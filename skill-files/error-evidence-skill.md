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

Diagnose failures by collecting the exact error, classifying it, redacting secret-shaped values, and choosing a safe recovery without guessing.

Use this skill to decide whether a failure is retry-safe, John-required, or a hard stop before any mutation continues.

## When to Use

Use when a command, file read, model call, git operation, subagent route, or evidence check fails.

## Inputs Required

- Exact command/tool call.
- Full error message or sanitized log file.
- Intended operation.
- Workspace path and relevant files.
- Current permission gate.
- Whether external services, secrets, deploys, or production endpoints are in scope.

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

Reusable classifier:

```bash
./scripts/failure-evidence --input /path/to/log.txt
cat /path/to/log.txt | ./scripts/failure-evidence --stdin
```

Git identity failure suggestion shown by git:

```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

## Procedure

1. Capture the exact failing command/tool call and exact error.
2. Redact secret-shaped values before including error text in reports.
3. Run `scripts/failure-evidence` when the error text is long or matches a repeated workflow blocker.
4. Classify the error:
   - missing credential;
   - invalid credential;
   - network unreachable;
   - direct-host vs pooler mistake;
   - CLI unavailable;
   - auth unavailable;
   - permission denied;
   - merge blocked;
   - validation failed;
   - unsafe secret exposure risk;
   - external service mutation not permitted;
   - environment format issue;
   - ENOENT/missing file;
   - command not found;
   - model unsupported setting or missing access;
   - quota/billing failure;
   - git identity missing;
   - agent history forbidden.
5. Classify recovery:
   - retry-safe: network/DNS flake, environment format repair, validation failure in local files, missing local generated artifact.
   - John-required: missing/invalid credential, permission denied, auth unavailable, package/tool install need, account access, direct-host/pooler decision.
   - hard-stop: unsafe secret exposure, unapproved external mutation, merge blocked by checks/protection, destructive command needed.
6. Run the smallest read-only check that confirms the diagnosis.
7. Choose a fallback or ask for the missing input.
8. Do not proceed to mutation until the failure is understood and the current permission gate covers recovery.

## Evidence Required

- Exact error text.
- Confirming command output.
- Failure classification.
- Recovery class: retry-safe, John-required, or hard-stop.
- Redaction result.
- Suggested next ledger state.
- Recovery action taken or requested.
- Remaining uncertainty.

## Safety Rules

- Do not retry blindly.
- Do not print secret values, token values, database URLs, credential values, prefixes, suffixes, or lengths.
- Do not configure global git identity without user approval.
- Do not install missing tools without approval.
- Do not change model/provider settings silently.
- Do not broaden agent history access without approval.
- Do not continue to push, deploy, publish, migrate, set secrets, or call production endpoints while failure classification is unresolved.
- Do not classify auth success as permission for GitHub push, PR, merge, release, deploy, or production work.

## Common Failures

- ENOENT: search path/case, then ask for exact path or permission to generate.
- Command not found: use available equivalent, such as `grep` for `rg` or Node for `jq`.
- Missing credential: stop with `Needs John: credential missing`.
- Invalid credential: stop with `Needs John: credential invalid`.
- Network unreachable: retry only after read-only connectivity evidence; do not mutate external state.
- Direct-host vs pooler mistake: stop for database URL repair without printing the URL.
- Permission denied: request the minimum scope or role; do not silently switch account.
- Merge blocked: collect PR/check evidence and stop before merge.
- Validation failed: fix local validation or record caveat before handoff.
- Unsafe secret exposure risk: hard stop and report path/key/risk only.
- External service mutation not permitted: stop at permission boundary.
- Environment format issue: inspect variable-name shape only, not values.
- Unsupported model reasoning: change supported reasoning/model before retrying.
- Quota exceeded: stop and report platform/billing issue.
- Git identity unknown: ask for repo-local or global identity choice.

## Output Format

```text
Failure:
- Command/tool:
- Error:
- Classification:
- Recovery class:
- Evidence checked:
- Suggested ledger state:
- Recovery:
- Blocked on:
```

## Upgrade Ideas

- Expand `scripts/failure-evidence` with JSON output.
- Create `references/common-errors.md` with exact error signatures and recommended recoveries.
- Add runner integration for failed helper output classification.
