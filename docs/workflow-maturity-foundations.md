# Workflow Maturity Foundations

## Purpose

This document records the three local workflow-reliability foundations added after the modular `run-next` architecture:

1. safe recording when no existing skill fits;
2. privacy-safe autonomy outcome reporting;
3. one repeatable, read-only proof contract across multiple repositories.

These helpers improve the workflow control plane. They do not grant authority, call production, publish, deploy, or prove consequences that their inputs did not observe.

## Safe Skill-Gap Recording

Use `scripts/add-skill-gap` when repository inspection and routing evidence show that no current skill covers the work.

```bash
coding-workflow skill-gap \
  --title "Describe the missing workflow" \
  --evidence "Name the source evidence" \
  --primary-type SCRIPT_OR_HELPER \
  --dependency "Name the prerequisite" \
  --authority local_execution \
  --done "State the bounded completion contract" \
  --reason "Explain why it belongs in the queue" \
  --dry-run

coding-workflow skill-gap <same-fields> --json
coding-workflow skill-gap --validate
```

The helper:

- writes one bounded entry immediately before the P2 queue;
- preserves unrelated queue content through an atomic replacement;
- rejects duplicate titles, missing fields, multiline or oversized values, private absolute paths, and secret-shaped material;
- supports a non-writing dry-run and machine-readable output;
- validates the current queue structure without modifying it.

Recording a gap does not approve creation of a skill or grant any consequence authority.

## Autonomy Outcome Reporting

Use `scripts/autonomy-outcomes` to summarize safe local workflow metadata:

```bash
coding-workflow autonomy-outcomes --repo <LIBRARY_REPO>
coding-workflow autonomy-outcomes --repo <LIBRARY_REPO> --json --validate
coding-workflow autonomy-outcomes \
  --repo <LIBRARY_REPO> \
  --state-file /path/to/local/lanes.json \
  --json --validate
```

The report aggregates:

- route and completion classifications;
- blocker classes;
- checkpoint completion and recovery state;
- resume evidence;
- stop-boundary counts;
- ledger and run-log record counts;
- optional selected-lane state.

It emits counts and bounded categories only. It does not emit repository paths, notes, commands, stop reasons, raw logs, environment values, credentials, or production payloads.

Missing optional lane state is `WARN` and `not_verified`, not failure. Invalid or sensitive checkpoint content is a failure category, but the offending content is never repeated.

The first real library report found valid checkpoint history and no invalid checkpoint records. Its overall status was `WARN` only because no optional default lane-state file was present. That result is workflow metadata evidence, not production reliability evidence.

## Multi-Project Proof

Use `scripts/multi-project-proof` with at least three explicitly labelled repositories:

```bash
coding-workflow multi-project-proof \
  --repo workflow-library=<LIBRARY_REPO> \
  --repo product-a=/path/to/product-a \
  --repo product-b=/path/to/product-b \
  --json --validate
```

For every target, the helper runs the same bounded contract:

1. source-only repository map validation;
2. npm package-readiness validation;
3. local release-preflight validation;
4. lane-scoped `run-next` verification-bundle dry-run.

It creates only temporary lane state outside target repositories. It compares exact Git status and lane content before and after, emits labels rather than paths, and suppresses raw subprocess output.

A real local proof passed across the workflow library, OpsTruth, and Wagging Web Wins. All three targets completed all four contracts with unchanged Git status and unchanged lane state. Existing dirty entries in product repositories were preserved rather than cleaned, staged, or interpreted as this helper's work.

This proves the bounded local contract ran consistently across those three repositories. It does not prove remote CI, deployment, production runtime, database state, or arbitrary-repository compatibility.

## Route Boundary

No new `run-next` route IDs were added for these helpers.

- The gap recorder is an explicit queue-maintenance command.
- The outcome reporter is read-only inspection over existing local records.
- The multi-project proof is an operator-selected validation harness with explicit target arguments.

They remain thin CLI commands until repeated lane-driven use demonstrates a stable route state transition. This avoids inventing ledger states merely to make helpers look orchestrated.

## Next Dependency

The next recorded maturity dependency is exact-commit remote proof for the existing Linux, macOS, and Windows portable test matrix. That requires `remote_publication` and observed GitHub Actions evidence. Local Linux success must not be reported as remote cross-platform proof.
