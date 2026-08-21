---
name: review-claude-pr
version: 0.1.0
description: Review an open PR authored by the consuming repo's bot identity and immediately post prioritized P0–P3 findings as a Codex-attributed COMMENT review from the human reviewer account. Review-only — never edits, commits, pushes, approves, or resolves. Use when asked to "review the bot's PR", "review this PR as Codex", "review PR #N", or "/review-claude-pr [PR# | URL]". (khalilou-stack)
---

# review-claude-pr — review a bot-authored PR as Codex

## When to invoke

A PR authored by the consuming repo's bot identity is open and needs a
defect-first review published to GitHub from the human reviewer account. Invoke
as `/review-claude-pr [PR# | URL]`, or with no target to run the resolution
ladder below. This is the reviewer half of the review loop: it finds and posts
defects, and never answers, fixes, or resolves them — that is
`tools/github/review-comments`, and the unattended pairing of the two is
`tools/github/pr-loop`.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: khalilou-stack
`CONVENTIONS.md` §2) before anything else:

- **`identities.reviewer`** — the gh login that must be active for every write
  this skill performs. Missing or null → **refuse**, naming
  `identities.reviewer`. Called `$REVIEWER` below.
- **`identities.bot`** — the login whose PRs this skill reviews; it is the
  authorship precondition, not a writer. Missing or null → **refuse**, naming
  `identities.bot`, because the skill cannot then verify it is reviewing
  bot-authored work. One sanctioned override: the user explicitly names a PR
  and asks for it reviewed regardless of author — record that in the review
  body. Called `$BOT` below.
- **`review_gate.skill_path`** and **`review_gate.scope`** — the project's
  "prove the bug" review skill and the diff paths that trigger it. Both null →
  there is no project proof gate; run the general review and say so in the
  report. Configured → apply the proof gate exactly as §2 describes.
- **`gates.test`** — the command that runs the repo's tests, used only for
  read-only proof runs inside a disposable worktree. Null → the proof step
  **refuses**, naming `gates.test`; the review still posts, with every finding
  that would have needed a run downgraded to a labeled non-blocking question.
  Never guess a test invocation.

Missing `.agents/stack.yml` altogether → refuse and name the file.

## Non-negotiable boundaries

Every boundary here is **prompt-level**: this skill holds a shell, so nothing in
the harness blocks a write, a push, or an account switch. The contract asks, and
the post-submit verification checks after the fact. Treat them as hard rules.

- Make no repository edits. Do not implement fixes, commit, push, resolve
  threads, merge, approve, dismiss, or edit the PR description. Temporary proof
  artifacts may live only in a disposable worktree or temporary directory and
  must be removed.
- Use `$REVIEWER` for every GitHub write. Never switch accounts automatically
  and never post from `$BOT` or another identity.
- Put `**Review performed by Codex.**` in the body of every submitted GitHub
  review. This means the review body attached to the PR, not the PR description.
- Post the completed review immediately. Do not show drafts or ask the user to
  approve wording.
- Order findings by `P0`, `P1`, `P2`, then `P3`. Do not post style nits or
  speculative defects.
- Submit `COMMENT` regardless of finding priority. Priority communicates
  severity; it does not select the GitHub review event. Use `REQUEST_CHANGES`
  only when the user explicitly asks for it. Never submit `APPROVE`.

## 1. Resolve and verify the PR

This skill posts to GitHub immediately, so resolving the wrong target writes a
review onto the wrong PR with no draft step to catch it. The checked-out branch
is a **last** resort, not a first one: in a repo where sessions share one working
directory and many worktrees exist, the branch under `HEAD` is frequently not the
PR the user is looking at.

Resolve the target in this order, and stop rather than guess:

1. **A PR number or URL in the current invocation.** Supported forms:
   `/review-claude-pr Review PR #241`, `/review-claude-pr 241`, a full PR URL
   (`https://github.com/<owner>/<repo>/pull/241`), or bare `/review-claude-pr`,
   which falls through to the steps below.
