# One preparation, concurrent planners

The caller already reads the project pool, scope, ownership, graph and admission
before Workflow. Finish the deterministic selection and literal scan there.
For new version 2 plans pass this transient argument (not a RUN_A schema field):

```json
{
  "prepared_plan": {
    "snapshot_id": "same as selection_snapshot",
    "source_revision": "same installed source SHA as selection_snapshot",
    "main_sha": "same fresh main SHA as graph_publication",
    "checked_at": "same UTC observation as graph_publication",
    "selection": {"tracks": [], "planning_tracks": [], "sequenced": [], "already_active": []},
    "literals": [],
    "evidence": ["/absolute/path/to/original/observations.json", "/absolute/path/to/full/admission.json"]
  }
}
```

`selection` obeys SELECT exactly, including full TRACK objects. Branch/worktree
are proposals until dispatch read-back. Copy membership and scope from the
deterministic assessment, not a second ranking. Preserve every exclusion in the
assessment; record active/resumable work without creating duplicate tracks.
`literals` uses SHARED_LITERAL and names unique selected build participants. Read
the selected issue descriptions and file scopes for status tokens, schema fields,
config keys, paths and marker comments two or more tracks must agree on. Empty
means the caller checked and found none; it is not a default for an omitted scan.
Planning-only tracks have no build agreement or approval permission.

The runtime validates the closed SELECT/SCAN contracts, snapshot/source/main/time
pins, exact build/planning membership, projects/files and candidate admission
before A3/A4. It emits `preparation_reused`, keeps the full original evidence in
the checkpoint, and omits A1/A2 agent starts. Missing handoff retains the legacy
path for old callers; malformed handoff refuses instead of falling back silently.
Neither a prepared handoff nor its event proves source truth or freshness.

Each A4 reads the canonical dispatch procedure and receives only its candidate
and closure projection plus original artifact locators. It must follow dispatch's
Prepared planning handoff procedure. Reuse immutable source content by exact
revision/digest; observe mutable issue/relations, original decisions, main/graph
pins, ownership and status before writes. Re-run admission from fresh closure
facts; unchanged pins alone cannot certify mutable facts. Changed relevant facts
stop that track before writes. Never expand to the whole project or relaunch a
preparation agent just to recover already pinned context. A missing required
artifact is a named failure, not permission to invent an empty set.

Planners enter the existing bounded worker queue as soon as shared prerequisites
are ready. Local graphs keep agreements in the handoff and skip A3; published
shared contracts retain A3 and the human merge checkpoint. Worker concurrency,
native blockers, plan approval, tracker lifecycle and merge rules are unchanged.

Measure on the host: timestamp evidence collection start/end, selection ready,
each actual planner start and each plan result. Preserve native Workflow node
timestamps or a live timestamped stream. A finished log export's time is not the
node's time. Report selected build/planning-only counts, ready plans, repeated
reads/starts, auth/provider/human waits and worktree/status side effects. Reuse one
frozen selection baseline for comparison arms and refresh mutable facts without
reselecting after dispatch alters ownership. Resume verified existing work.
Offline call-count tests establish eliminated orchestration, not live speed.
