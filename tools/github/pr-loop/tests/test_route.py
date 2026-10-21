import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
import review_runtime as rt

HEAD = 'a' * 40


def commit(engine=None, login='human', sha=HEAD):
    return {'sha': sha, 'author': {'login': login}, 'commit': {'message':
            'change' + (f'\n\nCo-Authored-By: {engine} <agent@example.test>' if engine else '')}}


def pr(author='human', count=1):
    return {'number': 16, 'user': {'login': author}, 'commits': count,
            'head': {'sha': HEAD}, 'state': 'open'}


def route(engine='Codex', **kw):
    return rt.resolve('human', 'review-bot', 'build-bot', pr(), [commit(engine)], **kw)


def review(engine='claude', reviewer='build-bot', body='No findings.', **kw):
    value = {'id': 123, 'user': {'login': reviewer}, 'state': 'COMMENTED',
             'commit_id': HEAD, 'submitted_at': '2026-10-21T10:00:00Z',
             'body': f'**Review performed by {engine.title()}.**\n{body}\n'
                     f'<!-- {engine}-review head:{HEAD} -->'}
    value.update(kw)
    return value


class RoutingTests(unittest.TestCase):
    def test_maintainer_opened_both_directions(self):
        for engine, account, reviewer_engine in [('Codex', 'build-bot', 'claude'),
                                                 ('Claude', 'review-bot', 'codex')]:
            actual = route(engine)
            self.assertEqual((actual['reviewer'], actual['reviewer_engine']), (account, reviewer_engine))
            self.assertEqual(actual['source'], 'commits')

    def test_bot_commit_authorship(self):
        actual = rt.resolve('human', 'review-bot', 'build-bot', pr(), [commit(login='REVIEW-BOT')])
        self.assertEqual(actual['implementer_engine'], 'codex')

    def test_legacy_bot_opener(self):
        for login, engine in [('review-bot', 'codex'), ('build-bot', 'claude')]:
            actual = rt.resolve('human', 'review-bot', 'build-bot', pr(login), [commit()])
            self.assertEqual(actual['implementer_engine'], engine)
            self.assertEqual(actual['source'], 'legacy-pr-author')

    def test_commit_evidence_overrides_publishing_account(self):
        actual = rt.resolve('human', 'review-bot', 'build-bot', pr('build-bot'), [commit('Codex')])
        self.assertEqual(actual['implementer_engine'], 'codex')

    def test_legacy_exact_claude_login(self):
        actual = rt.resolve('human', 'review-bot', 'build-bot', pr(), [commit(login='claude')])
        self.assertEqual(actual['implementer_engine'], 'claude')

    def test_no_spelling_or_branch_guess(self):
        for login in ['my-codex-bot', 'claude-worker', 'human']:
            data = pr(); data['head']['ref'] = 'codex/feature'
            with self.assertRaises(rt.Blocked):
                rt.resolve('human', 'review-bot', 'build-bot', data, [commit(login=login)])

    def test_mixed_provenance_needs_selection(self):
        commits = [commit('Codex'), commit('Claude', sha='b' * 40)]
        with self.assertRaises(rt.Blocked):
            rt.resolve('human', 'review-bot', 'build-bot', pr(count=2), commits)
        for engine in ['codex', 'claude']:
            result = rt.resolve('human', 'review-bot', 'build-bot', pr(count=2), commits,
                                implementation_engine=engine)
            self.assertEqual(result['implementer_engine'], engine)
            self.assertEqual(result['evidence'], ['claude', 'codex'])

    def test_contradicting_explicit_engine_blocks(self):
        with self.assertRaises(rt.Blocked):
            route('Claude', implementation_engine='codex', any_author=True)

    def test_author_exception_is_separate(self):
        for args in [{}, {'implementation_engine': 'codex'}, {'any_author': True}]:
            with self.assertRaises(rt.Blocked):
                rt.resolve('human', 'review-bot', 'build-bot', pr(), [commit()], **args)
        result = rt.resolve('human', 'review-bot', 'build-bot', pr(), [commit()],
                            implementation_engine='codex', any_author=True)
        self.assertEqual(result['source'], 'any-author')

    def test_only_whole_trailer_lines(self):
        for message in ['Discuss Co-Authored-By: Codex <a@b.test>',
                        'Co-Authored-By: Codex without email', 'Co-Authored-By: Codex <a@b.test> extra']:
            data = commit(); data['commit']['message'] = message
            with self.assertRaises(rt.Blocked):
                rt.resolve('human', 'review-bot', 'build-bot', pr(), [data])

    def test_explicit_mapping_not_name(self):
        result = route('Codex', reviewer_engine='claude', implementer_engine='codex')
        self.assertEqual(result['implementer'], 'build-bot')
        self.assertEqual(result['direction'], 'forward')

    def test_null_engine_configuration_uses_legacy_mapping(self):
        self.assertEqual(route('Claude', reviewer_engine=None, implementer_engine=None)['reviewer_engine'], 'codex')

    def test_invalid_identities_and_engines(self):
        for accounts in [('human', 'bot', 'BOT'), ('human', 'HUMAN', 'bot'),
                         ('human', None, 'bot'), ('human', 'null', 'bot')]:
            with self.assertRaises(rt.Blocked):
                rt.resolve(*accounts, pr(), [commit('Codex')])
        with self.assertRaises(rt.Blocked):
            route(implementer_engine='codex')

    def test_commit_pagination_and_exact_head(self):
        commits = [[commit('Claude', sha='b' * 40)], [commit('Codex')]]
        result = rt.resolve('human', 'review-bot', 'build-bot', pr(count=2), commits,
                            implementation_engine='codex')
        self.assertEqual(result['implementer_engine'], 'codex')
        for data in [commits[:1], [commit('Codex', sha='b' * 40)], [commit('Codex')] * 2]:
            with self.assertRaises(rt.Blocked):
                rt.resolve('human', 'review-bot', 'build-bot', pr(count=2), data)

    def test_one_controller_no_delegation(self):
        for engine in ['Codex', 'Claude']:
            value = route(engine)
            rt.controller(value, engine.lower())
            with self.assertRaises(rt.Blocked):
                rt.controller(value, value['reviewer_engine'])
            with self.assertRaises(rt.Blocked):
                rt.controller(value, engine.lower(), delegated=True)


