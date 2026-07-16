# Coding Workflow Skills Library

This library converts the workflow extraction in `<WORKFLOW_EXTRACTION_SOURCE>` into local, operational Markdown skill files.

Use this library when another LLM needs reusable instructions for repo mapping, session-log extraction, OpenClaw route tracing, environment audits, security hardening review, verification, and error triage.

`AGENTS.md` is the first file an agent must read. It contains the hard rules for permissions, repo safety, secrets, evidence, source-only proof, and skill routing.

`RUNBOOK.md` is operational guidance after the hard rules are understood. `coding-workflow-orchestrator-skill` decides the next safe work item when the path is not obvious.

## Portable Paths

Public documentation and evidence use semantic placeholders such as `<LIBRARY_REPO>`, `<TARGET_REPO>`, `<LOCAL_ENV_FILE>`, and `<TEMP_ROOT>`. Replace them locally; never commit a maintainer-specific absolute home-directory path.

`scripts/run-next` uses the caller's current working directory when `--repo` is omitted. Runtime locations can be overridden without editing tracked files:

- `CODING_WORKFLOW_HOME`: local runtime root; the compatibility default is `$HOME/.openclaw`.
- `CODING_WORKFLOW_ENV_FILE`: local env file; the default is `$CODING_WORKFLOW_HOME/.env`.
- `CODING_WORKFLOW_TMPDIR`: temporary work root; the default is under the operating system temp directory.
- `CODING_WORKFLOW_NPM_CACHE`: npm cache used by package smoke helpers; the default is under the workflow temp root.

Run `npm run check:paths` before public commits or packaging. It scans tracked or packaged text files for Linux, macOS, and Windows user-home paths and reports only file, line, and category.

## Layout

```text
skills/coding-workflow-library/
  AGENTS.md
  CHANGELOG.md
  LICENSE
  LICENSE-DECISION.md
  package.json
  package-lock.json
  README.md
  RUNBOOK.md
  skills-index.md
  build-queue.md
  command-library.md
  tools.md
  tool-patterns.md
  evidence-checklist.md
  work-ledger.md
  routes/
    skill-routes.json
  schemas/
    work-lanes.schema.json
    approval-registry.schema.json
    decision-record.schema.json
    workflow-corpus.schema.json
    workflow-source-manifest.schema.json
    repo-map.schema.json
    project-kb.schema.json
    pre-commit-check.schema.json
    migration-review.schema.json
    browser-live-proof.schema.json
    github-deep-review.schema.json
    opstruth-runtime-truth.schema.json
  runs/
    decisions/
    skill-runs.md
  state/
    approval-registry.json
  bin/
    coding-workflow.js
  scripts/
    committer
    autonomous-boundaries
    objective-authority
    lane-state
    evidence-pack
    failure-evidence
    library-packaging-readiness
    npm-package-readiness
    release-preflight
    extract-session-workflows.mjs
    docs-list
    repo-map
    project-kb
    pre-commit-check
    check-public-paths
    migration-review
    browser-live-proof
    github-deep-review
    opstruth-classify
    install-git-hooks
    run-next
    route-audit
    skill-cleaner
    validate-skills
  templates/
    hooks/
      pre-commit
    repo-agents-pointer-template.md
    skill-run-template.md
    new-skill-template.md
    skill-upgrade-template.md
    evidence-report-template.md
    workflow-extraction-config.example.json
  tests/
    objective-authority.test.js
    workflow-extraction.test.js
    docs-list.test.js
    repo-map.test.js
    project-kb.test.js
    pre-commit-check.test.js
    migration-review.test.js
    browser-live-proof.test.js
    github-deep-review.test.js
    opstruth-classify.test.js
    public-paths.test.js
    library-validation-checklist.md
  skill-files/
    coding-workflow-orchestrator-skill.md
    session-log-extraction-skill.md
    repo-map-skill.md
    route-trace-skill.md
    env-audit-skill.md
    build-verify-skill.md
    evidence-pack-builder-skill.md
    npm-package-readiness-skill.md
    skills-library-packaging-skill.md
    release-preflight-skill.md
    runtime-verification-skill.md
    browser-live-proof-skill.md
    github-deep-review-skill.md
    opstruth-runtime-truth-skill.md
    supabase-function-deploy-skill.md
    supabase-scheduler-vault-skill.md
    production-handoff-skill.md
    error-evidence-skill.md
    openclaw-config-diff-skill.md
    security-hardening-review-skill.md
    llm-drift-control-skill.md
    github-auth-gate-skill.md
    github-handoff-skill.md
    project-kb-builder-skill.md
    capability-intelligence-builder-skill.md
    public-market-scan-skill.md
    cloudflare-deploy-skill.md
    supabase-rls-audit-skill.md
    migration-review-skill.md
    tool-patterns-skill.md
    skill-cleaner-skill.md
```

## Frontmatter Routing

Every file in `skill-files/*.md` starts with YAML frontmatter:

```yaml
---
name: skill-name
description: short operational description
category: skill-system
routing_triggers:
  - trigger phrase
  - trigger phrase
status: active
---
```

The frontmatter is the routing contract. `name` must match the filename without `.md`; `description` should be short and concrete; `routing_triggers` should contain two to six phrases; `status` must be `active`, `draft`, or `deprecated`.

## How To Use

