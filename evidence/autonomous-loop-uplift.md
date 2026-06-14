# Autonomous Loop Uplift

## Date

2026-06-14

## Purpose

Improve `scripts/run-next` so the workflow library chooses the next safe job from ledger state with less prompt babysitting.

## Changes

- Added non-mutating `--explain` mode.
- Made `--dry-run` and `--explain` avoid writing `work-ledger.md` or `runs/skill-runs.md`.
- Added a safe missing-ledger stop when a target repo has no matching ledger item.
- Added routing for `Scheduler migration draft merged, Supabase mutation still gated`.
- Added report fields for whether a job can run now and the next approval command.
- Added optional autonomy metadata to `coding-workflow-orchestrator-skill`.
- Added validator support for optional autonomy frontmatter fields.

## Safety Boundaries Preserved

The runner still refuses missing permissions and preserves gates for secrets, deployment, database mutation, production calls, GitHub merge, npm publish, releases, destructive actions, and target repo cleanup.

## Validation Plan

- `./scripts/validate-skills`
- `./scripts/run-next --repo /home/johnh/wagging-web-wins --dry-run`
- `./scripts/run-next --repo /home/johnh/opstruth/tempo/opstruth --dry-run`
- Strict redacted secret scan over the workflow library

## Result

Validation passed after implementation:

- `./scripts/validate-skills`
- `./scripts/run-next --repo /home/johnh/wagging-web-wins --dry-run`
- `./scripts/run-next --repo /home/johnh/wagging-web-wins --explain`
- `./scripts/run-next --repo /home/johnh/opstruth/tempo/opstruth --dry-run`

Dry-run and explain modes did not update the ledger or run log during validation.
