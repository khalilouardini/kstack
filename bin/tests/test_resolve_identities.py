"""bin/resolve-identities: tracked logins, the host file that replaces them, refusals."""

import json
import os
from pathlib import Path
import re
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
        self.write_stack(STACK.replace("project: acme", "project: ../../elsewhere"))
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

    def test_project_template_identities_parse_as_all_null(self):
        template = (REPO / "project-template" / "stack.yml").read_text()
        self.assertIn("project: <slug>", template)
        self.write_stack(template.replace("project: <slug>", "project: acme"))
        result = self.resolved()
        self.assertEqual((result["maintainer"], result["reviewer"], result["implementer"]),
                         (None, None, None))

    def test_unfilled_template_project_refuses(self):
        self.write_stack((REPO / "project-template" / "stack.yml").read_text())
        self.assert_refused("project '<slug>'")

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
