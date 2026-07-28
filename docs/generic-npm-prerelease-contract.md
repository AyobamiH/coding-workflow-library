# Generic npm prerelease contract

`scripts/lib/run-next/npm-release-route.js` provides the framework-neutral,
declarative release boundary for packages outside this library.

The caller supplies a versioned manifest containing:

- canonical repository, package-directory, tarball, release-note, and asset paths;
- GitHub repository, branch, annotated tag, and prerelease/final classification;
- package name/version, exact tarball SHA-256, npm access, and explicit dist-tag;
- validation commands plus allowed and forbidden paths;
- an approval issuer, expiry, and identity digest bound to the repository, package,
  version, artifact digest, Git tag, npm tag, and GitHub release type.

`validateDeclarativeRelease(manifest)` is local and non-mutating. It rejects missing,
relative, or noncanonical artifacts; digest drift; package identity drift;
private or incomplete package metadata; and missing, shebang-less, or
non-executable CLI bins.

`executeDeclarativeRelease(manifest, adapter, { dryRun })` takes an injected adapter so
credentials never enter the manifest or transaction evidence. It serializes
same-package/version attempts, reconciles matching npm and GitHub state,
fails closed on conflicts, publishes the exact tarball with the explicit npm
tag, preserves `latest` for prereleases, verifies GitHub release type/assets,
and returns partial evidence when a later stage fails. Dry-run performs no
adapter calls.

The existing `release-coding-workflow-library-vX.Y.Z` route remains unchanged. Canonical local proof runs through `scripts/run-next --release-manifest <absolute-path> --dry-run`; real execution fails closed until an authenticated adapter is installed.
It is the compatibility adapter for historical library releases. New consumers
should build and validate a manifest, bind approval with `approvalIdentity`,
and provide an authenticated adapter at the publication boundary.
