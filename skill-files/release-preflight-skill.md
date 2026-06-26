---
name: release-preflight-skill
description: Run a local release gate that combines validation evidence, package readiness, evidence packs, git state, and publish boundaries.
category: verification
routing_triggers:
  - release preflight
  - release readiness
  - publish boundary
  - local release gate
status: active
---

# release-preflight-skill

## Purpose

Run a local release gate before a package, CLI, app, or skills library is published, tagged, pushed, deployed, or handed off.

This skill connects `evidence-pack-builder-skill` and `npm-package-readiness-skill` with local build/test evidence, changelog or release-note checks, Git cleanliness, version/tag readiness, and explicit publish boundaries.

Local release preparation runs under `local_execution`. Git push, tag push, GitHub Release creation, and npm publication are `remote_publication` consequences and should be presented as one consolidated objective boundary. Missing npm authentication is `BLOCKED_CAPABILITY`, not `BLOCKED_PERMISSION`; continue version, changelog, release notes, validation, package smoke, and local commit work when those stages do not depend on publication.

The helper supports modes: `local`, `npm`, and `cli`. `local` is the default and must not fail only because a repo is not an npm package. `npm` expects package readiness. `cli` expects package readiness and CLI `bin` readiness.

For this skills library, MIT has been selected and `package.json` may exist as a local package candidate scaffold named `autonomous-coding-workflow-library` with repository identity `AyobamiH/coding-workflow-library`. The local CLI command candidate is `coding-workflow`. Release preflight may classify readiness, but publishing remains blocked until John confirms final npm package name availability and ownership and separately approves the publish/tag/push/release gate.

## When to Use

Use this skill when John asks for release readiness, publish readiness, package handoff, release preflight, local release gate, or a combined evidence bundle before shipping.

Use it after package or workflow changes when the next decision could involve npm publish, GitHub release, tag creation, deploy, push, or external distribution.

## Inputs Required

- Target repo path.
- Package directory if different from target repo.
- Release mode: `local`, `npm`, or `cli`.
- Whether package dry-run is allowed.
- Whether an evidence pack should be written or only dry-run planned.
- Known validation commands and whether they were already run.
- Intended release version or tag, if supplied.
- Changelog or release-note path, if supplied.
- Explicit statement of which release actions remain forbidden.
- Whether the package candidate name and repository identity have been confirmed.
- Whether final registry availability and ownership have been confirmed before publish.

## Commands

Local helper:

```bash
./scripts/release-preflight --repo "$TARGET_REPO"
./scripts/release-preflight --repo "$TARGET_REPO" --mode local
./scripts/release-preflight --repo "$TARGET_REPO" --mode npm
./scripts/release-preflight --repo "$TARGET_REPO" --mode cli
./scripts/release-preflight --repo "$TARGET_REPO" --allow-pack-dry-run
```

Component helpers:

```bash
./scripts/npm-package-readiness --repo "$TARGET_REPO"
./scripts/npm-package-readiness --repo "$TARGET_REPO" --expect-package
./scripts/npm-package-readiness --repo "$TARGET_REPO" --expect-cli
./scripts/npm-package-readiness --repo "$TARGET_REPO" --allow-pack-dry-run
./scripts/evidence-pack --repo "$TARGET_REPO" --title "Release preflight" --dry-run
```

Basic local git checks:

```bash
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" log --oneline -5
git -C "$TARGET_REPO" tag --points-at HEAD
```

## Procedure

1. Confirm the target repo and release scope.
2. Confirm this is local preflight only.
3. Capture Git state and current branch.
4. Check whether the working tree is clean or document uncommitted changes.
5. Check whether HEAD already has a tag without creating one.
6. Run or read local validation evidence already approved for this task.
7. Select release mode:
   - `local`: local handoff/release evidence; package checks may be `NOT_APPLICABLE`.
   - `npm`: npm package release readiness; `package.json` is required.
   - `cli`: npm CLI release readiness; `package.json` and `bin` are required.
8. Run `npm-package-readiness-skill` or `scripts/npm-package-readiness` with the mode-appropriate expectation flags.
9. Run evidence-pack planning with `scripts/evidence-pack --dry-run`, or write an evidence pack only if local-edit evidence creation is explicitly approved.
10. Check README and changelog or release-note presence.
11. If npm mode is used for a candidate package, record whether the package name is still a John-required blocker.
12. Classify release readiness.
13. State exactly which gates remain separate: publish, tag, push, deploy, remote registry mutation, and GitHub release.

## Evidence Required

- Target repo path.
- Release mode.
- Git status.
- Current branch.
- Recent commits.
- Tag-at-HEAD result.
- Validation commands run or explicit not-run list.
- Package readiness result.
- Evidence pack dry-run or output path.
- README result.
- Changelog/release-note result.
- Release blockers and warnings.
- Final package-name blocker, if any.
- Final release preflight classification.
- Next safe step.

## Safety Rules

- Do not publish packages.
- Do not tag releases.
- Do not push commits or tags.
- Do not deploy.
- Do not mutate npm registries.
- Do not create GitHub releases.
- Do not install dependencies unless John separately approves it.
- Do not read `.env` or token-bearing config values.
- Do not print secrets, token values, database URLs, or credential values.

Forbidden commands by default:

```bash
npm publish
npm version
git tag
git push
git push --tags
gh release create
wrangler deploy
supabase functions deploy
```

## Common Failures

- Treating `npm pack --dry-run` as publish permission.
- Failing local mode only because the repo is not an npm package.
- Running npm mode when the user only asked for local workflow evidence.
- Creating a tag during preflight.
- Ignoring dirty working tree state.
- Missing README or release notes.
- Package readiness warnings hidden inside a broader release report.
- Evidence pack planned but not written, then reported as written.
- Claiming release readiness without validation evidence.

## Output Format

```markdown
# Release Preflight Report

## Target Repo

## Permission Level

## Git State

## Version And Tag Readiness

## Local Validation

## Package Readiness

## Evidence Pack

## Docs And Release Notes

## Release Boundaries

## Final Classification

## Next Safe Step
```

## Upgrade Ideas

- Add JSON output to `scripts/release-preflight`.
- Add configured validation command discovery.
- Add release-note diff checks.
- Add optional registry read-only version check after explicit network permission.
- Add integration with GitHub handoff and evidence-pack reports.
- Add GitHub source handoff mode that proves public repository files, CI, exact-file commit scope, and remote HEAD parity while still blocking publish/version/tag/release.
- Add first-version tag mode that requires package version/changelog/release notes, clean local validation, package smoke, exact release commit CI success, annotated tag verification, and explicit exclusion of npm publish and GitHub release creation.
