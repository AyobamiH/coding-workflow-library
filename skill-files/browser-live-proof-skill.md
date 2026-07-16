---
name: browser-live-proof-skill
description: Collect bounded browser rendering evidence without interaction, raw logs, credentials, or production overclaiming.
category: verification
routing_triggers:
  - browser live proof
  - responsive browser verification
  - screenshot evidence
  - console and network evidence
  - horizontal overflow check
status: active
---
# Browser Live Proof Skill

## Purpose

Collect one bounded browser observation after source, build, and runtime checks. Use `scripts/browser-live-proof` to record navigation, responsive layout, accessibility counts, count-only console/network evidence, and an optional screenshot without turning a browser visit into a production-correctness claim.

## When to Use

Use when a website or local web application needs direct rendering evidence, responsive overflow proof, screenshot evidence, basic accessibility counts, or browser-observed console/network classifications. Use `runtime-verification-skill` for endpoint protocols and `opstruth-runtime-truth-skill` for final evidence classification.

## Inputs Required

- Exact HTTP(S) URL.
- Intended viewport.
- Whether the target is loopback or remote.
- Local screenshot path when an image is required.
- Existing source/build/runtime evidence and known unverified claims.
- Explicit higher authority before logged-in, interactive, or production mutation work.

## Commands

```bash
./scripts/browser-live-proof \
  --url http://127.0.0.1:4173 \
  --viewport 390x844 \
  --screenshot /tmp/browser-proof-mobile.png \
  --validate

./scripts/browser-live-proof \
  --url http://127.0.0.1:4173 \
  --viewport 1440x900 \
  --json \
  --validate

coding-workflow browser-live-proof \
  --url http://127.0.0.1:4173 \
  --viewport 1280x800
```

Remote read-only navigation is separate and explicit:

```bash
./scripts/browser-live-proof \
  --url https://example.com \
  --allow-remote \
  --validate
```

## Procedure

1. Run repository mapping, project knowledge, source inspection, build checks, and local runtime health first.
2. Confirm the target and viewport. Prefer loopback evidence before remote evidence.
3. Reject credential-bearing URLs and URLs with sensitive query-parameter names.
4. Run one helper invocation per required viewport. Add `--screenshot` only when visual review is needed.
5. Inspect `navigation`, `layout`, `accessibility`, `console`, `network`, and `signals` independently.
6. Treat console/network output as counts and categories only; never request raw bodies, headers, cookies, storage, or page text.
7. Record authenticated flows, user interactions, database state, deployment history, and ongoing reliability as `NOT_VERIFIED` unless separate direct evidence exists.
8. Use `opstruth-runtime-truth-skill` to combine browser evidence with source, build, CI, runtime, and production evidence.

## Evidence Required

- Safe URL without query values or opaque identifiers.
- Browser family/version and viewport.
- Document response classification and DOM ready state.
- Document and viewport dimensions with horizontal-overflow result.
- Requested-versus-observed CSS viewport classification.
- Count-only accessibility observations.
- Count-only console and network classifications.
- Screenshot filename, PNG validity, bounded sampled-color count, and nonblank classification when requested, never an embedded image or private absolute path.
- Final-location classification, with different-origin redirects surfaced as warnings.
- Explicit list of unverified behaviours and collection boundaries.

## Safety Rules

- Default to loopback; require `--allow-remote` for one remote read-only navigation.
- Never click, submit, upload, log in, accept consent on behalf of a user, or execute product mutations.
- Never pass credentials in a URL.
- Never emit request/response bodies, headers, authorization material, cookies, browser storage, raw console logs, or page text.
- Never claim deployment history, database state, authentication behaviour, production correctness, or reliability from one browser observation.
- Keep screenshots in an explicitly selected local or temporary path and review repository exclusions before staging.
- Use separate objective authority for remote publication, production mutation, secret mutation, or destructive actions.

## Common Failures

- Browser unavailable: classify `BLOCKED_CAPABILITY` and provide `--browser` guidance.
- DevTools unavailable or Node lacks WebSocket: classify `BLOCKED_CAPABILITY`; do not silently downgrade to source-only proof.
- Remote URL blocked: obtain explicit read-only remote approval and use `--allow-remote` only for the named target.
- Navigation timeout or HTTP error: classify `FAILED`; do not convert screenshot creation into a pass.
- Different-origin redirect: classify `WARNING` even when the remote read-only target was explicitly allowed.
- Requested viewport mismatch: classify `WARNING`; a missing mobile viewport declaration can make a nominal mobile capture use a wider CSS viewport.
- Horizontal overflow: classify `FAILED` for the observed viewport.
- Console errors, failed resources, unlabelled controls, or missing image alt text: classify `WARNING` unless the product contract makes them blocking.
- Invalid PNG: classify `FAILED`; one-color screenshot sample: classify `WARNING`; absent screenshot: report `NOT_VERIFIED`.

## Output Format

```text
Browser live proof:
- Status:
- Target/mode:
- Viewport:
- Navigation:
- Layout and overflow:
- Accessibility counts:
- Console/network counts:
- Screenshot:
- Verified signals:
- Warnings/failures:
- Not verified:
- Next safe step:
```

## Upgrade Ideas

Add multi-viewport orchestration only after repeated use proves a stable contract. Keep clicks, authentication, destructive flows, and browser credential handling outside this helper unless separately designed with explicit authority and non-printing evidence rules.
