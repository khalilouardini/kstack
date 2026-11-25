---
name: linear-roadmap-create
version: 0.2.0
description: Create complete Linear roadmaps with measurable evals on every ticket and aligned MVP scope and architecture decisions. Use when asked to "create a roadmap in Linear", "build a new Linear roadmap", or "/linear-roadmap-create BRIEF [--dry-run]". Searches existing work, verifies writes and resumes partial runs. Does not authorize implementation or release. (kstack)
---

# linear-roadmap-create

## When to invoke

The user wants an entire new roadmap persisted in Linear: outcomes, projects,
milestones, implementation units, decisions and release gates. Also use to extend
a roadmap when the user explicitly requests that scope. Invoke as:

```text
/linear-roadmap-create <brief|spec|plan> [--team <team>] [--dry-run]
```

`--dry-run` prepares the full plan, ticket bodies, evals and documentation changes
without Linear writes. A request to create a roadmap authorizes its bounded
creation; do not add a second confirmation when existing authorization and the
workspace contract cover the concrete plan. Resolve material scope/authority
questions after preparing the reviewable result. This task does not authorize
implementation, deployments, paid eval runs or release signoff.

For an existing ticket graph, use `/linear-roadmap`; for one feature's verdict
and tickets, use `/linear-feature-intake`. The mapper remains tracker-read-only.
Do not invoke intake once per ticket or recurse between these skills.

## Read the authorities and prior work

1. Read the consuming repo's `.agents/stack.yml`, `workspace_contract`,
   `scope_doc`, host instructions, relevant ADRs and existing roadmap/decision
   records. Missing/unreadable `workspace_contract` prevents tracker writes;
   finish a draft and name the missing key. Missing scope authority prevents
   claims of admitted implementation scope, not preparation of a proposal.
   Read [references/scope-and-decisions.md](references/scope-and-decisions.md)
   before drafting scope or architecture changes.
2. Discover the connected Linear tool schemas and confirm workspace/team.
   Inspect existing projects, milestones, documents and equivalent issues across
   statuses, including archived work. Paginate queries; list descriptions can
   be truncated, so fetch full bodies before assessing eval quality. Reuse
   canonical records and identify overlap, supersession and external owners.
3. Inspect relevant previous roadmaps and their unit and gate tickets. Name the
   strongest reusable evals and concrete gaps with source links. Separate
   historical snapshots from current authority; ticket closure or project progress
   is not evidence a gate passed. State the review's coverage and limits.
   Do not rewrite those prior projects unless the user requested it.

For a draft with unavailable source files or repository commands, supply concrete
proposed wording and reproducible protocols plus named source-resolution
prerequisites. Do not fabricate verified paths, commands, section anchors or live
reads. Resolve those prerequisites before the affected adoption or execution step.

## Design backwards from the evidence

Read [references/evals.md](references/evals.md) in full. Define the project outcome
and integrated release eval first, then the smallest independently verifiable
units needed to achieve it. Every ticket, including containers, documentation,
decisions, evaluation infrastructure and release gates, needs its own eval
contract. Numeric measures are preferred when meaningful; a precise observable
pass/fail rubric is valid. A list of implementation tasks or "CI green" alone
does not assess the promised behavior.

Classify every ticket as frontend or non-frontend while creating the roadmap.
Every frontend ticket, including mixed frontend/backend work, must plan a final
localhost demo and/or screenshots so the reviewer can see and understand the
change. Map that requirement to the ticket's own eval, pass condition and
evidence destination now; implementation supplies the actual evidence before
review/completion. Follow the frontend review contract in the eval reference.

Prepare one durable local plan at the consuming repo's established roadmap path
(or a disclosed local artifact path). Include:

- Product outcome, users, included and excluded scope, authority and source links.
- Proposed/reused initiative only if useful, projects/teams, milestones and all
  ticket bodies. Each ticket names its kind, single bounded outcome, owner or
  unresolved owner decision, scope source, boundaries, prerequisites and evals.
- A coverage matrix from every admitted outcome to unit evals and the integrated
  gate. Distinguish optional work and excluded scope. No orphan promise, uncovered
  ticket or release gate that merely sums closed children. For each frontend
  ticket, include its review eval, chosen demo/screenshot modes and evidence
  destination in this matrix and the published project roadmap.
- Baseline/eval preparation before dependent behavior changes, explicit human
  decisions, and start/build/merge/release prerequisites. Reuse external issues;
  preserve dependency direction and distinguish completion from a positive
  decision. Flag shared-file/interface contention before claiming parallelism.
- The scope/ADR/document impact table and a per-record proposed change ledger.
  Dates, estimates and limits come from evidence or an explicitly marked proposal;
  unknowns are not commitments. Resolve conflicting gates before affected work
  can be admitted.

Store the same ticket eval contracts in a JSON artifact with a `tickets` array
using [references/eval-example.json](references/eval-example.json). Resolve this
skill's physical directory (Codex: the canonical path in its generated pointer;
Claude: the installed symlink target), then run:

```bash
python3 <physical-skill-directory>/bin/check-evals <absolute-eval-plan.json>
```

Read the exit code and repair every structural error before publishing tickets.
Then review semantic quality: input representativeness, meaningful thresholds,
negative controls, gate coverage and feasibility. The checker enforces required
fields, explicit frontend classification and a linked demo/screenshot eval for
each frontend ticket in its supplied list. It cannot prove
that the inventory is complete, the eval is useful, approval exists, or an eval
passed. Those checks and all write restrictions are **prompt-level**.

## Reconcile documents and persist

Apply already authorized scope/ADR changes with their source and effective
boundary. Otherwise prepare explicitly proposed amendments and track the exact
decision needed; do not silently promote a draft. Update every affected current
summary, gate and cross-reference while preserving historical decisions. Document
edits are part of the roadmap deliverable when needed, with their verification
and adoption status; they are not an optional afterthought.

Follow [references/linear-writes.md](references/linear-writes.md) for bounded,
duplicate-aware creation, read-back and recovery. In `--dry-run`, stop before
those writes and return the complete proposal and doc diffs. Never imply that a
local plan or a successful checker run created Linear records.

After persistence, offer `/linear-roadmap <project>` to map the verified canonical
IDs. Its graph publication and execution rules remain separate. Do not start
sessions, move new work into started/completed states or mark release gates passed.

## Output

Lead with DRAFT, CREATED or PARTIAL. Return the roadmap/project links, the
created/reused/updated counts, eval coverage (tickets with defined evals / all
in-scope tickets), checker result, scope/ADR paths and adoption status, and ledger
path. Include frontend review coverage (frontend tickets with planned visual
evidence / all frontend tickets). Report proposed thresholds, missing decisions
and unrun evals explicitly.
Creation success means the planned records and relationships were read back;
implementation success requires their future executed eval evidence.
