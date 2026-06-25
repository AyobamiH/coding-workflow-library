---
name: route-trace-skill
description: Trace control routes and staged data pipelines without skipping boundaries.
category: debugging
routing_triggers:
  - route trace
  - subagent routing
  - allowAgents
  - session history
  - zero output pipeline
  - candidate attrition
status: active
---
# Route Trace Skill

## Purpose

Trace control routing and staged data flow without skipping boundaries. This includes OpenClaw agent/subagent routing and generic zero-output pipelines where inputs pass through configuration, retrieval, filtering, deduplication, normalisation, and persistence.

## When to Use

Use when an orchestrator cannot spawn agents, subagent history is inaccessible, a governed pipeline stalls, or OpenClaw config changes may have blocked routing.

Use when a job succeeds operationally but produces zero business output, especially when response counters represent only a late stage and do not expose earlier attrition.

## Inputs Required

- OpenClaw root, usually `/home/johnh/.openclaw`.
- Expected agent IDs, such as `researcher`, `trader`, `banker`, `executioner`.
- Current config file path, usually `openclaw.json`.
- User approval before widening agent permissions.
- For data pipelines: source/entrypoint, configured inputs, each filter, external boundaries, database dependencies, response counter assignments, and the current mutation gate.

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

Source-only pipeline trace:

```bash
./scripts/pipeline-diagnostics --source /path/to/pipeline-source
./scripts/pipeline-diagnostics --source /path/to/pipeline-source --json
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
9. For a zero-output pipeline, map every stage in execution order and record its input, output, filter/stop condition, database dependency, external dependency, and available count evidence.
10. Trace each response counter to its exact assignment. Do not infer that a counter named `candidates` represents raw upstream records.
11. Reproduce database-backed filters with read-only counts when approved, then identify the first proven non-zero stage and first proven zero stage.
12. If the gap spans an external boundary or uninstrumented filters, classify the result as evidence-insufficient rather than guessing.
13. If a count-only observability patch is approved, place counters at real transformation boundaries, avoid content/URL/header/user fields, preserve business logic, and stop before deploy or runtime observation unless those gates are separately approved.

## Evidence Required

- Before/after allowlist diff or config snippet.
- `agents_list` showing expected agents.
- Successful `sessions_spawn` result with child session key.
- Either accessible session history or documented policy denial.
- For data pipelines: stage map, counter assignment lines, count attrition, first non-zero/first zero boundary, exact classification, and remaining unverified evidence.

## Safety Rules

- Do not broaden agent access silently.
- Preserve existing `tools.deny` blocks.
- Use harmless smoke-test tasks only.
- Do not enable cross-agent history without explicit approval.
- Do not fetch external sources, invoke production jobs, or create data merely to diagnose zero output unless separately approved.
- Do not edit product code unless a deterministic defect is proven and local edits are explicitly allowed.
- Do not change filters, source configuration, dedupe behaviour, or insertion behaviour as part of a count-only observability patch.

## Common Failures

- CLI patch unsupported: fall back to gateway tool or exact config edit.
- Old text mismatch during edit: reread config and patch narrower JSON block.
- Spawn succeeds but history forbidden: report `tools.agentToAgent.enabled` requirement.
- Wrong workspace: run commands from OpenClaw workspace/root as appropriate.
- Late-stage counter hides earlier attrition: report the uninstrumented boundary and request logs or observability rather than choosing a speculative cause.
- Empty destination table: it may rule out deduplication, but it does not prove upstream input existed.

## Output Format

Report:

- Routing problem found.
- Change made or recommended.
- Verification commands/results.
- Remaining policy limitations.
- For data pipelines: staged flow, counter trace, safe counts, first non-zero/first zero, classification, and next evidence gate.

## Upgrade Ideas

Add adapters for structured application logs and configurable stage-counter schemas without embedding product-specific table names.
