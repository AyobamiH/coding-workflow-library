# Autonomous Decision Boundaries

## Principle

The workflow runner should continue through safe, verified work without asking John to babysit each next step. It should stop only at a real external boundary, name that boundary precisely, and provide the exact input required to continue.

Codex is responsible for building and operating the autonomous workflow. John is not a manual step in ordinary implementation, testing, PR, or merge work. John is involved only when the running workflow reaches a real external or policy boundary.

## What The Workflow Decides

The workflow decides how to select safe work, inspect state, implement bounded fixes, validate locally, commit exact files, push workflow-authored branches, open or reuse PRs, inspect checks, review final diffs, merge normally, update local main, verify exact merged commits, update the ledger, write run records, and continue to the next safe job.

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
BILLING_DECISION
LEGAL_OR_POLICY_DECISION
BUSINESS_PREFERENCE_REQUIRED
SECURITY_PRIVACY_TRADEOFF
INDEPENDENT_REVIEW_REQUIRED
REPOSITORY_POLICY_BLOCK
UNTRUSTED_CHANGE
EXTERNAL_SERVICE_UNAVAILABLE
SAFETY_GATE_FAILED
CONFLICTING_REQUIREMENTS
```

Each stop packet must include:

```text
boundary_type
boundary_reason
evidence
why_autonomous_resolution_is_unsafe_or_impossible
exact_human_input_required
resume_condition
resume_command
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
required
granted
consumed
expired
denied
revoked
not_applicable
```

The registry must never contain credential values, authorization headers, Supabase project references, database URLs, JWTs, API keys, raw logs, or request payloads. One-time approvals must be marked consumed after use. Expired, denied, revoked, missing, or consumed approvals cannot be reused.

## PR Lifecycle

The PR lifecycle is:

```text
PR_OPEN
PR_CHECKS_PENDING
PR_READY
MERGING
POST_MERGE_VERIFY
COMPLETED
```

`PR_OPEN` is not completion. `PR_READY` is not a human-decision boundary. `MERGING` is allowed only through normal repository rules. `POST_MERGE_VERIFY` must identify the exact merged commit, validate it, and confirm remote alignment before completion.

## Automatic Merge Conditions

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

## Automatic Merge Policy

Automatic merge policy is the executable form of the conditions above. It blocks on failing checks, pending checks, changed heads, untrusted commits, repository policy, independent-review requirements, production mutation, secret mutation, destructive action, or any external boundary named in this document. It never uses admin merge or branch-protection bypass.

## Decision Records

Decision records belong under `runs/decisions/` when they are public-safe, or under ignored local checkpoint state when they contain operational detail. Each record includes:

```text
decisionId
runId
objectiveId
repository
branch
question
availableOptions
selectedOption
rejectedOptions
constraints
confidence
reversible
approvalRequired
approvalReference
stateBefore
stateAfter
boundaryType
action
evidence
safetyGates
approvalId
nextAutomaticStep
exactInputRequiredFromJohn
result
```

Records must remain secret-free and must distinguish manual evidence from automated proof.

## Interruption Recovery

`run-next --status` reports the current checkpoint. `run-next --resume --dry-run` validates branch, tracked changes, required permission or approval scope, and checkpoint integrity without mutating anything.

Resume should not recreate existing PRs, duplicate commits, repeat a merge, or rerun a production action. If a PR is already merged, the runner should verify exact containment and continue to post-merge validation. If a branch was pushed and a PR already exists, the runner should reuse it. If checks are pending, the state is `PR_CHECKS_PENDING`; it is not a John decision.

## Failure Handling

Failures are classified before stopping:

- failed tests, validation, secret scan, package inspection, repo drift, or idempotency failures are `SAFETY_GATE_FAILED`;
- unavailable provider APIs, network, tools, or external capability are `EXTERNAL_SERVICE_UNAVAILABLE`;
- changed reviewed heads or third-party commits are `UNTRUSTED_CHANGE`;
- repository policy or branch protection is `REPOSITORY_POLICY_BLOCK`;
- production, secret, or destructive action without exact approval is an approval boundary.

The runner should fix retryable local failures when safe, poll bounded waiting conditions, and continue all remaining independent safe work before reporting a boundary.

## Boundary Output

Every boundary report must include:

```text
boundary_type
boundary_reason
evidence
why_autonomous_resolution_is_unsafe_or_impossible
exact_human_input_required
resume_condition
resume_command
```

## Examples

- A workflow-authored PR with scoped files, passing checks, unchanged reviewed head, and no policy block is `PR_READY`, then `MERGING`, then `POST_MERGE_VERIFY`.
- A PR with pending checks is `PR_CHECKS_PENDING`; poll within a bound and resume later.
- A PR whose head changed after review is `UNTRUSTED_CHANGE`.
- A production scheduler mutation without exact stored approval is `PRODUCTION_MUTATION_APPROVAL`.
- A missing GitHub or provider credential is `CREDENTIAL_REQUIRED`.

## What Completion Means

`COMPLETED` means acceptance criteria were satisfied, the intended change reached the intended base branch when remote work was involved, the exact merged commit was identified, post-merge validation passed, local and remote refs were aligned, the ledger was updated, and a run record was written.

## What Requires John

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
