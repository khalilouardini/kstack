"""Exercise the localhost HTTP contract with a fake GitHub CLI on PATH."""

from contextlib import closing
from datetime import datetime
from http.client import HTTPConnection
import json
import os
from pathlib import Path
import selectors
import shutil
import subprocess
import sys
import tempfile
import unittest
from urllib.parse import parse_qs, urlencode, urlsplit


SERVER = Path(__file__).resolve().parents[1] / "bin" / "decision-queue"
FAKE_GH = Path(__file__).with_name("fake_gh.py")
REPO = "example/queue-fixture"
LOGIN = "tracked-maintainer"
PROJECT = "queue-fixture"
TITLE = "<script>window.queueInjected=true</script>"


def pr(number=1, **fields):
    return {
        "number": number,
        "title": f"Pull request {number}",
        "author": {"login": "fixture-author"},
        "createdAt": f"2026-01-{number:02d}T00:00:00Z",
        "isDraft": False,
        "mergeable": "MERGEABLE",
        "headRefOid": f"{number:040x}",
        "isMergeQueueEnabled": False,
        "body": "",
        **fields,
    }


def check(bucket, name="lint + tests"):
    return {"name": name, "bucket": bucket}


def comment(kind, body):
    return {"user": {"type": kind}, "body": body}


