---
name: capability-intelligence-builder-skill
description: Build privacy-safe capability inventories with lifecycle, evidence, risk, and source reconciliation.
category: repo-inspection
routing_triggers:
  - capability intelligence
  - capability inventory
  - plugin and skill census
  - agent tool readiness
  - capability hard cutover
status: active
---
# Capability Intelligence Builder Skill

## Purpose

Build or review a standalone capability-intelligence product that inventories agent skills, plugins, tools, connectors, hooks, commands, and workflow resources without confusing metadata presence with runtime proof.

This skill supplies the engineering workflow. The target product owns its implementation, data model, adapters, tests, and interface. Do not fold the product into this workflow library or redirect the autonomous coding workflow around it.

## When to Use

Use when a task asks to inventory local agent capabilities, compare capability coverage between hosts, map outcomes to available resources, expose missing metadata, assess capability risk, or perform a hard cutover from an incomplete catalogue to a reconciled capability graph.

Do not use this skill merely to install one known skill, invoke one tool, or verify a product claim. Use the relevant installer, execution, or verification skill for those narrower jobs.

## Inputs Required

- Target product repository or directory.
- Explicit allowlist of metadata roots and source formats.
- Required artifact types and host surfaces.
- Lifecycle and evidence-state definitions.
- Privacy exclusions and redaction contract.
- Local execution authority and any separate publication authority.
- Expected source counts or a discovery method that can establish them safely.

## Commands

Adapt commands to the target repository and use its documented entrypoints:

```bash
<CAPABILITY_CLI> scan --strict --summary
<CAPABILITY_CLI> coverage --json
<CAPABILITY_CLI> ask "<OUTCOME>"
<CAPABILITY_CLI> duplicates
<CAPABILITY_CLI> receipts --input <EXPLICIT_RECEIPT_FILE> --json
<CAPABILITY_CLI> export --output <TEMP_ROOT>/capabilities.json --redacted
<TARGET_TEST_COMMAND>
```

Use the library controls around the target work when appropriate:

```bash
./scripts/repo-map --repo <TARGET_REPO> --validate
./scripts/docs-list --validate
./scripts/route-audit
./scripts/validate-skills
```

## Procedure

1. Map the target repository and recover existing capability work before designing a replacement.
2. Write a source contract that lists every allowlisted root, expected record type, and explicit exclusion.
3. Separate lifecycle states such as discovered, present, installed, enabled, authenticated, runnable, and verified.
4. Separate declared, structural, inferred, observed, and unknown evidence.
5. Build one adapter per source format. Adapters must return source counts, represented counts, deliberate de-duplication counts, parse failures, artifacts, and findings.
6. Preserve records that lack standard capability labels. Mark them unlabelled and inferred or structural; never silently drop them.
7. Generate stable internal identities without exposing connector IDs, project references, install URLs, server origins, or credential material.
8. Reconcile each source so every discovered record is represented, deliberately de-duplicated, or reported as a parse failure.
9. Build deterministic outcome search, duplicate detection, host comparison, lifecycle readiness, and risk views on top of the same normalized inventory. Require a positive lexical or concept match before readiness can affect outcome ranking; readiness orders relevant results but must never manufacture relevance.
10. Ensure human, JSON, export, API, and interface views derive from the same source model.
11. Give each CLI command an explicit option grammar. Reject unsupported options, duplicate singleton options, and values outside shared model enums before scanning source metadata.
12. Add synthetic fixtures for every adapter and negative tests for malformed data, silent loss, unsafe fields, duplicate identities, lifecycle overclaiming, and command-input typos.
13. Treat cached provider flags as metadata hints unless they are observed runtime evidence. A directory `enabled` field must not silently become lifecycle `enabled=yes`.
14. If observed receipts are supported, require an explicit bounded input, current-artifact identity match, constrained evidence checks, latest-observation semantics, and clear issuer-trust limits. Receipt import must not invoke or mutate a capability.
15. Keep the target product's canonical backlog and maturity direction in the target repository, including limitations exposed by real workflow use.
16. Run a real strict scan only after synthetic tests pass. Record aggregate counts, not private source payloads.

## Evidence Required

- Source allowlist and explicit exclusions.
- Discovered, represented, de-duplicated, and failed counts per source.
- Dynamic count of records lacking standard capability labels.
- Artifact counts by type, risk, and lifecycle state.
- Deterministic repeated-run evidence.
- Tests proving installed does not imply enabled, authenticated, runnable, or verified.
- Tests proving cached connector flags remain hints rather than lifecycle claims.
- Passed, failed, stale, unmatched, malformed, unsafe, and repeated observed-receipt fixtures when receipts are supported.
- Tests proving connector IDs, authorization material, secret-shaped values, and private paths do not reach output.
- Strict scan result from the real local environment.
- UI or API smoke evidence when the product exposes those surfaces.
- Clear list of properties that remain unknown or unverified.

## Safety Rules

- Default to local, read-only discovery with no network calls.
- Read only allowlisted metadata roots.
- Never read authentication files, environment values, sessions, transcripts, attachments, memories, logs, shell snapshots, or credential stores.
- Never emit raw connector IDs, app IDs, authorization headers, tokens, project references, server origins, install URLs, tool payloads, or absolute private paths.
- Do not mark a capability authenticated from cache presence or enabled from installation alone.
- Do not mark a capability runnable from a manifest claim.
- Do not mark a capability verified without bounded observed evidence.
- Do not describe schema-valid operator-supplied receipts as cryptographic issuer proof.
- Do not execute discovered tools merely to improve inventory status.
- Do not copy target-product implementation into this workflow library.
- Do not install, publish, push, tag, release, deploy, or mutate production without separate authority.

## Common Failures

- Catalogue count differs from manifest count: inspect source boundaries before changing the expected count.
- Cache snapshots repeat connector records: de-duplicate by an internal identity and report the count without emitting that identity.
- Public descriptions mention security terms: detect secret-shaped values rather than rejecting harmless documentation language.
- One adapter fails: preserve other source results, mark the adapter failed, and fail strict coverage.
- Outcome ranking favours low-level primitives: require a positive match, then weight direct name and query matches above broad inferred synonyms.
- Empty or unmatched outcomes return installed tools: gate readiness scoring behind relevance and add CLI/API no-match regressions.
- Unknown CLI options appear to succeed: use command-specific option allowlists and fail before scanning.
- Invalid filter values return an empty success: validate against shared model enums and report accepted values.
- Cached connector enablement appears as lifecycle truth: retain the value as a safe hint and leave lifecycle state unknown.
- A receipt targets a changed artifact: report it as stale and do not change lifecycle state.
- Host roots contain duplicate skills: retain each host-specific artifact and add duplicate relationships.
- A source format changes: fail closed and add a versioned fixture before supporting the new shape.

## Output Format

Report:

- Target product boundary.
- Sources scanned and excluded.
- Source reconciliation table.
- Artifact totals by type.
- Unlabelled records retained.
- Lifecycle and evidence rules.
- Risk and duplicate findings.
- Tests and strict scan result.
- Interface/API validation.
- Unknown or unverified states.
- Mutations and external actions not performed.

## Upgrade Ideas

- Add signed publisher evidence without converting signatures into runtime proof.
- Compare redacted inventories across teams without uploading private skill bodies.
- Authenticate receipt issuers only after multiple independent producers prove the need and trust model.
- Add compatibility drift alerts for plugin, skill, and tool-schema updates.
