---
name: stack
version: 0.3.0
description: Router for the kstack skill suite — sends a request to the right skill across decide, build, review, land, and operate, and disambiguates the review and decide clusters. Use when asked to "route this", "which stack skill fits this?", "what should I use for this", or "/stack". Proactively suggest when a request matches a stack skill's purpose and the right one is not obvious. (kstack)
---

# stack — the router

## When to invoke

The request could be handled by a stack skill and you are deciding which one, or
the user invoked `/stack` without naming a skill. This file is a routing table,
nothing else: it names the skill and stops. It never performs the work itself.

Casual conversation, one-off factual questions, and work already inside a
running skill do not route here.

## Route first

1. Check the consuming repo's `CLAUDE.md` (or its host equivalent) for a
   `## Skill routing` section. **A project rule that matches wins** — the project
   knows about its own domain skills and this table does not.
2. Otherwise match the rules below and invoke the named skill.
3. If nothing matches, answer directly.

Invoke as `/<name>`. On a host that does not offer slash invocation, read the
canonical `SKILL.md` at its tier path (`core/<name>/`, `roles/<name>/`,
`tools/github/<name>/`, `tools/linear/<name>/`) and follow it top to bottom.

The four **role contracts** (`product-manager`, `tech-lead`, `designer`, `qa`)
are not slash skills. Dispatch them as subagents against the project's role
adapter, or read `roles/<role>.md` and follow it in-session.

## Routing rules

### Understand and decide — before code exists

- "should we build X", "is this in scope", "spec this out", "write this up as a
  ticket", "is this worth building" → invoke `/spec`
- "what should I work on next", "what's next", "pick my next ticket", "what's
  the highest-leverage thing right now" → invoke `/next`
- "triage the backlog", "clean up the open PRs", "which branches can we
  delete", "what's still open and does it matter" → invoke `/triage`
- "is *just this* in scope?" — scope verdict only, no spec → dispatch
  `product-manager` alone
- "how long would this take", "does this already exist", "what would we reuse"
  → dispatch `tech-lead` alone (only after a scope verdict, see the decide
  matrix)
- "which component renders this", "what should this screen look like", "what
  data shape does the surface need" → dispatch `designer` alone
- "what would prove this works", "write the acceptance criteria", "how do we
  check it" → dispatch `qa` alone
- "file this", "turn this verdict into tickets", "create the issues for it" →
  invoke `/linear-feature-intake`

### Build

- "start this ticket", "tackle ISSUE-123", "dispatch this issue", "begin work
  on this Linear ticket" → invoke `/dispatch-implementation`
- "debug this", "why is this broken", "it was working yesterday", "this
  doesn't work", a pasted stack trace, a 500, a failing test → invoke
  `/investigate`
- "be careful", "safety mode", "careful mode", "prod mode", "we're touching
  production" → invoke `/careful`
- "freeze edits", "restrict edits to <dir>", "only edit this folder", "lock the
  editing scope" → invoke `/freeze`
- "unfreeze", "unlock edits", "remove the freeze", "allow all edits" → invoke
  `/unfreeze`
- "explain this change", "walk me through this diff", "make a page explaining
  this PR", "teach the team what changed" → invoke `/explain-diff-html`

### Review

- "review the bot's PR", "review PR #N", "review this as Codex", "give me a
  defect review" → invoke `/review-claude-pr`
- "answer the review comments", "address the PR feedback", "reply to the
  review", "there are unanswered comments" → invoke `/review-comments`
- "run the review loop", "ping-pong this PR", "drive the review until it's
  clean", "review it unattended" → invoke `/pr-loop`
- The diff falls inside the paths the project's own review gate claims
  (`review_gate.scope` in `.agents/stack.yml`) → run that gate first, at
  `review_gate.skill_path`

### Land

- "land this", "commit and push", "open a PR", "ship it", "get this onto a
  branch" → invoke `/land`

`/land` stops at the PR. A request to *merge* is a human decision and routes
nowhere.

### Operate

- "health check", "code quality", "how healthy is this codebase", "run all the
  checks", "quality score" → invoke `/health`
- "was this week fruitful", "engineering retro", "what did we ship", "how'd we
  do this sprint" → invoke `/delivery-retro`
