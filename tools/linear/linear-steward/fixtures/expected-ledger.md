# Expected output — linear-steward audit against `workspace.json`

The dry run reads `workspace.json` as its inventory (no MCP calls, no `gh` calls) and
must produce this ledger. Row order may differ; row content may not. A row present
here and absent from a run is a **miss**; a row present in a run and absent here is a
**false positive** and must be explained before the skill is used with `apply`.

Staleness is measured against `as_of` = 2026-08-10.

## Ledger

| # | Issue | Field | From | To | Evidence | Reversible |
|---|---|---|---|---|---|---|
| 1 | FIX-02 | status | Todo | Done | PR #219 merged 2026-08-08, branch `fix/api-packaging` matches `gitBranchName` | yes |
| 2 | FIX-04 | project | (none) | Road to MVP-1 — Aug 13 authenticated reports | The MVP-1 gate is not met without it; hosting is the means, not the outcome | yes |
| 3 | FIX-04 | labels | Tech | Tech, infra | Cross-project relevance to `Deploy & Hosting` expressed as a capability label, not a second issue | yes |
| 4 | FIX-04 | status | In Progress | In Review | PR #224 is open, non-draft, and branch `feat/single-container` matches `gitBranchName` | yes |
| 5 | FIX-01 | status | In Progress | Todo | Started status with no branch, PR, or commit; `updatedAt` 2026-07-27 is 14 days stale and `dueDate` 2026-08-02 has passed | yes |
| 6 | FIX-09 | status | Todo | Duplicate | Restates FIX-08, which carries the acceptance criterion and the branch `feat/report-authz` | yes |
| 7 | FIX-09 | relation | (none) | duplicate of FIX-08 | Same work; FIX-08 is the survivor | yes |
| 8 | FIX-05 | status | Backlog | Duplicate | Superseded by FIX-06: "Scope web app deployment" → "MVP-1 Gate B — Deploy one same-origin app serving both frozen reports" | yes |
| 9 | FIX-05 | relation | (none) | duplicate of FIX-06 | The concrete gate issue replaces the broad scoping issue | yes |
| 10 | FIX-10 | description | (empty) | + "Done when: …" draft line | No statable completion condition; unroutable by `product-manager` and uncheckable by `linear-release-audit` | yes |

## Required non-rows

These must **not** appear. Each is a specific failure the skill exists to prevent.

| Issue | Must not be proposed | Why |
|---|---|---|
| FIX-03 | `status → Done` | It is a release gate. PR #221 merged is implementation evidence, not gate evidence — the acceptance artifact is an inventory naming each client-reachable route and its verdict, and it has not been produced. Correct output: a note under **Unknowns**, and no status row. |
| FIX-01 | `status → Canceled` | An unstarted issue is not a rejected one. |
| FIX-07 | any status change | Commercial work; real-world state cannot be inferred. Correct output: `UNKNOWN — needs founder input`. |
| FIX-11 | any change | Completed work is preserved. Its missing project is not a defect worth rewriting history for. |
| FIX-04 | a second issue in `Deploy & Hosting` | Cross-project relevance is a label or a relation, never a duplicate row. |
| FIX-10 | `status → Canceled` | Vagueness is a description defect, not a scope verdict. |

## Unknowns

1. **FIX-03** — PR #221 merged on `feat/audit-surfaces`, but the gate's acceptance
   artifact (the route inventory) has not been produced. Gate state is
   **not established**. Producing the inventory would establish it.
2. **FIX-07** — no dated record of an ICP conversation exists in the workspace.
   Needs founder input.
3. **FIX-10** — unprojected *and* vague. No project is proposed: until "Done when"
   is answered, which outcome it blocks is unknowable. Row 10 has to land first.
   FIX-11 is also unprojected and is skipped as completed work.

## Next actions

1. Produce the FIX-03 route inventory — it is the only outstanding evidence between
   two merged PRs and a met gate.
2. Approve rows 1–10 and re-run with `apply`.
3. Answer the FIX-07 question so the GTM row stops being unauditable.

## Focused reconcile-finished output

`/linear-steward reconcile-finished` runs only Phase 1 and Phase 2.3. Against this
fixture its entire ledger is:

| # | Issue | Field | From | To | Evidence | Reversible |
|---|---|---|---|---|---|---|
| 1 | FIX-02 | status | Todo | Done | PR #219 merged 2026-08-08, branch `fix/api-packaging` matches `gitBranchName` | yes |
| 2 | FIX-04 | status | In Progress | In Review | PR #224 is open, non-draft, and branch `feat/single-container` matches `gitBranchName` | yes |

Required Unknown: FIX-03 has merged implementation PR #221, but it is a release
gate and its route-inventory acceptance artifact is absent. It must not receive a
status row. No other fixture issue appears in the focused ledger. The focused and
full audits deliberately share this status verdict: identical GitHub evidence must
not produce different state proposals merely because the invocation is narrower.
