---
name: github-deep-review-skill
description: Performs a read-only, thread-aware GitHub pull-request review with exact patch scope, current review decisions, stale approvals, checks, and bounded failure categories.
category: github
routing_triggers:
  - deep review github pull request
  - inspect unresolved review threads
  - triage requested changes
  - verify stale approvals and checks
  - review exact PR patch scope
status: active
---
# github-deep-review-skill

## Purpose

This skill deepens `github-handoff-skill` with deterministic, read-only pull-request evidence. It inspects thread resolution and outdated state, current reviewer decisions, approvals made against an older head, exact changed files, check conclusions, and branch-protection metadata when the authenticated identity can read it.

It does not reply, resolve threads, submit reviews, edit code, commit, push, merge, approve, delete branches, or grant authority. `READY_FOR_HANDOFF` means only that no blocker was observed in the collected metadata.

## When to Use

Use this skill when:

- a PR needs thread-aware review rather than a flat comment list;
- requested changes may have been superseded by a later review;
- approvals may be stale after a new head commit;
- failing or pending checks need a bounded classification;
- exact changed-file scope must be compared with the intended work;
- `github-handoff-skill` needs stronger evidence before a separate write or merge decision.

## Inputs Required

- GitHub repository in `OWNER/REPO` form.
- Pull-request number.
- Valid local `gh` authentication for read access.
- Whether optional failed Actions logs may be inspected in memory.
- Intended patch scope, when scope comparison is part of the objective.
- Separate consequence authority for any later reply, code change, push, review, or merge.

## Commands

```bash
./scripts/github-deep-review --repo OWNER/REPO --pr 123
./scripts/github-deep-review --repo OWNER/REPO --pr 123 --json --validate
./scripts/github-deep-review --repo OWNER/REPO --pr 123 --inspect-failed-checks

coding-workflow github-deep-review --repo OWNER/REPO --pr 123 --validate
```

The optional failed-check mode reads failed Actions logs in memory but emits only category counts and secret-shaped marker categories. It never emits raw logs.

## Procedure

1. Confirm the repository and PR number.
2. Run the GitHub auth gate without printing token values.
3. Collect PR head, base, draft, state, mergeability, and check metadata.
4. Page through review threads, reviews, and changed files with read-only GraphQL calls.
5. Separate resolved, actionable unresolved, and outdated unresolved threads.
6. Reduce each reviewer to their latest submitted decision.
7. Mark an approval stale when its reviewed commit does not match the current PR head.
8. Classify checks as passed, failed, pending, or neutral.
9. Read branch-protection metadata when available; preserve `METADATA_UNAVAILABLE` when access is insufficient.
10. Only when explicitly selected, inspect failed Actions logs in memory and emit categories without raw text.
11. Validate the report contract and compare exact file scope with the objective.
12. Route fixes to normal local engineering workflow and route remote replies/resolution/review/push/merge to a separate `remote_publication` gate.

## Evidence Required

- Repository and PR number.
- Exact PR head SHA and base/head branch names.
- Exact changed file list with additions/deletions.
- Thread totals split by resolved, actionable unresolved, and outdated unresolved.
- Latest reviewer decisions.
- Current requested-change count.
- Stale approval count.
- Passed, failed, pending, and neutral check counts.
- Branch-protection state or explicit metadata-unavailable classification.
- Optional failed-log category counts with `raw_logs_emitted: false`.
- Explicit `NOT_VERIFIED` entries for merge permission and production state.

## Safety Rules

- Never reply to comments or resolve review threads from this skill.
- Never submit a review, approval, dismissal, merge, push, commit, or branch deletion.
- Never print `GH_TOKEN`, `GITHUB_TOKEN`, authorization headers, credentials, PR bodies, or raw check logs.
- Redact secret-shaped values, links in review text, and private absolute paths.
- Bound review excerpts to 240 characters.
- Treat inaccessible branch protection or thread metadata as unavailable, not passed.
- Do not infer merge authority from green checks or `READY_FOR_HANDOFF`.
- Do not treat CI evidence as deployment or production evidence.

## Common Failures

- GitHub CLI missing or unauthenticated.
- Token lacks permission to read review threads or branch protection.
- PR number or repository is wrong.
- GraphQL pagination or metadata is incomplete.
- Checks remain queued or pending.
- Current requested changes or actionable unresolved threads block handoff.
- Approval targets an earlier head commit.
- Failed Actions logs are unavailable or are not associated with a run ID.

## Output Format

```text
# GitHub Deep Review

## Pull Request
## Classification
## Patch Scope
## Review Threads
## Reviews
## Checks
## Branch Protection
## Signals
## Not Verified
## Safety Boundaries
```

JSON output follows `schemas/github-deep-review.schema.json` and uses `READY_FOR_HANDOFF`, `ATTENTION`, `PENDING`, or `BLOCKED` as the overall classification.

## Upgrade Ideas

- Add explicit intended-scope policy files after repeated use proves a stable format.
- Add cross-PR dependency evidence without introducing remote mutation.
- Add connector-backed metadata only when its thread model preserves resolution and outdated state.
