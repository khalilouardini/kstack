# Changelog

## Unreleased

`/pr-loop` 0.9.1: identify the invoking Codex or Claude Code session from
host-provided subprocess markers before creating a ledger and again before a
review. Missing, simultaneous, or mismatched markers block; the route can no
longer certify its own `--host` claim.

`/pr-loop` 0.9.0, `/review-claude-pr` 0.4.0 and `/review-comments` 0.6.0:
bidirectional independent review with commit-based engine provenance, explicit
mixed-authorship selection, and one implementation controller. Add a tested
CLI runner that verifies per-command identity, exact-head submitted review
and inline evidence, catches failures, and keeps Claude/Codex flags separate.
Retain main's model routing, fast mode, graph admission and concurrency guards.
Host permissions are inherited. Deployment and a live authenticated review
remain rollout checks; this does not enable Codex /wave build.

Add --local-graph to wave and composed execution
skills. Explicit local graph use retains fresh candidate/closure, scope, dependency,
evidence and human approval checks without graph publication. Build requires renewed
local approval and matching saved pins; B3 re-audits local files even when main is
unchanged. Preserve source_revision as adoption provenance across stack upgrades.

`/wave` 0.8.0: a B3 review no longer stops before round 1 because main moved
after B1. With the default `review_concurrency` of 1, a later track's review
starts after earlier tracks' rounds, and any merge in that window moved main and
made the node return BLOCKED with rounds 0. A read-only B3 admission node now
observes live main before each project-linked track's pr-loop. When main moved,
it re-runs graph-admission at live main; the script proceeds only when the
validated main is an ancestor, `git merge-tree --write-tree` merges the PR head
cleanly and the candidate graph/evidence digests preserve the approved conditions.
Anything else stays BLOCKED before any write. New READMISSION record.

`/wave` 0.7.0 reconciles per-track admission with compatible stack updates and
repair publication. Saved own-closure graph and evidence digests permit a local
repair to become published while retaining full origin checks during local
execution. Missing or changed relevant evidence stops only the affected track;
unrelated graph changes and independently verified siblings remain admissible.
`/linear-roadmap` 0.6.2 preserves local refresh defaults and source provenance.

Roadmap admission now treats `source_revision` as adoption provenance, rather than
requiring equality with the installed kstack HEAD. `/linear-roadmap` 0.5.1,
`/next` 0.8.2 and `/wave` 0.5.2 use supported index/manifest schemas for
compatibility, so stack upgrades alone need no graph-only repin PR. Dirty source,
unsupported schemas, scope, dependency and approval checks still refuse as before.
Regression fixtures verify unchanged admission across stack updates, preserved
provenance and unrelated coverage warnings.

`/wave` 0.5.2 preserves plan approval across the required contract merge and other
main/graph-PR SHA movement when fresh audits confirm the same effective graph and
approved issue closure. Historical reports are validated against their own pins;
current pending graphs still require explicit flags and exact-head review. Covers
contract plan/build round trips, later-day resumes, graph publication and malformed
historical evidence without relaxing scope, contract or changed-evidence checks.

`/wave` 0.6.2: A1 is told the format of `TRACK.project`. The script matches it
exactly against `graph_publication.projects[]`, but the A1 prompt never named
the format, so an A1 that returned `"MVP 2.1 (<uuid>)"` instead of the bare UUID
stopped Run A with "no unambiguous eligible candidate audit". The A1 prompt and
records.md now require the publication's `project_id` verbatim (or null), and a
stopped Run A records, per failing track, the `project` value and how many
publication projects it matched.

`/linear-roadmap` 0.6.0 refreshes local JSON, orchestration Markdown and scope
files by default; `--publish` explicitly opens or updates the graph PR. Local
mapping does not grant execution admission or alter a running wave's membership.
`/wave` 0.6.0 compares per-candidate graph/evidence closure digests across plan
and build instead of locking approval to the whole graph or main SHA. Unrelated
graph/ticket/main changes preserve approval after a fresh audit; changed or
missing relevant evidence stops only the affected track, not independent siblings.

Add `/update-stack` to refresh the recorded canonical checkout from the remote
default branch, reinstall both host adapters through `bin/install`, and report
source/host/project evidence. Dirty or divergent source checkouts stop updates.
A read-only installation audit detects stale targets/frontmatter, missing or
orphaned adapters, and bounded project-local copies; `--check` never fetches or
installs. Updates are manually invoked, with no schedule or merge hook.

