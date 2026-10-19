# Offline behavioral validation

Replay these cases against `SKILL.md` using only the frozen facts below. Do not
query Linear/GitHub, create worktrees, or mutate tracker state. Judge the selected
IDs and stated refusal/sequencing reasons, not wording or headings. The skill is
an agent procedure; these are behavioral cases, not executable API tests.

## Frozen facts

Unless a case says otherwise, every project has CURRENT graph coverage on
freshly fetched main for all its tickets, including OUT and terminal tickets.
Each candidate also has verified scope, ownership, acceptance and live prerequisite
evidence for its full relevant closure; coverage CURRENT alone is not admission.

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
13. **Accepted external overlap:** open PR #900, unrelated to candidates' own
    issues, touches `src/d.py`. Three filters with `--parallel 5` → A,C,E,F;
    D is sequenced against #900. Add `--accept-overlap 900` → A,C,D,E,F;
    D's kickoff lists #900's title/author and `src/d.py`, uses the default branch,
    and records Pending overlap while #900 is open. After #900 merges, rebase
    onto the fetched default branch before `land` Step 7, never onto its PR head.
14. **Two active PRs on one file:** #900 and #901 both touch `src/d.py`.
    Accept only 900 → D stays sequenced, naming #901. Accept both → D may join.
    This also models OGUR-371 sharing `docs/design/ux-spec.md` with #478 and #459:
    accepting one does not exempt the other.
15. **Within-batch overlap:** open PR #902 touches `src/shared.py`; accept it
    with the three filters and `--parallel 5` → A,C,D,E,F. B is still sequenced
    against A under criterion 4. A's kickoff records #902 and the exact path;
    Integration order cannot admit B.
16. **Unused and empty:** accepted open PR #903 touches `src/unrelated.py`.
    Every gated scope is concrete → report #903 unused, with its title/author.
    Repeat with every gated candidate blocked and no tracks selected: preserve
    the unused report. OUT issue G is not part of this reported candidate set.
17. **Refusal and deduplication:** `0`, `-1`, `1.5`, `abc`, `#900`, a bare flag,
    a nonexistent PR, a MERGED PR or a CLOSED PR → refuse before selection,
    quoting the value (or `<missing>`). `--accept-overlap 900` repeated twice
    validates one PR and emits one entry per candidate/PR intersection.
18. **Foundation and own active PR:** C needs code on accepted open PR #904 →
    C remains excluded under criterion 3. Accept F's own live PR from case 8 →
    F remains already active; record its overlap against F rather than unused.
    Blocking paths, scope failures and graph conditions remain unchanged too.
19. **Default-mode monotonicity and kickoff types:** default #1 A overlaps an
    unaccepted active PR; accepted #900 touches only D. Default mode with and
    without `--accept-overlap 900` still recommends A. The flag reports known
    intersections without adding a file-collision bar for #1. Repeat with
    `--parallel 1` and an explicit milestone plus project filters. Parallel
    kickoffs still need the existing concurrency checks. With no flag, omit
    overlap clauses; PLAN_ONLY records risks without rebase, and human actions
    receive no overlap or git instruction.
20. **Unknown and mixed reporting:** with flag 900, D's gated scope is unknown →
    report unused status unverified, naming D; do not call #900 unused. Separately,
    #902 touches selected A and sequenced B → list both intersections, even
    though the PR overlaps a selected track. Preserve all evidence if it exceeds
    the usual one-screen target; unknown default report scope does not alter #1.
21. **Complete diffs and renamed paths:** accepted PR #905 has 140 changed file
    records, with the candidate path on page 2 → exhaust the pages and find it.
    Receiving only 100 records while `changedFiles` is 140 → refuse. A renamed
    record with `filename: src/renamed.py`, `previous_filename: src/d.py` → D's
    intersection includes the old path. A moving head requires a stable re-read.

For every case: propose distinct engineering branches and worktree paths only;
one kickoff per selected issue ends with open a PR, do not merge, do not mark
complete. Select leaves rather than containers. A human action must trace to its
own contract project/milestone assignment and receive no git artifacts. Count no
tracker mutation, branch creation, or worktree creation as a successful skill run.

## Validation limits

These cases test the instructions' decisions, not a live connector's filtering or
GraphQL schema. Live runs must still fetch complete state and verify IDs and team
membership. Run `python3 bin/check-stack` for repository structural validation.

## Published graph admission cases

21. Main's P1 graph omits unrelated maintenance D, dropping coverage from 11/11
    to 11/12 while selected A and its closure remain verified: recommend A and
    report the warning/missing D separately. Terminal or archived additions also
    produce warnings. Prose-only mentions do not count as graph declarations.
22. Main lacks the P1 file entirely, or Linear pagination/main fetch is incomplete:
    block P1; an unavailable read is UNKNOWN. Legacy mode cannot bypass this check.
23. Explicit --accept-graph-update 905 names an OPEN graph-only PR to main whose
    stable reviewed validated head covers selected A and its complete closure: analyze that PR graph and allow
    otherwise eligible P1 work, citing its head/main SHAs. Acceptance of --accept-overlap
    905 alone does not satisfy publication. New code dependencies remain blocked.
24. Bare/malformed graph flags, a closed/merged/nonexistent/unrelated PR, an invalid
    graph, a dirty/unsupported source or a PR omitting selected A/its closure: refusal
    before selection. A provenance-only source-pin mismatch remains compatible. Unrelated missing D remains a warning.
    A moving head requires a fresh graph/coverage check. Repeated valid flags are
    validated/deduplicated but preserved through composed invocations.
25. Planning used accepted #905, then wave build carries only --approve all while
    main is still incomplete: block build. Passing --accept-graph-update 905 again
    requires a fresh live PR/coverage check. A plan risk or prior flag is not consent.

26. Selected D is absent from main but repairs approved A behavior with complete
    live issue/closure evidence, no new edges and one auditable append-only unit:
    emit its local reconciliation record and kickoff without a preliminary PR.
27. D adds new product behavior, changes a dependency, release acceptance or human
    gate: require reviewed publication and explicit owner scope approval as needed;
    neither a maintenance label nor a small diff admits it locally.
28. D is within the proposed local bounds but main pin, full issue body/relations,
    scope citation, owner, acceptance or prerequisite evidence is missing/stale:
    no D kickoff. Independently verified mapped A remains eligible.
