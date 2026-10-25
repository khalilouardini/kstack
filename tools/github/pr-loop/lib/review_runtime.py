"""Deterministic boundaries for the prompt-driven loop. Stdlib, no shell eval."""
import argparse
from contextlib import nullcontext
import hashlib
import sys
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time


class Blocked(ValueError):
    pass


ENGINES = {'codex', 'claude'}
SHA = re.compile(r'[0-9a-f]{40}')
TRAILER = re.compile(r'^Co-Authored-By: (Codex|Claude)\b[^\n]*<[^<>\s]+@[^<>\s]+>\s*$', re.I)


def pages(value):
    if not isinstance(value, list):
        raise Blocked('expected a complete JSON array (gh --paginate --slurp)')
    if value and all(isinstance(page, list) for page in value):
        value = [item for page in value for item in page]
    if not all(isinstance(item, dict) for item in value):
        raise Blocked('malformed paginated records')
    return value


def resolve(maintainer, reviewer, implementer, pr, commits,
            reviewer_engine='codex', implementer_engine='claude',
            implementation_engine=None, any_author=False):
    accounts = [maintainer, reviewer, implementer]
    if any(not isinstance(v, str) or not re.fullmatch(r'[\w-]+(?:\[bot\])?', v)
           or v == 'null' for v in accounts):
        raise Blocked('identities.maintainer, reviewer, and implementer are required logins')
    if len({v.casefold() for v in accounts}) != 3:
        raise Blocked('maintainer, reviewer, and implementer must be distinct')
    reviewer_engine = reviewer_engine or 'codex'
    implementer_engine = implementer_engine or 'claude'
    if {reviewer_engine, implementer_engine} != ENGINES:
        raise Blocked('review_engines must map distinct accounts to codex and claude')
    if implementation_engine is not None and implementation_engine not in ENGINES:
        raise Blocked('unsupported implementation engine')
    commits = pages(commits)
    if (not commits or len(commits) != pr.get('commits')
            or len({c.get('sha') for c in commits}) != len(commits)):
        raise Blocked('complete PR commit pagination is required')
    head = pr['head']['sha']
    if not SHA.fullmatch(head) or head not in {c.get('sha') for c in commits}:
        raise Blocked('commit evidence does not contain the exact PR head')
    account_engines = {reviewer.casefold(): reviewer_engine,
                       implementer.casefold(): implementer_engine}
    evidence = set()
    for commit in commits:
        login = ((commit.get('author') or {}).get('login') or '').casefold()
        if login in account_engines:
            evidence.add(account_engines[login])
        # Exact historical GitHub attribution, not a substring of a bot login.
        if login == 'claude':
            evidence.add('claude')
        for line in commit['commit']['message'].splitlines():
            match = TRAILER.fullmatch(line)
            if match:
                evidence.add(match[1].lower())
    source = 'commits'
    # A legacy bot opener is evidence only in the absence of commit signals.
    if not evidence:
        author = pr['user']['login'].casefold()
        if author in account_engines:
            evidence.add(account_engines[author])
            source = 'legacy-pr-author'
    if implementation_engine:
        if evidence and implementation_engine not in evidence:
            raise Blocked('explicit engine conflicts with attributed implementation')
        selected = implementation_engine
    elif len(evidence) == 1:
        selected = next(iter(evidence))
    else:
        raise Blocked('ambiguous implementation engine; supply --implementation-engine')
    if not evidence and not any_author:
        raise Blocked('no agent authorship evidence; --any-author is required separately')
    reverse = selected == reviewer_engine
    return dict(
        direction='reverse' if reverse else 'forward',
        reviewer=implementer if reverse else reviewer,
        implementer=reviewer if reverse else implementer,
        reviewer_engine=implementer_engine if reverse else reviewer_engine,
        implementer_engine=selected, maintainer=maintainer,
        evidence=sorted(evidence), source=source if evidence else 'any-author',
        head=head, pr=pr['number'],
        resolution=dict(maintainer=maintainer, reviewer=reviewer, implementer=implementer,
                        reviewer_engine=reviewer_engine, implementer_engine=implementer_engine,
                        implementation_engine=implementation_engine, any_author=any_author),
    )


