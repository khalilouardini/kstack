---
name: linear-feature-intake
version: 0.1.0
description: Turn a gated feature request into the correct Linear records — and nothing else. Searches for equivalent existing work first, then executes only the disposition a product-manager verdict block implies: no ticket for OUT, one research issue for NEEDS-EVIDENCE, one backlog issue for a future milestone, a meta issue plus children for the active one. Never overrides the verdict. Use when asked to "file this", "create the tickets for this", or "/linear-feature-intake …". (kstack)
---

# linear-feature-intake — the verdict's hands, not its judgement

This skill writes down a decision that has already been made. The `product-manager`
role owns scope; this skill owns the tracker records that follow from it. Keeping
those two jobs apart is the entire design: a skill that both decides and creates
will find a reason to create.

## When to invoke

An idea has been through the product gate and its verdict now needs to exist as
tracker records — or an owner is starting from the tracker and wants a request
gated and filed in one step. Invoke as:

```
/linear-feature-intake "<feature request>"                        # obtains the verdict itself
/linear-feature-intake --verdict <verdict-artifact>               # consumes a verdict already produced
/linear-feature-intake --verdict <artifact> --spec <spec-path>    # persistence only; the spec already exists
```

Not for deciding whether the idea is in scope — that judgement is the
`product-manager` role's and this skill never revisits it. Not for auditing
records that already exist, and not for a release-readiness question.

## Configuration — read `.agents/stack.yml` first

Read `.agents/stack.yml` at the consuming repo's root (schema: kstack
`CONVENTIONS.md` §2) before anything else:

- **`workspace_contract`** — the tracker's workspace rules. Missing, null, or
  unreadable → **refuse**, naming `workspace_contract`. There is no fallback:
  without it you do not know this workspace's statuses, its project roster, its
  label axes, or what its completed status requires as proof, and every record
  this skill creates would be a guess about someone else's board.
- **`scope_doc`** — read **only** to identify which milestone is **active**. Never
  to form an opinion about the proposal. Null or missing → you cannot tell a
  future milestone from the active one, so the §1 consistency check degrades to
  the two pairs that do not need it (`OUT`→`STOP`, `NEEDS-EVIDENCE`→`EVIDENCE`);
  say so in the output and execute `disposition` as given.

Read the file named by `workspace_contract` in full, first. Do not carry a section
map in your head — cite its sections as that document numbers them. You need, by
role rather than by number:

| What you need from it | How to find it |
|---|---|
| Status names and their types | The section defining the workspace shape |
| The project roster, and which outcome each project tracks | Same section |
| The label axes — ownership vs capability | Same section |
| The one-primary-project rule | The section forbidding a second issue for the same work |
| What the completed status requires, per work type | The section listing admissible proofs |
| Mutation safety — the change ledger, name resolution, read-back | The section on writes |
| The closing report sections | The section on reporting |

If the document's structure disagrees with this table, **the document wins** and
you say so.

> **Never write a project, label, or status name you did not read out of the
> workspace contract or resolve from the tracker itself.** A name typed from
> memory does not fail loudly — the Linear write path fails *open*, returning
> HTTP 200 with the field silently unset when the name does not resolve, and a
> project name containing `&` never resolves at all. Resolve every name to an id
> with `list_projects` / `list_issue_labels` / `list_issue_statuses` before
> passing it, and read the record back after the write.

A harness with no Linear MCP connector runs the same queries through the GraphQL
API; the trap above applies to either path.

### `--spec` — exactly one orchestrator per run

This skill and the spec pipeline (`roles/spec`, invoked as `/spec`) can each
invoke the other. Unguarded, that recurses: `/spec` → intake → `/spec`, writing
the spec twice and proposing two sets of issues.

**Whoever was invoked first owns orchestration; the second call is persistence
only.** `--spec <path>` is how the caller says so. It supplies an approved spec
artifact, and it is a promise that the expensive path has already run.

> **`--spec` given ⇒ do not invoke `/spec`.** Read that file for the issue bodies
> and go straight to the §2 duplicate search and the upsert.

