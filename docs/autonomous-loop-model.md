# Autonomous Loop Model

## Purpose

The autonomous loop turns the workflow library into a bounded operator: read one selected project lane (or the legacy ledger), choose the next safe job, check objective authority or legacy permission flags, run only the covered step, record evidence, and stop only at a named external boundary.

## Why Skills Exist

Skills are durable operating procedures. They keep repo mapping, GitHub handoff, Supabase review, deployment planning, validation, and error recovery from being rewritten in every prompt.

## Why This Must Not Need Prompt Babysitting

John should not have to describe the same next-step sequence each time. The ledger already records the current state. `scripts/run-next` should use that state, skill metadata, and permission gates to choose the next safe move or explain exactly why it cannot proceed.

## Core Loop

1. Read `AGENTS.md` and `tools.md`.
2. Select a local project lane, or use the legacy ledger mode when backwards compatibility is required.
3. Map the selected lane or ledger status to a skill, job, and permission.
4. Refuse to act if the required permission flag is missing.
5. Run one bounded step when the route is implemented and permission is granted.
6. Validate evidence.
7. Update only the selected lane after lane-aware real execution; legacy mode updates `work-ledger.md` and `runs/skill-runs.md`.
8. Stop at the next boundary.

Real runs also create a local ignored checkpoint under `.run-next/`. The checkpoint records phase, completed steps, required permission, last verified commit, and stop reason so an interrupted run can be inspected with `--status` and resumed with `--resume --dry-run` before any real continuation.

## Lane State And Historical Ledger

Local lane state owns active multi-project execution state. `work-ledger.md` remains historical public evidence and a backwards-compatible route source. If a requested lane does not exist, `run-next` stops instead of borrowing another lane or repo state.

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

The loop stops when no ledger item exists for the repo, the status is unknown, the route is not implemented, the required authority was not granted, credentials are missing or under-scoped, a safety scan finds a real secret value, repository policy blocks the action, the reviewed head changed, checks are failing or pending, or the next step would cross production, secret, destructive, legal, billing, product, or security boundaries without exact approval. It should not stop merely because a verified workflow-authored PR exists or is ready for normal merge.

Resume mode also stops when the branch changed, tracked files changed unexpectedly, checkpoint state is invalid, or continuing would replay a potentially completed mutation.

## Relationship To OpsTruth

OpsTruth is the public proof product. The workflow library may use OpsTruth as a completion gate or evidence generator, but it must remain a separate private operator system.

## Relationship To Target Repos

Target repos such as Wagging Web Wins are validation targets, not storage for the workflow system. The loop may inspect or operate on a target repo only within explicit permission gates and must preserve local-only evidence/temp paths.
