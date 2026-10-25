# Graph coverage, candidate eligibility and reviewed publication

This contract applies to next, wave plan/build, dispatch-implementation, land,
review-comments, pr-loop and investigate before implementation edits. Project-local
execution skills must use it too. Read-only investigation/review and project-less
work remain exempt. Coverage is a project-wide maintenance warning. Execution
eligibility belongs to selected work and its relevant dependency closure.
Enforcement is prompt-level except the deterministic helpers and wave's checks
of caller evidence; there is no global hook.

## Fresh baseline and project coverage

`/linear-roadmap` refreshes local JSON/Markdown/scope artifacts by default. It
does not commit, push or open/update a PR unless invoked with `--publish`.
Local mapping and PR publication are separate from execution admission below.
Keep a running wave's selected tickets, approved plans and saved evidence intact.
New tickets wait for a later selection; local refreshes never enroll them in a wave.

On each invocation, resolve the authoritative repository, project UUID and graph
path without ambiguity. Fetch literal `main`, record its exact SHA and UTC check
time, and inspect Git blobs at that SHA. Do not use an unmerged working graph or
silently substitute a default branch. Explicit local approval below uses the
local owner files instead of Git graph blobs; main remains the implementation base. Follow cross-repository graph ownership;
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

Indexed schema validation, clean installed source, graph/event-cycle checks, scope, active
session checks, independence, plan/review approval and release gates remain
mandatory. Legacy graphs require the same cited closure audit by the skill;
`graph-admission` cannot grant deterministic admission without a typed index.
A legacy missing unit or dependency repair requires a reviewed graph update.

`source_revision` records adoption provenance. Preserve it across stack upgrades;
supported schemas and clean installed source determine compatibility. A different
installed HEAD alone requires no graph-only repin PR.

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
before each transition. A changed SHA requires a fresh audit. Only changed
relevant conditions/evidence invalidate a track's approval; unrelated graph
changes or commits do not. Keep old and new SHA observations in the audit trail.

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
A structural draft validation is not a substitute for indexed schema and clean-source validation.

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

Linear-roadmap reports coverage warnings and publishes only with `--publish`;
it does not label the whole project blocked merely because coverage is below
100%. Reuse a matching graph PR rather than opening duplicates. Report exactly
which candidates or conditions require reviewed publication, including main SHA,
missing keys and PR/head. Missing evidence stays UNKNOWN; do not publish invented
scope or prerequisites to manufacture completeness.

## Explicit pending reviewed graph — --accept-graph-update <PR#>

Retain this repeatable flag for a specific pending **reviewed** graph update.
Validate positive decimal numbers, deduplicate, and verify OPEN, base main,
stable exact head, affected projects, indexed schema/clean-source validation and review
evidence at that head. Report coverage gaps separately and require verified
selected units and closure on that head; unrelated omissions do not veto it. Review must come from the configured reviewer
or authorized human; scope decisions require the authorized owner independently.
Fetch and validate the exact PR head; `--main-ref <fresh-main-ref>` with
`graph-admission` records both SHAs (snapshot also supplies `graph_sha`). The flag
waives publication on main only. It cannot waive review, scope, blockers or gates.
Closed, merged, unrelated, invalid or unreviewed heads refuse. A head moving
during a node returns STOPPED before writes; later invocations require fresh
exact-head review and admission, then compare approved candidate conditions;
incomplete selected scope/closure evidence refuses too; after
merge omit the flag and recheck main. Never base implementation on the graph PR.

Do not infer acceptance from --accept-overlap, --approve, a tracker comment or a
previous invocation. Forward only human-supplied flags and recheck in each composed
skill. Wave build must receive a pending-graph flag again explicitly. Ordinary
local maintenance reconciliation requires no bypass flag.

## Explicit approved local graph — --local-graph

Accept the single boolean flag --local-graph. It defaults to
`<owner-root>/orchestration/index.json`; no path argument or script is needed.
Reject repeated local flags and combinations with --accept-graph-update. Never copy a graph across
owners, combine overlays or silently use an older dispatch-worktree copy.

