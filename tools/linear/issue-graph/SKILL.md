---
name: issue-graph
version: 0.1.1
description: Open, inspect or refresh a local issue-graph visualization from the indexed roadmap and fresh Linear ticket data. Use when asked to "launch the issue graph", "open the roadmap visualization", "refresh the issue graph", or "/issue-graph open|status|refresh [project]". Does not change the roadmap or tracker. (kstack)
---

# issue-graph — open and refresh the roadmap viewer

## When to invoke

The user wants to view an existing roadmap, check whether its visualization is
current, or refresh that visualization. Default to `open` when they only ask
to launch it. `refresh` updates the selected local view and opens it afterward.
Neither mode schedules future refreshes. A recurring request uses the host's
supported scheduler separately, with an explicit refresh instruction.

This skill renders an existing roadmap. Changed scope, missing tickets or
changed dependencies belong to `/linear-roadmap`; name the discrepancy and
route there only when the user requests reconciliation. Opening the viewer
does not require roadmap publication, scope approval or an execution source pin.
This workflow reads Linear and writes only local viewer caches; no tracker
writes, agent dispatch, merges or deployment authorization (prompt-level).

## Resolve the installation and project

Read the consuming repository's `.agents/stack.yml`. Resolve the physical
canonical skill directory: Claude follows its symlink; Codex reads its pointer.
The helper is `bin/issue-graph` beneath that canonical directory, not the Codex
pointer directory.

Resolve the binding from `issue_graph.config`, relative to the consuming root
unless absolute. An existing saved binding at
`${KSTACK_STATE:-$HOME/.kstack}/projects/<project>/issue-graph.json` is also
supported; `<project>` is the configured repository slug. If neither exists,
use installation evidence already available in the session (service plist,
local setup document, installed viewer) to prepare and save the binding there.
Do not invent installation paths or project/workspace mappings. Ask only for a
choice that the evidence cannot resolve. See
[references/binding.md](references/binding.md) for the format and first setup.

Match the requested project by manifest key, exact title or canonical Linear
UUID. The binding maps that key to an existing viewer workspace. With one
binding entry, it is unambiguous; with several and no project in the request,
use the established session project or ask which project. Do not substitute
the viewer's default workspace. Report missing installations rather than
cloning, upgrading or replacing the application as part of an open request.

## Open or inspect

Run the helper using absolute paths:

```text
python3 <skill-dir>/bin/issue-graph open --config <binding.json> --project <key> --repo <consuming-root>
python3 <skill-dir>/bin/issue-graph status --config <binding.json> --project <key> --repo <consuming-root>
```

`open` checks the selected API view, starts its configured macOS user service
if needed, then returns its URL. It does not start a second server when the
service is already healthy. Use the available browser-opening tool to show
that URL; otherwise return a clickable link. `status` never starts a service.
Both compare stored snapshot provenance with the current manifest digest.
An older installation without provenance is UNKNOWN, not current.

## Refresh

Read [references/refresh.md](references/refresh.md). Read
`orchestration/index.json` and its one manifest from the selected consuming
checkout, including uncommitted owner changes when that is the requested source.
The helper validates its structure without repinning or modifying the roadmap.
Report this as a checkout snapshot; source-pin validation and publication are
not verified by this visualization workflow.

List the exact UUIDs needed before fetching tracker data:

```text
python3 <skill-dir>/bin/issue-graph requirements --config <binding.json> --project <key> --repo <consuming-root>
```

Fetch fresh Linear details for every issue UUID in the selected project and
its transitive incoming prerequisites. Include referenced completed, canceled
and archived tickets. Read full descriptions, status/type, labels, assignee,
priority, project and timestamps. Use the connected tracker or an established
read API; never scrape secrets out of another application's database. Normalize
the results to the evidence format in the reference. Missing access/details
stops the refresh, preserving the previous view; do not mix old cached ticket
data with new graph structure and call it fresh. Native Linear relations do not
replace the roadmap's stage-specific edges.

```text
python3 <skill-dir>/bin/issue-graph refresh --config <binding.json> --project <key> --repo <consuming-root> --issues <fresh-evidence.json>
python3 <skill-dir>/bin/issue-graph refresh --config <binding.json> --project <key> --repo <consuming-root> --issues <fresh-evidence.json> --apply
```

Inspect the preview before applying. An explicit refresh request authorizes the
local cache replacement; no extra confirmation is required. The helper backs up
the selected workspace, then transactionally replaces its issue/label caches,
including removal of obsolete nodes and edges. Saved views, annotations,
workstreams and other workspaces remain intact. Human/evidence/release nodes
stay unverified regardless of their linked ticket's status. The helper refuses
credential-backed workspaces and viewers lacking the snapshot adapter.

Open the selected view and read its API again. Check identifiers, edge types,
labels and detail content against the import, including a linked checkpoint.
Browser reload is sufficient; restarting alone does not refresh data. Report
API failures separately from a successful local import. If the old installation
has a hardcoded date banner, disclose that stale banner and use the node detail
provenance as the authoritative refresh timestamp; do not patch application
source or claim the banner proves freshness.

## Output

Lead with the link and result: OPEN, REFRESHED, STALE or UNKNOWN. Give the selected
project, manifest digest/source checkout, Linear observation time, node/condition
counts and backup path when changed. Distinguish roadmap freshness from ticket
freshness. A current display does not prove execution or release readiness.
