"""Black-box checks for the roadmap's eval publication gate."""

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
EXAMPLE = json.loads((SKILL / "references/eval-example.json").read_text())


class EvalContracts(unittest.TestCase):
    def run_check(self, plan):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "plan.json"
            path.write_text(json.dumps(plan))
            return subprocess.run(
                [sys.executable, str(SKILL / "bin/check-evals"), str(path)],
                capture_output=True, text=True,
            )

    def test_unit_and_session_release_contracts_are_supported(self):
        result = self.run_check(EXAMPLE)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("2/2", result.stdout)
        self.assertIn("1 proposed", result.stdout)

    def test_every_ticket_kind_requires_its_own_eval(self):
        for kind in ("unit", "release", "group", "decision", "documentation", "research"):
            with self.subTest(kind=kind):
                plan = copy.deepcopy(EXAMPLE)
                plan["tickets"].append({"key": "missing", "kind": kind, "outcome": "Record the agreed decision."})
                self.assertEqual(self.run_check(plan).returncode, 1)

    def test_incomplete_eval_cannot_hide_behind_another_ticket(self):
        for field in ("inputs", "procedure", "pass_condition", "evidence", "failure_check", "runner", "baseline"):
            with self.subTest(field=field):
                plan = copy.deepcopy(EXAMPLE)
                del plan["tickets"][1]["evals"][0][field]
                result = self.run_check(plan)
                self.assertEqual(result.returncode, 1)
                self.assertIn(field, result.stderr)

    def test_unknown_threshold_and_placeholder_are_rejected(self):
        plan = copy.deepcopy(EXAMPLE)
        plan["tickets"][1]["evals"][0]["threshold_source"] = {"status": "approved-later", "source": "TBD"}
        self.assertEqual(self.run_check(plan).returncode, 1)

    def test_duplicate_keys_and_eval_ids_are_rejected(self):
        plan = copy.deepcopy(EXAMPLE)
        plan["tickets"].append(copy.deepcopy(plan["tickets"][0]))
        self.assertEqual(self.run_check(plan).returncode, 1)
        plan = copy.deepcopy(EXAMPLE)
        plan["tickets"][0]["evals"].append(copy.deepcopy(plan["tickets"][0]["evals"][0]))
        self.assertEqual(self.run_check(plan).returncode, 1)

    def test_empty_and_malformed_inventories_fail_without_traceback(self):
        for plan in (None, [], {}, {"tickets": []}, {"tickets": [None]}, {"tickets": [{"evals": [False]}]}):
            with self.subTest(plan=plan):
                result = self.run_check(plan)
                self.assertEqual(result.returncode, 1)
                self.assertNotIn("Traceback", result.stderr)

    def test_missing_and_malformed_files_return_input_error(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "missing.json"
            command = [sys.executable, str(SKILL / "bin/check-evals"), str(path)]
            self.assertEqual(subprocess.run(command, capture_output=True).returncode, 2)
            path.write_text("{not json}")
            self.assertEqual(subprocess.run(command, capture_output=True).returncode, 2)


if __name__ == "__main__":
    unittest.main()
