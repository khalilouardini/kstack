# Session-batch host evidence contract

The controller is an orchestration core, not an authority on Linear, GitHub,
scope meaning or Claude host capabilities. Only a trusted adapter that performs
and verifies the actual observations can permit transitions. The bundled Claude
registry adapter is read-only and refuses creation. It does not implement this
contract. The following fields are validated for every run; absent, stale,
ambiguous or inconsistent evidence fails closed.

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
