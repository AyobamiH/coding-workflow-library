# tools.md

## Purpose

This is the local tool catalogue for the coding workflow orchestrator and skills.

Use it to decide what tools exist locally, when a tool is appropriate, which authority class or safety gate it belongs to, what evidence must be collected, and which actions require objective-level approval.

This file does not grant permission. It classifies tools. `AGENTS.md` remains the hard-rule layer, and individual skills provide task-specific procedures.

## Tool Permission Model

The system requests authority for consequences, not permission for every tool call.

Tool permission levels remain useful for classification, but execution is governed by the selected lane objective:

- safe local reads, edits, validation, package dry-runs, and exact-file local commits normally run under `local_execution`;
- git push, PR mutation, merge, tag push, GitHub Release, and npm publish require `remote_publication`;
- deploys, SQL writes, migrations, scheduler/Vault mutation, app-data writes, and production success calls require `production_mutation`;
- setting or rotating external secrets requires `secret_mutation`;
- force, history rewrite, deletion, and teardown require `destructive_action`.

Unavailable tools, credentials, binaries, env vars, or network access are `BLOCKED_CAPABILITY`. Failed tests, unsafe files, secret-scan findings, or repo drift are `BLOCKED_SAFETY`.

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

- The orchestrator must not cross objective authority classes without an active grant.
- Read-only local tools are allowed during repo mapping and source-only audits.
- Cloud, database, secret, deploy, and destructive consequences require the matching objective authority.
- If a tool is unavailable or auth is missing, record `BLOCKED_CAPABILITY` and continue independent authorised work.
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

#### scripts/evidence-pack

Purpose: generate a local redacted evidence-pack directory from safe local inputs.

Default permission: `read-only-local` for `--dry-run`; `local-edit` when writing evidence files.

Examples:

```bash
./scripts/evidence-pack --repo "$TARGET_REPO" --title "Short title" --dry-run
./scripts/evidence-pack --repo "$TARGET_REPO" --title "Short title"
```

Rules:

- Writes under the target repo's `evidence/` folder by default.
- Never stages, commits, pushes, deploys, publishes, mutates databases, sets secrets, or calls production endpoints.
- Never reads `.env` files.
- Redacts obvious token, credential, JWT, and database URL shapes from captured output.
- If the target is not a Git repo, it records that as evidence rather than failing the whole report.

Evidence required:

- Target repo.
- Output directory or dry-run plan.
- Git status or no-git warning.
- Diff stat or no-git warning.
- Validation output or explicit not-run note.
- Next safe step.

#### scripts/npm-package-readiness

Purpose: inspect local npm package and CLI readiness without publishing.

Default permission: `read-only-local`; `local-validation` when `--allow-pack-dry-run` is supplied.

Examples:

```bash
./scripts/npm-package-readiness --repo "$TARGET_REPO"
./scripts/npm-package-readiness --repo "$TARGET_REPO" --json
./scripts/npm-package-readiness --repo "$TARGET_REPO" --allow-pack-dry-run
```

Rules:

- Default mode must not run `npm pack`.
- `--allow-pack-dry-run` is not publish permission.
- Never runs `npm publish`, changes versions, installs dependencies, mutates registries, reads `.npmrc` token values, tags, pushes, or creates releases.

Evidence required:

- Package metadata checks.
- Bin entrypoint checks.
- Lockfile result.
- Package contents control result.
- README and release-note result.
- Script inventory.
- Pack dry-run status when allowed.
- Final classification and next safe step.

#### scripts/release-preflight

Purpose: combine local Git state, package readiness, evidence-pack planning, docs/release-note checks, and explicit release boundaries.

Default permission: `read-only-local` plus `local-validation` for local helper execution.

Examples:

```bash
./scripts/release-preflight --repo "$TARGET_REPO"
./scripts/release-preflight --repo "$TARGET_REPO" --allow-pack-dry-run
```

Rules:

- Never publishes, tags, pushes, deploys, creates GitHub releases, mutates registries, sets secrets, reads secret values, or calls production endpoints.
- Calls `scripts/npm-package-readiness` and `scripts/evidence-pack --dry-run`.
- Treats package dry-run as a separate opt-in flag.

Evidence required:

- Git state.
- Package readiness summary.
- Evidence-pack dry-run summary.
- README/release-note result.
- Release boundaries and final classification.

