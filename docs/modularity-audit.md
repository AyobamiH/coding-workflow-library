# Source Modularity Audit

## Policy

Hand-written JavaScript and Node scripts are reviewed when they exceed 1,000 lines and fail validation when they exceed 2,200 lines.

```bash
./scripts/check-module-size
./scripts/check-module-size --json
```

Review candidates are not automatic failures. Each candidate must either remain cohesive for a documented reason or yield a focused responsibility extraction. The hard maximum has no allowlist.

## Completed Entrypoint Refactor

The original `scripts/run-next` contained 16,116 lines. The first modular pass reduced it to 1,596 lines and 14 responsibility-owned modules.

The follow-up pass reduced the entrypoint to 964 lines by extracting:

- command-line parsing, help, control-file reads, and lane/ledger selection into `cli-control.js`;
- authority and route-access decisions into `route-access.js`;
- route-kind executor selection into `route-dispatch.js`.

The modular runtime now has 17 modules. Focused module-contract, resume, objective-authority, and lane-isolation tests preserve behavior.

## Current Review Candidates

The following snapshot records files above the review threshold. `scripts/check-module-size --json` is the current source of truth for exact line counts.

| File | Snapshot lines | Disposition |
| --- | ---: | --- |
| `scripts/extract-session-workflows.mjs` | 1,254 | Cohesive extraction, normalization, snapshot, and comparison pipeline. Monitor; split parsers only when a new source format is added. |
| `scripts/lib/run-next/local-foundations.js` | 1,693 | Several local foundation routes share package and validation primitives. Highest non-production candidate for route-family extraction when next modified. |
| `scripts/lib/run-next/observability-routes.js` | 1,565 | Cohesive zero-output and observability lifecycle. Split evidence collection from patch/deploy routing if another observability route is added. |
| `scripts/lib/run-next/release-routes.js` | 1,051 | Cohesive release lifecycle and only slightly above review threshold. Keep together for now. |
| `scripts/lib/run-next/reports.js` | 1,249 | Central report selection remains behaviorally cohesive. Extract report families only when a new family creates repeated branching. |
| `scripts/lib/run-next/runtime-core.js` | 1,020 | Shared runtime primitives are cohesive and barely above review threshold. Keep stable. |
| `scripts/lib/run-next/runtime-routes.js` | 1,253 | Cohesive deploy and bounded runtime-verification lifecycle. Preserve until a distinct runtime domain appears. |
| `scripts/lib/run-next/scheduler-routes.js` | 1,851 | Largest current module and next domain refactor priority. Split monitoring/read-only evidence from Vault/application mutation when this domain changes. |
| `scripts/lib/run-next/supabase-control.js` | 1,617 | Cohesive Supabase control-plane state transitions. Split application decisions from runtime handoff when next modified. |

## Refactor Decision

A repository-wide mechanical split is not justified now:

- no checked file exceeds the hard maximum;
- the entrypoint and dispatch responsibility are now bounded;
- remaining candidates align with recognizable domains;
- broad splitting would increase cross-module coupling without a current behavioral need.

The standing rule is incremental: before adding behavior to a review candidate, inspect its responsibility boundary and extract one coherent concern when the change would make ownership less clear.

## Validation Boundary

The module-size check is part of:

- `npm test`;
- `npm run test:portable`;
- the default pre-commit gate.

JSON output exists for audit automation. Review candidates remain visible without converting a cohesive 1,001-line module into a false failure, while the 2,200-line maximum prevents another monolith.
