---
name: coding-workflow-orchestrator-skill
description: Classify work, permission gates, and next skill.
category: orchestration
routing_triggers:
  - decide next work
  - permission gate
  - orchestrate task
  - work ledger
status: active
handles_state:
  - No ledger item for repo
  - Auth pass for GitHub handoff
  - PR opened, not merged
  - PR ready for merge approval
  - Merged, not deployed
  - Deployment plan ready, not deployed
  - Supabase execution preflight ready, not executed
  - Supabase tooling/auth ready, not linked
  - Supabase linked and local secret ready, not deployed
  - Scheduler migration PR opened, not merged
  - Scheduler migration draft merged, Supabase mutation still gated
  - Scheduler migration draft merged, not applied
  - Function deployed and remote secret set, scheduler not applied
  - Runtime negative checks passed, scheduler not applied
  - Runtime negative checks failed, scheduler blocked
  - Scheduler applied, runtime success not verified
  - Scheduler blocked: safe secret storage path not proven
  - Scheduler applied via Vault, runtime success not verified
  - Scheduler applied via Vault, runtime not verified
  - Function deployed, negative runtime verified, success path not run
  - Controlled success invocation completed
  - Scheduled run pending, production handoff ready
  - Scheduled run observed, production handoff ready
  - Scheduled run observed with failure: investigate scheduler/runtime
  - Zero-output pipeline investigation blocked
  - Zero-output root cause proven, production handoff pending decision
  - Expected empty input proven, production handoff ready
  - Zero-output local fix drafted, not committed or deployed
  - Local verification and release evidence bundle built
  - Verification bundle self-test complete
  - Local skill workpack complete
  - Embedded production lanes extracted into reusable routes
  - Cloudflare Opstruth packaging routes extracted
  - Clean-temp readiness smoke complete
  - Package candidate dry-run complete
  - CLI entrypoint package smoke complete
  - GitHub open-source handoff complete
  - First version tag blocked
  - v0.1.0 release commit prepared, tag not created
  - v0.1.0 tagged and pushed, npm unpublished
  - Needs John: database connection URL missing
  - Needs John: psql unavailable for non-interactive DB inspection
  - Scheduler blocked: Vault/pg_cron/pg_net capability not proven
requires_permission:
  - auth-check
  - github-handoff
  - pr-readiness
  - pr-merge
  - deployment-plan
  - supabase-preflight
  - supabase-tooling-auth
  - supabase-link-secret-readiness
  - scheduler-draft-pr
  - scheduler-pr-merge
  - supabase-secret-function-deploy
  - runtime-negative-verification
  - function-secret-deploy-negative-runtime
  - controlled-success-invocation
  - scheduled-run-monitoring-handoff
  - zero-output-investigation
  - scheduler-application-decision
  - scheduler-vault-design-apply
  - scheduler-vault-apply-retry
  - verification-bundle-self-test
  - local-skill-workpack
  - evidence-pack-write
  - cloudflare-opstruth-packaging-bundle
  - clean-temp-readiness-smoke
  - license-package-candidate
  - package-candidate-dry-run
  - cli-package-smoke
safe_by_default: true
mutates:
  - selected local lane on lane-aware real execution
  - work-ledger.md on legacy real execution
  - runs/skill-runs.md on legacy real execution
reads:
  - AGENTS.md
  - tools.md
  - work-ledger.md
  - target repo git state
writes:
  - work-ledger.md
  - runs/skill-runs.md
evidence:
  - selected ledger item
  - current status
  - selected skill
  - required permission
  - validation evidence for executed bounded step
stop_conditions:
  - missing ledger item
  - missing permission flag
  - unknown status
  - unimplemented route
  - credential blocker
  - production mutation boundary
---
# coding-workflow-orchestrator-skill

## Purpose

Orchestrate one bounded workflow lane at a time. Prefer project-scoped local state selected with `--lane` and `--state-file`; retain `work-ledger.md` as historical evidence and a backwards-compatible routing source.

Lane-aware execution must never replace another lane's state. Dry-run and explain modes do not update lanes. Real repo paths, monitoring baselines, and product runtime evidence remain local and secret-free.

This is the control-plane skill for the local coding workflow system.

