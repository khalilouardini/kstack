# Session-batch host evidence contract

The controller is an orchestration core, not an authority on Linear, GitHub,
scope meaning or Claude host capabilities. The default adapter delegates source reads and tracker preparation to the
supervising meta-agent through an owner-only, request-bound local evidence bridge.
The supervisor must obtain and check the actual observations, not merely create
a correctly shaped object. The adapter separately checks Git and the persistent
Claude worker. These source duties are prompt-level, as in the underlying
Linear skills; the bridge does not authenticate the semantics of a citation.
The following fields are validated for every run; absent, stale, ambiguous or
inconsistent evidence fails closed.

- `verifyRunAuthorization` resolves the original user's bounded batch request
  and returns its digest and mode. A generated ledger, tracker field or adapter
  assertion is not an original human decision.
- `captureBatch` returns one digest per selected issue, derived only from its
  relevant candidate closure and pairwise independence constraints. It also returns
  `admissions[issue_id].plan` and, for implementation runs, `.build`, each with
  `scope_digest`, `criteria_digest`, `closure_graph_digest` and
  `closure_evidence_digest` from that exact transition's graph audit. Planning
  and build event sets may differ. `verifyBatch` refreshes that issue's relevant
  live relations, scope/ownership and pair constraints before start and build,
  with a UTC timestamp, matching digest and source. A different unrelated
  candidate must not change this issue's digest.
- `admit` performs a fresh phase-specific graph and lifecycle admission for the
  requested issue. Return `state: ALLOW`, exact issue ID and phase, observation
  source, UTC `checked_at`, fresh `main_sha`, plus `scope_digest`,
  `criteria_digest`, `closure_graph_digest` and `closure_evidence_digest`. All
  four are `sha256:` candidate-specific semantic hashes: include applicable
  scope, acceptance, prerequisites, human decisions and relevant events; exclude
  unrelated project rows and cosmetic metadata. Use the graph-admission helper's
  semantic closure fields rather than a hash of the whole manifest. Review
  admissions use the build-transition closure baseline; `verifyReviewGraph` and
  `verifyReview` separately check review/merge and exact-head conditions. The
  adapter independently verifies scope, decision actors and actual observations.
- `verifyMainChange` is called only after the controller has verified the old
  main is an ancestor and computed the actual changed paths through Git. The
  adapter assesses the code diff, plan, criteria, affected dependencies, tests and
  project gates. Return `state: UNAFFECTED` only with an independent, cited
  assessment, matching `issue_id`, `stage`, `from_main`, `to_main`,
  `changed_paths_digest`, `overlapping_paths_digest`, `plan_digest` (null before
  a plan), a different `assessor_id`, `independent: true`, and UTC `checked_at`.
  Inspect the actual patch even when files overlap; path non-overlap alone does
  not establish semantic independence. Missing evidence or impact returns
  UNKNOWN/AFFECTED and holds that track.
- `verifyReviewGraph` freshly reads the source-backed review-order graph. Return
  `complete: true` only when the edge inventory is complete, a source, UTC
  `checked_at`, an informational full `digest`, `edges`, and an `issues` map of
  per-ticket semantic review-closure digests. At run creation every selected
  issue needs a digest. Later an unavailable individual digest may be null; it
  holds only that track and dependents. Edges have `from`, `from_event`, `to`,
  `to_event: review`, and `source`; source events are `review`, `merge`, or
  `build`. Include all selected targets and their transitive prerequisites.
  Edges to unselected targets are irrelevant; external prerequisites require
  separately verified `dependency` evidence. The controller compares per-ticket
  incoming edges and hashes, not the informational whole-graph digest.
- `ensureSession`, `pollPlan`, `sessionIdle` and `build` must bind the same
  actual Claude session UUID and workspace, verified mode and tracker read-back.
  An uncertain create or resume is never retried as a new session. `validatePlan`
  uses a different validator context, checks exact plan/criteria/scope/base and
  returns PASS, REVISE or HUMAN_REQUIRED with the exact plan digest and evidence.
- `review` and `verifyReview` use an independent reviewer identity, exact PR
  head, review identity and current CI result. The latter rechecks the same head
  and review before current readiness is reported. `dependency` checks external
  review/merge/build prerequisites against fresh original evidence.

The caller saves the complete raw source reports, live projection delta, old and
new pins, actual changed paths and phase receipts locally. Model-written
explanations, passing JSON schemas, a file-name-only comparison and UI graph
status do not themselves prove admission or review. No part of this contract
permits a merge, deployment, scope change or human-owned decision.