#### scripts/library-packaging-readiness

Purpose: inspect whether the skills library is ready to remain local, become a reusable template, or move toward npm/CLI packaging without publishing.

Default permission: `read-only-local`; `local-validation` for running the helper as part of route validation.

Examples:

```bash
./scripts/library-packaging-readiness --repo "$SKILLS_LIBRARY"
./scripts/library-packaging-readiness --repo "$SKILLS_LIBRARY" --json
./scripts/library-packaging-readiness --repo "$SKILLS_LIBRARY" --expect-open-source
./scripts/library-packaging-readiness --repo "$SKILLS_LIBRARY" --expect-npm
./scripts/library-packaging-readiness --repo "$SKILLS_LIBRARY" --expect-cli
```

Rules:

- Never publishes, tags, pushes, installs dependencies, creates GitHub releases, deploys, sets secrets, reads secret values, or calls production endpoints.
- Missing `package.json` is not a failure unless `--expect-npm` or `--expect-cli` is supplied.
- CLI bin checks are required only when CLI readiness is expected.
- Default mode checks local library and reusable-template readiness.
- `--expect-open-source` classifies open-source blockers without choosing a license.
- Missing license is a John-required blocker for open-source, npm, or CLI expectations.
- Missing changelog or release notes is a release-readiness blocker, not a local-library blocker.
- `LICENSE-DECISION.md` is only a decision record and is not a license.

Evidence required:

- Core docs status.
- Skill and route inventory.
- Helper script status.
- Templates, tests, docs, license, and release-note status.
- Package/CLI expectation status.
- Final classification and next safe step.

#### scripts/run-next

Purpose: executable autonomous work-loop runner for the coding workflow library. It reads `work-ledger.md`, selects the active repo work item, maps status to skill and permission gate, runs only actions covered by supplied `--allow` flags, updates ledger/run-log evidence, and stops at real John-required boundaries.

Default permission: `read-only-local` for `--dry-run`, `--explain`, and unsupported/boundary states; escalates by supplied `--allow` flag for covered actions. Current covered paths are GitHub handoff for `Auth pass for GitHub handoff`, read-only PR readiness inspection for `PR opened, not merged`, PR #11 merge handoff for `PR ready for merge approval`, source-only deployment planning for `Merged, not deployed`, source/local Supabase execution preflight for `Deployment plan ready, not deployed`, Supabase tooling/auth setup for `Supabase execution preflight ready, not executed`, Supabase link/local secret readiness for `Supabase tooling/auth ready, not linked`, scheduler draft/PR handoff for `Supabase linked and local secret ready, not deployed`, scheduler PR #12 merge for `Scheduler migration PR opened, not merged`, remote secret plus single function deploy for `Scheduler migration draft merged, not applied`, runtime rejection checks for `Function deployed and remote secret set, scheduler not applied`, combined post-Vault function secret/deploy/negative-runtime checks for `Scheduler applied via Vault, runtime not verified`, one controlled scheduler-path success invocation for `Function deployed, negative runtime verified, success path not run`, scheduled-run monitoring and production handoff prep for `Controlled success invocation completed`, scheduler application decision for `Runtime negative checks passed, scheduler not applied`, scheduler Vault design/apply for `Scheduler blocked: safe secret storage path not proven`, scheduler Vault apply retry for `Scheduler blocked: Vault/pg_cron/pg_net capability not proven`, verification bundle self-test for `Local verification and release evidence bundle built`, local skill workpack for `Verification bundle self-test complete`, Cloudflare/Opstruth/packaging route extraction for `Embedded production lanes extracted into reusable routes`, clean-temp readiness smoke for `Cloudflare Opstruth packaging routes extracted`, MIT licence/package candidate verification for `Clean-temp readiness smoke complete`, package candidate dry-run for `MIT licence and package candidate scaffold complete`, CLI entrypoint package smoke for `Package candidate dry-run complete`, GitHub open-source handoff for `CLI entrypoint package smoke complete`, and first version tag for `GitHub open-source handoff complete`.

Examples:

```bash
./scripts/run-next
./scripts/run-next --dry-run
./scripts/run-next --explain
./scripts/run-next --list-routes
./scripts/run-next --repo /home/johnh/wagging-web-wins
./scripts/run-next --repo /home/johnh/wagging-web-wins --explain
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow github-handoff
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow github-handoff --dry-run
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow pr-readiness
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow pr-merge
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow deployment-plan
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow supabase-preflight
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow supabase-tooling-auth
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow supabase-link-secret-readiness
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow scheduler-draft-pr
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow scheduler-pr-merge
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow supabase-secret-function-deploy
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow runtime-negative-verification
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow function-secret-deploy-negative-runtime
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow controlled-success-invocation
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow scheduled-run-monitoring-handoff
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow scheduler-application-decision
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow scheduler-vault-design-apply
./scripts/run-next --repo /home/johnh/wagging-web-wins --allow scheduler-vault-apply-retry
./scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow verification-bundle-self-test
./scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow verification-bundle-self-test --allow evidence-pack-write
./scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow cloudflare-opstruth-packaging-bundle
./scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow clean-temp-readiness-smoke
./scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow license-package-candidate
./scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow package-candidate-dry-run
./scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow cli-package-smoke
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
--allow scheduler-pr-merge
--allow supabase-secret-function-deploy
--allow runtime-negative-verification
--allow function-secret-deploy-negative-runtime
--allow controlled-success-invocation
--allow scheduled-run-monitoring-handoff
--allow scheduler-application-decision
--allow scheduler-vault-design-apply
--allow scheduler-vault-apply-retry
--allow verification-bundle-self-test
--allow local-skill-workpack
--allow evidence-pack-write
--allow cloudflare-opstruth-packaging-bundle
--allow clean-temp-readiness-smoke
--allow license-package-candidate
--allow package-candidate-dry-run
--allow cli-package-smoke
```

Rules:

- Never assume permission from ledger status alone.
- Never add deploy, migration, Supabase mutation, production endpoint, release, or destructive powers without a future explicit upgrade.
- Never print token values.
- Never push `main`, force push, deploy, run Supabase migrations, mutate Supabase, call production endpoints, stage unrelated files, or include `evidence/`; never merge except through the explicit PR merge mode.
- Dry-run and explain modes must not create branches, push, create PRs, inspect live PRs, mark ledger work completed, append run-log entries, edit target repos, or call external services.
- PR readiness mode must inspect GitHub evidence only and must never merge.
- PR merge mode must only merge PR #11 after explicit `--allow pr-merge`, exact PR scope checks, passing/nonblocking checks, `MERGEABLE` state, repo access, auth user confirmation, and repo-local workflow deployment scan. It must not delete the branch, deploy, run migrations, mutate Supabase, call production endpoints, force push, or push `main`.
- Deployment planning mode must only inspect local/source evidence and draft future-gated commands. It must not set secrets, deploy, run migrations, mutate Supabase, update schedulers, call production endpoints, push, create PRs, merge, or print secrets.
- Supabase execution preflight mode must only inspect local/source execution prerequisites and draft future-gated commands. It must not install the Supabase CLI, run `npx supabase`, log in, link a project, set secrets, deploy functions, run migrations, execute SQL, mutate schedulers, call runtime endpoints, push, create PRs, merge, or print secrets.
- Supabase tooling/auth setup mode may run `npx supabase --version` and read-only project listing with `SUPABASE_ACCESS_TOKEN` as a runtime environment value. It must not install Supabase CLI as a dependency, run `supabase login`, run `supabase link`, set secrets, deploy functions, run migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push, create PRs, merge, or print secrets.
- Supabase link/local secret readiness mode may run local `npx supabase link --project-ref <approved-ref>` after auth/project checks pass and may generate/store `IMPORT_REDDIT_TIPS_SECRET` only in `/home/johnh/.openclaw/.env`. It must not set remote secrets, deploy functions, run migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push, create PRs, merge, stage target repo files, include `evidence/`, or print secrets.
- Scheduler draft/PR mode may draft a guarded local scheduler migration, update docs, run local checks, create an exact-file commit, push a feature branch, and open or confirm a PR when John grants `--allow scheduler-draft-pr`. It must not set remote secrets, deploy functions, run `db push`, apply migrations, execute SQL, mutate schedulers remotely, invoke Edge Functions, call production endpoints, push `main`, force-push, merge, include `evidence/`, include `supabase/.temp/`, or print secrets.
- Scheduler PR merge mode may inspect and merge PR #12 only when John grants `--allow scheduler-pr-merge`. It must verify exact scheduler files, expected commits, checks, mergeability when still open, and a no-hardcoded-secret migration scan before merge; if PR #12 is already merged, it may verify the same evidence and stop. It must not delete the branch, set remote secrets, deploy functions, run migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push `main`, force-push, include `evidence/`, include `supabase/.temp/`, or print secrets.
- Supabase secret/function deploy mode may set remote `IMPORT_REDDIT_TIPS_SECRET` and deploy only `import-reddit-tips` when John grants `--allow supabase-secret-function-deploy`. It must use a temporary env file outside the target repo if `--env-file` is supported, delete that file immediately, block staged or tracked target repo changes, report untracked local artifacts as excluded, and stop before scheduler mutation, `db push`, migration application, SQL execution, Edge Function invocation, runtime verification, production endpoint calls, push, PR, merge, `evidence/` staging, `supabase/.temp/` staging, or secret printing.
- Runtime negative verification mode may call the deployed `import-reddit-tips` endpoint only for rejection checks when John grants `--allow runtime-negative-verification`: `OPTIONS`, `GET`/non-POST, `POST` without auth, `POST` with an invalid scheduler secret, and optional anon-only `POST`. It must not send a valid scheduler secret, admin bearer token, successful import/write request, apply scheduler, run `db push`, apply migrations, execute SQL, mutate pg_cron, set secrets, deploy functions, push, create PRs, merge, stage excluded files, or print tokens/secrets.
- Combined function secret/deploy/negative-runtime mode may run after `Scheduler applied via Vault, runtime not verified` when John grants `--allow function-secret-deploy-negative-runtime`. It may set remote `IMPORT_REDDIT_TIPS_SECRET`, deploy only `import-reddit-tips`, and run only non-mutating rejection checks. It must stop before valid scheduler/admin success calls or any import/write unless a true no-write dry-run mode is proven and explicitly exercised.
- Controlled success invocation mode may run after `Function deployed, negative runtime verified, success path not run` when John grants `--allow controlled-success-invocation`. It may collect read-only before/after `pet_tips` metadata and run exactly one valid scheduler-secret POST. It must not deploy, run `db push`, apply migrations, mutate schedulers, run SQL writes, manually insert/update/delete `pet_tips`, run admin success, retry the success call, push, create PRs, merge, stage excluded files, or print tokens/secrets/DB URLs.
- Scheduled-run monitoring and production handoff mode may run after `Controlled success invocation completed` when John grants `--allow scheduled-run-monitoring-handoff`. It may inspect cron job metadata, safe cron run history, `pet_tips` metadata, and source/docs evidence with read-only SQL and local reads. It must not invoke Edge Functions, call production endpoints, deploy, run `db push`, apply migrations, run SQL writes, mutate schedulers, write app tables or `pet_tips`, push, create PRs, merge, stage excluded files, or print tokens/secrets/DB URLs.
- MIT licence/package candidate mode may run after `Clean-temp readiness smoke complete` when John grants `--allow license-package-candidate`. It may verify the approved MIT `LICENSE`, `LICENSE-DECISION.md`, `package.json`, open-source readiness, npm package readiness, and local release preflight. It must not publish, version, pack, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate remote services, or touch product repos.
- Package candidate dry-run mode may run after `MIT licence and package candidate scaffold complete` when John grants `--allow package-candidate-dry-run`. It may run package readiness, release preflight npm mode, `npm pack --dry-run`, package content inspection, clean-temp package smoke, route audit, skill cleanup, and validation for candidate `autonomous-coding-workflow-library`. It must not publish, version, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate registries, mutate remote services, or choose a CLI entrypoint.
- CLI entrypoint package smoke may run after `Package candidate dry-run complete` when John grants `--allow cli-package-smoke`. It may verify `coding-workflow` local CLI metadata, run local CLI helper commands, run package readiness with `--expect-cli`, run release preflight CLI mode, run `npm pack --dry-run`, create a local temp tarball, install that local tarball into a clean temp consumer with lifecycle scripts disabled, run the installed CLI, remove temp files, and validate. It must not publish, version, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate registries, install remote dependencies, or mutate remote services.
- First version tag mode may run after `GitHub open-source handoff complete` when John grants `--allow first-version-tag`. It may update package version `0.1.0`, changelog, release notes, route metadata, and local docs; run local validation and clean-temp package smoke; exact-file commit; push `main` non-force; inspect GitHub Actions for the exact release commit; create/push annotated tag `v0.1.0`; verify the remote tag; and record post-tag bookkeeping. It must not publish, run `npm version`, create a GitHub release, deploy, run Supabase or Cloudflare commands, call production endpoints, print secrets, force-push, rewrite history, or stage broad/excluded paths.
- Scheduler application decision mode may inspect source/docs/env presence, Supabase CLI help, read-only project access, and read-only database capability evidence when John grants `--allow scheduler-application-decision`. It must prove a non-hardcoded `pg_cron` secret path before any scheduler mutation; otherwise it must stop at `Scheduler blocked: safe secret storage path not proven`. It must not deploy functions, run `supabase db push`, apply migrations, execute unrelated SQL, write app tables or `pet_tips`, invoke a valid scheduler/admin success path, trigger a successful import, stage excluded files, push, create PRs, merge, or print tokens/secrets.
- Scheduler Vault design/apply mode may use `psql` and a local DB URL when John grants `--allow scheduler-vault-design-apply`. It may inspect Vault/pg_cron/pg_net/current-job metadata, create or update one Vault secret outside the repo using a temporary deleted SQL file, and replace only `import-reddit-tips-daily` with a Vault-backed header. It must not print DB URLs or secrets, deploy functions, run `supabase db push`, apply migrations, run unrelated SQL, write app tables or `pet_tips`, invoke a valid scheduler/admin success path, trigger a successful import, stage excluded files, push, create PRs, or merge.
- Scheduler Vault apply retry mode may use `psql` and a corrected local DB URL when John grants `--allow scheduler-vault-apply-retry` for `Scheduler blocked: Vault/pg_cron/pg_net capability not proven`. It may retry DB connectivity, capability discovery, one Vault secret create/update, and replacement of only `import-reddit-tips-daily`. It must stop before runtime verification and must not print DB URLs or secrets, deploy functions, run `supabase db push`, apply migrations, run unrelated SQL, write app tables or `pet_tips`, invoke a valid scheduler/admin success path, trigger a successful import, stage excluded files, push, create PRs, or merge.
- Verification bundle self-test mode may run after `Local verification and release evidence bundle built` when John grants `--allow verification-bundle-self-test`. It may run npm package readiness, release preflight, evidence-pack dry-run, helper syntax checks, `skill-cleaner`, and `validate-skills` against the selected repo. Evidence pack writing requires the extra `--allow evidence-pack-write` flag and is limited to local `evidence/` files; it must not stage, commit, publish, tag, push, create PRs, deploy, mutate registries, read secret values, call external services, or call production endpoints.
- Vendor skill intake is a dependency-install/local-edit workflow and must be isolated under `vendor-intake/<vendor-name>/`. It must not install into a target repo, override `AGENTS.md` or `tools.md`, copy secrets, mutate Supabase, deploy, run migrations, or mark a repo deployment-ready. Official Supabase guidance is advisory until adapted into local library files.
- Clean-temp readiness smoke mode may create and remove a local temp copy under `/home/johnh/.openclaw/tmp/`, run only local route/readiness/preflight/validation checks from that copy, and classify open-source/package blockers. It must not choose a license, create an npm package, publish, version, tag, push, create PRs, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, or touch product repos.

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
- For scheduler PR merge mode: PR #12 URL/state/base/head, exact changed files, expected commits, checks, mergeability or already-merged state, migration secret scan result without values, merge result or already-merged boundary, final PR state, local repo state, and explicit Supabase commands not run.
- For Supabase secret/function deploy mode: repo state, function boundary source evidence, env variable presence only, Supabase CLI version, read-only project access, secrets-set help support for `--env-file`, remote secret set result, temporary secret file creation/removal evidence without values, single function deploy result, post-deploy git state, and explicit scheduler/db/runtime commands not run.
- For runtime negative verification mode: repo state, source auth-before-work evidence, endpoint URL, env variable presence only, negative HTTP status evidence for OPTIONS/GET/no-auth/invalid-secret/optional anon-only checks, response secret-exposure scan result, and explicit confirmation that no valid scheduler/admin success request, scheduler mutation, migration, SQL, secret mutation, or deploy was run.
- For combined function secret/deploy/negative-runtime mode: repo state, dry-run/no-write source decision, env variable presence only, Supabase CLI version, read-only project access, remote secret set result, temporary secret file creation/removal evidence without values, single function deploy result, OPTIONS/non-POST/no-auth/invalid-secret/anon-only rejection statuses, explicit success-path decision, response secret-exposure scan result, and explicit db/migration/scheduler/write commands not run.
- For controlled success invocation mode: repo state, env variable presence only, psql availability, read-only before `pet_tips` count/columns/safe recent metadata, exactly one scheduler-secret POST status/response summary, read-only after `pet_tips` count/safe recent metadata, count delta, response secret-exposure scan, and explicit deploy/db-push/migration/scheduler/admin/retry commands not run.
- For scheduled-run monitoring and production handoff mode: repo state, env variable presence only, psql availability, read-only `cron.job` metadata, `cron.job_run_details` availability and safe recent status/start/end rows when available, read-only `pet_tips` count/columns/safe recent metadata, source/docs evidence, production handoff decision, secret-exposure scan, and explicit confirmation that no function invocation, deploy, scheduler mutation, SQL write, push, PR, or merge was run.
- For scheduler application decision mode: recovered partial-work status, target repo state, existing scheduler job/source evidence, local env variable presence only, Supabase CLI/project access result, read-only database capability discovery, safe-path decision, planned scheduler change or blocker, post-application scheduler evidence if applied, secret-exposure check, and explicit commands not run.
- For scheduler Vault design/apply mode: target repo state, env variable presence only including DB URL source without value, psql availability, read-only Vault/pg_cron/pg_net/current-job capability discovery, safe-path decision, Vault secret create/update result, temporary SQL file deletion proof, scheduler replacement result, post-application metadata/command-shape checks without printing command, secret-exposure check, and explicit commands not run.
- For verification bundle self-test mode: selected repo, npm package readiness classification, release preflight classification, evidence-pack mode, confirmation that default mode is dry-run, helper syntax checks, skill-cleaner result, validate-skills result, ledger/run-log status, and explicit commands not run.
- For CLI entrypoint package smoke mode: package `bin` metadata, executable wrapper check, local CLI help/routes/package-readiness/release-preflight results, package readiness with `--expect-cli`, release preflight CLI mode, `npm pack --dry-run` contents, clean-temp local tarball install result, installed CLI help/routes/validate results, temp cleanup proof, route audit, skill-cleaner, validate-skills, and explicit commands not run.
- For first version tag mode: repository state, GitHub auth, npm name read-only status if checked, package/lockfile version `0.1.0`, changelog entry, release notes, local validation, clean-temp tarball smoke, exact release commit hash, push result, exact-commit CI success, annotated tag creation, tag push, remote tag dereference, post-tag bookkeeping commit, final validation, and explicit commands not run.
- For vendor skill intake: isolated intake path, install command/result, installed skill names, files inspected, useful guidance found, differences from local gates, local library updates made, and confirmation that no target repo or external service was mutated.
- Ledger and run-log update status.

