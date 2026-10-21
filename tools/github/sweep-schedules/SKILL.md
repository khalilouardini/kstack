---
name: sweep-schedules
version: 0.1.0
description: Schedule session-titles and pr-label-sweep to apply their rules every few hours through the desktop automation tools. Reuses an existing matching schedule; defaults to every three hours. Use when asked to automate these sweeps, run them periodically, or /sweep-schedules [--hours N] [--sessions-only|--labels-only]. (kstack)
---

# sweep-schedules — recurring session titles and PR labels

## When to invoke

Set up recurring sweeps when the user asks for periodic application. Defaults:
both sweeps, every three hours. `--hours N` accepts a positive integer;
`--sessions-only` and `--labels-only` restrict scope and are mutually exclusive.
A request only to change this skill or open a PR does not activate a schedule.
Manual invocations of either sweep remain dry-run by default.

## Establish scope and readiness

Resolve the consuming repository to its stable main checkout, not a temporary
feature worktree. Record its absolute path and GitHub owner/repo. Read its
`.agents/stack.yml`. For labels, require nonempty `pr_labels.rules` and check
`gh` authentication; do not invent label rules to make setup pass. Missing
issue-prefix or tracker tools degrades exactly as in the underlying skills.
For sessions, require the supported desktop list/read/rename tools for at least
one harness. Never schedule recurring rewrites of Codex's private index.
If one selected sweep is unavailable, explain the blocker and ask whether to
schedule only the other; do not silently narrow the requested scope.

Read the selected procedures:

- `tools/github/session-titles/SKILL.md`
- `tools/github/pr-label-sweep/SKILL.md`

Scheduling explicitly authorizes `--apply` on subsequent runs within this scope.
Persist that authorization in the prompt; each run still prints its proposed
table before applying and verifies every change. No extra confirmation is needed
on each tick. Ambiguous sessions remain excluded.

## Create or update one native schedule

Discover the host's `automation_update` tool and use its current schema. On
Codex desktop, use a thread heartbeat by default, attached to this setup chat.
Use a standalone project automation only if the user explicitly requests a new
chat per run or standalone project work; resolve its project id using
`list_projects`. Keep model settings at the user's defaults when supported.
If the scheduler is unavailable, or session tools are unavailable when session
titles were selected (for example in a bare CLI), report the missing capability; do not substitute cron, launchd, an
in-process sleep loop, or direct writes to automation files.

Inspect existing schedules before creating one. On Codex, read the names,
prompts and fields in `$CODEX_HOME/automations/*/automation.toml` (default
`~/.codex/automations/`). Match by canonical repository and selected sweeps,
not just display name. View the match through the tool and update it in place,
preserving unrelated fields and notification preferences. Multiple matches:
ask which to keep, rather than creating another or deleting any automatically.
No match: create an active schedule named `Sweep titles and labels: <project>`
(adapt the name for a single sweep). Express the cadence in the tool's supported
schedule format, equivalent to every N hours, using the user's timezone.
Read back the result with `automation_update` view. Count setup as complete only
if prompt, cadence, scope and active status match; report a mismatch or error.

## Saved run prompt

Replace placeholders with the resolved scope and omit any unselected sweep.
Persist the full prompt through the automation tool, not a raw directive:

> Maintain session titles and PR labels for <owner/repo> at <absolute stable
> checkout>. The user authorized recurring application of these two sweeps.
> On each run, re-read that repository's current .agents/stack.yml and the
> installed session-titles and pr-label-sweep skills, following their canonical
> pointers. Run session-titles --apply using supported desktop tools only;
> restrict sessions to this repository and its worktrees, exclude this chat,
> archived chats and ambiguous associations. Never rewrite session_index.jsonl.
> Then run pr-label-sweep --apply for this repository's open PRs using its
> configured rules. Continue the other sweep if one fails. Print each proposed
> table before its writes, verify changes, and retain the counts and evidence in
> run output. Never invent identifiers, create or remove labels, change code,
> post comments, merge PRs, message other chats, or create more schedules.
> Stay quiet when there are no changes or actionable failures. Notify only for
> applied changes, failures, or required user action. If a blocker repeats
> unchanged, avoid repeating the same notification until its state changes.

Reports name the schedule, repository, selected sweeps, cadence and active
status. Include any capability degradation. Local schedules require the machine
and desktop app to be running; setup is not evidence that a sweep already ran.
Pause, resume, cadence changes and removal use the native scheduler tool only
when requested. See [official scheduling documentation](https://developers.openai.com/codex/app/automations).
