#!/usr/bin/env python3
"""Deterministic executable fixture. Never connects to a model or GitHub."""
import json
import os
from pathlib import Path
import sys

state_path = Path(os.environ['REVIEW_FAKE_STATE'])
s = json.loads(state_path.read_text())
name = Path(sys.argv[0]).name
args = sys.argv[1:]
s['calls'].append({'name': name, 'args': args, 'cwd': os.getcwd(),
                   'has_expected_token': os.environ.get('GH_TOKEN') == 'fixture-secret',
                   'has_other_token': 'GITHUB_TOKEN' in os.environ})
state_path.write_text(json.dumps(s))
mode = s.get('mode', '')


def emit(value):
    print(json.dumps(value))
    sys.exit(0)


if name == 'git':
    if args[0] == 'rev-parse':
        print('a' * 40)
    elif mode == 'edited' and s.get('posted'):
        print(' M implementation.py')
    sys.exit(0)
if name == 'gh':
    if args[:2] == ['auth', 'token']:
        print('fixture-secret')
        sys.exit(0)
    assert args[0] == 'api'
    endpoint = args[-1]
    if endpoint == 'user':
        emit({'login': 'wrong' if mode == 'wrong-token' else s['route']['reviewer']})
    if endpoint.endswith('/commits'):
        assert '--paginate' in args and '--slurp' in args
        emit([s['commits']])
    if endpoint.endswith('/reviews'):
        assert '--paginate' in args and '--slurp' in args
        emit([[], s['reviews'] if s.get('posted') or s.get('reuse') else []])
    if endpoint.endswith('/comments'):
        assert '--paginate' in args and '--slurp' in args
        emit([[], s.get('comments', [])])
    value = s['pr']
    if mode == 'head-moved' and s.get('posted'):
        value['head']['sha'] = 'b' * 40
    emit(value)
if '--help' in args:
    if mode == 'unsupported':
        print('old CLI without required flags')
    else:
        print('--print --output-format --permission-prompts --model --effort --cd --output-last-message --config --enable')
    sys.exit(0)
if '--version' in args:
    print('fixture-cli 1.0')
    sys.exit(0)
if args == ['auth', 'status']:
    emit({'loggedIn': mode != 'unauthenticated'})
if mode == 'nonzero':
    print('fixture-secret', file=sys.stderr)
    sys.exit(9)
assert sys.stdin.read() == ''
assert os.environ.get('GH_TOKEN') == 'fixture-secret'
assert 'GITHUB_TOKEN' not in os.environ
assert args[-1].find(s['route']['head']) >= 0
assert 'https://github.com/example/repo/pull/16' in args[-1]
assert str(Path(s['skill']).resolve()) in args[-1]
s['posted'] = mode != 'no-review'
state_path.write_text(json.dumps(s))
if mode == 'empty':
    sys.exit(0)
if mode == 'malformed':
    print('done')
    sys.exit(0)
report = {'status': 'BLOCKED' if mode == 'blocked-report' else 'REVIEW_SUBMITTED',
          'review_id': 999 if mode == 'wrong-report-id' else 123, 'head': 'a' * 40}
if name == 'claude':
    emit({'type': 'result', 'subtype': 'success', 'is_error': mode == 'error-envelope',
          'permission_denials': ['Bash'] if mode == 'denied' else [], 'result': json.dumps(report)})
if name == 'codex':
    Path(args[args.index('-o') + 1]).write_text(json.dumps(report))
    print('events are not the final report')
