"""CI holds against a fake GitHub service; no paid agents or live writes."""

from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, unquote, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
from ci_defer import Hold, config
from review_runtime import Blocked

HEAD = 'a' * 40
OTHER = 'b' * 40


def run(number=20, head=HEAD, pr=16, status='completed', conclusion='success', workflow='tests.yml'):
    return dict(id=number, event='pull_request', head_sha=head, status=status,
                display_title=f'kstack-ci-release pr:{pr} head:{head}',
                conclusion=conclusion, created_at='9999-01-01T00:00:00Z',
                path='.github/workflows/' + workflow, pull_requests=[dict(number=pr)],
                html_url=f'https://example.test/runs/{number}')


def job(name='lint + tests (1/2)', conclusion='success'):
    return dict(name=name, status='completed', conclusion=conclusion,
                started_at='2026-11-25T10:00:00Z', steps=[dict(conclusion='success')])


class GitHub:
    def __init__(self):
        self.login = 'maintainer'
        self.head = HEAD
        self.head_repo = 'example/repo'
        self.labels = ['backend']
        self.files = [{'filename': 'src/app.py'}]
        self.changed_files = None
        self.runs = [run(10)]
        self.jobs = {10: [job()]}
        self.calls = []
        self.marker = '# kstack-defer-ci: ci:hold\non: ...'
        self.crash_after_delete = False

    def gh(self, *args, payload=None, raw=False):
        self.calls.append((args, payload))
        endpoint = urlsplit(args[1])
        url, query = unquote(endpoint.path), parse_qs(endpoint.query)
        method = args[args.index('--method') + 1] if '--method' in args else 'GET'
        if url == 'user':
            value = dict(login=self.login)
        elif url.endswith('/pulls/16'):
            value = dict(state='open', head=dict(sha=self.head, ref='feature', repo=dict(full_name=self.head_repo)),
                         changed_files=len(self.files) if self.changed_files is None else self.changed_files)
        elif url.endswith('/pulls/16/files'):
            value = self.files
        elif '/contents/' in url:
            value = self.marker
        elif url.endswith('/repo/labels/ci:hold'):
            value = dict(name='ci:hold')
        elif url.endswith('/labels/ci:hold') and method == 'DELETE':
            self.labels.remove('ci:hold')
            if self.crash_after_delete:
                self.crash_after_delete = False
                raise Blocked('simulated lost response after deletion')
            value = None
        elif url.endswith('/labels'):
            if payload:
                self.labels = list(dict.fromkeys(self.labels + payload['labels']))
            value = [dict(name=name) for name in self.labels]
        elif '/actions/workflows/' in url:
            workflow = url.split('/workflows/')[1].split('/')[0]
            value = dict(workflow_runs=[r for r in self.runs if r['path'] == '.github/workflows/' + workflow
                                       and ('head_sha' not in query or r['head_sha'] == query['head_sha'][0])])
        elif '/actions/runs/' in url:
            tail = url.split('/actions/runs/')[1].split('/')
            number = int(tail[0])
            if len(tail) == 1:
                value = next(r for r in self.runs if r['id'] == number)
            elif tail[1] == 'jobs':
                value = dict(jobs=self.jobs.get(number, []))
            elif tail[1] == 'cancel':
                value = None
            else:
                raise AssertionError(args)
        else:
            raise AssertionError(args)
        if '--paginate' in args:
            value = [value]
        return deepcopy(value)


class DeferredCITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        settings = self.root / 'config.json'
        settings.write_text(json.dumps(dict(label='ci:hold', workflows=[dict(file='tests.yml')])))
        self.args = SimpleNamespace(config=settings, state=self.root / 'state.json',
                                    repo_root=self.root, owner_repo='example/repo',
                                    pr=16, head=HEAD, maintainer='maintainer')
        self.github = GitHub()

    def controller(self):
        hold = Hold(self.args)
        hold.gh = self.github.gh
        return hold

    def acquire(self):
        return self.controller().acquire()

    def release(self):
        self.acquire()
        return self.controller().release()

    def publish(self, **values):
        value = run(**values)
        self.github.runs.append(value)
        self.github.jobs[value['id']] = [job(), job('lint + tests (2/2)')]
        return value

    def test_hold_adds_only_its_label_and_cancels_only_this_pr(self):
        self.github.runs = [run(1, status='in_progress'), run(2, pr=17, status='queued'),
                            run(3, status='completed'), run(4, head=OTHER, status='queued')]
        result = self.acquire()
        self.assertEqual(result['cancelled'], [1, 4])
        self.assertEqual(self.github.labels, ['backend', 'ci:hold'])
        cancelled = [a[1] for a, _ in self.github.calls if a[1].endswith('/cancel')]
        self.assertEqual(cancelled, ['repos/example/repo/actions/runs/1/cancel',
                                     'repos/example/repo/actions/runs/4/cancel'])

    def test_pending_until_new_released_run_registers(self):
        self.release()
        result = self.controller().check()
        self.assertEqual(result['status'], 'CI_PENDING')
        self.assertNotIn('ci:hold', self.github.labels)
        self.assertEqual(result['runs'], [])

    def test_success_requires_new_run_and_all_jobs_executed(self):
        self.release()
        self.publish()
        result = self.controller().check()
        self.assertEqual(result['status'], 'CI_GREEN')
        self.assertEqual(result['runs'][0]['run_id'], 20)
        self.assertEqual(len(result['runs'][0]['jobs']), 2)

    def test_successful_aggregate_cannot_hide_skipped_job(self):
        self.release()
        self.publish()
        self.github.jobs[20][0]['conclusion'] = 'skipped'
        with self.assertRaisesRegex(Blocked, 'did not execute successfully'):
            self.controller().check()

    def test_empty_jobs_or_no_executed_steps_never_pass(self):
        self.release()
        self.publish()
        for jobs in ([], [job() | {'steps': []}], [job() | {'started_at': None}]):
            self.github.jobs[20] = jobs
            with self.assertRaises(Blocked):
                self.controller().check()

    def test_cancelled_failed_and_skipped_release_runs_block(self):
        self.release()
        current = self.publish()
        for conclusion in ('cancelled', 'failure', 'skipped', 'neutral', 'timed_out'):
            current['conclusion'] = conclusion
            with self.assertRaisesRegex(Blocked, conclusion):
                self.controller().check()

    def test_pending_release_run_is_not_green(self):
        self.release()
        self.publish(status='queued', conclusion=None)
        self.assertEqual(self.controller().check()['status'], 'CI_PENDING')

    def test_wrong_pr_head_or_event_does_not_satisfy_gate(self):
        self.release()
        self.publish(number=20, pr=17)
        self.publish(number=21, head=OTHER)
        self.publish(number=22)['event'] = 'workflow_dispatch'
        self.assertEqual(self.controller().check()['status'], 'CI_PENDING')

    def test_release_run_is_accepted_without_trusting_controller_clock(self):
        self.release()
        self.publish()['created_at'] = '2000-01-01T00:00:00Z'
        self.assertEqual(self.controller().check()['status'], 'CI_GREEN')

    def test_unrelated_label_event_cannot_mask_the_release_run(self):
        self.release()
        self.publish(number=20)
        self.publish(number=21)['display_title'] = 'ordinary PR update'
        self.github.jobs[21] = [job(conclusion='skipped')]
        result = self.controller().check()
        self.assertEqual(result['status'], 'CI_GREEN')
        self.assertEqual(result['runs'][0]['run_id'], 20)

    def test_head_movement_blocks_before_label_mutation(self):
        self.github.head = OTHER
        with self.assertRaisesRegex(Blocked, 'CI_HEAD_MOVED'):
            self.acquire()
        self.assertEqual(self.github.labels, ['backend'])

    def test_fork_heads_are_rejected_before_holding_ci(self):
        self.github.head_repo = 'a-fork/repo'
        with self.assertRaisesRegex(Blocked, 'same-repository'):
            self.acquire()
        self.assertEqual(self.github.labels, ['backend'])

    def test_ci_retry_reuses_release_and_saved_run(self):
        self.release()
        current = self.publish(conclusion='failure')
        with self.assertRaises(Blocked):
            self.controller().check()
        self.assertEqual(self.acquire()['status'], 'CI_RELEASED')
        current['conclusion'] = 'success'  # GitHub rerun, same run id / newer attempt
        self.assertEqual(self.controller().check()['status'], 'CI_GREEN')
        self.assertEqual(sum('--method' in a and 'DELETE' in a for a, _ in self.github.calls), 1)

    def test_resume_after_lost_label_delete_response_keeps_original_baseline(self):
        self.acquire()
        self.github.crash_after_delete = True
        with self.assertRaises(Blocked):
            self.controller().release()
        self.publish()
        self.controller().release()
        self.assertEqual(self.controller().check()['status'], 'CI_GREEN')

    def test_early_exit_leaves_hold_and_next_controller_resumes(self):
        self.acquire()
        self.assertEqual(self.controller().state['phase'], 'holding')
        self.assertIn('ci:hold', self.github.labels)
        self.assertEqual(self.acquire()['status'], 'CI_HELD')

    def test_new_head_after_fix_can_be_held_again(self):
        self.release()
        self.github.head = self.args.head = OTHER
        self.assertEqual(self.acquire()['status'], 'CI_HELD')
        self.assertIn('ci:hold', self.github.labels)

    def test_foreign_hold_is_not_removed(self):
        self.github.labels.append('ci:hold')
        with self.assertRaisesRegex(Blocked, 'without this controller'):
            self.acquire()
        self.assertIn('ci:hold', self.github.labels)

    def test_wrong_identity_and_missing_workflow_opt_in_block(self):
        self.github.login = 'implementer'
        with self.assertRaisesRegex(Blocked, 'maintainer token'):
            self.acquire()
        self.github.login = 'maintainer'
        self.github.marker = 'on: pull_request'
        with self.assertRaisesRegex(Blocked, 'not opted'):
            self.acquire()
        self.assertEqual(self.github.labels, ['backend'])

    def test_optional_docs_workflow_follows_changed_paths_including_renames(self):
        value = dict(label='ci:hold', workflows=[dict(file='tests.yml'),
                     dict(file='docs.yml', paths=['docs/**', 'CONTRIBUTING.md'])])
        self.args.config.write_text(json.dumps(value))
        self.assertEqual(self.acquire()['status'], 'CI_HELD')
        self.assertEqual(self.controller().state['workflows'], ['tests.yml'])
        self.github.files.append(dict(filename='archive/old.md', previous_filename='docs/old.md'))
        self.acquire()
        self.assertEqual(self.controller().state['workflows'], ['tests.yml', 'docs.yml'])

    def test_path_selection_matches_github_single_and_recursive_stars(self):
        cases = [
            ('**/*.md', 'README.md', True),
            ('**/*.md', 'docs/nested/readme.md', True),
            ('docs/**/*.md', 'docs/readme.md', True),
            ('docs/*.md', 'docs/readme.md', True),
            ('docs/*.md', 'docs/nested/readme.md', False),
            ('docs/**', 'docs/nested/readme.md', True),
            ('*.md', 'docs/readme.md', False),
        ]
        for pattern, filename, selected in cases:
            with self.subTest(pattern=pattern, filename=filename):
                self.args.config.write_text(json.dumps(dict(label='ci:hold', workflows=[
                    dict(file='tests.yml'), dict(file='docs.yml', paths=[pattern])])))
                self.github.files = [dict(filename=filename)]
                hold = self.controller()
                hold.verify()
                self.assertEqual('docs.yml' in hold.workflows(), selected)

    def test_unsupported_path_filter_syntax_fails_before_hold(self):
        for pattern in ('docs/?.md', 'docs/[ab].md', 'docs/a+.md', 'docs/\\*.md', '***.md'):
            with self.subTest(pattern=pattern):
                self.args.config.write_text(json.dumps(dict(label='ci:hold', workflows=[
                    dict(file='tests.yml', paths=[pattern])])))
                with self.assertRaises(Blocked):
                    self.controller()

    def test_incomplete_files_fail_closed(self):
        self.github.changed_files = 3001
        with self.assertRaisesRegex(Blocked, 'complete PR file pagination'):
            self.acquire()

    def test_remote_workflow_content_is_raw_not_json(self):
        hold = Hold(self.args)
        with patch('ci_defer.subprocess.run', return_value=subprocess.CompletedProcess(
                [], 0, stdout='name: Tests\n# kstack-defer-ci: ci:hold\n')):
            self.assertIn('name: Tests', hold.gh('api', 'contents', raw=True))

    def test_config_rejects_missing_or_ambiguous_workflows(self):
        for value in ({}, dict(label='other', workflows=[dict(file='tests.yml')]),
                      dict(label='ci:hold', workflows=[]),
                      dict(label='ci:hold', workflows=[dict(file='../tests.yml')]),
                      dict(label='ci:hold', workflows=[dict(file='tests.yml', paths=['!docs/**'])])):
            with self.assertRaises(Blocked):
                config(value)


if __name__ == '__main__':
    unittest.main()
