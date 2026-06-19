---
name: opstruth-runtime-truth-skill
description: Classify runtime evidence with an Opstruth-style proof model before release or handoff claims.
category: verification
routing_triggers:
  - Opstruth
  - runtime truth
  - proof model
  - evidence classification
  - verified not verified
status: active
---
# Opstruth Runtime Truth Skill

## Purpose

Use this skill to apply an Opstruth-style evidence model to coding workflow claims: what is verified, what is warning-level, what failed, what was skipped, what remains not verified, what belongs in the evidence pack, and what the next safe step is.

This skill is local and analytical. It does not call an external Opstruth service. It turns existing command output, runtime reports, validation logs, screenshots, CI checks, deployment output, and handoff notes into a clear truth table so the final response does not overclaim.

## When to Use

Use this skill when:

- a task claims code is built, deployed, verified, released, published, fixed, or production-ready;
- runtime behaviour matters and source-only proof is insufficient;
- a report contains mixed pass/fail/skipped evidence;
- release preflight or handoff needs a truth summary;
- an evidence pack must separate facts from next-step assumptions;
- `runtime-verification-skill` produced endpoint evidence that needs final classification;
- CI, browser checks, deploy logs, or production monitoring need a common proof vocabulary.

Use `runtime-verification-skill` for how to run live checks. Use this skill for how to classify and report what those checks prove.

## Inputs Required

- Target repo or project path, if local evidence is being inspected.
- User claim or workflow claim being evaluated.
- Commands run and outputs, sanitized.
- Files inspected.
- Build/lint/test/runtime/deploy/CI evidence.
- Evidence pack path, if one exists.
- Known commands not run.
- Permission boundaries that prevented stronger proof.
- Any required production or browser evidence that remains gated.

## Commands

Local evidence discovery templates:

```bash
pwd
git -C "$TARGET_REPO" status --short
git -C "$TARGET_REPO" diff --stat
find "$TARGET_REPO/evidence" -maxdepth 2 -type f 2>/dev/null | sort
rg -n "PASS|WARN|FAIL|SKIP|NOT_VERIFIED|verified|warning|failure|skipped|not verified|runtime|deploy|production|evidence|Result|Final classification" "$TARGET_REPO" --glob '!node_modules' --glob '!dist' --glob '!build' --glob '!*.png'
```

Library helper templates:

```bash
./scripts/evidence-pack --repo "$TARGET_REPO" --title "Runtime truth review" --dry-run
./scripts/failure-evidence --input "$LOG_FILE"
./scripts/release-preflight --repo "$TARGET_REPO" --mode local
```

Do not call external Opstruth services from this skill. If an `opstruth` CLI exists in a target repo, treat it as an external/local tool that needs explicit command approval and record the exact command separately.

## Procedure

1. State the claim being evaluated.
2. Inventory available evidence and commands run.
3. Inventory commands not run and permission gates not granted.
4. Classify each evidence item as:
   - `Verified`: direct evidence proves the claim within its scope.
   - `Warning`: evidence is useful but incomplete, noisy, stale, or scope-limited.
   - `Failure`: direct evidence contradicts the claim or required proof failed.
   - `Skipped`: a check was intentionally not run and the reason is known.
   - `Not Verified`: no direct evidence was collected for the claim.
5. Separate source-only proof from deployed/runtime proof.
6. Separate local validation from cloud, browser, database, registry, and production proof.
7. Treat "not verified" as not passed. Do not convert absence of failure into success.
8. Decide whether an evidence pack should be created or updated through `evidence-pack-builder-skill`.
9. Produce a truth table with concise evidence references.
10. Produce a final status:
    - `VERIFIED`: all material claims are directly proved.
    - `VERIFIED WITH WARNINGS`: core claim is proved but non-blocking caveats remain.
    - `FAILED`: material claim is contradicted by evidence.
    - `NOT VERIFIED`: material claim lacks direct proof.
    - `BLOCKED`: required evidence cannot be collected under current permission/tooling.
11. Recommend the next safe skill or permission gate.
12. Update ledger/run log if this skill was selected as part of an orchestrated workflow.

## Evidence Required

- Claim under review.
- Evidence source list.
- Command list.
- Files inspected.
- Truth table with classification per claim.
- Source-only versus runtime proof distinction.
- Commands not run.
- Permission gates not granted.
- Evidence pack decision.
- Final status and next safe step.

## Safety Rules

- Do not claim runtime truth from source inspection alone.
- Do not treat a skipped check as a pass.
- Do not treat "no error seen" as proof if no command was run.
- Do not print secrets from logs.
- Do not run live endpoints, browser checks, deploys, database queries, package publishes, or GitHub mutations unless the active workflow grants that separate permission.
- Do not modify evidence files unless evidence-pack write permission is granted.
- Do not let product-specific success language override the evidence classification.

## Common Failures

- Saying "verified" when only a build passed.
- Saying "production-ready" when deployment or runtime checks were not run.
- Treating a planned command as evidence.
- Collapsing `Skipped` and `Not Verified`.
- Forgetting to name commands not run.
- Missing stale evidence dates.
- Mixing local helper classifications with external service truth.
- Forgetting to route durable evidence into `evidence-pack-builder-skill`.

## Output Format

```text
# Runtime Truth Report

## Selected Skill

## Claim Under Review

## Evidence Sources

## Commands Run

## Truth Table

| Claim | Classification | Evidence | Caveat |
| --- | --- | --- | --- |

## Commands Not Run

## Source-Only Versus Runtime Proof

## Evidence Pack Decision

## Final Status

## Next Safe Step
```

## Upgrade Ideas

- Add a local `scripts/opstruth-classify` helper for Markdown/JSON evidence.
- Add evidence-pack integration that writes a truth table.
- Add stale-evidence detection by timestamp.
- Add CI/deploy-log parser adapters.
- Add route metadata for runtime truth review gates.
- Add a later optional bridge to an approved local Opstruth CLI.
