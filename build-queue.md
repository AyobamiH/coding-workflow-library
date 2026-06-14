# Build Queue

These are implementation goals an LLM can complete one by one to turn the Markdown skills into scripts, CLIs, or packaged local skills.

## Applied Peter-Pattern Uplifts

- AGENTS hard-rules uplift applied: root `AGENTS.md` created, downstream repo pointer template created, and README/RUNBOOK/index/command/tool/evidence docs wired to read `AGENTS.md` first.
- Skill frontmatter and validator uplift applied: every `skill-files/*.md` file now has routing frontmatter, `templates/new-skill-template.md` includes the frontmatter pattern, and `scripts/validate-skills` validates the library without noisy marker self-hits.
- Skill cleaner uplift applied: `skill-cleaner-skill.md` and `scripts/skill-cleaner` now provide advisory cleanup intelligence for duplication, bloat, weak routing, stale skills, overlap, and script candidates.
- Peter-style tools catalogue uplift applied: `tools.md` now defines local tools, permission gates, safe and unsafe examples, approval requirements, and evidence rules.
- Exact-file `scripts/committer` uplift applied: helper created for exact-file commit preparation, GitHub handoff now prefers it, and docs/evidence gates distinguish dry-run, no-commit staging, local commit, push, PR, deploy, and production verification.
- GitHub auth gate skill uplift applied: `github-auth-gate-skill` now handles `gh` availability, auth validity, active account matching, runtime environment token presence, safe local account switching, and routing back to `github-handoff-skill`.
- Autonomous `scripts/run-next` uplift applied: runner reads `work-ledger.md`, maps status to skill/permission gates, supports dry-run and explicit `--allow` flags, executes the first GitHub handoff path, inspects PR readiness after PR creation, updates ledger/run logs, and stops at human boundaries.

Next Peter-pattern upgrades:

1. Create `scripts/github-auth-gate`.
2. Create `browser-live-proof-skill`.
3. Create `github-deep-review-skill`.
4. Create `hooks/pre-commit` validation hook.
5. Create `one-password-secret-access-skill`.
6. Add generated Markdown output for `skill-cleaner`.

## 1. Build Session Log Extractor

Goal: create `scripts/extract_session_workflows.mjs`.

Inputs:

- Session directories.
- Keyword filters.
- Redaction regex list.

Done when:

- It emits confirmed commands, tool calls, user prompts, assistant text, and errors.
- It skips `thinking`.
- It redacts secrets.
- It writes Markdown and JSON outputs.

## 2. Build Repo Mapper

Goal: create `scripts/map_repo.sh`.

Commands to codify:

```bash
pwd
rg --files
find . -maxdepth 3 -type f
git status --short
```

Done when:

- It handles missing `rg`.
- It excludes credential contents.
- It reports git root/status or no-git state.

## 3. Build Error Evidence Lookup

Goal: create `references/common-errors.md`.

Include:

- ENOENT.
- command not found.
- unsupported model/reasoning.
- quota exceeded.
- git identity missing.
- agent history forbidden.

Done when:

- Each error has symptoms, evidence command, and recovery.

## 4. Build OpenClaw Config Diff Script

Goal: create `scripts/diff_openclaw_backups.sh`.

Commands to codify:

```bash
ls -l --full-time openclaw.json*
diff -u openclaw.json.bak.3 openclaw.json.bak.2
diff -u -w openclaw.json.bak openclaw.json
```

Done when:

- It prints backup timestamps.
- It compares adjacent backups.
- It explains that `diff` exit code 1 means differences exist.

## 5. Build Route Trace Script

Goal: create `scripts/check_subagents.sh`.

Done when:

- It lists agents.
- It checks `allowAgents`.
- It runs/records a harmless spawn test if tools allow it.
- It reports history policy denial separately.

## 6. Build Security Hardening References

Goal: create reference files:

- `references/gate-a-e-template.md`
- `references/windows-evidence.md`
- `references/secrets-handling.md`
- `references/rollback-template.md`

Done when:

- Every state-changing recommendation requires approval, verification, and rollback.

## 7. Build Git Verification Script

Goal: create `scripts/verify_git.sh`.

Commands:

```bash
git status --short
git diff --check
```

