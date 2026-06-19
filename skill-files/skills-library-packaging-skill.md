---
name: skills-library-packaging-skill
description: Prepare the local skills library for reusable template, npm, CLI, or open-source release readiness without publishing.
category: skill-system
routing_triggers:
  - package skills library
  - open source skills
  - library packaging
  - reusable template
  - CLI package candidate
status: active
---
# Skills Library Packaging Skill

## Purpose

Assess and prepare the coding workflow skills library for reuse without publishing or pushing anything by default.

This skill distinguishes six states:

- `local library`: useful on this machine only;
- `reusable template`: can be copied or cloned safely with documented setup;
- `open-source candidate`: has public docs, route metadata, release notes, and a John-approved license path;
- `npm package candidate`: has package metadata and controlled published contents;
- `CLI package candidate`: has package metadata plus executable bin entrypoints;
- `published package`: exists only after a separate publish/release gate.

The skill covers package shape, CLI/bin decisions, npm readiness, route manifest inclusion, helper script inclusion, examples/templates, license/README/changelog expectations, open-source readiness, release boundaries, npm publish boundaries, GitHub release boundaries, clean-temp portability tests, and evidence requirements.

## When to Use

Use when:

- John asks whether the local skills library can be reused outside this machine;
- route metadata, helper scripts, or skill files need packaging review;
- npm package or CLI distribution is being considered;
- a clean-temp install/test smoke is requested;
- open-source release planning is requested;
- `npm-package-readiness-skill` or `release-preflight-skill` needs a library-specific wrapper;
- the library needs a safe handoff package but publishing is not yet approved.

## Inputs Required

- Skills library path.
- Intended distribution shape: local, template, npm package, CLI package, or unknown.
- Whether local file edits are allowed.
- Whether package metadata edits are allowed.
- Whether John has approved a license and package candidate scaffold.
- Whether the candidate package name and repository identity are confirmed.
- Whether clean-temp install/test is allowed.
- Whether network/package registry access is allowed.
- Whether publish, GitHub release, tag, or push is explicitly approved.
- Required public/private boundary for docs, evidence, vendor intake, logs, and local secrets.

## Commands

Read-only packaging readiness:

```bash
cd /home/johnh/.openclaw/skills/coding-workflow-library
./scripts/library-packaging-readiness --repo /home/johnh/.openclaw/skills/coding-workflow-library
./scripts/library-packaging-readiness --repo /home/johnh/.openclaw/skills/coding-workflow-library --json
./scripts/library-packaging-readiness --repo /home/johnh/.openclaw/skills/coding-workflow-library --expect-open-source
./scripts/library-packaging-readiness --repo /home/johnh/.openclaw/skills/coding-workflow-library --expect-npm
./scripts/library-packaging-readiness --repo /home/johnh/.openclaw/skills/coding-workflow-library --expect-cli
./scripts/npm-package-readiness --repo /home/johnh/.openclaw/skills/coding-workflow-library
./scripts/release-preflight --repo /home/johnh/.openclaw/skills/coding-workflow-library --mode local
./scripts/route-audit
./scripts/validate-skills
```

Clean-temp checks require separate permission:

```bash
./scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow clean-temp-readiness-smoke
./scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow clean-temp-readiness-smoke
./scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow license-package-candidate
./scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow license-package-candidate
./scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow package-candidate-dry-run
./scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow package-candidate-dry-run
./scripts/run-next --dry-run --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow cli-package-smoke
./scripts/run-next --repo /home/johnh/.openclaw/skills/coding-workflow-library --allow cli-package-smoke
```

Package dry-run commands requiring explicit local package-candidate permission:

```bash
npm pack --dry-run
./scripts/npm-package-readiness --repo /home/johnh/.openclaw/skills/coding-workflow-library --expect-package --allow-pack-dry-run
./scripts/release-preflight --repo /home/johnh/.openclaw/skills/coding-workflow-library --mode npm --allow-pack-dry-run
```

Commands requiring separate release permission:

```bash
npm publish
npm version
git tag
git push
gh release create
```

## Procedure