- "label my sessions", "what is each session working on", "retitle the agent
  sessions" → invoke `/session-titles`
- "audit the board", "clean up the workspace", "reconcile finished issues",
  "these statuses are wrong" → invoke `/linear-steward`
- "audit the release", "is the release ready", "what's blocking the release",
  "check the gate criteria" → invoke `/linear-release-audit`

## Tie-break: when in doubt, invoke the skill

A false positive — invoking a skill that was not needed — is cheaper than a
false negative: answering ad-hoc when a structured workflow exists. Each skill
carries checklists, gates, and refusal conditions that an inline answer does
not, and the cost of an unnecessary invocation is one skill read.

The exception is the decide cluster's ordering, below: invoking `tech-lead`,
`designer`, or `qa` on an idea whose scope verdict is unknown is not a cheap
false positive — it spends three agents specifying something that may be out of
scope. Route those through `/spec`.

## Disambiguation — the review cluster

Two axes: **who reviews** and **what stage of the review**.

| Who reviews | Produce the review | Answer existing comments | Drive rounds to a stop condition |
|---|---|---|---|
| **Me, now, by hand** | the project's own review gate (`review_gate.skill_path`), when the diff is inside `review_gate.scope` | — | — |
| **The reviewer (Codex by default)** | `/review-claude-pr` — P0–P3 findings as a COMMENT review from `identities.reviewer` | — | — |
| **The implementer (Claude by default)** | — | `/review-comments` — fix, then reply as `identities.implementer` | — |
| **Nobody watching — both halves** | — | — | `/pr-loop` — each round runs the reviewer, then `/review-comments`, then re-checks the exit gates |

The one-line decision:

- Comments already exist and need answers → `/review-comments`.
- No review exists yet and one should be published → `/review-claude-pr`.
- Both halves, repeatedly, with nobody in the seat → `/pr-loop`.
- The diff touches the project's own gated paths → run that gate first. It is
  the only one of the four that demands a runnable failing artifact per finding.

`/pr-loop` **calls** `/review-comments`; do not run both. `/review-claude-pr`
never fixes or resolves, and `/review-comments` never initiates a review — the
split is deliberate, because the reviewer and the implementer post under different
identities.

## Disambiguation — the decide cluster

One axis: **which direction the work is moving**.

| Direction | The question | Route to |
|---|---|---|
| A new idea coming **in** | "should we build this at all?" | `/spec` — `product-manager` runs first and alone; only an active-milestone IN fans out to `tech-lead` + `designer`, then `qa` |
| One narrow question about an idea already understood | "is just this in scope?" / "how long?" / "which component?" / "what proves it?" | the single role contract, dispatched alone |
| The backlog, **forward** | "what do I pick up next?" | `/next` — reads the tracker, recommends exactly one thing, read-only |
| Work already open, **backward** | "what do we do with everything still unfinished?" | `/triage` — scores open PRs, branches, worktrees; writes a proposal, executes nothing |
| A decision already made, needing a record | "file it" | `/linear-feature-intake` — executes a verdict, never forms one |

Two properties worth preserving when you choose:

- **`/spec` is the only member that runs more than one role**, and its ordering
  is the design: rejection costs one agent instead of four. Dispatching a role
  alone is fine when the scope verdict already exists. Dispatching `tech-lead`
  before any verdict throws that property away.
- **`/next` and `/triage` are complements, not alternatives.** `/next` looks
  forward at what to start; `/triage` looks backward at what was left
  unfinished. A question about both is two invocations, not one.

## What this table does not know

- **Project skills shadow stack skills of the same name.** If the consuming repo
  defines `<name>` locally, its version is what runs. This table names the stack
  skill; the project's may behave differently.
- **The project's own domain skills are not listed here at all** — eval
  harnesses, data-pipeline loops, product-specific review gates. They stay in
  the consuming repo by design. Read that repo's `## Skill routing` section
  before falling through to these rules.
- **Configuration failures are the skill's business, not the router's.** A skill
  that needs a `.agents/stack.yml` key and does not find it asks or refuses,
  naming the key. Route to it anyway; do not pre-check its config here.
