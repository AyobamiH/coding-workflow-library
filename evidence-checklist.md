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
- Verification bundle self-test used `--allow verification-bundle-self-test` only when the active ledger status was `Local verification and release evidence bundle built`.
- Verification bundle self-test defaulted to `scripts/evidence-pack --dry-run`; any local evidence-file creation used the extra `--allow evidence-pack-write` gate.
- Verification bundle self-test did not publish, tag, push, create PRs, deploy, mutate registries, read secret values, call external services, or call production endpoints.
- Cloudflare/Opstruth/packaging bundle used `--allow cloudflare-opstruth-packaging-bundle` only when the active ledger status was `Embedded production lanes extracted into reusable routes`.
- Cloudflare/Opstruth/packaging bundle ran local route audit, library packaging readiness, release preflight local mode, skill cleanup, and skill validation only.
- Cloudflare/Opstruth/packaging bundle did not touch product repos, deploy Cloudflare, run Wrangler deploy, publish npm, run version changes, tag, push, create PRs, set/read secrets, run Supabase commands, call production endpoints, or mutate remote services.
- Clean-temp readiness smoke used `--allow clean-temp-readiness-smoke` only when the active ledger status was `Cloudflare Opstruth packaging routes extracted`.
- Clean-temp readiness smoke created a temp copy under `/home/johnh/.openclaw/tmp/`, excluded `.git`, `.env`, evidence, dependency caches, and credential-shaped files, and removed the temp copy after checks.
- Clean-temp readiness smoke ran route audit, route listing, packaging readiness, open-source readiness classification, release preflight local mode, skill cleanup, and validation from the temp copy.
- Clean-temp readiness smoke did not touch product repos, choose a license, create a package, publish, tag, push, create PRs, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, or mutate remote services.
- MIT licence and package candidate verification used `--allow license-package-candidate` only when the active ledger status was `Clean-temp readiness smoke complete`.
- MIT licence and package candidate verification confirmed `LICENSE`, `LICENSE-DECISION.md`, `package.json`, package-name blocker, open-source readiness, npm package readiness, and release preflight local evidence.
- MIT licence and package candidate verification did not publish, version, pack, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate remote services, or touch product repos.
- Package candidate dry-run used `--allow package-candidate-dry-run` only when the active ledger status was `MIT licence and package candidate scaffold complete`.
- Package candidate dry-run confirmed package candidate name `autonomous-coding-workflow-library`, repository identity `AyobamiH/coding-workflow-library`, MIT metadata, version `0.0.0`, files allowlist, no CLI `bin`, package readiness, release preflight npm mode, `npm pack --dry-run`, package contents risk inspection, clean-temp package smoke, route audit, and validation.
- Package candidate dry-run did not publish, version, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate registries, mutate remote services, or choose a CLI entrypoint.
- CLI entrypoint package smoke used `--allow cli-package-smoke` only when the active ledger status was `Package candidate dry-run complete`.
- CLI entrypoint package smoke confirmed package `bin` metadata for `coding-workflow`, executable wrapper syntax, local CLI help/routes/package-readiness/release-preflight results, package readiness with `--expect-cli`, release preflight CLI mode, `npm pack --dry-run`, package contents risk inspection, clean-temp local tarball install, installed CLI help/routes/validate results, temp cleanup, route audit, skill cleanup, and validation.
- CLI entrypoint package smoke did not publish, version, tag, push, create PRs, create GitHub releases, deploy, run Supabase or Cloudflare commands, read secrets, call production endpoints, mutate registries, install remote dependencies, mutate remote services, or touch product repos.
- First version tag used `--allow first-version-tag` only when the active ledger status was `GitHub open-source handoff complete` or a documented retry state.
- First version tag must confirm package and lockfile version `0.1.0`, changelog entry, release notes, local validation, clean-temp tarball smoke, exact release commit, non-force `main` push, GitHub Actions success for that release commit, annotated tag `v0.1.0`, remote tag dereference to the release commit, post-tag bookkeeping commit, final validation, and route verification.
- First version tag must not publish, run `npm version`, create a GitHub release, deploy, run Supabase or Cloudflare commands, call production endpoints, print secrets, force-push, rewrite history, stage broad/excluded paths, or touch product repos.
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

## Route Metadata

- `routes/skill-routes.json` inspected when adding or extracting reusable workflow routes.
- Route id recorded.
- Referenced skill file exists.
- Referenced local helper scripts exist, or helper is explicitly marked external/manual.
- Permission flag is non-empty and matches the intended gate.
- Forbidden actions are present for every route.
- Success ledger state is non-empty.
- Blocked ledger state is non-empty.
- Next permission is non-empty.
- Evidence requirements are non-empty.
- `./scripts/route-audit` passed after route edits.
- `./scripts/validate-skills` passed after route edits.
- New reusable production-lane skills have route metadata or a deliberate hold reason.
- Product-specific live actions remain explicitly gated and are not granted by route metadata.

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

## Evidence Pack

- `evidence-pack-builder-skill` selected when durable local handoff evidence is requested.
- Evidence pack dry-run used before writing files unless John already approved local evidence creation.
- Evidence output path recorded.
- Evidence files written only under an approved local evidence path.
- Evidence-pack writes through `scripts/run-next` require both `--allow verification-bundle-self-test` and `--allow evidence-pack-write`; otherwise dry-run is required.
- `.env` files and credential files not read.
- Secret values, token values, DB URLs, prefixes, suffixes, and lengths not printed.
- Evidence files not staged or committed automatically.
- Commands not run and next safe step recorded.

## NPM Package Readiness

