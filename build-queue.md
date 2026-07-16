# P0 - Foundations

## Keep corrected workflow corpus current

- Evidence source: `scripts/extract-session-workflows.mjs`, `docs/workflow-corpus-recovery-report.md`, private validated corpus coverage.
- Primary type: `SCRIPT_OR_HELPER`, `VALIDATION`.
- Dependency: none; this is the foundation for future roadmap decisions.
- Authority required: `local_execution`.
- Done definition: extractor tests pass, private corpus validates, source coverage reconciles, extraction-meta sessions are excluded from rankings by default, and public docs use aggregate evidence only.
- Reason for priority: without reproducible source coverage, newer agent and capability ideas are memory-led rather than evidence-led.

# Completed Reusable Foundations

## Corpus fingerprints and comparison

- Evidence source: `scripts/extract-session-workflows.mjs`, extraction determinism tests, and the private-corpus boundary.
- Primary type: `VALIDATION`.
- Dependency: corrected workflow corpus.
- Authority required: `local_execution`.
- Done definition: every new extraction writes a content-derived snapshot; comparison distinguishes unchanged, changed, and incompatible baselines; mtime-only changes do not drift; strict unchanged mode fails intentionally; no private paths or transcript content enter reports.
- Status: implemented locally with snapshot/comparison schemas and deterministic regression tests.

## Cross-platform portability CI

- Evidence source: existing Linux-only `validate.yml`, path sanitisation work, managed hook installer, and package portability tests.
- Primary type: `VALIDATION`.
- Dependency: dependency-free helpers and package lockfile.
- Authority required: `local_execution` for tests; `remote_publication` for CI execution on GitHub.
- Done definition: focused path, hook, corpus, browser-proof, and GitHub-review contracts run on Linux, macOS, and Windows without external service calls.
- Status: implemented locally as `npm run test:portable` and a three-OS GitHub Actions matrix; remote CI remains unverified until publication is authorised.

## Routing shape review

- Evidence source: `scripts/skill-cleaner` warnings for long descriptions, duplicate `scheduled monitoring`, and three safety-critical long skills.
- Primary type: `CONTROL_PLANE`, `VALIDATION`.
- Dependency: active skill frontmatter.
- Authority required: `local_execution`.
- Done definition: duplicate triggers are disambiguated, routing descriptions are concise, and intentional long safety contracts carry reviewed machine-visible reasons rather than disappearing from cleanup evidence.
- Status: implemented locally; shape exceptions remain visible in the cleaner report.

## GitHub deep review skill

- Evidence source: `runs/skill-runs.md` Peter-pattern follow-up; existing GitHub handoff skill covers PR files/checks but not review-thread triage.
- Primary type: `SKILL`.
- Dependency: GitHub auth gate and GitHub handoff skill.
- Authority required: read-only GitHub inspection by default; replies, resolutions, commits, merges, and pushes require `remote_publication`.
- Done definition: skill inspects review threads, requested changes, check logs, stale approvals, and exact patch scope without mutating remote state by default.
- Reason for priority: it completes the PR lifecycle beyond branch/PR creation and merge readiness.
- Status: implemented locally with `scripts/github-deep-review`, a validated JSON contract, synthetic regression tests, CLI delegation, route metadata, and a bounded real GitHub evidence run.

# P1 - Current Maturity Gaps

## Modular run-next architecture and source-size guard

- Evidence source: the prior 16,116-line `scripts/run-next`, interrupted-run recovery requirements, and current route/resume regression coverage.
- Primary type: `CONTROL_PLANE`, `VALIDATION`.
- Dependency: existing route and objective-authority contracts.
- Authority required: `local_execution`.
- Done definition: the entrypoint owns only composition and dispatch; domain logic, reports, checkpoints, and runtime support live in focused modules; recursive syntax checks cover nested code; a deterministic hard line budget prevents another monolith.
- Status: implemented locally. `scripts/run-next` is 1,596 lines, 14 modules live under `scripts/lib/run-next/`, every checked file is below 2,200 lines, and focused module, resume, and authority tests pass.

## Safe skill-gap recorder

- Evidence source: `RUNBOOK.md` requires a skill-gap note when no skill fits, while `coding-workflow-orchestrator-skill.md` still lists `scripts/add_skill_gap.mjs` as an upgrade idea.
- Primary type: `SCRIPT_OR_HELPER`.
- Dependency: build queue format and public-path/secret safety checks.
- Authority required: `local_execution`.
- Done definition: one deterministic helper appends a bounded, portable, secret-safe gap record; supports dry-run and validation; refuses duplicate or malformed entries; never edits unrelated queue content.
- Reason for priority: the control rule exists, but recording still depends on ad hoc manual editing.

