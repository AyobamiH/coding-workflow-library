#!/usr/bin/env node

const assert = require("assert");
const boundaries = require("../scripts/autonomous-boundaries");

function registry(overrides = {}) {
  return {
    version: 1,
    approvals: [
      {
        approvalId: "verified-workflow-pr-merge",
        scope: ["remote_publication", "normal_pr_merge", "post_merge_verification"],
        status: "granted",
        grantedAt: "2026-06-28T00:00:00.000Z",
        grantedBy: "john",
        expiresAt: "2999-01-01T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

assert(boundaries.WORKFLOW_STATES.includes("PR_READY"));
assert(boundaries.WORKFLOW_STATES.includes("POST_MERGE_VERIFY"));
assert(boundaries.WORKFLOW_STATES.includes("COMPLETED"));
assert(boundaries.BOUNDARY_TYPES.includes("PRODUCTION_MUTATION_APPROVAL"));
assert(boundaries.BOUNDARY_TYPES.includes("INDEPENDENT_REVIEW_REQUIRED"));
assert(boundaries.BOUNDARY_TYPES.includes("UNTRUSTED_CHANGE"));
assert(boundaries.APPROVAL_STATUSES.includes("required"));

assert.equal(boundaries.validateApprovalRegistry(registry()).ok, true);
assert.equal(
  boundaries.approvalUsable(registry(), "verified-workflow-pr-merge", ["remote_publication", "normal_pr_merge"]).usable,
  true,
  "matching approval should be usable",
);

const consumed = registry({
  approvals: [{ ...registry().approvals[0], status: "consumed", consumedAt: "2026-06-28T01:00:00.000Z" }],
});
assert.equal(
  boundaries.approvalUsable(consumed, "verified-workflow-pr-merge", ["remote_publication"]).usable,
  false,
  "consumed approvals must not be reused",
);

assert.throws(
  () => boundaries.validateApprovalRegistry({
    version: 1,
    approvals: [{ approvalId: "bad", scope: ["x"], status: "granted", token: "not-needed" }],
  }),
  /prohibited secret-bearing key/,
  "approval registry must reject secret-bearing fields",
);

assert.throws(
  () => boundaries.assertNoVagueBoundary("Remaining human decision: merge the verified PR"),
  /vague human boundary/,
  "vague human boundary wording must be rejected",
);

const merge = boundaries.evaluateAutomaticMerge({
  workflowAuthored: true,
  scopeBounded: true,
  acceptanceKnown: true,
  localChecks: "passed",
  prChecks: "passed",
  headMatchesReviewed: true,
  finalDiffIntended: true,
  normalMergeAllowed: true,
});
assert.equal(merge.canMerge, true);
assert.equal(merge.requiresJohn, false);
assert.equal(merge.state, "PR_READY");
assert.equal(merge.boundary.boundaryType, "NONE");
assert.equal(merge.boundary.boundary_type, "NONE");

const pending = boundaries.evaluateAutomaticMerge({
  workflowAuthored: true,
  scopeBounded: true,
  acceptanceKnown: true,
  localChecks: "passed",
  prChecks: "pending",
});
assert.equal(pending.canMerge, false);
assert.equal(pending.state, "PR_CHECKS_PENDING");
assert.equal(pending.boundary.boundaryType, "EXTERNAL_SERVICE_UNAVAILABLE");
assert.match(pending.boundary.resume_command, /run-next --status/);

const failing = boundaries.evaluateAutomaticMerge({
  workflowAuthored: true,
  scopeBounded: true,
  acceptanceKnown: true,
  localChecks: "passed",
  prChecks: "failed",
});
assert.equal(failing.canMerge, false);
assert.equal(failing.state, "FAILED_RETRYABLE");
assert.equal(failing.boundary.boundaryType, "SAFETY_GATE_FAILED");

const changedHead = boundaries.evaluateAutomaticMerge({
  workflowAuthored: true,
  scopeBounded: true,
  acceptanceKnown: true,
  localChecks: "passed",
  prChecks: "passed",
  headChanged: true,
});
assert.equal(changedHead.canMerge, false);
assert.equal(changedHead.boundary.boundaryType, "UNTRUSTED_CHANGE");

const reviewRequired = boundaries.evaluateAutomaticMerge({
  workflowAuthored: true,
  scopeBounded: true,
  acceptanceKnown: true,
  localChecks: "passed",
  prChecks: "passed",
  independentReviewRequired: true,
});
assert.equal(reviewRequired.canMerge, false);
assert.equal(reviewRequired.boundary.boundaryType, "INDEPENDENT_REVIEW_REQUIRED");

const production = boundaries.classifyBoundary({ productionMutation: true });
assert.equal(production.boundaryType, "PRODUCTION_MUTATION_APPROVAL");
assert.equal(production.boundary_type, "PRODUCTION_MUTATION_APPROVAL");
assert.match(production.exactInputRequired, /exact production mutation approval/i);
assert.match(production.exact_human_input_required, /exact production mutation approval/i);
assert.match(production.resume_condition, /exact required input/i);

assert.equal(boundaries.classifyBoundary({ productionMutation: true, productionApproval: true }).boundaryType, "NONE");

assert.equal(
  boundaries.completionState({
    prMerged: true,
    postMergeValidationPassed: false,
  }),
  "FAILED_RETRYABLE",
  "post-merge validation failure must not become completed",
);

assert.equal(
  boundaries.completionState({
    prMerged: true,
  }),
  "POST_MERGE_VERIFY",
  "merged PR must continue into post-merge verification",
);

assert.equal(
  boundaries.completionSatisfied({
    acceptanceCriteriaSatisfied: true,
    evidenceRecorded: true,
    exactCommitVerified: true,
    remoteAlignmentVerified: true,
    ledgerUpdated: true,
    runRecordUpdated: true,
    prMerged: true,
    postMergeValidationPassed: true,
  }),
  true,
  "completion requires evidence, exact commit, alignment, ledger, run record, merge, and post-merge validation",
);

const record = boundaries.createDecisionRecord({
  decisionId: "normal-merge-001",
  runId: "run-001",
  objectiveId: "test-objective",
  stateBefore: "PR_READY",
  stateAfter: "POST_MERGE_VERIFY",
  boundaryType: "NONE",
  action: "normal merge of verified workflow-authored PR",
  question: "merge versus stop",
  availableOptions: ["merge normally", "stop"],
  selectedOption: "merge normally",
  rejectedOptions: ["stop"],
  constraints: ["normal merge only"],
  confidence: "high",
  reversible: false,
  approvalRequired: false,
  evidence: ["checks passed", "head matched reviewed SHA"],
});
assert.equal(record.exactInputRequiredFromJohn, "none");
assert.equal(record.runId, "run-001");
assert.equal(record.question, "merge versus stop");
assert.equal(record.selectedOption, "merge normally");
assert.equal(record.result, "POST_MERGE_VERIFY");

assert.throws(
  () => boundaries.createDecisionRecord({
    decisionId: "bad-record",
    stateBefore: "READY",
    stateAfter: "COMPLETED",
    boundaryType: "NONE",
    evidence: ["Authorization: bearer nope"],
  }),
  /secret-shaped value/,
  "decision records must reject secret-shaped output",
);

console.log("Autonomous boundary tests passed: approval registry, exact boundary typing, normal verified PR merge policy, post-merge completion semantics, and secret-free decision records.");
