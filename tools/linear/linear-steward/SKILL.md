---
name: linear-steward
version: 0.1.0
description: Audit and repair the structural health of a Linear workspace against its workspace contract — issues with no project, stale statuses, statuses contradicted by GitHub, duplicates, superseded work, and issues too vague to gate. Produces an evidence ledger and mutates nothing unless explicitly invoked with apply. Use when asked to "clean up Linear", "is the board accurate?", "reconcile Linear with GitHub", or "/linear-steward audit|apply|reconcile-finished [team|project]". (kstack)
---

# linear-steward — keep the board's claims true

## When to invoke

The workspace is a claim about the state of the world, and someone suspects the
claim is wrong: issues sitting in a started status for weeks, work that merged
without the ticket moving, two tickets for one job, tickets nobody can say when
they are finished. Invoke as `/linear-steward audit|apply|reconcile-finished
[team|project]`.

This skill does not decide scope — that is the `product-manager` gate — and it
does not create feature work — that is the feature-intake skill. It checks the
board's claims against evidence and repairs the ones that are wrong.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: kstack
`CONVENTIONS.md` §2) before any tracker call:

- **`workspace_contract`** — the workspace rules doc. Missing, null, or
  unreadable → **refuse**, naming `workspace_contract`. There is no fallback and
  no default vocabulary: this skill is the *enforcement* of that contract, and an
  enforcement with nothing to enforce is a rewrite of someone's board according
  to your taste.

Missing `.agents/stack.yml` altogether → refuse and name the file.

**Every team name, project name, status name, and label in this run comes from
the contract or from a live tracker read. Never hardcode one, and never carry one
over from a previous run** — workspaces are renamed and re-shaped, and a
hardcoded name is how a sweep silently scopes itself to the wrong team.

## The contract you enforce — read it fresh, every run

Read the file named by `workspace_contract` in full at the start of every
invocation. Do not carry a section map in your head; read the headings you
actually find and cite them as the document numbers them. You need, by role
rather than by number:

| Role | What it holds |
|---|---|
| **Workspace shape** | The team(s), the status vocabulary and each status's type, what a project means, the label axes |
| **One primary project** | The rule for which single project an issue belongs to, and how cross-project relevance is expressed instead |
| **Evidence rules for complete** | What each work type requires before it may be called done |
| **History preservation** | What may never be deleted, archived, re-opened, or re-scoped |
| **Milestone semantics** | What milestone progress does and does not mean |
| **Mutation safety** | The write protocol — id resolution, read-back, batch abort |
| **Reporting** | The ledger format and the required closing sections |

If the document's structure disagrees with this table, **the document wins** and
you say so in the report. If it is silent on a role, say which one and treat that
detection as unavailable rather than inventing the rule.

**Judge status by `type`** (`backlog` / `unstarted` / `started` / `completed` /
`canceled` / `duplicate`), never by name. Where this file names a status in
backticks it means *the contract's status of that type* — substitute the name the
contract actually uses.

## Invocation

```
/linear-steward audit [team|project]                       # read-only (default)
/linear-steward apply [team|project]                       # write, after the ledger is approved
/linear-steward reconcile-finished [team|project]          # GitHub↔tracker status audit only
/linear-steward reconcile-finished --apply [team|project]  # apply its approved ledger
```

No argument means the whole team named in the contract's workspace-shape section.
A project name scopes the sweep to that project — use it when a full sweep would
produce a ledger too long to review.

`audit` never writes. `apply` writes only rows the owner approved from a ledger
printed in the same session; it does not re-derive the ledger silently and act on
it.

`reconcile-finished` is the fast path for "clean up the board after merges." It
runs Phase 1 and Phase 2.3 only, then prints the same ledger and Unknowns
sections. It is not a fourth tracker skill: status truth already belongs to the
steward. Without `--apply` it is read-only; with `--apply` it still requires
approval of the printed ledger before any write and uses the Phase 5 read-back
protocol.

**Enforcement honesty:** the no-write guarantee under `audit` and
`reconcile-finished` is **prompt-level** — the write tools are reachable and
nothing blocks the call. A host that runs this skill with the tracker's write
tools withheld makes `audit` tool-list-enforced; say which case you are in if
the user asks.

---

## Phase 1 — inventory (always)

Build the picture before judging any part of it. Six reads, all read-only:

1. `list_projects` with `includeMilestones: true` — the outcome roster, each
   project's state and target date, and the release-gate milestones.
2. `list_issue_statuses` for the team — the status vocabulary and each status's
   `type`. Judge by `type`, never by name.
3. `list_issue_labels` — the ownership and capability axes the contract defines.
4. `list_issues` for the team, `limit: 250`, requesting at minimum
   `title, status, statusType, project, labels, parentId, updatedAt, dueDate,
   projectMilestone`.
5. `get_issue` with `includeRelations: true` for every issue a later phase flags —
   not for all of them; relations are the expensive field.
6. GitHub, for the reconciliation in Phase 2.3 only:
   `gh pr list --state merged --limit 100 --json number,title,mergedAt,headRefName`
   and `gh pr list --state open --limit 100 --json number,title,headRefName,isDraft`.

