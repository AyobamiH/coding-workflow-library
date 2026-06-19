---
name: cloudflare-deploy-skill
description: Plan and verify Cloudflare Pages or Workers deploy safety without assuming live deploy permission.
category: deployment
routing_triggers:
  - Cloudflare deploy
  - Wrangler deploy
  - Pages deploy
  - Workers deploy
  - deploy proof
status: active
---
# Cloudflare Deploy Skill

## Purpose

Prepare, audit, and hand off Cloudflare deployment work without treating source inspection as deployed proof.

This skill covers Cloudflare Pages versus Workers detection, Wrangler config discovery, package script discovery, build-output checks, environment and secret-name checks without printing values, pre-deploy validation, preview versus production deploy boundaries, post-deploy verification boundaries, rollback planning, stop conditions, and ledger states.

The skill is not a live deploy script. A live Cloudflare deploy requires an explicit deploy permission gate. Secret creation or update requires a separate secret-access/cloud-write gate. Production endpoint calls require a separate browser-live-proof or runtime verification gate.

## When to Use

Use this skill when:

- a repo mentions Cloudflare Pages, Workers, Wrangler, `wrangler.toml`, or `wrangler.jsonc`;
- the user asks for Cloudflare deploy planning, readiness, proof, rollback, or verification;
- a GitHub merge may trigger Cloudflare deployment;
- a package script includes a Cloudflare or Wrangler command;
- a Pages build output directory must be verified before deployment;
- a Worker entrypoint or compatibility setting needs review;
- deploy evidence is needed but live deploy permission has not been granted.

Do not use it to deploy unless John has explicitly approved the exact deploy gate for the exact target.

## Inputs Required

- Target repo path.
- Intended target: Cloudflare Pages, Workers, or unknown.
- Permission level granted: source-only planning, preview deploy, production deploy, secret setting, rollback, or post-deploy verification.
- Expected branch and dirty-worktree rules.
- Known project/account name if supplied by John.
- Known build command and output directory if supplied by John.
- Known runtime routes, custom domains, or health endpoints if supplied by John.
- Known secrets by name only, never values.

## Commands

Read-only discovery templates:

```bash
pwd
ls -la "$TARGET_REPO"
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" log --oneline -5
find "$TARGET_REPO" -maxdepth 3 -type f \( -name "wrangler.toml" -o -name "wrangler.jsonc" -o -name "package.json" -o -name ".dev.vars.example" -o -name ".env.example" -o -name "*.md" \) | sort
rg -n "cloudflare|Cloudflare|wrangler|pages deploy|workers deploy|functions|compatibility_date|main =|pages_build_output_dir|CLOUDFLARE_|CF_|wrangler deploy|wrangler pages deploy|wrangler secret|npm run build|vite build|dist|build" "$TARGET_REPO" --glob '!node_modules' --glob '!dist' --glob '!build'
node -e "const fs=require('fs'); const p=process.argv[1]; if(fs.existsSync(p)){const pkg=JSON.parse(fs.readFileSync(p,'utf8')); console.log(JSON.stringify(pkg.scripts||{}, null, 2));}" "$TARGET_REPO/package.json"
```

Local validation templates, only after scripts are confirmed:

```bash
git -C "$TARGET_REPO" diff --check
npm run build
npm run lint
npm run test
```

Cloudflare commands that require separate explicit permission before use:

```bash
npx wrangler --version
npx wrangler pages deploy <build-output> --project-name <project-name>
npx wrangler deploy
npx wrangler secret put <SECRET_NAME>
npx wrangler pages deployment list --project-name <project-name>
npx wrangler tail <worker-name>
```

Never run a deploy, secret, tail, rollback, or production endpoint command from this skill unless the current prompt grants that exact permission.

## Procedure

1. Read `AGENTS.md`, `tools.md`, and this skill before any Cloudflare command.
2. Confirm the target repo exists and record branch plus working tree state.
3. Stop if tracked changes are unexpected for the requested deployment gate.
4. Discover whether the repo is Cloudflare Pages, Workers, both, or unknown.
5. Inspect `wrangler.toml`, `wrangler.jsonc`, package scripts, README/deploy docs, Pages output settings, Worker entrypoints, `compatibility_date`, routes, and environment names.
6. Classify target:
   - Pages: static output directory, build command, Pages project name, `_routes.json`, Functions directory, custom domain checks.
   - Workers: `main` entrypoint, module format, bindings, routes, queues, durable objects, KV/R2/D1, compatibility flags.
   - Unknown: stop with discovery evidence and request target confirmation.
