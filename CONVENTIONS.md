# kstack conventions

Every skill, role, and doc in this repo follows these rules. `bin/check-stack`
machine-checks the checkable ones.

## 1. Layout

```
router/           — the /stack router skill (navigation spine)
core/<skill>/     — general coding skills; no external service, no project coupling
roles/<role>.md   — gate-agent contracts (product-manager, tech-lead, designer, qa)
roles/<skill>/    — role-pipeline skills (spec, triage)
tools/github/<skill>/   — skills that need gh / a GitHub repo
tools/linear/<skill>/   — skills that need a Linear workspace
tools/external/<skill>/ — vendored third-party skills; frontmatter names the upstream commit
hosts/            — host adapter notes + Codex pointer generation
project-template/ — what a consuming project provides (stack.yml + onboarding)
bin/              — install, check-stack
docs/             — migration guides, deep dives
```

Tier rule: a skill lives in the **least capable tier that can run it**. If it
works with only git + the local filesystem it is `core/`; if it needs `gh` it is
`tools/github/`; if it needs Linear it is `tools/linear/`.

The tier is set by what a skill needs to deliver its **core** value, not by
every optional step. `core/land` is the standing example: branch, gates, atomic
commits and push are all git, and only the final PR step wants `gh`. Without a
forge CLI it stops after push and reports the branch — degraded, not broken, so
it stays in `core/`. A skill that would produce *nothing* without the higher
tier does not get this latitude; it belongs in that tier. Any skill using the
exception must say in its own text what it does when the tool is absent. Project-specific
skills never live here — they stay in the consuming project's repo
(`.claude/skills/` + `.agents/skills/`), and project-level skills shadow
stack-level skills of the same name under the router's policy. This is an
instruction to select the project contract, not a promise that every host hides
duplicate skill names; Codex can display both.

Skill vs script boundary: session-interactive judgment → skill; batch or
deterministic transformation → plain script under `bin/`.

## 2. Per-project configuration — `.agents/stack.yml`

General skills never hardcode a project. Anything project-specific is read from
`.agents/stack.yml` in the consuming repo:

