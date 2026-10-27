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

After changes merge into the shared stack, `/update-stack` refreshes that
recorded installation once for both hosts. `/update-stack --check` reports its
source SHA and adapter status. Project-local copies remain separate; the audit
reports them without deleting them. Do not rerun adoption/configuration steps
in every project just to refresh the shared skills.

`<stack-root>` is wherever you cloned it; you will need its **absolute path** in
step 3. Install is per machine, not per project — a second project needs only
steps 2 onward.

Read [`../hosts/HOSTS.md`](../hosts/HOSTS.md) before trusting any enforcement
claim on a host other than `claude`. Kstack's Codex pointers register no guards,
so `careful` and `freeze` are prompt-level in this integration. Check that the
host discovers the generated pointers; current Codex discovery paths and hook
support are documented in the host notes.

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
| nothing — no `stack.yml` at all | `/stack`, `/careful`, `/freeze`, `/unfreeze`, `/investigate`, `/explain-diff-html`; `/summarize-change` also briefs a local branch or range, with available intent evidence. |
| `gates.lint` + `gates.test` | `/land` (gates before commit) and `/health` (scores your own checks). Both **refuse** without them — a gate that defaults open is not a gate. |
| `gates.test_full` | `/health --full`, and `/land`'s full-suite path. |
| `scope_doc` | the four role contracts, `/spec`, `/triage`, and `/next` gating. Without it they ask for the path and still refuse to invent a verdict. |
| `identities.maintainer` + `identities.reviewer` + `identities.implementer` | The GitHub review cluster. `/pr-loop` requires all three, resolves authorship, and assigns the opposite engine to review; the Claude-implementation/Codex-review route is the default. |
| `ci.checks` | `/pr-loop`'s `CLEAN` verdict: which PR checks must be green at the reviewed head (`required`, `all`, or `none`). `/pr-loop` refuses without it. |
| `review_model` + `claude_review_model` + `review_engines` | `/pr-loop` resolves the reviewer engine and pins its model and effort. Missing settings use the documented, announced defaults in the template. |
| `review_gate.skill_path` + `review_gate.scope` | stack review skills defer to your project's own review gate on the paths it claims. |
| `workspace_contract` | `/dispatch-implementation`, `/linear-steward`, `/linear-feature-intake`, `/linear-release-audit` need the tracker's status and mutation rules. Without it they refuse writes. |
| `issue_prefix` | `/session-titles` labels by issue key, and `/next` resolves issue references. |
| `issue_graph.config` | `/issue-graph open` and `status` use an existing local viewer; `refresh` also needs the indexed roadmap and fresh Linear reads. A saved host-local binding under `${KSTACK_STATE:-$HOME/.kstack}/projects/<project>/issue-graph.json` also works. See [the binding format](../tools/linear/issue-graph/references/binding.md). |
| `protected_branches` | `/triage` stops proposing CLOSE on branches that carry unextracted work. |
| `role_appendix_dir` | roles answer with your traps, factories, and component inventory instead of asking for them. |
| `spec_output_dir` | `/spec` writes where you want instead of asking. |
| `wave.max_review_rounds` + `wave.review_concurrency` + `wave.contract_dir` | `/wave` bounds review and stores shared contracts; rounds/concurrency have announced defaults. Published-graph waves need a contract directory for shared literals; local-graph waves retain them in the approved handoff. Claude Code executes the Workflow graph; Codex selects only. |
| `wave.selection_limit` + `wave.execution_mode` + `wave.worker_concurrency` + `wave.test_concurrency` | Set selection capacity, opt into experimental streaming, and bound worker and local-test concurrency separately. See the template and `/wave` for defaults and pilot conditions. |
| `pr_labels.rules` | `/pr-label-sweep` proposes labels from existing repository labels. Apply is explicit. `/sweep-schedules` can schedule the sweeps when desktop session tools and label rules are available. |

Read the table as a sequence: `gates` first (they cost one line each and unlock
the two skills you run most), then `scope_doc`, then identities, then the rest.

