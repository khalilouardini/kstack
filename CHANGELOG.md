# Changelog

## Unreleased

Vendored `follow-builders` (zarazhangrui/follow-builders @ 6df06d7) under a new
`tools/external/` tier for third-party skills. Frontmatter gained `version`,
`upstream`, and the `(kstack)` suffix so `bin/check-stack` covers it; the body is
upstream's verbatim. Feed JSON and the feed-generation workflow are not vendored
because `scripts/prepare-digest.js` fetches them from upstream `main`.

Added a GitHub-rendered visual guide for the router, workflow phases,
capability tiers, and the decision and review clusters. The README now links to
this guide first while retaining the filterable HTML map as a local interactive
view.

`pr-loop` now pins the review model and reasoning effort on every `codex exec`
round instead of inheriting `~/.codex/config.toml`. New `review_model` block in
`.agents/stack.yml` (`slug`, `effort`, `escalate_above_lines`,
`escalated_effort`) with `--model` / `--effort` invocation overrides. Default is
`gpt-5.6-terra` at `medium`, escalating effort — not tier — above 400 changed
lines. This is the only stack.yml block that defaults rather than refuses; the
resolved pair is stated in the preflight and the final report.

## 0.3.0 — 2026-08-24

Replaced the ambiguous two-account review configuration with three explicit
GitHub roles: `identities.maintainer`, `identities.reviewer`, and
`identities.implementer`. Codex is the default reviewer and Claude the default
implementer. Review API calls now use verified per-command `GH_TOKEN`
credentials instead of `gh auth switch`, so concurrent Codex and Claude
sessions cannot change which account publishes another session's review or
reply. This is a schema-breaking change from `stack: 1` to `stack: 2`.

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

### Fixed in review (kstack#1, Codex round 2)
- `core/careful` hard-denied `rm -rf $HOME` but only **asked** on
  `rm -rf /Users/me` — the same deletion, decided by spelling, and the resolved
  absolute path is what an agent actually emits. The HIGH tier now compares
  against the resolved `$HOME`. Same class of gap on force-push:
  `HEAD:refs/heads/main` fell to the ask tier while `HEAD:main` was denied;
  `refs/heads/` is now normalized before the comparison.
- `bin/install --host codex --uninstall` `rm -rf`'d the whole skill directory
  after checking only `SKILL.md`, destroying any sidecar file a user had put
  there — verified by losing a `user-notes.txt`. It now removes the generated
  pointer and `rmdir`s only if that left the directory empty.
- `bin/check-stack` walked canonical skills only, so a removed or renamed skill
  left its Codex pointer installed and never inspected. Added `pointer-orphan`,
  which walks the installed tree too.
- `tools/linear/next`'s GraphQL fallback filtered on state alone, returning
  every team's open issues in a multi-team workspace. It now resolves the
  consuming team and refuses the fallback when it cannot.
- Two round-1 fixes overshot and were corrected: `core/land` claimed git branch
  state does not survive between shells (it does — `HEAD` is in `.git`; only
  env and `cd` are lost, and chaining is a concurrency mitigation, unnecessary
  in an isolated worktree), and `session-titles` required *no* Codex session to
  be running, which made the feature unusable from `codex exec` — its own
  documented host. It now excludes the invoking session and refuses on others.

### Fixed in review (kstack#1, Codex round 3)
- `core/careful` denied `rm -rf /` and `//` but only asked on `///`, `////`,
  `/.` and `/./` — all names for the same filesystem root. Enumerating spellings
  cannot keep up, so targets are now normalized (repeated separators collapsed,
  `/.` components dropped) before the tier is decided.
- `core/freeze` with a boundary of `/` denied **everything**: `_resolve_path /`
  produced `///`, and the prefix test then built `//` and matched nothing — the
  exact inversion of what was configured.
- `validate_explanation.py`'s offline gate scanned `fetch`/XHR/WebSocket but not
  ES module loading, so `import("https://cdn…")` and
  `import x from "https://cdn…"` passed while the delivered page fetched a
  remote module at load time.
