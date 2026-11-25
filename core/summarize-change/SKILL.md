---
name: summarize-change
version: 0.4.0
description: Brief a PR or change in chat with an intent paragraph, a few main-change and eval bullets, and PR details in a final appendix. Use when asked to "summarize this PR", "what did we do here", "give me a high-level summary of this branch", "brief me on this change", or "/summarize-change [branch | PR | commit range | paths] [--tight]". (kstack)
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
Both modes use an intent paragraph, a few bullets on main changes and evals,
and a final appendix for PR details. `--tight` shortens that structure; it does
not change it. Gather the same evidence in either mode.

**Resolve the argument to concrete revisions before investigating.** Record the
target and revision range in the final appendix.

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

Use the same structure in both modes: one clean paragraph, a few bullet points,
then an **Appendix**. Start directly with the paragraph, without a summary title
or mode label. Keep the main body focused on intent, main changes, and evals.

**Opening paragraph — intent.** Explain the problem, who it affects, and what
the PR aims to achieve. Connect that goal to the resulting behavior in plain
language. Attribute the intent briefly to the request, issue, or spec; label it
as inferred when necessary. Include a material scope gap or policy choice where
it changes the reader's understanding of the outcome. Do not lead with an
approval request, next action, PR number, revision range, or status inventory.

**A few bullets — main changes and evals.** Aim for 3–5 bullets total:

- Use 2–4 bullets for the main behavioral changes, grouped by what the system
  now does. Explain the approach and affected users, callers, or data where
  they help the reader understand the change. Include consequential departures
  from intent here; omit empty categories and mechanical edits.
- Finish with an **Evals:** bullet. Say which intended behaviors the observed
  tests, evals, CI, or other checks support, their results, and any material
  failures or gaps. Distinguish local evidence from CI and tests merely added
  from tests actually run. If no checks ran, say so. Keep the outcome and its
  limits here; put the command transcript and status details in the appendix.

**Appendix — PR and evidence details, always last.** Keep this compact, grouping
related details into a few bullets and omitting unavailable or irrelevant fields:

- PR link, issue/spec links, branch, and the concrete base/head or revision
  range actually summarized. For path inputs, include the selected paths.
  State any unresolved target or fallback here.
- Exact check commands and observed exit codes for local gates cited in the
  body; CI run links and head, review state, and pending checks when relevant.
  Say which configured `gates.lint` and `gates.test` in `.agents/stack.yml` were
  not run in this session, grouping them when possible. Never imply a green
  suite from tests that were only inspected.
- Supporting implementation references or operational steps only when useful.
  Keep `file:line` citations, SHAs, counts, and routine PR metadata out of the
  main paragraph and bullets.

For frontend changes, retain localhost demo instructions and/or screenshot
links, their revision and observed result, following the physical stack root's
`ORCHESTRATION.md` **Frontend review evidence** contract. Put those supporting
details in the appendix. Missing, stale, or uninspected visuals remain visible
as material gaps in the Evals bullet, including with `--tight`. Likewise, state
the limits of replay or offline evidence when the outcome needs live behavior.

**Length is the only mode difference.** With `--tight`, aim for a 1–2 sentence
paragraph and short, single-sentence bullets (roughly 100–160 words before the
appendix). Without it, expand the paragraph and the same bullets with useful
context and explanation (roughly 200–350 words before the appendix). These are
guidelines: use less for a simple change, and keep material evidence gaps in
either mode. Do not add more sections or print a "tight" label in the response.

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

**Prompt-level.** Before sending, read only the paragraph and main bullets:
can the reader explain the PR's intent, main changes, and what the evals prove
or leave unverified? Check that both modes use that structure and all PR and
evidence details follow in the final appendix, including the revision range.
