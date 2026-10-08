# Declarative roadmap contract

`graph.schema.json` is the canonical structural schema, version 1. The stdlib
`bin/graph-record` implements its bundled closed subset and additional graph
semantics. It reads UTF-8 manifests and emits validation or Mermaid; it does not
run acceptance commands, access the network, write tracker/runtime state or
dispatch sessions. Index validation also runs read-only Git commands for the pin.

## One authoritative index

Each consuming repository has exactly one active `orchestration/index.json`:

```json
{
  "schema_version": 1,
  "source_revision": "<40 lowercase hex digits from reviewed kstack HEAD>",
  "manifest": "orchestration/project.json"
}
```

`index.schema.json` requires these keys and rejects unknown fields. `manifest`
is one path beneath the consuming `orchestration/` directory, not an array or
overlay. Symlinks escaping that directory are rejected. A single manifest holds
all selected projects and their subunits; all node/issue uniqueness and cycle
checks therefore run on that combined graph. Cross-subunit/project edges name
nodes in this same manifest. Additional draft files are inactive, never merged
implicitly. A Linear project's owner maintains one authoritative graph; other
repos link that graph rather than copying executable units into another graph.

`validate-index` and `render-index` compare `source_revision` to the physical
stack's `git rev-parse HEAD` and reject a mismatch or uncommitted lifecycle/roadmap
source. They do not checkout, fetch or silently use another version. The skills
stop on a mismatch and require an explicit reconciliation of source, graph and
human decisions. A matching pin proves source identity, not human PR approval.
`validate-index` reports `manifest_revision: sha256:<digest>` of the exact manifest
bytes, including uncommitted drafts. This digest is the revision `/next` cites.
Plain `validate`/`render` are structural draft tools and do not check the index pin.

## Manifest fields

- `schema_version`: 1; `title`: required display title.
- `projects`: stable local key/title, lowercase Linear project UUID or null,
  `scope_source` and `authorization` (`draft` or `recorded`). Recorded cites existing
  scope authorization; validation does not verify it. Proposed work remains draft.
- `policy`: explicit `implementation_model`, high/xhigh `default_effort`,
  `max_sessions` (1–5), `max_plan_revisions` (nonnegative), `review_rounds`
  (positive), and `review_concurrency` (1–5). These are proposed controller inputs,
  not new stack config or wave flags. The future controller uses the lower of
  manifest and configured wave review caps/concurrency, passes that resolved cap
  to `/pr-loop`, and records its source. Skill defaults apply only where that
  skill documents them; they cannot expand the manifest cap.
- `nodes`: required ID/title/kind/project/owner/acceptance/source and the required
  nullable keys `unit_of`, `issue_ref` and `effort`. `unit_of` names a group in the
  same project; `effort` null inherits the policy. `owner` names the responsible
  role or actor; `human` means the authorized human in the scope/project record,
  `implementer` means the project's configured implementation role. Neither is
  an approval. Acceptance text describes checks, never executes them.
- `issue_ref`: lowercase canonical issue UUID or null, never a URL/key alias.
  Recorded units require it and a project UUID; validation checks shape/uniqueness,
  not existence. The same UUID identifies one executable unit. Human/evidence,
  release and external nodes may link its issue for context; `/next` maps an
  implementation candidate only to kind `unit`. Groups must have `issue_ref: null`.
- `edges`: required source node/event, target node/event, type and source citation.
  Unknown fields are rejected. Nonblank string patterns are part of the schema.
  Draft template citations/checks use `TODO:`. Recorded project scope, node sources,
  acceptance criteria and touching edges reject that prefix. Real citations still
  require a live read; removing a sentinel is not proof of truth.

| Kind | Events |
| -- | -- |
| unit | plan → build → merge |
| human | approve |
| evidence | pass |
| external | complete |
| release | release |
| group | none |

Every edge means its source event precedes its target event; all prerequisites
are AND conditions. Alternative paths need an explicit decision before execution.
Cycle checks combine all types and implicit unit phases. A projected node cycle
can be valid when its event graph is acyclic; read its event labels. Groups have
no event edges. Errors report one actual cycle path, not downstream blocked nodes.

`start_after` targets unit plan/build; `merge_after` targets unit merge;
`release_after` targets release and originates at merge/release/complete;
`verify_after` targets evidence pass; `review_after` targets human approve.
Every edge from human approve must be `human_decision`; every edge from evidence
pass must be `evidence_required`. Those types also require their respective source.
A **start prerequisite** is any edge targeting unit plan/build, regardless of type.

Native Linear `blocks` targets the downstream **plan** event, preserving `/next`'s
existing blocked-issue rule. For an engineering upstream unit it originates at
merge; for an external prerequisite at complete; for a decision/evidence source
at approve/pass with the corresponding type. An unfulfilled native blocker always
blocks planning and wins over a graph edge targeting build only. Report their
disagreement for reconciliation; never relax the native relation by inference.

## Observations and manual human decisions

The manifest is declarative. Per-condition verifier, evidence, observation time
and result live in the consuming root `ORCHESTRATION.md` Conditions table, or the
future controller ledger. They are not extra edge fields. Unknown or stale
observations are not satisfied prerequisites; Done is not acceptance evidence.

Before a controller exists, a human decision can be a cited scope decision-log
entry or Linear comment from an authorized human. The root Human decisions table
indexes node/event, explicit outcome, actor, recorded UTC time, manifest digest,
scope/criteria and source URL or file:line. `/next` reads the original record,
verifies its author and exact decision/boundary, and checks whether graph/scope
changes invalidate it. Bot comments, approval-looking labels and this template
are not human approvals. `/next` reads these records; it does not create them.

The graph analysis in `/next` owns the read-only rehearsal. Report these predicates:

| State | Predicate |
| -- | -- |
| UNMAPPED | Open issue in a covered project has no executable unit; refresh graph before kickoff |
| ACTIVE | Existing session/worktree/PR owns this unit; resume rather than duplicate |
| HUMAN_REQUIRED | Named unresolved human decision or authority disagreement blocks the requested transition |
| UNKNOWN | Evidence needed for the requested transition cannot be verified |
| BLOCKED | A native blocker or known-false plan condition prevents planning |
| PLAN_ONLY | Plan/native conditions verified; at least one build condition false or unknown; no implementation permission |
| READY_TO_BUILD | Plan and build conditions verified; scope and independence gates still apply |
| MERGE_BLOCKED | Build converged but at least one merge prerequisite is not verified |

ACTIVE controls session reuse and may carry a MERGE_BLOCKED qualifier. HUMAN_REQUIRED
and UNKNOWN name the affected event; an unknown later build condition can still
permit a PLAN_ONLY recommendation when all plan prerequisites are verified.
No state is written to Linear by analysis. PLAN_ONLY does not count toward N in
parallel mode and is excluded from `/wave` tracks/build approval.

## Publication owner

The human maintainer publishes the central Linear view and links it from project
overviews manually, following the workspace contract and checking the saved result.
This is separate from `/linear-roadmap`, which never writes to Linear, even when
publication is requested. It returns local artifacts for that manual step.
Publish source commit/PR and schema version together. Keep the shared team document
outside pilots and each pilot with its own project. The connector has a team parent,
not a workspace-root parent; links retain actual access controls and grant no access.
Do not create a project, initiative or issue solely to host the template.
