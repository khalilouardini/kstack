---
name: summarize-change
version: 0.1.0
description: Brief someone on a change in the session itself — one verdict line, the decision it encodes, a behavioral change map with file:line evidence, blast radius with real gate exit codes, and what the change does not do. Refuses file-by-file narration and changed-line counts. Use when asked to "summarize this PR", "what did we do here", "give me a high-level summary of this branch", "brief me on this change", or "/summarize-change [branch | PR | commit range | paths]". (kstack)
---

# summarize-change — brief a change in chat, at briefing depth

## When to invoke

Someone needs the shape of a change now, in the conversation, without opening a
file:

- Returning to your own branch after days away, before deciding what is left.
- Handing a branch to whoever picks it up next.
- Writing the PR description, the standup line, or the handover message.
- Reading someone else's PR before reviewing it, to know what it is *for*.

Invoke on "summarize this PR", "what did we do here", "brief me on this
branch", "high-level summary of this change", "/summarize-change".

Three neighbours, and the unit each one works on:

| Want | Skill |
|---|---|
| A briefing in the session, nothing written | this skill |
| A teaching artifact someone studies without you — page, diagrams, quiz | `/explain-diff-html` |
| Whether a *period* of work was fruitful, across many PRs | `/delivery-retro` |

**Not** a review. This skill forms no verdict on whether the change is correct
or mergeable — that is the review cluster (`/review-claude-pr`, the project's
`review_gate.skill_path`, or the host's built-in `/code-review`). It reports
what the change does and what it risks; it never says "ship it".

## Inputs

`/summarize-change [branch | PR number | commit range | file paths]`. With no
argument, summarize the current branch against its merge base.

**Resolve the argument to concrete revisions and state them before summarizing
anything.** A briefing on the wrong range is worse than none, and unlike a
wrong file reference nothing downstream will catch it.

```bash
git merge-base --fork-point HEAD origin/main || git merge-base HEAD origin/main
```

A PR-number input needs `gh`. **Without `gh` this skill still works on every
other input form** — branch, range, paths — and it says so rather than
guessing: report that the PR number could not be resolved, name the branch you
summarized instead, and note that PR title, body, and review state are absent
from the briefing.

## 1. Collect the facts, with commands whose output you can quote

Everything in the briefing rests on one of these. Run them first; do not
summarize from memory of the session that produced the change.

```bash
BASE=$(git merge-base HEAD origin/main)
git diff --stat "$BASE"...HEAD          # which areas were touched
git log --oneline "$BASE"..HEAD          # what the author said they were doing
git diff "$BASE"...HEAD -- '*test*'      # which assertions moved
gh pr view <N> --json title,body,state,reviewDecision  # only with gh
```

Commit messages are **claims about** the change, not evidence for it. Where a
message and the diff disagree, the diff wins and the disagreement is worth one
line in the briefing.

## 2. Establish the change at briefing depth

Briefing depth, not teaching depth. `/explain-diff-html` requires enough
understanding for a reader to predict cases the page never showed — this skill
does not, and pursuing that here costs time the asker did not offer. Establish
exactly four things:

- **What behavior differs.** Stated as a before and an after, not as a list of
  edits.
- **Who is affected.** Grep the changed symbols for callers. A change with no
  callers outside its own file has a small blast radius, and that is a fact
  worth reporting.
- **What the tests now assert.** A changed test names the behavior that was
  load-bearing; an unchanged test names an invariant that held.
- **Which decision it encodes.** Usually recoverable from the diff plus the
  alternative that is visibly absent.

If any of the four cannot be established from the evidence, say which one and
why. An honest gap beats a confident guess, because the asker is about to act
on this.

## 3. Emit the briefing

Six parts, in this order, 15–25 lines total. Longer than that is a page, and a
page is `/explain-diff-html`.

| Part | Carries |
|---|---|
| **Verdict** | One sentence: what the system does now that it did not before. |
| **Why** | The decision encoded, and the alternative not taken. |
| **Change map** | 3–6 bullets, **one per behavioral area**, each citing `file:line`. |
| **Blast radius** | Callers affected, data-shape and migration changes, and which gates ran with which exit code. |
| **Not covered** | What a reader would wrongly assume this change does. |
| **Next action** | One line, concrete, doable now. |

Two of these earn the skill and are the two most often dropped:

**Change map bullets are behavioral areas, never files.** One area routinely
spans four files; one file routinely carries two unrelated areas. If a bullet's
subject is a filename, it is a diff summary wearing the right format.

**"Not covered" is where a handover briefing pays for itself.** The reader is
about to assume the change is complete in some direction it is not — the flag
is added but not read anywhere, the migration is written but not run, one of
two call sites is updated. State those. If the change genuinely has no such
edge, write "nothing obvious" rather than inventing one.

Gate results go in blast radius **only with the exit code you observed**. If
you did not run the project's `gates.lint` and `gates.test` from
`.agents/stack.yml`, write "gates not run in this session" — never imply a
green suite you did not see.

## 4. What this skill refuses

- **File-by-file narration.** The failure mode named at step 2 of
  `/explain-diff-html`: walking the diff top to bottom leaves the reader knowing
  which lines moved and not what the system now does. A briefing organized by
  file has failed even when every line of it is true.
- **Changed lines, commit count, and file count as a measure of the work.**
  Report them as scale when scale matters to the reader's next action; never as
  a score. Inherited verbatim from `/delivery-retro` and CONVENTIONS.md §6.
- **A gate claim with no exit code.**
- **A summary of a range it did not state.** See Inputs.
- **A merge verdict.** Not this skill's job — see When to invoke.

## Enforcement

**Prompt-level, entirely.** The deliverable is text in a session: there is no
artifact to validate, so the validator model that gates `/explain-diff-html`
does not transfer here and no hook is involved. Nothing but this procedure
keeps the briefing at six parts, the change map behavioral, and the gate claims
honest.

The one check that is available costs a second and is worth taking: reading
only the verdict line and the next-action line, does the asker know what
changed and what to do about it? If not, those two lines are the ones to fix.
