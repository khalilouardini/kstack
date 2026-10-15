# Verified Linear project resolution

Shared read-only contract for `/next` and `/triage`. Callers supply the issue
state restriction (next: open; triage: **all issue states**, including terminal
containers). Selection is not scope authorization. No ranking, graph admission,
tracker mutation or kickoff belongs to this contract.

## Access and team

Read `.agents/stack.yml`. When `workspace_contract` is set, read it and prefer
its tracker access and verification path. If absent, disclose that no workspace
contract was configured. Prefer the Linear connector when available; otherwise
use GraphQL with `LINEAR_API_KEY`. Missing access on a requested project pass
refuses that pass, naming the evidence; never substitute GitHub labels.

Resolve the consuming team to its canonical ID from the workspace contract, or
from `issue_prefix` resolved against `teams`. Missing `issue_prefix` alone skips
only the issue-key-prefix sanity check, announced; it does not remove the team
constraint. If neither source identifies the team, refuse and name the key that
would have resolved it. Exhaust team lookup and reject ambiguity. Never use an
unscoped workspace result as a fallback.

## Resolve projects

Parse quoted values as one argument; each `--project` requires a non-empty value.
Refuse malformed flags before tracker access. Repeated filters form a **union**,
not an intersection or separate batches. Resolve each value to a canonical
Linear project ID: accept an ID only after fetching that project; otherwise
exhaust project lookup and require exactly one exact name match. Missing or
ambiguous names refuse with the value and available IDs. Never choose the first
search result or silently broaden a query. Deduplicate resolved IDs, including
a name and ID naming the same project.

Verify each project's team membership against the resolved consuming team ID.
A project not belonging to that team or unavailable membership fails closed.
A cross-team project can contribute only the consuming team's issues.

## Verify issue membership

Query using the resolved project **IDs** and canonical team constraint, with the
caller's state restriction. Exhaust every issue page. Verify each returned
issue's `project.id` is in the resolved set and its team ID matches; a null
project, leaked row or truncated result fails closed, naming the input. Do not
silently discard leaks and call the query verified. Deduplicate issues by
canonical issue ID before selection. A connector's name filter is not proof.

Check transport status and GraphQL errors even alongside partial data. Each
connection needs its own advancing cursor and `hasNextPage=false`; unreadable
pages or missing nested membership evidence mean failure, never an empty set.
Record canonical project/team IDs, input values and verification provenance.
