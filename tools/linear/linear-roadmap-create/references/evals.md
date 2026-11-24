# Evals for every roadmap ticket

An eval must make it possible to tell whether the ticket's promised outcome was
achieved. Choose the cheapest credible check: existing unit/integration tests,
a new eval script, a reproducible session-local experiment, or a documented human
rubric. Do not require a permanent harness for a one-off check. Prefer measurable
behavior to implementation trivia; count-based tests need a meaningful denominator.

## Required contract

Put this information in each ticket's **Evals** section and the local JSON:

| Field | Required substance |
| -- | -- |
| `claim` | The observable outcome this eval tests; tie it to a requirement. |
| `method` | Unit/integration test, benchmark, session protocol, document review or other concrete method. |
| `inputs` | Fixture/dataset IDs, selected cases, environment and relevant versions; include adverse/empty/error cases where the claim needs them. |
| `baseline` | Current measurement or comparison revision, or why no baseline applies to this invariant. Never invent measured values. |
| `procedure` | Exact existing command or reproducible steps, setup and teardown. Mark a new test/script as planned, include its intended invocation, and make implementing it part of this ticket. |
| `pass_condition` | Metric with unit, population/denominator and threshold, or an explicit observable pass/fail rubric. No "improves", "works well" or "tests added" as the criterion. |
| `threshold_source` | Requirement, owner decision or rationale for a proposed threshold; its `status` is `accepted` or `proposed`. Proposed criteria remain visible and cannot pass an admission/release decision requiring acceptance. |
| `evidence` | Where to retain command/protocol, revision, environment, inputs/digests, timestamp, raw observations, result and reviewer when needed. A session log is sufficient when durable and linked from the ticket. |
| `failure_check` | Negative control, adverse case or regression that exposes a misleading PASS; explain a risk-based exception when a separate control adds no useful evidence. |
| `runner` | Responsible actor/role for execution and independent review where needed. Resolve any missing human decision-maker before admission. |

Each eval also has a stable `id`. In JSON, `threshold_source` is an object with
`status` (`accepted` or `proposed`) and `source` (decision/requirement/rationale).
Required fields must carry concrete content,
not placeholders or links to an unspecified future eval. A shared protocol may
be referenced by exact section/version, but each ticket still states its own
inputs, claim and pass condition. Future implementation has no PASS result yet.

## Frontend review evidence

During roadmap creation, give every ticket a `frontend` boolean in JSON and
record the classification in its Linear body. Set it to `true` when the ticket
changes user-visible UI or owns acceptance of changed UI, including mixed
frontend/backend tickets. A container merely grouping frontend children does
not need its own demo; each frontend child does.

Every frontend ticket requires `frontend_review` with an `eval_id` referencing
one of its own evals and `modes` containing `localhost`, `screenshots`, or both.
The referenced eval uses the normal contract fields above:

- `procedure` gives setup/start commands, fixture/account prerequisites, the
  localhost URL/route and reproduction steps for a demo; for screenshots it
  specifies how to reach and capture the changed screens/states. Resolve proposed
  commands and routes against the consuming repo before publishing them as verified.
- `inputs` names representative data, changed states, viewport(s) and relevant
  loading/empty/error states. Include before/after comparison when it helps
  explain a visual change.
- `pass_condition` states what the reviewer must see or do to verify the promised
  outcome, including relevant interaction and responsive behavior. Choose a
  localhost demo when screenshots cannot demonstrate the claimed interaction;
  screenshots alone can support a visual claim.
- `evidence` names a durable destination linked from the ticket and PR (when
  present) for demo instructions/observations and/or screenshots. Retain the
  evaluated revision, environment, route, state, viewport, timestamp and result,
  so the reviewer can identify what changed and reproduce or inspect it.
- `runner` names who produces the evidence and who reviews it.

