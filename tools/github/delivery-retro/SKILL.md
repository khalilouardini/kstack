---
name: delivery-retro
version: 0.1.0
description: Assess whether a period of engineering work was fruitful, against the previous period of equal length, from GitHub (and optionally tracker) evidence — delivered outcomes, flow, quality, focus, review effectiveness. Never commits, changed lines, or merged-PR count as a standalone score. Read-only; ends with one bounded experiment. Use when asked "was this week fruitful?", "engineering retro", "what did we ship this week", or "/delivery-retro --days 7". (khalilou-stack)
---

# delivery-retro — was this period fruitful?

## When to invoke

One question, answered against the previous period of equal length: **did this
period move the release closer, and if not, where did the time go?** Invoke it
at the end of a week, sprint, or release push, when what matters is whether the
time bought delivery — not how busy it looked. Call it as
`/delivery-retro --days 7` or with explicit dates. Read-only: it opens no PRs,
edits no issues, and writes no files unless asked for a saved artifact. Not for
deciding what to work on next, and not for auditing a release's gate criteria —
those are separate skills.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: khalilou-stack
`CONVENTIONS.md` §2) before gathering anything:

- **`scope_doc`** — the scope/priority contract the milestone attribution is
  read from, pinned at the window's `to` by git history (§1). **Null → step 1 of
  the scope ladder does not exist**: a caller-supplied `--milestone "<name>"` is
  then the only sanctioned scope source, and without it the verdict is
  `Unscoped`. Say which case applied in the report header.
- **`workspace_contract`** — the tracker (Linear) workspace rules doc. **The
  tracker leg runs only when this is configured.** Null → skip every tracker
  query, and report tracker-derived rows as `not configured` rather than
  omitting them silently.

Missing `.agents/stack.yml` altogether → run against GitHub evidence alone,
report the scope verdict as `Unscoped`, and name the missing file.

**Invocation**

```
/delivery-retro --days 7
/delivery-retro --from 2026-08-03 --to 2026-08-10
/delivery-retro --from 2026-07-01 --to 2026-07-08 --milestone "<name>"
```

The comparison period is the immediately preceding window of the same length.
Every number is reported as a **delta**, because a bare number has no
interpretation: four merged PRs is neither good nor bad until you know last week
was eleven.

---

## Pre-flight guards

Both guards run before §1. Each one exists because its failure mode produces a
*confident* report rather than an obviously broken one.

### Guard 1 — stale base and bad "today" anchor

A retro computes its window from "today" and reads local git refs for the scope
pin (§1), the branch list, and the worktree list. If "today" has drifted, or the
local `origin/<default-branch>` is materially behind the real remote, those legs
return near-nothing and the retro fabricates a coherent narrative from an empty
window. **Fetch first, then refuse rather than narrate.**

`gh` legs read the server and are unaffected by a stale local base; the git legs
are not, and a wrong "today" corrupts every window boundary including the API
ones. That is why the guard blocks the run rather than annotating one section.

Run the pre-flight in this exact order. The first branch that matches wins:

```bash
# Pre-check A: no remote configured?
_HAS_REMOTE=$(git remote 2>/dev/null | grep -c '^origin$' || echo 0)
if [ "$_HAS_REMOTE" = "0" ]; then
  echo "RETRO_GUARD: no 'origin' remote, base freshness not verified — proceeding"
  _GUARD_VERDICT="skip-no-remote"
fi

# Pre-check B: detached HEAD or no current base?
if [ -z "$_GUARD_VERDICT" ]; then
  _HEAD_REF=$(git symbolic-ref --quiet HEAD 2>/dev/null || echo "")
  if [ -z "$_HEAD_REF" ]; then
    echo "RETRO_GUARD: detached HEAD, base freshness not verified — proceeding"
    _GUARD_VERDICT="skip-detached"
  fi
fi

# Pre-check C: fetch the default branch; if it fails, warn but proceed.
if [ -z "$_GUARD_VERDICT" ]; then
  if ! git fetch origin "$DEFAULT_BRANCH" --quiet 2>/dev/null; then
    echo "RETRO_GUARD: 'git fetch origin $DEFAULT_BRANCH' failed (offline?) — proceeding against last-known origin/$DEFAULT_BRANCH"
    _GUARD_VERDICT="warn-fetch-failed"
  fi
fi

# Pre-check D: BLOCK only when the fetch succeeded AND the newest
# origin/<default-branch> commit predates the window start.
if [ -z "$_GUARD_VERDICT" ]; then
  _LATEST_ISO=$(git log -1 --format=%ci "origin/$DEFAULT_BRANCH" 2>/dev/null | awk '{print $1}')
  [ -n "$_LATEST_ISO" ] && echo "RETRO_GUARD: latest origin/$DEFAULT_BRANCH commit on $_LATEST_ISO"
fi
```

