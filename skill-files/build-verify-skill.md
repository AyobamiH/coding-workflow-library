---
name: build-verify-skill
description: Run local lint, build, test, diff, and pre-commit checks.
category: verification
routing_triggers:
  - verify build
  - run tests
  - lint check
  - completion evidence
  - pre-commit check
status: active
---
# Build Verify Skill

## Purpose

Run lightweight verification gates and collect evidence before claiming a coding or workflow task is complete. For this skills library, own the deterministic local pre-commit gate through `scripts/pre-commit-check`.

## When to Use

Use after edits, generated workflow files, config changes, evidence-pack review, or before a local commit in this library.

## Inputs Required

- Repo/workspace path.
- Files changed.
- Available project scripts, if any.
- Evidence pack path, if present.

## Commands

```bash
git status --short
git status -sb
git diff --check
./scripts/pre-commit-check
./scripts/pre-commit-check --staged
./scripts/pre-commit-check --full
sed -n '1,240p' evidence/opstruth-report.md
```

If project scripts are discovered in `package.json`, run only confirmed scripts from the repo. No package-manager scripts were confirmed in the extraction.

## Procedure

1. Check git status before summarizing work.
2. Run `git diff --check` to catch whitespace/conflict marker issues.
3. For this library, run `scripts/pre-commit-check`; use `--staged` before a local commit and `--full` when release-like confidence is needed.
4. Review any evidence pack for pass/fail and safety boundaries.
5. Report tests or checks that were not available.
6. If commit is requested, verify git identity before committing.

## Evidence Required

- Git status output.
- `git diff --check` result.
- `scripts/pre-commit-check` mode and result when used.
- Evidence pack status if present.
- Explicit list of checks not run.

## Safety Rules

- Do not invent test/lint/build commands.
- Do not treat pre-commit success as push, release, deploy, or production proof.
- Do not run deploys, database mutations, queue triggers, restarts, or publishing as verification unless explicitly requested and approved.
- Do not ignore unrelated dirty files.

## Common Failures

- Not a git repo: switch to file-based verification and say so.
- `git diff --check` fails: report exact file/line and fix if in scope.
- `scripts/pre-commit-check` fails: report the failing check id and the redacted file/risk category if the staged secret scan fired.
- No package scripts: state that no project test scripts were found.
- Evidence pack stale: mention it only proves its recorded run.

## Output Format

Final verification block:

```text
Verification:
- git status: ...
- git diff --check: pass/fail
- pre-commit check: pass/fail/not run
- tests/lint/build: not available / command result
- evidence pack: pass/fail/not present
```

## Upgrade Ideas

Keep `scripts/pre-commit-check` aligned with the library's validation helpers as new foundation scripts are added.