Use it to decide which work should happen next, classify the queue item, select the correct downstream skill, run one bounded work loop, collect evidence, update the work ledger, update the run log, and stop at the correct permission boundary.

The orchestrator must not perform deep implementation itself unless the selected downstream skill authorizes it. It should avoid random prompting and decide the next safe step from evidence.

`scripts/run-next` is the executable implementation of this orchestrator loop. It reads ledger state, selects the next skill, checks supplied permission flags, runs covered safe actions, updates ledger/run-log evidence, and stops at permission boundaries. Manual prompts are fallback control, not the default, when `scripts/run-next` covers the current ledger state.

`routes/skill-routes.json` is the route ownership layer. Use it to keep reusable skills from becoming manual-only documents and to keep proven production workflow logic from staying hidden inside `scripts/run-next`. The runner should remain a bounded orchestrator over skills, route metadata, and helper scripts. Product-specific live actions still require explicit permission gates.

For GitHub work, `scripts/run-next` can continue past `PR opened, not merged` into read-only PR readiness inspection. It may collect PR metadata, checks, changed files, commits, mergeability, review decision, and local repo evidence, but it must stop before merge.

When John separately approves PR merge and the ledger status is `PR ready for merge approval`, `scripts/run-next --allow pr-merge` may merge PR #11 only after rechecking the auth user, repo access, exact changed files, PR state, `MERGEABLE` state, PR checks, and repo-local workflow deployment evidence. It must stop at `Merged, not deployed`.

When John separately approves deployment planning and the ledger status is `Merged, not deployed`, `scripts/run-next --allow deployment-plan` may inspect local/source evidence and draft a deployment plan. It must stop at `Deployment plan ready, not deployed` and must not deploy, set secrets, run migrations, mutate Supabase, update schedulers, call production endpoints, push, create PRs, or merge.

When John separately approves Supabase execution preflight and the ledger status is `Deployment plan ready, not deployed`, `scripts/run-next --allow supabase-preflight` may inspect local/source execution prerequisites and draft exact execution commands. It must stop at `Supabase execution preflight ready, not executed` and must not install the Supabase CLI, run `npx supabase`, log in, link a project, set secrets, deploy functions, run migrations, execute SQL, mutate schedulers, call runtime endpoints, push, create PRs, or merge.

When John separately approves Supabase tooling/auth setup and the ledger status is `Supabase execution preflight ready, not executed`, `scripts/run-next --allow supabase-tooling-auth` may check Node/npm/npx, run `npx supabase --version`, inspect local env names/presence without printing values, and use `SUPABASE_ACCESS_TOKEN` only for read-only project listing. It must stop before `supabase login`, `supabase link`, secrets, deploy, migrations, SQL, scheduler mutation, Edge Function invocation, runtime endpoint calls, push, PR, or merge.

When John separately approves Supabase link/local secret readiness and the ledger status is `Supabase tooling/auth ready, not linked`, `scripts/run-next --allow supabase-link-secret-readiness` may run local Supabase link and ensure `IMPORT_REDDIT_TIPS_SECRET` exists only in `/home/johnh/.openclaw/.env`. It must stop before remote secret setup, deploy, migrations, SQL, scheduler mutation, Edge Function invocation, runtime endpoint calls, push, PR, or merge.

When John separately approves the combined scheduler draft and PR gate and the ledger status is `Supabase linked and local secret ready, not deployed`, `scripts/run-next --allow scheduler-draft-pr` may draft a guarded local scheduler migration, update docs, run local checks, create an exact-file commit, push the feature branch, and open or confirm a PR. It must stop at `Scheduler migration PR opened, not merged` and must not set remote secrets, deploy functions, run `db push`, apply migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push `main`, force-push, or merge.

When John separately approves the scheduler PR merge gate and the ledger status is `Scheduler migration PR opened, not merged` or `Scheduler migration draft merged, Supabase mutation still gated`, `scripts/run-next --allow scheduler-pr-merge` may inspect PR #12, verify exact changed files and expected commits, check PR state/checks/mergeability when still open, scan the scheduler migration for hardcoded secret-shaped values without printing matches, and merge PR #12 only if it is still open and clean. It must stop at `Scheduler migration draft merged, not applied` and must not set remote secrets, deploy functions, run `db push`, apply migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, force-push, or delete the branch.