Then evaluate the printed date against the resolved window:

- **Newest `origin/<default-branch>` commit is older than the window's `from`** →
  **BLOCK**: "Retro window is stale. Latest commit on `origin/<default-branch>`
  was `<DATE>`, but the window covers `<from>` to `<to>`. Either today's date is
  wrong in this session, or `origin/<default-branch>` is materially behind the
  remote. Confirm the date, run `git fetch origin <default-branch>`, and re-run."
  Stop until the user resolves it.
- Otherwise print `RETRO_GUARD: latest commit <DATE> within window — proceeding.`

**Take "today" from the session's stated current date, never from `date` on the
local clock** — containerized harnesses run hours or days off, and a shifted
anchor moves both windows together, which looks like a valid comparison. If the
current date cannot be established reliably, stop and ask rather than proceed.

The three skip paths (`skip-no-remote`, `skip-detached`, `warn-fetch-failed`)
proceed to §1, and the report must carry the reason as a disclosure line
("offline run, window not freshness-verified") rather than silently misreporting.

### Guard 2 — same-window-only comparison

**Never compare a window against a period of a different length.** A 7-day
window compared against a 14-day one, or against a partial window still in
progress, produces deltas that are pure artifact of duration. This applies to
every source of the previous period's numbers:

- The comparison window is `[from − (to − from), from)` **by construction** —
  computed, not chosen. Do not accept a caller-supplied comparison window of a
  different length; recompute it.
- If a saved retro artifact or snapshot is offered as the previous period, use
  it **only** when its recorded window length matches this run's exactly. On a
  mismatch, discard it and recompute the previous window from the API; if that
  is not possible, report the previous-period cells as `unavailable` and say the
  stored snapshot's window differed.
- Never compare against a window that is still open at read time — a window
  whose `to` is in the future is partial, and every count in it is an undercount.

---

## What this skill refuses to measure

The refusal is the design. These are activity, not delivery, and each one rewards
exactly the wrong behaviour when it becomes a target:

| Rejected | Why |
|---|---|
| Commit count | Rewards splitting work |
| Lines added or changed | Rewards verbosity, punishes deletion — and deletion is often the delivery |
| Merged-PR count **on its own** | Merging ten small PRs is not more productive than closing a release gate. It appears below only as an input, alongside what those PRs served |
| Hours, session count, days active | Not delivery, and not this skill's business |
| A single opaque productivity score | See §8 |

A period with **one** merged PR that closed a release gate outranks a period with
twelve that served no active milestone. The metrics below are built so that
ranking comes out of the arithmetic rather than being asserted at the end.

---

## 1. Gather

Bound everything by the window. All read-only.

**Window semantics — half-open, UTC, no timestamp in two windows.**

> All timestamps are UTC. A bare `--from`/`--to` date means `T00:00:00Z`. The
> window is **`[from, to)`**: an event at exactly `from` is in the window, an
> event at exactly `to` is **not** — it belongs to the next one. The comparison
> window is `[from − (to − from), from)`, so the two are adjacent and disjoint.
> `--days N` sets `to` to the run instant and `from` to `to − N days`.

