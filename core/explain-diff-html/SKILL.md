---
name: explain-diff-html
version: 0.1.0
description: Explain a code change as one self-contained offline HTML page — investigation first, semantic diagrams, a five-question quiz — then gate it with a stdlib validator that blocks remote assets, collapsed code samples, and a quiz scoreable without reading the page. Use when asked to "explain this diff", "write up this change", "onboard someone onto this PR", or "/explain-diff-html [branch | PR | commit range | paths]". (kstack)
---

# explain-diff-html — teach a change, then prove the page is not broken

## When to invoke

Someone has to understand a change they did not write:

- Onboarding a collaborator onto a subsystem they have not touched.
- After a change whose *reasoning* is the valuable part and would otherwise be
  lost — a backend swap, a gate insertion, a scoring-rule change.
- Before a design review, so attendees arrive with the model already loaded.
- On your own long-lived branch, for the version of you that returns to it.

Invoke on "explain this diff", "write up this change", "explain this PR to
someone new", "/explain-diff-html".

**Not** for deciding whether to merge — that is the consuming repo's review gate
(`review_gate.skill_path` in `.agents/stack.yml`) or a general code review. Not
for API reference docs. Not for anything whose deliverable belongs in version
control: the output is a throwaway teaching artifact written under `/tmp`,
deliberately outside the repo.

If the explanation should live in a team workspace — editable, commentable,
alongside other docs — use a wiki or doc-tool equivalent instead. Reach for this
skill when you want a single file that works offline, renders its own diagrams,
and tests comprehension.

## Inputs

`/explain-diff-html [branch | PR number | commit range | file paths]`. With no
argument, explain the current branch against its merge base. Resolve the
argument to a concrete diff before doing anything else, and say out loud which
revisions you resolved it to — an explanation of the wrong range is worse than
none.

## 1. Investigate before writing

The failure this step exists to prevent is **narrating the diff instead of
explaining the change**. A page that walks files top to bottom leaves the reader
knowing which lines moved and not what the system now does.

Before writing a single line of the page, establish:

- **What the system did before.** Read the pre-change version of the touched
  code, not only the diff's context lines.
- **Who calls it.** Grep for the changed symbols. A change is explained by its
  callers at least as much as by its own body.
- **What the tests assert.** A test that changed tells you which behavior was
  load-bearing; a test that did not change tells you which invariant held.
- **What data flows through.** Models, schemas, and the shapes at the boundary.
- **Which decision the change encodes.** The alternative that was not taken is
  usually the most valuable sentence on the finished page.

Treat the diff as **evidence for** the explanation, never as its outline.

## 2. Write the page

Write to `/tmp/YYYY-MM-DD-explanation-<slug>.html`. One file, no siblings.

Required sections, by `id` — the validator checks these exist:

| `id` | Carries |
|---|---|
| `the-change` | What the system does now that it did not before. The answer, first. |
| `why` | The reasoning, and the alternative not taken. |
| `how-it-works` | The mechanism, in enough detail to predict unshown cases. |
| `quiz` | The comprehension check. |

Add whatever other sections the change needs; these four are the floor. A table
of contents is optional, but every `#anchor` you write must resolve.

Hard constraints, each one enforced by a check in step 3:

- **Everything inline.** No remote stylesheet, font, script, or image. Outbound
  `<a href>` links are fine — those are references, not dependencies.
- **`pre` gets a preserving `white-space`.** Without a CSS rule setting
  `white-space: pre` or `pre-wrap`, every code sample collapses onto one line
  for the reader while still looking correct to you.
- **Diagrams are HTML and CSS.** No box-drawing characters, no ASCII art in a
  `<pre>`. A flex row of bordered `<li>` elements outperforms character art at
  every window width and survives copy-paste.
- **No network calls in the inline script.**

Read `reference.html` in this skill's own directory before writing your first
page. It is a working page that passes every check, so it doubles as the
executable version of this spec — copy its structure rather than deriving one.

## 3. Gate it

**A page is deliverable only when the validator exits `0`.** Run it:

```bash
SKILL_DIR="$HOME/.claude/skills/explain-diff-html"
PAGE="/tmp/$(date +%F)-explanation-<slug>.html"
python3 "$SKILL_DIR/validate_explanation.py" "$PAGE"
```

`$SKILL_DIR` is where the installer symlinks this skill. If it does not exist —
you are running from a repo checkout rather than an install — use the directory
you read this `SKILL.md` from; in the stack checkout that is
`core/explain-diff-html/`. Both hold the same
`validate_explanation.py` and `reference.html`.

What it checks:

| Check | Blocks when |
|---|---|
| `document` | No doctype, no closing `</html>`, empty `<title>` — the signature of a truncated write |
| `offline` | Remote `src`/`href` asset, `@import`, `url(https://…)`, or a network call in an inline script |
| `code-blocks` | No CSS rule targeting `pre` sets `white-space: pre` or `pre-wrap` |
| `diagrams` | Box-drawing characters or ASCII art inside a `<pre>` |
| `structure` | A required section missing, or an anchor pointing at a nonexistent id |
| `quiz` | Not exactly 5 questions, a malformed entry, an empty explanation, or an all/none-of-the-above option |
| `quiz-position` | One slot holds the answer 3+ times, or fewer than 3 distinct slots are used |
| `quiz-length` | The correct option is the single longest in more than half the questions |
| `quiz-leak` | `data-correct`, a `correct` class, correctness in an `aria-label`, or only the answer rendered in static markup |

`document` and `a11y` also emit **warnings** — missing `:focus` styling, no
viewport meta, inline `onclick`. Warnings do not affect the exit code and do not
block, but fix them unless you have a reason not to.

**Fix and re-run until it exits `0`.** Do not hand-wave a failure as a false
positive without demonstrating it: every check names the exact construct it
found.

**Enforcement is prompt-level.** Nothing forces the validator to run except this
procedure — there is no hook. What the validator does catch, it catches
deterministically and identically on any machine; whether it runs at all is on
whoever follows these steps.

## The quiz-data contract

The validator can audit the quiz only because the questions live in one
machine-readable block:

```html
<script type="application/json" id="quiz-data">
[{"question": "...", "options": ["...", "..."], "answer": 2,
  "explanation": "...", "distractors": {"0": "the misreading this encodes"}}]
</script>
```

Two consequences worth stating explicitly:

- **`answer` indexes the options as emitted, and that order is final.**
  Shuffling happens at authoring time. A runtime `Math.random()` shuffle would
  make the position-balance rule unverifiable and the page non-reproducible.
- **Option elements carry no correctness marker.** The script reads `answer`
  from the JSON on click. That is what turns "do not leak the answer through
  markup" into something mechanically checkable rather than a matter of trust.

Write the five questions so each one asks the reader to **predict** what the
system does in a case the page never showed them. `distractors` is optional but
worth filling in: naming the misreading a wrong option encodes is where most of
the teaching happens.

## Rule of thumb

The reader should be able to predict what the system does in a case the page
never showed them. If the page only supports recall of what it stated, it
explained the diff and not the change.

The quiz is the cheapest test of this. If every question is answerable by
scanning back for a matching phrase, the explanation has not done its job — and
no validator will tell you that one.
