# Offline triage validation

Run from the stack root:

```bash
python3 -m unittest discover -s roles/triage/tests -v
python3 bin/check-stack
```

The JSON fixtures use synthetic projects, canonical IDs, issues, reviewers and
PRs. Each JSON document has shared `defaults`; case `facts` recursively override
dictionaries and replace arrays. `fixture_model.py` is a small offline oracle over
**normalized frozen facts**, not a production triage runner. Tests compare derived status, posted
loop provenance, severity counts, selection IDs, exclusion arithmetic and
refusals. It has no service clients or write capabilities. `bin/check-stack`
runs these cases and reports failures. The prompt remains the canonical live
procedure; the model is intentionally isolated under tests.

Review fixtures cover: current-head no-findings with zero threads; stale review
after a push; answered unresolved P2 plus later no-findings; P3-only with an open
thread; outdated unresolved findings; exhausted loop leaving an unreviewed fix;
no review and zero threads; missing CI despite green Cloudflare; independent
multi-page reviews, threads and nested replies; repeated head movement;
unavailable loop/ledger state (availability is reported, never clearance); partial API/pagination failures; copied markers;
summary-only findings; explicit no-CI configuration; stale posted CLEAN; unknown
CI expectations; red and pending CI; requested-changes reviews, null-commit
conversation reviews and earlier same-head summary contradictions. Assertions also check rename intersections,
file count mismatch, cursor errors, resolved/unknown-severity threads and stale
CI SHAs. "merge_gate" means the modeled technical conditions only; human
permission is never inferred.

Project fixtures cover unlabeled PRs, terminal project-container attachments,
misleading prerequisite mentions, direct implementation, exact project-ID
membership, repeated project unions, all-label intersection, canonical team
mismatch, leaked rows, null membership, ambiguous names, incomplete lookup and
missing issue mapping. Without project filters, unavailable Linear data does
not affect GitHub selection. Container/state fields are retained and asserted
in selection provenance, while their values do not grant or remove membership.
Label-excluded PRs skip issue mapping; exclusions distinguish project failures
among label matches from **label-only or both**. Every successful case reconciles
selected plus these disjoint exclusions with the full inventory.

A passing test does **not** show that an agent follows the skill, an API result
is complete, a body's prose expresses implementation, a claimed fix is correct,
a live loop report is authentic, CI expectations were discovered correctly, or
that tools enforce read-only behavior. Pages are frozen normalized connections;
these are not GitHub/Linear transport or schema tests. Prompt-contract checks
guard shared-reference consumption and canonical section anchors, not full semantic equivalence
between the prompt and the oracle. Read-only remains prompt-level.

For a manual prompt replay, supply one case's facts without its expected block
and ask the skill for that PR's report fields or the selected PR set. Compare
with the frozen expectations, not exact wording. Explicitly verify the report
also links intent evidence and every unresolved thread, preserves claimed-fix
and outdated flags, labels UNKNOWN sources, reports all verdicts including
CLOSE/PARK, and lists every merge candidate once in dependency order or truly
independent lanes. No network, paid review, PR/thread writes or tracker writes
are needed for this replay. Live pagination, workflow applicability, state
rechecks, collision-safe output creation and safe ordering still require the
procedure's runtime evidence.

The inventory regression checks extract the actual Step 0 shell/Python fragment
from SKILL.md and execute it with a local fake `gh`. They verify error exit
propagation, malformed/error JSON rejection, valid multi-page counts and an
empty inventory. This tests the shown fragment, not a live API or an agent's
choice to follow it. Access-fallback/cache behavior remains a prompt contract.
