# Coding Workflow Library Runbook

This runbook is the operating manual for using the local coding workflow skills library during real coding work. An LLM should follow it before, during, and after each task.

Read `AGENTS.md` first. Its hard rules and permission gates override individual skill convenience.

## Core Rules

1. Read `AGENTS.md` first.
2. Use `coding-workflow-orchestrator-skill` as the control plane when the next safe skill, queue status, or permission boundary is not already obvious.
3. Select the relevant downstream skill before acting.
4. Read the selected skill file before running commands.
5. State why that skill was selected.
6. Separate confirmed facts from assumptions.
7. Prefer read-only inspection before editing.
8. Never say a task is complete without evidence.
9. Record active orchestration state in `work-ledger.md`.
10. Record every skill run in `runs/skill-runs.md`.
11. If no skill fits, create a skill gap note instead of improvising silently.
12. If a command fails, record the failure and recovery path.
13. If secrets or credentials are found, stop and report without printing the secret value.
14. Before any commit, use `github-handoff-skill`.
15. If committing locally is approved, prefer `scripts/committer`.
16. Commit permission does not imply push permission.

## Execution Order

1. `AGENTS.md`: hard rules, permission gates, repo safety, secret handling, and routing constraints.
2. `coding-workflow-orchestrator-skill`: control-plane classification and next-skill selection when the next step is unclear.
3. `scripts/run-next`: executable work-loop runner when ledger state and supplied `--allow` flags cover the next action.
4. `routes/skill-routes.json`: ledger-state to skill ownership, permission flag, helper script, forbidden action, success state, blocked state, and evidence mapping.
5. Skill frontmatter plus `skills-index.md`: routing contract and skill discovery.
6. Selected `skill-files/*.md`: concrete commands, procedure, evidence, and safety rules.
7. `tools.md`: tool permission levels, safe examples, approval requirements, and evidence expectations.
8. `./scripts/route-audit`: route metadata validation after route edits.
9. `./scripts/validate-skills`: library validation after skill edits.
10. `evidence-checklist.md`: final evidence gate.

The system requests authority for consequences, not permission for every tool call.

Objective authority in `AGENTS.md` overrides individual skill convenience. Local execution is normally autonomous inside the selected objective. A skill may suggest a command, but only consequence-bearing actions need a granted authority class: `remote_publication`, `production_mutation`, `secret_mutation`, or `destructive_action`.

Use `github-handoff-skill` before publication-oriented git work, use `scripts/committer` for exact-file local commits, and treat push, PR mutation, merge, tag push, GitHub Release, and npm publication as `remote_publication` consequences under the active objective rather than separate repeated prompts.

`scripts/run-next` is the default executable path when the next step is represented in lane state or `work-ledger.md`. In lane mode it reads the selected objective authority and can continue through multiple safe/local stages until a structured blocker appears. Legacy `--allow <route>` flags remain compatible; new work should prefer objective grants. Use `--explain`, `--explain-next`, or `--dry-run` when the selected job should be reported without mutating lane state, ledger, run log, target repo, or external services.

Use these blocker states:

- `BLOCKED_CAPABILITY`: missing binary, missing/invalid auth, missing env var, network unavailable, or unavailable external account capability.
- `BLOCKED_PERMISSION`: next consequence crosses an ungranted objective authority class.
- `BLOCKED_SAFETY`: tests, validation, secret scan, package inspection, repo drift, or idempotency failed.
- `BLOCKED_DECISION`: human judgement is genuinely required.
- `WAITING_CONDITION`: CI, scheduled job, deployment completion, or propagation is pending.

Route metadata is the future source of truth for reusable workflow ownership. Keep `scripts/run-next` working, but prefer adding or updating `routes/skill-routes.json` when a proven ledger state should map to a durable skill. A reusable skill is incomplete until it has route metadata or a deliberate hold reason in `build-queue.md`. Manual helpers are allowed, but they should not remain orphaned once a workflow is proven.

For GitHub PR handoff work, `PR opened, not merged` is not a dead end. `scripts/run-next --allow pr-readiness` may inspect the PR, collect files/checks/mergeability/review evidence, update the ledger, and continue to the normal merge path when the active objective already grants `remote_publication`.

When the ledger status is `PR ready for merge approval`, `scripts/run-next --allow pr-merge` may merge a verified workflow-authored PR by normal repository rules only after rechecking auth, repo access, exact changed files, PR state, mergeability, checks, reviewed head SHA, and intended scope. This is not an admin merge or branch-protection bypass. It must continue to `POST_MERGE_VERIFY` and only record completion after exact merge commit, local validation, remote alignment, ledger update, and run-record update pass. Deployment planning, Supabase secret setup, scheduler changes, runtime endpoint checks, and deployed RLS/grants remain separate gates.

