---
name: supabase-scheduler-vault-skill
description: Apply Supabase scheduler changes safely with pg_cron, pg_net, Vault-backed secrets, direct-host versus pooler DB URL gates, read-only capability discovery, one Vault secret boundary, one cron job mutation boundary, and no app-table writes. Use for Supabase scheduler, Vault, pg_cron, pg_net, scheduler secret storage, or cron header hardening.
category: migration
routing_triggers:
  - Supabase scheduler
  - Vault scheduler secret
  - pg_cron
  - pg_net
  - scheduler secret storage
status: active
---
# supabase-scheduler-vault-skill

## Purpose

Review, design, and apply a Supabase scheduler secret path using `pg_cron`, `pg_net`, and Supabase Vault without hardcoding secrets or writing application data.

This skill separates local migration drafting from deployed scheduler application. It also separates database writes to Vault/cron metadata from application-table writes. Runtime verification comes after scheduler application and needs its own gate.

This skill does not grant `supabase db push`. Applying a migration file, pushing schema, or running unrelated SQL requires separate approval.

## When to Use

Use when a scheduled Supabase job must call an Edge Function with a private header, webhook secret, scheduler secret, or provider secret.

Use when source migration drafts are not enough and the workflow must prove whether the deployed database supports Vault, `pg_cron`, and `pg_net`.

Use when a previous scheduler job has a public header, anon-only header, hardcoded secret, missing secret header, or unclear mutation boundary.

Use after runtime negative checks pass and before a scheduled job is allowed to trigger a success path.

## Inputs Required

- Target repo path.
- Approved Supabase project reference.
- Current ledger state and permission gate.
- Job name to inspect or replace.
- Edge Function URL or URL construction rule.
- Header name that must be supplied by scheduler.
- Vault secret name, never value.
- Local private runtime env path, if a secret must be loaded without printing.
- `SUPABASE_DB_URL` or `DATABASE_URL`, without printing it.
- Whether non-interactive SQL access is allowed.
- Whether Vault secret write is allowed.
- Whether cron job replacement is allowed.
- Existing scheduler source or migration draft.
- Known excluded local artifacts.

## Commands

Local repo and migration/source inspection:

```bash
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" log --oneline -12
rg -n "cron\\.schedule|cron\\.unschedule|pg_cron|net\\.http_post|http_post|vault|decrypted_secrets|x-[A-Za-z0-9-]+-secret|apikey|Authorization|Bearer|scheduler" "$TARGET_REPO/supabase/migrations" "$TARGET_REPO/docs" --glob '!node_modules'
```

Environment presence only:

```bash
test -n "$SUPABASE_PROJECT_REF" && echo "SUPABASE_PROJECT_REF is set" || echo "SUPABASE_PROJECT_REF is not set"
test -n "$SUPABASE_DB_URL" && echo "SUPABASE_DB_URL is set" || echo "SUPABASE_DB_URL is not set"
test -n "$DATABASE_URL" && echo "DATABASE_URL is set" || echo "DATABASE_URL is not set"
test -n "$SCHEDULER_SECRET_VALUE" && echo "scheduler secret value is set" || echo "scheduler secret value is not set"
```

SQL tooling check:

```bash
command -v psql || true
psql --version || true
```

Read-only capability discovery. Do not select decrypted secret values:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q -t -A <<'SQL'
select extname from pg_extension where extname in ('pg_cron', 'pg_net', 'supabase_vault', 'vault') order by extname;
select nspname from pg_namespace where nspname in ('cron', 'net', 'vault') order by nspname;
select n.nspname || '.' || p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('cron', 'net', 'vault')
  and p.proname in ('schedule', 'unschedule', 'alter_job', 'http_post', 'create_secret', 'update_secret')
order by 1;
select jobid, jobname, schedule, active
from cron.job
where jobname = '$JOB_NAME';
SQL
```

Post-application metadata check. Keep command text redacted or shape-only:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q -t -A <<'SQL'
select jobid, jobname, schedule, active
from cron.job
where jobname = '$JOB_NAME';
SQL
```

## Procedure

