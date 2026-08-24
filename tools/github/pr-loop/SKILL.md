---
name: pr-loop
version: 0.1.0
description: Drive an unattended reviewer↔responder loop on one open PR to CLEAN, BLOCKED, or ROUNDS_EXHAUSTED: each round runs the Codex reviewer via `codex exec`, answers findings with review-comments (fix + reply as the bot), then re-checks the exit gates. Bounded by a round cap, a repeat-finding ledger that survives invocations, and a head-SHA marker so no round is paid twice. Use when asked to "run the review loop", "ping-pong this PR", or "/pr-loop <PR#> [--max-rounds N] [--merge]". (kstack)
---

# pr-loop — run the review ping-pong to a stop condition

## When to invoke

One open PR needs review rounds driven to a stop condition without a human in
the seat: review → fix → reply → re-review, until the PR is clean, a
disagreement blocks it, or the round budget runs out. Invoke as
`/pr-loop <PR#> [--max-rounds N] [--merge] [--any-author]`. Not for reviewing a
human-authored PR, not for deciding contested design questions, and not for
approving — see "What this skill is NOT for".

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: kstack
`CONVENTIONS.md` §2) before preflight:

- **`identities.reviewer`** — the human maintainer's gh login. This is the
  loop's `$ORIG`, the account the reviewer posts under, and the only account
  that ever merges. Missing or null → **refuse**, naming `identities.reviewer`.
- **`identities.bot`** — the responder identity that authors every reply.
  Missing or null → **refuse**, naming `identities.bot`. Both identities are
  required *here*, unlike `review-comments`, which degrades to human-account
  replies when no bot is configured. This loop is unattended: posting under the
  maintainer's own account with nobody watching is not a degradation the loop
  gets to choose on its own.
- **`gates.lint`, `gates.test`** — the responder's pre-push gate,
  `<gates.lint> && <gates.test>`. Either missing or null → **refuse**, naming
  the exact key. A gate that defaults open is not a gate.
- **`review_gate.skill_path`** — the project's "prove the bug" review skill,
  and **`review_gate.scope`**, the diff paths that trigger it. Non-null → the
  reviewer round is expected to run it over matching diffs, and preflight
  asserts it is **tracked** (an untracked copy is not a dependency). **Null →
  rounds run without a project review gate**, using the generic reviewer only;
  say so once in the final report, plainly: *"no project review gate configured
  (`review_gate.skill_path: null`) — rounds ran with the generic reviewer
  only."* Do not substitute a guessed skill.

Missing `.agents/stack.yml` altogether → refuse and name the file.

## What this skill drives

This skill is the **driver** for two review skills that already exist and are
not changed here:

- **the reviewer** — kstack [`tools/github/review-claude-pr`](../review-claude-pr/SKILL.md),
  run by Codex, posts a `COMMENT` review as `identities.reviewer`.
- **the responder** — kstack [`review-comments`](../review-comments/SKILL.md),
  run by you, fixes the code and replies as `identities.bot`.

Neither one decides when to stop. This one does. It is **unattended by design**:
it posts, pushes, and replies without asking. It never merges unless `--merge`
was passed on the invocation.

## Preflight — run once, stop on any failure

Every variable the round uses is defined here. The round body below assumes all
of them exist; do not run it against a partial preflight.