def invoking_host(environ=None):
    """Identify the agent that launched this shell, independently of PR evidence."""
    environ = os.environ if environ is None else environ
    codex = bool(environ.get('CODEX_SESSION_ID') or environ.get('CODEX_THREAD_ID'))
    claude = environ.get('CLAUDE_CODE_CHILD_SESSION') == '1'
    if codex == claude:
        raise Blocked('cannot uniquely identify invoking Codex or Claude Code session')
    return 'codex' if codex else 'claude'


def controller(route, delegated=False, environ=None):
    if delegated:
        raise Blocked('automatic loop delegation is unsupported; one implementation controller only')
    host = invoking_host(environ)
    if host != route['implementer_engine']:
        raise Blocked('run pr-loop in the ' + route['implementer_engine'] + ' implementation session')
    return host


def review_evidence(reviews, comments, reviewer, engine, head):
    """Return verified findings or None. Never interpret missing prose as clean."""
    marker = f'<!-- {engine}-review head:{head} -->'
    candidates = [r for r in pages(reviews)
                  if (r.get('user') or {}).get('login', '').casefold() == reviewer.casefold()
                  and marker in (r.get('body') or '')
                  and r.get('state') in ('COMMENTED', 'CHANGES_REQUESTED')]
    if not candidates:
        return None
    review = max(candidates, key=lambda r: r['id'])
    body = review.get('body', '')
    label = 'Codex' if engine == 'codex' else 'Claude'
    if (review.get('commit_id') != head or not review.get('submitted_at')
            or f'**Review performed by {label}.**' not in body):
        raise Blocked('review has wrong commit, missing submission, or false engine attribution')
    findings = []
    section = re.search(r'^### Findings\s*\n(.*?)(?=^### |\Z)', body, re.M | re.S)
    # Formatted reviews parse only the Findings section. Headerless historical
    # reviews retain their strict priority-line parsing.
    finding_lines = (section[1].splitlines() if section else
                     [] if re.search(r'^### ', body, re.M) else body.splitlines())
    for line in finding_lines:
        if not re.match(r'^\s*(?:\d+\.\s+)?(?:\*\*)?\[P[^\]]*\]', line):
            continue
        match = re.fullmatch(r'\d+\. \*\*\[P([0-3])\] (.+?)\*\* — `(.+?):\d+(?:-\d+)?`', line)
        if not match:
            raise Blocked('malformed review finding; expected numbered priority/title/path:line')
        findings.append(dict(priority=int(match[1]), title=match[2], path=match[3]))
    for comment in pages(comments):
        if comment.get('pull_request_review_id') != review['id'] or comment.get('in_reply_to_id'):
            continue
        match = re.match(r'(?:\*\*)?\[P([0-3])\] (.+?)(?:\*\*)?\s*(?:\n|$)', comment.get('body', ''))
        if not match or not comment.get('path'):
            raise Blocked('malformed inline finding')
        item = dict(priority=int(match[1]), title=match[2], path=comment['path'])
        if item not in findings:
            findings.append(item)
    no_findings = bool(re.search(r'^\s*No findings\.(?:\s|$)', body, re.M))
    if (not findings and not no_findings) or (findings and no_findings):
        raise Blocked('absent or contradictory review verdict')
    return dict(review_id=review['id'], review_url=review.get('html_url'), head=head,
                reviewer=reviewer, engine=engine, findings=findings,
                status='FINDINGS' if any(f['priority'] <= 2 for f in findings) else 'REVIEW_CLEAR')


def prior_review_count(reviews, reviewer, engine):
    """Count submitted reviews with matching account, engine and commit marker."""
    if engine not in ENGINES:
        raise Blocked('invalid reviewer engine')
    marker = re.compile(rf'<!-- {engine}-review head:([0-9a-f]{{40}}) -->')
    label = 'Codex' if engine == 'codex' else 'Claude'
    count = 0
    for review in pages(reviews):
        body = review.get('body') or ''
        match = marker.search(body)
        if ((review.get('user') or {}).get('login', '').casefold() == reviewer.casefold()
                and review.get('state') in ('COMMENTED', 'CHANGES_REQUESTED')
                and review.get('submitted_at') and match
                and review.get('commit_id') == match[1]
                and f'**Review performed by {label}.**' in body):
            count += 1
    return count


