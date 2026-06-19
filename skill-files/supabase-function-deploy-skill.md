---
name: supabase-function-deploy-skill
description: Deploy Supabase Edge Functions safely with source preflight, remote secret gates, single-function deploy boundaries, negative runtime checks, no-write dry-run proof, and controlled success handoff. Use for Supabase Edge Function deployment, remote secret setup, deployed function rejection checks, or separating deploy from runtime and success invocation.
category: deployment
routing_triggers:
  - Supabase function deploy
  - Edge Function deploy
  - remote secret setup
  - function negative runtime
  - controlled function success
status: active
---
# supabase-function-deploy-skill

## Purpose

Deploy a Supabase Edge Function without blending source inspection, remote secret setup, deployment, rejection checks, and success-path calls into one permission.

This skill is reusable. Project references, function names, URLs, known secrets, and observed statuses belong in run evidence and logs, not hardcoded in the skill. A project-specific runner may provide concrete values, but the workflow must keep these boundaries separate:

- source preflight;
- environment presence checks without values;
- remote secret setup;
- one named function deploy;
- non-mutating runtime rejection checks;
- no-write dry-run proof;
- controlled success invocation;
- scheduled monitoring or production handoff.

## When to Use

Use when a Supabase Edge Function needs remote secret setup, deployment, runtime rejection checks, or a handoff to controlled success verification.

Use after a source security patch when the function must be deployed, especially if it uses `Deno.env.get`, server-only secrets, service-role access, webhook secrets, admin checks, scheduler secrets, or provider tokens.

Use when previous work embedded deployment logic in `scripts/run-next` and the workflow needs a durable skill owner.

## Inputs Required

- Target repo path.
- Supabase project reference.
- Function name and function directory.
- Required remote secret names, never values.
- Current ledger state.
- Current explicit permission gate.
- Whether network and Supabase CLI calls are allowed.
- Whether runtime checks are allowed.
- Whether a success invocation is allowed.
- Source files proving auth, method handling, writes, dry-run behavior, rate limits, and service-role usage.
- Known expected rejection status codes.
- Known excluded local artifacts such as evidence folders or local Supabase temp folders.

## Commands

Read-only source preflight:

```bash
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" log --oneline -10
rg -n "Deno.env.get|SUPABASE_SERVICE_ROLE_KEY|service_role|verify_jwt|Authorization|authorization|Bearer|secret|signature|rateLimit|insert|update|delete|upsert|dry|dryRun|preview|validate" "$TARGET_REPO/supabase/functions/$FUNCTION_NAME" "$TARGET_REPO/supabase/config.toml" --glob '!node_modules'
```

Environment presence checks must report only set or not set:

```bash
test -n "$SUPABASE_ACCESS_TOKEN" && echo "SUPABASE_ACCESS_TOKEN is set" || echo "SUPABASE_ACCESS_TOKEN is not set"
test -n "$SUPABASE_PROJECT_REF" && echo "SUPABASE_PROJECT_REF is set" || echo "SUPABASE_PROJECT_REF is not set"
test -n "$REQUIRED_FUNCTION_SECRET" && echo "required function secret is set" || echo "required function secret is not set"
```

Supabase CLI inspection and project access, only after the matching permission gate:

```bash
npx supabase --version
SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" npx supabase projects list
npx supabase secrets set --help
npx supabase functions deploy --help
```

Remote secret setup with a temporary env file outside the repo, only after remote-secret permission:

```bash
mkdir -p "$LOCAL_PRIVATE_TMP"
chmod 700 "$LOCAL_PRIVATE_TMP"
# Create a chmod 600 env file outside the target repo without printing values.
SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" npx supabase secrets set --env-file "$TEMP_SECRET_ENV_FILE" --project-ref "$SUPABASE_PROJECT_REF"
rm -f "$TEMP_SECRET_ENV_FILE"
test ! -f "$TEMP_SECRET_ENV_FILE" && echo "temporary secret env file removed"
```

Single function deploy, only after deploy permission:

```bash
SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" npx supabase functions deploy "$FUNCTION_NAME" --project-ref "$SUPABASE_PROJECT_REF"
```

Negative runtime checks, only after runtime rejection-check permission:

