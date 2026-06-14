---
name: skill-cleaner-skill
description: Audits the local skill library for duplicates, bloat, stale skills, weak routing, and cleanup candidates.
category: skill-system
routing_triggers:
  - clean skills
  - audit skill library
  - remove duplicate skills
  - reduce skill bloat
  - improve skill routing
status: active
---
# skill-cleaner-skill

## Purpose

This skill keeps the local coding workflow skill library small, sharp, and routable.

It audits for duplicate skills, stale skills, overlong skills, weak frontmatter, unclear routing triggers, overlapping responsibilities, missing index references, missing validation evidence, and prompt-budget bloat.

The skill must not delete skills automatically. It produces cleanup recommendations and requires John approval before renaming, merging, deprecating, or deleting any skill.

## When to Use

Use this skill:

- before creating a new skill when overlap is possible;
- after adding several new skills;
- when `skills-index.md` feels noisy or hard to route from;
- when two or more skills seem to own the same workflow;
- when long skills may be hiding smaller reusable scripts;
- when the library needs a cleanup queue rather than more new files.

## Inputs Required

- `SKILLS_LIBRARY`, usually `/home/johnh/.openclaw/skills/coding-workflow-library`.
- Current `skill-files/*.md`.
- Current `skills-index.md`.
- Current `scripts/validate-skills`.
- Optional max line threshold, such as `--max-lines 250`.
- Optional routing trigger threshold, such as `--max-triggers 6`.

## Commands

Run from the library root:

```bash
./scripts/skill-cleaner
./scripts/skill-cleaner --json
./scripts/skill-cleaner --max-lines 250
./scripts/skill-cleaner --max-triggers 6
./scripts/validate-skills
```

## Procedure

1. Read `AGENTS.md` first.
2. Read `RUNBOOK.md`, `skills-index.md`, this skill, and `scripts/validate-skills`.
3. Confirm the work is advisory cleanup only.
4. Run `./scripts/skill-cleaner`.
5. Review Summary, Warnings, and Recommended Cleanup Queue.
6. Run `./scripts/skill-cleaner --json` if structured evidence is useful.
7. Classify every recommendation as one of:
   - keep;
   - sharpen;
   - merge candidate;
   - split candidate;
   - deprecate candidate;
   - script candidate.
8. Treat overlap as a review signal, not proof of a problem.
9. If edits are made to skills, index, templates, or docs, run `./scripts/validate-skills`.
10. Record cleaner findings in `runs/skill-runs.md` and update `work-ledger.md`.

## Evidence Required

- List of skills scanned.
- Cleaner command output or JSON summary.
- Count of active, draft, and deprecated skills.
- Duplicate names and trigger groups, if any.
- Missing active index references, if any.
- Longest skills and line-count threshold used.
- Keep, sharpen, merge, split, deprecate, and script candidate lists.
- `./scripts/validate-skills` result after any skill edits.
- Run log update.
- Work ledger update.

## Safety Rules

- Never delete or merge skills without explicit approval.
- Never rename or deprecate skills without explicit approval.
- Prefer improving routing and boundaries before creating new skills.
- Detect overlap between skills but do not assume overlap is bad.
- Do not edit `/home/johnh/wagging-web-wins` while cleaning this library.
- Do not print secrets.
- Do not add real secrets.
- Do not treat cleaner output as pass/fail validation.
- Always run `./scripts/validate-skills` after skill edits.
- Active skills must be referenced in `skills-index.md`.
- All skills must have frontmatter and required sections.
- Overlong skills are not automatically bad if they encode safety-critical procedures.
- Safety-critical skills may be long, but must have strong routing and output structure.

## Common Failures

- Treating advisory cleaner findings as permission to delete files.
- Creating a new skill instead of sharpening an existing one.
- Assuming overlap is bad when the skills have different permission boundaries.
- Measuring only line count and ignoring safety-critical procedure detail.
- Forgetting that `scripts/validate-skills` remains the pass/fail validator.
- Failing to update `skills-index.md` after adding an active skill.
- Failing to run the validator after skill edits.

## Output Format

```text
# Skill Cleaner Run

## Selected Skill

## Commands Run

## Summary

## Keep

## Sharpen

## Merge Candidates

## Split Candidates

## Deprecate Candidates

## Script Candidates

## Warnings

## Recommended Cleanup Queue

## Validator Result

## Run Log Update

## John Approval Needed
```

Bloat classification:

Low:

- small wording duplication;
- minor routing overlap;
- slightly long examples.

Medium:

- unclear routing triggers;
- repeated command blocks across several skills;
- similar skill purpose across multiple files;
- missing evidence/output discipline.

High:

- two active skills appear to own the same workflow;
- important safety rules only exist in one obscure skill;
- skill too vague for an LLM to execute;
- skill too long and unfocused for routing;
- index does not match active skill files.

## Upgrade Ideas

- Add historical usage counts from session logs.
- Add frontmatter quality scoring.
- Add a command-snippet extractor that proposes helper scripts.
- Add a Markdown report writer under a generated reports directory.
- Add safe autofix suggestions for descriptions and routing triggers.
- Add a prompt-budget estimator for active skill sets.
