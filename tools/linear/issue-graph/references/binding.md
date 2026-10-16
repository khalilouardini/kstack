# Viewer binding

The local application is upstream issue-graph with the snapshot adapter used by
this workflow. KStack supplies a data projection, not an application installer.
Require the installed backend to support `MVP_SNAPSHOT_MODE`, snapshot-backed
issue details and typed `orchestrationLabel`/`orchestrationType` relations. Keep
the existing service/runtime and saved views.

Point `.agents/stack.yml` at a JSON binding:

```yaml
issue_graph:
  config: /absolute/path/to/issue-graph.json
```

Alternatively save a host-local binding under
`${KSTACK_STATE:-$HOME/.kstack}/projects/<configured-project-slug>/issue-graph.json`.
This keeps machine-specific installation paths out of the product repository.
The saved binding is explicit configuration, not permission to launch other
services or modify the roadmap. Use `project-template/issue-graph.json` as an
example. Paths are relative to the binding file unless absolute; `~` expands.

```json
{
  "schema_version": 1,
  "viewer_root": "/absolute/path/to/issue-graph",
  "url": "http://127.0.0.1:31415",
  "service": {
    "label": "local.example.issue-graph",
    "plist": "~/Library/LaunchAgents/local.example.issue-graph.plist"
  },
  "projects": {
    "milestone_2_1": {"workspace": "milestone21"}
  }
}
```

`service: null` supports a viewer managed elsewhere; opening reports an offline
viewer rather than guessing a start command. This version supports loopback HTTP
only, the installation's standard `data/workspaces.db`, and its
`data/workspaces/<workspace>/graph.db`. It refuses unknown workspace IDs rather
than writing a database the running app might never read.

For first setup, inspect the application's local setup document and service
plist. Confirm its working directory, loopback URL, snapshot environment and
actual workspace roster, reading only non-secret fields. Map manifest keys to
the existing workspace names. Save an unambiguous binding and report the path;
otherwise ask for the missing choice. Do not copy credentials into this file.

No live Linear credentials are required by this adapter. The agent fetches
read-only tracker data using the available connector at each explicit refresh.
Upstream's Sync button is not a refresh of these document-derived views.