def command(engine, repo, model, effort, prompt, report, fast=False):
    if not model or model.startswith('-') or not re.fullmatch(r'[\w./:-]+', model):
        raise Blocked('invalid reviewer model')
    if effort not in {'low', 'medium', 'high', 'xhigh', 'max'}:
        raise Blocked('unsupported reviewer effort')
    if engine == 'claude':
        if fast or model.startswith(('gpt-', 'o1', 'o3', 'o4')):
            raise Blocked('Claude cannot use Codex --fast or GPT model settings')
        # Use Claude's normal auto classifier. Unapproved prompts remain denied
        # because this child has no interactive permission responder.
        return ['claude', '--print', '--output-format', 'json', '--permission-mode', 'auto',
                '--permission-prompts', 'none',
                '--model', model, '--effort', effort, prompt]
    if engine != 'codex' or model.startswith(('claude', 'sonnet', 'opus', 'haiku')):
        raise Blocked('invalid Codex engine/model')
    # Inherit host permissions. Never lower its sandbox or suppress its rules.
    args = ['codex', 'exec', '-C', str(repo), '-o', str(report), '-m', model,
            '-c', 'model_reasoning_effort=' + effort]
    if fast:
        args += ['-c', 'service_tier="fast"', '--enable', 'fast_mode']
    return args + [prompt]


def run(argv, *, cwd, env=None, timeout=60, pass_fds=()):
    try:
        result = subprocess.run(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                capture_output=True, text=True, timeout=timeout, pass_fds=pass_fds)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise Blocked('command unavailable or timed out: ' + argv[0]) from exc
    if result.returncode:
        # A child can echo a credential or full prompt; do not log stderr/argv.
        raise Blocked(f'{argv[0]} exited {result.returncode}; no verified review')
    return result.stdout


def decode(text):
    try:
        return json.loads(text)
    except (ValueError, TypeError) as exc:
        raise Blocked('invalid JSON evidence') from exc


def cli_report(engine, text):
    if not text.strip():
        raise Blocked('missing reviewer report')
    if engine == 'claude':
        data = decode(text)
        if isinstance(data, dict) and data.get('permission_denials'):
            names = sorted({str(d.get('tool_name', 'unknown')) for d in data['permission_denials']
                            if isinstance(d, dict)})
            names = [n for n in names if re.fullmatch(r'[A-Za-z0-9_]+', n)]
            raise Blocked('Claude tool permission denied: ' + ', '.join(names or ['unknown'])
                          + '; use the normal host approval flow before retrying')
        if (not isinstance(data, dict) or data.get('type') != 'result'
                or data.get('subtype') != 'success' or data.get('is_error') is not False
                or data.get('permission_denials') != []):
            raise Blocked('Claude failed, denied permissions, or returned an incomplete report')
        text = data.get('result', '')
    report = decode(text)
    if (not isinstance(report, dict) or report.get('status') != 'REVIEW_SUBMITTED'
            or type(report.get('review_id')) is not int or report['review_id'] <= 0
            or not SHA.fullmatch(report.get('head', ''))):
        raise Blocked('reviewer did not report a submitted review with exact head and ID')
    return report


