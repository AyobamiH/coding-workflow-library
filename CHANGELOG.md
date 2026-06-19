# Changelog

## Unreleased

- Local coding workflow skills library remains under active development.
- Route metadata, validation helpers, packaging checks, and autonomous runner routes are being hardened for local reuse.
- MIT was selected for the initial open-source/package-readiness path.
- A local package candidate scaffold was added for readiness checks.
- Package candidate identity was set to `autonomous-coding-workflow-library` with GitHub repository identity `AyobamiH/coding-workflow-library`.
- A package-candidate dry-run route was added for npm package readiness, release preflight npm mode, npm pack dry-run, package content inspection, clean-temp smoke, and validation.
- A local CLI entrypoint candidate `coding-workflow` was added with a package smoke route for local CLI checks, npm pack dry-run, clean-temp tarball install, installed CLI verification, and validation.
- Public repository hardening files, truthful package validation scripts, and a GitHub Actions validation workflow were added for the open-source handoff path.
- A `github-open-source-handoff` route was added for exact-file commit, public GitHub repo verification/creation, one `main` push, and remote HEAD verification.
- Public/open-source release has not been approved.
- NPM publish, package release, versioning, tags, pushes, and releases have not been approved.

## Release Requirements Before Public Distribution

- John confirms final npm package name availability and ownership before any publish path.
- John chooses the distribution shape: reusable template, public source, npm package, CLI package, or private-only.
- Local CLI package smoke passes for `coding-workflow` from an installed tarball.
- Clean-temp smoke passes from a copied library without hidden local state.
- Route audit, skill cleanup, validation, packaging readiness, and release preflight evidence are collected.
- Publish, version, tag, push, GitHub release, deploy, and remote mutation gates are separately approved.
