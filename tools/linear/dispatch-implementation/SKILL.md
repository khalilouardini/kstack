---
name: dispatch-implementation
version: 0.8.0
description: Start one approved Linear issue in an isolated branch and worktree, update its tracker status only after that evidence exists, and route a plan-only executor before implementation. Use when asked to "start this ticket", "tackle ISSUE-123", "dispatch this issue", or "/dispatch-implementation ISSUE-123". Not for choosing the next issue or certifying completion. (kstack)
---

# dispatch-implementation — one issue, one workspace, one truthful start

## When to invoke

An existing, approved Linear issue is ready to be picked up by Claude or Codex.
Invoke as:

```text
/dispatch-implementation <ISSUE-ID> [--executor claude|codex] [--model <name>] [--plan-only] [--accept-graph-update <PR#>]... [--local-graph]
```

The exact issue identifier is required. Invoking this skill is explicit authorization
to create its isolated branch/worktree and perform the bounded start-status write
defined below. It is not authorization to merge, mark the issue complete, change
scope, or create another issue.

Not for deciding what to work on next (`next`), admitting a new feature (`spec` and
`linear-feature-intake`), repairing historical tracker drift (`linear-steward`), or
starting work that has no approved issue.


Accept `--local-graph` under the shared publication gate's **Explicit approved local graph**
procedure. It replaces graph publication with fresh local indexed validation and
candidate/closure admission; scope, native blockers, evidence, human decisions
and plan/merge approvals remain mandatory. Forward this invocation's explicit
flag and canonical owner/index/manifest pins through composed execution skills.
Recheck the owner files before writes; never substitute an older dispatch-worktree
copy. Changed pins require a new plan. Reject repeated local flags and mixed
local/PR graph sources. No graph publication or extra tracker writes are granted.

## Configuration and required access

Read `.agents/stack.yml` from the consuming repository, then read the file named by
`workspace_contract` in full.

- Missing, null, or unreadable `workspace_contract` → **refuse**, naming the key.
- The contract must unambiguously identify the unstarted status for approved active
  work and the started status meaning "a branch or worktree exists". If it does not,
  stop and name the ambiguity; never guess a status name.
- Linear read/write access and local git worktree access are required. If either is
  unavailable, refuse before creating anything.

Use the contract's own mutation and evidence rules. This skill adds one narrow
authorization boundary: an invocation carrying an exact issue identifier authorizes
the single `unstarted → started` write after its branch/worktree exists. The ledger
and read-back remain mandatory; a second approval prompt for that one row is not.

## 1. Resolve the issue and prove it is startable

Read `tools/linear/next/references/selection.md` from the physical stack root.
Assess the named issue with the same plan/build checks as next and wave and run
the shared helper on that single-candidate snapshot (`requested: 1`, no pairs).
Do not reinterpret stage eligibility merely because dispatch names one issue.
Plan eligibility permits only planning; build still needs an approved exact plan,
fresh build eligibility and existing lifecycle guards. Resume verified active
work instead of treating its ownership exclusion as a fresh-start failure.
Reconcile newer named scope decisions with older exclusions before requesting
repeat approval. File overlap alone warns; real dependencies and unmerged
foundations still constrain implementation. Retain assessment and overlap evidence.


Before any git or tracker write, follow the canonical
`tools/linear/linear-roadmap/references/publication-gate.md` from the physical
stack root. Verify this issue and its relevant dependency closure on fresh main,
including resumed work and --plan-only. Unrelated missing tickets are coverage
warnings, not a dispatch refusal. A selected unmapped maintenance repair may use
the bounded local audit before any workspace/status write; retain its main SHA,
full live evidence and exact delta. UNKNOWN selected evidence or semantic changes
require reviewed publication. Accept repeatable --accept-graph-update only for
verified reviewed PRs under that contract. Carry audit paths/digests and explicit
flags to later build/land; each transition rechecks fresh evidence. A prior plan
or wave approval supplies no bypass or new scope authorization.

Then:

1. Fetch the exact issue with relations and its project/milestone fields.
2. List the team's issue statuses and resolve their ids. Judge lifecycle by status
   type plus the workspace contract's meaning, never by a remembered name.
3. Inspect `git worktree list --porcelain`, local branches, and any visible open PRs
   for the issue identifier or its tracker-provided branch name.
4. Check every blocking relation. A blocker is resolved only when the workspace
   contract's completion evidence is present; status text alone is insufficient when
   the contract says otherwise.

Then classify exactly one path:

| Observed state | Action |
|---|---|
| Active-milestone unstarted issue; no unresolved blocker; no existing branch/worktree | Start path below |
| Active-milestone unstarted issue; matching branch/worktree already exists | Reconcile its status to started, then resume that workspace |
| Started issue with matching branch/worktree or PR | Resume it; create nothing and do not rewrite the status |
| Started issue with no defensible implementation evidence | Stop and route to `linear-steward`; do not manufacture evidence |
| Backlog/future work | Stop; dispatch may not silently promote scope |
| Completed, canceled, or duplicate | Stop and report the terminal state |
| Unresolved blocker or ambiguous issue match | Stop and name the exact blocker or ambiguity |

One issue means one issue. Never create an executor-only tracking row, and never use
a parent/meta issue when an implementation child is the independently mergeable unit.

## 2. Create or recover the isolated workspace

### Prepared planning handoff

When the current wave caller supplies a version 2 prepared handoff, reuse its
immutable observations by exact revision/digest. This applies only to that
invocation and does not grant a later cache bypass. Keep all §1 gates:

