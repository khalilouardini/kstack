---
name: summarize-change
version: 0.3.0
description: Brief a change in chat, leading with the decision and key caveats and backing them with intent, impact, and observed verification. Use when asked to "summarize this PR", "what did we do here", "give me a high-level summary of this branch", "brief me on this change", or "/summarize-change [branch | PR | commit range | paths] [--tight]". (kstack)
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
`--tight` emits one compact paragraph. Gather the same evidence in either mode.

**Resolve the argument to concrete revisions before investigating.** State the
target and revision range in the briefing, after the opening decision.

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
  intent, and any alternative the evidence shows was considered. Name the system
  constraints it relies on or changes: a contract with another component, an
  invariant, an access rule, a data shape, or which component owns state. These are
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

### Default

- **Decision and key caveats.** Open with the specific call the reader has to
  make or the next concrete action. Put the blockers, conditions, scope gaps,
  and policy choices that could change that call in the opening. If no action
  is pending, say so and lead with the outcome.
- **Change and impact.** Identify the target and revision range. State what
  changed and why, cite the intent source or label the intent as inferred, and
  distinguish what this change delivers from any wider completion criteria.
  Include the approach, affected callers or data, and departures from intent
  where they matter to the reader. Omit empty categories and mechanical detail.
  Add a precise `file:line` reference only where the reader has a concrete
  reason to inspect the implementation, such as a spend gate, data write, or
  consequential departure from the agreed scope.
- **Verification.** State what was verified at the stated revision and what
  remains unverified. Name the local gates and their observed exit codes,
  giving the exact commands when known. Include material test, CI, and review
  results when available. Distinguish local checks from CI, and report pending
  or failed checks explicitly. Say which configured `gates.lint` and
  `gates.test` in `.agents/stack.yml` were not run in this session.
  Report the limits of replay or offline evidence when
  the intended outcome depends on live behavior.

### `--tight`

Write one compact paragraph without headings, lists, file references, or
omission counts. Aim for three to five sentences. Lead with the decision or
next action and the caveats that affect it. Identify the target and revision
range, and state what changed and why, with a short intent source or an
explicit inference. Close with the verification that bears on the decision.
Keep observed exit codes for any local
gates cited and state which configured gates were unrun, grouping them when
possible. Keep material verification gaps even if no checks ran.

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
- **A local gate claim with no observed exit code.**
- **A summary of a range it did not state.** See Inputs.
- **A merge verdict.** Beyond intent and short of intent are facts for the
  reviewer, not a ruling on them — see When to invoke.

## Enforcement

**Prompt-level.** Before sending, check that the opening tells the reader what
to decide or do and which caveats affect it. Check that the briefing identifies
the revisions and gives observed verification or states the evidence gap.
