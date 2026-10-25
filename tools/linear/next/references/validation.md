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

## Executable selection cases

Run `node tools/linear/next/tests/selection.cjs` for the deterministic contract:
shared-file warnings before/after ownership changes; the greedy trap; scope,
native and foundation blocks; planning-only and unknown file scope; unknown
ownership; explicit capacity above five; malformed/partial evidence; bounded
search; named dispatch parity; and exhaustive small-pool oracle comparisons.

On the frozen pool above, A and B may now share a batch if their changes are
technically compatible: the common path is a warning. With a five-track limit,
active-release count then priority breaks equal-cardinality ties. Declare a real
INCOMPATIBLE pair to test sequencing instead of using the filename as a proxy.
Default single-milestone and explicit repeated-project filters retain their scope
boundaries. Related/duplicate links alone never become native blockers. External
PR overlap warns without flags; required unmerged code remains a foundation gate.
Unknown candidate files route to authorized planning; unknown external diff paths
remain an integration warning. No branch or tracker writes occur during next.

Wave's executable harness covers separate planning records, explicit/all approval,
forged membership, missing plan evidence and stale snapshot pins. Keep human
approval separate from graph ELIGIBLE. Live connector collection still needs
complete pagination, scope interpretation, ownership and actual dependency reads.

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
