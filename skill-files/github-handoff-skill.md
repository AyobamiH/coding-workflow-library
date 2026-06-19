---
name: github-handoff-skill
description: Prepare exact-file git status, commit, and PR handoff.
category: github
routing_triggers:
  - commit readiness
  - GitHub handoff
  - PR prep
  - git status
status: active
---
# GitHub Handoff Skill

## Purpose

Prepare a local Git handoff after changes: exact-file status, diff evidence, commit readiness, PR readiness, merge handoff boundaries, caveats, and next permission gates.

Use `scripts/committer` when a local commit is approved and the helper is available. This skill separates `ready-to-commit` from `ready-to-deploy`, and it does not turn commit permission into push, PR, release, deploy, migration, database, or external-service permission.

Use `github-auth-gate-skill` before push or PR work when `gh auth status` fails, the active account is unclear, or credentials may be expired, revoked, wrong-account, or under-scoped.

The reusable lifecycle is: auth gate, exact-file commit, feature-branch creation or recovery, push of that branch only, PR creation or confirmation, PR readiness inspection, merge decision, optional branch deletion as a separate gate, and post-merge handoff. Each step has its own permission boundary.

## When to Use

Use after creating/editing files, before asking the user to review, when the user asks for commit readiness, or when a handoff needs to preserve validation caveats.

Use before any commit. Use it again before push, PR, or PR merge if the task later crosses into remote GitHub work.

## Inputs Required

- Repo path.
- Files changed.
- Exact files that should be included in the handoff.
- Whether the user wants a dry-run, staged no-commit state, or an actual local commit.
- Commit message if local commit is approved.
- Git identity configuration or permission to set it.
- Validation commands already run and their results.
- Known unrelated dirty files, untracked evidence directories, generated artifacts, and validation caveats.
- Whether push, PR, deploy, migration, or production verification is explicitly approved.
- GitHub auth gate result before any approved push or PR work.
- PR number, expected changed files, mergeability/checks evidence, and explicit merge approval before any PR merge.
- Existing branch or PR URL when recovering an interrupted handoff.
- Whether branch deletion is explicitly approved after merge.

## Commands

Read-only state and evidence:

```bash
git status --short
git status -sb
git diff --check
git diff --stat
git diff -- path/to/file
git diff --cached --stat
```

Preferred exact-file helper:

```bash
./scripts/committer --repo "$TARGET_REPO" --message "Describe the exact scoped change" --files path/to/file --dry-run
./scripts/committer --repo "$TARGET_REPO" --message "Describe the exact scoped change" --files path/to/file --no-commit
./scripts/committer --repo "$TARGET_REPO" --message "Describe the exact scoped change" --files path/to/file
```

Fallback exact Git commands if `scripts/committer` is unavailable and local commit permission is explicit:

```bash
git status --short
git diff --check
git add -- path/to/file-one path/to/file-two
git status --short
git diff --cached --stat
git commit -m "Describe the exact scoped change"
```

Git identity suggestions from error output, approval required before setting global identity:

