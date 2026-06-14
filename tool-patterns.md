# Tool Patterns

`tools.md` is authoritative for tool permission gates, approval requirements, and evidence rules.

This file is now a companion for examples and historical notes. Keep durable permission policy in `tools.md`; keep concrete tool-call patterns and past workflow snippets here.

Current local tools to verify later:

- `git`
- `gh`
- `npm`
- `npx`
- `supabase`
- `wrangler`
- `node`
- `rg`
- `jq`
- browser tooling
- secret manager

Read `AGENTS.md` and `tools.md` before using these patterns. A tool being available does not grant permission to install, edit, build, commit, push, deploy, migrate, mutate data, access secrets, call production endpoints, release, or delete.

## Read Before Edit

Use this when modifying config or generated docs.

Pattern:

```text
read {"path":"TARGET"}
edit {"path":"TARGET","oldText":"EXACT_OLD_TEXT","newText":"EXACT_NEW_TEXT"}
```

Evidence:

- Read result matches expected old text.
- Edit reports success.
- Follow-up read or command verifies behavior.

## Write New Generated File

Use this when the user requested a new artifact.

Pattern:

```text
write {"file_path":"memory/2026-02-12.md","content":"# 2026-02-12\n"}
```

Evidence:

- Write result with byte count.
- File can be read.

Safety:

- Do not overwrite user files without reading first unless the file is clearly new/generated.

## Background Process Polling

Use when a process/session ID is returned.

Pattern:

```text
process {"action":"log","sessionId":"briny-lagoon","offset":0,"limit":200}
process {"action":"list"}
```

Evidence:

- Exit code or completion line.
- Expected output file exists.

Safety:

- Do not dump logs that may include secrets.
- Do not poll indefinitely.

## OpenClaw Agent Listing

Pattern:

```text
agents_list {}
session_status {}
```

Evidence:

- Expected agents appear.
- Session status confirms model/runtime if relevant.

Safety:

- Redact API keys from status output.

## OpenClaw Subagent Smoke Test

Pattern:

```text
sessions_spawn {"agentId":"researcher","label":"test_spawn","task":"Output NOTES only: hello","runTimeoutSeconds":120,"cleanup":"keep"}
sessions_history {"sessionKey":"agent:researcher:subagent:SESSION_KEY","limit":20,"includeTools":false}
```

Evidence:

- Child session key and run ID.
- Expected harmless output.
- If history forbidden, exact policy error.

Safety:

- Use harmless prompts.
- Do not enable cross-agent history without approval.

## Gateway Config Patch

Pattern:

```text
gateway {"action":"config.patch","patch":{"agents":{"list":[{"id":"main","subagents":{"allowAgents":["researcher","trader","banker","executioner"]}}]}}}
```

Evidence:

- Config patch accepted.
- `agents_list` and `openclaw subagents list` verify result.

Safety:

- Treat as permission broadening.
- Preserve `tools.deny`.
- Require explicit user intent.

## Error Capture

Pattern:

```text
Command/tool:
Exact error:
Classification:
Fallback:
Evidence:
```

Common classifications:

- ENOENT.
- command not found.
- model unsupported reasoning.
- quota exceeded.
- git identity unknown.
- agent history forbidden.
