"""Per-PR CI holds and exact-run evidence. Uses gh; no reviewer process or shell eval."""

import argparse
from datetime import datetime, timezone
import fnmatch
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import quote, urlencode

from review_runtime import Blocked


def config(value):
    if not isinstance(value, dict) or value.get('label') != 'ci:hold':
        raise Blocked('ci.defer.label must be ci:hold (the workflow protocol)')
    workflows = value.get('workflows')
    if not isinstance(workflows, list) or not workflows:
        raise Blocked('ci.defer.workflows must name the opted-in workflows')
    names = set()
    for item in workflows:
        if (not isinstance(item, dict) or not isinstance(item.get('file'), str)
                or not re.fullmatch(r'[\w.-]+\.ya?ml', item['file'])
                or item['file'] in names):
            raise Blocked('ci.defer.workflows requires unique workflow filenames')
        names.add(item['file'])
        paths = item.get('paths')
        if paths is not None and (not isinstance(paths, list) or not paths
                                  or any(not isinstance(p, str) or not p
                                         or p.startswith('!') for p in paths)):
            raise Blocked('ci.defer workflow paths must be positive file globs')
    return value


class Hold:
    def __init__(self, args):
        self.args = args
        self.settings = config(json.loads(args.config.read_text()))
        self.prefix = f'repos/{args.owner_repo}'
        self.state_file = args.state
        self.state = json.loads(args.state.read_text()) if args.state.exists() else None
        self.pr = None

    def gh(self, *args, payload=None, raw=False):
        command = ['gh', *args]
        if payload is not None:
            command += ['--input', '-']
        try:
            result = subprocess.run(command, cwd=self.args.repo_root,
                                    input=json.dumps(payload) if payload is not None else None,
                                    capture_output=True, text=True, timeout=60)
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise Blocked('gh unavailable or timed out; CI hold state retained') from exc
        if result.returncode:
            # gh stderr can contain authentication details. Never echo it or argv.
            raise Blocked('GitHub CI operation failed; CI hold state retained')
        if raw:
            return result.stdout
        return json.loads(result.stdout) if result.stdout.strip() else None

    def api(self, endpoint, method=None, payload=None):
        args = ['api', endpoint]
        if method:
            args += ['--method', method]
        return self.gh(*args, payload=payload)

    def records(self, endpoint, key=None):
        pages = self.gh('api', endpoint, '--paginate', '--slurp')
        if not isinstance(pages, list):
            raise Blocked('incomplete GitHub pagination')
        result = []
        for page in pages:
            items = page.get(key) if key and isinstance(page, dict) else page
            if not isinstance(items, list) or any(not isinstance(v, dict) for v in items):
                raise Blocked('malformed GitHub CI evidence')
            result.extend(items)
        return result

    def verify(self):
        if self.api('user').get('login', '').casefold() != self.args.maintainer.casefold():
            raise Blocked('CI holds require the verified maintainer token')
        self.pr = self.api(f'{self.prefix}/pulls/{self.args.pr}')
        if self.pr.get('state') != 'open' or self.pr['head']['sha'] != self.args.head:
            raise Blocked('CI_HEAD_MOVED: PR is closed or its head changed')
        if self.state is not None:
            if (self.state.get('owner_repo') != self.args.owner_repo
                    or self.state.get('pr') != self.args.pr
                    or self.state.get('config') != self.settings):
                raise Blocked('CI hold state belongs to a different PR or configuration')

    def held(self):
        labels = self.records(f'{self.prefix}/issues/{self.args.pr}/labels?per_page=100')
        return any(v['name'] == self.settings['label'] for v in labels)

    def workflows(self):
        changes = self.records(f'{self.prefix}/pulls/{self.args.pr}/files?per_page=100')
        if len(changes) != self.pr.get('changed_files'):
            raise Blocked('complete PR file pagination is required to select deferred workflows')
        filenames = [v[k] for v in changes for k in ('filename', 'previous_filename') if k in v]
        selected = [v['file'] for v in self.settings['workflows']
                    if v.get('paths') is None or any(fnmatch.fnmatchcase(name, pattern)
                                                    for name in filenames for pattern in v['paths'])]
        if not selected:
            raise Blocked('no deferred workflow applies to this PR')
        return selected

    def save(self):
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.state_file.with_suffix('.tmp')
        temporary.write_text(json.dumps(self.state, indent=2) + '\n')
        os.replace(temporary, self.state_file)

    def runs(self, workflow, head=None):
        query = dict(event='pull_request', per_page=100)
        if head:
            query['head_sha'] = head
        else:
            query['branch'] = self.pr['head']['ref']
        return self.records(f'{self.prefix}/actions/workflows/{quote(workflow, safe="")}/runs?'
                            + urlencode(query), 'workflow_runs')

    def belongs(self, run):
        return (run.get('event') == 'pull_request'
                and any(p.get('number') == self.args.pr for p in run.get('pull_requests', [])))

    def acquire(self):
        self.verify()
        if (self.state and self.state.get('head') == self.args.head
                and self.state.get('phase') in ('releasing', 'released')):
            # A same-head CI retry must not restart CI or buy another review.
            return self.release()
        if self.held() and self.state is None:
            raise Blocked('ci:hold already exists without this controller\'s durable state')
        workflows = self.workflows()
        try:
            label = self.api(f'{self.prefix}/labels/{quote(self.settings["label"], safe="")}')
        except Blocked as exc:
            raise Blocked('ci:hold repository label must exist before --defer-ci') from exc
        if label.get('name') != self.settings['label']:
            raise Blocked('ci:hold repository label must exist before --defer-ci')
        # An explicit marker is the consuming workflow's opt-in contract. Read
        # the remote PR head, rather than trusting a stale local checkout.
        for name in workflows:
            raw = self.gh('api', f'{self.prefix}/contents/.github/workflows/{name}?ref={self.args.head}',
                          '-H', 'Accept: application/vnd.github.raw+json', raw=True)
            if not isinstance(raw, str) or '# kstack-defer-ci: ci:hold' not in raw:
                raise Blocked(f'{name} has not opted into the ci:hold protocol')
        self.state = dict(owner_repo=self.args.owner_repo, pr=self.args.pr,
                          head=self.args.head, config=self.settings,
                          phase='acquiring', workflows=workflows)
        self.save()  # Keep ownership even if interrupted during the mutation.
        self.api(f'{self.prefix}/issues/{self.args.pr}/labels', 'POST',
                 {'labels': [self.settings['label']]})
        if not self.held():
            raise Blocked('ci:hold did not appear on the PR')
        self.state['phase'] = 'holding'
        self.save()
        cancelled = []
        for workflow in workflows:
            for run in self.runs(workflow):
                if self.belongs(run) and run.get('status') != 'completed':
                    try:
                        self.api(f'{self.prefix}/actions/runs/{run["id"]}/cancel', 'POST')
                    except Blocked:
                        current = self.api(f'{self.prefix}/actions/runs/{run["id"]}')
                        if current.get('status') != 'completed':
                            raise
                    cancelled.append(run['id'])
        self.verify()
        return dict(status='CI_HELD', label=self.settings['label'], cancelled=cancelled)

    def release(self):
        self.verify()
        if self.state is None or self.state.get('head') != self.args.head:
            raise Blocked('no saved CI hold for the reviewed head')
        phase = self.state.get('phase')
        if phase not in ('holding', 'releasing', 'released'):
            raise Blocked('CI hold acquisition must finish before release')
        if phase == 'holding':
            if not self.held():
                raise Blocked('ci:hold was removed outside the controller before release')
            self.state['workflows'] = self.workflows()
            self.state['baseline'] = {w: [r['id'] for r in self.runs(w, self.args.head)]
                                      for w in self.state['workflows']}
            self.state['released_after'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            self.state['runs'] = {}
            self.state['phase'] = 'releasing'
            self.save()  # Save BEFORE deleting: a crash must not swallow the new run.
        if self.held():
            if phase == 'released':
                raise Blocked('ci:hold was reapplied outside the controller')
            self.api(f'{self.prefix}/issues/{self.args.pr}/labels/{quote(self.settings["label"], safe="")}',
                     'DELETE')
        if self.held():
            raise Blocked('ci:hold is still present after release')
        self.state['phase'] = 'released'
        self.save()
        self.verify()
        return dict(status='CI_RELEASED', head=self.args.head, state=str(self.state_file))

    def check(self):
        self.verify()
        if (self.state is None or self.state.get('head') != self.args.head
                or self.state.get('phase') != 'released' or self.held()):
            raise Blocked('CI has not been released for this reviewed head')
        pending, evidence = [], []
        for workflow in self.state['workflows']:
            run_id = self.state['runs'].get(workflow)
            if run_id is None:
                candidates = [r for r in self.runs(workflow, self.args.head)
                              if self.belongs(r) and r.get('head_sha') == self.args.head
                              and r.get('display_title') == self.release_title()
                              and r['id'] not in self.state['baseline'][workflow]
                              and r.get('created_at', '') >= self.state['released_after']]
                if not candidates:
                    pending.append(workflow + ': awaiting release-triggered run')
                    continue
                run_id = max(r['id'] for r in candidates)
                self.state['runs'][workflow] = run_id
                self.save()
            run = self.api(f'{self.prefix}/actions/runs/{run_id}')
            if (not self.belongs(run) or run.get('head_sha') != self.args.head
                    or run.get('display_title') != self.release_title()
                    or run.get('path', '').split('@', 1)[0] != '.github/workflows/' + workflow):
                raise Blocked('released CI run does not match this PR, workflow and reviewed head')
            if run.get('status') != 'completed':
                pending.append(workflow + ': ' + str(run.get('status')))
                continue
            if run.get('conclusion') != 'success':
                raise Blocked(f'{workflow} run {run_id}: {run.get("conclusion")}')
            jobs = self.records(f'{self.prefix}/actions/runs/{run_id}/jobs?filter=latest&per_page=100', 'jobs')
            if not jobs:
                raise Blocked(f'{workflow} run {run_id}: no executed jobs')
            for job in jobs:
                if (job.get('status') != 'completed' or job.get('conclusion') != 'success'
                        or not job.get('started_at') or not any(step.get('conclusion') == 'success'
                                                              for step in job.get('steps', []))):
                    raise Blocked(f'{workflow} run {run_id}: job {job.get("name")} did not execute successfully')
            evidence.append(dict(workflow=workflow, run_id=run_id, url=run.get('html_url'),
                                 jobs=[v['name'] for v in jobs]))
        self.verify()
        if self.held():
            raise Blocked('ci:hold was reapplied while checking the released run')
        return dict(status='CI_PENDING' if pending else 'CI_GREEN', head=self.args.head,
                    pending=pending, runs=evidence)

    def release_title(self):
        return f'kstack-ci-release pr:{self.args.pr} head:{self.args.head}'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['hold', 'release', 'check'])
    parser.add_argument('--repo-root', type=Path, required=True)
    parser.add_argument('--owner-repo', required=True)
    parser.add_argument('--pr', type=int, required=True)
    parser.add_argument('--head', required=True)
    parser.add_argument('--maintainer', required=True)
    parser.add_argument('--config', type=Path, required=True)
    parser.add_argument('--state', type=Path, required=True)
    args = parser.parse_args()
    try:
        if (args.pr <= 0 or not re.fullmatch(r'[\w.-]+/[\w.-]+', args.owner_repo)
                or not re.fullmatch(r'[0-9a-f]{40}', args.head)):
            raise Blocked('invalid PR, repository or reviewed head')
        args.state.parent.mkdir(parents=True, exist_ok=True)
        with args.state.with_suffix('.lock').open('a+') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise Blocked('another CI hold operation owns this PR state') from exc
            hold = Hold(args)
            result = {'hold': hold.acquire, 'release': hold.release, 'check': hold.check}[args.action]()
        print(json.dumps(result))
    except (Blocked, OSError, ValueError, KeyError, TypeError) as exc:
        print(json.dumps(dict(status='BLOCKED', reason=str(exc))))
        raise SystemExit(2)


if __name__ == '__main__':
    main()
