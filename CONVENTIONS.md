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
stack-level skills of the same name.

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
issue_prefix: <PREFIX|null>     # e.g. OGUR — session-titles, next
gates:                          # `lint` + `test` are the two any skill may assume.
  lint: <cmd|null>              # must pass before any commit/push claim
  test: <cmd|null>              # fast suite
  test_full: <cmd|null>
  typecheck: <cmd|null>         # additional keys are permitted and are scored by
  build: <cmd|null>             # /health; only lint + test gate a push
review_gate:
  skill_path: <path|null>       # project "prove the bug" review skill (e.g. review-engine)
  scope: <glob|null>            # diff paths that trigger it
identities:
  maintainer: <gh-login|null>   # human owner: governs and merges
  reviewer: <gh-login|null>     # review agent; Codex by default
  implementer: <gh-login|null>  # implementation agent: opens PRs, fixes, replies
protected_branches: []          # fnmatch globs (`demo/*`) matched against the
                                # branch name; triage may never propose CLOSE for one
role_appendix_dir: <path|null>  # per-role project appendices (traps, factories, gates)
spec_output_dir: <path|null>
```

**Missing-key policy — never silently default.** A skill that needs a key and
does not find it either asks the user (interactive judgment calls) or refuses
with the exact key name (gates and identities always refuse — a gate that
defaults open is not a gate).

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
- Composition by reference: "Read `<path>` with the Read tool and follow it
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