2. **The most recent PR the *user* explicitly selected in this session.**
3. **The most recent tracker issue the *user* explicitly selected** (Linear,
   GitHub issue, whatever the project uses), and only when it maps to exactly one
   linked **open** PR in this repository. Two or more linked open PRs is
   ambiguity, not a tie to break.
4. **The current branch's PR**, as the fallback:
   ```bash
   gh pr view --json number,url,state,isDraft,author,baseRefName,headRefName,headRefOid
   ```
5. **Otherwise stop and ask for an explicit target.** Absent or genuinely
   ambiguous context is a reason to stop, never a reason to review the branch
   that happens to be checked out.

Two rules on what counts as context:

- **Only a user selection establishes it.** A PR number appearing in assistant
  prose, tool output, or a previous review body is not a selection. Inferring
  from those is how a review lands on a PR nobody asked about.
- **A later user selection supersedes an earlier one.**

**Announce the resolved PR and which step resolved it before reviewing** — for
example, "reviewing #241, selected by you in this session; the checked-out branch
is `feat/pr-loop-skill` (#239)". When step 4 supplies the target, say so
explicitly, because that is the step most likely to be wrong.

The authorship check and the head-SHA idempotency marker below are unchanged by
this ordering; they apply to whichever PR is resolved.

Resolve the repository and verify the active writer before reviewing:

```bash
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
ACTIVE_LOGIN=$(gh api user --jq .login)
test "$ACTIVE_LOGIN" = "$REVIEWER"      # REVIEWER = identities.reviewer
```

If the identity check fails, stop without posting and report the active login.
Do not switch it. Require an open PR. A draft PR may be reviewed, but identify
it as a draft in the summary.

Confirm the PR author is `$BOT`. If it is not, inspect the PR commits for that
author. If neither the PR nor its commits are attributable to `$BOT`, stop unless
the user explicitly requested that exact PR despite its author.

Use a hidden idempotency marker tied to the reviewed head SHA:

```text
<!-- codex-review head:<full-head-sha> -->
```

Check existing submitted reviews and conversation comments for that exact
marker. If it exists, do not duplicate the review unless the user explicitly
asked to rerun it. A new head SHA is a new review target.

## 2. Inspect exactly what would merge

Read the applicable agent-instruction files (`AGENTS.md`, `CLAUDE.md`) and any
project documents they require for the changed paths. Review the PR's merge-base
diff, not a two-dot comparison against the current base tip.

Resolve or fetch the base and PR head without changing the user's working
branch, then run:

```bash
MERGE_BASE=$(git merge-base "$REVIEW_HEAD" "$BASE_REF")
git diff --name-status "$MERGE_BASE" "$REVIEW_HEAD"
git diff --find-renames "$MERGE_BASE" "$REVIEW_HEAD"
```

If the PR head is not checked out, inspect it with Git plumbing (`git show`,
`git grep`, and `git diff`) or use a disposable detached worktree. Do not alter
the user's current worktree.

For every changed path:

1. Read the complete diff and enough surrounding code to understand the changed
   behavior.
2. Read affected callers, schemas, migrations, and tests, including unchanged
   contract partners.
3. Run focused tests or other read-only checks needed to demonstrate the
   affected scenario. The test invocation is `gates.test` from
   `.agents/stack.yml`; if it is null, do not invent one — refuse the proof step,
   naming the key.
4. Continue through the complete diff after finding the first issue.

Flag a finding only when it is introduced by this PR, affects correctness,
security, performance, or meaningful maintainability, has a concrete affected
path, and is something the author would likely fix. Do not flag intentional
behavior changes, pre-existing defects, broad architectural preferences, or
formatting/style nits.

### Project proof gate

If `review_gate.skill_path` is configured and any changed path matches
`review_gate.scope`, read that skill and apply it against the same merge base
and PR head. It takes an explicit PR number or `base_ref head_sha`, which is what
this gate needs. Use the **tracked** copy at the configured path — never an
untracked sibling copy, which is typically older and scoped to the current
branch only.

Verify the dependency before relying on it, and **fail closed** if it is missing:

```bash
GATE="<review_gate.skill_path>"
if ! git ls-files --error-unmatch "$GATE" >/dev/null 2>&1; then
  echo "project proof gate unavailable: $GATE is not tracked in this checkout" >&2
  # Do not review gated paths unproven — say so in the review body and post
  # observations on those paths as non-blocking questions only.
fi
```

A clean clone that cannot find the gate must **say so in the review body** rather
than fall back to unproven defect claims on the gated paths. The gate being
absent is a reportable condition, not a licence to skip it silently.

Applying the project proof gate adds its proof requirement to the general review:

- Post defects on gated paths only when backed by a failing test, verifier
  rejection, schema error, or demonstrated invariant violation.
- Keep proof-only test files outside the repository or in the disposable
  worktree, and remove them after collecting the output.
- Downgrade unproven suspicions on gated paths to clearly labeled non-blocking
  questions; do not phrase them as defects or use them alone to request changes.

When `review_gate.skill_path` is null, none of this applies — run the general
review and state in the report that the project configures no proof gate.

## 3. Build the prioritized review

Use one finding per issue and cite the smallest changed line range that
establishes the defect:

```text
[P1] Use an imperative, actionable title

Explain the concrete input or call path, the resulting wrong behavior, and why it
matters. State the requested outcome clearly, without prescribing an unnecessary
implementation.
```

Priority meanings:

- `P0`: universal release blocker, data loss, or critical security/correctness
  failure.
- `P1`: urgent defect that should be fixed next.
- `P2`: ordinary defect that should be fixed before merge.
- `P3`: low-impact but concrete improvement or recommendation.

Keep non-blocking questions in a final `Questions` section after all findings.
Mention material test gaps or residual risks in the review summary, but never
inflate a test gap into a defect without a demonstrated failure mode.

## 4. Submit the review immediately

Prefer one GitHub review containing all inline comments, ordered by priority.
Anchor every inline comment to a changed line on the PR head. The review body
must follow this shape:

```markdown
## Codex review

**Review performed by Codex.**

Reviewed `<short-head-sha>` against `<base-branch>`.

### Findings

1. **[P1] Short title** — `path/to/file.py:42`
2. **[P2] Short title** — `path/to/other.py:18`

### Overall assessment

One concise assessment, followed by material test gaps or residual risks.

<!-- codex-review head:<full-head-sha> -->
```

Omit `Findings` when there are none. For a clean review, post a `COMMENT` review
whose assessment says `No findings.` and still includes the Codex attribution and
idempotency marker.

Submit through the GitHub review API so the body, event, and ordered inline
comments are one review. Set `event` explicitly to `COMMENT` unless the user
explicitly requested `REQUEST_CHANGES`; never leave a pending review. Do not
infer `REQUEST_CHANGES` from P0/P1/P2 findings. Re-check
`gh api user --jq .login` immediately before the write and compare it against
`$REVIEWER`; a mismatch at that moment stops the post.

If an explicitly requested `REQUEST_CHANGES` review is rejected because
`$REVIEWER` owns the PR, verify that no review with the idempotency marker was
created, retry once as `COMMENT`, and state the fallback in the report back.

If an inline anchor is rejected, do not silently lose the finding. Verify that no
review with the idempotency marker was created, then retry once with the affected
finding in the top-level review body and its file/line citation. Avoid duplicate
submissions.

After posting, fetch the submitted review and verify all of the following:

- author login is `$REVIEWER`;
- state matches the intended event;
- body contains `Review performed by Codex` and the head-SHA marker;
- every planned finding appears either inline or in the top-level body.

## Report back

Return the PR URL, submitted review URL or ID, event used, and counts by
priority. State that no code was changed or pushed, and whether the project proof
gate ran, was absent (`review_gate.skill_path: null`), or failed closed. If
posting failed, say so plainly and include the blocking error; never imply that a
local draft was published.

## What this skill is NOT for

- Fixing findings, replying to threads, or resolving them — that is
  `tools/github/review-comments`.
- Merging, approving, dismissing, or changing PR state.
- Reviewing human-authored PRs, unless the user explicitly names one.
- Style-only passes: this is a defect-first review.
