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
4. Skill frontmatter plus `skills-index.md`: routing contract and skill discovery.
5. Selected `skill-files/*.md`: concrete commands, procedure, evidence, and safety rules.
6. `tools.md`: tool permission levels, safe examples, approval requirements, and evidence expectations.
7. `./scripts/validate-skills`: library validation after skill edits.
8. `evidence-checklist.md`: final evidence gate.

Permission gates in `AGENTS.md` override individual skill convenience. A skill may suggest a command, but that does not grant permission to install, edit, build, commit, push, deploy, migrate, mutate data, call external services, access secrets, release, or delete.

Git handoff requires its own gate. Use `github-handoff-skill` before any commit, use `scripts/committer` for approved local commits when available, and treat push, PR creation, deploy, migration, release, and merge as separate later decisions.

`scripts/run-next` is the default executable path when the next step is already represented in `work-ledger.md`. It must never assume permission: it can only act when a matching `--allow` flag is present. Manual prompts remain the fallback when the runner stops at an unimplemented state, missing permission, credential repair, merge, deploy, migration, production verification, or security decision boundary.

For GitHub PR handoff work, `PR opened, not merged` is not a dead end. `scripts/run-next --allow pr-readiness` may inspect the PR, collect files/checks/mergeability/review evidence, update the ledger, and stop before merge. Merge remains a separate John-required gate.

When John explicitly approves the merge gate and the ledger status is `PR ready for merge approval`, `scripts/run-next --allow pr-merge` may merge PR #11 only after rechecking auth, repo access, exact changed files, PR state, mergeability, checks, and repo-local workflow deployment evidence. It must stop at `Merged, not deployed`; deployment planning, Supabase secret setup, scheduler changes, runtime endpoint checks, and deployed RLS/grants remain separate gates.

When John explicitly approves deployment planning and the ledger status is `Merged, not deployed`, `scripts/run-next --allow deployment-plan` may inspect local/source evidence and produce a deployment plan. It must not deploy, set secrets, run migrations, mutate Supabase, update schedulers, call production endpoints, push, create PRs, or merge anything. It must stop at `Deployment plan ready, not deployed`.

When John explicitly approves Supabase execution preflight and the ledger status is `Deployment plan ready, not deployed`, `scripts/run-next --allow supabase-preflight` may inspect local/source execution prerequisites and draft the exact execution sequence. It must not install the Supabase CLI, run `npx supabase`, log in, link a project, set secrets, deploy functions, run migrations, execute SQL, mutate schedulers, call runtime endpoints, push, create PRs, or merge. It must stop at `Supabase execution preflight ready, not executed`.

When John explicitly approves Supabase tooling/auth setup and the ledger status is `Supabase execution preflight ready, not executed`, `scripts/run-next --allow supabase-tooling-auth` may check Node/npm/npx, run `npx supabase --version`, inspect local runtime env variable names/presence without printing values, and use `SUPABASE_ACCESS_TOKEN` only for read-only project listing. It must not install the Supabase CLI as a dependency, run interactive login, link, set secrets, deploy, run migrations, execute SQL, mutate schedulers, invoke functions, call production endpoints, push, create PRs, or merge. It must stop at either a clear tooling/auth credential boundary or `Supabase tooling/auth ready, not linked`.

When John explicitly approves Supabase link/local secret readiness and the ledger status is `Supabase tooling/auth ready, not linked`, `scripts/run-next --allow supabase-link-secret-readiness` may run `npx supabase link --project-ref <approved-ref>` and ensure `IMPORT_REDDIT_TIPS_SECRET` exists only in `/home/johnh/.openclaw/.env`. If missing, it may generate a strong local secret and write it only to that local runtime env file without printing the value. It must stop before remote secret setup, deploy, migrations, SQL, scheduler mutation, Edge Function invocation, runtime endpoint calls, push, create PRs, or merge.

When John explicitly approves the combined scheduler draft and PR gate and the ledger status is `Supabase linked and local secret ready, not deployed`, `scripts/run-next --allow scheduler-draft-pr` may draft a guarded local scheduler migration, update local docs, run local checks, create an exact-file commit, push the feature branch, and open or confirm a PR. It must stop at `Scheduler migration PR opened, not merged` and must not set remote Supabase secrets, deploy functions, run `db push`, apply migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push `main`, force-push, or merge the PR.

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
3. Treat local edits, dependency installs, test/lint/build, commit, push, PR creation, merge/close, deploy, migration, database mutation, external API call, and release/tag as separate permission gates.
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
6. John must approve merge, deprecate, delete, or rename actions.
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
- Need to trace OpenClaw subagent routing: `route-trace-skill`
- Need to compare OpenClaw config backups: `openclaw-config-diff-skill`
- Need to coordinate local tools, reads, writes, process logs, or gateway calls: `tool-patterns-skill`
- Need a public market scan from proxy data: `public-market-scan-skill`
- Need to audit skill bloat, overlap, routing, or cleanup candidates: `skill-cleaner-skill`

When frontmatter and this prose mapping disagree, treat `./scripts/validate-skills` output and the active skill file as the source of truth, then update stale docs.

## Missing Skill Handling

If a mapped skill file is missing:

1. Do not claim it exists.
2. List the missing skill name.
3. Add a "missing skill gap" entry to `build-queue.md`.
4. Recommend whether it should be created.
5. Use only generic read-only inspection until the user approves creating the missing skill or selects another skill.

## Secret Handling

If a secret-looking value is found:

1. Stop reading that value.
2. Do not print the value.
3. Report the file path, line number if safe, and secret class such as API key, private key, token, or service role.
4. Recommend containment steps.
5. Continue only after the user confirms the next safe action.

## Run Logging

Every active orchestrated task must update `work-ledger.md`.

Every real use of this library must be logged in `runs/skill-runs.md`.

`scripts/run-next` updates `work-ledger.md` for real runs and appends `runs/skill-runs.md` for both real runs and dry-runs. Dry-runs must not mark ledger work completed.

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