When John separately approves Supabase remote secret setup and single Edge Function deploy and the ledger status is `Scheduler migration draft merged, not applied`, `scripts/run-next --allow supabase-secret-function-deploy` may verify source/auth/env, set remote `IMPORT_REDDIT_TIPS_SECRET` through a temporary env file, deploy only `import-reddit-tips`, and stop at `Function deployed and remote secret set, scheduler not applied`. It must block staged or tracked target repo changes, may only report untracked local artifacts as excluded, and must not mutate schedulers, run `db push`, apply migrations, execute SQL, invoke Edge Functions, call production endpoints, push, create PRs, merge, stage excluded files, or print secret values.

When John separately approves negative runtime verification and the ledger status is `Function deployed and remote secret set, scheduler not applied`, `scripts/run-next --allow runtime-negative-verification` may call the deployed `import-reddit-tips` endpoint only for rejection checks: `OPTIONS`, `GET`/non-POST, `POST` without auth, `POST` with an invalid scheduler secret, and optional anon-only `POST` if a local anon key is available without printing it. It must stop at `Runtime negative checks passed, scheduler not applied` or `Runtime negative checks failed, scheduler blocked`. It must not send a valid scheduler secret, send an admin bearer token, trigger a successful import/write, apply the scheduler, run `db push`, apply migrations, execute SQL, mutate pg_cron, set secrets, deploy functions, push, create PRs, merge, stage excluded files, or print token/secret values.

When John separately approves the combined function secret/deploy/negative-runtime gate and the ledger status is `Scheduler applied via Vault, runtime not verified`, `scripts/run-next --allow function-secret-deploy-negative-runtime` may verify source/env/project state, set remote `IMPORT_REDDIT_TIPS_SECRET` through a temporary env file outside the target repo, deploy only `import-reddit-tips`, and run only non-mutating runtime rejection checks. It must stop at `Function deployed, negative runtime verified, success path not run` unless a true no-write dry-run mode is proven and explicitly exercised. It must not run `db push`, apply migrations, execute SQL, mutate schedulers, write app tables or `pet_tips`, send a valid scheduler secret, send an admin success request, trigger a successful import, push, create PRs, merge, stage excluded files, or print token/secret values.

When John separately approves the controlled scheduler-path success invocation gate and the ledger status is `Function deployed, negative runtime verified, success path not run`, `scripts/run-next --allow controlled-success-invocation` may collect read-only `pet_tips` metadata before and after, run exactly one valid scheduler-secret POST to `import-reddit-tips`, and stop at `Controlled success invocation completed` or a precise blocked state. It must not deploy, run `db push`, apply migrations, mutate schedulers, run SQL writes, manually insert/update/delete `pet_tips`, run admin success, retry a successful import call, push, create PRs, merge, stage excluded files, or print token/secret values.

When John separately approves scheduled-run monitoring and production handoff prep and the ledger status is `Controlled success invocation completed`, `scripts/run-next --allow scheduled-run-monitoring-handoff` may inspect read-only scheduler metadata, cron run history, `pet_tips` metadata, and source/docs evidence. It must stop at `Scheduled run pending, production handoff ready`, `Scheduled run observed, production handoff ready`, or a precise blocked state. It must not invoke Edge Functions, call production endpoints, deploy, run `db push`, apply migrations, run SQL writes, mutate schedulers, write app tables or `pet_tips`, push, create PRs, merge, stage excluded files, or print token/secret values.

When John separately approves scheduler application decision work and the ledger status is `Runtime negative checks passed, scheduler not applied`, `scripts/run-next --allow scheduler-application-decision` may inspect source/docs, local env variable presence without values, Supabase CLI help, read-only project access, and read-only database capability evidence if a safe non-interactive path is available. It must prove a non-hardcoded `pg_cron` secret path for `x-import-reddit-tips-secret` before any scheduler mutation. If that proof is missing, it must stop at `Scheduler blocked: safe secret storage path not proven`; if a safe path is ever proven and implemented, it may apply only the `import-reddit-tips-daily` scheduler update and stop at `Scheduler applied, runtime success not verified`. It must not deploy functions, run `supabase db push`, apply migrations, execute unrelated SQL, write app tables or `pet_tips`, invoke a valid scheduler/admin success path, trigger a successful import, stage excluded files, push, create PRs, merge, or print token/secret values.

