---
name: next
version: 0.2.0
description: Read Linear — open issues, cycles, projects, milestones, deadlines, blockers — and decide what to work on next, gated against the consuming repo's scope doc. Default mode makes exactly ONE recommendation with a ranked top 3; --parallel [N] instead returns up to N mutually-independent issues as a batch, each with its own paste-ready kickoff — and its own branch and worktree when the track is engineering work. Read-only; never creates, closes, or reassigns an issue, and never invents one. Use when asked to "what should I work on next", "what's next", "pick my next ticket", "what can I run in parallel", or "/next [<milestone-id>|any] [--parallel [N]]". (kstack)
---

# next — what to pick up now

## When to invoke

Someone needs to decide what starts now, and the tracker holds more open work
than fits in one head. Invoke as `/next [<milestone-id>|any] [--parallel [N]]`.
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
set of things that can start *at once* without colliding." Same configuration,
same contract gate, same blocker analysis; the output is a batch of up to N issues
proven independent of each other instead of a single decision. Default N = 3. See
**Parallel mode** below.

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
| Source | GitHub — PRs, branches, worktrees | Linear — issues, cycles, projects |
| Direction | Backward. What did we leave unfinished? | Forward. What should start now? |
| Output | A scored roster of everything | One recommendation plus two runners-up — or, under `--parallel`, an N-track batch |

If the answer is "finish something already in flight," say so and hand off to
`triage` — but say *which* thing, not "check your open PRs."

## Reaching Linear

Two paths. Use whichever the harness offers; the reasoning below is identical.

**Path A — MCP tools** (a host with the Linear connector). Use the `list_issues`,
`list_cycles`, `list_projects`, `list_milestones`, `get_issue` tools. Prefer these
when available.

**Path B — GraphQL** (any harness without the connector). Needs `LINEAR_API_KEY`
in the environment. Prefer the access contract in the file named by
`workspace_contract` when it is present.

**The query must collect every field the ranking below consumes.** An earlier
version fetched only active-cycle issues with priority and state, while steps 3–5
rank on project membership, milestone deadlines, and blocking relations. The
result was silent: a release gate sitting *outside* the active cycle, or an issue
blocked by another ticket, lost to an apparently-unblocked cycle item and nothing
in the output revealed the omission.

Read **open issues across the team**, not just the active cycle, and paginate:

```bash
curl -s https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" -H "Content-Type: application/json" \
  -d '{"query":"query($after:String){ issues(first:100, after:$after, filter:{state:{type:{nin:[\"completed\",\"canceled\"]}}}) { pageInfo { hasNextPage endCursor } nodes { identifier title priority estimate dueDate state { name type } assignee { name } cycle { name endsAt isActive } project { id name } projectMilestone { name targetDate } labels { nodes { name } } relations { nodes { type relatedIssue { identifier state { type } } } } inverseRelations { nodes { type issue { identifier state { type } } } } } } }","variables":{"after":null}}'
```

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

   **Resolve the target milestone** from the argument — a milestone id the scope
   doc defines, or `any` (whichever milestone the winning candidate serves). With
   no argument, the target is the **active** milestone: the earliest gate the
   decision log does not record as released. **A passed date does not advance it**
   — an unreleased gate whose date has gone is *overdue* and still active. Compute
   days to *that* gate; if it is negative, write `overdue by N days`, never "soon"
   or "coming up".

   A gate whose entry carries no date, or whose IN list the document marks as
   under redefinition or TBD, is reported as such rather than given an invented
   one.

2. **Pull tracker state — all of it.** Every open issue on the team (not only the
   active cycle), paginated to exhaustion, each carrying priority, estimate,
   state, assignee, due date, cycle, **project, project milestone and its target
   date, and both directions of its blocking relations**. Verify the filter
   actually applied (trap 1). If any of those inputs is missing, fail closed per
   "Reaching Linear" rather than ranking on what arrived.

   **Under `--parallel`, this field set is not sufficient** — criterion 4 of the
   concurrency bar needs `description`, `parent`, `children`, and branch/PR
   evidence per candidate, which the base query above does not request. Fetch them
   before computing a batch, and fail closed if they are unavailable. Default mode
   does not need them, which is why they are not in the base query.
