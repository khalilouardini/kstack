# Experimental streaming execution

Set `wave.execution_mode: streaming` in the consuming stack config to opt in.
The default remains `legacy`. Both modes preserve selected membership, explicit
plan approval, fresh admission, review identity/round caps and human merge.
Codex still cannot run the Claude Workflow graph.

## Budgets and scheduling

`worker_concurrency` (default 3) bounds planners, and bounds the entire approved
ticket path from build through review in streaming mode. Queue excess tickets
in the script before launching an agent. A ticket opens its PR and immediately
enters readmission/review; it does not wait for slower builds. Once its path
finishes, the next approved ticket can start. Legacy reviews also use a rolling
queue instead of fixed batches.

`review_concurrency` (default 1) limits paid reviewer processes in streaming
mode. Pass `--review-slots N` through every pr-loop round to `run-review`.
The helper acquires a POSIX file-lock permit immediately before the paid process,
rechecks current head, route and already-submitted review after waiting, and
releases the permit when that process exits. Fixes and CI waits happen outside
the permit. The existing loop controller keeps its round count and findings;
this is not a new resumable controller or a change to CLEAN/CI semantics.
Permit waiting has a separate 7200-second default from the reviewer's
1800-second process timeout. Expiry returns `SLOT_WAIT_TIMEOUT`/75 before any
paid review. Pr-loop reports `verdict: BLOCKED` with
`block_reason_code: SLOT_WAIT_TIMEOUT` and unchanged paid-round count; wave
preserves that code in the track's review record. Retry in a later invocation
after a fresh head/route check.

`test_concurrency` (default 1) bounds configured expensive lint/test/build commands
via `core/land/bin/with-slot --group local-tests --limit N -- <argv...>`.
Pr-loop forwards `--test-slots N` to review-comments, so fix-round lint and test
gates use the same group as land's build gates.
For shell gate commands, explicitly supply the shell and `-c` argument. The
wrapper never interprets argv itself and returns the command's exit code.
Its permit wait defaults to 7200 seconds; exit 75 means the gate never ran
because the queue wait expired, so it is retryable rather than a gate failure.
Exit 78 with `with-slot: refused:` on stderr means permit setup or command launch
failed before the gate ran. Report and correct the setup error before retrying;
it does not consume a gate repair attempt. Require both the diagnostic and the
status, since a child command may itself return 78.
The wrapper changes concurrency only: user/project restrictions on full tests
still apply. Release the permit before review or CI waiting.

Permits live under `${KSTACK_STATE:-$HOME/.kstack}/slots`, shared across repos.
Review groups use actual engine plus a hash of the verified reviewer account;
local tests share one group. Callers must use the same state root. Conflicting
limits on an active group refuse rather than silently raise its allowance.
Locks release on process exit; the command inherits the descriptor so losing
its wrapper does not release its permit while that command remains alive.
Detached descendants that close inherited descriptors are outside this mechanism.

Limits are enforced by the helper for commands routed through it. Routing all
commands through it remains **prompt-level**; unrelated/manual sessions are not
automatically limited. This is not a global process supervisor. Worker limits
bound ticket controllers, not every subprocess or transient readmission agent.

## Final agreement evidence

Streaming B3 returns `reviewed_head` for CLEAN, the exact final commit covered by
independent review and CI. Missing head evidence becomes BLOCKED. Shared literal
participants come from the approved `SHARED_LITERAL.tracks`; absent participants
conservatively means all selected tracks. Open questions have no structured
dependency list yet, so their checks observe all selected tracks and block their
owning ticket until verified. A stopped/unapproved required participant never
disappears from the agreement.

After reviews, FINAL_CHECK re-reads every active PR head and its same-head
configured reviewer/CI evidence in both modes. Streaming also requires that head
to equal B3's exact `reviewed_head`; unavailable or moved evidence blocks the
affected track. Recovered PRs enter this path without rerunning implementation.

Streaming B4 then checks connected groups through FINAL_EVIDENCE. It checks local
and GitHub heads before and after checking
agreements and runs `seam-check` against the final reviewed SHAs, not the B1 heads.
Use `--expected-heads` with a JSON branch-to-SHA map and `--participants` with a
literal-to-branch-list map. Deduplicate identical contract entries and union
participant lists for identical literals. The helper pins the fetched base and
all branch refs, returns `{base_sha, heads, table}`, and errors if refs move.
The script requires complete per-file rows and exact expected head observations.
Group failures withhold readiness for their owners; unrelated tickets can finish.
Literal presence alone does not certify behavioral acceptance.

Independent CLEAN tickets emit `ticket_ready` before unrelated paths finish.
Those events are observations at their reviewed head, never merge authorization
for a later head. Human merge still requires the existing current-head checks.
Final group verification is batched after the run's reviews; it does not yet
start separate B4 agents as individual groups finish.

## Evidence and rollout

Node prompts carry configuration plus one ticket's plan, worktree and relevant
candidate/closure facts. Full original reports remain in the returned audit
record. A projection is explicitly marked, and must not be passed off as a
complete admission-helper output or used to skip a required fresh read.

`WAVE_EVENT` JSON log lines carry schema version, sequence, run/wave IDs, event
type and node/ticket label. They expose scheduling order and readiness without
copying prompts or issue bodies. Workflow has no clock: these events do **not**
claim elapsed durations. Preserve native host timestamps when exporting them;
timestamping a completed log export does not measure node execution time.
`run-review` separately reports monotonic permit-wait and reviewer-process seconds.
These include provider waits inside the process, not just model compute; they
are not token/cost measurements. Preserve this report in the review evidence.

Offline tests cover unequal build/review completion, rolling slot reuse, bounded
workers, narrowed prompts, final-head drift, missing participants, real Git seam
checks and real process permits. They prove control flow, not live performance.

This implements PR #44's independently deliverable scheduling changes. Persistent
plan/build/fix sessions, crash-recovery journal, deterministic CI waiter and
content-addressed evidence cache remain separate host-controller work. Do not
pretend Workflow supports a resume API or choose that adapter from CLI help alone.
Before implementing that adapter, run the design's disposable host probe proving
exact session identity, Plan-mode approval transition, actual permissions/models,
interruption recovery and duplicate-controller exclusion. Before changing defaults,
run the paired pilot against legacy wave and both manual baselines, with identical
membership and gates, recording CI/human/provider waits, tokens and memory load.
No measured speedup or manual-dispatch parity is claimed by these changes.
