---
name: pr-loop
version: 0.9.0
description: Drive an independent Codex↔Claude review/fix loop on one PR to CLEAN, BLOCKED, or ROUNDS_EXHAUSTED. The implementation session keeps fixes; the other engine reviews with verified GitHub identity and head evidence. Use when asked to "run the review loop", "ping-pong this PR", or "/pr-loop <PR#>". (kstack)
---

# pr-loop — run the review ping-pong to a stop condition

## When to invoke

One open PR needs review rounds driven to a stop condition without a human in
the seat: review → fix → reply → re-review, until the PR is clean, a
disagreement blocks it, or the round budget runs out. Invoke as
`/pr-loop <PR#> [--max-rounds N] [--merge] [--any-author] [--implementation-engine codex|claude] [--model M] [--effort E] [--fast] [--ci-wait MIN] [--accept-graph-update <PR#>]... [--local-graph]`. Not for reviewing a
human-authored PR, not for deciding contested design questions, and not for
approving — see "What this skill is NOT for".

## Graph publication admission

For Linear-linked implementation, follow
`tools/linear/linear-roadmap/references/publication-gate.md` from the physical
stack root before implementer edits or merge work. Validate repeatable
--accept-graph-update PR values from this invocation and forward them explicitly
into each review-comments/land invocation; those skills recheck candidate and
closure eligibility. Unrelated project coverage gaps do not block mapped PR work.
A missing maintenance unit may use bounded local reconciliation; carry the main
SHA, full live evidence and exact delta into each implementation round and PR.
Scope/dependency/release/human-gate changes require reviewed publication; unknown
selected evidence blocks fixes. Read-only review remains allowed. Existing review
and merge requirements hold; a graph-only repair uses the shared exception.


Accept `--local-graph` under the shared publication gate's **Explicit approved local graph**
procedure. It replaces graph publication with fresh local indexed validation and
candidate/closure admission; scope, native blockers, evidence, human decisions
and plan/merge approvals remain mandatory. Forward this invocation's explicit
flag and canonical owner/index/manifest pins through composed execution skills.
Recheck the owner files before writes; never substitute an older dispatch-worktree
copy. Changed pins require a new plan. Reject repeated local flags and mixed
local/PR graph sources. No graph publication or extra tracker writes are granted.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: kstack
`CONVENTIONS.md` §2) before preflight:

- **`identities.maintainer`** — the human maintainer's gh login. This account
  opens every PR, governs the repository, and is the only account that ever
  merges.
  Missing or null → **refuse**, naming `identities.maintainer`.
- **`identities.reviewer`** — the review-agent login, normally Codex, that
  publishes reviews in the default route. Missing or null → **refuse**, naming `identities.reviewer`.
- **`identities.implementer`** — the implementation-agent login, normally
  Claude, that publishes fixes and replies in the default route. Missing or null → **refuse**,
  naming `identities.implementer`. All three identities are required *here*,
  unlike `review-comments`, which degrades to human-account replies when no
  implementer is configured. This loop is unattended: posting under the
  maintainer's own account with nobody watching is not a degradation the loop
  gets to choose on its own.
- **`gates.lint`, `gates.test`** — the implementer's pre-push gate,
  `<gates.lint> && <gates.test>`. Either missing or null → **refuse**, naming
  the exact key. A gate that defaults open is not a gate.
- **`ci.checks`** — which of the PR's checks must be green at the reviewed head
  before the loop may report `CLEAN` (step 3a). `required` → the base branch's
  required status checks (`gh pr checks --required`); `all` → every check
  GitHub reports on the head, for a repo that marks none as required; `none` →
  no CI gate, for a repo with no CI, stated in the final report. Missing or null
  → **refuse**, naming `ci.checks`: without it `CLEAN` would certify a head whose
  CI nobody read. `required` on a base branch that requires nothing never turns
  green — gh reports `no required checks reported` and the gate times out — so
  such a repo sets `all`.
- **`review_gate.skill_path`** — the project's "prove the bug" review skill,
  and **`review_gate.scope`**, the diff paths that trigger it. Non-null → the
  reviewer round is expected to run it over matching diffs, and preflight
  asserts it is **tracked** (an untracked copy is not a dependency). **Null →
  rounds run without a project review gate**, using the generic reviewer only;
  say so once in the final report, plainly: *"no project review gate configured
  (`review_gate.skill_path: null`) — rounds ran with the generic reviewer
  only."* Do not substitute a guessed skill.

