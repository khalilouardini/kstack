# Resolve the PR roles before credentials or model selection

Read this contract in `pr-loop`, `review-claude-pr`, and `review-comments` once
an exact PR is resolved. Paths here are relative to this canonical skill,
not the consuming repository or a generated Codex pointer.

`identities.reviewer` and `identities.implementer` are the **default** pairing.
`review_engines.reviewer` and `review_engines.implementer` identify the engines
behind those accounts, defaulting to `codex` and `claude` respectively for
existing configurations. Only those two engines are supported; require distinct
bot accounts, distinct engines, and a separate maintainer. Never infer an engine
from a login's spelling.

Read the actual PR `author.login` with the verified maintainer credential (or
the configured reviewer credential for a standalone review). Run
`tools/github/pr-loop/bin/resolve-route` (resolved from this KStack checkout) with `--maintainer`, `--reviewer`, `--implementer`,
`--author`, `--reviewer-engine`, and `--implementer-engine`, using these configured
values. Parse its JSON; do not evaluate it as shell code. Nonzero exit → stop.

- PR author is the configured implementer → keep the default pairing.
- PR author is the configured reviewer → swap both accounts **and engines**.
- Author is neither → keep the default pairing and enforce the invoking skill's
  existing authorship rules. `author_matched: false` is not authorization.
  Commit authorship may admit a legacy PR, but never overrides a matched PR
  author. A push actor, branch name, or PR comment cannot select a route.

Use the result as `$REVIEWER`, `$IMPLEMENTER`, `$REVIEWER_ENGINE`, and
`$IMPLEMENTER_ENGINE` everywhere thereafter, including token lookup, attribution,
authorship checks, bot-noise filtering, replies, and delivery verification.
Every later `<identities.reviewer>` / `<identities.implementer>` placeholder
means this resolved value; never reload the default and undo the route. Do not
modify stack.yml, global gh state, or git author settings. Recompute in child
processes from configuration and live PR metadata; the parent passes the
expected route in its prompt and the child stops if its result differs.

Standalone `review-comments` with a null implementer retains its documented
maintainer fallback and does not call this resolver. If only the reviewer is null, standalone
`review-comments` retains the configured implementer and its existing behavior
without reversal; the full loop still refuses missing roles. `pr-loop` never allows
that fallback. Standalone review requires all identities for routing.

## The loop runs in the implementation engine

Resolve `REPO_ROOT`, the canonical loop path, and a temporary `REPORT` path
before delegation; verify the implementer credential and CLI.
Before starting the ledger, round counter, or review, ensure the host running
`pr-loop` is `$IMPLEMENTER_ENGINE`. If it is already that engine, continue.
Otherwise delegate the **whole loop once** to that engine in the PR worktree,
using the installed `pr-loop` contract (or its verified canonical absolute
path), the exact PR number, and all original options. Await its result and
return it; the parent must not also execute rounds or fixes. Include the
expected route and "delegated once; stop on host/route mismatch" in the prompt.
Do not translate reviewer `--model` into the implementation process's model.
The implementation process inherits its host model configuration.

For Codex use `codex exec -C "$REPO_ROOT" -s danger-full-access -o "$REPORT"
"$LOOP_PROMPT" < /dev/null`. For Claude use `(cd "$REPO_ROOT" && claude -p
--permission-mode auto --output-format text "$LOOP_PROMPT" < /dev/null >
"$REPORT")`. Bind the verified implementer token through `GH_TOKEN` for that
process only. Check exit status and read the report. A missing CLI, denied tool
permission, or absent report is `BLOCKED`; never fall back to the other engine.
These permission modes do not override host policy. Do not weaken policy on a
failure. Run each agent in a separate process; never review your own fixes.

## Reviewer model and invocation

For a Codex reviewer, use the main skill's existing `review_model` resolution,
escalation, and `--fast` handling. For a Claude reviewer, skip that entire Codex
model block: use `claude_review_model.slug` (default `sonnet`) and
`claude_review_model.effort` (default `high`). `--model` and `--effort` override
the selected engine's settings; validate them against that CLI. No GPT slug or
Codex escalation setting is passed to Claude. Reject `--fast` for Claude before
any paid round because it is a Codex-only option.

Resolve the reviewer skill to a readable **canonical absolute path** before
launching. Follow generated pointers to that path; both engines use the same
`review-claude-pr` contract despite its historical name. Set `REVIEW_PROMPT` to
instruct the child to read that path, review the exact PR, verify the expected
route, and post its findings. Pass paths and prompts as quoted arguments.

Codex uses the main skill's invocation with `"$REVIEW_PROMPT"` as its prompt.
Claude uses:

```bash
(cd "$REPO_ROOT" && GH_TOKEN="$REVIEWER_TOKEN" claude -p \
  --permission-mode auto --output-format text \
  --model "$MODEL" --effort "$EFFORT" \
  "$REVIEW_PROMPT" < /dev/null > "$SCRATCH/claude-round-$N.txt")
```

Verify required flags with the installed CLI's `--help`; unsupported options,
permission denials, nonzero exits, or no submitted review → `BLOCKED`, with no
blind retry or engine substitution. Reviewer repository writes remain a
**prompt-level** prohibition, as in the existing Codex review contract.

## Attribution, reuse, and reporting

Set `$REVIEWER_LABEL` to `Codex` or `Claude` from the engine, and
`$REVIEW_MARKER` to `codex-review` or `claude-review`. Every review uses that label
and `<!-- <review-marker> head:<full-head-sha> -->`. Preserve existing
`codex-review` markers for compatibility. Never label a Claude review as Codex.

For skip-checks and finding retrieval, paginate submitted reviews and accept a
marker only from `$REVIEWER`, with the current engine's marker and exact head
SHA, in a non-PENDING review. Another account's marker or the other engine's
review does not satisfy this route. Conversation comments cannot satisfy the
loop's completed-review gate. Read findings from that verified GitHub review;
a CLI's prose alone cannot establish `CLEAN`.

Keep the existing per-PR answered-findings ledger across both routes. Report the
resolved implementation engine/account and review engine/account, model/effort,
and the usual verdict, gates, and round count. Merge remains maintainer-only.