1. Read `AGENTS.md` first.
2. Read `RUNBOOK.md` for operational guidance.
3. Prefer `scripts/run-next` for the autonomous work loop when the next action should come from `work-ledger.md`.
4. Use `routes/skill-routes.json` and `./scripts/run-next --list-routes` to see which reusable skill owns a ledger route.
5. Use `coding-workflow-orchestrator-skill` manually when `scripts/run-next` cannot cover the current state.
6. Pick the relevant downstream skill from frontmatter routing, route metadata, and `skills-index.md`.
7. Open the matching file under `skill-files/`.
8. State why the skill was selected before acting.
9. Follow its commands, procedure, evidence requirements, and safety rules.
10. Use `command-library.md` only as a command source; do not treat every command as safe for every task.
11. Use `evidence-checklist.md` before final response.
12. Record orchestration state in `work-ledger.md` and the completed skill run in `runs/skill-runs.md`.

## Capability Intelligence Work

Use `capability-intelligence-builder-skill` when a separate product needs a complete local inventory of agent skills, plugins, tools, connectors, hooks, commands, and workflow resources. The skill defines source reconciliation, lifecycle truth, evidence levels, privacy exclusions, strict coverage, duplicate handling, outcome matching, and validation expectations.

The target product remains independent. This library provides the reusable engineering workflow and may be inventoried as a resource provider; it does not host the product implementation or replace autonomous workflow routing with capability discovery.

## Project-Scoped Workflow Lanes

`work-ledger.md` is retained as historical library evidence. Active multi-project execution state should live in a local lane file outside the repository, defaulting to `$HOME/.coding-workflow/lanes.json` or supplied with `--state-file`.

```bash
./scripts/lane-state --state-file /path/to/lanes.json list
./scripts/run-next --list-lanes --state-file /path/to/lanes.json
./scripts/run-next --lane example-project --state-file /path/to/lanes.json --explain-next
./scripts/run-next --lane example-project --state-file /path/to/lanes.json --dry-run --allow <permission>
```

Lane files must never contain secrets. The tracked schema and example are portable; real repo paths, product evidence, and monitoring baselines remain local. Omitting `--lane` preserves legacy ledger routing.

## Reproducible Workflow Corpus

Use the extractor when backlog, skill-roadmap, or agent-role decisions need historical evidence instead of memory:

```bash
node scripts/extract-session-workflows.mjs \
  --source /path/to/local/sessions \
  --output-dir /private/workflow-corpus

node scripts/extract-session-workflows.mjs \
  --output-dir /private/workflow-corpus \
  --validate-only

node scripts/extract-session-workflows.mjs \
  --source /path/to/local/sessions \
  --output-dir /private/workflow-corpus-next \
  --compare-to /private/workflow-corpus \
  --require-unchanged

coding-workflow extract-workflows \
  --source /path/to/local/sessions \
  --output-dir /private/workflow-corpus
```

Generated corpus files, snapshots, comparisons, and `pseudonym-map.json` must stay outside the package repository. `workflow-snapshot.json` fingerprints content-derived manifest, corpus, and coverage components while omitting source mtimes, local paths, transcript bodies, and pseudonym mappings. `--compare-to` reports only changed component names, safe count deltas, and fingerprints; drift is informational unless `--require-unchanged` is supplied. Public docs may use only aggregate counts and safe classifications. See `docs/workflow-extraction-methodology.md`, `docs/workflow-corpus-recovery-report.md`, and `docs/agent-and-skill-roadmap.md`.

## Documentation Inventory

Use `scripts/docs-list` before broad documentation work so existing guidance is discovered before new docs are created:

```bash
./scripts/docs-list
./scripts/docs-list --json
./scripts/docs-list --orphans
./scripts/docs-list --validate

coding-workflow docs-list --validate
```

The helper inventories tracked Markdown documentation, classifies each file by repository area, extracts the first H1, reports duplicate titles, and checks whether current docs are referenced by the expected index/control documents. Historical release notes, run logs, and evidence notes are listed but are not treated as current-document orphan failures. It does not call an LLM, rewrite docs, inspect private corpus outputs, read secrets, publish, deploy, push, tag, or mutate external services.

## Repository Map

Use `scripts/repo-map` before editing an unfamiliar workspace so the agent has deterministic source-only orientation evidence:

```bash
./scripts/repo-map --repo /path/to/repo
./scripts/repo-map --repo /path/to/repo --json
./scripts/repo-map --repo /path/to/repo --validate

coding-workflow repo-map --repo /path/to/repo --validate
```

The helper reports git state, top-level files and directories, detected languages, package/config markers, safe package scripts, command candidates, documentation summary from `scripts/docs-list`, source/database directories, environment-file presence without values, and secret-surface warning categories. It works for Git and non-Git directories. It does not install dependencies, run build/test commands in the target repo, mutate git, read `.env` values, call external services, inspect private corpus output, publish, deploy, push, tag, or prove runtime behaviour.

## Project Knowledge Base

Use `scripts/project-kb` after `repo-map` and `docs-list` when a repo needs durable, source-only handoff context:

```bash
./scripts/project-kb --repo /path/to/repo --dry-run
./scripts/project-kb --repo /path/to/repo --json
./scripts/project-kb --repo /path/to/repo --validate
./scripts/project-kb --repo /path/to/repo --output /path/to/PROJECT_KB.md

coding-workflow project-kb --repo /path/to/repo --validate
```

