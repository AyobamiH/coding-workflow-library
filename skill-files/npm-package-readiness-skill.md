---
name: npm-package-readiness-skill
description: Check Node package and CLI readiness for npm distribution without publishing unless explicitly approved.
category: verification
routing_triggers:
  - npm package readiness
  - npm publish readiness
  - package distribution
  - CLI install flow
status: active
---

# npm-package-readiness-skill

## Purpose

Inspect whether a Node package or CLI is ready for npm distribution using local evidence only.

This skill verifies package metadata, package contents, entrypoints, lockfiles, docs, scripts, and publish boundaries. It does not publish, tag, push, install dependencies, mutate registries, or change versions without separate explicit permission.

It distinguishes `PASS`, `WARN`, `FAIL`, `NOT_VERIFIED`, and `NOT_APPLICABLE`. A repo without `package.json` is not a failed npm package check unless npm packaging was explicitly expected.

## When to Use

Use this skill before npm release planning, CLI handoff, package distribution, package rename/version review, package tarball inspection, or release preflight.

Use it when run logs mention npm package readiness, CLI install flow, package distribution, release preflight, or paused npm publish work.

For this skills library, `package.json` may exist as a local candidate scaffold. The current package candidate is `autonomous-coding-workflow-library` with repository identity `AyobamiH/coding-workflow-library`, and the local CLI command candidate is `coding-workflow`. That proves metadata and local CLI shape only; it does not approve publish, version bump, tag, push, package rename, registry mutation, or public CLI distribution. The current package-name blocker is `NEEDS JOHN: confirm final npm package name availability and ownership before publish`.

## Inputs Required

- Target repo path.
- Package directory if it is not the repo root.
- Whether `npm pack --dry-run` is allowed.
- Whether an npm package is expected.
- Whether a CLI `bin` entrypoint is expected.
- Whether network registry checks are allowed.
- Expected CLI command names, if any.
- Known build, test, lint, or typecheck commands.
- Whether package version changes are allowed.
- Whether dependency installs are allowed.
- Whether the candidate npm package name and repository identity are confirmed.
- Whether final registry availability and ownership are confirmed before publish.

## Commands

Default read-only local inspection:

```bash
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" branch --show-current
git -C "$TARGET_REPO" log --oneline -5
```

Package metadata reads:

```bash
node -e "const p=require('./package.json'); console.log(JSON.stringify({name:p.name,version:p.version,description:p.description,license:p.license,bin:p.bin,files:p.files,scripts:p.scripts}, null, 2))"
```

Helper script:

```bash
./scripts/npm-package-readiness --repo "$TARGET_REPO"
./scripts/npm-package-readiness --repo "$TARGET_REPO" --json
./scripts/npm-package-readiness --repo "$TARGET_REPO" --expect-package
./scripts/npm-package-readiness --repo "$TARGET_REPO" --expect-cli
./scripts/npm-package-readiness --repo "$TARGET_REPO" --allow-pack-dry-run
```

Optional package dry-run, only when explicitly allowed:

```bash
npm pack --dry-run
```

Local CLI smoke, only when CLI package smoke is approved:

```bash
./bin/coding-workflow.js --help
./bin/coding-workflow.js routes
./bin/coding-workflow.js package-readiness --repo . --expect-package --expect-cli
./bin/coding-workflow.js release-preflight --repo . --mode cli --allow-pack-dry-run
```

## Procedure

1. Confirm target repo and package directory.
2. Capture Git state.
3. Read `package.json` without modifying it.
4. If `package.json` is absent and package release was not expected, classify `NOT_APPLICABLE`.
5. If `package.json` is absent and `--expect-package` was supplied, classify `FAIL`.
6. Check `name`, `version`, `description`, and `license`.
7. If the package is a local candidate scaffold, record whether the package name is final or still John-required before publish.
8. If the package is a CLI or `--expect-cli` was supplied, check the `bin` field.
9. Confirm each `bin` target exists.
10. If `--expect-cli` was supplied and no `bin` exists, classify `FAIL`.
11. If no `bin` exists and CLI was not expected, classify `WARN`.
12. Confirm executable permission for bin targets when the package is intended to be run directly.
13. For this library's approved local CLI candidate, confirm `coding-workflow` maps to `bin/coding-workflow.js`.
14. Detect package manager lockfiles: `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`, or `bun.lockb`.
15. Check whether package contents are controlled by a `files` field or `.npmignore`.
16. Check for README presence.
17. Check for changelog or release notes when available.
18. Identify build, test, lint, typecheck, format, and prepare scripts.
19. Run `npm pack --dry-run` only when explicitly allowed.
20. Inspect dry-run output for accidental env files, evidence folders, caches, local configs, or private artifacts.
21. Produce a readiness judgement: `PASS`, `WARN`, `FAIL`, `NOT_VERIFIED`, or `NOT_APPLICABLE`.

## Evidence Required

- Target repo path.
- Package directory.
- Git state.
- `package.json` presence.
- Whether package or CLI readiness was expected.
- Package name, version, description presence, and license presence.
- Whether package name is final or still John-required before publish.
- `bin` field result and bin target existence for CLI packages.
- Lockfile result.
- Package contents control result: `files` or `.npmignore`.
- README result.
- Changelog/release notes result.
- Script inventory.
- `npm pack --dry-run` result or explicit not-run reason.
- Risk findings.
- Final readiness classification.
- Next safe step.

## Safety Rules

- Do not run `npm publish`.
- Do not change package versions unless John explicitly approves a version bump.
- Do not install dependencies unless John explicitly approves dependency installation.
- Do not mutate remote registries.
- Do not create tags or releases.
- Do not push.
- Do not read `.npmrc` token values.
- Do not print npm tokens.
- Do not include `.env`, evidence folders, credential files, package-manager caches, or local-only config in the package.

Forbidden commands by default:

```bash
npm publish
npm version
npm install
npm token list
git tag
git push --tags
gh release create
```

## Common Failures

- `package.json` is missing required metadata.
- A non-package repo is incorrectly treated as npm release failure.
- CLI `bin` target is missing or not executable.
- No lockfile exists.
- Package contents are uncontrolled and may include private local files.
- Dry-run package output includes env files, evidence files, cache folders, or local-only config.
- Release notes are absent for a user-facing package.
- Version already exists on the registry, when registry checking is separately allowed.
- Missing build, typecheck, lint, format, or prepare scripts are misreported as failures even when they are honestly not applicable. Classify them as `NOT_APPLICABLE` with evidence instead of creating fake scripts.

## Output Format

```markdown
# NPM Package Readiness Report

## Package

## Git State

## Metadata Checks

## CLI Entrypoints

## Lockfile

## Package Contents Control

## Docs And Release Notes

## Script Inventory

## Pack Dry-Run

## Risks

## Final Classification

## Next Safe Step
```

## Upgrade Ideas

- Add registry read-only version checks behind a network permission gate.
- Add temp-prefix CLI install smoke testing behind a dependency/tooling gate.
- Add package denylist configuration.
- Add integration with `release-preflight-skill`.
- Add machine-readable report output for release automation.
- Add package quality script classifier that distinguishes `PASS`, `WARN`, `NOT_VERIFIED`, and `NOT_APPLICABLE`.