Done when:

- It handles non-git directories.
- It returns machine-readable status.

## 8. Build LLM Drift Parser

Goal: create a session-log parser that groups model/provider errors.

Done when:

- Unsupported reasoning, missing model, quota, and reasoning-item mismatch errors are grouped with recovery guidance.

## 9. Build Daily Memory Helper

Goal: create `scripts/ensure_daily_memory.sh`.

Done when:

- It creates `memory/YYYY-MM-DD.md` if missing.
- It appends sanitized bullets.
- It refuses obvious secret-looking content.

## 10. Build Public Market Scanner

Goal: create `scripts/stooq_scan.mjs`.

Done when:

- It accepts ticker list and filters.
- It fetches Stooq CSV.
- It emits JSON and Markdown.
- It includes as-of date and proxy-data caveat.

## 11. Defer Provider-Specific Deploy/DB Skills

Do not automate Cloudflare, Supabase, or migration apply commands until a target repo provides confirmed commands and safety requirements.

## 12. Build Redacted Env Scanner

Status: `env-audit-skill` has now been upgraded from real validation feedback from `/home/johnh/wagging-web-wins`.

Goal: create a reusable redacted env scanner that supports the upgraded `env-audit-skill`.

Next automation candidate: redacted env scanner.

Done when:

- It discovers env/config files without printing values.
- It checks tracked/ignored status for env-like and secret-like files.
- It extracts variable names from env/example files.
- It compares `.env.example` coverage with actual code usage.
- It emits a secret-shaped marker report with masked previews only.
- It produces a Supabase function/env/JWT matrix when Supabase files exist.
- It classifies docs placeholders separately from real-looking committed values.
- It writes Markdown and JSON evidence reports.

Previous repo audit run: `supabase-rls-audit-skill` for `/home/johnh/wagging-web-wins` selected correctly and produced validation feedback.

## 13. Build Supabase RLS Source-Audit Scanner

Status: `supabase-rls-audit-skill` has now been upgraded from validation feedback.

Goal: create a reusable source-only Supabase RLS/public-anon audit scanner that supports the upgraded `supabase-rls-audit-skill`.

Next automation candidate: Supabase RLS source-audit scanner.

Next repo workflow should be: `security-hardening-review-skill` for `/home/johnh/wagging-web-wins`.

Priority hardening target: `import-reddit-tips`.

Done when:

- It builds a table/RLS inventory from migrations.
- It extracts active policies and classifies broad access patterns.
- It maps frontend `supabase.from`, `supabase.rpc`, `storage.from`, and `functions.invoke` usage.
- It builds an Edge Function service-role/auth/JWT matrix.
- It extracts storage bucket and `storage.objects` policy evidence.
- It reviews SQL functions, RPC exposure, grants, and revokes.
- It emits a source-only public-anon safety judgement with PASS, PASS WITH REVIEW ITEMS, FAIL, or INCONCLUSIVE.
- It redacts secret-shaped values and reports only paths, lines, names, and risk categories.

## 14. Build Coding Workflow Orchestrator Helper

Status: first executable helper delivered as `scripts/run-next`.

Goal: keep expanding helper scripts that make orchestration repeatable without replacing skill judgement.

Candidate helpers:

- `scripts/run-next` follow-up paths for `auth-check`, exact-file `commit`, and `local-validation`
- `scripts/update_work_ledger.mjs`

Done in first version:

- Parses the latest ledger item for a requested repo.
- Understands `Ready to commit with caveats`, `Committed locally, not pushed`, `Needs GitHub auth gate`, `Needs John token replacement`, `Auth pass for GitHub handoff`, and `PR opened, not merged`.
- Implements the `Auth pass for GitHub handoff` path with isolated `GH_TOKEN`, repo access checks, expected commit/state checks, feature-branch push, and PR create/confirm logic.
- Implements the `PR opened, not merged` path as read-only PR readiness inspection with metadata, files, commits, checks, mergeability/review evidence, local repo state, and explicit readiness status.
- Implements the `PR ready for merge approval` path as a separate `pr-merge` gate that merges PR #11 only after safety checks and stops at `Merged, not deployed`.
- Implements the `Merged, not deployed` path as a separate `deployment-plan` gate that inspects local/source evidence only, drafts future Supabase secret/deploy/scheduler/runtime verification commands as not run, and stops at `Deployment plan ready, not deployed`.
- Implements the `Deployment plan ready, not deployed` path as a separate `supabase-preflight` gate that inspects source/local execution prerequisites only, drafts exact Supabase tooling/auth/secret/scheduler/deploy/runtime verification commands as not run, and stops at `Supabase execution preflight ready, not executed`.
- Implements the `Supabase execution preflight ready, not executed` path as a separate `supabase-tooling-auth` gate that checks Node/npm/npx, `npx supabase --version`, local env variable names/presence, project-ref match, and read-only project listing with runtime `SUPABASE_ACCESS_TOKEN`, then stops before link, secrets, deploy, scheduler mutation, SQL, and runtime verification.
- Implements the `Supabase tooling/auth ready, not linked` path as a separate `supabase-link-secret-readiness` gate that links the local repo, checks local link-created files, generates/stores `IMPORT_REDDIT_TIPS_SECRET` only in `/home/johnh/.openclaw/.env` if missing, and stops before remote secret setup, deploy, migrations, SQL, scheduler mutation, and runtime verification.
- Provides dry-run mode that does not mutate branch, push, PR, or completion ledger state.
- `scripts/classify_queue_item.mjs`
- `scripts/validate_skill_file.sh`
- `scripts/add_skill_gap.mjs`

Done when:

- It runs the local repo gate and reports no-git state cleanly.
- It creates or updates `work-ledger.md` with normalized fields.
- It checks every skill file for required sections.
- It verifies `skills-index.md` references every skill file.
- It can append a skill gap note to `build-queue.md`.
- It never runs state-changing commands, installs, commits, pushes, deploys, migrations, database mutations, or external API calls.

## 15. Build GitHub Auth Gate Helper

Status: `github-auth-gate-skill` has been created after the `/home/johnh/wagging-web-wins` GitHub handoff was blocked by invalid local `gh` auth.

Goal: create `scripts/github-auth-gate`.

Done when:

- It accepts `--repo`, `--expected-owner`, and `--expected-repo`.
- It reports `gh` availability without mutating external state.
- It reports environment token presence without printing values.
- It parses `gh auth status` into PASS, NEEDS JOHN, or BLOCKED.
- It can optionally switch to an already-authenticated account when allowed.
- It never prints, writes, or commits token values.
- It emits the next skill, usually `github-handoff-skill` after PASS.

## Missing Skill Gaps

Current required RUNBOOK mapping was checked against `skill-files/`.

Missing mapped skill files:

- None at this validation pass.

Weak or inspection-first skills that need real project evidence before automation:

- `cloudflare-deploy-skill`: exists, but has no confirmed deploy command. Upgrade after a real Cloudflare repo provides exact commands and verification steps.
- `supabase-rls-audit-skill`: upgraded from real validation feedback. Next work is scanner automation plus hardening feedback from `security-hardening-review-skill` on `/home/johnh/wagging-web-wins`.
- `migration-review-skill`: exists, but has no confirmed migration apply/test command. Upgrade after a target repo reveals framework-specific commands.
- `github-handoff-skill`: exists, and now routes invalid or unclear GitHub CLI auth to `github-auth-gate-skill`. Upgrade after a repo-specific PR is successfully opened.

When a future task needs a missing or weak skill, add a `Skill Upgrade Proposal` using `templates/skill-upgrade-template.md`.

## 2026-06-13 - Supabase Official Agent Skill Intake Follow-Up

Status: vendor guidance reviewed and adapted into local library rules.

Useful automation candidates:

- Add a Supabase migration-draft helper that can use `npx supabase migration new <name>` only after an explicit local migration-draft gate.
- Add a source scanner for Data API grant exposure versus RLS policy coverage.
- Extend the Supabase RLS source-audit scanner to flag `auth.role()`, `TO authenticated` without ownership, public `SECURITY DEFINER`, and view `security_invoker` gaps.

Next repo workflow remains gated: continue scheduler migration draft with official Supabase guidance, without remote secret setup, migration apply, SQL execution, function deploy, scheduler mutation, or runtime endpoint calls until John grants those separate permissions.
