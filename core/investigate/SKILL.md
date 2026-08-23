---
name: investigate
version: 0.1.0
description: Debug a failure by finding its root cause before any fix: reproduce, gather evidence, write a hypothesis ledger with confidence, test the most falsifiable hypothesis first, then fix with a regression test that failed before it and passes after. Use when asked to "debug this", "fix this bug", "why is this broken", "investigate this error", or "root cause analysis". Proactively suggest when the user reports a stack trace, a 500, unexpected behavior, or "it was working yesterday". (kstack)
---

# investigate — root-cause debugging under the Iron Law

## When to invoke

Something is broken and nobody yet knows why. Invoke as `/investigate [what is
broken]` — use it in place of debugging directly whenever the user reports an
error, stack trace, wrong result, or "it was working yesterday". The point of
the skill is that it forbids the fix you would otherwise reach for first. Not
for: a change whose cause is already understood, reviewing code for latent bugs
(that is a review skill), or performance tuning with no failure.

## The Iron Law

**NO FIXES, PATCHES, OR WORKAROUNDS BEFORE ROOT-CAUSE INVESTIGATION COMPLETES.**

This is a **refusal gate**, not advice. Until Phase 4 confirms a hypothesis with
observed evidence, refuse to edit product code — including the "obvious" one-line
guard — and say which phase you are in instead. Fixing symptoms creates
whack-a-mole debugging: every fix that does not address the root cause makes the
next bug harder to find.

**Enforcement is prompt-level** — nothing in the harness blocks an edit here; the
optional scope lock below is the only mechanically enforced part, and only on a
host with PreToolUse hooks. Allowed before the gate opens, because they gather
evidence rather than dodge it: temporary instrumentation (a log line, assertion,
debug print) that you remove afterwards, a failing test that reproduces the bug,
and your own scratch files.

### Red flags — you are about to violate the Iron Law

If you catch yourself producing any of these sentences, stop and return to the
current phase:

- **"Quick fix for now."** There is no "for now." Fix it right or escalate.
- **Proposing a fix before tracing the data flow.** You are guessing.
- **Each fix reveals a new problem elsewhere.** Wrong layer, not wrong code.
- **"This should fix it."** Never say it. Verify and prove it, or say you cannot.
- **"I can't reproduce it, but this is probably it."** Never apply a fix you
  cannot verify.
- **"Let me just add a try/except and see."** A swallowed error is a deleted
  symptom, not a fixed cause.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: kstack
`CONVENTIONS.md` §2) before Phase 5:

- **`gates.test`** — the command that runs the fast suite. Every regression-test
  run in this skill is this command.
- **`gates.test_full`** — the full suite, run once before the report. Null → fall
  back to `gates.test` and say so.

**Missing `gates.test`, null, or no `.agents/stack.yml`:** do not guess a command
— ask the user which command runs the tests, naming `gates.test` as the key it
belongs under. Until you have one the fail-then-pass proof cannot be produced, so
the status is `DONE_WITH_CONCERNS` or `BLOCKED`, never `DONE`. A verification
that defaults open is not a verification.

## Phase 1 — Reproduce first

You cannot investigate a failure you cannot trigger.

1. Collect the symptom exactly as the user has it: error text, stack trace, the
   command or click that produces it, the environment it happened in.
2. Trigger it yourself. Record the exact command and its output.
3. **Deterministic?** Note whether it fails every time or intermittently.
   Intermittent means timing, ordering, or shared state — carry that into Phase 3.
