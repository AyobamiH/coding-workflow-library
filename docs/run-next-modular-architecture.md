# Run-Next Modular Architecture

## Purpose

`scripts/run-next` is the executable control-plane entrypoint for route selection, objective authority, bounded execution, checkpoints, and evidence-backed reporting.

Before this architecture was introduced, the entrypoint contained 16,116 lines spanning local foundations, release handling, GitHub, Supabase, scheduler, observability, reports, and checkpoint storage. That made changes difficult to review and made interrupted work depend on understanding one oversized file.

The modular architecture preserves the existing route and authority behaviour while separating implementation by responsibility.

## Entrypoint Contract

The entrypoint owns:

- environment-independent constants;
- selection of the target repo or lane;
- composition of runtime modules;
- top-level error and exit handling.

Command-line parsing, route-access decisions, and route-kind dispatch are separate structural modules. The entrypoint must not absorb product executors, specialised report renderers, database helpers, GitHub workflows, scheduler logic, or another long executor chain.

## Module Ownership

| Module | Responsibility |
| --- | --- |
| `runtime-context.js` | Internal dependency composition and lazy function lookup |
| `cli-control.js` | Argument parsing, help, control-file reads, and lane/ledger work-item selection |
| `route-access.js` | Authority checks, stop-boundary decisions, and next-approval classification |
| `route-dispatch.js` | Declarative route-kind to executor dispatch |
| `runtime-core.js` | Process execution, sanitisation, Git helpers, shared runtime utilities |
| `checkpoints.js` | Secret-free interrupted-run checkpoint creation, status, and resume support |
| `reports.js` | Route-specific human report selection and rendering |
| `local-foundations.js` | Verification bundles, package smoke, docs, repo-map, project-KB, migration, and local foundations |
| `release-routes.js` | Versioned release preparation and publication route execution |
| `github-routes.js` | GitHub handoff, PR readiness, merge, and scheduler PR route execution |
| `github-support.js` | Shared GitHub inspection, scope, commit, and PR metadata helpers |
| `supabase-control.js` | Supabase route orchestration and bounded control-plane decisions |
| `supabase-auth.js` | Supabase local auth, link, secret-file, and repository evidence helpers |
| `supabase-planning.js` | Deployment, tooling, scheduler, and application planning evidence |
| `runtime-routes.js` | Function deployment and bounded runtime verification routes |
| `scheduler-routes.js` | Scheduler, Vault, monitoring, and read-only database evidence routes |
| `observability-routes.js` | Zero-output and production-observability investigation routes |

## Runtime Composition

Modules receive immutable-at-load configuration and shared state through `runtime-context.js`.

`runtime.pick()` resolves constants and state needed when a module loads. `runtime.lazy()` resolves cross-module functions when they are called, after every module export has been registered. This avoids a second copy of route logic while keeping cross-module dependencies explicit and testable.

`tests/run-next-modules.test.js` verifies that:

- the modular directory exists and contains the required structural modules;
- product executors and specialised reports do not leak back into the entrypoint;
- every lazy dependency resolves to an exported module function or entrypoint function;
- every entrypoint module call references an exported function;
- missing runtime dependencies fail with a clear error.

## Source-Size Boundary

Modularity is a repository rule, not a one-time refactor.

- Review a hand-written source file when it reaches 1,000 lines.
- Explain why it remains cohesive or extract a focused responsibility.
- `scripts/check-module-size` enforces a 2,200-line hard maximum.
- `scripts/check-module-size --json` exposes review candidates for deterministic audit tooling.
- The checker scans JavaScript and Node scripts recursively under `bin/`, `scripts/`, and `tests/`.
- Generated output, dependencies, caches, builds, coverage, and private `.run-next` state are excluded by directory boundary.
- Do not add a hand-written-file allowlist to bypass the limit.

The check runs through `npm test`, `npm run test:portable`, and the default pre-commit gate.

## Adding Or Changing A Route

1. Confirm the route belongs in the workflow library and identify its authority boundary.
2. Add or update route metadata in `routes/skill-routes.json` when the workflow is reusable.
3. Put execution logic in the existing responsibility-owned module.
4. Add a new module only when the responsibility is distinct and would otherwise create coupling or repeated logic.
5. Keep the entrypoint change to dispatch or composition.
6. Export shared helpers once and use `runtime.lazy()` for cross-module calls.
7. Preserve `--dry-run`, checkpoint, lane isolation, redaction, and blocker semantics.
8. Extend focused tests, then run resume and objective-authority regression tests.
9. Run `scripts/check-module-size` and recursive syntax validation.

## Behaviour Boundaries

The split does not change:

- route names or legacy `--allow` compatibility;
- objective authority classes;
- local lane isolation;
- permission, capability, safety, decision, or waiting blocker meanings;
- secret redaction;
- production or remote consequence gates;
- dry-run immutability;
- checkpoint and resume semantics.

It is not a migration to planner, worker, reviewer, agent-swarm, generic capability-broker, or automatic plugin acquisition architecture.

## Remaining Maturity Gaps

The modular split enabled the safe skill-gap recorder, read-only autonomy outcome reporting, and observed three-repository proof without broadening route authority. The next gap is exact-commit remote proof for the existing Linux, macOS, and Windows portable matrix. Optional secret-manager work remains held behind a separate non-printing contract and authority decision.

See `docs/modularity-audit.md` for current review candidates and `docs/workflow-maturity-foundations.md` for the completed reliability contracts.