When John separately approves scheduler Vault design/apply work and the ledger status is `Scheduler blocked: safe secret storage path not proven`, `scripts/run-next --allow scheduler-vault-design-apply` may use local env values without printing them, require `SUPABASE_DB_URL` or `DATABASE_URL`, verify `psql`, inspect Vault/pg_cron/pg_net/current job metadata, create or update one Vault secret named `import_reddit_tips_scheduler_secret`, and replace only `import-reddit-tips-daily` with a Vault-backed `x-import-reddit-tips-secret` header if safe. It must stop at `Scheduler applied via Vault, runtime not verified`, `Needs John: database connection URL missing`, `Needs John: psql unavailable for non-interactive DB inspection`, or `Scheduler blocked: Vault/pg_cron/pg_net capability not proven`. It must not deploy functions, run `supabase db push`, apply migrations, execute unrelated SQL, write app tables or `pet_tips`, invoke a valid scheduler/admin success path, trigger a successful import, stage excluded files, push, create PRs, merge, print DB URLs, or print token/secret values.

When John separately approves scheduler Vault apply retry work and the ledger status is `Scheduler blocked: Vault/pg_cron/pg_net capability not proven`, `scripts/run-next --allow scheduler-vault-apply-retry` may retry DB connectivity, capability discovery, one Vault secret create/update, and one `import-reddit-tips-daily` scheduler replacement. It must stop at `Scheduler applied via Vault, runtime not verified`, `DB CONNECTIVITY BLOCKED`, or `Scheduler blocked: Vault/pg_cron/pg_net capability not proven`. It is not deploy, migration, runtime verification, unrelated SQL, app table write, `pet_tips` write, push, PR, merge, or secret-printing permission.

When John separately approves verification bundle self-test work and the ledger status is `Local verification and release evidence bundle built`, `scripts/run-next --allow verification-bundle-self-test` may run npm package readiness, release preflight, evidence-pack dry-run, helper syntax checks, skill cleanup, and skill validation against the selected repo. It must stop at `Verification bundle self-test complete` or a precise blocked state. Evidence-pack file writing requires the additional `--allow evidence-pack-write` flag and remains local-only under the selected repo `evidence/`; it is not permission to stage, commit, publish, tag, push, create PRs, deploy, mutate registries, read secret values, call external services, or call production endpoints.

When John separately approves the local skill workpack and the ledger status is `Verification bundle self-test complete`, `scripts/run-next --allow local-skill-workpack --allow evidence-pack-write` may run the local-only skills-library workpack against `/home/johnh/.openclaw/skills/coding-workflow-library`. It may harden verification classification, prove exactly one local evidence-pack write, run failure evidence classification, validate runtime verification extraction, validate GitHub lifecycle hardening, run helper syntax checks, run skill cleanup, and run skill validation. It must stop at `Local skill workpack complete` and must not touch product repos, publish npm, run `npm version`, tag, push, create PRs, deploy, run Supabase or Cloudflare commands, read secret values, mutate remote services, or call production endpoints.

When local route extraction is approved and the ledger status is `Local skill workpack complete`, add durable skill files and route metadata for proven embedded routes, validate with `scripts/route-audit` and `scripts/validate-skills`, and stop at `Embedded production lanes extracted into reusable routes`. This is local skills-library work only and is not permission for product repos, Supabase, Cloudflare, GitHub remote mutation, npm publish, release tags, secret reads, or production endpoint calls.

When John separately approves the Cloudflare/Opstruth/packaging bundle and the ledger status is `Embedded production lanes extracted into reusable routes`, `scripts/run-next --allow cloudflare-opstruth-packaging-bundle` may run only local route audit, library packaging readiness, release preflight local mode, helper syntax checks, skill cleanup, and skill validation against the skills library. It must stop at `Cloudflare Opstruth packaging routes extracted`. It must not touch product repos, deploy Cloudflare, run Wrangler deploy, publish npm, run `npm version`, tag, push, create PRs, set/read secrets, run Supabase commands, call production endpoints, or mutate remote services.