When John explicitly approves deployment planning and the ledger status is `Merged, not deployed`, `scripts/run-next --allow deployment-plan` may inspect local/source evidence and produce a deployment plan. It must not deploy, set secrets, run migrations, mutate Supabase, update schedulers, call production endpoints, push, create PRs, or merge anything. It must stop at `Deployment plan ready, not deployed`.

When John explicitly approves Supabase execution preflight and the ledger status is `Deployment plan ready, not deployed`, `scripts/run-next --allow supabase-preflight` may inspect local/source execution prerequisites and draft the exact execution sequence. It must not install the Supabase CLI, run `npx supabase`, log in, link a project, set secrets, deploy functions, run migrations, execute SQL, mutate schedulers, call runtime endpoints, push, create PRs, or merge. It must stop at `Supabase execution preflight ready, not executed`.

When John explicitly approves Supabase tooling/auth setup and the ledger status is `Supabase execution preflight ready, not executed`, `scripts/run-next --allow supabase-tooling-auth` may check Node/npm/npx, run `npx supabase --version`, inspect local runtime env variable names/presence without printing values, and use `SUPABASE_ACCESS_TOKEN` only for read-only project listing. It must not install the Supabase CLI as a dependency, run interactive login, link, set secrets, deploy, run migrations, execute SQL, mutate schedulers, invoke functions, call production endpoints, push, create PRs, or merge. It must stop at either a clear tooling/auth credential boundary or `Supabase tooling/auth ready, not linked`.

When John explicitly approves Supabase link/local secret readiness and the ledger status is `Supabase tooling/auth ready, not linked`, `scripts/run-next --allow supabase-link-secret-readiness` may run `npx supabase link --project-ref <approved-ref>` and ensure `IMPORT_REDDIT_TIPS_SECRET` exists only in `/home/johnh/.openclaw/.env`. If missing, it may generate a strong local secret and write it only to that local runtime env file without printing the value. It must stop before remote secret setup, deploy, migrations, SQL, scheduler mutation, Edge Function invocation, runtime endpoint calls, push, create PRs, or merge.

When John explicitly approves the combined scheduler draft and PR gate and the ledger status is `Supabase linked and local secret ready, not deployed`, `scripts/run-next --allow scheduler-draft-pr` may draft a guarded local scheduler migration, update local docs, run local checks, create an exact-file commit, push the feature branch, and open or confirm a PR. It must stop at `Scheduler migration PR opened, not merged` and must not set remote Supabase secrets, deploy functions, run `db push`, apply migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push `main`, force-push, or merge the PR.

When John explicitly approves the scheduler PR merge gate and the ledger status is `Scheduler migration PR opened, not merged` or an already-recorded `Scheduler migration draft merged, Supabase mutation still gated`, `scripts/run-next --allow scheduler-pr-merge` may inspect PR #12, verify exact files and commits, check PR state/checks/mergeability where applicable, scan the scheduler migration for hardcoded secret-shaped values without printing matches, and merge PR #12 only if it is still open and clean. It must stop at `Scheduler migration draft merged, not applied` and must not set remote Supabase secrets, deploy functions, run `db push`, apply migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, force-push, or delete the branch.

When John explicitly approves the combined Supabase remote secret setup and single Edge Function deploy gate and the ledger status is `Scheduler migration draft merged, not applied`, `scripts/run-next --allow supabase-secret-function-deploy` may verify source/auth/env, set remote `IMPORT_REDDIT_TIPS_SECRET` using a temporary env file outside the target repo, deploy only `import-reddit-tips`, delete the temporary env file, and stop at `Function deployed and remote secret set, scheduler not applied`. This gate must block staged or tracked target repo changes; untracked local artifacts may only be reported as excluded and must not be staged, deployed, or treated as source evidence. It must not mutate schedulers, run `db push`, apply migrations, execute SQL, invoke Edge Functions, call production endpoints, run runtime verification, push, create PRs, merge, write secrets into the target repo, or print secret values.

When John explicitly approves negative runtime verification and the ledger status is `Function deployed and remote secret set, scheduler not applied`, `scripts/run-next --allow runtime-negative-verification` may call the deployed `import-reddit-tips` endpoint only for rejection checks: `OPTIONS`, `GET`/non-POST rejection, `POST` without auth rejection, `POST` with an invalid scheduler secret rejection, and optional anon-only rejection if a local anon key is available without printing it. It must stop at `Runtime negative checks passed, scheduler not applied` or `Runtime negative checks failed, scheduler blocked`. It must not send a valid scheduler secret, send an admin bearer token, trigger a successful import/write, apply the scheduler, run `db push`, apply migrations, execute SQL, mutate pg_cron, set secrets, deploy functions, push, create PRs, merge, stage excluded files, or print token/secret values.

