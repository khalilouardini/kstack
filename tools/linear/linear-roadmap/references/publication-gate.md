# Graph coverage, candidate eligibility and reviewed publication

This contract applies to next, wave plan/build, dispatch-implementation, land,
review-comments, pr-loop and investigate before implementation edits. Project-local
execution skills must use it too. Read-only investigation/review and project-less
work remain exempt. Coverage is a project-wide maintenance warning. Execution
eligibility belongs to selected work and its relevant dependency closure.
Enforcement is prompt-level except the deterministic helpers and wave's checks
of caller evidence; there is no global hook.

## Fresh baseline and project coverage

On each invocation, resolve the authoritative repository, project UUID and graph
path without ambiguity. Fetch literal `main`, record its exact SHA and UTC check
time, and inspect Git blobs at that SHA. Do not use an unmerged working graph or
silently substitute a default branch. Follow cross-repository graph ownership;
never create a competing copy. An unavailable authoritative main read is UNKNOWN.

Paginate all project tickets, including terminal and archived issues, and verify
membership. Run the read-only membership audit:

```text
python3 <stack-root>/tools/linear/linear-roadmap/bin/graph-coverage --repo <owner-root> --ref <fresh-main-ref> --issues <live-evidence.json>
```

Evidence is `{complete: true, projects: [...]}`. Each project has canonical
`project_id`, `project_name`, repository-relative `view_path`, and
`issues: [{id: "<UUID>", identifier: "<key>"}]`. Set complete only after pagination
and membership read-back. Require each ticket's own graph declaration, and UUID
membership in the indexed manifest when present. Contextual groups may cover meta
issues without making them executable. Incidental mentions do not count.

The helper reports CURRENT / UPDATE_REQUIRED / UNKNOWN; nonzero means incomplete
coverage or an invalid audit, **not automatic exclusion of every candidate**.
Report covered/total counts and missing keys separately from eligibility. An
unrelated addition, including a terminal or archived ticket, must not freeze
mapped work. Missing project graph/index, ambiguous ownership, unknown main or
incomplete live evidence still blocks the affected candidate audit. An unrelated
project's failure does not block independently verified candidates.

## Candidate and dependency-closure eligibility

For every proposed, resumed or reviewed implementation unit:

1. Map its canonical issue UUID to exactly one `kind: unit`. An unmapped candidate
   may use only the bounded reconciliation below, otherwise report UNMAPPED.
2. Verify the selected scope against the approved product contract and any original
   owner decision. Read exact citations at the pinned graph SHA; project membership,
   a maintenance label, `authorization: recorded`, a tracker status or a rationale
   alone cannot authorize work. Explicit exclusions and admission decisions win.
3. Traverse prerequisite **events**, including implicit plan → build → merge,
   across projects and external, evidence and human nodes. Include containers and
   every prerequisite needed for plan/build/merge in the metadata audit. For a
   repair include its existing origin unit's closure too. Do not invent edges from
   related-to links, or turn a merge-only gate into a start blocker.
4. Fetch full issue bodies and complete relations for each referenced issue in
   that closure. Reconcile native blockers, prose prerequisites, ownership and
   acceptance conditions with the reviewed graph. Verify non-issue sources too.
   Scope expansion or any changed dependency, acceptance/release criterion or
   human gate requires reviewed publication; it is never a local metadata repair.
5. Evaluate the current transition from fresh completion, PR, acceptance and human
   evidence. UNKNOWN is not satisfied. Native blockers target plan; any incoming
   plan/build condition is a start prerequisite. Future merge/release gates remain
   explicit and enforced at those events; an unmet future gate alone does not
   prohibit an otherwise eligible build. PLAN_ONLY remains a separate next/dispatch
   outcome and cannot enter wave's implementation tracks.

Indexed validation, installed source pin, graph/event-cycle checks, scope, active
session checks, independence, plan/review approval and release gates remain
mandatory. Legacy graphs require the same cited closure audit by the skill;
`graph-admission` cannot grant deterministic admission without a typed index.
A legacy missing unit or dependency repair requires a reviewed graph update.

For indexed graphs, use `bin/graph-admission` beside `bin/graph-coverage`:

```text
python3 <stack-root>/tools/linear/linear-roadmap/bin/graph-admission --repo <owner-root> --ref <fresh-main-ref> --issues <live-evidence.json> --request <candidate-evidence.json> [--reconcile <proposed-manifest.json>]
```

