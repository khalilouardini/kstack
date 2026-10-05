# Offline behavioral validation

Replay these cases against `SKILL.md` using only the frozen facts below. Do not
query Linear/GitHub, create worktrees, or mutate tracker state. Judge the selected
IDs and stated refusal/sequencing reasons, not wording or headings. The skill is
an agent procedure; these are behavioral cases, not executable API tests.

## Frozen facts

Team `T` owns projects `P1` (Road to MVP-2), `P2` (MVP-2 stretch), and `P3`
(MVP 2.3). Project `PX` belongs only to team `X`. All lookup and issue pages are
complete unless a case says otherwise. The scope contract assigns tracker
milestones `P1/Q1` and `P2/Q2` to release `R2`, and `P3/Q3` to later release
`R23`. `R2` is unreleased and overdue; `R23` is ratified for later work. The
explicit scope lines below are binding. Every issue has team T and no blocker,
foundation, open child, or active work unless specified. File scopes are concrete.

| ID | Project/milestone | Authorized scope line | Files | Rank within tier |
|---|---|---|---|---|
| A | P1/Q1 | R2 §2.a | src/shared.py | 1 |
| B | P2/Q2 | R2 §2.b | src/shared.py | 2 |
| C | P3/Q3 | R23 §3.c | src/c.py | 1 |
| D | P1/Q1 | R2 §2.d | src/d.py | 3 |
| E | P3/Q3 | R23 §3.e | src/e.py | 2 |
| F | P2/Q2 | R2 §2.f | src/f.py | 4 |
| G | P1/Q1 | none (OUT) | src/g.py | highest tracker priority |

## Cases and expected decisions

1. **Combined pool:** the three named filters with `--parallel 5` → A,C,D,E,F.
   B is sequenced for sharing `src/shared.py` with A; G is excluded by scope.
   There is one five-track batch, all ten pairs checked, no project quotas. Every
   track reports project and milestone separately and cites its own scope line.
2. **Duplicate filters:** supply `--project "Road to MVP-2" --project P1`
   with `--parallel 5` → A,D once each; P1 and issue IDs are deduplicated.
3. **Failing resolution:** missing name, two exact-name matches with distinct IDs,
   empty value, or bare `--project` → refusal, never workspace-wide selection.
   `--project PX` → team-membership refusal.
4. **Leaked or partial rows:** P1-only query returns C, a null-project issue, a
   team-X issue, or `hasNextPage=true` without the next page → fail closed.
   `related` and `duplicate` edges alone must not block otherwise runnable tracks.
5. **External blocker:** A has an open blocking inverse relation to Z in PX →
   fetch Z as dependency evidence, exclude A, select B,C,D,E,F. Do not recommend
   Z because it is outside the requested project/team boundaries.
6. **Pairs beyond track 1:** change E's file to `src/c.py` → A,C,D,F only;
   E is sequenced against C, even though both are independent of A.
7. **Unmerged foundation:** C requires code on open foundation PR H → exclude C
   even if it is the only candidate requested. If H's stacked PR says MERGED but
   its code is absent from the default branch, the exclusion remains.
8. **Active work:** F has a live linked PR touching `src/f.py`; an active issue
   outside P1/P2/P3 touches `src/d.py` → A,C,E. F gets a resume/review instruction,
   D is sequenced against that external active work, B against A. No duplicate
   session for F. Unknown relevant active scope cannot prove independence.
9. **Authorization per issue:** remove the R23 IN list's ratification (TBD), or
   remove Q3's mapping → C,E are ineligible, report why; A,D,F remain. Missing
   mapping *data* rather than a known unmapped value → fail closed. A project's
   release-looking name and an OUT issue's priority never authorize scope.
10. **Legacy and explicit milestone:** `any --parallel 5` without filters →
    resolve R2 first, then A,D,F only. No arguments → one active-R2 recommendation
    A. Three filters plus explicit R2 → A,D,F; no R23 tracks.
11. **Limits and collapse:** `--parallel 0`, negative, or fractional → refusal;
    bare flag defaults to 3; 9 clamps to 5 and reports it; 1 gives default mode.
    One eligible leaf → ordinary single output with its own project/gate; none →
    name blockers, never pad. Project-filtered default mode has at most three
    ranked issues total (one winner and two runners-up).
12. **Cardinality before preference:** in a separate pool, active-release A
    conflicts with later tracks C and E, which are independent of each other;
    `--parallel 2` → C,E and disclose why A was excluded. For an equal-size
    choice between {A,D} and {C,E}, choose {A,D} for active release priority.

For every case: propose distinct engineering branches and worktree paths only;
one kickoff per selected issue ends with open a PR, do not merge, do not mark
complete. Select leaves rather than containers. A human action must trace to its
own contract project/milestone assignment and receive no git artifacts. Count no
tracker mutation, branch creation, or worktree creation as a successful skill run.

## Validation limits

These cases test the instructions' decisions, not a live connector's filtering or
GraphQL schema. Live runs must still fetch complete state and verify IDs and team
membership. Run `python3 bin/check-stack` for repository structural validation.
