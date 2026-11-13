import json
import hashlib
import fcntl
import os
import shutil
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
        if state.get('scratch'):
            scratch = Path(state['scratch'])
            def remove_test_scratch():
                if scratch.is_symlink(): scratch.unlink()
                elif scratch.exists(): shutil.rmtree(scratch)
                moved = scratch.with_name(scratch.name + '-moved')
                if moved.exists(): shutil.rmtree(moved)
            self.addCleanup(remove_test_scratch)
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

    def assert_controller_owned_scratch(self, implementation, reviewer, flag):
        outside = self.root / 'unrelated-sentinel'
        outside.write_text('keep')
        result, report, state = self.invoke(implementation, mode='scratch')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(report['status'], 'REVIEW_CLEAR')
        launch = next(c for c in state['calls'] if c['name'] == reviewer and flag in c['args'])
        scratch = Path(launch['review_tmpdir'])
        self.assertEqual(launch['tmpdir'], str(scratch))
        self.assertEqual(scratch.parent, Path(tempfile.gettempdir()).resolve())
        self.assertFalse(scratch.is_relative_to(self.root.resolve()))
        self.assertFalse(scratch.exists(), 'controller must remove only its own scratch after the reviewer exits')
        self.assertEqual(outside.read_text(), 'keep')
        self.assertTrue((self.root / 'reports' / 'report.txt').is_file())
        self.assertIn('Do not delete temporary artifacts', launch['args'][-1])
        self.assertNotIn('--dangerously-skip-permissions', launch['args'])
        self.assertNotIn('--allowedTools', launch['args'])
        self.assertIn('Do not leave background processes', launch['args'][-1])

    def test_claude_reviewer_uses_controller_owned_scratch(self):
        self.assert_controller_owned_scratch('Codex', 'claude', '--print')

    def test_codex_reviewer_uses_controller_owned_scratch(self):
        self.assert_controller_owned_scratch('Claude', 'codex', '-o')

    def test_failed_reviewer_preserves_scratch_for_reconciliation(self):
        result, report, state = self.invoke(mode='scratch-nonzero')
        self.assert_blocked(result, report)
        shutil.rmtree(self.root / 'reports')
        self.assertTrue((Path(state['scratch']) / 'owned-proof').is_file())
        self.assertIn('review scratch preserved at', report['reason'])

    def test_denied_review_still_blocks_after_owned_cleanup(self):
        result, report, state = self.invoke(mode='scratch-denied')
        self.assert_blocked(result, report)
        self.assertIn('Claude tool permission denied: Bash', report['reason'])
        self.assertFalse(Path(state['scratch']).exists())

    def test_timeout_preserves_owned_scratch(self):
        result, report, state = self.invoke(mode='scratch-timeout', extra=['--timeout', '1'])
        self.assert_blocked(result, report)
        self.assertIn('review scratch preserved at', report['reason'])
        shutil.rmtree(self.root / 'reports')
        self.assertTrue((Path(state['scratch']) / 'owned-proof').is_file())

    def test_unsafe_cleanup_implementation_refuses_before_creating_scratch(self):
        with patch.object(rt.shutil.rmtree, 'avoids_symlink_attacks', False):
            with self.assertRaisesRegex(rt.Blocked, 'safe review scratch cleanup is unsupported'):
                rt.create_review_scratch(self.root / 'reports', self.repo.resolve())

    def test_scratch_cannot_be_inside_the_controller_report_tree(self):
        self.env['TMPDIR'] = str(self.root)
        result, report, state = self.invoke(mode='scratch')
        self.assert_blocked(result, report)
        self.assertIn('scratch overlaps', report['reason'])
        self.assertFalse(any(c['name'] == 'claude' and '--print' in c['args'] for c in state['calls']))

    def test_replaced_scratch_never_deletes_an_outside_directory(self):
        outside = self.root / 'outside'
        outside.mkdir()
        (outside / 'sentinel').write_text('keep')
        result, report, state = self.invoke(mode='scratch-symlink',
            modify=lambda s: s.update(outside=str(outside)))
        self.assert_blocked(result, report)
        self.assertIn('scratch identity changed', report['reason'])
        self.assertEqual((outside / 'sentinel').read_text(), 'keep')
        self.assertTrue(Path(state['scratch']).is_symlink())

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

    def test_review_permit_is_held_only_for_paid_process(self):
        value = route('Codex')
        key = hashlib.sha256(value['reviewer'].casefold().encode()).hexdigest()
        slot = self.root / 'slots' / ('review-claude-' + key) / '0'
        result, report, _ = self.invoke(mode='check-slot',
            extra=['--review-slots', '1', '--slot-state', str(self.root)],
            modify=lambda s: s.update(slot_file=str(slot)))
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertGreaterEqual(report['timing']['slot_wait_seconds'], 0)
        self.assertGreater(report['timing']['reviewer_process_seconds'], 0)
        with slot.open('a+') as released:
            fcntl.flock(released, fcntl.LOCK_EX | fcntl.LOCK_NB)

    def test_review_found_after_wait_avoids_second_charge(self):
        result, report, state = self.invoke(mode='reuse-after-wait',
            extra=['--review-slots', '1', '--slot-state', str(self.root)])
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertTrue(report['reused'])
        self.assertFalse(any('--print' in c['args'] for c in state['calls']))

    def test_invalid_review_limit_never_launches(self):
        result, report, state = self.invoke(extra=['--review-slots', '0', '--slot-state', str(self.root)])
        self.assert_blocked(result, report)
        self.assertFalse(any('--print' in c['args'] for c in state['calls']))

    def test_slot_wait_expiry_is_retryable_and_does_not_launch(self):
        value = route('Codex')
        key = hashlib.sha256(value['reviewer'].casefold().encode()).hexdigest()
        slot = self.root / 'slots' / ('review-claude-' + key) / '0'
        slot.parent.mkdir(parents=True)
        (slot.parent / 'limit.json').write_text('1')
        with slot.open('a+') as held:
            fcntl.flock(held, fcntl.LOCK_EX)
            result, report, state = self.invoke(extra=[
                '--review-slots', '1', '--slot-state', str(self.root),
                '--slot-wait', '0'])
        self.assertEqual(result.returncode, 75)
        self.assertEqual(report['status'], 'SLOT_WAIT_TIMEOUT')
        self.assertFalse(any('--print' in c['args'] for c in state['calls']))

    def test_checkout_move_after_wait_blocks_before_paid_process(self):
        result, report, state = self.invoke(mode='checkout-moved-before-review',
            extra=['--review-slots', '1', '--slot-state', str(self.root)])
        self.assert_blocked(result, report)
        self.assertFalse(any('--print' in c['args'] for c in state['calls']))

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

    def assert_probe_rule_in_prompt(self, implementation, reviewer, flag):
        result, report, state = self.invoke(implementation)
        self.assertEqual(result.returncode, 0, result.stderr)
        launch = next(c for c in state['calls'] if c['name'] == reviewer and flag in c['args'])
        prompt = launch['args'][-1]
        # Required steps still block; a denied optional probe is stated, not BLOCKED.
        self.assertIn('A denied required step (identity, GitHub reads or review submission, '
                      'the diff, gates.test or the project proof gate), absent evidence or a '
                      'moved head means BLOCKED.', prompt)
        self.assertIn('Any other check is an optional runtime probe (a browser, a GUI app, '
                      'Computer Use, a process listing such as ps); a denied one is not BLOCKED',
                      prompt)
        self.assertIn('never request, retry around or work around a denial', prompt)
        self.assertNotIn('denial, absent evidence or moved head means BLOCKED', prompt)

    def test_codex_prompt_separates_required_steps_from_optional_probes(self):
        self.assert_probe_rule_in_prompt('Claude', 'codex', '-o')

    def test_claude_prompt_separates_required_steps_from_optional_probes(self):
        self.assert_probe_rule_in_prompt('Codex', 'claude', '--print')

    def assert_checkout_rule_in_prompt(self, implementation, reviewer, flag):
        result, report, state = self.invoke(implementation)
        self.assertEqual(result.returncode, 0, result.stderr)
        launch = next(c for c in state['calls'] if c['name'] == reviewer and flag in c['args'])
        self.assertIn('Make any disposable checkout with git clone --shared --no-checkout or '
                      'git archive in a temporary directory, never git worktree add',
                      launch['args'][-1])

    def test_codex_prompt_forbids_git_worktree_add(self):
        self.assert_checkout_rule_in_prompt('Claude', 'codex', '-o')

    def test_claude_prompt_forbids_git_worktree_add(self):
        self.assert_checkout_rule_in_prompt('Codex', 'claude', '--print')

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
