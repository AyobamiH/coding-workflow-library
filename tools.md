# tools.md

## Purpose

This is the local tool catalogue for the coding workflow orchestrator and skills.

Use it to decide what tools exist locally, when a tool is appropriate, which permission gate it belongs to, what evidence must be collected, and which actions require explicit John approval.

This file does not grant permission. It classifies tools. `AGENTS.md` remains the hard-rule layer, and individual skills provide task-specific procedures.

## Tool Permission Model

Permission levels:

- `read-only-local`: local file, repo, and process inspection that does not modify files or external state.
- `local-edit`: exact file creation or modification inside the approved workspace.
- `dependency-install`: package install, package manager mutation, tool download, or dependency cache mutation.
- `local-validation`: local lint, test, build, formatting check, or validation script.
- `git-commit`: staging exact files and creating commits.
- `git-push`: pushing commits or tags to remotes.
- `github-remote`: GitHub issue, PR, release, Actions, comment, label, or repository remote operations.
- `browser-live-proof`: browser inspection, screenshot, or runtime proof, especially against deployed or logged-in contexts.
- `secret-access`: reading, writing, rotating, or checking secrets in env files, secret managers, provider dashboards, or CLIs.
- `cloud-read`: reading cloud configuration, deployment status, logs, routes, DNS, queues, storage, or account data.
- `cloud-write`: changing cloud settings, secrets, routes, DNS, storage, workers, queues, or provider resources.
- `database-read`: reading schema, migrations, data, policies, grants, logs, or deployed state.
- `database-write`: migrations, seeds, resets, policy changes, function deploys, SQL writes, or data mutation.
- `production-deploy`: deploying code, functions, workers, pages, releases, or production configuration.
- `destructive`: delete, reset, clean, restore, force, volume removal, data deletion, or irreversible cleanup.

Rules:

- The orchestrator must not cross permission levels without explicit John approval.
- Read-only local tools are allowed during repo mapping and source-only audits.
- Cloud, database, secret, deploy, and destructive actions require explicit approval.
- If a tool's required permission is higher than the current permission, stop and ask John with a decision brief.
- A command appearing in this catalogue or `command-library.md` is not permission to run it.

## Tool Catalogue

### git

Purpose: inspect repo state, compare changes, and perform exact-file handoff work.

Default permission: `read-only-local` for inspection.

Safe read-only examples:

```bash
git status --short
git branch --show-current
git diff --stat
git diff -- path
git log --oneline -5
```

Mutating examples requiring approval:

```bash
git add <exact files>
git commit
git push
git reset
git clean
git restore
git stash
```

Safety rules:

- Never run `git add .`.
- Never reset, clean, restore, or stash without approval.
- Preserve unrelated changes.
- Treat untracked files as evidence until classified.
- Prefer exact-file diffs and exact-file commits.

Evidence required:

- Status before and after.
- Diff stat.
- Exact files changed and staged.
- Commit hash only if commit was approved and created.

#### scripts/committer

Purpose: safer local Git commit preparation that stages exact listed files only and prints evidence before handoff.

Default permission: `read-only-local` for `--dry-run`; `git-commit` for `--no-commit` staging or default commit mode.

Examples:

```bash
./scripts/committer --repo "$TARGET_REPO" --message "Describe the exact scoped change" --files path/to/file --dry-run
./scripts/committer --repo "$TARGET_REPO" --message "Describe the exact scoped change" --files path/to/file --no-commit
./scripts/committer --repo "$TARGET_REPO" --message "Describe the exact scoped change" --files path/to/file
```

Rules:

- Default mode commits exact listed files only.
- Dry-run mode is safe read-only and does not stage or commit.
- No-commit mode stages exact files only and prints the suggested commit command.
- Push and PR remain separate permission gates.
- The helper must not be used as permission to push, create PRs, deploy, run migrations, or mutate external services.

Evidence required:

- Repo path and branch.
- Pre-status and pre-diff stat.
- Exact files requested and exact files staged.
- Staged diff stat.
- Diff-check result.
- Secret-shaped staged diff scan result.
- Commit hash only if default commit mode was explicitly approved and succeeded.
- Final status.

#### scripts/run-next

Purpose: executable autonomous work-loop runner for the coding workflow library. It reads `work-ledger.md`, selects the active repo work item, maps status to skill and permission gate, runs only actions covered by supplied `--allow` flags, updates ledger/run-log evidence, and stops at real John-required boundaries.

Default permission: `read-only-local` for `--dry-run` and unsupported/boundary states; escalates by supplied `--allow` flag for covered actions. Current covered paths are GitHub handoff for `Auth pass for GitHub handoff`, read-only PR readiness inspection for `PR opened, not merged`, PR #11 merge handoff for `PR ready for merge approval`, source-only deployment planning for `Merged, not deployed`, source/local Supabase execution preflight for `Deployment plan ready, not deployed`, Supabase tooling/auth setup for `Supabase execution preflight ready, not executed`, Supabase link/local secret readiness for `Supabase tooling/auth ready, not linked`, and scheduler draft/PR handoff for `Supabase linked and local secret ready, not deployed`.

Examples:

```bash
./scripts/run-next
./scripts/run-next --dry-run
./scripts/run-next --repo /home/johnh/wagging-web-wins
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow github-handoff
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow github-handoff --dry-run
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow pr-readiness
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow pr-merge
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow deployment-plan
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow supabase-preflight
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow supabase-tooling-auth
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow supabase-link-secret-readiness
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow scheduler-draft-pr
```

Supported permission flags:

```text
--allow auth-check
--allow github-handoff
--allow push-pr
--allow local-validation
--allow local-edit
--allow commit
--allow pr-readiness
--allow pr-merge
--allow deployment-plan
--allow supabase-preflight
--allow supabase-tooling-auth
--allow supabase-link-secret-readiness
--allow scheduler-draft-pr
```

Rules:

- Never assume permission from ledger status alone.
- Never add deploy, migration, Supabase mutation, production endpoint, release, or destructive powers without a future explicit upgrade.
- Never print token values.
- Never push `main`, force push, deploy, run Supabase migrations, mutate Supabase, call production endpoints, stage unrelated files, or include `evidence/`; never merge except through the explicit PR merge mode.
- Dry-run mode must not create branches, push, create PRs, inspect live PRs, or mark ledger work completed.
- PR readiness mode must inspect GitHub evidence only and must never merge.
- PR merge mode must only merge PR #11 after explicit `--allow pr-merge`, exact PR scope checks, passing/nonblocking checks, `MERGEABLE` state, repo access, auth user confirmation, and repo-local workflow deployment scan. It must not delete the branch, deploy, run migrations, mutate Supabase, call production endpoints, force push, or push `main`.
- Deployment planning mode must only inspect local/source evidence and draft future-gated commands. It must not set secrets, deploy, run migrations, mutate Supabase, update schedulers, call production endpoints, push, create PRs, merge, or print secrets.
- Supabase execution preflight mode must only inspect local/source execution prerequisites and draft future-gated commands. It must not install the Supabase CLI, run `npx supabase`, log in, link a project, set secrets, deploy functions, run migrations, execute SQL, mutate schedulers, call runtime endpoints, push, create PRs, merge, or print secrets.
- Supabase tooling/auth setup mode may run `npx supabase --version` and read-only project listing with `SUPABASE_ACCESS_TOKEN` as a runtime environment value. It must not install Supabase CLI as a dependency, run `supabase login`, run `supabase link`, set secrets, deploy functions, run migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push, create PRs, merge, or print secrets.
- Supabase link/local secret readiness mode may run local `npx supabase link --project-ref <approved-ref>` after auth/project checks pass and may generate/store `IMPORT_REDDIT_TIPS_SECRET` only in `/home/johnh/.openclaw/.env`. It must not set remote secrets, deploy functions, run migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push, create PRs, merge, stage target repo files, include `evidence/`, or print secrets.
- Scheduler draft/PR mode may draft a guarded local scheduler migration, update docs, run local checks, create an exact-file commit, push a feature branch, and open or confirm a PR when John grants `--allow scheduler-draft-pr`. It must not set remote secrets, deploy functions, run `db push`, apply migrations, execute SQL, mutate schedulers remotely, invoke Edge Functions, call production endpoints, push `main`, force-push, merge, include `evidence/`, include `supabase/.temp/`, or print secrets.
- Vendor skill intake is a dependency-install/local-edit workflow and must be isolated under `vendor-intake/<vendor-name>/`. It must not install into a target repo, override `AGENTS.md` or `tools.md`, copy secrets, mutate Supabase, deploy, run migrations, or mark a repo deployment-ready. Official Supabase guidance is advisory until adapted into local library files.

