# Mandatory /next dispatch proposal

Every `/next` result that hands off new engineering work must explicitly propose
dispatch: one separate child session per issue, nested under the main `/next`
session, with fresh context, the latest available Claude Opus (minimum Opus 5.5),
and effort **High** (`high`). This applies to default mode, `--parallel 1`, safe
runner-up kickoffs, every parallel track, single-track collapse, and PLAN_ONLY
items outside the implementation batch. It is mandatory even without a dispatch
request. A paste-ready task paragraph alone does not satisfy it.

## Proposal and receiving session

For each engineering kickoff, include this self-contained dispatch envelope in
its paragraph, resolving values when the host exposes them:

> Proposed dispatch for <issue>: a separate Claude child session under this
> `/next` coordinator (<parent session ID/link>), fresh context (no inherited
> conversation), latest available Opus >=5.5 (<resolved model ID, or resolution
> pending>), effort High (`high`). In that child run
> `/dispatch-implementation <issue> --from-next <parent-session-id> --executor claude --model <resolved-opus-id> --effort high`
> <plus `--plan-only` when applicable and this invocation's explicit graph flags
> and pins>. <Then the issue's bounded kickoff.>

The parent relationship must be host session metadata, not just a title or text
link. A conversation fork, inherited transcript, same-session execution, pooled
multi-issue session, or transient workflow node is not this child session. Give
the child only the issue-specific outcome, acceptance criteria, scope, evidence
sources/pins, prerequisites, overlap risks, workspace instruction and checkpoints;
it re-reads current source documents. Do not copy the coordinator's conversation.

Resolve the latest supported Opus from the destination host's available models;
do not guess a newer model ID or treat a moving alias as proof of its resolved
version. Opus 5.5 is the minimum. Set `high` explicitly even if the host defaults
to another effort. Risk/size heuristics, repository defaults, and generic
dispatcher model selection cannot override these settings for `/next` handoffs.

`/next` proposes this dispatch; selection alone grants no launch, workspace,
tracker or implementation authorization. When the user authorizes dispatch,
use the host's documented session launcher, create the fresh child first, and
run the named dispatcher inside it. Verify and report actual child ID/link,
parent ID, context inheritance disabled, resolved model and `high` before the
dispatcher makes workspace/status writes. An explicit later user override takes
precedence; identify the changed setting rather than silently inferring one.

For `--plan-only`, "current agent" in the dispatcher means this verified ticket
child, never the `/next` coordinator. Ordinary dispatch also plans in that same
child and resumes it only after approval of its exact plan; do not introduce a
grandchild with different settings. Keep all existing scope, readiness, human
plan approval, PR review, no-merge and no-completion boundaries.

If the host cannot create nested fresh sessions, select/verify Opus >=5.5, set
High, or read back the required settings, retain the proposal and mark
**Dispatch blocked: <missing capability/evidence>**. Unresolved parent/model IDs
are pending fields, never invented IDs or launch-ready commands. Do not fall
back to Codex, another Claude family, inherited context, or local execution.
This is prompt-level enforcement; no persistent session launcher is implemented
by this document or proved by a workflow agent's name.

## Completion check

Before returning, require exactly one dispatch envelope occurrence per new
engineering kickoff issue ID; reject duplicate IDs even when they name the same
child. Then compare the kickoff and proposal ID sets for exact equality, and
require one distinct child per issue. Check every envelope for parent, fresh
context, latest Opus >=5.5,
explicit High, and the named dispatcher with `--from-next`, `--model` and
`--effort high`. Include PLAN_ONLY IDs; exclude sequenced and merely ranked
issues without kickoffs. Fix missing envelopes before answering. The output's
usual length target never permits dropping them.

Human-only actions keep their human kickoff. Active work gets its existing
session/branch/PR resume instruction; never create a duplicate to satisfy this
rule. If there is no new engineering kickoff, explicitly report
`Dispatch: none — <human action / resume existing work / no eligible work>`.
