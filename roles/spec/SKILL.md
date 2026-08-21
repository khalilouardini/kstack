---
name: spec
version: 0.1.0
description: Take an idea, feature request, or "should we build X?" question through the product gate — product-manager decides scope first and alone, and only when the verdict is IN for the currently active milestone do tech-lead, designer, and qa run. Emits one spec file with a single verdict block, or a one-paragraph rejection that costs one agent instead of four. Use when asked to "spec this", "should we build X", "is this in scope", or "/spec [--milestone <id>] <idea>". (khalilou-stack)
---

# spec — the product gate

## When to invoke

A new idea, feature request, or open PR of uncertain standing needs a scope
decision, and — only if it passes — a spec. Invoke as
`/spec [--milestone <milestone-id>] <idea>`.

Not a ceremony on every commit, and not for work already in flight and already
in scope. For auditing unfinished work backwards, that is a triage skill's job,
not this one.

One idea in, one verdict out. The gate is ordered so that **rejection is cheap**:
`product-manager` runs alone first, and unless the verdict admits the idea to the
**currently active milestone**, the other three roles never spend a token.

That ordering is the whole design. A pipeline that specs everything and filters
at the end costs four agents per bad idea and produces a beautifully-specified
backlog of things you will never build.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: khalilou-stack
`CONVENTIONS.md` §2):

- **`scope_doc`** — the scope contract. Missing, null, or unreadable → **stop**.
  The gate has nothing to gate against, and a `/spec` run without a scope
  contract is just four agents writing a plan. Say so and ask the owner to
  establish the contract first.
- **`spec_output_dir`** — where the spec file lands. Missing or null → **ask the
  user** where specs belong in this repo before writing anything. Do not invent a
  path and do not drop the spec into the repo root.
- **`workspace_contract`** — the tracker's workspace rules. Null or missing means
  the project has no tracker wired; step 5 degrades to printing the verdict block
  for manual intake.

## The four roles

Each step below dispatches a role as a subagent. Their contracts are the ones
this stack defines under `roles/`; the consuming project points at them through
its own role adapters (see `project-template/ONBOARDING.md` for which adapters a
project is expected to provide and how they are wired for each harness).

If an adapter a step needs is not configured, say which one is missing and
**stop** — do not write that section of the spec yourself. A spec section
authored by the orchestrator carries no gate.

## Step 0 — read the contract, resolve the active milestone

Read the file named by `scope_doc` yourself before dispatching. You need its
gates and its NOT list to interpret what comes back, and you need to notice if
the owner has amended it since the last run.

**Resolve the active milestone before dispatching.** It is the **earliest
unreleased** gate — the first one the scope doc's decision log does not record as
released. The gate's *date* does not select it.

> **A passed date does not advance the milestone. A release does.**

If the earliest unreleased gate's date has passed, it is **overdue**, and it
stays active. Say so in one line — `<milestone> (<its date>) — overdue by N days,
unreleased` — and keep gating against it. A gate whose entry carries no date
(for example one marked under redefinition) is stated as such rather than given
an invented one. Advancing requires an explicit act by the owner recorded in the
decision log: a release, a recorded cut, or an amendment under the amendment
rule.

This is not pedantry about dates. Selecting on "date has not passed" means that
at midnight after a missed date the gate silently stops being the gate and the
next milestone's work starts being admitted — a missed deadline converting itself
into scope expansion, with no decision taken by anyone.

Accept `/spec --milestone <milestone-id> <idea>` to spec ahead deliberately, with
the id as the scope doc names it; that is an act by the owner and it does not
change which milestone is active.

State which milestone you resolved, and why, in one line before step 1.

## Step 1 — the scope gate (alone)

Dispatch **one** `product-manager` with the raw idea, verbatim. Do not
pre-digest it, do not steelman it, and do not attach your own view. If you
summarise the idea into its most defensible form before handing it over, you have
already done the advocacy the gate exists to resist.

Wait for the verdict.

Branch on the verdict's `disposition` field (step 5 defines the handoff block it
comes in), **not on the milestone token**.

> **Worked example (OGUR).** An orchestrator that branched on the literal token
> `IN-MVP-1` would have needed editing the moment that milestone was released and
> the next became active — the pipeline could not have specced any currently
> active work until someone noticed. `disposition` is stable across every
> milestone transition; the token is not.

### `STOP` — verdict `OUT`

Print the verdict. Hand off per step 5. **Stop.**

Do not soften it, do not add "but if you wanted to…", and do not run the other
roles "just to see." Running them is how an `OUT` becomes a thing that gets built
on a Sunday.

### `BACKLOG` — `IN`, but for a *future* milestone

Print the verdict, hand off per step 5 with the milestone tag, **stop**. No spec,
no estimate. A feature specced a milestone early is a feature that gets built a
milestone early.

### `EVIDENCE` — verdict `NEEDS-EVIDENCE`

Print the verdict and the forcing question the gate named. Hand off per step 5 as
blocked. **Stop.** The next action is a conversation with a tester, not a spec.

### `SPEC` — `IN`, for the active milestone

Continue to step 2. This is the only path that costs four agents.

## Step 2 — parallel analysis

Dispatch `tech-lead` and `designer` **concurrently** — one message, two tool
calls. They are independent: one reads the implementation surface, one reads the
project's design contract, and neither needs the other's output.

Give each of them the proposal *and* the product-manager's verdict block, so they
know which contract line they are serving.

If `tech-lead` returns `CANNOT-ESTIMATE`, that is a legitimate outcome. Do not
paper over it — surface what it said it needed, and mark the spec `BLOCKED` in
the verdict block. A spec with a fabricated estimate is worse than a spec with
none.

