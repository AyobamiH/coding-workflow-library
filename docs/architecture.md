# Architecture

The coding workflow library is organized around five local layers:

1. Skill files in `skill-files/` define operational procedures that another LLM can follow.
2. Route metadata in `routes/skill-routes.json` maps ledger states to reusable skills, permission flags, helper scripts, forbidden actions, and evidence requirements.
3. Local lane state stores active per-project execution state outside the public package. `schemas/work-lanes.schema.json` defines the portable shape and `templates/work-lanes.example.json` provides neutral example data.
4. `scripts/run-next` selects a route from one explicit lane, or reads historical `work-ledger.md` in backwards-compatible mode, and enforces objective authority before running local automation.
5. Evidence and release helpers validate package contents, routes, skills, runtime claims, and handoff readiness without publishing or mutating remote services unless a specific permission gate allows it.

The library is designed to be portable. Clean-temp smoke tests copy the package candidate into an isolated folder and verify that route audit, validation, package readiness, release preflight, and CLI commands work without hidden local state.

Remote actions are deliberately split from local readiness. A route may prepare a plan, inspect state, or run dry-run checks without becoming permission to publish, deploy, push, tag, run migrations, set secrets, or call production endpoints.

## Objective Authority

The system requests authority for consequences, not permission for every tool call.

Each selected lane can carry one active objective:

```json
{
  "id": "release-example-v1",
  "description": "Prepare and ship a release",
  "status": "active",
  "authority": {
    "local_execution": true,
    "remote_publication": false,
    "production_mutation": false,
    "secret_mutation": false,
    "destructive_action": false
  },
  "checkpoints": {},
  "blockers": []
}
```

Local work proceeds under `local_execution`: source reads, local edits, docs, tests, validation, package dry-runs, clean-temp smoke, local branches, exact-file local commits, and read-only service checks. Child skills and helper scripts inherit the objective envelope; they return structured stage results instead of asking for repeated permission.

External consequence classes are granted once per objective:

- `remote_publication` covers git push, PR mutation, merge, tag push, GitHub Release, npm publish, and public repository settings.
- `production_mutation` covers deploys, database writes, migrations, scheduler/Vault mutation, app-data writes, and production success calls.
- `secret_mutation` covers setting or rotating external secrets.
- `destructive_action` covers force push, history rewrite, deletes, teardown, and destructive migrations.

Blockers are classified independently:

- `BLOCKED_CAPABILITY`: authority exists or is not relevant, but the environment cannot act, such as missing npm auth or missing `psql`.
- `BLOCKED_PERMISSION`: the next consequence crosses an ungranted authority class.
- `BLOCKED_SAFETY`: tests, validation, secret scan, package inspection, repo drift, or idempotency failed.
- `BLOCKED_DECISION`: human judgement is required.
- `WAITING_CONDITION`: CI, scheduled runs, registry propagation, or another future event is pending.

## Runtime Lane State

`work-ledger.md` and `runs/skill-runs.md` remain public historical evidence. New project execution should use a local state file such as `$HOME/.coding-workflow/lanes.json`, or an explicit `--state-file`. Real paths, product evidence, and monitoring baselines belong in that private runtime file and are excluded from package contents.

Only a selected lane may change during a lane-aware run. Dry-runs never update lane state. Objective grants do not leak between lanes. Product monitoring evidence remains local unless it is deliberately sanitised for public documentation.

## Diagnostic Routes

`zero-output-pipeline-investigation` is a lane-scoped read-only route. It composes existing trace, runtime, and error-classification skills with `scripts/pipeline-diagnostics`; the helper remains source-only, while approved adapters may add aggregate database metadata. Product-specific counts and paths remain private lane evidence rather than package content.
