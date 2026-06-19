# Architecture

The coding workflow library is organized around four local layers:

1. Skill files in `skill-files/` define operational procedures that another LLM can follow.
2. Route metadata in `routes/skill-routes.json` maps ledger states to reusable skills, permission flags, helper scripts, forbidden actions, and evidence requirements.
3. `scripts/run-next` reads `work-ledger.md`, selects the next route, and enforces permission gates before running local automation.
4. Evidence and release helpers validate package contents, routes, skills, runtime claims, and handoff readiness without publishing or mutating remote services unless a specific permission gate allows it.

The library is designed to be portable. Clean-temp smoke tests copy the package candidate into an isolated folder and verify that route audit, validation, package readiness, release preflight, and CLI commands work without hidden local state.

Remote actions are deliberately split from local readiness. A route may prepare a plan, inspect state, or run dry-run checks without becoming permission to publish, deploy, push, tag, run migrations, set secrets, or call production endpoints.