- **`review_model.slug`, `review_model.effort`,
  `review_model.escalated_slug`, `review_model.escalate_above_lines`,
  `review_model.escalate_above_files`, `review_model.escalate_paths`, and
  `review_model.escalated_effort`** —
  which model runs the reviewer round and at what reasoning effort. This is the
  model the review agent runs on, not the account it posts under
  (`identities.reviewer`). **The one block that defaults instead of refusing**
  (CONVENTIONS.md §2): missing or null → `gpt-6.1-sol` at `high`. On the first
  review of a PR, configured risk triggers select `gpt-6-astra` at `high`;
  the raw-size triggers default to disabled, and `escalate_paths` defaults to
  empty. Subsequent heads use the base lane. Use `--model gpt-6-luna
  --effort high` for a lower-cost pass, or explicitly pin Astra when another
  deep review is warranted. The default is never silent — the per-round
  resolution and final report both state the resolved pair and its source.

Missing `.agents/stack.yml` altogether → refuse and name the file.

## What this skill drives

This skill is the **driver** for two review skills that already exist and are
composed by reference:

- **the reviewer** — kstack [`tools/github/review-claude-pr`](../review-claude-pr/SKILL.md),
  run by the resolved independent engine, posts a `COMMENT` review as `$REVIEWER`.
- **the implementer** — kstack [`review-comments`](../review-comments/SKILL.md),
  stays in this implementation session, fixes code and replies as `$IMPLEMENTER`.

Neither one decides when to stop. This one does. It is **unattended by design**:
it posts, pushes, and replies without asking. It never merges unless `--merge`
was passed on the invocation.

## Resolve engine roles first

Read [references/routing.md](references/routing.md) and follow it before the
preflight below. If unreadable, stop. It owns provenance, role selection, host
checks, canonical skill resolution and CLI invocation. Bootstrap the maintainer
credential and scratch there, resolve the exact PR, and pin route.json. All role
placeholders below mean resolved roles. Never infer the engine from a bot name.
On a host mismatch stop; no whole-loop delegation or fallback self-review.

## Preflight — run once, stop on any failure

Every variable the round uses is defined here. The round body below assumes all
of them exist; do not run it against a partial preflight.

