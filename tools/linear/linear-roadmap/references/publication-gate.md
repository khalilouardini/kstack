# Graph publication and ticket coverage gate

Read this contract when linear-roadmap prepares an existing Linear project, or
when a skill selects, starts, resumes, edits or lands implementation for a
Linear-backed project. It applies to next, wave plan/build, dispatch-implementation,
land, review-comments and pr-loop; investigate applies it before Phase 5 edits
when its bug is linked to a Linear project. Read-only inspection/review and work
without a Linear project do not need this gate. Project-local execution skills
must enforce it too. Enforcement is prompt-level except the deterministic
coverage helper and wave's caller-evidence checks; it is not a global hook.

## Check main on every invocation

1. Resolve the consuming repository and each affected Linear project by canonical
   UUID. Paginate all its tickets, including completed, canceled and archived
   tickets; verify project membership and completeness. A selected issue alone
   is insufficient. Do not audit the entire workspace as one project.
2. Fetch the repository remote's `main` branch and record its exact SHA and the
   check's UTC time. Inspect files at that ref, never the local branch, worktree
   or remembered contents. An unavailable main/live read is UNKNOWN and blocks
   affected execution. Do not substitute another branch silently.
3. Resolve the project's orchestration Markdown path from the root roadmap's
   links, existing project records or an explicit path. Filenames are flexible
   (for example a versioned MVP document). Inspect it on main. If absent, propose
   its initial path and use the same update-PR path as an incomplete graph.
   Ambiguous ownership/path stops execution rather than selecting an arbitrary
   graph. Repositories linking another repository's authoritative graph check
   that owner repository's main and PR; do not make a competing copy.
4. Require every ticket to appear as a graph node or contextual container in that
   project's Markdown view. An incidental mention in prose is insufficient.
   Meta/decision tickets may be contextual nodes; this does not make them
   implementation units. When the published index exists, require its single
   manifest to represent those UUIDs in the owning project as well. Keep the
   existing indexed validation, source pin and condition checks mandatory.

Use `tools/linear/linear-roadmap/bin/graph-coverage` for the membership comparison:

```text
python3 <stack-root>/tools/linear/linear-roadmap/bin/graph-coverage --repo <owner-root> --ref <fresh-main-ref> --issues <live-evidence.json>
```

The transient evidence JSON is `{ "complete": true, "projects": [...] }`; each
project has `project_id` (canonical UUID), `project_name`, `view_path` (relative
to its repository) and `issues: [{"id": "<issue UUID>", "identifier": "<key>"}]`.
Set complete only after pagination and membership read-back. The helper reads
Git blobs, reports CURRENT / UPDATE_REQUIRED / UNKNOWN and exits nonzero unless
CURRENT. It does not fetch Linear/GitHub, establish freshness or grant permission.

## Publish repairs through a PR

On linear-roadmap invocation, missing/incomplete main coverage requires a new
graph update PR. Reconcile live dependencies while adding the missing tickets;
preserve start, merge, evidence and human conditions. Update the authoritative
manifest, index, root links and affected project Markdown together. Keep source
pins and unrelated projects intact. A changed dependency also requires an update
when normal roadmap reconciliation discovers it, even if membership is complete.

Prepare changes on a dedicated branch from freshly fetched main, run indexed
validation/rendering and the consuming repository's gates, then push and open
the graph update PR as `identities.maintainer`, following land's branch/identity
rules. This bounded publication is part of linear-roadmap; it does not authorize
merging or Linear writes. A graph-only repair PR is exempt from this publication
gate so it can repair the very condition blocking implementation. Mixed graph
and product implementation changes are not exempt. Existing human scope approval
requirements still apply to edits of the product scope contract.

If a matching graph update PR is already open, update that dedicated PR rather
than opening duplicates. Report its URL, exact head, missing ticket keys, main
SHA and affected projects. If pushing/opening is unavailable, preserve local
artifacts and report publication incomplete; do not mark the gate satisfied.
Creating the PR leaves affected execution UPDATE_REQUIRED until its coverage is
on freshly fetched main. Linear status, a local regenerated graph and PR approval
alone do not satisfy publication. Next and other execution skills report the
missing keys/PR and stop affected work; they do not create the repair themselves.

## Explicit bypass — --accept-graph-update <PR#> (repeatable)

This flag accepts using a specific pending graph update for this invocation,
analogous to accepting a named file overlap. Validate each value as a positive
decimal PR number without a leading #; reject missing, zero, signed, fractional
or malformed values before any selection or writes, then deduplicate. Never
infer acceptance from --accept-overlap, an earlier run, a plan, an approval or a
tracker comment. Wave build must receive the flag again explicitly.

Fetch each named PR's live number, URL, state, base branch, head SHA and changed
paths in the authoritative repository. Require OPEN, base main, a stable head,
and a graph update for the affected projects. Fetch that exact PR head into a
scratch ref/worktree and repeat complete coverage and indexed validation there.
A closed/merged/nonexistent/unrelated PR, incomplete coverage, inaccessible head,
invalid graph or mismatched source pin refuses the bypass. If it has merged,
omit the flag and re-check main normally. A moving head requires a fresh check.

Use the validated PR graph for condition analysis and cite its SHA/digest. This
waives only publication on main; it never waives scope, unmapped executable
units, native blockers, event prerequisites, independence, plan/review approval
or release gates. Do not base implementation on the graph PR's branch. Recheck
before each execution transition; forward only flags explicitly supplied by the
human into composed skills and include PR/head/main coverage evidence in the
kickoff, plan risks and final report. A forwarded flag still requires live checks.

For wave, the caller supplies transient `graph_publication` evidence with
`main_sha`, `checked_at` (UTC ISO timestamp), and `projects`. Each project has
`project_id`, `project_name`, `view_path`, `state` (CURRENT, ACCEPTED_UPDATE,
UPDATE_REQUIRED or UNKNOWN). ACCEPTED_UPDATE also carries `pr_number` and
`head_sha`. Named bypass PR snapshots are `accepted_graph_updates` entries:
`{number, url, state, base, head_sha, coverage_exit, project_ids}`. Require OPEN,
base main and coverage_exit 0. For plan retain the full selection tokens; for
build use `graph_update_flags` containing only the current invocation's repeatable
flag/value pairs. These are read-only caller observations, not durable approval
records. Each node rechecks live state; stale Run A evidence is never reused as
a Run B grant. Every selected/approved track must have a covered project.
