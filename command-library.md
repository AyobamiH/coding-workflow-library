# Command Library

This file lists extracted commands and command templates by use. Commands are not automatically safe; follow `AGENTS.md` and the matching skill's safety rules.

## Public Path Portability

```bash
./scripts/check-public-paths
./scripts/check-public-paths --json
npm run check:paths
```

Tracked examples use `<LIBRARY_REPO>`, `<TARGET_REPO>`, `<LOCAL_ENV_FILE>`, and `<TEMP_ROOT>`. Runtime callers may set `CODING_WORKFLOW_HOME`, `CODING_WORKFLOW_ENV_FILE`, `CODING_WORKFLOW_TMPDIR`, or `CODING_WORKFLOW_NPM_CACHE`; those local values must not be copied into public evidence.

## Repo Mapping

```bash
./scripts/repo-map --repo "$TARGET_REPO"
./scripts/repo-map --repo "$TARGET_REPO" --json
./scripts/repo-map --repo "$TARGET_REPO" --validate
./scripts/repo-map --repo "$TARGET_REPO" --max-files 500
coding-workflow repo-map --repo "$TARGET_REPO" --validate
```

`scripts/repo-map` is source-only orientation. It must not install dependencies, run target build/test commands, mutate git, read `.env` values, call external services, publish, deploy, push, tag, or prove runtime behaviour.

## Project Knowledge Base

```bash
./scripts/project-kb --repo "$TARGET_REPO" --dry-run
./scripts/project-kb --repo "$TARGET_REPO" --json
./scripts/project-kb --repo "$TARGET_REPO" --validate
./scripts/project-kb --repo "$TARGET_REPO" --output "$TARGET_REPO/PROJECT_KB.md"
coding-workflow project-kb --repo "$TARGET_REPO" --validate
```

`scripts/project-kb` compiles deterministic source-only handoff context from repo-map, docs-list, package, route, skill, and control-doc metadata. It must not read `.env` values, raw sessions, private corpus output, install dependencies, run target build/test commands, call services, mutate git, publish, deploy, push, tag, or prove runtime behaviour.

## Migration Review

```bash
./scripts/migration-review --repo "$TARGET_REPO"
./scripts/migration-review --repo "$TARGET_REPO" --json
./scripts/migration-review --repo "$TARGET_REPO" --validate
./scripts/migration-review --repo "$TARGET_REPO" --migrations-dir supabase/migrations
./scripts/migration-review --repo "$TARGET_REPO" --fail-on-high-risk
coding-workflow migration-review --repo "$TARGET_REPO" --validate
```

`scripts/migration-review` is source-only SQL migration risk classification. It detects common migration directories, destructive statements, RLS/policy changes, grants/revokes, functions, triggers, extension changes, pg_cron/pg_net, Vault references, data mutation, rollback gaps, ordering warnings, and secret-shaped material by category only. It must not connect to a database, run Supabase CLI, execute SQL, apply migrations, read `.env` values, print secrets, mutate files, stage, commit, publish, deploy, push, tag, or prove deployed database state.

Manual follow-up after reading the map:

```bash
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" status -sb
rg --files "$TARGET_REPO"
find "$TARGET_REPO" -maxdepth 3 -type f
```

## Orchestrator Local Repo Gate

```bash
pwd
ls -la "$TARGET_REPO"
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" diff --stat
git -C "$TARGET_REPO" remote -v
git -C "$TARGET_REPO" log --oneline -5
```

Only run the remote and log checks when remote/GitHub work is in scope. Treat any no-git result as evidence, not as permission to invent git state.

## Missing Files

```bash
ls MEMORY.md
find . -maxdepth 3 -iname 'runbook*' -ls
find . -maxdepth 4 -type f -iname 'watchlist*' -ls
grep -RIl "watchlist" -n . || true
```

## Session Logs

```bash
find agents/main/sessions -maxdepth 1 -type f -name '*.jsonl*' -printf '%f %s bytes\n'
find agents/researcher/sessions -maxdepth 1 -type f -name '*.jsonl*' -printf '%f %s bytes\n'
rg -n "command|cmd|exec|tool|npm|git|gh|wrangler|curl|Supabase|Cloudflare|deploy|build|test|lint|typecheck|publish|release|evidence" agents/main/sessions/*.jsonl -S
```

## Tool Availability

```bash
jq --version
which node && node -v && which curl && curl --version | head -n 2
python - <<'PY'
import sys, pkgutil
print('yfinance', bool(pkgutil.find_loader('yfinance')))
PY
```

## SOPS + age Secret Access

Use the library adapter instead of direct decryption:

```bash
./scripts/sops-age-secret-access status --validate
./scripts/sops-age-secret-access validate-file \
  --file /private/path/runtime.enc.env \
  --validate
./scripts/sops-age-secret-access run \
  --file /private/path/runtime.enc.env \
  --dry-run \
  -- command arg
coding-workflow sops-age status --validate
```

