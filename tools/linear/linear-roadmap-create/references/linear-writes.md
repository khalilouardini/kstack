# Persisting a complete roadmap in Linear

These write and recovery rules are prompt-level. The local eval checker has no
Linear access and cannot enforce them.

## Prepare and bound the mutation

Use the connected Linear tools; discover their current schemas instead of copying
stale API arguments. Resolve workspace, team, statuses, projects, users, labels
and milestones from live records and the workspace contract. An unspecified team
is resolvable when the context gives one unambiguous match; ask only if material
ambiguity remains. Never create labels, statuses, users or teams as a side effect.

Before any write, finish the plan, complete ticket bodies/evals, documentation
impact table, duplicate classifications and proposed per-field change ledger.
Honor the workspace contract's mutation/approval requirements. Reuse explicit
authorization already covering this concrete change; if approval is missing,
show the reviewable ledger and ask once. Do not spend that approval on later
unrelated scope. `--dry-run` performs none of these remote mutations.

The ledger records stable plan key, kind, intended parent/team/project, proposed
fields, source/authority, create/reuse/update disposition, remote ID/URL,
read-back status and remaining steps. Include a stable roadmap/unit source key
in authored descriptions so an interrupted run can find its records. Reuse
equivalent work; do not create a second implementation issue for another project's
interest. Update existing records only when in scope; preserve their unrelated
text, labels, owners, states and relationships.

## Dependency order and verification

1. Create/reuse an initiative only when the requested outcomes actually need
   that grouping. Create/reuse projects with resolved teams and proposed or
   authorized scope, then project milestones. Do not create a shell solely to
   host a document; prefer the supported existing parent/location.
2. Create/reuse container tickets only when useful, then all independently
   verifiable units, eval preparation, scope/ADR decisions and release gate
   tickets. Every ticket gets the checked eval contract in its body. Use the
   contract's initial non-started state; no inferred assignment, deadline or
   priority. Documentation/eval/decision work is first-class, with explicit owners
   or outstanding owner decisions rather than hidden chores inside implementation.
3. Add relationships after endpoints are read back. Native blockers represent
   true start prerequisites. Preserve merge/enablement, evidence and positive
   human-decision conditions in a typed dependency table; do not convert all
   arrows to native blockers. Verify direction, both endpoints and cycles,
   including cross-project foundations. Parent/child is grouping, not a blocker.
4. Create/update a roadmap document in the intended supported parent, link all
   canonical records, scope/ADR sources, coverage matrix and typed dependency
   table. Replace plan keys with verified IDs/URLs. Keep actual access boundaries.
   Preserve each frontend ticket's review eval, demo/screenshot modes and evidence
   destination in both its body and the roadmap coverage matrix; verify those
   fields on read-back alongside the other evals.
   Publishing a new project roadmap does not publish or replace the stack's shared
   central lifecycle document; that remains its maintainer's separate action.

After each write, read the record back and compare critical fields: workspace/team,
parent/project/milestone, body and evals, state, intended labels and relations.
An HTTP success or returned ID alone is insufficient. Update the ledger immediately.
On a mismatch, stop further mutations; report the exact expected/saved difference.
Preserve successful records. Do not delete/recreate a partial roadmap to retry.

For a timeout or ambiguous write result, search by recorded ID/source key and
compare content before retrying creation. On resume, re-read the ledger and live
records, recheck authorization and source drift, and apply only missing changes.
An unexplained conflict remains PARTIAL and requires reconciliation; do not loop
blindly or overwrite a concurrent owner's edit.

## Final reconciliation

Read all records touched by this run and the complete target project membership.
Compare them to the plan: every intended unit exists exactly once, parents and
milestones agree, dependencies and gate populations match, every authored ticket
retains its evals, and scope/ADR adoption status is accurate. Include relevant
reused tickets in the eval coverage denominator; prepare the authorized eval
amendment if they lack one. Flag unrelated pre-existing membership separately.
Report gaps as PARTIAL, not CREATED. Rebuilding a local orchestration graph,
Git publication and execution admission remain separate `/linear-roadmap` work.

Compare structured dates/states and gate memberships with each current overview,
ticket and published roadmap summary; reconcile contradictions within the requested
scope. Date historical snapshots and point them to the current authority. Record
the observation time and exact covered membership. A stale source remains a
limitation, not an invented current status or a reason to rewrite release history.