The compiler synthesizes deterministic facts about project identity, repository shape, stack, commands, documentation, skills/routes, validation gates, source-only safety boundaries, verified facts, and unknowns. It does not read `.env` values, raw session transcripts, private corpus output, caches, temp data, or generated evidence. It does not install dependencies, run target build/test commands, mutate git, call services, publish, deploy, or prove runtime behaviour.

## Migration Review

Use `scripts/migration-review` after `repo-map` and before any migration apply, deploy, Supabase command, or production mutation. It performs source-only SQL risk classification for common migration directories:

```bash
./scripts/migration-review --repo /path/to/repo
./scripts/migration-review --repo /path/to/repo --json
./scripts/migration-review --repo /path/to/repo --validate
./scripts/migration-review --repo /path/to/repo --migrations-dir supabase/migrations

coding-workflow migration-review --repo /path/to/repo --validate
```

The helper reports relative migration paths, ordering prefixes, statement categories, risk categories, rollback hints, RLS/policy changes, grants/revokes, functions, triggers, extensions, pg_cron/pg_net, Vault references, destructive/data-mutation patterns, and secret-shaped findings by category only. It never executes SQL, connects to a database, runs Supabase CLI, applies migrations, deploys, mutates files, reads `.env` values, prints secret values, or proves deployed database truth. High-risk findings should block apply/deploy decisions until a separate authority gate and human review approve the next step.

## Browser Live Proof

Use `scripts/browser-live-proof` after source, build, and local runtime checks to collect one bounded Chromium observation:

```bash
./scripts/browser-live-proof \
  --url http://127.0.0.1:4173 \
  --viewport 390x844 \
  --screenshot /tmp/browser-proof-mobile.png \
  --validate

coding-workflow browser-live-proof \
  --url http://127.0.0.1:4173 \
  --viewport 1440x900 \
  --json \
  --validate
```

The helper defaults to loopback targets. `--allow-remote` permits one explicitly selected read-only remote navigation. It records safe URL metadata, redirect boundaries, requested-versus-observed viewport dimensions, horizontal overflow, basic accessibility counts, count-only console/network classifications, and optional PNG validity/nonblank sampling. Cross-origin redirects, viewport mismatches, and one-color screenshot samples are warnings, not silent passes. It never clicks, submits forms, logs in, prints raw console messages, emits headers/bodies/cookies/storage/page text, or treats one browser observation as proof of deployment history, database state, authentication paths, production correctness, or ongoing reliability.

## GitHub Deep Review

Use `scripts/github-deep-review` after the GitHub auth gate when a pull request needs thread-aware evidence beyond flat comments and top-level check status:

```bash
./scripts/github-deep-review --repo OWNER/REPO --pr 123
./scripts/github-deep-review --repo OWNER/REPO --pr 123 --json --validate
./scripts/github-deep-review --repo OWNER/REPO --pr 123 --inspect-failed-checks

coding-workflow github-deep-review --repo OWNER/REPO --pr 123 --validate
```

The helper reads exact changed files, review-thread resolution/outdated state, each reviewer's latest decision, approvals against an older head, checks, and branch-protection metadata when available. Ambiguous GitHub 404 responses remain `METADATA_UNAVAILABLE`; they are not proof that protection is absent. Optional failed-log inspection emits categories only; raw logs are never returned. Review excerpts and Linux, macOS, and Windows private paths are bounded/redacted. The command never replies, resolves threads, submits reviews, commits, pushes, merges, or treats `READY_FOR_HANDOFF` as merge permission. GitHub CI evidence remains separate from deployment and production evidence.

## OpsTruth Runtime-Truth Classifier

Use `scripts/opstruth-classify` to turn an explicit redacted evidence manifest into a deterministic truth table, or to verify the classifier itself with the built-in mixed fixture:

```bash
./scripts/opstruth-classify --self-test --json --validate
./scripts/opstruth-classify --input /path/to/redacted-evidence.json --json --validate
./scripts/opstruth-classify --input /path/to/redacted-evidence.json --strict

coding-workflow opstruth-classify --self-test --validate
```

Claims declare the scopes they require, such as `source`, `local_validation`, `ci`, `browser`, `deployment`, `runtime`, `database`, `registry`, or `production`. Evidence can only verify a matching required scope when it is direct, current, and passing. The built-in self-test must produce exactly one `VERIFIED`, `WARNING`, `FAILURE`, `SKIPPED`, and `NOT_VERIFIED` claim while proving that CI is not deployment or production evidence. The helper performs no network calls, executes no evidence commands, writes no files, and rejects raw-log fields, secret-shaped material, and private absolute paths.

## Objective-Level Autonomy

The system requests authority for consequences, not permission for every tool call.

Each lane may carry an active objective with an authority envelope. `local_execution` is granted by default for normal local work. Consequence-bearing classes are granted once per objective:

- `remote_publication`: push, PR mutation, merge, tag push, GitHub Release, npm publish, public repository settings.
- `production_mutation`: deploys, migrations, SQL writes, scheduler/Vault changes, app-data writes, production success calls.
- `secret_mutation`: setting or rotating external secrets.
- `destructive_action`: force push, history rewrite, deletion, destructive migrations, teardown.

