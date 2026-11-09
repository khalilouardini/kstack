#!/usr/bin/env python3
"""Deterministic half of the pr-label-sweep skill (the SKILL.md one directory up).

Runs every gh call itself, with the repository as its working directory, so an
unattended run needs exactly one allow rule, naming this file by absolute path:
    Bash(python3 <absolute path to this file>:*)

Usage:
    pr_label_sweep.py --repo-dir DIR keys
        Print the issue keys the open PRs resolve to, as JSON. The caller looks
        each key up with the tracker MCP (get_issue) and passes the results back
        with --tracker-file.
    pr_label_sweep.py --repo-dir DIR plan  [--tracker-file PATH]
        Dry run: print the proposal table and counts. Writes nothing.
    pr_label_sweep.py --repo-dir DIR apply [--tracker-file PATH]
        Print the same table, then add the labels and verify each PR.

--tracker-file holds a JSON object keyed by issue key:
    {"<PREFIX>-128": {"project": "<project name>", "labels": ["x"], "title": "..."},
     "<PREFIX>-999": null}
null marks a key get_issue did not find. It is a file, not an argument, because
issue titles carry quotes that break shell quoting. Without it, linear_project
and linear_label matchers are skipped and the report says so.

The last line of output is always `SUMMARY {json}`.
Exit codes: 0 done, 1 an apply step failed, 2 configuration refusal.
"""
import argparse
import fnmatch
import json
import os
import re
import subprocess
import sys

TRACKER_MATCHERS = ("linear_project", "linear_label")
# Linear's magic words (linear.app/docs/gitlab), plus "refs". A word links only when it
# opens a line and the key follows it directly; a label also needs its colon.
LINK_WORDS = (
    "close|closes|closed|closing|fix|fixes|fixed|fixing|resolve|resolves|resolved|resolving|"
    "complete|completes|completed|completing|implement|implements|implemented|implementing|"
    "ref|refs|references|part of|contributes to|towards|updates"
)
LINK_LABELS = "linear|issue|ticket"
HEADING = re.compile(r"^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$")
LIST_ITEM = re.compile(r"^\s*(?:[-*+]|\d+[.)])\s")
# A backtick fence's trailing text holds no backtick: ``` x ``` is inline code.
FENCE = re.compile(r" {0,3}(`{3,}(?=[^`]*$)|~{3,})(.*)$")


def gh(args, cwd):
    out = subprocess.run(["gh", *args], cwd=cwd, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(f"gh {' '.join(args)}: {out.stderr.strip()}")
    return out.stdout


def load_stack(repo_dir):
    path = os.path.join(repo_dir, ".agents", "stack.yml")
    if not os.path.exists(path):
        return None
    out = subprocess.run(
        ["ruby", "-ryaml", "-rjson", "-e", "puts JSON.dump(YAML.load_file(ARGV[0]))", path],
        capture_output=True, text=True, check=True,
    )
    return json.loads(out.stdout) or {}


def first_key(prefix_re, *fields):
    if not prefix_re:
        return None
    for field in fields:
        m = prefix_re.search(field or "")
        if m:
            return m.group(0).upper()
    return None


def body_lines(body):
    """A PR body's lines, without HTML comments and fenced code blocks.

    A fence closes only on its own character, at its opening length or longer, with
    no text after it. An unclosed fence runs to the end of the body."""
    text = re.sub(r"<!--.*?-->", "", (body or "").replace("\r", ""), flags=re.DOTALL)
    lines, fence = [], None
    for line in text.split("\n"):
        m = FENCE.match(line)
        if fence:
            if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence) and not m.group(2).strip():
                fence = None
        elif m:
            fence = m.group(1)
        else:
            lines.append(line)
    return lines


def scope_sentence(lines):
    """The first sentence under the first heading named Scope, or an empty string."""
    for i, line in enumerate(lines):
        m = HEADING.match(line)
        if m and m.group(1).strip(" *_`:.").lower() == "scope":
            break
    else:
        return ""
    block = []
    for line in lines[i + 1:]:
        if HEADING.match(line) or (block and (not line.strip() or LIST_ITEM.match(line))):
            break
        if line.strip():
            # A list marker is not a sentence: the period in "1." ends nothing.
            block.append(LIST_ITEM.sub("", line).strip())
    text = " ".join(block)
    end = re.search(r"[.!?][*_`)\]]*(?:\s|$)", text)
    return text[:end.end()] if end else text


