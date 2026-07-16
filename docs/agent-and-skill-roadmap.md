# Agent And Skill Roadmap

This roadmap is rebuilt from two sources:

1. current repository implementation;
2. corrected private workflow corpus aggregates.

It separates reusable skills and helpers from product-specific roles and newer unproven autonomy ideas.

## Dependency Graph

```text
corrected workflow corpus
  -> content-derived snapshot and comparison (implemented)
  -> docs/source inventory helper (implemented)
  -> backlog confidence
  -> repo-map helper automation (implemented)
  -> project-KB compiler (implemented)
  -> pre-commit validation hook (implemented)
  -> migration-review helper (implemented)
  -> browser/live proof (implemented)
  -> GitHub deep review (implemented)
  -> three-OS portability contract (implemented locally)
  -> routing shape review (implemented)
  -> modular run-next architecture and source-size guard (implemented locally)
  -> safe skill-gap recorder
  -> autonomy outcome reporting
  -> real multi-project workflow evidence
  -> remote three-OS exact-commit proof
  -> Opstruth runtime truth self-test (implemented)
  -> capability adapter evaluation (completed: narrow adapters only)
  -> secret-access adapter, only if separately approved
  -> capability acquisition/prefetch, rejected until repeated adapter insufficiency is proven
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
- browser live proof
- GitHub deep review
- Opstruth runtime truth self-test
- production handoff
- release/package readiness
- skills-library packaging

Documented missing skills:

- one-password secret access

## Scripts And Helpers

Implemented:

- `scripts/extract-session-workflows.mjs`
- `scripts/docs-list`
- `scripts/repo-map`
- `scripts/project-kb`
- `scripts/pre-commit-check`
- `scripts/install-git-hooks`
- `scripts/migration-review`
- `scripts/browser-live-proof`
- `scripts/github-deep-review`
- `scripts/opstruth-classify`
- `scripts/run-next`
- `scripts/lane-state`
- `scripts/objective-authority`
- `scripts/committer`
- `scripts/check-js`
- `scripts/check-module-size`
- `scripts/route-audit`
- `scripts/validate-skills`
- `scripts/skill-cleaner`
- `scripts/evidence-pack`
- `scripts/failure-evidence`
- `scripts/pipeline-diagnostics`
- package and release readiness helpers

Missing helpers:

- safe skill-gap recorder for the existing "no skill fits" control rule
- read-only autonomy outcome summarizer over safe lane/checkpoint/run metadata

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
- `migration-review-helper`
- `browser-live-proof`
- `github-deep-review`
- `opstruth-runtime-truth-integration` with built-in classifier self-test

## Capability Adapters

Implemented capability gates:

- GitHub auth gate
- npm/package readiness checks
- Supabase tooling/deploy/scheduler boundaries
- Cloudflare planning boundaries
- browser live-proof gate and count-only Chromium observer
- optional GitHub plugin repository-read provider observed beneath the existing GitHub skill contracts

Missing, held, or rejected:

- one-password secret access
- capability acquisition broker (rejected for the current roadmap)
- capability prefetch (rejected for the current roadmap)

The adapter evaluation found no need for a generic broker. Capability Intelligence remains a separate inventory product; provider reads may satisfy existing workflow contracts, but provider availability does not grant authority or replace deterministic fallbacks. See `docs/capability-adapter-evaluation.md`.

## Recommended Build Order

### P0

1. Keep corrected workflow corpus current.
2. Compare content-derived snapshots when roadmap evidence is refreshed; use strict unchanged mode only for an explicit immutability gate.
3. Keep `scripts/docs-list` current as the deterministic documentation inventory and docs coverage helper.

### P1

4. Keep the modular `run-next` architecture and `scripts/check-module-size` current; do not regrow the entrypoint.
5. Implement the safe skill-gap recorder required by the existing runbook contract.
6. Add read-only autonomy outcome reporting from safe lane, checkpoint, ledger, and run metadata.
7. Collect representative real-run evidence across at least three repositories without leaking lane state.
8. Verify the existing Linux/macOS/Windows portable matrix against an exact published commit.
9. Keep `scripts/repo-map` current as the deterministic source-only workspace orientation helper.
10. Keep `scripts/project-kb` current as the deterministic source-only project memory compiler.
11. Keep `scripts/pre-commit-check` and `scripts/install-git-hooks` current as the deterministic local commit gate.
12. Keep `scripts/migration-review` current as the deterministic source-only migration risk helper.

### P2

13. Keep `scripts/browser-live-proof` and `browser-live-proof-skill` current as the bounded browser-observation foundation, including redirect and screenshot-content warnings.
14. Keep `scripts/github-deep-review` and `github-deep-review-skill` current as the thread-aware, read-only PR evidence foundation; unavailable protection metadata must stay unknown.
15. Keep the Linux/macOS/Windows portable contract and reviewed routing-shape exceptions current.
16. Keep `scripts/opstruth-classify` current as the deterministic mixed-evidence truth-model self-test.
17. Keep the hardened release/package preflight current: validated human/JSON reports, crisp mode-specific blockers, safe package-manifest inspection, version and release-note baseline checks, and optional aggregate-only corpus evidence are now implemented locally.

### P3

18. Keep optional provider reads subordinate to existing workflow skills, evidence contracts, redaction, and authority gates.
19. Explore one-password secret access only after a non-printing local contract is approved.
20. Revisit capability acquisition and prefetch only after at least two real runs prove the same unresolved adapter insufficiency.
21. Revisit agent-role system only after at least two independent sessions prove a reusable role contract.

The evidence-backed reusable-foundation sequence through capability adapter evaluation is complete locally. The current maturity sequence returns to workflow reliability: keep `run-next` modular, close the skill-gap recording contract, measure autonomy outcomes, gather multi-project evidence, and verify remote portability. The adapter evaluation selected narrow workflow-owned adapters, observed one bounded GitHub metadata read, and rejected a generic broker, prefetch, automatic installation, and skill/plugin hard cutover. Capability Intelligence remains parked as a separate product direction.
