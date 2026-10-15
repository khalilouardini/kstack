"""Regression probes from PR feedback; no live service calls."""
from copy import deepcopy
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from fixture_model import review_status, select_projects
from test_triage import ROOT, load_cases


class InventoryCommand(unittest.TestCase):
    def run_inventory(self, payload, status=0):
        skill = (ROOT / 'roles/triage/SKILL.md').read_text()
        start = skill.index('gh api --paginate --slurp')
        end = skill.index('git branch --no-merged', start)
        with tempfile.TemporaryDirectory() as scratch:
            fake = Path(scratch) / 'gh'
            fake.write_text('#!/usr/bin/env python3\nimport os,sys\n'
                            'print(os.environ["TRIAGE_FAKE_PAYLOAD"])\n'
                            'sys.exit(int(os.environ["TRIAGE_FAKE_STATUS"]))\n')
            fake.chmod(0o755)
            env = dict(os.environ, SCRATCH=scratch,
                       PATH=scratch+os.pathsep+os.environ['PATH'],
                       TRIAGE_FAKE_PAYLOAD=payload, TRIAGE_FAKE_STATUS=str(status))
            return subprocess.run(['bash','-c',skill[start:end]], env=env,
                                  capture_output=True, text=True)

    def test_http_error_exits_before_counting(self):
        result = self.run_inventory('[{"message":"Not Found","status":"404"}]', 1)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('open PRs', result.stdout)

    def test_successful_malformed_pages_are_not_counts(self):
        for payload in ['[{"message":"Not Found","status":"404"}]',
                        '{"message":"Not Found"}', '[[],{}]', '[[]] trailing']:
            with self.subTest(payload=payload):
                result = self.run_inventory(payload)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn('open PRs', result.stdout)

    def test_complete_pages_and_empty_inventory(self):
        for payload, count in [('[ [{"number":11}], [{"number":12}]]', 2), ('[[]]', 0)]:
            with self.subTest(payload=payload):
                result = self.run_inventory(payload)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.strip(), str(count)+' open PRs')


class ReviewRegression(unittest.TestCase):
    def test_pending_and_dismissed_reviews_do_not_clear_current_head(self):
        for state in ['PENDING', 'DISMISSED']:
            facts = deepcopy(load_cases('reviews')[0]['facts'])
            facts['reviews'][0]['nodes'][0]['state'] = state
            self.assertFalse(review_status(facts)['merge_gate'])

    def test_ledger_availability_changes_provenance_only(self):
        facts = deepcopy(load_cases('reviews')[0]['facts'])
        facts['ledger_available'] = False
        absent = review_status(facts)
        facts['ledger_available'] = True
        present = review_status(facts)
        self.assertEqual(absent['ledger_status'], 'unavailable')
        self.assertEqual(present['ledger_status'], 'available')
        for key in ['loop', 'review', 'merge_gate']:
            self.assertEqual(absent[key], present[key])

    def test_terminal_container_provenance_is_retained(self):
        facts = deepcopy(load_cases('projects')[0]['facts'])
        result = select_projects(facts)
        self.assertIn(14, result['selected'])
        evidence = result['selection_evidence']['14'][0]
        self.assertEqual(evidence['state'], 'Done')
        self.assertTrue(evidence['container'])
        for issue in facts['issues']:
            if issue['id'] == 'container-a':
                issue.update(state='Open', container=False)
        changed = select_projects(facts)
        self.assertEqual(changed['selected'], result['selected'])
        self.assertEqual(changed['selection_evidence']['14'][0]['state'], 'Open')
        self.assertFalse(changed['selection_evidence']['14'][0]['container'])

    def test_label_exclusion_skips_unavailable_per_pr_mapping(self):
        facts = deepcopy(load_cases('projects')[0]['facts'])
        facts['labels'] = ['release']
        facts['prs'][0]['links'] = [{'kind':'direct', 'issue':'missing'}]
        result = select_projects(facts)
        self.assertEqual(result['selected'], [14])
        self.assertEqual(result['excluded']['label-only or both'], 2)


class SharedReferences(unittest.TestCase):
    def test_consumers_reference_shared_contracts(self):
        for shared, consumers, headings in [
            ('tools/linear/next/references/project-resolution.md',
             ['tools/linear/next/SKILL.md','roles/triage/references/project-filter.md'],
             ['## Access and team', '## Resolve projects', '## Verify issue membership']),
            ('tools/linear/next/references/pr-file-snapshot.md',
             ['tools/linear/next/SKILL.md','roles/triage/references/pr-status.md'],
             ['## Collect', '## Verify stability and completeness']),
        ]:
            contract = (ROOT / shared).read_text()
            for heading in headings:
                self.assertIn(heading, contract)
            for consumer in consumers:
                self.assertIn(shared, (ROOT / consumer).read_text())
        self.assertNotIn('first two paragraphs', (ROOT / 'roles/triage/references/project-filter.md').read_text())

    def test_review_contract_anchors_exist(self):
        anchors = {
            'tools/github/pr-loop/SKILL.md': ['## Configuration', '## The round',
                '**1. Skip-check', '**3. Read the findings.', '**3a. CI gate',
                '## Exit gates', '## Resuming after `ROUNDS_EXHAUSTED`', '## Merging'],
            'tools/github/review-claude-pr/SKILL.md': ['Priority meanings:',
                '<!-- codex-review head:<full-head-sha> -->', 'After posting, fetch'],
            'tools/github/review-comments/SKILL.md': ['## How to find the unanswered comments',
                'Now filter to what is **genuinely unanswered**'],
        }
        for source, expected in anchors.items():
            text = (ROOT / source).read_text()
            for anchor in expected:
                self.assertIn(anchor, text, source)

    def test_metadata_and_ci_discovery_contracts(self):
        status = (ROOT / 'roles/triage/references/pr-status.md').read_text()
        self.assertIn('additions,deletions', status)
        for anchor in ['/branches/{branch}/protection', '/rules/branches/{branch}',
                       '404 Not Found', 'base ref and SHA', 'per-PR applicability']:
            self.assertIn(anchor, status)
        skill = (ROOT / 'roles/triage/SKILL.md').read_text()
        self.assertIn('**`identities.maintainer`', skill)
        self.assertIn('[a-z0-9-]', skill)
        conventions = (ROOT / 'CONVENTIONS.md').read_text()
        self.assertIn('Triage reporting exception', conventions)


if __name__ == '__main__':
    unittest.main()
