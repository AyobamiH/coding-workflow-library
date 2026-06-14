---
name: tool-patterns-skill
description: Coordinate safe local tool usage patterns.
category: automation
routing_triggers:
  - tool pattern
  - read before edit
  - process polling
  - tool failure
status: active
---
# Tool Patterns Skill

## Purpose

Use local agent tools consistently: read before edit, prefer exact patches, poll long-running processes, and separate tool failures from project failures.

## When to Use

Use whenever a task requires multiple shell commands, file reads/writes, background processes, OpenClaw tool calls, or session tracing.

## Inputs Required

- Tool available in current environment.
- Target file/path/session ID.
- Whether operation is read-only or mutating.

## Commands

Confirmed tool-call patterns:

```text
read {"path":"SOUL.md"}
read {"file_path":"RUNBOOK.md"}
write {"file_path":"memory/2026-02-12.md","content":"# 2026-02-12\n"}
edit {"path":"/home/johnh/.openclaw/openclaw.json","oldText":"...","newText":"..."}
process {"action":"log","sessionId":"briny-lagoon","offset":0,"limit":200}
process {"action":"list"}
agents_list {}
session_status {}
sessions_spawn {"agentId":"researcher","label":"test_spawn","task":"Output NOTES only: hello","runTimeoutSeconds":120,"cleanup":"keep"}
sessions_history {"sessionKey":"agent:researcher:subagent:SESSION_KEY","limit":20,"includeTools":false}
gateway {"action":"config.patch","patch":{...}}
```

## Procedure

1. Read relevant files before editing.
2. Prefer exact old/new edits for config changes.
3. Use write only for newly created files or fully owned generated artifacts.
4. Poll background processes with `process log`; verify output files after completion.
5. Use session/subagent tools for route tracing, not for arbitrary data mining.
6. Record tool errors exactly.

## Evidence Required

- Read result before edit.
- Successful write/edit result.
- Background process output and generated files.
- Tool error text if failed.

## Safety Rules

- Do not dump secrets from tool results.
- Do not edit config without verification path.
- Do not use broad history access without approval.
- Do not poll forever; report stalled processes.

## Common Failures

- `oldText` mismatch: reread file and narrow patch.
- Process log incomplete: poll again with offset/limit.
- Session history forbidden: report policy and use allowed transcript path.
- Write overwrites file: read first unless file is intentionally new.

## Output Format

```text
Tool workflow:
- Tools used:
- Files/sessions touched:
- Evidence:
- Failures:
- Next action:
```

## Upgrade Ideas

Create reference snippets for each OpenClaw tool and a wrapper script for process polling.