It reads immutable Git blobs and does not fetch, write, dispatch or grant human
approval. Add `main_sha` and `checked_at` to the coverage snapshot. Closure issues
also require full `description`, `url`, `updated_at`, `relations_complete: true`,
and `prerequisites` containing all incoming manifest edge objects in manifest
order, after checking both prose and native relations. The list is per issue:
when several nodes share one `issue_ref` (a unit and its human review node), it
holds every edge into any of those nodes, in manifest order. Do not use truncated list
responses as full bodies. Evidence expires after one hour and must be refreshed
before each transition. A changed SHA or relevant evidence requires reanalysis.

The request contains `selected` issue UUIDs, `transition` (plan/build/merge),
`nodes` and `events`. Each closure node proof has `node_id`, exact `owner` and
`acceptance`, an authoritative `source`, complete `prerequisites`, and
`scope: {path, line, quote, rationale}`. Scope quotes must match the pinned Git
blob at the stated one-based line; the rationale explains applicability to this
work. Event observations have `node_id`, `event`, `state` (SATISFIED, UNSATISFIED,
UNKNOWN) and `source`. Every current prerequisite event needs cited evidence.
Run separate audits for independent candidates when a group has incomplete
evidence; an UNKNOWN group report is no reason to exclude a separately verified
candidate. The helper validates structure, membership, exact citations, delta and
event coverage. Its graph/evidence digests hash canonical JSON (sorted keys and
compact separators); graph-record also reports its distinct raw manifest digest. The calling skill must verify source truth, scope meaning, actor
identity and the actual acceptance result; a self-reported SATISFIED is not proof.

## Bounded local reconciliation within approved scope

No preliminary graph PR is required for **one to three selected missing
maintenance units** whose work restores behavior already authorized on main.
Next may prepare a local admission artifact as part of its read-only analysis;
this permits no product edits, tracker writes or launch by next.

Supply the complete proposed manifest with `--reconcile`, plus request
`repairs: [{node_id, origin, kind: "maintenance", rationale}]`. Each origin must
be an existing approved executable unit in the same project. The rationale cites
that original authorization and explains why the repair changes no product
boundary. A bugfix label or small diff is insufficient. Each added node must be
selected and retain the origin's project, group, owner and effort. Its own
acceptance must reproduce the live issue's Done-when and the approved behavior.
Existing nodes, scope records, policy, edges, acceptance/release conditions and
human gates must stay byte-for-byte equivalent as JSON values. This deliberately
narrow path adds **no edges**: any new prerequisite or ordering requirement,
including on the new repair, requires reviewed publication. The origin closure
is audited and its current prerequisites still apply; it cannot be used to evade
an existing human or evidence gate. No removals, reassignments, renamed gates,
weakening criteria or unrelated additions are allowed.

The helper emits an auditable JSON record with main/graph SHA, base and effective
graph digests, UTC time, full live issue/request evidence and digest, per-candidate
closure/digest, and the exact added-node delta and repair rationale. Save this
record in a local session artifact; carry its path/digests in kickoffs, plans,
land reports and the implementation PR body. Use the one validated effective
manifest in an isolated admission directory; never implicitly merge overlays
into the active index or edit the shared authoritative graph. Reconstruct from
pinned main plus the recorded delta, validate/render, and inspect the complete
conditions. Any local manifest must match that exact recorded effective digest.
A structural draft validation is not a substitute for the source-pin audit.

Re-fetch main and full closure issues before dispatch/status writes, build,
commit/push and implementer review fixes. Re-run admission against current
evidence. Never infer a grant from an earlier record, plan approval or review.
If the boundary/delta/closure changes, stop the affected work and repeat analysis
and approval where required. Include the reconciliation record or its exact
reconstructible delta in the implementation PR for review and durable audit.
If publishing the repair into the authoritative manifest in that PR or a later
roadmap refresh, review its explicit event conditions against the recorded origin
closure. Never promote the edge-free local delta alone and lose inherited gates.
Graph publication is not a separate precondition to the maintenance implementation. Local reconciliation itself
never permits merging or signing off a release.

## Reviewed graph publication for semantic changes

