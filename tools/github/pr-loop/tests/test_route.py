import importlib.machinery
import importlib.util
from pathlib import Path
import unittest

loader = importlib.machinery.SourceFileLoader('route', str(Path(__file__).parents[1] / 'bin/resolve-route'))
spec = importlib.util.spec_from_loader(loader.name, loader)
route = importlib.util.module_from_spec(spec)
loader.exec_module(route)


class RoutingTests(unittest.TestCase):
    def resolve(self, author, **kw):
        return route.resolve('human', 'review-bot', 'build-bot', author, **kw)

    def test_forward(self):
        result = self.resolve('build-bot')
        self.assertEqual((result['reviewer'], result['reviewer_engine'], result['implementer_engine']), ('review-bot', 'codex', 'claude'))
        self.assertTrue(result['author_matched'])

    def test_reverse(self):
        result = self.resolve('REVIEW-BOT')
        self.assertEqual((result['reviewer'], result['implementer'], result['reviewer_engine'], result['implementer_engine']), ('build-bot', 'review-bot', 'claude', 'codex'))

    def test_unknown_author_is_not_authorized(self):
        result = self.resolve('human')
        self.assertFalse(result['author_matched'])
        self.assertEqual(result['direction'], 'forward')

    def test_explicit_engine_mapping(self):
        self.assertEqual(self.resolve('review-bot', reviewer_engine='claude', implementer_engine='codex')['reviewer_engine'], 'codex')

    def test_same_engine_rejected(self):
        with self.assertRaises(ValueError):
            self.resolve('build-bot', implementer_engine='codex')

    def test_identity_collisions_rejected(self):
        for accounts in [('human', 'bot', 'BOT'), ('human', 'HUMAN', 'bot')]:
            with self.assertRaises(ValueError):
                route.resolve(*accounts, 'bot')

    def test_missing_identity_rejected(self):
        for missing in ['', None, 'null']:
            with self.assertRaises(ValueError):
                route.resolve('human', missing, 'bot', 'bot')


if __name__ == '__main__':
    unittest.main()
