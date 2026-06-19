# License Decision

John selected MIT for the initial open-source and package-readiness path.

This decision allows the local skills library to carry a standard MIT `LICENSE` file and MIT package metadata for readiness checks. It does not approve publishing, tagging, pushing, creating releases, or distributing a package.

## Decision Required

- Confirm final npm package name availability and ownership before publish.
- Intended distribution beyond this local candidate: reusable template, public source, npm package, CLI package, or private-only.
- Whether vendor-intake material can be included, summarized, or must stay excluded.
- Whether run logs, evidence folders, local paths, and machine-specific notes must be stripped before distribution.
- Whether external contributors are allowed and what contribution terms apply.

## Options Under Consideration

- MIT: most permissive/simple; good for maximum adoption and low-friction reuse.
- Apache 2.0: permissive like MIT but more formal and includes explicit patent language; often comfortable for company/enterprise reuse.
- GPL: stronger copyleft/open-source protection; derivatives/distributed modifications generally need to stay under GPL-compatible terms, but it can reduce commercial adoption.

## Decision

- MIT is selected for the initial open-source/package-readiness path.
- MIT was chosen for low-friction adoption and reuse.
- Apache 2.0 remains a future option if John later prefers more formal terms with explicit patent language.
- GPL is not selected because the current project direction favors adoption over copyleft enforcement.

## Current Status

- MIT license file is approved locally as `LICENSE`.
- MIT package metadata is approved locally in the package candidate scaffold.
- GitHub repository identity for package metadata is `AyobamiH/coding-workflow-library`.
- NPM package candidate name is `autonomous-coding-workflow-library`.
- Current blocker: `NEEDS JOHN: confirm final npm package name availability and ownership before publish`.
- Public release, npm publish, version bump, tag, push, GitHub release, and package distribution still require separate approval.
- The current `package.json` name is a local package candidate, not final publish approval.