Evidence required:

- Selected ledger item and current status.
- Supplied `--allow` flags.
- Selected next skill and required permission.
- Repo status, staged-area, branch, and expected commit evidence when GitHub handoff is covered.
- Auth user and repo permission evidence without token values when GitHub handoff is covered.
- PR URL, metadata, changed files, commits, checks, mergeability/review evidence, unexpected-file findings, or exact boundary reason.
- For PR merge mode: repo-local workflow deployment scan evidence, pre-merge PR state, exact changed files, PR checks, merge command result, final PR state, and post-merge local repo state.
- For deployment planning mode: repo state, merged commit/source evidence, Supabase config/function evidence, scheduler evidence, package scripts, CLI availability, drafted-but-not-run commands, and explicit remaining gates.
- For Supabase execution preflight mode: repo state, Supabase config/function/migration/scheduler evidence, env variable names only, CLI availability, project reference evidence, secret setup evidence without values, scheduler update decision, exact drafted execution sequence, blockers, and explicit permission gates.
- For Supabase tooling/auth setup mode: repo state, Node/npm/npx availability, local Supabase path, `npx supabase --version` result, local env variable names/presence only, project-ref match/mismatch, read-only project access result, final auth status, and commands explicitly not run.
- For Supabase link/local secret readiness mode: repo status before and after link, auth/project access reconfirmation, link result, local files created by link such as ignored `supabase/.temp/*`, local import secret readiness without values, and explicit commands not run.
- For scheduler draft/PR mode: starting repo state, origin/main fetch and feature branch evidence, scheduler source evidence, guarded migration path, docs update, local check results, exact-file commit hash, pushed branch, PR URL or confirmation, included/excluded files, and remote Supabase commands explicitly not run.
- For vendor skill intake: isolated intake path, install command/result, installed skill names, files inspected, useful guidance found, differences from local gates, local library updates made, and confirmation that no target repo or external service was mutated.
- Ledger and run-log update status.

### gh

Purpose: inspect and manage GitHub issues, PRs, Actions, releases, and repository metadata.

Availability: verify before use.

Default permission: `github-remote`.

Read-only examples:

```bash
command -v gh || true
gh auth status
gh auth status --hostname github.com
gh auth status --show-token-scopes
gh repo view
gh pr view <number>
gh pr diff <number>
gh issue view <number>
gh run list
gh run view <run-id> --log
```

Runtime environment auth examples. These report presence only and must never print values:

```bash
test -n "$GH_TOKEN" && echo "GH_TOKEN is set" || echo "GH_TOKEN is not set"
test -n "$GITHUB_TOKEN" && echo "GITHUB_TOKEN is set" || echo "GITHUB_TOKEN is not set"
```

Local account switching, only when the requested account is already authenticated locally and account switching has been authorized:

```bash
gh auth switch --hostname github.com --user "$EXPECTED_OWNER"
```

Mutating examples requiring approval:

```bash
gh pr create
gh pr comment
gh issue close
gh issue edit --add-label
gh release create
```

Safety rules:

- Use `github-auth-gate-skill` when `gh auth status` fails or the active account is unclear.
- Prefer body files for long PR/comment/release text.
- Do not post comments, close issues, change labels, create releases, or open PRs without approval.
- Do not expose secret values from logs.
- `GH_TOKEN` and `GITHUB_TOKEN` are runtime environment auth options only.
- Environment tokens must never be printed or committed.
- `GH_TOKEN` may override stored `gh` auth for the current process.
- Never run `gh auth token` unless explicitly needed, and never print its output.
- If token scopes are shown, report scope names only.
- Auth success is not deploy, merge, release, migration, or production permission.

Evidence required:

- Repository and branch context.
- `gh` availability.
- Auth status summary without token values.
- Active account when available.
- Environment token presence only, not value.
- PR, issue, run, or release identifier.
- Read-only output summary.
- URL or ID for any approved remote mutation.

### node

Purpose: run local scripts, parse JSON/Markdown, generate reports, and implement portable helpers.

Default permission: `read-only-local` for non-mutating local scripts, `local-edit` for scripts that write files.

Safe examples:

```bash
node --version
node scripts/local-helper.js
node -e "const fs=require('fs'); console.log(fs.existsSync('README.md'))"
```

Safety rules:

- No network assumptions unless the script clearly performs network calls.
- Inspect script intent before running unfamiliar code.
- Treat file-writing scripts as `local-edit`.

Evidence required:

- Script path or inline purpose.
- Output summary.
- Files read or written, if any.

### npm / npx

Purpose: install dependencies, run package scripts, execute local package binaries, and validate JavaScript projects.

Default permission: `local-validation` for existing scripts that do not install; `dependency-install` for installs/downloads.

Package manager rules:

- Respect `packageManager` if present.
- If no `packageManager`, use lockfile evidence.
- Prefer `npm ci` when `package-lock.json` exists.
- Do not switch package managers silently.
- Report lockfile drift.

Examples:

```bash
npm run build
npm run lint
npm test
npm ci
npm exec -- <local-tool>
```

Risk examples requiring caution or approval:

```bash
npm install
npm update
npx <package>
npm publish
```

Notes:

- `npx` can download and execute packages. Treat it as dependency/tool execution risk unless using local package resolution through `npm exec --`.
- `npm ci` can modify `node_modules` and dependency cache even when lockfiles stay unchanged.

Evidence required:

- Package manager decision.
- Relevant lockfiles.
- Command output summary.
- Lockfile or package file changes, if any.

### bun / pnpm / yarn

Purpose: alternate JavaScript package managers.

Availability: verify before use.

Default permission: `local-validation` for confirmed existing project scripts; `dependency-install` for installs or package-manager changes.

Rules:

- Check `packageManager` and lockfiles first.
- Do not switch package managers silently.
- Do not delete lockfiles.
- Record lockfile drift.
- Approval is required if changing package manager or adding lockfiles.

Evidence required:

- Detected package manager.
- Lockfile evidence.
- Command output summary.
- Changed package or lock files.

### rg

Purpose: fast local text search for repo inspection, route tracing, source audits, and command discovery.

Default permission: `read-only-local`.

Safe examples:

```bash
rg -n "pattern" .
rg --files
rg -n "supabase|wrangler|gh " . --glob '!node_modules'
```

Safety rules:

- Avoid dumping raw secrets.
- When searching for secret-shaped values, report only path, line, key name, category, and masked preview.
- Exclude `node_modules`, build output, and generated large folders when possible.

Evidence required:

- Search pattern category.
- Paths and line numbers.
- Redacted summary for sensitive findings.

### find / ls / cat / sed / awk / jq

Purpose: local file discovery, listing, safe reads, slicing large files, and structured parsing.

Default permission: `read-only-local`.

Safe examples:

```bash
find . -maxdepth 3 -type f | sort
ls -la
sed -n '1,220p' README.md
awk '{print NR ":" $0}' file.txt
jq '.scripts' package.json
```

Safety rules:

- Do not print `.env` values, private keys, tokens, cookies, database URLs, or secret-bearing config.
- Prefer `sed -n` ranges over full-file dumps for large or sensitive files.
- Treat reads of secret files as `secret-access`, not ordinary read-only inspection.

Evidence required:

- File paths inspected.
- Relevant line ranges or JSON keys.
- Redaction notes for sensitive areas.

### jq

Purpose: parse JSON safely, especially `package.json`, lockfiles, config, and API output.

Availability: verify before use.

Default permission: `read-only-local`.

Safe examples:

```bash
jq '.scripts' package.json
jq '.packageManager' package.json
jq '{name, version}' package.json
```

Safety rules:

- Do not pipe secret-bearing JSON into reports without redaction.
- If `jq` is unavailable, use Node for local parsing.

Evidence required:

- JSON file or output source.
- Queried keys.
- Redacted summary if sensitive.

### Supabase CLI

Purpose: inspect and manage Supabase projects, database state, migrations, functions, and secrets.

Availability: verify before use.

Default permission: source-only file reads are `read-only-local`; Supabase CLI project interactions are at least `cloud-read` or `database-read`; mutation commands are `database-write`, `cloud-write`, `secret-access`, or `production-deploy`.

Source-only inspections are allowed through file reads, `rg`, `find`, `sed`, and local scripts.

Commands requiring approval:

```bash
supabase link
supabase db push
supabase db pull
supabase migration up
supabase db reset
supabase functions deploy
supabase secrets set
```

Safety rules:

- Do not link, push, pull, reset, deploy functions, or set secrets without approval.
- Do not assume deployed RLS matches migrations.
- Do not print service-role keys, database URLs, JWTs, or secret values.

Evidence required:

- Project reference.
- Target environment.
- Source plan or dry-run where possible.
- Deployed verification if approved.
- RLS, grants, function config, and secret state evidence for production claims.

### Wrangler / Cloudflare

Purpose: inspect and manage Cloudflare Workers, Pages, KV, R2, D1, DNS, routes, logs, and secrets.

Availability: verify before use.

Default permission: `cloud-read` for account/config/status inspection; `cloud-write` or `production-deploy` for changes.

Read-only examples if available:

```bash
wrangler --version
wrangler whoami
wrangler deploy --dry-run
```

Write/deploy/secret commands requiring approval:

```bash
wrangler deploy
wrangler secret put <name>
wrangler kv key put
wrangler kv key delete
wrangler r2 object put
wrangler r2 object delete
```

Also require approval:

- DNS changes.
- Route changes.
- Worker or Pages deploys.
- KV, R2, D1, queue, or secret mutations.

Evidence required:

- Account.
- Project.
- Config file.
- Deployed URL.
- Runtime proof after approved deploy.

### Browser

Purpose: live proof after deployment, UI fixes, auth flows, and runtime debugging.

Availability: verify before use.

Default permission: `browser-live-proof`.

Rules:

- Distinguish screenshot/inspection from mutation.
- Logged-in browser access can expose accounts and private data.
- Approval is required before changing live data, submitting forms, purchasing, deleting, or altering account state.

Evidence required:

- URL.
- Action taken.
- Expected result.
- Screenshot or log summary.
- Redaction notes for private data.

### curl / HTTP requests

Purpose: inspect local or remote HTTP endpoints, headers, status codes, and API responses.

Default permission: local development requests may be `read-only-local`; production endpoint calls are `github-remote`, `cloud-read`, `database-read`, or `browser-live-proof` depending on target and effect.

Examples:

```bash
curl -I http://localhost:3000
curl -s http://localhost:3000/health
```

Rules:

- Production endpoint calls require approval.
- Never send secrets in the transcript.
- Do not print full sensitive URLs, tokens, signed links, cookies, or auth headers.
- Mutating HTTP methods require explicit approval.

Evidence required:

- Method.
- Endpoint category, not secret URL if sensitive.
- Response status.
- Redacted response summary.

### Secret manager / 1Password / env files

Purpose: check secret presence, names, locations, and deployment readiness without exposing values.

Availability: verify before use.

Default permission: `secret-access`.

Rules:

- No broad secret dumps.
- Approval required before accessing secret values.
- Report shape-only: name, location/category, present/missing.
- Never print values.
- `.env.example` may contain names and placeholders only.

Evidence required:

- Secret name only.
- Location or category.
- Present or missing.
- Whether value access was avoided or approved.

### Docker

Purpose: run local services, containers, databases, and integration test dependencies.

Availability: verify before use.

Default permission: `local-validation` for non-destructive local service startup; `destructive` for volume/container cleanup.

Examples:

```bash
docker ps
docker compose ps
docker compose up
```

Approval required:

```bash
docker compose down -v
docker rm
docker volume rm
docker system prune
```

Evidence required:

- Compose file or image source.
- Containers started/stopped.
- Ports.
- Volumes affected.
- Cleanup commands avoided or approved.

### Python

Purpose: local parsing, reports, quick data transforms, and compatibility checks.

Default permission: `read-only-local` for local parsing; `local-edit` for file-writing scripts; higher permission if the script performs network, install, cloud, database, or secret operations.

Safe examples:

```bash
python --version
python -m json.tool file.json
python scripts/local_report.py
```

Rules:

- Do not use Python to make network calls unless approved.
- Prefer Node when the repo is JavaScript/TypeScript and Node is already the local scripting convention.
- Do not write files unless local edits are authorized.

Evidence required:

- Script path or inline purpose.
- Input files.
- Output summary.
- Files written, if any.

### Local validation scripts

Purpose: validate and audit this skills library.

Default permission: `local-validation`.

Commands:

```bash
./scripts/validate-skills
./scripts/skill-cleaner
./scripts/skill-cleaner --json
```

Rules:

- `./scripts/validate-skills` is pass/fail validation.
- `./scripts/skill-cleaner` is advisory cleanup intelligence.
- Cleaner findings do not permit deletion, merge, rename, or deprecation.

Evidence required:

- Command output summary.
- Pass/fail validator result.
- Cleaner summary and recommended queue when relevant.

### Editor/file modification tools

Purpose: exact local file edits, generated docs, and owned script creation.

Default permission: `local-edit`.

Rules:

- Use exact-file edits only.
- Read before editing unless creating a clearly new file.
- No broad formatting unless requested.
- Preserve unrelated changes.
- Do not edit outside the approved workspace.

Evidence required:

- Files changed.
- Diff stat or content summary.
- Validation result.
- Remaining risks.

## Tools That Require John Approval

John approval is required for:

- Deploy tools.
- Database mutation tools.
- Secret access tools.
- Commit, push, PR, release, tag, and merge tools.
- Production HTTP calls.
- Destructive git or file commands.
- Package manager changes.
- Billing, domain, DNS, registrar, and account changes.
- Browser actions that mutate live data or account state.
- Cloud writes, worker deploys, route changes, queue/storage mutations, and secret writes.

## Evidence Rules

Before final response, collect:

- Tool name and command category.
- Permission level granted, missing, and avoided.
- Tool availability when uncertain.
- Target repo/path/project/account.
- Before state for mutating tools.
- After state for approved mutations.
- Files changed and validation result for local edits.
- Redaction note for any sensitive output.
- Runtime proof for deployment, browser, or HTTP claims.

## Unknown Tool Handling

If a tool is not known to be installed:

- Check with `command -v <tool>` only if allowed.
- Otherwise mark it as "verify before use".
- Do not assume availability.
- Do not install or download a tool without dependency-install approval.