This invocation explicitly approves use of the local index/manifest. No graph PR,
graph on main or Linear publication is required or authorized. It does not approve
scope, a plan, a human_decision event, a contract merge or an implementation merge.
Original owner scope decisions, draft/recorded authorization, typed dependencies,
native blockers, all event/evidence/human conditions, independence, review and
release gates remain mandatory. Semantic scope and gate changes still require
original authorized decisions; the flag cannot manufacture them.

1. Resolve the physical owner path. Run graph-record validate-index and retain
   clean installed-source/schema/cycle validation, source_revision provenance and
   the raw manifest digest. A stack upgrade alone does not require repinning
   source_revision; it records the original reviewed adoption commit.
2. Fetch fresh implementation main and complete live project/closure evidence,
   including full issue bodies/relations and original human/acceptance sources.
   Run graph-coverage --repo <owner> --local-index orchestration/index.json
   --issues <live.json>. CURRENT/UPDATE_REQUIRED are coverage observations;
   UNKNOWN/invalid evidence blocks. Unrelated omissions remain warnings.
3. Run graph-admission --repo <owner> --local-index orchestration/index.json
   --main-ref <fresh-main-ref> --issues <live.json> --request <candidate.json>.
   This uses the same candidate/closure rules above and exact local scope quotes.
   --ref and --reconcile cannot be combined with local-index. Only ELIGIBLE build
   candidates may enter wave tracks. The helper reports graph_sha null, explicit
   local_graph index/manifest/provenance pins, and full local_scope_sources in
   evidence for later scope comparison. A structural graph alone is not readiness.
4. Pin index_path, manifest_path, index_digest, manifest_digest and source_revision
   in the checkpoint handoff. Graph/index/source changes require a new plan and
   human approval; fresh closure evidence is still needed when pins match. Compare
   full relevant scope sections and exclusions against the saved local snapshots.
   Never claim local files existed at the implementation main SHA.
5. Repeat validation/admission before A3/A4 writes, B1 and each B3 review/fix,
   even when main is unchanged. Forward only the human's current explicit flag
   and absolute canonical owner/pins through dispatch, land, pr-loop and
   review-comments. Build must supply the flag again alongside --approve;
   no prior plan, comment or observation is consent. Contract and implementation
   PRs, dispatch's normal tracker transitions and human merge checkpoints retain
   their existing procedures. A graph refresh cannot enroll new wave members.

Wave caller approved_local_graph is `{index_path, manifest_path, index_digest,
manifest_digest, source_revision, checked_at, validation_exit, coverage_exit,
coverage_state, project_ids}`. Digests are sha256:<64 lowercase hex>; validation_exit
is 0, coverage_exit is 0/1 matching CURRENT/UPDATE_REQUIRED, and checked_at matches
the fresh graph_publication timestamp. Set each affected project to APPROVED_LOCAL.
Plan keeps tokens in selection; build uses graph_update_flags. The script binds
local_graph pins to graph_publication evidence and each full helper report, then
compares both runs before B1. Existing record.evidence arrays retain all observations;
RUN_A/WAVE_REPORT schemas do not change. Default published/maintenance paths remain
unchanged when the flag is absent. These rules are prompt-level except helper
validation, wave caller/pin checks and B3 admission comparisons.

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
fresh reports and compares each candidate's `closure_graph_digest` and relevant
`closure_evidence_digest` with Run A before building. The graph digest covers the
selected unit, its containers, prerequisite events/nodes (including future merge
gates), their project scope/authorization and execution policy. Unrelated nodes,
edges, projects and display titles (graph, project and node) are excluded. Full graph digests and
SHAs remain audit observations, not whole-wave approval locks. Coverage counts
and routine tracker timestamp/status changes alone do not
invalidate approval; full fresh observations remain in the audit record. Relevant
digests cover scope path/quote (line is a freshly verified locator), node identity, ownership, acceptance, incoming
prerequisites within the candidate event closure, issue id/identifier/description/prerequisites, and current event
node_id/event/state. Event facts are sorted by node_id/event before hashing.
Agent-written scope rationales and proof/event source explanations remain required
and fully retained in evidence.request but are excluded from the factual digest;
rewording them alone cannot invalidate approval. The calling skills still verify
source truth on each transition. Future merge gate definitions stay protected
by the candidate graph digest; release conditions are verified at release.
Changed relevant constraints or evidence require reanalysis and plan approval
for that track. During build a missing/blocked/changed candidate stops only that track;
independently verified siblings continue. If no approved track is eligible,
return STOPPED with all reasons. Do not replace stopped tracks with new tickets.
Older Run A records lacking candidate graph digests need a new plan audit;
never substitute the full graph digest or invent missing evidence.
B1 and B3 receive the saved Run A main/graph pins and per-track digests, alongside
fresh Run B reports. Preserve both snapshots and changed fields with old/new
values on refusals. B1 verifies Run A main ancestry before writes. Planning has
no prior approval: caller preflight rejects known ineligible selections before
Workflow, and unexpected invalid A1 selections stop before A3 writes.