New scope, dependency changes, release/acceptance changes, human-gate changes,
repairs outside the bounds above, or incomplete authorization require a reviewed
graph update before affected execution. Prepare an isolated branch from fresh
main, reconcile live sources, update manifest/index and rendered views together,
run validation and repository gates, and open the PR as `identities.maintainer`.
Scope changes additionally need the authorized owner's explicit scope decision.
A graph-only PR is exempt from its own execution gate so it can repair it; a
mixed implementation PR may use only verified existing scope/local reconciliation.
Never merge automatically or write Linear through this policy.

Linear-roadmap reports coverage warnings and may publish routine bookkeeping;
it does not label the whole project blocked merely because coverage is below
100%. Reuse a matching graph PR rather than opening duplicates. Report exactly
which candidates or conditions require reviewed publication, including main SHA,
missing keys and PR/head. Missing evidence stays UNKNOWN; do not publish invented
scope or prerequisites to manufacture completeness.

## Explicit pending reviewed graph — --accept-graph-update <PR#>

Retain this repeatable flag for a specific pending **reviewed** graph update.
Validate positive decimal numbers, deduplicate, and verify OPEN, base main,
stable exact head, affected projects, indexed validation/source pin and review
evidence at that head. Report coverage gaps separately and require verified
selected units and closure on that head; unrelated omissions do not veto it. Review must come from the configured reviewer
or authorized human; scope decisions require the authorized owner independently.
Fetch and validate the exact PR head; `--main-ref <fresh-main-ref>` with
`graph-admission` records both SHAs (snapshot also supplies `graph_sha`). The flag
waives publication on main only. It cannot waive review, scope, blockers or gates.
Closed, merged, unrelated, invalid, unreviewed or moving heads refuse;
incomplete selected scope/closure evidence refuses too; after
merge omit the flag and recheck main. Never base implementation on the graph PR.

Do not infer acceptance from --accept-overlap, --approve, a tracker comment or a
previous invocation. Forward only human-supplied flags and recheck in each composed
skill. Wave build must receive a pending-graph flag again explicitly. Ordinary
local maintenance reconciliation requires no bypass flag.

## Wave caller evidence and checkpoints

`graph_publication` retains `main_sha`, valid UTC `checked_at` on `args.date`,
and project coverage entries with project UUID/name/view path and state CURRENT,
UPDATE_REQUIRED, UNKNOWN or ACCEPTED_UPDATE. Coverage warnings do not exclude
all tracks from that project. Project-less work may supply `{projects: []}`.
Accepted PR snapshots also include number, URL, state, base, head_sha,
coverage_exit (0 for CURRENT, 1 for UPDATE_REQUIRED), coverage_state,
validation_exit 0, project_ids, `reviewed_head_sha` and `review_source`.
UNKNOWN coverage/invalid indexed validation cannot authorize that pending graph.

Supply `graph_admission` as an array of full helper reports for candidate groups.
Match candidates only inside validated build-transition reports in both runs;
ignore plan-transition and invalid reports before checking match uniqueness.
Validate stored Run A reports using Run A's publication SHA and UTC date, and
current reports using Run B's SHA/date. Only ELIGIBLE build candidates enter TRACK;
an unrelated project's warning or an unselected candidate's block does not stop selected eligible work. Require exact
project/issue identity, main/graph pins, closure evidence and the bounded delta.
Persist both coverage and admission reports in existing record.evidence; do not
add RUN_A/WAVE_REPORT schema fields. A1 rechecks before selection, A3/A4 before
writes, B1 before implementation and B3 before implementer fixes. Run B obtains
fresh reports and compares effective graph and relevant closure digests with Run
A before building. Coverage counts and routine tracker timestamp/status changes alone do not
invalidate approval; full fresh observations remain in the audit record. Relevant
digests cover scope path/line/quote, node identity, ownership, acceptance, incoming
prerequisites, issue id/identifier/description/url/prerequisites, and current event
node_id/event/state. Event facts are sorted by node_id/event before hashing.
Agent-written scope rationales and proof/event source explanations remain required
and fully retained in evidence.request but are excluded from the factual digest;
rewording them alone cannot invalidate approval. The calling skills still verify
source truth on each transition. Future gate definitions stay protected by the
graph digest. A changed coverage count alone does not invalidate approval;
a changed graph, relevant closure or SHA requires reanalysis and plan approval.
These caller observations are evidence, not durable human approval records.
