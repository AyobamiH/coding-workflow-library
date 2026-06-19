---
name: runtime-verification-skill
description: Run runtime verification with negative checks, dry-run proof, controlled success gates, and scheduled monitoring boundaries.
category: verification
routing_triggers:
  - runtime verification
  - negative runtime checks
  - controlled success invocation
  - dry-run runtime proof
  - scheduled monitoring
status: active
---
# runtime-verification-skill

## Purpose

Verify deployed or locally running runtime behavior without collapsing all endpoint checks into one risky success call.

This skill separates negative/non-mutating checks, true no-write dry-run checks, controlled success checks, scheduled monitoring, and production-write boundaries. It is generic: it can apply to web apps, APIs, serverless functions, workers, jobs, webhooks, and scheduled tasks. Product-specific workflows may add details, but they must keep these permission gates separate.

## When to Use

Use when a task asks to verify a live endpoint, deployed function, webhook, cron job, worker, scheduler, background job, or runtime behavior.

Use after deploy-like work when the next step could call a live service, trigger writes, send emails, charge money, publish content, enqueue jobs, import data, mutate a database, or call production providers.

Use before any success-path request if the source does not prove a true no-write dry-run mode.

## Inputs Required

- Target repo path.
- Runtime URL or local server URL.
- Endpoint, route, job name, webhook, or scheduler name.
- Current permission gate: negative checks, dry-run success, controlled success, or scheduled monitoring.
- Source file proving request method handling, auth rules, write behavior, and dry-run behavior if claimed.
- Known safe headers and known forbidden headers.
- Whether credentials, tokens, secrets, admin auth, or production provider keys are allowed.
- Expected status codes and failure modes.
- Any tables, queues, files, providers, emails, payments, posts, or external side effects that could be mutated.

## Commands

Read-only/source inspection examples:

```bash
git -C "$TARGET_REPO" status --short
rg -n "dryRun|dry-run|preview|validate|insert|update|delete|upsert|send|charge|publish|enqueue|schedule|webhook|Authorization|Bearer|secret|signature" "$TARGET_REPO" --glob '!node_modules' --glob '!dist' --glob '!build'
```

Negative/non-mutating HTTP checks. Replace URL and headers with approved values only:

```bash
curl -s -o /tmp/runtime-options.out -w "%{http_code}\n" -X OPTIONS "$RUNTIME_URL"
curl -s -o /tmp/runtime-get.out -w "%{http_code}\n" -X GET "$RUNTIME_URL"
curl -s -o /tmp/runtime-post-no-auth.out -w "%{http_code}\n" -X POST "$RUNTIME_URL" -H "Content-Type: application/json" --data '{}'
curl -s -o /tmp/runtime-post-invalid-auth.out -w "%{http_code}\n" -X POST "$RUNTIME_URL" -H "Content-Type: application/json" -H "x-test-secret: invalid" --data '{}'
```

Dry-run success checks are allowed only when source proves a no-write path:

```bash
curl -s -o /tmp/runtime-dry-run.out -w "%{http_code}\n" -X POST "$RUNTIME_URL" -H "Content-Type: application/json" --data '{"dryRun":true}'
```

Controlled success checks require separate explicit approval and must be exactly scoped:

```bash
# Example shape only. Use the target repo's approved command and approved credentials.
curl -s -o /tmp/runtime-success.out -w "%{http_code}\n" -X POST "$RUNTIME_URL" -H "Content-Type: application/json" --data '{"approvedSingleRun":true}'
```

## Procedure

1. Read `AGENTS.md`, `tools.md`, and this skill.
2. Confirm the current permission gate: negative checks, dry-run success, controlled success, or scheduled monitoring.
3. Inspect source before calling the runtime.
4. Identify every operation that can write data, send side effects, call providers, publish content, schedule work, or mutate production state.
5. Identify method handling, auth checks, signature checks, rate limits, and response codes.
6. Decide whether the runtime has a true no-write dry-run mode. A label such as `dryRun` is not enough; source must prove the write path is skipped.
7. Run only negative/non-mutating checks under a negative-check gate.
8. Do not send real secrets, admin auth, provider tokens, valid scheduler secrets, or success payloads during negative checks.
9. If a dry-run success gate is approved and source proves no writes, run exactly the approved no-write success request.
10. If controlled success is approved, capture read-only before evidence, run exactly one success invocation, then capture read-only after evidence.
11. If scheduled monitoring is approved, inspect job metadata, run history, logs, or read-only downstream effects without manually triggering the job unless separately approved.
12. Stop immediately if a request unexpectedly succeeds under a rejection check, returns unclear auth behavior, or appears to mutate data.
13. Update `work-ledger.md` and `runs/skill-runs.md` with status, evidence, stop boundary, and next permission.

## Evidence Required

- Target repo and runtime URL class without secrets.
- Source files inspected.
- Write/side-effect map.
- Dry-run proof decision.
- Commands run and status codes.
- Sanitized response summaries.
- Confirmation that no real secret values were printed.
- Confirmation that no success write path was run unless separately approved.
- Before/after read-only evidence for controlled success checks.
- Scheduled monitoring evidence if used.
- Final runtime status and next ledger state.

## Safety Rules

- Do not call production endpoints without explicit runtime verification permission.
- Do not run success-path calls under a negative-check gate.
- Do not use real secrets in a request unless the matching gate explicitly allows that credential and request.
- Do not print tokens, secrets, passwords, database URLs, bearer values, signatures, or credential fragments.
- Do not assume `dryRun`, `preview`, or `validate` is no-write without source proof.
- Do not retry success-path calls automatically.
- Do not write app tables, queues, files, provider resources, payments, emails, posts, or scheduler state unless a controlled success or mutation gate explicitly allows it.
- Do not treat scheduled monitoring as permission to manually trigger the scheduled job.
- Do not mix deploy, secret setup, database migration, runtime verification, and success invocation into one permission gate.

## Common Failures

- Negative check unexpectedly succeeds: stop and route to security hardening.
- Dry-run mode exists in parameters but still reaches write code: stop and mark dry-run proof failed.
- Runtime returns a generic error for all auth failures: record ambiguity and request source/log review.
- Missing or invalid credential: route to auth/env audit without printing values.
- Network unreachable or DNS failure: classify with `error-evidence-skill` before retrying.
- Rate limit unclear: avoid repeated calls and request a bounded verification plan.
- Response body includes sensitive data: redact before reporting.
- Success path needs production write: request a controlled success invocation gate or scheduled monitoring gate.

## Output Format

```text
# Runtime Verification Report

## Selected Skill
runtime-verification-skill

## Target

## Permission Gate

## Source Inspected

## Write And Side-Effect Map

## Dry-Run Proof

## Checks Run

## Results

## Success Path Decision

## Commands Not Run

## Secret Exposure Check

## Ledger Update

## Run Log Update

## Next Permission Needed
```

## Upgrade Ideas

- Add `scripts/runtime-verify` for method/auth/status-code matrices.
- Add response redaction fixtures for common API shapes.
- Add a no-write proof parser that traces dry-run flags to write branches.
- Add scheduled monitoring adapters for cron, queues, serverless logs, and worker logs.
- Add JSON output for use by `scripts/run-next`.