```bash
PR=<number>
MAX_ROUNDS=5; N=0                                        # --max-rounds overrides MAX_ROUNDS
                                                         # N counts rounds in THIS invocation only —
                                                         # see "Resuming after ROUNDS_EXHAUSTED"
MAINTAINER="<identities.maintainer>"                    # from .agents/stack.yml
REVIEWER="<resolved reviewer account>"
IMPLEMENTER="<resolved implementer account>"
CI_CHECKS="<ci.checks>"                                  # required | all | none
CI_WAIT_MIN=30                                           # --ci-wait overrides: minutes step 3a
                                                         # waits for pending checks

MAINTAINER_TOKEN=$(gh auth token --hostname github.com --user "$MAINTAINER")
REVIEWER_TOKEN=$(gh auth token --hostname github.com --user "$REVIEWER")
IMPLEMENTER_TOKEN=$(gh auth token --hostname github.com --user "$IMPLEMENTER")
test "$(GH_TOKEN="$MAINTAINER_TOKEN" gh api user --jq .login)" = "$MAINTAINER"
test "$(GH_TOKEN="$REVIEWER_TOKEN" gh api user --jq .login)" = "$REVIEWER"
test "$(GH_TOKEN="$IMPLEMENTER_TOKEN" gh api user --jq .login)" = "$IMPLEMENTER"

REPO_ROOT=$(git rev-parse --show-toplevel)
OWNER_REPO=$(GH_TOKEN="$MAINTAINER_TOKEN" gh repo view --json nameWithOwner --jq .nameWithOwner)
OWNER=${OWNER_REPO%/*}; REPO=${OWNER_REPO#*/}
# Reuse the bootstrap SCRATCH and route.json; never overwrite them here.

# durable, per-PR answered-findings ledger — OUTSIDE $SCRATCH and outside $REPO_ROOT,
# because the repeat-finding guard must survive this invocation. See step 5.
STATE_DIR="${KSTACK_STATE:-$HOME/.kstack}/pr-loop"
mkdir -p "$STATE_DIR"
LEDGER="$STATE_DIR/$OWNER-$REPO-$PR"
touch "$LEDGER"

# Codex reviewers only: read model routing configuration here; resolve it again immediately before each
# paid review, because the first-review exception expires after round 1.
# Precedence per slot: invocation flag > first-review escalation > base config
# > stack default. Explicit flags pin their slots for every round.
FAST="<true iff --fast was passed; otherwise false>"
BASE_MODEL="<review_model.slug, or gpt-6.1-sol>"
BASE_EFFORT="<review_model.effort, or high>"             # --effort overrides
PINNED_MODEL="<--model value, if passed>"
PINNED_EFFORT="<--effort value, if passed>"
MODEL_PINNED="<true iff --model was passed>"
EFFORT_PINNED="<true iff --effort was passed>"
ESCALATED_MODEL="<review_model.escalated_slug, or gpt-6-astra>"
ESCALATED_EFFORT="<review_model.escalated_effort, or high>"
ESCALATE_ABOVE="<review_model.escalate_above_lines, or empty>"
ESCALATE_FILES="<review_model.escalate_above_files, or empty>"
ESCALATE_PATHS=(<review_model.escalate_paths, or no elements>)

# the reviewer contract this loop delegates to, resolved through the host's installed
# skill path (bin/install symlinks stack skills there). If your host installs skills
# somewhere else, assert that path instead — but assert one.
test -r "$REVIEW_SKILL"  # canonical absolute path from the shared routing contract

# the project review gate, ONLY when review_gate.skill_path is non-null — tracked,
# because an untracked copy is not a dependency
git -C "$REPO_ROOT" ls-files --error-unmatch "<review_gate.skill_path>" >/dev/null

# baseline of files already untracked here, so the pre-push guard can tell them
# from anything THIS loop leaves uncommitted
git status --porcelain --untracked-files=all | sort > "$SCRATCH/untracked-baseline.txt"
GH_TOKEN="$MAINTAINER_TOKEN" gh pr view "$PR" --json number,state,isDraft,headRefName,headRefOid,mergeable,author

# Authorship and engine scope were resolved from complete REST commit evidence.
```

Require state OPEN and the CLI, canonical skill and verified credentials named
by the route. Missing dependencies or permissions return BLOCKED. For Claude,
skip the Codex model variables above and use claude_review_model (sonnet/high
when unset); --model/--effort override that pair. --fast is Codex-only.

The shared resolver enforces authorship independently of engine choice.
Maintainer-opened PRs with Codex/Claude commit attribution are eligible; mixed
provenance needs explicit --implementation-engine. --any-author is separately
required when there is no agent evidence. Forward those exact options to both
child skills and report any exception. Do not treat an exact PR number passed
by this controller as an implicit authorship override.

### Bind to the PR's branch — before any round

`review-comments` scopes its *comment lookup* to `$PR`, but its edits, commits,
and pushes go to **whatever is checked out**. Running `/pr-loop 123` from the
default branch or an unrelated branch would apply fixes to the wrong branch and
leave PR 123 untouched. Bind explicitly:

```bash
HEAD_REF=$(GH_TOKEN="$MAINTAINER_TOKEN" gh pr view "$PR" --json headRefName --jq .headRefName)
HEAD_OID=$(GH_TOKEN="$MAINTAINER_TOKEN" gh pr view "$PR" --json headRefOid  --jq .headRefOid)

test "$(git rev-parse --abbrev-ref HEAD)" = "$HEAD_REF"   # right branch
test "$(git rev-parse HEAD)" = "$HEAD_OID"                # not behind or ahead of the PR head
test -z "$(git status --porcelain -uno)"                  # no unstaged tracked changes to sweep into a fix commit
```

Re-run this block **at the start of every implementer pass**, not just once — the
PR head moves each round, and a concurrent session sharing this working
directory can move the branch underneath you.

### The pre-push guard — a different check, not the same one

The block above cannot be reused before the push. By then the implementer has
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
  files, and the implementer contract asks for new regression tests where they
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
*additions*, and the dangerous case is a *disappearance*. If the implementer
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