`/wave` Run B no longer refuses because main moved after Run A. When A2 finds
shared literals, B1 requires A3's contract PR on the default branch, so merging
it always moved main and no wave with a contract could build. Run B now decides
on the graph and closure digests it already compared; a changed digest or a
different project still refuses, and B1 verifies
Run A's main is an ancestor of the fetched default branch.

`graph-admission` compares a closure issue's live `prerequisites` once per issue:
the edges into every node sharing its `issue_ref`, in manifest order. A unit and
its human review node with one `issue_ref` could not both match before, so no
such candidate was admissible. Live-dependency drift still refuses.

`/triage` 0.3.1 hardens inventory error handling and review-evidence fixtures,
retains contradictory same-head findings and unknown severities as holds, and
reports ledger/container provenance. Shared project-resolution and complete-file
references are now consumed by both `/next` 0.8.1 and triage. CI discovery names
permission-aware policy/workflow fallbacks and caches base evidence; labels
prefilter costly project mapping with honest exclusion counts. Missing audit
configuration has an explicit reporting-only exception in CONVENTIONS.md.


`/triage` 0.3.0 adds repeatable Linear project filters (union, intersected with
all requested GitHub labels) and evidence for every PR disposition: intent,
state/head/base, CI coverage, posted loop versus derived review status, and a
linked unresolved-thread appendix. Reuses `/next` membership/file verification
and review contracts without running them. Proposals disclose unknown/unstable
reads, all merge candidates in dependency order or independent lanes, and use
exclusive collision-safe output creation. Default remains GitHub-only PR triage;
project lookup fails closed, and branch/worktree passes remain separate.
Synthetic offline fixtures and prompt-reference checks run in `bin/check-stack`;
they do not enforce live agent behavior. Router and README preserve invocation
filters. Refresh adapters through `bin/install --host codex` after deployment.

Add `/issue-graph open|status|refresh` for an installed local roadmap viewer.
Refresh derives views from the indexed JSON and fresh Linear evidence, preserves
typed event conditions and unverified checkpoints, and backs up one workspace
before replacing its caches without changing saved views or notes.

`/pr-loop` 0.6.0: `CLEAN` requires CI. After a finding-free review, step 3a
reads the PR's checks at the reviewed head, waits up to `--ci-wait` minutes
(default 30) for pending ones, and exits `BLOCKED` on a red or timed-out check
instead of `CLEAN`. A head that moves while it waits starts the next round. New
key `ci.checks` (`required` | `all` | `none`) says which checks count; missing →
`/pr-loop` refuses. Buckets come from `gh pr checks --json`, which exits 0 on
pending and failing checks alike (gh 2.89.0), so the exit code is never read.
kstack's own `stack.yml` sets `none`: it has no GitHub CI.

Separate project graph coverage warnings from execution eligibility across next,
wave, dispatch, land, investigate and review workflows. Unrelated missing tickets
no longer freeze mapped work. Add `graph-admission` for pinned candidate/closure
evidence and at most three missing maintenance units within approved scope,
recording main SHA, full live issue evidence and exact node delta without a
preliminary graph PR. Scope, dependencies, release criteria and human gates still
require reviewed publication. Wave retains admission digests through plan/build
and requires fresh candidate evidence before implementation.

`/summarize-change` 0.2.0 briefs a change by its intent instead of its
behavior. The six parts are now intent with its source, approach and the system
constraints it touches, diff vs intent (delivered / beyond intent / short of
intent), sensitive vs mechanical ranges, blast radius, and decision needed.
Intent comes from the tracker issue, the `/spec` file, the PR body, then
commits, in that order; the diff still decides what the code does. An intent
inferred from the diff alone is labelled as inferred. `--tight` emits the same
six parts under per-part caps, at most 250 words, and states how many items each
cap dropped.

Add repeatable `--accept-overlap <PR#>` to `/next` and `/wave plan`: humans may
accept file overlap with named open PRs, recorded in kickoffs and plan risks for
rebasing onto the default branch after a merge, while scope, graph, dependency,
foundation and within-batch checks hold. Complete diff snapshots and caller
preflight preserve refusal reasons; default ranking stays unchanged. Workflow
records carry track risks but omit unused/excluded overlap reports.

Require `/linear-roadmap` to create or update the consuming product’s scope
contract when needed, covering project purpose, boundaries, acceptance gates and
product impact. Preserve approved scope and mark unauthorized changes as drafts.

