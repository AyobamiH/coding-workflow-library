---
name: supabase-rls-audit-skill
description: Audit Supabase RLS, anon key, and function boundaries.
category: security
routing_triggers:
  - Supabase RLS
  - public anon key
  - Edge Function service role
  - policy audit
status: active
---
# supabase-rls-audit-skill

## Purpose

Audit Supabase public-anon safety from source evidence by connecting:

frontend access -> table/RPC/function -> policy/function boundary -> risk

This skill audits:

- Supabase public anon/publishable key safety.
- RLS policy coverage.
- Frontend direct table access.
- RPC exposure.
- Edge Function service-role boundaries.
- `verify_jwt=false` function risk.
- Storage policies.
- SQL functions.
- Grants and revokes.
- Source-only production confidence.

Supabase anon/publishable keys and Supabase URLs are expected to be public in browser apps. The public anon key is only safe when RLS policies, RPC grants, storage policies, and public endpoint boundaries are correct. A source-only audit does not prove deployed production state unless deployed Supabase evidence is explicitly collected.

## When to Use

Use this skill when:

- A public Supabase anon or publishable key appears in frontend code.
- Browser/client code uses Supabase directly.
- The repo has Supabase migrations.
- The repo has Supabase Edge Functions.
- The repo has `verify_jwt=false` functions.
- A service-role key is used in functions.
- Public forms, checkout, webhook, import, admin, or content endpoints exist.
- The project is approaching production launch.
- Supabase changes were generated or edited by an LLM.
- The project migrated from Lovable/Supabase cloud paths.
- Stripe, webhook, n8n, admin, or content-import features were added.

## Inputs Required

- Target repo path.
- Skills library path.
- Whether the audit is source-only or deployed verification is allowed.
- Supabase project reference, if available.
- Whether production Supabase access is allowed.
- Whether network calls are allowed.
- Whether edits are allowed.
- Known public endpoints.
- Known sensitive tables or features.

## Commands

These are read-only command templates. Do not print secret values from command output. If output includes JWTs, API keys, database URLs, webhook secrets, provider tokens, or private key material, redact values and report only file, line, variable name, and risk category.

Confirm repo state:

```bash
pwd
ls -la "$TARGET_REPO"
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
```

Find Supabase files:

```bash
find "$TARGET_REPO/supabase" -maxdepth 4 -type f | sort
find "$TARGET_REPO/supabase" -maxdepth 4 -type d | sort
```

Scan migrations for RLS, policies, SQL functions, role references, storage, and grants:

```bash
rg -n "create table|alter table|enable row level security|disable row level security|force row level security|create policy|drop policy|alter policy|grant |revoke |security definer|security invoker|security_barrier|security_invoker|create view|create function|create trigger|auth.uid()|auth.role()|auth.jwt()|user_metadata|raw_user_meta_data|app_metadata|storage.objects|service_role|anon|authenticated|public" "$TARGET_REPO/supabase/migrations" --glob '*.sql'
```

Map frontend and function Supabase use:

```bash
rg -n "createClient|supabase.from|supabase.auth|supabase.rpc|storage.from|functions.invoke|channel(" "$TARGET_REPO/src" "$TARGET_REPO/scripts" "$TARGET_REPO/supabase/functions" --glob '!node_modules' --glob '!dist' --glob '!build'
```

Map Edge Function environment, service-role, JWT, CORS, auth, secrets, and privileged writes:

```bash
rg -n "Deno.env.get|SUPABASE_SERVICE_ROLE_KEY|service_role|createClient|verify_jwt|Authorization|authorization|Bearer|cors|origin|ALLOWED_ORIGINS|auth.getUser|jwt|webhook|secret|signature|rateLimit|admin|insert|update|delete|upsert|rpc|from(" "$TARGET_REPO/supabase/functions" "$TARGET_REPO/supabase/config.toml" --glob '!node_modules'
```

Find storage policies and storage use:

```bash
rg -n "storage.|storage.objects|create policy.*storage|bucket|buckets|storage.from" "$TARGET_REPO/supabase/migrations" "$TARGET_REPO/src" "$TARGET_REPO/supabase/functions" --glob '!node_modules'
```

Find SQL functions, RPC calls, and execute grants:

```bash
rg -n "create or replace function|create function|security definer|security invoker|grant execute|revoke execute|rpc(" "$TARGET_REPO/supabase/migrations" "$TARGET_REPO/src" "$TARGET_REPO/supabase/functions" --glob '!node_modules'
```

If a template fails because a literal parenthesis is interpreted as regex syntax, rerun the same search with the literal parenthesis escaped or split the search into smaller `rg -n` searches. Record the failed command and the corrected read-only command.

## Procedure

