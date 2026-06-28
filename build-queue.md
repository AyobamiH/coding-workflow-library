# P0 - Foundations

## Keep corrected workflow corpus current

- Evidence source: `scripts/extract-session-workflows.mjs`, `docs/workflow-corpus-recovery-report.md`, private validated corpus coverage.
- Primary type: `SCRIPT_OR_HELPER`, `VALIDATION`.
- Dependency: none; this is the foundation for future roadmap decisions.
- Authority required: `local_execution`.
- Done definition: extractor tests pass, private corpus validates, source coverage reconciles, extraction-meta sessions are excluded from rankings by default, and public docs use aggregate evidence only.
- Reason for priority: without reproducible source coverage, newer agent and capability ideas are memory-led rather than evidence-led.

## Add `scripts/docs-list`

- Evidence source: backlog audit and corrected corpus need for source inventory before additional docs or skill split work.
- Primary type: `SCRIPT_OR_HELPER`.
- Dependency: corrected workflow corpus.
- Authority required: `local_execution`.
- Done definition: helper inventories docs, skills, routes, schemas, templates, tests, and package files; reports stale/missing docs without reading secrets or touching product repos.
- Reason for priority: it gives the next roadmap pass a deterministic documentation/source inventory instead of ad hoc `find` output.

# P1 - Documented Missing Reusable Components

## Repo-map helper automation

- Evidence source: `repo-map-skill.md`; corrected corpus shows repeated repo inspection commands.
- Primary type: `SCRIPT_OR_HELPER`.
- Dependency: `scripts/docs-list` is useful but not mandatory.
- Authority required: `local_execution`.
- Done definition: helper emits a redacted repo map with git state, major files, package/config markers, docs, tests, scripts, and known risk surfaces.
- Reason for priority: repo orientation is a recurring first step and should be reproducible.

## Project-KB compiler

- Evidence source: `project-kb-builder-skill.md`; prior ledgers record repeated durable-memory needs.
- Primary type: `SCRIPT_OR_HELPER`.
- Dependency: repo-map helper.
- Authority required: `local_execution`.
- Done definition: helper writes or previews safe project memory summaries from validated local evidence and excludes secrets/private transcript bodies.
- Reason for priority: it turns repeated project context reconstruction into a controlled local artifact.

## Migration-review helper

- Evidence source: `migration-review-skill.md`; Supabase scheduler work proved source-only migration and secret-hardcoding review needs.
- Primary type: `SCRIPT_OR_HELPER`.
- Dependency: repo-map helper.
- Authority required: `local_execution`; SQL execution remains a separate `production_mutation` boundary.
- Done definition: helper inventories migrations, flags destructive patterns, secret-shaped literals, rollback gaps, ordering risks, and source-only limitations.
- Reason for priority: migration review is reusable and safety-critical.

## Pre-commit validation hook

- Evidence source: `github-handoff-skill.md`, `runs/skill-runs.md` Peter-pattern follow-up.
- Primary type: `HOOK`.
- Dependency: exact-file committer and validator already exist.
- Authority required: `local_execution`.
- Done definition: opt-in hook runs secret-shaped marker scan and exact-file safety checks before manual commits without broad staging or remote mutation.
- Reason for priority: it prevents regressions around the already-proven exact-file handoff pattern.

## Browser live proof skill

- Evidence source: `work-ledger.md`, `runs/skill-runs.md`, `tools.md` `browser-live-proof` permission level.
- Primary type: `SKILL`.
- Dependency: runtime-verification and Opstruth runtime-truth skills.
- Authority required: `local_execution` for local browser proof; logged-in or production browser actions require explicit higher authority.
- Done definition: skill defines screenshots, console/network evidence, mutation boundaries, and final proof language for browser-observed behavior.
- Reason for priority: browser evidence is a documented gap after source/build/runtime helper checks.

## GitHub deep review skill

- Evidence source: `runs/skill-runs.md` Peter-pattern follow-up; existing GitHub handoff skill covers PR files/checks but not review-thread triage.
- Primary type: `SKILL`.
- Dependency: GitHub auth gate and GitHub handoff skill.
- Authority required: read-only GitHub inspection by default; replies, resolutions, commits, merges, and pushes require `remote_publication`.
- Done definition: skill inspects review threads, requested changes, check logs, stale approvals, and exact patch scope without mutating remote state by default.
- Reason for priority: it completes the PR lifecycle beyond branch/PR creation and merge readiness.

# P2 - Follow-On Autonomy Improvements

## Release and package preflight hardening

- Evidence source: `release-preflight-skill.md`, `npm-package-readiness-skill.md`, v0.1/v0.2 release docs.
- Primary type: `RELEASE_WORK`.
- Dependency: corrected corpus and docs inventory.
- Authority required: `local_execution`; publish, push, tag, and GitHub Release creation require `remote_publication`.
- Done definition: preflight consumes corpus-backed evidence where useful and reports local/npm/CLI modes with crisp blockers.
- Reason for priority: release paths are working, but should benefit from the same reproducible evidence foundation.

## Opstruth runtime truth self-test

- Evidence source: `opstruth-runtime-truth-skill.md` and prior build queue.
- Primary type: `VALIDATION`.
- Dependency: runtime-verification skill.
- Authority required: `local_execution`.
- Done definition: self-test classifies mixed evidence into verified, warning, failure, skipped, and not-verified without overclaiming.
- Reason for priority: it protects final reports from treating skipped checks as proof.

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
