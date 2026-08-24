# Adopting kstack in a project

Six steps, in order. Steps 1–2 are required; 3–6 unlock progressively more of
the suite. Nothing here is destructive — if the project already has its own
copies of these skills, they shadow the stack ones until you delete them, so you
can adopt and verify before removing anything.

## 1. Install the stack

Clone this repo once per machine, then install for each host you use:

```bash
git clone <stack-repo-url> <stack-root>
cd <stack-root>
bin/install                  # claude: symlinks into ~/.claude/skills/<name>
bin/install --host codex     # codex: generated pointer files into ~/.codex/skills/
```

`<stack-root>` is wherever you cloned it; you will need its **absolute path** in
step 3. Install is per machine, not per project — a second project needs only
steps 2 onward.

Read [`../hosts/HOSTS.md`](../hosts/HOSTS.md) before trusting any enforcement
claim on a host other than `claude`. The short version: Codex does not run
`PreToolUse` hooks, so `careful` and `freeze` are prompt-level there.

## 2. Write `.agents/stack.yml`

```bash
mkdir -p <your-repo>/.agents
cp <stack-root>/project-template/stack.yml <your-repo>/.agents/stack.yml
```

Then fill it in. Every key is documented inline in the template; the schema is
CONVENTIONS §2. Leaving a key `null` is a supported state — it turns off the
skills that need it and leaves the rest working.

### Which keys unlock which skills

| You configure | You get |
|---|---|
| nothing — no `stack.yml` at all | `/stack`, `/careful`, `/freeze`, `/unfreeze`, `/investigate`, `/explain-diff-html`. These need no project config. |
| `gates.lint` + `gates.test` | `/land` (gates before commit) and `/health` (scores your own checks). Both **refuse** without them — a gate that defaults open is not a gate. |
| `gates.test_full` | `/health --full`, and `/land`'s full-suite path. |
| `scope_doc` | the four role contracts, `/spec`, `/triage`, and `/next` gating. Without it they ask for the path and still refuse to invent a verdict. |
| `identities.maintainer` + `identities.reviewer` + `identities.implementer` | The GitHub review cluster. Codex normally fills reviewer and Claude implementer; unattended `/pr-loop` requires all three roles. |
| `review_gate.skill_path` + `review_gate.scope` | stack review skills defer to your project's own review gate on the paths it claims. |
| `workspace_contract` | `/dispatch-implementation`, `/linear-steward`, `/linear-feature-intake`, `/linear-release-audit` need the tracker's status and mutation rules. Without it they refuse writes. |
| `issue_prefix` | `/session-titles` labels by issue key, and `/next` resolves issue references. |
| `protected_branches` | `/triage` stops proposing CLOSE on branches that carry unextracted work. |
| `role_appendix_dir` | roles answer with your traps, factories, and component inventory instead of asking for them. |
| `spec_output_dir` | `/spec` writes where you want instead of asking. |

Read the table as a sequence: `gates` first (they cost one line each and unlock
the two skills you run most), then `scope_doc`, then identities, then the rest.

## 3. Create the role adapters

The four role contracts live in the stack at `<stack-root>/roles/<role>.md`.
Your repo provides an **adapter** per role that points at the contract and adds
the host-specific tool list. The adapter never restates the procedure
(CONVENTIONS §4): two copies drift, and the drift is invisible until the hosts
return different verdicts on the same PR.

```bash
mkdir -p <your-repo>/.claude/agents
```

Complete example — `.claude/agents/product-manager.md`:

```markdown
---
name: product-manager
description: Scope gate. Returns exactly one verdict on a proposed feature, PR, or idea, citing the line of the scope doc that justifies it. Defaults to OUT. Use before any spec, estimate, or implementation work — including on your own suggestions.
tools: Read, Grep, Glob
---

# product-manager — Claude Code adapter

This is an adapter, not the contract. The canonical, harness-neutral role
contract is `<stack-root>/roles/product-manager.md`.

**Read that file now and follow it exactly.** Nothing about the role is
restated here, deliberately: every host must consume one file, or their
verdicts diverge without anyone noticing.

## Host-specific notes

- Tools are `Read`, `Grep`, `Glob` only. **No `Bash`** — the refusal is
  enforced by the tool list, not by this prompt, and a shell would defeat it
  (it can write files, run `gh`, and reach a tracker's API).
- Read the document named by `scope_doc` in `.agents/stack.yml` fresh on every
  run. Do not answer from a previous session's memory of it.
- Project specifics come from `<role_appendix_dir>/product-manager.md`, not
  from this file.
```

The other three adapters are the same file with two lines changed — `name` and
`tools` — plus their own canonical path:

| Adapter | `tools:` | Why |
|---|---|---|
| `product-manager.md` | `Read, Grep, Glob` | read-only **by construction** — the capability is absent |
| `designer.md` | `Read, Grep, Glob` | same |
| `qa.md` | `Read, Grep, Glob` | same |
| `tech-lead.md` | `Read, Grep, Glob, Bash` | its contract requires listing open PRs and worktrees; there is no read-only alternative in this harness |

`tech-lead` needs one extra paragraph in its notes, and it must be there:

```markdown
- **This role's read-only refusal is prompt-level, not tool-level.** A shell can
  write files, push, and call APIs; omitting `Edit`/`Write` does not prevent
  that. Stated plainly because the other three roles *are* enforced by their
  tool list, and treating this one as equally constrained would be false.
- **Use the shell only to inspect.** Read-only `git` and `gh` commands and file
  inspection. Never write a file, never commit or push, never a mutating API
  call. If an estimate seems to need one, it does not — refuse the estimate
  instead.
```

Write the **absolute** `<stack-root>` path into each adapter. A relative path
breaks the moment an agent runs from a worktree.

## 4. Optional — role appendices

If `role_appendix_dir` is set, create one file per role there. This is where
project specifics live, and the reason the canonical contracts stay clean:

| File | Carries |
|---|---|
| `product-manager.md` | milestone specifics the scope doc does not spell out |
| `tech-lead.md` | the trap ledger (things that have bitten before), the architecture map, module ownership |
| `designer.md` | the design spec path, the component inventory, known standing conflicts |
| `qa.md` | the test-factory catalog, the current suite baseline, which harness checks which layer |

Each canonical contract states exactly where its appendix is spliced in, and
what it does when there is none. A missing appendix is a **documented
degradation** — the role says so in its output — never a silent one.

Never add project detail by editing a contract in the stack. That is the one
change that breaks every other consuming project at once.

## 5. Paste this into the project's `CLAUDE.md`

Routing should be ambient at session start, not something the agent has to go
looking for. Append:

```markdown
## Skill routing

When a request matches a skill, invoke it rather than answering ad-hoc. When in
doubt, invoke the skill — a false positive costs one skill read; a false
negative costs a workflow's checklists and gates.

Decide, before code exists:
- "should we build X" / "is this in scope" / "spec this" → `/spec`
- "what should I work on next" → `/next`
- "triage the backlog" / "which of these open PRs still matter" → `/triage`
- one narrow question — scope only, how long, which component, what proves it →
  dispatch `product-manager` / `tech-lead` / `designer` / `qa` alone
- a decision already made, needing a record → `/linear-feature-intake`

Build:
- "start this ticket" / "tackle ISSUE-123" / "dispatch this issue" → `/dispatch-implementation`
- "why is this broken" / a stack trace / "it worked yesterday" → `/investigate`
- touching production or anything shared and destructive → `/careful`
- "only edit this folder" → `/freeze`; clear it with `/unfreeze`
- "explain this diff to the team" → `/explain-diff-html`

Review:
- produce a review of a bot-authored PR → `/review-claude-pr`
- answer review comments that already exist → `/review-comments`
- drive review rounds unattended → `/pr-loop`

Land and operate:
- "land this" / "commit and push" / "open a PR" → `/land`
- "health check" / "quality score" → `/health`
- "was this week fruitful" → `/delivery-retro`
- "what is each session working on" → `/session-titles`
- audit or repair the tracker → `/linear-steward`
- audit a release against its gate criteria → `/linear-release-audit`
- unsure which of the above → `/stack`

<!-- Add this repo's own domain skills here — they are not in the stack. -->

Project skills shadow stack skills; domain-specific loops stay in this repo.
```

Keep that last line. It is what stops a session from assuming the stack version
ran when a local skill of the same name shadowed it.

## 6. What does not move to the stack

Leave these in the project repo:

- **Domain skills** — anything that names your product's own nouns: its
  entities, pipelines, data sources, customer artifacts.
- **Eval and benchmark harnesses** — they are coupled to your data, your
  scorers, and your baselines. A general stack cannot hold a number that only
  means something against your corpus.
- **Project review gates** — a "prove the bug" reviewer scoped to your riskiest
  module. Point at it from `review_gate.skill_path` instead of moving it; the
  stack review skills will defer to it on the paths it claims.
- **Project hooks** — a post-edit gate that runs your suite is correctly
  project-local.

**Rule of thumb: a skill that names your product's nouns stays home.**

The test when you are unsure: try to write the skill using only `stack.yml`
keys. If it needs a key that does not exist, the split is wrong and the key
belongs in the schema. If it needs project prose that no key could carry, it is
a domain skill. Both answers are useful; guessing is not.

> **Worked example (OGUR).** The first consumer of this stack moved twelve
> skills and four role contracts out, and kept eight in — every one of the eight
> named a landscape, a pack, a source, or the engine. The full inventory, and
> what changed in each migrated file, is in
> [`../docs/MIGRATION-ogur.md`](../docs/MIGRATION-ogur.md). Read it as an
> example of applying the rule of thumb, not as a checklist for your repo.

## Verify, then delete the old copies

```bash
bin/check-stack          # schema, frontmatter, and cross-host drift
```

Then run one skill per tier you configured — one core skill, `/spec` or
`/triage` if `scope_doc` is set, one GitHub skill if identities are set — and
confirm each one reads your `stack.yml` rather than asking for a value you
already provided.

**Delete the project's own copies of migrated skills only after that.** Until
then they shadow the stack ones, so a stack skill that misbehaves costs you
nothing.

Next action: run step 1 and step 2, then set `gates.lint` and `gates.test` —
they are two lines and they unlock `/land` and `/health`, which are the two you
will run every day.
