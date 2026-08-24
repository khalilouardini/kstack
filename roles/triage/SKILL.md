---
name: triage
version: 0.1.0
description: Score every open PR, unmerged branch, and worktree against the consuming repo's scope doc and propose MERGE / REBASE+MERGE / CLOSE / PARK for each, with every verdict citing a scope-doc line. Read-only — writes one dated proposal file and never closes, merges, deletes, or pushes. Use when asked to "triage the backlog", "clean up the open PRs", "which branches can we delete?", or "/triage [prs|branches|worktrees|all]". (kstack)
---

# triage — score the backlog against the scope contract

## When to invoke

The repo has accumulated more open work than anyone can hold in their head —
open PRs, unmerged branches, stale worktrees — and someone needs a defensible
disposition for each one. Invoke as `/triage [prs|branches|worktrees|all]`
(default `prs`). This skill produces **a proposal**; it never executes it. Not
for deciding whether a *new* idea is in scope (that is the `spec` pipeline), and
not for picking what to work on next.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: kstack
`CONVENTIONS.md` §2) before doing anything else:

- **`scope_doc`** — the scope/priority contract every verdict is scored
  against. Missing or null → **refuse**, naming `scope_doc`. There is no
  fallback: a triage with no contract is an opinion about tidiness, and this
  skill exists precisely to not be that.
- **`protected_branches`** — a list of globs. No verdict may ever be `CLOSE`
  for a branch or a PR whose head branch matches one. An empty list is a valid
  declaration (this project has no protected class) — say so explicitly in the
  proposal, so the absence is visible rather than silent.
- **`spec_output_dir`** — the proposal is written to its **parent** directory as
  `triage-<YYYY-MM-DD>.md`. Missing or null → **ask the user** where to write
  it; do not guess a docs path.

Missing `.agents/stack.yml` altogether → refuse and name the file.

## Hard rule: read-only

> **Never run `gh pr close`, `gh pr merge`, `gh pr edit`, `git branch -d`,
> `git worktree remove`, `git push`, or any other mutating command.**

Closing someone's PR is outward-facing and hard to reverse — a closed PR loses
its review thread's place in the maintainer's attention even though the commits
survive. You write the proposal file and stop. The maintainer executes, or asks
you to execute a named subset after reading it.

This holds even if the proposal is obviously correct, and even if asked to
"just clean it up" — confirm the specific list first.

**Enforcement honesty:** this is **prompt-level**. Nothing in the harness blocks
a mutating `gh` or `git` call; the contract asks, and the proposal file is the
only artifact the skill is supposed to leave behind. Treat it as a hard rule
anyway. A host that runs this skill with `Bash` withheld makes it
tool-list-enforced; say which case you are in if the user asks.

## Step 0 — measure, do not quote

**Measure the backlog, do not quote a remembered number** — counts move every
week and a stale figure in a proposal is a claim you cannot support:

```bash
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)
# --limit is a cap with no truncation signal, so a repo at or above it reports
# the cap as if it were the count. Ask for more than could exist, then assert.
gh pr list --state open --limit 1000 --json number \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);n=len(d);print(n,"open PRs");sys.exit(1) if n>=1000 else None' \
  || echo "TRUNCATED — raise the limit and re-measure before reporting any count"
git branch --no-merged "$DEFAULT_BRANCH" | wc -l   # unmerged local branches
git worktree list | wc -l                          # worktrees
```

Report the counts you measured, dated.

> **Worked example (OGUR).** On 2026-08-04, when this procedure was first
> written, that was 27 open PRs (oldest untouched since April), 80 unmerged
> local branches, and 55 worktrees. Each was a defensible idea at the time. The
> cost is not disk — it is that nobody can tell which four of them matter this
> month, so all of them feel slightly alive and none of them get finished. That
> is the condition this skill is for; the numbers are not a benchmark.

## Step 1 — read the contract

Read `scope_doc` in full. **Verify the section headings you actually find** —
maintainers amend this document and section numbers move. Record, by their
literal heading text, which sections play these three roles:

| Role | What it holds |
|---|---|
| **Active-milestone IN list** | What is being built now. `MERGE` / `REBASE+MERGE` cite a line here. |
| **Later-milestone IN list(s)** | Real work, wrong milestone. `PARK` cites a line here. |
| **NOT list** | Explicitly out of scope. `CLOSE` and `PARK` may cite a row here. |

Every verdict cites one of them, by the heading text you recorded. A verdict
without a citation is an opinion about tidiness.

If the scope doc has no recognisable NOT list, say so — a scope contract that
only says yes cannot produce a `CLOSE`, and that is a finding about the
document, not about the backlog.

## Step 2 — cheap metadata pass

Do not read every diff. Get the facts first, in one call:

```bash
# --limit is a CAP, not a page size: gh silently returns the first N and says
# nothing about the rest. A repo with 101+ open PRs would produce a proposal
# that claims to cover every open PR while omitting the remainder from every
# bucket and every total. Ask for more than could exist, then assert.
gh pr list --state open --limit 1000 \
  --json number,title,isDraft,headRefName,updatedAt,additions,deletions,mergeable,statusCheckRollup \
  > /tmp/triage-prs.json
TOTAL=$(gh pr list --state open --limit 1000 --json number --jq 'length')
echo "open PRs fetched: $TOTAL"
```

If `TOTAL` equals the limit you passed, assume the list was truncated: raise the
limit and re-run, or **fail closed and disclose the cap** in the proposal. Never
report bucket totals over a subset while promising a disposition for every open
PR.

Then bucket mechanically, before any judgement:

- **Stale** — no update in >30 days. Age is not a verdict, but it is evidence: a
  PR nobody touched in three months is a PR nobody needs.