class EvidenceTests(unittest.TestCase):
    def check(self, reviews, comments=None):
        return rt.review_evidence(reviews, comments or [], 'build-bot', 'claude', HEAD)

    def test_both_engines_and_pagination(self):
        for engine, account in [('claude', 'build-bot'), ('codex', 'review-bot')]:
            value = rt.review_evidence([[], [review(engine, account)]], [[]], account, engine, HEAD)
            self.assertEqual(value['status'], 'REVIEW_CLEAR')
            self.assertNotEqual(value['status'], 'CLEAN')

    def test_wrong_account_engine_head_and_unsubmitted_ignored(self):
        for value in [review(reviewer='human'), review(engine='codex'),
                      dict(review(), body='<!-- claude-review head:' + 'b' * 40 + ' -->', commit_id='b'*40),
                      *[review(state=s) for s in ['PENDING', 'DISMISSED', 'APPROVED']]]:
            self.assertIsNone(self.check([value]))

    def test_malformed_matching_review_blocks(self):
        for changes in [{'commit_id': 'b' * 40}, {'submitted_at': None},
                        {'body': '<!-- claude-review head:' + HEAD + ' -->'}]:
            with self.assertRaises(rt.Blocked):
                self.check([review(**changes)])
        for text in ['Done.', '[P1] bad format', '1. **[P9] unknown** — `file:1`']:
            with self.assertRaises(rt.Blocked):
                self.check([review(body=text)])

    def test_body_findings_and_p3(self):
        for priority, status in [(1, 'FINDINGS'), (3, 'REVIEW_CLEAR')]:
            value = self.check([review(body=f'1. **[P{priority}] Fix this** — `file.py:8`')])
            self.assertEqual(value['status'], status)
            self.assertEqual(value['findings'][0]['path'], 'file.py')

    def test_range_citation_and_priority_mention_in_assessment(self):
        body = ('### Findings\n1. **[P2] Fix this** — `file.py:8-12`\n'
                '### Overall assessment\n[P3] context: the [P2] issue is reproducible.')
        value = self.check([review(body=body)])
        self.assertEqual(value['status'], 'FINDINGS')
        self.assertEqual(value['findings'], [dict(priority=2, title='Fix this', path='file.py')])

    def test_clean_assessment_allows_trailing_sentence(self):
        value = self.check([review(body='### Overall assessment\nNo findings. Tests pass.\n'
                                       '[P3] is discussed here as context, not a finding.')])
        self.assertEqual(value['status'], 'REVIEW_CLEAR')

    def test_formatted_malformed_finding_still_blocks(self):
        body = '### Findings\n1. **[P9] Invalid** — `file.py:8`\n### Overall assessment\nNeeds work.'
        with self.assertRaises(rt.Blocked):
            self.check([review(body=body)])

    def test_prior_count_requires_matching_account_engine_and_commit(self):
        valid = review(engine='codex', reviewer='review-bot')
        invalid = [review(engine='codex', reviewer='build-bot'),
                   review(engine='claude', reviewer='review-bot'),
                   review(engine='codex', reviewer='review-bot', commit_id='b' * 40),
                   review(engine='codex', reviewer='review-bot', state='PENDING'),
                   review(engine='codex', reviewer='review-bot', submitted_at=None)]
        self.assertEqual(rt.prior_review_count([[valid, *invalid]], 'review-bot', 'codex'), 1)
        with self.assertRaises(rt.Blocked):
            rt.prior_review_count([valid], 'review-bot', 'other')

    def test_inline_cannot_be_lost_or_cleaned_away(self):
        comment = {'pull_request_review_id': 123, 'body': '[P1] Missing check\nExplanation', 'path': 'a.py'}
        with self.assertRaises(rt.Blocked):
            self.check([review()], [[comment]])
        value = self.check([review(body='1. **[P3] Small thing** — `b.py:1`')], [[comment]])
        self.assertEqual(value['status'], 'FINDINGS')
        self.assertEqual(len(value['findings']), 2)
        comment['in_reply_to_id'] = 4
        self.assertEqual(self.check([review()], [comment])['findings'], [])

    def test_latest_matching_review_and_conflicting_verdict(self):
        value = self.check([review(id=1), review(body='1. **[P2] Fix** — `a:1`')])
        self.assertEqual(value['status'], 'FINDINGS')
        with self.assertRaises(rt.Blocked):
            self.check([review(body='No findings.\n1. **[P2] Fix** — `a:1`')])