Child skills inherit the parent objective authority. Capability failures are recorded separately from permission: unavailable npm auth, missing `gh`, missing DB URL, or absent binaries are `BLOCKED_CAPABILITY`, while failed tests or unsafe package contents are `BLOCKED_SAFETY`.

Normal verified workflow-authored PR merge is part of `remote_publication`, not a separate John boundary. The runner may merge by normal repository rules only when checks pass, the reviewed head has not changed, the diff scope is intended, and repository policy does not require a different human reviewer. A merge moves the workflow into `POST_MERGE_VERIFY`; completion is recorded only after exact-commit and remote-alignment evidence are captured.

```bash
coding-workflow objective show --lane example-project --state-file /path/to/lanes.json
coding-workflow objective approve --lane example-project --grant remote_publication --state-file /path/to/lanes.json
coding-workflow run-next --lane example-project --state-file /path/to/lanes.json --until-blocked
coding-workflow resume --lane example-project --state-file /path/to/lanes.json
```

Legacy `--allow <route>` flags remain compatible. In lane mode, new work should prefer objective authority classes so one `remote_publication` grant covers the approved push, tag, GitHub Release, and npm publication consequences for that objective.

## Interrupted Runs

`run-next` records safe local checkpoint metadata for real runs under `.run-next/`, which is ignored by git.

```bash
./scripts/run-next --repo /path/to/repo --status
./scripts/run-next --repo /path/to/repo --resume --dry-run
```

Resume mode verifies branch, tracked changes, required permissions, and checkpoint validity before continuing. It does not store secret values or command output bodies.

## Zero-Output Pipeline Diagnostics

When infrastructure succeeds but business output is empty, use the source-only tracer before any new production invocation:

```bash
./scripts/pipeline-diagnostics --source /path/to/pipeline-source
./scripts/run-next --lane <lane-id> --state-file /path/to/lanes.json --repo /path/to/repo --dry-run --allow zero-output-investigation
```

The route combines `route-trace-skill`, `runtime-verification-skill`, and `error-evidence-skill`. It traces counter assignments and stage attrition, reproduces approved database-backed counts read-only, and stops at `EVIDENCE_INSUFFICIENT` when upstream or per-filter evidence is absent. It does not invoke jobs, fetch external sources, write data, deploy, or edit product code without a separately proven defect and permission.

If the missing boundary requires instrumentation, use a separate count-only observability gate:

```bash
./scripts/run-next --lane <lane-id> --state-file /path/to/lanes.json --repo /path/to/repo --dry-run --allow zero-output-observability-patch
./scripts/run-next --lane <lane-id> --state-file /path/to/lanes.json --repo /path/to/repo --allow zero-output-observability-patch
```

That route validates local aggregate telemetry only. Commit, PR, deploy, and automatic-run recheck remain separate consequence classes, and the recheck uses `--allow observability-run-recheck`. Normal verified workflow-authored PR merge follows the automatic merge policy when `remote_publication` is granted.

## Route Metadata

`routes/skill-routes.json` is the local manifest that connects ledger states to reusable skills, permission flags, helper scripts, forbidden actions, success states, blocked states, next permissions, and evidence requirements.

This manifest does not grant permission and does not call external services. It exists so proven runner paths do not stay trapped inside `scripts/run-next` as undocumented production logic.

```bash
cd <LIBRARY_REPO>
./scripts/run-next --list-routes
./scripts/route-audit
./scripts/route-audit --json
```

A reusable skill is incomplete until it has route metadata or an explicit hold reason in `build-queue.md`. Manual helpers are allowed, but they should not remain orphaned from route metadata once a workflow is proven.

## Validation

Run the validator before handoff after any skill or library routing edit:

```bash
cd <LIBRARY_REPO>
./scripts/validate-skills
```

The validator checks required files, skill frontmatter, required skill sections, active skill index coverage, duplicate names, placeholder markers, and secret-shaped markers with noisy self-hits filtered.

The validator also checks route metadata for missing skill files, missing helper scripts, duplicate route ids, empty permission flags, and empty success or blocked ledger states.

## Tool Catalogue

`tools.md` is the local tool catalogue. It defines tool permission levels, safe and unsafe examples, approval requirements, and evidence expectations.

The orchestrator and skills should consult `tools.md` before tool-heavy work, especially when commands may install dependencies, edit files, mutate git, call GitHub, access secrets, deploy, touch databases, call production endpoints, or change cloud resources.

## Skill Hygiene

`skill-cleaner-skill` keeps the library small and routable.

`./scripts/validate-skills` is pass/fail validation. `./scripts/skill-cleaner` is advisory cleanup intelligence for duplicates, bloat, stale skills, weak routing, and overlap.

Long safety-critical skills may declare a reviewed `shape_exception` with a concrete co-location reason. The cleaner reports those separately; it does not hide unreviewed oversize files, duplicate triggers, or long routing descriptions.

```bash
cd <LIBRARY_REPO>
./scripts/skill-cleaner
./scripts/validate-skills
```

## Exact-File Committer

`scripts/committer` is a local Git handoff helper for approved commit preparation. It refuses broad staging, requires exact file paths, checks repo state and diff evidence, scans staged diffs for secret-shaped markers, and never pushes or creates PRs.

Use it after `github-handoff-skill` is selected and local commit preparation is approved. Dry-run mode is safe for read-only evidence:

```bash
cd <LIBRARY_REPO>
./scripts/committer --repo /path/to/repo --message "Describe the exact scoped change" --files path/to/file --dry-run
```

Commit permission is separate from push, PR, deploy, migration, and release permission.

## Pre-Commit Validation Hook

`scripts/pre-commit-check` is the local commit gate for this library. It runs deterministic checks before a commit: `git diff --check`, Node syntax checks for core helpers, docs-list validation, repo-map validation, project-KB validation, migration-review validation, route audit, and skill validation. `--staged` also inspects the staged diff for whitespace issues and secret-shaped additions, reporting only file/risk category without printing values. `--full` adds `npm test` and `skill-cleaner`.

```bash
./scripts/pre-commit-check
./scripts/pre-commit-check --staged
./scripts/pre-commit-check --full
./scripts/pre-commit-check --json

coding-workflow pre-commit-check --staged
```

The optional hook template is tracked at `templates/hooks/pre-commit`. Install it only when desired:

```bash
./scripts/install-git-hooks --dry-run
./scripts/install-git-hooks
coding-workflow install-hooks --dry-run
```

The installer writes only `.git/hooks/pre-commit` in the selected Git repository, refuses unmanaged existing hooks by default, and uses a managed marker for safe updates. It does not stage, commit, push, install packages, publish, deploy, read secrets, or call remote services. The hook is not a substitute for CI or release preflight; it is a fast local guardrail before exact-file commits.

## Local Verification And Release Evidence

The local verification bundle supports evidence-pack generation, npm package readiness inspection, and release preflight without publishing, tagging, pushing, deploying, setting secrets, or mutating remote services.

Use these helpers only inside an approved local workflow:

```bash
cd <LIBRARY_REPO>
./scripts/evidence-pack --repo /path/to/repo --title "Short title" --dry-run
./scripts/npm-package-readiness --repo /path/to/repo
./scripts/npm-package-readiness --repo /path/to/repo --expect-package
./scripts/npm-package-readiness --repo /path/to/repo --expect-cli
./scripts/npm-package-readiness --repo /path/to/repo --json --validate
./scripts/library-packaging-readiness --repo <LIBRARY_REPO>
./scripts/library-packaging-readiness --repo <LIBRARY_REPO> --expect-open-source
./scripts/release-preflight --repo /path/to/repo --mode local
./scripts/release-preflight --repo /path/to/repo --mode npm
./scripts/release-preflight --repo /path/to/repo --mode cli
./scripts/release-preflight --repo /path/to/repo --json --validate
./scripts/release-preflight --repo /path/to/repo --corpus-dir /path/to/generated-corpus --require-corpus
```

`scripts/evidence-pack` writes under the target repo's `evidence/` folder only when not in dry-run mode. Evidence files are never staged or committed automatically. `scripts/npm-package-readiness` distinguishes `PASS`, `WARN`, `FAIL`, `NOT_VERIFIED`, and `NOT_APPLICABLE`; non-package repos are not failures unless `--expect-package` is supplied. Its JSON report exposes script names and blocker codes, never script bodies or raw prepack output. `npm pack --dry-run --json` runs only when `--allow-pack-dry-run` is present, and its final manifest is checked for env files, evidence, local state, private corpus output, raw sessions, pseudonym maps, and key-like files. `scripts/library-packaging-readiness` separates local library readiness, reusable template readiness, open-source readiness, npm package readiness, and CLI readiness. MIT is selected, the published package name is `autonomous-coding-workflow-library`, the CLI command is `coding-workflow`, and the GitHub repository identity is `AyobamiH/coding-workflow-library`. Each future publication remains an explicit `remote_publication` consequence.

`scripts/release-preflight --mode local` is the default and must not fail merely because a repo is not an npm package; `--mode npm` expects package readiness; `--mode cli` expects package and bin readiness. npm/CLI modes compare the package version and release-note changes with `--base-ref` or the latest reachable tag. Optional `--corpus-dir` integration reads only generated `coverage-report.json` and `validation-report.json`, verifies aggregate reconciliation, and emits count-only release signals. It never reads raw corpus events, source roots, sessions, source manifests, or pseudonym maps. `--require-corpus` turns missing aggregate evidence into a crisp blocker. `--strict` returns non-zero for `FAIL` or `NOT_VERIFIED`; `--validate` validates report structure without pretending readiness passed. No readiness or preflight mode publishes, versions, tags, pushes, deploys, creates GitHub releases, reads secrets, or mutates registries.

When the ledger status is `Local verification and release evidence bundle built`, `scripts/run-next --allow verification-bundle-self-test` can run the bundle against the selected repo. The route runs npm package readiness, release preflight, evidence-pack dry-run, helper syntax checks, skill cleanup, and skill validation. Evidence pack writing is still separate: it defaults to `scripts/evidence-pack --dry-run` and writes local `evidence/` files only when `--allow evidence-pack-write` is also present. This route is not publish, tag, push, PR, deploy, secret, external service, or production endpoint permission.

When the ledger status is `Verification bundle self-test complete`, `scripts/run-next --allow local-skill-workpack --allow evidence-pack-write` can run the larger local-only skill workpack against this skills library. It hardens verification classification, proves exactly one local evidence-pack write, runs failure-evidence classification, validates runtime/GitHub skill extraction, updates ledger/run-log evidence, and stops at `Local skill workpack complete`. It must not touch product repos, Supabase, Cloudflare, GitHub remotes, npm publishing, tags, pushes, PRs, deploys, secrets, or production endpoints.

