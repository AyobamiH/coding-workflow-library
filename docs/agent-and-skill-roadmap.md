# Agent And Skill Roadmap

This roadmap is rebuilt from two sources:

1. current repository implementation;
2. corrected private workflow corpus aggregates.

It separates reusable skills and helpers from product-specific roles and newer unproven autonomy ideas.

## Current Direction

The current product direction is a reusable, lane-scoped autonomous coding control plane for evidence-backed repository work. Agents should be able to orient, select a bounded route, inherit objective authority, execute local steps, checkpoint, resume, validate, and stop at the first ungranted consequence boundary without asking the user to reconstruct context.

The reusable foundation is currently broad. Self-dogfooding proved and closed two bounded control-plane gaps: tests and terminal queue status could conceal unpublished Git work or stale lane/checkpoint evidence, and a successful route could immediately recreate stale terminal authority while an injected GitHub role failed to reach Git's credential path. Situational truth is published, terminal lifecycle cleanup and ephemeral Git credential delivery are implemented, and no new generic P0/P1 capability is proven missing after this reconciliation. Further work should come from a selected target-repository objective, a structured gap with concrete evidence, or repeated failures showing an existing skill, route, or helper cannot satisfy its contract. Maintenance keeps existing route, documentation, portability, package, privacy, and modularity truth intact; it must not manufacture a new product direction.

Generic planner/worker/reviewer roles, fixed agent teams, capability brokering, and automatic prefetch remain held. Product-specific role pilots may continue in their own scope, but they are not reusable library architecture until repeated independent work proves stable inputs, outputs, authority, handoff, and measurable benefit.

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
  -> three-OS portability contract (implemented and remotely proven)
  -> routing shape review (implemented)
  -> modular run-next architecture and source-size guard (implemented)
  -> safe skill-gap recorder (implemented)
  -> autonomy outcome reporting (implemented)
  -> real multi-project workflow evidence (observed locally)
  -> exact-commit remote three-OS portability proof (observed)
  -> Opstruth runtime truth self-test (implemented)
  -> capability adapter evaluation (completed: narrow adapters only)
  -> narrow open-source SOPS + age secret-access adapter (implemented)
  -> purpose-scoped encrypted secret delivery (implemented)
  -> current-state reconciliation and lane discovery (implemented; remote publication pending)
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
- SOPS + age secret access
- purpose-scoped secret bundle delivery
- production handoff
- release/package readiness
- skills-library packaging

## Scripts And Helpers

Implemented:

- `scripts/extract-session-workflows.mjs`
- `scripts/docs-list`
- `scripts/repo-map`
- `scripts/situational-truth`
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
- `scripts/check-public-paths`
- `scripts/add-skill-gap`
- `scripts/autonomy-outcomes`
- `scripts/multi-project-proof`
- `scripts/library-next-objective`
- `scripts/sops-age-secret-access`
- `scripts/route-audit`
- `scripts/validate-skills`
- `scripts/skill-cleaner`
- `scripts/evidence-pack`
- `scripts/failure-evidence`
- `scripts/pipeline-diagnostics`
- package and release readiness helpers

Missing helpers:

- None currently evidence-backed. Add a helper only after the structured gap recorder or repeated workflow evidence proves a bounded contract that current helpers cannot satisfy.

## Routes And Control Plane

Implemented:

- route metadata manifest
- lane-scoped local state
- objective authority
- interrupted-run checkpoints
- package/release routes
- production-lane routes
- zero-output diagnostics routes

Foundation routes implemented:

- `workflow-corpus-recovery`
- `docs-list-foundation`
- `repo-map-helper-automation`
- `project-kb-compiler`
- `pre-commit-validation-hook`
- `migration-review-helper`
- `library-next-objective-assessment`
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
- narrow non-printing open-source SOPS + age adapter with encrypted-file validation and output-suppressed `sops exec-env --pristine`
- manifest-driven purpose bundles with exact source coverage, runtime aliases, allowlisted consumers, and same-run retirement proof

Missing, held, or rejected:

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
5. Keep the implemented safe skill-gap recorder current as the structured "no skill fits" queue contract.
6. Keep read-only autonomy outcome reporting current over safe lane, checkpoint, ledger, and run metadata.
7. Keep the observed multi-project proof contract current; it has passed across the workflow library, OpsTruth, and Wagging Web Wins without Git or lane-state leakage.
8. Keep the verified Linux/macOS/Windows portable matrix current. Exact commit `f8968d2` passed all three portability jobs and the main validation job in GitHub Actions run `29484530598`.
9. Keep `scripts/repo-map` current as the deterministic source-only workspace orientation helper.
10. Keep `scripts/project-kb` current as the deterministic source-only project memory compiler.
11. Keep `scripts/pre-commit-check` and `scripts/install-git-hooks` current as the deterministic local commit gate.
12. Keep `scripts/migration-review` current as the deterministic source-only migration risk helper.
13. Run `scripts/situational-truth` before broad route selection or resume so passing tests cannot conceal unpublished Git work, stale lane authority, or checkpoint drift.

### P2

14. Keep `scripts/browser-live-proof` and `browser-live-proof-skill` current as the bounded browser-observation foundation, including redirect and screenshot-content warnings.
15. Keep `scripts/github-deep-review` and `github-deep-review-skill` current as the thread-aware, read-only PR evidence foundation; unavailable protection metadata must stay unknown.
16. Keep the Linux/macOS/Windows portable contract and reviewed routing-shape exceptions current.
17. Keep `scripts/opstruth-classify` current as the deterministic mixed-evidence truth-model self-test.
18. Keep the hardened release/package preflight current: validated human/JSON reports, crisp mode-specific blockers, safe package-manifest inspection, version and release-note baseline checks, and optional aggregate-only corpus evidence are implemented and published.

### P3

19. Keep optional provider reads subordinate to existing workflow skills, evidence contracts, redaction, and authority gates.
20. Keep the SOPS + age adapter narrow: keep private identities outside source, preserve output suppression, and never let injection grant the child command extra authority.
21. Use `secret-bundle-delivery-skill` only when one source serves multiple consumers; keep real manifests, ciphertext, reports, and local paths private.
22. Revisit capability acquisition and prefetch only after at least two real runs prove the same unresolved adapter insufficiency.
23. Revisit agent-role system only after at least two independent sessions prove a reusable role contract.

The evidence-backed reusable-foundation sequence through capability adapter evaluation, remote portability proof, and situational-truth reconciliation is complete. Exact commit `73bcb54` is published and passed validation plus Ubuntu, macOS, and Windows in run `31594083338`. Workflow reliability now has a bounded entrypoint, current-state preflight, structured skill-gap recording, privacy-safe outcome reporting, observed three-repository proof, exact-commit multi-platform CI evidence, terminal objective/checkpoint cleanup, and a narrow open-source SOPS + age adapter with two-recipient recovery proof plus output-suppressed GitHub delivery. The manifest-driven layer maps every source name exactly once into purpose bundles, constrains consumer profiles, proves delivery before source retirement, and can bridge an injected `GH_TOKEN` into one Git child without persistent login or plaintext storage. The earlier subscription-backed 1Password direction, system package, trust files, executable, and daemon are removed. No additional generic foundation is currently proven missing. New foundation-building should start only from corrected corpus evidence, a structured gap record, or repeated real workflow failures. See `docs/workflow-maturity-foundations.md` and `docs/modularity-audit.md`. Capability Intelligence remains parked as a separate product direction.
