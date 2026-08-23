# kstack

A personal agent harness that travels across projects. Twenty skills and four
role contracts, each defined once, pointed at by every host and every repo that
uses them.

**Start here:** [`router/stack/SKILL.md`](router/stack/SKILL.md) routes any
request to the right skill. [Skill map (visual)](docs/skill-map.html) shows the
same thing as a filterable board.

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
| [`/next`](tools/linear/next/SKILL.md) | Reads the board and recommends exactly one thing to pick up | Inventing a ticket; any write |
| [`/linear-feature-intake`](tools/linear/linear-feature-intake/SKILL.md) | Turns a scope verdict into the right tracker records | Forming a verdict of its own |

The four **role contracts** are dispatched as subagents, not invoked as slash
commands: [`product-manager`](roles/product-manager.md) (one verdict, cited,
defaults to OUT), [`tech-lead`](roles/tech-lead.md) (reuse-vs-build delta,
half-day estimate, refuses to estimate what it cannot name),
[`designer`](roles/designer.md) (surface contract from existing components),
[`qa`](roles/qa.md) (acceptance criteria that are runnable checks).

### Build

| Skill | Does | Enforcement |
|---|---|---|
| [`/investigate`](core/investigate/SKILL.md) | Root-cause debugging: no fix before the cause is found; three failed attempts stops the run; every fix ships a fail-then-pass test | prompt + optional scope lock |
| [`/careful`](core/careful/SKILL.md) | Pre-checks every shell command. Recursive deletes rooted at `/` or `$HOME` and force-pushes to the default branch are denied; the rest asks | **hook** (Claude Code) |
| [`/freeze`](core/freeze/SKILL.md) · [`/unfreeze`](core/unfreeze/SKILL.md) | Locks edits to one directory; a symlink inside the boundary pointing out of it is still blocked | **hook** (Claude Code) |
| [`/explain-diff-html`](core/explain-diff-html/SKILL.md) | Self-contained interactive page teaching a change, validator-gated | bundled validator |

### Review

| Skill | Half of the loop |
|---|---|
| [`/review-claude-pr`](tools/github/review-claude-pr/SKILL.md) | Produces the review — P0–P3 findings as a comment review, marked with the head SHA |
| [`/review-comments`](tools/github/review-comments/SKILL.md) | Answers existing comments — fixes the code, replies as the bot, summary comment last |
| [`/pr-loop`](tools/github/pr-loop/SKILL.md) | Runs both halves unattended, bounded rounds, repeat-finding detector |

The reviewer and the responder post under different identities, which is why no
single skill does both halves.

### Land and operate

| Skill | Does |
|---|---|
| [`/land`](core/land/SKILL.md) | Branch → gates green → atomic commits → PR. Carries the concurrent-session guards. **Stops at the PR** |
| [`/health`](core/health/SKILL.md) | Runs the project's own gates, scores them, reports the trend |
| [`/delivery-retro`](tools/github/delivery-retro/SKILL.md) | Was this period fruitful vs the previous equal period — refuses activity metrics |
| [`/session-titles`](tools/github/session-titles/SKILL.md) | Retitles open agent sessions with their issue key and PR |
| [`/linear-steward`](tools/linear/linear-steward/SKILL.md) | Tracker structural health; mutates only on explicit apply |
| [`/linear-release-audit`](tools/linear/linear-release-audit/SKILL.md) | Audits a release against its gates using tracker + GitHub evidence |

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
hosts/HOSTS.md      what differs between Claude Code and Codex
project-template/   stack.yml + onboarding for a consuming repo
bin/                install, check-stack
docs/               skill map, migration guides
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
