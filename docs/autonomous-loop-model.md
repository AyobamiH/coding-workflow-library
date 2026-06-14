# Autonomous Loop Model

## Purpose

The autonomous loop turns the workflow library into a bounded operator: read the ledger, choose the next safe job, check permission flags, run only the covered step, record evidence, and stop at a real John-required boundary.

## Why Skills Exist

Skills are durable operating procedures. They keep repo mapping, GitHub handoff, Supabase review, deployment planning, validation, and error recovery from being rewritten in every prompt.

## Why This Must Not Need Prompt Babysitting

John should not have to describe the same next-step sequence each time. The ledger already records the current state. `scripts/run-next` should use that state, skill metadata, and permission gates to choose the next safe move or explain exactly why it cannot proceed.

## Core Loop

1. Read `AGENTS.md`, `tools.md`, and `work-ledger.md`.
2. Find the latest ledger item for the requested repo.
3. Map the ledger status to a skill, job, and permission.
4. Refuse to act if the required permission flag is missing.
5. Run one bounded step when the route is implemented and permission is granted.
6. Validate evidence.
7. Update `work-ledger.md` and `runs/skill-runs.md` only after real execution.
8. Stop at the next boundary.

## Ledger as Source of Truth

`work-ledger.md` owns active work state. If a target repo has no ledger item, `run-next` must stop and ask for a ledger entry instead of borrowing another repo's latest state.

## Skill Frontmatter as Router

Skill frontmatter can declare:

- `handles_state`
- `requires_permission`
- `safe_by_default`
- `mutates`
- `reads`
- `writes`
- `evidence`
- `stop_conditions`

These fields help the runner and humans understand routing without reading the full skill body first.

## Permission Flags

Permission flags are explicit gates. A ledger state can suggest a job, but it does not authorize the job. `--allow <permission-name>` is still required for real execution.

## Evidence Requirements

Each real run must record detected repo, current ledger state, selected skill/job, required permission, commands run, files changed, validation evidence, stop reason, and next exact command or approval.

## Stop Conditions

The loop stops when no ledger item exists for the repo, the status is unknown, the route is not implemented, the required permission was not granted, credentials are missing or under-scoped, a safety scan finds a real secret value, or the next step would cross a deploy/database/production/release boundary without explicit permission.

## Relationship To OpsTruth

OpsTruth is the public proof product. The workflow library may use OpsTruth as a completion gate or evidence generator, but it must remain a separate private operator system.

## Relationship To Target Repos

Target repos such as Wagging Web Wins are validation targets, not storage for the workflow system. The loop may inspect or operate on a target repo only within explicit permission gates and must preserve local-only evidence/temp paths.