1. Read `RUNBOOK.md`, confirm this skill is selected, and record why.
2. Confirm the target repo exists.
3. Capture Git branch and working tree state.
4. Confirm Supabase folders and files exist.
5. Inspect Supabase client creation.
6. Confirm whether frontend code uses anon/publishable key only.
7. Confirm no service-role key appears in `src` or `public`.
8. Map frontend direct Supabase table/RPC/function usage.
9. Inspect all migrations.
10. Build a table inventory.
11. For every table, identify whether RLS is enabled.
12. For every table, identify whether `FORCE ROW LEVEL SECURITY` is used.
13. For every table, identify policies.
14. For every table, identify frontend direct access.
15. For every table, identify Edge Function access.
16. Classify table risk.
17. Parse policy bodies.
18. Classify policies by `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `ALL`.
19. Identify risky policy patterns.
20. Inspect `supabase/config.toml` for `verify_jwt=false`.
21. Inspect every Edge Function.
22. Build an Edge Function service-role/auth matrix.
23. Flag public functions that use service-role and mutate data without strong auth, shared-secret, or signature checks.
24. Inspect storage policies and bucket usage.
25. Inspect SQL functions/RPCs, especially `SECURITY DEFINER`.
26. Inspect grants and revokes.
27. Map frontend routes/features to Supabase operations.
28. Produce a source-only safety judgement.
29. Recommend the next skill.
30. Append the run log.

### Table and RLS Inventory Rules

Produce a table with these columns:

- Table
- Created in migration
- RLS enabled
- Force RLS
- Policies found
- Frontend direct access
- Edge Function access
- Risk
- Evidence

Rules:

- If a table is created but no RLS enable statement is found, mark high review if it can be reached by frontend or exposed APIs.
- If RLS is enabled but no policies exist, mark it locked down by default and verify app behaviour.
- If public read is limited to published content, mark low or medium depending on sensitivity.
- If public insert uses `WITH CHECK true`, mark high review unless clearly designed for public form intake with rate limits and abuse controls.
- If a service-role policy exists, it is not automatically wrong, but every service-role caller must be reviewed.

### Policy Quality Review Rules

Produce a table with these columns:

- Table
- Policy
- Operation
- Role
- Uses auth.uid/auth.role
- Ownership/admin check
- Broad access concern
- Risk
- Evidence

Risk checks must include:

- Public read policies.
- Public insert policies.
- Public update/delete policies.
- `USING true`.
- `WITH CHECK true`.
- Anon role writes.
- Authenticated-wide access without ownership checks.
- Missing `WITH CHECK` on insert/update.
- Admin checks depending on editable user fields.
- Multi-tenant tables without tenant boundary.
- Service-role-only operations hidden behind public functions.
- `auth.role()` used instead of explicit policy `TO` role clauses.
- `TO authenticated` used without an ownership, admin, or tenant predicate.
- `auth.jwt()` authorization depending on user-editable metadata.
- UPDATE policies lacking the SELECT policy needed to find target rows.
- Views exposed without `security_invoker = true` or explicit revoke/unexposed-schema protection.

### Edge Function Service-Role Boundary Rules

Produce a table with these columns:

- Function
- JWT disabled
- Service role used
- Auth/secret/signature check
- DB writes/privileged action
- Risk
- Evidence

Risk rules:

Critical:

- `verify_jwt=false`.
- Service-role key used.
- Privileged write/action exists.
- No obvious auth, shared secret, webhook signature, or server-side user verification.

High:

- Public function with service-role and unclear auth.
- Public function writes to sensitive/admin/customer tables.
- Public function trusts request body for privileged DB writes.
- Function calls privileged RPC without auth boundary.

Medium:

- Public unauthenticated function using private provider APIs.
- Public checkout/session function needing allowlist review.
- Optional webhook secret fallback.
- CORS or rate-limit unclear.

Low:

- Public read-only sitemap/feed function.
- Webhook with strong signature verification.
- Authenticated function that verifies token and checks admin RPC.

### Frontend Supabase Usage Mapping

Produce a table with these columns:

- File/route
- Supabase operation
- Table/RPC/function
- Direct frontend or Edge Function
- RLS dependency
- Risk
- Evidence

Every mapped item must connect frontend access -> table/RPC/function -> policy/function boundary -> risk. Do not conclude only that "RLS exists"; state which policy or function boundary protects the access and whether that boundary is sufficient.

### Storage Policy Review

Review:

- Buckets.
- Public bucket read.
- Admin write.
- Frontend `storage.from`.
- Storage object path ownership.
- Storage policies on `storage.objects`.

If no storage use is found, say so explicitly.

### SQL Function/RPC Review

Review:

- `SECURITY DEFINER`.
- `SECURITY INVOKER`.
- Function execute grants.
- Frontend RPC calls.
- RLS policy helper functions.
- Admin helper functions.
- Functions that bypass RLS or insert audit rows.

### Grants/Revoke Review

Check migrations for:

- `grant`.
- `revoke`.
- `grant execute`.
- `revoke execute`.
- Role mentions: `anon`, `authenticated`, `service_role`, `public`.
- Data API exposure assumptions: grants to `anon` or `authenticated` are separate from RLS and must be reviewed with the table's policies.

If none are found, say deployed grants must be verified.

### Risk Classification

Critical:

- Service-role key exposed in frontend/public code.
- Anon/public users can read or write sensitive customer/admin data.
- Public unauthenticated endpoint can perform privileged writes without secret, signature, or auth check.
- Broad update/delete policies for anon/public users.

High:

- Tables without RLS but referenced by frontend.
- Public functions with service-role and weak/no auth checks.
- Policies allowing public write.
- Security definer functions exposed to anon/authenticated without strong checks.
- Security definer functions in `public` or exposed schemas without explicit execute revokes and caller identity checks.
- Missing ownership/tenant checks on user/customer data.

Medium:

- Missing `.env.example` coverage for Supabase secrets.
- `verify_jwt=false` functions requiring manual endpoint review.
- Public read policies that may be intentional but expose business data.
- Incomplete policy coverage.
- Migration/header API key patterns needing verification.
- Data API grant/exposure state needing deployed verification.
- `auth.role()` policy patterns needing replacement with policy `TO` clauses.
- Provider token restrictions needing provider-side verification.

Low:

- Expected public anon/publishable key.
- Expected public Supabase URL.
- Placeholder-only docs.
- RLS enabled with narrow ownership policies.

### Public Anon Key Safety Judgement

Force one of these statuses:

PASS:
No material RLS/public-anon risk found in source audit.

PASS WITH REVIEW ITEMS:
Expected public config is present, but some endpoints/policies need review.

FAIL:
Confirmed high/critical exposure path in source.

INCONCLUSIVE:
Migrations/source are insufficient to judge deployed safety.

The judgement must answer:

- Is the public Supabase anon/publishable key itself a leak?
- Is it safe in this repo based on current source evidence?
- What must be true for it to be safe?
- Which exact tables/functions/policies need review before production confidence?
- What remains unverified because this was source-only?

## Evidence Required

- Target repo path.
- Git state.
- Supabase files inspected.
- Frontend client boundary.
- Frontend direct Supabase usage.
- Table inventory.
- RLS enablement.
- Policy list.
- Policy quality review.
- Edge Function service-role/auth matrix.
- Storage review.
- SQL function/RPC review.
- Grants/revokes review.
- Risk classification.
- Public anon key safety judgement.
- Recommended next skill.
- Run log update.

## Safety Rules

- Do not edit the target repo during audit unless explicitly asked.
- Do not run migrations.
- Do not deploy.
- Do not reset, seed, link, push, or pull Supabase.
- Do not mutate Supabase.
- Do not connect to production Supabase unless explicitly allowed.
- Do not print secret values.
- Do not print full JWTs, API keys, database URLs, webhook secrets, or tokens.
- Do not assume deployed state matches migrations.
- Do not call public endpoints during a source-only audit.
- Do not say safe just because the public anon key is expected.
- Do not say unsafe only because the public anon key exists.

## Common Failures

- Saying "RLS exists" without mapping policies to frontend access.
- Treating the anon key as a secret leak.
- Ignoring Edge Functions.
- Ignoring `verify_jwt=false`.
- Ignoring service-role usage.
- Failing to inspect `supabase/config.toml`.
- Missing public insert policies.
- Missing `SECURITY DEFINER` RPCs.
- Missing storage policies.
- Not checking grants/revokes.
- Overstating source-only findings as deployed proof.
- Failing to update the run log.

## Output Format

```text
# Supabase RLS Audit Skill Run

## Selected Skill

## Why This Skill Was Selected

## Target Repo

## Commands Run

## Files Inspected

## Supabase Client Boundary

## Table and RLS Inventory

## Policy Quality Review

## Edge Function Service-Role Boundary

## Frontend Supabase Usage Map

## Storage Policy Review

## SQL Functions/RPC Review

## Grants/Revoke Review

## Risks Found

## Public Anon Key Safety Judgement

## What Is Still Unverified

## Recommended Next Skill

## Did The Skill Work?

## Skill Improvement Notes

## Run Log Update

## Upgrade Ideas
```

## Upgrade Ideas

- Active policy parser.
- Table/RLS inventory generator.
- Frontend Supabase usage mapper.
- Edge Function service-role/auth matrix generator.
- Storage policy extractor.
- Grant/RPC reviewer.
- Source-only judgement helper.
- Later CLI command: `supabase-rls-audit`.
