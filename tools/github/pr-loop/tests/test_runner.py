import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from test_route import HEAD, commit, pr, route, review, rt

BIN = Path(__file__).resolve().parents[1] / 'bin'
FAKE = Path(__file__).with_name('fake_cli.py').read_text()


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'repository with spaces'; self.repo.mkdir()
        self.fake = self.root / 'fake'; self.fake.mkdir()
        for tool in ['git', 'gh', 'claude', 'codex']:
            p = self.fake / tool
            p.write_text('#!' + sys.executable + '\n' + FAKE.split('\n', 1)[1])
            p.chmod(0o755)
        self.skill = self.root / 'canonical skill.md'
        self.skill.write_text('review only')
        self.env = dict(os.environ, PATH=str(self.fake), REVIEW_FAKE_STATE=str(self.root / 'state.json'),
                        GITHUB_TOKEN='ambient-wrong-token', GH_TOKEN='ambient-wrong-token')

    def invoke(self, engine='Codex', mode='', reuse=False, extra=None, modify=None, host=None):
        value = route(engine)
        reviewer_engine = value['reviewer_engine']
        state = dict(route=value, commits=[commit(engine)], pr=pr(),
                     reviews=[review(reviewer_engine, value['reviewer'])], skill=str(self.skill),
                     calls=[], mode=mode, reuse=reuse)
        if modify:
            modify(state)
        (self.root / 'state.json').write_text(json.dumps(state))
        route_file = self.root / 'route.json'; route_file.write_text(json.dumps(value))
        args = [sys.executable, str(BIN / 'run-review'), '--repo-root', str(self.repo),
                '--owner-repo', 'example/repo', '--pr', '16', '--head', HEAD,
                '--route', str(route_file), '--skill', str(self.skill),
                '--model', 'sonnet' if reviewer_engine == 'claude' else 'gpt-6.1-sol',
                '--effort', 'high', '--report-dir', str(self.root / 'reports')]
        env = self.env.copy()
        for marker in ('CODEX_SESSION_ID', 'CODEX_THREAD_ID', 'CLAUDE_CODE_CHILD_SESSION'):
            env.pop(marker, None)
        host = engine.lower() if host is None else host
        if host == 'codex':
            env['CODEX_SESSION_ID'] = 'fake-session'
            env['CODEX_THREAD_ID'] = 'fake-thread'
        elif host == 'claude':
            env['CLAUDE_CODE_CHILD_SESSION'] = '1'
        elif host == 'ambiguous':
            env['CODEX_SESSION_ID'] = 'fake-session'
            env['CLAUDE_CODE_CHILD_SESSION'] = '1'
        result = subprocess.run(args + (extra or []), env=env, capture_output=True, text=True,
                                stdin=subprocess.DEVNULL, timeout=15)
        state = json.loads((self.root / 'state.json').read_text())
        self.assertNotIn('fixture-secret', result.stdout + result.stderr)
        return result, json.loads(result.stdout), state

    def assert_blocked(self, result, report):
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertEqual(report['status'], 'BLOCKED')

    def test_claude_review_of_codex_implementation(self):
        result, report, state = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(report['status'], 'REVIEW_CLEAR')
        self.assertEqual(report['engine'], 'claude')
        launches = [c for c in state['calls'] if c['name'] == 'claude' and '--print' in c['args']]
        self.assertEqual(len(launches), 1)
        self.assertEqual(launches[0]['cwd'], str(self.repo.resolve()))
        self.assertFalse(launches[0]['has_other_token'])
        self.assertEqual(json.loads((self.root / 'reports/report.txt').read_text())['type'], 'result')

    def test_codex_review_of_claude_implementation(self):
        result, report, state = self.invoke('Claude', extra=['--fast'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(report['engine'], 'codex')
        launches = [c for c in state['calls'] if c['name'] == 'codex' and '-o' in c['args']]
        self.assertEqual(len(launches), 1)
        self.assertIn('service_tier="fast"', launches[0]['args'])
        self.assertEqual(json.loads((self.root / 'reports/report.txt').read_text())['status'], 'REVIEW_SUBMITTED')

    def assert_isolated_reviewer_host(self, implementation, reviewer, marker):
        result, report, state = self.invoke(implementation)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(report['engine'], reviewer)
        launch = next(c for c in state['calls'] if c['name'] == reviewer
                      and ('-o' in c['args'] or '--print' in c['args']))
        self.assertEqual(launch['host_markers'], {})
        # The reviewer CLI establishes its own marker before running tools.
        child_env = dict(launch['host_markers'], **{marker: '1'})
        self.assertEqual(rt.invoking_host(child_env), reviewer)

    def test_codex_reviewer_does_not_inherit_claude_host(self):
        self.assert_isolated_reviewer_host('Claude', 'codex', 'CODEX_THREAD_ID')

    def test_claude_reviewer_does_not_inherit_codex_host(self):
        self.assert_isolated_reviewer_host('Codex', 'claude', 'CLAUDE_CODE_CHILD_SESSION')

    def test_reuse_needs_no_cli_or_auth(self):
        (self.fake / 'claude').unlink()
        result, report, state = self.invoke(reuse=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(report['reused'])
        self.assertFalse(any(c['name'] == 'claude' for c in state['calls']))

    def test_wrong_host_blocks_before_commands(self):
        result, report, state = self.invoke(host='claude')
        self.assert_blocked(result, report)
        self.assertEqual(state['calls'], [])

    def test_missing_or_ambiguous_host_blocks_before_commands(self):
        for host in ('none', 'ambiguous'):
            result, report, state = self.invoke(host=host)
            self.assert_blocked(result, report)
            self.assertEqual(state['calls'], [])

    def test_missing_cli(self):
        (self.fake / 'claude').unlink()
        result, report, _ = self.invoke()
        self.assert_blocked(result, report)
        self.assertIn('missing reviewer CLI', report['reason'])

    def test_unsupported_cli(self):
        result, report, state = self.invoke(mode='unsupported')
        self.assert_blocked(result, report)
        self.assertFalse(any('--print' in c['args'] for c in state['calls']))

    def test_auth_required(self):
        result, report, state = self.invoke(mode='unauthenticated')
        self.assert_blocked(result, report)
        self.assertFalse(any('--print' in c['args'] for c in state['calls']))

    def test_wrong_identity(self):
        result, report, state = self.invoke(mode='wrong-token')
        self.assert_blocked(result, report)
        self.assertFalse(any('--print' in c['args'] for c in state['calls']))

    def test_nonzero_exit_does_not_leak_stderr(self):
        result, report, _ = self.invoke(mode='nonzero')
        self.assert_blocked(result, report)

    def test_cli_success_without_review_blocks(self):
        result, report, _ = self.invoke(mode='no-review')
        self.assert_blocked(result, report)

    def test_permission_denial_blocks_even_if_review_exists(self):
        result, report, _ = self.invoke(mode='denied')
        self.assert_blocked(result, report)
        self.assertIn('Claude tool permission denied: Bash', report['reason'])

    def test_error_envelope_blocks(self):
        result, report, _ = self.invoke(mode='error-envelope')
        self.assert_blocked(result, report)

    def test_malformed_report_blocks(self):
        result, report, _ = self.invoke(mode='malformed')
        self.assert_blocked(result, report)

    def test_empty_report_blocks(self):
        result, report, _ = self.invoke(mode='empty')
        self.assert_blocked(result, report)

    def test_blocked_codex_report_cannot_be_clean(self):
        result, report, _ = self.invoke('Claude', mode='blocked-report')
        self.assert_blocked(result, report)

    def test_wrong_report_id_blocks(self):
        result, report, _ = self.invoke(mode='wrong-report-id')
        self.assert_blocked(result, report)

    def test_remote_head_moves_during_review(self):
        result, report, _ = self.invoke(mode='head-moved')
        self.assert_blocked(result, report)

    def test_reviewer_edits_detected(self):
        result, report, _ = self.invoke(mode='edited')
        self.assert_blocked(result, report)

    def test_route_drift(self):
        result, report, _ = self.invoke(modify=lambda s: s.update(commits=[commit('Claude')]))
        self.assert_blocked(result, report)

    def test_wrong_review_actor_is_not_evidence(self):
        result, report, _ = self.invoke(modify=lambda s: s['reviews'][0].update(user={'login': 'human'}))
        self.assert_blocked(result, report)

    def test_stale_review_commit_blocks(self):
        result, report, _ = self.invoke(modify=lambda s: s['reviews'][0].update(commit_id='b' * 40))
        self.assert_blocked(result, report)

    def test_generated_pointer_not_canonical_skill(self):
        self.skill.write_text('kstack pointer — generated by bin/install')
        result, report, state = self.invoke()
        self.assert_blocked(result, report)
        self.assertEqual(state['calls'], [])

    def test_run_closes_stdin_and_timeout_blocks(self):
        with patch.object(rt.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, 'ok')) as call:
            self.assertEqual(rt.run(['cli'], cwd=self.repo), 'ok')
            self.assertIs(call.call_args.kwargs['stdin'], subprocess.DEVNULL)
            self.assertTrue(call.call_args.kwargs['capture_output'])
        with patch.object(rt.subprocess, 'run', side_effect=subprocess.TimeoutExpired('cli', 1)):
            with self.assertRaises(rt.Blocked):
                rt.run(['cli'], cwd=self.repo)


if __name__ == '__main__':
    unittest.main()