The symmetric half lives in `/spec`: a `/spec` run invoked *by* this skill returns
its spec to the caller instead of calling back. Both halves are required — either
alone still recurses from the other entry point.

`--spec` without `--verdict` is a hard stop: a spec is not a scope decision, and
persisting one without the verdict that admitted it produces a record no release
audit can trace. `--spec` pointing at a file that does not exist is also a hard
stop — do not fall back to running `/spec`, which would silently reintroduce the
loop the flag exists to prevent.

**Enforcement honesty.** The recursion guard is **prompt-level**: it is a check
you perform before dispatching, not a mechanism that blocks the call. So is
"never override the verdict". What *is* structural is the gate itself — the
`product-manager` role adapter grants only `Read`, `Grep`, `Glob`, so the deciding
half cannot write to the tracker even if it wanted to.

---

## 1. The verdict contract

**This section is the canonical definition of the verdict block.**
`roles/product-manager.md` emits it and points here; if that file and this section
ever disagree, this one wins and that one is the bug.

The `product-manager` role emits, alongside its prose verdict, one YAML block.
This skill consumes that block and nothing else from the gate:

```yaml
proposal:            # one sentence, the PM's words
verdict:             # IN-<active-milestone> | IN-<future-milestone> | OUT | NEEDS-EVIDENCE
milestone:           # the milestone the verdict places it in; null for OUT
scope_citation:      # the quoted line of the scope doc the verdict rests on
user_evidence:       # named evidence, or null
reversal_condition:  # the concrete observable that would change the verdict
disposition:         # STOP | EVIDENCE | BACKLOG | SPEC
```

Seven keys, spelled exactly this way, no others.

Rules on this block:

- **`disposition` is authoritative.** It is what this skill switches on. `verdict`
  is carried into the record for the reader; it is not re-interpreted. Consumers
  branch on `disposition` and never on the milestone token, so that a milestone
  transition does not require editing this skill.
- **A missing or unparseable block is a hard stop.** Report what was missing and
  ask for a re-run of the gate. Do not infer a disposition from the prose.
- **A block with no `scope_citation` is a hard stop.** The contract citation is what
  makes the record auditable later; the gate's own instructions require it.
- **`disposition` and `verdict` disagreeing is a hard stop.** The valid pairs are
  `OUT`→`STOP`, `NEEDS-EVIDENCE`→`EVIDENCE`, a non-active milestone→`BACKLOG`, and
  the active milestone→`SPEC`. Anything else is a malformed gate output. When
  `scope_doc` is null you cannot resolve which milestone is active; check the two
  pairs that do not need it, state that the other two went unchecked, and proceed.

Without `--verdict`, dispatch the `product-manager` role on the request and use
what it returns. Pass the request through unedited — rephrasing it to sound more
necessary is smuggling scope past the gate. If the role adapter is not configured
in this harness, say which one is missing and **stop**; ask for a verdict artifact
via `--verdict` rather than forming the verdict yourself.

---

## 2. Search before anything

Runs **before** the gate, not after. The cheapest possible outcome is discovering
the work already has a ticket, and that outcome should not cost a gate run.

1. `list_issues` with `query:` on the two or three load-bearing nouns of the request,
   `includeArchived: true`, across all statuses.
2. `list_issues` filtered by each **capability label the workspace contract
   defines** that the request plausibly carries. Read the roster out of the
   contract; do not guess label names.
3. `list_projects` — a request that restates a whole project is a project-level
   conversation, not an issue.

Classify every hit as one of:

- **Equivalent** — same work. Stop; report the identifier. Update the existing issue
  with the new context if it adds anything; create nothing.
- **Overlapping** — shares a component or a milestone. Not a stop; becomes a
  `related to` relation in §4.
- **Superseded** — an older issue this request replaces. Becomes a relation and a
  finding for whichever skill owns workspace hygiene; this skill does not close it.

Print the hits and the classification before proceeding. "No existing work found" is
a claim that needs the queries you ran shown beneath it.

---

## 3. Disposition → tracker action

Exactly one row fires per run. Every status, project, and label named below is
resolved from the workspace contract, never typed from memory.