class InvocationTests(unittest.TestCase):
    def test_separate_engine_flags_and_permissions(self):
        claude = rt.command('claude', '/repo', 'sonnet', 'high', 'prompt $x', '/report')
        self.assertEqual(claude[-1], 'prompt $x')
        self.assertIn('--permission-prompts', claude)
        for forbidden in ['-c', 'service_tier', '--permission-mode', '--dangerously-skip-permissions']:
            self.assertNotIn(forbidden, ' '.join(claude))
        codex = rt.command('codex', '/repo', 'gpt-6.1-sol', 'high', 'prompt', '/report', True)
        self.assertIn('service_tier="fast"', codex)
        self.assertIn('model_reasoning_effort=high', codex)
        self.assertNotIn('--sandbox', codex)
        self.assertNotIn('danger-full-access', codex)
        self.assertNotIn('service_tier="fast"', rt.command('codex', '/', 'gpt-6.1-sol', 'high', 'p', '/r'))

    def test_invalid_model_effort_or_fast_blocks(self):
        for engine, model, effort, fast in [('claude', 'gpt-6.1-sol', 'high', False),
                                          ('claude', 'sonnet', 'high', True),
                                          ('codex', 'sonnet', 'high', False),
                                          ('claude', 'sonnet', 'ultra', False),
                                          ('codex', '$(bad)', 'high', False)]:
            with self.assertRaises(rt.Blocked):
                rt.command(engine, '/', model, effort, 'prompt', '/report', fast)


if __name__ == '__main__':
    unittest.main()
