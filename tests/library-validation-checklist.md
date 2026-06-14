# Library Validation Checklist

Use this checklist after creating, updating, or reorganizing the coding workflow skills library.

## Required Top-Level Files

- [ ] `README.md` exists
- [ ] `skills-index.md` exists
- [ ] `build-queue.md` exists
- [ ] `command-library.md` exists
- [ ] `tool-patterns.md` exists
- [ ] `evidence-checklist.md` exists
- [ ] `RUNBOOK.md` exists
- [ ] `work-ledger.md` exists
- [ ] `runs/skill-runs.md` exists

## Required Templates

- [ ] `templates/skill-run-template.md` exists
- [ ] `templates/new-skill-template.md` exists
- [ ] `templates/skill-upgrade-template.md` exists
- [ ] `templates/evidence-report-template.md` exists

## Required Skill Sections

- [ ] Every skill file has YAML frontmatter
- [ ] Every skill `name` matches its filename without `.md`
- [ ] Every skill has `description`, `category`, `routing_triggers`, and `status`
- [ ] Every skill file has `## Purpose`
- [ ] Every skill file has `## When to Use`
- [ ] Every skill file has `## Inputs Required`
- [ ] Every skill file has `## Commands`
- [ ] Every skill file has `## Procedure`
- [ ] Every skill file has `## Evidence Required`
- [ ] Every skill file has `## Safety Rules`
- [ ] Every skill file has `## Common Failures`
- [ ] Every skill file has `## Output Format`
- [ ] Every skill file has `## Upgrade Ideas`

## Content Quality

- [ ] No obvious placeholder text remains
- [ ] No obvious secret-looking values are present
- [ ] `build-queue.md` lists missing or weak skills
- [ ] `skills-index.md` links to every skill file
- [ ] `RUNBOOK.md` includes the Skill Selection Flow
- [ ] `RUNBOOK.md` requires run logging
- [ ] `RUNBOOK.md` requires evidence before completion

## Validation Commands

```bash
./scripts/validate-skills
find . -maxdepth 3 -type f | sort
grep -R "TODO|TBD|placeholder|lorem|changeme" . --exclude=library-validation-checklist.md || true
grep -R "sk-[A-Za-z0-9]|SUPABASE_SERVICE_ROLE|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH" . --exclude=library-validation-checklist.md || true
for f in skill-files/*.md; do
  for h in "Purpose" "When to Use" "Inputs Required" "Commands" "Procedure" "Evidence Required" "Safety Rules" "Common Failures" "Output Format" "Upgrade Ideas"; do
    grep -q "^## $h$" "$f" || echo "$f missing $h"
  done
done
```