1. Verify the source revision, canonical graph source/flags/pins and immutable
   scope/decision-source digests against the handoff. Read full relevant source
   sections when changed or unavailable; unchanged content can be reused from
   the full original artifact. A quote match alone does not prove applicability.
2. Fetch current candidate and relevant closure issue bodies/relations and
   original mutable decision sources. Verify unchanged acceptance, native
   blockers, project/milestone and stage-specific conditions. Re-run admission
   from these fresh facts before writes, even if main has not moved. Retain old
   and new observations. Changed/unknown relevant evidence returns STOPPED.
3. Fetch main/accepted heads and check owner graph pins; planning requires the
   caller's main/source pins before workspace/status writes. Recheck worktrees,
   branches, PR ownership and lifecycle status. Resume verified active work;
   never treat the handoff's earlier INACTIVE observation as current ownership.
4. Reuse the assessed candidate/closure, exact scope, warnings and known status
   vocabulary. Do not run /next, paginate the project, regenerate the graph or
   launch another preparation/executor agent. If the scoped audit is incomplete,
   return the precise missing input. Do not silently redo a broad collection.

These are focused fresh checks, not a freshness exemption. The original full
audit remains available by absolute locator and the node receives a clearly
marked candidate projection. Dispatch's workspace/status ledger and read-back
below are unchanged. Ordinary named dispatch still performs §1 in full.

Prefer the issue's tracker-provided branch name. Otherwise derive a readable branch
containing the issue identifier. Resolve the repository's default branch instead of
hardcoding one.

- If the branch is already attached to a worktree, reuse that exact worktree.
- If the branch exists but has no worktree, attach it to one; do not create a second
  branch for the issue.
- Otherwise create one branch and one sibling worktree from the resolved default
  branch.
- Refuse an occupied path, a branch claimed by unrelated work, or a dirty base whose
  state would leak into the new workspace.

After creation, read `git worktree list --porcelain` again and verify that the
expected branch and absolute worktree path are paired. The command returning zero is
not proof if the read-back disagrees.

## 3. Automatically mark the truthful start

Only after §2 proves the branch/worktree exists, print this one-row start ledger:

```text
| Issue | Field | From | To | Evidence | Reversible |
| <ID> | status | <unstarted> | <started> | branch <branch> in worktree <absolute-path> | yes |
```

Then, without a second approval prompt:

1. Resolve the target started-status id from Linear's status list and the workspace
   contract.
2. Update only the issue's status with the Linear issue-write tool.
3. Fetch the issue again and compare the returned status id/type to the target.
4. On mismatch, stop before launching an executor. Preserve the created branch and
   worktree, report that tracker state is stale, and make no further writes.

If the issue was already truthfully started, print an `Unchanged` row with the branch
or worktree evidence instead. If a matching branch/worktree existed while the issue
was unstarted, the same automatic ledger/write/read-back sequence applies.

This transition is **prompt-level orchestration**, not a hook: work started outside
this skill is not intercepted. The read-back is the proof that this invocation's
write landed; it is not a global guarantee about other sessions.

## 4. Route plan-only, then stop for approval

**Graph node / `--plan-only` mode (prompt-level):** run §1–3 unchanged,
including the isolated workspace and status ledger/write/read-back. In §4,
write the acceptance-cited plan in the current agent and return it; launch no
separate executor and grant no implementation permission. For `/wave`, use
PLAN from `tools/linear/wave/references/records.md`; refusals return STOPPED with
stop_reason and evidence rather than waiting. `/wave build --approve` supplies
the human approval for that exact wave/plan, resumes the same dispatch worktree
with the returned plan context, and records the approval ids in WAVE_REPORT.
All Refusals still apply. Ordinary invocation follows the executor route below.

Select the executor and model from explicit flags when supplied. Otherwise choose by
risk, ambiguity, relevant strengths, and expected horizon, and state the choice in
one sentence. Do not choose by task size alone.

Launch the executor in the verified worktree with a hard read-only/plan-only
boundary:

- Claude: plan permission mode in the isolated worktree.
- Codex: read-only sandbox with a plan-only output contract.

The plan must cite the issue's acceptance criteria and name the files, tests, and
risks it expects to touch. It may refine the technical approach; it may not reopen
the product verdict or rewrite acceptance criteria.

Return the plan and stop for user approval. Resume the same scoped executor with
write access only after approval. Do not create a replacement session whose context
can drift from the approved plan.

## 5. Lifecycle after the start

The implementation session owns code and tests, not tracker truth beyond evidence it
has actually produced.

- It opens a PR only as `identities.maintainer`, through `/land` or with that
  account's verified token bound via `GH_TOKEN` — never as the implementer or
  reviewer account, and never by relying on the active global `gh` account.
- If it opens a PR and the workspace contract defines a review status for that
  evidence, apply that transition with the same resolve → ledger → write → read-back
  discipline.
- Never mark the issue completed. Completion remains governed by the workspace
  contract and an independent review, evaluation, or steward reconciliation.
- Never merge automatically.

The completion handoff reports: issue id and URL, executor/model, branch, absolute
worktree path, current Linear status with read-back result, plan approval state, PR
if any, tests run, acceptance evidence, blockers, and the next human checkpoint.

## Refusals

- No exact existing issue → no dispatch.
- No unambiguous workspace status contract → no tracker write.
- No verified branch/worktree → no started status.
- Status write mismatch → no executor launch.
- Existing active workspace → resume, never duplicate.
- No plan approval → no implementation permissions.
- No independent completion evidence → never completed.
- Never create a second issue, rewrite scope, merge, delete, or archive.
