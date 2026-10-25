# Shared engine, authorship, and evidence contract

Read this in pr-loop, review-claude-pr, and review-comments after selecting an
exact PR. Resolve scripts relative to this physical kstack checkout, following
installed symlinks or generated pointers; never edit adapters or install from an
unmerged branch. The historical skill name review-claude-pr is retained.

## Resolve once, verify again at each head

`identities.reviewer` and `identities.implementer` name the default accounts.
`review_engines.reviewer` / `review_engines.implementer` map them to engines,
respectively `codex` / `claude` when missing or null. Require both engines,
distinct accounts, and a separate maintainer. Never guess engines from login
spelling, branch names, PR prose, push actors, or which host invoked the skill.

Standalone/controller bootstrap reads use the verified maintainer token. A
child reviewer with a parent-pinned route uses its supplied verified reviewer
token for bootstrap and re-resolution. Set BOOTSTRAP_TOKEN to that token in a
child, or to MAINTAINER_TOKEN standalone; the child never obtains a maintainer
credential. Then use the resolved role
for subsequent credentials. Never switch global gh auth. For an exact PR:

```bash
GH_TOKEN="$BOOTSTRAP_TOKEN" gh api "repos/$OWNER_REPO/pulls/$PR" > "$SCRATCH/pr.json"
GH_TOKEN="$BOOTSTRAP_TOKEN" gh api --paginate --slurp \
  "repos/$OWNER_REPO/pulls/$PR/commits" > "$SCRATCH/commits.json"
python3 "$STACK_ROOT/tools/github/pr-loop/bin/resolve-route" \
  --maintainer "$MAINTAINER" --reviewer "$DEFAULT_REVIEWER" \
  --implementer "$DEFAULT_IMPLEMENTER" \
  --reviewer-engine "$DEFAULT_REVIEWER_ENGINE" \
  --implementer-engine "$DEFAULT_IMPLEMENTER_ENGINE" \
  --pr-json "$SCRATCH/pr.json" --commits-json "$SCRATCH/commits.json" \
  "${AUTHOR_ARGS[@]}" > "$SCRATCH/route.json"

# Read resolved fields as data; never source or eval route.json.
route_field() {
  python3 -c 'import json,sys; value=json.load(open(sys.argv[1]))[sys.argv[2]]; assert isinstance(value,str); print(value)' \
    "$SCRATCH/route.json" "$1"
}
REVIEWER=$(route_field reviewer)
IMPLEMENTER=$(route_field implementer)
REVIEWER_ENGINE=$(route_field reviewer_engine)
IMPLEMENTER_ENGINE=$(route_field implementer_engine)
```

`AUTHOR_ARGS` contains only this invocation's explicit
`--implementation-engine codex|claude` and `--any-author`, if present. Parse JSON,
never source/eval it. Any failed read or resolver error is BLOCKED, not a default
route. The commit count must match REST PR metadata and contain its exact head.

Evidence, in order:

1. Complete PR commits: configured account authors map through review_engines;
   whole-line `Co-Authored-By: Codex … <email>` or `Co-Authored-By: Claude … <email>`
   attribution also identifies the engine. The exact historical `claude` author
   login remains supported. A prose mention or similarly spelled bot does not.
2. Only with no commit signals: a configured bot PR opener supplies legacy
   evidence. The maintainer opener never identifies an engine. Commit evidence
   wins over a differently attributed opener, who may only have published it.
3. One evidenced engine selects the route automatically. Mixed engine commits
   require an explicit `--implementation-engine` selecting an evidenced engine.
   This names the session responsible for fixes; it does not relabel other
   commits. An explicit engine contradicting the sole evidence blocks.
4. No evidence requires both explicit engine selection and `--any-author`.
   Engine selection alone is not authorship authorization, and `--any-author`
   alone cannot guess an engine. For a standalone reviewer, an explicit user
   request to review the exact PR despite its author can supply the authorship
   exception; it still needs engine selection. Record the exception.

Use the returned reviewer/implementer accounts and engines for every credential,
filter, label, reply and delivery check. Never reload the configured default
roles after resolution. Pin the result for each head; pass its `resolution`
options to child skills, recompute from fresh complete evidence, and compare.
A changed route before any write blocks. The next guarded implementation head
gets a new route artifact; preserve the same explicit engine selection.

Authorship is accident prevention, not cryptographic attestation: trailers can
be forged. Git commit author, model doing the work, and account publishing a PR
or review are different facts. Do not change global git author configuration.
Implementation commits should carry truthful Codex/Claude attribution so future
maintainer-opened PRs retain machine-readable provenance.

Standalone review-comments retains its existing null-role fallbacks: null
implementer uses the maintainer, null reviewer uses the configured implementer,
without reversal or engine inference. Report that automatic routing is unavailable.
Those fallbacks are forbidden in the full loop. Standalone review with missing
roles blocks and names the missing key; an author exception does not invent accounts.

## One implementation controller

