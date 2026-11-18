# Scope, architecture and document alignment

Read the project's own decision and documentation conventions. Filenames and
section numbers are project-specific; locate the canonical product/MVP scope,
ADRs, release rules and roadmap source instead of creating competing authorities.

## Authority before admission

A request to plan or create tracker records does not silently change approved
product boundaries. Cite an existing verdict or an authorized owner's exact
decision, date and affected scope. Honor recorded owner exceptions; do not
re-run a product gate already superseded by an applicable owner decision, and do
not relabel that exception as a product-manager verdict.

When new scope is undecided, prepare the scope delta and the decision needed.
Use `/spec` for the unresolved product decision where the project's workflow
requires it; no technical fan-out for rejected scope. Do not force a separate
gate for every implementation child of an already admitted outcome. Future work
gets only the decomposition the owner/contract authorizes, without implying an
active milestone or implementation approval. Explicitly authorized proposal
records can remain in the contract's non-started state.

## Required document impact table

For each affected document, record its current source/revision, exact sections,
proposed change, authority, adoption status and verification. An unchanged document
gets a reason; creating an ADR for every ticket is unnecessary.

- **Product/MVP scope:** update purpose and product contribution, included and
  excluded outcomes, milestone boundaries, acceptance/eval gates, dependencies,
  operating/cost constraints and release/signoff rules when the roadmap changes
  them. Reconcile summary, active-milestone rules and current gate population.
  Preserve unrelated decisions and prior delivered contracts. Do not amend only
  a decision log while leaving contradictory normative text in force.
- **ADR:** amend or add one when the roadmap changes a durable architectural
  decision: identity/schema/versioning, interfaces, persistence, source of truth,
  deployment boundary, security/trust model or significant tradeoff. State the
  old decision, new choice, alternatives, rationale, consequences, migration,
  rollback and compatibility, verification and affected consumers. Use the repo's numbering,
  status and supersession conventions. Accepted ADRs can contain deferred/replaced
  individual decisions; read those boundaries. Merged code is not ADR acceptance.
- **Other docs:** update affected runbooks, data/API contracts, release checklist,
  evaluation protocol and project overviews. Link the canonical rule rather than
  copying an independently editable version. Create only documents the change needs.

Make authorized edits directly within the requested scope. Otherwise prepare
proposed amendments or diffs, preserve accepted text, and record whose approval
is missing. If source files are unavailable, deliver exact proposed edits and a
documentation ticket with evals; do not claim the canonical docs were updated.
Do not silently set `scope_doc` or replace the workspace contract. Adopt a newly
created scope file in config only when authorized and report that change.

## Changes that affect gates

Membership moves, deferrals and scope transfers need an explicit before/after
map: canonical issue, old/new project or milestone, affected outcome, eval,
dependency and release gate. Reconcile both sides, remove duplicate promises,
and preserve history. Do not silently move existing work when only creation was
requested. A milestone at 100% after its unfinished tickets moved away proves
no release outcome.

Scope/ADR/threshold decisions that must precede behavior changes become explicit
prerequisites to the affected build/merge/release event. Distinguish preparing a
decision from accepting it. Keep draft or disputed boundaries visible; a document
ticket marked Done cannot replace a required positive owner decision.