#### scripts/route-audit

Purpose: validate local route metadata so proven ledger routes point to durable skill files, helper scripts, permission flags, success states, blocked states, forbidden actions, and evidence requirements.

Default permission: `read-only-local`.

Examples:

```bash
./scripts/route-audit
./scripts/route-audit --json
```

Rules:

- Does not call external services.
- Does not read secrets or env files.
- Does not update `work-ledger.md` or `runs/skill-runs.md`.
- Does not execute route helpers.
- Allows helper references only when the script exists locally or the helper is explicitly marked `external:` or `manual:`.
- Route metadata does not grant deploy, push, publish, secret, database, or production permission.

Evidence required:

- Route file path.
- Routes checked.
- Missing skill/helper findings.
- Duplicate route id findings.
- Empty permission, success, or blocked state findings.
- Final pass/fail result.

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

### Local verification, release, and evidence helpers

Purpose: local-only evidence packs, package readiness classification, release preflight classification, and failure classification.

Default permission: `local-validation` for read-only helper runs; `local-edit` only for approved local evidence-pack writes under an approved `evidence/` folder.

Commands:

```bash
./scripts/evidence-pack --repo "$TARGET_REPO" --title "Short title" --dry-run
./scripts/evidence-pack --repo "$TARGET_REPO" --title "Short title"
./scripts/npm-package-readiness --repo "$TARGET_REPO"
./scripts/npm-package-readiness --repo "$TARGET_REPO" --expect-package
./scripts/npm-package-readiness --repo "$TARGET_REPO" --expect-cli
./scripts/npm-package-readiness --repo "$TARGET_REPO" --allow-pack-dry-run
./scripts/release-preflight --repo "$TARGET_REPO" --mode local
./scripts/release-preflight --repo "$TARGET_REPO" --mode npm
./scripts/release-preflight --repo "$TARGET_REPO" --mode cli
./scripts/failure-evidence --input /path/to/log.txt
cat /path/to/log.txt | ./scripts/failure-evidence --stdin
```

