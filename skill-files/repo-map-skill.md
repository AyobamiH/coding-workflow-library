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

Map an unfamiliar workspace safely before editing, running tests, or answering code questions. The skill identifies files, contracts, session logs, git state, and missing source files with minimal risk.

## When to Use

Use at the start of a coding task, workflow extraction, missing-file investigation, or repo review.

## Inputs Required

- Workspace path.
- User target, such as a file name, feature, error, or workflow.
- Any known expected files, such as `RUNBOOK.md`, `MEMORY.md`, or `Watchlist_sources.md`.

## Commands

```bash
pwd
rg --files
find . -maxdepth 3 -type f
ls
ls -la
ls /home/johnh/.openclaw
cd /home/johnh/.openclaw/workspace && ls
git status --short
git status -sb
```

Missing-file templates:

```bash
ls MEMORY.md
find . -maxdepth 3 -iname 'runbook*' -ls
find . -maxdepth 4 -type f -iname 'watchlist*' -ls
grep -RIl "watchlist" -n . || true
```

## Procedure

1. Confirm current directory with `pwd`.
2. List tracked-looking source files with `rg --files`; fall back to `find`.
3. Check git state if the directory is a git repo.
4. Search for user-named files case-insensitively before saying they are missing.
5. Read only relevant project files, not broad credential directories.
6. Record gaps explicitly: missing file, wrong path, wrong case, no git repo.

## Evidence Required

- Current directory.
- File inventory or targeted search result.
- Git status or a clear "not a git repository" result.
- Successful read path or exact missing-file error.

## Safety Rules

- Do not print credential contents.
- Do not assume a file exists because the user named it.
- Do not edit during mapping.
- Do not use destructive git commands.

## Common Failures

- `rg` unavailable: use `find` and `grep`.
- Linux case mismatch: search with `-iname`.
- Search too broad: exclude credentials and binary assets when possible.
- No git repo: report it and continue with file-based mapping.

## Output Format

Report:

- Workspace root.
- Key files/folders found.
- Missing expected files.
- Git state.
- Next safe action.

## Upgrade Ideas

Create `scripts/map_repo.sh` that prints cwd, git root/status, top-level files, key config files, and missing expected files.
