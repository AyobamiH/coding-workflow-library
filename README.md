# Coding Workflow Skills Library

This library converts the workflow extraction in `/home/johnh/.openclaw/workflow-extraction.md` into local, operational Markdown skill files.

Use this library when another LLM needs reusable instructions for repo mapping, session-log extraction, OpenClaw route tracing, environment audits, security hardening review, verification, and error triage.

`AGENTS.md` is the first file an agent must read. It contains the hard rules for permissions, repo safety, secrets, evidence, source-only proof, and skill routing.

`RUNBOOK.md` is operational guidance after the hard rules are understood. `coding-workflow-orchestrator-skill` decides the next safe work item when the path is not obvious.

## Layout

```text
skills/coding-workflow-library/
  AGENTS.md
  README.md
  RUNBOOK.md
  skills-index.md
  build-queue.md
  command-library.md
  tools.md
  tool-patterns.md
  evidence-checklist.md
  work-ledger.md
  runs/
    skill-runs.md
  scripts/
    committer
    run-next
    skill-cleaner
    validate-skills
  templates/
    repo-agents-pointer-template.md
    skill-run-template.md
    new-skill-template.md
    skill-upgrade-template.md
    evidence-report-template.md
  tests/
    library-validation-checklist.md
  skill-files/
    coding-workflow-orchestrator-skill.md
    session-log-extraction-skill.md
    repo-map-skill.md
    route-trace-skill.md
    env-audit-skill.md
    build-verify-skill.md
    error-evidence-skill.md
    openclaw-config-diff-skill.md
    security-hardening-review-skill.md
    llm-drift-control-skill.md
    github-auth-gate-skill.md
    github-handoff-skill.md
    project-kb-builder-skill.md
    public-market-scan-skill.md
    cloudflare-deploy-skill.md
    supabase-rls-audit-skill.md
    migration-review-skill.md
    tool-patterns-skill.md
    skill-cleaner-skill.md
```

## Frontmatter Routing

Every file in `skill-files/*.md` starts with YAML frontmatter:

```yaml
---
name: skill-name
description: short operational description
category: skill-system
routing_triggers:
  - trigger phrase
  - trigger phrase
status: active
---
```

The frontmatter is the routing contract. `name` must match the filename without `.md`; `description` should be short and concrete; `routing_triggers` should contain two to six phrases; `status` must be `active`, `draft`, or `deprecated`.

## How To Use

1. Read `AGENTS.md` first.
2. Read `RUNBOOK.md` for operational guidance.
3. Prefer `scripts/run-next` for the autonomous work loop when the next action should come from `work-ledger.md`.
4. Use `coding-workflow-orchestrator-skill` manually when `scripts/run-next` cannot cover the current state.
5. Pick the relevant downstream skill from frontmatter routing and `skills-index.md`.
6. Open the matching file under `skill-files/`.
7. State why the skill was selected before acting.
8. Follow its commands, procedure, evidence requirements, and safety rules.
9. Use `command-library.md` only as a command source; do not treat every command as safe for every task.
10. Use `evidence-checklist.md` before final response.
11. Record orchestration state in `work-ledger.md` and the completed skill run in `runs/skill-runs.md`.

## Validation

Run the validator before handoff after any skill or library routing edit:

```bash
cd /home/johnh/.openclaw/skills/coding-workflow-library
./scripts/validate-skills
```

The validator checks required files, skill frontmatter, required skill sections, active skill index coverage, duplicate names, placeholder markers, and secret-shaped markers with noisy self-hits filtered.

## Tool Catalogue

`tools.md` is the local tool catalogue. It defines tool permission levels, safe and unsafe examples, approval requirements, and evidence expectations.

The orchestrator and skills should consult `tools.md` before tool-heavy work, especially when commands may install dependencies, edit files, mutate git, call GitHub, access secrets, deploy, touch databases, call production endpoints, or change cloud resources.

## Skill Hygiene

`skill-cleaner-skill` keeps the library small and routable.

`./scripts/validate-skills` is pass/fail validation. `./scripts/skill-cleaner` is advisory cleanup intelligence for duplicates, bloat, stale skills, weak routing, and overlap.

```bash
cd /home/johnh/.openclaw/skills/coding-workflow-library
./scripts/skill-cleaner
./scripts/validate-skills
```

## Exact-File Committer

`scripts/committer` is a local Git handoff helper for approved commit preparation. It refuses broad staging, requires exact file paths, checks repo state and diff evidence, scans staged diffs for secret-shaped markers, and never pushes or creates PRs.