Every membership test below — merged in window, opened in window, completed in
window — uses this rule, so a merge on a shared boundary is counted once, in the
later window. State the resolved `[from, to)` instants in the report header; a
retro whose two windows overlap by a second reports work twice.

```bash
# merged in window — statusCheckRollup is READ-TIME check state; §4 filters it to
# completedAt <= mergedAt before calling anything green
gh pr list --state merged --limit 200 --json number,title,headRefName,createdAt,mergedAt,additions,deletions,reviews,comments,labels,body,statusCheckRollup
# lifecycle timestamps across ALL states — this is what reconstructs WIP, see below
gh pr list --state all --limit 500 --json number,title,headRefName,createdAt,closedAt,mergedAt,isDraft,reviewDecision
# CI on the default branch — workflow health only, NOT the green-at-merge denominator
gh run list --branch "$DEFAULT_BRANCH" --limit 100 --json conclusion,workflowName,createdAt,headSha
# review evidence on each PR merged in the window
gh api repos/{owner}/{repo}/pulls/<n>/reviews
gh api repos/{owner}/{repo}/pulls/<n>/comments
# attribution (§6) needs BOTH the committer date and the file list per commit.
# The list endpoint carries the date but no files; the detail endpoint carries both.
gh api repos/{owner}/{repo}/pulls/<n>/commits \
  --jq '.[] | {sha, date: .commit.committer.date}'        # enumerate; keep the date
gh api repos/{owner}/{repo}/commits/<sha> \
  --jq '{date: .commit.committer.date, files: [.files[].filename]}'   # one call per SHA
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){
  pullRequest(number:$n){ reviewThreads(first:100){ nodes{ isResolved isOutdated path
    resolvedBy{login} comments(first:50){ nodes{ createdAt author{login} } } } } } }}' \
  -F o={owner} -F r={repo} -F n=<n>          # resolution STATE only — see §6, no timestamp
```

The per-SHA file call is one request per commit on each merged PR. Cap it at the
PRs merged in the window (never the whole repo), and if the cap is hit, report
the attribution ratio as `partial (n of m PRs)` rather than silently scaling it.

**Reconstruct WIP at each boundary — never snapshot it.** `gh pr list --state
open` returns state *now*, not state at the window boundary: run twice it omits
PRs that were open then and have since merged, and includes PRs opened after.
Derive "open at boundary `T`" from the `--state all` lifecycle timestamps
instead:

> PR is open at `T` ⇔ `createdAt ≤ T` **and** (`mergedAt` and `closedAt` are both
> null, **or** whichever is set is `> T`).

Age at `T` is `T − createdAt`. Both boundaries are computed the same way, so
queue size, median age, and the over-30-day count are genuine deltas.

`git worktree list` and `git branch --sort=-committerdate` carry concurrent open
work the API does not — but both are **current snapshots with no history**.
Report them for the current window only and print the previous-window cell as
`unavailable`. Do not reconstruct a worktree count from reflog or branch dates
and present it as historical.

**Tracker leg — only when `workspace_contract` is configured.** Read-only:
issues whose `completedAt` falls in the window, their project and milestone.
When `workspace_contract` is null, skip this leg entirely and mark its rows
`not configured`.

**Resolve the scope as of the window, not as of today.** The milestone share
decides the verdict, so reading today's scope for a historical window silently
re-attributes old PRs to a milestone that did not exist yet. Resolve in this
order and name the step used in the report:

1. **`<scope_doc>` as it stood at `to`** — pinned by git history, never the
   working tree. Only available when `scope_doc` is configured:
   ```bash
   SHA=$(git log -1 --format=%H --before="$TO" "origin/$DEFAULT_BRANCH" -- "$SCOPE_DOC")
   [ -n "$SHA" ] && git show "$SHA:$SCOPE_DOC"
   ```
   Empty `SHA` means the scope contract did not exist during the window — that is
   a real answer, not a reason to fall through to today's copy. `scope_doc: null`
   means this step does not exist at all; go to step 2.
