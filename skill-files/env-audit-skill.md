---
name: env-audit-skill
description: Audit env files, secrets, and public/private config.
category: security
routing_triggers:
  - env audit
  - secret exposure
  - env example
  - public config
status: active
---
# env-audit-skill

## Purpose

Audit a repository's environment-variable surface, secret exposure risk, public/private config boundaries, frontend public config, server-only secrets, function-level env usage, and documentation gaps.

This skill is read-only by default. It is designed to find where configuration is declared, referenced, hardcoded, documented, or accidentally exposed without printing raw secret values.

## When to Use

Use this skill:

- Before production launch or security review.
- After repo handoff or before an unfamiliar deployment.
- After LLM-generated code touches env, config, scripts, functions, migrations, docs, or deployment files.
- When public frontend keys are found and must be classified.
- When Supabase, Stripe, Cloudflare, n8n, OpenAI, Resend, SendGrid, GitHub, Mapbox, Mailgun, or webhook secrets are involved.
- When Edge Functions, server functions, API routes, workers, jobs, or scripts use secret env vars.
- When `.env.example` may be incomplete or stale.
- When a repo has public endpoints that also use private-service access.
- When docs contain placeholder secrets and you need to separate placeholders from real-looking leaks.

## Inputs Required

- `TARGET_REPO`: absolute path to the repo being audited.
- `SKILLS_LIBRARY`: absolute path to the local skills library.
- Audit mode: read-only, or explicitly allowed to patch docs/examples.
- Known deployment provider, if available.
- Known backend provider, if available.
- In-scope services: Supabase, Cloudflare, Stripe, n8n, OpenAI, Resend, SendGrid, GitHub, Mapbox, Mailgun, or other providers.
- Whether untracked evidence/docs folders should be included in the scan.

## Commands

Confirm repo path and Git state:

```bash
pwd
ls -la "$TARGET_REPO"
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
```

Find env/config files without printing their contents:

```bash
find "$TARGET_REPO" -maxdepth 4 -type f \( -name ".env" -o -name ".env.*" -o -name ".dev.vars" -o -name "*.env" -o -name "wrangler.toml" -o -name "config.toml" -o -name "supabase.toml" \) | sort
```

Check whether secret-bearing files are tracked or ignored:

```bash
git -C "$TARGET_REPO" ls-files -- .env ".env.*" ".dev.vars" "*.pem" "*.key" || true
git -C "$TARGET_REPO" check-ignore -v .env .env.local .env.production.local .dev.vars "*.pem" "*.key" || true
git -C "$TARGET_REPO" status --short -- .env ".env.*" ".dev.vars" "*.pem" "*.key" || true
```

Inspect ignore rules:

```bash
sed -n '1,220p' "$TARGET_REPO/.gitignore"
```

Search env usage across repo areas. Raw output may include values; redact before reporting.

```bash
rg -n "process.env|import.meta.env|Deno.env.get|SUPABASE_|VITE_|STRIPE_|CLOUDFLARE_|OPENAI_|RESEND_|SENDGRID_|JWT|SECRET|TOKEN|SERVICE_ROLE|ANON|DATABASE_URL" "$TARGET_REPO" --glob '!node_modules' --glob '!dist' --glob '!build' --glob '!coverage'
```

Find frontend and server env access:

```bash
rg -n "process\.env|import\.meta\.env|Deno\.env\.get" "$TARGET_REPO/src" "$TARGET_REPO/scripts" "$TARGET_REPO/supabase/functions" --glob '!node_modules' || true
```

Find Supabase functions and JWT settings:

```bash
find "$TARGET_REPO/supabase/functions" -maxdepth 2 -type f | sort
sed -n '1,220p' "$TARGET_REPO/supabase/config.toml"
rg -n "Deno\.env\.get\(['\"][A-Z0-9_]+['\"]\)|verify_jwt|SUPABASE_SERVICE_ROLE_KEY" "$TARGET_REPO/supabase" || true
```

Check package scripts and build/runtime config:

```bash
node -e 'const fs=require("fs"); const p=process.argv[1]+"/package.json"; const pkg=JSON.parse(fs.readFileSync(p,"utf8")); console.log(JSON.stringify(pkg.scripts||{},null,2));' "$TARGET_REPO"
find "$TARGET_REPO/scripts" -maxdepth 2 -type f | sort
sed -n '1,220p' "$TARGET_REPO/vite.config.ts" 2>/dev/null || true
sed -n '1,220p' "$TARGET_REPO/vitest.config.ts" 2>/dev/null || true
```

Check docs for placeholder secret examples:

```bash
find "$TARGET_REPO/docs" "$TARGET_REPO/evidence" -maxdepth 3 -type f 2>/dev/null | sort
rg -n "SECRET|TOKEN|KEY|SERVICE_ROLE|DATABASE_URL|WEBHOOK|STRIPE_|SUPABASE_|OPENAI_|RESEND_|SENDGRID_|CLOUDFLARE_|N8N_" "$TARGET_REPO/README.md" "$TARGET_REPO/docs" "$TARGET_REPO/evidence" "$TARGET_REPO/package.scripts.md" 2>/dev/null || true
```

Use a redacted scanner for secret-shaped markers. It must emit only file path, line number, category, key name, and masked preview:

```bash
node - "$TARGET_REPO" <<'NODE'
const fs=require("fs"), path=require("path");
const root=process.argv[2];
const skipDirs=new Set([".git","node_modules","dist","dist-ssr","build","coverage"]);
const skipExt=new Set([".png",".jpg",".jpeg",".webp",".gif",".ico",".woff",".woff2",".ttf",".lock"]);
function walk(dir,out=[]){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(skipDirs.has(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p,out);else if(!skipExt.has(path.extname(ent.name).toLowerCase()))out.push(p)}return out}
function mask(v){v=String(v);return v.length<=8?v.slice(0,2)+"***":v.slice(0,4)+"***"+v.slice(-4)}
function keyName(line){const m=line.match(/\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|SERVICE_ROLE|WEBHOOK|DATABASE_URL|DB_URL|ANON)[A-Z0-9_]*)\b/i);return m?m[1]:"unknown"}
const patterns=[
  ["openai_key",/\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ["stripe_secret_key",/\bsk_(?:live|test)_[A-Za-z0-9_]{6,}\b/g],
  ["stripe_webhook_secret",/\bwhsec_[A-Za-z0-9_]{6,}\b/g],
  ["jwt_like_value",/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g],
  ["private_key_block",/BEGIN [A-Z ]* KEY/g],
  ["database_url",/\b(?:postgres|postgresql|mysql|mongodb):\/\/[^\s"'<>()]+/g],
  ["github_token",/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g],
  ["bearer_token_literal",/Bearer\s+[A-Za-z0-9_.-]{20,}/g],
  ["basic_auth_literal",/Basic\s+[A-Za-z0-9+/=]{16,}/g],
  ["assigned_high_entropy_secret",/\b([A-Za-z0-9_]*(?:key|token|secret|password|credential)[A-Za-z0-9_]*)\b\s*[:=]\s*["']([A-Za-z0-9_.+/=-]{24,})["']/gi]
];
for(const file of walk(root)){let text;try{text=fs.readFileSync(file,"utf8")}catch{continue}
  text.split(/\r?\n/).forEach((line,i)=>{for(const [cat,re] of patterns){re.lastIndex=0;let m;while((m=re.exec(line))){const value=m[2]||m[1]||m[0];console.log(`${path.relative(root,file)}:${i+1}\t${cat}\tkey=${keyName(line)}\tpreview=${mask(value)}`)}}})
}
NODE
```

If any command prints raw values, do not paste that output into the report. Convert it to path, line, key name, category, and masked preview only.

## Procedure

1. Read `RUNBOOK.md` and select `env-audit-skill` from the skill selection flow.
2. Read this skill file before running audit commands.
3. Confirm `TARGET_REPO` exists and record Git state before auditing.
4. Find env/config files without printing values.
5. Check which env/config/secret-like files are tracked, ignored, clean, modified, or untracked.
6. Inspect `.gitignore` for protection of `.env`, `.env.*`, `.env.*.local`, `.dev.vars`, key files, certificate files, service-role files, local Supabase files, and provider-specific local secret files.
7. Extract variable names only from env/example files. Never print values.
8. Search environment-variable usage across frontend, backend, scripts, docs, migrations, tests, serverless functions, workers, and deployment config.
9. Build an env inventory table with variable/key name, runtime area, public/private expectation, example coverage, risk, and evidence.
10. Search secret-shaped markers with redacted output only.
11. Inspect frontend public config boundaries: public URLs, publishable keys, anon keys, map tokens, analytics IDs, and `import.meta.env` usage.
12. Inspect server/edge function env usage and identify which functions use private secrets.
13. Identify public endpoints that use private secrets or service-role access.
14. Compare `.env.example` coverage against actual names used in code and docs.
15. Inspect docs and evidence files. Classify placeholder examples separately from real-looking committed values.
16. Classify risks as critical, high, medium, or low.
17. Recommend the next skill, usually `supabase-rls-audit-skill` when Supabase public anon keys or RLS-dependent safety claims are present.
18. Append a run log entry to `runs/skill-runs.md` before saying the audit is complete.

### Supabase-Specific Procedure

If the repo has Supabase files or dependencies:

1. Inspect `src/integrations/supabase/client.*` if present.
2. Identify public Supabase URL usage and anon/publishable key usage without printing values.
3. Confirm no `SUPABASE_SERVICE_ROLE_KEY` appears in frontend or public folders.
4. Inspect `supabase/config.toml`.
5. List functions with `verify_jwt = false`.
6. Inspect `supabase/functions`.
7. Find every `Deno.env.get(...)` usage and extract env names only.
8. Produce a function/env/JWT matrix.
9. Mark service-role usage inside public unauthenticated functions as high review.
10. State clearly that Supabase anon keys are only safe if RLS is correct.
11. Recommend `supabase-rls-audit-skill` when RLS has not been audited.

### Risk Classification

- Critical: private secrets or service-role credentials exposed in committed frontend/public files.
- High: private keys/tokens in tracked repo files, service-role use in frontend, or public unauthenticated endpoints performing privileged operations.
- Medium: public endpoints needing authorization review, incomplete `.env.example`, unclear secret docs, ignored-but-present local env files, hardcoded public tokens that need provider restrictions, or migration/scripts embedding credential-like values.
- Low: expected public anon/publishable keys, placeholder docs, normal env-name references, or docs-only examples clearly marked as placeholders.

## Evidence Required

- Repo path exists.
- Git state before audit.
- Env/config file list.
- Tracked/ignored/dirty status for env-like and secret-like files.
- `.gitignore` secret-protection result.
- Variable inventory.
- Frontend public config boundary.
- Server-only secret usage and file/function locations.
- Supabase Edge Function env/JWT matrix if Supabase exists.
- Secret-shaped marker scan result with masked previews only.
- `.env.example` coverage result.
- Docs/evidence placeholder classification.
- Risk classification by severity.
- Next-skill recommendation.
- Run log update.

## Safety Rules

- Never print raw secrets.
- Never print full JWTs, API keys, private keys, database URLs, cookies, session values, webhook secrets, bearer tokens, basic-auth strings, or connection strings.
- If a secret-looking value is found, report only file path, line number, key name, risk category, and masked preview.
- Do not run deployments.
- Do not run migrations.
- Do not mutate Supabase, Cloudflare, Stripe, GitHub, n8n, OpenAI, Resend, SendGrid, Mailgun, Mapbox, or other external providers.
- Do not install packages.
- Do not modify env files unless the user explicitly allows patching them.
- Do not run commands that require network access unless explicitly requested and approved.
- Do not treat public anon keys as safe unless RLS has been verified.
- Do not assume `verify_jwt=false` is wrong; always require endpoint and authorization review.
- Avoid broad raw grep output in final reports. Redact or summarize it first.

## Common Failures

- Confusing public anon/publishable keys with leaked private secrets.
- Printing raw secret values in the report.
- Ignoring Edge Functions, workers, API routes, cron jobs, and server scripts.
- Ignoring scripts and migrations that embed public tokens or request headers.
- Only scanning `.env` files and missing hardcoded literals.
- Failing to check `.env.example` coverage.
- Failing to check `.gitignore` protection.
- Treating docs placeholders as real leaks.
- Treating real-looking docs examples as harmless without checking placeholder context.
- Missing public unauthenticated functions that use service-role keys.
- Saying "safe" before RLS or provider restrictions have been audited.
- Letting a failed scanner hide evidence; rerun with a simpler read-only command and record the failure.

## Output Format

# Env Audit Skill Run

## Selected Skill

## Why This Skill Was Selected

## Target Repo

## Commands Run

## Files Inspected

## Env Files Found

## Git Ignore Protection

## Env Variable Inventory

Use this table:

| Variable/key name | Runtime area | Public/private expectation | Example file coverage | Risk level | Evidence |
|---|---|---|---|---|---|

## Frontend Public Config Boundary

## Server/Edge Function Env Usage

Use this table when Edge Functions or server functions exist:

| Function | Env names | JWT disabled | Service role used | Public-facing | Review level | Evidence |
|---|---|---|---|---|---|---|

## Public Endpoints Using Private Secrets

## Secret-Shaped Marker Findings

Do not print raw secret values.

## Public vs Private Config Boundary

## Missing Env Example Coverage

## Risks Found

Group by:

- Critical
- High
- Medium
- Low

## What Is Still Unverified

## Recommended Next Skill

## Did The Skill Work?

Answer yes, partially, or no, and explain why.

## Skill Improvement Notes

## Run Log Update

Confirm whether `runs/skill-runs.md` was appended.

## Upgrade Ideas

- Build a reusable redacted env scanner script.
- Build an env-example coverage checker.
- Build a Supabase function/JWT matrix generator.
- Build a `.gitignore` secret-protection checker.
- Build a docs placeholder classifier.
- Later expose these checks as a local CLI command.
