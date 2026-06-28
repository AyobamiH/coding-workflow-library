# Autonomous Decision Boundaries

## Purpose

The workflow runner should continue through safe, verified work without asking John to babysit each next step. It should stop only at a real external boundary, name that boundary precisely, and provide the exact input required to continue.

## Workflow States

The canonical states are:

```text
READY
RUNNING
VERIFYING
PR_OPEN
PR_CHECKS_PENDING
PR_READY
MERGING
POST_MERGE_VERIFY
COMPLETED
BLOCKED_EXTERNAL
BLOCKED_APPROVAL
BLOCKED_POLICY
FAILED_RETRYABLE
FAILED_TERMINAL
```

Completion requires evidence that acceptance criteria were met, the exact commit was verified, remote alignment was checked when remote work occurred, the ledger was updated, and the run record was updated. A merged PR is not complete until post-merge validation passes.

## External Boundaries

Allowed boundary types are:

```text
CREDENTIAL_REQUIRED
PRODUCTION_MUTATION_APPROVAL
SECRET_MUTATION_APPROVAL
DESTRUCTIVE_ACTION_APPROVAL
BILLING_OR_ACCOUNT_DECISION
LEGAL_OR_LICENSE_DECISION
PRODUCT_OR_BUSINESS_DECISION
SECURITY_PRIVACY_TRADEOFF
INDEPENDENT_REVIEW_REQUIRED
REPOSITORY_POLICY_BLOCK
UNTRUSTED_CHANGE
CAPABILITY_UNAVAILABLE
WAITING_EXTERNAL_EVENT
SAFETY_GATE_FAILED
CONFLICTING_OBJECTIVE
```

The runner must not stop with vague language such as "human decision needed" or "manual review" unless it maps that phrase to one of these boundary types and names the exact next input.

## Approval Registry

`state/approval-registry.json` documents the secret-free registry shape. Entries support:

```text
approvalId
scope
status
grantedAt
expiresAt
consumedAt
grantedBy
evidence
```

Supported statuses are:

```text
granted
consumed
expired
denied
revoked
not_applicable
```

The registry must never contain credential values, authorization headers, Supabase project references, database URLs, JWTs, API keys, raw logs, or request payloads. One-time approvals must be marked consumed after use. Expired, denied, revoked, missing, or consumed approvals cannot be reused.

## Automatic Merge Policy

Normal merge is allowed without a fresh John prompt when all of these are true:

- the PR was authored by this workflow or its managed branch;
- the change scope is bounded and matches the reviewed objective;
- acceptance criteria are known and satisfied;
- local validation passed;
- PR checks passed;
- the head SHA matches the reviewed SHA;
- the final diff is intended;
- repository policy allows normal merge;
- no independent reviewer is required;
- no untrusted commit or changed head is present;
- the action is not a production, secret, destructive, billing, legal, product, or security tradeoff boundary.

The runner must merge only by normal repository policy. It must not use admin merge, force push, bypass branch protection, merge pending/failing checks, or merge a changed head without re-review.

After merge, the runner enters `POST_MERGE_VERIFY` and must verify the exact merge commit, local checkout, remote alignment, and required tests or gates before recording `COMPLETED`.

## Decision Records

Decision records belong under `runs/decisions/` when they are public-safe, or under ignored local checkpoint state when they contain operational detail. Each record includes:

```text
decisionId
objectiveId
repository
branch
stateBefore
stateAfter
boundaryType
action
evidence
safetyGates
approvalId
nextAutomaticStep
exactInputRequiredFromJohn
```

Records must remain secret-free and must distinguish manual evidence from automated proof.

## Interruption Recovery

`run-next --status` reports the current checkpoint. `run-next --resume --dry-run` validates branch, tracked changes, required permission or approval scope, and checkpoint integrity without mutating anything.

Resume should not recreate existing PRs, duplicate commits, repeat a merge, or rerun a production action. If a PR is already merged, the runner should verify exact containment and continue to post-merge validation. If a branch was pushed and a PR already exists, the runner should reuse it. If checks are pending, the state is `PR_CHECKS_PENDING`; it is not a John decision.

## What Still Requires John

John is required only for true external choices:

- missing, expired, invalid, or under-scoped credentials;
- explicit production mutation approval;
- explicit secret mutation approval;
- destructive actions;
- billing or external account choices;
- legal, license, or ownership decisions;
- product or business decisions;
- security or privacy tradeoffs;
- repository policy that requires a different human reviewer;
- untrusted third-party changes or a changed PR head requiring re-review.

Verified workflow-authored PR merge under normal repository rules is not a separate John boundary once the objective grants remote publication and all merge gates pass.
