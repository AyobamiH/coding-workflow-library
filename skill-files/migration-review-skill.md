---
name: migration-review-skill
description: Review migrations for safety before apply commands.
category: migration
routing_triggers:
  - migration review
  - database migration
  - SQL migration
  - rollback risk
status: active
---
# Migration Review Skill

## Purpose

Review database or config migrations for safety, reversibility, and verification. The extraction contained no confirmed database migration commands, so the skill is read-only until repo commands are discovered.

## When to Use

Use when the user asks to review migrations, schema changes, SQL files, rollback plans, or migration risk.

## Inputs Required

- Target repo path.
- Migration files or migration directory.
- Database type, if known.
- Desired operation: review only, generate migration, or apply migration.

## Commands

Confirmed discovery commands:

```bash
rg --files
find . -maxdepth 3 -type f
git status --short
git diff --check
```

Migration discovery templates:

```bash
find . -maxdepth 5 -type f -iname '*migration*' -o -iname '*.sql'
rg -n "migration|migrate|schema|create table|alter table|drop table|create index|policy|rollback" . -S
```

No confirmed migration apply command was extracted. Do not invent one.

## Procedure

1. Locate migration files.
2. Read changed migrations and adjacent prior migrations.
3. Identify irreversible operations: drops, destructive alters, data rewrites.
4. Check indexes, constraints, defaults, RLS/policies, and backfill strategy.
5. Look for rollback/down migration if the framework supports it.
6. Verify formatting with `git diff --check`.
7. Produce review findings before suggesting apply commands.

## Evidence Required

- Files inspected.
- Risky statements with file/line references.
- Rollback or forward-fix plan.
- Verification/test command, only if discovered.

## Safety Rules

- Do not apply migrations without explicit approval.
- Do not use production database credentials casually.
- Do not invent framework commands.
- Do not hide destructive operations in a summary.

## Common Failures

- Migration framework unknown: inspect repo scripts/docs.
- SQL dialect unknown: ask or infer from config.
- No rollback: flag and propose recovery.
- Data backfill not idempotent: require guard clauses.

## Output Format

```text
Migration review:
- Files:
- Blocking findings:
- Warnings:
- Rollback/forward recovery:
- Verification:
```

## Upgrade Ideas

Add framework-specific references only after real repos provide confirmed commands.
