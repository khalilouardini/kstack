"""Offline oracle for normalized frozen facts, NOT a live triage implementation.

No network, filesystem mutation, natural-language intent extraction, or agent
execution. See README.md for what a passing fixture cannot establish.
"""
from collections import Counter
import re


class EvidenceGap(ValueError):
    pass


def connection(pages):
    """Require explicit exhaustion and independent advancing cursor evidence."""
    rows, cursor, seen = [], None, set()
    if not pages:
        raise EvidenceGap('missing pages')
    for index, page in enumerate(pages):
        if page.get('errors') or page.get('after') != cursor:
            raise EvidenceGap('partial/error or wrong cursor')
        rows.extend(page['nodes'])
        info = page['pageInfo']
        if not info['hasNextPage']:
            if index != len(pages) - 1:
                raise EvidenceGap('pages after exhaustion')
            return rows
        cursor = info.get('endCursor')
        if not cursor or cursor in seen:
            raise EvidenceGap('missing/nonadvancing cursor')
        seen.add(cursor)
    raise EvidenceGap('pagination incomplete')


def review_status(facts):
    head = facts['head']
    stable = all(value == facts['snapshots'][0] for value in facts['snapshots'])
    complete, reviews, threads = True, [], []
    try:
        reviews = connection(facts['reviews'])
        threads = connection(facts['threads'])
    except EvidenceGap:
        complete = False
    counts = Counter({key: 0 for key in ['P0', 'P1', 'P2', 'P3', 'unknown']})
    last = {}
    for thread in {t['id']: t for t in threads}.values():
        try:
            replies = [r for r in connection(thread['replies']) if r['state'] != 'PENDING']
        except EvidenceGap:
            complete = False
            replies = []
        if thread['resolved']:
            continue
        counts[thread.get('priority') or 'unknown'] += 1
        last[thread['id']] = replies[-1]['author'] if replies else None
    valid = []
    history = []
    for review in reviews:
        match = re.search(r'<!-- codex-review head:([a-f0-9]{40}) -->', review['body'])
        if (review['author'] != facts['reviewer'] or review['state'] != 'COMMENTED'
                or 'Review performed by Codex' not in review['body'] or not match
                or review.get('commit', match[1]) != match[1]):
            continue
        history.append(match[1])
        if match[1] == head:
            valid.append(review)
    assessment = 'unknown'
    if stable and complete and valid:
        priorities = valid[-1]['findings']
        if any(p in priorities for p in ['P0', 'P1', 'P2']):
            assessment = 'findings present'
        elif 'P3' in priorities:
            assessment = 'P3-only'
        else:
            assessment = 'no P0–P2'
    ci = facts['ci']
    if ci['mode'] == 'none':
        ci_status = 'missing'
    elif not stable or not ci['complete'] or ci['mode'] not in ['all', 'required']:
        ci_status = 'unknown'
    else:
        buckets = [c['bucket'] for c in ci['checks'] if c['head'] == head]
        names = {c['name'] for c in ci['checks'] if c['head'] == head}
        if any(b in ['fail', 'cancel'] for b in buckets):
            ci_status = 'failure'
        elif 'pending' in buckets:
            ci_status = 'pending'
        elif not buckets or set(ci['expected']) - names:
            ci_status = 'missing'
        elif not ci['expectations_known'] or any(b not in ['pass', 'skipping'] for b in buckets):
            ci_status = 'unknown'
        else:
            ci_status = 'success'
    posted = facts.get('loop')
    loop = posted['verdict'] if posted and posted['attributable'] else 'UNKNOWN'
    loop_head = posted.get('head') if posted and posted['attributable'] else None
    clean_conditions = (assessment in ['no P0–P2', 'P3-only']
                        and (ci_status == 'success' or ci['mode'] == 'none'))
    holds = []
    if not stable:
        holds.append('unstable')
    if not complete:
        holds.append('incomplete')
    if assessment == 'unknown':
        holds.append('no current review evidence')
    if assessment == 'findings present':
        holds.append('current findings')
    if any(counts[p] for p in ['P0', 'P1', 'P2']):
        holds.append('unresolved P0–P2')
    if counts['unknown']:
        holds.append('unknown severity')
    if ci_status != 'success' and ci['mode'] != 'none':
        holds.append('CI ' + ci_status)
    return dict(review=assessment, loop=loop, loop_head=loop_head, ci=ci_status,
                counts=dict(counts), last_authors=last, history=history,
                clean_conditions=clean_conditions, merge_gate=clean_conditions and not holds,
                holds=holds, complete=complete, stable=stable)


def select_projects(facts):
    """Selection arithmetic over preclassified explicit/direct relationships."""
    inputs, labels = facts['filters'], set(facts['labels'])
    selected_projects = set()
    if inputs:
        if not facts['mapping_available']:
            raise EvidenceGap('mapping unavailable')
        projects = connection(facts['projects'])
        for value in inputs:
            matches = [p for p in projects if p['id'] == value]
            if not matches:
                matches = [p for p in projects if p['name'] == value]
            if len(matches) != 1 or facts['team'] not in matches[0]['teams']:
                raise EvidenceGap('project/team resolution')
            selected_projects.add(matches[0]['id'])
        if any(i['project'] not in selected_projects or i['team'] != facts['team']
               for i in facts.get('query_rows', [])):
            raise EvidenceGap('leaked row')
    issues = {issue['id']: issue for issue in facts['issues']}
    selected, reasons = [], Counter({'project-only': 0, 'label-only': 0, 'both': 0})
    for pr in facts['prs']:
        project_match = not inputs
        for link in pr['links'] if inputs else []:
            if link['kind'] not in ['attachment', 'direct']:
                continue
            issue = issues.get(link['issue'])
            if issue is None:
                raise EvidenceGap('issue mapping unavailable')
            if issue['team'] == facts['team'] and issue['project'] in selected_projects:
                project_match = True
        label_match = labels.issubset(pr['labels'])
        if project_match and label_match:
            selected.append(pr['number'])
        else:
            key = 'both' if not project_match and not label_match else 'label-only' if project_match else 'project-only'
            reasons[key] += 1
    return dict(selected=selected, excluded=dict(reasons), projects=sorted(selected_projects))


def changed_paths(count, files):
    if len(files) != count:
        raise EvidenceGap('file count/cap mismatch')
    return {path for f in files for path in [f['filename'], f.get('previous_filename')] if path}