3. **Gate each candidate against the contract.** An issue that does not trace to a
   line in the target milestone's IN list is not that milestone's next step
   regardless of its tracker priority. **When tracker priority and contract scope
   disagree, say so loudly** — that disagreement is usually the most useful thing
   on the screen, because it means the board has drifted from what was ratified.
4. **Check blockers before recommending.** If the strongest candidate is blocked,
   recommend *the unblocking work* instead and name what it releases. Two kinds:

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
5. **Prefer work that unblocks other work**, then work on the critical path, then
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
batch. Above **5**, clamp to 5 and say the clamp applied: more concurrent
worktrees than that cannot be supervised by one person, and the batch stops
fitting the one-screen ceiling the output section is built around.

### Resolving `any` for a batch

`any` is defined in step 1 as "whichever milestone the winning candidate serves,"
and parallel mode has no winning candidate — so that definition does not survive
the composition `/next any --parallel 3` unaided. Left undefined it is circular:
the target milestone must be known to gate candidates, but it would depend on a
candidate chosen after gating.

**A parallel batch is always single-milestone.** Under `any`, resolve the
milestone *before* selecting tracks: gate every candidate against each milestone's
IN list, rank the gated candidates by step 5's preference, and take the milestone
the top-ranked one serves. The batch is then drawn from that milestone alone, and
the output's single `Gate` and `Contract` line describes it truthfully. **Name the
resolved milestone and say it was resolved from `any`**, so the reader can see a
choice was made on their behalf.

This is the one place the top-ranked candidate does seed something, and it is not
the batch — it fixes the *scope*, after which cardinality is maximized within that
scope exactly as below. A batch spanning two milestones is never emitted: the
output cannot describe it in one gate line, and "these five things are next" across
two different gates is not a decision anyone can act on.

**Configuration and steps 1–4 of the Procedure are unchanged.** Read
`.agents/stack.yml`, read the file named by `scope_doc` in full, pull tracker state
to exhaustion, gate every candidate against the target milestone's IN list, verify
both kinds of blocker. Parallel mode changes what happens *after* the gating, never
the gating itself, and the hard read-only rule above covers it unchanged.

### Selecting the tracks

From the gated, unblocked candidates, select the **largest mutually-independent
set of size ≤ N** — maximum cardinality, not merely a set nothing can be added
to. Step 5's preference (work that unblocks other work first, then the critical
path, then the rest) breaks ties **among the batches that are already largest**;
it does not choose the first track and let the rest fall out around it.

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
six. Checking each track only against track 1 is the failure this mode is most
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
2. **No dependency edge between them**, in either direction — again blocking type
   only, by the same reasoning.
3. **No shared not-yet-merged foundation.** Two issues stacked on the same open PR
   are not independent: a stacked PR's `MERGED` state proves nothing about the
   default branch, because the base can merge out from under it and strand the
   code off it.
4. **Scopes isolatable in separate worktrees**, with no overlap in the files each
   will touch — and **this one has to be proven from evidence you actually
   fetched**, which the base query does not provide. An unstarted issue has no
   diff to inspect, so the field set in step 2 must be extended before a batch can
   be computed:

   - **`description`** — the acceptance criteria naming the area of the codebase.
   - **`parent { identifier }` and `children { nodes { identifier } }`** — see the
     container rule below.
   - **`branchName`, and any attached branch or PR** — for an issue already in
     flight, the real diff is the best scope evidence available.

   **Fail closed.** If the file scope of either track is not concrete after that,
   the pair is *not proven independent* — send it to `Sequenced instead` naming
   "scope not established", and never assume isolation from silence. Assuming
   independence is the direction that produces the merge collision; assuming
   dependence only costs a track.

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

