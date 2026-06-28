# Workflow Corpus Recovery Report

This report records public-safe aggregate findings from the corrected private workflow corpus. It intentionally excludes raw prompts, raw assistant responses, local path maps, private transcript excerpts, credential material, and generated corpus files.

## Private Corpus

- Location: private local state outside the package repository.
- Outputs: source manifest, JSONL corpus, coverage report, validation report, and private pseudonym map.
- Validation: `PASS`
- Manifest schema: `PASS`
- Corpus schema: `PASS`
- Coverage reconciliation: `PASS`

## Coverage

- source roots inspected: 4
- total files discovered: 32
- parsed: 30
- unsupported: 2
- corrupt: 0
- empty: 0
- duplicate: 0
- excluded: 0
- extraction-meta sessions: 1
- total events: 30098
- ranked events, excluding extraction-meta sessions: 18430
- date range: 2026-02-10 to 2026-06-26

Reconciliation:

```text
32 = 30 + 2 + 0 + 0 + 0 + 0
```

## Corrected Frequency Signals

Top executed command names in ranked events:

| Command | Count |
| --- | ---: |
| `git` | 3131 |
| `sed` | 1791 |
| `node` | 699 |
| `npm` | 664 |
| `gh` | 476 |
| `find` | 393 |
| `rg` | 350 |
| `true` | 321 |
| `curl` | 266 |
| `cat` | 241 |

Top skill mentions:

| Skill | Count |
| --- | ---: |
| `coding-workflow-orchestrator-skill` | 85 |
| `github-handoff-skill` | 58 |
| `supabase-rls-audit-skill` | 46 |
| `route-trace-skill` | 45 |
| `cloudflare-deploy-skill` | 43 |
| `error-evidence-skill` | 40 |
| `env-audit-skill` | 39 |
| `build-verify-skill` | 36 |
| `github-auth-gate-skill` | 36 |
| `repo-map-skill` | 36 |

## Old Extraction Comparison

| Historical claim | Corrected status | Evidence note |
| --- | --- | --- |
| Session JSONL mining was a recurring foundation need | `CONFIRMED` | `session-log-extraction-skill` appears in current repo and corrected corpus; helper was missing before this pass. |
| Repo mapping, route tracing, error evidence, build verification, and security review were core reusable skills | `CONFIRMED` | Current repo implements those skills; corrected corpus contains repeated mentions. |
| GitHub handoff and auth gating became reusable workflow lanes | `CONFIRMED` | Current repo has `github-auth-gate-skill`, `github-handoff-skill`, routes, and heavy `git`/`gh` evidence. |
| Supabase and Cloudflare lanes are reusable but permission-gated | `CONFIRMED` | Skills and route metadata exist; corpus confirms repeated Supabase/Cloudflare references. |
| Agent role system should be promoted immediately | `NOT_SUPPORTED` | Role mentions exist, but most are product-specific or historical subagent vocabulary; reusable agent-role handoff contracts are not proven. |
| Planner/worker/reviewer roles are ready as durable agents | `NOT_SUPPORTED` | Mentions are sparse compared with product-specific roles and do not yet prove distinct reusable contracts. |
| Capability acquisition/prefetch is a historical P0 | `CANNOT_VERIFY` | The corrected corpus does not make it older or more foundational than extraction, docs inventory, browser proof, or secret-access prerequisites. |

## Confirmed Missing Reusable Components

- deterministic session extraction helper: now implemented
- source manifest and coverage reports: now implemented
- `scripts/docs-list`: still missing
- repo-map helper automation: still missing
- project-KB compiler: still missing
- migration-review helper: still missing
- pre-commit validation hook: still missing
- browser live proof skill: still missing
- GitHub deep review skill: still missing
- one-password secret access skill: still missing and decision-dependent

## Agent Role Recovery

No reusable agent role is verified for promotion yet.

The corpus confirms repeated historical mentions of product-specific roles such as researcher/trader/banker/executioner and generic terms such as worker/subagent. These should remain `PRODUCT_SPECIFIC` or `NOT_YET_AN_AGENT_ROLE` until a role has:

- recurring responsibility across distinct sessions,
- distinct inputs,
- distinct outputs,
- a handoff contract,
- and a reason a skill or route is insufficient.

## Confidence Limits

- Raw transcript bodies are not preserved in public docs.
- Some helper mentions are product-repo paths from historical sessions and should not drive generic library priority alone.
- Extraction-meta sessions are excluded from rankings by default.
- Command evidence is based on tool invocation records, not assistant prose.