1. Read `AGENTS.md`, `RUNBOOK.md`, `tools.md`, and this skill.
2. Confirm the library path and current git state.
3. Decide the intended distribution shape.
4. Inspect core files: `README.md`, `RUNBOOK.md`, `AGENTS.md`, `skills-index.md`, `tools.md`, `command-library.md`, `evidence-checklist.md`, and `work-ledger.md`.
5. Inspect skill files and ensure active skills are indexed.
6. Inspect `routes/skill-routes.json` and run `scripts/route-audit`.
7. Inspect helper scripts and executable bits.
8. Check templates, tests, docs, and examples.
9. Check license/readme/changelog expectations for the selected distribution shape.
10. Treat `LICENSE-DECISION.md` as the license decision record. It is not a license by itself; the actual approved license text must exist as `LICENSE`.
11. If open-source readiness is intended, run `scripts/library-packaging-readiness --expect-open-source` and report `NEEDS JOHN: licence decision` until an actual approved license file exists.
12. If a package candidate scaffold exists, verify the license field, files allowlist, version, scripts, package candidate name, repository metadata, and package-name ownership blocker before any publish path.
13. If npm package readiness is intended, run `scripts/npm-package-readiness --expect-package`.
14. If CLI readiness is intended, run `scripts/npm-package-readiness --expect-cli`.
15. If only local/template readiness is intended, do not fail merely because `package.json` is absent.
16. Run `scripts/library-packaging-readiness` when available.
17. Run `scripts/release-preflight --mode local`.
18. For portability claims, run the clean-temp smoke route with `--allow clean-temp-readiness-smoke`.
19. After John approves a license/package candidate gate, run `scripts/run-next --allow license-package-candidate`.
20. After John approves package dry-run, run `scripts/run-next --allow package-candidate-dry-run`.
21. After John approves a CLI entrypoint, confirm package candidate name `autonomous-coding-workflow-library`, repository identity `AyobamiH/coding-workflow-library`, MIT, version `0.0.0`, files allowlist, and `bin.coding-workflow` pointing to `bin/coding-workflow.js`.
22. Confirm local CLI help/routes/package-readiness/release-preflight commands delegate to existing scripts.
23. Confirm `npm pack --dry-run` contents include `bin/coding-workflow.js` and exclude `.env`, `evidence/`, `node_modules/`, temp folders, credential config, and local runtime folders.
24. Confirm the clean-temp copy or package install excludes `.git`, `.env`, `evidence/`, dependency caches, hidden credential files, and secret-shaped files.
25. Confirm a local tarball can install into a clean temp consumer with lifecycle scripts disabled and the installed `coding-workflow` CLI can run `--help`, `routes`, and `validate`.
26. Confirm the temp copy/tarball/consumer folder is removed after checks unless a future run explicitly keeps evidence.
27. Stop before `npm publish`, `npm version`, tags, pushes, or GitHub releases unless separately approved.
28. Produce a packaging classification and next permission.
29. Update ledger/run log when this is an orchestrated workflow.

## Evidence Required

- Library path and git state.
- Intended distribution shape.
- Core docs present.
- Skill count and index coverage.
- Route metadata audit result.
- Helper script inventory.
- Templates/tests/docs inventory.
- License/changelog status.
- Open-source blocker status, actual `LICENSE` presence, and whether John has selected a license.
- Package candidate scaffold status and final package-name blocker.
- Clean-temp path, copied/excluded summary, check results, and cleanup result when portability is claimed.
- Package metadata status if npm/CLI is intended.
- CLI bin status if CLI is intended.
- Local CLI command smoke result when the CLI gate is approved.
- Clean-temp tarball install smoke and installed CLI result when CLI portability is claimed.
- Release boundary and commands not run.
- Final packaging classification.
- Next permission.

## Safety Rules

- Packaging readiness is not publish permission.
- Clean-temp smoke is a portability check, not release approval.
- Open-source readiness is not npm publish readiness.
- NPM package readiness is not CLI readiness unless bin entrypoints are checked.
- Do not choose a license for John.
- Do not treat `LICENSE-DECISION.md` as a license file.
- Do not create `package.json` unless separately approved.
- Do not run `npm publish`.
- Do not run `npm version`.
- Do not create tags.
- Do not push.
- Do not create a GitHub release.
- Do not install into product repos.
- Do not include private env files, local secrets, `.git`, `evidence/`, local temp folders, vendor caches, or machine-specific config in package candidates.
- Do not treat a local library as open-source-ready until license, docs, route metadata, helper scripts, and secret boundaries are reviewed.

## Common Failures

- Treating missing `package.json` as failure when only local/template readiness was requested.
- Treating package readiness as release approval.
- Forgetting route metadata and helper scripts in package shape.
- Publishing local evidence, vendor intake, temp files, or machine-specific paths.
- Adding a CLI bin without executable permissions or a documented command.
- Forgetting license or changelog requirements for public release.
- Treating a local clean-temp smoke as permission to publish, push, or tag.
- Treating a license decision placeholder as a real license file.
- Treating a local package candidate scaffold as publish approval.
- Running registry, tag, push, or GitHub release commands during readiness review.
- Treating GitHub source handoff as npm package publication.
- Forgetting CI and public repository files before public source handoff.

## Output Format

```text
# Skills Library Packaging Readiness Report

## Selected Skill

## Library Path

## Intended Distribution Shape

## Core Files

## Skill And Route Inventory

## Helper Scripts

## Templates Tests And Examples

## Package Metadata

## CLI Bin Decision

## Clean Temp Portability Smoke

## Open Source And Release Blockers

## Release Boundary

## Classification

## Commands Not Run

## Next Permission Needed From John
```

## Upgrade Ideas

- Add package manifest generator behind a separate local-edit gate.
- Add clean-temp archive smoke test.
- Add package contents allowlist generator.
- Add CLI command smoke test once a bin exists.
- Add GitHub open-source handoff smoke that verifies CI, exact-file commit scope, and remote HEAD parity without publishing.
- Add changelog/release-notes generator.
- Add route metadata packaging exporter.
- Add open-source readiness checklist.
- Add package-manifest generator behind a separate John-approved local-edit gate.
- Add first-version package source tag checklist that keeps local tarball/package smoke separate from npm publish, GitHub release creation, and production deployment.
