---
name: decision-queue
version: 0.1.0
description: Open a local keyboard-driven page for maintainer decisions on the consuming repository's open pull requests. Use when asked to "open the PR decision queue", "show me the PR decision page", or "/decision-queue". (kstack)
---

# decision-queue — decide on open pull requests

## When to invoke

Open this page when the user asks to work through the consuming repository's open
GitHub PRs. Launching the page authorizes reading PRs. The maintainer uses the page
to choose individual actions.

## Launch

Identify the consuming GitHub.com repository as `owner/repo` from its Git remote or
the user's explicit selection. Read that repository's `.agents/stack.yml` and use
the values of `project`, `ci.checks` and `identities.maintainer` as required flags.
Name any missing key and stop. The server reads no project YAML. It calls
`bin/resolve-identities --project <project>` and uses the host-local maintainer
override when configured.

Run the server from the physical kstack checkout that provides this skill.
Replace each placeholder with the resolved value.

```bash
"<kstack checkout>/tools/github/decision-queue/bin/decision-queue" \
  --repo "<owner>/<repo>" --project "<project>" --ci-checks "<ci.checks>" \
  --maintainer "<identities.maintainer>"
```

Append `--merge-method <merge|squash|rebase>` when `merge.method` is configured.
When the key is absent or null, omit the flag. The page names `merge.method` and
disables merge while leaving close and comment available.

The server needs Python 3 and `gh` with a stored token for the resolved maintainer.
Open the printed URL in the local browser, keep its token private and leave the
server running while the page is in use. Use Ctrl+C in the server terminal to
stop it.

## Read and act

The page loads a snapshot on open and on explicit refresh. Passing CI sorts
first, then pending, then failing or unknown, oldest first within each group.
CI follows [the review loop's step 3a](../pr-loop/SKILL.md) for the selected
check mode. `required` uses the required checks GitHub has reported and `all` uses
all reported checks. Failed or cancelled checks fail, and skipped checks count
as passed. An empty result gives no green evidence.
`none` explicitly bypasses the CI requirement. Use Refresh after GitHub updates.

Review reads UNKNOWN. When the answered-findings ledger exists, the page reports
whether its last head matches the PR head. A match records answered findings
only. The screenshot flag indicates a media reference in the PR description or
in a GitHub comment from a user account.

Use `j`/`k` or the arrow keys to select a row, `m` to start merge, `x` to start
close, and `c` to compose a comment. Use Escape to dismiss a pending action.
Merge and close require a second confirmation. Merge requires an open,
mergeable, non-draft PR and passing configured checks (or `ci.checks: none`).
The server checks the head and CI again before issuing a direct merge pinned to
the displayed head. GitHub merge-queue PRs require action in GitHub.

Writes use an explicit repository and a per-command token verified against
the resolved maintainer. Each attempted GitHub write appends its timestamp,
repository, PR number, head SHA, action, note and GitHub CLI exit code to
`${KSTACK_STATE:-$HOME/.kstack}/projects/<project>/decision-queue/decisions.jsonl`.
