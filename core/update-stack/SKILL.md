---
name: update-stack
version: 0.1.0
description: Update the installed kstack checkout from main, reinstall Claude Code and Codex adapters, and report stale links and project-local copies. Use when asked to "update kstack", "reinstall kstack", "refresh the shared skills", or "/update-stack [--check]". (kstack)
---

# update-stack — refresh shared skills after changes land

## When to invoke

A change has landed on kstack's remote default branch and the shared installation
needs refreshing across projects. Invoke `/update-stack`; use `/update-stack
--check` for read-only status. In an established kstack conversation, "reinstall
gstack" means this workflow; do not substitute another upstream project.

This is a manually invoked update. It creates no watcher, schedule, merge hook
or project-local copies. A merged PR is not automatically installed. The default
refreshes both Claude Code and Codex through the existing installer.

## Find the installed source, not the invoking worktree

Resolve `${KSTACK_STATE:-$HOME/.kstack}/stack-root`. Its recorded absolute path is
the canonical checkout. An explicit user-supplied root may replace it. Do not
infer the root from the consuming repo, the current feature branch or this
skill's physical path. Missing/stale record → inspect installed Claude symlink
and generated Codex pointer targets; use their single unambiguous checkout only
when it is a git root containing `bin/install` and `CONVENTIONS.md`. Conflicting
or unavailable targets → report the paths and request the intended root.

Read that checkout's `bin/install`, `hosts/HOSTS.md`, and `.agents/stack.yml`.
Keep the host mechanisms the installer implements; do not hand-edit generated
pointers or migrate installation paths as part of a reinstall. No gh/Linear
access or consuming-project gate commands are required.

## Inspect and preserve local work

Record canonical branch, HEAD, upstream and `git status --porcelain=v1
--untracked-files=all`. Run the read-only helper at
`core/update-stack/bin/installation-status --root <canonical-root>` from the
physical skill checkout. For project coverage, add explicit `--project <path>`
values and/or `--projects-under <directory>` for known local project parents.
The helper includes those repositories' registered worktrees. When no paths
were supplied, scan immediate sibling repositories under the canonical root's
parent; disclose that boundary. Include other known project locations when the
user supplies them. Never claim a whole-machine audit from this bounded scan.

`--check` stops after reporting this evidence. The helper does not fetch: label
its main comparison as local remote-tracking evidence, possibly stale.

For an update, dirty tracked **or untracked** files, detached HEAD, or a merge/
rebase in progress → stop before changing the canonical checkout or adapters.
Report the paths/state and still report installation status. Preserve everything;
never stash, reset, clean, move edits, commit someone else's work or switch its
branch to make an update pass. The user can preserve that work separately and
invoke the skill again. Do not refresh adapters from a dirty feature checkout.

## Update main and reinstall

Use the canonical checkout's `origin`, resolving its remote default branch via
`git ls-remote --symref origin HEAD`; check status/errors rather than guessing a
branch name. Fetch `refs/heads/<default>` into
`refs/remotes/origin/<default>` and pin its exact SHA. Set the local
`origin/HEAD` alias to that verified default with `git remote set-head origin
<default>` so subsequent audits inspect the same ref. The canonical branch must
be the default branch or track `origin/<default-branch>`, and its HEAD must be an
ancestor of the fetched SHA. Ahead/divergent/wrong branch → stop, naming both
SHAs; never rebase, force or change branches. Check branch/HEAD/cleanliness again
immediately before the write, then fast-forward only to the pinned SHA:

```bash
git -C "<canonical-root>" merge --ff-only "<fetched-default-SHA>"
```

Verify HEAD equals the pinned SHA and the checkout remains clean. Run the
**updated checkout's** normal installer, sequentially, stopping on any failure:

```bash
"<canonical-root>/bin/install" --host claude --force
"<canonical-root>/bin/install" --host codex
```

`--force` is only the installer's symlink replacement; it must not become a
recursive delete or overwrite of real skill directories. Inspect conflicting
host entries first: unrelated custom symlinks/files or installer refusals are
holds, not permission to remove them. Generated kstack pointers and links to
other checkouts of this same stack may be refreshed. Keep project-local copies
and unrelated skills untouched. A partially successful install stays partial;
report the exact stage and changes, without silently rolling back.

## Verify and report the effective installation

Run `python3 "<canonical-root>/bin/check-stack"`, then re-run installation-status
against that same root and the disclosed project scope. Recheck pinned HEAD and
cleanliness. Success requires zero installer skips/errors, a passing gate, every
expected Claude link resolving to the canonical skill directory, every Codex
pointer naming that source with matching name/version/description, and the root
record matching. Missing/orphaned adapters, unreadable evidence or moved HEAD
prevent a global success claim. Do not automatically remove orphaned adapters.

Report the canonical path and installed SHA, default branch and fetched SHA,
per-host current/expected counts, gate exit code, exact project scan scope and
local duplicate/override paths. Separate **shared installation current** from
**project-local copies found**: a global reinstall cannot remove the latter.
Codex duplicate names can coexist in discovery; do not claim the helper proves
which prompt an already-running host has loaded. For a session retaining older
instructions, have it re-read the skill or restart the session/app if needed.

The helper's exit codes are 0 (checked installation current, no local findings),
1 (action needed, with shared/project results separate), and 2 (UNKNOWN/error).
It is read-only and never fetches or installs. Update/refusal rules and host
refresh behavior are **prompt-level**; the helper verifies filesystem/git facts,
not loaded agent context. Rechecks reduce shared-checkout races but do not lock
out other agent sessions. Stop if concurrent changes are detected.
