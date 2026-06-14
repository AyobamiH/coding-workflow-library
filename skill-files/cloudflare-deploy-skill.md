---
name: cloudflare-deploy-skill
description: Inspect Cloudflare deploy commands and runtime proof safely.
category: deployment
routing_triggers:
  - Cloudflare deploy
  - Wrangler deploy
  - runtime proof
  - deployment audit
status: active
---
# Cloudflare Deploy Skill

## Purpose

Prepare for Cloudflare deployment only after discovering confirmed project-specific commands. The extraction contained no confirmed Cloudflare deploy command, so this skill is inspection-first.

## When to Use

Use when the user asks to deploy, verify, or debug a Cloudflare project and the target repo may contain Wrangler or Cloudflare config.

## Inputs Required

- Target repo path.
- Deployment target: Pages, Workers, or unknown.
- Existing project scripts/config.
- Explicit user approval before deployment.

## Commands

Confirmed extraction commands for discovery:

```bash
rg -n "Supabase|supabase|Cloudflare|cloudflare|wrangler|npm publish|npm run|git diff|git status|gh |curl |API|migration|RLS|rls|deploy|build|typecheck|lint|test" . --glob '!credentials/**' --glob '!memory/**' --glob '!workspace/avatars/*.png' --glob '!**/*.png' -S
rg --files
git status --short
```

No confirmed deploy command was extracted. Do not assume `wrangler deploy`; discover it from repo docs/scripts first.

## Procedure

1. Map repo files.
2. Search for `wrangler`, `cloudflare`, `pages`, `workers`, and deploy scripts.
3. Read config/docs before proposing a command.
4. Run build/typecheck/lint only if confirmed by repo scripts.
5. Present exact deploy command discovered from the repo.
6. Ask approval before running any deploy.
7. Verify deployment with command output, URL, status, or headers.

## Evidence Required

- Config file or package script proving deploy command.
- Predeploy checks.
- Approval record.
- Deploy output.
- Postdeploy verification.

## Safety Rules

- Do not invent or run Cloudflare commands not found in repo/user instructions.
- Do not deploy with uncommitted unrelated changes without telling the user.
- Do not print tokens or `.env`.
- Do not mutate production without explicit approval.

## Common Failures

- No Wrangler config: stop and report.
- Multiple deploy targets: ask or infer from docs.
- Network/auth failure: report exact CLI error.
- Build failure: fix or report before deploy.

## Output Format

```text
Cloudflare deploy readiness:
- Target:
- Discovered command:
- Predeploy checks:
- Approval:
- Deploy result:
- Verification:
```

## Upgrade Ideas

After a real Cloudflare repo is handled, add exact known commands and create a `scripts/cloudflare_preflight.sh`.
