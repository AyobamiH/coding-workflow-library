---
name: error-evidence-skill
description: Capture command errors and choose safe recovery.
category: debugging
routing_triggers:
  - command failed
  - error evidence
  - diagnose failure
  - recovery path
status: active
---
# Error Evidence Skill

## Purpose

Diagnose failures by collecting the exact error, classifying it, and choosing a safe recovery without guessing.

## When to Use

Use when a command, file read, model call, git operation, subagent route, or evidence check fails.

## Inputs Required

- Exact command/tool call.
- Full error message.
- Intended operation.
- Workspace path and relevant files.

## Commands

Missing file:

```bash
ls MEMORY.md
find . -maxdepth 3 -iname 'runbook*' -ls
find . -maxdepth 4 -type f -iname 'watchlist*' -ls
```

Missing tool fallback checks:

```bash
jq --version
which node && node -v && which curl && curl --version | head -n 2
```

Git identity failure suggestion shown by git:

```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

## Procedure

1. Capture the exact failing command/tool call and exact error.
2. Classify the error:
   - ENOENT/missing file.
   - command not found.
   - model unsupported setting or missing access.
   - quota/billing failure.
   - git identity missing.
   - agent history forbidden.
3. Run the smallest read-only check that confirms the diagnosis.
4. Choose a fallback or ask for the missing input.
5. Do not proceed to mutation until the failure is understood.

## Evidence Required

- Exact error text.
- Confirming command output.
- Recovery action taken or requested.
- Remaining uncertainty.

## Safety Rules

- Do not retry blindly.
- Do not configure global git identity without user approval.
- Do not install missing tools without approval.
- Do not change model/provider settings silently.
- Do not broaden agent history access without approval.

## Common Failures

- ENOENT: search path/case, then ask for exact path or permission to generate.
- Command not found: use available equivalent, such as `grep` for `rg` or Node for `jq`.
- Unsupported model reasoning: change supported reasoning/model before retrying.
- Quota exceeded: stop and report platform/billing issue.
- Git identity unknown: ask for repo-local or global identity choice.

## Output Format

```text
Failure:
- Command/tool:
- Error:
- Classification:
- Evidence checked:
- Recovery:
- Blocked on:
```

## Upgrade Ideas

Create `references/common-errors.md` with exact error signatures and recommended recoveries.