Reads 1–5 assume the harness has the Linear MCP tools. Without them, use the
access path in the workspace contract (GraphQL with `LINEAR_API_KEY`) to fetch
the same fields; if neither path is available, stop and say so rather than
auditing a board you could not read.

Print a one-paragraph inventory: issue count by status type, project count, how many
issues have no project, and the date of the oldest `started` issue. This paragraph is
the baseline the ledger is read against.

---

## Phase 2 — the six detections

Each detection yields findings. A finding carries the issue identifier, the observed
state, the evidence, and one proposed change. A finding with no proposed change is a
question for the owner, not a ledger row.

### 2.1 Unprojected

An issue with no project. Every issue belongs to exactly one outcome.

Propose the project whose delivery is blocked by this issue. If no project's
delivery is blocked by it, the issue is a candidate for `Canceled`, not for a new
project — say so and let the owner decide.

Two exclusions:

- **Completed and canceled issues are skipped.** Their project field is history, and
  history is preserved (contract, history-preservation section). An unprojected
  completed issue is not a defect.
- **A vague issue (2.6) gets no project proposal.** If nobody can say what would make
  it complete, nobody can say which outcome it blocks. Fix the description first;
  the project follows. Record it under **Unknowns**, not as a ledger row.

Tracker onboarding artifacts (issues like `Get familiar with Linear`, `Import your
data`, `Connect your tools`) are the tool's own seed issues. If already `Canceled`,
leave them; they cost nothing and the contract preserves history.

### 2.2 Stale

An issue in a `started`-type status whose `updatedAt` is older than **7 days**, or
whose `dueDate` has passed.

Staleness is a question, not a verdict. Before proposing anything, look for the
implementation evidence in Phase 2.3. The three outcomes:

- Evidence of a merged PR → propose the `completed` status (2.3).
- Evidence of an open PR → the issue is genuinely in review; propose only a
  `dueDate` correction, and name the PR.
- No evidence at all → propose the `unstarted` status, with the reason "started
  status with no branch, PR, or commit". Do **not** propose `Canceled`; an
  unstarted issue is not a rejected one.

### 2.3 Status contradicted by GitHub

The reconciliation, in both directions:

- **Merged PR, issue not complete.** Match merged PRs to issues by branch name
  (`gitBranchName` on the issue), by issue identifier in the PR title or body, or by
  a titled correspondence you can state in one sentence. On a match, propose the
  status implied by the contract's evidence rules — the `completed` status for
  implementation issues, and for a **release-gate** issue propose nothing but a
  note, because a merged PR is not gate evidence.
- **Issue complete, no merged PR.** Report it. Propose no change: completed work is
  preserved, and the missing link is more likely a linkage gap than a false
  claim. Ask for the PR number.

The focused `reconcile-finished` mode uses this exact mapping:

| GitHub evidence | Current tracker state | Proposal |
|---|---|---|
| Merged PR, implementation issue | Any non-completed state | `completed` status |
| Open non-draft PR | Any `backlog` / `unstarted` / `started` state | The in-review status |
| Open draft PR | `backlog` / `unstarted` | The in-progress status |
| Merged PR, release-gate issue | Any | No status change; name the missing gate acceptance artifact |
| Closed without merge, or no defensible match | Any | No status change; report under Unknowns |

Never move an issue backward merely because GitHub evidence is missing in the
latest 100 PRs. Search the exact branch and identifier before concluding there is
no match; absence from a bounded list is not evidence that work never merged.

Matching is heuristic and must be labelled as such. State the basis for every match
("branch `feat/x` on `<ISSUE-ID>`") and mark any match resting only on title
similarity as `LOW CONFIDENCE — confirm before applying`.

### 2.4 Duplicated

Two issues describing the same work. Detect by title overlap, by the same PR
matching both, and by parent/child pairs where the child restates the parent.

Propose: keep the issue with the richer description and the real linkage; set the
other to the `duplicate` status; add a `duplicate of` relation to the survivor.
Never delete, never archive.

If both carry unique content, they are not duplicates — they are two issues that
need their titles to say why they differ. Propose the retitle instead.

### 2.5 Superseded

An open issue whose purpose has been taken over by a newer, more concrete issue —
typically a broad area issue replaced by a specific release-gate issue.

The tell is a broad title against a specific one. Propose the `duplicate` or
`canceled` status on the broad issue with a relation to the concrete one, and
quote both titles in the finding so the owner can overrule in one glance.

> **Worked example (OGUR).** A broad `Scope web app deployment` was superseded by
> a concrete `MVP-1 Gate B — Deploy one same-origin app serving both frozen
> reports`. The broad issue got `Duplicate` plus a relation to the gate issue,
> with both titles quoted in the finding; the gate issue was left untouched.

Do not supersede an issue merely because it is old. Age is not obsolescence.

### 2.6 Vague

An issue whose title and description do not let a reader say what would make it
complete. These are unfixable by this skill and unroutable by any other: the
`product-manager` gate returns `NEEDS-EVIDENCE` on them, and a release audit
cannot check them.