When John separately approves clean-temp readiness smoke and the ledger status is `Cloudflare Opstruth packaging routes extracted`, `scripts/run-next --allow clean-temp-readiness-smoke` may create a local temp copy under `/home/johnh/.openclaw/tmp/`, exclude `.git`, `.env`, `evidence/`, dependency caches, and credential-shaped files, run route audit, route listing, packaging readiness, open-source readiness classification, release preflight local mode, skill cleanup, and validation from the copied library, then remove the temp copy. It must stop at `Clean-temp readiness smoke complete`. It must not choose a license, create `package.json`, publish, run `npm version`, tag, push, create PRs, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate remote services, or touch product repos.

When John separately approves MIT licence/package candidate verification and the ledger status is `Clean-temp readiness smoke complete`, `scripts/run-next --allow license-package-candidate` may verify the approved MIT `LICENSE`, `LICENSE-DECISION.md`, `package.json`, open-source readiness, npm package readiness, and release preflight local mode. It must stop at `MIT licence and package candidate scaffold complete` and must not publish, run `npm version`, run `npm pack`, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate remote services, or touch product repos.

When John separately approves package candidate dry-run and the ledger status is `MIT licence and package candidate scaffold complete`, `scripts/run-next --allow package-candidate-dry-run` may verify package metadata, run package readiness, release preflight npm mode, `npm pack --dry-run`, package content inspection, clean-temp package smoke, route audit, skill cleanup, and validation. It must stop at `Package candidate dry-run complete` and must not publish, version, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate registries, mutate remote services, or choose a CLI entrypoint.

When John separately approves CLI entrypoint package smoke and the ledger status is `Package candidate dry-run complete`, `scripts/run-next --allow cli-package-smoke` may verify the local `coding-workflow` CLI wrapper, package `bin` metadata, package readiness with `--expect-cli`, release preflight in CLI mode, `npm pack --dry-run`, clean-temp local tarball install with lifecycle scripts disabled, installed CLI help/routes/validate commands, route audit, skill cleanup, and validation. It must stop at `CLI entrypoint package smoke complete` and must not publish, version, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate registries, install remote dependencies, or mutate remote services.

When John separately approves the first version tag gate and the ledger status is `GitHub open-source handoff complete`, `scripts/run-next --allow first-version-tag` may verify version `0.1.0`, changelog, release notes, local validation, package smoke, exact release commit, non-force `main` push, CI success for the release commit, annotated tag `v0.1.0`, remote tag dereference, and post-tag bookkeeping. It must stop at `v0.1.0 tagged and pushed, npm unpublished` and must not publish, run `npm version`, create a GitHub release, deploy, run Supabase or Cloudflare commands, print secrets, force-push, rewrite history, or stage broad/excluded paths.

When John separately approves official Supabase vendor-skill intake, install and inspect the vendor package only under `vendor-intake/`. Do not install vendor skills into the target repo, let vendor instructions override local gates, or continue into scheduler migration/deploy work in the same run. Adapt only useful guidance into local library files and keep the ledger at the current gated Supabase status unless a separate approved runner path changes it.

## When to Use

Use before starting multi-step coding workflow work, queue triage, handoff recovery, repo work with unclear permissions, or any task where the next safe skill is not already obvious.