| `disposition` | Tracker action |
|---|---|
| `STOP` | **No execution ticket.** Record the decision only — see below. |
| `EVIDENCE` | Upsert **one** issue: the customer-research question, at the contract's `backlog`-type status, with its ownership label for commercial work, in the project the contract designates for customer discovery. It is blocked *on the answer*, stated in the description — not by a relation onto another issue. |
| `BACKLOG` | Upsert **one** issue in the project the contract maps that future milestone to, at the `backlog`-type status, no children, no spec. |
| `SPEC` | Run `/spec`. On owner approval, upsert one meta issue plus its implementation children. |

**`STOP` in detail.** An `OUT` verdict never becomes a backlog feature — that is the
laundering path the gate exists to close. What survives is the decision audit: if a
decision record for this proposal does not already exist, create **one** issue at the
contract's `completed`-type status, titled
`Decision recorded — <proposal> is outside <milestone>`, whose description carries
the verdict block verbatim, including `reversal_condition`. It is completed on
creation because the decision is the deliverable. If the owner later wants it
reconsidered, the reversal condition is written down and searchable.

> **Worked example (OGUR).** `OGUR-55` is an existing record of exactly this shape:
> created `Done`, titled for the proposal and the milestone it fell outside, body
> carrying the verdict block. Nothing was ever built for it, and three weeks later
> the question "why didn't we do that" had a dated answer with a reversal
> condition attached.

**`EVIDENCE` in detail.** The issue's title is the question to put to a user, not a
feature name. Its description carries the verdict block and states what answer would
flip the verdict to `IN` and what answer would flip it to `OUT`. By the contract's
evidence rules, nothing may move commercial work to the completed status except
named, dated real-world evidence — so this issue cannot be closed by inference from
activity. If the contract names no project for customer-research work, **ask the
user** which project holds it; do not invent one and do not park it in the release
project.

**`SPEC` in detail.** The spec's output is the issue bodies — this skill never
writes a spec.

- **Invoked with `--spec <path>`:** the spec already exists. **Do not run `/spec`.**
  Read the artifact and continue.
- **Invoked without it:** run `/spec` once, and only after the §2 duplicate search
  has cleared. If `/spec` is unavailable in the current harness, stop and request a
  spec artifact supplied via `--spec`; do not improvise a spec or create partial
  tracker records.

After approval:

- **One meta issue** in the project the contract maps the active milestone to,
  carrying the milestone, the verdict block, the scope citation, and the acceptance
  evidence from `/spec`.
- **Implementation children** with `parentId` set to the meta issue: one per
  independently mergeable PR. If the work is one PR, there are no children — a meta
  issue with a single child is two rows tracking one thing.
- Every child inherits the parent's project. Children start at the contract's
  `unstarted`-type status for the active milestone.
- `dueDate` only if `/spec` produced one. An invented due date is noise the release
  audit will later have to discount.

---

## 4. Relations, labels, and the verdict trail

After the records exist:

- **Dependencies.** Add `blocks` / `blocked by` for real ordering constraints only —
  "B cannot start until A merges". Thematic adjacency is `related to`.
- **Cross-project relevance.** Capability label or relation. Never a second issue —
  the contract's one-primary-project rule. This is the rule most likely to be
  violated under pressure, because a second issue looks like thoroughness.
- **The verdict trail.** Every created or updated issue carries, in its description:
  the `verdict`, the `scope_citation` quoted, and the `reversal_condition`. An issue
  whose scope justification is not in its own body cannot be audited when the
  milestone is questioned three weeks later.

---

## 5. Output