def declared_body_key(key_re, body):
    """The key a PR body declares (pr-label-sweep SKILL.md section 2): the first link line,
    else the first sentence under a Scope heading. Any other body key is a citation."""
    lines = body_lines(body)
    link_re = re.compile(
        r"^\s*(?:(?:[-*+]|\d+[.)])\s+)?[*_]*"
        rf"(?:(?:{LINK_WORDS})[*_]*:?|(?:{LINK_LABELS})[*_]*:)"
        rf"[*_]*\s+[*_`(\[]*({key_re.pattern})",
        re.IGNORECASE,
    )
    for line in lines:
        m = link_re.match(line)
        if m:
            return m.group(1).upper()
    return first_key(key_re, scope_sentence(lines))


def pr_key(prefix, title, body, branch):
    """The PR's issue key: title, then what the body declares, then head branch.

    Title and body keys are bounded, so a project id (P-<PREFIX>-18) or a file stamp
    (<PREFIX>-20261022T120513Z) is not a key. A branch key is not: fix-<PREFIX>-412 is one."""
    if not prefix:
        return None
    escaped = re.escape(prefix)
    bounded = re.compile(rf"(?<![A-Za-z0-9-]){escaped}-\d+(?![A-Za-z0-9])", re.IGNORECASE)
    return (first_key(bounded, title) or declared_body_key(bounded, body)
            or first_key(re.compile(rf"{escaped}-\d+", re.IGNORECASE), branch))


def list_prs(repo_dir):
    fields = "number,title,headRefName,body,labels,isDraft"
    for limit in (200, 1000):
        prs = json.loads(gh(["pr", "list", "--state", "open", "--limit", str(limit), "--json", fields], repo_dir))
        if len(prs) < limit:
            return prs, None
    return prs, f"list may be truncated at {limit} PRs"