2. **A caller-supplied `--milestone "<name>"`**, recorded in the report as
   caller-supplied. This is the only sanctioned way to score a window that
   predates the scope contract, and the only scope source at all when
   `scope_doc` is null.
3. **Neither resolves → verdict is `Unscoped`.** Report the merged work
   unattributed, name the missing source, and stop.

A tracker carries no history of milestone membership — the milestone field is
current state. When the window's `to` is in the past, label every tracker-derived
milestone figure `as of now, not as of the window` in the report, or omit it. The
active milestone itself never comes from the tracker for a historical window.

The working-tree copy of `<scope_doc>` is for reference only; step 1 above is
what a run actually reads.

Run the same gather over the previous window. Do not reuse a remembered number
for the prior period — recompute it, or the delta is fiction.

---

## 2. Delivered outcomes

What exists now that did not exist before.

- Merged PRs — **as an input**, and split by what they served.
- Release-gate issues completed, each named. This is the headline row.
- **Percentage of merged work serving the active milestone.** Attribute each
  merged PR to the gate or milestone it serves via the linked issue, the branch
  name, or one stated sentence. PRs serving no active milestone are counted
  separately, not discarded — they are the input to §5.
- User-visible capabilities delivered: what a user could not do on the first day
  of the window and can do on the last. Usually a much shorter list than the PR
  list, and the gap between the two lists is the most informative thing in the
  report.

A merged PR that implements a gate does **not** count that gate as completed. The
gate is completed only when a **named artifact** exists that a reader can open — a
committed report, a scored eval output, a served endpoint, a passing acceptance
test — and the issue links it. A closed tracker issue whose only evidence is
"PR #N merged" is **falsely complete** and counts as zero.

That rule is stated in full here so this skill stands on its own. A sibling
release-audit skill enforces the identical rule, and when one is present in the
tree the two must not disagree.

## 3. Flow

Where the time actually went.

- **PR cycle time** — first commit to merge. Report **median and p75**, never the
  mean; one four-week PR moves a mean and tells you nothing about the typical PR.
- **Time to first review** — PR opened to first review submitted.
- **Time from approval to merge** — the cheapest delay to fix when it is large,
  and the one most often invisible.
- **Age of open work in progress** — median and max age of PRs open at the end of
  the window, and the count older than 30 days.

Report each as `this period → previous period`. The **flow bottleneck** is
whichever stage holds the largest share of median cycle time; name it and give
the number.

## 4. Quality

- **CI state at merge** — **denominator: merges in the window.** One data point
  per merged PR, from its `statusCheckRollup`. The `gh run list` counts are
  workflow health on the default branch and include runs belonging to no merge —
  using them as the denominator inflates or deflates the number by whatever CI
  did that week, so they are never it.

  **`statusCheckRollup` is state at read time, not at `mergedAt`.** A check that
  finished *after* the merge appears in it exactly like one that gated the merge,
  so taking the rollup at face value credits a PR with evidence that did not
  exist when it merged. Filter every check to `completedAt ≤ mergedAt` first,
  then classify each merge into one of three buckets:

  > **Worked example (OGUR).** PR #183 merged at `2026-07-09T23:17:04Z` and its
  > four checks completed between 10 seconds and 3 minutes *later*. Read without
  > the filter, that merge scores green on evidence that did not exist at merge
  > time.

  | Bucket | Condition |
  |---|---|
  | **Green at merge** | At least one check completed by `mergedAt`, and every check that had completed by then succeeded |
  | **Red at merge** | Any check with a failing conclusion completed by `mergedAt` |
  | **Merged before checks completed** | No check had completed by `mergedAt`, or the ones that had leave required checks still pending |

  Report all three — `green / red / merged-before-checks` over merges. The third
  bucket is **never folded into green**: it is not a clean merge, it is an
  unverified one, and it is its own quality signal (checks were not waited for).
  List the red and merged-before-checks PRs individually. If `completedAt` is
  missing for a check, that check is not evidence — treat it as pending rather
  than assuming it passed.
