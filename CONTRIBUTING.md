# Contributing

This library is a local autonomous coding workflow system: skill files describe reusable workflows, route metadata maps ledger states to permission-gated actions, and helper scripts provide evidence checks.

Before proposing changes, run:

```bash
npm test
node scripts/route-audit
node scripts/npm-package-readiness --repo . --expect-package --expect-cli --allow-pack-dry-run
node scripts/release-preflight --repo . --mode cli --allow-pack-dry-run
node scripts/validate-skills
```

Reusable skills should have either route metadata in `routes/skill-routes.json` or a documented hold reason in `build-queue.md`. If a workflow is only embedded in `scripts/run-next`, extract or document it before treating it as reusable.

Do not include secrets, credentials, private runtime configuration, or sensitive evidence in issues, logs, evidence packs, pull requests, or commits. Exact-file commits are preferred so unrelated local state stays out of history. External mutations such as publishing, pushing, deploying, running migrations, setting secrets, or calling production endpoints require explicit permission.
