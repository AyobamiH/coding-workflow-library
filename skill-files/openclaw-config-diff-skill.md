---
name: openclaw-config-diff-skill
description: Compare OpenClaw config backups and rollback evidence.
category: debugging
routing_triggers:
  - config diff
  - OpenClaw backup
  - gateway config
  - rollback candidate
status: active
---
# OpenClaw Config Diff Skill

## Purpose

Compare OpenClaw config backups to identify functional changes, formatting-only changes, and safe rollback candidates.

## When to Use

Use when OpenClaw behavior changes after hardening, upgrades, config edits, or agent permission changes.

## Inputs Required

- OpenClaw root path.
- Current `openclaw.json`.
- Backup files such as `openclaw.json.bak`, `.bak.1`, `.bak.2`, `.bak.3`, `.bak.4`.
- User's target time or suspected change.

## Commands

```bash
cd /home/johnh/.openclaw && ls -l --full-time openclaw.json*
cd /home/johnh/.openclaw && diff -u openclaw.json.bak.4 openclaw.json
cd /home/johnh/.openclaw && diff -u openclaw.json.bak.3 openclaw.json.bak.2
cd /home/johnh/.openclaw && diff -u openclaw.json.bak.2 openclaw.json.bak.1
cd /home/johnh/.openclaw && diff -u openclaw.json.bak.1 openclaw.json
cd /home/johnh/.openclaw && diff -u openclaw.json.bak openclaw.json
cd /home/johnh/.openclaw && diff -u -w openclaw.json.bak openclaw.json
```

Suggested rollback commands, only after explicit approval:

```bash
cd /home/johnh/.openclaw
cp openclaw.json.bak.N openclaw.json
openclaw gateway restart
```

## Procedure

1. List config backup timestamps.
2. Diff adjacent backups to build a timeline.
3. Diff suspected hardening backup against current.
4. Rerun with `diff -u -w` to remove whitespace-only noise.
5. Separate metadata timestamps, formatting, and functional config changes.
6. If rollback is needed, ask the user to select the backup and approve overwrite.

## Evidence Required

- Backup timestamps.
- Unified diff fragments.
- Whitespace-insensitive diff where formatting noise exists.
- Functional change summary.
- Verification after rollback, if performed.

## Safety Rules

- Treat `diff` exit code 1 as "differences found", not command failure.
- Do not overwrite current config without explicit approval.
- Preserve a copy of current config before rollback.
- Do not widen permissions without naming the blast radius.

## Common Failures

- Huge diff: compare adjacent backups.
- Formatting noise: use `-w`.
- Wrong backup: use timestamps before restoring.
- Gateway not reloaded: verify after restart.

## Output Format

```text
Config diff summary:
- Compared:
- Functional changes:
- Formatting/metadata only:
- Risk:
- Rollback candidate:
- Verification:
```

## Upgrade Ideas

Create `scripts/diff_openclaw_backups.sh` that prints timestamp table, adjacent diffs, and whitespace-insensitive summary.
