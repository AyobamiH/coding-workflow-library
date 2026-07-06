---
name: project-kb-builder-skill
description: Compile deterministic source-only project knowledge bases without leaking secrets.
category: documentation
routing_triggers:
  - project memory
  - knowledge base
  - durable context
  - project handoff
status: active
---
# Project KB Builder Skill

## Purpose

Compile a deterministic, privacy-safe project knowledge base from existing source evidence so future runs can start with durable context instead of rediscovering the same facts.

The project KB is source-only memory. It is not runtime proof, an embedding store, an LLM summarizer, a private transcript archive, or an agent role.

## When to Use

Use when a repo needs durable handoff context, repeated orientation has become wasteful, or an agent needs a safe package of known project facts before routing the next skill.

Preferred sequence:

1. Run `repo-map` for source orientation.
2. Run `docs-list` for documentation surface.
3. Run `project-kb` to compile durable project memory.

## Inputs Required

- Target repo path.
- Optional Markdown output path when a local KB file is explicitly wanted.
- Optional existing `repo-map` or `docs-list` JSON files.
- Maximum document count if the default needs narrowing.

## Commands

Preview Markdown without writing:

```bash
./scripts/project-kb --repo /path/to/repo --dry-run
```

Emit portable JSON:

```bash
./scripts/project-kb --repo /path/to/repo --json
```

Validate compiled facts:

```bash
./scripts/project-kb --repo /path/to/repo --validate
```

Write an explicit Markdown KB file:

```bash
./scripts/project-kb --repo /path/to/repo --output /path/to/PROJECT_KB.md
```

CLI delegation:

```bash
coding-workflow project-kb --repo /path/to/repo --validate
```

## Procedure

1. Inspect repo state before writing any output file.
2. Generate or reuse `repo-map` evidence.
3. Generate or reuse `docs-list` evidence when documentation is present.
4. Compile the KB with `scripts/project-kb`.
5. Validate the compiled KB.
6. If writing Markdown, use `--output` with an explicit path.
7. Confirm no secret values, database URLs, tokens, private local paths, raw session text, or private corpus bodies are present.
8. Use the KB to select the next safe skill; do not treat it as deployed/runtime truth.

## Evidence Required

- `scripts/project-kb --repo <path> --validate` result.
- JSON or Markdown output mode used.
- Repo-map and docs-list inputs, or a note that they were generated internally.
- Privacy check result.
- Explicit statement of unknowns and not-verified areas.

## Safety Rules

- Do not read `.env` values.
- Do not store or print secrets, tokens, database URLs, cookies, private keys, or raw credential material.
- Do not include raw chat/session transcript bodies or private corpus outputs.
- Use relative paths in portable JSON.
- Report environment files only as present or absent.
- Do not install dependencies.
- Do not run target repo build/test commands.
- Do not mutate git.
- Do not call external services or production endpoints.
- Do not claim runtime truth, deployment status, or account permission proof from the KB.

## Common Failures

- Missing `repo-map` helper: run or build repo-map first.
- Missing `docs-list` helper: compile with repo-map and top-level docs only, then record docs as not verified.
- Secret-shaped output: stop, redact the source field, and rerun validation.
- Output parent directory missing: create it only if local edits are approved and the path is intentional.
- Dirty target repo: report it as source evidence; do not clean or reset.

## Output Format

Markdown output includes:

```text
# Project Knowledge Base

## Project Identity
## Repository Shape
## Stack and Package Manager
## Important Commands
## Documentation Surface
## Skills and Routes
## Validation and Release Gates
## Source-Only Safety Boundaries
## Known Local-Only State
## Verified Facts
## Unknowns and Not Verified
## Recommended First Skills
## Last Generated
```

JSON output follows `schemas/project-kb.schema.json`.

## Upgrade Ideas

- Add an opt-in project-local KB write route for downstream repos.
- Add a migration-review input section after the migration-review helper exists.
- Add a pre-commit hook check that validates committed KB files contain no private paths or secret-shaped values.
