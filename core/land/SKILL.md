---
name: land
version: 0.2.0
description: Land an agent session's work safely — dedicated branch, concurrent-session guards re-run before every commit, the repo's own lint and test gates from .agents/stack.yml, atomic commits, then one PR. Stops at the PR; merging is a human decision. Use when asked to "land this", "commit and push", "open a PR", "ship it", or "/land". (kstack)
---

# land — get a session's work onto a branch, through the gates, and into a PR

## When to invoke

Work is done in the working tree and needs to become a reviewable PR. Invoke as
`/land` (or `/land <type>/<name>` to name the branch yourself).

This skill assumes **other agent sessions may be sharing this working directory
and the machine's global state right now**. Most of its steps exist for that
reason, and they re-run before every commit rather than once at the start.

It stops at the PR. It does not merge, and it is not an auto-ship pipeline —
see "What this skill is NOT for".

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: kstack
`CONVENTIONS.md` §2).

- **`gates.lint`** — missing or null → **refuse**, naming `gates.lint`.
- **`gates.test`** — missing or null → **refuse**, naming `gates.test`. Use
  `gates.test_full` instead only when the user asks for the full suite.
- **`protected_branches`** — globs this skill must never commit to, in addition
  to the repo's default branch. Absent or empty → protect the default branch
  alone. (The schema comment names triage's use of this list; this skill reads
  the same list for the same reason.)
- **`issue_prefix`** — when set, an issue key may appear in the branch name and
  PR title. Optional; absent means plain branch names.
- **`identities.implementer`** — the implementation-agent account that opens
  the PR (Claude by default). Missing or null → **refuse**, naming
  `identities.implementer`. Resolve its token for forge API calls; never switch
  global `gh` identity.

Missing `.agents/stack.yml` altogether → refuse and name the file.

A red gate is the whole point of a gate. Never substitute a guessed lint or test
command for a missing key — a gate that defaults open is not a gate.

## The shell does not persist state between tool calls

Every Bash call starts fresh: no variables, no exported values, no `cd`. This
splits git work into two kinds of call, and the split is load-bearing:

- **Reads are separate calls.** You need to *see* the output and decide before
  the next step. Never chain a safety check into the command it is supposed to
  guard — chaining it means you never read it.
- **In a shared worktree, chain a dependent write sequence into one `&&` call.**
  Branch-then-stage-then-commit, in one call.

```bash
# assert, then commit — the assertions are what make this safe, not the &&
git checkout -b feat/session-expiry && \
  git add src/session.py tests/test_session.py && \
  test "$(git branch --show-current)" = feat/session-expiry && \
  test "$(git diff --cached --name-only)" = "$(printf 'src/session.py\ntests/test_session.py')" && \
  git commit -m "fix: redirect on expired session cookie"
```

The two `test` lines narrow the window. **They are not a guarantee, and this
skill should not call them one.** `test` and `git commit` are still separate
processes, so a sibling can move `HEAD` or stage foreign paths after the last
assertion passes and before the commit starts. That is a time-of-check to
time-of-use race, and no ordering of checks inside a shared worktree closes it.

So the rule is:

- **Use an isolated worktree for anything that commits.** `git worktree add`
  gives this session its own `HEAD` and its own index, which is the only
  arrangement where the commit *cannot* land on another branch or absorb another
  session's staged paths. In an isolated worktree you do not need the chain or
  the assertions.
- **If you must commit from a shared worktree**, run the assertions above and
  treat the result as best-effort: they catch drift that has already happened,
  they cannot prevent drift that happens next. Say so when reporting — "committed
  from a shared worktree; branch and staged set were verified immediately before
  the commit, which narrows but does not eliminate the race" — rather than
  reporting the commit as verified.

**Be precise about why, because the obvious reason is wrong.** `git checkout -b`
writes the worktree's `HEAD`, which lives in `.git` and persists across shells
and tool calls — the branch does *not* reset between calls. What does not
persist is process state: environment variables, and `cd`. So the branch can
differ in your next call for exactly one reason: **another session moved the
shared worktree.**

That makes chaining a concurrency mitigation, not a shell-semantics
requirement — and it narrows the race without closing it, since each command in
the chain is still a separate `git` process a sibling can interleave with.

Two things actually protect you, in order:

1. **A per-session worktree.** `git worktree add` gives this session its own
   checkout and its own `HEAD`, so no sibling can move the branch under it.
   This is the only real isolation; prefer it for any multi-commit task. **In an
   isolated worktree the chaining above is unnecessary** — split the steps
   across calls freely and read each result.