When John explicitly approves the combined function secret/deploy/negative-runtime gate and the ledger status is `Scheduler applied via Vault, runtime not verified`, `scripts/run-next --allow function-secret-deploy-negative-runtime` may verify source/env/project state, set remote `IMPORT_REDDIT_TIPS_SECRET` using a temporary env file outside the target repo, deploy only `import-reddit-tips`, delete the temporary env file, and run only non-mutating runtime rejection checks. It must stop at `Function deployed, negative runtime verified, success path not run` unless a true no-write dry-run mode is proven and explicitly exercised. This gate corrects the post-Vault sequence: do not proceed to runtime verification until the remote Edge Function secret is set and the function is deployed. It must not run `db push`, apply migrations, execute SQL, mutate schedulers, write app tables or `pet_tips`, send a valid scheduler/admin success request, trigger a successful import, push, create PRs, merge, stage excluded files, or print token/secret values.

When John explicitly approves the controlled scheduler-path success invocation gate and the ledger status is `Function deployed, negative runtime verified, success path not run`, `scripts/run-next --allow controlled-success-invocation` may use `SUPABASE_DB_URL` for read-only `pet_tips` metadata before and after, run exactly one valid scheduler-secret POST to `import-reddit-tips`, and stop at `Controlled success invocation completed` or a precise blocked state. It must not deploy functions, run `supabase db push`, apply migrations, mutate schedulers, run SQL writes, manually insert/update/delete `pet_tips`, run admin success, retry the success invocation, stage excluded files, push, create PRs, merge, print DB URLs, or print token/secret values.

When John explicitly approves scheduled-run monitoring and production handoff prep and the ledger status is `Controlled success invocation completed`, `scripts/run-next --allow scheduled-run-monitoring-handoff` may use `SUPABASE_DB_URL` for read-only cron metadata, safe cron run history, `pet_tips` metadata, and source/docs handoff evidence. It must stop at `Scheduled run pending, production handoff ready`, `Scheduled run observed, production handoff ready`, or a precise blocked state. It must not invoke Edge Functions, call production endpoints, deploy, run `supabase db push`, apply migrations, run SQL writes, mutate schedulers, write app tables or `pet_tips`, stage excluded files, push, create PRs, merge, print DB URLs, or print token/secret values.

When John explicitly approves the scheduler application decision gate and the ledger status is `Runtime negative checks passed, scheduler not applied`, `scripts/run-next --allow scheduler-application-decision` may inspect local scheduler source/docs, local env variable presence without values, Supabase CLI help, read-only project access, and read-only database capability evidence if a safe non-interactive path exists. It must prove how `pg_cron` can send `x-import-reddit-tips-secret` without hardcoding the secret literal before mutating the scheduler. If that proof is missing, it must stop at `Scheduler blocked: safe secret storage path not proven`. This gate must not deploy functions, run `supabase db push`, apply migrations, execute unrelated SQL, write app tables or `pet_tips`, invoke a valid scheduler/admin success path, trigger a successful import, stage excluded files, push, create PRs, merge, or print token/secret values.

When John explicitly approves the scheduler Vault design/apply gate and the ledger status is `Scheduler blocked: safe secret storage path not proven`, `scripts/run-next --allow scheduler-vault-design-apply` may use local env values without printing them, require `SUPABASE_DB_URL` or `DATABASE_URL`, verify `psql`, inspect Vault/pg_cron/pg_net/current job capability, create or update one Vault secret named `import_reddit_tips_scheduler_secret`, and replace only `import-reddit-tips-daily` with a Vault-backed `x-import-reddit-tips-secret` header if safe. It must stop at `Scheduler applied via Vault, runtime not verified`, `Needs John: database connection URL missing`, `Needs John: psql unavailable for non-interactive DB inspection`, or `Scheduler blocked: Vault/pg_cron/pg_net capability not proven`. It must not deploy functions, run `supabase db push`, apply migrations, run unrelated SQL, write app tables or `pet_tips`, invoke a valid scheduler/admin success path, trigger a successful import, stage excluded files, push, create PRs, merge, print DB URLs, or print token/secret values.

