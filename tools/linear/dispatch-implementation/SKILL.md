---
name: dispatch-implementation
version: 0.1.0
description: Start one approved Linear issue in an isolated branch and worktree, update its tracker status only after that evidence exists, and route a plan-only executor before implementation. Use when asked to "start this ticket", "tackle ISSUE-123", "dispatch this issue", or "/dispatch-implementation ISSUE-123". Not for choosing the next issue or certifying completion. (kstack)
---

# dispatch-implementation — one issue, one workspace, one truthful start

## When to invoke

An existing, approved Linear issue is ready to be picked up by Claude or Codex.
Invoke as:

```text
/dispatch-implementation <ISSUE-ID> [--executor claude|codex] [--model <name>]
```

The exact issue identifier is required. Invoking this skill is explicit authorization
to create its isolated branch/worktree and perform the bounded start-status write
defined below. It is not authorization to merge, mark the issue complete, change
scope, or create another issue.

Not for deciding what to work on next (`next`), admitting a new feature (`spec` and
`linear-feature-intake`), repairing historical tracker drift (`linear-steward`), or
starting work that has no approved issue.

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

Before any git write:

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
