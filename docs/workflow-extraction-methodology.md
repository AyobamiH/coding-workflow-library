# Workflow Extraction Methodology

This methodology defines how local OpenClaw/Codex session evidence is converted into a private workflow corpus without promoting memory, raw transcript text, or suggested commands into confirmed facts.

## Evidence Classes

Every corpus event has exactly one `primary_class` and may have multiple `evidence_tags`:

- `USER_REQUEST`
- `ASSISTANT_PROPOSAL`
- `ASSISTANT_DECISION`
- `TOOL_INVOCATION`
- `TOOL_RESULT`
- `SHELL_COMMAND_EXECUTED`
- `SHELL_COMMAND_PROPOSED`
- `FILE_CREATED`
- `FILE_UPDATED`
- `VALIDATION_RESULT`
- `FAILURE_OR_BLOCKER`
- `PERMISSION_OR_AUTHORITY_BOUNDARY`
- `CAPABILITY_BOUNDARY`
- `FUTURE_WORK`
- `BACKLOG_ITEM`
- `AGENT_ROLE_MENTION`
- `SKILL_MENTION`
- `SCRIPT_OR_HELPER_MENTION`
- `ROUTE_OR_CONTROL_PLANE_MENTION`
- `PRODUCT_SPECIFIC_MENTION`

## Source Accounting

Every discovered source receives a terminal status:

- `parsed_successfully`
- `unsupported_format`
- `unreadable`
- `excluded_by_explicit_rule`
- `duplicate`
- `corrupted`
- `empty`
- `generated_by_extraction_process_itself`

Coverage must reconcile:

```text
discovered = parsed + unsupported + corrupt + empty + duplicate + excluded
```

No source may disappear silently.

## Contamination Controls

Sessions whose main purpose is extraction, corpus methodology, backlog recovery, or agent-roadmap audit are marked as `EXTRACTION_META_SESSION`.

They remain in coverage accounting but are excluded from workflow-frequency rankings by default. Use `--include-meta-sessions` only when auditing the extractor itself.

## Executed Versus Proposed Commands

Commands in assistant prose or Markdown code fences are `SHELL_COMMAND_PROPOSED`.

Commands are `SHELL_COMMAND_EXECUTED` only when a shell/tool invocation record proves execution. Tool results are linked to invocations when the session format exposes a call id.

Compound commands are decomposed into top-level components while respecting quotes and escaping. The corpus stores the redacted original chain plus command names/components.

## Privacy Model

The extractor writes private outputs outside the package repository. The portable manifest does not include local paths. The private `pseudonym-map.json` contains local mappings and must never be committed.

Sensitive values are redacted or pseudonymised:

- users -> `<USER_001>`
- emails -> `<EMAIL_001>`
- local paths -> `<LOCAL_PATH_001>`
- URLs -> `<URL_001>`
- credentials -> `<SECRET_REDACTED>`

Raw transcript bodies are not stored in corpus events by default. Events contain short redacted summaries and safe mention arrays.

## CLI

```bash
node scripts/extract-session-workflows.mjs \
  --source /path/to/sessions \
  --output-dir /private/output/path
```

Useful modes:

```bash
node scripts/extract-session-workflows.mjs --source /path --output-dir /private/out --dry-run
node scripts/extract-session-workflows.mjs --output-dir /private/out --validate-only
coding-workflow extract-workflows --source /path --output-dir /private/out
```

The script does not publish, push, deploy, tag, read secret stores, or mutate remote services.