When the ledger status is `Embedded production lanes extracted into reusable routes`, `scripts/run-next --allow cloudflare-opstruth-packaging-bundle` can run the next local-only extraction bundle. It validates Cloudflare deploy planning, Opstruth/runtime truth, skills-library packaging, npm/CLI route metadata, route audit, packaging readiness, release preflight local mode, and skill validation. It stops at `Cloudflare Opstruth packaging routes extracted`. It is not permission to deploy Cloudflare, run Wrangler deploy, publish npm packages, change versions, tag, push, create PRs, set/read secrets, run Supabase commands, call production endpoints, or mutate remote services.

When the ledger status is `Cloudflare Opstruth packaging routes extracted`, `scripts/run-next --allow clean-temp-readiness-smoke` can create a clean local copy under `<TEMP_ROOT>/`, exclude `.git`, `.env`, evidence, dependency caches, and credential-shaped files, run route audit, route listing, packaging readiness, open-source readiness classification, release preflight local mode, skill cleanup, and validation from the copied folder, then remove the temp copy. It stops at `Clean-temp readiness smoke complete`. This is a portability check, not an open-source release, npm package, CLI package, publish, version, tag, push, PR, deploy, Supabase, Cloudflare, secret, or production endpoint permission.

When the ledger status is `Clean-temp readiness smoke complete`, `scripts/run-next --allow license-package-candidate` can verify the approved MIT `LICENSE`, the `LICENSE-DECISION.md` record, the local `package.json` candidate scaffold, open-source/package readiness, npm package readiness, and local release preflight. It stops at `MIT licence and package candidate scaffold complete`. This is still not permission to publish, version, tag, push, create a PR, create a GitHub release, deploy, read secrets, call production endpoints, or mutate remote services.

When the ledger status is `MIT licence and package candidate scaffold complete`, `scripts/run-next --allow package-candidate-dry-run` can verify the package candidate identity, run open-source/npm readiness, run release preflight in npm mode, run `npm pack --dry-run`, inspect the package contents for local/private files, run a clean-temp package smoke, and validate the library. It stops at `Package candidate dry-run complete`. This is still not permission to publish, version, tag, push, create a PR, create a GitHub release, deploy, call production endpoints, mutate registries, or choose a CLI entrypoint.

When the ledger status is `Package candidate dry-run complete`, `scripts/run-next --allow cli-package-smoke` can verify the local `coding-workflow` CLI entrypoint, run CLI package readiness, run release preflight in CLI mode, inspect `npm pack --dry-run` contents, create a local tarball in a temp folder, install that tarball into a clean temp consumer with lifecycle scripts disabled, run the installed CLI, remove the temp folder, and validate the library. It stops at `CLI entrypoint package smoke complete`. This is still not permission to publish, version, tag, push, create a PR, create a GitHub release, deploy, call production endpoints, mutate registries, install remote dependencies, or mutate remote services.

The CLI command candidate is `coding-workflow`. It is a thin local wrapper over existing helper scripts and preserves `scripts/run-next` permission gates.

`scripts/failure-evidence` turns a log file or stdin into a redacted blocker classification:

```bash
./scripts/failure-evidence --input /path/to/log.txt
cat /path/to/log.txt | ./scripts/failure-evidence --stdin
```

## GitHub Auth Gate

`github-auth-gate-skill` checks whether `gh` is installed, whether local GitHub CLI authentication is valid, which account is active, whether that account matches the target repo owner, and whether safe local account switching is possible.

It supports `GH_TOKEN` and `GITHUB_TOKEN` only as runtime environment auth. It must never print, save, or commit token values. After the auth gate returns `PASS`, route back to `github-handoff-skill` for any separately approved push or PR work.

## Autonomous Work Loop

`scripts/run-next` is the executable implementation of the orchestrator loop. It reads `AGENTS.md`, `tools.md`, and `work-ledger.md`; selects the latest ledger item for the requested repo; checks the required permission gate from `--allow`; runs only covered safe actions; updates the ledger/run log after real execution; and stops at real John-required boundaries.

Use `--explain` when John needs the selected job, required permission, stop reason, and next approval command without mutating any files. `--dry-run` is also non-mutating; it does not update `work-ledger.md`, `runs/skill-runs.md`, target repos, or external services.

Use `--list-routes` to inspect local route metadata without reading credentials, updating the ledger, touching target repos, or calling external services.

Current automation supports the `Auth pass for GitHub handoff` path for `<TARGET_REPO>`: it isolates `GH_TOKEN`, verifies `AyobamiH/wagging-web-wins` access, checks local repo safety, creates/switches the feature branch, pushes that branch only, and creates or confirms the PR.

It also supports `PR opened, not merged` as a PR readiness inspection path. With `--allow pr-readiness` or inherited `remote_publication`, the runner inspects PR metadata, changed files, commits, checks, mergeability, review decision, reviewed head SHA, and local repo state, then records one of: `PR_CHECKS_PENDING`, `PR_READY`, `PR blocked by checks`, `PR blocked by unexpected files`, `PR blocked by mergeability`, or `PR readiness unknown`. It may proceed to normal merge only when the automatic merge policy in `docs/autonomous-decision-boundaries.md` passes.

