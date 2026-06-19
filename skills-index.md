# Skills Index

Start with `AGENTS.md` before `RUNBOOK.md` or any individual skill. `AGENTS.md` contains global hard rules for permission gates, repo safety, secrets, evidence, and source-only versus deployed proof.

Then use `RUNBOOK.md` for operational guidance. Each skill file must be read before its commands are used.

Active skill routing is based on each skill file's frontmatter:

- `name`: must match the filename without `.md`;
- `description`: short operational routing description;
- `category`: approved routing category;
- `routing_triggers`: two to six short trigger phrases;
- `status`: `active`, `draft`, or `deprecated`.

Every active skill must be referenced here by filename or name. `./scripts/validate-skills` enforces that contract.

## High Priority

### coding-workflow-orchestrator-skill

File: `skill-files/coding-workflow-orchestrator-skill.md`
Use as the control plane for queue classification, permission gates, local repo gate checks, downstream skill selection, one bounded work loop, work-ledger updates, evidence-first verification, and decision-ready owner prompts. Keep this as the control-plane skill after `AGENTS.md` is read.

### session-log-extraction-skill

File: `skill-files/session-log-extraction-skill.md`
Use for mining OpenClaw/Codex JSONL logs into command/tool/prompt inventories. Starts with `find agents/main/sessions ...` and uses Node when `jq` is missing.

### skill-cleaner-skill

File: `skill-files/skill-cleaner-skill.md`
Use for advisory skill-library hygiene: duplicate skills, bloat, stale skills, weak routing, overlap, script candidates, and cleanup queue recommendations. It does not delete, merge, rename, or deprecate skills without John approval.

### repo-map-skill

File: `skill-files/repo-map-skill.md`
Use at the start of unfamiliar workspace tasks. Maps cwd, files, git state, and missing paths with `pwd`, `rg --files`, `find`, `ls`, and `git status`.

### error-evidence-skill

File: `skill-files/error-evidence-skill.md`
Use when a command/tool/model/git/subagent operation fails. Classifies ENOENT, command-not-found, model drift, quota, git identity, and agent-history errors.

### openclaw-config-diff-skill

File: `skill-files/openclaw-config-diff-skill.md`
Use when OpenClaw behavior changed after hardening or backup edits. Uses `diff -u`, `diff -u -w`, and timestamped backup comparison.

### route-trace-skill

File: `skill-files/route-trace-skill.md`
Use when subagents cannot spawn or history is inaccessible. Verifies `allowAgents`, `agents_list`, `sessions_spawn`, and `openclaw subagents list`.

### security-hardening-review-skill

File: `skill-files/security-hardening-review-skill.md`
Use for OpenClaw/host security review. Read-only baseline first, then Gate A-E changesets with rollback and approval.

### build-verify-skill

File: `skill-files/build-verify-skill.md`
Use after edits. Runs git status, `git diff --check`, and reviews opstruth-style evidence reports.

### evidence-pack-builder-skill

File: `skill-files/evidence-pack-builder-skill.md`
Use to build local redacted evidence packs from repo state, validation output, ledger/run-log evidence, references, caveats, and next-step handoff evidence. Optional evidence file creation is local-edit only and never stages or commits files.

### npm-package-readiness-skill

File: `skill-files/npm-package-readiness-skill.md`
Use for local npm package and CLI readiness checks: package metadata, lockfiles, bin entrypoints, package contents control, docs, scripts, and optional `npm pack --dry-run` when explicitly allowed. It never publishes by default.

### skills-library-packaging-skill

File: `skill-files/skills-library-packaging-skill.md`
Use to decide whether this library is a local library, reusable template, npm package candidate, CLI package candidate, or actually released package. It owns packaging readiness without granting publish, tag, push, GitHub release, or product-repo install permission.

### release-preflight-skill

File: `skill-files/release-preflight-skill.md`
Use for local release gates that combine Git state, validation evidence, npm package readiness, evidence-pack planning, changelog/release-note checks, and explicit publish/tag/push/deploy boundaries. `scripts/run-next --allow verification-bundle-self-test` can now select the local verification/release bundle from ledger state and keep evidence-pack writing gated behind `--allow evidence-pack-write`.

### runtime-verification-skill

File: `skill-files/runtime-verification-skill.md`
Use for generic runtime verification after deploy-like work or live endpoint changes. It separates negative/non-mutating checks, true no-write dry-run proof, controlled success invocations, scheduled monitoring, forbidden production writes, and next ledger states.

### opstruth-runtime-truth-skill

File: `skill-files/opstruth-runtime-truth-skill.md`
Use to classify what runtime, deploy, CI, release, and handoff evidence actually proves. It separates `Verified`, `Warning`, `Failure`, `Skipped`, and `Not Verified`, and prevents source-only or skipped checks from being reported as runtime truth.

### supabase-function-deploy-skill

File: `skill-files/supabase-function-deploy-skill.md`
Use for Supabase Edge Function remote secret setup, one named function deploy, deploy-to-runtime boundaries, negative runtime checks, no-write dry-run proof rules, controlled success handoff, and evidence requirements. Project-specific values belong in run evidence, not the skill.

### supabase-scheduler-vault-skill

File: `skill-files/supabase-scheduler-vault-skill.md`
Use for Supabase scheduler safety with pg_cron, pg_net, Vault-backed private headers, DB connectivity gates, read-only capability discovery, one Vault secret boundary, one cron job mutation boundary, metadata-only verification, and no app-table writes.

### production-handoff-skill

File: `skill-files/production-handoff-skill.md`
Use for read-only production handoff and scheduled-run monitoring after deploy/scheduler setup. It distinguishes pending automatic runs, observed success, observed failure, and incomplete evidence without invoking functions by default.