7. Map env and secrets by name only. Report set/not-set only when permission allows env presence checks. Never print values, prefixes, suffixes, or lengths.
8. Identify pre-deploy checks from the repo. Prefer existing package scripts. Do not invent framework checks.
9. Run local validation only when allowed and only for confirmed scripts.
10. Produce a deploy plan that separates:
    - local build proof;
    - preview deploy permission;
    - production deploy permission;
    - secret-setting permission;
    - post-deploy runtime verification permission;
    - rollback permission.
11. If live deploy permission is absent, stop at `Cloudflare deploy proof plan ready, not deployed`.
12. If live deploy permission is present, recheck dirty state, auth/project target, exact command, and secret boundaries immediately before deploy.
13. After any deploy, collect deploy output, deployment URL, build ID or deployment ID if available, and command exit code.
14. Do not call production endpoints unless runtime verification permission is also present.
15. Prepare rollback options from Cloudflare evidence; do not execute rollback without separate permission.
16. Update ledger and run log with exact commands run and commands not run.

## Evidence Required

- Target repo path and branch.
- Working tree state before any deploy-like step.
- Pages versus Workers classification.
- Cloudflare config files inspected.
- Package scripts inspected.
- Build command and output directory evidence, or why unknown.
- Worker entrypoint and compatibility evidence when Workers is in scope.
- Secret names required and presence checks without values, if authorized.
- Pre-deploy validation command results.
- Exact deploy command proposed or run.
- Deploy output if deployment was explicitly approved.
- Post-deploy verification command results if explicitly approved.
- Rollback plan or rollback evidence if explicitly approved.
- Commands not run.
- Ledger state and next permission.

## Safety Rules

- Do not deploy by default.
- Do not run `wrangler deploy` or `wrangler pages deploy` without explicit live deploy permission.
- Do not set, read, print, or rotate Cloudflare secrets without separate secret permission.
- Do not print token values, secret values, account credentials, `.env` values, or `.dev.vars` values.
- Do not assume Cloudflare Pages when Workers config exists, or Workers when Pages scripts exist.
- Do not assume source inspection proves production state.
- Do not call production endpoints unless runtime verification permission is granted.
- Do not rollback, delete deployments, change routes, change DNS, mutate KV/R2/D1/Queues, or edit Cloudflare settings without separate approval.
- Do not ignore GitHub workflows that may auto-deploy on merge.
- Do not hide failed checks behind a successful build.

## Common Failures

- No Cloudflare config found: classify as unknown and request target confirmation.
- Multiple deploy targets found: separate Pages and Workers evidence before proposing commands.
- `wrangler` unavailable: record tool blocker and do not install unless dependency-install permission is granted.
- Cloudflare auth unavailable: stop with a credential boundary and do not ask John to paste tokens into chat.
- Missing output directory after build: stop before deploy.
- Missing secret names or bindings: stop before deploy or require a secret/setup gate.
- Merge may trigger auto-deploy: stop with a deployment-aware merge boundary.
- Preview deploy mistaken for production deploy: label it clearly and avoid production proof claims.
- Production endpoint not checked: say runtime proof remains unverified.

## Output Format

```text
# Cloudflare Deploy Readiness Report

## Selected Skill

## Target Repo

## Permission Gate

## Repo State

## Target Classification

## Config And Scripts Inspected

## Environment And Secret Boundary

## Pre-Deploy Checks

## Deploy Plan

## Deploy Result

## Post-Deploy Verification

## Rollback Boundary

## Commands Not Run

## Evidence Collected

## Final Ledger State

## Next Permission Needed From John
```

## Upgrade Ideas

- Add a local `scripts/cloudflare-deploy-readiness` helper.
- Add Pages versus Workers config parser.
- Add GitHub workflow auto-deploy detector.
- Add Wrangler output redactor.
- Add preview deployment evidence parser.
- Add rollback-plan generator.
- Add route metadata for `cloudflare-deploy-proof-planning`.