One real injection is separate and explicit:

```bash
./scripts/sops-age-secret-access run \
  --file /private/path/runtime.enc.env \
  --allow-secret-access \
  -- command arg
```

The selected file must already be SOPS-encrypted for an age recipient. The helper never echoes decrypted values, private identities, provider output, or child output. Do not use `sops decrypt`, `exec-file`, `edit`, `set`, `unset`, `publish`, `rotate`, `updatekeys`, or `--ignore-mac` as a substitute. Injection does not grant the child command any other consequence authority.

## Git Verification

```bash
git status --short
git status -sb
git diff --check
```

## Local Evidence Pack

```bash
./scripts/evidence-pack --repo "$TARGET_REPO" --title "Short title" --dry-run
./scripts/evidence-pack --repo "$TARGET_REPO" --title "Short title"
```

Dry-run is read-only. Writing an evidence pack is local-edit only and must not stage or commit the generated files.

## NPM Package Readiness

```bash
./scripts/npm-package-readiness --repo "$TARGET_REPO"
./scripts/npm-package-readiness --repo "$TARGET_REPO" --json
./scripts/npm-package-readiness --repo "$TARGET_REPO" --allow-pack-dry-run
./scripts/npm-package-readiness --repo "$TARGET_REPO" --expect-package --expect-cli --allow-pack-dry-run
```

Default mode does not run `npm pack`. `--allow-pack-dry-run` is not permission to publish, change versions, install dependencies, mutate registries, tag, push, or create releases.

## Release Preflight

```bash
./scripts/release-preflight --repo "$TARGET_REPO"
./scripts/release-preflight --repo "$TARGET_REPO" --allow-pack-dry-run
./scripts/release-preflight --repo "$TARGET_REPO" --mode cli --allow-pack-dry-run
```

Release preflight is local only. It does not publish, tag, push, deploy, create GitHub releases, mutate registries, set secrets, or call production endpoints.

## Local CLI Entrypoint

`coding-workflow` is the candidate package CLI. The source wrapper lives at `bin/coding-workflow.js` and delegates to local scripts instead of duplicating workflow logic.

```bash
./bin/coding-workflow.js --help
./bin/coding-workflow.js routes
./bin/coding-workflow.js validate
./bin/coding-workflow.js cleaner
./bin/coding-workflow.js package-readiness --repo /path/to/repo --expect-package --expect-cli
./bin/coding-workflow.js release-preflight --repo /path/to/repo --mode local
./bin/coding-workflow.js run-next --repo /path/to/repo --dry-run --allow cli-package-smoke
```

The CLI must not bypass `scripts/run-next` permission gates. It is a local/package-candidate wrapper only; it is not publish, version, tag, push, deploy, registry, secret, Supabase, Cloudflare, production-endpoint, or remote-service permission.

## Skills Library Packaging Readiness

```bash
./scripts/library-packaging-readiness --repo <LIBRARY_REPO>
./scripts/library-packaging-readiness --repo <LIBRARY_REPO> --json
./scripts/library-packaging-readiness --repo <LIBRARY_REPO> --expect-open-source
./scripts/library-packaging-readiness --repo <LIBRARY_REPO> --expect-npm
./scripts/library-packaging-readiness --repo <LIBRARY_REPO> --expect-cli
```

Packaging readiness is local only. It does not publish, install dependencies, tag, push, create releases, deploy, set/read secrets, call registries, or call production endpoints. Missing `package.json` is acceptable unless npm or CLI packaging is explicitly expected. `--expect-open-source` classifies license/changelog blockers without choosing a license or granting release permission.

## Exact-File Git Safety

Use exact paths only. Do not run `git add .`. Prefer `scripts/committer` after `github-handoff-skill` is selected and local commit preparation is approved.

Dry-run and no-commit examples for `<TARGET_REPO>`:

```bash
./scripts/committer --repo <TARGET_REPO> --message "Harden import reddit tips authorization" --files supabase/functions/import-reddit-tips/index.ts .env.example docs/import-reddit-tips-security.md --dry-run
./scripts/committer --repo <TARGET_REPO> --message "Harden import reddit tips authorization" --files supabase/functions/import-reddit-tips/index.ts .env.example docs/import-reddit-tips-security.md --no-commit
```

General helper templates:

```bash
./scripts/committer --repo "$TARGET_REPO" --message "Describe the exact scoped change" --files path/to/file --dry-run
./scripts/committer --repo "$TARGET_REPO" --message "Describe the exact scoped change" --files path/to/file --no-commit
./scripts/committer --repo "$TARGET_REPO" --message "Describe the exact scoped change" --files path/to/file
./scripts/committer --self-test
```

`scripts/committer` secret scanning blocks hardcoded secret-shaped literal values. Runtime secret access such as `Deno.env.get(...)`, `process.env.NAME`, `import.meta.env.NAME`, and header reads are reported as safe notes instead of fatal findings.

