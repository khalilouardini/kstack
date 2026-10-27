---
name: next
version: 0.11.0
description: Read Linear and recommend one scoped issue, or a bounded parallel batch with --parallel and repeated --project. Verifies candidate scope and dependency closure; unrelated graph gaps are warnings. Explicit flags accept a reviewed pending PR or a local graph. Shared files warn; real dependencies constrain selection. Read-only. Use for "what should I work on next", "pick my next ticket", or "what can I run in parallel". (kstack)
---

# next — what to pick up now

## When to invoke

Someone needs to decide what starts now, and the tracker holds more open work
than fits in one head. Invoke as
`/next [<milestone-id>|any] [--project "<name-or-id>"]... [--parallel [N]] [--accept-overlap <PR#>]... [--accept-graph-update <PR#>]... [--local-graph]`.
Forward-looking;
the complement to `triage`, which audits unfinished GitHub work backwards. Not
for deciding whether a *new* idea is in scope (that is the `spec` pipeline's
product gate), and not for repairing the board (that is `linear-steward`).

**Make exactly one recommendation.** Show a ranked top 3 for visibility, but rank
2 and 3 are context for the decision, not alternatives to weigh — the #1 is the
answer, and it comes with the reasoning that makes it checkable.

A ranked list of ten is what a backlog already *is*; the value you add is the
decision, and a decision that still needs deciding is not a decision. Three is the
ceiling because the point of the ranking is to show what #1 beat, not to hand the
choice back.

That is **default mode**, and it is the right shape when one person picks up one
ticket. When several agent sessions can run at once, `--parallel [N]` answers a
different question — not "what is the one thing to start" but "what is the largest
set of things that can start *at once* with explicit integration obligations." Same configuration,
same contract gate, same blocker analysis; the output is a batch of up to N issues
assessed for technical compatibility instead of a single decision. Default N = 3. See
**Parallel mode** below.

## Project filters — `--project "<name-or-id>"` (repeatable)

Read `tools/linear/next/references/project-resolution.md` from the physical
stack root and follow it top to bottom, using **open issues** as the state
restriction. If unreadable, stop. It owns argument validation, access/team
resolution, canonical project-ID union, membership verification and pagination.

With filters and no positional milestone (or `any`), consider each issue under
**its own authorized milestone**; do not narrow the pool to the active milestone
or let a winner seed one milestone. With an explicit positional milestone, apply
it as an additional restriction across the selected projects. Project names are
selection boundaries, **not scope authorization**: neither a release-looking
name nor membership makes an issue IN. Map `projectMilestone.id` plus project ID
to the scope doc's milestone and ratified IN line. If tracker milestones use a
different vocabulary, use an explicit mapping in the scope/workspace contract;
never equate a project with a milestone or guess from similar names. An issue
with null or unresolved milestone is ineligible unless the contract explicitly
assigns its scope to a milestone. Report unmapped issues and TBD/non-binding IN
lists as unauthorized; fail closed if the mapping data could not be fetched.

Without `--parallel` (including `--parallel 1`), project filters still yield one
recommendation and at most two runners-up. With `--parallel`, select **one
combined batch**, using the cross-project checks below. Without project filters,
the existing single-milestone resolution remains unchanged.

Examples:

```text
/next --project "Road to MVP-2" --project "MVP-2 stretch" --project "MVP 2.3" --parallel 5
/next <milestone-id> --project "Road to MVP-2" --project "MVP-2 stretch" --parallel 3
/next --project "<project-id>"                  # one recommendation
/next any --parallel 3                        # legacy single-milestone batch
/next <milestone-id>                          # legacy single recommendation
```

For focused offline validation, use [references/validation.md](references/validation.md).

## Shared eligibility and overlap policy

Read [references/selection.md](references/selection.md) before assessing candidates.
It is the common stage contract for next, wave and dispatch. Collect the complete
filtered pool, compile its observation packet with `bin/assess-candidates`, run
its deterministic selector, and retain all exclusion reasons. Do not hand-author
the six checks or substitute a project coverage state for candidate admission.
Use the returned IDs; priority is a tie-break after feasible cardinality.

Shared file paths warn equally for candidates selected together and already-active
work. Real dependencies, required unmerged foundations and incompatible changes
remain constraints. Preserve exact overlap paths in plan risks and Pending overlap
PR sections, with fresh-main rebase, gates and changed-head review before merge.
`--accept-overlap <PR#>` is an optional compatibility annotation, not permission
needed for ordinary overlaps. Each explicit value must be a positive decimal PR
number, OPEN at observation; missing/invalid/closed/nonexistent values refuse.
Deduplicate reads without discarding original command tokens. Read
`tools/linear/next/references/pr-file-snapshot.md` from the physical stack root for complete diffs;
unknown external diff evidence is an unverified warning, not a fabricated dependency.
Ownership and technical dependency evidence still must be established.


