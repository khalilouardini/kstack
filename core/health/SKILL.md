---
name: health
version: 0.1.0
description: Read-only code-quality dashboard — runs the consuming repo's own gates from .agents/stack.yml, scores each check 0-10 from real exit codes and real output, and reports a weighted composite plus the trend versus the previous run. Never edits, never fixes. Use when asked to "health check", "code quality", "how healthy is this codebase", "run all the checks", "quality score", or "/health". (kstack)
---

# health — run the project's own gates, score them, track the trend

## When to invoke

Someone wants a single number and a per-check breakdown for the current state of
the repo: "how healthy is this codebase", "run all the checks", "quality score".
Invoke as `/health` (fast suite) or `/health --full` (full suite, when
`gates.test_full` is declared).

Not for fixing anything — this skill reports and stops. Not for gating a push
either; that is `core/land`, which runs the same commands as a blocking gate
rather than as a score.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: kstack
`CONVENTIONS.md` §2) before running anything.

- **`project`** — the slug that names the history file. Missing or null →
  **refuse**, naming `project`. Do not guess from the directory name; a guessed
  slug silently forks the trend history into a second file.
- **`gates.lint`** — missing or null → **refuse**, naming `gates.lint`.
- **`gates.test`** (and **`gates.test_full`** for `--full`) — missing or null →
  **refuse**, naming the exact key.

The refusal on a missing gate is not pedantry. The composite normalizes over the
checks that actually ran (see "Composite"), so a repo that declares no lint check
scores **identically** to a repo whose lint check is clean. A dashboard that
cannot tell those two apart is worse than no dashboard.

Missing `.agents/stack.yml` altogether → refuse and name the file.

### Which commands become checks

Every non-null key under `gates:` is a check. Named keys carry the documented
weight below; any other key the project declares (`typecheck`, `build`, or
anything else) is run too.

| Check | stack.yml key | Weight |
|---|---|---|
| tests | `gates.test` — or `gates.test_full` when invoked with `--full` | 45 |
| lint | `gates.lint` | 30 |
| typecheck | `gates.typecheck` | 15 |
| build | `gates.build` | 10 |
| any other key under `gates:` | that key, by its own name | 10 each |

`gates.test` and `gates.test_full` are the **same** check under two commands —
never run both in one invocation and never score them as two checks. Record which
one ran; the trend comparison depends on it.

## Step 1 — capture the run context and the previous history line

```bash
KSTACK_STATE="${KSTACK_STATE:-$HOME/.kstack}"
HIST="$KSTACK_STATE/projects/<project>/health.jsonl"
mkdir -p "$(dirname "$HIST")"
git branch --show-current
git rev-parse --short HEAD
git status --porcelain | wc -l          # dirty-tree count, recorded in the report
tail -1 "$HIST" 2>/dev/null || echo "NO_HISTORY"
```

**Read the previous line before appending, not after.** Appending first and then
reading `tail -1` compares the run against itself and reports a flat trend every
time. If you have already appended, read `tail -2 | head -1` instead.

Record the dirty-tree count. A composite measured on a dirty tree describes
uncommitted work in progress, not the committed state, and the report must say
so.

## Step 2 — run each check

Run checks **sequentially** from the repo root. Concurrent runs contend for lock
files, build caches, and test databases, and the failure looks like a real defect.

```bash
OUT=$(mktemp)
START=$(date +%s)
<the command from stack.yml> >"$OUT" 2>&1
EXIT=$?
END=$(date +%s)
echo "EXIT:$EXIT DURATION:$((END-START))s"
tail -50 "$OUT"
```

**Capture the exit code from the command itself, never through a pipe.**
`<cmd> 2>&1 | tail -50` followed by `$?` yields `tail`'s status, which is `0`
whatever the command did — every check would score 10. Redirect to a file, read
`$?`, then tail the file.

If a command is not found or its runtime is absent, record the check as
**SKIPPED** with the reason. Skipped is not failed: it drops out of the composite
entirely (see below) rather than scoring 0.

**Read-only toward the repo.** Before running a command, check it for a
fixing flag — `--fix`, `--write`, `-w`, `--apply`, an in-place formatter. If a
declared gate carries one, do **not** run it: report the key and the flag and
score that check SKIPPED. A `gates.build` command legitimately writes build
artifacts; that is the project's own command, not this skill editing source.
After a build check, re-run `git status --porcelain` and report any **tracked**
file it modified.

This read-only guarantee is **prompt-level** — the skill holds Bash and nothing
in the harness blocks a fixing command. It is a rule the procedure follows, not
a capability that is absent.

## Step 3 — score each check 0-10

Two rubrics. Pick by what the output actually contains, not by the check's name.

**Test-shaped** — the output yields passed/failed/total counts:

| Result | Score |
|---|---|
| exit 0 | 10 |
| pass rate > 95% | 7 |
| pass rate > 80% | 4 |
| pass rate ≤ 80% | 0 |
| exit non-zero, no counts parse (collection error, import failure, crash) | 0, labelled **ERRORED** |

Label the ERRORED case distinctly. "The suite failed" and "the suite never ran"
are different problems with different fixes, and collapsing them into one score
hides which one you have.

**Diagnostic-shaped** — the output is a list of findings (lint, typecheck, build):

| Result | Score |
|---|---|
| exit 0 | 10 |
| 1-4 findings | 7 |
| 5-19 findings | 4 |
| ≥ 20 findings, or non-zero exit with no parsable count | 0 |

**Parsing counts, without knowing the tool:**

