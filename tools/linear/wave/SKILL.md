---
name: wave
version: 0.12.0
description: Run one independent Linear batch through a Claude Code Workflow graph, with human plan approval and merge checkpoints. Use when asked to "run one wave", "plan a Linear batch", "build the approved wave", or "/wave plan|build". (kstack)
---

# wave — one batch, two human decisions

## When to invoke

A wave is one fixed implementation batch plus a separate planning queue selected
by `/next --parallel`. Shared files require integration checks; real dependencies
and incompatible changes constrain concurrent implementation.
Build and human-merge this wave before selecting the next one. Invoke:

```text
/wave plan [<milestone-id>|any] [--project "<p>"]... [--parallel N] [--accept-overlap <PR#>]... [--accept-graph-update <PR#>]... [--local-graph]
/wave build --approve <comma-separated-issue-ids|all> [--accept-graph-update <PR#>]... [--local-graph]
```

Invoking this skill explicitly opts into calling the Claude Code Workflow tool,
as required by that tool's user opt-in rule. No Workflow execution is implicit
in an ordinary `/next` invocation. Project filters depend on the canonical
`next` supporting repeatable `--project`; if it does not, refuse that option
and name the dependency. Do not approximate selection rules.

Plan accepts repeatable `--accept-overlap <PR#>` and delegates its validation
to canonical `next`. Shared-file overlap is warning-only, including within the
selected batch; technical dependencies remain constraints. Plan and build accept
repeatable --accept-graph-update or one --local-graph under
the shared contract below. Build accepts `--approve` and graph source flags; `--accept-overlap` on build is an unknown flag and must be rejected.

## Published graph admission

Before Workflow starts, follow
`tools/linear/linear-roadmap/references/publication-gate.md` from the physical
stack root. Report project coverage warnings and require fresh candidate/closure
admission for every selected/approved track before contract/worktree/tracker writes.
Unrelated additions do not freeze mapped work. Bounded local maintenance repairs
need no preliminary graph PR; retain their main SHA, full live evidence and exact
delta. Semantic scope/dependency/release/human changes require reviewed publication.
Only explicit --accept-graph-update can use a verified reviewed pending graph.
Revalidate at A1, before A3/A4 writes, B1 implementation and B3 implementer fixes;
Run A observations and --approve do not supply fresh evidence or a bypass.

The wave's membership is fixed by Run A and the human-approved subset. Roadmap
refreshes and newly created or closed tickets do not add tracks or cancel this
wave. Compare each mapped track's `closure_graph_digest` and
`closure_evidence_digest` after refreshing evidence; a different main SHA or full
graph digest alone does not invalidate its approval. Changed relevant conditions
or missing evidence stop that track; independently verified siblings continue.
Future merge gates stay in the comparison and are enforced at merge. Release
evidence is rechecked at release; project membership alone is no start condition.

## Explicit local graph source

Use --local-graph on plan and repeat it explicitly
on build alongside --approve. The default path is orchestration/index.json in
the owning repository. Refresh it with /linear-roadmap "<project>" first when
tickets, scope or dependencies changed; omit --publish to keep it local. Follow the shared gate's **Explicit approved local
graph** procedure. It uses the owning local index/manifest without graph publication
to GitHub or Linear. Scope, typed dependencies, native blockers, evidence, original
human-decision proof, independence and both human checkpoints remain mandatory.
This flag approves graph use only. Reject repeated local flags and mixed PR/local
sources. Build compares saved index/manifest/provenance pins and still validates
the approved candidates' closure digests; changed pins require a new plan.

Supply approved_local_graph with canonical paths/digests, provenance, fresh UTC
checked_at, validation_exit 0, coverage_exit/state and project_ids. Use project
state APPROVED_LOCAL and full graph-admission --local-index reports. Coverage gaps
remain warnings; only verified ELIGIBLE build candidates enter tracks. Local helper
reports have graph_sha null and explicit local_graph pins; do not invent a Git SHA
for uncommitted files. Preserve full local scope snapshots in report evidence.
Before B3, obtain a fresh local admission report even if main has not moved.
Forward the explicit flag and absolute owner/pins through dispatch, land, pr-loop
and review-comments. Host support below is unchanged.

## Local wave metadata stays local

