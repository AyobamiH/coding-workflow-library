# P0 - Foundations

## Keep corrected workflow corpus current

- Evidence source: `scripts/extract-session-workflows.mjs`, `docs/workflow-corpus-recovery-report.md`, private validated corpus coverage.
- Primary type: `SCRIPT_OR_HELPER`, `VALIDATION`.
- Dependency: none; this is the foundation for future roadmap decisions.
- Authority required: `local_execution`.
- Done definition: extractor tests pass, private corpus validates, source coverage reconciles, extraction-meta sessions are excluded from rankings by default, and public docs use aggregate evidence only.
- Reason for priority: without reproducible source coverage, newer agent and capability ideas are memory-led rather than evidence-led.

# Completed Reusable Foundations

## GitHub deep review skill

- Evidence source: `runs/skill-runs.md` Peter-pattern follow-up; existing GitHub handoff skill covers PR files/checks but not review-thread triage.
- Primary type: `SKILL`.
- Dependency: GitHub auth gate and GitHub handoff skill.
- Authority required: read-only GitHub inspection by default; replies, resolutions, commits, merges, and pushes require `remote_publication`.
- Done definition: skill inspects review threads, requested changes, check logs, stale approvals, and exact patch scope without mutating remote state by default.
- Reason for priority: it completes the PR lifecycle beyond branch/PR creation and merge readiness.
- Status: implemented locally with `scripts/github-deep-review`, a validated JSON contract, synthetic regression tests, CLI delegation, route metadata, and a bounded real GitHub evidence run.

# P2 - Follow-On Autonomy Improvements

Next active dependency: `Release and package preflight hardening`.

## Opstruth runtime truth self-test

- Evidence source: `opstruth-runtime-truth-skill.md` and prior build queue.
- Primary type: `VALIDATION`.
- Dependency: runtime-verification skill.
- Authority required: `local_execution`.
- Done definition: self-test classifies mixed evidence into verified, warning, failure, skipped, and not-verified without overclaiming.
- Reason for priority: it protects final reports from treating skipped checks as proof.
- Status: implemented locally through `scripts/opstruth-classify`, its built-in mixed fixture, JSON schema, tests, CLI delegation, and the existing runtime-truth skill/route.

## Release and package preflight hardening

- Evidence source: `release-preflight-skill.md`, `npm-package-readiness-skill.md`, v0.1/v0.2 release docs.
- Primary type: `RELEASE_WORK`.
- Dependency: corrected corpus and docs inventory.
- Authority required: `local_execution`; publish, push, tag, and GitHub Release creation require `remote_publication`.
- Done definition: preflight consumes corpus-backed evidence where useful and reports local/npm/CLI modes with crisp blockers.
- Reason for priority: release paths are working, but should benefit from the same reproducible evidence foundation.

## Capability adapter evaluation

- Evidence source: corrected corpus confirms capability boundaries, but not a durable acquisition broker.
- Primary type: `CAPABILITY_ADAPTER`.
- Dependency: browser-live proof and secret-access decision.
- Authority required: depends on adapter; secret managers require explicit decision and non-printing contract.
- Done definition: evaluate whether a capability broker is still needed after concrete browser and secret-access adapters exist.
- Reason for priority: capability acquisition is not first; it follows adapter prerequisites.

# P3 - Optional Experiments

## Agent-role system

- Evidence source: corrected corpus shows role terms, but no reusable role contracts.
- Primary type: `AGENT_ROLE`.
- Dependency: corrected corpus, docs inventory, and at least two independent sessions proving a role contract.
- Authority required: `local_execution` for design only.
- Done definition: promote a role only when recurring responsibility, inputs, outputs, handoff contract, and insufficiency of skill/route abstraction are proven.
- Reason for priority: current evidence supports product-specific roles, not a generic agent-role framework.

## Capability acquisition and prefetch

- Evidence source: newer discussions only; corrected corpus does not prove this as an older foundation.
- Primary type: `CONTROL_PLANE`.
- Dependency: capability adapter evaluation.
- Authority required: likely multiple classes; must be defined before implementation.
- Done definition: design only after real adapters define what can be acquired safely.
- Reason for priority: optional autonomy experiment, not current P0/P1 work.

# Hold - Product-Specific Or Decision-Dependent

## OneClickPostFactory / Devvit / Reddit lane

- Evidence source: product-lane mentions are not reusable library evidence.
- Primary type: `PRODUCT_SPECIFIC`.
- Dependency: explicit product repo selection and platform requirements.
- Authority required: target-specific.
- Done definition: resume only with a concrete repo, platform rules, and permission gates.
- Reason for hold: avoid drifting from library work into product runtime work.

## One-password secret access

- Evidence source: `github-auth-gate-skill.md` upgrade idea.
- Primary type: `CAPABILITY_ADAPTER`.
- Dependency: John selects secret manager scope and non-printing runtime contract.
- Authority required: secret-access decision; secret values must never be printed.
- Done definition: credential presence/use workflow proves non-printing behavior and writes no secrets into repos.
- Reason for hold: powerful, high-risk, and decision-dependent.

## Live product deploy work

- Evidence source: prior Wagging/Supabase/Cloudflare lanes.
- Primary type: `PRODUCT_SPECIFIC`.
- Dependency: selected product lane and explicit objective authority.
- Authority required: `production_mutation` and possibly `secret_mutation` or `remote_publication`.
- Done definition: handled only through selected lane state, not this public build queue.
- Reason for hold: product state must not overwrite library roadmap state.

# Completed - Short Historical Index Only

- GitHub open-source handoff.
- CLI entrypoint package smoke.
- v0.1.0 source tag.
- v0.2.0 local preparation.
- Lane-scoped state and objective authority.
- Reproducible workflow corpus extraction foundation.
- Deterministic documentation inventory foundation (`scripts/docs-list`).
- Deterministic source-only repository map helper (`scripts/repo-map`).
- Deterministic source-only project KB compiler (`scripts/project-kb`).
- Pre-commit validation hook (`scripts/pre-commit-check`, `scripts/install-git-hooks`, `templates/hooks/pre-commit`).
- Deterministic source-only migration review helper (`scripts/migration-review`).
- Bounded read-only browser live-proof helper (`scripts/browser-live-proof`) and `browser-live-proof-skill`.
- Capability-intelligence builder skill and local-only hard-cutover route.
