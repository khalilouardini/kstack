---
name: linear-roadmap
version: 0.2.0
description: Build a typed orchestration roadmap and Mermaid graph from existing Linear work or draft a proposed graph from a prompt. Writes local artifacts; tracker reads only. Use when asked to "map this Linear project", "prepare an orchestration roadmap", or "/linear-roadmap <project|spec|prompt>". Does not launch sessions or create tickets. (kstack)
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
Resolve this skill's physical canonical directory first. Claude: resolve the
installed symlink with `cd <installed-linear-roadmap-directory> && pwd -P`.
Codex: read the generated pointer's `SKILL.md` and use the canonical directory it
names; the pointer directory has no `bin/`. Set `<stack-root>` from
`git -C <physical-skill-directory> rev-parse --show-toplevel`. Read
`<stack-root>/ORCHESTRATION.md` and
`<stack-root>/tools/linear/linear-roadmap/references/contract.md`. If unreadable,
stop. Refuse artifact writes if the consuming root resolves to `<stack-root>`;
never write pilot data into the shared lifecycle.

- **Existing project/subunit:** resolve the exact Linear ID, verify membership,
  paginate its issues and both directions of blocking relations, and read issue
  bodies, project rules, acceptance criteria and external dependencies. Fetch
  external prerequisites to the boundary stated by the contract; record unknown
  state and disagreement rather than inventing a runnable path. Reuse canonical lowercase Linear UUIDs for `issue_ref` and project IDs;
  resolve URL/key aliases before writing the record. Reuse existing issue IDs; a group/container has no implementation session.
- **Approved spec:** recover the existing verdict without re-running it and
  resolve tickets by duplicate search. Intake must persist every executable unit
  before this path produces MAPPED records. If tickets are missing, report their
  acceptance scopes and hand off to `/linear-feature-intake`; do not emit a
  recorded project containing proposed/null-ref units or downgrade its existing
  tickets to draft. Prompt-only DRAFT proposals remain the separate path below.
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
2. Read `orchestration/index.json` first. It names exactly one active manifest,
   which contains all selected projects/subunits and cross-subunit edges. Update
   that record in place and preserve stable IDs; do not create per-subunit overlays.
   On first adoption, write `orchestration/<slug>.json` and the index using the
   template `project-template/orchestration-index.json`. Record the explicitly
   adopted reviewed stack HEAD as `source_revision`; never auto-repin an existing
   index. Refuse a source mismatch until the owner reconciles it. Root
   `ORCHESTRATION.md` links this machine-readable index and its one manifest.
3. Encode prerequisites with source and target events. `start_after` targets a
   unit's plan/build event; `merge_after` targets merge; `release_after` targets
   release; `evidence_required` comes from an evidence pass; `human_decision`
   comes from a human approval. `verify_after` orders evidence collection;
   `review_after` orders a human review. Every condition cites its source. Do not convert a merge-only condition into a native start blocker.
4. Run `python3 <stack-root>/tools/linear/linear-roadmap/bin/graph-record validate-index <absolute-consuming-root>/orchestration/index.json`, then the
   same full command with `render-index`. Read exit codes and the manifest digest.
   Pin/structure failure stops the handoff; fix from evidence, never remove the
   failing prerequisite. Plain `validate`/`render` accept a manifest for draft
   checks only and cannot substitute for indexed validation before `/next`.
5. Put the rendered project graph, a condition/source table, unknowns and links
   to the shared lifecycle in root `ORCHESTRATION.md`. Before replacing an
   existing diagram, inspect its conditions and preserve unrelated content.
6. Report artifact paths, source pin, manifest digest, resolved project IDs,
   missing tickets/scope, conflicting conditions and remaining human decisions.
   Never publish or link Linear documents from this skill. Return artifacts for
   the human maintainer's separate manual publish/read-back step. Graph updates
   never grant launch permission.

## Output

Return DRAFT or MAPPED, local JSON and root graph paths, validator exit code,
source observations and up to three next actions. MAPPED means existing records
were mapped, not that their work is ready. Actual readiness needs live evidence,
source freshness and the explicit controller's admission checks. `/wave` keeps
its existing human plan checkpoint until that controller path is implemented.
