---
name: linear-roadmap
version: 0.1.0
description: Build a typed orchestration roadmap and Mermaid graph from existing Linear work or draft a proposed graph from a spec. Writes local artifacts; tracker reads only. Use when asked to "map this Linear project", "prepare an orchestration roadmap", or "/linear-roadmap <project|spec|prompt>". Does not launch sessions or create tickets. (kstack)
---

# linear-roadmap — prepare the graph before execution

## When to invoke

A project or subunit needs a reusable execution map before `/next` or `/wave`.
Invoke `/linear-roadmap <project|spec|prompt>`. This skill creates local roadmap
artifacts and reads Linear; it does not create issues, rewrite scope, publish to
Linear, invoke Workflow, or start a ticket session. Those limits are prompt-level.
The validator checks structure and phase dependencies; it proves no live readiness.

## Inputs and composition

Read `.agents/stack.yml`, its `scope_doc` and `workspace_contract` when configured.
Missing scope authority permits only a DRAFT graph, with project authorization
`draft`; report the missing source instead of fabricating admission. A tracker
mapping requires a readable workspace contract and a live Linear read path.
Read stack-root `ORCHESTRATION.md` for the lifecycle and central-source policy,
then `tools/linear/linear-roadmap/references/contract.md` for the artifact format.

- **Existing project/subunit:** resolve the exact Linear ID, verify membership,
  paginate its issues and both directions of blocking relations, and read issue
  bodies, project rules, acceptance criteria and external dependencies. Fetch
  external prerequisites to the boundary stated by the contract; record unknown
  state and disagreement rather than inventing a runnable path. Reuse canonical lowercase Linear UUIDs for `issue_ref` and project IDs;
  resolve URL/key aliases before writing the record. Reuse existing issue IDs; a group/container has no implementation session.
- **Approved spec:** recover the existing verdict without re-running it. Resolve
  any existing tickets by duplicate search. Missing issues become explicitly
  proposed units with `issue_ref: null`; they cannot be handed to dispatch.
- **Simple prompt:** draft proposed units and human decisions only. A prompt is
  input to a plan, not evidence that scope or dependencies have been approved.
  If scope/ticket creation is wanted, name `/spec` then `/linear-feature-intake`
  as the next step; do not invoke them from this read-only tracker workflow.

`/spec` owns scope and its spec artifact; `/linear-feature-intake` owns approved
tracker creation, duplicate search and write/read-back. Neither should recursively
call this roadmap builder. The roadmap consumes their outputs. Explicit recorded
owner exceptions must be cited, never disguised as a product-manager verdict or
an active-milestone status change. These rules are prompt-level.

## Produce and validate

1. Use `project-template/orchestration.json` as a format example. Resolve project
   names and IDs from fetched evidence; use a stable filesystem-safe project or
   subunit slug, keeping the artifact beneath `orchestration/`. No invented milestones, dates, estimates or readiness claims.
2. Write `orchestration/<slug>.json` at the consuming repo root. If it exists,
   inspect and update it in place, preserving its stable IDs. For multiple plans,
   the root `ORCHESTRATION.md` indexes them; each manifest declares its projects
   and may refer to an explicit `group` through `unit_of`.
3. Encode prerequisites with source and target events. `start_after` targets a
   unit's plan/build event; `merge_after` targets merge; `release_after` targets
   release; `evidence_required` comes from an evidence pass; `human_decision`
   comes from a human approval. `verify_after` orders evidence collection;
   `review_after` orders a human review. Every condition cites its source. Do not convert a merge-only condition into a native start blocker.
4. Run the physical installed `tools/linear/linear-roadmap/bin/graph-record`
   with `validate <absolute-manifest-path>`, then `render <absolute-manifest-path>`.
   Read its output. Validation failure stops publication and execution handoff;
   fix the record from evidence, not by removing the failing prerequisite.
5. Put the rendered project graph, a condition/source table, unknowns and links
   to the shared lifecycle in root `ORCHESTRATION.md`. Before replacing an
   existing diagram, inspect its conditions and preserve unrelated content.
6. Report artifact paths, resolved project IDs, missing tickets/scope, conflicting
   conditions and the remaining human decisions. Publishing a Linear document
   needs the user's request; updating a graph never grants launch permission.

## Output

Return DRAFT or MAPPED, local JSON and root graph paths, validator exit code,
source observations and up to three next actions. MAPPED means existing records
were mapped, not that their work is ready. Actual readiness needs live evidence,
source freshness and the explicit controller's admission checks. `/wave` keeps
its existing human plan checkpoint until that controller path is implemented.
