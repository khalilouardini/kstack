# Declarative roadmap contract

`graph.schema.json` is the canonical structural schema. `bin/graph-record` evaluates
its bundled closed subset and checks graph semantics using the Python standard
library. It reads a manifest and emits validation or Mermaid; no network,
tracker writes, code execution, runtime state writes or session dispatch occur.

## Format

- `schema_version`: 1. Unknown versions/fields are rejected.
- `projects`: stable local `key`, display title, resolved lowercase Linear project UUID or null,
  scope source and authorization `draft` or `recorded`. Recorded means the
  author cites existing authorization; validation does not verify that claim.
- `policy`: explicit implementation model, default high/xhigh effort, concurrency
  (1–5) and review-round cap. These are proposed controller inputs, not new
  `.agents/stack.yml` or `/wave` flags. Models/accounts/status names stay in
  project data or existing configuration, never in validator logic.
- `nodes`: stable safe ID, title, project key, kind, optional `unit_of` group,
  canonical lowercase Linear issue UUID or null, owner, acceptance checks, source and optional
  high/xhigh effort override. A recorded project's executable unit needs a real
  issue UUID and resolved project UUID. Resolve URL/key aliases first; validation
  checks UUID shape and uniqueness, not that an issue exists. The same UUID maps
  to one executable unit;
  human/evidence substeps can share its issue reference without spawning another
  implementation session. Group nodes never execute. Drafts may have null IDs.
- `edges`: source node/event, target node/event, type and source citation.

| Kind | Events |
| -- | -- |
| unit | plan → build → merge |
| human | approve |
| evidence | pass |
| external | complete |
| release | release |
| group | none |

A source event must precede its target event. This permits parallel builds with
ordered merges without pretending the downstream build is blocked. Cycle checks
expand internal unit phases and combine all edge types, so a mixed start/merge
cycle cannot hide behind separate per-type checks. Group containment is checked
separately. Rendering projects each unit's phases onto one visible node; a visual
node cycle can therefore be valid when the underlying event graph is acyclic.
Use event labels to read it, not an unlabeled visual topology.

Edge types: `start_after` targets plan/build, `merge_after` targets merge,
`release_after` targets release, `verify_after` targets evidence pass,
`review_after` targets human approve, `evidence_required` originates at evidence
pass, and `human_decision` originates at human approve. Groups cannot carry event edges.
There is no implied AND/OR alternative: all listed prerequisites are required.
Alternative paths must be resolved into one explicit condition before execution.

Sources cite issue/project/spec/owner records, not guesses. Acceptance text names
checks but the renderer never runs them. Unknown external state, stale evidence,
missing session capabilities and disagreements stay in the root document/ledger;
structural validity is not permission to start or evidence that tests passed.

## Reuse and publication

The same schema covers a whole project, multiple project keys or a group's
subunits. Each project references one centrally versioned lifecycle. Local
root documents link the lifecycle and index `orchestration/<slug>.json`; they
contain domain conditions only. The central Linear document is a published view
of kstack's root contract. Pilot documents live with their own projects and link
that view; do not copy pilot issue IDs into the shared contract.

Publish central source revision, schema version and PR/commit link together.
A project pins its reviewed revision; updates are an explicit reconciliation,
not an implicit authorization change. The connector supports team-owned documents,
not a workspace-root parent: use the shared team document outside any pilot,
link it from other projects/subunits, and honor Linear's actual access controls.
A link does not grant access. No project, initiative or issue is created just to
hold the template.
