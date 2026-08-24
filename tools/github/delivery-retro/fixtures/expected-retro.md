# Expected output — github-delivery-retro against the two period fixtures

Read `period-current.json` and `period-previous.json` as the gathered evidence. No
`gh` calls, no MCP calls, no writes.

**The assertion this dry run exists to make:** the current window merged **7** PRs
against the previous window's **3**, and must still come out **Low-delivery**. A
retro that reports the current week as an improvement has failed, whatever else it
gets right. Arithmetic within ±10% of the figures below is acceptable; the verdict,
the bottleneck, and the direction of every arrow are not.

---

# Engineering delivery retro — 2026-07-27 → 2026-08-03 (vs 2026-07-20 → 2026-07-27)

Windows, half-open and UTC: `[2026-07-27T00:00:00Z, 2026-08-03T00:00:00Z)` against
`[2026-07-20T00:00:00Z, 2026-07-27T00:00:00Z)`. PR **#219** merged at exactly
`2026-08-03T00:00:00Z` and is therefore **excluded** — it belongs to the next window.
Scope source: **caller-supplied** — `MVP-1 release gate`, taken from the fixture's
`active_milestone`. These windows predate the first `mvp-scope.md` commit
(2026-08-07), so the git-pinned lookup at `to` finds nothing; a live run over these
dates **without** `--milestone` is `Unscoped`, not `Low-delivery`. The verdict below
holds *because* the milestone was supplied.

## Verdict

**Low-delivery.** Zero release-gate outcomes completed with evidence, and 2 of 7
merged PRs served the active milestone (29%). Merge count more than doubled.

## Delivered

- **Release-gate outcomes: none.** `OGUR-59` (Gate B) was closed inside the window,
  but on the merge of #208 alone — it carries no acceptance artifact, so the gate is
  not met and does not count. It is a **falsely complete** row, and the same finding
  `linear-release-audit` would raise.
- **User-visible capabilities: none.** Nothing a client could not do on 07-27 became
  possible by 08-03.
- Merged, serving the active milestone: **#207** (Polygon brief on a document layer,
  Gate E) and **#208** (multi-pack serving, Gate B implementation).
- Merged, serving no active milestone: **#209**, **#210** (both corrective),
  **#212** (research archive), **#216** (landing page), **#218** (dependency bump).

The gap between "7 merged" and "0 capabilities delivered" is the report.

## Delta versus previous period

