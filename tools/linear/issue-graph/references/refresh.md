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
an unverified triage state even when they link to a completed ticket. If a ticket
has several unit representations, stable `VIEW-<node-id>` keys avoid collapsing
them. Unlinked units use `PROPOSED-<node-id>` and a Proposed unit label; unlinked
external prerequisites use `EXTERNAL-<node-id>` and an External prerequisite
label. Both stay unverified and retain their actual roadmap project instead of
being grouped with checkpoints. Each detail retains the original UUID/key when
linked, manifest node kind, acceptance,
source, project admission, incoming/outgoing events and their sources.

The viewer's generic Blocks/Blocked by counts project event-specific conditions
onto one relation model. They are not scheduling/readiness calculations.

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
