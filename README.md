<img src="docs/gojo.svg" alt="Pixel-art Gojo" width="130" align="right">

# kstack

A personal agent harness that travels across projects. Twenty-six installable skills and four
role contracts, each defined once, pointed at by every host and every repo that
uses them.

**Start here:** [`router/stack/SKILL.md`](router/stack/SKILL.md) routes any
request to the right skill. The [visual guide](docs/skill-map.md) explains the
router, workflow phases, capability tiers, and the decision and review clusters
with diagrams that render directly on GitHub.
The root [project orchestration graph](ORCHESTRATION.md) defines the experimental
Ultracode coordinator, per-ticket sessions and human checkpoints;
[the project template](project-template/ORCHESTRATION.md) carries project-specific conditions.
[`/linear-roadmap`](tools/linear/linear-roadmap/SKILL.md) prepares a typed record
and generates its Mermaid view; `/next` reads its conditions before recommending work.
The [interactive map](docs/skill-map.html) adds filtering when opened locally.

```bash
git clone <this repo> ~/projects/kstack
cd ~/projects/kstack && bin/install            # Claude Code
bin/install --host codex                               # Codex CLI
```

Then per project: copy [`project-template/stack.yml`](project-template/stack.yml)
to `<repo>/.agents/stack.yml` and fill in what applies. See
[`project-template/ONBOARDING.md`](project-template/ONBOARDING.md).

## The idea

Two things stay separate on purpose.

**General skills live here.** They read the consuming repo's `.agents/stack.yml`
for anything project-specific — which document defines scope, which command is
the lint gate, which GitHub account posts review replies. A skill never
hardcodes a project, and never silently defaults a missing key: it asks you, or
it refuses naming the key. A gate that defaults open is not a gate.

**Domain skills stay in their own repo.** Eval harnesses, data-pipeline loops,
product-specific review gates. The rule of thumb: *a skill that names your
product's nouns stays home.* Project skills also shadow stack skills of the same
name, so a repo can always override.

## Catalog

Skills are grouped by where they sit in the work, and a skill lives in the least
capable tier that can run it. `core/` needs nothing but git and the filesystem;
`roles/` needs a scope document; `tools/github/` needs `gh`; `tools/linear/`
needs a Linear workspace.

### Decide — before code exists

| Skill | Does | Refuses |
|---|---|---|
| [`/spec`](roles/spec/SKILL.md) | Product gate: the scope role runs first and alone; only an in-scope verdict fans out to tech-lead + designer, then qa | Spending four agents on an idea that fails the first gate |
| [`/triage`](roles/triage/SKILL.md) | Scores every open PR, branch and worktree against the scope doc; writes a dated proposal | Closing, merging or deleting anything |
| [`/next`](tools/linear/next/SKILL.md) | Recommends one scoped issue or up to five independent tracks across repeated project filters | Inventing a ticket; any write |
| [`/linear-feature-intake`](tools/linear/linear-feature-intake/SKILL.md) | Turns a scope verdict into the right tracker records | Forming a verdict of its own |
| [`/linear-roadmap`](tools/linear/linear-roadmap/SKILL.md) | Creates or updates the product scope contract; maps work, validates JSON and generates Mermaid | Creating tickets, granting scope or launching sessions |

For new work, compose `/spec` → `/linear-feature-intake` → `/linear-roadmap`.
For existing approved tickets, start with `/linear-roadmap`. A simple prompt can
produce a draft graph and scope contract; scope approval and ticket creation remain separate steps.
Every roadmap run checks the product scope contract, updating it or creating one
when needed. The contract explains the project’s purpose, boundaries, release
gates and impact on the whole product; its title and filename are flexible.
The shared lifecycle lives once at the stack root, with a versioned schema and
one indexed manifest containing each repo's projects/subunits. Indexed validation
checks the source pin; `/next` gives plan-only work a planning kickoff and excludes
it from wave batches. The human publishes Linear views manually under workspace
rules. Preparing a roadmap grants no execution permission.

The four **role contracts** are dispatched as subagents, not invoked as slash
commands: [`product-manager`](roles/product-manager.md) (one verdict, cited,
defaults to OUT), [`tech-lead`](roles/tech-lead.md) (reuse-vs-build delta,
half-day estimate, refuses to estimate what it cannot name),
[`designer`](roles/designer.md) (surface contract from existing components),
[`qa`](roles/qa.md) (acceptance criteria that are runnable checks).

### Build

| Skill | Does | Enforcement |
|---|---|---|
| [`/wave`](tools/linear/wave/SKILL.md) | One independent batch through a Claude Code Workflow graph | prompt-level checkpoints; script checks approval/review routing; Codex selection only |
| [`/dispatch-implementation`](tools/linear/dispatch-implementation/SKILL.md) | Starts one approved issue in an isolated worktree and automatically moves it to the contract's started status after the worktree exists | Linear write + mandatory read-back; prompt-level outside the skill |
| [`/investigate`](core/investigate/SKILL.md) | Root-cause debugging: no fix before the cause is found; three failed attempts stops the run; every fix ships a fail-then-pass test | prompt + optional scope lock |
| [`/careful`](core/careful/SKILL.md) | Pre-checks every shell command. Recursive deletes rooted at `/` or `$HOME` and force-pushes to the default branch are denied; the rest asks | **hook** (Claude Code) |
| [`/freeze`](core/freeze/SKILL.md) · [`/unfreeze`](core/unfreeze/SKILL.md) | Locks edits to one directory; a symlink inside the boundary pointing out of it is still blocked | **hook** (Claude Code) |
| [`/explain-diff-html`](core/explain-diff-html/SKILL.md) | Self-contained interactive page teaching a change, validator-gated | bundled validator |
| [`/summarize-change`](core/summarize-change/SKILL.md) | Briefs a change in the session: verdict, decision, behavioral change map, blast radius, what it does not do | prompt-level |

