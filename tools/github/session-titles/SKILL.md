---
name: session-titles
version: 0.1.0
description: Sweep open agent sessions (Claude Code and Codex), resolve the GitHub PR and issue key each one is working on, and prefix each session title so the session list is scannable at a glance. Dry-run by default; nothing is renamed until --apply. Use when asked to "label my sessions", "what is each session working on?", "retitle the agent sessions", or "/session-titles [--apply] [--include-archived]". (khalilou-stack)
---

# session-titles — label sessions with their PR / issue key

## When to invoke

A fleet of Claude Code and/or Codex sessions is open and the session list no
longer says what each one is *for*. Invoke as
`/session-titles [--apply] [--include-archived]`. **Dry-run is the default** —
Phase 1 always runs and prints the proposed diff; nothing is renamed until
`--apply` is passed (either on the invocation or as a confirmation after
reviewing the dry-run table). Not for creating, archiving, or resuming
sessions — this only rewrites titles.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: khalilou-stack
`CONVENTIONS.md` §2):

- **`issue_prefix`** — the issue-tracker key prefix (e.g. a three-to-five letter
  team code). The issue-key regex is `<PREFIX>-\d+`, case-insensitive, and the
  title format is `<PREFIX>-XX / PR#YY / <original>`.
  **Missing or null is a sanctioned degradation, not a refusal**: resolve PR
  numbers only, build titles as `PR#YY / <original>`, and say plainly in the
  report that no issue key was sought because `issue_prefix` is unset.

Missing `.agents/stack.yml` altogether → run in PR-only mode and say so.

This skill is a bulk, cross-tool write to another process's data — cheap to redo
if wrong, but there is no reason not to show the list before touching it.

## Why this needs a harness split, not a shared implementation

Claude Code and Codex sessions live in two systems with no shared API:

| | Claude Code (this app) | Codex CLI |
|---|---|---|
| Enumerate sessions | `mcp__ccd_session_mgmt__list_sessions` | `~/.codex/session_index.jsonl` (one JSON object per line: `id`, `thread_name`, `updated_at`) |
| Session → cwd/branch | `mcp__ccd_session_mgmt__get_session` (worktree/branch fields) | `session_meta.payload.cwd` in the first line of `~/.codex/sessions/<Y>/<M>/<D>/rollout-*-<id>.jsonl` matching the session id |
| Rename | `mcp__ccd_session_mgmt__set_session_title` (supported call) | **No CLI verb exists** (`codex --help`, `codex archive/resume --help` checked on `codex-cli 0.147.0` — only `archive`/`delete`/`unarchive`/`fork`, nothing for title). The title lives in the `thread_name` field of `session_index.jsonl`, which must be edited directly. |

Because of the last row, this skill has two execution paths that converge on the
same resolve-PR/resolve-issue-key logic (§2) but diverge on how they enumerate
and write (§3a/§3b). Run under Claude Code, do the Claude half natively and
shell out for the Codex half (the files are on the same machine). Run under
`codex exec`, do the Codex half natively; the Claude half needs the
`ccd_session_mgmt` MCP tools, which are only available inside a Claude Code
session — if invoked from `codex exec` without that MCP server connected, skip
§3a and say so, don't fail the whole run.

## 1. Enumerate candidate sessions

**Claude Code sessions:** `mcp__ccd_session_mgmt__list_sessions` (pass
`include_archived: true` only if `--include-archived` was given). This already
excludes the current session — do not attempt to rename it from inside itself.

**Codex sessions:** read `~/.codex/session_index.jsonl` line by line (it is
JSONL, not a JSON array — one `json.loads` per line). Without
`--include-archived`, exclude any id that also appears under
`~/.codex/archived_sessions/` (matched by the UUID embedded in the rollout
filename). Skip any line that fails to parse rather than aborting the sweep — a
partially-written last line during a concurrent Codex write is expected, not
corruption.

For each surviving session, resolve its working directory:
- Claude: from `get_session`'s worktree/cwd field.
- Codex: from the `session_meta` event's `payload.cwd` in the matching rollout
  file — read only the first JSON line of that file (it's always
  `session_meta`), never the whole transcript.

If the cwd no longer exists on disk (a worktree that was since removed), still
attempt PR/issue resolution from the session's existing title and the branch
name embedded in the cwd path — do not silently drop it, since a stale worktree
is exactly the case where the title is most likely wrong and most useful to fix.

## 2. Resolve PR number and issue key (shared logic, either harness)

For a session with resolved cwd `$DIR`:

```bash
BRANCH=$(git -C "$DIR" branch --show-current 2>/dev/null)
```

If `$DIR` no longer exists or isn't a git worktree, fall back to parsing
`$BRANCH` out of the cwd path itself — using **the repo's worktree directory
layout, if it has one** (derive the convention from a live `git worktree list`
rather than assuming; if the paths show no consistent branch-derived component,
skip this fallback) — and out of the session's current title.

> **Worked example (OGUR).** Worktree paths were
> `.claude/worktrees/<branch-derived-name>`, so the branch was recoverable from
> the path's last component even after the worktree had been removed.

**GitHub PR**, only if `$BRANCH` resolved and a repo is reachable:

```bash
gh pr list --head "$BRANCH" --state all --json number,title,body --limit 1
```

`--state all` on purpose — a merged or closed PR still identifies what the
session was for, and a stale title is worst right after merge, not before. Take
`number` as `PR#YY`.

**Issue key** (skip this whole step when `issue_prefix` is unset), matching
`<PREFIX>-\d+` case-insensitively, in this priority order — first match wins, do
not merge conflicting keys:

1. Against the PR title/body just fetched.
2. Against `$BRANCH`.
3. Against the session's *current* title. This covers hand-typed sessions where
   the key was written by a human and nothing else carries it.

> **Worked example (OGUR).** `issue_prefix: OGUR` made the regex `OGUR-\d+`, and
> rule 3 was what caught Codex sessions titled `"Review PR #241 for OGUR-64"`.

Do not call the issue tracker's MCP tools (`list_issues` / `get_issue` or their
equivalents) to *discover* the key — only use them to validate one already found
by regex, and skip validation entirely if that MCP server isn't connected in
this session. A plausible-looking `<PREFIX>-\d+` is worth using unverified
rather than dropped.

If neither PR nor issue key resolves, leave the session out of the rename set
entirely — do not invent a prefix from a guess, and do not prefix with a bare
`PR#` or `<PREFIX>-` placeholder.

## 3. Build the new title (idempotent)

```
new_title = "<PREFIX>-{issue} / PR#{pr} / {original}"   # both resolved
new_title = "<PREFIX>-{issue} / {original}"             # issue only
new_title = "PR#{pr} / {original}"                      # PR only (also the whole
                                                        # vocabulary when
                                                        # issue_prefix is unset)
```

Before building it, check whether `{original}` (the session's current title)
**already starts with** the exact prefix that would be produced. If so, this
session is a no-op — exclude it from the diff entirely so re-running the sweep
doesn't pile up duplicate prefixes. If the title carries a *different* stale
prefix (wrong PR number after a rebase onto a new branch, for instance), strip
only a leading `<PREFIX>-\d+ / ` and/or `PR#\d+ / ` combination before
re-prefixing — never touch text after the first non-prefix token.

## 3a. Apply — Claude Code sessions

```
mcp__ccd_session_mgmt__set_session_title(session_id, new_title)
```

One call per session in the confirmed rename set. Report any call that errors
(e.g. the session was closed between dry-run and apply) rather than treating it
as fatal to the whole sweep.

## 3b. Apply — Codex sessions

There is no supported write path, so this is a direct, minimal edit to
`~/.codex/session_index.jsonl`, done carefully because Codex itself may be
running and appending to this file concurrently:

1. Copy `~/.codex/session_index.jsonl` to a timestamped backup next to it
   (`session_index.jsonl.bak-<epoch>`) before touching anything.
2. Read the file, and for each line whose `id` is in the confirmed rename set,
   replace only the `thread_name` value — leave `id` and `updated_at` untouched,
   and leave every non-matching line byte-for-byte as-is.
3. Write the full result to a temp file in the same directory
   (`~/.codex/.session_index.jsonl.tmp`) and `os.replace`/`mv` it over the
   original — an atomic rename, not an in-place edit, so a crash mid-write can't
   leave a half-written index. **`mkstemp`-style temp files land with `0600`
   permissions instead of the original's mode — `chmod` the temp file to match
   the original's mode before the rename**, or the atomic write silently
   tightens permissions on a file this skill does not own.
4. This is a best-effort, undocumented mechanism against another running
   application's private state file, not a supported API. State that plainly in
   the report back rather than presenting it as equivalent in reliability to the
   Claude Code path. If a future Codex version changes the file format or adds a
   real rename command, prefer the real command and delete this step.

## Output

Always show the dry-run table first, one row per session that will change:
`harness | session/id | old title | new title`. Then, only after `--apply`
(given up front or confirmed after reviewing the table):

- Count renamed per harness, count skipped (no PR/issue resolved), count
  already-correct (no-op).
- Any errors per session, without aborting the rest of the sweep for one
  failure.
- Whether the run was in PR-only mode because `issue_prefix` was unset.
- For the Codex path specifically, the backup file path it wrote before editing.

## Safety / scope invariants

Every invariant here is **prompt-level** — nothing in the harness blocks a
violating write — except invariant 2 on the Claude Code side, where
`list_sessions` excluding the current session is enforced by the tool itself.

1. **Dry-run first, always.** Never write a title without the table having been
   shown first, in this same invocation or a prior one that's being explicitly
   confirmed.
2. **Never rename the current session.** `list_sessions` already excludes it on
   the Claude side (tool-enforced); the Codex side must exclude its own
   `CODEX_SESSION_ID`/rollout id the same way if invoked from inside
   `codex exec` (prompt-level).
3. **Never invent a PR or issue number.** A session with no resolvable PR and no
   resolvable issue key keeps its current title, full stop.
4. **Never touch the archive** unless `--include-archived` was explicitly
   passed.
5. **Codex `session_index.jsonl`: backup before write, atomic replace, preserve
   the original file mode, and preserve every unrelated line and field
   exactly.** This file has no schema doc and no official write API — treat it
   as fragile, not as a database this skill owns.
