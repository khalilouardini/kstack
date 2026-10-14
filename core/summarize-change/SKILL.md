---
name: summarize-change
version: 0.2.0
description: Brief a change in the session by its intent — the intent with its source, approach and constraints touched, the diff checked against that intent, sensitive ranges, blast radius with real gate exit codes, the decision needed. Refuses file-by-file narration and line counts. Use when asked to "summarize this PR", "what did we do here", "give me a high-level summary of this branch", "brief me on this change", or "/summarize-change [branch | PR | commit range | paths] [--tight]". (kstack)
---

# summarize-change — brief a change by its intent, in chat

## When to invoke

Someone needs to know what a change is for, and whether the code does that and
nothing else, now, in the conversation, without opening a file:

- Returning to your own branch after days away, before deciding what is left.
- Handing a branch to whoever picks it up next.
- Writing the PR description, the standup line, or the handover message.
- Before a human review. ORCHESTRATION.md makes this the briefing a ticket
  session sends before each human review. That reviewer judges the change's
  intent rather than reading every line, so the briefing states the intent and
  shows where the code departs from it.

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
what the change is for, what it does, and where those two differ; it never
says "ship it".

## Inputs

`/summarize-change [branch | PR number | commit range | file paths] [--tight]`.
With no target, summarize the current branch against its merge base.
`--tight` emits the same six parts under per-part caps, at most 250 words — see
step 3. It changes only what is emitted; steps 1 and 2 run in full either way.

**Resolve the argument to concrete revisions and state them before summarizing
anything.** A briefing on the wrong range is worse than none, and unlike a
wrong file reference nothing downstream will catch it.

```bash
BASE=$(git merge-base --fork-point HEAD origin/main || git merge-base HEAD origin/main)
echo "$BASE"
```

Every command in step 1 reads `$BASE`, so assign it first. Shell state does not
persist between tool calls on most hosts: repeat the assignment in each call
that reads `$BASE`, or an unset `$BASE` turns `git log "$BASE"..HEAD` into an
empty `HEAD..HEAD` with no error.

A PR-number input needs `gh`. **Without `gh` this skill still works on every
other input form** — branch, range, paths — and it says so rather than
guessing: report that the PR number could not be resolved, name the branch you
summarized instead, and note that PR title, body, and review state are absent
from the briefing.

## 1. Collect the facts, from two kinds of source

Everything in the briefing rests on one of these. Run them first; do not
describe the code from memory of the session that produced the change.

**Intent sources** say what the change is for. Read every one that exists, in
this order — the first two record what was asked for and approved before the
work started, the last two are written by whoever implemented it, often an
agent:

| Source | How to find it |
|---|---|
| Tracker issue | The issue key (`issue_prefix` in `.agents/stack.yml`) in the branch name, PR title, or PR body; read its description and acceptance criteria with the tracker's tools |
| Spec file | `<spec_output_dir>/<slug>.md`, written by `/spec`: `Serves gate`, `Scope contract`, `Why this is in scope`, `Architectural seam & collisions` |
| PR body | `gh pr view <N> --json title,body` |
| Commit messages | `git log "$BASE"..HEAD` |

The human's own request in this session counts as an intent source at the top
of that order, quoted; the rest of the session does not.

**Code evidence** says what the change does:

```bash
git diff --stat "$BASE"...HEAD          # which areas were touched
git diff "$BASE"...HEAD                  # what the code now does
git diff "$BASE"...HEAD -- '*test*'      # which assertions moved
gh pr view <N> --json state,reviewDecision  # only with gh
```

The two kinds are trusted for different things. Intent sources decide what the
change was meant to do; they never decide what it does. Where a PR body or
commit message claims the code does something, the diff decides, and a
disagreement is worth one line. Where the PR body states a different goal from
the issue or spec, that is intent drift: report both, and brief against the
issue or spec.

**No intent source at all** — an ad-hoc branch with terse commits — is common
and allowed. Infer the intent from the diff, and label it as inferred in the
briefing. Never present an inferred intent as a stated one.

## 2. Check the diff against the intent

Briefing depth, not teaching depth. `/explain-diff-html` requires enough
understanding for a reader to predict cases the page never showed — this skill
does not, and pursuing that here costs time the asker did not offer. Establish
exactly five things:

- **The intent.** The problem, who has it, and what done means, from the first
  intent source in the order above.
- **The approach.** The system-level choice the change makes to meet the
  intent, and the alternative visibly not taken. Name the system constraints it
  relies on or changes: a contract with another component, an invariant, an
  access rule, a data shape, which component owns a piece of state. These are
  the choices a reviewer is most likely to reject — an agent will follow a
  local pattern that breaks one, such as reconstructing state from a log
  instead of querying the component that owns it.
- **Each behavioral area, sorted against the intent**, into one of three
  groups:
  - *Delivered* — serves the intent.
  - *Beyond intent* — code the intent does not call for: validation or
    fallbacks for a case the intent never raised, refactors, new dependencies,
    new configuration, a second feature.
  - *Short of intent* — what the intent asks for and the diff does not do: the
    flag added but read nowhere, the migration written but not run, one of two
    call sites updated, an acceptance criterion with no test.