Pre-commit gate for this library:

```bash
./scripts/pre-commit-check
./scripts/pre-commit-check --staged
./scripts/pre-commit-check --full
./scripts/pre-commit-check --json
./scripts/install-git-hooks --dry-run
```

`scripts/pre-commit-check --staged` reports staged secret-shaped additions by file and category without printing values. `scripts/install-git-hooks` installs only the managed `.git/hooks/pre-commit` template and refuses unmanaged hook overwrites unless `--force` is explicit.

Fallback raw Git commands if `scripts/committer` is unavailable:

```bash
git status --short
git diff -- path/to/file
git diff --check
git add -- path/to/file
git commit -m "Describe the exact scoped change"
```

For a multi-file commit, stage every file explicitly:

```bash
git add -- path/to/file-one path/to/file-two path/to/file-three
git status --short
git diff --cached --stat
git commit -m "Describe the exact scoped change"
```

Do not commit, push, open a PR, tag, release, or merge without the matching permission gate.

Identity commands suggested by git, approval required:

```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

## Autonomous Work-Loop Runner

Use `scripts/run-next` to continue from `work-ledger.md` without manually pasting the next prompt. It only acts when the needed permission gate is supplied with `--allow`.

```bash
cd <LIBRARY_REPO>
./scripts/run-next
./scripts/run-next --dry-run
./scripts/run-next --list-routes
./scripts/run-next --repo <TARGET_REPO>
./scripts/run-next --repo <TARGET_REPO> --allow github-handoff
./scripts/run-next --repo <TARGET_REPO> --allow github-handoff --dry-run
./scripts/run-next --repo <TARGET_REPO> --allow pr-readiness
./scripts/run-next --repo <TARGET_REPO> --allow pr-readiness --dry-run
./scripts/run-next --repo <TARGET_REPO> --allow pr-merge
./scripts/run-next --repo <TARGET_REPO> --allow pr-merge --dry-run
./scripts/run-next --repo <TARGET_REPO> --allow deployment-plan
./scripts/run-next --repo <TARGET_REPO> --allow deployment-plan --dry-run
./scripts/run-next --repo <TARGET_REPO> --allow supabase-preflight
./scripts/run-next --repo <TARGET_REPO> --allow supabase-preflight --dry-run
./scripts/run-next --repo <TARGET_REPO> --allow supabase-tooling-auth
./scripts/run-next --repo <TARGET_REPO> --allow supabase-tooling-auth --dry-run
./scripts/run-next --repo <TARGET_REPO> --allow supabase-link-secret-readiness
./scripts/run-next --repo <TARGET_REPO> --allow supabase-link-secret-readiness --dry-run
./scripts/run-next --repo <LIBRARY_REPO> --allow verification-bundle-self-test
./scripts/run-next --repo <LIBRARY_REPO> --allow verification-bundle-self-test --dry-run
./scripts/run-next --repo <LIBRARY_REPO> --allow verification-bundle-self-test --allow evidence-pack-write
./scripts/run-next --repo <LIBRARY_REPO> --allow cloudflare-opstruth-packaging-bundle
./scripts/run-next --repo <LIBRARY_REPO> --allow cloudflare-opstruth-packaging-bundle --dry-run
./scripts/run-next --repo <LIBRARY_REPO> --allow clean-temp-readiness-smoke
./scripts/run-next --repo <LIBRARY_REPO> --allow clean-temp-readiness-smoke --dry-run
./scripts/run-next --repo <LIBRARY_REPO> --allow license-package-candidate
./scripts/run-next --repo <LIBRARY_REPO> --allow license-package-candidate --dry-run
./scripts/run-next --repo <LIBRARY_REPO> --allow package-candidate-dry-run
./scripts/run-next --repo <LIBRARY_REPO> --allow package-candidate-dry-run --dry-run
./scripts/run-next --repo <LIBRARY_REPO> --allow cli-package-smoke
./scripts/run-next --repo <LIBRARY_REPO> --allow cli-package-smoke --dry-run
```

## Route Metadata Audit

Route metadata is local-only validation. These commands do not execute route helpers, call external services, deploy, push, publish, set secrets, run SQL, or update the ledger.

```bash
cd <LIBRARY_REPO>
./scripts/run-next --list-routes
./scripts/route-audit
./scripts/route-audit --json
```

Supported permission flags:

```bash
./scripts/run-next --allow auth-check
./scripts/run-next --allow github-handoff
./scripts/run-next --allow push-pr
./scripts/run-next --allow local-validation
./scripts/run-next --allow local-edit
./scripts/run-next --allow commit
./scripts/run-next --allow pr-readiness
./scripts/run-next --allow pr-merge
./scripts/run-next --allow deployment-plan
./scripts/run-next --allow supabase-preflight
./scripts/run-next --allow supabase-tooling-auth
./scripts/run-next --allow supabase-link-secret-readiness
./scripts/run-next --allow scheduler-draft-pr
./scripts/run-next --allow scheduler-pr-merge
./scripts/run-next --allow supabase-secret-function-deploy
./scripts/run-next --allow runtime-negative-verification
./scripts/run-next --allow function-secret-deploy-negative-runtime
./scripts/run-next --allow controlled-success-invocation
./scripts/run-next --allow scheduled-run-monitoring-handoff
./scripts/run-next --allow scheduler-application-decision
./scripts/run-next --allow scheduler-vault-design-apply
./scripts/run-next --allow scheduler-vault-apply-retry
./scripts/run-next --allow verification-bundle-self-test
./scripts/run-next --allow local-skill-workpack
./scripts/run-next --allow evidence-pack-write
./scripts/run-next --allow cloudflare-opstruth-packaging-bundle
./scripts/run-next --allow clean-temp-readiness-smoke
./scripts/run-next --allow license-package-candidate
./scripts/run-next --allow package-candidate-dry-run
./scripts/run-next --allow cli-package-smoke
```

Current first automated path:

```bash
./scripts/run-next --repo <TARGET_REPO> --allow github-handoff
```

The runner uses supported GitHub CLI forms for this installed version:

```bash
gh repo view AyobamiH/wagging-web-wins --json nameWithOwner,visibility,viewerPermission
gh pr create --repo AyobamiH/wagging-web-wins --base main --head harden-import-reddit-tips-auth --title "Harden import reddit tips authorization" --body-file /tmp/import-reddit-tips-pr-body.md
gh pr view --repo AyobamiH/wagging-web-wins harden-import-reddit-tips-auth --json url,title,state,headRefName,baseRefName
gh pr view --repo AyobamiH/wagging-web-wins 11 --json url,title,state,headRefName,baseRefName,mergeable,reviewDecision,files,commits
gh pr checks --repo AyobamiH/wagging-web-wins 11 || true
gh pr merge --repo AyobamiH/wagging-web-wins 11 --merge
```

Do not use the unsupported `gh -R ... repo view` form in this environment.

`PR opened, not merged` routes to PR readiness inspection with `--allow pr-readiness` or `--allow github-handoff`. The runner must stop before merge and record one of the PR readiness statuses in the ledger.

`PR ready for merge approval` routes to PR #11 merge handoff with `--allow pr-merge`. The runner must check repo-local workflow deployment evidence before merging:

```bash
find <TARGET_REPO>/.github/workflows -maxdepth 1 -type f -print 2>/dev/null || true
grep -RniE "deploy|supabase|cloudflare|wrangler|pages|production|secrets" <TARGET_REPO>/.github/workflows 2>/dev/null || true
```

If a workflow clearly indicates merging `main` may deploy, the runner must stop with `NEEDS JOHN: merge may trigger deployment`. If the merge succeeds, record `Merged, not deployed` and do not run deployment planning in the same loop.

`Merged, not deployed` routes to source-only deployment planning with `--allow deployment-plan`. It inspects repo state, Supabase source/config, docs/migrations, package scripts, and local CLI availability, then records `Deployment plan ready, not deployed`.

`Local verification and release evidence bundle built` routes to local verification bundle self-test with `--allow verification-bundle-self-test`. It runs package readiness, release preflight, evidence-pack dry-run, helper syntax checks, skill cleanup, and skill validation, then records `Verification bundle self-test complete` if safe. Add `--allow evidence-pack-write` only when John separately approves local `evidence/` file creation; this flag is not staging, commit, publish, tag, push, PR, deploy, registry, secret, or external-service permission.

`Clean-temp readiness smoke complete` routes to MIT licence and package candidate verification with `--allow license-package-candidate`. It verifies `LICENSE`, `LICENSE-DECISION.md`, `package.json`, open-source readiness, npm package readiness, and release preflight local mode, then records `MIT licence and package candidate scaffold complete` if safe. This flag is not publish, version, pack, tag, push, PR, GitHub release, deploy, registry, secret, external-service, product-repo, or production-endpoint permission.

`MIT licence and package candidate scaffold complete` routes to package candidate dry-run with `--allow package-candidate-dry-run`. It verifies candidate package identity `autonomous-coding-workflow-library`, repository identity `AyobamiH/coding-workflow-library`, MIT metadata, no CLI `bin`, package readiness, release preflight npm mode, `npm pack --dry-run`, package contents, clean-temp package smoke, route audit, and validation, then records `Package candidate dry-run complete` if safe. This flag is not publish, version, tag, push, PR, GitHub release, deploy, registry mutation, secret, external-service, product-repo, production-endpoint, or CLI-entrypoint permission.

`Package candidate dry-run complete` routes to CLI entrypoint package smoke with `--allow cli-package-smoke`. It verifies `coding-workflow` package `bin` metadata, local CLI help/routes/package-readiness/release-preflight behavior, package readiness with `--expect-cli`, release preflight CLI mode, `npm pack --dry-run`, clean-temp local tarball install, installed CLI help/routes/validate behavior, route audit, cleanup, and validation, then records `CLI entrypoint package smoke complete` if safe. This flag is not publish, version, tag, push, PR, GitHub release, deploy, registry mutation, secret, external-service, product-repo, production-endpoint, remote dependency install, or remote mutation permission.

`GitHub open-source handoff complete` routes to first version tag work with `--allow first-version-tag`. It verifies package/lockfile version `0.1.0`, changelog, release notes, local validation, clean-temp package smoke, exact release commit, non-force `main` push, GitHub Actions success for that exact commit, annotated tag `v0.1.0`, remote tag dereference, and post-tag bookkeeping. This flag is not npm publish, `npm version`, GitHub release, deploy, Supabase, Cloudflare, production endpoint, secret, force-push, history rewrite, broad staging, or excluded-file staging permission.

Read-only planning commands:

```bash
git -C <TARGET_REPO> status --short
git -C <TARGET_REPO> branch --show-current
git -C <TARGET_REPO> log --oneline -5
git -C <TARGET_REPO> remote -v
git -C <TARGET_REPO> show --stat --name-only 271414a
find <TARGET_REPO>/supabase -maxdepth 4 -type f | sort
find <TARGET_REPO>/.github/workflows -maxdepth 1 -type f -print 2>/dev/null || true
find <TARGET_REPO> -maxdepth 2 -type f \( -name "wrangler.toml" -o -name "wrangler.jsonc" -o -name "netlify.toml" -o -name "vercel.json" -o -name "package.json" \) -print | sort
grep -RniE "import-reddit-tips|cron|schedule|pg_cron|net.http|x-import-reddit-tips-secret|IMPORT_REDDIT_TIPS_SECRET|verify_jwt|service_role|SUPABASE_SERVICE_ROLE_KEY" <TARGET_REPO>/supabase <TARGET_REPO>/docs 2>/dev/null || true
command -v supabase || true
command -v npx || true
command -v npm || true
command -v node || true
command -v gh || true
```

Commands drafted during planning are not permission to run them:

```bash
supabase secrets set IMPORT_REDDIT_TIPS_SECRET=<redacted>
supabase functions deploy import-reddit-tips
```

Never run Supabase deploy, secrets, db push, db pull, migration, function invoke, scheduler mutation, production curl, push, PR, or merge from deployment planning mode.

`Deployment plan ready, not deployed` routes to Supabase execution preflight with `--allow supabase-preflight`. It inspects source/local execution prerequisites only, drafts the exact sequence, and records `Supabase execution preflight ready, not executed`.

Read-only preflight commands:

```bash
git -C <TARGET_REPO> status --short
git -C <TARGET_REPO> branch --show-current
git -C <TARGET_REPO> log --oneline -8
git -C <TARGET_REPO> remote -v
find <TARGET_REPO>/supabase -maxdepth 5 -type f | sort
sed -n '1,240p' <TARGET_REPO>/supabase/config.toml 2>/dev/null || true
sed -n '1,260p' <TARGET_REPO>/supabase/functions/import-reddit-tips/index.ts 2>/dev/null || true
sed -n '260,560p' <TARGET_REPO>/supabase/functions/import-reddit-tips/index.ts 2>/dev/null || true
grep -RniE "import-reddit-tips|cron\.schedule|cron\.unschedule|cron\.alter_job|pg_cron|net\.http_post|http_post|x-import-reddit-tips-secret|apikey|Authorization|Bearer|IMPORT_REDDIT_TIPS_SECRET" <TARGET_REPO>/supabase/migrations <TARGET_REPO>/docs 2>/dev/null || true
find <TARGET_REPO> -maxdepth 3 -type f \( -name ".env.example" -o -name "*.example" -o -name "*.md" \) -print | sort
grep -RniE "SUPABASE_ACCESS_TOKEN|SUPABASE_PROJECT_REF|IMPORT_REDDIT_TIPS_SECRET|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY" <TARGET_REPO>/.env.example <TARGET_REPO>/docs 2>/dev/null || true
command -v supabase || true
command -v npx || true
command -v npm || true
command -v node || true
```

Commands drafted during preflight are not permission to run them:

```bash
supabase --version
supabase login
supabase link --project-ref <project-ref>
supabase secrets set IMPORT_REDDIT_TIPS_SECRET=<redacted>
supabase functions deploy import-reddit-tips
select cron.unschedule('<existing-job-name>');
select cron.schedule(... net.http_post(... headers including x-import-reddit-tips-secret ...));
```

Never install Supabase CLI, run `npx supabase`, run `supabase login`, link, set secrets, deploy, run migrations, execute SQL, mutate scheduler jobs, call runtime endpoints, push, create PRs, or merge from Supabase execution preflight mode.

`Supabase execution preflight ready, not executed` routes to Supabase tooling/auth setup with `--allow supabase-tooling-auth`. It verifies local tooling and read-only project access, then records either a credential/tooling boundary or `Supabase tooling/auth ready, not linked`.

Tooling/auth commands:

```bash
git -C <TARGET_REPO> status --short
git -C <TARGET_REPO> branch --show-current
git -C <TARGET_REPO> log --oneline -8
node --version || true
npm --version || true
npx --version || true
command -v supabase || true
command -v npx || true
npx supabase --version
```

Safe local env shape check, values must be redacted:

```bash
test -f <LOCAL_ENV_FILE> && grep -En '^(SUPABASE_ACCESS_TOKEN|SUPABASE_PROJECT_REF|IMPORT_REDDIT_TIPS_SECRET)=' <LOCAL_ENV_FILE> | sed -E 's/=.*/=<redacted>/' || true
```

Read-only Supabase project access, only when `SUPABASE_ACCESS_TOKEN` is set and `npx supabase --version` passes:

```bash
SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" npx supabase projects list
```

Do not run `supabase login`, `npx supabase login`, `supabase link`, `npx supabase link`, `supabase secrets set`, `supabase functions deploy`, `supabase db push`, migrations, SQL, scheduler mutation, Edge Function invoke, production endpoint calls, push, PR, or merge from tooling/auth mode.

`Supabase tooling/auth ready, not linked` routes to Supabase link/local secret readiness with `--allow supabase-link-secret-readiness`. It may link the local repo and ensure the local scheduler secret exists only in `<LOCAL_ENV_FILE>`.

Link/local secret readiness commands:

```bash
git -C <TARGET_REPO> status --short
git -C <TARGET_REPO> branch --show-current
git -C <TARGET_REPO> log --oneline -8
cd <TARGET_REPO>
npx supabase --version
SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" npx supabase projects list
SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" npx supabase link --project-ref viwxxjnehceedyctevau
find <TARGET_REPO>/supabase -maxdepth 3 -type f | sort
```

If `IMPORT_REDDIT_TIPS_SECRET` is missing, the runner may generate and store it locally without printing it:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Do not print the generated secret. Do not write it to `<TARGET_REPO>`. Do not run remote `supabase secrets set`, deploy, db push, migrations, SQL, scheduler mutation, Edge Function invoke, production endpoint calls, push, PR, or merge from link/local secret readiness mode.

## GitHub Auth Gate

Use these commands when GitHub handoff is blocked by `gh` authentication. Do not print token values.

```bash
command -v gh || true
gh auth status || true
gh auth status --hostname github.com || true
gh auth status --show-token-scopes || true
git -C "$TARGET_REPO" remote -v
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" status --short
test -n "$GH_TOKEN" && echo "GH_TOKEN is set" || echo "GH_TOKEN is not set"
test -n "$GITHUB_TOKEN" && echo "GITHUB_TOKEN is set" || echo "GITHUB_TOKEN is not set"
```

Account switching, only when account switching is authorized and the expected account is already authenticated locally:

```bash
gh auth switch --hostname github.com --user "$EXPECTED_OWNER"
```

Manual provisioning commands for John to run outside chat on the local machine:

```bash
gh auth login -h github.com
read -s GH_TOKEN
export GH_TOKEN
gh auth status
unset GH_TOKEN
read -s GH_TOKEN
echo "$GH_TOKEN" | gh auth login --with-token
unset GH_TOKEN
```

Never ask John to paste a GitHub token into chat. Treat `GH_TOKEN` and `GITHUB_TOKEN` as runtime environment auth only, never as repo content.

## OpenClaw Config Diff

```bash
cd <OPENCLAW_HOME> && ls -l --full-time openclaw.json*
cd <OPENCLAW_HOME> && diff -u openclaw.json.bak.4 openclaw.json
cd <OPENCLAW_HOME> && diff -u openclaw.json.bak.3 openclaw.json.bak.2
cd <OPENCLAW_HOME> && diff -u openclaw.json.bak.2 openclaw.json.bak.1
cd <OPENCLAW_HOME> && diff -u openclaw.json.bak.1 openclaw.json
cd <OPENCLAW_HOME> && diff -u openclaw.json.bak openclaw.json
cd <OPENCLAW_HOME> && diff -u -w openclaw.json.bak openclaw.json
```

Rollback commands, approval required:

```bash
cd <OPENCLAW_HOME>
cp openclaw.json.bak.N openclaw.json
openclaw gateway restart
```

## OpenClaw Route Trace

```bash
cd <OPENCLAW_HOME> && grep -R "allowAgents" -n
cd <OPENCLAW_INSTALL_ROOT> && rg -n "allowAgents"
cd <OPENCLAW_INSTALL_ROOT> && grep -R "allowAgents" -n docs
cd <OPENCLAW_WORKSPACE> && openclaw config --help
cd <OPENCLAW_WORKSPACE> && openclaw gateway --help
cd <OPENCLAW_WORKSPACE> && openclaw gateway config --help
cd <OPENCLAW_WORKSPACE> && openclaw subagents list
cd <OPENCLAW_WORKSPACE> && openclaw config patch '{"agents":{"list":[{"id":"main","subagents":{"allowAgents":["researcher","trader","banker","executioner"]}}]}}'
```

## Host And Security Audit

```bash
cd <OPENCLAW_WORKSPACE> && uname -a
cd <OPENCLAW_WORKSPACE> && cat /etc/os-release
cd <OPENCLAW_WORKSPACE> && ss -ltnup
cd <OPENCLAW_WORKSPACE> && ufw status
cd <OPENCLAW_WORKSPACE> && openclaw security audit --deep
cd <OPENCLAW_WORKSPACE> && openclaw update status
```

Windows evidence to request:

```bash
manage-bde -status
netsh advfirewall show allprofiles
```

Approval-required hardening suggestions:

```bash
netsh advfirewall set currentprofile state on
netsh advfirewall export
openclaw security audit --fix
vault secrets enable pki
```

## Public Market Data

```bash
cd <OPENCLAW_WORKSPACE> && curl -s 'https://finviz.com/screener.ashx?v=111&f=sh_avgvol_o1000,sh_price_o5,sh_price_u150,ta_pattern_cta&ft=4'
cd <OPENCLAW_WORKSPACE> && curl -s 'https://finviz.com/screener.ashx?v=111&o=-change&f=sh_avgvol_o1000,sh_price_o5,sh_price_u150,ta_pattern_flag,ta_sma20_pa,ta_sma50_pa'
cd <RESEARCH_WORKSPACE> && curl -s 'https://finviz.com/screener.ashx?v=111&f=sh_price_o5,sh_price_u150,sh_avgvol_o1000,sh_relvol_o1.5,ta_perf_dup,exch_nyse,exch_nasdaq'
```

## Image Asset Generation

```bash
cd <OPENCLAW_WORKSPACE> && mkdir -p avatars
cd <OPENCLAW_WORKSPACE> && python3 <OPENCLAW_INSTALL_ROOT>/skills/openai-image-gen/scripts/gen.py --model gpt-image-1 --count 1 --size 1024x1024 --quality high --prompt "Minimalist atlas compass emblem for an AI orchestrator named Boltsie: a stylized compass rose etched into brushed steel with subtle grooves, cool cyan highlights around the points, dark graphite background, flat icon aesthetic, high contrast, no text" --out-dir avatars
cd <OPENCLAW_WORKSPACE>/avatars && ls
cd <OPENCLAW_WORKSPACE>/avatars && cp 001-minimalist-atlas-compass-emblem-for-an-a.png atlas.png
```

## Discovery For Unconfirmed Cloudflare/Supabase/Migration Work

```bash
rg -n "Supabase|supabase|Cloudflare|cloudflare|wrangler|npm publish|npm run|git diff|git status|gh |curl |API|migration|RLS|rls|deploy|build|typecheck|lint|test" . --glob '!credentials/**' --glob '!memory/**' --glob '!workspace/avatars/*.png' --glob '!**/*.png' -S
rg -n "create policy|alter table|enable row level security|auth.uid|service_role|anon|authenticated|security definer" . -S
find . -maxdepth 5 -type f -iname '*migration*' -o -iname '*.sql'
```

## Library Validation Placeholders

Run from the library root after local skill-library edits:

```bash
cd <LIBRARY_REPO>
cat tools.md
./scripts/skill-cleaner
./scripts/skill-cleaner --json
./scripts/validate-skills
find . -maxdepth 3 -type f | sort
grep -n "AGENTS.md" README.md RUNBOOK.md skills-index.md build-queue.md command-library.md tool-patterns.md evidence-checklist.md
grep -R "TODO|TBD|lorem|changeme" . || true
grep -R "sk-[A-Za-z0-9]|BEGIN RSA|BEGIN OPENSSH|PRIVATE KEY" . || true
```

Prefer `./scripts/validate-skills` over manual grep checks. Manual grep commands are fallback evidence and may have noisy self-hits.

Use `./scripts/skill-cleaner` for advisory cleanup intelligence. It does not replace validation and must not be treated as permission to merge, deprecate, delete, or rename skills.

Treat validation matches as evidence to classify. Do not print secret values if a real secret-shaped value appears.

## Tool Catalogue Commands

```bash
cd <LIBRARY_REPO>
cat tools.md
./scripts/validate-skills
./scripts/skill-cleaner
```

Use `tools.md` to classify permission level before running tool-heavy commands.

## Local Verification And Release Helpers

```bash
cd <LIBRARY_REPO>
./scripts/npm-package-readiness --repo "$TARGET_REPO"
./scripts/npm-package-readiness --repo "$TARGET_REPO" --expect-package
./scripts/npm-package-readiness --repo "$TARGET_REPO" --expect-cli
./scripts/npm-package-readiness --repo "$TARGET_REPO" --allow-pack-dry-run
./scripts/npm-package-readiness --repo "$TARGET_REPO" --json
./scripts/release-preflight --repo "$TARGET_REPO" --mode local
./scripts/release-preflight --repo "$TARGET_REPO" --mode npm
./scripts/release-preflight --repo "$TARGET_REPO" --mode cli
./scripts/release-preflight --repo "$TARGET_REPO" --mode npm --allow-pack-dry-run
```

`--mode local` is not npm package release permission. `--allow-pack-dry-run` is not publish permission.

## Failure Evidence Helper

```bash
cd <LIBRARY_REPO>
./scripts/failure-evidence --input /path/to/log.txt
cat /path/to/log.txt | ./scripts/failure-evidence --stdin
```

The helper redacts secret-shaped values and classifies missing/invalid credentials, network errors, direct-host versus pooler mistakes, CLI unavailability, auth failures, permission denials, merge blockers, validation failures, unsafe secret exposure risk, unapproved external mutation, and env format issues.

## Local Skill Workpack Route

```bash
cd <LIBRARY_REPO>
./scripts/run-next --dry-run --repo <LIBRARY_REPO> --allow local-skill-workpack --allow evidence-pack-write
./scripts/run-next --repo <LIBRARY_REPO> --allow local-skill-workpack --allow evidence-pack-write
```

This route is local skills-library work only. It is not product repo, publish, tag, push, PR, deploy, Supabase, Cloudflare, secret-read, external mutation, or production endpoint permission.

## Downstream AGENTS Pointer

Check whether a repo has a local pointer:

```bash
test -f "$TARGET_REPO/AGENTS.md"
grep -n "coding-workflow-library/AGENTS.md" "$TARGET_REPO/AGENTS.md"
```

Create one only when local edits are authorized for that repo:

```bash
cp templates/repo-agents-pointer-template.md "$TARGET_REPO/AGENTS.md"
```

## Project-Scoped Lane State

```bash
./scripts/lane-state --state-file "$STATE_FILE" list
./scripts/lane-state --state-file "$STATE_FILE" show "$LANE_ID"
./scripts/run-next --list-lanes --state-file "$STATE_FILE"
./scripts/run-next --lane "$LANE_ID" --state-file "$STATE_FILE" --explain-next
./scripts/run-next --lane "$LANE_ID" --state-file "$STATE_FILE" --dry-run --allow "$PERMISSION"
```

Lane commands are local state operations. They do not grant permission for the selected route and must not be used with state files containing secrets.

## Zero-Output Pipeline Investigation

```bash
./scripts/pipeline-diagnostics --source "$PIPELINE_SOURCE"
./scripts/pipeline-diagnostics --source "$PIPELINE_SOURCE" --json
./scripts/run-next --lane "$LANE_ID" --state-file "$STATE_FILE" --repo "$TARGET_REPO" --dry-run --allow zero-output-investigation
./scripts/run-next --lane "$LANE_ID" --state-file "$STATE_FILE" --repo "$TARGET_REPO" --allow zero-output-investigation
./scripts/run-next --lane "$LANE_ID" --state-file "$STATE_FILE" --repo "$TARGET_REPO" --dry-run --allow zero-output-observability-patch
./scripts/run-next --lane "$LANE_ID" --state-file "$STATE_FILE" --repo "$TARGET_REPO" --allow zero-output-observability-patch
./scripts/run-next --lane "$LANE_ID" --state-file "$STATE_FILE" --repo "$TARGET_REPO" --dry-run --allow observability-run-recheck
```

The real investigation route may use only approved read-only metadata. The observability preparation route may validate a local count-only patch, but it is still not permission to invoke the pipeline, fetch its upstream source, write SQL, deploy, merge, or commit product changes outside the separately approved GitHub handoff gate.
# GitHub Open-Source Handoff Commands

Use only after John grants `github-open-source-handoff`.

```bash
npm test
node scripts/route-audit
node scripts/npm-package-readiness --repo . --expect-package --expect-cli --allow-pack-dry-run
node scripts/release-preflight --repo . --mode cli --allow-pack-dry-run
npm pack --dry-run --json --cache <TEMP_ROOT>/npm-cache

gh auth status
gh api user --jq .login
gh repo view AyobamiH/coding-workflow-library --json nameWithOwner,visibility,url,defaultBranchRef

git status --short
git diff --cached --stat
git diff --cached --check
git push -u origin main
git ls-remote origin refs/heads/main
```

Never use `git add .`, `git add -A`, `npm publish`, `npm version`, `git tag`, GitHub releases, deploy commands, Supabase commands, Cloudflare commands, or production endpoint calls in this route.