### Review

| Skill | Half of the loop |
|---|---|
| [`/review-claude-pr`](tools/github/review-claude-pr/SKILL.md) | Produces the review — P0–P3 findings as a comment review, marked with the head SHA |
| [`/review-comments`](tools/github/review-comments/SKILL.md) | Answers existing comments — fixes the code, replies as the implementer, summary comment last |
| [`/pr-loop`](tools/github/pr-loop/SKILL.md) | Runs both halves unattended, bounded rounds, repeat-finding detector |

The reviewer (Codex by default) and implementer (Claude by default) use separate
machine identities, while the human maintainer retains governance and merge
authority. That three-way split is why no single skill does both halves or
merges on its own.

### Land and operate

| Skill | Does |
|---|---|
| [`/land`](core/land/SKILL.md) | Branch → gates green → atomic commits → PR. Carries the concurrent-session guards. **Stops at the PR** |
| [`/health`](core/health/SKILL.md) | Runs the project's own gates, scores them, reports the trend |
| [`/delivery-retro`](tools/github/delivery-retro/SKILL.md) | Was this period fruitful vs the previous equal period — refuses activity metrics |
| [`/session-titles`](tools/github/session-titles/SKILL.md) | Retitles open agent sessions with their issue key and PR |
| [`/sweep-schedules`](tools/github/sweep-schedules/SKILL.md) | Sets up recurring title and label sweeps; every three hours by default |
| [`/pr-label-sweep`](tools/github/pr-label-sweep/SKILL.md) | Adds milestone, area and client labels to open PRs from configured rules; add-only |
| [`/linear-steward`](tools/linear/linear-steward/SKILL.md) | Tracker structural health; mutates only on explicit apply |
| [`/linear-release-audit`](tools/linear/linear-release-audit/SKILL.md) | Audits a release against its gates using tracker + GitHub evidence |
| [`/follow-builders`](tools/external/follow-builders/SKILL.md) | Vendored from [zarazhangrui/follow-builders](https://github.com/zarazhangrui/follow-builders): AI-builders digest, in-chat / Telegram / email. Needs `node`; `npm ci` in its `scripts/` once |

Run `/sweep-schedules` once in the consuming repository to enable both sweeps
through the desktop scheduler. Use `--hours 4` to change the cadence or
`--sessions-only` / `--labels-only` to limit scope. Label scheduling requires
`pr_labels.rules`; title scheduling requires supported desktop session tools.
Installing or merging the skill does not activate a schedule.

## What this stack refuses

Inherited deliberately from the repo it was extracted from, which once carried
27 open PRs, 80 unmerged branches and 55 worktrees — every one of which started
as a good idea. The missing constraint was never idea generation.

- **No auto-decide pipeline.** Nothing chains reviews and answers their
  questions for you. Reviews surface decisions; you make them.
- **`/land` stops at the PR.** Merging is a human decision.
- **The scope gate defaults to OUT.** An idea with no citation argues its way in.
- **A merged PR is not gate evidence.** Shared verbatim by the retro and the
  release audit.
- **Activity metrics are never scores.** Commits, lines and PR counts are refused.
- **No acceptance criterion without a runnable check.**

## Repo layout

```
router/stack/       the router — read this first
core/               git + filesystem only
roles/              gate contracts + the spec and triage pipelines
tools/github/       needs gh
tools/linear/       needs a Linear workspace
tools/external/     vendored third-party skills (follow-builders: needs node)
hosts/HOSTS.md      what differs between Claude Code and Codex
project-template/   stack.yml + onboarding for a consuming repo
bin/                install, check-stack
docs/               GitHub-rendered visual guide, interactive map, migration guides
```

[`CONVENTIONS.md`](CONVENTIONS.md) is the contract every file here follows.
`bin/check-stack` machine-checks the checkable parts.

## Credits

The role-gate agents, evidence-first review discipline and refusal defaults come
from the OGUR harness. The router pattern, the two `PreToolUse` hook scripts,
`/investigate`'s no-fix-before-cause rule, `/health`'s scoring and the forcing
questions inside the product gate are adapted from
[garrytan/gstack](https://github.com/garrytan/gstack) (MIT). gstack's
auto-decide pipelines are deliberately not ported — see the refusals above.

### Select parallel work across projects

```text
/next --project "Road to MVP-2" --project "MVP-2 stretch" --project "MVP 2.3" --parallel 5
```

`next` resolves project IDs, verifies membership, and selects one combined batch.
Each track keeps its own milestone authorization and reports its project and gate.
Active release work breaks ties between equally large independent batches. The
skill only proposes separate branch/worktree kickoffs; it creates nothing. Without
project filters, `/next any --parallel 3` still selects one milestone.