When John explicitly approves the scheduler Vault apply retry gate and the ledger status is `Scheduler blocked: Vault/pg_cron/pg_net capability not proven`, `scripts/run-next --allow scheduler-vault-apply-retry` may retry the same bounded Vault-backed scheduler application after DB connectivity or capability provisioning changes. It may verify IPv4 DB connectivity, discover Vault/pg_cron/pg_net capabilities, create or update only the `import_reddit_tips_scheduler_secret` Vault secret, and replace only `import-reddit-tips-daily` if the safe path is proven. It must stop at `Scheduler applied via Vault, runtime not verified`, `DB CONNECTIVITY BLOCKED`, or `Scheduler blocked: Vault/pg_cron/pg_net capability not proven`; it is not deploy, migration, runtime verification, unrelated SQL, or app-data-write permission.

When John explicitly approves verification bundle self-test and the ledger status is `Local verification and release evidence bundle built`, `scripts/run-next --allow verification-bundle-self-test` may run `scripts/npm-package-readiness`, `scripts/release-preflight`, `scripts/evidence-pack --dry-run`, helper syntax checks, `scripts/skill-cleaner`, and `scripts/validate-skills` against the selected repo. It must stop at `Verification bundle self-test complete` or a precise blocked state. `scripts/evidence-pack` must stay dry-run unless John also supplies `--allow evidence-pack-write`; that second flag allows only local evidence file creation under the selected repo and is not staging, commit, publish, tag, push, PR, deploy, registry, secret, external service, or production endpoint permission.

When John explicitly approves the local skill workpack and the ledger status is `Verification bundle self-test complete`, `scripts/run-next --allow local-skill-workpack --allow evidence-pack-write` may run only the local skills-library workpack against `/home/johnh/.openclaw/skills/coding-workflow-library`. It may run verification classification helpers, create exactly one local evidence pack under the library `evidence/` folder, run failure evidence classification, run helper syntax checks, run skill cleanup, and run skill validation. It must stop at `Local skill workpack complete` and must not touch product repos, publish npm, run `npm version`, tag, push, create PRs, deploy, run Supabase or Cloudflare commands, read secret values, mutate remote services, or call production endpoints.

When John explicitly approves the Cloudflare/Opstruth/packaging extraction bundle and the ledger status is `Embedded production lanes extracted into reusable routes`, `scripts/run-next --allow cloudflare-opstruth-packaging-bundle` may run only local route audit, library packaging readiness, release preflight in local mode, helper syntax checks, skill cleanup, and skill validation against `/home/johnh/.openclaw/skills/coding-workflow-library`. It must stop at `Cloudflare Opstruth packaging routes extracted` and must not touch product repos, deploy Cloudflare, run Wrangler deploy, publish npm, run `npm version`, tag, push, create PRs, set/read secrets, run Supabase commands, call production endpoints, or mutate remote services.

When John explicitly approves the clean-temp readiness smoke and the ledger status is `Cloudflare Opstruth packaging routes extracted`, `scripts/run-next --allow clean-temp-readiness-smoke` may create a clean temporary copy under `/home/johnh/.openclaw/tmp/`, exclude `.git`, `.env`, evidence, dependency caches, and credential-shaped files, run route audit, route listing, packaging readiness, open-source readiness classification, release preflight local mode, skill cleanup, and validation from the copied library, then remove the temp copy. It must stop at `Clean-temp readiness smoke complete` and must not choose a license, create `package.json`, publish, run `npm version`, tag, push, create PRs, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate remote services, or touch product repos.

When John explicitly approves the MIT licence and package candidate gate and the ledger status is `Clean-temp readiness smoke complete`, `scripts/run-next --allow license-package-candidate` may verify the approved MIT `LICENSE`, `LICENSE-DECISION.md`, `package.json` candidate scaffold, open-source readiness, npm package readiness, and local release preflight. It must stop at `MIT licence and package candidate scaffold complete` and must not publish, run `npm version`, run `npm pack`, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate remote services, or touch product repos. Final registry availability and ownership remain a separate John-required decision before any publish path.

When John explicitly approves the package candidate dry-run gate and the ledger status is `MIT licence and package candidate scaffold complete`, `scripts/run-next --allow package-candidate-dry-run` may verify package identity for `autonomous-coding-workflow-library`, repository metadata for `AyobamiH/coding-workflow-library`, MIT metadata, files allowlist, absence of a CLI `bin`, local open-source/npm readiness, release preflight npm mode, `npm pack --dry-run`, package contents risk checks, clean-temp package smoke, route audit, skill cleanup, and validation. It must stop at `Package candidate dry-run complete` and must not publish, run `npm version`, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate registries, mutate remote services, or choose a CLI entrypoint. Registry availability and ownership remain blocked by `NEEDS JOHN: confirm final npm package name availability and ownership before publish`.