- **Huge** — >5,000 lines changed. These are usually data snapshots or generated
  artifacts, not reviewable features, and they need a different disposition than
  code PRs.
- **Conflicted** — `mergeable` is `CONFLICTING`.
- **Red** — failing checks.

## Step 3 — classify

Read titles and branch names first. Only open the diff for PRs you cannot
classify from metadata — typically fewer than a third of them.

| Verdict | Meaning | Criterion |
|---|---|---|
| `MERGE` | In scope, green, no conflicts | Cites an active-milestone IN line. Ship this week. |
| `REBASE+MERGE` | In scope, but conflicted or red | Cites an active-milestone IN line. Name what has to be fixed. |
| `CLOSE` | Superseded, abandoned, or on the NOT list | **Must name the superseding PR/branch/commit, or the NOT-list row.** A `CLOSE` with neither is a `PARK`. |
| `PARK` | Real work, wrong milestone | Cites a later-milestone IN line or a NOT-list row. Branch stays; PR closes with a pointer, or converts to draft. |

### Judgement rules

- **Size is not merit.** A 50,000-line snapshot PR and a 200-line fix are
  equally subject to the scope doc. Large PRs are more likely to be data dumps —
  check whether the diff is code or artifacts before treating line count as
  effort.
- **Draft ≠ dead, and open ≠ alive.** Check the date, not the flag.
- **Sunk cost is not a criterion.** "It's already 80% done" does not move
  something from the NOT list into an IN list. That argument is exactly what the
  scope contract exists to refuse.
- **When genuinely torn, `PARK`.** Parking is reversible and costs a line in a
  file. Closing is a conversation with a human. Asymmetric risk, asymmetric
  default.

### Protected branches are a special class

Every branch matching a `protected_branches` glob from `.agents/stack.yml`, and
every PR whose head branch matches one, is **ineligible for `CLOSE`**. The
correct disposition is `PARK — extract first`.

The reason is not sentiment. Protected branches are where hand edits accumulate
— the manual corrections someone made to get output presentable for a customer,
a demo, or a deadline. **Each of those edits is a defect report against the
pipeline that could not produce it automatically**, not clutter and not a merge
candidate. The extraction is its own workstream: diff the hand-edited artifact
against what the pipeline produces today, and categorise each delta by why the
pipeline could not produce it. Closing the branch loses that diff, which is
usually the most concrete evidence in the repo about where the system is
actually wrong.

If `protected_branches` is empty, state that in the proposal: "no protected
branches declared (`protected_branches: []`) — if any open branch carries hand
edits, it needs adding to the list before this proposal is executed."

> **Worked example (OGUR).** The protected globs were `demo/*`. Three demo
> branches carried the co-founder's hand corrections to customer-facing report
> output; the scope doc's own §2.4 named each such edit a defect report against
> the pipeline. Every one was `PARK — extract first`, never `CLOSE`.

## Step 4 — branches and worktrees

Only when asked for `branches`, `worktrees`, or `all`.

```bash
git branch --no-merged "$DEFAULT_BRANCH" --format='%(refname:short) %(committerdate:short)'
git worktree list
```

- A branch whose PR is merged is **safe to delete** — say so plainly.
- A branch with no PR and no commits in 30+ days is a **deletion candidate**;
  list it, do not delete it.
- **A worktree with uncommitted changes is never a deletion candidate.** Check
  every worktree before proposing anything about it:

  ```bash
  git -C "<worktree-path>" status --porcelain
  ```

  Non-empty output **downgrades any `CLOSE` or delete-candidate verdict for that
  worktree and its branch to `PARK`**, and the proposal row carries an explicit
  warning naming the uncommitted paths. Parallel sessions share this working
  directory, and an uncommitted worktree may be someone's live session. Getting
  this wrong destroys work that was never pushed.

## Step 5 — write the proposal

Write `<parent of spec_output_dir>/triage-<YYYY-MM-DD>.md` (or the path the user
gave when `spec_output_dir` was absent):

```markdown
# Triage — <date>

**Scored against:** `<scope_doc>` (as of <date>)
**Measured:** <n> open PRs · <n> unmerged branches · <n> worktrees
**Totals:** <n> MERGE · <n> REBASE+MERGE · <n> CLOSE · <n> PARK

## Merge this week
| PR | Title | IN line | Blocker |
|---|---|---|---|

## Rebase then merge
| PR | Title | IN line | What's broken |
|---|---|---|---|

## Close
| PR | Title | Superseded by / NOT-list row |
|---|---|---|

## Park
| PR | Title | Milestone | Why not now |
|---|---|---|---|

## Protected branches — extract before anything
| Branch | Matched glob | What's in it | Extraction task |
|---|---|---|---|

## Worktrees
| Path | Branch | Uncommitted? | Verdict |
|---|---|---|---|

## Recommended sequence
<The order to actually do this in, and why. Merge order matters when PRs touch
the same files — name the collisions.>
```

Then print to the user: the measured counts, the totals, the recommended first
three actions, and anything you were genuinely unsure about. **Ask before
executing any of it.**

## Calibration note

If this produces a `PARK` for nearly everything, either the scope contract is
too narrow or the triage is too timid — both are findings worth reporting. If it
produces a `MERGE` for nearly everything, the gate isn't reading the NOT list.
Say which way it leaned; a triage that flatters the backlog is as useless as one
that condemns it.

## What this skill is NOT for

- Executing any verdict. Read-only, by contract.
- Scoping a new idea — that is the `spec` pipeline's product gate.
- Choosing the next task to start — that is the forward-looking complement;
  `triage` audits what was left unfinished, backwards.
- Deleting worktrees or pruning branches, even ones it labels safe.
