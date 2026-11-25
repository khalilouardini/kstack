# Deferred CI — `--defer-ci`

This mode holds opted-in GitHub Actions jobs during review/fix rounds, releases
them once review has no P0–P2 findings, and verifies the resulting run before
`CLEAN`. Local lint/changed-file tests, frontend evidence, the ordinary configured
CI gate and merge authorization still apply. Independent CI providers are not
paused by this protocol.

This mode supports same-repository PR heads. Fork heads are rejected before
label mutations because GitHub can omit their PR association from workflow runs.

## Repository setup

Create the repository label `ci:hold` once as the maintainer. The loop never
creates repository labels. Add `ci.defer` to `.agents/stack.yml`:

```yaml
ci:
  checks: all  # or required; none cannot use --defer-ci
  defer:
    label: ci:hold
    workflows:
      - file: tests.yml
      - file: docs.yml
        paths: ['docs/**', 'mkdocs.yml']  # match this workflow's PR path filters
```

`file` is a unique filename under `.github/workflows/`. Omit `paths` for an
always-applicable workflow. Otherwise copy all supported positive PR file globs
from that workflow; matching includes both sides of a rename. Supported patterns
contain literal text, `*` (one path segment) and `**` (any depth); `**/` also
matches zero directories. Other glob syntax and exclusions are rejected rather
than approximated. The helper verifies complete PR file pagination before selecting
workflows. Every job in a selected released workflow must execute successfully;
do not opt in a workflow with intentionally skipped jobs without adapting it.

Each configured workflow must implement this protocol at the PR head:

```yaml
name: Tests
# kstack-defer-ci: ci:hold
run-name: >-
  ${{ github.event.action == 'unlabeled' && github.event.label.name == 'ci:hold' && format('kstack-ci-release pr:{0} head:{1}', github.event.pull_request.number, github.event.pull_request.head.sha) || github.event.pull_request.title || github.workflow }}
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, unlabeled]
concurrency:
  group: tests-${{ github.ref }}
  cancel-in-progress: true
jobs:
  test:
    if: >-
      github.event_name != 'pull_request' ||
      !contains(github.event.pull_request.labels.*.name, 'ci:hold')
    runs-on: ubuntu-latest
    steps:
      - run: echo 'Replace with the existing test steps'
```

Keep existing job names, steps, permissions, main-branch CI and manual triggers.
Apply the condition to every job being held. With no hold, unrelated label
removals also run CI: skipping those jobs could mask a failure with a successful
skipped check. The release run name distinguishes them for the controller. Use the verified maintainer
token, not an Actions `GITHUB_TOKEN`, for label mutations so release emits its
workflow event. The marker is an explicit adoption contract, not a YAML validator.
Validate the workflow with actionlint when adopting it.

## Controller setup — after all ordinary preflight/binding checks

Reject `--defer-ci` with `ci.checks: none`, missing `ci.defer`, missing repository
label or a workflow without the protocol marker. Do not fall back to ordinary CI
after a deferred-CI failure. Before any round without the flag, inspect PR labels
and the saved state below: a `ci:hold` label or matching-head deferred state
requires resuming with `--defer-ci`. This prevents skipped jobs from satisfying
the ordinary gate after an interrupted run.

Write the exact `ci.defer` mapping as JSON to `$SCRATCH/ci-defer.json`. Use a
durable state path outside the repo, never `$SCRATCH`:

```bash
CI_HOLD_STATE="$STATE_DIR/$OWNER-$REPO-$PR.ci-hold.json"
CI_DEFER_ARGS=(--repo-root "$REPO_ROOT" --owner-repo "$OWNER_REPO" --pr "$PR"
  --maintainer "$MAINTAINER" --config "$SCRATCH/ci-defer.json" --state "$CI_HOLD_STATE")
```

At the start of step 1, after binding its current remote head, run:

```bash
GH_TOKEN="$MAINTAINER_TOKEN" python3 "$STACK_ROOT/tools/github/pr-loop/bin/defer-ci" \
  hold "${CI_DEFER_ARGS[@]}" --head "$HEAD"
```

Run `hold` once per round at its freshly bound remote head, before any reviewer
skip-check or paid launch. `CI_HELD` means the label is verified and existing active runs of
selected workflows associated with this PR were cancelled, including prior
heads. It never cancels main-branch runs or another PR. `CI_RELEASED` means a
same-head retry already released CI: retain the existing review and run evidence.
Nonzero/`BLOCKED` means stop; do not buy a review after a failed hold.

## Review clear — step 3a

Release only after a verified independent review has no P0–P2 findings and the
applicable frontend evidence gate passed:

```bash
GH_TOKEN="$MAINTAINER_TOKEN" python3 "$STACK_ROOT/tools/github/pr-loop/bin/defer-ci" \
  release "${CI_DEFER_ARGS[@]}" --head "$HEAD"
GH_TOKEN="$MAINTAINER_TOKEN" python3 "$STACK_ROOT/tools/github/pr-loop/bin/defer-ci" \
  check "${CI_DEFER_ARGS[@]}" --head "$HEAD"
```

The helper saves the pre-release run IDs **before** deleting
the label, preserving them even if the deletion response is lost. It accepts only
new release-named `pull_request` runs associated with this PR and exact head,
without comparing the controller clock to GitHub timestamps. It
pins each run ID and verifies its workflow path, success conclusion, nonempty
paginated jobs, successful job conclusions and executed steps. A successful
aggregate containing skipped jobs is `BLOCKED`.

`check` returns `CI_PENDING`, `CI_GREEN` or nonzero `BLOCKED` JSON. Poll pending
results with at most 60 seconds between observations, under the
`CI_DEFER_DEADLINE` set by step 3a. The ordinary gate reuses this same `--ci-wait`
deadline. A missing release run waits to that deadline;
never silently dispatch an alternative run or push a trigger commit. Failure,+cancellation, skipped jobs or timeout means `BLOCKED`. `CI_HEAD_MOVED` goes back
to the next bounded round, rebinding the head and acquiring its hold. Do not
release again merely to retry CI.

Only `CI_GREEN` permits continuing to the ordinary step 3a check gate; both must
pass at the same reviewed head. Retain release run IDs/URLs and executed job names
in the final report. The ordinary gate may see skipped checks from earlier held
runs; those are never the deferred gate's evidence.

## Stops and resumes

On a review disagreement, failed local gate, exhaustion or interruption before
release, retain the label and durable state. Report plainly that CI is held and
give the state path and `/pr-loop <PR#> --defer-ci` resume command. Do not remove
the label in an exit trap. An existing hold without this controller's saved state
blocks instead of removing somebody else's hold.

After release, a CI failure/timeout leaves CI released. A same-head rerun reuses
the review and pinned run; a manually rerun GitHub workflow is verified at its
latest attempt. Verified fix commits/new externally reconciled heads acquire a
new hold and require the normal independent review. Saved state is retained for
recovery and reporting. No mode change authorizes a merge.

A later push or label removal can supersede a pinned run through the workflow's
normal concurrency group. Cancellation fails closed as `BLOCKED`; the controller
does not substitute an unrelated run or restart CI automatically.