When the ledger status is `PR ready for merge approval`, `scripts/run-next --allow pr-merge` can perform a normal merge for a verified workflow-authored PR only. It rechecks GitHub auth, repo access, exact PR file scope, PR state, mergeability, PR checks, reviewed head SHA, and repo-local evidence before running `gh pr merge --merge`. It does not admin-merge, force-push, bypass branch protection, delete protected evidence, deploy, run migrations, mutate Supabase, or call production endpoints. After a successful merge it enters `POST_MERGE_VERIFY`; it records completion only after exact merge commit, local validation, remote alignment, ledger update, and run-record update pass.

When the ledger status is `Merged, not deployed`, `scripts/run-next --allow deployment-plan` can inspect local/source evidence and produce a Supabase deployment plan. It reads repo state, Supabase config, the `import-reddit-tips` Edge Function, relevant docs/migrations, package scripts, and local CLI availability. It does not set secrets, deploy functions, run migrations, mutate Supabase, update schedulers, call production endpoints, push, create PRs, or merge anything. After a successful planning run it records `Deployment plan ready, not deployed`.

When the ledger status is `Deployment plan ready, not deployed`, `scripts/run-next --allow supabase-preflight` can inspect local/source execution prerequisites and draft the exact Supabase execution sequence. This is preflight only: it does not install the Supabase CLI, run `npx supabase`, log in, link, set secrets, deploy, run migrations, execute SQL, update schedulers, call runtime endpoints, push, create PRs, or merge. After a successful preflight it records `Supabase execution preflight ready, not executed`.

When the ledger status is `Supabase execution preflight ready, not executed`, `scripts/run-next --allow supabase-tooling-auth` can verify Node/npm/npx availability, run `npx supabase --version`, inspect local `<LOCAL_ENV_FILE>` variable names/presence without printing values, and use `SUPABASE_ACCESS_TOKEN` only as runtime auth for read-only Supabase project listing. This is not permission to run `supabase login`, `supabase link`, set secrets, deploy, run migrations, execute SQL, mutate schedulers, invoke functions, call production endpoints, push, create PRs, or merge. After auth passes it records `Supabase tooling/auth ready, not linked`.

When the ledger status is `Supabase tooling/auth ready, not linked`, `scripts/run-next --allow supabase-link-secret-readiness` can link the local repo to the approved Supabase project and ensure `IMPORT_REDDIT_TIPS_SECRET` exists only in `<LOCAL_ENV_FILE>`. If the secret is missing, the runner may generate a strong local value and store it there without printing it. This is not permission to set remote Supabase secrets, deploy functions, run migrations, execute SQL, mutate schedulers, invoke functions, call production endpoints, push, create PRs, or merge. After link and local secret readiness pass it records `Supabase linked and local secret ready, not deployed`.

When the ledger status is `Supabase linked and local secret ready, not deployed`, `scripts/run-next --allow scheduler-draft-pr` can run the combined local handoff gate: draft a guarded local scheduler migration, update scheduler docs, run local checks, create an exact-file commit, push the feature branch, and open or confirm a PR. This is not permission to set remote Supabase secrets, deploy functions, run or apply migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push `main`, force-push, or merge a PR. After success it records `Scheduler migration PR opened, not merged`.

When the ledger status is `Local verification and release evidence bundle built`, `scripts/run-next --allow verification-bundle-self-test` can self-test the local verification/release helpers against the selected repo. It records `Verification bundle self-test complete` after safe local checks pass. Add `--allow evidence-pack-write` only when John explicitly approves local evidence file creation; otherwise the evidence-pack step stays dry-run.

Official vendor skills may be reviewed only as advisory input under `vendor-intake/`. The Supabase official agent skills intake found useful checks for Data API exposure versus RLS, public-schema RLS, `auth.role()` policy drift, `SECURITY DEFINER` exposure, CLI help discovery, and migration-file creation with Supabase CLI tooling when a migration-draft gate is explicitly approved. Vendor guidance does not override `AGENTS.md`, `tools.md`, permission gates, or `scripts/run-next` ledger routing.