- `npm-package-readiness-skill` selected before npm package or CLI distribution decisions.
- `package.json` inspected for name, version, description, license, bin, files, and scripts.
- Bin targets verified when present.
- Lockfile result recorded.
- README and release-note/changelog result recorded.
- `npm pack --dry-run` run only when explicitly allowed.
- `npm publish`, version changes, dependency installs, registry mutations, token reads, tags, pushes, and release creation avoided.
- Final classification recorded as `PASS`, `WARN`, `FAIL`, `NOT_VERIFIED`, or `NOT_APPLICABLE`.
- Missing `package.json` without `--expect-package` treated as `NOT_APPLICABLE` or warning, not a package-readiness failure.
- Missing `package.json` with `--expect-package` treated as failure.
- Missing CLI bin with `--expect-cli` treated as failure.

## Release Preflight

- `release-preflight-skill` selected before publish/tag/push/deploy handoff.
- Mode recorded: `local`, `npm`, or `cli`.
- Git state and tag-at-HEAD evidence captured without creating tags.
- Package readiness result included.
- Evidence pack dry-run or output path included.
- README and release notes checked.
- Local mode did not fail merely because the repo is not an npm package.
- Npm mode expected npm package readiness.
- CLI mode expected package and bin readiness.
- Publish, tag, push, deploy, registry mutation, and GitHub release boundaries stated clearly.
- Autonomous verification self-test recorded package readiness classification, release preflight classification, evidence-pack mode, helper syntax checks, skill-cleaner result, validator result, and the next permission boundary.
- Next safe step recorded.

## Failure Evidence

- `error-evidence-skill` selected for failed commands or blocked routes.
- Exact failing command/tool and sanitized error captured.
- `scripts/failure-evidence` used for long or repeated logs when useful.
- Classification recorded, such as missing credential, invalid credential, network unreachable, direct-host/pooler issue, CLI unavailable, auth unavailable, permission denied, merge blocked, validation failed, unsafe secret exposure risk, external mutation not permitted, or env format issue.
- Recovery class recorded: retry-safe, John-required, or hard-stop.
- Suggested ledger state recorded.
- Secret-shaped values redacted.

## Runtime Verification

- `runtime-verification-skill` selected before live endpoint, webhook, scheduler, worker, job, or deployed function checks.

## Opstruth Runtime Truth

- `opstruth-runtime-truth-skill` selected when claims need proof classification.
- Claim under review recorded.
- Evidence sources recorded.
- Commands run and commands not run separated.
- Each claim classified as `Verified`, `Warning`, `Failure`, `Skipped`, or `Not Verified`.
- Source-only evidence separated from deployed/runtime evidence.
- `Skipped` and `Not Verified` were not reported as passes.
- Evidence-pack decision recorded.
- Next safe step recorded.

## Skills Library Packaging

- `skills-library-packaging-skill` selected before packaging/open-source readiness decisions.
- `scripts/library-packaging-readiness` run when available.
- Intended shape recorded: local library, reusable template, npm package candidate, CLI package candidate, or published package.
- Core docs, skill files, route manifest, helper scripts, templates, tests, docs, license, and release notes checked.
- Missing `package.json` treated as acceptable unless npm/CLI packaging is expected.
- Open-source readiness separated from local-library readiness.
- `LICENSE-DECISION.md` recorded as a decision placeholder only, not as a chosen license.
- Missing license recorded as `NEEDS JOHN: licence decision` when open-source/npm/CLI readiness is expected.
- Changelog/release notes recorded as release-readiness evidence, not a local-library requirement.
- Clean-temp copy checks recorded when portability is the claim.
- Publish, version, tag, push, GitHub release, product-repo install, secrets, and deploy boundaries stated clearly.
- Final classification and next permission recorded.
- Source inspected before runtime calls.
- Runtime permission gate recorded: negative checks, dry-run success, controlled success, or scheduled monitoring.
- Write and side-effect map recorded.
- No-write dry-run proof recorded before any dry-run success call.
- Negative checks avoided real secrets, admin auth, and success payloads.
- Controlled success ran only with explicit separate permission and exactly scoped before/after read-only evidence.
- Scheduled monitoring did not manually trigger jobs unless separately approved.
- Sanitized status codes and response summaries recorded.

## Local Skill Workpack

- Ledger state was `Verification bundle self-test complete`.
- `scripts/run-next` used `--allow local-skill-workpack`.
- Evidence-pack write proof used the additional `--allow evidence-pack-write` flag.
- Exactly one local evidence pack path recorded under the skills library `evidence/`.
- No product repos, Supabase, Cloudflare, GitHub remotes, npm publish, version changes, tags, pushes, PRs, deploys, secret reads, remote mutations, or production endpoints were used.
- `node --check`, `scripts/skill-cleaner`, and `scripts/validate-skills` results recorded.

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
# GitHub Open-Source Handoff Evidence

- Public hardening files: `.gitignore`, `CONTRIBUTING.md`, `SECURITY.md`, `.github/workflows/validate.yml`, and architecture/docs as needed.
- Package quality scripts: `check:js`, `test`, package readiness, release preflight, and pack dry-run.
- GitHub auth account: account name only, never token values or token shapes.
- Repository preflight: whether `AyobamiH/coding-workflow-library` exists, visibility, default branch, and empty/conflict decision.
- Exact files staged and committed, with no `evidence/`, env, temp, cache, tarball, or private runtime files.
- Commit hash, branch, remote URL, push result, and remote `main` HEAD matching local HEAD.
- Explicit commands not run: npm publish, npm version, git tag, GitHub release, deploy, Supabase, Cloudflare, production endpoints, force push, broad staging.
