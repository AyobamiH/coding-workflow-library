# Release Reconciliation

The read-only release check compares public canonical GitHub source, an explicit npm distribution tag, a configured release-source baseline, and optional local consumer metadata. It extends the existing release-preflight skill after the October package reconciliation exposed repeated gaps between merged source and registry availability.

```bash
node scripts/release-reconciliation --config templates/release-reconciliation.example.json --allow-network --json
coding-workflow release-reconciliation --config <CONFIG_JSON> --allow-network --strict
```

Copy the example to private local storage before adding consumers. Each consumer has a short `id` and an absolute `root` pointing at a project containing `package.json`, an optional npm `package-lock.json`, and optional `node_modules`. Only these explicit metadata files are read; roots are omitted from reports. No recursive search, package commands, lifecycle scripts, installation, publication, credentials, service control or runtime mutation occur. Network reads require `--allow-network` and use public GitHub/npm endpoints with time and size bounds. Private repositories and rate limits remain unknown; no authentication fallback runs.

The example covers four previously accepted releases. Baselines are configured evidence, not independently verified artifact provenance; update them only from an accepted release record. AgentProof intentionally follows `next`, not `latest`.

## Results and next actions

- `SOURCE_VERSION_DIFFERS`: inspect canonical changes and prepare a separately approved release if appropriate.
- `SOURCE_AHEAD_REVIEW_REQUIRED`: inspect changes since the release source; documentation-only commits do not automatically require publication.
- `SOURCE_IDENTITY_MISMATCH` or `REGISTRY_IDENTITY_MISMATCH`: resolve canonical repository ownership before preparing another release.
- `CONSUMER_VERSION_DIFFERS`: review exact lockfile and installation differences before upgrading that consumer.
- `CONSUMERS_NOT_CONFIGURED` or `CONSUMER_VERSION_UNKNOWN`: provide explicit consumer roots or collect missing metadata. No estate-wide adoption claim is made.
- `SOURCE_UNAVAILABLE`, `REGISTRY_OR_COMPARISON_UNAVAILABLE`, `UNKNOWN`, or `DIVERGED_OR_BEHIND`: investigate missing evidence or history before drawing a release conclusion.
- `REGISTRY_INTEGRITY_MISSING`: inspect registry metadata before relying on the distribution.

`INSTALLED_MATCH` proves only installed metadata. `LOCK_MATCH_ONLY` proves only an npm lock entry. Running-process versions always remain `NOT_OBSERVED`. Ranges are reported as `RANGE_OR_OTHER_SPEC`; this helper does not solve semver ranges or support other package-manager locks. Subdirectory packages are not supported in this first bounded slice.

Exit 0 means the report was produced, not that everything matches. `--strict` returns 1 when any row needs review. Exit 2 means invalid input or a missing network grant. JSON uses `schemaVersion: 1`, an observation timestamp, per-package findings, consumer states and explicit evidence boundaries. Provider errors are reduced to fixed finding codes without response bodies or private paths.

This helper never stages or publishes. Maintainer 2FA remains required by the release process. Registry availability does not establish production signing or consequence authority. It runs on demand; no timer or production service is installed.