```yaml
stack: 2                        # config schema version
project: <slug>
scope_doc: <path|null>          # scope/priority contract — roles, spec, triage, next
workspace_contract: <path|null> # Linear workspace rules — tools/linear
issue_prefix: <PREFIX|null>     # e.g. OGUR — session-titles, next, pr-label-sweep
issue_graph:                   # local roadmap visualization — issue-graph
  config: <path|null>          # JSON viewer binding; absolute or relative to consuming repo
gates:                          # `lint` + `test` are the two any skill may assume.
  lint: <cmd|null>              # must pass before any commit/push claim
  test: <cmd|null>              # fast suite
  test_full: <cmd|null>
  typecheck: <cmd|null>         # additional keys are permitted and are scored by
  build: <cmd|null>             # /health; only lint + test gate a push
review_gate:
  skill_path: <path|null>       # project "prove the bug" review skill (e.g. review-engine)
  scope: <glob|null>            # diff paths that trigger it
review_model:                   # which model reviews, and how hard — pr-loop only
  slug: <model-slug|null>       # passed to `codex exec -m`
  effort: <low|medium|high|xhigh|max|null>
  escalated_slug: <model-slug|null>  # first-review model when a risk trigger fires
  escalate_above_lines: <int|null>  # optional raw changed-line trigger
  escalate_above_files: <int|null>  # optional changed-file trigger
  escalate_paths: []                # fnmatch globs; any matching changed path triggers
  escalated_effort: <effort|null>
review_engines:                  # account→engine mapping; does not infer from logins
  reviewer: codex                # codex | claude, null/missing → codex
  implementer: claude            # the other engine, null/missing → claude
claude_review_model:             # Claude review rounds only; no Codex flags
  slug: sonnet                  # null/missing → sonnet (alias, not immutable revision)
  effort: high                  # null/missing → high
ci:
  checks: <required|all|none>   # PR checks /pr-loop needs green before CLEAN
identities:
  maintainer: <gh-login|null>   # human owner: opens PRs, governs, merges
  reviewer: <gh-login|null>     # review agent; Codex by default
  implementer: <gh-login|null>  # implementation agent: fixes and replies in a review loop
protected_branches: []          # fnmatch globs (`demo/*`) matched against the
                                # branch name; triage may never propose CLOSE for one
role_appendix_dir: <path|null>  # per-role project appendices (traps, factories, gates)
spec_output_dir: <path|null>
pr_labels:                      # pr-label-sweep only
  rules: []                     # each: label + any of linear_project, linear_label,
                                # paths (fnmatch), text (regex); a rule fires on ANY match
wave:
  selection_limit: 12            # batch-size bound; independent of process limits
  execution_mode: legacy         # streaming is an explicit experimental opt-in
  worker_concurrency: 3          # planners and ticket controllers
  test_concurrency: 1            # cooperative host-wide local-test permits
  max_review_rounds: 3           # announced default when missing/null
  review_concurrency: 1          # announced default when missing/null
  contract_dir: <path|null>      # required for shared literals in published-graph waves
```

`issue_graph.config` points to the JSON viewer binding described in
`tools/linear/issue-graph/references/binding.md`. A saved host-local binding at
`${KSTACK_STATE:-$HOME/.kstack}/projects/<project>/issue-graph.json` also supplies
the installation and workspace mapping when this key is unset. Opening and
inspecting an existing viewer need no tracker access; refresh needs fresh Linear
reads and the indexed roadmap.

`review_model` and `claude_review_model` use announced defaults rather than
refusing. The reason is the asymmetry: an unset gate command silently passes a check that
never ran, while an unset review model can safely use a documented, pinned
default rather than inheriting the host's interactive setting. Refusing there
would cost more than defaulting. The default is `gpt-6.1-sol`/`high`. On the
first review of a PR,
configured risk triggers select `gpt-6-astra`/`high`; later heads return to
the base lane unless `--model` explicitly pins Astra. Raw size triggers are
disabled by default because generated data and fixtures can inflate them.
`--model gpt-6-luna --effort high` is the economy override. The skill states
the resolved model, effort, and where each came from in its report, so the
default is never silent.

The review skills share `tools/github/pr-loop/references/routing.md`: resolve
implementation from complete commit attribution, with a legacy bot-opener
fallback only when no commit signals exist. Explicit --implementation-engine
resolves mixed provenance; absent agent evidence also requires --any-author.
The maintainer opening a PR does not select an engine. Account mapping defaults
preserve the Claude implementation → Codex review flow without changing existing
configuration. The implementation host controls fixes; host mismatch blocks
without automatic delegation. Claude settings never inherit review_model or
--fast. Review reuse requires account, actual engine and exact head evidence.

**Missing-key policy — never silently default.** A skill that needs a key and
does not find it either asks the user (interactive judgment calls) or refuses
with the exact key name (gates, identities and `ci.checks` always refuse — a
gate that defaults open is not a gate).

**Triage reporting exception:** `/triage` reads `identities.maintainer`,
`identities.reviewer`, `identities.implementer` and `ci.checks` as evidence
interpretation inputs, not as authorization for a gate or write. When one is
missing, it names the exact key and marks the affected attribution/assessment
UNKNOWN with an evidence hold; it can retain unrelated scope facts. It never
invents an identity, CI mode, successful gate or merge permission. This exception
does not apply to review, implementation, publication or merge procedures,
which continue to refuse their required missing identities/gates/CI mode.

`wave.selection_limit` defaults to 12 and must be a positive integer. It bounds
batch size without silently clamping requests to five. Shared selection assesses
plan and build separately; this limit does not authorize concurrent full tests.

`wave.execution_mode` defaults to `legacy`; `streaming` opts in to early review
and final-head agreements. `worker_concurrency` defaults to 3 and
`test_concurrency` to 1, both positive integers. These separately bound ticket
controllers and cooperative host-local gate commands. Streaming review permits
cover paid reviewer processes only, releasing capacity during fixes and CI.
See wave's `references/execution.md` for enforcement and rollout limits.

`wave.max_review_rounds` missing/null defaults to 3, announced: observed later
rounds addressed interactions among earlier fixes, so a bounded three-round run
leaves further decisions human. `wave.review_concurrency` defaults to 1,
announced, because concurrent reviewer processes share an account quota window.
Both must be positive integers. `wave.contract_dir` has no project-neutral
default; missing/null with shared literals refuses naming that exact key for
published graphs. Explicit local-graph waves retain agreements in the approved
plan handoff and need no contract directory or separate contract PR.
These defaults bound work rather than invent evidence; gates and identities
continue to refuse when absent.

## 3. Skill file anatomy

- One directory per skill: `SKILL.md` (the procedure) + optional `bin/`,
  `references/`, `fixtures/`. Reference matter is read on demand at the step
  that needs it, never inlined. Hook scripts live in the owning skill's `bin/`
  (`core/careful/bin/` also holds the shared `hook-extract.sh`; `core/freeze`
  sources it by physical path). Scripts resolve their own location with
  `cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P` so they work through the
  `~/.claude/skills/<name>` symlinks the installer creates.
- Persistent state lives under `${KSTACK_STATE:-$HOME/.kstack}` (freeze
  boundary, per-project health history at `projects/<slug>/`), never inside a
  consuming repo.
- Frontmatter: `name`, `version` (semver-ish, bump on behavior change — it is
  the cross-host drift detector), `description`.
- Description formula, in order: one sentence of what it does; `Use when asked
  to "<literal user phrasings>"`; optionally `Proactively suggest when <situation>`;
  ends with `(kstack)`. Hard cap 1024 bytes; target ≤500. The
  description is paid every session — the body only on invocation.
- First body section is `## When to invoke` (routing altitude), then the
  procedure. A reader deciding *which* skill never has to read *how* one works.
- Skills follow the output discipline of the user's global CLAUDE.md: answer
  first, every claim carries its evidence, no coined terms, report failures
  flatly.

## 4. Composition and adaptation

- **One canonical file.** A skill or role is defined once, here. Hosts and
  projects point at it; they never restate the procedure (drift is invisible
  until harnesses disagree).
- Composition by reference: "Read `<path>` and follow it
  top to bottom, skipping sections `[...]`. If unreadable, say so and stop."
- Project adaptation goes in the project's `role_appendix_dir`, not by editing
  the canonical contract. A role contract states exactly where its appendix is
  spliced in.

## 5. Enforcement honesty

For every guarantee, state the mechanism: **hook-enforced** (a PreToolUse hook
blocks the call), **tool-list-enforced** (the capability is absent), or
**prompt-level** (the contract asks and nothing checks). A prompt-level
guarantee must be labeled as such where it is claimed. When the same skill runs
on a host without hooks, the skill's doc says plainly which host enforces and
which merely requests.

## 6. Bias

The stack inherits the gate philosophy it was extracted from: agents that
decide default to **no**; evidence outranks narrative; a merged PR is not gate
evidence; activity metrics (commits, LOC, PR count) are never scores. gstack's
auto-decide pipeline shape (autoplan/ship) is deliberately absent — the
constraint this stack preserves is something empowered to decline.

## 7. Versioning

`VERSION` at repo root is a monotonic release identifier, not a semver
compatibility promise. One `CHANGELOG.md` line per meaningful change; the entry
describes the shipped system, never the branch's internal history, and every
number names its source.

## 8. Documentation maintenance

Keep the README catalog, Markdown skill map, and HTML map aligned with the
canonical skill directories and four role contracts. Add a discovery entry when
adding a skill; link to its procedure instead of copying it. The onboarding
instructions point to the router so new routes have one owner.

`python3 bin/check-docs` verifies catalog coverage, canonical HTML card links,
the HTML header version against `VERSION`, inline Markdown links/images, and
HTML link attributes, including anchors outside fenced examples. It skips
vendored documents and does not fetch external URLs or prove the semantics of shell commands, CI gates,
host restrictions, or Mermaid diagrams. `python3 bin/check-stack` includes this
check and its regression cases alongside the skill, script, and workflow gates.
Review operational claims against their owning contract and verify changing
host capabilities against current official documentation.
