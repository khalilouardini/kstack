---
name: triage
version: 0.3.1
description: Score open work against scope and report PR intent, merge/CI, review-loop evidence and unresolved threads. Default PR-only; optional repeated project and label filters. Read-only proposal; never reviews, merges or closes. Use when asked to "triage the backlog", "clean up the open PRs", "which branches can we delete?", or "/triage [prs|branches|worktrees|all] [--project <name-or-ID>]... [--label <name>]...". (kstack)
---

# triage — score the backlog against the scope contract

## When to invoke

The repo has accumulated more open work than anyone can hold in their head —
open PRs, unmerged branches, stale worktrees — and someone needs a defensible
disposition for each one. Invoke as
`/triage [prs|branches|worktrees|all] [--project "<name-or-ID>"]... [--label <name>]...`
(default `prs`). This skill produces **a proposal**; it never executes it. Not
for deciding whether a *new* idea is in scope (that is the `spec` pipeline), and
not for picking what to work on next.

### Filters — PR selection only

`--label <name>` requires that GitHub PR label; repeated labels are an **AND**.
`--project "<name-or-ID>"` selects PRs implementing or explicitly attached to
verified Linear project issues; repeated projects are a **union**. Both together
mean **(project A OR project B) AND label X AND label Y**. Reject empty/missing
values before access. A project name is never substituted with a GitHub label.

When the invocation includes a PR pass and `--project`, read
`references/project-filter.md` and follow it top to bottom; if unreadable, stop. Without `--project`, use GitHub only: no Linear access or
credentials are required. For `branches` or `worktrees` alone, disclose the unused
PR filters and skip PR selection and tracker access. This scope-role skill
remains in `roles/`: optional tracker access uses CONVENTIONS.md §1's capability
exception. Missing Linear access on that path
refuses the requested project pass with missing evidence; it never broadens to
an unfiltered or label-only proposal. An explicit later invocation without
`--project` can still deliver the core GitHub proposal.

Always state the exact inputs, canonical project/team IDs if used, measured
unfiltered total, scored count and excluded count. A zero-match filter is a valid
empty proposal, with its filters visible. Filters affect **only the PR pass**;
branch/worktree passes, when requested, cover everything and are disclosed
separately. Filtering changes which work is scored, never its scope criteria.

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
  `triage-<YYYY-MM-DD>.md` (collision handling in Step 5). Missing or null →
  **ask the user** where to write it; do not guess a docs path.
- **`identities.maintainer`, `identities.reviewer`, `identities.implementer`,
  `ci.checks`** — read for
  status interpretation using the referenced review/CI contracts. Missing keys
  make the affected assessment **UNKNOWN**, naming the key; they do not turn
  zero findings into clearance or stop unrelated scope scoring. This is the
  explicit **Triage reporting exception** in CONVENTIONS.md §2, not pr-loop's
  configuration refusal policy; it authorizes no gate or external action.
- **`workspace_contract`, `issue_prefix`** — used only with `--project`, through
  the referenced project-filter procedure. No tracker configuration is needed
  without that flag.

Missing `.agents/stack.yml` altogether → refuse and name the file.

## Hard rule: read-only

> **Never run `gh pr close`, `gh pr merge`, `gh pr edit`, `git branch -d`,
> `git worktree remove`, `git push`, or any other external-state mutation.**

Never invoke `/pr-loop`, a paid reviewer, `/review-claude-pr`, or
`/review-comments`; never post a review/comment, reply, resolve a thread, edit
Linear, or execute a verdict. Reading their contracts below grants no execution
permission. Only session scratch and the proposal file may be written.

Closing someone's PR is outward-facing and hard to reverse — a closed PR loses
its review thread's place in the maintainer's attention even though the commits
survive. You write the proposal file and stop. The maintainer executes, or asks
you to execute a named subset after reading it.

This holds even if the proposal is obviously correct or the request says
"just clean it up". Stop with a reviewable list of actions.

**Enforcement honesty:** this is **prompt-level**. Nothing in the harness blocks
a mutating `gh` or `git` call; the contract asks, and the proposal file is the
only artifact the skill is supposed to leave behind. Treat it as a hard rule
anyway. A host that runs this skill with `Bash` withheld makes it
tool-list-enforced; say which case you are in if the user asks.

## Step 0 — measure, do not quote

**Measure the backlog, do not quote a remembered number** — counts move every
week and a stale figure in a proposal is a claim you cannot support:

```bash
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name) || exit 1
SCRATCH=$(mktemp -d) || exit 1  # private to this run
# Flatten all pages; retain errors and fail closed on an incomplete inventory.
gh api --paginate --slurp 'repos/{owner}/{repo}/pulls?state=open&per_page=100' \
  > "$SCRATCH/open-pages.json" || exit 1
python3 - "$SCRATCH/open-pages.json" <<'PY' || exit 1
import json, sys
pages = json.load(open(sys.argv[1]))
if not isinstance(pages, list) or not pages or not all(isinstance(p, list) for p in pages):
    sys.exit("UNKNOWN inventory: expected a non-empty array of PR-list pages")
rows = [row for page in pages for row in page]
if not all(isinstance(row, dict) and type(row.get("number")) is int and row["number"] > 0 for row in rows):
    sys.exit("UNKNOWN inventory: invalid PR records")
print(len(rows), "open PRs")
PY
git branch --no-merged "$DEFAULT_BRANCH" | wc -l
git worktree list --porcelain | sed -n '/^worktree /p' | wc -l
```

Check exit status and API/GraphQL errors, including errors alongside partial
data, before consuming any result. Do not pipe an unsuccessful fetch into a
successful count. Exhaust pagination with advancing cursors/links; a cap or
missing page is **UNKNOWN**, never an empty backlog. If the inventory cannot be
completed, report the missing evidence and stop the PR proposal; independent
requested branch/worktree findings can still be reported separately.

Date the measurements and record the repo/default branch. Count the whole open
PR inventory even with filters. Counts describe this inventory timestamp; retain
and disclose any later CLOSED/MERGED transitions instead of silently dropping
rows. Branch/worktree counts are measurements, not a scored pass by default.

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

## Step 2 — metadata and evidence for every scored PR

Select from the complete inventory, applying the project procedure when
requested and all requested labels. Deduplicate by repository and PR number.
Record selection evidence and exclusions before scoring. Do not infer project
membership from a prerequisite mention.

Read `references/pr-status.md` once with the file-reading tool and follow it
top to bottom for **every** scored PR, including `CLOSE` and `PARK`. If unreadable,
stop. Collect body, complete changed files, state/head/base, CI,
all reviews/threads/replies and available loop reports. This is evidence
collection, not a fresh review. Missing status evidence is reported as UNKNOWN
with its error; keep known facts and do not manufacture zeros.

Bucket mechanically before judgement: stale (>30 days without an update), huge
(>5,000 changed lines), conflicted (`mergeable=CONFLICTING`), red (failing checks).
These are prompts for inspection, never verdicts by themselves.

## Step 3 — classify

Read the current body and actual changed files for intent as required by Step 2.
Inspect relevant diff sections when needed to explain resulting behavior or
scope; do not review every line just to triage. Label inferred intent, and use
**intent UNKNOWN** when evidence is insufficient. Never substitute line counts
for the intent paragraph.

| Verdict | Meaning | Criterion |
|---|---|---|
| `MERGE` | In scope, green, no conflicts | Cites an active-milestone IN line. Ship this week. |
| `REBASE+MERGE` | In scope, but conflicted or red | Cites an active-milestone IN line. Name what has to be fixed. |
| `CLOSE` | Superseded, abandoned, or on the NOT list | **Must name the superseding PR/branch/commit, or the NOT-list row.** A `CLOSE` with neither is a `PARK`. |
| `PARK` | Real work, wrong milestone | Cites a later-milestone IN line or a NOT-list row. Branch stays; PR closes with a pointer, or converts to draft. |

Keep scope disposition separate from readiness: `MERGE` is a proposal under
the criterion above, never permission. Unknown CI/review, a draft, dependency,
unresolved P0–P2 thread, evidence gap or human hold must appear explicitly even
when GitHub reports `mergeStateStatus=CLEAN`. A green in-scope candidate with a
review/human hold can retain its scope disposition, but is not ready. Red or
conflicted candidates stay `REBASE+MERGE`; do not change verdict meanings to
encode loop outcomes. CLOSED/MERGED transitions are retained with their state
and removed from actionable merge candidates.

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

### Every PR pass needs a complete merge order

Every proposal that scores PRs must include a **recommended merge order** for
all `MERGE` and `REBASE+MERGE` candidates, not only the first few actions. Order
PRs by their actual dependencies and shared-file collisions, and say why that
order is safe. When one candidate is red or conflicted, keep it in the ordered
list at the point it can proceed and name the checks or conflict resolution
that must happen first. Do not imply that a blocked PR is ready to merge.

Use the complete, stable file snapshots from Step 2 for intersections, including
both `filename` and `previous_filename` for renames. Inspect shared-file diff
sections when they could affect order. Independent lanes may proceed in
parallel; table position alone must not create a dependency. Every candidate
must occur exactly once in the order/lanes, including held candidates with the
condition that releases them. If file evidence is incomplete or the head is
unstable, label ordering UNKNOWN and name what must be re-read. If the
available evidence cannot establish a safe relative order, name the unresolved
dependency and the information needed to decide it; do not invent an order.
Under any filter, calculate collisions within the scored set and state that an
excluded PR may still touch the same files. If no PR is eligible to merge, say
so and give the ordered next actions needed to reach a mergeable state.

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