This is also why the implementer must stage explicitly — `git add <path>` for the
files it changed, never `git add -A` in a tree carrying hundreds of untracked
paths.

Launch and verify each independent reviewer through `bin/run-review` as specified
in the shared routing contract. It inherits host permissions, captures reports,
and verifies submitted GitHub evidence. Permission or authentication failures
block; never change host policy to make a review succeed. Codex --fast retains
the service-tier/feature settings, only when explicitly requested.

## The round

Repeat until an exit gate fires. Default cap: **5 rounds** (`--max-rounds`
overrides). The cap counts rounds in *this* invocation — `--max-rounds N` means
"N more rounds", never "N rounds in total across every run against this PR". The
durable bound on repeated invocations is the ledger in step 5, not `N`.

**1. Skip-check (and round bound).** Increment N and enforce MAX_ROUNDS before any paid
review. Read the current remote head and recompute route.json from complete
commit evidence. A foreign head requires reconciliation; the loop's own guarded
fix head becomes the next expected head. Preserve existing graph admission.

Read all submitted reviews with --paginate --slurp. For Codex model escalation,
PRIOR_REVIEW_COUNT counts only submitted reviews by the resolved reviewer with
that engine's exact marker and matching commit_id; never comments or another
account's text. `bin/run-review` performs the exact-head skip-check and returns
verified evidence without another paid review if one exists. No CLI prose or
bare marker can satisfy the gate.

**2. Review.** For a Codex reviewer, resolve the model immediately before a paid round, not once in
preflight. The previous round may have posted the first kstack review marker,
after which an automatic Astra escalation must expire:

```bash
# Count only submitted reviews with this account's Codex marker bound to the
# review's commit_id. Fetch every page before selecting the first-review model.
GH_TOKEN="$MAINTAINER_TOKEN" gh api --paginate --slurp \
  "repos/$OWNER_REPO/pulls/$PR/reviews" > "$SCRATCH/prior-reviews.json"
PRIOR_REVIEW_COUNT=$(python3 "$STACK_ROOT/tools/github/pr-loop/bin/prior-review-count" \
  --reviews "$SCRATCH/prior-reviews.json" --reviewer "$REVIEWER" --engine codex)
SIZE=$(GH_TOKEN="$MAINTAINER_TOKEN" gh pr view "$PR" --json additions,deletions \
  --jq '.additions + .deletions')
GH_TOKEN="$MAINTAINER_TOKEN" gh pr diff "$PR" --name-only > "$SCRATCH/changed-paths-raw.txt"
sort -u "$SCRATCH/changed-paths-raw.txt" > "$SCRATCH/changed-paths.txt"
FILE_COUNT=$(wc -l < "$SCRATCH/changed-paths.txt" | tr -d ' ')
MATCHED_PATH=""
while IFS= read -r path; do
  for glob in "${ESCALATE_PATHS[@]}"; do
    case "$path" in $glob) MATCHED_PATH="$path"; break 2 ;; esac
  done
done < "$SCRATCH/changed-paths.txt"
MODEL="$BASE_MODEL"; EFFORT="$BASE_EFFORT"
if [ "$PRIOR_REVIEW_COUNT" -eq 0 ] && \
  { { [ -n "$ESCALATE_ABOVE" ] && [ "$SIZE" -gt "$ESCALATE_ABOVE" ]; } \
    || { [ -n "$ESCALATE_FILES" ] && [ "$FILE_COUNT" -gt "$ESCALATE_FILES" ]; } \
    || [ -n "$MATCHED_PATH" ]; }; then
  MODEL="$ESCALATED_MODEL"; EFFORT="$ESCALATED_EFFORT"
fi
if [ "$MODEL_PINNED" = true ]; then MODEL="$PINNED_MODEL"; fi
if [ "$EFFORT_PINNED" = true ]; then EFFORT="$PINNED_EFFORT"; fi
```

The path loop uses shell glob matching, not substring or regex matching, and
retains the first matching path for the routing report. Size thresholds are raw GitHub counts if a project opts
in; generated files and fixtures are not filtered from those optional counts.
On a follow-up head, even a high-risk path uses the base model unless the
invocation explicitly pins `--model gpt-6-astra`. This prevents an automatic
Astra charge for each small fix while allowing a deliberate deep re-review.