With an explicitly approved local graph, never open a separate PR for the wave
run, its plan, shared-literal contract or bookkeeping. A2 still scans agreements;
store them in `RUN_A.literals`, keep `RUN_A.contract` null and skip A3. Each A4
plan receives those exact agreements. The human approves that snapshot with the
plans; implementation and any required product regression tests belong in the
ticket PRs. A new product interface or scope change still needs its own normal
authorization; a local snapshot cannot supply it.

Run B uses the approved literals directly, with no contract merge prerequisite.
When literals exist, B2 writes their `{literal, files}` projection to a temporary
JSON file outside the repository and runs the same seam checker against the
built branches in legacy mode. Missing, incomplete or mismatched seam evidence
blocks legacy review. Streaming verifies the approved local agreements after
review at exact reviewed heads and withholds readiness on mismatches. `wave.contract_dir` is unnecessary in this mode. Repeat `--local-graph`
on build and retain the existing graph pins and plan approval checks.
Published-graph waves retain the contract PR procedure below. Older local Run A
records that already contain a published contract retain their merge check;
run a new plan to use the local-only handoff.

## Project-level orchestration design

For the requested single Ultracode coordinator and one persistent Desktop session
per ticket, resolve the physical stack root as described in Invocation below and
read `<stack-root>/ORCHESTRATION.md`; do not follow a lexical symlink-relative link.
It is an experimental specification, not an additional wave mode. This skill
still uses the two human checkpoints below; it does not automatically approve
plans, preserve one Desktop session across stages or advance to another wave.

## Configuration

Read the consuming repo's `.agents/stack.yml` first (CONVENTIONS §2).
Read every composed procedure by physical path, never copy its rules here.

- `wave.max_review_rounds`: missing/null → default 3, announce it. Earlier
  review-loop evidence found rounds 3–5 dealing with interactions among fixes;
  three bounds one wave's unattended work, leaving later decisions human.
- `wave.review_concurrency`: missing/null → default 1, announce it. Concurrent
  reviewer processes share an account's quota window. Both keys must be positive
  integers; malformed values refuse with the exact key.
- `wave.selection_limit`: missing/null → 12; positive integer. Refuse requests
  above the configured bound, never clamp to a display ceiling. This is batch
  capacity, not a local-test concurrency budget.
- `wave.execution_mode`: missing/null → `legacy`. `streaming` is an explicit
  experimental opt-in; other values refuse. Read `references/execution.md`
  for scheduling, enforcement limits and the pilot gates before enabling it.
- `wave.worker_concurrency`: missing/null → 3; positive integer. Bounds A4
  planners, legacy B1 builds, and streaming ticket controllers through B1 and
  B3 together.
- `wave.test_concurrency`: missing/null → 1; positive integer. Expensive local
  gate commands use canonical `core/land/bin/with-slot`. This is a host-wide
  cooperative process limit; project test scope and CI authority remain unchanged.
  Announce the resolved mode and all worker/reviewer/test budgets.
- `wave.contract_dir`: missing/null → permitted for a local graph or when A2 is empty; otherwise
  refuse naming `wave.contract_dir`. No defensible project-neutral location exists.
  When set, require a relative directory contained in the repo; reject traversal,
  absolute paths and symlink escape before launching the graph.
- `gates.lint`, `gates.test`, `ci.checks`, `identities.maintainer`,
  `identities.reviewer`, `identities.implementer`: missing/null → refuse naming
  the exact key before graph execution. Pass review settings and workspace contracts through unchanged.
  `scope_doc` and `workspace_contract` must be readable for plan/build; named
  procedures own their remaining configuration and status checks.

## Host support

Read `hosts/HOSTS.md`. Claude Code supplies the Workflow tool. On Codex, run
A1 only: read `tools/linear/next/SKILL.md` and follow it top to bottom in parallel
mode with the supplied milestone/project/count tokens and every
`--accept-overlap <PR#>` and --accept-graph-update / --local-graph occurrences unchanged. PLAN_ONLY candidates
appear in the separate planning queue. Render both queues, all exclusions and
capacity counts, then say **the graph did not run**; no dispatch, tracker write,
contract or build. A Codex build invocation refuses because approval cannot
restore a missing tool.
The graph's policies remain prompt-level; absence of Workflow on Codex is
**tool-list-enforced**. The offline harness checks control flow, not live tools.