When John explicitly approves the CLI entrypoint package smoke gate and the ledger status is `Package candidate dry-run complete`, `scripts/run-next --allow cli-package-smoke` may verify the local `coding-workflow` CLI wrapper, package `bin` metadata, package readiness with `--expect-cli`, release preflight in CLI mode, `npm pack --dry-run`, clean-temp local tarball install with lifecycle scripts disabled, installed CLI help/routes/validate commands, route audit, skill cleanup, and validation. It must stop at `CLI entrypoint package smoke complete` and must not publish, run `npm version`, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate registries, install remote dependencies, or mutate remote services. Registry availability and ownership remain blocked by `NEEDS JOHN: confirm final npm package name availability and ownership before publish`.

When John approves official vendor skill intake, install and inspect the vendor package only inside `vendor-intake/<vendor-name>/`. Treat official Supabase guidance as advisory evidence. Keep `AGENTS.md`, `tools.md`, explicit permission gates, and `scripts/run-next` ledger routing authoritative. The Supabase vendor intake highlighted Data API grants as separate from RLS, RLS on exposed schemas, `auth.role()` deprecation, `TO authenticated` without ownership as authentication-only, `SECURITY DEFINER` exposure, CLI `--help` discovery, and migration-file creation with Supabase CLI tooling when that local-draft gate is approved.

Frontmatter is the routing contract. The orchestrator should use `name`, `description`, `category`, `routing_triggers`, and `status` before falling back to manual index text.

Tool selection must respect `tools.md`. If a tool's permission level is higher than the current permission, stop and ask John for that exact gate. Validation scripts are preferred for library checks.

## Before A Coding Task

1. Read the user's task and identify the task type.
2. Read `AGENTS.md`.
3. If the task is to continue an existing ledger item, prefer `scripts/run-next --dry-run` with the matching `--repo` and allowed gate.
4. Use `coding-workflow-orchestrator-skill` first when the task has multiple possible next actions, unclear priority, separate permission gates, or no covered `scripts/run-next` path.
5. Use the Skill Selection Flow below to choose one or more skills.
6. Confirm the selected skill file exists under `skill-files/`.
7. Read the selected skill file in full enough to follow its Commands, Procedure, Evidence Required, and Safety Rules.
8. Read `tools.md` before tool-heavy work or any command outside read-only local inspection.
9. State the selected skill and why it applies.
10. Record starting facts separately from assumptions.
11. Start with read-only commands unless the task explicitly requires a file creation/edit and the target is clear.

## During A Coding Task

1. Follow the selected skill's Procedure.
2. Use exact commands from the skill file or `command-library.md` only when they match the current repo, `tools.md`, and safety rules.
3. Treat local edits, dependency installs, test/lint/build, commit, push, PR creation, merge/close, deploy, migration, database mutation, external API call, and release/tag as consequence classes. Do not request the same authority class twice for one objective, and do not treat a normal verified workflow-authored PR merge as a separate John boundary when `remote_publication` is already granted.
4. When a command fails:
   - capture the exact command;
   - capture the exact error;
   - classify the failure;
   - record the recovery path;
   - avoid retrying blindly.
5. Before editing a file, inspect the current file content or confirm the file is intentionally new.
6. When a potential secret appears, stop reading that value, do not print it, and report the file/path and secret type only.
7. Keep confirmed facts, assumptions, and unresolved gaps separate.
8. Update `work-ledger.md` before stopping at a permission boundary, blocker, handoff, or completion state.

## After A Coding Task

1. Run the evidence checks required by the selected skill.
2. After editing any skill, skill index, template, or routing docs, run `./scripts/validate-skills`.
3. Run `./scripts/skill-cleaner` before creating a new skill if overlap is possible.
4. Run `./scripts/skill-cleaner` after adding several skills.
5. Use cleaner recommendations as input, not automatic truth.
6. John must approve deprecate, delete, rename, destructive, production, secret, legal, billing, product, or security-tradeoff actions when not already covered by the objective. Normal verified workflow-authored PR merges follow the automatic merge policy in `docs/autonomous-decision-boundaries.md`.
7. Prefer validator output over manual grep checks for library health.
8. Use `evidence-checklist.md` for final verification.
9. Update `work-ledger.md` with status, evidence, blockers, next skill, exact next action, and whether John is needed.
10. Update `runs/skill-runs.md` using the template in `templates/skill-run-template.md`.
11. If the skill was weak, missing, or required repeated ad hoc work, add an upgrade idea to the run log and `build-queue.md`.
12. Final response must include:
   - files inspected;
   - files changed;
   - commands/checks run;
   - validation results;
   - remaining risks or unverified items.