Accept `--local-graph` under the shared publication gate's **Explicit approved local graph**
procedure. It replaces graph publication with fresh local indexed validation and
candidate/closure admission; scope, native blockers, evidence, human decisions
and plan/merge approvals remain mandatory. Forward this invocation's explicit
flag and canonical owner/index/manifest pins through composed execution skills.
Recheck the owner files before writes; never substitute an older dispatch-worktree
copy. Changed pins require a new plan. Reject repeated local flags and mixed
local/PR graph sources. No graph publication or extra tracker writes are granted.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: kstack
`CONVENTIONS.md` §2) before touching the tracker:

- **`scope_doc`** — the scope/priority contract every candidate is gated against.
  Missing, null, or unreadable → **refuse**, naming `scope_doc`. There is no
  fallback: without it this skill ranks on tracker priority alone and calls the
  result a decision, which is exactly the drift it exists to catch.
- **`workspace_contract`** — the tracker's own rules doc (access path, status
  vocabulary, what `Done` requires, milestone semantics). Read it when set, and
  prefer its access and verification path over anything restated here — one path
  for every Linear skill beats a second set of rules maintained per skill. Null
  or missing is **not** a refusal: use the access path below and say in the output
  that no workspace contract was configured.
- **`issue_prefix`** — the issue-key prefix (e.g. a three-to-five letter team
  code). Used only to sanity-check that the rows you got back belong to the team
  you asked for (trap 1). Missing or null is a sanctioned degradation: skip that
  check and say so.

Missing `.agents/stack.yml` altogether → refuse and name the file.

## Hard rule: read-only

> **Never create, close, re-open, reassign, re-estimate, or comment on an issue,
> and never write a status update.** This skill reads the tracker and writes
> nothing to it.

**Enforcement honesty:** this is **prompt-level** — the Linear write tools
(`save_issue`, `save_comment`, `save_status_update`, or the equivalent GraphQL
mutations) are reachable from most hosts and nothing blocks the call. A host that
runs this skill with those tools withheld makes it tool-list-enforced; say which
case you are in if the user asks.

## How this differs from `triage`

| | `triage` | `next` |
|---|---|---|
| Source | GitHub — PRs (default), branches/worktrees on request; optional Linear project selection | Linear — issues, cycles, projects |
| Direction | Backward. What did we leave unfinished? | Forward. What should start now? |
| Output | A scored roster of everything | One recommendation plus two runners-up — or, under `--parallel`, an N-track batch |

If the answer is "finish something already in flight," say so and hand off to
`triage` — but say *which* thing, not "check your open PRs."

## Reaching Linear

For access and canonical team resolution, follow
`tools/linear/next/references/project-resolution.md` (Access and team), including
when no project filter was supplied. The connector may additionally need cycle
and milestone reads for the ranking below.

**The query must collect every field the ranking below consumes.** An earlier
version fetched only active-cycle issues with priority and state, while steps 3–5
rank on project membership, milestone deadlines, and blocking relations. The
result was silent: a release gate sitting *outside* the active cycle, or an issue
blocked by another ticket, lost to an apparently-unblocked cycle item and nothing
in the output revealed the omission.

Read **open issues across the team**, not just the active cycle, and paginate.
With project filters, restrict the candidate queries to the resolved project IDs
as well. Verify IDs and membership using the project-filter procedure; a connector
name filter is not proof. Fetch blocking neighbors outside those projects (and
outside the team when linked) to establish their state and transitive dependencies.
The project union limits recommendations, not the dependency evidence.

Apply the resolved canonical team constraint to every candidate query. For
the example below, resolve `TEAM_KEY` from that verified team; never use a
workspace-wide state-only query.

```bash
# Base query without project filters; TEAM_KEY resolved above — never unscoped
curl -s https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"query($after:String,$team:String!){ issues(first:100, after:$after, filter:{team:{key:{eq:$team}}, state:{type:{nin:[\"completed\",\"canceled\"]}}}) { pageInfo { hasNextPage endCursor } nodes { id identifier team { id key } title priority estimate dueDate state { name type } assignee { name } cycle { name endsAt isActive } project { id name } projectMilestone { id name targetDate } labels { nodes { name } } relations { nodes { type relatedIssue { identifier state { type } } } } inverseRelations { nodes { type issue { identifier state { type } } } } } } }","variables":{"after":null,"team":"'"$TEAM_KEY"'"}}'
```

For project-filtered GraphQL reads, extend the base query with a project-ID
variable/filter using the available schema, or run one ID-filtered query per
resolved project and union the verified results. Do not run this team-only
example unchanged and present it as a project-filtered query.

Follow `pageInfo.hasNextPage` / `endCursor` until exhausted. `relations` gives
what this issue blocks; `inverseRelations` gives what blocks it — you need both,
and reading only one inverts the dependency direction.

**Fail closed on any missing ranking input.** If pagination is truncated, or
relations, project, or milestone data is unavailable for the candidate set, say
which input is missing and that the ranking is unreliable. Do not rank on the
subset you happened to receive — a confident recommendation from partial state is
worse than no recommendation, because nothing in the output shows what was absent.

If neither path is available, **stop and say so**. Do not recommend a next step
from the repo alone and present it as if it came from the tracker — that is a
fabricated source, and it is the one failure mode that makes this skill worse
than useless.

### Two Linear traps, both load-bearing

