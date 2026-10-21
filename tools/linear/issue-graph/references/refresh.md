# Refresh data contract

The helper reads the indexed manifest directly, validates it against the shared
roadmap schema and preserves every event/type/source on displayed edges. It does
not parse Mermaid, choose a second graph or check execution source-pin freshness.
The selected view includes its non-container nodes, issue-bearing containers,
and the transitive closure of incoming prerequisites, including external
projects. Empty group containers are represented by each card's project/group
provenance rather than synthetic tickets. Outgoing edges to unrelated projects
are shown in those projects' own views.

Pass a UTF-8 evidence file. `complete` means every referenced issue in that
selection was fetched, not that the entire Linear workspace was audited.
`observed_at` is the actual UTC observation time. Use the connector's canonical
UUID in `id`, and its human issue key in `identifier`. Resolve tracker status
types from team workflow metadata; never guess completion from a status name.

```json
{
  "complete": true,
  "observed_at": "2026-10-14T12:00:00Z",
  "issues": [{
    "id": "11111111-1111-4111-8111-111111111111",
    "identifier": "EXAMPLE-1",
    "title": "Implement the scoped API",
    "url": "https://linear.app/example/issue/EXAMPLE-1",
    "description": "Full tracker description",
    "state": {"name": "Done", "type": "completed"},
    "priority": 2,
    "assignee": null,
    "labels": [],
    "project": {"id": "22222222-2222-4222-8222-222222222222", "name": "Milestone 2.1"},
    "createdAt": "2026-10-01T12:00:00Z",
    "updatedAt": "2026-10-14T11:00:00Z",
    "completedAt": "2026-10-14T11:00:00Z"
  }]
}
```

`priority` is numeric (0–4); `assignee`, if present, has `id` and `displayName`.
Labels have `id`, `name`, `color` and `group` (null or its upstream object).
`project` may be null for external issues with no assigned project.
`completedAt` may be null. All shown fields are required, including description;
optional `attachments` and `comments` are retained in detail provenance when
actually fetched. Do not invent comments or change tracker relations.

Unit/external/contextual issue cards use their actual issue key when unique.
Human, evidence and release cards use stable `GATE-<manifest-node-id>` keys and
explicit `raw.checkpoint` display metadata. The viewer renders these as roadmap
checkpoints, without a ticket key, priority or unassigned-user footer. Without
separate observations they remain unverified, even when their linked ticket is
Done. A linked issue's state alone never verifies an approval or evaluation. If a ticket
has several unit representations, stable `VIEW-<node-id>` keys avoid collapsing
them. Unlinked units use `PROPOSED-<node-id>` and a Proposed unit label; unlinked
external prerequisites use `EXTERNAL-<node-id>` and an External prerequisite
label. Both stay unverified and retain their actual roadmap project instead of
being grouped with checkpoints. Each detail retains the original UUID/key when
linked, manifest node kind, acceptance,
source, project admission, incoming/outgoing events and their sources.

The viewer's generic Blocks/Blocked by counts project event-specific conditions
onto one relation model. They are not scheduling/readiness calculations.

## Reconcile checkpoint evidence

The snapshot may include a `checkpoints` array. Each entry names `node_id`, the
exact `manifest_digest`, `status`, `summary`, `observed_at`, and nonempty
`evidence` entries with `kind`, HTTPS `url` and `summary`. A completed entry also
requires its original `event_at`. Duplicate, unknown, unrelated and stale-digest
observations fail the import. Observations are display evidence, not execution
admission or new approval records. Preserve original actors, dates, reviewed
SHAs and acceptance boundaries in their source explanations.

Statuses are `verified`, `historical`, `pending`, `failed` and `unknown`.
`verified` requires human-decision evidence for a human node, evaluation evidence
for an evidence node, and release evidence for a release node. Review-and-merge
checkpoints additionally require merge and review evidence, with every merge
entry's `head_sha` matching a review entry's `sha`. Read the actual review verdict,
author and exact head; a populated review list is not a clean review.

`historical` applies only to a human review checkpoint with an outgoing merge
authorization for its linked engineering unit and observed merge evidence. It
displays as **Merge recorded** and completed history, while explicitly retaining
unverified review requirements in its summary. A merge cannot verify an eval or
release node. Use `pending` or `failed` only with evidence explaining the unmet
condition; absent evidence stays `unknown`, rather than asserting new work exists.
Review the existing scope/decision records and original evidence before changing
a checkpoint's status; never close all checkpoints merely because tickets are Done.

Preview is read-only and reports additions/removals, source digest, observation
time and resulting counts. Apply refuses a changed on-disk source before writing,
incomplete evidence, unsupported database schemas, API-key/webhook-backed
workspaces, or missing snapshot adapter support. A SQLite backup precedes one
transaction replacing only issue/label cache rows and refresh metadata.
No saved views, annotations, stage history or control-plane rows are modified.
Repeating a refresh replaces the same derived rows; it never duplicates views.

The backup is for manual recovery if needed. No service restart or cache-reset
API call is required. After import, use `open`/`status` and GET `/api/graph?w=...`
to confirm the running application reads the same rows. The helper has no tracker
or Git mutation capability; restrictions on agent actions are prompt-level.