```bash
PR=<number>
MAX_ROUNDS=5; N=0                                        # --max-rounds overrides MAX_ROUNDS
                                                         # N counts rounds in THIS invocation only —
                                                         # see "Resuming after ROUNDS_EXHAUSTED"
REVIEWER="<identities.reviewer>"                         # from .agents/stack.yml
BOT="<identities.bot>"                                   # from .agents/stack.yml

codex --version                                          # the loop is not runnable without it
gh auth status                                           # must list BOTH $REVIEWER and $BOT
ORIG=$(gh api user --jq .login); test "$ORIG" = "$REVIEWER"

REPO_ROOT=$(git rev-parse --show-toplevel)
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
OWNER=${OWNER_REPO%/*}; REPO=${OWNER_REPO#*/}
SCRATCH=$(mktemp -d)                                     # session scratch, never inside $REPO_ROOT
trap 'rm -rf "$SCRATCH"' EXIT

# durable, per-PR answered-findings ledger — OUTSIDE $SCRATCH and outside $REPO_ROOT,
# because the repeat-finding guard must survive this invocation. See step 5.
STATE_DIR="${KSTACK_STATE:-$HOME/.kstack}/pr-loop"
mkdir -p "$STATE_DIR"
LEDGER="$STATE_DIR/$OWNER-$REPO-$PR"
touch "$LEDGER"

# the reviewer contract this loop delegates to, resolved through the host's installed
# skill path (bin/install symlinks stack skills there). If your host installs skills
# somewhere else, assert that path instead — but assert one.
test -r "$HOME/.claude/skills/review-claude-pr/SKILL.md"

# the project review gate, ONLY when review_gate.skill_path is non-null — tracked,
# because an untracked copy is not a dependency
git -C "$REPO_ROOT" ls-files --error-unmatch "<review_gate.skill_path>" >/dev/null

# baseline of files already untracked here, so the pre-push guard can tell them
# from anything THIS loop leaves uncommitted
git status --porcelain --untracked-files=all | sort > "$SCRATCH/untracked-baseline.txt"
gh pr view "$PR" --json number,state,isDraft,headRefName,headRefOid,mergeable,author

# authorship scope — see below
AUTHOR=$(gh pr view "$PR" --json author --jq .author.login)
COMMIT_AUTHORS=$(gh pr view "$PR" --json commits --jq '[.commits[].authors[].login] | unique | join(",")')
CLAUDE_COMMITS=$(gh pr view "$PR" --json commits \
  --jq '[.commits[] | select(([.authors[].login] | index("claude"))
        or (.messageBody | split("\n") | any(test("^Co-Authored-By: Claude\\b.*<[^>]+>\\s*$"; "i"))))] | length')
```

`state` must be `OPEN`. If `codex` is absent, stop and tell the user to install
it (`npm i -g @openai/codex`) — do not fall back to reviewing your own PR
yourself, which defeats the entire point of the loop.

If the reviewer skill file is missing, stop. `codex exec` will silently proceed
without it, produce no review and no marker, and the loop will report `BLOCKED`
for a reason that looks like a Codex failure but is a missing dependency.

### Authorship scope — enforced here, not assumed

`review-claude-pr` is scoped to PRs attributable to `$BOT`, but it has an
explicit-request exception, and this loop *always* passes an exact PR number —
which trips that exception every time. Without a check here, `/pr-loop` silently
extends the reviewer to any PR, including a maintainer's own.

Stop unless one of these holds, each machine-checked in preflight:

- `$AUTHOR` or one of `$COMMIT_AUTHORS` is `$BOT` — a PR the bot has already
  touched in earlier rounds; or
- `$CLAUDE_COMMITS` is non-zero — a head commit is authored by the `claude`
  login or carries a `Co-Authored-By: Claude` **trailer line**: a whole line
  starting `Co-Authored-By: Claude` and ending in an `<email>` address. A prose
  mention of the phrase mid-sentence does not count — the match is anchored per
  line, so a human-only commit that merely discusses the trailer format stays at
  `0`. This is the **first-draft case**: the agent pushes the initial PR
  directly under `$REVIEWER`, and `$BOT` only appears once review rounds start,
  so requiring the bot identity up front would lock the loop out of every
  round-1 review.

The remaining exception is an explicit `--any-author` on the invocation — for a
PR with no machine-attributable commit at all — which the user is stating
deliberately; record it in the final report so the run is never mistaken for an
in-scope one. Do not stretch the first-draft rule beyond its evidence: a PR
whose commits carry neither the `claude` login nor the trailer is a human PR,
however machine-generated it looks. The trailer is forgeable, but the threat
model here is accident, not adversary — the guard exists to keep the loop off a
maintainer's own hand-written PR, not to authenticate commits.

### Bind to the PR's branch — before any round

`review-comments` scopes its *comment lookup* to `$PR`, but its edits, commits,
and pushes go to **whatever is checked out**. Running `/pr-loop 123` from the
default branch or an unrelated branch would apply fixes to the wrong branch and
leave PR 123 untouched. Bind explicitly:

```bash
HEAD_REF=$(gh pr view "$PR" --json headRefName --jq .headRefName)
HEAD_OID=$(gh pr view "$PR" --json headRefOid  --jq .headRefOid)

test "$(git rev-parse --abbrev-ref HEAD)" = "$HEAD_REF"   # right branch
test "$(git rev-parse HEAD)" = "$HEAD_OID"                # not behind or ahead of the PR head
test -z "$(git status --porcelain -uno)"                  # no unstaged tracked changes to sweep into a fix commit
```

