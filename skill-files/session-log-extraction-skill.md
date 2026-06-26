---
name: session-log-extraction-skill
description: Extract reusable workflow skills from session logs.
category: skill-system
routing_triggers:
  - skill extraction
  - session logs
  - workflow inventory
  - command harvest
status: active
---
# Session Log Extraction Skill

## Purpose

Extract useful coding workflows from local OpenClaw/Codex session logs without leaking secrets, raw transcript bodies, local path maps, or assistant private reasoning. The skill turns JSONL transcripts into a deterministic private workflow corpus with source coverage, redaction, executed-versus-proposed command separation, and corpus-driven backlog recovery.

## When to Use

Use when the user asks to mine a chat, session, transcript, run log, or evidence pack for commands, tool calls, debugging moves, prompts, repeated workflows, or skill candidates.

## Inputs Required

- One or more local session roots or JSONL files.
- Private output directory outside the repository, usually a local runtime state folder.
- Optional extraction config based on `templates/workflow-extraction-config.example.json`.
- Scope decision for whether extraction-meta sessions should be included in rankings.

## Commands

```bash
node scripts/extract-session-workflows.mjs \
  --source /path/to/codex/sessions \
  --source /path/to/openclaw/agents/main/sessions \
  --output-dir /private/workflow-corpus

node scripts/extract-session-workflows.mjs \
  --output-dir /private/workflow-corpus \
  --validate-only

coding-workflow extract-workflows \
  --source /path/to/sessions \
  --output-dir /private/workflow-corpus
```

## Procedure

1. Read `docs/workflow-extraction-methodology.md`.
2. Discover all approved session roots; do not assume one path covers all history.
3. Run the extractor with `--dry-run` first when checking scope.
4. Run the extractor into a private output directory outside the package repository.
5. Confirm outputs exist: `source-manifest.json`, `workflow-corpus.jsonl`, `coverage-report.json`, `coverage-report.md`, `validation-report.json`, and private `pseudonym-map.json`.
6. Run `--validate-only` against the private output.
7. Confirm coverage reconciles: discovered equals parsed plus unsupported plus corrupt plus empty plus duplicate plus excluded.
8. Exclude `EXTRACTION_META_SESSION` events from workflow-frequency rankings unless auditing the extractor itself.
9. Compare corrected aggregate signals with older extraction docs before updating roadmap or build queue.
10. Keep raw transcripts, raw prompts, raw assistant responses, pseudonym maps, and generated corpus files out of commits and package contents.

## Evidence Required

- Source manifest with every discovered source assigned a terminal parse status.
- Coverage report with mathematical reconciliation.
- Validation report showing manifest, corpus, and coverage pass.
- Aggregate class, command, skill, helper, and agent-role mention counts.
- Explicit meta-session count and whether meta sessions were included in rankings.
- Statement of historical claims confirmed, unsupported, contradicted, or not verifiable.

## Safety Rules

- Do not quote raw transcript bodies.
- Do not commit generated corpus files or `pseudonym-map.json`.
- Do not print credential values, database URLs, cookies, bearer headers, private keys, or raw environment values.
- Do not treat commands inside assistant prose or Markdown code fences as executed.
- Do not promote product-specific role mentions into generic agents without repeated independent evidence and handoff contracts.
- Do not invent Cloudflare, Supabase, GitHub, migration, browser, secret-manager, or deploy capabilities when none were confirmed.

## Common Failures

- Source format unsupported: keep it in source accounting rather than silently dropping it.
- Corrupt JSONL lines: parse valid lines, mark the source corrupted, and preserve the coverage gap.
- Extraction sessions contaminate rankings: mark them `EXTRACTION_META_SESSION`.
- Secret leakage risk: validate corpus and inspect only aggregate public-safe output.
- Private source paths in manifest: treat as a safety failure.

## Output Format

Return a report with:

- Source roots inspected as safe opaque identifiers.
- Coverage reconciliation.
- Private corpus location.
- Validation status.
- Confirmed versus unsupported historical findings.
- Documented missing skills/helpers.
- Agent role recovery decision.
- Rebuilt build queue and dependency graph.

## Upgrade Ideas

Add richer source-format adapters only when real source evidence requires them. Do not add another extraction skill; extend `scripts/extract-session-workflows.mjs` and this methodology instead.
