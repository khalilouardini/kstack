---
name: wave
version: 0.1.0
description: Run one independent Linear batch through a Claude Code Workflow graph, with human plan approval and merge checkpoints. Use when asked to "run one wave", "plan a Linear batch", "build the approved wave", or "/wave plan|build". (kstack)
---

# wave — one batch, two human decisions

## When to invoke

A wave is the set of mutually independent issues selected by `/next --parallel`.
Build and human-merge this wave before selecting the next one. Invoke:

```text
/wave plan [<milestone-id>|any] [--project "<p>"]... [--parallel N]
/wave build --approve <comma-separated-issue-ids|all>
```

Invoking this skill explicitly opts into calling the Claude Code Workflow tool,
as required by that tool's user opt-in rule. No Workflow execution is implicit
in an ordinary `/next` invocation. Project filters depend on the canonical
`next` supporting repeatable `--project`; if it does not, refuse that option
and name the dependency. Do not approximate selection rules.

## Project-level orchestration design

For the requested single Ultracode coordinator and one persistent Desktop session
per ticket, read the stack-root [ORCHESTRATION.md](../../../ORCHESTRATION.md).
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
- `wave.contract_dir`: missing/null → permitted only when A2 is empty; otherwise
  refuse naming `wave.contract_dir`. No defensible project-neutral location exists.
  When set, require a relative directory contained in the repo; reject traversal,
  absolute paths and symlink escape before launching the graph.
- `gates.lint`, `gates.test`, `identities.maintainer`, `identities.reviewer`,
  `identities.implementer`: missing/null → refuse naming the exact key before
  graph execution. Pass review settings and workspace contracts through unchanged.
  `scope_doc` and `workspace_contract` must be readable for plan/build; named
  procedures own their remaining configuration and status checks.

## Host support

Read `hosts/HOSTS.md`. Claude Code supplies the Workflow tool. On Codex, run
A1 only: read `tools/linear/next/SKILL.md` and follow it top to bottom in parallel
mode with the supplied milestone/project/count tokens. Render that selection
and say **the graph did not run**; no dispatch, tracker write, contract or build.
A Codex build invocation refuses because approval cannot restore a missing tool.
The graph's policies remain prompt-level; absence of Workflow on Codex is
**tool-list-enforced**. The offline harness checks control flow, not live tools.

## Procedure

1. Parse the stage and flags. Reject unknown flags, nonpositive N, absent build
   approval, or an approval list containing unknown/stopped issues. N defaults
   to `/next`'s documented 3; announce the resolved count. Resolve repo root and
   fetched default branch; use the remote-tracking ref, not a guessed `main`.
2. Read `tools/linear/wave/references/records.md`. Resolve the physical installed
   skill directory with `cd <installed-wave-directory> && pwd -P`, then its stack
   root. Build absolute `paths` to canonical `wave`, `next`, `dispatch`, `land`,
   `pr_loop`, `records` and `seam_check` files. If any is unreadable, stop.
3. Build JSON `args`: `stage`, `repo_root` (absolute), `default_branch` (fetched
   remote-tracking ref), `gates`, `identities`, `wave`, full `stack_config`, `paths`,
   `date` (caller-supplied ISO date), unique `wave_id` and invocation `run_id`.
   Scripts have no filesystem access and cannot acquire the time. Pass gate
   commands and physical paths explicitly; never include tokens or secrets in args.
   Pass these settings rather than asking the script to infer
   them. For plan, `selection` is an array of tokens, e.g.
   `["any", "--project", "Project name", "--parallel", "3"]`.
4. For build, obtain the exact returned Run A record from the human's checkpoint
   handoff and pass it as `args.plan_record`, plus `args.approve` (`"all"` or an
   issue-id array). Validate against RUN_A, including unique ids, plan/track
   coverage, absolute verified worktrees and STOPPED evidence. Record the user's
   exact approval and wave id. Do not infer approval from a prior plan invocation
   or use `resumeFromRunId` to transport data across Claude sessions. If the
   record is unavailable, ask for that record before building anything.
5. Call the Workflow tool with `scriptPath` equal to the physical
   `workflow/wave.js` inside the resolved wave directory and the JSON `args`.
   Whether paths outside the session directory work through an installed symlink
   is unverified. If the tool rejects the path **before execution**, read that
   same file and pass its contents as the tool's `script` input, with identical
   args. Do not retry a partially executed run under a new input mechanism.
   Claude verifies path support on the first live run.