Re-run this block **at the start of every responder pass**, not just once — the
PR head moves each round, and a concurrent session sharing this working
directory can move the branch underneath you.

### The pre-push guard — a different check, not the same one

The block above cannot be reused before the push. By then the responder has
committed its fix, so `git rev-parse HEAD` is the *new* commit while
`headRefOid` is still the old remote one until the push lands — the equality
assertion would fail on every round that actually fixed something, and the loop
would exit `BLOCKED` at the exact moment it should publish. What the push needs
verified is different: that **the remote has not moved under you**, and that
**what you are pushing descends from what you reviewed**.

```bash
git fetch -q origin "$HEAD_REF"
test "$(git rev-parse --abbrev-ref HEAD)" = "$HEAD_REF"    # STILL the PR's branch — see below
test "$(git rev-parse "origin/$HEAD_REF")" = "$HEAD_OID"   # remote head unchanged since the round began
git merge-base --is-ancestor "$HEAD_OID" HEAD              # local commits build on it, no rewrite
test -z "$(git status --porcelain)"                        # every fix committed — untracked included
```

Two of those lines are easy to get wrong, and both failures are silent:

- **The branch-name assertion is not redundant with ancestry.** Ancestry checks
  *history*, not which branch is checked out. If a concurrent session switches
  this shared worktree to another branch that also descends from `$HEAD_OID`,
  the remote-equality, ancestry and cleanliness checks all pass, and the push
  lands on that other branch — leaving the PR unchanged or publishing unrelated
  work. The relaxed ancestry rule replaces the *`HEAD` OID* equality from the
  binding block, never the branch name.
- **`git status --porcelain` here, without `-uno`.** `-uno` hides untracked
  files, and the responder contract asks for new regression tests where they
  fit — an unstaged new test file leaves the cleanliness check passing while the
  code change pushes without its test.

> **Worked example (OGUR).** In the working tree this guard was written against,
> `git status --porcelain -uno` reported 0 entries while `git status --porcelain`
> reported 122. The `-uno` form would have passed every round while the untracked
> half of the change never left the machine. That gap is the whole reason the
> guard drops `-uno`.

Because a repo can carry a large pre-existing untracked set, a bare
`--porcelain` assertion may fail before the first round. Snapshot the permitted
set at loop start and diff against it instead, so the guard rejects only paths
**this loop** created:

```bash
# once, before round 1
git status --porcelain --untracked-files=all | sort > "$SCRATCH/untracked-baseline.txt"

# in the pre-push guard, replacing the bare assertion above
git status --porcelain --untracked-files=all | sort > "$SCRATCH/untracked-now.txt"
test -z "$(comm -3 "$SCRATCH/untracked-baseline.txt" "$SCRATCH/untracked-now.txt")"
```

**`comm -3`, both directions — not `comm -13`.** A one-way check catches only
*additions*, and the dangerous case is a *disappearance*. If the responder
reaches for `git add -A`, every pre-existing untracked file is swept into the
fix commit; their `??` lines vanish from `untracked-now`, a one-way diff comes
back empty, every guard passes, and the push publishes unrelated workspace
files — which can mean archived run data, `.env`-adjacent scratch, and other
things that must never leave the machine. A deleted baseline file is invisible
the same way. `comm -3` prints lines unique to *either* side, so both are caught
by the one assertion.

Any line unique to `untracked-now` is a file this loop produced and did not
commit; any line unique to the baseline is a file this loop committed or deleted
that it had no business touching. Either way, exit `BLOCKED` and name the paths.

This is also why the responder must stage explicitly — `git add <path>` for the
files it changed, never `git add -A` in a tree carrying hundreds of untracked
paths.

The reviewer invocation, verified against `codex-cli 0.147.0`:

```bash
codex exec -C "$REPO_ROOT" -s danger-full-access -o "$SCRATCH/codex-round-$N.txt" \
  "Use \$review-claude-pr to review PR #$PR and post the findings."
```

- `-s danger-full-access` is required: the reviewer must reach the GitHub API
  and run `gh`, which the `workspace-write` sandbox blocks. It therefore runs
  unsandboxed against the real repo, which is what makes the reviewer skill's
  "make no repository edits" boundary load-bearing. Do not weaken it.