For Claude, skip the Codex escalation block entirely. Run `bin/run-review`
with the selected model/effort and inspect its JSON and exit status. Failure
means BLOCKED with no blind retry, engine substitution or self-review.

**3. Read the findings.** Use the helper's verified review ID/head and structured
findings (summary plus inline). Missing/malformed evidence is BLOCKED. Apply
the durable ledger below before responding. Classify:

- any `P0`/`P1`/`P2` → there is work to do, continue to step 4.
- only `P3`, or `No findings.` → run the CI gate (step 3a); exit `CLEAN` only
  if it passes. **P3 is not worth another paid round**; leave those threads
  open for the human.

**3a. CI gate — before any `CLEAN`.** A finding-free review alone is not
`CLEAN`. The implementer's pre-push gate is `<gates.test>`, which a project may scope to
the tests a branch changed, so the full suite's verdict lives in CI. Read the
checks on the reviewed head, waiting for pending ones:

```bash
CI=""; [ "$CI_CHECKS" = none ] && CI=skipped
SCOPE=(); [ "$CI_CHECKS" = required ] && SCOPE=(--required)
DEADLINE=$(( $(date +%s) + CI_WAIT_MIN * 60 ))
while [ -z "$CI" ]; do
  # --json exits 0 even when checks are pending or failing (gh 2.89.0), so read
  # the buckets, never the exit code. No checks reported → empty file → wait.
  GH_TOKEN="$MAINTAINER_TOKEN" gh pr checks "$PR" "${SCOPE[@]}" --json bucket,name \
    --jq '.[] | "\(.bucket)\t\(.name)"' > "$SCRATCH/ci.tsv" 2> "$SCRATCH/ci.err" || true
  NOW=$(GH_TOKEN="$MAINTAINER_TOKEN" gh pr view "$PR" --json headRefOid --jq .headRefOid)
  BUCKETS=$(cut -f1 "$SCRATCH/ci.tsv" | sort -u)
  if   [ "$NOW" != "$HEAD" ];                                   then CI=moved
  elif printf '%s\n' "$BUCKETS" | grep -qx -e fail -e cancel;   then CI=red
  elif [ -n "$BUCKETS" ] && ! printf '%s\n' "$BUCKETS" | grep -qx pending; then CI=green
  elif [ "$(date +%s)" -ge "$DEADLINE" ];                       then CI=timeout
  else sleep 60
  fi
done
# Required even when ci.checks:none skipped the loop.
NOW=$(GH_TOKEN="$MAINTAINER_TOKEN" gh pr view "$PR" --json headRefOid --jq .headRefOid)
[ "$NOW" = "$HEAD" ] || CI=moved
```

| `CI` | Verdict |
|---|---|
| `green` | `CLEAN`. A `skipping` check counts as passed, as GitHub counts a skipped required check. |
| `skipped` | `CLEAN` (`ci.checks: none`); the report says no CI gate ran. |
| `red` | `BLOCKED`, naming each `fail`/`cancel` check from `ci.tsv`. No implementer pass: a red check is not a review finding, and this loop's fixes answer findings. |
| `timeout` | `BLOCKED`, naming the checks still `pending`. An empty `ci.tsv` means GitHub reported no matching checks — quote `ci.err`. `no required checks reported` is a `ci.checks` setting for the human to fix, not something to wait out. |
| `moved` | Someone pushed while the gate waited. Never report `CLEAN` for code nobody reviewed: start the next round (step 1), which counts against `--max-rounds`. |

The gate sees only checks that have registered on the head: `gh pr checks
--required` lists required checks that have *reported*, not ones GitHub still
expects. Step 3a runs after an independent review, minutes after the last push, and
GitHub registers check suites within seconds of a push. An empty list waits
instead of passing.