Use it after `github-handoff-skill` is selected and local commit preparation is approved. Dry-run mode is safe for read-only evidence:

```bash
cd /home/johnh/.openclaw/skills/coding-workflow-library
./scripts/committer --repo /path/to/repo --message "Describe the exact scoped change" --files path/to/file --dry-run
```

Commit permission is separate from push, PR, deploy, migration, and release permission.

## GitHub Auth Gate

`github-auth-gate-skill` checks whether `gh` is installed, whether local GitHub CLI authentication is valid, which account is active, whether that account matches the target repo owner, and whether safe local account switching is possible.

It supports `GH_TOKEN` and `GITHUB_TOKEN` only as runtime environment auth. It must never print, save, or commit token values. After the auth gate returns `PASS`, route back to `github-handoff-skill` for any separately approved push or PR work.

## Autonomous Work Loop

`scripts/run-next` is the executable implementation of the orchestrator loop. It reads `AGENTS.md`, `tools.md`, and `work-ledger.md`; selects the latest ledger item for the requested repo; checks the required permission gate from `--allow`; runs only covered safe actions; updates the ledger/run log after real execution; and stops at real John-required boundaries.

Use `--explain` when John needs the selected job, required permission, stop reason, and next approval command without mutating any files. `--dry-run` is also non-mutating; it does not update `work-ledger.md`, `runs/skill-runs.md`, target repos, or external services.

Current automation supports the `Auth pass for GitHub handoff` path for `/home/johnh/wagging-web-wins`: it isolates `GH_TOKEN`, verifies `AyobamiH/wagging-web-wins` access, checks local repo safety, creates/switches the feature branch, pushes that branch only, and creates or confirms the PR.

It also supports `PR opened, not merged` as a read-only PR readiness inspection path. With `--allow pr-readiness` or `--allow github-handoff`, the runner inspects PR metadata, changed files, commits, checks, mergeability, review decision, and local repo state, then records one of: `PR ready for merge approval`, `PR blocked by checks`, `PR blocked by unexpected files`, `PR blocked by mergeability`, or `PR readiness unknown`. It never merges.

When the ledger status is `PR ready for merge approval`, `scripts/run-next --allow pr-merge` can perform the separate merge gate for PR #11 only. It rechecks GitHub auth, repo access, exact PR file scope, PR state, mergeability, PR checks, and repo-local GitHub workflow deployment evidence before running `gh pr merge --merge`. It does not delete the feature branch, deploy, run migrations, mutate Supabase, or call production endpoints. After a successful merge it records `Merged, not deployed` and stops.

When the ledger status is `Merged, not deployed`, `scripts/run-next --allow deployment-plan` can inspect local/source evidence and produce a Supabase deployment plan. It reads repo state, Supabase config, the `import-reddit-tips` Edge Function, relevant docs/migrations, package scripts, and local CLI availability. It does not set secrets, deploy functions, run migrations, mutate Supabase, update schedulers, call production endpoints, push, create PRs, or merge anything. After a successful planning run it records `Deployment plan ready, not deployed`.

When the ledger status is `Deployment plan ready, not deployed`, `scripts/run-next --allow supabase-preflight` can inspect local/source execution prerequisites and draft the exact Supabase execution sequence. This is preflight only: it does not install the Supabase CLI, run `npx supabase`, log in, link, set secrets, deploy, run migrations, execute SQL, update schedulers, call runtime endpoints, push, create PRs, or merge. After a successful preflight it records `Supabase execution preflight ready, not executed`.

When the ledger status is `Supabase execution preflight ready, not executed`, `scripts/run-next --allow supabase-tooling-auth` can verify Node/npm/npx availability, run `npx supabase --version`, inspect local `/home/johnh/.openclaw/.env` variable names/presence without printing values, and use `SUPABASE_ACCESS_TOKEN` only as runtime auth for read-only Supabase project listing. This is not permission to run `supabase login`, `supabase link`, set secrets, deploy, run migrations, execute SQL, mutate schedulers, invoke functions, call production endpoints, push, create PRs, or merge. After auth passes it records `Supabase tooling/auth ready, not linked`.