## Skill Selection Flow

Use this mapping before acting:

- Need to classify work, choose the next safe skill, enforce permissions, run one bounded loop, or update the ledger: `coding-workflow-orchestrator-skill`
- Need to understand a repo before editing: `repo-map-skill`
- Need to investigate an error: `error-evidence-skill`
- Need to verify build/test/lint status: `build-verify-skill`
- Need to create a local redacted evidence pack: `evidence-pack-builder-skill`
- Need to inspect npm package or CLI distribution readiness: `npm-package-readiness-skill`
- Need a local release gate before publish/tag/push/deploy: `release-preflight-skill`
- Need runtime endpoint verification, negative checks, dry-run proof, controlled success invocation, or scheduled monitoring: `runtime-verification-skill`
- Need Supabase Edge Function remote secret setup, one function deploy, or deploy-to-runtime boundary handling: `supabase-function-deploy-skill`
- Need Supabase scheduler, Vault, pg_cron, pg_net, scheduler secret storage, or scheduler mutation boundary handling: `supabase-scheduler-vault-skill`
- Need production handoff, scheduled-run monitoring, run history review, or final observed-versus-pending status: `production-handoff-skill`
- Need to inspect environment variables or secret exposure risk: `env-audit-skill`
- Need to inspect Supabase database/auth/RLS risk: `supabase-rls-audit-skill`
- Need to resolve blocked or invalid GitHub CLI auth before push/PR work: `github-auth-gate-skill`
- Need to inspect Cloudflare deployment/runtime state: `cloudflare-deploy-skill`
- Need to create or update a project knowledge base: `project-kb-builder-skill`
- Need to review security before production: `security-hardening-review-skill`
- Need to control LLM drift during a long coding task: `llm-drift-control-skill`
- Need to review migrations: `migration-review-skill`
- Need to prepare GitHub handoff or repo sync: `github-handoff-skill`
- Need to extract more skills from a chat/session log: `session-log-extraction-skill`
- Need to rebuild backlog or agent-roadmap evidence from local history: `session-log-extraction-skill` with `scripts/extract-session-workflows.mjs`
- Need to trace OpenClaw subagent routing: `route-trace-skill`
- Need to compare OpenClaw config backups: `openclaw-config-diff-skill`
- Need to coordinate local tools, reads, writes, process logs, or gateway calls: `tool-patterns-skill`
- Need a public market scan from proxy data: `public-market-scan-skill`
- Need to audit skill bloat, overlap, routing, or cleanup candidates: `skill-cleaner-skill`

When frontmatter and this prose mapping disagree, treat `./scripts/validate-skills` output and the active skill file as the source of truth, then update stale docs.

## Local Verification Bundle

Use `evidence-pack-builder-skill`, `npm-package-readiness-skill`, and `release-preflight-skill` together when John asks for local release evidence.

Default boundaries:

- `scripts/evidence-pack --dry-run` is read-only-local.
- `scripts/evidence-pack` without dry-run is local-edit and writes only local evidence files.
- `scripts/npm-package-readiness` is read-only-local by default and reports `PASS`, `WARN`, `FAIL`, `NOT_VERIFIED`, or `NOT_APPLICABLE`.
- `scripts/npm-package-readiness --expect-package` turns a missing package into a failure.
- `scripts/npm-package-readiness --expect-cli` requires package and CLI bin readiness.
- `scripts/npm-package-readiness --allow-pack-dry-run` may run `npm pack --dry-run` but is not publish permission.
- `scripts/release-preflight --mode local` is the default and must not fail merely because a repo is not an npm package.
- `scripts/release-preflight --mode npm` expects npm package readiness.
- `scripts/release-preflight --mode cli` expects package and bin readiness.
- `scripts/release-preflight` is local validation/orchestration and must not publish, tag, push, deploy, create GitHub releases, mutate registries, read secret values, or call production endpoints.

Recommended sequence:

1. Run `scripts/npm-package-readiness --repo "$TARGET_REPO"`.
2. Add `--expect-package` or `--expect-cli` only when the repo is expected to be an npm package or CLI.
3. Run `scripts/evidence-pack --repo "$TARGET_REPO" --title "Short title" --dry-run`.
4. Run `scripts/release-preflight --repo "$TARGET_REPO" --mode local`.
5. Use `--mode npm` or `--mode cli` only when that release lane is intended.
6. Write evidence files only if John approves local evidence creation.
7. Stop before publish, tag, push, deploy, registry mutation, or GitHub release gates.

