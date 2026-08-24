---
name: review-comments
version: 0.1.0
description: Find the unanswered review feedback on a PR (inline threads, review summaries, conversation comments), make the code fix where one is warranted, and reply under the consuming repo's bot identity, with the active gh account always restored and re-verified in a separate call. Use when asked to "answer the review comments", "reply to the review", "address the PR feedback", or "/review-comments [PR#]". (kstack)
---

# review-comments — answer a PR's open review comments as the bot

## When to invoke

An open PR carries review feedback — inline threads, review summaries, or
conversation comments — that needs answering, and the fix-plus-reply should land
under the project's bot identity. Invoke as `/review-comments [PR#]` (defaults
to the current branch's PR). Not for initiating reviews, resolving threads, or
changing PR state — see "What this skill is NOT for".

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: kstack
`CONVENTIONS.md` §2) before doing anything else:

- **`identities.reviewer`** — the human maintainer's gh login, normally the
  *active* account. Missing or null → **refuse**, naming `identities.reviewer`.
- **`identities.bot`** — the dedicated review-bot login that authors every
  reply. Call it `$BOT` below. **Null → there is no bot identity for this
  project**: post replies as the human account and say so plainly in the report
  ("replies posted as `<reviewer>`; no bot identity configured —
  `identities.bot: null`"). Skip the identity-switch subshell entirely in that
  case; the restore invariant is vacuous, but the verification call still runs.
  Note the degradation: the "last comment by the bot ⇒ answered" predicate
  below keys on `$BOT`, and with `$BOT` absent it must key on the human login —
  which cannot distinguish the reviewer's own follow-up from a prior reply.
  Expect false "answered" skips and say so in the report.
- **`gates.lint`, `gates.test`** — the pre-push gate is
  `<gates.lint> && <gates.test>`. Either missing or null → **refuse**, naming
  the exact key. A gate that defaults open is not a gate; never substitute a
  guessed command.

Missing `.agents/stack.yml` altogether → refuse and name the file.

## What this skill does

The consuming repo declares **two** GitHub identities in `.agents/stack.yml`,
both authenticated in the `gh` CLI: the human maintainer (`identities.reviewer`,
normally the *active* account) and a dedicated review bot (`identities.bot`).
This skill walks a PR's open review feedback, addresses each item — **making the
code fix when one is warranted, not just replying** — and posts every reply
under the **bot** identity so the conversation reads as "the bot answered the
review," while your own account stays untouched.

Two things make this skill safe rather than reckless. First, **posting is the
only outward-facing step, and it never happens without your explicit approval**
— everything up to the draft gate is read-only. Second, **the active `gh`
account is always restored to whatever it was before**, even if the run errors
out, so the skill can never silently leave your terminal authenticated as the
bot.

If the `$BOT` account is not present in `gh auth status`, stop immediately and
tell the user — never post review answers from the wrong identity.

## What to scope

1. **Resolve the target PR.** If the user passed a number (`/review-comments 117`), use it. Otherwise auto-detect the current branch's PR:
   ```bash
   gh pr view --json number,url,headRefName,state
   ```
   If there is no PR for the branch, report that and stop.
2. **Resolve the repo and capture the current identity** (read-only):
   ```bash
   OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)   # e.g. <owner>/<repo>
   OWNER=${OWNER_REPO%/*}; REPO=${OWNER_REPO#*/}                         # both queries below need them split
   ORIG=$(gh api user --jq .login)                                       # the account to restore later
   ```
   `$ORIG` is captured *before* any switch and is the single source of truth for switch-back. Do not hardcode it. Record its literal value in the transcript — the later verification call compares against that recorded value, not a shell variable.
3. **Confirm the bot account exists.** `gh auth status` must list `$BOT`. If it is absent, stop and tell the user — do not fall back to posting as `$ORIG`.

## How to find the unanswered comments

A PR carries feedback on three surfaces. Fetch all three (reading as `$ORIG` is fine — no switch needed to read).

**Inline review threads** — the load-bearing query. Threads carry resolution state, which is how you tell "still open" from "done":
**Walk every cursor.** A long-running PR exceeds any single page, and an
unanswered thread that fell off page 2 is indistinguishable in the output from
one that does not exist — the skill would post its mandatory summary while
leaving real feedback unanswered. Follow `reviewThreads.pageInfo` until
`hasNextPage` is false, re-query any thread whose `comments.pageInfo.hasNextPage`
is true, and pass `--paginate` on both REST calls below. If any surface cannot be
exhausted, say which and stop rather than filtering a partial set.

```bash
AFTER=null   # then the endCursor of the previous page, until hasNextPage is false
gh api graphql -f query='
query($owner:String!, $repo:String!, $pr:Int!, $after:String) {
  repository(owner:$owner, name:$repo) {
    pullRequest(number:$pr) {
      reviewThreads(first:100, after:$after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id isResolved isOutdated path
          comments(first:100) { pageInfo { hasNextPage } nodes { databaseId author { login } body createdAt pullRequestReview { state } } }
        }
      }
      reviews(first:100) { pageInfo { hasNextPage } nodes { author { login } state body submittedAt } }
    }
  }
}' -F owner="$OWNER" -F repo="$REPO" -F pr="$PR" -F after="$AFTER"
```
For the line number and `diff_hunk` context a thread is anchored to (the GraphQL above omits them), supplement with REST:
```bash
gh api "repos/$OWNER/$REPO/pulls/$PR/comments"           # inline comments: path, line, diff_hunk, in_reply_to_id, user.login
gh api "repos/$OWNER/$REPO/issues/$PR/comments"          # top-level conversation comments
```

Now filter to what is **genuinely unanswered** — this is the whole "pending/new" judgement:

- **A review thread is unanswered** ⇔ `isResolved == false` **and** the *last* comment is **not** authored by `$BOT` **and** its comments are **not** part of a `PENDING` review (`comments.nodes[].pullRequestReview.state != "PENDING"`). A `PENDING` review is the author's own *unsubmitted draft* — those comments are invisible to everyone else and the reply endpoint will reject them, so they must be skipped exactly like a `PENDING` summary. Sanity check: a published inline comment also appears in the REST `pulls/{pr}/comments` list; a pending one does not. (If the bot already replied last, the thread is answered — skip it.)
- **A review summary is to-address** ⇔ it is **submitted** with a non-empty body **and** no later reply addresses it. **Skip `state: PENDING`** (unsubmitted draft) and empty-body summaries. If a *human* (not the bot) has already posted a top-level comment after `submittedAt` that addresses it (e.g. "addressed in `<commit>`"), **annotate the draft as already handled by a human** and drop it at the gate rather than have the bot re-answer.
- **A conversation comment is unanswered** ⇔ human-authored **and** no later bot comment responds to it.
- **Skip noise:** the bot's own comments, and automation accounts — e.g. `cloudflare-workers-and-pages[bot]` and any login ending in `[bot]`.
- **Flag, don't skip, outdated threads:** if `isOutdated == true` the code the comment anchored to has since moved. Still address it, but note in your reply that the anchor is outdated.

This "last comment by the bot ⇒ answered" rule is also what makes the skill **idempotent**: re-running on the same PR will not re-answer a thread the bot already replied to.

## How to answer each item (reply + fix)

For every unanswered item, read the anchored file at `path` (and the `diff_hunk`) for full context, then classify:

- **Change request** ("add statistics", "this should X", "fix this") → **make the code edit**, and add a regression test where it fits the consuming repo's test conventions. Draft a reply that says what you changed and why.
- **Question** ("what does this constant mean?", "how is `converge_rounds` used?") → draft an explanatory reply. Make a code change only if the question exposes a real bug.
- **Design pushback** ("this is cheating because…") → engage substantively. Change code only if the point is clearly correct; otherwise reply with your reasoning or a clarifying question. Do not guess a large change to satisfy an ambiguous comment.

Record, per item: the thread `id`, the `databaseId` to reply to, the surface type, the drafted reply text, and any code diff.

## The confirm gate — draft, do not post

Present every drafted answer to the user **before** touching the bot identity or the PR. Nothing outward-facing has happened yet. Use this layout, one block per item:

```
[T1] thread · src/discovery/sources.py:42   (isOutdated: false)
  Comment (<reviewer>): "How is `converge_rounds` used?"
  Proposed reply:
    `converge_rounds` is the stop condition for the discovery loop — …
  Code change: none
---
[T2] thread · src/discovery/normalize.py:349
  Comment (<reviewer>): "Can you add statistics on the normalization layer?"
  Proposed reply:
    Added a coverage stat block … see <commit>.
  Code change:  src/discovery/normalize.py  (+18 −2),  tests/…/test_normalize.py (+24)
```

Then stop and let the user approve, edit wording, or drop items. **Do not proceed to posting until the user explicitly approves.**

## Posting as the bot

Apply the approved code edits first, then run the consuming repo's pre-push gate from `.agents/stack.yml`:
```bash
<gates.lint> && <gates.test>
```
Commit/push under the user's normal branch discipline. **Commits use the user's git identity (the SSH key) — only the PR comments go out as the bot.** This split is intentional: the fix is authored by the human/Claude, the conversation reply is authored by the bot.

**Re-fetch the comment `databaseId`s immediately before posting.** Reviews can be re-attributed or re-submitted mid-session, which invalidates ids captured earlier — a reply against a dead id fails or lands on the wrong thread.

Post inside a single atomic block so the identity is restored no matter what.
**Ordering rule: inline thread replies first, the conversation-level summary
comment last — always post the summary, and always post it last.** Pushing a
fix to a reviewed file flips its threads to `isOutdated`, and the PR's default
view hides replies inside outdated threads — so an inline reply to a thread you
just fixed can be invisible to the reviewer. The conversation-level summary is
the one reply guaranteed to stay visible; post one even when every item got an
inline reply, listing what changed (with commit refs) and which threads were
answered.

```bash
BOT="<identities.bot>"
(
  set -e
  trap 'gh auth switch --user "$ORIG" >/dev/null 2>&1' EXIT   # fires on success, error, or set -e abort
  gh auth switch --user "$BOT"

  # inline thread reply — reply to a databaseId in the thread:
  gh api "repos/$OWNER/$REPO/pulls/$PR/comments/$COMMENT_ID/replies" -f body="$REPLY_BODY"

  # LAST: the conversation-level summary comment (also the reply surface for
  # review summaries, which can't be thread-replied):
  gh pr comment "$PR" --body "$SUMMARY_BODY"
)
# fast smoke check, same shell — necessary but NOT sufficient, see below:
test "$(gh api user --jq .login)" = "$ORIG" && echo "active account restored: $ORIG"
```
**Do not resolve threads** — leave them open so the human reviewer decides whether each is settled.

## Verify the restore — a later, separate call

`gh` auth state is **global mutable state**, shared by every shell and every
concurrent session on the machine — a verification in the same shell invocation
as the switch proves nothing about the state after that invocation returns.
The inline `test` above is a smoke check only. The authoritative verification
is a **later, separate shell invocation**, after the posting block has fully
returned:

```bash
gh api user --jq .login    # must print the reviewer login recorded at capture time
```

Compare the output against the literal `$ORIG` value recorded in the transcript
(shell state does not survive between calls — compare against the transcript,
not a variable). If it does not match, run
`gh auth switch --user "<recorded-login>"` explicitly and report the mismatch.

After posting, **re-scan the PR you just pushed** — confirm the summary comment
and each inline reply actually landed, because a push that flipped threads to
outdated can make a posted reply invisible in the default view even though the
API accepted it.

## Output / report

When done, report:
- What was posted, with the comment URLs the API returned, grouped by surface — the conversation-level summary named explicitly as the last post.
- What code changed (files + commit ref) and whether `<gates.lint>`/`<gates.test>` passed.
- What was skipped and why (PENDING reviews, `[bot]` noise, already-answered threads).
- Explicit confirmation: **active `gh` account restored to `$ORIG`, verified in a separate call.**
- If `identities.bot` was null: state that replies went out as the human account.

## Safety invariants — non-negotiable

Every invariant here is **prompt-level**: nothing in the harness blocks a
violating `gh` call — the procedure asks, and the verification steps check
after the fact. Treat them as hard rules anyway.

1. **Restore the original active account no matter what.** The switch→post→switch-back lives in one subshell with `trap … EXIT`. The same-shell `test` is a smoke check; the authoritative verification is a later, separate call (`gh api user --jq .login` compared against the recorded `$ORIG`), because auth state is global and mutable.
2. **Posting is the only outward step and only happens after explicit approval.** Reading and drafting are always safe.
3. **Idempotent.** The "last comment by the bot ⇒ answered" rule prevents reposting on a re-run.
4. **Skip `PENDING` reviews and `[bot]` noise.** Never answer an unsubmitted draft review.
5. **Stop early if `$BOT` is absent** from `gh auth status`. Never post from the wrong identity. (`identities.bot: null` in stack.yml is the one sanctioned degradation — human-account replies, declared in the report.)
6. **The conversation-level summary comment is always posted, and always posted last.** Pushing a fix flips inline threads to outdated and hides inline replies; the summary is the durable visible record.

## What this skill is NOT for

- Posting *new* review comments or initiating a review — this answers existing feedback only.
- Resolving or dismissing threads (left to the human by design).
- Merging, approving, or changing PR state.
- Unattended/scheduled runs — it is invoked manually. Wiring it to a loop or a scheduled agent is a separate decision (see `tools/github/pr-loop`, which does exactly that with a documented override of the confirm gate).