Four lists, and every row carries an identifier and a URL. Identifiers are whatever
the tracker returns (`<PREFIX>-nn`, where the prefix is the workspace's own):

```
Created:   <ID>  <title>                 <why this record exists>
Updated:   <ID>  <field>: <from> → <to>  <why>
Related:   <ID>  <relation> <ID>         <basis>
Unchanged: <ID>  <title>                 <why it was left alone>
```

`Unchanged` is not padding — it is the evidence that the search in §2 ran and that
existing work was respected rather than duplicated.

Then the workspace contract's closing sections: **Unknowns** and at most three
**Next actions**.

---

## Refusals

- **Never perform an independent scope assessment.** No "this seems valuable", no
  "this is smaller than the PM thought". If the verdict looks wrong, say so in one
  sentence in Unknowns and execute it anyway.
- **Never create a ticket before the §2 search has run and been printed.**
- **Never create a separate ticket per relevant project.** One primary project, plus
  labels and relations.
- **Never turn an `OUT` into a backlog feature**, a "small version", a spike, or a
  research issue. `STOP` means no execution ticket, in any disguise.
- **Never write a spec.** `/spec` does that, and only under `SPEC`.
- **Never invent a due date, an estimate, or a priority** that no upstream artifact
  produced.
- **Never write a project, label, or status name that was not resolved from the
  contract or the tracker.** Name resolution fails open; an unresolved name lands as
  a silently unset field on an HTTP 200.
- **Never close an issue into a milestone whose name states a target** unless the
  target was reached — closing the work publishes a number nobody hit.

---

## Acceptance scenarios

| # | Input | Required behaviour |
|---|---|---|
| 1 | `disposition: STOP` on a proposal with an existing decision record | Create nothing. Report the existing record as `Unchanged`. |
| 2 | `disposition: STOP`, no existing record | One completed decision issue carrying the verdict block; **zero** execution tickets |
| 3 | `disposition: EVIDENCE` | One backlog-status issue with the commercial ownership label in the contract's customer-discovery project, titled as a question, with both flip conditions stated |
| 4 | `disposition: BACKLOG` (future milestone) | One backlog-status issue in that milestone's project; no children, no `/spec` run |
| 5 | `disposition: SPEC`, and §2 found an equivalent issue | Stop before `/spec`. Report the equivalent identifier; update it; create nothing |
| 6 | Verdict block missing `scope_citation` | Hard stop; name the missing field; create nothing |
| 7 | `verdict: OUT` with `disposition: SPEC` | Hard stop as malformed; do not execute either half |
| 8 | `disposition: SPEC` with `--spec <path>` supplied, no duplicate found | **`/spec` runs zero times.** One meta issue built from the supplied artifact, plus implementation children only where §3's one-PR-per-child rule yields more than one |
| 9 | `--spec` supplied without `--verdict`, or pointing at a missing file | Hard stop; create nothing. Never fall back to running `/spec` |
| 10 | `workspace_contract` null or unreadable | Refuse, naming the key. Create nothing, and do not guess a project or status name |
| 11 | `scope_doc` null, `disposition: SPEC` | Execute `SPEC`; state in the output that the milestone↔disposition pair could not be checked and why |

---

## Fixture dry run

When this skill directory carries a `fixtures/` set, run it before trusting a
change to this file. It holds one verdict artifact per disposition
(`verdict-stop.yaml`, `verdict-evidence.yaml`, `verdict-backlog.yaml`,
`verdict-spec.yaml`), two malformed ones (`verdict-missing-citation.yaml`,
`verdict-contradictory.yaml`), a persistence-only pair
(`verdict-spec-persist.yaml` + `spec-persist.md`), and `existing-issues.json` — a
frozen issue slice that contains a deliberate near-duplicate of the `SPEC`
fixture's proposal.

Run each fixture with no tracker writes and diff against
`fixtures/expected-actions.md`. The two malformed fixtures must produce a hard stop
and zero proposed writes; the `SPEC` fixture must be caught by the duplicate in
`existing-issues.json` and must not reach `/spec`.

**The recursion assertion.** Run `verdict-spec-persist.yaml` with
`--spec fixtures/spec-persist.md`. Its proposal is deliberately *absent* from
`existing-issues.json`, so the §2 search does not stop it and the run reaches the
`SPEC` branch on its own merits. Assert **`/spec` was invoked zero times** and the
issue bodies came from the supplied artifact. This is the only fixture that
exercises the branch with nothing else stopping it, which is what makes it the
one that can catch the loop.

A fixture set cannot exercise name resolution or the read-back rule — both are
live-tracker paths. The dry run checks the *proposed* writes, not that they landed.
