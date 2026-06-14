# Evidence Checklist

Use this before final response or before saying a workflow is complete.

## Universal

- `AGENTS.md` was read before the runbook or skill.
- Current workspace confirmed.
- Relevant files read.
- Missing files searched with case-insensitive lookup.
- Commands and tool calls separated into confirmed, suggested, and inferred.
- No secrets printed.
- No hidden/private reasoning included.
- Work ledger updated when orchestration was used.
- `./scripts/validate-skills` passed after skill-library edits.
- Validator proof is preferred over manual grep checks.
- Skill hygiene evidence collected with `./scripts/skill-cleaner` when skill overlap or bloat is in scope.
- Cleaner report evidence is advisory and separated from validator pass/fail evidence.
- Validator pass evidence is collected after cleanup edits.
- Tool permission evidence captured from `tools.md` before tool-heavy work.
- Tool availability evidence captured when a tool is not known to be installed.
- Before/after state evidence collected for mutating tools.

## Repo Mapping

- `pwd` captured.
- `rg --files` or `find` captured.
- `git status` captured or "not a git repo" reported.
- Important contract/config files identified.

## Orchestration

- Work item classified.
- Permission gates granted, missing, and avoided.
- Tool permission level checked against `tools.md`.
- `scripts/run-next --dry-run` used when a ledger-driven continuation is available.
- `scripts/run-next` real run used only with matching `--allow` flags.
- Runner stopped at a real permission/auth/repo-state boundary or recorded a PR URL.
- PR readiness inspection recorded PR metadata, changed files, commits, checks, mergeability/review evidence, local repo state, and an explicit readiness decision.
- PR readiness inspection did not merge.
- PR merge mode ran only with explicit `--allow pr-merge`.
- PR merge mode rechecked auth user, repo access, PR state, exact file scope, mergeability, PR checks, and repo-local workflow deployment evidence before merge.
- PR merge mode did not delete the branch, deploy, run migrations, mutate Supabase, call production endpoints, force push, push `main`, or include `evidence/`.
- After a successful PR merge, ledger status is `Merged, not deployed` and the next action is deployment planning or hold, not deployment itself.
- Deployment planning mode ran only with explicit `--allow deployment-plan`.
- Deployment planning mode inspected local/source evidence only: repo state, merged commit/source files, Supabase config/function source, scheduler references, package scripts, and CLI availability.
- Deployment planning mode drafted future commands as not run and did not set secrets, deploy, run migrations, mutate Supabase, update schedulers, call production endpoints, push, create PRs, merge, or include `evidence/`.
- After successful deployment planning, ledger status is `Deployment plan ready, not deployed` and the next action is an explicit Supabase secret/scheduler/deploy execution plan approval or hold.
- Supabase execution preflight mode ran only with explicit `--allow supabase-preflight`.
- Supabase execution preflight inspected local/source execution prerequisites only and did not install Supabase CLI, run `npx supabase`, log in, link, set secrets, deploy functions, run migrations, execute SQL, mutate schedulers, call runtime endpoints, push, create PRs, merge, or include `evidence/`.
- Supabase execution preflight produced project reference evidence, CLI availability, secret setup evidence without values, scheduler update decision, exact drafted sequence, blockers, and permission gates.
- After successful Supabase execution preflight, ledger status is `Supabase execution preflight ready, not executed`.
- Supabase tooling/auth mode ran only with explicit `--allow supabase-tooling-auth`.
- Supabase tooling/auth checked Node/npm/npx, local Supabase path, `npx supabase --version`, local env variable names/presence only, project-ref match/mismatch, and read-only project access only if `SUPABASE_ACCESS_TOKEN` was available.
- Supabase tooling/auth did not install Supabase CLI as a dependency, run login/link, set secrets, deploy, run migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push, create PRs, merge, or print secrets.
- After successful Supabase tooling/auth, ledger status is `Supabase tooling/auth ready, not linked`; otherwise the exact credential/tooling boundary is recorded.
- Supabase link/local secret readiness ran only with explicit `--allow supabase-link-secret-readiness`.
- Supabase link/local secret readiness checked repo state before and after link, reconfirmed auth/project access, ran local link only, and recorded any local Supabase files created by link without staging them.
- Supabase link/local secret readiness generated `IMPORT_REDDIT_TIPS_SECRET` only if missing and stored it only in `/home/johnh/.openclaw/.env`; no value, prefix, suffix, or length was printed.
- Supabase link/local secret readiness did not set remote secrets, deploy functions, run migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push, create PRs, merge, or include `evidence/`.
- Official vendor skill intake, when approved, installed only under `vendor-intake/<vendor-name>/`.
- Vendor intake evidence includes installed skill names, files inspected, useful guidance, local workflow differences, local adaptations, and validator results.
- Vendor guidance did not override `AGENTS.md`, `tools.md`, `scripts/run-next`, or permission gates, and did not touch the target repo.
- Local repo gate run or exact blocker recorded.
- Selected downstream skill read before use.
- Only one bounded work loop run before handoff or reclassification.
- Decision-ready owner prompt used when John is needed.
- `work-ledger.md` updated with next skill and exact next action.