```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

Repo-discovery template for GitHub CLI, not confirmed as used:

```bash
rg -n "gh |pull request|release|workflow|actions" .github . 2>/dev/null
```

GitHub auth preflight before push or PR work:

```bash
command -v gh || true
gh auth status || true
```

Feature branch and PR lifecycle, only when separately approved:

```bash
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" switch -c "$FEATURE_BRANCH"
git -C "$TARGET_REPO" switch "$FEATURE_BRANCH"
git -C "$TARGET_REPO" push -u origin "$FEATURE_BRANCH"
gh pr view --repo "$OWNER_REPO" "$PR_NUMBER" --json url,title,state,headRefName,baseRefName,mergeable,files,commits
gh pr checks --repo "$OWNER_REPO" "$PR_NUMBER" || true
gh pr create --repo "$OWNER_REPO" --base main --head "$FEATURE_BRANCH" --title "$TITLE" --body-file "$BODY_FILE"
gh pr merge --repo "$OWNER_REPO" "$PR_NUMBER" --merge
```

Never use `git add .`.

## Procedure

1. Check git status before staging.
2. Identify intended files and unrelated dirty files separately.
3. Inspect exact-file diffs for intended files when possible.
4. Run `git diff --check`.
5. Record validation caveats from lint, test, build, security, or source-only checks. If lint/test fail because of unrelated known issues, include them as caveats instead of hiding them.
6. Decide the status:
   - `ready-to-commit`: exact files are known, diff/check evidence is collected, no secret-shaped diff markers are present, and commit permission is either granted or can be requested.
   - `ready-to-deploy`: build/runtime/deployment proof and deployment plan exist, but deploy permission is still separate.
7. If the user has not approved a commit, produce a handoff summary and the exact `scripts/committer --dry-run` command.
8. If local commit preparation is approved, prefer `scripts/committer`.
9. Use `scripts/committer --dry-run` before `--no-commit` or default commit mode unless the user specifically asks to proceed directly.
10. In `--no-commit` mode, stage exact files only and report the suggested commit command.
11. In default helper mode, commit exact files only with the provided message.
12. If `scripts/committer` is unavailable, stage with `git add -- <exact files>` only after confirming no unrelated staged files exist.
13. Do not stage untracked evidence directories unless they are explicitly listed in the intended files.
14. If identity is missing, ask whether to set repo-local or global config and do not guess.
15. Before any approved push or PR work, run the GitHub auth preflight.
16. If `gh auth status` fails, route to `github-auth-gate-skill`.
17. Do not ask John for vague auth help; use the auth gate to produce exact local provisioning steps when needed.
18. Do not proceed to push or PR until `github-auth-gate-skill` returns `PASS`.
19. After `PASS`, continue only the separately approved feature branch, push, and PR work.
20. If already on the intended feature branch, keep it and verify the intended commit is present.
21. If already on a different feature branch, report it and do not switch unless the gate allows branch switching.
22. If a PR already exists, confirm URL, head/base, changed files, commits, and state instead of creating a duplicate.
23. Do not push `main`; push only the intended feature branch.
24. Do not force push unless John gives a separate force-push approval and recovery plan.
25. Do not push, create PRs, merge PRs, tag, release, deploy, run migrations, or verify production unless that separate gate is approved.
26. For PR readiness, inspect exact files, commits, checks, mergeability, review state, and any workflow/deploy implication without merging.
27. If PR merge is approved, recheck the PR immediately before merging: expected account, repo access, `OPEN` state, exact changed files, `MERGEABLE`, nonblocking checks, and repo-local workflow deployment evidence.
28. If a repo-local workflow clearly suggests merging `main` may deploy, stop with a deployment-aware owner decision instead of merging.
29. Do not delete the feature branch during merge unless John explicitly approves branch deletion.
30. After a merge, record `Merged, not deployed` or the repo-specific post-merge state and stop before deployment planning.

## Evidence Required

- Git status before/after.
- Branch and repo path.
- Exact files intended.
- Exact files staged, if staging was approved.
- Diff stat and staged diff stat.
- `git diff --check` result.
- Secret-shaped staged diff scan result when using `scripts/committer`.
- Handoff caveats from validation.
- Commit hash if commit succeeded.
- Exact failure if commit failed.
- Final status.
- Statement that push/PR/deploy were not performed unless explicitly approved.
- GitHub auth gate result before any push or PR work.
- For PR creation: branch, pushed ref, PR URL, base/head, body file used, and files included/excluded.
- For PR readiness: PR URL, state, base/head, exact files, commits, checks, mergeability, review state, and workflow/deploy implications.
- For PR merge: repo-local workflow deployment scan, PR state, exact changed files, checks, merge command result, final PR state, branch deletion decision, and post-merge local repo state.
- For open-source repository handoff: public hardening files, GitHub auth account, repository existence/visibility, exact files committed, commit hash, branch, remote URL, push result, local HEAD, remote `main` HEAD, and commands deliberately not run.

## Safety Rules

- Use exact-file commit rules.
- Prefer `scripts/committer` before commit when available.
- Never use `git add .`.
- Do not stage unrelated files.
- Do not stage untracked evidence directories unless explicitly listed.
- Do not set global identity without approval.
- Do not invent `gh` commands from memory.
- If `gh auth status` fails, route to `github-auth-gate-skill`.
- Do not proceed to push or PR work until the auth gate returns `PASS`.
- Do not ask John to paste GitHub tokens into chat.
- Do not push or create PRs without explicit request.
- Do not merge PRs without explicit merge approval and immediate pre-merge safety checks.
- Do not delete the feature branch during merge unless John explicitly approves branch deletion.
- Do not force push unless John explicitly approves force-push recovery.
- Do not create duplicate PRs when a suitable existing PR can be confirmed.
- Do not use auth success as permission to push, PR, merge, release, deploy, or mutate external services.
- For public/open-source handoff, do not publish npm packages, run `npm version`, create git tags, create GitHub releases, deploy, or use broad staging. Repository creation and one `main` push require explicit approval.
- Do not describe a repo as `ready-to-deploy` just because it is `ready-to-commit`.
- Do not hide unrelated lint/test failures; report them as caveats.
- Do not reset, clean, restore, stash, delete, pull, rebase, or switch branches unless the user explicitly approves that gate.

## Common Failures

- Not a git repo: report and skip git handoff.
- Author identity unknown: ask for name/email and scope.
- Whitespace check fails: fix in touched files or report.
- Unrelated dirty files: leave them alone and mention them.
- Unrelated staged files already present: refuse commit prep until the user resolves or explicitly scopes them.
- Broad staging temptation: use `scripts/committer` or `git add -- <exact files>` only.
- Untracked evidence directories staged accidentally: untracked evidence must stay out of the commit unless explicitly listed.
- Validation caveats omitted: include unrelated lint/test failures, source-only limits, and deployment verification gaps.
- Commit hash reported without a real commit: only report a hash from a successful approved commit.
- Invalid `gh` auth: run `github-auth-gate-skill` and stop until it returns `PASS`.
- Vague auth prompt: use the auth gate output format and exact local provisioning steps instead.
- Existing branch already contains the commit: confirm and continue only within the approved branch gate.
- Existing PR already exists: view and confirm it rather than creating a duplicate.
- Merge blocked by checks or branch protection: report readiness evidence and stop.
- Force-push temptation after branch divergence: stop for explicit recovery approval.
- Treating public GitHub source handoff as npm release approval: stop before publish, version, tag, and GitHub release gates.

## Output Format

```text
Git handoff:
- Classification: ready-to-commit | ready-to-deploy | blocked | needs John
- Repo:
- Branch:
- Intended files:
- Unrelated changes:
- Checks:
- Caveats:
- Commit prep:
- Commit:
- Push/PR/deploy:
- Next action:
```

## Upgrade Ideas

- Add optional repo-specific references after a real GitHub workflow is confirmed.
- Add a public-source handoff helper that verifies repository emptiness/conflicts, exact files, remote HEAD parity, and release blockers before push.
- Add a GitHub deep-review skill that inspects open PRs, review comments, CI runs, and branch protection before PR handoff.
- Add a pre-commit hook that runs `scripts/committer`-style path and secret checks before manual commits.
- Add first-version source tag handoff that pushes an exact release commit, waits for CI on that commit, creates/pushes one annotated tag, verifies remote tag dereference, records post-tag bookkeeping, and still blocks npm publish and GitHub release creation.