### llm-drift-control-skill

File: `skill-files/llm-drift-control-skill.md`
Use when provider/model errors prevent task execution.

## Medium Priority

### env-audit-skill

File: `skill-files/env-audit-skill.md`
Use for read-only repository environment and secret-surface audits: env/config files, `.gitignore` protections, `.env.example` coverage, public/private config boundaries, frontend public keys, server-only secrets, Supabase Edge Function env/JWT matrices, and redacted secret-shaped marker findings.

### github-handoff-skill

File: `skill-files/github-handoff-skill.md`
Use for local git handoff, commit readiness, push handoff, and PR preparation after the GitHub auth gate passes.

### github-auth-gate-skill

File: `skill-files/github-auth-gate-skill.md`
Use when GitHub handoff is blocked by missing, invalid, wrong-account, expired, revoked, or unclear `gh` authentication. It checks local `gh` auth state, environment token presence without printing values, active account, owner/repo alignment, and safe account switching before routing back to `github-handoff-skill`.

### cloudflare-deploy-skill

File: `skill-files/cloudflare-deploy-skill.md`
Use for Cloudflare Pages or Workers deployment planning, deploy proof boundaries, Wrangler config discovery, env/secret-name checks without values, preview versus production deploy separation, post-deploy verification planning, and rollback boundaries. It is not live deploy permission.

### project-kb-builder-skill

File: `skill-files/project-kb-builder-skill.md`
Use to write durable daily project memory notes.

### public-market-scan-skill

File: `skill-files/public-market-scan-skill.md`
Use for public market-data fallback scans with Finviz/Stooq and explicit data caveats.

### tool-patterns-skill

File: `skill-files/tool-patterns-skill.md`
Use when coordinating read/write/edit/process/session/gateway tool patterns.

## Placeholder / Inspection-First

### supabase-rls-audit-skill

File: `skill-files/supabase-rls-audit-skill.md`
Use for read-only source-only Supabase public-anon/RLS safety audits: client boundary, frontend table/RPC/function use, migrations, active policies, Edge Function service-role/JWT boundaries, storage policies, SQL functions/RPCs, grants/revokes, and source-only safety judgement. Do not run Supabase CLI mutations or production calls unless explicitly allowed.

### migration-review-skill

File: `skill-files/migration-review-skill.md`
Use for read-only migration review until repo-specific apply commands are confirmed.

## Operational Control Files

- `AGENTS.md`: global hard rules. Read this first.
- `LICENSE`: John-approved MIT license for the initial open-source/package-readiness path.
- `LICENSE-DECISION.md`: local decision record stating that John selected MIT, the package candidate name is `autonomous-coding-workflow-library`, and final npm package name availability and ownership still require approval before publish.
- `CHANGELOG.md`: unreleased change log and release-readiness scaffold.
- `package.json`: local npm package candidate metadata for `autonomous-coding-workflow-library`, including the `coding-workflow` CLI bin mapping.
- `package-lock.json`: local lockfile for the dependency-free package candidate, generated without lifecycle scripts or audit/fund calls.
- `bin/coding-workflow.js`: thin local CLI wrapper that delegates to existing scripts and preserves `scripts/run-next` permission gates.
- `RUNBOOK.md`: library operating manual and skill selection flow.
- `tools.md`: global tool catalogue and permission model.
- `work-ledger.md`: persistent active-work ledger owned by `coding-workflow-orchestrator-skill`.
- `runs/skill-runs.md`: append-only run log for real skill use.
- `templates/repo-agents-pointer-template.md`: downstream repo pointer file that references the shared hard rules without copying them.
- `templates/skill-run-template.md`: reusable run log entry.
- `templates/new-skill-template.md`: required structure for new skills.
- `templates/skill-upgrade-template.md`: proposal format for improving weak skills.
- `templates/evidence-report-template.md`: report format for task evidence.
- `scripts/committer`: exact-file commit handoff helper.
- `scripts/evidence-pack`: local redacted evidence-pack generator.
- `scripts/failure-evidence`: local redacted failure classifier for logs or stdin.
- `scripts/library-packaging-readiness`: local reusable/open-source/package-readiness inspector for this skills library, including explicit `--expect-open-source`, `--expect-npm`, and `--expect-cli` modes.
- `scripts/npm-package-readiness`: local npm package and CLI readiness inspector.
- `scripts/release-preflight`: local release gate combining package readiness and evidence-pack planning.
- `routes/skill-routes.json`: local route manifest mapping ledger states to skill files, permission flags, helper scripts, forbidden actions, success states, blocked states, next permissions, and evidence requirements.
- `scripts/route-audit`: local route metadata validator.
- `scripts/skill-cleaner`: advisory skill hygiene scanner.
- `scripts/validate-skills`: frontmatter, required-section, index-coverage, route metadata, placeholder-marker, and secret-shaped marker validator.
- `docs/autonomous-loop-model.md`: autonomous operator model for ledger-driven work.
- `docs/job-selection-contract.md`: selection and stop contract for `scripts/run-next`.
- `tests/library-validation-checklist.md`: validation checklist and commands.
# Open-Source GitHub Handoff Route

- Route id: `github-open-source-handoff`
- Primary skills: `github-handoff-skill`, `skills-library-packaging-skill`, `release-preflight-skill`
- Trigger state: `CLI entrypoint package smoke complete`
- Permission flag: `--allow github-open-source-handoff`
- Success state: `GitHub open-source handoff complete`
- Scope: local public repo hardening, local validation, exact-file commit, public GitHub repo creation/verification, one `main` push, and remote HEAD verification.
- Boundaries: no npm publish, versioning, tags, GitHub releases, deploys, Supabase/Cloudflare commands, production calls, secret printing, force push, or broad/excluded staging.
