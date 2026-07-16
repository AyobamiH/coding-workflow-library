# Source Modularity Audit

## Policy

Hand-written JavaScript and Node scripts receive an early cohesion review above 750 lines and fail validation above 1,000 lines.

```bash
./scripts/check-module-size
./scripts/check-module-size --json
```

Review candidates are not automatic failures. Each candidate must remain cohesive for a recorded reason or yield a focused responsibility extraction. The hard maximum has no allowlist.

## Completed Refactors

The original `scripts/run-next` contained 16,116 lines. Earlier passes reduced the entrypoint to 964 lines and separated CLI control, authority, dispatch, domain execution, reports, and checkpoints.

The 2026-07-16 cohesion pass removed every former 1,000-line review candidate:

- eight domain modules became thin compatibility facades over twenty responsibility-labelled parts;
- cross-part calls remain explicit through the existing lazy runtime registry;
- the session-workflow extractor became a thin CLI facade over `core.mjs`, `corpus.mjs`, and `snapshot.mjs`;
- focused extraction, module-contract, resume, route, and authority tests preserve behaviour;
- all checked source files now remain below the 1,000-line hard maximum.

## Current Review Candidates

The following files exceed the 750-line early-review threshold but remain below the hard maximum. `scripts/check-module-size --json` is the source of truth for current counts.

| File | Responsibility decision |
| --- | --- |
| `scripts/run-next` | Composition, runtime registration, checkpoint loop, and top-level dispatch remain together; product executors stay outside it. |
| `scripts/browser-live-proof` | One bounded browser evidence contract; split capture transport from classification if another browser engine is added. |
| `scripts/lib/run-next/github-routes.js` | Cohesive GitHub handoff and PR lifecycle; extract a route family before adding another GitHub consequence path. |
| `scripts/lib/run-next/github-support.js` | Shared GitHub evidence and exact-file support primitives; keep central until a distinct provider boundary appears. |
| `scripts/lib/run-next/supabase-auth.js` | Cohesive local auth/link/readiness evidence with one redaction boundary; split before adding another authentication mode. |
| `scripts/lib/run-next/supabase-planning.js` | Read-only deployment and scheduler planning evidence; keep separate from mutation executors. |

## Composition Rules

- Facades preserve stable import paths and contain no route implementation.
- Part modules own named responsibilities and carry a short orienting comment.
- `runtime.lazy()` is used only for cycle-safe cross-part calls after all exports are registered.
- Workflow extraction separates argument/redaction primitives, corpus parsing, and snapshot validation.
- A split must preserve privacy, dry-run, lane isolation, authority, and evidence semantics.
- New work must not raise the hard maximum or add a hand-written-file exemption.

## Validation Boundary

The module-size check runs through:

- `npm test`;
- `npm run test:portable`;
- the default and staged pre-commit gates.

JSON output supports deterministic audit tooling. The 750-line warning provides extraction lead time, while the 1,000-line hard failure prevents another monolith.