- `-o <file>` captures the agent's final message, which is what you parse in
  step 3 — do not scrape stdout.
- Write the capture file to the session scratchpad, never into the repo.

If a future `codex` version rejects these flags, re-check `codex exec --help`
and use what it reports rather than guessing.

## The round

Repeat until an exit gate fires. Default cap: **5 rounds** (`--max-rounds`
overrides). The cap counts rounds in *this* invocation — `--max-rounds N` means
"N more rounds", never "N rounds in total across every run against this PR". The
durable bound on repeated invocations is the ledger in step 5, not `N`.

**1. Skip-check (this is the cost control).** Read the current head SHA and look
for the reviewer's marker:

```bash
N=$((N+1)); test "$N" -le "$MAX_ROUNDS"   # false ⇒ stop the loop, verdict ROUNDS_EXHAUSTED
HEAD=$(gh pr view "$PR" --json headRefOid --jq .headRefOid)
gh api --paginate "repos/$OWNER/$REPO/pulls/$PR/reviews" --jq '.[].body' \
  | grep -c "codex-review head:$HEAD"
```

`--paginate` is not optional: that endpoint returns 30 reviews per page, and on
a PR with more than one page the marker for the current head can sit on a later
one. Missing it buys a duplicate Codex review and breaks the one-round-per-SHA
invariant this skill is built around.

If the marker for **this exact SHA** already exists, the reviewer has already
been paid for on this code — skip straight to step 3. A Codex round costs real
money; never spend one on an unchanged head.

**2. Review.** Run the `codex exec` command above. Capture its report. If it
exits non-zero or posts nothing, do not retry blindly — record it and exit
`BLOCKED`.

**3. Read the findings.** Fetch the review for `$HEAD` and parse the
`### Findings` list into `(priority, title, path)` triples. Classify:

- any `P0`/`P1`/`P2` → there is work to do, continue to step 4.
- only `P3`, or `No findings.` → exit `CLEAN`. **P3 is not worth another paid
  round**; leave those threads open for the human.

**4. Respond.** Re-run the branch-binding block first — the head moved if the
previous round pushed — and the pre-push guard immediately before the push,
which is a different check. Then: read `../review-comments/SKILL.md` with the
Read tool and follow it top to bottom, **skipping the section "The confirm gate
— draft, do not post"**; if it is unreadable, say so and stop. That skipped
section is the **one documented override**: it assumes an interactive run, and
this loop has none, so post directly. Every other invariant in that skill still
holds — its thread-selection rules, its fix-don't-just-reply rule, its identity
subshell, its `<gates.lint> && <gates.test>` gate, restoring `$ORIG` and
verifying it in a **later, separate call**, never resolving threads, and posting
the conversation-level summary comment **last**.

If `<gates.lint>` or `<gates.test>` fails after your fixes, you get **one**
repair attempt. Still failing → push nothing further, exit `BLOCKED`.

**5. Loop guard — against the ledger, not against memory.** The comparison is
"have I *already answered* this finding", and the answer has to outlive the
process. `$SCRATCH` does not: it is `mktemp -d` under a `trap … EXIT`, so every
capture from a previous invocation is gone before the next one starts. A guard
that compares only to the previous in-session round cannot see a `P0` that Codex
has now raised four times across two invocations, and reads it as a first
sighting.

So the ledger is the guard. Key each `P0`–`P2` finding on **`path` *and*
normalized title**, never the title alone, and check it **in step 3, before
responding**:

```bash
key() { tr 'A-Z' 'a-z' | tr -s '[:space:]' ' ' | sed 's/[[:punct:]]*$//;s/^ *//;s/ *$//'; }
K="${FPATH:--}|$(printf '%s' "$TITLE" | key)"      # step 3 already parses (priority, title, path)
grep -Fqx -- "$K" <(cut -f2- "$LEDGER")   # hit ⇒ already answered in an earlier round or invocation
```

**The path is load-bearing precisely because the ledger is permanent.** A
title-only key was tolerable while the comparison spanned two adjacent rounds;
across the life of a PR it is not. Reviewers reuse generic titles — "Validate
the identifier", "Handle the empty case" — so a title answered in one file would
block an unrelated finding of the same name in another, and it would block it
*before the responder ever reads it*. Whatever the key includes, it must at
minimum separate two findings that differ only by file. A finding parsed without
a path falls back to `-`, which groups all path-less findings together; that is
the one place the collision survives, and it is the conservative direction.