## Procedure

New plans use version 2 selection. Read next's `references/selection.md`, collect
its complete observation packet and run `next/bin/assess-candidates` first.
Use its returned normalized input and assessment; never hand-author graph checks
from project coverage or treat merge-only holds as start prerequisites.
Pass `selection_version: 2` and `selection_snapshot` to Workflow. Match requested
N, command tokens, `wave.selection_limit` (default 12), main SHA and observation
time to this invocation. A1 must return the helper's exact build and planning
membership. Retain every outcome, warning and unfilled-slot explanation.

Planning-only candidates require plan-transition graph reports and live plan
admission; build tracks still require build reports. Dispatch planning-only work
in a separate lane, with no code edits or build command. Version 2 Run A records
keep these plans outside `--approve all`; later build eligibility requires fresh
selection and approval. Legacy Run A records retain their old membership.


1. Parse the stage and flags. For plan, accept the milestone, repeated `--project`,
   `--parallel`, repeated `--accept-overlap <PR#>`, --accept-graph-update pairs
   or one --local-graph. Before constructing args or
   starting Workflow, validate each PR flag value with `^[1-9][0-9]*$`.
   For --accept-overlap, verify OPEN and complete live-diff evidence using
   next's **Accepted file overlaps** procedure. For --accept-graph-update,
   use the publication contract's exact-head graph-coverage procedure. Otherwise refuse and quote the
   value (or `<missing>`); do not report EMPTY. Deduplicate this read-only
   preflight while preserving all selection tokens. `/next` checks again in A1.
   For build, accept `--approve`, repeated --accept-graph-update or one --local-graph; reject `--accept-overlap` as unknown. Reject other unknown flags,
   nonpositive N, absent build approval, or an approval list containing unknown/stopped issues. N defaults
   to `/next`'s documented 3; announce the resolved count. Resolve repo root and
   fetched default branch for implementation; use its remote-tracking ref.
   Graph admission independently audits literal main under the shared contract;
   a moved SHA triggers a fresh audit, not automatic wave cancellation.
2. Read `tools/linear/wave/references/records.md`. Resolve the physical installed
   skill directory with `cd <installed-wave-directory> && pwd -P`, then its stack
   root. Build absolute `paths` to canonical `wave`, `next`, `dispatch`, `land`,
   `pr_loop`, `records` and `seam_check` files. If any is unreadable, stop.
3. Build JSON `args`: `stage`, `repo_root` (absolute physical path), `default_branch` (fetched
   remote-tracking ref), `gates`, `identities`, `wave`, full `stack_config`, `paths`,
   `date` (caller-supplied ISO date), unique `wave_id` and invocation `run_id`.
   Scripts have no filesystem access and cannot acquire the time. Pass gate
   commands and physical paths explicitly; never include tokens or secrets in args.
   Pass these settings rather than asking the script to infer
   them. For plan, `selection` is an array of tokens, e.g.
   `["any", "--project", "Project name", "--parallel", "3", "--accept-overlap", "479", "--accept-overlap", "470"]`.
   Pass every overlap flag and value occurrence unchanged, preserving order and
   repeats; `/next` owns deduplication and validation.
   When flags are present, also pass `accepted_prs`, the deduplicated preflight
   snapshots: `{number, title, author, state, head_sha, changed_files, files}`;
   `author` is the login string, `head_sha` is `headRefOid`, and `changed_files`
   is `changedFiles`. `files` keeps one entry per REST file record, retaining only
   `filename` and, for renames, `previous_filename`. These are transient caller
   args, not new record fields. A4 uses
   their intersections with each track's `file_scope` for its read-only preflight
   before dispatch §1; a merged or closed PR does not stop unrelated tracks.
