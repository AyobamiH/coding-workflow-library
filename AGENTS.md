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

## Objective Authority

The system requests authority for consequences, not permission for every tool call.

Normal local execution is autonomous for the selected objective: read-only inspection, local file edits inside the chosen repo, docs, tests, validation, package dry-runs, clean-temp smoke, local branches, exact-file local commits, and secret-free local lane-state updates.

Ask again only when the next action crosses an ungranted authority boundary:

- `remote_publication`: git push, PR mutation, merge, tag push, GitHub Release, npm publish, public repository settings.
- `production_mutation`: deploys, Supabase migrations, SQL writes, scheduler/Vault mutation, app-data writes, Cloudflare production changes, production endpoint success invocation.
- `secret_mutation`: creating, rotating, replacing, or setting secrets in an external service.
- `destructive_action`: force push, history rewrite, deleting unmerged work, deleting production data, repository deletion, destructive migration, infrastructure teardown.

Child routes, skills, helpers, retries, and resumes inherit the selected lane objective authority. They must not ask for the same authority again. Missing tools, credentials, binaries, env vars, or network access are `BLOCKED_CAPABILITY`, not permission requests.

Normal workflow-authored PRs may be merged automatically when `remote_publication` is granted for the active objective and the PR is scoped, reviewed, checks have passed, the head SHA matches the reviewed head, branch protection allows a normal merge, and no independent-review or untrusted-change boundary is present. PR merge is not completion by itself; continue through post-merge exact-commit verification, local validation, remote alignment, ledger update, and run-record update before recording `COMPLETED`.

Preserve safety gates. Failed tests, failed validation, unsafe package contents, secret-scan findings, repository drift, and idempotency failures are `BLOCKED_SAFETY`. Human judgement belongs in `BLOCKED_DECISION`. Future external events such as running CI or scheduled jobs are `WAITING_CONDITION`.

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

- granting an unapproved authority class for the active objective;
- exact production, secret-mutation, or destructive-action approval when the active objective has not already granted it;
- product/business decision;
- security/privacy tradeoff;
- credentials or external account capability when local auth is missing, expired, invalid, or under-scoped;
- destructive actions;
- unclear priority or incompatible architecture choices.

Do not ask John for another approval merely because the next skill is ready, a local tool call is next, a PR exists, or a verified workflow-authored PR is ready for normal merge. Continue authorized local work, checkpoint external blockers, and present the exact boundary type plus exact input required when a real boundary remains.

## Output Discipline

- Give the next exact action.
- Do not ask vague "what next?" questions.
- Prefer `scripts/run-next --explain` when the next safe job should be selected without mutating any files, repos, or external services.
- For interrupted work, prefer `scripts/run-next --repo <repo> --status` and `scripts/run-next --repo <repo> --resume --dry-run` before asking John to reconstruct state manually.
- When John is needed, provide a decision brief with options and recommendation.
- Keep reports evidence-backed.
- Include commands run, files changed, validation results, risks, and next skill.

## Active Work State

Use project-scoped local lane state for active work. The public `work-ledger.md` is historical evidence and a legacy routing source, not a single global current state.

Real repo paths, monitoring baselines, private evidence, and product-specific runtime status belong in a local secret-free state file outside the tracked package. Select one lane explicitly and never advance another lane as a side effect.

Real `run-next` executions also write secret-free local checkpoint metadata under `.run-next/`. This directory is ignored by git and is used only to inspect or resume interrupted bounded runs.
