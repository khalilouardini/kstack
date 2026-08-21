# Changelog

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
- `core/freeze/bin/check-freeze.sh` resolves the deepest **existing** ancestor
  before comparing against the boundary. Resolving only the immediate parent
  left a path unresolved whenever its subdirectory did not exist yet, so on any
  system with a symlinked ancestor (macOS `/tmp` → `/private/tmp`) creating a
  file in a new subdirectory *inside* the boundary was wrongly denied.

### Deliberately not ported
gstack's `autoplan` and `ship` auto-decide pipelines. The gate agents exist to
decline; a pipeline that answers their questions for them removes the constraint
they were added to supply.
