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
---
# coding-workflow-orchestrator-skill

## Purpose

This is the control-plane skill for the local coding workflow system.

Use it to decide which work should happen next, classify the queue item, select the correct downstream skill, run one bounded work loop, collect evidence, update the work ledger, update the run log, and stop at the correct permission boundary.

The orchestrator must not perform deep implementation itself unless the selected downstream skill authorizes it. It should avoid random prompting and decide the next safe step from evidence.

`scripts/run-next` is the executable implementation of this orchestrator loop. It reads ledger state, selects the next skill, checks supplied permission flags, runs covered safe actions, updates ledger/run-log evidence, and stops at permission boundaries. Manual prompts are fallback control, not the default, when `scripts/run-next` covers the current ledger state.

For GitHub work, `scripts/run-next` can continue past `PR opened, not merged` into read-only PR readiness inspection. It may collect PR metadata, checks, changed files, commits, mergeability, review decision, and local repo evidence, but it must stop before merge.

When John separately approves PR merge and the ledger status is `PR ready for merge approval`, `scripts/run-next --allow pr-merge` may merge PR #11 only after rechecking the auth user, repo access, exact changed files, PR state, `MERGEABLE` state, PR checks, and repo-local workflow deployment evidence. It must stop at `Merged, not deployed`.

When John separately approves deployment planning and the ledger status is `Merged, not deployed`, `scripts/run-next --allow deployment-plan` may inspect local/source evidence and draft a deployment plan. It must stop at `Deployment plan ready, not deployed` and must not deploy, set secrets, run migrations, mutate Supabase, update schedulers, call production endpoints, push, create PRs, or merge.

When John separately approves Supabase execution preflight and the ledger status is `Deployment plan ready, not deployed`, `scripts/run-next --allow supabase-preflight` may inspect local/source execution prerequisites and draft exact execution commands. It must stop at `Supabase execution preflight ready, not executed` and must not install the Supabase CLI, run `npx supabase`, log in, link a project, set secrets, deploy functions, run migrations, execute SQL, mutate schedulers, call runtime endpoints, push, create PRs, or merge.

When John separately approves Supabase tooling/auth setup and the ledger status is `Supabase execution preflight ready, not executed`, `scripts/run-next --allow supabase-tooling-auth` may check Node/npm/npx, run `npx supabase --version`, inspect local env names/presence without printing values, and use `SUPABASE_ACCESS_TOKEN` only for read-only project listing. It must stop before `supabase login`, `supabase link`, secrets, deploy, migrations, SQL, scheduler mutation, Edge Function invocation, runtime endpoint calls, push, PR, or merge.

When John separately approves Supabase link/local secret readiness and the ledger status is `Supabase tooling/auth ready, not linked`, `scripts/run-next --allow supabase-link-secret-readiness` may run local Supabase link and ensure `IMPORT_REDDIT_TIPS_SECRET` exists only in `/home/johnh/.openclaw/.env`. It must stop before remote secret setup, deploy, migrations, SQL, scheduler mutation, Edge Function invocation, runtime endpoint calls, push, PR, or merge.

When John separately approves the combined scheduler draft and PR gate and the ledger status is `Supabase linked and local secret ready, not deployed`, `scripts/run-next --allow scheduler-draft-pr` may draft a guarded local scheduler migration, update docs, run local checks, create an exact-file commit, push the feature branch, and open or confirm a PR. It must stop at `Scheduler migration PR opened, not merged` and must not set remote secrets, deploy functions, run `db push`, apply migrations, execute SQL, mutate schedulers, invoke Edge Functions, call production endpoints, push `main`, force-push, or merge.

When John separately approves official Supabase vendor-skill intake, install and inspect the vendor package only under `vendor-intake/`. Do not install vendor skills into the target repo, let vendor instructions override local gates, or continue into scheduler migration/deploy work in the same run. Adapt only useful guidance into local library files and keep the ledger at the current gated Supabase status unless a separate approved runner path changes it.

## When to Use

Use before starting multi-step coding workflow work, queue triage, handoff recovery, repo work with unclear permissions, or any task where the next safe skill is not already obvious.

Prefer invoking `scripts/run-next --dry-run` first when the active work already exists in `work-ledger.md`; then use the real `scripts/run-next` command only with explicit `--allow` flags covering the next action. Use `--allow pr-readiness` for read-only PR readiness inspection after a PR is open. Use `--allow pr-merge` only after John explicitly approves the merge gate. Use `--allow deployment-plan` only after John explicitly approves source-only deployment planning. Use `--allow supabase-preflight` only after John explicitly approves source/local Supabase execution preflight. Use `--allow supabase-tooling-auth` only after John explicitly approves Supabase tooling/auth setup. Use `--allow supabase-link-secret-readiness` only after John explicitly approves Supabase link/local secret readiness. Use `--allow scheduler-draft-pr` only after John explicitly approves the combined local scheduler draft, exact-file commit, feature-branch push, and PR gate. Vendor-skill intake is a separate advisory workflow, not a runner permission to mutate the target repo or Supabase.

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
