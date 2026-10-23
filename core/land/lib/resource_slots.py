"""Host-local process permits. Locks survive until the entire command exits."""
from contextlib import contextmanager
import fcntl
import json
import math
import os
from pathlib import Path
import re
import time


@contextmanager
def permit(group, limit, *, root=None, timeout=1800):
    if (not re.fullmatch(r'[A-Za-z0-9_.-]+', group) or group in ('.', '..')
            or type(limit) is not int or limit < 1):
        raise ValueError('invalid slot group or limit')
    if not math.isfinite(timeout) or timeout < 0:
        raise ValueError('slot timeout must be finite and nonnegative')
    root = Path(root or os.environ.get('KSTACK_STATE', Path.home() / '.kstack'))
    directory = root / 'slots' / group
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    deadline = time.monotonic() + timeout
    acquired = None
    while acquired is None:
        # Serialize allocation/configuration so a second caller cannot silently
        # increase a live group's allowance. Empty groups may change their limit.
        with (directory / 'allocation.lock').open('a+') as config_lock:
            fcntl.flock(config_lock, fcntl.LOCK_EX)
            config = directory / 'limit.json'
            old = json.loads(config.read_text()) if config.exists() else limit
            if type(old) is not int or old < 1:
                raise ValueError('invalid persisted slot limit')
            if old != limit:
                held = []
                try:
                    for i in range(old):
                        f = (directory / str(i)).open('a+')
                        try:
                            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        except BlockingIOError:
                            f.close()
                            raise ValueError('slot limit differs from an active group')
                        held.append(f)
                finally:
                    for f in held:
                        f.close()
            config.write_text(json.dumps(limit))
            for i in range(limit):
                f = (directory / str(i)).open('a+')
                try:
                    fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    f.close()
                    continue
                acquired = f
                break
        if acquired is None:
            if time.monotonic() >= deadline:
                raise TimeoutError('resource slot wait expired: ' + group)
            time.sleep(min(.1, max(0, deadline-time.monotonic())))
    try:
        yield acquired.fileno()
    finally:
        acquired.close()