## File Creation/Edit

- File path is inside writable workspace.
- File did not exist or was read before overwrite.
- Write/edit succeeded.
- Follow-up read or listing confirms file.
- Skill edits preserve frontmatter and required sections.
- Skill cleanup does not merge, deprecate, delete, or rename skills without John approval.

## Git

- `git status --short` or `git status -sb` checked.
- `git diff --check` run when repo exists.
- Exact-file diffs reviewed for changed files.
- Exact-file staging used if a commit was authorized.
- `git add .` avoided.
- `scripts/committer` dry-run used before commit preparation when available.
- Exact files staged recorded.
- Staged diff stat recorded.
- Secret scan on staged diff recorded without printing secret values.
- Secret scanner safe notes for runtime env/header access separated from fatal hardcoded literal findings.
- Commit hash recorded only if a local commit was approved and created.
- Final status recorded.
- Push not performed unless separately approved.
- Commit only if requested.
- Git identity failure handled by asking user before config changes.
- Unrelated dirty files left alone.

## GitHub Auth Gate

- `github-auth-gate-skill` selected when `gh auth status` fails or active account is unclear.
- `command -v gh` result captured.
- Target repo remote URL captured.
- Expected GitHub owner/repo identified from input or remote.
- `GH_TOKEN` and `GITHUB_TOKEN` presence checked without printing values.
- `gh auth status` summarized without token values.
- Active account recorded if available.
- Token scopes reported by name only if checked.
- Account switch result recorded if `gh auth switch` was authorized and run.
- Final status recorded as `PASS`, `NEEDS JOHN`, or `BLOCKED`.
- Push and PR work skipped unless separately permitted and auth gate returned `PASS`.
- Next skill recorded, usually `github-handoff-skill` after `PASS`.

## OpenClaw Route Trace

- `allowAgents` searched in config/docs.
- `agents_list` or `openclaw subagents list` checked.
- Smoke-test spawn used harmless prompt.
- History policy denial reported separately.
- Config permission broadening approved and verified.

## Config Diff

- Backup timestamps listed.
- Adjacent diffs compared.
- `diff -u -w` used if formatting noise exists.
- Functional changes separated from timestamp/formatting.
- Rollback command not run without explicit approval.

## Security Hardening

- Read-only host baseline run first.
- WSL/Windows boundary stated.
- Windows evidence requested when WSL cannot inspect.
- Proposed changes have spec, risk, evidence, rollback, and policy check.
- No firewall/remote-access changes without approval.

## Build/Verify

- Available tests/lint/build scripts discovered before use.
- No package-manager or deploy command invented.
- Evidence pack reviewed if present.
- Checks not run are stated clearly.
- Build success is not reported as production safety.
- Source-only verification and deployed runtime proof are separated.
- Live proof is collected when runtime behaviour is part of the claim.

## Market Scan

- Data source and as-of date included.
- Delayed/proxy data labeled.
- Missing data caveats included.
- Researcher notes do not become execution instructions.

## Cloudflare/Supabase/Migrations

- Repo commands discovered before any deploy/db action.
- No Cloudflare deploy, Supabase mutation, or migration apply command invented.
- `.env`, service keys, database URLs, and tokens not printed.
- Production mutation requires explicit approval.
- Source audit does not prove deployed state.
- Deployed RLS, secrets, Edge Function config, scheduler state, and runtime status remain unverified until checked.
- Secret findings are reported by path, line, key name, and risk category only.
