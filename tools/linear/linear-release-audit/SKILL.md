---
name: linear-release-audit
version: 0.1.0
description: Audit a release project against its gate criteria using Linear and GitHub evidence together — what is complete, active, blocked, unstarted, or falsely complete (Done with no acceptance evidence) — plus date/dependency incoherence, open review findings, and red CI. Never treats a merged implementation PR as proof a gate passed. Ends with three next actions. Use when asked "will we hit the release date", "audit the release", or "/linear-release-audit "<project>" [--apply]". (khalilou-stack)
---

# linear-release-audit — is the release gate actually met?

One question, answered with evidence: **would the release criteria pass today, and
if not, what is the shortest path to yes?**

## When to invoke

A release date is approaching, or has passed, and someone needs to know whether the
gates are met rather than whether the board looks tidy. Invoke as:

```
/linear-release-audit "<release project>"           # read-only (default)
/linear-release-audit "<release project>" --apply   # correct statuses + publish a status update
```

Not for deciding whether a new idea is in scope, not for choosing what to work on
next, and not for a period retrospective. Those are separate skills. This one asks
only whether the criteria in the scope doc would pass on today's evidence.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: khalilou-stack
`CONVENTIONS.md` §2) before gathering anything:

- **`workspace_contract`** — the tracker's workspace rules. Missing, null, or
  unreadable → **refuse**, naming `workspace_contract`. Without it you do not know
  what this workspace's completed status *requires* as proof, and the entire audit
  reduces to reading statuses back — which is the failure it exists to catch.
- **`scope_doc`** — **the gates document.** The release criteria live here; the
  tracker project tracks those criteria, it does not define them. Missing, null, or
  unreadable → **refuse**, naming `scope_doc`. There is no fallback: an audit with
  no criteria is a status report.
- **`issue_prefix`** — used to find issue identifiers inside PR titles and bodies
  (§2). Null → that linking method is unavailable; fall back to `gitBranchName` and
  stated titled correspondence, and say so in the report.

Read the file named by `workspace_contract` in full, first. Cite its sections as
that document numbers them, not by a number carried in your head. You need, by role:

| What you need from it | How to find it |
|---|---|
| What the completed status requires, per work type | The section listing admissible proofs |
| Why milestone `progress` is not the metric it is named after | The section on derived progress |
| Mutation safety — change ledger, name resolution, read-back | The section on writes |
| Historical work is preserved — what may not be rewritten | The section on preservation |
| The closing report sections | The section on reporting |

If the document's structure disagrees with this table, **the document wins** and you
say so.

**Enforcement honesty.** Read-only is the default and it is **prompt-level** —
nothing in the harness withholds the tracker write tools unless the host does. A
host that runs this skill without them makes it tool-list-enforced; say which case
you are in if asked.

---

## 1. Establish the criteria

From `scope_doc`, list the release gates verbatim — the exit criterion and each
lettered or numbered gate as that document names them. Quote them; do not
paraphrase. Every later finding attaches to one of these lines, and a finding that
attaches to none is out of the audit's scope.

Then, from the tracker, `list_projects` with `includeMilestones: true` and
`list_milestones` for the project.

**Do not report the milestone `progress` percentage as the state of the release.**
It is derived from issue closure, so it measures nothing about the thing the
milestone is named after. Quote the milestone *description*, which carries the real
number, and say explicitly that `progress` is a closure count.

> **Worked example (OGUR).** A milestone named `Deal recall → 10/12` reported
> `progress: 100%`, because all of its issues were closed. The actual result was 10
> of 12. A reader who takes `progress` at face value reads a missed target as a met
> one.

---

## 2. Gather evidence

Tracker (read-only): `list_issues` for the project with
`title, status, statusType, project, projectMilestone, labels, parentId, dueDate,
updatedAt, gitBranchName`, then `get_issue` with `includeRelations: true` for the
gate issues and anything flagged below.

GitHub:

