import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[4]
spec = importlib.util.spec_from_file_location('resource_slots', ROOT / 'core/land/lib/resource_slots.py')
slots = importlib.util.module_from_spec(spec)
spec.loader.exec_module(slots)
BIN = ROOT / 'core/land/bin/with-slot'


class Slots(unittest.TestCase):
    def test_process_bound_and_release_on_exception(self):
        with tempfile.TemporaryDirectory() as root:
            with slots.permit('tests', 1, root=root):
                p = subprocess.run([sys.executable, str(BIN), '--group', 'tests', '--limit', '1',
                    '--state-root', root, '--wait', '0', '--', sys.executable, '-c', 'print("RAN")'], capture_output=True, text=True)
                self.assertEqual(p.returncode, 75)
                self.assertNotIn('RAN', p.stdout)
                self.assertIn('resource slot wait expired', p.stderr)
                with self.assertRaises(ValueError):
                    with slots.permit('tests', 2, root=root, timeout=0):
                        self.fail('increased an active limit')
            try:
                with slots.permit('tests', 1, root=root):
                    raise RuntimeError('fixture')
            except RuntimeError:
                pass
            with slots.permit('tests', 2, root=root, timeout=0):
                with slots.permit('tests', 2, root=root, timeout=0):
                    with self.assertRaises(TimeoutError):
                        with slots.permit('tests', 2, root=root, timeout=0):
                            self.fail('exceeded limit')

    def test_argv_is_not_shell_and_exit_is_preserved(self):
        with tempfile.TemporaryDirectory() as root:
            p = subprocess.run([sys.executable, str(BIN), '--group', 'tests', '--limit', '1',
                '--state-root', root, '--', sys.executable, '-c',
                'import sys; print(sys.argv[1]); sys.exit(7)', '$(echo unsafe); literal'], capture_output=True, text=True)
            self.assertEqual(p.returncode, 7)
            self.assertEqual(p.stdout.strip(), '$(echo unsafe); literal')

    def test_invalid_groups_and_limits(self):
        for group, limit in [('../escape', 1), ('..', 1), ('.', 1), ('tests', 0), ('tests', True)]:
            with self.assertRaises(ValueError):
                with slots.permit(group, limit, timeout=0):
                    self.fail('invalid input')