For `/pr-loop`, use `ci.checks: required` when the base branch defines required
checks, `all` when it has CI but no required checks, and `none` only when it has
no CI. Configure local tests according to the project's own instructions;
`CLEAN` includes the configured CI result at the reviewed head, while `none`
is reported explicitly. This does not grant merge permission.

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

## 5. Add a routing pointer to the project instructions

Routing should be ambient at session start, not something the agent has to go
looking for. Add the following to `CLAUDE.md` for Claude Code or `AGENTS.md`
for Codex, replacing `<stack-root>` with the absolute installed path:

```markdown
## Skill routing

Read `<stack-root>/router/stack/SKILL.md` and apply its routing rules.
Matching project rules below take precedence. If the same skill name exists
in this project and the stack, read the project contract explicitly.
On a host without slash invocation, read the selected canonical SKILL.md.

<!-- Add this repo's own domain skills here — they are not in the stack. -->

Domain-specific loops stay in this repo. If a required canonical file cannot
be read, report the missing path instead of substituting a remembered procedure.
```

The router is the shared routing table. This pointer picks up roadmap, wave,
briefing, viewer, and sweep routes without maintaining a second catalog.
Codex can expose duplicate skill names; project precedence is the routing
instruction above, not a promise that the host hides the stack version.

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

## Optional: prepare a project orchestration map

After scope and tracker setup, use `/linear-roadmap <project>` to map existing
approved tickets. For new work, `/spec` supplies the verdict and
`/linear-feature-intake` creates the approved records first. Prompt-only input
can produce a draft, with no launch authorization.

Keep the shared lifecycle at the installed stack's root; copy/adapt
[`ORCHESTRATION.md`](ORCHESTRATION.md) and [`orchestration.json`](orchestration.json)
into the consuming root and the one active `orchestration/<slug>.json`. Adapt
[`orchestration-index.json`](orchestration-index.json) into `orchestration/index.json`;
its source pin records adoption provenance; supported schemas and a clean installed source determine compatibility. Groups describe subunits without new sessions; one
executable issue maps to one persistent session. `/next` reads indexed conditions
and checks live evidence. `/wave` retains its current human plan checkpoint.

Each project's Markdown graph must include all its Linear tickets on main.
Linear-roadmap reports coverage gaps as maintenance warnings. Next/wave, dispatch,
land and implementer review workflows verify selected work and its dependency
closure; unrelated missing tickets do not freeze mapped candidates. At most three
missing in-scope maintenance units may use a local reconciliation record containing
main SHA, live issue evidence and exact delta. Scope/dependency/release/human-gate
changes normally require reviewed publication; the explicit approved local graph
path below validates its local source and retains the original authorizations.
An explicit --accept-graph-update uses a validated reviewed pending graph for one
invocation; build requires the flag again.
Legacy graphs still need cited closure audits and reviewed mapping repairs.
See the [canonical publication-gate contract](../tools/linear/linear-roadmap/references/publication-gate.md)
in the physical kstack checkout for the exact reconciliation and pending-PR rules.

Use `/linear-roadmap <project>` for local JSON, orchestration Markdown and scope
updates; add `--publish` explicitly to open or update the graph PR. Updating the
map leaves existing wave membership and approved plans intact. Revalidation uses
each mapped track's graph/evidence closure; unrelated ticket, graph or main
changes do not interrupt it. Changed relevant conditions stop only affected tracks
while independent audited siblings continue. Local drafts alone grant no admission.


For a local roadmap, explicitly pass `--local-graph`
to wave plan and repeat it on wave build alongside --approve. This uses fresh local
indexed/candidate admission without graph publication to GitHub or Linear. Scope,
native blockers, dependencies, evidence and human plan/merge decisions still apply.
Changed local index/manifest/provenance pins require a new plan; source_revision
remains the original adoption provenance across compatible stack upgrades.

The human maintainer manually publishes/links the shared team-owned Linear contract
under the workspace rules and verifies read-back; the roadmap skill never writes it. Keep
each pilot document with its project. Publishing a graph does not execute it;
the persistent-session controller remains an experimental integration requirement.

## Verify, then delete the old copies

```bash
python3 <stack-root>/bin/check-stack  # run the stack's own gate
<stack-root>/bin/install --dry-run
<stack-root>/bin/install --host codex --dry-run
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