def execute(args):
    repo = Path(args.repo_root).resolve(strict=True)
    skill = Path(args.skill)
    if not skill.is_absolute() or not skill.is_file():
        raise Blocked('review skill must be a readable canonical absolute path')
    skill = skill.resolve()
    if 'kstack pointer' in skill.read_text():
        raise Blocked('follow the generated pointer to the canonical review skill')
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', args.owner_repo) or args.pr <= 0:
        raise Blocked('invalid repository or PR')
    route = decode(Path(args.route).read_text())
    controller(route)
    engine = route['reviewer_engine']
    report_dir = Path(args.report_dir).resolve()
    if report_dir == repo or repo in report_dir.parents:
        raise Blocked('reports must live outside the repository')
    report_dir.mkdir(parents=True, exist_ok=False, mode=0o700)
    report = report_dir / 'report.txt'
    command(engine, repo, args.model, args.effort, '', report, args.fast)
    env = os.environ.copy()
    for key in ('GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN'):
        env.pop(key, None)
    token = run(['gh', 'auth', 'token', '--hostname', 'github.com', '--user', route['reviewer']],
                cwd=repo, env=env).strip()
    if not token:
        raise Blocked('reviewer credential is absent')
    env['GH_TOKEN'] = token
    env['GH_HOST'] = 'github.com'

    def api(path, paginate=False):
        argv = ['gh', 'api'] + (['--paginate', '--slurp'] if paginate else []) + [path]
        return decode(run(argv, cwd=repo, env=env))

    if api('user').get('login', '').casefold() != route['reviewer'].casefold():
        raise Blocked('reviewer token belongs to the wrong account')
    endpoint = f'repos/{args.owner_repo}/pulls/{args.pr}'

    def fresh():
        pr = api(endpoint)
        if pr.get('state') != 'open' or pr['head']['sha'] != args.head:
            raise Blocked('PR is closed or its head moved')
        current = resolve(pr=pr, commits=api(endpoint + '/commits', True), **route['resolution'])
        if current != route:
            raise Blocked('live route differs from the pinned route')

    def observed():
        return review_evidence(api(endpoint + '/reviews', True), api(endpoint + '/comments', True),
                               route['reviewer'], engine, args.head)

    fresh()
    evidence = observed()
    if evidence:
        fresh()
        return dict(evidence, reused=True, cli_version=None)
    if not shutil.which(engine):
        raise Blocked('missing reviewer CLI: ' + engine)
    help_text = run([engine, 'exec', '--help'] if engine == 'codex' else [engine, '--help'], cwd=repo)
    required = (['--print', '--output-format', '--permission-mode', '--permission-prompts',
                 '--model', '--effort']
                if engine == 'claude' else ['--cd', '--output-last-message', '--model', '--config'])
    if args.fast and engine == 'codex':
        required += ['--enable']
    if any(flag not in help_text for flag in required):
        raise Blocked('installed reviewer CLI lacks required flags')
    version = run([engine, '--version'], cwd=repo).strip()
    if engine == 'claude':
        auth = decode(run(['claude', 'auth', 'status'], cwd=repo))
        if auth.get('loggedIn') is not True:
            raise Blocked('Claude CLI is not authenticated')
    prompt = (f'Read and follow the canonical review-only skill {skill}. Review exactly '
              f'https://github.com/{args.owner_repo}/pull/{args.pr} at head {args.head}. '
              f'Expected resolved route: {json.dumps(route)}. You are the {engine} reviewer; '
              'verify your actual engine matches. Recompute the route from complete live commits '
              'and stop on mismatch. The parent has authorized this exact review and posting it. '
              'Post one submitted COMMENT review with commit_id pinned to that exact head and '
              'the engine-specific marker. Never edit implementation, commit, push, fix findings, '
              'or start/delegate pr-loop. Your process already has GH_TOKEN bound to '
              f'{route["reviewer"]}; verify it with gh api user and use it for all GitHub reads '
              'and review submission. Do not obtain or use a maintainer credential, and do not '
              'reset to the configured default reviewer. Recompute provenance with this same token. '
              'Respect host permissions; denial, absent evidence or moved head means BLOCKED. '
              'Your final response must be only a JSON object: '
              '{"status":"REVIEW_SUBMITTED","review_id":123,"head":"<full reviewed SHA>"}. '
              'Use the actual submitted ID. On failure return {"status":"BLOCKED"}.')
    argv = command(engine, repo, args.model, args.effort, prompt, report, args.fast)
    before = (run(['git', 'rev-parse', 'HEAD'], cwd=repo),
              run(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=repo))
    if before[0].strip() != args.head or any(
            line and not line.startswith('?? ') for line in before[1].splitlines()):
        raise Blocked('review checkout must be clean at the exact PR head')
    slots = getattr(args, 'review_slots', None)
    if slots is not None:
        sys.path.insert(0, str(Path(__file__).resolve().parents[4] / 'core/land/lib'))
        from resource_slots import permit
        account_key = hashlib.sha256(route['reviewer'].casefold().encode()).hexdigest()
        admission = permit('review-' + engine + '-' + account_key, slots,
                           root=getattr(args, 'slot_state', None), timeout=args.slot_wait)
    else:
        admission = nullcontext(None)
    queued_at = time.monotonic()
    with admission as fd:
        acquired_at = time.monotonic()
        # Waiting for a permit can make both the head and the skip-check stale.
        fresh()
        evidence = observed()
        if evidence:
            return dict(evidence, reused=True, cli_version=version)
        current = (run(['git', 'rev-parse', 'HEAD'], cwd=repo),
                   run(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=repo))
        if current != before:
            raise Blocked('review checkout changed while waiting for a resource permit')
        started_at = time.monotonic()
        output = run(argv, cwd=repo, env=env, timeout=args.timeout,
                     pass_fds=() if fd is None else (fd,))
        finished_at = time.monotonic()
    if engine == 'claude':
        report.write_text(output.replace(token, '[REDACTED]'))
    if not report.is_file():
        raise Blocked('reviewer did not produce a captured report')
    text = report.read_text()
    report.write_text(text.replace(token, '[REDACTED]'))
    submitted = cli_report(engine, text)
    after = (run(['git', 'rev-parse', 'HEAD'], cwd=repo),
             run(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=repo))
    if before != after:
        raise Blocked('reviewer changed implementation state; preserve it for inspection')
    fresh()
    evidence = observed()
    if not evidence:
        raise Blocked('CLI completed without a valid submitted GitHub review')
    if submitted['head'] != args.head or submitted['review_id'] != evidence['review_id']:
        raise Blocked('captured report does not match submitted GitHub evidence')
    fresh()
    return dict(evidence, reused=False, cli_version=version,
                timing=dict(slot_wait_seconds=acquired_at-queued_at,
                            reviewer_process_seconds=finished_at-started_at))