Add `/linear-roadmap` to prepare reusable project/subunit roadmaps from existing
Linear work, specs or prompts. A versioned JSON contract and stdlib validator
generate Mermaid and check combined event dependencies; `/next` consults these
conditions using live evidence. One machine-readable index names the combined
manifest and checks its source revision. PLAN_ONLY has a planning handoff and is
excluded from wave tracks. Root lifecycle and consuming-project templates keep
shared policy separate from pilot data. Document the missing session
controller and automatic-plan path; existing `/wave` approval remains unchanged.

New `sweep-schedules` sets up recurring session-title and PR-label application
through the desktop scheduler, every three hours by default. Setup reuses a
matching schedule, saves bounded apply authorization, and keeps unchanged runs
quiet. Manual sweep defaults remain dry-run. `session-titles` now prefers the
supported Codex desktop rename API; scheduled runs never rewrite the private
CLI session index. Installation alone does not activate a schedule.

Add `/wave`: a two-run Claude Code Workflow batch with human plan approval, contract seam checks and bounded review; Codex selects only.

Upgrade the default Codex reviewer from `gpt-6-sol` to `gpt-6.1-sol`,
keeping high reasoning effort and the existing Astra escalation and Luna override.

PRs are now opened by `identities.maintainer`, not `identities.implementer`.
`land` binds the maintainer token for `gh pr create`; `dispatch-implementation`
requires the same account instead of whatever global `gh` account is active.
`pr-loop` and `review-claude-pr` treat a maintainer-opened PR with a
`Co-Authored-By: Claude` trailer as the standard agent-built case; the
implementer and reviewer accounts act only once a review loop starts.

New `tools/github/pr-label-sweep`: adds GitHub labels to open PRs from rules in
a new `pr_labels.rules` block of `.agents/stack.yml` — the linked tracker
issue's project or labels, fnmatch globs over changed paths, and regexes over
the PR title, head branch and issue title (never the body). Dry-run by default,
add-only, and it never creates a repo label; managed labels no rule supports are
reported, not removed. Tracker rules are skipped, and the report says so, when
`issue_prefix` is unset or the tracker MCP is not connected.

`pr-loop` now uses `gpt-6-sol`/high for routine independent reviews and
offers `gpt-6-luna`/high as the documented economy override. Optional
first-review risk triggers route to `gpt-6-astra`/high; later heads return to
Sol unless Astra is explicitly pinned. Raw line/file thresholds are disabled
by default, so archived data and fixtures no longer trigger Astra merely by
inflating PR size. Project-specific path globs can opt into escalation.

`session-titles` 0.2.0 takes a Claude session's PR from the `prNumber` that
`list_sessions` reports, and no longer resolves a PR from the branch of a shared
main checkout, where every session reads whatever is checked out now; Claude rows
the app may have resolved that way go to an ambiguous section of the dry-run.
The prefix strip now matches hand-typed `PR#12: ` and `<PREFIX>-3/PR#12 : `
forms, so re-prefixing no longer stacks a second prefix. `--apply` checks each
write with `get_session` and counts a session as renamed only when the title
matches.

`pr-loop`'s reviewer command now ends in `< /dev/null`. `codex exec` reads extra
prompt text from stdin whenever stdin is not a TTY, so a round launched from a
background shell with an open pipe hung on `Reading additional input from
stdin...` without calling the model (4h42m observed on `codex-cli 0.147.0`).

Vendored `follow-builders` (zarazhangrui/follow-builders @ 6df06d7) under a new
`tools/external/` tier for third-party skills. Frontmatter gained `version`,
`upstream`, and the `(kstack)` suffix so `bin/check-stack` covers it; the body is
upstream's verbatim. Feed JSON and the feed-generation workflow are not vendored
because `scripts/prepare-digest.js` fetches them from upstream `main`.

`triage` takes an optional `--label <name>` (repeatable) that narrows the PR
pass to one label partition, for backlogs already split by a milestone label.
Filtering weakens the skill's completeness promise, so the proposal now carries
a mandatory `**Filter:**` header line — `none` when unfiltered — plus the scored
and excluded counts, the truncation assertion moves to the filtered count, and
the branch/worktree tables state that no label reached them. `--label` is a
GitHub PR label only; that path stays GitHub-only. Optional Linear project
filtering is described in the current triage procedure.

New `core/summarize-change`: briefs one change in the session as six fixed parts
— verdict, decision, behavioral change map with `file:line`, blast radius with
observed gate exit codes, what the change does not do, next action. It refuses
file-by-file narration and changed-line counts, and forms no merge verdict. It
is the chat-altitude sibling of `explain-diff-html`, which keeps the deeper
investigation its quiz requires; the router gained an explaining-work
disambiguation table covering both plus `delivery-retro`. Enforcement is
prompt-level — chat text has no artifact to validate.

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
