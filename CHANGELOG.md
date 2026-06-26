# Changelog

## Unreleased

- Nothing yet.

## 0.2.0 - 2026-06-26

- Replaced per-step permission prompting with objective-level authority classes: `local_execution`, `remote_publication`, `production_mutation`, `secret_mutation`, and `destructive_action`.
- Added executable authority/blocker helpers that distinguish `BLOCKED_CAPABILITY`, `BLOCKED_PERMISSION`, `BLOCKED_SAFETY`, `BLOCKED_DECISION`, `WAITING_CONDITION`, and `COMPLETE`.
- Extended lane state with an optional active objective envelope, authority grants, checkpoints, and blockers while keeping runtime state local and secret-free.
- Added project-scoped runtime lanes with a portable schema, neutral template, atomic local state helper, lane-aware `run-next` routing, CLI lane commands, and isolation tests.
- Kept `work-ledger.md` as historical evidence while moving active product state, local paths, monitoring baselines, and private runtime references into untracked local lane files.
- Added a lane-scoped zero-output investigation route, generic source pipeline tracer, staged attrition classifications, and tests without granting production invocation or mutation.
- Added CLI objective commands for showing an objective and approving a consequence authority once for the selected lane.
- Updated `run-next` to inherit authority from the selected lane objective, preserve legacy `--allow` route flags, and support a local/read-only `v0.2.0` preparation route.
- Added deterministic authority-model tests for safe local autonomy, child authority inheritance, consolidated remote publication, capability blockers, safety blockers, decisions, waiting conditions, checkpoint resume, idempotency, dry-run immutability, lane isolation, destructive boundaries, secret-key rejection, and legacy compatibility.
- Documented that capability failures, such as unavailable npm authentication, are not permission failures and should not stop independent local release work.
- This release remains source/package-candidate only: npm publication and GitHub release creation have not occurred.

## 0.1.0 - 2026-06-19

- Local coding workflow skills library remains under active development.
- Route metadata, validation helpers, packaging checks, and autonomous runner routes are being hardened for local reuse.
- MIT was selected for the initial open-source/package-readiness path.
- A local package candidate scaffold was added for readiness checks.
- Package candidate identity was set to `autonomous-coding-workflow-library` with GitHub repository identity `AyobamiH/coding-workflow-library`.
- A package-candidate dry-run route was added for npm package readiness, release preflight npm mode, npm pack dry-run, package content inspection, clean-temp smoke, and validation.
- A local CLI entrypoint candidate `coding-workflow` was added with a package smoke route for local CLI checks, npm pack dry-run, clean-temp tarball install, installed CLI verification, and validation.
- Public repository hardening files, truthful package validation scripts, and a GitHub Actions validation workflow were added for the open-source handoff path.
- A `github-open-source-handoff` route was added for exact-file commit, public GitHub repo verification/creation, one `main` push, and remote HEAD verification.
- Added the ledger-driven `scripts/run-next` autonomous work loop with permission-gated execution.
- Added reusable skill files, route metadata, route audit, skill validation, and skill cleanup helpers.
- Added evidence-pack generation and failure evidence classification helpers.
- Added GitHub auth and exact-file handoff workflows.
- Added Supabase production-lane skills for RLS/source audits, Edge Function deploy boundaries, scheduler/Vault/pg_cron safety, runtime verification, and production handoff.
- Added Cloudflare deployment planning and Opstruth runtime-truth workflow support.
- Added package/release readiness helpers and the `coding-workflow` CLI command.
- Verified clean-temp portability and local tarball install smoke during package candidate work.
- This release is source/package-candidate only: npm publication and GitHub release creation have not occurred.
- Not all routes have been production-tested across arbitrary repositories.

## Release Requirements Before Public Distribution

- John confirms final npm package name availability and ownership before any publish path.
- John chooses the distribution shape: reusable template, public source, npm package, CLI package, or private-only.
- Local CLI package smoke passes for `coding-workflow` from an installed tarball.
- Clean-temp smoke passes from a copied library without hidden local state.
- Route audit, skill cleanup, validation, packaging readiness, and release preflight evidence are collected.
- Publish, version, tag, push, GitHub release, deploy, and remote mutation gates are separately approved.