4. For build, obtain the exact returned Run A record from the human's checkpoint
   handoff and pass it as `args.plan_record`, plus `args.approve` (`"all"` or an
   issue-id array). Validate against RUN_A, including unique ids, plan/track
   coverage, absolute verified worktrees and STOPPED evidence. Record the user's
   exact approval and wave id. Do not infer approval from a prior plan invocation
   or use `resumeFromRunId` to transport data across Claude sessions. If the
   record is unavailable, recover its durable checkpoint before asking or planning again.
   Before Workflow, query each approved branch/worktree and its open/merged PRs.
   Supply transient `args.recovery` entries for the approved tracks with
   `issue_id`, exact `branch`/`worktree`, current UTC `checked_at`, `evidence`,
   `state: ABSENT|PR_OPEN`, and `result` (null for ABSENT, verified TRACK_RESULT
   for PR_OPEN). ABSENT requires a successful complete lookup, never an API error.
   For an existing open PR, verify its current head, acceptance evidence and gates
   at that head. Reuse prior same-head gate evidence; if unavailable, run lint and
   changed-file tests only, without implementing, committing, pushing or duplicating
   the PR. Merged/closed PRs, conflicts, dirty/foreign worktrees or unknown evidence
   stop that track with the exact reason; do not label them ABSENT. The script
   reuses a verified PR_OPEN result and skips B1. This works on an ordinary build
   retry without a special resume flag. Do not infer new implementation approval.
5. For both stages, obtain fresh `graph_publication` evidence and any
   `accepted_graph_updates` snapshots or `approved_local_graph` observations under
   the shared publication contract. Local mode uses complete live candidate/closure
   evidence against the pinned owner files and preserves local scope snapshots.
   For plan preserve graph flag/value tokens in `selection`; for build populate
   `graph_update_flags` only from the human's current build invocation. Reject
   malformed/missing values and unreviewed/invalid PR graphs before Workflow;
   unrelated PR coverage gaps stay warnings. In plan, reject known missing or
   blocked selected closure evidence before Workflow; if A1 nevertheless returns
   an invalid selected track, stop the planning invocation before A3 writes.
   In build, missing or blocked closure evidence stops only that approved track,
   preserving independently audited siblings.
   Supply full `graph_admission` helper reports for candidate groups. Evaluate
   each selected/approved issue's ELIGIBLE build state and relevant closure;
   UPDATE_REQUIRED is a warning, never project-wide exclusion. Project-less tracks
   remain exempt. Require valid UTC checked_at on args.date. Carry main/graph SHA,
   full admission evidence, exact local delta and digests into the existing
   record.evidence array. Ticket nodes receive a clearly marked projection of
   their candidate and closure, with source pins and fresh-read requirements;
   the projection is not a complete helper report. Moved pins require fresh audits and changed
   relevant conditions stop only affected build tracks. Planning nodes stop the
   planning invocation when conditions change before contract publication.
   Build tracks in both runs match validated build-transition reports; the separate
   planning lane matches plan-transition reports. Run B
   validates stored reports using Run A's publication SHA/date, then compares
   each candidate's graph and factual closure digests before implementation.
   Prefer `semantic_closure_graph_digest` and `semantic_closure_evidence_digest`
   when the saved candidate contains them; current semantic evidence is then
   mandatory. Older checkpoints retain their original digest comparison and do
   not become invalid solely because kstack upgraded. For repair publication,
   use the corresponding saved `semantic_published_closure_*` pair when present.
   When a local repair becomes published, compare its saved
   `published_closure_graph_digest` and `published_closure_evidence_digest` with
   the fresh published candidate digests. These describe the repair's own
   closure, excluding its temporary origin audit. Both saved digests must be
   valid and equal; a missing digest requires a new plan audit for that track.
   Same-mode local audits still compare full origin closures; reverse mode
   transitions require a new plan. An accepted graph reaching main is permitted
   with fresh evidence. Pending graphs still require this invocation's explicit
   flags and exact-head review. Unrelated graph changes never veto siblings.
   B1 and B3 receive each track's explicit Run A baseline, main/graph pins and
   both candidate digests. B1 verifies Run A's main is an ancestor of fetched
   main; unchanged candidate conditions permit a merged contract or unrelated
   main commit. Preserve both runs' observations and changed field values in
   stop evidence. Re-read full relevant scope sections, including exclusions;
   matching citation text alone does not establish scope applicability.
   Full rationales and source explanations remain in the evidence; prose rewording
   and changed coverage counts alone do not invalidate plans.
   A3 rechecks before contract publication; pass the same explicit
   graph flags to composed land, dispatch, review-comments and B3 pr-loop invocations. These
   fields are transient args, not extra RUN_A/WAVE_REPORT schema keys.