1. **Name resolution fails OPEN.** Filtering by a team, project, or cycle *name*
   can return HTTP 200 with the filter field silently unset — you get everything,
   ranked as if it were the filtered set. `&amp;`-containing names never resolve
   at all. **Always verify the filter applied**: check the returned rows actually
   belong to what you asked for before you reason over them (with `issue_prefix`
   set, every identifier should carry that prefix).
2. **Milestone `progress` derives from issue closure**, not from real completion.
   A milestone reading 100% means its issues are closed, which is not the same
   claim. Never quote milestone progress as evidence that something works.

## Published graph coverage — required for Linear projects

Before ranking or emitting any kickoff, resolve the physical stack root and read
`tools/linear/linear-roadmap/references/publication-gate.md` there. Follow its
fresh main coverage audit and separate candidate/closure eligibility checks,
including legacy projects with no index. Report coverage counts and missing keys
as project warnings. Rank otherwise eligible mapped candidates despite unrelated
missing tickets. Selected unmapped maintenance work may prepare the bounded local
reconciliation artifact; cite main SHA, full live evidence and exact delta in its
kickoff. Scope/dependency/release/human changes need reviewed publication. Unknown
selected main/live/closure evidence fails closed; exclude that candidate, not all
independently verified work in its project.

Accept repeatable --accept-graph-update <PR#> with the contract's positive-number,
OPEN/main-base, reviewed exact-head, indexed validation and selected-closure checks
before selection; unrelated coverage omissions remain warnings. It is
independent of --accept-overlap and waives only main publication. Read the
validated pending PR graph for condition analysis when accepted; do not relax
indexed validation or the gates below. Report the main SHA, coverage and accepted
PR/head/digest and candidate audit path/digests; carry the local delta and forward
current invocation flags into every kickoff, including dispatch --plan-only and
wave. Prior flags or local audit records are not consent or fresh evidence.

## Project orchestration records — read-only

Use a detached, read-only graph checkout at the exact main SHA validated above,
or the exact accepted graph PR head for that project. Call it `<graph-checkout>`;
verify its HEAD equals the coverage SHA. Read the index, manifest, root roadmap
and human-decision table from that checkout. Never use the consuming working
tree's unmerged graph for condition analysis. The sole exception is the bounded
local maintenance manifest reconstructed from pinned main plus the recorded exact
delta; validate its effective digest and origin closure under the shared contract.
If the validated head or relevant evidence moves, repeat admission and condition
analysis before a kickoff.

When `<graph-checkout>/orchestration/index.json` exists, it is the sole active manifest index.
Resolve this skill's physical canonical directory: follow the installed Claude
symlink with `cd <installed-next-directory> && pwd -P`, or read Codex's generated
pointer and use its canonical target. Obtain `<stack-root>` with
`git -C <physical-next-directory> rev-parse --show-toplevel`. Read
`<stack-root>/ORCHESTRATION.md` and the roadmap `references/contract.md` beneath
that root, then run `python3 <stack-root>/tools/linear/linear-roadmap/bin/graph-record validate-index <graph-checkout>/orchestration/index.json`. Unreadable,
invalid or unsupported schemas and dirty lifecycle/roadmap source stop the
covered-project recommendation. `source_revision` is adoption provenance;
an installed HEAD mismatch alone never blocks selection or requires repinning.
Absent index keeps the legacy procedure only where the root graph does not claim
adoption. If the root claims adoption but lacks its index, stop recommendations
for the affected projects until the index is repaired; never fall back around
their graph conditions.

Read the exact manifest named by the index. Cite the `sha256:<digest>` reported
by indexed validation as its revision. Never combine additional files or infer
readiness from Mermaid. A covered project's open issue without a kind `unit`
matching its canonical UUID is UNMAPPED: require bounded verified local maintenance
reconciliation or reviewed graph publication before a kickoff. A publication flag
cannot waive executable mapping or closure evidence. Other node kinds can share
issue references for context only.

This analysis owns the read-only graph rehearsal. Use the state predicates in the
contract: ACTIVE, HUMAN_REQUIRED, UNKNOWN, BLOCKED, PLAN_ONLY, READY_TO_BUILD and
MERGE_BLOCKED. Scope authorization and the independence bar below still apply.
A start prerequisite is **any edge targeting plan or build**, regardless of type.
Native Linear blockers always target plan; step 4's native-blocker rule wins over
a graph's build-only edge. An open native blocker excludes even a plan-only
kickoff. Report conflicting representations as a named human decision.

Check each event against fresh PR/default-branch, acceptance and human-decision
evidence. Before a controller exists, read the root Human decisions table and its
original scope decision-log entry or Linear comment, including authorized actor,
UTC date, exact boundary and manifest digest. A changed graph/scope invalidates a
decision unless its owner explicitly reaffirms it. Do not write approval records.
Done, a draft/recorded field or structural validity is not completion evidence.

