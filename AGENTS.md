# AGENTS.md

## Purpose

This is the first file agents must read before working with the local coding workflow library at `/home/johnh/.openclaw/skills/coding-workflow-library`.

It defines hard rules. Use `RUNBOOK.md` for operating guidance after these rules are understood.

## Core Rules

- Read this file before any skill or runbook.
- Use `coding-workflow-orchestrator-skill` when deciding what work comes next.
- Select one skill before acting.
- Run one bounded step at a time.
- Separate facts from assumptions.
- Do not claim completion without evidence.
- Update `runs/skill-runs.md` after skill use.
- Update `work-ledger.md` when work status changes.
- Preserve user intent and current repo state.

## Permission Gates

Treat each gate as separate:

- read-only inspection;
- local edit;
- dependency install;
- lint/test/build;
- git commit;
- git push;
- pull request;
- production deploy;
- Supabase migration;
- database mutation;
- external API call;
- secret access;
- release/tag/version bump;
- destructive cleanup/delete/reset.

Permission for one gate does not imply permission for another.

If a needed gate is missing, stop at the last authorized boundary and give John a decision brief.

## Repo Safety

- Always inspect repo state before editing.
- Use exact paths.
- Do not run `git add .`.
- Do not reset, clean, stash, restore, or delete without explicit permission.
- Treat untracked files as evidence until classified.
- Preserve unrelated user changes.
- Prefer exact-file diffs and exact-file commits.

## Package Manager Safety

- Respect `packageManager` if present.
- If no `packageManager`, use lockfile evidence.
- Prefer `npm ci` over `npm install` when `package-lock.json` exists.
- Do not switch package managers silently.
- Do not delete lockfiles.
- Report lockfile drift.

## Secrets And Credentials

- Never print secrets.
- Never print full JWTs, API keys, private keys, database URLs, cookies, webhook secrets, or tokens.
- Report only file path, line number, key name, and risk category.
- New secrets must be stored outside source.
- `.env.example` may contain names/placeholders only.
- Public anon keys are not automatically leaks, but must depend on RLS and endpoint boundaries.
- Tokens are provisioned once locally; agents check local auth and only stop when credentials are missing, expired, invalid, or under-scoped.
- Do not ask John to paste tokens into chat.

## Source-Only vs Deployed Proof

- Source audit does not prove deployed state.
- Build success does not prove production safety.
- Deployment needs explicit approval.
- Production verification must collect runtime evidence.
- Supabase deployed RLS, secrets, function config, and scheduler state remain unverified until checked.

## Skill Routing

- deciding next work -> `coding-workflow-orchestrator-skill`
- repo orientation -> `repo-map-skill`
- env/secrets -> `env-audit-skill`
- Supabase RLS/public anon safety -> `supabase-rls-audit-skill`
- security finding or patch plan -> `security-hardening-review-skill`
- local lint/build/test proof -> `build-verify-skill`
- GitHub commit/push/PR handoff -> `github-handoff-skill`
- GitHub auth blocked or invalid -> `github-auth-gate-skill`
- Cloudflare/deploy/runtime proof -> `cloudflare-deploy-skill`
- route/runtime behaviour -> `route-trace-skill`
- migration review -> `migration-review-skill`
- skill extraction -> `session-log-extraction-skill`
- skill hygiene -> `skill-cleaner-skill`

## John Required

John is required for:

- product/business decision;
- security/privacy tradeoff;
- credentials or external account access;
- dependency install if not pre-authorized;
- source edits if not pre-authorized;
- commit/push/PR;
- deploy;
- migrations/database mutation;
- production endpoint calls;
- destructive actions;
- release/version/tag;
- unclear priority.

## Output Discipline

- Give the next exact action.
- Do not ask vague "what next?" questions.
- Prefer `scripts/run-next --explain` when the next safe job should be selected without mutating any files, repos, or external services.
- When John is needed, provide a decision brief with options and recommendation.
- Keep reports evidence-backed.
- Include commands run, files changed, validation results, risks, and next skill.

## Active Work State

Use project-scoped local lane state for active work. The public `work-ledger.md` is historical evidence and a legacy routing source, not a single global current state.

Real repo paths, monitoring baselines, private evidence, and product-specific runtime status belong in a local secret-free state file outside the tracked package. Select one lane explicitly and never advance another lane as a side effect.