- **Review findings by priority** — blocking vs non-blocking, from review threads
  on PRs merged in the window.
- **Review rounds before merge** — median count of distinct review submissions
  per merged PR. Zero across the board is a finding, not a triumph: it means
  changes merged unreviewed.
- **Reverts, hotfixes, immediate corrective PRs** — a PR that reverts, fixes, or
  re-lands work merged inside the same or previous window. Detect by
  `revert`/`fix` in the title referencing a recent PR, and by a second PR
  touching the same files within 72 hours. Each one is rework: it consumed the
  window without moving the release, and it is the strongest single quality
  signal available.

## 5. Focus

- **Concurrent open PRs and worktrees**, at the end of the window vs the start.
- **Started-versus-finished ratio** — PRs opened in the window ÷ PRs merged in
  the window. Above 1.0 sustained means the queue is growing; state the queue
  size.
- **Stretch or out-of-scope work started during the release window** — branches
  and PRs opened in the window that serve no active-milestone issue. Name them.
  This is the number the release date is actually paying for.
- **Stale work created or resolved** — PRs and branches that crossed the 30-day
  line in either direction during the window.

Report focus without moralising. "Six of nine PRs opened this week served no
active gate" is the finding; whether that was right is the owner's call, and
there are weeks where it was.

## 6. Review effectiveness

- **Reviews performed** in the window, and by whom (human vs bot identity).
- **Actionable findings produced** — findings that led to a code change, as
  distinct from findings acknowledged and closed. The ratio between the two is
  the signal.

  Evidence: the REST review endpoints carry timestamps but neither resolution
  state nor code attribution, so both come from the extra gathers in §1.
  Attribution rule, applied per inline finding:

  > A finding **changed code** ⇔ a commit on that PR whose
  > `commit.committer.date` is later than the comment's `createdAt` lists the
  > comment's anchor file (`thread.path`) in its `files`. Everything else is
  > **acknowledged only**.

  Both halves of that rule are per-commit inputs, and neither endpoint alone
  carries both: `pulls/<n>/commits` has `commit.committer.date` but no `files`,
  so the file list must come from the per-SHA
  `repos/{owner}/{repo}/commits/<sha>` call in §1 — which returns the date as
  well, so one detail call per SHA satisfies the whole rule. Carry the date and
  the file list together; a pipeline that reduces either endpoint to bare SHAs or
  bare filenames cannot classify anything. If those calls were not made, the
  ratio is `unavailable`; a ratio computed from commit messages or timing alone
  is a guess wearing a number.

  Review-summary findings that name no file cannot be attributed by this rule;
  count them in a third bucket, `unattributable`, and show it — do not fold them
  into either side of the ratio.

- **Review-thread resolution — count, not duration.** GitHub exposes no
  resolution timestamp: `PullRequestReviewThread` carries `isResolved` and
  `resolvedBy` but no `resolvedAt`, and the PR timeline has no resolve event. So
  *time* to resolve a comment is **not measurable from the API and is reported
  `unavailable`, always** — not estimated from the last comment, not from the
  merge time.

  What is measurable, and replaces it: **threads resolved ÷ threads opened on PRs
  merged in the window**, plus the count still `isResolved: false`. Both are
  current state, so label them as read-at-run-time rather than as-of-window.

  The one exception: if the caller supplies a resolution log with timestamps, use
  it and cite it as caller-supplied.

**When this evidence is missing, report the metric as `unavailable` — never
estimate it.** If the GraphQL gather or the per-SHA file calls were not run, the
resolution counts and the changed-code ratio are unavailable and the report says
so. An estimated review-effectiveness number is worse than a blank, because §6's
whole claim is that it is measured.
- **Defects caught before merge versus after merge.** Before = blocking findings
  on PRs that then merged. After = the reverts and corrective PRs from §4. The
  ratio is the honest measure of whether review is paying for itself; when it
  inverts, review is theatre and should be said so plainly.