class DecisionQueueTest(unittest.TestCase):
    def setUp(self):
        scratch = tempfile.TemporaryDirectory()
        self.addCleanup(scratch.cleanup)
        self.root = Path(scratch.name)
        self.state = self.root / "state"
        self.fixture = self.root / "fixture.json"
        self.calls_file = self.root / "calls.jsonl"
        self.log_file = self.state / "projects" / PROJECT / "decision-queue" / "decisions.jsonl"
        fake_gh = self.root / "gh"
        shutil.copyfile(FAKE_GH, fake_gh)
        fake_gh.chmod(0o700)
        self.env = {
            **os.environ,
            "PATH": os.pathsep.join((str(self.root), os.environ["PATH"])),
            "KSTACK_STATE": str(self.state),
            "QUEUE_TEST_FIXTURE": str(self.fixture),
            "QUEUE_TEST_CALLS": str(self.calls_file),
            "GH_TOKEN": "unrelated-ambient-token",
        }
        self.data = {"rows": [pr()]}
        self.save()

    def save(self):
        new_fixture = self.fixture.with_suffix(".new")
        new_fixture.write_text(json.dumps(self.data), encoding="utf-8")
        new_fixture.replace(self.fixture)

    def arguments(self, scope="all", merge_method="squash"):
        args = [
            sys.executable, str(SERVER), "--project", PROJECT,
            "--ci-checks", scope, "--maintainer", LOGIN, "--repo", REPO,
        ]
        if merge_method is not None:
            args.extend(("--merge-method", merge_method))
        return args

    def start(self, scope="all", merge_method="squash"):
        stderr = tempfile.TemporaryFile(mode="w+t")
        self.addCleanup(stderr.close)
        process = subprocess.Popen(
            self.arguments(scope, merge_method),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=stderr,
            env=self.env,
            text=True,
        )

        def stop():
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
            process.stdout.close()

        self.addCleanup(stop)
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            self.assertTrue(selector.select(timeout=10), "Server did not print its URL")
        address = process.stdout.readline().strip()
        if not address:
            stderr.seek(0)
            self.fail(f"Server exited before printing its URL: {stderr.read()}")
        url = urlsplit(address)
        self.assertEqual((url.scheme, url.hostname), ("http", "127.0.0.1"))
        self.host = url.hostname
        self.port = url.port
        self.origin = f"http://{self.host}:{self.port}"
        self.token = parse_qs(url.query)["token"][0]

    def request(self, path, payload=None, *, token=True, headers=None):
        if token:
            path += "?" + urlencode({"token": self.token})
        request_headers = {} if payload is None else {
            "Content-Type": "application/json",
            "Origin": self.origin,
        }
        request_headers.update(headers or {})
        with closing(HTTPConnection(self.host, self.port, timeout=40)) as connection:
            connection.request(
                "GET" if payload is None else "POST",
                path,
                None if payload is None else json.dumps(payload).encode("utf-8"),
                request_headers,
            )
            response = connection.getresponse()
            body = response.read().decode("utf-8")
            if response.headers.get_content_type() == "application/json":
                body = json.loads(body)
            return response.status, body

    def queue(self):
        status, result = self.request("/api/queue")
        self.assertEqual(status, 200, result)
        return result

    def action(self, snapshot, action, number=1, note=""):
        return self.request("/api/actions", {
            "snapshot_id": snapshot["snapshot_id"], "number": number, "action": action, "note": note,
        })

    def prepare(self, snapshot, action, number=1):
        status, result = self.action(snapshot, action, number)
        self.assertIn(status, (200, 202), result)
        return result["action_id"]

    def confirm(self, action_id):
        return self.request("/api/actions", {"action_id": action_id})

    @staticmethod
    def read_jsonl(path):
        if path.exists():
            return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
        return []

    def calls(self):
        return self.read_jsonl(self.calls_file)

    def writes(self):
        return [call for call in self.calls() if call["write"]]

    def test_merge_eligibility_and_order_follow_ci_gate(self):
        self.data["rows"] = [
            pr(1), pr(2), pr(3), pr(4), pr(5), pr(6), pr(7, isDraft=True),
            pr(8, mergeable="CONFLICTING"), pr(9, mergeable="UNKNOWN"), pr(10),
        ]
        self.data["checks"] = {
            "1": [check("fail")],
            "3": {"checks": [check("pending")], "exit_code": 8},
            "4": {"checks": [check("pending"), check("cancel", "build")], "exit_code": 1},
            "5": [],
            "6": [check("skipping")],
            "10": None,
        }
        self.save()
        self.start(scope="required")
        snapshot = self.queue()
        rows = snapshot["rows"]
        self.assertEqual([row["number"] for row in rows], [2, 6, 7, 8, 9, 3, 1, 4, 5, 10])
        for row in rows:
            with self.subTest(pr=row["number"]):
                expected = {"close", "comment"}
                if row["number"] in (2, 6):
                    expected.add("merge")
                else:
                    status, _ = self.action(snapshot, "merge", row["number"])
                    self.assertGreaterEqual(status, 400)
                self.assertEqual(set(row["actions"]), expected)
                self.assertEqual(row["review"], "UNKNOWN")
        check_calls = [call["args"] for call in self.calls() if call["args"][:2] == ["pr", "checks"]]
        self.assertEqual(len(check_calls), len(rows))
        self.assertTrue(all("--required" in args for args in check_calls))
        self.assertEqual(self.writes(), [])

    def test_first_merge_request_runs_no_cli_and_confirm_is_single_use(self):
        self.start()
        snapshot = self.queue()
        calls_before = self.calls()
        action_id = self.prepare(snapshot, "merge")
        self.assertEqual(self.calls(), calls_before)
        self.assertEqual(self.read_jsonl(self.log_file), [])
        status, result = self.confirm(action_id)
        self.assertEqual(status, 200, result)
        status, _ = self.confirm(action_id)
        self.assertGreaterEqual(status, 400)
        writes = self.writes()
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0]["args"], [
            "pr", "merge", "1", "--repo", REPO, "--squash", "--match-head-commit", pr()["headRefOid"],
        ])
        self.assertEqual(writes[0]["token"], f"stub-token-for-{LOGIN}")
        self.assertFalse(writes[0]["in_checkout"])
        log, = self.read_jsonl(self.log_file)
        self.assertEqual(log["action"], "merge")
        self.assertEqual(log["gh_exit_code"], 0)

    def test_close_and_comment_bind_override_and_log_decisions(self):
        override = self.state / "projects" / PROJECT / "identities.yml"
        override.parent.mkdir(parents=True)
        override.write_text(
            "maintainer: host-maintainer\nreviewer: host-reviewer\nimplementer: host-implementer\n",
            encoding="utf-8",
        )
        self.data["rows"].append(pr(2))
        self.save()
        self.start()
        snapshot = self.queue()
        calls_before = self.calls()
        action_id = self.prepare(snapshot, "close")
        self.assertEqual(self.calls(), calls_before)
        status, result = self.confirm(action_id)
        self.assertEqual(status, 200, result)
        note = "One line\nSecond line; $(this is plain text)"
        status, result = self.action(snapshot, "comment", 2, note)
        self.assertEqual(status, 200, result)
        close, post = self.writes()
        self.assertEqual(close["args"], ["pr", "close", "1", "--repo", REPO])
        self.assertEqual(post["args"], ["pr", "comment", "2", "--repo", REPO, "--body-file", "-"])
        self.assertEqual(post["stdin"], note)
        for write in (close, post):
            self.assertEqual(write["token"], "stub-token-for-host-maintainer")
            self.assertFalse(write["in_checkout"])
        calls = self.calls()
        for write in (close, post):
            idx = calls.index(write)
            self.assertEqual(calls[idx - 1]["args"], ["api", "user", "--hostname", "github.com", "--jq", ".login"])
            self.assertEqual(calls[idx - 1]["token"], write["token"])
            self.assertEqual(calls[idx - 2]["args"], [
                "auth", "token", "--hostname", "github.com", "--user", "host-maintainer",
            ])
        entries = self.read_jsonl(self.log_file)
        self.assertEqual(len(entries), 2)
        for entry, number, action, expected_note in zip(entries, (1, 2), ("close", "comment"), ("", note)):
            self.assertIsNotNone(datetime.fromisoformat(entry["timestamp"]).tzinfo)
            self.assertEqual(
                (entry["repository"], entry["pr_number"], entry["head_sha"], entry["action"], entry["note"],
                 entry["gh_exit_code"]),
                (REPO, number, pr(number)["headRefOid"], action, expected_note, 0),
            )

    def test_rejects_missing_token_foreign_host_and_foreign_origin(self):
        self.start()
        payload = {"action_id": self.prepare(self.queue(), "close")}
        calls_before = self.calls()
        cases = [
            ("/api/queue", None, False, {}),
            ("/api/queue", None, True, {"Host": f"foreign.example:{self.port}"}),
            ("/api/actions", payload, False, {}),
            ("/api/actions", payload, True, {"Origin": "https://foreign.example"}),
            ("/api/actions", payload, True, {"Origin": ""}),
        ]
        for path, body, token, headers in cases:
            with self.subTest(path=path, token=token, headers=headers):
                status, _ = self.request(path, body, token=token, headers=headers)
                self.assertIn(status, (400, 403, 421))
        self.assertEqual(self.calls(), calls_before)
        status, result = self.confirm(payload["action_id"])
        self.assertEqual(status, 200, result)
        self.assertEqual(len(self.writes()), 1)

    def test_changed_head_blocks_merge(self):
        self.start()
        snapshot = self.queue()
        self.data["current"] = {"1": {"headRefOid": "f" * 40}}
        self.save()
        status, _ = self.confirm(self.prepare(snapshot, "merge"))
        self.assertGreaterEqual(status, 400)
        self.assertEqual(self.writes(), [])

    def test_changed_checks_block_merge_even_if_still_passing(self):
        self.start()
        action_id = self.prepare(self.queue(), "merge")
        self.data["checks"] = {"1": [check("pass"), check("skipping", "docs")]}
        self.save()
        status, _ = self.confirm(action_id)
        self.assertGreaterEqual(status, 400)
        self.assertEqual(self.writes(), [])

    def test_merge_queue_is_refused_after_confirmation_if_base_policy_changes(self):
        self.start()
        action_id = self.prepare(self.queue(), "merge")
        self.data["current"] = {"1": {"isMergeQueueEnabled": True}}
        self.save()
        status, _ = self.confirm(action_id)
        self.assertGreaterEqual(status, 400)
        self.assertEqual(self.writes(), [])

    def test_missing_merge_method_keeps_other_actions_available(self):
        self.start(merge_method=None)
        snapshot = self.queue()
        self.assertIn("merge.method", snapshot["merge_notice"])
        self.assertEqual(set(snapshot["rows"][0]["actions"]), {"close", "comment"})
        status, _ = self.action(snapshot, "merge")
        self.assertGreaterEqual(status, 400)
        self.assertEqual(self.writes(), [])

    def test_none_scope_enables_merge_without_reading_checks(self):
        self.data["checks"] = {"1": [check("fail")]}
        self.save()
        self.start(scope="none")
        snapshot = self.queue()
        self.assertIn("merge", snapshot["rows"][0]["actions"])
        status, result = self.confirm(self.prepare(snapshot, "merge"))
        self.assertEqual(status, 200, result)
        self.assertFalse(any(call["args"][:2] == ["pr", "checks"] for call in self.calls()))

    def test_missing_or_wrong_token_actor_refuses_write(self):
        self.start()
        snapshot = self.queue()
        for failure in ({"no_token": True}, {"actor": "different-user"}):
            with self.subTest(failure=failure):
                self.data = {"rows": [pr()], **failure}
                self.save()
                status, result = self.action(snapshot, "comment", note="A note")
                self.assertGreaterEqual(status, 400)
                self.assertIn(LOGIN, str(result))
        self.assertEqual(self.writes(), [])

    def test_failed_cli_write_is_logged_with_exit_code(self):
        self.data["write_exit_code"] = 7
        self.save()
        self.start()
        status, _ = self.action(self.queue(), "comment", note="Failed note")
        self.assertGreaterEqual(status, 400)
        log, = self.read_jsonl(self.log_file)
        self.assertEqual((log["action"], log["note"], log["gh_exit_code"]), ("comment", "Failed note", 7))

    def test_screenshot_indicator_counts_body_and_human_comments_only(self):
        self.data["rows"] = [
            pr(1, body="![Description](https://example.com/image.png)"),
            pr(2),
            pr(3),
            pr(4, body="<video controls></video>"),
            pr(5, body="https://github.com/user-attachments/assets/1"),
            pr(6, body="https://notgithub.com/user-attachments/assets/1"),
        ]
        self.data["comments"] = {
            "2": [[comment("Bot", "<img src='bot.png'>")]],
            "3": [[comment("Bot", "<video></video>")], [comment("User", "<img src='human.png'>")]],
        }
        self.save()
        self.start()
        self.assertEqual(
            [row["screenshot"] for row in self.queue()["rows"]],
            [True, False, True, True, True, False],
        )

    def test_answered_findings_describe_last_ledger_head_with_review_unknown(self):
        self.data["rows"] = [pr(1), pr(2), pr(3)]
        self.save()
        ledger = self.state / "pr-loop"
        ledger.mkdir(parents=True)
        stem = REPO.replace("/", "-")
        (ledger / f"{stem}-1").write_text(
            "earlier\tfirst\n" + pr(1)["headRefOid"] + "\tsecond\n", encoding="utf-8",
        )
        (ledger / f"{stem}-2").write_text(
            pr(2)["headRefOid"] + "\tfirst\nearlier\tsecond\n", encoding="utf-8",
        )
        self.start()
        self.assertEqual(
            [(row["review"], row["answered_findings"]) for row in self.queue()["rows"]],
            [("UNKNOWN", "Current head"), ("UNKNOWN", "Earlier head"), ("UNKNOWN", None)],
        )

    def test_script_title_is_data_and_the_page_uses_text_rendering(self):
        self.data["rows"] = [pr(title=TITLE)]
        self.save()
        self.start()
        status, document = self.request("/")
        self.assertEqual(status, 200)
        self.assertNotIn(TITLE, document)
        self.assertNotIn("innerHTML", document)
        self.assertNotIn("insertAdjacentHTML", document)
        self.assertIn("textContent", document)
        self.assertEqual(self.queue()["rows"][0]["title"], TITLE)

    def test_missing_required_flags_name_the_config_keys(self):
        for flag, key in (
            ("--project", "project"),
            ("--ci-checks", "ci.checks"),
            ("--maintainer", "identities.maintainer"),
            ("--repo", "--repo"),
        ):
            with self.subTest(flag=flag):
                args = self.arguments()
                index = args.index(flag)
                del args[index:index + 2]
                result = subprocess.run(args, capture_output=True, text=True, timeout=10, env=self.env)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(key, result.stderr)
        self.assertEqual(self.calls(), [])


if __name__ == "__main__":
    unittest.main()
