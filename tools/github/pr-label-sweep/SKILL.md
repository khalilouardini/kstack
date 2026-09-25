---
name: pr-label-sweep
version: 0.1.0
description: Sweep open GitHub PRs and add the labels the consuming repo's rules call for — from the linked tracker issue's project and labels, the changed paths, and client keywords in the title and branch — each label citing the evidence that fired it. Dry-run by default; add-only; never creates a repo label. Use when asked to "label my PRs", "tag the open PRs", "sweep PR labels", or "/pr-label-sweep [--apply] [--pr N]". (kstack)
---

# pr-label-sweep — add rule-backed labels to open PRs

## When to invoke

Open PRs are missing the labels that say which milestone, area, and client each
one belongs to, and adding them by hand has fallen behind. Invoke as
`/pr-label-sweep [--apply] [--pr N]`. **Dry-run is the default** — the table of
proposed additions is always printed first; nothing is written until `--apply`
is passed (on the invocation, or as a confirmation after reviewing the table).
`--pr N` restricts the sweep to one PR.

Not for removing labels, creating or renaming repo labels, or labelling issues.
Filtering a backlog by label is `/triage --label`.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: kstack
`CONVENTIONS.md` §2):

- **`pr_labels.rules`** — the label vocabulary and when each label applies.
  **Missing, null, or empty → refuse**, naming `pr_labels.rules`. Labels are
  project vocabulary and this skill never guesses one. With the refusal, print
  `gh label list --json name,description` and a draft `pr_labels` block built
  from those names with every matcher left empty, for the user to fill in.
- **`issue_prefix`** — the tracker key prefix; the key regex is `<PREFIX>-\d+`,
  case-insensitive. **Missing or null is a sanctioned degradation**: skip every
  `linear_project` and `linear_label` matcher, evaluate `paths` and `text` only,
  and say in the report that tracker rules did not run and why.

Rule shape — each rule names one GitHub label and any number of matchers. A rule
fires when **any** of its matchers fires:

```yaml
pr_labels:
  rules:
    - label: <github-label>
      linear_project: [<project name>, ...]   # exact match on the issue's project
      linear_label: [<label name>, ...]       # any issue label, case-insensitive
      paths: [<fnmatch glob>, ...]            # any changed path matches
      text: [<regex>, ...]                    # case-insensitive, see §3
```

The **managed set** is every `label` named by a rule. Labels outside it are never
read, proposed, or reported.

## Tier and degradation

Tier `tools/github`: `paths` and `text` rules need only `gh`, and they carry the
area and client labels on their own. Tracker rules (`linear_project`,
`linear_label`) additionally need the tracker's MCP server connected in this
session. When it is not, skip those matchers, keep the rest, and say so in the
report — degraded, not refused (CONVENTIONS.md §1).

## 1. Enumerate PRs

```bash
gh pr list --state open --limit 200 \
  --json number,title,headRefName,body,labels,isDraft
```

Drafts are included. If exactly 200 rows come back, say the list may be
truncated and raise `--limit` before continuing. With `--pr N`, use
`gh pr view N --json number,title,headRefName,body,labels,isDraft,state` and
refuse if `state` is not `OPEN`.

Read the repo's label list once:

```bash
gh label list --limit 500 --json name --jq '.[].name'
```

A rule whose `label` is not in that list is reported as **missing label** and
never applied — creating a repo label is a repo-wide change this skill does not
make.

## 2. Resolve signals per PR

**Changed paths** — the REST endpoint, because `gh pr diff` fails on large
diffs and `gh pr view --json files` stops at 100 files:

```bash
gh api "repos/{owner}/{repo}/pulls/$N/files" --paginate --jq '.[].filename'
```

**Issue key** (skip when `issue_prefix` is unset) — match `<PREFIX>-\d+`
case-insensitively against, in order, the PR title, the PR body, the head
branch. First match wins; do not merge conflicting keys. The body is allowed
here because this is a key lookup, not a keyword match.

**Tracker issue** (only when a key resolved and the tracker MCP is connected) —
fetch the issue (`get_issue` or the connected server's equivalent) and keep its
`project`, `labels`, and `title`. A key that does not resolve to an issue is
reported as **unknown key** and contributes no tracker signal. Never search the
tracker to *discover* a key the regex did not find.

## 3. Evaluate rules

For each PR and each rule, test every matcher and record the first one that
fires as that label's evidence:

| Matcher | Fires when | Evidence recorded |
|---|---|---|
| `linear_project` | the issue's project equals a listed name exactly | `<KEY> → project "<name>"` |
| `linear_label` | any issue label equals a listed name, case-insensitive | `<KEY> → label "<name>"` |
| `paths` | any changed path matches a glob under Python `fnmatch` (so `*` also crosses `/`) | the glob and the first matching path |
| `text` | a regex matches the PR title, the head branch, or the tracker issue title | the regex, the field, and the matched text |

`text` **never reads the PR body.** Bodies mention other clients and projects in
passing, and a single mention would label an unrelated PR.

Then per PR:

- **add** — labels whose rule fired and that the PR does not carry.
- **unsupported** — managed labels the PR carries that no rule fired for. These
  are reported, never removed: a human may have added them for a reason the
  rules do not capture.
- A PR with no `add` entries is **already correct** (if any rule fired) or
  **no signal** (if none did).

## 4. Dry-run output

Print first, always:

```
PR   | title (truncated) | add           | evidence                                   | unsupported
#372 | eval(gate-r): …   | MVP-2,polygon | <KEY> → project "…"; text polygon in title | —
```

Below the table: counts of PRs with additions, already correct, no signal; any
missing labels; any unknown keys; whether tracker rules ran; the `gh` login that
`--apply` would act as (`gh api user --jq .login`).

## 5. Apply

Only after `--apply` (up front, or confirmed after the table):

```bash
gh pr edit "$N" --add-label "<label1>,<label2>"
```

One call per PR in the add set. A failed call is reported with its error and the
sweep continues. After the calls, re-read each edited PR's labels
(`gh pr view "$N" --json labels`) and count a PR as labelled only when every
proposed label is present.

Final report: PRs labelled, labels added in total, already correct, no signal,
errors per PR, and whether tracker rules ran.

## Safety / scope invariants

All of these are **prompt-level** — nothing in the harness blocks a violating
`gh` call (CONVENTIONS.md §5).

1. **Dry-run first.** No `gh pr edit` before the table has been shown in this
   invocation or a prior one being explicitly confirmed.
2. **Add-only.** Never `--remove-label`. Unsupported managed labels are
   reported for the human to remove.
3. **Managed set only.** Never propose, report, or touch a label no rule names.
4. **Never create, rename, or recolour a repo label.**
5. **Never invent an issue key or search the tracker for one.** Tracker signal
   comes only from a key the regex found.
6. **Open PRs only.** Closed and merged PRs are out of scope.

> **Worked example (OGUR, 2026-09-25).** Rule `label: MVP-2`,
> `linear_project: ["Road to MVP-2"]`. PR #372's title carries `OGUR-128`;
> `get_issue OGUR-128` returns project "Road to MVP-2", so `MVP-2` is proposed
> with evidence `OGUR-128 → project "Road to MVP-2"`. The same title contains
> "Polygon", so a `text: ["polygon"]` rule adds `polygon` without any tracker
> lookup.