Verified plan/native conditions with a false or unknown later build condition
permit PLAN_ONLY in default mode. Its kickoff calls
`/dispatch-implementation <id> --plan-only` only after the dispatcher's unchanged
scope/lifecycle guards pass; it ends at a plan, with no code edits or PR. Name the
unmet build event and source, and re-check it before any later implementation.
READY_TO_BUILD gets the implementation kickoff after human plan approval.
A graph result alone is not plan approval or semantic scope authorization.
PLAN_ONLY and unknown-file-scope candidates with authorized planning go in the
separate planning queue. They do not count as implementation-ready tracks.
Wave version 2 preserves them in planning_tracks/planning_plans, never in its
build approval set. Later merge conditions do not block planning or build unless
a cited prerequisite actually targets those stages.
Use unresolved downstream conditions within the existing release/scope ranking;
do not invent durations or a computed critical path. These rules are prompt-level.

## Procedure

1. **Read the file named by `scope_doc`, in full, every run.** Do not answer from
   memory of a previous run, and do not carry a section map in your head — owners
   amend the document and section numbers move. Read the headings you actually
   find and cite them as the document numbers them. You need, by role rather than
   by number:

   | Role | What it holds |
   |---|---|
   | **Gates and their dates** | The milestones and when each is due |
   | **Active-milestone IN list** | The lines a recommendation for the active milestone must cite |
   | **Later-milestone IN list(s)** | Real work, wrong milestone |
   | **Known blockers** | Repo-level blockers the tracker does not know about |
   | **Decision log** | The dated log of ratified decisions and releases |

   If the document's structure disagrees with this table, **the document wins**
   and you say so.

   **Without project filters, resolve the target milestone** from the argument — a milestone id the scope
   doc defines, or `any` (whichever milestone the winning candidate serves). With
   no argument, the target is the **active** milestone: the earliest gate the
   decision log does not record as released. **A passed date does not advance it**
   — an unreleased gate whose date has gone is *overdue* and still active. Compute
   days to *that* gate; if it is negative, write `overdue by N days`, never "soon"
   or "coming up".

   With project filters, resolve each candidate as described under **Project
   filters**; only an explicit positional milestone restricts that union.

   A gate whose entry carries no date, or whose IN list the document marks as
   under redefinition or TBD, is reported as such rather than given an invented
   one.

2. **Pull tracker state — all of it.** Every open issue on the team (not only the
   active cycle), restricted to the verified project union when filters are set, paginated to exhaustion, each carrying priority, estimate,
   state, assignee, due date, cycle, **project, project milestone and its target
   date, and both directions of its blocking relations**. Verify the filter
   actually applied (trap 1). If any of those inputs is missing, fail closed per
   "Reaching Linear" rather than ranking on what arrived.

   **Under `--parallel`, this field set is not sufficient**
   — criterion 4 of the concurrency bar needs `description`, `parent`, `children`, and branch/PR
   evidence per candidate, which the base query above does not request. Fetch them
   before selection, and fail closed if they are unavailable. Default mode does
   not add this selection requirement. With `--accept-overlap`, fetch concrete
   scopes for overlap reporting; mark missing scopes unverified as defined above.
3. **Gate each candidate against the contract.** An issue that does not trace to a
   line in its resolved milestone's IN list is not that milestone's next step
   regardless of its tracker priority. **When tracker priority and contract scope
   disagree, say so loudly** — that disagreement is usually the most useful thing
   on the screen, because it means the board has drifted from what was ratified.
4. **Check blockers before recommending.** If the strongest candidate is blocked,
   recommend *the unblocking work* instead and name what it releases, only if
   that work passes the same project/team and scope gate. Otherwise report the
   external prerequisite without making it a selected track. Two kinds:

   - **Linear blocking relations**, from `inverseRelations` — authoritative, since
     the board maintains them.
   - **Repo-level blockers** in the scope doc's known-blockers section, which the
     tracker does not know about.

   > **Verify every known-blockers row against the current repository before it
   > changes a ranking.** That section is prose, not a query; it records what was
   > true when written and nothing invalidates a row when the work merges. Check
   > the cited file, or `gh pr list --state merged --search "<the PR it names>"`,
   > before treating a row as open.

   A stale blocker is not a harmless one. It makes this skill recommend unblocking
   work that is already merged, or de-prioritise a candidate that is in fact ready —
   and the output looks identical either way, because the citation is to a file that
   still exists.

   > **Worked example (OGUR).** A known-blockers row recorded that only one report
   > pack was served end to end. The PR that fixed it merged on 2026-08-05 and the
   > row still read as open five days later, so every run in that window
   > de-prioritised work that was in fact ready. Nothing in the output showed it,
   > because the row cited a file that still existed.

   If a row cannot be verified, say so and rank without it rather than assuming it
   still holds. Report any row found stale — that is a finding about the contract,
   and it is worth more than the recommendation it changed.
5. **With project filters, prefer authorized active release work** over later or
   stretch work: derive active/unreleased gates from the scope doc and decision
   log, not project names or passed dates. Within that release tier, prefer work
   that unblocks other work, then the critical path, then the rest. Without
   filters, **prefer work that unblocks other work**, then work on the critical path, then
   everything else. A two-hour task that releases four tickets beats a one-day
   task that releases none.
6. **Non-engineering items count.** If the binding constraint is "nobody has asked
   the customer who gets logins," that is the next step, and it is not a ticket.
   Say it anyway.