- **Each *engineering* track names its own branch and its own worktree.** Several
  agent sessions in one working directory is the concurrency hazard this mode
  exists to manage, not to create. A fresh worktree may need the repo's install
  step re-run before its checks pass.
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
  only if it traces to a line in the target milestone's IN list. That it has no
  tracker issue is not a defect to paper over — it is the finding the Rules section
  already requires ("a contract IN line with no tracker issue is a finding"), so
  surface it. It has no identifier and no estimate, and **inventing either would
  be fabricating tracker data this skill is forbidden to create**, so its row takes
  the untracked shape in the output template below: `(no issue)`, a proposed title,
  no branch, no worktree. Propose the title; never create the ticket.
- **An issue already owned by a live branch or PR is not a new track.** Mark it
  `already active` and hand off a resume instruction instead.
- Each **engineering** kickoff still ends with: open a PR, do not merge, do not
  mark the issue complete.

## Agent handoff

After ranking, write a paste-ready kickoff for the recommended work — one
paragraph a person can paste straight into a fresh coding-agent session (Claude
Code, Codex, whichever host they drive). This is an execution handoff, not a
second recommendation.

- Write **one short paragraph for the #1 issue**. Use its tracker outcome and
  acceptance criteria, the contract boundary, known prerequisites, the relevant
  validation, and the instruction to open a PR without merging or marking the
  issue complete. Do not invent implementation scope that the tracker does not
  contain.
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

Short. The whole point is that it fits in one screen.

Every milestone-dependent field below is **derived from the resolved milestone**,
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

**Gate:** <MILESTONE> (<gate date>, N days) · **Contract:** <section, as the doc numbers it>
**Size:** <tracker estimate, or "unestimated — treat as unknown">
**Blocked by:** <nothing / what, and whether that is also worth doing first>

**First action:** <one concrete thing doable in under 30 minutes>

**Kickoff:** <one short, paste-ready paragraph for #1; use "Execution kickoff"
instead when #1 is non-engineering>

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
Same one-screen ceiling; every milestone-derived field works identically.

```
## Parallel batch: <k> tracks (<N> requested, <k> passed the bar)

**Gate:** <MILESTONE> (<gate date>, N days) · **Contract:** <section, as the doc numbers it>

**Track 1 — `<id>` <title>**
<size> · <contract section> · branch `<name>`, own worktree
<one short paste-ready kickoff paragraph, this issue only>

**Track 2 — `(no issue)` <one-line action>**          ← untracked human action
untracked human action · <contract section> · no branch, no worktree
Proposed issue title: "<title>" — not created.
Independent because: <the one sentence from criterion 2 above>
<one short execution kickoff paragraph for the person>

**Track 3 — `<id>` <title>**
<size> · <contract section> · branch `<name>`, own worktree
<one short paste-ready kickoff paragraph, this issue only>

**Sequenced instead** (passed the contract gate, failed the concurrency bar):
- `<id>` — <the concrete collision: the file it shares with track M, the
  dependency edge, or the unmerged base it stacks on>

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
dependency and no shared file** — one track is time-boxed to a date and should
merge first, or the reviewer wants the smaller diff landed first to keep review
bandwidth for the larger one. Both tracks still touch disjoint files; the
preference is about merge sequence, not about code.

A shared file is not a preference either. Criterion 4 already sends any pair with
overlapping file scopes to `Sequenced instead`, so an `Integration order` entry
naming two tracks that touch the same file contradicts the bar directly above it
and admits precisely the pair the bar rejected. If either track would fail its own
gates without the other merged, or the two touch the same file, it is not an
integration-order preference.

## Rules

- **Default mode: one recommendation, up to three ranked.** The #1 is the
  decision; 2 and 3 exist so the reader can see what it beat. Never present three
  as a menu. If two are genuinely tied, pick the smaller one and say it was a coin
  flip.
- **Parallel mode: up to N tracks, every pair proven independent, and the
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
  remaining, and contract section all follow the resolved milestone.
- **Fail closed on incomplete tracker state.** Name the missing input rather than
  ranking on a subset.
- **Never invent a ticket.** If the right next step has no tracker issue, say
  exactly that and propose the title — do not create it. This skill is read-only.
- **Never quote milestone progress as completion.** See trap 2.
- **A contract IN line with no tracker issue is a finding**, not a gap to fill
  silently. The contract is ratified; the board is not.
- **Do not write status updates, close issues, or reassign anything.** Read-only.