Rules:

- `evidence-pack` without `--dry-run` writes local files only and never stages or commits them.
- `npm-package-readiness` must distinguish `PASS`, `WARN`, `FAIL`, `NOT_VERIFIED`, and `NOT_APPLICABLE`.
- `npm-package-readiness` must not run `npm pack --dry-run` unless `--allow-pack-dry-run` is present.
- `release-preflight --mode local` must not fail merely because a repo is not an npm package.
- `release-preflight --mode npm` expects package readiness.
- `release-preflight --mode cli` expects package and CLI bin readiness.
- `failure-evidence` redacts secret-shaped values and classifies the recovery path; it does not fix the failure by itself.
- These helpers never publish, change versions, tag, push, create PRs, deploy, set secrets, mutate registries, run Supabase or Cloudflare mutation commands, or call production endpoints.

Evidence required:

- Helper command and mode.
- Final classification.
- Evidence pack path if written.
- Redaction statement for failure logs.
- Commands explicitly not run.

### Runtime verification helpers

Purpose: negative runtime checks, dry-run proof, controlled success invocation planning, and scheduled monitoring evidence.

Default permission: `read-only-local` for source inspection; explicit runtime-verification permission for any live endpoint call; separate permission for controlled success or production write paths.

Rules:

- Inspect source before calling a runtime.
- Separate negative checks from dry-run success checks and controlled success invocations.
- Do not send valid secrets or admin credentials during negative checks.
- Do not call a success path unless the current permission gate covers the write risk.
- Do not treat scheduled monitoring as permission to manually trigger a job.