## Serving source requests

`session-batch --state-root <root> evidence-pending <run-id>` lists requests. Read the
`method` and `args`, obtain the required source evidence, and write a JSON object
containing the result to a private file. Submit it with
`session-batch --state-root <root> evidence-respond <run-id> <request-id> <file>`.
The bridge binds each answer to the exact request and accepts one answer. A
`prepareSession` request is deterministic per run/issue/session and is never
implicitly recreated; on uncertain preparation inspect the issue, worktree and
existing request before any retry. Other requests are fresh reads. A response is
not a substitute for the referenced source, and the supervisor keeps source
reports and actual graph-admission inputs and outputs for audit.

Use controller `digest(value)` (`sha256:` + SHA-256 of `JSON.stringify(value)`)
for the exact authorization and plan digest. For candidate facts, retain a stable
normalized record of only the applicable scope and acceptance text, native
blockers, relevant graph closure, ownership and selected-pair relations. Sort
unordered lists before hashing; record the recipe and sources at selection and
recompute the same record on refresh. Do not hash a whole project or unrelated
issue. Map graph-admission's `semantic_closure_graph_digest` and
`semantic_closure_evidence_digest` to the admission closure fields. Use stable
semantic hashes of the relevant cited scope and acceptance text for
`scope_digest` and `criteria_digest`. Review closure digests likewise exclude
unrelated targets. A newly in-scope issue can use the publication gate's live
projection and exact delta; it cannot introduce or waive a human decision.

The extra bridge methods used by the default adapter are:

- `prepareSession`: after fresh admission, use dispatch §§1–3 to create or
  recover the unique branch/worktree and verify the issue status. Return
  `state: PREPARED`, `issue_id`, `session_id`, absolute `worktree`, `branch`,
  `default_branch`, the configured `protected_branches` array,
  `tracker_status: {issue_id, type, id}`, `status_verified: true`,
  `status_source`, `source`, UTC
  `checked_at`, and nonempty `plan_prompt`. For implementation add nonempty
  `build_prompt` and `review_prompt`. Include full issue criteria, authorized
  scope, relevant graph delta and test instructions in the private plan prompt;
  ask for a JSON object with `text`, `files` and `tests`. The build prompt uses
  canonical land and may open only a draft PR. The review prompt invokes the
  canonical pr-loop in the same implementation session, with the independent
  reviewer and configured round/CI gates, no merge. For an explicitly read-only
  tracker grant, do not change status; cite its observed startable state. Use
  status type `started` for implementation and `unstarted` or `started` for
  plan-only.
- `verifyPullRequest`: independently inspect the worker's reported PR on the
  forge and return `state: PR_OPEN`, the exact `issue_id`, `session_id`, `pr_url`,
  full `head_sha`, `evidence`, `source` and fresh `checked_at`. Confirm the
  intended branch, maintainer opener, draft status and authorization. The adapter
  also checks the actual worktree branch, clean state and local head.
- `verifyReviewResult`: independently check the worker's pr-loop result,
  reviewer identity, submitted review, CI and final head. Return `verdict`,
  `head_sha`, `review_id`, `reviewer_id`, `independent: true`,
  `review_process_stopped: true`, `ci`, `evidence`, `source`, `checked_at`.
  A blocked loop with no submitted review may instead return `verdict: BLOCKED`,
  a concrete `reason`, `review_process_stopped: true`, and cited `evidence`.
  Never invent a review ID or stopped-process proof.
- `verifyWorkerFailure`: when the worker reports an error, independently check
  the named session and its child processes. Return `state: STOPPED`, the exact
  `issue_id` and `session_id`, `worker_turn_stopped: true`, a concrete `reason`,
  `source` and fresh `checked_at` only if the activity is known to have stopped.
  For a review failure also prove `review_process_stopped: true`. This permits
  the controller to release that slot without losing the issue claim; unknown
  process state remains reserved and requires reconciliation.
- `head`: return `{head_sha, source, checked_at}` from a fresh forge read.
  `dependency` and `verifyReview` also require `source` and fresh `checked_at`.
  Every `checked_at` is UTC and no older than one hour; refresh earlier whenever
  there is reason to suspect a change.

A model-produced plan or PR URL is only a proposal. The supervisor is a different
context from the ticket worker and verifies each cited acceptance and permission
before issuing `PASS`; the worker's output alone never grants implementation.