1. Read `AGENTS.md`, `tools.md`, `RUNBOOK.md`, this skill, `migration-review-skill`, and `runtime-verification-skill`.
2. Confirm the current ledger state and exact permission gate.
3. Capture target repo status, branch, staged files, and recent commits.
4. Stop if tracked or staged target repo changes are outside the approved scope.
5. Inspect scheduler source, docs, and migration drafts.
6. Identify job name, schedule, URL, headers, body, and whether any secret literal is hardcoded.
7. Confirm this is not a migration apply or `supabase db push` gate.
8. Load local env values only in process and report presence only.
9. Confirm a database URL exists without printing it.
10. Classify DB URL shape if needed: direct host can fail from IPv6-only paths; pooler or other approved reachable host may be required.
11. Verify `psql` exists before database inspection.
12. Run read-only capability discovery first.
13. Prove `cron` schema, `net.http_post`, `vault` schema, Vault create/update functions, Vault secret metadata, and current job schedule.
14. Do not select or print decrypted secret values during discovery.
15. Stop if Vault, `pg_cron`, `pg_net`, DB connectivity, or current job evidence is not proven.
16. If Vault secret write is approved, create a temporary SQL file outside the target repo with private permissions, execute it, delete it immediately, and confirm deletion.
17. Create or update only the approved Vault secret name.
18. If scheduler mutation is approved, unschedule or replace only the approved job name.
19. Build the cron command so the private header reads from `vault.decrypted_secrets` by secret name and never contains the literal secret value.
20. Preserve the existing schedule unless a schedule change is separately approved.
21. After applying, collect metadata and shape-only command checks: header present, Vault reference present, literal secret absent, long secret-looking literal absent.
22. Stop before runtime verification or success invocation.
23. Update ledger and run log with status, evidence, blockers, and next permission.

## Evidence Required

- Target repo path, branch, status, staged-file result, and recent commit evidence.
- Scheduler source or migration files inspected.
- Existing job name, schedule, URL, headers, and body shape when available.
- Env presence only, including database URL source without value.
- `psql` availability.
- DB connectivity result without URL or password.
- Read-only capability discovery for `cron`, `net`, and `vault`.
- Current job metadata before mutation.
- Safe-path decision.
- Vault secret create/update result without value.
- Temporary SQL/env file creation and deletion proof.
- Scheduler replacement result.
- Post-application metadata.
- Command shape checks proving header and Vault reference are present and literal secret is absent.
- Commands explicitly not run.
- Next ledger state and next permission.

## Safety Rules

- Do not print DB URLs, passwords, tokens, secrets, prefixes, suffixes, or lengths.
- Do not select `vault.decrypted_secrets.decrypted_secret` except inside the cron command being stored; never print its result.
- Do not hardcode scheduler secrets in migrations, docs, logs, source, or cron commands.
- Do not write secrets inside the target repo.
- Do not run `supabase db push` under this skill.
- Do not apply migration files under this skill unless a separate migration-apply gate is granted.
- Do not run unrelated SQL.
- Do not write application tables, including import/output tables.
- Do not invoke Edge Functions or trigger successful imports.
- Do not deploy functions, push, PR, merge, tag, publish, or mutate unrelated remote services.
- Do not replace a scheduler job unless the exact job name and schedule are proven or separately approved.

## Common Failures

- Direct database host fails because the environment cannot reach the required network path.
- Pooler URL is missing or malformed.
- `psql` is unavailable.
- Vault extension exists but required functions or views are missing.
- `cron.job` exists but current job name or schedule cannot be proven.
- SQL function signatures differ from assumptions.
- Temporary SQL file is created inside the target repo.
- Cron command accidentally contains a literal secret.
- Local migration draft is mistaken for deployed scheduler state.
- Scheduler application is reported as runtime verification.

## Output Format

```text
# Supabase Scheduler Vault Report

## Selected Skill
supabase-scheduler-vault-skill

## Target Repo

## Permission Gate

## Local Repo State

## Scheduler Source Evidence

## Env Presence

## SQL Tooling

## Read-Only Capability Discovery

## Safe Path Decision

## Vault Secret Result

## Scheduler Apply Result

## Post-Application Metadata

## Secret Exposure Check

## Commands Not Run

## Ledger Update

## Run Log Update

## Next Permission Needed
```

## Upgrade Ideas

- Add `scripts/supabase-scheduler-vault` to generate capability and apply reports from route metadata.
- Add a SQL command-shape redactor for cron command inspection.
- Add DB URL shape classifier fixtures for direct host, transaction pooler, and session pooler forms.
- Add a migration-draft checker that refuses executable secret literals.
- Add JSON output for scheduler route automation.