def route_main():
    parser = argparse.ArgumentParser(description='Resolve review roles from complete REST evidence')
    for key in ('maintainer', 'reviewer', 'implementer', 'pr-json', 'commits-json'):
        parser.add_argument('--' + key, required=True)
    parser.add_argument('--reviewer-engine', default='codex')
    parser.add_argument('--implementer-engine', default='claude')
    parser.add_argument('--implementation-engine', choices=sorted(ENGINES))
    parser.add_argument('--any-author', action='store_true')
    args = vars(parser.parse_args())
    try:
        args['pr'] = decode(Path(args.pop('pr_json')).read_text())
        args['commits'] = decode(Path(args.pop('commits_json')).read_text())
        print(json.dumps(resolve(**args)))
    except (Blocked, OSError, ValueError, TypeError, KeyError, AttributeError, TimeoutError) as exc:
        parser.exit(2, 'BLOCKED: ' + str(exc) + '\n')


def controller_host_main():
    parser = argparse.ArgumentParser(description='Verify the invoking pr-loop host')
    parser.add_argument('--route', required=True)
    args = parser.parse_args()
    try:
        print(controller(decode(Path(args.route).read_text())))
    except (Blocked, OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
        parser.exit(2, 'BLOCKED: ' + str(exc) + '\n')


def prior_count_main():
    parser = argparse.ArgumentParser(description='Count verified historical reviewer submissions')
    parser.add_argument('--reviews', required=True)
    parser.add_argument('--reviewer', required=True)
    parser.add_argument('--engine', required=True, choices=sorted(ENGINES))
    args = parser.parse_args()
    try:
        reviews = decode(Path(args.reviews).read_text())
        print(prior_review_count(reviews, args.reviewer, args.engine))
    except (Blocked, OSError, ValueError, TypeError, KeyError, AttributeError, TimeoutError) as exc:
        parser.exit(2, 'BLOCKED: ' + str(exc) + '\n')


def review_main():
    parser = argparse.ArgumentParser(description='One independent review; never certifies CI/CLEAN')
    for key in ('repo-root', 'skill', 'owner-repo', 'head', 'route', 'model', 'effort', 'report-dir'):
        parser.add_argument('--' + key, required=True)
    parser.add_argument('--pr', required=True, type=int)
    parser.add_argument('--fast', action='store_true')
    parser.add_argument('--timeout', type=int, default=1800)
    parser.add_argument('--slot-wait', type=float, default=7200)
    parser.add_argument('--review-slots', type=int)
    parser.add_argument('--slot-state')
    args = parser.parse_args()
    try:
        print(json.dumps(execute(args)))
    except TimeoutError as exc:
        print(json.dumps(dict(status='SLOT_WAIT_TIMEOUT', reason=str(exc))))
        raise SystemExit(75)
    except (Blocked, OSError, ValueError, TypeError, KeyError, AttributeError, TimeoutError) as exc:
        print(json.dumps(dict(status='BLOCKED', reason=str(exc))))
        raise SystemExit(2)