Prefer invoking `scripts/run-next --dry-run` first when the active work already exists in `work-ledger.md`; then use the real `scripts/run-next` command only with explicit `--allow` flags covering the next action. Use `--allow pr-readiness` for read-only PR readiness inspection after a PR is open. Use `--allow pr-merge` only after John explicitly approves the merge gate. Use `--allow deployment-plan` only after John explicitly approves source-only deployment planning. Use `--allow supabase-preflight` only after John explicitly approves source/local Supabase execution preflight. Use `--allow supabase-tooling-auth` only after John explicitly approves Supabase tooling/auth setup. Use `--allow supabase-link-secret-readiness` only after John explicitly approves Supabase link/local secret readiness. Use `--allow scheduler-draft-pr` only after John explicitly approves the combined local scheduler draft, exact-file commit, feature-branch push, and PR gate. Use `--allow scheduler-pr-merge` only after John explicitly approves PR #12 readiness/merge and keep Supabase mutation gated. Use `--allow supabase-secret-function-deploy` only after John explicitly approves remote import secret setup and the single `import-reddit-tips` deploy. Use `--allow runtime-negative-verification` only after John explicitly approves deployed rejection checks and keep scheduler/application success paths gated. Use `--allow function-secret-deploy-negative-runtime` only after John explicitly approves the post-Vault correction gate: remote secret setup, deploy only `import-reddit-tips`, then non-mutating runtime checks before any success import. Use `--allow controlled-success-invocation` only after John explicitly approves one scheduler-path success POST with before/after read-only metadata. Use `--allow scheduled-run-monitoring-handoff` only after John explicitly approves read-only scheduler/database monitoring and final handoff prep; it must not invoke the function again. Use `--allow scheduler-application-decision` only after John explicitly approves the scheduler decision gate; it must prove safe non-hardcoded `pg_cron` secret handling before scheduler mutation or stop blocked. Use `--allow scheduler-vault-design-apply` only after John explicitly approves DB-backed Vault scheduler application; it must prove psql, Vault, pg_cron, pg_net, current job, and no literal secret in the cron command. Use `--allow scheduler-vault-apply-retry` only after John explicitly provides a corrected DB/capability path for the blocked Vault scheduler application; it must preserve all scheduler Vault safety boundaries. Use `--allow verification-bundle-self-test` only after John explicitly approves the local verification/release bundle route; add `--allow evidence-pack-write` only for local evidence file creation. Use `--allow local-skill-workpack --allow evidence-pack-write` only after John explicitly approves the local skills-library workpack from `Verification bundle self-test complete`. Use `--allow cloudflare-opstruth-packaging-bundle` only after John explicitly approves the local non-Supabase route extraction bundle from `Embedded production lanes extracted into reusable routes`. Use `--allow clean-temp-readiness-smoke` only after John explicitly approves portability/open-source readiness smoke from `Cloudflare Opstruth packaging routes extracted`; it is not license selection, package creation, release, publish, push, deploy, or product-repo permission. Use `--allow license-package-candidate`, `--allow package-candidate-dry-run`, and `--allow cli-package-smoke` only for their specific local package gates; none of them grants publish/version/tag/push/release/deploy/remote mutation permission. Vendor-skill intake is a separate advisory workflow, not a runner permission to mutate the target repo or Supabase.

Use `scripts/run-next --list-routes` and `scripts/route-audit` when reviewing route ownership. A route entry is local metadata, not permission to run a live action.

Use when a task needs one or more of:

- queue classification;
- permission boundary tracking;
- local repo gate checks;
- persistent work-ledger updates;
- one bounded step per loop;
- decision-ready owner prompts;
- evidence-first verification;
- skill validation;
- helper-script candidate capture.

Do not use this as a replacement for specialist skills. Use it to choose and coordinate them.

## Inputs Required

- `TARGET_REPO`: absolute path to the repo or workspace being worked on.
- `SKILLS_LIBRARY`: absolute path to this library, usually `/home/johnh/.openclaw/skills/coding-workflow-library`.
- Current objective or queue item.
- Current permission level granted by John.
- Known constraints, such as no deploys, no production mutation, no external API calls, or no target repo edits.
- Existing work state, including current run log and `work-ledger.md`.
- Any known target files, failing commands, evidence reports, or user-provided source of truth.

## Work Classification

Classify every item as exactly one of these statuses before acting:

Autonomous:

- bounded technical task;
- clear verification path;
- no credentials needed;
- no destructive production mutation;
- no product/security decision needed from John;
- can be completed with local evidence.

Needs John:

- product decision;
- pricing/business decision;
- security/privacy judgement;
- missing credential or external access;
- deploy/release/merge permission;
- destructive or irreversible action;
- unclear priority.

Blocked:

- missing files;
- missing repo;
- failed install;
- unavailable dependency;
- missing account access;
- failing command with no safe fix;
- unclear source of truth.

Ready to verify:

- source patch exists;
- needs lint/build/test/security scan;
- needs runtime proof;
- needs production check after deployment.

Ready to commit:

- local checks passed;
- diff reviewed;
- no secrets;
- no unrelated changes;
- commit message can be prepared.

Ready to deploy:

- build verified;
- deployment plan exists;
- required secrets/settings known;
- explicit deploy permission still required.

Completed:

- evidence collected;
- run log updated;
- repo state known;
- next skill recommended.

## Permission Gates

Treat these as separate permissions:

- triage/read-only inspection;
- local edits;
- dependency install;
- test/lint/build;
- git commit;
- git push;
- PR creation;
- production deploy;
- Supabase migration;
- database mutation;
- external API call;
- release/version/tag;
- merge/close.

Having one permission does not imply another.

Examples:

- permission to patch source does not mean permission to deploy;
- permission to push does not mean permission to merge;
- permission to run build does not mean permission to install dependencies;
- permission to inspect Supabase does not mean permission to run migrations.

If permission is missing, stop at the last authorized boundary and state the exact next permission needed.

## Local Repo Gate

Before acting on any repo, run or request these read-only checks:

```bash
pwd
ls -la "$TARGET_REPO"
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" diff --stat
```

If remote or GitHub work is in scope and the repo has a remote, inspect:

```bash
git -C "$TARGET_REPO" remote -v
git -C "$TARGET_REPO" log --oneline -5
```

Do not switch branch, stash, reset, clean, restore, commit, push, pull, or delete files without explicit permission.

If the repo has dirty files, classify whether they are:

- expected current task changes;
- unrelated pre-existing changes;
- generated artifacts;
- untracked evidence;
- risky unknown changes.

If the target is not a Git repo, record the Git failure, continue only with file-based evidence, and do not offer commit/push/PR/deploy next steps until repo state is clarified.

## Skill Selection Flow

Select from existing skills:

- repo orientation -> `repo-map-skill`;
- env/secrets/public-private config -> `env-audit-skill`;
- Supabase RLS/public anon safety -> `supabase-rls-audit-skill`;
- security finding/patch plan -> `security-hardening-review-skill`;
- local lint/build/test proof -> `build-verify-skill`;
- route/runtime behaviour -> `route-trace-skill`;
- Cloudflare deployment/runtime proof -> `cloudflare-deploy-skill`;
- GitHub blocked auth, invalid `gh` token, wrong active account, or account switch need -> `github-auth-gate-skill`;
- GitHub commit/push/PR handoff -> `github-handoff-skill`;
- migration review -> `migration-review-skill`;
- project KB creation/update -> `project-kb-builder-skill`;
- LLM drift/control issue -> `llm-drift-control-skill`;
- extracting more skills from logs -> `session-log-extraction-skill`.

Use `error-evidence-skill` as a failure handler when a command/tool/model/git operation fails. Use `tool-patterns-skill` when the main problem is safe coordination of local reads, writes, processes, or tool calls.

GitHub auth gate can run autonomously through local availability checks, environment-token presence checks, active account detection, and safe account switching when already authorized. It must stop only when actual credential provisioning or refresh is required from John.

If no skill fits:

- create a skill gap note;
- add it to `build-queue.md`;
- do not improvise silently.

## Work Ledger

The persistent work ledger lives at:

```text
/home/johnh/.openclaw/skills/coding-workflow-library/work-ledger.md
```

The orchestrator owns this file. Create it if it does not exist.

Each loop must record:

- active repo;
- current objective;
- current permission level;
- current status;
- selected skill;
- last commands run;
- files changed;
- validation evidence;
- blockers;
- next recommended skill;
- exact next action;
- whether John is needed.

Update the ledger before stopping, even when the loop stops because a permission is missing or a command failed.

## Commands

Inspect route metadata without mutating anything:

```bash
./scripts/run-next --list-routes
./scripts/route-audit
./scripts/route-audit --json
```

Read the library control files:

```bash
sed -n '1,260p' "$SKILLS_LIBRARY/RUNBOOK.md"
sed -n '1,260p' "$SKILLS_LIBRARY/skills-index.md"
sed -n '1,260p' "$SKILLS_LIBRARY/work-ledger.md"
```

Confirm the selected skill exists and read it:

```bash
ls -la "$SKILLS_LIBRARY/skill-files"
sed -n '1,260p' "$SKILLS_LIBRARY/skill-files/SELECTED_SKILL.md"
```

Run the local repo gate:

```bash
pwd
ls -la "$TARGET_REPO"
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" diff --stat
```

Use verification commands from the selected downstream skill. Do not invent test, deploy, migration, release, or provider commands.

## Procedure