6. Render the returned record. Attach the tool's actual run id if it allocates
   one; preserve the caller invocation ids for Run B. Keep the complete Run A
   JSON available in the checkpoint handoff. Never truncate stopped, skipped,
   sequenced or already-active issues. Agent nulls/exceptions become explicit
   stopped records or a wave refusal, with logs and evidence.

**Internal node rule:** A2, A3 and B2 read this skill only for their assigned
scan, contract or seam operation below. The numbered caller procedure, including
the Workflow invocation, is caller-only: a node never recursively invokes it.
A2 reads issues/scopes and returns literals; A3 prepares only the contract and
its test via land; B2 runs seam-check and verifies questions. All are prompt-level.

Run A selects (A1), scans shared literals in issue descriptions and scopes (A2),
then, only if necessary, prepares a contract PR (A3) before dispatch plans (A4).
The contract is `<contract_dir>/<wave-id>.json`, a JSON list of `{literal, files}`,
plus a test in the consuming runner that asserts those strings. A3 uses its own
branch/worktree and reads `core/land/SKILL.md` top to bottom. JSON provides exact
literals without Markdown escaping and a stdlib-readable input to seam-check.
A4 reads `tools/linear/dispatch-implementation/SKILL.md` top to bottom using its
`--plan-only` node rule. No separate executor is launched.

Run B pipelines approved tracks through B1 in the dispatch worktrees. Each node
reads the dispatch lifecycle and land procedure by reference, verifies any
contract PR actually reached the fetched default branch, rebases, then builds
only the approved plan. After all B1s, B2 runs the deterministic
`tools/linear/wave/bin/seam-check` against the built branches, contract and fetched
base. It emits a literal × branch × file table; nonzero exit or absent evidence
blocks affected tracks. No contract → B2 does not run and the report says so.
B3 reads `tools/github/pr-loop/SKILL.md` top to bottom with the round cap and
parses its existing verdict report; it has no new adaptation. Review concurrency
limits only B3. Do not give Workflow agents `isolation: 'worktree'`: that would
lose the dispatch workspace and its evidence.

All node policy guarantees — no merge, human approval, tracker boundaries,
canonical composition, truthful worktree use and refusal on ambiguity — are
**prompt-level**. The approval filter and stopped/mismatch review filters are
script checks verified by the offline harness, not tool restrictions on agents.
No-merge is prompt-level, backed by harness case 9's script/prompt scan. The seam
checker is deterministic evidence, not a hook. Contract verification, gates and
read-back still depend on nodes faithfully following the canonical procedures.

## Checkpoints

1. Run A returns `AWAITING_APPROVAL`, plans, contract PR and the exact Run B
   invocation plus JSON handoff. Human reads plans, merges the contract PR if
   present, then invokes `/wave build --approve <ids|all>`. One decision per wave;
   unapproved and stopped tracks remain visible. A3's contract work is the only
   preapproval code write; track implementation permission requires this checkpoint.
2. Run B returns `WAVE_REPORT`. Human may merge CLEAN PRs and decides every
   BLOCKED, ROUNDS_EXHAUSTED, STOPPED and SEAM_MISMATCH track. No further wave is
   selected automatically. These are prompt-level checkpoints, not hook guards.

## Refusals

Missing Workflow support → A1-only plan degradation, or build refusal. Missing
approval/Run A record, invalid required config, missing project-filter support,
unknown ids, non-empty A2 without `wave.contract_dir`, unmerged/missing contract,
unreadable canonical procedures or dispatch refusal → report and stop with
evidence. Headless land stops rather than waiting. Stopped or mismatched tracks
never enter B3 (script check). No tracker authorship beyond dispatch's own
started/in-review ledger/write/read-back transitions (prompt-level).

## Output

Return RUN_A or WAVE_REPORT as defined in the records reference, with run ids,
approval list, final state/evidence per track, seam table, every open question and
next human action. Checked questions carry verified/stale plus sibling-tip
citations; unchecked questions remain explicitly unverified for the human.
With N=3, Run A normally uses 6 agents (3+N with contract), or 5 without A3;
Run B uses 7 (2N+1 with B2), or 6 without B2, before stopped-track reductions.
There is no implicit retry past terminal review verdicts.