## Parallel mode — `--parallel [N]`

Bare `--parallel` means N = 3; `--parallel 5` overrides. The flag composes with the
milestone argument — `/next <milestone-id> --parallel 3` is valid.

**N must be a positive integer, and it is validated before anything is
selected.** `--parallel 0`, a negative value, or a non-integer is a malformed
invocation: **refuse**, quoting the value given. Do not accept it and select
nothing — an empty batch is indistinguishable in the output from "every
candidate is blocked", which is a real and very different finding. `--parallel 1`
is default mode; say so and run default mode rather than emitting a one-row
batch. Use `wave.selection_limit` (default 12) as the explicit upper bound;
above it refuse and name the key rather than silently clamping. The count controls
selection, not concurrent local test processes or the size of the output.

### Resolving `any` for a batch without project filters

`any` is defined in step 1 as "whichever milestone the winning candidate serves,"
and parallel mode has no winning candidate — so that definition does not survive
the composition `/next any --parallel 3` unaided. Left undefined it is circular:
the target milestone must be known to gate candidates, but it would depend on a
candidate chosen after gating.

**Without project filters, a parallel batch is always single-milestone.** Under `any`, resolve the
milestone *before* selecting tracks: gate every candidate against each milestone's
IN list, rank the gated candidates by step 5's preference, and take the milestone
the top-ranked one serves. The batch is then drawn from that milestone alone, and
the output's single `Gate` and `Contract` line describes it truthfully. **Name the
resolved milestone and say it was resolved from `any`**, so the reader can see a
choice was made on their behalf.

This is the one place the top-ranked candidate does seed something, and it is not
the batch — it fixes the *scope*, after which cardinality is maximized within that
scope exactly as below. Without project filters, a batch spanning two milestones is never emitted: the
output cannot describe it in one gate line, and "these five things are next" across
two different gates is not a decision anyone can act on.

**Configuration and steps 1–4 of the Procedure are unchanged.** Read
`.agents/stack.yml`, read the file named by `scope_doc` in full, pull tracker state
to exhaustion, gate every candidate against its resolved milestone's IN list (one target
without project filters, per issue with them), verify
both kinds of blocker. Parallel mode changes what happens *after* the gating, never
the gating itself, and the hard read-only rule above covers it unchanged.

### Selecting the tracks

Read active work across the repository and record ownership, dependencies and
external overlaps using references/selection.md. A live issue gets a resume
instruction; assignee or In Progress alone is not proof of an active session.
Collect complete candidate and pair assessments, including semantic conflicts;
run `node <stack-root>/tools/linear/next/bin/select-candidates <input.json>`.
Unknown candidate scope permits authorized read-only planning but not an
implementation independence claim. Shared filenames alone are warnings.

From the gated, unblocked, inactive candidates, compute the **largest mutually-compatible
set of size ≤ N** — maximum cardinality, not merely a set nothing can be added
to. Step 5's preference (work that unblocks other work first, then the critical
path, then the rest) breaks ties **among the batches that are already largest**;
it does not choose the first track and let the rest fall out around it. With
project filters, compare equal-size batches first by the number of authorized
active-release tracks, then by step 5's remaining preferences. Later work fills
spare capacity only when independent; do not reserve one slot per project.

The distinction is not pedantic, and greedy-by-priority gets it wrong. If the
highest-priority candidate A collides with both B and C while B and C are
independent of each other, taking A first yields `{A}` — a set nothing can be
added to, and half the batch that `{B, C}` would have delivered. The mode
promises the largest set that can start at once; seeding it with the top-ranked
candidate quietly promises something smaller. When a maximum-cardinality batch
excludes the top-ranked candidate, say so in the output and name what it cost —
that trade is the reader's to see.

Independence must hold **pairwise across every pair in the batch**, not merely
between each candidate and the top-ranked one. Three tracks is three pairs; four is
six; five is ten. These checks cross project and milestone boundaries as well.
Checking each track only against track 1 is the failure this mode is most
likely to ship, because the output reads identically either way and the collision
does not surface until merge.

A pair is independent only when all four hold:

1. **Neither issue is blocked** — no open inverse relation **of blocking type**,
   and no known-blockers row that survived re-verification against the repo. **Filter on
   `type`.** Linear's relation records also carry `related` and `duplicate` links,
   and a bare mention of one issue in another's description or comments can create
   a `related` edge automatically. Rejecting every open `inverseRelations` edge
   regardless of type discards runnable work and makes the supposedly maximum batch
   underfill — which silently defeats the cardinality rule above. Related and
   duplicate edges are **context**: read them, mention them if they matter, never
   let them block.
2. **No dependency path between them**, direct or transitive in either direction — again blocking type
   only, by the same reasoning. Follow blocking neighbors outside the selected
   projects too; missing relation pages or neighbor state cannot prove independence.
3. **No shared not-yet-merged foundation.** Two issues stacked on the same open PR
   are not independent: a stacked PR's `MERGED` state proves nothing about the
   default branch, because the base can merge out from under it and strand the
   code off it. Verify required foundation code is reachable from the current
   default branch; an open/unmerged foundation blocks starting even one dependent
   track. Do not substitute a stacked PR's merged label for reachability.