A hit means Codex and you disagree: exit `BLOCKED` with both positions quoted,
and do not argue across another round. A miss means it is new; after the
responder pass in step 4 lands, record it:

```bash
printf '%s\t%s\n' "$HEAD" "$K" >> "$LEDGER"
```

`$K` stays one tab-free field so `cut -f2-` recovers it intact — put the `|`
separator inside the key, never a second tab column.

**Append once the response has landed — which means the reply is posted, and the
push succeeded if there was one to push.** Not "once a fix is pushed": a finding
you answered in prose with no code change (a question, or pushback you engaged
with and correctly declined to code around) is still *answered*, and leaving it
out of the ledger live-locks the loop. The head has not moved, so the next
invocation reuses the same review for free; the ledger misses, so the guard does
not fire; and `review-comments` skips the thread because the bot commented last
— so the round finds nothing to do and exhausts in the identical state, forever.
Recording it means a re-raise of that same finding trips `BLOCKED`, which is
exactly right: Codex restating a point you answered in prose *is* the
disagreement the guard exists to catch.

The rule the ordering protects is narrower than "wait for a push": never record
a finding whose response did not go out. A reply that failed to post, or a fix
that failed its gate and was never pushed, leaves the finding genuinely
unanswered, and recording it would turn the next invocation's legitimate first
sighting into a false `BLOCKED`.

The ledger is per `(owner, repo, PR)` and never cleared by the loop. If a
`BLOCKED` disagreement is settled by hand and you want the loop to consider the
finding open again, delete its line — that is a human decision, so the loop does
not make it.

## Exit gates

Report one of these, always with the round count and what it cost:

| Verdict | Condition | What you do |
|---|---|---|
| `CLEAN` | round produced no `P0`–`P2` findings | stop; merge only if `--merge` (below) |
| `BLOCKED` | repeat finding, failing gate, or a design-pushback finding you should not decide alone | stop, summarize the disagreement, ask nothing — the human reads it later |
| `ROUNDS_EXHAUSTED` | hit `--max-rounds` | stop; list the still-open findings |

Design pushback ("this approach is wrong") is **always** `BLOCKED`, never
something you concede to in an unattended round. That call is the user's.

Every verdict report also carries: the `--any-author` exception if it was used,
and — when `review_gate.skill_path` is null — the one-line statement that rounds
ran without a project review gate.

## Resuming after `ROUNDS_EXHAUSTED`

Re-invoking `/pr-loop <PR#>` **continues from the current head — it does not
restart the review from round 1**, and it never re-pays for a review of code
already reviewed. What it does *not* usually do is skip the Codex call, and the
reason is the round ordering:

**The cap fires at the top of a round, not before the responder.** Step 1
increments `N` and tests it, so `ROUNDS_EXHAUSTED` is raised at the *start* of
the round that would exceed the cap — after the previous round already ran to
completion. That previous round answered its `P0`–`P2` findings in step 4 and,
where a fix was warranted, pushed. So the usual exhausted state is **a new head
that has never been reviewed**, and the rerun correctly buys exactly one fresh
review for it. A round with no `P0`–`P2` finding would have exited `CLEAN`
instead, and a repeat or a failed gate would have exited `BLOCKED`.

That is still a resume rather than a restart, but the thing being resumed is the
*work*, not the review: the earlier rounds' fixes are pushed, their findings are
recorded in the ledger, and only the unreviewed delta is paid for.

- **The head-SHA marker (step 1) skips the Codex call only when the head has not
  moved *and* preflight passes.** That second condition rules out most of the
  exits you would expect to qualify. The binding block runs before step 1 and
  asserts `HEAD == headRefOid` and a clean tracked worktree, so: a `BLOCKED` on
  a failed `<gates.lint>`/`<gates.test>` gate left the responder's edits
  **uncommitted** and fails the cleanliness assertion; a `BLOCKED` on a moved
  remote left a local commit ahead of `headRefOid` and fails the head assertion.
  Neither reaches the marker check at all — the rerun stops in preflight until a
  human reconciles the tree, which is the intended behaviour, not a free reread.

  What actually gets the free reread is an exit that leaves the tree **clean at
  the reviewed head**: a run killed between step 2 and step 4, and the
  `BLOCKED`s raised in step 3 before any edit — repeat finding, and design
  pushback. The last two will re-block immediately on the ledger, so the case
  worth planning around is the clean interruption.