def evaluate(pr, rules, files, issue, tracker_ran):
    """Return {label: evidence} for every rule that fires, plus labels not evaluable."""
    fired, unevaluable = {}, set()
    texts = [("title", pr["title"]), ("branch", pr["headRefName"])]
    if issue and issue.get("title"):
        texts.append(("issue title", issue["title"]))
    for rule in rules:
        label, evidence = rule["label"], None
        if not tracker_ran and any(rule.get(m) for m in TRACKER_MATCHERS):
            unevaluable.add(label)
        if tracker_ran and issue:
            for name in rule.get("linear_project") or []:
                if issue.get("project") == name:
                    evidence = f'{issue["key"]} -> project "{name}"'
                    break
            if not evidence:
                issue_labels = {l.lower() for l in issue.get("labels") or []}
                for name in rule.get("linear_label") or []:
                    if name.lower() in issue_labels:
                        evidence = f'{issue["key"]} -> label "{name}"'
                        break
        if not evidence:
            for glob in rule.get("paths") or []:
                hit = next((f for f in files if fnmatch.fnmatch(f, glob)), None)
                if hit:
                    evidence = f"path {glob} matched {hit}"
                    break
        if not evidence:
            for pattern in rule.get("text") or []:
                for field, value in texts:
                    m = re.search(pattern, value or "", re.IGNORECASE)
                    if m:
                        evidence = f'text /{pattern}/ in {field}: "{m.group(0)}"'
                        break
                if evidence:
                    break
        if evidence:
            fired[label] = evidence
            unevaluable.discard(label)
    return fired, unevaluable


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo-dir", required=True)
    ap.add_argument("mode", choices=["keys", "plan", "apply"])
    ap.add_argument("--tracker-file", help="JSON file: issue key -> {project, labels, title} or null")
    a = ap.parse_args()
    repo = os.path.abspath(a.repo_dir)

    stack = load_stack(repo)
    rules = ((stack or {}).get("pr_labels") or {}).get("rules") or []
    if not rules:
        print("REFUSED: pr_labels.rules is missing or empty in .agents/stack.yml; this sweep never guesses labels.")
        print(gh(["label", "list", "--limit", "500", "--json", "name,description"], repo))
        print("SUMMARY " + json.dumps({"refused": "pr_labels.rules"}))
        return 2
    prefix = (stack or {}).get("issue_prefix")
    prefix_re = re.compile(rf"{re.escape(prefix)}-\d+", re.IGNORECASE) if prefix else None

    prs, truncated = list_prs(repo)
    keys = {pr["number"]: pr_key(prefix, pr["title"], pr["body"], pr["headRefName"]) for pr in prs}
    if a.mode == "keys":
        print(json.dumps({"issue_prefix": prefix, "keys": sorted({k for k in keys.values() if k}),
                          "by_pr": {str(n): k for n, k in keys.items() if k}}, indent=1))
        print("SUMMARY " + json.dumps({"prs": len(prs), "keys": len({k for k in keys.values() if k})}))
        return 0

    tracker_ran = a.tracker_file is not None and prefix_re is not None
    tracker = {}
    if a.tracker_file:
        with open(a.tracker_file) as f:
            tracker = {k.upper(): v for k, v in json.load(f).items()}
    repo_labels = set(gh(["label", "list", "--limit", "500", "--json", "name", "--jq", ".[].name"], repo).split("\n")) - {""}
    managed = {r["label"] for r in rules}
    missing = sorted(managed - repo_labels)
    login = gh(["api", "user", "--jq", ".login"], repo).strip()

    rows, unknown_keys, not_looked_up = [], set(), set()
    counts = {"with_additions": 0, "already_correct": 0, "no_signal": 0}
    for pr in prs:
        n, key = pr["number"], keys[pr["number"]]
        files = gh(["api", f"repos/{{owner}}/{{repo}}/pulls/{n}/files", "--paginate", "--jq", ".[].filename"], repo).split("\n")
        issue = None
        if tracker_ran and key:
            if key not in tracker:
                not_looked_up.add(key)
            elif tracker[key] is None:
                unknown_keys.add(key)
            else:
                issue = dict(tracker[key], key=key)
        fired, unevaluable = evaluate(pr, rules, [f for f in files if f], issue, tracker_ran)
        have = {l["name"] for l in pr["labels"]}
        add = {l: e for l, e in fired.items() if l not in have and l not in missing}
        unsupported = sorted((have & managed) - set(fired) - unevaluable)
        if add:
            counts["with_additions"] += 1
        elif fired:
            counts["already_correct"] += 1
        else:
            counts["no_signal"] += 1
        rows.append({"pr": n, "title": pr["title"], "key": key, "add": add, "unsupported": unsupported})

    print("PR   | title (truncated)                        | add | evidence | unsupported")
    for r in rows:
        if r["add"] or r["unsupported"]:
            add = ",".join(r["add"]) or "-"
            ev = "; ".join(r["add"].values()) or "-"
            print(f'#{r["pr"]} | {r["title"][:40]:<40} | {add} | {ev} | {",".join(r["unsupported"]) or "-"}')
    print(f'\nPRs with additions: {counts["with_additions"]}, already correct: {counts["already_correct"]}, '
          f'no signal: {counts["no_signal"]}, open PRs: {len(prs)}')
    if truncated:
        print(f"WARNING: {truncated}")
    print(f"missing labels: {missing or 'none'}")
    print(f"unknown keys: {sorted(unknown_keys) or 'none'}")
    if not_looked_up:
        print(f"keys not looked up (absent from --tracker-file): {sorted(not_looked_up)}")
    if tracker_ran:
        print("tracker rules: ran")
    else:
        why = "issue_prefix unset" if not prefix_re else "no --tracker-file (tracker MCP not used)"
        print(f"tracker rules: did not run ({why}); paths and text rules only")
    print(f"gh login for writes: {login}")

    summary = {"mode": a.mode, "open_prs": len(prs), **counts, "missing_labels": missing,
               "unknown_keys": sorted(unknown_keys), "tracker_ran": tracker_ran,
               "unsupported": {str(r["pr"]): r["unsupported"] for r in rows if r["unsupported"]}}
    if a.mode == "plan":
        print("SUMMARY " + json.dumps(summary))
        return 0

    labelled, added, errors = [], 0, {}
    for r in rows:
        if not r["add"]:
            continue
        n, want = r["pr"], sorted(r["add"])
        try:
            gh(["pr", "edit", str(n), "--add-label", ",".join(want)], repo)
            now = {l["name"] for l in json.loads(gh(["pr", "view", str(n), "--json", "labels"], repo))["labels"]}
            if set(want) <= now:
                labelled.append(n)
                added += len(want)
                print(f"#{n}: added {','.join(want)} (verified)")
            else:
                errors[str(n)] = f"after edit, missing {sorted(set(want) - now)}"
        except RuntimeError as e:
            errors[str(n)] = str(e)
    for n, err in errors.items():
        print(f"#{n}: ERROR {err}")
    summary.update(labelled=labelled, labels_added=added, errors=errors)
    print("SUMMARY " + json.dumps(summary))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
