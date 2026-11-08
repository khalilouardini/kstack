"""bin/resolve-identities: tracked logins, the host file that replaces them, refusals."""

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "bin" / "resolve-identities"
STACK = """\
stack: 2
project: acme  # the slug that names the state directory
gates:
  lint: make lint
identities:
  maintainer: owner-a
  reviewer: 'review-bot-a'   # quoted
  implementer: "build-bot-a"

protected_branches:
  - maintainer: not-this-one
"""
HOST = "maintainer: owner-b\nreviewer: review-bot-b\nimplementer: build-bot-b\n"
PROJECT_FORMS = {
    "plain": "project: acme\n",
    "double-quoted key": '"project": acme\n',
    "single-quoted key": "'project': acme\n",
    "space before the colon": "project : acme\n",
    "double-quoted value": 'project: "acme"\n',
    "single-quoted value and comment": "project: 'acme'  # slug\n",
}
IDENTITIES_FORMS = {
    "block": "identities:\n  maintainer: owner-a\n  reviewer: review-bot-a\n  implementer: build-bot-a\n",
    "quoted keys in a block": ('identities:\n  "maintainer": owner-a\n'
                               "  'reviewer': review-bot-a\n  implementer : build-bot-a\n"),
    "flow": "identities: {maintainer: owner-a, reviewer: review-bot-a, implementer: build-bot-a}\n",
    "flow with quotes, a trailing comma and a comment": (
        'identities: {"maintainer": "owner-a", \'reviewer\': \'review-bot-a\', implementer: build-bot-a,}  # logins\n'),
    "flow in JSON spacing": '"identities": {"maintainer":"owner-a","reviewer":"review-bot-a","implementer":"build-bot-a"}\n',
}
UNSUPPORTED_FORMS = {
    "identities alias": "project: acme\nidentities: *ids\n",
    "identities anchor": "project: acme\nidentities: &ids\n  maintainer: owner-a\n",
    "identities scalar": "project: acme\nidentities: owner-a\n",
    "multi-line flow": "project: acme\nidentities: {maintainer: owner-a,\n  reviewer: review-bot-a}\n",
    "nested flow": "project: acme\nidentities: {maintainer: {login: owner-a}}\n",
    "text after a flow mapping": "project: acme\nidentities: {maintainer: owner-a} extra\n",
    "login on the next line": "project: acme\nidentities:\n  maintainer:\n    owner-a\n",
    "login alias": "project: acme\nidentities:\n  maintainer: *owner\n",
    "merge key": "project: acme\nidentities:\n  <<: *ids\n",
    "sequence": "project: acme\nidentities:\n  - maintainer: owner-a\n",
    "text after a quoted login": "project: acme\nidentities:\n  maintainer: 'owner-a' b\n",
    "duplicate login": "project: acme\nidentities:\n  maintainer: owner-a\n  maintainer: owner-b\n",
    "duplicate project": "project: acme\nproject: other\n",
    "project on the next line": "project:\n  acme\n",
    "project anchor": "project: &slug acme\n",
    "whole-document flow": "{project: acme}\n",
    "top-level merge key": "<<: *defaults\nproject: acme\n",
    "escaped project key": '"pro\\u006aect": acme\n',
    "escaped identities key": '"identit\\u0069es": {maintainer: owner-a}\nproject: acme\n',
    "single-quoted key with an escaped quote": "'pro''ject': acme\n",
    "complex key": "? project\n: acme\n",
    "tagged key": "!!str project: acme\n",
    "anchored key": "&slug project: acme\n",
    "escaped project value": 'project: "ac\\u006de"\n',
    "escaped login": 'project: acme\nidentities:\n  maintainer: "owner\\u002da"\n',
    "project continued on the next line": "project: acme\n  more\n",
    "flow mapping continued on the next line": "project: acme\nidentities: {maintainer: owner-a}\n  reviewer: x\n",
    "colon inside a plain value": "project: acme: x\n",
    "line less indented than the first key": "  project: acme\nidentities: {}\n",
    "second document": "project: acme\n---\nidentities: {}\n",
    "content on the marker line": "--- {project: acme}\n",
    "stray text at the top level": "project: acme\nstray text\n",
}
# Lines the resolver must skip, because they cannot name `project` or `identities`.
OTHER_KEYS = {
    "plain keys": "gates:\n  lint: make lint\ndotted.key: x\nkey with spaces: y\n1: z\n",
    "sequence at the key's indent": "protected_branches:\n- main\n- demo/*\n",
    "quoted command": 'gates:\n  test: "pytest -k \\"not slow\\""\n',
    "flow value on several lines": "paths: [\n  a,\n  b,\n]\nmap: {\n  a: 1,\n}\n",
    "nested keys with the same names": "other:\n  project: wrong\n  identities:\n    maintainer: wrong\n",
    "block scalar": "notes: |\n  project: wrong\n  identities: wrong\n",
    "escaped quoted value": 'other: "a\\tb"\n',
}