## Autonomy outcome reporting

- Evidence source: lane objectives, checkpoints, blocker classes, `work-ledger.md`, and `runs/skill-runs.md`.
- Primary type: `VALIDATION`, `CONTROL_PLANE`.
- Dependency: stable local checkpoint and lane-state records.
- Authority required: `local_execution`.
- Done definition: a read-only helper reports route completion, blocker, recovery, resume, and stop-boundary counts from safe local metadata without reading secrets or treating logs as production proof.
- Reason for priority: the workflow records evidence but does not yet summarize whether autonomy is becoming more reliable.

## Real multi-project workflow evidence

- Evidence source: existing product-specific Wagging, OpsTruth, release, browser, and GitHub runs.
- Primary type: `VALIDATION`.
- Dependency: modular `run-next`, outcome reporting, and stable route contracts.
- Authority required: `local_execution`; target-specific consequences retain their own authority.
- Done definition: at least three distinct repositories complete representative routes with the same public contracts, explicit failures, and no lane-state leakage.
- Reason for priority: synthetic coverage is strong, but reusable autonomy needs repeated cross-repository evidence.

## Remote cross-platform exact-commit proof

- Evidence source: local `test:portable` and the three-OS GitHub Actions matrix.
- Primary type: `VALIDATION`.
- Dependency: publication of the modular source and exact-commit CI access.
- Authority required: `remote_publication`.
- Done definition: Linux, macOS, and Windows jobs pass for the exact published commit, with any platform-specific failure classified rather than inferred from local Linux evidence.
- Reason for priority: the matrix exists locally, but remote execution evidence must remain separate until observed.

# P2 - Follow-On Autonomy Improvements

Capability adapter evaluation is complete. No generic capability work is active; maintenance returns to the proven P0 foundations unless a real workflow supplies repeated unresolved `BLOCKED_CAPABILITY` evidence.

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
- Status: implemented locally through validated package/preflight JSON reports, explicit blockers/warnings/not-verified states, safe pack-manifest inspection, version and release-note baseline checks, aggregate-only corpus evidence, tests, CLI delegation, and pre-commit contract checks.

## Capability adapter evaluation

- Evidence source: corrected corpus confirms capability boundaries, but not a durable acquisition broker.
- Primary type: `CAPABILITY_ADAPTER`.
- Dependency: browser-live proof and secret-access decision.
- Authority required: depends on adapter; secret managers require explicit decision and non-printing contract.
- Done definition: evaluate whether a capability broker is still needed after concrete browser and secret-access adapters exist.
- Reason for priority: capability acquisition is not first; it follows adapter prerequisites.
- Status: completed locally as a decision. The GitHub plugin is an optional structured-read provider beneath existing GitHub workflow contracts. Skill/plugin creators remain authoring references; task-specific stacks remain task-specific; automatic installation, secret access, generic brokering, prefetch, and bulk skill/plugin cutover were rejected or held. See `docs/capability-adapter-evaluation.md`.

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
- Dependency: capability adapter evaluation plus repeated unresolved adapter insufficiency evidence.
- Authority required: likely multiple classes; must be defined before implementation.
- Done definition: design only after real adapters define what can be acquired safely.
- Reason for priority: optional autonomy experiment, not current P0/P1 work.
- Status: rejected for the current roadmap. Reopen only when at least two real workflow runs cannot resolve the same `BLOCKED_CAPABILITY` through an existing helper, optional provider, or documented fallback.

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
- Generic objective-driven semver release preparation and publication routing.
- Lane-scoped state and objective authority.
- Reproducible workflow corpus extraction foundation.
- Deterministic documentation inventory foundation (`scripts/docs-list`).
- Deterministic source-only repository map helper (`scripts/repo-map`).
- Deterministic source-only project KB compiler (`scripts/project-kb`).
- Pre-commit validation hook (`scripts/pre-commit-check`, `scripts/install-git-hooks`, `templates/hooks/pre-commit`).
- Deterministic source-only migration review helper (`scripts/migration-review`).
- Bounded read-only browser live-proof helper (`scripts/browser-live-proof`) and `browser-live-proof-skill`.
- Capability-intelligence builder skill and local-only hard-cutover route.