Propose no status change. Propose one added line: **"Done when: …"**, drafted from
whatever the issue does say, marked as a draft for the owner to correct.

---

## Phase 3 — project assignment

For every issue the phases above touched, and every issue with more than one
plausible home, apply the contract's one-primary-project rule:

> The primary project is the outcome that is **not delivered** until this issue is
> done.

Cross-project relevance is expressed with a capability label or a tracker relation —
never with a second issue. If a finding's proposed fix is "create a copy in the
other project", the finding is wrong; replace it with a label or relation row.

State the rejected alternative when the call is close: "primary `<release
project>` (the gate is not met without it), not `<capability project>` (that is
the means); found from that work via the `<capability label>` label."

---

## Phase 4 — the ledger

Print the ledger in the contract's reporting format, sorted with the
highest-confidence rows first, before any write:

| # | Issue | Field | From | To | Evidence | Reversible |
|---|---|---|---|---|---|---|
| 1 | `<ISSUE-ID>` | status | In Progress | Done | PR #219 merged 2026-08-08, branch `fix/api-packaging` | yes |

One field per row. A row that has no evidence column filled is not a ledger row —
move it to **Unknowns**.

Then the two closing sections the contract's reporting section requires:
**Unknowns** (what could not be established, and what would establish it) and
**Next actions** (at most three).

Under `audit`, stop here. This is the whole deliverable.

---

## Phase 5 — apply (only on `apply`, only after approval)

For each approved row, in ledger order:

1. **Resolve every name to an id first** — `list_projects`, `list_issue_labels`,
   `list_issue_statuses`. The MCP write path fails open: `save_issue` returns 200
   with the field silently unset when a name does not resolve, and a name containing
   `&` (`Design & Research`) never resolves. Pass ids, not names.
2. Write the single field with `save_issue`.
3. **Read back** with `get_issue` and compare to the intended value.
4. On mismatch: stop the batch, report the row that did not take, and leave the rest
   unapplied.

Print the applied ledger with a fourth state column — `applied` / `mismatch` /
`skipped` — and the read-back value for every row.

---

## Refusals

These are absolute. They are the reason the skill is safe to run on a live
workspace.

- **Never mark commercial work complete without named, dated user evidence.**
  Not from a doc being written, not from a related engineering issue closing. If the
  real-world state cannot be established, report `UNKNOWN — needs owner input`.
- **Never mark engineering work complete without a merged PR or equivalent commit
  evidence.** An open PR means in review.
- **Never mark a release gate complete because its implementation PR merged.** The
  gate needs the gate's own acceptance evidence.
- **Never create a second issue to represent cross-project relevance.**
- **Never delete, archive, re-open, or re-scope completed work.**
- **Never report milestone `progress` as the metric the milestone is named after** —
  progress derives from issue closure; quote the milestone description instead.
- **Never write outside an approved ledger**, and never under `audit`.

---

## Acceptance scenarios

The skill is correct on a workspace when it produces these five outcomes. Re-check
them after any edit to this file.

| # | Situation | Required behaviour |
|---|---|---|
| 1 | An issue sits in a started status past its due date with no branch, PR, or commit | Propose the `unstarted` status with reason "started status with no implementation evidence" — **not** `Canceled`, and **not** complete |
| 2 | A merged PR implements an issue still in an `unstarted` status | Propose the `completed` status, citing PR number and merge date; if the issue is a release gate, propose a note instead and say the gate needs its own acceptance evidence |
| 3 | One issue is relevant to two projects | Exactly one primary project (the one whose delivery it blocks) plus a capability label or relation — never two issues |
| 4 | A broad issue is superseded by a concrete release-gate issue | Propose `duplicate`/`canceled` on the broad one with a relation to the concrete one; quote both titles; never delete |
| 5 | A commercial issue's real-world state cannot be inferred | Report `UNKNOWN — needs owner input`; propose no status change under either mode |

### Focused finished-issue reconciliation

Run `reconcile-finished` against the same inputs as a full `audit` and compare.
Two invariants:

- **Invocation scope never changes a verdict on identical evidence.** A status
  proposal the full audit makes must be identical in the focused mode, and vice
  versa.
- **No leak.** No unprojected, duplicate, supersession, vagueness, or commercial
  row may appear in the focused mode's ledger; a release-gate issue whose
  implementation PR merged stays an Unknown in both modes.

## Fixture dry run

This skill ships no fixtures. When the consuming project provides a frozen,
redacted workspace slice (`fixtures/workspace.json`) plus the ledger those inputs
must produce (`fixtures/expected-ledger.md`), run the skill against it — no
tracker calls, read the JSON as the Phase 1 inventory — and diff your ledger
against the expected one. A row that appears in yours and not in the expected file
is a false positive and must be explained before the skill is used with `apply` on
live state.

A useful slice contains one instance of each of the five acceptance scenarios plus
one duplicate pair, and a separate expected section for `reconcile-finished`
against the same inputs; any additional ledger row in that mode is a scope leak.