4. **Scopes executable in isolated worktrees.** Establish concrete file scopes
   from issue descriptions, parent/child structure, repository mapping and existing
   diffs. Assess actual incompatible changes as pair constraints. Sharing a file
   alone is an integration warning. If candidate scope is unknown, use the
   authorized planning queue to map it; do not invent a disjoint file list.

   **A container issue is not an executable track.** A parent carrying open
   children (workstream containers are exactly this shape) is a grouping, not a unit of work, and it
   is never isolated from its own children. Select the leaf, never the container,
   and never both.

**Never pad the batch to reach N.** Fewer tracks than requested is an expected
outcome and is reported as one — `3 requested, 2 passed` is a result, not a
failure. If exactly one candidate passes, say that parallel mode collapsed to a
single track and emit the ordinary default-mode output rather than a one-row batch.
If none passes, say so and name what they are all waiting on.

### Per-track handoff

Every rule in **Agent handoff** applies per track, and one paragraph per issue
still means one paragraph per issue. Additionally:

- **Each *engineering* track names its own branch and its own distinct worktree
  path in the kickoff.** Several
  agent sessions in one working directory is the concurrency hazard this mode
  exists to manage, not to create. A fresh worktree may need the repo's install
  step re-run before its checks pass.
- **With the flag, each engineering track carries its actual accepted overlaps
  in its kickoff:** PR number, title, author and exact overlapping files. For
  READY_TO_BUILD or graphless implementation, include the **Rebase policy for
  accepted overlaps** above. PLAN_ONLY lists risks without a rebase step;
  human actions omit this clause. No overlap means no extra kickoff instruction.
- **A non-engineering track keeps its human execution kickoff and gets no git
  artifacts.** Step 6 of the Procedure holds here unchanged: if the binding
  constraint is "nobody has asked the customer who gets logins," that is real work
  and it belongs in the batch. Manufacturing a branch, a worktree, and a PR for it
  would be fake git work, and dropping it would understate the batch this mode
  promises is the largest — so do neither. Give it an execution kickoff for the
  person, and say plainly it carries no branch.

  **Its independence needs its own contract, because all four criteria are about
  mechanisms an untracked action does not have.** There is no `inverseRelations`
  edge, no issue-to-issue dependency, no branch, and no file scope — so calling it
  "independent" by the four-criterion bar is not conservative, it is undefined.
  Judge it on this instead, and write the answer into the output rather than
  implying it:

  1. **Not blocked** — no known-blockers row applies to it, re-verified against the
     repo exactly as step 4 requires.
  2. **No track in the batch waits on its outcome, and it waits on none of them.**
     This is read from the action's own description, not from a relations graph, so
     it is a judgement rather than a lookup: write the one sentence that justifies
     it. If that sentence is hard to write, the answer is not independent —
     sequence it.

  Criteria 3 and 4 do not apply at all: it touches no branch and no file. Not
  applicable is not the same as failed — never send an untracked action to
  `Sequenced instead` for lacking a file scope to compare.

  **Gating and rendering.** It is gated like everything else: it enters the batch
  only if it traces to a line in its resolved milestone's IN list. With project filters, record its
  project and milestone from the contract; do not assign it to a project by guess. That it has no
  tracker issue is not a defect to paper over — it is the finding the Rules section
  already requires ("a contract IN line with no tracker issue is a finding"), so
  surface it. It has no identifier and no estimate, and **inventing either would
  be fabricating tracker data this skill is forbidden to create**, so its row takes
  the untracked shape in the output template below: `(no issue)`, a proposed title,
  no branch, no worktree. Propose the title; never create the ticket.
- **An issue already owned by a live branch or PR is not a new track.** Mark it
  `already active` and hand off a resume instruction instead.
- Each **READY_TO_BUILD or graphless engineering** kickoff ends with: open a PR, do not merge,
  do not mark the issue complete. PLAN_ONLY uses the plan-only variant below and
  is listed outside the N selected implementation tracks.

## Agent handoff

After ranking, write a paste-ready kickoff for the recommended work — one
paragraph a person can paste straight into a fresh coding-agent session (Claude
Code, Codex, whichever host they drive). This handoff follows the readiness state; it is not a second recommendation.

- Write **one short paragraph for the #1 issue**. Use its tracker outcome and
  acceptance criteria, the contract boundary, known prerequisites, the relevant
  validation, and, for READY_TO_BUILD or graphless engineering, the instruction to open a PR without
  merging or marking the issue complete. For PLAN_ONLY, use: "Run
  `/dispatch-implementation <id> --plan-only`, honoring its scope/workspace rules.
  Produce the acceptance-cited plan and stop. No implementation or PR; build waits
  for <event, unmet condition, source>." Do not invent scope.
- With the flag and actual file overlap, carry this engineering issue's PR
  number, title, author and exact overlapping files in the paragraph. Include
  the **Rebase policy for accepted overlaps** for READY_TO_BUILD or graphless
  implementation. PLAN_ONLY carries plan risks without a rebase step; human
  actions omit this clause. Apply the same rule to every parallel kickoff.
