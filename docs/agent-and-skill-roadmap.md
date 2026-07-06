# Agent And Skill Roadmap

This roadmap is rebuilt from two sources:

1. current repository implementation;
2. corrected private workflow corpus aggregates.

It separates reusable skills and helpers from product-specific roles and newer unproven autonomy ideas.

## Dependency Graph

```text
corrected workflow corpus
  -> docs/source inventory helper (implemented)
  -> backlog confidence
  -> repo-map helper automation (implemented)
  -> project-KB compiler (implemented)
  -> pre-commit validation hook (implemented)
  -> browser/live proof and GitHub deep review
  -> secret-access adapter, if approved
  -> capability acquisition/prefetch, if still needed
  -> agent-role system, only after repeated role contracts are proven
```

## Agent Roles

Current status: no reusable agent role is verified for implementation.

Historical roles such as researcher, trader, banker, and executioner are confirmed as product-specific OpenClaw/subagent vocabulary. They should not become generic package agents without a separate contract.

Planner, worker, and reviewer are `NOT_YET_AN_AGENT_ROLE`: mentions exist, but the corrected corpus does not yet prove stable reusable inputs, outputs, and handoff contracts.

## Skills

Implemented and active:

- session-log extraction
- repo map
- route trace
- env audit
- build verify
- error evidence
- GitHub auth and handoff
- Supabase RLS/function/scheduler skills
- Cloudflare deploy planning
- runtime verification
- production handoff
- release/package readiness
- skills-library packaging

Documented missing skills:

- browser live proof
- GitHub deep review
- one-password secret access

## Scripts And Helpers

Implemented:

- `scripts/extract-session-workflows.mjs`
- `scripts/docs-list`
- `scripts/repo-map`
- `scripts/project-kb`
- `scripts/pre-commit-check`
- `scripts/install-git-hooks`
- `scripts/run-next`
- `scripts/lane-state`
- `scripts/objective-authority`
- `scripts/committer`
- `scripts/check-js`
- `scripts/route-audit`
- `scripts/validate-skills`
- `scripts/skill-cleaner`
- `scripts/evidence-pack`
- `scripts/failure-evidence`
- `scripts/pipeline-diagnostics`
- package and release readiness helpers

Missing helpers:

- migration-review automation helper

## Routes And Control Plane

Implemented:

- route metadata manifest
- lane-scoped local state
- objective authority
- interrupted-run checkpoints
- package/release routes
- production-lane routes
- zero-output diagnostics routes

New route added:

- `workflow-corpus-recovery`
- `docs-list-foundation`
- `repo-map-helper-automation`
- `project-kb-compiler`
- `pre-commit-validation-hook`

## Capability Adapters

Implemented capability gates:

- GitHub auth gate
- npm/package readiness checks
- Supabase tooling/deploy/scheduler boundaries
- Cloudflare planning boundaries

Missing or held:

- one-password secret access
- browser live proof
- capability acquisition broker
- capability prefetch

Capability acquisition remains `NEWLY_PROPOSED` until browser proof and secret-access prerequisites are either implemented or explicitly rejected.

## Recommended Build Order

### P0

1. Keep corrected workflow corpus current.
2. Keep `scripts/docs-list` current as the deterministic documentation inventory and docs coverage helper.

### P1

3. Keep `scripts/repo-map` current as the deterministic source-only workspace orientation helper.
4. Keep `scripts/project-kb` current as the deterministic source-only project memory compiler.
5. Keep `scripts/pre-commit-check` and `scripts/install-git-hooks` current as the deterministic local commit gate.
6. Add migration-review helper.

### P2

7. Build browser-live-proof-skill.
8. Build GitHub deep review skill.
9. Harden release/package preflight around generated corpus evidence.

### P3

10. Explore one-password secret access only after a non-printing local contract is approved.
11. Revisit capability acquisition and prefetch only after adapter prerequisites exist.
12. Revisit agent-role system only after at least two independent sessions prove a reusable role contract.
