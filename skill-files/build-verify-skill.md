---
name: build-verify-skill
description: Run local lint, build, test, and diff checks.
category: verification
routing_triggers:
  - verify build
  - run tests
  - lint check
  - completion evidence
status: active
---
# Build Verify Skill

## Purpose

Run lightweight verification gates and collect evidence before claiming a coding or workflow task is complete.

## When to Use

Use after edits, generated workflow files, config changes, or evidence-pack review.

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
sed -n '1,240p' evidence/opstruth-report.md
```

If project scripts are discovered in `package.json`, run only confirmed scripts from the repo. No package-manager scripts were confirmed in the extraction.

## Procedure

1. Check git status before summarizing work.
2. Run `git diff --check` to catch whitespace/conflict marker issues.
3. Review any evidence pack for pass/fail and safety boundaries.
4. Report tests or checks that were not available.
5. If commit is requested, verify git identity before committing.

## Evidence Required

- Git status output.
- `git diff --check` result.
- Evidence pack status if present.
- Explicit list of checks not run.

## Safety Rules

- Do not invent test/lint/build commands.
- Do not run deploys, database mutations, queue triggers, restarts, or publishing as verification unless explicitly requested and approved.
- Do not ignore unrelated dirty files.

## Common Failures

- Not a git repo: switch to file-based verification and say so.
- `git diff --check` fails: report exact file/line and fix if in scope.
- No package scripts: state that no project test scripts were found.
- Evidence pack stale: mention it only proves its recorded run.

## Output Format

Final verification block:

```text
Verification:
- git status: ...
- git diff --check: pass/fail
- tests/lint/build: not available / command result
- evidence pack: pass/fail/not present
```

## Upgrade Ideas

Create `scripts/verify_git.sh` that runs git status, diff check, and optional evidence report parsing.
