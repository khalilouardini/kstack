# Changelog

## 0.2.0 — 2026-08-24

Added `dispatch-implementation`: an approved issue gets one isolated branch and
worktree, then an automatic unstarted-to-started Linear transition with mandatory
read-back before a plan-only executor can launch. The transition is deliberately
bounded to an invocation carrying an exact issue identifier; completion and merging
remain outside the dispatcher.

## 0.1.0 — 2026-08-21

First release. Twenty skills and four role contracts, extracted from the OGUR
harness and generalized, with the router pattern and two `PreToolUse` hook
scripts adapted from [gstack](https://github.com/garrytan/gstack).

**Numbers that matter** — `bin/check-stack`: 23 documents, 5 scripts, 0 failures.
`bin/install --dry-run`: 19 skill directories link into a host; the four role
contracts are dispatched as subagents rather than invoked, so they are not linked.

### Added
- `router/stack` — situation-phrased routing rules plus disambiguation matrices
  for the review and decide clusters.
- `core/` — `careful` and `freeze`/`unfreeze` (hook-enforced on Claude Code),
  `investigate`, `health`, `land`, `explain-diff-html`.
- `roles/` — `product-manager`, `tech-lead`, `designer`, `qa`, and the `spec`
  and `triage` pipelines.
- `tools/github/` — `review-comments`, `pr-loop`, `review-claude-pr`,
  `delivery-retro`, `session-titles`.
- `tools/linear/` — `next`, `linear-steward`, `linear-feature-intake`,
  `linear-release-audit`.
- `.agents/stack.yml` as the per-project configuration seam, with a
  missing-key policy that asks or refuses but never defaults.
- `bin/install` (symlinks for Claude Code, generated pointers for Codex),
  `bin/check-stack`, `hosts/HOSTS.md`, `docs/skill-map.html`.

### Fixed
- `core/freeze/bin/check-freeze.sh` denies on an empty payload when a boundary
  is set. It reached that branch only with a boundary configured, and a
  `PreToolUse` hook always receives one — so empty stdin meant a broken
  invocation, and allowing it let an upstream wrapper that swallowed stdin
  disable the boundary with no error anywhere.
- `roles/spec` and `roles/designer` disagreed on the blocking token: designer
  emits `⚠ DESIGN-SPEC CONFLICT`, spec waited for `⚠ DESIGN-CONTRACT CONFLICT`
  and would never have recognised a conflict stop. Aligned on designer's.
- `tools/github/pr-loop` kept its ledger under `XDG_STATE_HOME` instead of the
  `KSTACK_STATE` root this repo declares. All state references now agree.
- `gates.typecheck` and `gates.build` are read by `/health` but were missing
  from the schema, so `/health` documented keys nobody could discover.
- `core/freeze/bin/check-freeze.sh` resolves the deepest **existing** ancestor
  before comparing against the boundary. Resolving only the immediate parent
  left a path unresolved whenever its subdirectory did not exist yet, so on any
  system with a symlinked ancestor (macOS `/tmp` → `/private/tmp`) creating a
  file in a new subdirectory *inside* the boundary was wrongly denied.

### Fixed in review (kstack#1, Codex round 1)
- `bin/install --host codex` refused nothing when the destination skill
  directory was a **symlink**: `mkdir -p` accepted it and the pointer was
  written outside `CODEX_HOME` entirely. Reproduced, then blocked — the
  installer now refuses a symlinked `$dir`/`$file` and verifies the resolved
  path stays under the destination.
- `validate_explanation.py` tested `srcset` **once, anchored**, so only the
  first candidate was checked. `local.png 1x, https://cdn/x.png 2x` passed the
  offline gate with a live CDN dependency. Each comma-separated candidate is now
  validated, and `imagesrcset` is covered too.
- `hosts/HOSTS.md` called `version` the pointer drift detector, but
  `bin/install` never emitted `version` into a pointer and `bin/check-stack`
  never looked at the pointer tree — the promised mechanism did not exist. Both
  halves are now implemented; the check caught all 20 installed pointers on its
  first run.
- `core/land` claimed a chained `&&` sequence was atomic against a sibling
  session switching branches. It is not: each command is a separate process. The
  claim is corrected to what chaining actually buys (shell state within one tool
  call), with per-session worktrees named as the only real isolation.
- `session-titles` rewrote the Codex session index from a snapshot, which loses
  any line Codex appended in between — atomic rename prevents a torn file, not a
  stale one. Now requires a quiescent writer plus a compare-and-swap on
  size/mtime before the rename.

### Deliberately not ported
gstack's `autoplan` and `ship` auto-decide pipelines. The gate agents exist to
decline; a pipeline that answers their questions for them removes the constraint
they were added to supply.