---

## 7. Output

```markdown
# Engineering delivery retro — <period> (vs <previous period>)

## Verdict
Fruitful | Mixed | Low-delivery

## Delivered
<concrete outcomes — what exists now that did not before. Not activity.>

## Delta versus previous period
<metric-by-metric table, this → previous, with the direction that matters marked>

## Flow bottleneck
<the largest measurable delay, with its number and share of cycle time>

## Quality signal
<what reviews and CI indicate, including rework>

## Scope discipline
<how much of the merged work served the active milestone>

## One experiment for next period
<one bounded behaviour change, with the metric it should move>
```

Verdict rules, applied mechanically so the word is not a mood:

- **Fruitful** — at least one release-gate outcome completed with its evidence,
  **and** the majority of merged work served the active milestone, **and** no
  unresolved rework from the window.
- **Low-delivery** — no gate outcome completed **and** under half of merged work
  served the active milestone.
- **Mixed** — anything else. Say which half is which; do not average them into a
  shrug.
- **Unscoped** — no active milestone resolved by either step of the §1 order.
  Report the evidence, withhold the verdict, and name the missing scope source.

The experiment is **one** change, bounded to the next window, naming the metric
it should move ("cut approval-to-merge median below 12h by merging on approval
instead of batching"). Three experiments is a plan, and plans do not get run.

## 8. On summary numbers

Do not produce a single opaque productivity score.

If one summary number is genuinely useful, it is **delivery confidence** — how
much of the active milestone this window's evidence supports — and it comes with
its inputs shown, so a reader can disagree with a component rather than with a
verdict.

It is never a statement about the person. It does not stand in for hours, effort,
or worth, it is not comparable across people, and it is not a performance metric.
A week spent deleting a dependency, reading a source, or discovering that a
planned approach does not work can be the most valuable week in a release, and
this skill will score it low. Say so in the report when it happens.

---

## Refusals

- **Never report commits, changed lines, or merged-PR count as a productivity
  score.**
- **Never produce a single opaque score**, and never present any number as
  personal worth, effort, or hours worked.
- **Never count a release gate as completed because its implementation PR
  merged.** A merged PR is not gate evidence.
- **Never report a metric without its previous-period comparison.**
- **Never mutate anything** — no PR, no issue, no branch, no comment.
- **Never present a current snapshot as a historical figure.** Open-PR queues are
  reconstructed from lifecycle timestamps; worktree counts cannot be, so the
  previous window's cell is `unavailable`.
- **Never estimate a metric whose evidence was not gathered.** Unavailable is a
  reportable value; a plausible number is not.
- **Never assume an active milestone.** No scope source resolves → verdict is
  `Unscoped`.
- **Never attribute historical work to today's scope.** The milestone is read at
  the window's `to` from git history, or supplied by the caller, or the run is
  `Unscoped`.
- **Never let two windows share a timestamp.** `[from, to)`, UTC, previous window
  ends where the current one begins.
- **Never credit a merge with a check that finished after it merged.** Filter to
  `completedAt ≤ mergedAt`; a merge with no completed check is `merged before
  checks completed`, never green.
- **Never run against an unfetched or stale base.** Guard 1 fetches first and
  blocks when the newest `origin/<default-branch>` commit predates the window;
  and "today" comes from the session's stated date, never the local clock.
- **Never compare windows of different lengths.** Guard 2: the comparison window
  is computed, a stored snapshot is used only on an exact window-length match,
  and a still-open window is never a comparison target.
- **Never infer from silence.** A window with no merged PRs may have been spent
  on a live client, an outage, or an approach that turned out to be a dead end.
  Say the evidence is absent rather than reading it as absence of work.

---

## Acceptance scenarios

| # | Situation | Required behaviour |
|---|---|---|
| 1 | 10 merged PRs, none serving the active milestone, no gate completed | **Low-delivery.** Ten merges is not the verdict; zero gate outcomes and 0% milestone share is |
| 2 | 1 merged PR, and it completed a release gate with its acceptance evidence | **Fruitful.** One outcome beats ten unaligned merges, and the arithmetic says so |
| 3 | Merged-PR count is flat but median cycle time doubled | Flow bottleneck is the headline; the flat count is not the story |
| 4 | 3 of 6 merged PRs are corrective work on the previous window | Rework leads the quality section and caps the verdict at Mixed |
| 5 | Zero reviews performed, zero findings | Report as a **gap**, not as quality — nothing was checked |
| 6 | No merged PRs at all in the window | State the evidence is absent. Do not infer idleness |
| 7 | A caller asks for one productivity number | Refuse the opaque score; offer delivery confidence with its inputs shown |
| 8 | No `scope_doc` configured and no `--milestone` supplied | **Unscoped.** Report the evidence, name the missing source, withhold the verdict |
| 9 | Review threads gathered without the GraphQL query | Resolution counts and changed-code ratio reported `unavailable`; the rest of §6 still reports |
| 10 | Previous window's worktree count requested | `unavailable` — a current snapshot, no history. The open-PR queue delta is still computed, from lifecycle timestamps |
| 11 | A window that closes before `<scope_doc>` first landed | Step 1 finds no commit; without `--milestone` the verdict is **Unscoped**. Never score it against today's milestone |
| 12 | A PR merged at exactly the window's `to` instant | Excluded — `[from, to)` puts it in the next window. It is counted once, there |
| 13 | Time-to-resolve-review-comments requested | `unavailable`, permanently — GitHub exposes no `resolvedAt`. Report resolved ÷ opened counts instead |
| 14 | A PR whose checks all completed after `mergedAt` | **Merged before checks completed** — its own bucket. Not green, not red, and never folded into the green share |
| 15 | Newest `origin/<default-branch>` commit predates the window's `from` | **BLOCK** (Guard 1). Name the latest commit date and the window, and stop until the base is fetched or the date confirmed. Never narrate an empty window |
| 16 | A saved 14-day retro snapshot offered as the previous period for a 7-day run | Discard it and recompute the 7-day previous window; if that is impossible, previous-period cells are `unavailable` (Guard 2) |

---

## Dry run

When this skill directory carries `fixtures/period-current.json`,
`fixtures/period-previous.json`, and `fixtures/expected-retro.md`, run them
before trusting a change to this file. The fixtures are two frozen windows of PR,
CI, review and tracker data, built so that the current window has **more** merged
PRs and **less** delivery than the previous one — the exact case an
activity-counting retro gets backwards.

The dry run passes when the verdict comes out **Low-delivery** despite the higher
merge count, and the report says why in the first three lines.

Four traps belong in the fixtures on purpose, each catching a rule the prose
alone cannot enforce:

- **A boundary PR** merged at exactly the window's exclusive `to`. Counting it is
  an inclusive-boundary bug and shifts the milestone share.
- **Default-branch workflow counts** (`ci.runs`/`ci.success`) that do not match
  the per-merge figures. Using them as the CI denominator is the §4 failure.
- **A late-checks PR** whose checks complete minutes *after* its `mergedAt`, so it
  is `merged before checks completed`, not green. Reading the rollup conclusion
  without the `completedAt` filter overstates the green share by one.
- **A missing `worktrees_at_end` on the previous window**, and no
  resolution-duration field in either. Both must be reported `unavailable`; a
  number in either place was invented.

**Make the fixture milestone caller-supplied (§1 step 2), not git-pinned**, and
say so in the expected report. If both fixture windows predate the scope
contract, a live run over the same dates without `--milestone "<name>"` is
correctly **`Unscoped`** — the `Low-delivery` result is conditional on the scope
being supplied, and a report that claims it was pinned has mislabelled its own
source.

What fixtures cannot exercise: the §6 attribution rule needs review threads with
anchor paths and per-commit file lists, the §1 scope pin needs git history, and
Guard 1 needs a real remote. All three are live-run paths, so the dry run checks
the *reported* values, not the derivation.
