---
name: llm-drift-control-skill
description: Recover from model, provider, and runtime drift errors.
category: debugging
routing_triggers:
  - model error
  - provider drift
  - quota failure
  - reasoning mismatch
status: active
---
# LLM Drift Control Skill

## Purpose

Detect and recover from LLM runtime drift: unsupported reasoning levels, missing model access, quota failures, and reasoning-item mismatch errors.

## When to Use

Use when an agent run fails before doing project work, repeatedly retries with the same provider error, or user-facing progress stalls due to model settings.

## Inputs Required

- Provider/model name.
- Exact API error.
- Current task state.
- Whether the failure happened before or after tool execution.

## Commands

No terminal command is required for provider-side model errors. Use session logs and error strings. Confirmed error strings:

```text
400 Unsupported value: 'low' is not supported with the 'gpt-5-pro' model. Supported values are: 'high'.
400 Unsupported value: 'low' is not supported with the 'gpt-5.2-pro' model. Supported values are: 'medium', 'high', and 'xhigh'.
The model `gpt-5.3-codex` does not exist or you do not have access to it.
You exceeded your current quota, please check your plan and billing details.
400 Item '...' of type 'reasoning' was provided without its required following item.
```

## Procedure

1. Capture exact provider error.
2. Determine if any project tool calls ran.
3. If no project tools ran, classify as platform/config failure, not project failure.
4. Choose recovery:
   - Unsupported reasoning: use a supported reasoning value or model.
   - Model missing: switch to accessible model.
   - Quota exceeded: stop and ask for billing/quota resolution.
   - Reasoning item mismatch: restart clean session/request.
5. Continue only after the model run starts successfully.

## Evidence Required

- Exact error string.
- Statement whether project state changed.
- Corrected model/reasoning setting or blocked reason.

## Safety Rules

- Do not present model errors as repo/test failures.
- Do not keep retrying the same invalid setting.
- Do not mask quota failures with speculative project debugging.

## Common Failures

- Multiple queued messages retry same bad setting: summarize once and fix config.
- Quota errors mixed with task prompts: separate platform issue from user request.
- Reasoning item mismatch: avoid resubmitting stale reasoning items.

## Output Format

```text
LLM run failure:
- Model/provider:
- Error:
- Project state changed: yes/no
- Recovery:
- Next run condition:
```

## Upgrade Ideas

Create a small parser that scans session logs for provider error messages and groups them by root cause.