A LOCAL_RECONCILIATION -> PUBLISHED transition preserves approval only when the
saved `published_closure_graph_digest` and `published_closure_evidence_digest`
match the fresh published candidate's full graph/evidence digests. The helper
computes both saved digests over the repair itself, its containers and its own
prerequisites. The origin remains fully audited and binding while both runs are
local. Missing saved publication digests or a reverse mode transition require a
new plan for that track; never substitute a whole-manifest digest or invent a
missing baseline. Unrelated graph changes still preserve independent tracks.
Issue URLs are verified locators, retained in raw evidence but excluded from
identity digests regardless of provider slug format. Scope applicability is a
semantic check over the full relevant sections, including exclusions; a quote
digest alone cannot establish it. Nodes compare saved/fresh scope sources.
Immediately before each project-linked B3 review, a read-only READMISSION node
observes live main. When it moved, require descendant ancestry, a clean merge of
the observed PR head, and a fresh ELIGIBLE build report at that main. Reuse the
same canonical identity and per-candidate graph/evidence comparisons as B1,
including the one-way local repair publication rule. Whole-manifest changes
outside that candidate do not block siblings. Preserve accepted graph head pins
and current-invocation flags. Refresh citation locations and event facts rather
than copying the old request. Evidence must not postdate the observation or be
more than one hour old. A refusal yields BLOCKED/rounds 0 without a review call;
retain the full observation and failure reason in WAVE_REPORT evidence. Successful
reviews pin live main and the merge-tested PR head; another move stops writes.
These caller observations are evidence, not durable human approval records.

## Semantic approval metadata and review freshness

Full legacy digests and all observations remain available for old checkpoints.
New candidates also emit semantic_closure_graph_digest and
semantic_closure_evidence_digest, plus semantic_published_closure_* for repairs.
The semantic graph omits node/edge citation prose, retaining project authority,
identity, acceptance, conditions, policy and verified scope. Semantic evidence
omits only exact standalone `<!-- kstack-progress: STATE -->` status markers
outside fenced code, where STATE is one of PLANNED, BUILDING, PR_OPEN, REVIEWING,
STOPPED or COMPLETE. No extra fields or prose are allowed in the marker. Blank
separators around an excluded marker do not add an empty paragraph. All free-text
description lines, including `Progress note:` prose, remain protected. Full bodies
and citations remain required and retained; exclusions and contradictions must
still be read. A status marker is metadata and cannot grant or change scope.

Wave compares semantic pairs only when saved in Run A; missing current semantic
evidence then blocks. Legacy checkpoints keep their original recipe. Always
refresh relevant Linear evidence before review even if Git main is unchanged.
A reviewed pending graph reaching main permits a source switch and removal of
its obsolete flag after fresh closure verification. Main commits and the loop's
own guarded fix pushes do not alone revoke approval. Final remote heads must
match review/CI observations and final seam checks after all review fixes.
