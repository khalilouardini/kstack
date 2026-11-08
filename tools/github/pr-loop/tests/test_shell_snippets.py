"""SKILL.md's first-review trigger and ledger key, run as printed under each shell."""
import functools
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest

from test_route import review, rt

SKILL = Path(__file__).resolve().parents[1] / 'SKILL.md'
BIN = SKILL.parent / 'bin'
STACK_ROOT = Path(__file__).resolve().parents[4]
SHELLS = {'bash': ['bash', '--noprofile', '--norc'], 'zsh': ['zsh', '-f']}
FAKE_GH = f'''#!{sys.executable}
import os, sys
args = sys.argv[1:]
if args[0] == 'api':
    print(os.environ['FAKE_REVIEWS'])
elif args[:2] == ['pr', 'diff']:
    print(os.environ['FAKE_PATHS'])
elif args[:2] == ['pr', 'view']:
    print(3)
else:
    sys.exit('unexpected gh call: ' + ' '.join(args))
'''


def fence(marker):
    """The one fenced bash block in SKILL.md that contains marker."""
    blocks = re.findall(r'^```bash\n(.*?)^```$', SKILL.read_text(), re.M | re.S)
    found = [block for block in blocks if marker in block]
    if len(found) != 1:
        raise AssertionError(f'{len(found)} bash blocks in SKILL.md contain {marker!r}')
    return found[0]


def assignments(**values):
    return ''.join(f'{key}={shlex.quote(str(value))}\n' for key, value in values.items())


def each_shell(test):
    """Run a test once per shell, as one subtest each; a missing shell skips its subtest."""
    @functools.wraps(test)
    def run(self):
        for name, argv in SHELLS.items():
            with self.subTest(shell=name):
                if not shutil.which(argv[0]):
                    self.skipTest(f'{name} is not installed')
                test(self, argv)
    return run


class ShellCase(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name) / 'path with spaces'
        self.root.mkdir()


class FirstReviewTriggerTests(ShellCase):
    def setUp(self):
        super().setUp()
        fake = self.root / 'fake'
        fake.mkdir()
        (fake / 'gh').write_text(FAKE_GH)
        (fake / 'gh').chmod(0o755)
        self.scratch = self.root / 'scratch'
        self.scratch.mkdir()
        self.path = str(fake) + os.pathsep + os.environ['PATH']

    def trigger(self, argv, globs, paths, reviews_json='[[]]'):
        script = assignments(
            STACK_ROOT=STACK_ROOT, SCRATCH=self.scratch, PR=16, OWNER_REPO='example/repo',
            REVIEWER='review-bot', MAINTAINER_TOKEN='fixture', BASE_MODEL='base-model',
            BASE_EFFORT='high', ESCALATED_MODEL='deep-model', ESCALATED_EFFORT='max',
            ESCALATE_ABOVE='', ESCALATE_FILES='', MODEL_PINNED='false', EFFORT_PINNED='false',
            PINNED_MODEL='', PINNED_EFFORT='')
        script += 'ESCALATE_PATHS=(' + ' '.join(shlex.quote(glob) for glob in globs) + ')\n'
        script += fence('MATCHED_PATH=')
        script += 'printf "%s\\n" "$MATCHED_PATH" "$MODEL" "$EFFORT"\n'
        script += 'command -v sort >/dev/null && echo path-intact\n'
        env = dict(os.environ, PATH=self.path, FAKE_PATHS='\n'.join(paths),
                   FAKE_REVIEWS=reviews_json)
        return subprocess.run([*argv, '-c', script], cwd=self.root, env=env,
                              capture_output=True, text=True)

    def assert_route(self, result, matched, model, effort):
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.split('\n')[:-1], [matched, model, effort, 'path-intact'],
                         result.stderr)

    @each_shell
    def test_first_review_on_a_matching_path_escalates(self, argv):
        result = self.trigger(argv, ['bin/**'], ['README.md', 'bin/check-stack'])
        self.assert_route(result, 'bin/check-stack', 'deep-model', 'max')

    @each_shell
    def test_no_matching_path_keeps_the_base_model(self, argv):
        result = self.trigger(argv, ['bin/**'], ['README.md', 'binary'])
        self.assert_route(result, '', 'base-model', 'high')

    @each_shell
    def test_no_configured_globs_keeps_the_base_model(self, argv):
        result = self.trigger(argv, [], ['bin/check-stack'])
        self.assert_route(result, '', 'base-model', 'high')

    @each_shell
    def test_follow_up_head_keeps_the_base_model_on_a_matching_path(self, argv):
        result = self.trigger(argv, ['bin/**'], ['bin/check-stack'],
                              reviews_json=json.dumps([[review('codex', 'review-bot')]]))
        self.assert_route(result, 'bin/check-stack', 'base-model', 'high')

    @each_shell
    def test_failed_match_blocks_instead_of_selecting_a_model(self, argv):
        (self.scratch / 'changed-paths.txt').mkdir(exist_ok=True)
        result = self.trigger(argv, ['bin/**'], ['bin/check-stack'])
        self.assertEqual((result.returncode, result.stdout), (2, ''), result.stderr)
        self.assertIn('BLOCKED', result.stderr)

    @each_shell
    def test_failed_count_blocks_instead_of_selecting_a_model(self, argv):
        result = self.trigger(argv, ['bin/**'], ['bin/check-stack'], reviews_json='not json')
        self.assertEqual((result.returncode, result.stdout), (2, ''), result.stderr)
        self.assertIn('BLOCKED', result.stderr)

    def test_preflight_renders_each_glob_in_single_quotes(self):
        line = re.search(r'^ESCALATE_PATHS=\(.*$', fence('ESCALATED_MODEL='), re.M).group()
        self.assertIn('single quotes', line)