4. **Cannot reproduce?** Do not proceed to a fix. Say so, then either gather more
   evidence (logs, environment diff, the user's exact steps) or add
   instrumentation and wait for the next occurrence. An unreproducible bug can
   only end at `BLOCKED` or `DONE_WITH_CONCERNS`. If the user has not given you
   enough, ask **one** question — the one that most unblocks reproduction.

## Phase 2 — Gather evidence

Still no fixes. Build the picture.

1. **Read the code path.** Trace from the symptom back toward possible causes.
   Grep for every reference; read the logic rather than assuming it.
2. **Check recent changes.**
   ```bash
   git log --oneline -20 -- <affected-files>
   ```
   Was this working before? What changed? A regression means the root cause is in
   the diff — read it before hypothesising anything else.
3. **Check the history of this area.** **Recurring bugs in the same files are an
   architectural smell, not a coincidence** — three prior fixes to one function
   means the ledger needs a structural candidate, not a fourth local one. Also
   read the repo's known-issues file (`TODOS.md` or equivalent) if it exists.
4. **Match against known patterns:**

| Pattern | Signature | Where to look |
|---------|-----------|---------------|
| Race condition | Intermittent, timing-dependent | Concurrent access to shared state |
| Nil/null propagation | NoMethodError, TypeError | Missing guards on optional values |
| State corruption | Inconsistent data, partial updates | Transactions, callbacks, hooks |
| Integration failure | Timeout, unexpected response | External API calls, service boundaries |
| Configuration drift | Works locally, fails in staging/prod | Env vars, feature flags, DB state |
| Stale cache | Shows old data, fixes on cache clear | Caches, CDN, browser, query client |

5. **External search, sanitized.** If it matches no pattern above, search
   "{framework} {generic error type}" or "{library} {component} known issues".
   **Sanitize first** — strip hostnames, IPs, file paths, SQL, and customer or
   proprietary data; search the error *category*, never the raw message. If the
   message cannot be sanitized safely, or web search is unavailable, skip it.

## Phase 3 — Write the hypothesis ledger

Write the ledger down before testing anything. It is a table in the transcript,
updated in place as hypotheses are tested — not a mental list.

```
HYPOTHESIS LEDGER
H1  <specific, testable claim about what is wrong and why>
    Predicts:   <the observation that must hold if H1 is true>
    Falsified by: <the single observation that would kill H1>
    Confidence: 6/10        Status: untested
H2  ...
```

- **At least two hypotheses.** One hypothesis is a belief, not an investigation.
- **Each must be falsifiable** — you can name the observation that would kill it.
  A claim nothing could disprove ("the state is inconsistent") is not a
  hypothesis; sharpen it until it names a mechanism.
- **Confidence is honest, 1–10.** Something you traced in the code is 8–9; an
  inference you have not checked is 4–5.
- **Test the most falsifiable hypothesis first** — literally: the one whose
  predicted observation differs most sharply from the others', so that a single
  run eliminates the most candidates. That is not the same as the one you most
  believe, and when they disagree, falsifiability wins.

## Scope lock (optional) — `/freeze` the implicated directory

Once the ledger names an implicated module, you may lock edits to it so the
eventual fix cannot sprawl into unrelated code. Read `core/freeze/SKILL.md` with
the Read tool and follow it, passing the narrowest directory containing the
affected files. If it is unreadable, say so and continue without the lock.

**Enforcement:** on Claude Code the lock is **hook-enforced** — a PreToolUse hook
blocks Edit and Write outside the frozen directory. On a host without PreToolUse
hooks it is **prompt-level** only; say which applies when you announce the lock.
Skip the lock, and say why, if the bug spans the repo or the scope is unclear.
Release it with `/unfreeze` (`core/unfreeze`) when the investigation ends.

## Phase 4 — Test hypotheses, do not fix them

For the top-ranked hypothesis:

1. **Instrument at the suspected cause** — a temporary log line, assertion, or
   debug output. Re-run the Phase 1 reproduction. Does the observed evidence
   match the prediction?
2. **Record the outcome in the ledger**: `confirmed` or `falsified`, with the
   line of output that decided it. A falsified hypothesis is progress — it
   removed a candidate. Say what it ruled out.
3. **If falsified**, do not reach for a fix and do not guess the next one. Return
   to Phase 2, gather evidence the failed test exposed, and re-rank the ledger.

**The 3-strike stop rule.** After **three** falsified hypotheses — or three
attempted fixes that did not hold — **stop**. Do not open a fourth. Write up:

- the symptom and the exact reproduction;
- each hypothesis, the test run, and what its output ruled out;
- what the pattern of failures suggests (repeated near-misses in one area point
  at the architecture, not at the code you keep editing).

Then escalate to the user with the write-up and these options: (A) continue —
here is a genuinely new hypothesis, stated; (B) escalate to someone who knows
this system; (C) add permanent instrumentation and catch it next time. Wait for
their answer. Three strikes is a hard stop, not a suggestion to try harder.

## Phase 5 — Fix

Only now. Only the confirmed root cause.

1. **Fix the cause, not the symptom.** The smallest change that eliminates the
   actual problem.
2. **Minimal diff.** Fewest files, fewest lines. Do not refactor adjacent code
   while you are here.
3. **Ship a regression test that fails before the fix and passes after — and show
   both runs.** The order is: write the test, run `<gates.test>` with the fix
   reverted or not yet applied, paste the **failing** output; apply the fix, run
   `<gates.test>` again, paste the **passing** output. A test that was never
   observed to fail proves nothing about the fix; it is a test of something else.
   If you cannot make it fail first, say so — that is a finding about the test,
   and the status is not `DONE`.

   > **Worked example (OGUR).** A frontend test for a sticky-state leak mounted
   > the component directly in each case. It passed identically with and without
   > the fix — a fresh mount cannot observe state left behind by a previous
   > route, so the assertion was vacuous. Mounting once and navigating made it
   > fail first, which is what made the later pass mean anything.

4. **Run the full suite** (`<gates.test_full>`, else `<gates.test>`) and paste
   the output. No regressions.
5. **Blast radius.** If the fix touches more than 5 files, stop and ask before
   proceeding: (A) proceed — the root cause genuinely spans them; (B) split — fix
   the critical path now, defer the rest; (C) rethink — a more targeted fix
   probably exists.
6. **Remove the temporary instrumentation** you added in Phase 4.

## Phase 6 — Fresh verification and report

**Fresh verification is not optional.** Re-run the Phase 1 reproduction **from
clean state** — new shell, rebuilt artifacts, cleared cache, fresh database or
fixture, whatever "clean" means for this failure — and confirm the original
symptom is gone. Re-running in the shell you have been debugging in does not
count; it carries the state your instrumentation left behind.

> **Worked example (OGUR).** An atomic-write fix verified green on a clean tree
> and shipped. The defect lived in the branch that only executes when the target
> file already exists, so the first run never reached it — idempotency bugs hide
> in the second run. Verify from clean state, then verify again immediately
> after, without cleaning.

Then output the report:

```
DEBUG REPORT
════════════════════════════════════════
Symptom:         [what the user observed]
Root cause:      [what was actually wrong, and why it produced that symptom]
Hypotheses:      [N tested — which were falsified and what each ruled out]
Fix:             [what changed, with file:line references]
Evidence:        [regression test failing before / passing after; full-suite output;
                  fresh reproduction attempt showing the symptom is gone]
Regression test: [file:line of the new test]
Related:         [prior bugs in the same area, known-issues entries, architectural notes]
Status:          DONE | DONE_WITH_CONCERNS | BLOCKED
════════════════════════════════════════
```

Status meanings: **DONE** — root cause found, fix applied, regression test shown
failing then passing, full suite green, fresh reproduction clean.
**DONE_WITH_CONCERNS** — fixed but not fully verifiable (intermittent, needs
staging, no test command configured); name exactly what is unverified.
**BLOCKED** — root cause not established; escalated with the 3-strike write-up.

If the scope lock is still active, release it (`/unfreeze`) and say so.

## Important rules

- **No fix before a confirmed root cause.** Prompt-level; hold it anyway.
- **Three falsified hypotheses or three failed fixes → stop and escalate.** Then
  question the architecture, not the next line of code.
- **Never apply a fix you cannot verify**, and never say "this should fix it."
- **A regression test never observed to fail is not evidence.**
- **Recurring bugs in the same files are an architectural smell** — report it in
  `Related:` even when this fix holds.
- **Fix touching >5 files → ask about blast radius** before proceeding.
