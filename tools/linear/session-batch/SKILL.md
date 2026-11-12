---
name: session-batch
version: 0.1.0
description: Supervise one selected Linear batch using independent Claude ticket sessions, one authorization, bounded plan validation and dependency-aware review. Use for delegating several tickets; wave remains an explicit option. (kstack)
---

# session-batch — one supervisor, independent ticket sessions

## When to invoke

Use this as the default when the user asks to delegate a batch of existing issues.
One meta-agent owns the batch, selects once, supervises individual Claude sessions,
and orders reviews from real dependencies. `/next` remains read-only; explicit
`/wave` stays the Workflow-based alternative. An ordinary recommendation request
is not permission to create workspaces, write tracker status, implement, or open PRs.

The user authorizes a bounded batch once: project/milestone scope, maximum workers,
plan-only versus implementation, graph source flags, and permission to open draft
PRs. Repeat any explicit graph-source flags exactly; never infer local-graph or
accepted-PR approval. This is not merge, deployment, scope change, or completion
approval. A plan-only evaluation never starts implementation or review.

## Host capability and current limit

Resolve the physical stack root. Before any write or tracker transition, check that
a trusted host adapter supports the entire requested lifecycle and can bind the
same actual Claude session across plan and implementation. The included Claude
registry adapter only observes session state and deliberately refuses session
creation: background resume can fork a different session and plan-to-build mode
transition has not been verified. Do not bypass that refusal with a prompt, a
mock, or a replacement session. With no capable adapter, offer the ordinary
read-only `/next --parallel` result and separate manual dispatch kickoffs; report
that automatic delegation did not run. Never silently substitute Wave.

## One supervisor and one selection

Read the consuming repo's stack configuration, workspace contract, scope document,
`tools/linear/next/SKILL.md`, `tools/linear/next/references/selection.md`, the
shared graph publication gate, and the canonical dispatch, land, pr-loop and
summarize-change skills. Invoke next once with the explicit scope and capacity;
keep its complete selector input, output, graph pins, tracker facts, ownership and
review-order evidence. For an unmapped in-scope ticket, have the selection collector
build the shared gate's live projection automatically from full issue, blocker,
scope and original authorization evidence. No separate graph PR or user flag is
needed; this is not permission to alter scope or dismiss a human decision. Save the
projection report and its exact delta in the run ledger and forward it to workers.
Report selected IDs and unfilled capacity immediately.
Separate planning advice from startable work. Exclude unresolved scope, blockers,
active ownership, unknown evidence and Backlog/future work from dispatch.

The supervisor creates one durable run using the session-batch controller and a
verified host adapter. Supply cited startability for every selected issue and a
complete, source-backed review graph, including external prerequisites. Default to
three ticket workers and one reviewer, subject to stricter project limits; enforce
a separate cooperative local-test limit and respect the consuming project's CI
policy. The run records the exact selection, original authorization, immutable
source pins, per-ticket session UUID, worktree and branch, plan digest, validation,
PR URL, reviewed head, status and stop reason. Persist and resume this run rather
than starting a second coordinator. Never steal an ambiguous or abandoned claim.

A worker refreshes its issue, scope, dependency, ownership and admission evidence
before workspace/status writes, without repeating the entire selection. Use
canonical dispatch lifecycle and its read-back; resume verified active ownership,
never create a duplicate. Start the exact Claude session in actual Plan mode with
a hard read-only boundary. Do not infer host permission mode from prompt text.

## Controller interface and evidence

`tools/linear/session-batch/bin/session-batch` accepts `--state-root` and a
trusted absolute `--adapter` module. The only valid state root is the real Git
common directory plus `/kstack-session-batch`; use the same root across all
worktrees. `create <input.json>` binds an explicit authorization, `mode`
(`plan_only` or `implement`), issue IDs and maximum tracks, policy limits,
complete selector input and source-backed review edges. A verified adapter must
independently attest authorization, batch dependencies and the review graph.
Read the exact [adapter evidence contract](references/adapter.md) before use.
The controller rejects incomplete proofs and unstartable lifecycle states.
`tick <run-id>` advances one bounded supervisory pass; it is not a daemon.
`queue` and `show` inspect a run. Use `--help` for the individual transition
commands. The meta-agent retains the original authorization and never invents
an evidence receipt to satisfy the adapter interface.

Plan-only is immutable for the run: no direct transition or `tick` may build or
review. A completed plan releases its worker slot only after the same session is
verified idle. Plan validation binds the exact plan, scope, criteria and candidate semantic
closure. When main moves, verify Git ancestry and the actual changed paths, and
require a fresh, source-backed assessment of whether those changes affect that
specific plan or its gates. Preserve the plan only on an independently verified
unaffected result; otherwise hold that track. Record both pins and the assessment.
A deadline leaves an uncertain operation and its claim or slot reserved: it does
not cancel the operation, stop a child, or guarantee the CLI exits. A timed-out
create can still finish later without an uncertainty marker; inspect the run and
host before retrying. Direct library calls have no deadline. Reconcile with the
actual host before any retry. Interrupted validation/build/review recovery is not
automated.

## Plan, implementation and review

Each session produces an acceptance-cited plan naming files, tests, dependencies and
risks. A different validator context checks criteria, file scope, dependencies,
project gates and unresolved decisions. Record PASS, REVISE or HUMAN_REQUIRED;
bind PASS to the plan content, issue criteria, scope evidence and fetched base.
Limit revisions. A batch that explicitly authorizes implementation may proceed
automatically only after PASS and fresh admission, in the same session. A changed
binding requires validation again. Never manufacture human approval. In plan-only
mode return the plan and do not invoke implementation.

On implementation, follow the consuming project's tests and land procedure, open
only the authorized draft PR, then supervise independent exact-head review using
the canonical review loop. Keep the implementation session for any fixes. Release
reviews in prerequisite order: `review_after`, `merge_after`, and other actual
typed requirements constrain affected tracks. Recompute each track's relevant
review closure from a fresh source; a change or cycle in a different track does not
hold an independent review. Unrelated tracks proceed without a global barrier. Recheck prerequisite evidence and PR heads before review;
a changed head invalidates its old review. Bound review rounds and report blocked,
exhausted, or unavailable evidence rather than calling it CLEAN. CI evidence must
match the reviewed head. Apply any shared-interface verification to the affected
tracks' final heads. Never merge, deploy, or close an issue automatically.

When a local issue-graph viewer is configured for this project, the authorized
batch may refresh its derived cache with the candidate admission reports using
`issue-graph refresh --admission-report <report> [--admission-report <report> ...] --apply`. Show unmapped live
issues as UNKNOWN, and mark projected nodes as unpublished observations; a
visualization is never proof of execution or release readiness. A missing viewer
is a warning, not an execution blocker. Never write Linear or alter the canonical
roadmap merely to render the projection.

The supervisor reports selection latency, first session/plan/PR times, per-track
states, actual session/worktree/PR mappings, review order and head evidence, and
unfilled capacity. Surface only actionable decisions during a run; a failed track
does not cancel independent siblings. If the adapter cannot prove a required host
capability, stop that transition and preserve its ledger for recovery.
