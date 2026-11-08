"""bin/resolve-identities: the host file that replaces the identities block, and its refusals."""

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
HOST = "maintainer: owner-b\nreviewer: review-bot-b\nimplementer: build-bot-b\n"
INVALID_HOST_FILES = {
    "missing role": ("maintainer: owner-b\nreviewer: review-bot-b\n", "identities.implementer is missing"),
    "empty file": ("", "identities.maintainer is missing"),
    "null login": ("maintainer: owner-b\nreviewer: null\nimplementer: build-bot-b\n", "identities.reviewer"),
    "empty login": ("maintainer:\nreviewer: review-bot-b\nimplementer: build-bot-b\n", "expected an unindented"),
    "unknown key": (HOST + "merger: owner-b\n", "unknown key merger"),
    "duplicate key": (HOST + "reviewer: review-bot-c\n", "duplicate key reviewer"),
    "nested block": ("identities:\n  maintainer: owner-b\n", "expected an unindented"),
    "indented line": ("  maintainer: owner-b\nreviewer: review-bot-b\nimplementer: build-bot-b\n", "expected an unindented"),
    "login with a space": ("maintainer: owner b\nreviewer: review-bot-b\nimplementer: build-bot-b\n", "expected an unindented"),
    "quoted login": ("maintainer: 'owner-b'\nreviewer: review-bot-b\nimplementer: build-bot-b\n", "identities.maintainer"),
    "flow mapping": ("{maintainer: owner-b, reviewer: review-bot-b, implementer: build-bot-b}\n", "expected an unindented"),
}


class ResolveIdentities(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.root = Path(scratch.name)
        self.state = self.root / "state"

    def write_host(self, text, project="acme"):
        path = self.state / "projects" / project / "identities.yml"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return path

    def run_script(self, project="acme", **env):
        base = {"PATH": os.environ["PATH"], "HOME": str(self.root / "home"), "KSTACK_STATE": str(self.state)}
        base.update(env)
        return subprocess.run([sys.executable, str(SCRIPT), "--project", project],
                              capture_output=True, text=True, env=base)

    def resolved(self, project="acme", **env):
        out = self.run_script(project, **env)
        self.assertEqual(out.returncode, 0, out.stderr)
        return json.loads(out.stdout)

    def assert_refused(self, project="acme", *needles):
        out = self.run_script(project)
        self.assertEqual(out.returncode, 2, out.stdout)
        self.assertEqual(out.stdout, "")
        self.assertTrue(out.stderr.startswith("REFUSED: "), out.stderr)
        for needle in needles:
            self.assertIn(needle, out.stderr)

    def test_no_host_file_prints_null(self):
        self.assertIsNone(self.resolved())

    def test_host_file_replaces_the_whole_block(self):
        host = self.write_host(HOST)
        self.assertEqual(self.resolved(), {
            "maintainer": "owner-b", "reviewer": "review-bot-b",
            "implementer": "build-bot-b", "source": str(host)})

    def test_host_file_of_another_project_is_ignored(self):
        self.write_host(HOST, project="other")
        self.assertIsNone(self.resolved())

    def test_state_defaults_to_home(self):
        host = self.root / "home" / ".kstack" / "projects" / "acme" / "identities.yml"
        host.parent.mkdir(parents=True)
        host.write_text(HOST)
        self.assertEqual(self.resolved(KSTACK_STATE="")["source"], str(host))

    def test_host_file_accepts_comments_blank_lines_and_a_bot_suffix(self):
        self.write_host("# this machine\nmaintainer: owner-b\n\nreviewer: review[bot]  # app\nimplementer: build-bot-b\n")
        result = self.resolved()
        self.assertEqual((result["maintainer"], result["reviewer"], result["implementer"]),
                         ("owner-b", "review[bot]", "build-bot-b"))

    def test_byte_order_mark_does_not_hide_the_first_role(self):
        host = self.state / "projects" / "acme" / "identities.yml"
        host.parent.mkdir(parents=True)
        host.write_bytes(b"\xef\xbb\xbf" + HOST.encode())
        self.assertEqual(self.resolved()["maintainer"], "owner-b")

    def test_invalid_host_files_refuse_naming_the_file(self):
        for name, (text, needle) in INVALID_HOST_FILES.items():
            with self.subTest(name):
                host = self.write_host(text)
                self.assert_refused("acme", needle, str(host))

    def test_unreadable_host_path_refuses(self):
        host = self.state / "projects" / "acme" / "identities.yml"
        host.mkdir(parents=True)
        self.assert_refused("acme", "cannot read", str(host))

    def test_broken_symlink_refuses(self):
        host = self.state / "projects" / "acme" / "identities.yml"
        host.parent.mkdir(parents=True)
        host.symlink_to(self.root / "absent")
        self.assert_refused("acme", "cannot read", str(host))

    def test_project_that_escapes_the_state_directory_refuses(self):
        for project in ("../../elsewhere", "..", ".", "a/b", "a\\b"):
            with self.subTest(project):
                self.assert_refused(project, "cannot name a state directory")

    def test_empty_project_prints_null(self):
        self.write_host(HOST)
        self.assertIsNone(self.resolved(""))

    def test_unfilled_template_project_prints_null(self):
        self.assertIsNone(self.resolved("<slug>"))

    def test_project_is_required(self):
        out = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True)
        self.assertEqual(out.returncode, 2)
        self.assertEqual(out.stdout, "")

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

    def test_no_document_still_uses_the_removed_repo_flag(self):
        documents = [REPO / "CONVENTIONS.md", *(p for tier in ("core", "roles", "tools") for p in (REPO / tier).rglob("*.md"))]
        stale = [str(p.relative_to(REPO)) for p in documents if re.search(r"resolve-identities\"? --repo", p.read_text())]
        self.assertEqual(stale, [])

    def test_the_review_contract_names_the_resolver(self):
        self.assertIn("bin/resolve-identities",
                      (REPO / "tools" / "github" / "pr-loop" / "references" / "routing.md").read_text())


if __name__ == "__main__":
    unittest.main()