class ResolveIdentities(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.root = Path(scratch.name)
        self.repo = self.root / "repo"
        self.state = self.root / "state"
        (self.repo / ".agents").mkdir(parents=True)
        self.write_stack(STACK)

    def write_stack(self, text):
        (self.repo / ".agents" / "stack.yml").write_text(text)

    def write_host(self, text, project="acme"):
        path = self.state / "projects" / project / "identities.yml"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return path

    def run_script(self, **env):
        base = {"PATH": os.environ["PATH"], "HOME": str(self.root / "home"), "KSTACK_STATE": str(self.state)}
        base.update(env)
        return subprocess.run([sys.executable, str(SCRIPT), "--repo", str(self.repo)],
                              capture_output=True, text=True, env=base)

    def resolved(self, **env):
        out = self.run_script(**env)
        self.assertEqual(out.returncode, 0, out.stderr)
        return json.loads(out.stdout)

    def assert_refused(self, *needles):
        out = self.run_script()
        self.assertEqual(out.returncode, 2, out.stdout)
        self.assertEqual(out.stdout, "")
        self.assertTrue(out.stderr.startswith("REFUSED: "), out.stderr)
        for needle in needles:
            self.assertIn(needle, out.stderr)

    def test_no_host_file_returns_the_tracked_block(self):
        self.assertEqual(self.resolved(), {
            "maintainer": "owner-a", "reviewer": "review-bot-a",
            "implementer": "build-bot-a", "source": ".agents/stack.yml"})

    def test_host_file_replaces_the_whole_block(self):
        host = self.write_host(HOST)
        self.assertEqual(self.resolved(), {
            "maintainer": "owner-b", "reviewer": "review-bot-b",
            "implementer": "build-bot-b", "source": str(host)})

    def test_host_file_of_another_project_is_ignored(self):
        self.write_host(HOST, project="other")
        self.assertEqual(self.resolved()["maintainer"], "owner-a")

    def test_state_defaults_to_home(self):
        home = self.root / "home"
        host = home / ".kstack" / "projects" / "acme" / "identities.yml"
        host.parent.mkdir(parents=True)
        host.write_text(HOST)
        self.assertEqual(self.resolved(KSTACK_STATE="")["source"], str(host))

    def test_host_file_accepts_comments_quotes_and_bot_suffix(self):
        self.write_host("# this Mac\nmaintainer: 'owner-b'\n\nreviewer: review[bot]  # app\nimplementer: \"build-bot-b\"\n")
        result = self.resolved()
        self.assertEqual((result["maintainer"], result["reviewer"], result["implementer"]),
                         ("owner-b", "review[bot]", "build-bot-b"))

    def test_partial_host_file_refuses_naming_the_key_and_file(self):
        host = self.write_host("maintainer: owner-b\nreviewer: review-bot-b\n")
        self.assert_refused("identities.implementer", str(host))

    def test_null_in_host_file_refuses(self):
        self.write_host("maintainer: owner-b\nreviewer: null\nimplementer: build-bot-b\n")
        self.assert_refused("identities.reviewer")

    def test_empty_host_file_refuses(self):
        self.write_host("")
        self.assert_refused("identities.maintainer")

    def test_unknown_key_refuses(self):
        self.write_host(HOST + "merger: owner-b\n")
        self.assert_refused("unknown key merger")

    def test_duplicate_key_refuses(self):
        self.write_host(HOST + "reviewer: review-bot-c\n")
        self.assert_refused("duplicate key reviewer")

    def test_indented_host_file_refuses(self):
        self.write_host("identities:\n  maintainer: owner-b\n")
        self.assert_refused("unknown key identities")

    def test_login_with_a_space_refuses(self):
        self.write_host("maintainer: owner b\nreviewer: review-bot-b\nimplementer: build-bot-b\n")
        self.assert_refused("identities.maintainer is not a GitHub login")

    def test_unreadable_host_path_refuses(self):
        host = self.state / "projects" / "acme" / "identities.yml"
        host.mkdir(parents=True)
        self.assert_refused("cannot read", str(host))

    def test_broken_symlink_refuses(self):
        host = self.state / "projects" / "acme" / "identities.yml"
        host.parent.mkdir(parents=True)
        host.symlink_to(self.root / "absent")
        self.assert_refused("cannot read", str(host))

    def test_missing_stack_file_refuses(self):
        (self.repo / ".agents" / "stack.yml").unlink()
        self.assert_refused(".agents/stack.yml")

    def test_project_that_escapes_the_state_directory_refuses(self):
        for project in ("../../elsewhere", "..", ".", "a/b", "a\\b"):
            with self.subTest(project):
                self.write_stack(STACK.replace("project: acme", f"project: {project}"))
                self.assert_refused("cannot name a state directory")

    def test_no_project_uses_the_tracked_block(self):
        self.write_stack(STACK.replace("project: acme", "project: null"))
        self.write_host(HOST)
        self.assertEqual(self.resolved()["source"], ".agents/stack.yml")

    def test_null_tracked_logins_stay_null(self):
        self.write_stack("project: acme\nidentities:\n  maintainer: owner-a\n  reviewer: null\n  implementer: ~\n")
        result = self.resolved()
        self.assertEqual((result["maintainer"], result["reviewer"], result["implementer"]),
                         ("owner-a", None, None))

    def test_absent_tracked_block_prints_nulls(self):
        self.write_stack("project: acme\n")
        result = self.resolved()
        self.assertEqual((result["maintainer"], result["reviewer"], result["implementer"]),
                         (None, None, None))

    def test_unfilled_template_returns_tracked_nulls(self):
        self.write_stack((REPO / "project-template" / "stack.yml").read_text())
        self.assertEqual(self.resolved(), {
            "maintainer": None, "reviewer": None, "implementer": None, "source": ".agents/stack.yml"})

    def test_this_repository_stack_file_parses(self):
        self.write_stack((REPO / ".agents" / "stack.yml").read_text())
        result = self.resolved()
        self.assertTrue(result["maintainer"] and result["reviewer"] and result["implementer"])

    def test_every_identities_form_returns_the_tracked_logins(self):
        for name, identities in IDENTITIES_FORMS.items():
            with self.subTest(name):
                self.write_stack("project: acme\n" + identities)
                result = self.resolved()
                self.assertEqual((result["maintainer"], result["reviewer"], result["implementer"]),
                                 ("owner-a", "review-bot-a", "build-bot-a"))

    def test_every_project_form_finds_the_host_file(self):
        host = self.write_host(HOST)
        for name, project in PROJECT_FORMS.items():
            with self.subTest(name):
                self.write_stack(project + IDENTITIES_FORMS["block"])
                self.assertEqual(self.resolved()["source"], str(host))

    def test_document_framing_does_not_change_the_result(self):
        host = self.write_host(HOST)
        body = PROJECT_FORMS["plain"] + IDENTITIES_FORMS["block"]
        indented = "".join(f"  {line}\n" for line in body.splitlines())
        framings = {"marker": "---\n" + body, "marker and comment": "--- # stack\n" + body,
                    "directive": "%YAML 1.1\n---\n" + body, "whole document indented": indented,
                    "marker before an indented document": "---\n" + indented}
        for name, text in framings.items():
            with self.subTest(name):
                self.write_stack(text)
                self.assertEqual(self.resolved()["source"], str(host))

    def test_byte_order_mark_does_not_hide_the_first_key(self):
        host = self.write_host(HOST)
        (self.repo / ".agents" / "stack.yml").write_bytes(
            b"\xef\xbb\xbf" + (PROJECT_FORMS["plain"] + IDENTITIES_FORMS["block"]).encode())
        self.assertEqual(self.resolved()["source"], str(host))

    def test_other_keys_are_skipped_in_any_position(self):
        host = self.write_host(HOST)
        body = PROJECT_FORMS["plain"] + IDENTITIES_FORMS["block"]
        for name, other in OTHER_KEYS.items():
            for text in (other + body, body + other):
                with self.subTest(name, text=text):
                    self.write_stack(text)
                    self.assertEqual(self.resolved()["source"], str(host))
                    (host.parent / "off").write_text(host.read_text())
                    host.unlink()
                    result = self.resolved()
                    self.assertEqual((result["maintainer"], result["source"]), ("owner-a", ".agents/stack.yml"))
                    (host.parent / "off").rename(host)

    def test_empty_identities_forms_return_nulls(self):
        for identities in ("identities: {}\n", "identities: null\n", "identities:  # none\n"):
            with self.subTest(identities):
                self.write_stack("project: acme\n" + identities)
                result = self.resolved()
                self.assertEqual((result["maintainer"], result["reviewer"], result["implementer"]),
                                 (None, None, None))

    @unittest.skipUnless(shutil.which("ruby"), "ruby is the YAML parser this test compares against")
    def test_supported_forms_match_a_yaml_parser(self):
        program = 'require "yaml"; require "json"; puts JSON.dump(YAML.safe_load(ARGF.read))'
        for identities in IDENTITIES_FORMS.values():
            for project in PROJECT_FORMS.values():
                text = project + identities
                parsed = json.loads(subprocess.run(["ruby", "-e", program], input=text, text=True,
                                                   capture_output=True, check=True).stdout)
                self.write_stack(text)
                result = self.resolved()
                self.assertEqual(parsed["project"], "acme")
                self.assertEqual(parsed["identities"], {role: result[role] for role in parsed["identities"]})

    def test_forms_outside_the_supported_set_refuse(self):
        for name, text in UNSUPPORTED_FORMS.items():
            with self.subTest(name):
                self.write_stack(text)
                self.assert_refused(".agents/stack.yml", "line ")

    def test_resolved_logins_are_accepted_by_the_review_route(self):
        sys.path.insert(0, str(REPO / "tools" / "github" / "pr-loop" / "lib"))
        import review_runtime as rt
        self.addCleanup(sys.path.pop, 0)
        self.write_host(HOST)
        result = self.resolved()
        head = "a" * 40
        pr = {"number": 1, "commits": 1, "head": {"sha": head}, "user": {"login": result["maintainer"]}}
        commit = {"sha": head, "author": {"login": result["maintainer"]},
                  "commit": {"message": "x\n\nCo-Authored-By: Claude Opus <noreply@example.com>"}}
        route = rt.resolve(result["maintainer"], result["reviewer"], result["implementer"], pr, [commit])
        self.assertEqual((route["reviewer"], route["implementer"]), ("review-bot-b", "build-bot-b"))


class SkillsReadTheResolver(unittest.TestCase):
    def test_every_skill_that_names_identities_calls_the_resolver(self):
        # router/stack only explains the review split and reads no login.
        skills = [p for tier in ("core", "roles", "tools") for p in (REPO / tier).rglob("SKILL.md")]
        readers = [p for p in skills if re.search(r"`identities\.", p.read_text())]
        self.assertGreaterEqual(len(readers), 6)
        missing = [str(p.relative_to(REPO)) for p in readers if "bin/resolve-identities" not in p.read_text()]
        self.assertEqual(missing, [])

    def test_the_review_contract_names_the_resolver(self):
        self.assertIn("bin/resolve-identities",
                      (REPO / "tools" / "github" / "pr-loop" / "references" / "routing.md").read_text())


if __name__ == "__main__":
    unittest.main()