6. Call the Workflow tool with `scriptPath` equal to the physical
   `workflow/wave.js` inside the resolved wave directory and the JSON `args`.
   Whether paths outside the session directory work through an installed symlink
   is unverified. If the tool rejects the path **before execution**, read that
   same file and pass its contents as the tool's `script` input, with identical
   args. Do not retry a partially executed run under a new input mechanism.
   Claude verifies path support on the first live run.
7. Render the returned record. Attach the tool's actual run id if it allocates
   one; preserve the caller invocation ids for Run B. Keep the complete Run A
   JSON available in the checkpoint handoff. Atomically persist both RUN_A and
   WAVE_REPORT JSON beneath `<git-common-dir>/kstack/waves/<wave-id>/<run-id>.json`,
   using filesystem-safe encoded IDs and exclusive per-run paths, and report the
   paths. These local checkpoints grant no new approval. Remote PRs and verified
   worktree bindings are the recovery source if an interrupted build returned no
   WAVE_REPORT. Never truncate stopped, skipped,
   sequenced or already-active issues. Agent nulls/exceptions become explicit
   stopped records or a wave refusal, with logs and evidence.

**Internal node rule:** A2, A3, B2, B4 and B3 admission read this skill only for their
assigned scan, contract, seam or admission operation below. The numbered caller
procedure, including the Workflow invocation, is caller-only: a node never
recursively invokes it. A2 reads issues/scopes and returns literals; A3 prepares
only the contract and its test via land; B2 runs seam-check and verifies questions;
B3 admission only observes. All are prompt-level.
B4 reads this skill only for read-only final agreement verification described
in `references/execution.md`; it never invokes a wave or fixes a ticket.

Run A selects (A1), scans shared literals in issue descriptions and scopes (A2),
then, only for published graphs when necessary, prepares a contract PR (A3)
before dispatch plans (A4). Local graphs follow **Local wave metadata stays local**.
The contract is `<contract_dir>/<wave-id>.json`, a JSON list of `{literal, files}`,
plus a test in the consuming runner that asserts those strings. A3 uses its own
branch/worktree and reads `core/land/SKILL.md` top to bottom. JSON provides exact
literals without Markdown escaping and a stdlib-readable input to seam-check.
A4 reads `tools/linear/dispatch-implementation/SKILL.md` top to bottom using its
`--plan-only` node rule. No separate executor is launched.

Run B first consumes the caller's read-only recovery evidence. Existing verified
PRs skip implementation and proceed to seams/review. Only tracks proven to have
no PR enter B1 in the dispatch worktrees. Each B1 node
reads the dispatch lifecycle and land procedure by reference, verifies any
contract PR actually reached the fetched default branch, rebases, then builds
only the approved plan. In legacy mode, after all B1s, B2 runs the deterministic
`tools/linear/wave/bin/seam-check` against the built branches, contract and fetched
base. It emits a literal × branch × file table; nonzero exit or absent evidence
blocks affected tracks. No shared literals and no contract → B2 does not run
and the report says so. Local literals require B2 even with `contract: null`.
B3 reads `tools/github/pr-loop/SKILL.md` top to bottom with the round cap and
parses its existing verdict report. Legacy B3 uses a rolling queue bounded by
review concurrency. Streaming starts each ticket's B3 as soon as its B1 opens
a PR, forwarding separate paid-review and local-test permits.
Before every project-linked track's pr-loop, a read-only B3 admission node returns
READMISSION with fresh full Linear and scope evidence, even if main did not move.
Always verify main ancestry, merge-tree against the actual PR head, and a fresh
build-transition graph-admission report. Reports must be no later than the
observation, no older than one hour and no earlier than Run B's audit. Preserve
canonical identity and the selected candidate's digests. An accepted graph PR
that reached main is audited on main; remove its obsolete flag from composed
commands. A still-pending graph needs this invocation's explicit flag and the
same reviewed exact head. Unavailable evidence blocks only that track before a
paid review, with rounds 0; refresh it without demanding approval for no change.

