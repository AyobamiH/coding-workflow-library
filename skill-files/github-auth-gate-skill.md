---
name: github-auth-gate-skill
description: Checks and prepares local GitHub CLI authentication before GitHub handoff work.
category: github
routing_triggers:
  - github auth blocked
  - gh auth invalid
  - prepare github auth
  - switch github account
  - token gate
status: active
---
# github-auth-gate-skill

## Purpose

This skill is a permission and authentication gate for GitHub CLI work. It checks local `gh` availability, local GitHub authentication state, active account identity, repo owner alignment, environment token presence, and whether account switching can happen with already-provisioned local credentials.

This skill does not ask John to paste tokens into chat. It checks local `gh` auth state and only asks John to provision or refresh credentials when the local machine lacks valid auth.

Use this skill before returning to `github-handoff-skill` for push or PR work. Auth success is not push, PR, deploy, merge, release, or production permission.

When the gate passes, return only an auth result and the next skill. Do not create branches, push, open PRs, merge, delete branches, or stage files from this skill.

## When to Use

Use when:

- `gh auth status` fails.
- GitHub handoff is blocked by an invalid token.
- A repo needs push or PR work.
- Multiple GitHub accounts may exist locally.
- The orchestrator needs to confirm the active GitHub account.
- `GH_TOKEN` or `GITHUB_TOKEN` may be available in the environment.
- A cached GitHub CLI token may be expired, revoked, or scoped incorrectly.
- The active account may not match the target repo owner.

## Inputs Required

- `TARGET_REPO`: absolute path to the target repo.
- Expected GitHub owner or account, for example `AyobamiH`.
- Expected repo, for example `AyobamiH/wagging-web-wins`.
- Current permission level: auth-check only, push, PR creation, or another explicit gate.
- Whether account switching is allowed.
- Whether environment token usage is allowed.
- Whether push or PR work is separately approved after auth passes.
- Known remote name if not `origin`.

## Commands

Read-only local and auth-check commands:

```bash
command -v gh || true
gh auth status || true
gh auth status --hostname github.com || true
gh auth status --show-token-scopes || true
git -C "$TARGET_REPO" remote -v
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" status --short
```

Environment-token presence checks. These must never print token values:

```bash
test -n "$GH_TOKEN" && echo "GH_TOKEN is set" || echo "GH_TOKEN is not set"
test -n "$GITHUB_TOKEN" && echo "GITHUB_TOKEN is set" || echo "GITHUB_TOKEN is not set"
```

Local account switching, only if the expected account is already authenticated locally and John has allowed account switching:

```bash
gh auth switch --hostname github.com --user "$EXPECTED_OWNER"
```

Manual provisioning instructions for John to run outside chat, on the local machine, only when credentials are missing or expired:

Option A:

```bash
gh auth login -h github.com
```

Option B:

```bash
read -s GH_TOKEN
export GH_TOKEN
gh auth status
unset GH_TOKEN
```

Option C for persistent CLI auth from stdin:

```bash
read -s GH_TOKEN
echo "$GH_TOKEN" | gh auth login --with-token
unset GH_TOKEN
```

Only John should run token provisioning steps. Agents must not ask John to paste tokens into chat, must not print tokens, and must not save tokens in repo files.

## Procedure

1. Read `AGENTS.md` and `tools.md`.
2. Confirm `TARGET_REPO` exists and capture local Git state.
3. Inspect `git -C "$TARGET_REPO" remote -v`.
4. Infer expected owner and repo from the GitHub remote URL if they were not provided.
5. Check `gh` availability with `command -v gh || true`.
6. Check environment token presence without printing values.
7. Run `gh auth status || true` and `gh auth status --hostname github.com || true`.
8. If scope evidence is needed, run `gh auth status --show-token-scopes || true` and report scope names only.
9. Identify the active GitHub account from `gh auth status` output if available.
10. If valid active auth matches the expected owner or intended account, return `PASS`.
11. If the active account differs and account switching is allowed, confirm the expected account is already authenticated locally from status output.
12. If the expected account is already locally authenticated, run `gh auth switch --hostname github.com --user "$EXPECTED_OWNER"`.
13. Recheck `gh auth status`.
14. If auth now matches the expected account, return `PASS`.
15. If the token is invalid, missing, expired, revoked, wrong-account, or under-scoped, return `NEEDS JOHN` with exact local provisioning steps.
16. Do not continue to push or PR work unless that separate permission exists and this auth gate returns `PASS`.
17. If `PASS`, record that the next skill is `github-handoff-skill` and that push/PR/merge still require their own permission gates.
18. Update `work-ledger.md` with the auth gate result, active account evidence, next skill, and exact next action.
19. Append a run log entry to `runs/skill-runs.md`.
20. Route back to `github-handoff-skill` after `PASS`.

## Evidence Required

- `command -v gh` result.
- Target repo path.
- Git branch and `git status --short`.
- Remote URL.
- Expected owner and repo.
- Active GitHub account, if available.
- Auth status summary without token value.
- Environment token presence only, not values.
- Token scope names only if scope output was requested.
- Account switch command and result if run.
- Final status: `PASS`, `NEEDS JOHN`, or `BLOCKED`.
- Whether push or PR work was skipped or remains separately gated.
- Next skill, usually `github-handoff-skill` after `PASS`.
- Work ledger update.
- Run log update.

## Safety Rules

- Never print tokens.
- Never ask John to paste a token into chat.
- Never write tokens to repo files.
- Never save tokens in the skills library.
- Never commit auth files.
- Never run push or PR commands as part of auth check unless separately permitted.
- Never treat auth success as deploy, merge, release, migration, or production permission.
- Never treat auth success as branch creation, push, PR creation, or branch deletion permission.
- Never use an invalid or wrong account for repo push.
- Do not run `gh auth token` unless explicitly needed, and never print its output.
- If token scopes are shown, report scope names only.
- Treat `GH_TOKEN` and `GITHUB_TOKEN` as runtime auth only.
- Remember that `GH_TOKEN` may override stored `gh` credentials for the current process.
- Stop if provisioning or refreshing credentials requires human action.

## Common Failures

- Invalid cached token.
- Wrong active GitHub account.
- Fine-grained token missing repo permission.
- Environment token overrides stored credentials.
- `GH_TOKEN` set for the wrong account.
- `GITHUB_TOKEN` set for an automation context without repo push or PR permission.
- `gh` installed but not logged in.
- Remote owner does not match active user.
- Private repo access denied.
- Token expired or revoked.
- `gh auth switch` fails because the expected account is not already locally authenticated.

## Output Format

```text
# GitHub Auth Gate Report

## Selected Skill

## Target Repo

## Expected GitHub Repo

## GH Availability

## Environment Token Presence

## Auth Status

## Active Account

## Account Switch Result

## Final Status

## Next Skill

## Ledger Update

## Run Log Update

## John Action Needed
```

## Upgrade Ideas

- Add script helper `scripts/github-auth-gate`.
- Add account-to-repo mapping file.
- Add secure token-manager integration.
- Add `one-password-secret-access-skill` integration.
- Add preflight before GitHub handoff.