When the ledger status is `Supabase tooling/auth ready, not linked`, `scripts/run-next --allow supabase-link-secret-readiness` can link the local repo to the approved Supabase project and ensure `IMPORT_REDDIT_TIPS_SECRET` exists only in `/home/johnh/.openclaw/.env`. If the secret is missing, the runner may generate a strong local value and store it there without printing it. This is not permission to set remote Supabase secrets, deploy functions, run migrations, execute SQL, mutate schedulers, invoke functions, call production endpoints, push, create PRs, or merge. After link and local secret readiness pass it records `Supabase linked and local secret ready, not deployed`.

When the ledger status is `Supabase linked and local secret ready, not deployed`, `scripts/run-next --allow scheduler-draft-pr` can run the combined local handoff gate: draft a guarded local scheduler migration, update scheduler docs, run local checks, create an exact-file commit, push the feature branch, and open or confirm a PR. This is not permission to set remote Supabase secrets, deploy functions, run or apply migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push `main`, force-push, or merge a PR. After success it records `Scheduler migration PR opened, not merged`.

Official vendor skills may be reviewed only as advisory input under `vendor-intake/`. The Supabase official agent skills intake found useful checks for Data API exposure versus RLS, public-schema RLS, `auth.role()` policy drift, `SECURITY DEFINER` exposure, CLI help discovery, and migration-file creation with Supabase CLI tooling when a migration-draft gate is explicitly approved. Vendor guidance does not override `AGENTS.md`, `tools.md`, permission gates, or `scripts/run-next` ledger routing.

```bash
cd /home/johnh/.openclaw/skills/coding-workflow-library
./scripts/run-next --repo /home/johnh/wagging-web-wins --explain
./scripts/run-next --dry-run --repo /home/johnh/wagging-web-wins --allow github-handoff
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow github-handoff
./scripts/run-next --dry-run --repo /home/johnh/wagging-web-wins --allow pr-readiness
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow pr-readiness
./scripts/run-next --dry-run --repo /home/johnh/wagging-web-wins --allow pr-merge
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow pr-merge
./scripts/run-next --dry-run --repo /home/johnh/wagging-web-wins --allow deployment-plan
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow deployment-plan
./scripts/run-next --dry-run --repo /home/johnh/wagging-web-wins --allow supabase-preflight
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow supabase-preflight
./scripts/run-next --dry-run --repo /home/johnh/wagging-web-wins --allow supabase-tooling-auth
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow supabase-tooling-auth
./scripts/run-next --dry-run --repo /home/johnh/wagging-web-wins --allow supabase-link-secret-readiness
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow supabase-link-secret-readiness
./scripts/run-next --dry-run --repo /home/johnh/wagging-web-wins --allow scheduler-draft-pr
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow scheduler-draft-pr
```

Manual prompts are now fallback control, not the default handoff mechanism.

## Important Boundaries

- Cloudflare, Supabase, migration, and GitHub CLI workflows were not confirmed in the extracted chat logs. Their skill files are inspection-first and forbid invented deployment/database/PR commands.
- Supabase execution preflight is not deployment. Supabase CLI install/auth/link, secret writes, function deploys, migrations, scheduler mutations, SQL execution, and runtime endpoint calls remain separate permission gates.
- Supabase tooling/auth setup is not link, secrets, deploy, scheduler mutation, or runtime verification. `SUPABASE_ACCESS_TOKEN` is runtime/local env only and agents must never print token values. `npx supabase --version` is allowed only under the tooling/auth gate; `npx supabase` mutation commands require separate permission.
- Supabase link/local secret readiness is not remote secret setup. Generated local secrets may only be stored in `/home/johnh/.openclaw/.env`, and agents must never print secret values or partial values.
- Vendor skill intake is not active-skill installation for a target repo. Keep vendor files isolated under `vendor-intake/`, read them as advisory evidence, and adapt only the local library rules that improve safety.
- `AGENTS.md` permission gates override any convenience implied by a skill file.
- Read-only mapping and evidence gathering should happen before edits.
- Permission gates are separate: local edits, installs, builds, commits, pushes, PRs, deploys, migrations, database mutations, external API calls, releases, and merges each need their own authorization.
- Do not print secrets, `.env` contents, bearer tokens, or credential file contents.
- Do not overwrite configs, run deploys, apply migrations, or broaden OpenClaw permissions without explicit approval.
- Do not say a task is complete without evidence.
- If no skill fits, create a skill gap note instead of improvising silently.

## Source

Built from:

- `/home/johnh/.openclaw/workflow-extraction.md`
- Local OpenClaw session logs under `agents/main/sessions` and `agents/researcher/sessions`
- `evidence/opstruth-report.md`