`--label` and `--project` do not reach this step. If either was passed
alongside `branches`, `worktrees`, or `all`, the branch and worktree tables cover
**everything**, while the PR tables above them cover only the filter. Label both
in the proposal; a reader who assumes one header governs the whole file will
otherwise read an unfiltered deletion candidate as an in-milestone one.

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

Write `<parent of spec_output_dir>/triage-<YYYY-MM-DD>.md` (or the supplied
path). **Never overwrite an existing proposal.** If occupied, use
`triage-<YYYY-MM-DD>-<filter-slug>-<HHMMSS>-<unique-run-ID>.md`, with `all-prs`
for no filter. For filtered runs, join the project/label values with `-`,
lowercase, replace runs of characters outside `[a-z0-9-]` with `-`, collapse
repeated `-`, trim edge hyphens, truncate to 40 characters and trim again. Use
`filtered` if empty. This is a single filename component, never a raw project
name/path. Claim the path with exclusive creation (`open(..., "x")` or host
equivalent); retry a collision with a fresh run ID. Announce the actual path and
time zone. This also protects two projects sharing an output directory.

Use a compact overview plus concrete per-PR paragraphs and a linked appendix:

```markdown
# Triage — <date/time and zone>

**Scored against:** <scope_doc, revision/date and literal headings>
**Repository / inventory time:** <repo, default branch, timestamp>
**Filter:** <none | project inputs → canonical IDs/team; labels>
**Coverage:** <scored> of <total> initially open PRs; <excluded> excluded;
<project exclusions among label matches / label-only or both exclusions>; <state transitions>
**Passes:** PR <filtered/unfiltered>; branches/worktrees <not scored | unfiltered>
**Measured:** <n> open PRs · <n> unmerged branches · <n> worktrees
**Totals:** <n> MERGE · <n> REBASE+MERGE · <n> CLOSE · <n> PARK
**Evidence gaps:** <surface/errors/caps/unstable reads, or none>

## PR overview
| PR | Verdict + scope line / supersession | State/draft · head → base | Mergeability / CI | Posted loop / derived review | Open P0/P1/P2/P3 + unknown | Holds |
|---|---|---|---|---|---|---|
<one row per PR; link details and thread appendix; full SHAs in detail>

## PR details
### <PR link and title> — <verdict>
<One short paragraph: stated intent and main behavioral changes, grounded in
linked current body/files/diff. Cite scope and name supersession for CLOSE.>

<Full head/base refs+SHAs; mergeStateStatus distinct from mergeability;
CI mode and named buckets/missing expected checks with links;
reviewed SHA vs current SHA; posted loop verdict/source/head/date/rounds or
UNKNOWN; separately derived review assessment and stale history;
P0/P1/P2/P3/unknown counts and appendix link; optional ledger availability;
explicit dependency, evidence and human holds; snapshot time/stability.>

## Unresolved review threads
| PR / finding title + link | Priority / author | Outdated? | Finding/review head | Last reply / author / time | Resolution / fix evidence |
|---|---|---|---|---|---|
<all unresolved threads, including answered and outdated ones; link original
finding and last reply. Unknown severity separately; known counts are lower
bounds when collection is partial. Also link blocking summary-only findings.>

## Recommended merge order and next actions
<Every OPEN MERGE and REBASE+MERGE candidate exactly once, in dependency order
or explicitly independent lanes. Name actual dependency edges, rename-aware
file intersections and every release condition. Unknown order stays explicit.
Filtered run: intersections cover scored set only; excluded PRs may overlap.>
<Next actions for CLOSE/PARK and requested branch/worktree findings.>

## Protected branches / branches / worktrees — <not scored | unfiltered>
<When requested, include branch/glob, extraction task, worktree path,
uncommitted paths and verdict. Otherwise include protected PR findings only.>
```

Always write the Filter line, including `none`. Before finalizing, recheck the
selected PRs' state/head/base against collected snapshots as in the status
reference. Reconcile scored/bucket totals, exclusions and merge-order coverage;
unknown counts never become zero. The same evidence fields apply to every
verdict, including CLOSE/PARK. Never collapse the three different facts
GitHub `CLEAN`, pr-loop `CLEAN`, and human merge permission into one badge.

Print measured counts, filters/exclusions, totals, first three next actions,
actual proposal path and remaining uncertainty. Stop at the proposal. Executing
it requires a separate, explicit instruction naming the actions.

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
- Repairing or ranking a tracker. Optional `--project` reads Linear only to
  establish PR selection; forward selection is `next`, board repair is
  `linear-steward`.

## Offline checks and their limits

Run `python3 -m unittest discover -s roles/triage/tests` and `python3 bin/check-stack`.
Read `tests/README.md` for the frozen cases and scope. These checks exercise a
fixture model and documentation invariants; they do **not** execute this prompt
against live tools, prove API completeness, or enforce read-only behavior.