Write the chosen modes, eval and evidence destination into the ticket's **Evals**
section and project roadmap coverage matrix. The final implementation handoff
must supply the demo and/or screenshots from the implemented revision before
requesting review or treating the frontend outcome as complete. A localhost URL
alone is insufficient for a reviewer on another machine: include reproducible
startup/navigation instructions, or retained screenshots. Tests and CI remain
part of verification; passing them alone does not satisfy this review evidence.

Roadmap creation plans this future handoff; it does not run the app or fabricate
screenshots. Missing visual evidence remains NOT_RUN or BLOCKED at execution.
The checker validates the classification, modes and eval reference structurally;
correct classification, useful visuals and the completed handoff are prompt-level.

## Match the check to the level

- **Implementation unit:** assert behavior through a real consumer/interface.
  Include relevant negative/error cases and regressions. A fixture proving the
  new branch of code executes is insufficient when the claim is end-to-end
  correctness, retrieval quality or performance.
- **Eval infrastructure:** test the evaluator itself against known-good and
  known-bad controls. Creating the evaluator and executing the domain benchmark
  are distinct deliverables; name both owners and prerequisites.
- **Scope or ADR ticket:** verify every affected normative section and current
  summary agrees with the cited decision; unchanged invariants still hold,
  contradictory language is reconciled, and the required owner disposition is
  recorded. "Document written" does not pass it.
- **Decision ticket:** name evidence, alternatives and a decision-maker. Closure
  with a NO/DEFER outcome never satisfies a dependency requiring YES. An agent's
  recommendation is not the human decision.
- **Parent/container:** check outcome-to-child coverage, dependencies, scope and
  doc alignment, and links to child/gate evidence. Give it no implementation
  session; its bookkeeping completion cannot certify the release.
- **Release gate:** run the integrated feature at a named revision/environment
  on the required population. Specify regression, failure/partial-result and
  operational checks relevant to the outcome, evidence and signoff owner.
  Passing unit tests or merging every child cannot substitute for this eval.

## Quantitative and model-based evals

Freeze the cohort, denominator, expected labels/rubric and baseline before work
that might tune against them. Separate development fixtures from held-out release
cases when generalization is claimed. State who labels/reviews and how disputes
are resolved. For model judges, pin prompt/model/rubric and calibrate against
human-labeled positive and negative controls; a model grading its own prose is
not independent evidence.

Ask how the check could pass while the product is broken. Countercheck the real
entry path and served population; for example, an authorization check must also
prove an authorized control succeeds, so a broken route returning 404 to everyone
cannot pass. A CLI-only proxy cannot certify a feature promised to app users.

Report per-case and per-stratum results as well as aggregates. Include failures,
timeouts, abstentions and censored attempts in the declared population; account
for exclusions rather than dropping hard cases. Specify repeats/uncertainty for
stochastic comparisons when relevant. Keep coverage, quality, latency and actual
cost separate; a cheaper run that omits the work has not improved cost efficiency.
Use a baseline/decision ticket when the required threshold cannot yet be justified.
Do not invent a percentage just to make a ticket look measurable.
An unknown metric outside the admitted outcome is an exclusion or optional proposal,
not an automatic new ticket or release blocker. Measurement requirements must not
silently broaden the roadmap's product scope.

A measured current limitation can be accepted only through an explicit recorded
decision. Keep the original criterion, measurement and waiver/change separate.
Criteria changed after seeing results require a versioned rationale and recheck
of the affected gate; the old run does not retroactively become PASS.

## Execution evidence and closure

Respect the consuming repo's verification commands and resource policy, including
CI-owned full suites. Do not launch expensive/live/production evals while creating
the roadmap. Name any permissions, cost caps and prerequisites for future runs.

Future results distinguish NOT_RUN, PASS, FAIL and INCONCLUSIVE/BLOCKED. Preserve
raw failures and missing evidence. Evidence must correspond to the evaluated
revision and relevant configuration; a changed behavior, corpus, dependency or
criterion invalidates the affected result until rechecked. Keep unaffected evidence.
An owner waiver is an accepted exception, not a passing measurement. The workspace
contract controls status changes; the roadmap must still distinguish merged code,
executed unit evals, integrated evidence and release authorization.
