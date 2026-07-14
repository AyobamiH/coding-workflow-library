---
name: migration-review-skill
description: Source-only migration risk review before any apply/deploy command.
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

Review database or config migrations for safety, reversibility, and verification before any apply/deploy step. This skill is source-only by default: it classifies migration risk from files and must not execute SQL, call Supabase, connect to a database, deploy, or claim deployed-state truth.

## When to Use

Use when the user asks to review migrations, schema changes, SQL files, rollback plans, or migration risk.

## Inputs Required

- Target repo path.
- Migration files or migration directory.
- Database type, if known.
- Desired operation: review only unless a separate objective explicitly grants a later mutation boundary.

## Commands

Confirmed discovery commands:

```bash
./scripts/repo-map --repo "$TARGET_REPO"
./scripts/project-kb --repo "$TARGET_REPO" --validate
./scripts/migration-review --repo "$TARGET_REPO"
./scripts/migration-review --repo "$TARGET_REPO" --json
./scripts/migration-review --repo "$TARGET_REPO" --validate
./scripts/migration-review --repo "$TARGET_REPO" --migrations-dir supabase/migrations
./scripts/migration-review --repo "$TARGET_REPO" --fail-on-high-risk
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

No confirmed migration apply command is granted by this skill. Do not invent one.

## Procedure

1. Run `repo-map` first for source orientation in unfamiliar repos.
2. Run `project-kb` when durable source-only context exists or handoff evidence is needed.
3. Run `scripts/migration-review --repo "$TARGET_REPO"` and optionally `--json` for machine-readable evidence.
4. Use `--migrations-dir <relative-path>` for a known migration directory.
5. Use `--fail-on-high-risk` only as a local gate when high-risk findings should fail the command.
6. Review classifications for destructive operations, RLS/policy changes, grants/revokes, functions, triggers, extensions, scheduler/Vault references, data mutations, rollback gaps, ordering warnings, and secret-shaped material.
7. Treat source-only findings as pre-apply review evidence, not deployed-state proof.
8. Stop before any migration apply, SQL execution, Supabase command, deploy, or production mutation unless a separate objective grants that authority.

## Evidence Required

- Files inspected.
- Migration-review status and file counts.
- Risky statement categories with file/line references.
- Rollback or forward-fix plan.
- Secret-shaped detection result by file/category only, without values.
- Source-only limitation statement.
- Verification/test command result.

## Safety Rules

- Do not apply migrations without explicit approval.
- Do not use production database credentials casually.
- Do not invent framework commands.
- Do not hide destructive operations in a summary.
- Do not run SQL, Supabase CLI, deploy, mutate databases, or call production endpoints under this skill.
- Do not print secret values, DB URLs, service-role keys, tokens, cookies, private keys, prefixes, suffixes, lengths, or shapes.
- High-risk findings block apply/deploy decisions until a separately approved authority gate and human review.

## Common Failures

- Migration framework unknown: inspect repo scripts/docs.
- SQL dialect unknown: ask or infer from config.
- No rollback: flag and propose recovery.
- Data backfill not idempotent: require guard clauses.
- `NO_MIGRATIONS_FOUND`: report as safe discovery outcome, not proof that the repo has no deployed database.
- `UNKNOWN`: classify as requiring manual review before apply.
- High risk: stop before apply/deploy and use `--fail-on-high-risk` in local gates when appropriate.

## Output Format

```text
Migration review:
- Files:
- Blocking findings:
- Warnings:
- Rollback/forward recovery:
- Verification:
- Source-only limits:
```

## Upgrade Ideas

Add framework-specific references only after real repos provide confirmed commands. Keep apply commands outside this skill unless a separate production-mutation gate is explicitly approved.
