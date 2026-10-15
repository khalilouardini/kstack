# Complete PR file snapshot

Shared read-only evidence contract for `/next` and `/triage`. The caller supplies
repository and PR numbers, allowed state and failure policy. `/next` requires
OPEN accepted PRs and refuses incomplete evidence; `/triage` retains state
transitions and marks affected fields/order UNKNOWN. This contract grants no
file-overlap acceptance or merge permission.

## Collect

Deduplicate by canonical repository and PR number. Fetch the PR's live diff,
number, title and author. Fetch `changedFiles`, state and head SHA with
`gh pr view <n> --json changedFiles,state,headRefOid,number,title,author` in the
consuming repo, then exhaust
`gh api --paginate repos/{owner}/{repo}/pulls/<n>/files`.

## Verify stability and completeness

Check API status and errors before using results. Require the file-record count
to equal `changedFiles`; a mismatch, including the REST endpoint's file cap,
is incomplete evidence even when HTTP succeeded. Re-read state/head and retry
if either changed, at most two retries (three attempts total). A caller may
also recheck base, labels or body; its broader snapshot invalidation applies.
If a stable complete snapshot cannot be established, use the caller's failure
policy and name the missing evidence. Do not combine old files with a new head.

Include both `filename` and `previous_filename` for renames when comparing
paths. `gh pr view --json files` alone is not completeness evidence. Retain the
file count, head/state and timestamp with the snapshot.
