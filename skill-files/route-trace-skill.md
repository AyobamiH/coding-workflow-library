---
name: route-trace-skill
description: Trace OpenClaw agent routing and subagent access.
category: debugging
routing_triggers:
  - route trace
  - subagent routing
  - allowAgents
  - session history
status: active
---
# Route Trace Skill

## Purpose

Trace and repair OpenClaw agent/subagent routing, including allowlists, spawn access, session history access, and pipeline role connectivity.

## When to Use

Use when an orchestrator cannot spawn agents, subagent history is inaccessible, a governed pipeline stalls, or OpenClaw config changes may have blocked routing.

## Inputs Required

- OpenClaw root, usually `/home/johnh/.openclaw`.
- Expected agent IDs, such as `researcher`, `trader`, `banker`, `executioner`.
- Current config file path, usually `openclaw.json`.
- User approval before widening agent permissions.

## Commands

```bash
cd /home/johnh/.openclaw && grep -R "allowAgents" -n
cd /home/johnh/.npm-global/lib/node_modules/openclaw && rg -n "allowAgents"
cd /home/johnh/.npm-global/lib/node_modules/openclaw && grep -R "allowAgents" -n docs
cd /home/johnh/.openclaw/workspace && openclaw config --help
cd /home/johnh/.openclaw/workspace && openclaw gateway --help
cd /home/johnh/.openclaw/workspace && openclaw gateway config --help
cd /home/johnh/.openclaw/workspace && openclaw subagents list
```

Patch command confirmed in extraction:

```bash
cd /home/johnh/.openclaw/workspace && openclaw config patch '{"agents":{"list":[{"id":"main","subagents":{"allowAgents":["researcher","trader","banker","executioner"]}}]}}'
```

Tool-call templates:

```text
agents_list {}
sessions_spawn {"agentId":"researcher","label":"test_spawn","task":"Output NOTES only: hello","runTimeoutSeconds":120,"cleanup":"keep"}
sessions_history {"sessionKey":"agent:researcher:subagent:SESSION_KEY","limit":20,"includeTools":false}
gateway {"action":"config.patch","patch":{"agents":{"list":[{"id":"main","subagents":{"allowAgents":["researcher","trader","banker","executioner"]}}]}}}
```

## Procedure

1. Read current agent config and docs references for `allowAgents`.
2. List configured agents.
3. Check whether the orchestrator has an explicit `subagents.allowAgents` list.
4. If missing, propose the exact allowlist patch.
5. Apply only after user approval because this widens routing capability.
6. Verify with `agents_list` and `openclaw subagents list`.
7. Run a harmless spawn test: `Output NOTES only: hello`.
8. If `sessions_history` is forbidden, report the policy and use transcript path or ask before enabling cross-agent history.

## Evidence Required

- Before/after allowlist diff or config snippet.
- `agents_list` showing expected agents.
- Successful `sessions_spawn` result with child session key.
- Either accessible session history or documented policy denial.

## Safety Rules

- Do not broaden agent access silently.
- Preserve existing `tools.deny` blocks.
- Use harmless smoke-test tasks only.
- Do not enable cross-agent history without explicit approval.

## Common Failures

- CLI patch unsupported: fall back to gateway tool or exact config edit.
- Old text mismatch during edit: reread config and patch narrower JSON block.
- Spawn succeeds but history forbidden: report `tools.agentToAgent.enabled` requirement.
- Wrong workspace: run commands from OpenClaw workspace/root as appropriate.

## Output Format

Report:

- Routing problem found.
- Change made or recommended.
- Verification commands/results.
- Remaining policy limitations.

## Upgrade Ideas

Create `scripts/check_subagents.sh` to list agents, inspect allowlist, run a safe spawn test, and summarize policy denials.
