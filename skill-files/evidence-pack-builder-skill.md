---
name: evidence-pack-builder-skill
description: Build local redacted evidence packs from repo state, validation output, logs, and next-step handoff evidence.
category: documentation
routing_triggers:
  - evidence pack
  - handoff evidence
  - validation evidence
  - completion gate report
status: active
---

# evidence-pack-builder-skill

## Purpose

Build a local evidence pack that captures the proof needed for a handoff: repo state, diff summary, selected command output, validation results, PR or URL references supplied by John or prior logs, ledger state, run-log state, caveats, and the next safe step.

Permission level is `read-only-local` by default. Use `local-edit` only when John has approved writing evidence-pack files under an approved local evidence folder.

## When to Use

Use this skill when a task needs durable proof rather than a prose-only final answer.

Trigger examples:

- John asks for an evidence pack, release evidence, PR handoff evidence, deployment readiness evidence, runtime proof bundle, completion gate report, or audit trail.
- A workflow needs a local artifact summarizing command outputs, validation results, ledger state, and next permissions.
- A release, deploy, PR, or package handoff needs evidence without crossing into publish, deploy, commit, push, or external-service mutation gates.

## Inputs Required

- Target repo path.
- Evidence title.
- Skills library path when ledger or run-log evidence is needed.
- Permission level: `read-only-local` or `local-edit`.
- Selected command outputs to include, if already available.
- Validation results to include, if already available.
- PR, issue, deploy, package, or URL references supplied by John or prior logs.
- Known caveats, blockers, and next safe step.

## Commands

Read-only local inspection:

```bash
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" log --oneline -5
git -C "$TARGET_REPO" diff --stat
git -C "$TARGET_REPO" diff --check
```

Evidence-pack helper:

```bash
./scripts/evidence-pack --repo "$TARGET_REPO" --title "Short title" --dry-run
./scripts/evidence-pack --repo "$TARGET_REPO" --title "Short title"
```

Optional library evidence reads:

```bash
sed -n '1,220p' "$SKILLS_LIBRARY/work-ledger.md"
sed -n '1,220p' "$SKILLS_LIBRARY/runs/skill-runs.md"
```

The helper writes this minimum structure when not in dry-run mode:

```text
evidence/
  YYYYMMDD-HHMMSS-short-title/
    summary.md
    git-status.txt
    git-diff-stat.txt
    validation.txt
    next-step.md
```

## Procedure

1. Confirm the target repo path.
2. Confirm whether this is read-only evidence planning or local evidence-file creation.
3. If writing files, confirm the evidence folder is under the target repo's `evidence/` directory or another approved local path.
4. Capture git status, branch, recent log, diff stat, and diff-check output when the target is a Git repo.
5. If the target is not a Git repo, record that as evidence and still produce a summary when local-edit permission exists.
6. Add selected validation outputs provided by the current run or prior logs.
7. Add PR, URL, deploy, package, or release references only when they were supplied or already recorded in trusted local logs.
8. Add ledger and run-log state only from approved local files.
9. Redact obvious token, password, secret, credential, and database URL shapes before writing or reporting output.
10. Record commands not run and gates not crossed.
11. End with a clear next safe step and permission needed.

## Evidence Required

- Target repo path.
- Evidence title.
- Evidence output path or dry-run plan.
- Current Git branch or no-git warning.
- Git status.
- Git diff stat.
- Git diff-check result if available.
- Validation result or explicit not-run note.
- Ledger state when in scope.
- Run-log reference when in scope.
- PR, URL, release, or package references when supplied.
- Redaction statement.
- Commands not run.
- Next safe step.

## Safety Rules

- Do not read `.env` files.
- Do not capture `.npmrc`, credential files, database URLs, cookies, tokens, webhook secrets, or private key material.
- Do not print secret values, partial secret values, prefixes, suffixes, or lengths.
- Do not stage evidence files.
- Do not commit evidence files.
- Do not push, publish, deploy, run migrations, mutate databases, set secrets, or call production endpoints.
- Do not include `evidence/` in an exact-file commit unless John separately approves it.
- Do not claim production safety from a local evidence pack.

Forbidden commands by default:

```bash
git add
git commit
git push
npm publish
gh pr create
gh pr merge
supabase secrets set
supabase functions deploy
supabase db push
wrangler deploy
curl https://production.example
```

## Common Failures

- Creating an evidence folder and accidentally staging it.
- Capturing secret-bearing files or full command output from secret-printing tools.
- Treating local evidence as deployed proof.
- Omitting failed or skipped validation commands.
- Forgetting to state the next permission gate.
- Writing evidence outside the approved local folder.

## Output Format

```markdown
# Evidence Pack Report

## Target Repo

## Evidence Path

## Permission Level

## Commands Captured

## Git State

## Diff Summary

## Validation Evidence

## Ledger Evidence

## Run Log Evidence

## References

## Caveats

## Commands Not Run

## Redaction Result

## Next Safe Step
```

## Upgrade Ideas

- Add JSON output to `scripts/evidence-pack`.
- Add optional ingestion of supplied command-output files.
- Add a package/release evidence template.
- Add integration with release preflight reports.
- Add an allowlist for safe evidence paths.
