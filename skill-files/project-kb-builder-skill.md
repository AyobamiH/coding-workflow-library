---
name: project-kb-builder-skill
description: Create durable project memory without leaking secrets.
category: documentation
routing_triggers:
  - project memory
  - knowledge base
  - durable notes
  - daily memory
status: active
---
# Project KB Builder Skill

## Purpose

Create and maintain local project memory files without turning them into noisy logs or private dossiers.

## When to Use

Use when the user asks to write lasting notes, create daily memory, explain missing memory files, or standardize watchlist/runbook notes.

## Inputs Required

- Note content.
- Date.
- Target memory folder, usually `workspace/memory`.
- Whether the note is durable enough to store.

## Commands

Read/check templates:

```bash
ls memory
ls MEMORY.md
find . -maxdepth 4 -type f -iname 'watchlist*' -ls
```

Confirmed file operations were tool writes:

```text
write {"file_path":"memory/2026-02-12.md","content":"# 2026-02-12\n"}
write {"path":"/home/johnh/.openclaw/workspace/memory/2026-02-10.md","content":"# 2026-02-10\n- Agreed on visual identity: compass-themed emblem ...\n"}
```

## Procedure

1. Decide whether the note is durable, factual, and useful later.
2. Ensure `memory/YYYY-MM-DD.md` exists.
3. Append or write concise bullets.
4. Read back the file if verification is needed.
5. For missing long-term `MEMORY.md`, explain the difference between daily notes and distilled memory.

## Evidence Required

- Successful write result.
- File readback or directory listing.
- Date and path used.

## Safety Rules

- Do not store sensitive secrets.
- Do not over-collect personal details.
- Do not write speculative notes as facts.
- Do not create files outside the workspace without approval.

## Common Failures

- Missing `memory/`: create directory only if requested or clearly needed.
- Wrong date/timezone: use current local date.
- User asks to summarize missing file: search first, then ask for exact path.

## Output Format

For successful writes:

```text
Stored in memory/YYYY-MM-DD.md:
- ...
```

For no durable note:

```text
NO_REPLY
```

## Upgrade Ideas

Create `scripts/ensure_daily_memory.sh` that creates the daily file and appends sanitized bullets.
