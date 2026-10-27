# Shared selection assessment, version 2

Next, wave and dispatch use this contract for stage eligibility. The collector
reads scope, tracker, graph and ownership evidence; the deterministic helper
evaluates those observations and computes a batch. A passing helper result is
not human approval, and cannot make an inaccurate observation true.

Resolve newer named owner decisions against older exclusions before declaring
scope blocked. Keep the original acceptance. Related links are context, not native
blockers. Graph ELIGIBLE at plan/build says nothing about plan approval or merge.
Read full relevant scope sections, not only a matching citation line. Unknown
evidence is UNKNOWN, never an invented dependency or a passing condition.

## Collect once, explain every candidate

New collections use the observation compiler below, rather than six agent-written
eligibility booleans. This addresses errors before optimization: a perfect solver
cannot recover a candidate that the collector incorrectly excluded.

1. Resolve and pin the invocation's graph source once. Default is freshly fetched
   main; explicit `--local-graph` uses the canonical owner index/manifest, never a
   stale dispatch copy. A local graph's existence does not silently select it.
   If default-main mapping prevents the requested comparison, report that source
   mismatch and the explicit local/pending option; do not describe all live work
   as intrinsically blocked. Preserve the user's flags unchanged.
2. Recover the original authorized owner's admission from configured scope,
   decision logs, linked original comments or an explicit original transcript
   locator provided by the owner. Verify actor, date, exact boundary and current
   applicability. Do this before declaring scope unavailable. Never search every
   unrelated private conversation. Generic admission authorizes only that boundary;
   enumerate specific unresolved behavior choices separately with their target
   stages. An admission does not resolve these choices or approve release.
3. Audit each candidate's plan and build transition separately. Attach the full
   helper reports, including BLOCKED reports, at the same main/time/source pins.
   Group BLOCKED, UPDATE_REQUIRED and missing unrelated tickets are not per-ticket
   graph verdicts. Missing/invalid candidate reports become UNKNOWN for that
   candidate/stage, while verified siblings remain selectable. Merge/release
   prerequisites stay in the audit; only their actual targeted ancestors constrain
   plan/build. Native blockers still constrain planning independently of the graph.
4. Save the original observation packet and run
   `node <stack-root>/tools/linear/next/bin/assess-candidates <observations.json>`.
   Exit 2 refuses malformed observations. Save returned `input` and `output` as
   the selector snapshot and assessment. Use those exact IDs for next, wave and
   named dispatch. Source truth, scope meaning, actor identity and complete reads
   remain collector responsibilities; the compiler cannot authenticate prose.

The packet has the selector metadata/ranking/pair fields below plus:

- `main_sha` and `checked_at`: the freshly observed main and UTC timestamp used
  by all admission reports. `graph_source` is `{mode: "PUBLISHED", graph_sha}`,
  `{mode: "ACCEPTED_UPDATE", graph_sha}` (after exact-head review validation), or
  `{mode: "APPROVED_LOCAL", local_graph}`. Local pins contain `index_path`,
  `manifest_path`, `index_digest`, `manifest_digest`, `source_revision` from the
  canonical helper. Source must agree with exact command tokens.
- `graph_reports: [{source: <absolute audit path>, report: <full helper JSON>}]`.
  The compiler matches issue UUID, identifier, project, transition and source pins,
  never the aggregate report state. Missing or duplicate matches are UNKNOWN.
- Each candidate retains identity/rank/ownership/files/overlaps, adds `issue_uuid`,
  and supplies `scope`, `native`, `foundation` instead of `checks`. Every check
  observation is `{state, source, detail}` using the three selector states below.
  `scope` contains `admission` (original authorization), `plan` and `build` (exact
  boundary applicability), and `decisions` (explicit empty list after checking).
  Each decision adds `id` and `stages` from plan/build/merge/release. A generic
  admission cannot override a pending named decision. Keep older exclusion and
  superseding decision sources together in the boundary rationale.
- `native: {complete: true, source, blockers: [<check observation>...]}` records
  both native relation directions and verified resolution of every blocker.
  Incomplete reads become UNKNOWN, never an empty unblocked set. `foundation`
  is the cited implementation foundation check. Project-less candidates require
  a cited `graph_exemption` observation; no implicit project exemption exists.

`select-candidates` remains a low-level pure solver and legacy checkpoint reader.
Running it alone on hand-written booleans does not verify collection correctness.

Use next's complete paginated project/milestone pool and existing scope filters.
Dispatch collects the same facts for its named issue; it need not fetch unrelated
candidate issues. Refresh mutable evidence before writes. Reuse only immutable
content by revision; a saved assessment is an audit, not later authorization.

Save the input and helper output outside the repository under
`${KSTACK_STATE:-$HOME/.kstack}/selection/<unique-run-id>/`. Do not put private
issue bodies in the summary. No selection PR or tracker mutation is needed.

Run `node <stack-root>/tools/linear/next/bin/select-candidates <input.json>`.
Exit 2 means invalid/incomplete input; show the error, never report an empty pool.
The JSON input contains:

- `schema_version: 2`, `complete: true` only after all requested pages and required
  dependencies have been read; `snapshot_id` identifying the saved observations;
  `source_revision` (40-character installed skill commit), `command` (exact
  selection argument tokens), `main_sha`, `checked_at` (UTC observation time).
