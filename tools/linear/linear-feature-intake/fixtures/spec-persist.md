# Daily feedback-volume snapshot

**Verdict:** IN-MVP-1 · **Estimate:** 1 half-day · **Status:** READY
**Serves gate:** MVP-1 — "read an auditable report" survives a host loss only if the
feedback written against it does.
**Scope contract:** §8 — "Snapshot the volume daily — client feedback is the only
unregenerable data in the system."
**Date:** 2026-08-10

> Fixture artifact. It exists so the dry run can assert that a supplied `--spec`
> is *read* rather than regenerated. Its content is representative, not ratified.

## What exists / what's new

Fly.io persistent volume for feedback (§8 deployment shape). No snapshot schedule.

## Acceptance criteria

| # | Criterion | How it's checked | Layer |
|---|---|---|---|
| 1 | A snapshot exists dated within the last 24h | `fly volumes snapshots list <vol>` | e2e |
| 2 | Restoring a snapshot into a fresh volume returns every feedback row | restore, then count rows | e2e |

## False positives

| Looks like success | Actually is | Check that discriminates |
|---|---|---|
| Snapshot job reports success | Nothing was restorable from it | Criterion 2 — restore, do not trust the job's exit code |

## Human judgement required

| Question | Who decides | Against what |
|---|---|---|
| Retention window | Founder | Cost vs the oldest feedback worth keeping |