- **Sensitive and mechanical ranges.** Sensitive: control flow, permissions,
  data writes, contracts with other components, test assertions. Mechanical:
  comments, docs, renames, formatting, generated files, regenerated fixtures.
- **Who is affected.** Grep the changed symbols for callers. A change with no
  callers outside its own file has a small blast radius, and that is a fact
  worth reporting.

If any of the five cannot be established from the evidence, say which one and
why. An honest gap beats a confident guess, because the asker is about to act
on this.

## 3. Emit the briefing

Six parts, in this order, 15–25 lines total. Longer than that is a page, and a
page is `/explain-diff-html`.

| Part | Carries |
|---|---|
| **Intent** | 1–3 sentences: the problem, who has it, what done means. Ends with its source — issue key, spec path, "PR body" — or "inferred from the diff; no stated intent". |
| **Approach** | The system-level choice, the alternative not taken, and the system constraints it relies on or changes. |
| **Diff vs intent** | Three labelled lines — `Delivered:`, `Beyond intent:`, `Short of intent:` — each item a behavioral area citing `file:line`. An empty group says "none"; it is never dropped. |
| **Sensitive vs mechanical** | `Sensitive:` the `file:line` ranges a reviewer must read. `Mechanical:` the rest, by kind. |
| **Blast radius** | Callers affected, data-shape and migration changes, and which gates ran with which exit code. |
| **Decision needed** | The one call the human has to make on this change; when none is pending, the next action, concrete and doable now. |

Four rules carry the skill, and each is the one most often broken:

**The Intent line states a purpose, not a behavior.** "`cache.get` falls back
to the origin on a miss" is a behavior. "Pages stop returning 500 while the
cache tier restarts" is an intent. If the Intent line could have been written
from the diff alone, it is a behavior: go back to the intent sources, or label
it inferred.

**Beyond intent is checked, not assumed empty.** Agents add validation,
fallbacks, and abstractions the intent never asked for, and a briefing that
lists only delivered work hides them from the one reader who would remove
them. Write "none" only after sorting every behavioral area.

**Diff vs intent items are behavioral areas, never files.** One area routinely
spans four files; one file routinely carries two unrelated areas. An item whose
subject is a filename is a file list, not a behavioral area.

**Short of intent names what the reader will wrongly assume is done.** A
handover reader assumes the change completes its intent; this line says where
it does not. If the change genuinely completes it, write "none" rather than
inventing a gap.

Gate results go in blast radius **only with the exit code you observed**. If
you did not run the project's `gates.lint` and `gates.test` from
`.agents/stack.yml`, write "gates not run in this session" — never imply a
green suite you did not see.

### `--tight`

The same six parts, in the same order, at most **250 words** in total as
`wc -w` counts them, the range statement from Inputs included. The budget is in
words, not lines, because a line has no length limit.

| Part | Cap |
|---|---|
| **Intent** | 2 sentences, 40 words, source kept |
| **Approach** | 2 sentences, 40 words, naming at most 2 system constraints |
| **Diff vs intent** | 3 items per group, each 12 words plus its `file:line` |
| **Sensitive vs mechanical** | 4 sensitive ranges, each a `file:line` plus 6 words; mechanical as one line of kinds |
| **Blast radius** | 30 words, gate exit codes kept |
| **Decision needed** | 1 sentence |

When a cap drops items, keep the ones most likely to change the reader's
decision and state how many were dropped: `Beyond intent: …; …; … (+2 more)`.
The count is the whole record of a dropped item; describing it in parentheses
spends the words the cap removed. The reader can ask for the full briefing.
The caps never drop the intent's source, the "inferred" label, a gate exit
code, or a group's "none".

Count before emitting. Over 250 words, cut the lowest-ranked items and raise
their counts; do not shorten citations to fit.

## 4. What this skill refuses

- **File-by-file narration.** The failure mode named at step 2 of
  `/explain-diff-html`: walking the diff top to bottom leaves the reader knowing
  which lines moved and not what the system now does. A briefing organized by
  file has failed even when every line of it is true.
- **An inferred intent presented as a stated one.**
- **The PR body as the intent when an issue or spec exists.** The implementer
  wrote the PR body; brief against what was asked for.
- **Changed lines, commit count, and file count as a measure of the work.**
  Report them as scale when scale matters to the reader's next action; never as
  a score. Inherited verbatim from `/delivery-retro` and CONVENTIONS.md §6.
- **A gate claim with no exit code.**
- **Under `--tight`, an item dropped without a count.**
- **A summary of a range it did not state.** See Inputs.
- **A merge verdict.** Beyond intent and short of intent are facts for the
  reviewer, not a ruling on them — see When to invoke.

## Enforcement

**Prompt-level, entirely.** The deliverable is text in a session: there is no
artifact to validate, so the validator model that gates `/explain-diff-html`
does not transfer here and no hook is involved. Nothing but this procedure
keeps the briefing at six parts, the intent sourced, the diff sorted against
it, and the gate claims honest.

The one check that is available costs a second and is worth taking: reading
only the Intent line and the Decision needed line, does the asker know what the
change is for and what they have to decide? If not, those two lines are the
ones to fix.