```bash
curl -sS -o /tmp/function-options.out -w "%{http_code}\n" -X OPTIONS "$FUNCTION_URL"
curl -sS -o /tmp/function-get.out -w "%{http_code}\n" -X GET "$FUNCTION_URL"
curl -sS -o /tmp/function-post-no-auth.out -w "%{http_code}\n" -X POST "$FUNCTION_URL" -H "Content-Type: application/json" --data '{}'
curl -sS -o /tmp/function-post-invalid-secret.out -w "%{http_code}\n" -X POST "$FUNCTION_URL" -H "Content-Type: application/json" -H "x-test-secret: invalid" --data '{}'
```

## Procedure

1. Read `AGENTS.md`, `tools.md`, `RUNBOOK.md`, this skill, and `runtime-verification-skill`.
2. Confirm the current ledger state and exact permission gate.
3. Confirm the target repo exists and capture branch, status, staged files, and recent commits.
4. Refuse to continue if tracked or staged target repo changes are outside the approved scope.
5. Inspect function source and config before any Supabase or runtime command.
6. Identify function auth checks, secret checks, admin checks, service-role usage, rate limits, CORS, method handling, and writes.
7. Confirm whether a true no-write dry-run path exists. A parameter name alone is not proof.
8. Check local env variable presence without printing values, prefixes, suffixes, or lengths.
9. Verify project reference matches the approved project.
10. Verify Supabase CLI availability and project access only if cloud-read permission is granted.
11. Set remote function secrets only if secret-write permission is granted.
12. Store temporary secret env files outside the target repo, chmod them to private mode, never print contents, and delete them immediately.
13. Deploy only the named function if deployment permission is granted.
14. Run only negative/non-mutating runtime checks if runtime rejection-check permission is granted.
15. Do not send real scheduler secrets, admin bearer tokens, or success payloads during negative checks.
16. If source proves a no-write dry-run path and dry-run success is approved, run exactly one no-write success request.
17. If a success path may write app data, stop and route to `runtime-verification-skill` for controlled success invocation.
18. Update the ledger and run log with evidence, status, and next permission.

## Evidence Required

- Target repo path, branch, status, staged-file result, and recent commit evidence.
- Function name and source files inspected.
- Auth, secret, service-role, rate-limit, method, and write-boundary findings.
- Dry-run/no-write proof decision.
- Env variable presence only.
- Supabase CLI version if run.
- Project access result if checked.
- Remote secret setup result without values.
- Temporary secret file creation and deletion proof without values.
- Single function deploy result.
- Runtime rejection status codes and sanitized response summaries.
- Secret-exposure scan over captured responses.
- Confirmation that success path was not run unless separately approved and proven no-write.
- Next ledger state and next permission.

## Safety Rules

- Do not print secrets, token values, database URLs, bearer values, prefixes, suffixes, or lengths.
- Do not read or write target repo `.env` files for deployment secrets.
- Do not write secrets into source files, docs, migrations, logs, or evidence.
- Do not deploy more than the approved named function.
- Do not run `supabase db push`, apply migrations, execute SQL, mutate schedulers, or write app tables under this skill.
- Do not call runtime success paths under a negative-check gate.
- Do not use a real scheduler secret or admin token unless the matching success gate explicitly allows it.
- Do not treat deployment success as production safety.
- Do not treat negative runtime checks as proof that the success path is correct.
- Do not push, create PRs, merge, tag, publish, or deploy other services from this skill.

## Common Failures

- Source preflight is skipped and a public function still lacks auth.
- Remote secret setup and deploy are treated as one implicit action.
- Deploying all functions instead of the one approved function.
- Temporary secret files are created inside the target repo.
- Negative checks accidentally use a valid secret.
- A `dryRun` request still reaches insert/update code.
- Runtime response body includes secret-shaped content.
- Function deployment succeeds but scheduler or production traffic still points to older behavior.
- Success invocation is retried after a transient failure without a new approval.

## Output Format

```text
# Supabase Function Deploy Report

## Selected Skill
supabase-function-deploy-skill

## Target Repo

## Permission Gate

## Function Source Decision

## Env Presence

## Supabase Auth Result

## Remote Secret Setup Result

## Temporary Secret File Handling

## Function Deploy Result

## Runtime Checks

## Success Path Decision

## Commands Not Run

## Secret Exposure Check

## Ledger Update

## Run Log Update

## Next Permission Needed
```

## Upgrade Ideas

- Add a reusable `scripts/supabase-function-deploy` wrapper that consumes route metadata.
- Add response redaction fixtures for Supabase Edge Function outputs.
- Add a source parser for method/auth/write/dry-run decisions.
- Add a deploy evidence adapter that records function version and deployment timestamp when the CLI exposes it safely.
- Add JSON output for `scripts/run-next` route consumption.