Evidence required:

- Runtime target and permission gate.
- Source files inspected.
- Write/side-effect map.
- Status codes and sanitized response summaries.
- Dry-run proof or explicit statement that no no-write success mode was proven.

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

### Lane-state tools

Purpose: maintain local project-scoped workflow state without treating a public Markdown ledger as the only runtime source.

Default permission: local state read; explicit route permission for state transitions.

Rules:

- Store real lane state outside the tracked package.
- Never store tokens, secrets, credentials, database URLs, or private keys.
- Use atomic writes and update only the selected lane.
- Dry-run and explain modes must not update any lane.
- Keep product-specific monitoring evidence local unless deliberately sanitised.

### Zero-output diagnostic tools

Purpose: locate the first stage where a successful pipeline becomes empty.

Default permission: source-read. Database counts, log inspection, external retrieval, product edits, and production mutation are separate gates.

Rules:

- Prefer source counter tracing and aggregate metadata.
- Do not print raw content, credentials, request headers, or database URLs.
- Do not fetch external sources or invoke production merely to diagnose attrition.
- Empty destination data may rule out deduplication but does not prove upstream input.
- Stop at `EVIDENCE_INSUFFICIENT` when stage attribution is not supported.

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

### GitHub open-source handoff tools

Purpose: public repository creation/verification, exact-file initial commit, one `main` push, and remote HEAD verification for the skills library.

Default permission: blocked until `github-open-source-handoff` is explicitly approved.

Allowed only under that gate:

- `gh auth status`, `gh api user`, and `gh repo view/create` without printing token values.
- `git init`, `git status`, exact-file staging, exact-file commit, one non-force push to `main`, and `git ls-remote`.
- Local validation commands such as `npm test`, route audit, package readiness, release preflight, and pack dry-run.

Forbidden:

- `git add .`, `git add -A`, force push, npm publish, npm version, tags, GitHub releases, deploys, Supabase/Cloudflare commands, production calls, secret printing, and staging evidence/temp/cache/private runtime files.

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