2. **Re-verifying the branch immediately before the commit** (Step 4), which
   catches drift that already happened rather than preventing what happens next.
   In a shared worktree this is the best available check — not a guarantee, and
   not a substitute for (1).

## Step 0 — baseline, before you touch anything

Two numbers, recorded in the transcript. Everything later is compared against
them.

```bash
git log --oneline -1                 # the commit you started from
git branch --show-current
git status --porcelain
```

Then the **test count** — the number the runner itself reports from
`<gates.test>`, not an estimate. Record the literal figure. Later, when the count
moves by more than the tests you wrote, the difference is a sibling session's
commits landing in the shared tree, not a mystery.

If you have a known-good count from earlier in this session, reuse it rather than
paying for a full run.

## Step 1 — a dedicated branch, never a shared one

**Never commit to the default branch, to any branch matching
`protected_branches`, or to whatever shared branch the tree happens to be on.**
The current branch was very likely set by someone else — a sibling session, or
the last task — and it is not yours to add commits to.

Create `<type>/<name>`:

- `<type>` — one of `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- `<name>` — kebab-case, describing the change, not the ticket. With
  `issue_prefix` set, `<PREFIX>-<n>-<name>` is fine.

```bash
git checkout -b fix/expired-session-redirect
```

If the current branch is already a dedicated branch **you** created this session,
stay on it. If you cannot account for it, treat it as shared and branch from it.

## Step 2 — before the first edit in a worktree you did not dirty

```bash
git status
```

Tracked modifications you cannot account for mean **STOP**. Another session may
own them, and editing on top makes their work unattributable and your diff
unreviewable. Before concluding anything:

- Check for running agent sessions on this machine.
- Check modification times on the changed files — minutes-old mtimes on files you
  never opened is a live session, not leftover state.
- Check sibling worktrees (`git worktree list`) for uncommitted work.

Then **report and stop**. Do not stash, do not reset, do not "just work around
it" — say what you found, name the files, and let the human decide. Resuming
after they confirm the changes are stale is fine; resuming on your own judgement
is not.

## Step 3 — before claiming any numbered filename

ADRs, migrations, sequential specs — anything whose name carries the next number
in a series. The number you would pick from your own branch is wrong the moment a
sibling branch already took it, and the collision surfaces at merge, not now.

Check **across all branches**, not just yours:

```bash
git log --all --diff-filter=A --name-only -- 'docs/adr/*' | sort -u
```

`--all` is the load-bearing flag and `--diff-filter=A` restricts it to the commit
that *added* each file. Take the next number above the highest you see, not above
the highest on your branch.

## Step 4 — before every commit, not just at task start

Re-run both checks before **each** commit. Siblings switch branches and stage
files mid-turn; a check that passed at task start proves nothing about now.

```bash
git branch --show-current        # still your branch?
git diff --cached --name-only    # is everything staged yours?
```

- **Branch drifted** → a sibling switched the shared checkout. Do not commit.
  Return to your branch and re-verify before staging again.
- **A staged path you did not stage** → a sibling's work. Unstage it:

  ```bash
  git restore --staged <path>
  ```

  A sibling's staged edits must never ship inside your commit. Never `git add -A`
  and never `git add .` — stage the exact paths you changed, by name.

## Step 5 — commit atomically

One logical change per commit. A refactor and the bugfix it enabled are two
commits. A commit whose message needs "and" is usually two commits.

Message: imperative subject line, `<type>: <what changed>`, and a body only when
the *why* is not obvious from the diff. State what changed, not that you changed
it.

## Step 6 — after committing, re-check the log

```bash
git log --oneline -5
```

An unexpected commit is **more likely a parallel session than your mistake** —
that is the default assumption, and it changes what you do next. Do not amend,
rebase, reset, or cherry-pick a commit you did not author until you know what it
is.

To find out whether a foreign commit is genuinely new work or a duplicate an
earlier rebase produced, compare its patch identity against origin:

```bash
git show <sha> | git patch-id --stable
```

Same patch-id as a commit already on origin → it is a duplicate of work that
already landed. **Leave it alone**; a later rebase drops it on its own. Removing
it by hand rewrites history that a sibling session may be sitting on.

Different patch-id → it is real, unlanded work belonging to someone else. Leave
it alone too, and report it.

## Step 7 — gates before push

```bash
<gates.lint>
<gates.test>
```

Run both. Red gate → **fix it, or report it and stop**. Never push over a red
gate and never push with a note promising to fix it after.

Two readings that are not a pass:

- The gate passed on a tree containing a sibling's uncommitted changes. Your
  commit is not what was tested. Re-run on your committed state.
- The test count moved by more than the tests you added. Something else landed;
  find out what before pushing (Step 6).

If a gate is red for a reason your change did not cause — a pre-existing failure
on the base — say so with the evidence (the same failure on the base commit), and
let the human decide. Do not silently accept it.

### Optional pre-PR self-review

With both gates green, a built-in `/code-review` pass over the branch diff is a
cheap way to catch defects before the PR exists — before the reviewer identity
spends a round on them in `pr-loop`. It is optional and session-local: findings
stay in the session, nothing is posted. Skip it when the user asked for speed.
Never use its `--comment` flag from this skill — that posts as the human
account, and PR commentary belongs to the review cluster's configured
identities.

## Step 8 — push and open the PR

```bash
git push -u origin <your-branch>
```

Then open the PR:

```bash
IMPLEMENTER="<identities.implementer>"
IMPLEMENTER_TOKEN=$(gh auth token --hostname github.com --user "$IMPLEMENTER")
test "$(GH_TOKEN="$IMPLEMENTER_TOKEN" gh api user --jq .login)" = "$IMPLEMENTER"
GH_TOKEN="$IMPLEMENTER_TOKEN" gh pr create --base <default-branch> --title "<type>: <what changed>" --body "<body>"
```

Body: what changed and why, the gate results as evidence (`<gates.lint>` clean,
`<gates.test>` N passed), and anything a reviewer should look at first. A merged
PR is not gate evidence and neither is a green PR page — the evidence is the gate
output you ran.

**Do not merge it.** Not with `gh pr merge`, not with auto-merge, not "since it's
green". Merging is a human decision, and it is the only decision this skill
deliberately refuses to make. Merge only when the user asks in this session, in
their own words.

Without a forge CLI available, stop after the push and report the pushed branch
and the gate results. The PR step is the only part of this procedure that needs
one.

### gh identity

`gh` auth is **global mutable state**, shared by every shell and every concurrent
session on the machine. Never call `gh auth switch` from this skill. Bind PR API
calls to the verified implementer token with `GH_TOKEN`, which is process-local
and safe for parallel sessions. Git transport authentication is separate from
PR authorship: SSH keys and HTTPS credential helpers may identify the pusher,
while the token-bound `gh pr create` determines the visible PR author.

## Safety invariants

All **prompt-level** — this skill holds Bash, and a shell can commit, push, and
call APIs regardless of what the procedure says. Nothing in this skill blocks a
violating call. They are rules the procedure follows, not capabilities that are
absent.

One exception, on hosts that support PreToolUse hooks: with `core/careful`
active, force-push to the default branch is **hook-enforced** (hard-denied) and
other destructive git commands prompt. That covers one failure mode of invariant
1; every other invariant below stays prompt-level whether `careful` is on or not.

1. **Never commit to the default branch, a `protected_branches` match, or an
   unaccounted-for shared branch.**
2. **Unexplained tracked modifications stop the session.** Report; do not stash,
   reset, or edit over them.
3. **The concurrent-session checks re-run before every commit**, not once at
   task start.
4. **Stage by explicit path.** Never `git add -A` / `git add .`. Unstage anything
   you did not stage yourself.
5. **Never push over a red gate.**
6. **Never merge.** Open the PR and stop.
7. **Never rewrite a commit you did not author** — check `git patch-id --stable`
   first, and leave origin-duplicated commits for the rebase to drop.
8. **Never switch global `gh` identity.** Bind forge API calls to the verified
   implementer token; leave Git transport authentication independent.

## What this skill is NOT for

- **Auto-ship.** This deliberately replaces the gstack-style
  decide-build-review-merge pipeline. That shape ends at a merge the agent chose
  to perform; this one ends at a PR a human chooses to merge. The missing step is
  the point — the constraint worth preserving is something empowered to decline.
- **Merging, approving, or changing PR state.**
- **Answering review feedback** — see `tools/github/review-comments`.
- **Scoring the repo.** `core/health` runs the same commands as a dashboard;
  this skill runs them as a blocking gate.
- **Deciding whether the work should exist.** Scope is decided before the work,
  not at landing time.