**4. Implement and reply.** Re-run the branch-binding block first — the head moved if the
previous round pushed — and the pre-push guard immediately before the push,
which is a different check. Pass any explicitly supplied --accept-graph-update
flags to the implementer; never infer them from prior rounds. Forward the pinned route and explicit --implementation-engine/--any-author too.
The current implementation session performs the fixes; the reviewer never does.
Then: read
`../review-comments/SKILL.md` and follow it top to bottom, **skipping the section "The confirm gate
— draft, do not post"**; if it is unreadable, say so and stop. That skipped
section is the **one documented override**: it assumes an interactive run, and
this loop has none, so post directly. Every other invariant in that skill still
holds — its thread-selection rules, its fix-don't-just-reply rule, its
per-command implementer token, its `<gates.lint> && <gates.test>` gate, never
switching global `gh` identity, never resolving threads, and posting
the conversation-level summary comment **last**.

If `<gates.lint>` or `<gates.test>` fails after your fixes, you get **one**
repair attempt. Still failing → push nothing further, exit `BLOCKED`.

**5. Loop guard — against the ledger, not against memory.** The comparison is
"have I *already answered* this finding", and the answer has to outlive the
process. `$SCRATCH` does not: it is per-invocation temporary storage, so a later
invocation cannot rely on its captures. A guard
that compares only to the previous in-session round cannot see a `P0` that the reviewer
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
*before the implementer ever reads it*. Whatever the key includes, it must at
minimum separate two findings that differ only by file. A finding parsed without
a path falls back to `-`, which groups all path-less findings together; that is
the one place the collision survives, and it is the conservative direction.

A hit means the reviewer and you disagree: exit `BLOCKED` with both positions quoted,
and do not argue across another round. A miss means it is new; after the
implementer pass in step 4 lands, record it:

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
exactly right: the reviewer restating a point you answered in prose *is* the
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
| `CLEAN` | round produced no `P0`–`P2` findings **and** the step 3a CI gate passed at the reviewed head (or `ci.checks: none`) | stop; merge only if `--merge` (below) |
| `BLOCKED` | repeat finding, failing gate, red or timed-out CI at a finding-free head, or a design-pushback finding you should not decide alone | stop, summarize the disagreement, ask nothing — the human reads it later |
| `ROUNDS_EXHAUSTED` | hit `--max-rounds` | stop; list the still-open findings |

Design pushback ("this approach is wrong") is **always** `BLOCKED`, never
something you concede to in an unattended round. That call is the user's.

Every verdict report also carries the review-model routing for **each paid
round** — model, effort, fired risk trigger (if any), whether this was the
first review, the source of each slot, and whether `--fast` was requested —
for example: *"round 1: gpt-6-astra / high (first review; stack.yml path
trigger: bin/install); round 2: gpt-6.1-sol / high (follow-up); fast requested:
no"*.
Without it the escalation is invisible and the next reader cannot tell a cheap
round from an expensive one.

Every verdict report also carries the implementation/reviewer engines and accounts,
provenance source, final reviewed SHA and submitted review URL/ID, plus the `--any-author` exception if it was used,
and — when `review_gate.skill_path` is null — the one-line statement that rounds
ran without a project review gate.

A `CLEAN` or CI `BLOCKED` report also carries the step 3a result: `ci.checks`,
the minutes waited, and each check's bucket at `$HEAD`. With `ci.checks: none`
it carries, plainly: *"no CI gate configured (`ci.checks: none`) — `CLEAN`
reflects review findings only."*

## Resuming after `ROUNDS_EXHAUSTED`

Re-invoking `/pr-loop <PR#>` **continues from the current head — it does not
restart the review from round 1**, and it never re-pays for a review of code
already reviewed. What it does *not* usually do is skip the reviewer call, and the
reason is the round ordering:

**The cap fires at the top of a round, not before the implementer.** Step 1
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

- **The head-SHA marker (step 1) skips the reviewer call only when the head has not
  moved *and* preflight passes.** That second condition rules out most of the
  exits you would expect to qualify. The binding block runs before step 1 and
  asserts `HEAD == headRefOid` and a clean tracked worktree, so: a `BLOCKED` on
  a failed `<gates.lint>`/`<gates.test>` gate left the implementer's edits
  **uncommitted** and fails the cleanliness assertion; a `BLOCKED` on a moved
  remote left a local commit ahead of `headRefOid` and fails the head assertion.
  Neither reaches the marker check at all — the rerun stops in preflight until a
  human reconciles the tree, which is the intended behaviour, not a free reread.

  What actually gets the free reread is an exit that leaves the tree **clean at
  the reviewed head**: a run killed between step 2 and step 4, the `BLOCKED`s
  raised in step 3 before any edit — repeat finding, and design pushback — and a
  CI `BLOCKED` from step 3a. Repeat finding and design pushback re-block
  immediately on the ledger. A CI `BLOCKED` is the useful one: rerun once the
  checks are green and step 3a reports `CLEAN` without paying for another independent
  review.