Autonomous sequence when the ledger status is `Local verification and release evidence bundle built`:

1. Run `scripts/run-next --dry-run --repo "$TARGET_REPO" --allow verification-bundle-self-test`.
2. Run `scripts/run-next --repo "$TARGET_REPO" --allow verification-bundle-self-test`.
3. Use `--allow evidence-pack-write` only for a separate local evidence-file write test.
4. Stop at `Verification bundle self-test complete`; do not route into publish, tag, push, PR, deploy, or production work in the same loop.

Autonomous local skill workpack sequence when the ledger status is `Verification bundle self-test complete`:

1. Run `scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow local-skill-workpack --allow evidence-pack-write`.
2. Run `scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow local-skill-workpack --allow evidence-pack-write`.
3. Confirm exactly one local evidence pack was created.
4. Stop at `Local skill workpack complete`; do not route into product repos, release, GitHub, deploy, Supabase, Cloudflare, secrets, or production work in the same loop.

Autonomous Cloudflare/Opstruth/packaging bundle sequence when the ledger status is `Embedded production lanes extracted into reusable routes`:

1. Run `scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow cloudflare-opstruth-packaging-bundle`.
2. Run `scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow cloudflare-opstruth-packaging-bundle`.
3. Confirm route audit, library packaging readiness, release preflight local mode, skill cleanup, and skill validation ran.
4. Stop at `Cloudflare Opstruth packaging routes extracted`; do not route into product repos, release, GitHub mutation, deploy, Supabase, Cloudflare, secrets, or production work in the same loop.

Autonomous clean-temp readiness smoke sequence when the ledger status is `Cloudflare Opstruth packaging routes extracted`:

1. Run `scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow clean-temp-readiness-smoke`.
2. Run `scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow clean-temp-readiness-smoke`.
3. Confirm the temp copy was created under `/home/johnh/.openclaw/tmp/`, local checks ran from that copy, route audit and validation passed, open-source/package blockers were classified, and the temp copy was removed.
4. Stop at `Clean-temp readiness smoke complete`; do not route into release, npm, GitHub mutation, deploy, Supabase, Cloudflare, secrets, production work, or license selection in the same loop.

Autonomous MIT/package candidate sequence when the ledger status is `Clean-temp readiness smoke complete`:

1. Run `scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow license-package-candidate`.
2. Run `scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow license-package-candidate`.
3. Confirm `LICENSE`, `LICENSE-DECISION.md`, `package.json`, open-source readiness, npm package readiness, and release preflight evidence.
4. Stop at `MIT licence and package candidate scaffold complete`; do not publish, version, tag, push, create PRs, create GitHub releases, deploy, read secrets, call production endpoints, or mutate remote services.

Autonomous package candidate dry-run sequence when the ledger status is `MIT licence and package candidate scaffold complete`:

1. Run `scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow package-candidate-dry-run`.
2. Run `scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow package-candidate-dry-run`.
3. Confirm `package.json` uses candidate name `autonomous-coding-workflow-library`, version `0.0.0`, MIT license, repository identity `AyobamiH/coding-workflow-library`, a tight files allowlist, and no CLI `bin`.
4. Confirm package readiness, release preflight npm mode, `npm pack --dry-run`, package contents inspection, clean-temp package smoke, route audit, and validation evidence.
5. Stop at `Package candidate dry-run complete`; do not publish, version, tag, push, create PRs, create GitHub releases, deploy, call registries except for separately approved read-only name checks, read secrets, call production endpoints, or mutate remote services.

Autonomous CLI entrypoint package smoke sequence when the ledger status is `Package candidate dry-run complete`:

1. Run `scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow cli-package-smoke`.
2. Run `scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow cli-package-smoke`.
3. Confirm `package.json` maps `coding-workflow` to `bin/coding-workflow.js`, the bin file is executable, package readiness passes or warns clearly with `--expect-cli`, `npm pack --dry-run` includes the bin and excludes private/local files, and the clean-temp installed CLI runs `--help`, `routes`, and `validate`.
4. Stop at `CLI entrypoint package smoke complete`; do not publish, version, tag, push, create PRs, create GitHub releases, deploy, install remote dependencies, read secrets, call production endpoints, mutate registries, or mutate remote services.

GitHub open-source handoff sequence when the ledger status is `CLI entrypoint package smoke complete`:

1. Run `scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow github-open-source-handoff`.
2. Harden public repo files, verify package quality scripts, run local validation, and perform a read-only npm name check if approved.
3. Confirm GitHub auth is `AyobamiH`, verify or create `AyobamiH/coding-workflow-library`, exact-file commit only, push `main` once, and verify local HEAD equals remote `main`.
4. Stop at `GitHub open-source handoff complete`; do not publish to npm, run `npm version`, create tags, create GitHub releases, deploy, run Supabase/Cloudflare commands, print secrets, force-push, or stage broad/excluded paths.

First version tag sequence when the ledger status is `GitHub open-source handoff complete`:

1. Run `scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow first-version-tag`.
2. Prepare package version `0.1.0`, `CHANGELOG.md`, and `docs/releases/v0.1.0.md` without running `npm version`.
3. Run local validation, package readiness, release preflight, `npm pack --dry-run`, and clean-temp tarball install smoke.
4. Exact-file commit the release files, push `main` non-force, and wait for GitHub Actions `validate.yml` to pass for that release commit.
5. Create and push annotated tag `v0.1.0` only after the exact release commit CI passes, then verify the remote tag dereferences to the release commit.
6. Record post-tag bookkeeping in a second exact-file commit and push `main`; it is acceptable for `main` to be one bookkeeping commit ahead of the tag.
7. Stop at `v0.1.0 tagged and pushed, npm unpublished`; do not publish to npm, run `npm version`, create a GitHub release, deploy, force-push, rewrite history, or stage broad/excluded paths.

## Missing Skill Handling

If a mapped skill file is missing:

1. Do not claim it exists.
2. List the missing skill name.
3. Add a "missing skill gap" entry to `build-queue.md`.
4. Recommend whether it should be created.
5. Use only generic read-only inspection until the user approves creating the missing skill or selects another skill.

## Zero-Output Investigation

Use the existing trace/runtime/error skill combination when a successful job produces no business output. Map stages in actual execution order, trace response counters to source assignments, reproduce database filters with aggregate read-only queries, identify the first non-zero and first zero stages, then choose one documented classification. Do not create a duplicate diagnostic skill unless these skills cannot express the evidence contract.

`EVIDENCE_INSUFFICIENT` is the required result when raw input counts, per-filter attrition, or safe upstream status evidence are unavailable. Never rerun production or fetch an external source merely to fill that gap under this route.

## Interrupted Run Resume

Use `./scripts/run-next --repo /path/to/repo --status` to inspect the latest checkpoint. Use `./scripts/run-next --repo /path/to/repo --resume --dry-run` before any real resume. Resume must verify branch, tracked working tree, permission flags, and checkpoint validity before continuing. It must not reset, clean, stash, force push, or replay a possible mutation.

## Secret Handling

If a secret-looking value is found:

1. Stop reading that value.
2. Do not print the value.
3. Report the file path, line number if safe, and secret class such as API key, private key, token, or service role.
4. Recommend containment steps.
5. Continue only after the user confirms the next safe action.

## Run Logging

Legacy ledger-mode tasks update `work-ledger.md`. New multi-project work should select a local runtime lane; only that lane is updated, while `work-ledger.md` remains historical evidence for reusable library development.

Every real use of this library must be logged in `runs/skill-runs.md`.

`scripts/run-next` updates `work-ledger.md` and appends `runs/skill-runs.md` only for real runs. Dry-run and explain modes must not mutate files or mark ledger work completed.

Lane-aware runs use `--lane <id> --state-file <path>`. They read and update only the selected lane, never append product-specific runtime evidence to the public ledger/run log, and require explicit monitoring baselines rather than deriving production time boundaries from ledger file timestamps.

Minimum ledger fields:

- Active repo.
- Current objective.
- Current permission level.
- Current status.
- Selected skill.
- Last commands run.
- Files changed.
- Validation evidence.
- Blockers.
- Next recommended skill.
- Exact next action.
- Whether John is needed.

Minimum log fields:

- Skill used.
- Goal.
- Starting state.
- Commands/tools used.
- Files inspected.
- Files changed.
- Evidence collected.
- Result.
- Failure/recovery notes.
- Follow-up skill needed.
- Upgrade idea.

## Completion Gate

Do not say "complete", "done", or equivalent unless:

- the selected skill was read;
- commands/tools used are recorded;
- files changed are listed;
- validation/evidence commands were run or explicitly unavailable;
- `./scripts/validate-skills` passed after skill-library edits;
- failures and recoveries are recorded;
- work ledger has been updated or the task was not orchestrated;
- run log has been updated or the user explicitly asks not to update it.
