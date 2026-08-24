# Migrating OGUR onto kstack

OGUR is where this stack came from, so it is the first consumer and the test of
whether the general/project split holds. Nothing here is destructive: the stack
version and the OGUR version can run side by side until you delete the OGUR copy.

## The split

**Moves to the stack** (delete from OGUR after verifying the stack copy works):

| OGUR path | Stack path | What changed |
|---|---|---|
| `.agents/roles/product-manager.md` | `roles/product-manager.md` | Scope-doc path → `stack.yml scope_doc`; §-map → generic active-milestone rule; gained the tone contract + six evidence tests |
| `.agents/roles/tech-lead.md` | `roles/tech-lead.md` | Trap ledger + architecture map → `role_appendix_dir/tech-lead.md`; gained the complexity-smell STOP |
| `.agents/roles/designer.md` | `roles/designer.md` | Spec path + component inventory → appendix |
| `.agents/roles/qa.md` | `roles/qa.md` | Check-layer table + factory catalog → appendix |
| `.claude/skills/spec/` | `roles/spec/` | Output paths → `spec_output_dir`; intake handoff conditional on `workspace_contract` |
| `.claude/skills/triage/` | `roles/triage/` | Protected demo branches → `protected_branches` |
| `.claude/skills/explain-diff-html/` | `core/explain-diff-html/` | Nothing — it was already repo-agnostic |
| `.claude/skills/review-comments/` | `tools/github/review-comments/` | Identities → `identities.maintainer` / `identities.reviewer` / `identities.implementer`; gate → `gates.lint`/`gates.test` |
| `.claude/skills/pr-loop/` | `tools/github/pr-loop/` | Same, plus ledger dir renamed, engine gate → `review_gate.skill_path` |
| `.agents/skills/review-claude-pr/` | `tools/github/review-claude-pr/` | Identities parameterized |
| `.agents/skills/github-delivery-retro/` | `tools/github/delivery-retro/` | Scope doc parameterized; gained the stale-base pre-flight |
| `.agents/skills/session-titles/` | `tools/github/session-titles/` | `OGUR-\d+` → `issue_prefix` |
| `.agents/skills/next/` | `tools/linear/next/` | Scope doc + workspace contract parameterized |
| `.agents/skills/linear-steward/` | `tools/linear/linear-steward/` | Team/project names → workspace contract |
| `.agents/skills/linear-feature-intake/` | `tools/linear/linear-feature-intake/` | Still the canonical owner of the verdict-block schema |
| `.agents/skills/linear-release-audit/` | `tools/linear/linear-release-audit/` | Gates document → `scope_doc` |

**Stays in OGUR** — every one of these names OGUR's own nouns (landscapes, the
engine, packs, sources, the Explore/Monitor harness):

`coverage-eval`, `landscape-loop-gt`, `landscape-loop-explore`,
`landscape-loop-promote`, `new-source`, `review-engine`, `doc-refresh`,
`integrate-expert-feedback`, plus `.claude/hooks/post-edit.sh` and its Codex
twin (a project gate, correctly project-local).

Rule of thumb: **a skill that names your product's nouns stays home.**

Schema 2 replaces the old human-reviewer / bot pair. Map the former human
reviewer to `identities.maintainer`, configure the dedicated Codex account as
`identities.reviewer`, and map the former bot to `identities.implementer`.

## Steps

1. Install the stack: `bin/install` (and `bin/install --host codex`).
2. Write `.agents/stack.yml` in the OGUR repo:

```yaml
stack: 2
project: ogur
scope_doc: docs/product/mvp-scope.md
workspace_contract: docs/product/linear-workspace-contract.md
issue_prefix: OGUR
gates:
  lint: make lint
  test: make test-fast
  test_full: make test
review_gate:
  skill_path: .claude/skills/review-engine/SKILL.md
  scope: ogur/engine/**
identities:
  maintainer: khalilouardini
  reviewer: ogur-codex-bot
  implementer: ogur-claude-bot
protected_branches:
  - demo/*
role_appendix_dir: .agents/appendices
spec_output_dir: docs/product/specs
```

3. Move the project-specific halves of the four role contracts into
   `.agents/appendices/{tech-lead,designer,qa}.md`. These carry what the
   generalized contracts deliberately dropped: the trap ledger (`signal.source`
   is the backend label; no `PRAGMA foreign_keys=ON`; patch-where-used; never
   `make fmt` in a feature PR; never seed live `ogur.db`), the architecture and
   ux-spec section maps, the `tests/conftest.py` factory catalog, and the
   current test baseline.
4. Repoint `.claude/agents/*.md` at the stack contracts (the adapter body is one
   line: read `<stack-root>/roles/<role>.md` and follow it exactly).
5. Delete the migrated OGUR copies **only after** running one of each: `/spec`,
   `/triage`, `/review-comments`, `/next`. Until then the project copies shadow
   the stack ones, so nothing breaks.

## What this migration proves

If a skill needed a `stack.yml` key that does not exist, the split is wrong and
the key belongs in the schema. If it needed OGUR prose that no key could carry,
it was a domain skill and should stay home. Both outcomes are useful; guessing
is not.