- If #1 is already genuinely active, tell the agent to resume the named branch or
  PR instead of creating a duplicate session. If #1 is non-engineering, write an
  execution kickoff for the human action; do not manufacture an agent task or a
  tracker issue.
- For ranks 2 and 3, decide whether each can **actually run in parallel** with #1,
  using the four-criterion bar defined under **Parallel mode** — the same bar,
  applied to one pair instead of a whole batch. If concurrency is uncertain,
  sequence the work and do not emit a parallel kickoff.
- For every runner-up proven safe to run concurrently, write **its own separate
  short paragraph** under `Parallel kickoffs`. Never combine two issues into one
  paragraph. Name any required rebase or final integration order.
- Do not emit a new-session kickoff for a runner-up already owned by a live branch
  or PR; say `already active` in its ranking line instead.

Kickoff paragraphs do not turn runners-up into a menu. The #1 issue remains the
decision; parallel paragraphs only explain how spare execution capacity can be
used without delaying or conflicting with it. That holds for default mode only —
under `--parallel` the batch *is* the answer and there is no #1.

## Output

Keep the recommendation short, normally one screen. The full accepted-overlap
evidence list is the explicit exception; preserve every entry.

With the flag, the **Accepted overlaps** list names every selected engineering
track (and each default-mode parallel kickoff), with each PR's number, title,
author and exact overlapping files; write `none` when its scope is verified and
does not overlap, or `unverified` for an unknown scope. Include unused/unverified
accepted PRs and overlaps with sequenced/already-active candidates, even when no
track is selected. Omit this list when the flag is absent and omit human actions.

Every milestone-dependent field below is **derived from the issue's resolved milestone**,
never written literally. Under an explicit milestone argument the gate line
carries whatever the scope doc states for *that* milestone — including "scope and
date TBD, under redefinition" while such a banner stands — and cites its IN-list
section only if that list is binding; under `any`, name the milestone the winning
candidate actually belongs to. A run that emits one milestone's gate, date, and
section citation for a different milestone's request is wrong even if it picked
the right issue.

```
## Next: <issue id> — <title>

**Why this one:** <two sentences. The contract line it serves, and what it
unblocks or de-risks.>

**Project:** <project name and ID> · **Gate:** <MILESTONE> (<gate date>, N days) · **Contract:** <section, as the doc numbers it>
**Readiness:** <READY_TO_BUILD / PLAN_ONLY / ACTIVE; omit when no graph>
**Graph:** <manifest path, sha256 revision, condition source; omit when no graph>
**Size:** <tracker estimate, or "unestimated — treat as unknown">
**Blocked by:** <nothing / what, and whether that is also worth doing first>

**First action:** <one concrete thing doable in under 30 minutes>

**Accepted overlaps** (omit when `--accept-overlap` is absent):
- `<selected/kickoff issue id>` — PR #<number> — <title> — @<author>: <exact overlapping files; implementation rebase policy / PLAN_ONLY risk> (or `none` / `unverified`)
- PR #<number> — <title> — @<author>: <sequenced/already-active candidate ids and exact overlapping files, even if also selected elsewhere>
- PR #<number> — <title> — @<author>: unused — no gated-candidate overlap, all scopes verified (or unused status unverified — <unknown scope ids>)

**Kickoff:** <implementation paragraph for READY_TO_BUILD or graphless engineering; plan-only paragraph
with unmet build condition for PLAN_ONLY; human action when non-engineering>

---

**Runners-up** (context for the call above, not alternatives to weigh):
2. `<id>` — <title> — <one line: why it lost to #1>
3. `<id>` — <title> — <one line: why it lost to #1>

**Parallel kickoffs** (omit when none are proven safe):

**`<id>`:** <one short, paste-ready paragraph for this issue only>

**`<id>`:** <one short, paste-ready paragraph for this issue only>

**Not these, and why:**
- `<id>` — <six-word reason>
- `<id>` — <six-word reason>

**Board vs contract:** <any issue with high tracker priority that the contract
puts out of scope, or any IN line in the milestone's list with no tracker issue at
all. "Aligned" is a valid answer, but check before writing it.>
```

Rank 2 and 3 are optional — if only one candidate is genuinely viable, say so and
omit them rather than padding to three. Cap "not these" at three; if more than
three deserve mention, the board needs grooming and that is itself the finding.

### Parallel mode output

Used only under `--parallel`, and only when at least two tracks passed the bar.
Keep the summary concise; retain the full candidate report even when it exceeds one screen. Every milestone-derived field works identically. With
project filters, replace the shared Gate/Contract line with a Projects line listing
the resolved name/ID pairs, and render **Project, Milestone, Gate, and Contract
separately on every track**, including human actions. Never label a mixed batch
with one shared gate or date. A single-track collapse uses that track's own fields;
runner-up lines also name their project and milestone when filters are supplied.