- **The ledger (step 5) is what stays bounded.** `N` resets to `0` on every
  invocation and `ROUNDS_EXHAUSTED` is not sticky, so nothing in the round
  counter stops `/pr-loop 123 --max-rounds 1` from being run five times in a
  row. The ledger does: a finding already answered trips `BLOCKED` on sighting,
  whichever invocation sees it.

`--max-rounds N` is therefore always "N more rounds", and each rerun after
exhaustion should be assumed to cost one Codex review. There is no
total-across-invocations budget, by design — the human deciding to run it again
*is* the budget.

## Merging — only with `--merge`

Merge only when **all** hold, checked in this order:

```bash
gh pr checks "$PR"                                  # every required check green
gh pr view "$PR" --json mergeable --jq .mergeable   # MERGEABLE, not CONFLICTING
```

plus verdict `CLEAN`, plus no unresolved thread carrying a `P0`–`P2` finding.
Merge as `$ORIG` (`identities.reviewer`), never as the bot:

```bash
gh pr merge "$PR" --squash --delete-branch
```

If any condition fails, do not merge and say which one blocked it. Without
`--merge`, stop at `CLEAN` and leave the merge to the human — that is the
default.

## Running it unattended

The loop is synchronous and self-terminating; it does not need an outer polling
loop. Use one only to *poll for new human comments* on an already-clean PR, and
give it a long interval (20 min+) — a short one burns tokens re-reading an
unchanged PR.

## Safety invariants

Every invariant here is **prompt-level**: no hook blocks a violating `git`,
`gh`, or `codex` call — the procedure asserts, and the guards check before each
outward step. Treat them as hard rules anyway.

1. **The reviewer never edits code; the responder never reviews its own work.**
   Keep the two roles in their own skills and their own processes.
2. **One paid Codex round per head SHA, enforced by the marker check.**
3. **Bounded rounds and a repeat-finding guard** — an unbounded loop between two
   models is the failure mode this skill exists to prevent. The round cap bounds
   one invocation; the **durable ledger** bounds the sequence of invocations,
   because `N` resets and `ROUNDS_EXHAUSTED` does not persist. A repeat guard
   living only in `$SCRATCH` would be erased by the `trap` before the rerun that
   needs it.
4. **`$ORIG` is restored and verified** after every bot-identity block, per
   `review-comments` — including its later, separate verification call, because
   `gh` auth state is global mutable state and a same-shell check proves nothing.
5. **No merge without `--merge` and green checks.** Codex posting
   `No findings.` is not a merge authorization; CI is.
6. **Every fix lands on the PR's own branch**, verified by the binding block
   before each responder pass and by the pre-push guard before each push — never
   on whatever happened to be checked out. Both guards assert the **branch
   name**, because ancestry alone cannot tell two branches apart when one
   descends from the other.
7. **A fix never pushes without the files it needs, and never with files it
   should not have.** The pre-push guard diffs untracked paths against the
   loop-start baseline **both ways** (`comm -3`, wrapped in `test -z`): a new
   regression test left unstaged blocks the push, and so does a baseline file
   that disappeared into the commit. The responder stages explicitly with
   `git add <path>` — never `git add -A` in a tree carrying hundreds of
   untracked paths.
8. **Authorship is checked in preflight**, not inherited from the reviewer
   skill, whose explicit-number exception this loop would otherwise trip on
   every run. First-draft PRs pushed under `identities.reviewer` qualify only
   through commit-level evidence (`claude` author login or
   `Co-Authored-By: Claude` trailer), never through the loop's impression of the
   PR.
9. **Both identities are required.** No bot identity configured → refuse. An
   unattended loop does not silently reassign the bot's replies to the
   maintainer's account.

## What this skill is NOT for

- Reviewing a PR a human authored. Preflight enforces this; `--any-author` is
  the deliberate, reported exception.
- Deciding contested design questions. Those exit `BLOCKED` on purpose.
- Approving PRs. The reviewer never submits `APPROVE`; neither do you.
