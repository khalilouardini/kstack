# PR evidence and status — read only

Apply this to every scored PR, including CLOSE/PARK. Preserve source URLs,
collection time, errors and completeness per surface. Missing evidence is
UNKNOWN. Known counts from partial reads are lower bounds, not totals.

## Reuse the canonical contracts without executing them

Read `tools/github/pr-loop/SKILL.md` from the physical stack root. Follow only
the **read/interpretation rules** in Configuration (`identities.*`, `ci.checks`),
The round steps 1 and 3/3a, Exit gates, Resuming after ROUNDS_EXHAUSTED, and the
conditions in Merging. Skip its preflight mutations, process launches, waiting,
review/fix/reply steps and merge command. Do not invoke the loop.

Read `tools/github/review-claude-pr/SKILL.md` only for its exact-head marker,
submitted review identity verification and severity definitions. Read
`tools/github/review-comments/SKILL.md` only for **How to find the unanswered
comments**, stopping before its filtering rules: reuse its three read surfaces
and independent/nested pagination, but retain **all unresolved threads** rather
than selecting unanswered work. Skip every write/post/fix section in both.
If a reference is unreadable, report that assessment UNKNOWN; do not invent a
replacement rule. Triage can retain unrelated facts and scope scoring.

## Stable metadata, files and intent

Start with `gh pr view <n> --json` fields `number,url,title,body,state,isDraft,
headRefName,headRefOid,baseRefName,baseRefOid,mergeable,mergeStateStatus,
changedFiles,updatedAt,labels`. State is OPEN/CLOSED/MERGED, independent of draft.
Keep GitHub `mergeStateStatus` (including CLEAN) separate from `mergeable`
(MERGEABLE/CONFLICTING/UNKNOWN) and from any review verdict or permission.

For complete file snapshots, reuse the `--accept-overlap` section of
`tools/linear/next/SKILL.md`: follow only its paragraph beginning "Deduplicate
PR numbers after validation" for complete file reads, count verification,
head/state rechecks and rename paths. Skip flag validation, acceptance and
selection behavior. It requires exhausting the REST files endpoint, comparing
records with `changedFiles`, and both `filename` and `previous_filename` in
intersections. Endpoint caps/count mismatch mean incomplete evidence even with
a successful HTTP response. Where that source refuses an incomplete snapshot,
triage keeps the affected fields/order UNKNOWN and names the evidence gap. Do
not use `gh pr view --json files` as proof.

Ground a short intent/main-changes paragraph in the current body and actual
files. Inspect relevant diff sections when the body is vague, stale or absent.
Describe resulting behavior, with links; label intent inferred from the diff.
If body/diff access is insufficient, say **intent UNKNOWN** and why. Do this for
CLOSE/PARK too; a scope verdict is not an intent summary.

After collecting files, CI, reviews and replies, re-read state, head/base
refs+SHAs, `changedFiles`, body, labels and `updatedAt`. If they changed, discard
the combined assessment and retry the whole read, at most **two retries**
(three attempts total). Recheck again before finalizing the proposal. Persisting
movement means **UNSTABLE / UNKNOWN**, naming observed SHAs/state/times; do not
combine old review/files with new-head CI or claim a safe merge order. Retain
CLOSED/MERGED transitions as facts; retry those snapshots too and mark them
non-actionable. Also compare review/thread counts or last-update evidence when
available and refresh a surface that changed during collection. A multi-API
read is not atomic; disclose the final observation time and this limit.

## CI at the current head

Use pr-loop step 3a's `ci.checks` scope and bucket interpretation, but take one
read-only snapshot instead of waiting or running checks. Record check names,
URLs, buckets and commit SHA; stale-head checks never clear the current head.
Report CI as **success, failure, pending, missing, or unknown**:

- Failure: a selected current-head check is fail/cancel, per the source rule.
- Pending: selected checks are pending; name them and any missing expectations.
- Missing: no selected current-head checks, or known expected jobs never
  registered. A successful Cloudflare/deployment check alone is not proof that
  backend/frontend or other expected CI ran.
- Success: the selected checks pass per the source, and the expected set is
  accounted for. Inspect base protection/rulesets and applicable tracked CI
  workflows/job conditions to establish expectations; cite them. Do not demand
  jobs whose conditions legitimately exclude this PR. An unexplained absent job
  is a hold. If expectations cannot be established, use unknown rather than
  certifying a partial rollup.
- Unknown: access/error/partial pagination, ambiguous expectations, head drift,
  missing `ci.checks`, or unrecognized buckets. Preserve known red/pending facts
  alongside the coverage gap. `ci.checks: none` explicitly means **no CI gate**;
  report CI missing/skipped by configuration, not a successful suite.

