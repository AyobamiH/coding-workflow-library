---
name: production-handoff-skill
description: Prepare production handoff after deployment and scheduler setup with read-only scheduled monitoring, cron metadata, run history, safe app metadata, observed versus pending status, failure routing, and no function invocation by default.
category: verification
routing_triggers:
  - production handoff
  - scheduled monitoring
  - scheduled run recheck
  - production readiness handoff
  - run history review
status: active
---
# production-handoff-skill

## Purpose

Prepare the final production handoff after deployment, remote secret setup, scheduler setup, and controlled verification work have reached a safe monitoring boundary.

This skill is not deployment. It is a read-only production evidence and handoff workflow by default. It must distinguish:

- pending automatic scheduled run;
- observed scheduled success;
- observed scheduled failure;
- incomplete evidence.

It routes failures to `error-evidence-skill` or `security-hardening-review-skill` instead of retrying live operations.

## When to Use

Use after a function, worker, cron job, webhook, or scheduled task has been deployed and the next step is production handoff, scheduled-run recheck, or read-only monitoring.

Use after a controlled success invocation when the user wants to wait for the scheduler and verify run history.

Use when the system must produce a final owner-facing summary of what is proven, what is pending, what remains gated, and what should be monitored next.

## Inputs Required

- Target repo path.
- Service or job name.
- Runtime or scheduler context.
- Current ledger state.
- Current permission gate.
- Approved read-only data sources.
- Database URL or cloud-log access only if explicitly allowed, without printing values.
- Baseline time for deciding whether an observed run is after the relevant deployment or scheduler change.
- Safe metadata fields allowed for app tables or downstream effects.
- Known source and docs files for handoff evidence.
- Failure-routing skill to use if monitoring reveals a blocker.

## Commands

Local source handoff evidence:

```bash
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" log --oneline -12
rg -n "deploy|deployed|scheduler|cron|secret|runtime|negative|success|monitor|handoff|rateLimit|auth|admin" "$TARGET_REPO/docs" "$TARGET_REPO/supabase/functions" --glob '!node_modules' --glob '!dist' --glob '!build'
```

Environment presence only:

```bash
test -n "$SUPABASE_PROJECT_REF" && echo "SUPABASE_PROJECT_REF is set" || echo "SUPABASE_PROJECT_REF is not set"
test -n "$SUPABASE_DB_URL" && echo "SUPABASE_DB_URL is set" || echo "SUPABASE_DB_URL is not set"
```

Read-only scheduler metadata, only when database-read permission is granted:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q -t -A <<'SQL'
select jobid, jobname, schedule, active
from cron.job
where jobname = '$JOB_NAME';
SQL
```

Read-only run history, only when safe and available:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q -t -A <<'SQL'
select r.jobid, j.jobname, r.status, r.start_time, r.end_time
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname = '$JOB_NAME'
order by r.start_time desc
limit 5;
SQL
```

Safe app metadata checks must select only approved non-sensitive fields:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q -t -A <<'SQL'
select count(*) from public.some_table;
SQL
```

## Procedure

1. Read `AGENTS.md`, `tools.md`, `RUNBOOK.md`, this skill, `runtime-verification-skill`, and any product-specific skill selected by route metadata.
2. Confirm the workflow has reached a handoff or monitoring ledger state.
3. Confirm this is read-only monitoring by default.
4. Capture target repo branch, status, staged files, and recent commits.
5. Stop if target repo changes create ambiguity for handoff evidence.
6. Identify the exact service, function, job, or scheduler to monitor.
7. Confirm baseline time or baseline commit used to decide whether a run is fresh.
8. Check env variable presence only when credentials are required for read-only metadata.
9. Verify local tooling such as `psql` only when database-read monitoring is approved.
10. Inspect source and docs for deployed boundary, scheduler setup, secret setup, rejection checks, and success-path caveats.
11. Collect scheduler/job metadata without printing command text that might contain secrets.
12. Collect run history if available.
13. Collect safe app metadata only from approved non-sensitive fields.
14. Do not manually invoke functions, webhooks, jobs, or production endpoints unless a separate invocation gate is approved.
15. Decide status:
    - pending automatic run;
    - observed success after baseline;
    - observed failure after baseline;
    - incomplete evidence.
16. If observed failure or ambiguous state appears, route to `error-evidence-skill` or `security-hardening-review-skill`.
17. Produce a handoff summary with proven evidence, remaining risks, commands not run, and next permission.
18. Update ledger and run log.

## Evidence Required

- Target repo state and commit context.
- Service/job/function identifier.
- Baseline time or baseline commit.
- Source/docs handoff evidence.
- Env presence only, if used.
- Tooling availability, if used.
- Scheduler metadata or explicit not-available result.
- Run history or explicit not-available result.
- Safe app metadata or explicit not-run result.
- Observed versus pending decision.
- Failure routing if needed.
- Commands not run.
- Secret exposure check over captured evidence.
- Ledger update and run log update.

## Safety Rules

- Do not deploy.
- Do not set secrets.
- Do not run migrations.
- Do not run SQL writes.
- Do not mutate schedulers.
- Do not invoke functions, webhooks, jobs, or production endpoints unless separately approved.
- Do not write app tables or downstream provider resources.
- Do not print secrets, database URLs, token values, bearer headers, prefixes, suffixes, or lengths.
- Do not read or report sensitive app-table fields.
- Do not convert pending scheduled monitoring into production pass without a fresh observed success or a clearly accepted pending status.
- Do not hide incomplete evidence behind a green summary.

## Common Failures

- Calling a production function again during handoff.
- Treating deploy output as scheduled-run proof.
- Treating scheduler metadata as proof that the scheduled job executed.
- Reading sensitive app rows instead of safe metadata.
- Reporting pending scheduled run as observed success.
- Ignoring a failed latest run because an older run succeeded.
- Missing the baseline time and comparing against stale runs.
- Forgetting to route failures to a focused investigation skill.

## Output Format

```text
# Production Handoff Report

## Selected Skill
production-handoff-skill

## Target Repo

## Permission Gate

## Service Or Job

## Baseline

## Source And Docs Evidence

## Read-Only Monitoring Evidence

## App Metadata Evidence

## Production Status
pending automatic run | observed success | observed failure | incomplete evidence

## Failure Routing

## Commands Not Run

## Secret Exposure Check

## Ledger Update

## Run Log Update

## Next Permission Needed
```

## Upgrade Ideas

- Add `scripts/production-handoff` to normalize monitoring reports from route metadata.
- Add scheduled-run baseline storage in the work ledger.
- Add adapters for Supabase cron history, GitHub Actions schedules, Cloudflare Workers Cron Triggers, and queue consumers.
- Add safe app-metadata allowlists by project.
- Add JSON output for dashboards and evidence packs.