- `delivery-retro`'s freshness guard treated an old fetched tip as proof of a
  stale checkout. A successful fetch already proves the ref is current, so an
  old tip means a *quiet period* — the guard was refusing to report the
  zero-delivery window it was asked for, contradicting its own acceptance
  scenario. It now blocks only on a failed fetch or a tip newer than "today".
- `review-comments` capped every review surface at one page with no `pageInfo`,
  so on a long PR an unanswered thread past page 1 was indistinguishable from
  one that did not exist — while the skill still posted its summary. All
  surfaces now paginate to exhaustion or stop.
- `roles/triage` fetched `--limit 100` open PRs while promising a disposition
  for every one, silently omitting the remainder from all totals.
- `core/land`'s example still showed a bare checkout→add→commit chain,
  contradicting the prose that calls the branch and staged-path assertions the
  guarantee. The example now performs both assertions before committing.

### Fixed in review (kstack#1, Codex round 4)
- `core/careful` still classified by string shape, so `rm -rf /tmp/../*` — which
  the shell expands over exactly the entries `rm -rf /*` does — reached the
  overridable ask tier. Targets are now **lexically canonicalized** (`.` and `..`
  resolved textually, never via the filesystem) before classification, which is
  what finally ends a gap that recurred in three consecutive rounds.
- `core/land` called its pre-commit assertions a guarantee. They are not:
  `test` and `git commit` are separate processes, so the check is
  time-of-check-to-time-of-use. The skill now requires an isolated worktree for
  anything that commits, and where a shared worktree is unavoidable it says the
  assertions narrow but cannot close the race — and that the report must say so.
- `delivery-retro`'s executable pre-flight still set `warn-fetch-failed` and
  proceeded, contradicting the round-3 rule that a failed fetch must stop. The
  branch and the skip list now match the rule.
- `validate_explanation.py` matched only single-line import spellings, so a
  multiline `import {\n x \n} from "https://…"` and
  `import(/* webpackIgnore */ "https://…")` still passed. Scripts are now
  comment-stripped and whitespace-collapsed before the offline scan — while a
  comment merely *containing* `https://` still passes.
- `review-comments` exposed `pageInfo` on `reviews` but gave it no cursor, so
  every iteration refetched the same first 100 summaries; and the copy-paste REST
  commands still omitted `--paginate` the prose required.
- `roles/triage` Step 0 reported `--limit 200` as if it were the backlog count.

### Fixed in review (kstack#1, Codex round 5)
- `core/careful` matched the literal string `git push`, so
  `git -C /repo push -f origin main` — an ordinary invocation — was **allowed
  outright**, not even asked. Both tiers now locate the subcommand *after* git's
  global options, handling `-C`, `-c`, `--git-dir=`, `--no-pager` and `sudo`.
- `validate_explanation.py`'s comment stripper (added in round 4) removed
  comment-like text inside string literals, so
  `const a="/*"; fetch("https://x"); const b="*/";` had its real `fetch` erased
  and the page passed. Replaced with a string-aware scan: only true comments are
  removed, string contents are preserved verbatim.
- `delivery-retro` consumed `$DEFAULT_BRANCH` six times and never assigned it,
  so the documented preflight ran `git fetch origin ""`, took the new
  round-4 block path, and aborted every retro in a repo with an origin.

### Known and deliberately not fixed
- `validate_explanation.py` accepts **local** asset references (`./app.js`,
  bare filenames) in a page the skill promises is self-contained. Real, but a
  new check rather than a regression, and one that risks rejecting legitimate
  same-document references — left for a future change rather than added under
  review pressure. Tracked in kstack#1 round 5, finding 4.

### Deliberately not ported
gstack's `autoplan` and `ship` auto-decide pipelines. The gate agents exist to
decline; a pipeline that answers their questions for them removes the constraint
they were added to supply.