class LedgerKeyTests(ShellCase):
    def key(self, argv, **values):
        ledger = self.root / 'ledger'
        ledger.write_text('abc123\t-|handle the empty case\n')
        script = assignments(LEDGER=ledger, TITLE='Handle the empty case.', **values)
        script += fence('key() {')
        script += 'hit=$?\nprintf "%s\\n" "$K" "$hit"\n'
        env = {key: value for key, value in os.environ.items() if key != 'FINDING_PATH'}
        result = subprocess.run([*argv, '-c', script], cwd=self.root, env=env,
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.split('\n')[:-1]

    @each_shell
    def test_finding_without_a_path_keys_on_a_dash(self, argv):
        self.assertEqual(self.key(argv), ['-|handle the empty case', '0'])

    @each_shell
    def test_same_title_in_another_file_is_a_new_finding(self, argv):
        self.assertEqual(self.key(argv, FINDING_PATH='a.py'), ['a.py|handle the empty case', '1'])


class FirstMatchingPathTests(unittest.TestCase):
    def test_fnmatch_rules(self):
        for glob, path, matches in [('bin/**', 'bin/check-stack', True),
                                    ('bin/*', 'bin/sub/tool', True),
                                    ('src/*.py', 'src/deep/module.py', True),
                                    ('bin/?', 'bin/x', True),
                                    ('bin/[ab]', 'bin/c', False),
                                    ('bin/**', 'binary', False),
                                    ('BIN/*', 'bin/x', False)]:
            with self.subTest(glob=glob, path=path):
                self.assertEqual(rt.first_matching_path([path], [glob]), path if matches else None)

    def test_first_path_in_file_order_and_no_globs(self):
        self.assertEqual(rt.first_matching_path(['a', 'b'], ['b', 'a']), 'a')
        self.assertIsNone(rt.first_matching_path(['a'], []))

    def run_cli(self, directory, *globs, paths='README.md\n\nbin/tool\n'):
        file = Path(directory) / 'paths.txt'
        if paths is not None:
            file.write_text(paths)
        return subprocess.run([sys.executable, str(BIN / 'first-matching-path'),
                               '--paths', str(file), '--', *globs],
                              capture_output=True, text=True)

    def test_command_line(self):
        with tempfile.TemporaryDirectory() as directory:
            for globs, expected in [(['bin/*'], 'bin/tool\n'), (['docs/*'], ''), ([], ''),
                                    (['-odd', 'README*'], 'README.md\n')]:
                with self.subTest(globs=globs):
                    result = self.run_cli(directory, *globs)
                    self.assertEqual((result.returncode, result.stdout), (0, expected), result.stderr)

    def test_unreadable_path_list_blocks(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_cli(directory, 'bin/*', paths=None)
            self.assertEqual((result.returncode, result.stdout), (2, ''))
            self.assertIn('BLOCKED', result.stderr)


if __name__ == '__main__':
    unittest.main()