```bash
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)
gh pr list --state merged --limit 100 --json number,title,mergedAt,headRefName,body
gh pr list --state open   --limit 100 --json number,title,headRefName,isDraft,reviewDecision,statusCheckRollup
gh run list --branch "$DEFAULT_BRANCH" --limit 20 --json conclusion,headSha,workflowName,createdAt
```

`statusCheckRollup` is check state at read time. For an open PR that is exactly the
question being asked — is CI red *now* — so no timestamp filter applies here.

For every open PR that maps to a gate issue, pull its unresolved review threads —
an unresolved blocking finding on the PR that implements a gate is a gate blocker,
whatever the issue status says.

Link the tracker to GitHub by `gitBranchName`, by an `<issue_prefix>-nn` identifier
in the PR title or body, or by a titled correspondence you can state in one
sentence. Label every link with its basis, and mark title-only matches
`LOW CONFIDENCE`.

A harness with no Linear MCP connector runs the same tracker queries through the
GraphQL API; nothing else in this procedure changes.

---

## 3. Classify every issue

Six buckets. Each issue lands in exactly one, with its evidence.

| Bucket | Definition | Evidence required |
|---|---|---|
| **Complete** | Completed status, and the contract's evidence for that work type exists | Merged PR / executed acceptance artifact / named user evidence |
| **Falsely complete** | Completed status, but that evidence does not exist | State what is missing. **The headline finding of any audit.** |
| **Active** | A started-type status with a live branch or open PR | The branch or PR |
| **Blocked** | Cannot proceed until something else lands | The blocking issue or PR, named |
| **Unstarted** | An unstarted- or backlog-type status in the active milestone | — |
| **Unimplementable as written** | No linked implementation and no acceptance path | What would have to exist |

Two distinctions do the real work here.

**A merged implementation PR is not gate evidence.** A gate is met when the thing
the gate names has actually been done and an artifact says so. The PR that added the
code does not produce that artifact. When the implementation has merged and the
acceptance evidence has not been executed, the gate is **Active**, and say precisely
which artifact is outstanding.

> **Worked example (OGUR).** `MVP-1 Gate C — Make every client-reachable surface
> auditable` is met when every client-reachable surface has been walked and found
> auditable — an inventory naming each route and its verdict. The PR that added the
> audit code merging does not produce that inventory. The issue read `Done`; the
> inventory did not exist.

**An issue with no linked implementation is a distinct finding.** Not blocked, not
merely unstarted: there is no branch, no PR, no commit, and often no acceptance path.
List these separately — they are the work most likely to be discovered late, because
nothing about them moves until someone starts.

---

## 4. Coherence checks

Four checks over the classified set. Each is a finding or an explicit pass.

1. **Due dates.** Any issue due after the release date, or before an issue it
   depends on. Compare the release date the gates cite against the project's
   `targetDate` — a material disagreement between them is itself a finding;
   report both and name which one the gates are being audited against.

   > **Worked example (OGUR).** During MVP-1 the release date in the gates read
   > `2026-08-13` while the project's `targetDate` read `2026-08-31`. Eighteen days
   > of apparent slack existed only in the tracker.

2. **Dependency order.** Walk the `blocks` / `blocked by` graph. Report any cycle,
   and any gate whose blocker is scheduled after it.
3. **Open review findings.** Unresolved blocking threads on PRs that implement gate
   issues, by PR and thread.
4. **CI.** The state of the default branch, and of each open PR mapped to a gate.
   Red CI on the default branch blocks every gate that ships from it; say so once, at
   the top, rather than repeating it per gate.

---

## 5. Output

```
# Release audit — <project> (<gate date>)

## Verdict
MET | NOT MET — <n> gates outstanding | UNKNOWN — <what is unestablished>

## Gate-by-gate
<one row per gate: criterion quoted, state, evidence or what is missing>

## Falsely complete
<issues at a completed status without the contract's evidence — empty is a real and good result>

## No linked implementation
<issues with no branch, PR, or commit>

## Coherence
<dates, dependency order, review findings, CI>

## Three highest-leverage next actions
1. …
2. …
3. …
```

