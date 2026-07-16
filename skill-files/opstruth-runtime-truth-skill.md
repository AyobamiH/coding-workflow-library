---
name: opstruth-runtime-truth-skill
description: Classify runtime, release, handoff, and Opstruth product-video evidence with a proof model that separates verified facts from warnings, failures, skipped checks, and unverified claims.
category: verification
routing_triggers:
  - Opstruth
  - runtime truth
  - proof model
  - evidence classification
  - verified not verified
  - product video truth
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
- a product video, demo, launch film, HyperFrames composition, or website media asset claims to show current Opstruth product truth.

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
./scripts/opstruth-classify --self-test --json --validate
./scripts/opstruth-classify --input "$REDACTED_EVIDENCE_JSON" --json --validate
./scripts/opstruth-classify --input "$REDACTED_EVIDENCE_JSON" --strict
./scripts/evidence-pack --repo "$TARGET_REPO" --title "Runtime truth review" --dry-run
./scripts/failure-evidence --input "$LOG_FILE"
./scripts/release-preflight --repo "$TARGET_REPO" --mode local
```

`scripts/opstruth-classify` reads one explicitly selected redacted JSON manifest or its built-in self-test fixture. It does not run commands named in evidence, call external services, inspect production, write evidence files, or mutate a repository. `--strict` exits non-zero when the resulting material status is `FAILED`, `NOT VERIFIED`, or `BLOCKED`; the built-in mixed self-test exits according to self-test correctness rather than its intentionally failed sample claim.

Do not call external Opstruth services from this skill. If an `opstruth` CLI exists in a target repo, treat it as an external/local tool that needs explicit command approval and record the exact command separately.

## Product Video Truth Protocol

For Opstruth product-video, demo, or HyperFrames work, the project repository is the source of truth. Do not create or continue a standalone private marketing pack as the authoritative deliverable unless the user explicitly asks for an external scratch pack. The default workflow is to update the project-owned video sources, website assets, evidence docs, and render outputs.

Before planning or editing any video:

1. Inspect the target project repository state, existing docs, website source, media paths, screenshots, prior renders, and current product facts.
2. Prefer `repo-map-skill` and `project-kb-builder-skill` for source-only orientation before creative work in an unfamiliar repo.
3. Read the project's own video/theme documents first, such as current video briefs, website audit notes, demo scripts, existing HyperFrames compositions, screenshot evidence, and release notes.
4. Compare the proposed visual language with the actual product interface and prior in-repo assets.
5. Treat mismatch between a new pack and the project theme as a `Warning` or `Failure`, not as a polish issue.

Required HyperFrames skill stack for product-video work:

- use `hyperframes` first for routing;
- use `hyperframes-core` before writing or editing composition HTML;
- use `hyperframes-creative` before choosing palette, typography, pacing, narrative, or visual density;
- use `hyperframes-animation` before motion design, timeline work, transitions, or animation runtime choices;
- use `hyperframes-cli` before lint, validate, inspect, snapshot, preview, render, doctor, or troubleshooting;
- use `hyperframes-registry` only when installing or wiring registry blocks/components.

Resolve these skills through the active agent's skill catalog. If a required skill is unavailable, report the missing capability and stop before authoring or rendering; do not hardcode a host-specific skill path into project or library files.

For non-trivial product videos, also follow `hyperframes-creative` references for house style and video composition before authoring a fresh visual system. The video must feel produced for the product, not like a generic SaaS promo or detached poster system.

Product-video proof must distinguish:

- current repo truth from historical launch material;
- source CLI truth from npm package truth;
- website/demo media truth from production deployment truth;
- local validation from production evidence;
- a rendered file from a publish-ready social asset.

Forbidden shortcuts:

- starting in a new external repo or private pack before inspecting the project itself;
- replacing the project theme with a generic campaign style;
- inventing proof cards, customers, metrics, production confidence, or dashboards;
- treating package metadata, local demo output, or static docs as deployed runtime proof;
- reporting a video as final without lint/validate/inspect, rendered output, decode checks, and visual review frames;
- deleting a rejected pack or other work without destructive-action authority.

## Procedure

1. State the claim being evaluated.
2. Inventory available evidence and commands run.
3. Inventory commands not run and permission gates not granted.
4. For repeatable classification, represent the claims, required scopes, evidence outcomes, commands not run, and authority gaps in a redacted local JSON manifest and run `scripts/opstruth-classify --input <file> --validate`.
5. Classify each evidence item as:
   - `Verified`: direct evidence proves the claim within its scope.
   - `Warning`: evidence is useful but incomplete, noisy, stale, or scope-limited.
   - `Failure`: direct evidence contradicts the claim or required proof failed.
   - `Skipped`: a check was intentionally not run and the reason is known.
   - `Not Verified`: no direct evidence was collected for the claim.
6. Separate source-only proof from deployed/runtime proof.
7. Separate local validation from CI, cloud, browser, database, registry, and production proof.
8. Treat "not verified" as not passed. Do not convert absence of failure into success.
9. Decide whether an evidence pack should be created or updated through `evidence-pack-builder-skill`.
10. Produce a truth table with concise evidence references.
11. Produce a final status:
    - `VERIFIED`: all material claims are directly proved.
    - `VERIFIED WITH WARNINGS`: core claim is proved but non-blocking caveats remain.
    - `FAILED`: material claim is contradicted by evidence.
    - `NOT VERIFIED`: material claim lacks direct proof.
    - `BLOCKED`: required evidence cannot be collected under current permission/tooling.
12. Recommend the next safe skill or permission gate.
13. Update ledger/run log if this skill was selected as part of an orchestrated workflow.

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
- Runtime-truth report validation result when `scripts/opstruth-classify` is used.
- Built-in category coverage and truth-rule result when the self-test is used.

## Safety Rules

- Do not claim runtime truth from source inspection alone.
- Do not treat a skipped check as a pass.
- Do not treat "no error seen" as proof if no command was run.
- Do not print secrets from logs.
- Do not run live endpoints, browser checks, deploys, database queries, package publishes, or GitHub mutations unless the active workflow grants that separate permission.
- Do not modify evidence files unless evidence-pack write permission is granted.
- Do not let product-specific success language override the evidence classification.
- Do not put raw logs, authorization headers, response bodies, secret values, environment values, or private absolute paths into classifier input.
- Do not treat the built-in mixed fixture's intentional `FAILED` sample status as self-test failure; require `self_test.status: PASS` and all five category coverage flags.

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

- Add evidence-pack integration that writes a truth table.
- Add stale-evidence detection by timestamp.
- Add CI/deploy-log parser adapters.
- Add a later optional bridge to an approved local Opstruth CLI.
