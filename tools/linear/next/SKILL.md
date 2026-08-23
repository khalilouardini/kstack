---
name: next
version: 0.1.0
description: Read Linear — open issues, cycles, projects, milestones, deadlines, blockers — and make exactly ONE recommendation for what to work on next, with a ranked top 3 and paste-ready kickoff paragraphs, gated against the consuming repo's scope doc. Read-only; never creates, closes, or reassigns an issue, and never invents one. Use when asked to "what should I work on next", "what's next", "pick my next ticket", or "/next [<milestone-id>|any]". (kstack)
---

# next — what to pick up now

## When to invoke

Someone needs to decide what starts now, and the tracker holds more open work
than fits in one head. Invoke as `/next [<milestone-id>|any]`. Forward-looking;
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
| Output | A scored roster of everything | One recommendation, plus two runners-up |

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
- For ranks 2 and 3, decide whether each can **actually run in parallel** with #1.
  Require resolved blockers, no dependency edge between the tasks, no shared
  not-yet-merged foundation, and scopes that can be isolated in separate
  worktrees. Check obvious repository/file overlap when it affects merge order.
  If concurrency is uncertain, sequence the work and do not emit a parallel
  kickoff.
- For every runner-up proven safe to run concurrently, write **its own separate
  short paragraph** under `Parallel kickoffs`. Never combine two issues into one
  paragraph. Name any required rebase or final integration order.
- Do not emit a new-session kickoff for a runner-up already owned by a live branch
  or PR; say `already active` in its ranking line instead.

Kickoff paragraphs do not turn runners-up into a menu. The #1 issue remains the
decision; parallel paragraphs only explain how spare execution capacity can be
used without delaying or conflicting with it.

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

## Rules

- **One recommendation, up to three ranked.** The #1 is the decision; 2 and 3
  exist so the reader can see what it beat. Never present three as a menu. If two
  are genuinely tied, pick the smaller one and say it was a coin flip.
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
