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

### cloudflare-deploy-skill

File: `skill-files/cloudflare-deploy-skill.md`
Use only to discover Cloudflare commands from a target repo. Do not deploy from assumptions.

### supabase-rls-audit-skill

File: `skill-files/supabase-rls-audit-skill.md`
Use for read-only source-only Supabase public-anon/RLS safety audits: client boundary, frontend table/RPC/function use, migrations, active policies, Edge Function service-role/JWT boundaries, storage policies, SQL functions/RPCs, grants/revokes, and source-only safety judgement. Do not run Supabase CLI mutations or production calls unless explicitly allowed.

### migration-review-skill

File: `skill-files/migration-review-skill.md`
Use for read-only migration review until repo-specific apply commands are confirmed.

## Operational Control Files

- `AGENTS.md`: global hard rules. Read this first.
- `RUNBOOK.md`: library operating manual and skill selection flow.
- `tools.md`: global tool catalogue and permission model.
- `work-ledger.md`: persistent active-work ledger owned by `coding-workflow-orchestrator-skill`.
- `runs/skill-runs.md`: append-only run log for real skill use.
- `templates/repo-agents-pointer-template.md`: downstream repo pointer file that references the shared hard rules without copying them.
- `templates/skill-run-template.md`: reusable run log entry.
- `templates/new-skill-template.md`: required structure for new skills.
- `templates/skill-upgrade-template.md`: proposal format for improving weak skills.
- `templates/evidence-report-template.md`: report format for task evidence.
- `scripts/skill-cleaner`: advisory skill hygiene scanner.
- `scripts/validate-skills`: frontmatter, required-section, index-coverage, placeholder-marker, and secret-shaped marker validator.
- `docs/autonomous-loop-model.md`: autonomous operator model for ledger-driven work.
- `docs/job-selection-contract.md`: selection and stop contract for `scripts/run-next`.
- `tests/library-validation-checklist.md`: validation checklist and commands.