- `requested`: positive N, default 3 for parallel and 1 for a named dispatch;
  `limit`: consuming `wave.selection_limit`, default 12, positive integer. Above
  the configured limit refuse with the value and key; never silently clamp to 5.
  `search_budget`: optional deterministic search-node cap, default 100000, max
  1000000. At most 1000 candidates per assessed pool; a larger pool needs narrower
  explicit filters, never silent truncation. Output length is not pool size.
- `candidates`: every considered engineering leaf, each with `issue_id`, canonical
  `project` UUID or null, authorized `milestone` identifier, nonnegative integer
  `priority` (lower preferred), `active_release` boolean, `file_scope` (concrete
  path array or null), `ownership: {state, source}` with state ACTIVE, INACTIVE or
  UNKNOWN. Active means verified branch/worktree/PR ownership, not assignee alone.
- Each candidate's `checks` has all six keys `scope_plan`, `scope_build`, `native`,
  `plan_graph`, `build_graph`, `foundation`. Each is `{state, source, detail}`,
  where state is SATISFIED, UNSATISFIED or UNKNOWN. Cite original decisions and
  exact graph reports, current native blocker evidence and required foundation
  reachability. For a graph-exempt issue cite that exemption explicitly. Do not
  infer missing native blockers from graph edges. `scope_plan` authorizes only
  the proposed planning boundary; `scope_build` covers the exact implementation
  acceptance. A bounded decision brief may be plan-authorized while build scope
  remains unresolved. Foundation concerns do not prohibit read-only planning
  unless a native/plan prerequisite also does.
- `external_overlaps`: per-candidate array of `{work, files, source}` naming
  external PRs/worktrees and exact paths, or empty after checking. Unknown external
  paths are a warning with empty `files` and a cited explanation in `source`.
  Unknown ownership/dependencies still fail their checks independently.
- `pairs`: one `{a, b, relation, source, detail}` for every pair of individually
  build-eligible candidates. Relation is INDEPENDENT, DEPENDENCY, INCOMPATIBLE or
  UNKNOWN. Check transitive blocking paths and actual interface behavior, not
  just filenames. An incomplete pair matrix refuses. UNKNOWN prevents that pair
  from being selected together; it does not fabricate a one-ticket blocker.

The helper returns all per-candidate plan/build states, cited reasons, warnings,
dispositions, selected IDs, planning IDs, and capacity accounting. It maximizes
cardinality first, then active-release count and priority/ID order. Bounded search
reports `optimal: false` with an upper bound when optimality is unproved. Never
describe that result as the maximum. Do not replace its IDs with a greedy choice.

## Shared paths and planning capacity

Shared paths alone warn for both candidate pairs and external active work. They
do not create a hard conflict. Incompatible changes or real dependencies do.
Report that an overlapping batch is parallelizable with integration work, not
file-disjoint. Keep exact paths in plans and PR Pending overlap sections. Before
merge, fetch and rebase onto current default main, resolve conflicts, rerun gates
and review the changed head. Never base on an unrelated open PR. A same-file
warning does not authorize a new shared interface or a dependency on unmerged code.

`--accept-overlap` remains a compatibility annotation: validate named PR numbers
and read their evidence, but flags do not change eligibility. Unknown external
diffs warn; invalid explicit PR arguments still refuse. Keep all overlap evidence
even when the selected set is empty or the summary exceeds one screen.

Show separately: selected builds, eligible planning, queued planning, active work,
decisions/blockers and unknown evidence. Print requested, selected, planning and
unfilled counts, with the reason and search bound. Native or plan-blocked work
cannot enter planning. Unknown files can be mapped by a bounded read-only planner
when planning is authorized; dispatch still coordinates workspace/status writes.
The planning queue is limited to N additional plans and never consumes build slots.
Planning does not approve or implement the issue. A planning-only wave member
needs fresh selection and plan approval before a later build.

## Wave and compatibility

New `/wave plan` invocations pass `selection_version: 2` and the full
`selection_snapshot` above. Its pins, count, limit and command must match the
invocation. A1 proposes workspace names only for the helper's selected and
planning IDs; the runtime rejects changed membership, project or file scope.
It verifies build graph admission for build tracks and plan graph admission for
planning tracks. The Workflow sandbox embeds the same pure helper; tests compare
the embedded source with `lib/selection.cjs` so the policies cannot silently drift.

RUN_A version 2 stores separate `tracks`/`plans` and
`planning_tracks`/`planning_plans`, plus the assessment and its input. Only the
first pair can enter approval. A planning-only run returns PLANNING_ONLY with no
build command. Even explicit IDs cannot promote a planning member. On build,
recompute the saved selection and verify membership, then run existing fresh
admission and plan checks. Legacy RUN_A records continue using their original
membership; never reinterpret them as version 2. `selection_version: 1` exists
only for legacy caller compatibility and fixture replay, not a new user flag.

On Codex without Workflow, render both queues and capacity evidence but do not
dispatch from wave. Direct next remains read-only. Existing human plan/merge
checkpoints and graph source flags remain required on supported execution hosts.
