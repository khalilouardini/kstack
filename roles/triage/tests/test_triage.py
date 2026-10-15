"""Frozen expectations and prompt-contract regressions; never contact services."""
from copy import deepcopy
import json
from pathlib import Path
import unittest

from fixture_model import EvidenceGap, changed_paths, connection, review_status, select_projects

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def assert_subset(test, actual, expected):
    for key, value in expected.items():
        if isinstance(value, dict):
            assert_subset(test, actual[key], value)
        else:
            test.assertEqual(actual[key], value, key)


def load_cases(name):
    data = json.loads((HERE / 'fixtures' / (name + '.json')).read_text())

    def overlay(base, updates):
        result = deepcopy(base) if isinstance(base, dict) else {}
        for key, value in updates.items():
            result[key] = overlay(result.get(key), value) if isinstance(value, dict) else value
        return result

    return [dict(case, facts=overlay(data['defaults'], case['facts'])) for case in data['cases']]


class FrozenCases(unittest.TestCase):
    pass


def status_test(case):
    def run(self):
        result = review_status(case['facts'])
        assert_subset(self, result, case['expected'])
        self.assertIn('loop', result)  # posted status stays separate from derivation
    return run


def project_test(case):
    def run(self):
        if case['error']:
            with self.assertRaises(EvidenceGap):
                select_projects(case['facts'])
        else:
            result = select_projects(case['facts'])
            assert_subset(self, result, case['expected'])
            self.assertEqual(len(result['selected']) + sum(result['excluded'].values()),
                             len(case['facts']['prs']))
    return run


for index, case in enumerate(load_cases('reviews'), 1):
    setattr(FrozenCases, f'test_review_{index:02d}_{case["name"].replace(" ", "_")}', status_test(case))
for index, case in enumerate(load_cases('projects'), 1):
    setattr(FrozenCases, f'test_project_{index:02d}_{case["name"].replace(" ", "_")}', project_test(case))


class EvidenceChecks(unittest.TestCase):
    def test_rename_intersects_previous_path(self):
        renamed = changed_paths(1, [{'filename':'src/new.py','previous_filename':'src/old.py'}])
        other = changed_paths(1, [{'filename':'src/old.py'}])
        self.assertEqual(renamed & other, {'src/old.py'})

    def test_truncated_files_are_unknown(self):
        with self.assertRaises(EvidenceGap):
            changed_paths(2, [{'filename':'src/only.py'}])

    def test_repeated_and_wrong_cursors_refuse(self):
        pages = load_cases('reviews')[8]['facts']['reviews']
        for key, value in [('after', 'wrong')]:
            bad = deepcopy(pages)
            bad[1][key] = value
            with self.assertRaises(EvidenceGap):
                connection(bad)
        bad = deepcopy(pages)
        bad[1]['pageInfo'] = {'hasNextPage':True,'endCursor':'v1'}
        with self.assertRaises(EvidenceGap):
            connection(bad)

    def test_resolved_thread_removed_and_unknown_severity_retained(self):
        facts = load_cases('reviews')[2]['facts']
        facts['threads'][0]['nodes'][0]['resolved'] = True
        self.assertEqual(review_status(facts)['counts']['P2'], 0)
        facts['threads'][0]['nodes'][0].update(resolved=False, priority=None)
        result = review_status(facts)
        self.assertEqual(result['counts']['unknown'], 1)
        self.assertFalse(result['merge_gate'])

    def test_stale_green_check_does_not_clear_head(self):
        facts = load_cases('reviews')[0]['facts']
        facts['ci']['checks'][0]['head'] = 'b' * 40
        self.assertEqual(review_status(facts)['ci'], 'missing')


class PromptContract(unittest.TestCase):
    """Guard selected load-bearing text/references, not agent compliance."""
    def test_default_filters_and_read_only_boundary(self):
        skill = (ROOT / 'roles/triage/SKILL.md').read_text()
        for phrase in ['(default `prs`)', '**union**', '**AND**',
                       'Never invoke `/pr-loop`', 'never post a review/comment',
                       '**prompt-level**', 'GitHub only', 'collision', '"x"']:
            self.assertIn(phrase, skill)

    def test_status_reuses_contracts_and_preserves_every_verdict(self):
        skill = (ROOT / 'roles/triage/SKILL.md').read_text()
        status = (ROOT / 'roles/triage/references/pr-status.md').read_text()
        for source in ['tools/github/pr-loop/SKILL.md',
                       'tools/github/review-claude-pr/SKILL.md',
                       'tools/github/review-comments/SKILL.md',
                       'tools/linear/next/references/pr-file-snapshot.md']:
            self.assertIn(source, status)
            self.assertTrue((ROOT / source).is_file())
        for phrase in ['including `CLOSE` and `PARK`', 'exactly once',
                       'Independent lanes', 'previous_filename', 'uncommitted paths']:
            self.assertIn(phrase, skill)
        for phrase in ['two retries', 'Known counts from partial reads are lower bounds',
                       'Answered is not resolved', 'outdated is not fixed',
                       'UNKNOWN / no accessible loop report', 'last author/time']:
            self.assertIn(phrase, status)

    def test_project_delegates_membership_but_includes_terminal_containers(self):
        project = (ROOT / 'roles/triage/references/project-filter.md').read_text()
        for phrase in ['tools/linear/next/references/project-resolution.md',
                       '**all issue states**', 'container/parent counts',
                       'prerequisite', '**all** GitHub label filters',
                       'label-only or both', 'branch/worktree-only']:
            self.assertIn(phrase, project)


if __name__ == '__main__':
    unittest.main()
