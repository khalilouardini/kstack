# Review boundaries

Run `python3 -m unittest discover -s tools/github/pr-loop/tests`, or the configured
`python3 bin/check-stack` gate, which includes this suite.

The executable fake CLIs record argv/cwd/token binding and simulate GitHub's
paginated REST responses. Tests cover both directions, provenance and explicit
author exceptions, host-marker mismatch/absence/ambiguity and no delegation,
per-engine flags,
closed stdin, matching submitted review and inline evidence, reuse, missing
CLI/auth, bad credentials, unsupported flags, nonzero/denied/malformed outputs,
remote head movement, and reviewer edits. They also cover the reviewer's scratch
directory: handed to the reviewer outside the repository, removed by the runner
after a verified review (read-only checkout included), kept after a BLOCKED round,
and refused inside the repository; the redacted reviewer streams and the session-log
pointer; and a review posted before a crash, timeout, denial or BLOCKED report,
named in the BLOCKED report and reused at the same head without a launch. `test_shell_snippets.py` runs the
first-review path trigger and the ledger key as `SKILL.md` prints them, and
review-claude-pr's disposable-checkout commands (into `$REVIEW_SCRATCH` when set),
under bash and zsh; a shell that is not installed skips its subtest. No test calls a model or
GitHub.

These checks prove deterministic boundaries, not that a live model can read the
skill, obey the review-only contract, obtain host permissions, review accurately,
or publish a review. The loop's ledger, round cap, graph admission, CI and guarded
fix/commit/push choreography remain prompt-level. Live validation must name its
PR, exact head, actual engine/model, account, review ID and outcome separately.
Do not review unrelated PRs as smoke tests or install this branch globally.
