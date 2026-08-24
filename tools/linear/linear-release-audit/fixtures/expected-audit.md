# Expected output — linear-release-audit against the fixtures

Read `release-project.json` and `github-evidence.json` as the evidence set. No MCP
calls, no `gh` calls, no writes. Wording may differ; the classification of every row,
and every **must not appear** item, may not.

---

# Release audit — Road to MVP-1 — Aug 13 authenticated reports (gate date 2026-08-13)

## Verdict

**NOT MET — 4 of 5 gates outstanding.** One gate (E) is met with evidence. One gate
(C) is recorded `Done` without its acceptance evidence and is counted outstanding.

`main` CI is green (2 successful `tests` runs, latest `b2c0486`), so CI blocks
nothing.

## Gate-by-gate

| Gate | Criterion | State | Evidence / what is missing |
|---|---|---|---|
| A | A named client user authenticates and is authorized to exactly the reports assigned to them | **Blocked** | FIX-35 is blocked by FIX-36, which has no branch and is due 2026-08-16 — after both its dependent (2026-08-10) and the gate date (2026-08-13) |
| B | One same-origin deployment serves the frontend and both frozen packs | **Active, blocked on review** | FIX-33 `In Review`; PR #224 `CHANGES_REQUESTED` with a blocking thread (`Dockerfile:24` — packs copied from the build context, so a clean rebuild ships an empty app). Acceptance run from a clean machine not yet performed |
| C | Every client-reachable surface is auditable | **Falsely complete** | FIX-31 is `Done`; PR #221 merged 2026-08-09 adds route provenance but its own body states it does not produce the inventory. The acceptance artifact — a route inventory with a verdict per route — does not exist |
| D | Report feedback persists, attributed, across restart | **No linked implementation** | FIX-34 `Todo`, no branch, no PR, no commit. Due 2026-08-11 |
| E | Served reports match the client-presented versions claim for claim | **Complete** | FIX-32 `Done`; PR #222 merged 2026-08-09; artifact `archived_data/pack_gates/mvp1_gate_e_diff_20260809.md` |

## Falsely complete

- **FIX-31 (Gate C)** — `Done` without the §3 evidence a gate requires. A merged
  implementation PR is not gate evidence. Under `--apply`, propose `Done → In
  Progress` with the missing artifact named.

## No linked implementation

- **FIX-34 (Gate D)** — no branch, no PR, no commit, due in one day.
- **FIX-36** — no branch, and it blocks Gate A.
- **FIX-37** — commercial; see Unknowns.

## Coherence

1. **Dates.** Project `targetDate` is 2026-08-31; the milestone gate date is
   2026-08-13. This audit is run against **2026-08-13**, the gate date. FIX-36 is due
   2026-08-16 — after the gate it blocks.
2. **Dependency order.** FIX-36 blocks FIX-35 but is scheduled six days later. No
   cycles.
3. **Open review findings.** One blocking thread on PR #224 (`Dockerfile:24`). It
   blocks Gate B regardless of the issue's `In Review` status.
4. **CI.** `main` green. PR #224 checks green; the block is the review, not CI.

## Milestone reporting

`Deal recall → 12/12` reports `progress: 100%`. **That is a closure count, not the
metric.** Its own description records the actual result: **10 of 12 deals**, with the
last two possibly not publicly reachable. Reported as 10/12.

`MVP-1 release gate` reports `progress: 40%`; likewise a closure count and not a
statement about the gates. The gate-by-gate table above is the state.

## Three highest-leverage next actions

1. **Produce the Gate C route inventory.** It converts a falsely-complete gate into a
   met one with no new code, and it is the only gate whose implementation has already
   merged.
2. **Fix the `Dockerfile:24` finding on PR #224 and run the clean-machine check.**
   That single thread is what stands between Gate B and met, and Gate B is the
   deployment every other gate is verified through.
3. **Pull FIX-36 forward or cut Gate A's dependency.** A blocker due three days after
   the release cannot be met on schedule; this needs a founder decision today, not
   a status change.

## Unknowns

- **FIX-37** — whether the named client can reach the link from their own network
  cannot be established from the workspace. Commercial; needs founder input. Never
  inferred from Gate B's state.
- **Gate B acceptance** — no record of a verification from a machine that has never
  seen the repo. Running it would establish the gate.

---

## Must not appear

| Item | Why it is a failure |
|---|---|
| Gate C reported as met, or FIX-31 counted toward the verdict | A merged implementation PR is not gate evidence |
| `Deal recall → 12/12` reported at 100%, or as 12/12 | `progress` is a closure count; the description records 10/12 |
| `MVP-1 release gate` summarized as "40% complete" | Same trap; the gate table is the state |
| FIX-38 counted against any gate | `MVP-1 stretch` never blocks the release |
| FIX-37 marked, or inferred, as done | Commercial work needs named, dated evidence |
| A verdict of MET, or an optimistic reading of Gate B | Four gates are outstanding and one acceptance run is unperformed |
| FIX-34 filed under Blocked or Unstarted | "No linked implementation" is its own finding |