| Metric | This period | Previous | |
|---|---|---|---|
| Merged PRs | 7 | 3 | ↑ (an input, not a result) |
| Release-gate outcomes completed | 0 | 1 (`OGUR-36`, artifact committed) | ↓ **the headline** |
| User-visible capabilities | 0 | 1 | ↓ |
| Merged work serving active milestone | 29% (2/7) | 100% (3/3) | ↓ |
| PR cycle time, median | 49h | 43h | ↓ |
| PR cycle time, p75 | 68h | 45h | ↓ |
| Time to first review, median | 31h | 5h | ↓ **6×** |
| Merged with no review at all | 5 of 7 | 0 of 3 | ↓ |
| Approval → merge, median | 13h | 3h | ↓ |
| Open PRs at window end | 29 (median age 27d, 12 over 30d) | 24 (21d, 9 over 30d) | ↓ |
| Started ÷ finished | 1.57 (11 opened / 7 merged) | 1.00 (3/3) | ↓ |
| Worktrees | 17 | unavailable (current snapshot only) | — |
| CI green at merge | 71% (5/7 merges) | 100% (3/3 merges) | ↓ |
| Merged before checks completed | 1 (#216) | 0 | ↓ |
| Merges with red CI at merge | 1 (#210) | 0 | ↓ |
| Review rounds before merge, median | 0 | 1 | ↓ |
| Corrective / revert PRs | 2 (#209, #210) | 0 | ↓ |
| Reviews performed | 2 | 4 | ↓ |
| Findings that changed code ÷ findings raised | 1/4 (25%) | 6/10 (60%) | ↓ |
| Review threads resolved ÷ opened | 3/4 | 10/10 | ↓ |
| Comment resolution, median | unavailable | unavailable | — (no `resolvedAt` in the API) |
| Defects caught before merge ÷ after | 1 / 2 | 6 / 0 | ↓ **inverted** |

## Flow bottleneck

**Time to first review — 31h median, up from 5h.** It is roughly 63% of the 49h
median cycle time, the largest single stage. It is also structural rather than
incidental: 5 of 7 PRs merged with no review at all, so the 31h is measured on the
two PRs that were reviewed, and the true figure for the window is unmeasurable.

## Quality signal

Review stopped, and rework started in the same window. Those are the same fact.

- **2 corrective PRs.** #209 restores seed sources dropped by #199 — merged in the
  *previous* window with 3 blocking findings raised and resolved. #210 then fixes
  #209 within 72h, and merged with **red CI**. Neither served a milestone; both
  consumed the window.
- **#216 merged before any check completed.** Its two checks finished 4 and 6 minutes
  *after* the merge, so at the moment it landed there was no evidence at all. It is
  not a green merge and not a red one — it is an unverified one, and with #210's red
  merge that is 2 of 7 merges landing without passing checks.
- **Defect capture inverted**: 1 caught before merge, 2 after. Last window: 6 before,
  0 after. Review was paying for itself and is no longer running.
- Review rounds median 0. That is not a clean week; it is an unchecked one.

## Scope discipline

29% of merged work served the active milestone, against 100% the previous window.
Three of the five unaligned merges (#212 research archive, #216 landing page, #218
dependency bump) were started inside the release window. Started-vs-finished rose to
1.57 and the open queue grew 24 → 29, with the over-30-day count going 9 → 12.

Stated without judgement: a landing page and a competitor teardown may have been the
right calls this week. They were not, however, release work, and the release date did
not move to accommodate them.

## One experiment for next period

**No PR touching `ogur/` merges without one review.** Metric it should move:
corrective PRs, currently 2, target 0. Secondary: defects caught before merge, back
above 1:1. One rule, one window, one number — if corrective PRs are still non-zero on
2026-08-10, the rule was not the cause and it gets dropped rather than tightened.

---

## Must not appear

| Item | Why it is a failure |
|---|---|
| A verdict of Fruitful or Mixed | Zero gate outcomes and 29% milestone share is Low-delivery by the §7 rule |
| "7 PRs merged, up from 3" presented as improvement | Merge count is an input; it is the trap this fixture is built around |
| A single productivity score, or any number framed as effort or hours | §8 |
| `OGUR-59` counted as a completed gate | Closed on PR evidence with no acceptance artifact |
| Any metric without its previous-period figure | The delta is the unit of meaning |
| Commit counts or line counts anywhere | §"What this skill refuses to measure" |
| More than one experiment | Three experiments is a plan, and plans do not get run |
| CI green at merge computed as `33/41` or `21/22` | Those are default-branch workflow runs, most belonging to no merge. §4 denominator is merges: 5/7 green and 3/3 |
| Any number in the previous-window worktree cell | The fixture omits it because a live `git worktree list` cannot recover it — a number there is fabricated |
| 8 merged PRs, or #219 anywhere in the merged list | #219 merged at exactly the exclusive `to`; `[from, to)` puts it in the next window. Counting it also breaks milestone share (2/8) and the CI buckets (6/8 green) |
| A duration for comment resolution | GitHub exposes no `resolvedAt`; §6 makes this permanently `unavailable`. A number here was invented |
| `#216` counted as green at merge, or CI green reported as 6/7 | Its checks completed 4–6 min after `mergedAt`; §4 filters to `completedAt ≤ mergedAt`, making it `merged before checks completed` |
| The merged-before-checks bucket folded into green or omitted | It is a distinct quality signal — checks were not waited for |
| Today's milestone applied to this 2026-07 window | Scope is read as of `to`; a live run with no pinned scope and no `--milestone` is `Unscoped` |