1. Read `RUNBOOK.md`, this skill, and `skills-index.md`.
2. Prefer `scripts/run-next --dry-run` when the next work is represented in `work-ledger.md`.
3. If the dry-run reports a covered path and John has granted the required `--allow` flag, run `scripts/run-next` for the real bounded loop.
4. If `scripts/run-next` stops at an uncovered or John-required boundary, continue manually from this skill.
5. Read or create `work-ledger.md`.
6. Restate the objective, known constraints, current permission level, and assumptions.
7. Run the local repo gate.
8. Classify the work item using `Work Classification`.
9. Select the one downstream skill that best fits the next bounded step.
10. Read the selected skill before running its commands.
11. Check the needed permission gate before every new class of action.
12. If permission is missing, stop and ask only the exact decision-ready prompt needed.
13. Run one bounded work loop only. A bounded loop is one coherent unit such as map repo, inspect one failure, patch one issue, run one verification suite, prepare one handoff, or add one skill gap note.
14. Collect evidence before claiming progress.
15. Update `work-ledger.md`.
16. Update `runs/skill-runs.md` for real skill use.
17. Stop with the current classification, evidence, next recommended skill, and exact next action.

Decision-ready prompts must include:

- the decision John needs to make;
- evidence that makes the decision ready;
- the exact permission being requested;
- the consequence of yes;
- the consequence of no.

## Evidence Required

- Objective and target repo path.
- Local repo gate output or explicit no-git/missing-repo result.
- Work classification and reason.
- Permission gates granted, missing, and avoided.
- Selected downstream skill and why it fits.
- Commands/tools run and exact failures.
- Files inspected.
- Files changed.
- Verification evidence from the selected skill.
- Updated `work-ledger.md`.
- Updated `runs/skill-runs.md`.
- Next recommended skill and exact next action.

## Safety Rules

- Do not touch repos outside the target scope.
- Do not edit `/home/johnh/wagging-web-wins` unless John explicitly asks.
- Do not perform deep implementation unless the selected downstream skill authorizes it.
- Do not prompt randomly when evidence can decide the next safe step.
- Do not combine permission gates.
- Do not install dependencies without dependency-install permission.
- Do not run deploys, migrations, database mutations, external API calls, releases, tags, merges, or closes without explicit permission for that gate.
- Do not switch branch, stash, reset, clean, restore, commit, push, pull, or delete files without explicit permission.
- Do not print secrets.
- Do not claim completion until evidence, ledger, and run log are updated.

## Common Failures

- Skipping the repo gate and discovering unrelated dirty files too late.
- Treating a read-only audit as permission to patch.
- Treating a local patch as permission to build, commit, push, or deploy.
- Asking John vague priority questions instead of presenting a decision-ready owner prompt.
- Running multiple downstream skills deeply in one loop and losing the permission boundary.
- Selecting a weak or missing skill and improvising silently.
- Recording evidence in the final answer but not in the ledger or run log.
- Forgetting that no-git directories cannot support commit/push/PR readiness claims.

## Output Format

```text
# Coding Workflow Orchestrator Run

## Objective

## Target Repo

## Current Classification

## Permission Gates

Granted:
Missing:
Avoided:

## Local Repo Gate

## Selected Skill

## One Bounded Step Run

## Evidence Collected

## Files Changed

## Ledger Update

## Run Log Update

## Blockers

## Next Recommended Skill

## Exact Next Action

## John Needed
```

## Upgrade Ideas

- Create `scripts/orchestrate_next_step.sh` for repo gate, status classification prompts, and ledger skeleton output.
- Expand `scripts/run-next` beyond GitHub handoff into auth-check, exact-file commit, local-validation, and safe report-generation paths.
- Keep expanding PR readiness evidence into branch protection, review-thread, and CI-log summaries without adding merge permission.
- Create `scripts/update_work_ledger.mjs` to append normalized ledger entries.
- Create `scripts/classify_queue_item.mjs` for deterministic classification from evidence fields.
- Create `scripts/validate_skill_file.sh` to check required sections and index coverage.
- Create `scripts/add_skill_gap.mjs` to append safe gap notes to `build-queue.md`.
- Create an evidence-pack generator that merges repo gate output, selected-skill evidence, ledger status, and run-log status.
- Add first-class `github-open-source-handoff` and `first-version-tag` reporting that separates public source handoff, source tags, npm publish, `npm version`, and GitHub release approval.
