# Expected output — linear-feature-intake against the verdict fixtures

Seven dry runs, each reading one verdict artifact plus `existing-issues.json` as the
§2 search result set. No MCP calls, no writes. A run that proposes a write not listed
here is a false positive and blocks live use.

Across the seven fixtures, **`/spec` is invoked zero times** and the total number of
**execution tickets** proposed is **two** — one from `BACKLOG`, one meta issue from
the persistence-only `SPEC` run. Those two totals are the headline assertions.

---

## `verdict-stop.yaml` — disposition STOP

The §2 search finds **FIX-24**, an existing decision record for the same proposal.

```
Created:   (none)
Updated:   (none)
Related:   (none)
Unchanged: FIX-24  Decision recorded — conversational Ask is outside MVP-1 and MVP-2
                   The decision is already recorded, including the same reversal condition.
```

Must not appear: any issue in `Road to MVP-1`, any `Backlog` "lite version", any
spike, any research issue. `OUT` produces no execution ticket in any disguise.

---

## `verdict-evidence.yaml` — disposition EVIDENCE

The §2 search finds **FIX-23** (`Recruit post-MVP-1 report testers`) as *overlapping*
— it is the recruiting channel, not the question — so it becomes a relation, not a
stop.

```
Created:   NEW-1  "Do report readers need a deck to circulate the report internally?"
                  status Backlog · label Commercial · project GTM & Customer Discovery
                  Description carries the verdict block, and both flip conditions:
                    → IN  if a named tester says they cannot circulate without a deck
                    → OUT if testers circulate the link itself
Related:   NEW-1  related to FIX-23   (that issue supplies the testers who answer this)
Unchanged: FIX-23
```

Must not appear: an issue titled "PowerPoint export" or any implementation issue.
The title is the question; the feature does not exist yet.

---

## `verdict-backlog.yaml` — disposition BACKLOG

The §2 search finds **FIX-25** as *overlapping* — same MVP-2 gate, different work
(Gate C reproducibility vs Gate B similarity).

```
Created:   NEW-2  "Rebuild the GNS561 corpus from a committed generator command"
                  status Backlog · label Tech · project Road to MVP-2 — Aug 31 reproducible reports
                  Description carries the verdict block and the §3.5 Gate C citation.
Related:   NEW-2  related to FIX-25
Unchanged: FIX-25
```

Must not appear: implementation children, a `/spec` run, a `Todo` status, an invented
due date. A future milestone gets one row and no plan.

---

## `verdict-spec.yaml` — disposition SPEC, blocked by a duplicate

The §2 search finds **FIX-21**, whose description already carries the same acceptance
criterion (403 on a cross-tenant read). Equivalent, not overlapping.

```
Created:   (none)
Updated:   FIX-21  description: += the Genfit 2026-08-04 user evidence from the verdict block
Related:   (none)
Unchanged: FIX-20, FIX-22
```

**`/spec` must not run.** The stop happens in §2, before the expensive path. A run
that produces a meta issue plus children here has failed the dry run outright — the
work already has a ticket, and a second one would make the release gate unanswerable.

---

## `verdict-spec-persist.yaml` + `--spec spec-persist.md` — persistence only

The §2 search finds **nothing equivalent** — this proposal is deliberately absent
from `existing-issues.json`. Nothing stops the run before the `SPEC` branch, so this
is the fixture that actually exercises it.

```
Created:   NEW-3  "Daily feedback-volume snapshot"
                  status Todo · project Road to MVP-1 — Aug 13 authenticated reports
                  Description carries the verdict block, the §8 scope citation, and the
                  two acceptance criteria read from spec-persist.md.
Children:  (none — one mergeable PR, so no children per §3)
Related:   (none)
Unchanged: FIX-20, FIX-21, FIX-22, FIX-23, FIX-24, FIX-25
```

**`/spec` must be invoked zero times.** The spec was supplied; regenerating it is the
recursion this fixture exists to catch. Two ways to fail:

- `/spec` runs → the loop is live. The acceptance criteria above would be *rewritten*
  rather than quoted, which is the visible symptom.
- The run hard-stops because `--spec` is unrecognised → the caller in `/spec` and this
  contract have diverged.

The criteria in the created issue must match `spec-persist.md` verbatim. Paraphrase is
evidence the artifact was regenerated, not read.

---

## `verdict-missing-citation.yaml` — malformed

```
HARD STOP — verdict artifact is missing `scope_citation`.
Proposed writes: 0.
Remedy: re-run product-manager; a verdict that cites no contract line is not a verdict.
```

---

## `verdict-contradictory.yaml` — malformed

```
HARD STOP — `verdict: OUT` is paired with `disposition: SPEC`.
Valid pairings: OUT→STOP, NEEDS-EVIDENCE→EVIDENCE, future milestone→BACKLOG, active milestone→SPEC.
Proposed writes: 0.
Remedy: re-run product-manager. Do not execute either half.
```

Executing the `SPEC` half because it is "more specific", or the `OUT` half because it
is "safer", both fail. A malformed gate output is not a decision.

---

## Mutation-safety assertions

| Assertion | Where it is tested |
|---|---|
| An `OUT` verdict never yields an execution ticket | `verdict-stop.yaml` |
| An existing equivalent issue stops the run before `/spec` | `verdict-spec.yaml` |
| A supplied `--spec` artifact is read, never regenerated | `verdict-spec-persist.yaml` |
| `/spec` is invoked zero times across the whole dry run | all seven |
| A malformed verdict yields zero writes | the two malformed fixtures |
| Cross-project relevance is a relation, never a second issue | `verdict-evidence.yaml`, `verdict-backlog.yaml` |
| A future milestone yields one row and no children | `verdict-backlog.yaml` |
| No independent scope assessment appears in any output | all seven |