**Verdict first, on line two.** The three next actions are ranked by *gates
unblocked per unit of work*, not by urgency of tone — the top action should be the
one whose completion moves the most gates from outstanding to met.

Then the workspace contract's **Unknowns** section. `UNKNOWN` is a legitimate
verdict: an audit that cannot establish the state of a gate must say so rather than
pick the optimistic reading.

---

## 6. Apply (only with `--apply`)

Two write classes, both after the change ledger the workspace contract specifies is
printed and approved:

**Status corrections.** Only those with evidence in the ledger. Resolve names to ids
first — the Linear write path fails open, returning HTTP 200 with the field silently
unset on an unresolved name, and a project name containing `&` never resolves. Read
back each write with `get_issue` and stop the batch on the first mismatch.

**A project status update** via `save_status_update`, carrying the verdict, the
gate-by-gate state, and the three next actions. Health follows the verdict
mechanically — `onTrack` only when every gate is met or has a dated, evidenced path
inside the window; `atRisk` when a gate lacks an owner or an acceptance artifact;
`offTrack` when a gate cannot be met by the date.

Never close issues into a milestone whose name states a target unless the target was
reached; closing the work publishes a number that was not hit.

---

## Refusals

- **Never claim a gate passed because its implementation PR merged.** Require the
  gate's own acceptance evidence.
- **Never report milestone `progress` as the metric named in the milestone.**
- **Never mark commercial work complete without named, dated user evidence.**
- **Never resolve an unknown by picking the optimistic reading.** `UNKNOWN` is a
  verdict.
- **Never write without `--apply` and an approved ledger.**
- **Never edit or soften a milestone description that records a correction** — the
  workspace contract makes those read-only, and they are usually the most honest
  text on the board.
- **Never audit against a scope doc you could not read.** Refuse, naming the key.

---

## Acceptance scenarios

| # | Situation | Required behaviour |
|---|---|---|
| 1 | A gate issue is at a completed status; its implementation PR merged; no acceptance artifact was executed | **Falsely complete.** Name the missing artifact. Under `--apply`, propose reverting it to a started-type status |
| 2 | Milestone `progress` is 100% and the description records a result short of the target | Quote the description; state that `progress` is a closure count; do not report 100% |
| 3 | A gate issue has no branch, no PR, and no commit | Report under **No linked implementation** — separately from Blocked and Unstarted |
| 4 | An issue's `dueDate` falls after the gate date | Coherence finding, both dates quoted, with which one the audit used |
| 5 | An open PR implementing a gate has an unresolved blocking review thread | Gate is blocked regardless of issue status; name PR and thread |
| 6 | A commercial issue's real-world state cannot be established | `UNKNOWN — needs owner input`; never inferred |
| 7 | `scope_doc` or `workspace_contract` is null | Refuse, naming the key. Do not audit statuses against nothing |
| 8 | `issue_prefix` is null and a PR carries no matching branch name | Link by stated titled correspondence, marked `LOW CONFIDENCE`, and say the identifier method was unavailable |

---

## Fixture dry run

When this skill directory carries a `fixtures/` set, run it before trusting a change
to this file. `fixtures/release-project.json` is a frozen slice of a release project
containing a falsely-complete gate, an issue with no linked implementation, a date
incoherence, and a milestone whose `progress` contradicts its description.
`fixtures/github-evidence.json` holds the matching PR and CI state, and
`fixtures/expected-audit.md` the report those inputs must produce.

Run against the fixtures with no tracker or `gh` calls and diff. The falsely-complete
gate must appear in its own section, and the milestone at `progress: 100%` must not
be reported as met.

What fixtures cannot exercise: unresolved review threads need a live GraphQL gather,
and the §6 name-resolution and read-back rules need a live tracker. The dry run
checks the *reported* values, not the derivation.