```
## Parallel batch: <k> tracks (<N> requested, <k> passed the bar)

**Gate:** <MILESTONE> (<gate date>, N days) · **Contract:** <section, as the doc numbers it>

**Track 1 — `<id>` <title>**
Project: <name, ID> · Milestone: <name, ID> · Gate: <date/TBD/overdue>
Readiness: READY_TO_BUILD · Graph: <path, sha256 revision, condition source; omit without graph>
<size> · <contract section> · branch `<name>`, worktree `<distinct path>`
<one short paste-ready kickoff paragraph, this issue only>

**Track 2 — `(no issue)` <one-line action>**          ← untracked human action
Project: <contract assignment> · Milestone: <contract assignment> · Gate: <date/TBD/overdue>
untracked human action · <contract section> · no branch, no worktree
Proposed issue title: "<title>" — not created.
Independent because: <the one sentence from criterion 2 above>
<one short execution kickoff paragraph for the person>

**Track 3 — `<id>` <title>**
Project: <name, ID> · Milestone: <name, ID> · Gate: <date/TBD/overdue>
Readiness: READY_TO_BUILD · Graph: <path, sha256 revision, condition source; omit without graph>
<size> · <contract section> · branch `<name>`, worktree `<distinct path>`
<one short paste-ready kickoff paragraph, this issue only>

**Sequenced instead** (passed the contract gate, failed the concurrency bar):
- `<id>` — <the concrete collision: the file it shares with track M, the
  dependency edge, or the unmerged base it stacks on>

**Planning only** (outside N, no implementation or PR):
- `<id>` — PLAN_ONLY — <manifest sha256, unmet build condition/source>
  <plan-only kickoff using /dispatch-implementation --plan-only; stop at plan>

**Already active:** <issue, project, milestone, branch/PR, resume or review action>

**Accepted overlaps** (omit when `--accept-overlap` is absent):
- `<selected engineering track id>` — PR #<number> — <title> — @<author>: <exact overlapping files; implementation rebase policy> (or `none` / `unverified`)
- PR #<number> — <title> — @<author>: <sequenced/already-active candidate ids and exact overlapping files, even if also selected elsewhere>
- PR #<number> — <title> — @<author>: unused — no gated-candidate overlap, all scopes verified (or unused status unverified — <unknown scope ids>)

**Integration order:** <which track's PR should land first, and why; "independent,
any order" is a valid answer>

**Not these, and why:**
- `<id>` — <six-word reason>

**Board vs contract:** <as in default mode>
```

`Sequenced instead` is what makes the batch checkable. A reader has to be able to
take a rejected candidate, look at the named file or edge, and disagree. "Possible
overlap" names nothing inspectable and is not a reason.

`Integration order` is **not** a place to park a dependency. If one track adds a
fixture, a schema, or a seam another consumes, the second track cannot be
implemented from the default branch alone — that is criterion 2 and criterion 3
failing, and the pair belongs in `Sequenced instead`. Recording it as a merge
order instead produces exactly the branch this mode exists to prevent: one that
fails on its own, or has to stack on the other's PR after the fact.

Reserve `Integration order` for preferences that create **no implementation
dependency** — one track is time-boxed to a date and should
merge first, or the reviewer wants the smaller diff landed first to keep review
bandwidth for the larger one. Shared-file warnings retain the rebase and changed-head review obligations.

Shared files may need an integration order and a rebase. If either track needs
unmerged code from the other to satisfy its own gates, that is a dependency and
must constrain selection. Explain the difference with cited evidence.

## Rules

- **Default mode: one recommendation, up to three ranked.** The #1 is the
  decision; 2 and 3 exist so the reader can see what it beat. Never present three
  as a menu. If two are genuinely tied, pick the smaller one and say it was a coin
  flip.
- **Parallel mode: up to N tracks, every pair assessed for real dependencies and incompatibility, and the
  *largest* such set — not the first one a priority-ordered pass happens to
  find.** Fewer than N is a result, not a failure — never pad the batch to reach
  the number asked for.
- **Independence is pairwise across the whole batch**, not each track against
  track 1.
- **Parallel mode is still read-only.** It names branches and worktrees; it
  creates neither, and runs no git command that writes.
- **One kickoff paragraph per issue.** Always hand off #1. Hand off a runner-up
  only when it is proven safe to run concurrently, and never combine issue
  kickoffs into one paragraph.
- **Do not duplicate active work.** A live branch or PR gets a resume/review
  instruction, not another agent session.
- **Every milestone-dependent field is derived.** Gate name, gate date, days
  remaining, and contract section all follow each issue's resolved milestone.
- **Project filters form one union; authorization stays per issue.** Resolve IDs,
  verify membership, and check every pair across all projects and active work.
- **Indexed graph conditions supplement the contract.** Check event evidence,
  preserve human gates and distinguish plan-only from implementation readiness.
- **Fail closed on incomplete tracker state.** Name the missing input rather than
  ranking on a subset.
- **Never invent a ticket.** If the right next step has no tracker issue, say
  exactly that and propose the title — do not create it. This skill is read-only.
- **Never quote milestone progress as completion.** See trap 2.
- **A contract IN line with no tracker issue is a finding**, not a gap to fill
  silently. The contract is ratified; the board is not.
- **Do not write status updates, close issues, or reassign anything.** Read-only.
