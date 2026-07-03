---
name: repo-map-skill
description: Map repo files, git state, and contracts before edits.
category: repo-inspection
routing_triggers:
  - repo map
  - inspect repo
  - unfamiliar codebase
  - find files
status: active
---
# Repo Map Skill

## Purpose

Map an unfamiliar workspace safely before editing, running tests, or answering code questions. The skill now delegates first to `scripts/repo-map`, which produces a deterministic, privacy-safe, source-only repository map.

## When to Use

Use at the start of a coding task, workflow extraction, missing-file investigation, or repo review.

## Inputs Required

- Workspace path.
- User target, such as a file name, feature, error, or workflow.
- Any known expected files, such as `RUNBOOK.md`, `MEMORY.md`, or `Watchlist_sources.md`.

## Commands

```bash
./scripts/repo-map --repo /path/to/repo
./scripts/repo-map --repo /path/to/repo --json
./scripts/repo-map --repo /path/to/repo --validate

coding-workflow repo-map --repo /path/to/repo --validate
```

Follow-up manual inspection, only after reading the map:

```bash
git status --short
rg --files
find . -maxdepth 3 -type f
find . -maxdepth 3 -iname 'runbook*' -ls
```

## Procedure

1. Run `scripts/repo-map --repo <path>` before editing or selecting deeper skills.
2. Read the human report or JSON output.
3. Confirm whether the target is a Git repo or a non-Git directory.
4. Use the top-level files, package/config markers, source directories, docs summary, and command candidates to choose the next safe skill.
5. Search for user-named files case-insensitively before saying they are missing.
6. Read only relevant project files, not broad credential directories.
7. Record gaps explicitly: missing file, wrong path, wrong case, no git repo, or insufficient source evidence.

## Evidence Required

- `scripts/repo-map` command and exit status.
- Git status classification or `not_a_git_repo`.
- Top-level file and directory summary.
- Detected language/config/package markers.
- Docs summary when available.
- Env-file presence only, never values.
- Successful read path or exact missing-file error if targeted follow-up search is needed.

## Safety Rules

- Do not print credential contents.
- Do not read `.env` contents for repo orientation.
- Do not assume a file exists because the user named it.
- Do not edit during mapping.
- Do not use destructive git commands.
- Do not treat framework detection as runtime proof.
- Do not install dependencies, run builds/tests, call external services, deploy, publish, push, tag, or mutate target repos from this skill.

## Common Failures

- `rg` unavailable: use `find` and `grep`.
- Linux case mismatch: search with `-iname`.
- Search too broad: exclude credentials and binary assets when possible.
- No git repo: report it and continue with file-based mapping.

## Output Format

Report:

- Repo-map status and whether validation passed.
- Git state.
- Key files/folders found.
- Detected package/config/language/docs markers.
- Env-file presence without values.
- Missing expected files or exact source gaps.
- Next safe skill/action.

## Upgrade Ideas

Use repo-map evidence as the input for the future project-KB compiler and migration-review helper. Do not expand it into a full static-analysis platform without new evidence.