Do not infer success from the command exit code. Follow all check/status pages;
record missing required checks even when `gh pr checks --required` lists only
checks already registered. CI selection is reported separately from full-suite
coverage. A posted loop report can have used a narrower gate; retain that report
as evidence without promoting its claim into full-CI success.

## Reviews, loop reports and threads

Fetch every page of submitted reviews, inline review threads, each thread's
replies, and top-level conversation comments using the referenced read
procedure. Reviews and reviewThreads have separate cursors; nested comments
need their own cursors and endCursor fields. Require advancing cursors and
`hasNextPage=false` on each connection. REST `--paginate` is mandatory. GraphQL
errors with partial data invalidate completeness. Request author/login, review
state, review commit OID, body, IDs/URLs and timestamps. For threads request
isResolved, isOutdated, path/line, original finding author/title/priority,
review/commit association, and all reply authors/bodies/URLs/times. Null/deleted
authors stay unknown. Pending drafts are not published review evidence.

A current Codex review must be submitted by `identities.reviewer`, have the
source contract's `Review performed by Codex` attribution and exact
`<!-- codex-review head:<full-head-sha> -->` marker, and agree with its review
commit OID when present. A copied marker by another author, a SHA prefix, a
pending/dismissed review or conflicting commit evidence cannot clear the head.
Apply the same identity/marker verification to a conversation-posted review,
whose commit may be absent; label its surface. Retain earlier heads as linked
history with SHAs and times. Within one head, use the latest valid review and
retain earlier contradictory findings explicitly; never cherry-pick the clean
summary. Unmarked/human reviews can be linked context, not Codex clearance.

Report three separate results:

1. **Posted loop report**: CLEAN/BLOCKED/ROUNDS_EXHAUSTED only when an actual
   attributable run report is accessible (linked conversation report by the
   configured maintainer/implementer, or a user-provided run artifact). Record
   source/author/date, report head, reviewed head, round count and stated CI scope
   when available; missing fields stay
   UNKNOWN. An unbound or stale report remains history. Plain text claiming
   "clean" without provenance is not verified loop evidence. No posted report
   means **UNKNOWN / no accessible loop report**, even if a review exists.
2. **Derived current-head review assessment**: no P0–P2, P3-only, findings
   present, or UNKNOWN/no current review. Use the source severity definitions
   and complete findings body, including summary-only findings; do not infer a
   zero from empty threads. Derive whether the review and CI exit conditions
   appear satisfied, labelled **derived**, never a fabricated posted CLEAN.
   Design pushback/repeat evidence uses pr-loop's BLOCKED rules. Exhaustion can
   leave an unreviewed fix: compare report/review/current SHAs rather than
   treating a reply or ledger row as a new review.
3. **Open threads and merge holds**: count all unresolved published findings
   by P0/P1/P2/P3, across current and stale reviews and all authors; show
   unclassified threads separately. Deduplicate by thread ID, not title or
   number of replies. Link every finding title and its last published reply,
   last author/time, outdated flag, original/reviewed SHA if available and
   resolution state. Also surface current summary-only P0–P2 findings as holds;
   a lack of inline threads cannot erase them. Missing severity/association
   stays unknown with an evidence hold, not P3 or resolved.

A last reply saying "fixed" is a **claimed fix**, with any commit link recorded.
Compare relevant diff evidence if available, label any observed fix separately,
and still count the thread until `isResolved=true`. Answered is not resolved;
outdated is not fixed. A no-findings current-head review may coexist with older
answered unresolved P2 threads: review exit conditions may pass, while pr-loop's
**merge** gate fails. P3-only may satisfy CLEAN with passing/config-disabled CI
and an open P3 thread; keep that thread visible without inventing a P2 hold.
Zero threads with no current review is UNKNOWN, never CLEAN.

Optionally read the existing per-PR answered-findings ledger at the path defined
in pr-loop's preflight, without creating/touching it. Record availability and
matching repeat-guard evidence. It is not a persisted final verdict, CI result,
thread resolution or review of a new head. Missing local state is normal and
must not block unrelated facts or be replaced by guessed loop history.

## Explicit holds

Name dependency holds (linked prerequisites and evidence of what must land),
evidence holds (unknown review/CI/files/membership), and human holds (draft,
design decision, required approval or author instruction) separately. Also name
conflicts/red CI and unresolved P0–P2 findings. For a clean candidate say that
human merge permission is **not granted by triage**. A GitHub CLEAN status, a
posted/derived pr-loop CLEAN and permission are three independent facts.