The host running pr-loop must be the resolved implementation engine. The
controller detects Codex from `CODEX_SESSION_ID` or `CODEX_THREAD_ID`, and
Claude Code from `CLAUDE_CODE_CHILD_SESSION=1` in the shell launched by that
host. Missing or simultaneous markers block. A Codex implementation stays in
Codex and launches Claude only for review. A Claude implementation stays in
Claude and launches Codex only for review. Run `bin/require-controller-host`
against the pinned route before ledger creation, and recheck inside
`bin/run-review` before any GitHub or model call. **Do not automatically
delegate the whole loop.** The user can invoke it in the correct existing
session. Child reviewers may not invoke pr-loop or review-comments. This bounds
handoffs to zero and prevents recursive controllers. Environment markers guard
accidental host confusion; they are not cryptographic identity proof.
The standalone reviewer requires the actual host to equal reviewer_engine;
review-comments requires implementer_engine before edits/replies.

## Model and launch contract

Codex preserves review_model defaults, first-review risk escalation, and --fast.
Claude uses claude_review_model.slug/effort, defaulting to sonnet/high. Explicit
--model/--effort override the selected engine only. Reject GPT settings and --fast
for Claude; never pass Codex service-tier or reasoning flags to it. A model alias
is reported as requested, not claimed to be an immutable model revision.

Use `tools/github/pr-loop/bin/run-review` for a loop's review/reuse step:

```bash
python3 "$STACK_ROOT/tools/github/pr-loop/bin/run-review" \
  --repo-root "$REPO_ROOT" --owner-repo "$OWNER_REPO" --pr "$PR" --head "$HEAD" \
  --route "$SCRATCH/route.json" \
  --skill "$REVIEW_SKILL" --model "$MODEL" --effort "$EFFORT" \
  --report-dir "$SCRATCH/round-$N" "${REVIEW_ARGS[@]}" \
  > "$SCRATCH/round-$N.json"
```

REVIEW_SKILL is the readable canonical absolute review-claude-pr/SKILL.md path,
not a generated pointer. REVIEW_ARGS contains --fast only for Codex when asked.
Use a new report directory outside the consuming repository. Check exit status
and parse JSON: FINDINGS or REVIEW_CLEAR is review evidence, **never CLEAN**.
A nonzero status, invalid JSON or missing result blocks. Keep reports private;
never print tokens, raw child logs or credential-bearing environments.

The helper verifies live route/head, per-command reviewer identity, complete
review and inline-comment pagination, required CLI flags, exit status and final
GitHub evidence. Claude runs with its normal `auto` permission classifier and
no interactive responder; any denied tool call blocks the round. It closes stdin
and passes prompts as argv, never shell code.
It captures Claude JSON and Codex's output-last-message report, checks Claude's
success envelope/permission denials and the final structured report
(REVIEW_SUBMITTED, review_id, head) from either engine. It checks repository
status/HEAD afterward. A prose “done” is not a report.
The reviewer no-write boundary is still prompt-level: the status check detects
changes after the fact, not sandbox isolation or all possible side effects.

Verified local CLI surfaces: Claude Code 2.1.290 and codex-cli 0.160.1. Claude
uses `--print --output-format json --permission-prompts none --model ... --effort
...`, after `claude auth status` reports loggedIn. Exact-head reuse does not need a
model login or installed model CLI, only verified GitHub evidence. Codex uses `exec -C ... -o ...
-m ... -c model_reasoning_effort=...`, with the existing optional fast settings.
Both inherit host permissions. No sandbox bypass, auto-approval permission mode,
or fallback engine is selected. A denied operation or unavailable required flag
means BLOCKED; establish permissions through the normal host flow before retrying.
Unsupported models are caught by the CLI's checked exit, not silently substituted.
Because stdin is closed and permission prompts have no interactive host, required
GitHub reads/posting and proof commands must already be permitted by the host.
A denial is a rollout blocker: approve the concrete operation through the normal
Claude permission flow before retrying. Never add a broad allowlist or bypass
permissions to turn a blocked run green.

## Submitted evidence and reuse

Reviewer labels derive from actual engines: Codex / Claude. Reviews contain
`**Review performed by Codex.**` or `**Review performed by Claude.**`, and the exact
whole marker `<!-- codex-review head:<full-sha> -->` or its claude-review equivalent.
Submit with `commit_id` explicitly set to the reviewed head. Re-read the head
immediately before posting and afterward; drift never certifies the new head.

Only submitted COMMENTED or CHANGES_REQUESTED reviews by the resolved account,
with matching engine marker, attribution and commit_id, count. PENDING,
DISMISSED, APPROVED, other accounts/engines, stale heads and conversation comments
do not. Paginate every connection. Choose the latest qualifying review and read
its inline findings too. A marker alone, missing verdict, malformed findings,
contradictory "No findings.", failed CLI or absent review blocks; it is not clean.
Use the canonical numbered finding format in review-claude-pr. Inline findings
start with `[P0]`–`[P3]` and a title; do not omit them from the summary.

Reuse remains account + engine + exact SHA scoped. The helper never reports
CLEAN; pr-loop still applies its durable finding ledger, bounded rounds,
implementation and push guards, graph admission, current CI policy, and final
head recheck even for ci.checks:none. Those controller steps remain prompt-level.
Report route/provenance, actual reviewer engine and posting account separately,
requested model/effort, review URL/ID/head, reuse and CLI status, and CI evidence.

When the controller carries `--review-slots N`, pass it to every `run-review`
invocation. The permit covers only the paid CLI process; its post-wait exact-head
and reuse checks prevent a queued call from blindly repeating a finished review.
The loop keeps its same controller and round ledger while other tickets use the
permit during its fix or CI phases. Do not wrap the entire pr-loop in this permit.