- **The ledger (step 5) is what stays bounded.** `N` resets to `0` on every
  invocation and `ROUNDS_EXHAUSTED` is not sticky, so nothing in the round
  counter stops `/pr-loop 123 --max-rounds 1` from being run five times in a
  row. The ledger does: a finding already answered trips `BLOCKED` on sighting,
  whichever invocation sees it.

`--max-rounds N` is therefore always "N more rounds", and each rerun after
exhaustion should be assumed to cost one independent review. There is no
total-across-invocations budget, by design — the human deciding to run it again
*is* the budget.

## Merging — only with `--merge`

Merge only when **all** hold, checked in this order:

```bash
GH_TOKEN="$MAINTAINER_TOKEN" gh pr checks "$PR"                                  # every required check green
GH_TOKEN="$MAINTAINER_TOKEN" gh pr view "$PR" --json mergeable --jq .mergeable   # MERGEABLE, not CONFLICTING
```

plus verdict `CLEAN`, plus no unresolved thread carrying a `P0`–`P2` finding.
Merge as `$MAINTAINER` (`identities.maintainer`), never as the reviewer or implementer:

```bash
GH_TOKEN="$MAINTAINER_TOKEN" gh pr merge "$PR" --squash --delete-branch
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
`gh`, or reviewer CLI call — the procedure asserts, and the guards check before each
outward step. Treat them as hard rules anyway.

1. **The reviewer never edits code; the implementer never reviews its own work.**
   Keep the two roles in their own skills and their own processes.
2. **One paid reviewer round per account + engine + head, checked against submitted evidence.**
3. **Bounded rounds and a repeat-finding guard** — an unbounded loop between two
   models is the failure mode this skill exists to prevent. The round cap bounds
   one invocation; the **durable ledger** bounds the sequence of invocations,
   because `N` resets and `ROUNDS_EXHAUSTED` does not persist. A repeat guard
   living only in `$SCRATCH` would be lost before the rerun that needs it.
4. **Global `gh` identity is never switched.** Every GitHub API call receives
   the intended role's verified token through `GH_TOKEN`.
5. **No merge without `--merge` and green checks.** A reviewer posting
   `No findings.` or green CI is not merge authorization; the human's explicit --merge is.
6. **Every fix lands on the PR's own branch**, verified by the binding block
   before each implementer pass and by the pre-push guard before each push — never
   on whatever happened to be checked out. Both guards assert the **branch
   name**, because ancestry alone cannot tell two branches apart when one
   descends from the other.
7. **A fix never pushes without the files it needs, and never with files it
   should not have.** The pre-push guard diffs untracked paths against the
   loop-start baseline **both ways** (`comm -3`, wrapped in `test -z`): a new
   regression test left unstaged blocks the push, and so does a baseline file
   that disappeared into the commit. The implementer stages explicitly with
   `git add <path>` — never `git add -A` in a tree carrying hundreds of
   untracked paths.
8. **Authorship is checked in preflight**, not inherited from the reviewer
   skill, whose explicit-number exception this loop would otherwise trip on
   every run. PRs are opened under `identities.maintainer` and qualify through
   the shared resolver's complete commit evidence and bounded legacy fallback, never through the loop's
   impression of the PR.
9. **All three identities are required.** No maintainer, reviewer, or implementer
   identity configured → refuse. An unattended loop does not silently reassign
   replies to the maintainer's account.
10. **`CLEAN` reads CI as well as the review.** `No findings.` at a head whose
    `ci.checks` are red, still pending after `--ci-wait`, or unreported is
    `BLOCKED`, never `CLEAN`. `ci.checks: none` is the one exception, and the
    report states it.

## What this skill is NOT for

- Reviewing a PR a human authored. Preflight enforces this; `--any-author` is
  the deliberate, reported exception.
- Deciding contested design questions. Those exit `BLOCKED` on purpose.
- Approving PRs. The reviewer never submits `APPROVE`; neither do you.