If `designer` returns a **⚠ DESIGN-CONTRACT CONFLICT**, surface it prominently and
mark the spec `BLOCKED — owner decision`. Design-contract conflicts are flagged,
never silently resolved by this skill.

## Step 3 — acceptance criteria

Dispatch `qa` with the proposal, the tech-lead delta, and the designer contract.
It runs last because criteria depend on both the implementation surface and the
user-facing surface.

If `qa` returns `NOT-READY`, keep the spec but mark it so. A spec whose done-ness
cannot be defined is a spec that will be argued about at the deadline.

## Step 4 — write the spec

Write to `<spec_output_dir>/<slug>.md`, slug kebab-cased from the feature name.

```markdown
# <Feature name>

**Verdict:** IN-<active milestone> · **Estimate:** <n> half-days · **Status:** READY | BLOCKED | NOT-READY
**Serves gate:** <the gate clause that fails without this>
**Scope contract:** <section as the doc numbers it> — "<quoted line>"
**Date:** <YYYY-MM-DD>

## Why this is in scope
<product-manager's reasoning, verbatim>

## What exists / what's new
<tech-lead's delta tables>

## Architectural seam & collisions
<tech-lead's seam + collision findings — name the PR numbers>

## Surface contract
<designer's components, data contract, states, provenance>

## Acceptance criteria
<qa's table>

## False positives
<qa's table — do not omit this section>

## Human judgement required
<qa's table>

## Open questions
<anything BLOCKED, with who decides>
```

**One verdict block per spec.** The verdict is the `product-manager`'s, copied
once, at the top. Do not restate it in a summary section, do not paraphrase it in
the reasoning, and never let a later role's output read as a second verdict — two
verdicts in one file is how a `BLOCKED` spec gets built anyway.

Then print a summary to the user: verdict, estimate, status, and the single
biggest risk. Do not paste the whole spec into the chat — it is on disk.

## Step 5 — hand the verdict to the tracker, do not start a second backlog

A Markdown backlog maintained beside a live tracker is a second execution record
that will drift from the first — the exact failure this workflow exists to stop.
So: **one execution record per accepted idea.**

**If `workspace_contract` is set**, pass the `product-manager`'s handoff block —
verbatim, unedited — to `/linear-feature-intake`, which owns duplicate search,
issue creation and update, project assignment, and cross-project links. It does
not re-derive the verdict; that judgement was already made and it is not the
adapter's to revisit.

| `disposition` | What the adapter does |
|---|---|
| `SPEC` | Link the **already-written** spec to one meta issue in the active-milestone project, plus its implementation children |
| `BACKLOG` | Upsert **one** backlog issue, tagged with its future milestone. No spec |
| `EVIDENCE` | Upsert **one** blocked research item carrying the forcing question |
| `STOP` | Audit record only. No execution issue is created for an `OUT` |

**If `workspace_contract` is null or missing, or the intake skill is unavailable
in this harness**, end by printing the handoff block and saying plainly that it
was not persisted and needs manual intake. **Do not** fall back to writing a
local backlog file — that is how the duplicate record gets created.

### Exactly one orchestrator per run

`/linear-feature-intake` can also be the entry point — invoked with a raw
request, it runs the gate itself and, on `SPEC`, runs `/spec`. That is the
correct shape when the owner starts from the tracker. But it means the two skills
can call each other, and `/spec → intake → /spec` is a loop that writes the spec
twice and proposes two sets of issues.

**The rule: whoever was invoked first owns orchestration, and the second call is
persistence-only.** When `/spec` reaches this step it has already run the gate and
already written the spec file, so it calls the adapter on its
**persistence-only path** — supplying both the verdict block and the path to the
finished spec:

```
/linear-feature-intake --verdict <handoff-block> --spec <spec_output_dir>/<slug>.md
```

**A supplied spec artifact means the adapter must not run `/spec`.** It reads
that file for the issue bodies and goes straight to the upsert — that is the
adapter's documented contract, and its fixtures assert `/spec` is invoked zero
times on that path.

Symmetrically, when intake is the entry point it runs `/spec` itself and `/spec`
must **not** call back — it returns the spec to its caller and this step is
skipped. Check before you dispatch: if this run was invoked *by* the intake
skill, stop after step 4 and return.

`product-manager` stays read-only throughout; the adapter is the only thing that
writes to the tracker. This is **prompt-level** at the orchestration layer — the
recursion guard is a check you perform, not a mechanism that blocks the call —
and **tool-list-enforced** at the gate, where the role adapter grants
`product-manager` only `Read`, `Grep`, `Glob`.

### `OUT` verdicts still need to be auditable

Keep them in the audit log — `spec-log.md` in the **parent directory of
`spec_output_dir`** (so `spec_output_dir: docs/product/specs` →
`docs/product/spec-log.md`). Append one line, decisions only:

```markdown
| Date | Idea | Verdict | Reason |
|---|---|---|---|
| YYYY-MM-DD | <one line> | OUT | <section> "<row>" — <six-word reason> |
```

That log is not a backlog: nothing on it is scheduled, and nothing accepted is
recorded there. Weeks later, "why didn't we build X" has an answer with a date on
it, and you can see whether the gate is calibrated. **A gate that never says OUT
is not a gate**, and a gate that says OUT to everything means the contract is too
narrow. The log is how you tell which one is happening.

## Notes

- **Reject fast, spec slow.** The expensive path should be the rare one.
- **Do not run this on work that is already in flight and in scope.** It is for
  new ideas and for open PRs of uncertain standing.
- **The owner can override any verdict.** They own the scope contract; the
  amendment rule is what changes it, and it requires cutting something to pay for
  the addition. An override is legitimate — it just has to be deliberate and
  recorded in the decision log, rather than a thing that happens because nobody
  said no.