B3 passes the Run A baseline and fresh source/flags to canonical pr-loop. Refresh
admission at every round and before fixes. Unrelated main movement permits
continuing after fresh ancestry, merge and condition checks. The loop's own
verified fix commits advance its expected head after guarded pushes; foreign
head changes still stop. These per-round observations are prompt-level, while
the B3 entry comparison is checked by the script. Project-less tracks remain
exempt from graph admission. Do not use Workflow worktree isolation: it would
lose dispatch context.

After every review loop completes, B4 reads actual remote heads, same-head
configured reviewer markers and final CI evidence. CLEAN requires a matching
reviewed head. Update each result's head observation and run deterministic seams
again against the immutable final head SHAs. FINAL_CHECK contains heads and, in legacy mode, the
raw SHA-keyed seam table; the script maps rows back to tracks. Missing/duplicate
heads, changed unreviewed heads, absent rows or mismatches block the affected
track. A pre-review seam success cannot certify code changed by review fixes.
For local shared agreements, B4 uses the same temporary contract projection as B2;
a null published contract never skips final seam verification.
B4 is read-only, including for terminal review verdicts.
Streaming FINAL_CHECK verifies all remote heads and their same-head review/CI
evidence. Connected shared obligations then use FINAL_EVIDENCE at exact reviewed
heads, with local/remote tip checks and participant-specific seam rows. Independent
tickets retain readiness without waiting for unrelated agreement groups.
See `references/execution.md` for scheduling and final agreement details.

All node policy guarantees — no merge, human approval, tracker boundaries,
canonical composition, truthful worktree use and refusal on ambiguity — are
**prompt-level**. The approval filter, stopped/mismatch review filters and the
B3 admission comparison are script checks verified by the offline harness, not
tool restrictions on agents; the B3 admission observation itself is prompt-level.
No-merge is prompt-level, backed by harness case 9's script/prompt scan. The seam
checker is deterministic evidence, not a hook. Contract verification, gates and
read-back still depend on nodes faithfully following the canonical procedures.

## Checkpoints

1. Run A returns `AWAITING_APPROVAL`, plans, any published contract PR and the exact Run B
   invocation plus JSON handoff. Human reads plans, merges the contract PR if
   present, then invokes `/wave build --approve <ids|all>`. Local graph use also
   requires repeating --local-graph explicitly. One decision per wave;
   unapproved and stopped tracks remain visible. A3's contract work is the only
   preapproval code write; track implementation permission requires this checkpoint.
   If no plan is PLANNED, Run A returns STOPPED with a null build_command instead.
2. Run B returns `WAVE_REPORT`. Human may merge CLEAN PRs and decides every
   BLOCKED, ROUNDS_EXHAUSTED, STOPPED and SEAM_MISMATCH track. No further wave is
   selected automatically. These are prompt-level checkpoints, not hook guards.

## Refusals

Missing Workflow support → A1-only plan degradation, or build refusal. Missing
approval/Run A record, invalid required config, missing project-filter support,
unknown ids, published-graph shared literals without `wave.contract_dir`,
an unmerged/missing published contract,
unreadable canonical procedures or dispatch refusal → report and stop with
evidence. Headless land stops rather than waiting. Stopped builds never enter B3;
legacy seam mismatches also stop before review. Streaming final mismatches stop
readiness after review (script checks). No tracker authorship beyond dispatch's own
started/in-review ledger/write/read-back transitions (prompt-level).

## Output

Return RUN_A or WAVE_REPORT as defined in the records reference, with run ids,
approval list, final state/evidence per track, seam table, every open question and
next human action. Checked questions carry verified/stale plus sibling-tip
citations; unchecked questions remain explicitly unverified for the human.
With accepted-overlap flags, the unchanged Workflow records keep each track's
overlaps in `PLAN.risks`. SELECT/RUN_A do not retain `/next`'s unused-PR or
excluded-candidate overlap reports, including EMPTY runs; say so explicitly.
Direct `/next` and Codex's A1-only output retain those reports.
With N=3, Run A normally uses 6 agents (3+N with contract), or 5 without A3;
Run B uses 11 (3N+2 with B2 and B4), or 10 without B2: one B1, one B3 admission and one B3
review per project-linked track. Project-less tracks have no admission node.
One final B4 node is included. Recovered PRs omit their B1 nodes.
Counts are before stopped-track reductions.
Local graphs skip A3 but still run B2 when shared literals exist.
There is no implicit retry past terminal review verdicts.
