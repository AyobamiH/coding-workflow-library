# Architecture

The coding workflow library is organized around five local layers:

1. Skill files in `skill-files/` define operational procedures that another LLM can follow.
2. Route metadata in `routes/skill-routes.json` maps ledger states to reusable skills, permission flags, helper scripts, forbidden actions, and evidence requirements.
3. Local lane state stores active per-project execution state outside the public package. `schemas/work-lanes.schema.json` defines the portable shape and `templates/work-lanes.example.json` provides neutral example data.
4. `scripts/run-next` selects a route from one explicit lane, or reads historical `work-ledger.md` in backwards-compatible mode, and enforces permission gates before running local automation.
5. Evidence and release helpers validate package contents, routes, skills, runtime claims, and handoff readiness without publishing or mutating remote services unless a specific permission gate allows it.

The library is designed to be portable. Clean-temp smoke tests copy the package candidate into an isolated folder and verify that route audit, validation, package readiness, release preflight, and CLI commands work without hidden local state.

Remote actions are deliberately split from local readiness. A route may prepare a plan, inspect state, or run dry-run checks without becoming permission to publish, deploy, push, tag, run migrations, set secrets, or call production endpoints.

## Runtime Lane State

`work-ledger.md` and `runs/skill-runs.md` remain public historical evidence. New project execution should use a local state file such as `$HOME/.coding-workflow/lanes.json`, or an explicit `--state-file`. Real paths, product evidence, and monitoring baselines belong in that private runtime file and are excluded from package contents.

Only a selected lane may change during a lane-aware run. Dry-runs never update lane state. Product monitoring evidence remains local unless it is deliberately sanitised for public documentation.

## Diagnostic Routes

`zero-output-pipeline-investigation` is a lane-scoped read-only route. It composes existing trace, runtime, and error-classification skills with `scripts/pipeline-diagnostics`; the helper remains source-only, while approved adapters may add aggregate database metadata. Product-specific counts and paths remain private lane evidence rather than package content.
