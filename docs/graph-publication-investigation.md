# Graph-publication gate investigation

Observed 2026-10-14 at 22:00 UTC (2026-10-15 in Europe/Paris).
KStack baseline: `361ea2c982afa69289c394fc68e479d1514317f9` (PR #28).
Authoritative OGUR main after fetch: `41872f20f3f486cc5eeccf3b8eeba8916e50c9db`.
Scope blob: `385375436eae914eb70e44de65c5bca64b7ff97e` at
`docs/product/mvp-scope.md`. The §1 gate and §10 IN list remain the approved
served-report-question boundary. This investigation did not edit OGUR or run
its test suite.

[OGUR-474](https://linear.app/ogur/issue/OGUR-474/improvement-the-ogur-367-answered-fixture-shows-a-statement-the-server)
was created on 2026-10-14 at 11:06:07.332 UTC. Its full body describes an answered
fixture that contradicts the approved claim filter, records the founder's PR #497
follow-up decision, and names fixture/contract tests as acceptance. Its live native
blocks and blockedBy lists were empty; relatedTo lists 367, 371 and 374. Related
links are provenance, not automatically dependency edges. It is absent from both
the published Markdown and typed manifest. The complete paginated project list
contained 12 tickets, including archived/terminal items; hasNextPage was false.
The captured membership is in
[ogur-474-coverage.json](../tools/linear/linear-roadmap/tests/fixtures/ogur-474-coverage.json).
This historical coverage fixture is not fresh execution authorization.

| Hypothesis | Prediction | Result |
| --- | --- | --- |
| H1: whole-project coverage is being used as candidate eligibility | Adding only the maintenance issue changes admission | Confirmed: CURRENT with the original 11, UPDATE_REQUIRED with all 12; wave excludes the entire project |
| H2: independent scope or prerequisite drift causes the block | The failure persists with the original membership or names a semantic change | Falsified for this symptom: the same Git SHA and unchanged graph pass the original 11; only 474 is missing |

Reproduce membership against the recorded immutable main SHA:

```sh
python3 tools/linear/linear-roadmap/bin/graph-coverage \
  --repo /path/to/ogur \
  --ref 41872f20f3f486cc5eeccf3b8eeba8916e50c9db \
  --issues tools/linear/linear-roadmap/tests/fixtures/ogur-474-coverage.json
```

The original helper exits 1 with UPDATE_REQUIRED and `missing_view` and
`missing_manifest` both containing only OGUR-474. Removing only that evidence
entry produces CURRENT at the same SHA. The revised helper still reports this
warning and exits 1, additionally reporting `covered_count: 11`, `total_count: 12`.
Execution callers use the separate candidate audit rather than equating this
exit code with permission to start every project ticket.

Root cause: the shared contract made every project ticket a publication
prerequisite. Next, dispatch, land, investigate and implementer review copied
that refusal. Wave encoded it by excluding UPDATE_REQUIRED projects and testing
tracks against that project state, without separate candidate evidence. Complete
coverage also did not prove candidate scope, prerequisites, ownership or acceptance.

The regression was observed failing before implementation through the repository
configured gate, `python3 bin/check-stack`: the unrelated-addition wave case
expected AWAITING_APPROVAL and received STOPPED. It now permits otherwise eligible
mapped work while retaining coverage warnings. The new stdlib admission suite
checks selected unmapped repairs, exact delta/evidence, scope expansion, dependency
changes, release/human criteria, cross-project closure, missing/stale evidence,
phase-specific readiness and the three-unit bound. The wave harness checks fresh
candidate reports, origin/delta retention, plan drift, reviewed PR heads and
unrelated incomplete audits. These fixtures establish behavior, not live launch
approval for OGUR-474; that still needs its full fresh admission audit.

The local path appends at most three selected maintenance units and no edges.
It records pinned main and graph SHAs, complete live issue/request evidence,
canonical JSON digests and exact node delta. Existing scope, dependencies,
acceptance/release criteria and human gates remain intact; any semantic change
requires reviewed publication. The origin unit's closure remains mandatory.
When publishing a local repair later, review explicit conditions against that
origin closure rather than promoting the edge-free local delta and losing gates.

Validation uses KStack's configured lint/test gate (the same command for both).
Source truth, scope interpretation and actual human approval remain the calling
skill's responsibility; the helpers validate citations, structure, evidence
completeness, event readiness assertions and the bounded delta.