- Take the runner's **own summary line**, and take the **last** one in the
  output — earlier matches are usually per-file or per-suite subtotals. Typical
  shapes: `N passed, M failed`, `Tests: N passed, M total`, `ok N`,
  `FAILED (failures=M)`, `Found N errors`.
- With no summary line, count **distinct findings**, not output lines: one
  finding commonly spans a location line, a source excerpt, and a caret. Count
  lines carrying a `path:line[:col]` prefix, deduplicated.
- Never infer a count from the byte size or line count of the output.

Record per check: the key, the command, exit code, score, weight, duration, and
a one-phrase detail (`312/312 passed`, `3 warnings`, `command not found`).

## Step 4 — composite

```
composite = Σ(weight_i × score_i) / Σ(weight_i)     over checks that actually ran
```

Rounded to one decimal. Skipped checks leave both sums — which is exactly the
proportional redistribution of their weight across the checks that ran, with no
separate step. This is also why Step 0 refuses on a missing `gates.lint` or
`gates.test`: normalization makes an absent check invisible.

Status label per check and for the composite: `10` → CLEAN, `7-9` → WARNING,
`4-6` → NEEDS WORK, `0-3` → CRITICAL.

## Step 5 — present the dashboard

```
HEALTH — <project>
branch <branch> @ <short-sha>   tree: clean | 4 uncommitted files
suite: gates.test (fast)

Check       Key              Score  Status      Time   Detail
---------   --------------   -----  ---------   ----   ---------------------
tests       gates.test       10/10  CLEAN        41s   312/312 passed
lint        gates.lint        7/10  WARNING       6s   3 warnings
typecheck   gates.typecheck  10/10  CLEAN        11s   0 errors
build       gates.build         —   SKIPPED       —    not declared

COMPOSITE 9.1 / 10          total 58s
```

**Show raw output for every check that scored below 10** — the last 50 lines
captured in Step 2, verbatim, under the check's name. The point is that the
reader can act without re-running anything:

```
tests · gates.test · exit 1
    FAILED tests/api/test_session.py::test_expired_cookie_redirects
    FAILED tests/api/test_session.py::test_malformed_token_rejected
    2 failed, 310 passed in 41.02s
```

Never paraphrase a tool's output into your own diagnosis. Quote what it said.

## Step 6 — append one history line

```bash
KSTACK_STATE="${KSTACK_STATE:-$HOME/.kstack}"
HIST="$KSTACK_STATE/projects/<project>/health.jsonl"
mkdir -p "$(dirname "$HIST")"
printf '%s\n' '<the JSON object below, one line>' >> "$HIST"
```

One line per run, appended, never rewritten:

```json
{"ts":"2026-08-21T14:30:00Z","project":"<slug>","branch":"<branch>","head":"<short-sha>","tree_dirty":0,"tests_key":"gates.test","composite":9.1,"duration_s":58,"checks":{"tests":{"key":"gates.test","exit":0,"score":10,"weight":45,"detail":"312/312 passed","duration_s":41},"lint":{"key":"gates.lint","exit":1,"score":7,"weight":30,"detail":"3 warnings","duration_s":6},"typecheck":{"key":"gates.typecheck","exit":0,"score":10,"weight":15,"detail":"0 errors","duration_s":11}}}
```

- `ts` — ISO 8601 UTC.
- `composite` — one decimal.
- `tests_key` — literally `gates.test` or `gates.test_full`. Load-bearing for
  the trend.
- `checks` — one entry per check that **ran**. A SKIPPED check is omitted, not
  written as null; its absence is what removes its weight.

State lives under `${KSTACK_STATE:-$HOME/.kstack}`, never inside the consuming
repo. This skill writes exactly one file, and it is not in the repo.

## Step 7 — trend and recommendations

Compare against the previous line captured in Step 1 — but only when it is
**comparable**: same `project` and same `tests_key`.

- Different `tests_key` → report `no comparable prior run (last run used
  gates.test_full)`. A fast-suite composite and a full-suite composite are
  different measurements; differencing them manufactures a trend.
- Different `branch` → still compare, and **say which branches**. A drop across
  a branch switch is a property of the branch, not a regression over time.
- No history at all → `First health check — no trend data yet. Run /health again
  after changes to track movement.`

```
TREND  9.1 → 8.4  (−0.7)  vs 2026-08-19  main → feat/session-expiry
  lint       7 → 4   12 new warnings
  tests     10 → 10
```

For every check that declined, name the delta and quote the specific new output
that explains it. A composite that moved without a named cause is not a finding.

**Recommendations**, ranked by `weight × (10 − score)` descending, listing only
checks below 10. One line each: the check, its score and weight, and the exact
command to see the detail — the project's own command, not one you invented.

```
1. [HIGH] lint 4/10, weight 30 — 12 warnings.  Run: <gates.lint>
2. [MED]  tests 7/10, weight 45 — 2 failures.  Run: <gates.test>
```

## Safety invariants

All **prompt-level** — the skill holds Bash; nothing in the harness enforces
these. Stated as rules the procedure follows.

1. **Never fix, never edit, never commit.** Report and stop. The user decides
   what to act on.
2. **Run the project's own commands, unmodified.** Never substitute your own
   analysis for what the tool reported, and never re-run a check with different
   flags to get a nicer number.
3. **Refuse on a missing gate key, naming it.** Never fall back to a guessed
   command, and never score a subset as if it were the whole.
4. **Skipped is not failed.** An absent tool drops out of the composite; it does
   not score 0.
5. **Exit codes come from the command, not from a pipe.**
6. **Be honest about the number.** A repo with a clean lint run and a broken test
   suite is not healthy. If the composite reads better than the checks do, say so
   in the report rather than letting the number stand alone.