```bash
cd <LIBRARY_REPO>
./scripts/run-next --repo <TARGET_REPO> --explain
./scripts/run-next --dry-run --repo <TARGET_REPO> --allow github-handoff
./scripts/run-next --repo <TARGET_REPO> --allow github-handoff
./scripts/run-next --dry-run --repo <TARGET_REPO> --allow pr-readiness
./scripts/run-next --repo <TARGET_REPO> --allow pr-readiness
./scripts/run-next --dry-run --repo <TARGET_REPO> --allow pr-merge
./scripts/run-next --repo <TARGET_REPO> --allow pr-merge
./scripts/run-next --dry-run --repo <TARGET_REPO> --allow deployment-plan
./scripts/run-next --repo <TARGET_REPO> --allow deployment-plan
./scripts/run-next --dry-run --repo <TARGET_REPO> --allow supabase-preflight
./scripts/run-next --repo <TARGET_REPO> --allow supabase-preflight
./scripts/run-next --dry-run --repo <TARGET_REPO> --allow supabase-tooling-auth
./scripts/run-next --repo <TARGET_REPO> --allow supabase-tooling-auth
./scripts/run-next --dry-run --repo <TARGET_REPO> --allow supabase-link-secret-readiness
./scripts/run-next --repo <TARGET_REPO> --allow supabase-link-secret-readiness
./scripts/run-next --dry-run --repo <TARGET_REPO> --allow scheduler-draft-pr
./scripts/run-next --repo <TARGET_REPO> --allow scheduler-draft-pr
./scripts/run-next --dry-run --repo <LIBRARY_REPO> --allow verification-bundle-self-test
./scripts/run-next --repo <LIBRARY_REPO> --allow verification-bundle-self-test
./scripts/run-next --dry-run --repo <LIBRARY_REPO> --allow local-skill-workpack --allow evidence-pack-write
./scripts/run-next --repo <LIBRARY_REPO> --allow local-skill-workpack --allow evidence-pack-write
./scripts/run-next --dry-run --repo <LIBRARY_REPO> --allow clean-temp-readiness-smoke
./scripts/run-next --repo <LIBRARY_REPO> --allow clean-temp-readiness-smoke
./scripts/run-next --dry-run --repo <LIBRARY_REPO> --allow package-candidate-dry-run
./scripts/run-next --repo <LIBRARY_REPO> --allow package-candidate-dry-run
./scripts/run-next --dry-run --repo <LIBRARY_REPO> --allow cli-package-smoke
./scripts/run-next --repo <LIBRARY_REPO> --allow cli-package-smoke
```

Manual prompts are now fallback control, not the default handoff mechanism.

## Open-Source Handoff

Repository identity: `AyobamiH/coding-workflow-library`.

Published package: `autonomous-coding-workflow-library`.

CLI command: `coding-workflow`.

The package is public, but future npm publication, package versioning, git tags, GitHub releases, deployment, and production endpoint checks are not approved by default. The local validation path is:

```bash
npm test
npm run test:portable
npm run check:paths
npm run package:readiness
npm run release:preflight
npm pack --dry-run --json
node scripts/route-audit
node scripts/validate-skills
```

GitHub Actions runs the full gate on Linux and a focused portability contract on Linux, macOS, and Windows. The portable suite covers syntax discovery, path redaction, workflow snapshots, managed hook behavior, browser-proof classification, and GitHub-review evidence without calling browsers or remote services.

`scripts/run-next --allow github-open-source-handoff` records and verifies the public GitHub handoff only after explicit approval. It must not publish to npm, create versions or tags, create GitHub releases, deploy, run Supabase/Cloudflare commands, print secrets, force-push, or stage broad/excluded paths.

## v0.1.0 First Version Tag Gate

The first source tag route is `first-version-tag`.

```bash
./scripts/run-next --dry-run --repo <LIBRARY_REPO> --allow first-version-tag
./scripts/run-next --repo <LIBRARY_REPO> --allow first-version-tag
```

This gate prepares and verifies package version `0.1.0`, `CHANGELOG.md`, `docs/releases/v0.1.0.md`, local validation, package smoke, exact-file release commit, non-force `main` push, GitHub Actions success for the release commit, annotated tag `v0.1.0`, remote tag verification, and post-tag bookkeeping.

It is not npm publication, `npm version`, GitHub release creation, deployment, production verification, or permission to broaden staging.

## Important Boundaries

- Cloudflare, Supabase, migration, and GitHub CLI workflows were not confirmed in the extracted chat logs. Their skill files are inspection-first and forbid invented deployment/database/PR commands.
- Supabase execution preflight is not deployment. Supabase CLI install/auth/link, secret writes, function deploys, migrations, scheduler mutations, SQL execution, and runtime endpoint calls remain separate permission gates.
- Supabase tooling/auth setup is not link, secrets, deploy, scheduler mutation, or runtime verification. `SUPABASE_ACCESS_TOKEN` is runtime/local env only and agents must never print token values. `npx supabase --version` is allowed only under the tooling/auth gate; `npx supabase` mutation commands require separate permission.
- Supabase link/local secret readiness is not remote secret setup. Generated local secrets may only be stored in `<LOCAL_ENV_FILE>`, and agents must never print secret values or partial values.
- Vendor skill intake is not active-skill installation for a target repo. Keep vendor files isolated under `vendor-intake/`, read them as advisory evidence, and adapt only the local library rules that improve safety.
- `AGENTS.md` permission gates override any convenience implied by a skill file.
- Read-only mapping and evidence gathering should happen before edits.
- Consequence classes are separate, but one objective-level grant covers the matching class for that objective. Local edits, installs, builds, commits, pushes, PRs, normal verified workflow-authored merges, deploys, migrations, database mutations, external API calls, and releases must be classified before execution; do not ask twice for the same granted class, and do not cross production, secret, destructive, legal, billing, product, or security boundaries without exact approval.
- Do not print secrets, `.env` contents, bearer tokens, or credential file contents.
- Do not overwrite configs, run deploys, apply migrations, or broaden OpenClaw permissions without explicit approval.
- Do not say a task is complete without evidence.
- If no skill fits, create a skill gap note instead of improvising silently.

## Source

Built from:

- `<WORKFLOW_EXTRACTION_SOURCE>`
- Local OpenClaw session logs under `agents/main/sessions` and `agents/researcher/sessions`
- `evidence/opstruth-report.md`
