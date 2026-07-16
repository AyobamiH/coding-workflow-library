#!/usr/bin/env node

const assert = require("assert");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const helper = require(path.join(ROOT, "scripts", "github-deep-review"));

function fixture(overrides = {}) {
  const base = {
    repo: "example/project",
    pr: 42,
    metadata: {
      number: 42,
      state: "OPEN",
      isDraft: false,
      headRefName: "feat/proof",
      baseRefName: "main",
      headRefOid: "0123456789abcdef0123456789abcdef01234567",
      mergeable: "MERGEABLE",
      mergeStateStatus: "CLEAN",
      reviewDecision: "APPROVED",
      statusCheckRollup: [
        { name: "test", workflowName: "CI", status: "COMPLETED", conclusion: "SUCCESS", detailsUrl: "https://github.com/example/project/actions/runs/10/job/20" },
      ],
    },
    threads: { available: true, category: null, nodes: [] },
    reviews: {
      available: true,
      category: null,
      nodes: [{ id: "R1", state: "APPROVED", submittedAt: "2026-07-16T10:00:00Z", author: { login: "reviewer" }, commit: { oid: "0123456789abcdef0123456789abcdef01234567" } }],
    },
    files: { available: true, category: null, nodes: [{ path: "src/proof.js", additions: 12, deletions: 2, changeType: "MODIFIED" }] },
    branchProtection: { state: "verified", required_checks: 1, required_approving_reviews: 1, dismisses_stale_reviews: true, requires_code_owner_reviews: false },
    failedCheckLogs: null,
  };
  return {
    ...base,
    ...overrides,
    metadata: { ...base.metadata, ...(overrides.metadata || {}) },
    threads: { ...base.threads, ...(overrides.threads || {}) },
    reviews: { ...base.reviews, ...(overrides.reviews || {}) },
    files: { ...base.files, ...(overrides.files || {}) },
    branchProtection: { ...base.branchProtection, ...(overrides.branchProtection || {}) },
  };
}

function report(input = fixture()) {
  return helper.buildGithubDeepReview(input, { collectedAt: "2026-07-16T12:00:00.000Z" });
}

function testArgumentsAndBoundaries() {
  assert.deepStrictEqual(helper.parseArgs(["--repo", "example/project", "--pr", "42", "--json"]), {
    repo: "example/project",
    pr: 42,
    inspectFailedChecks: false,
    json: true,
    validate: false,
    help: false,
  });
  assert.throws(() => helper.parseArgs(["--repo", "example/project", "--pr", "zero"]), /positive integer/);
  assert.throws(() => helper.normalizeRepo("https://github.com/example/project"), /OWNER\/REPO/);
  assert.strictEqual(helper.safeRelativePath("src/file.js"), "src/file.js");
  assert.strictEqual(helper.safeRelativePath("../secret"), "[invalid-path]");
}

function testReadyReport() {
  const value = report();
  assert.strictEqual(value.status, "READY_FOR_HANDOFF");
  assert.deepStrictEqual(helper.validateGithubDeepReview(value), []);
  assert.strictEqual(value.patch_scope.changed_files, 1);
  assert.strictEqual(value.reviews.current_approvals, 1);
  assert.strictEqual(value.signals.find((signal) => signal.id === "merge_permission").state, "NOT_VERIFIED");
  assert.strictEqual(value.signals.find((signal) => signal.id === "production_state").state, "NOT_VERIFIED");
}

function testActionableThreadsAndRequestedChangesBlock() {
  const value = report(fixture({
    threads: {
      nodes: [{
        id: "T1",
        isResolved: false,
        isOutdated: false,
        path: "src/proof.js",
        line: 12,
        comments: { nodes: [{ author: { login: "reviewer" }, body: "Please add the missing failure case.", createdAt: "2026-07-16T11:00:00Z" }] },
      }],
    },
    reviews: {
      nodes: [{ id: "R2", state: "CHANGES_REQUESTED", submittedAt: "2026-07-16T11:00:00Z", author: { login: "reviewer" }, commit: { oid: "0123456789abcdef0123456789abcdef01234567" } }],
    },
  }));
  assert.strictEqual(value.status, "BLOCKED");
  assert.strictEqual(value.threads.actionable_unresolved, 1);
  assert.strictEqual(value.reviews.current_changes_requested, 1);
  assert.strictEqual(value.signals.find((signal) => signal.id === "review_threads").state, "FAILED");
}

function testResolvedAndOutdatedThreads() {
  const value = report(fixture({
    threads: {
      nodes: [
        { id: "T1", isResolved: true, isOutdated: false, path: "a.js", line: 1, comments: { nodes: [] } },
        { id: "T2", isResolved: false, isOutdated: true, path: "b.js", originalLine: 2, comments: { nodes: [] } },
      ],
    },
  }));
  assert.strictEqual(value.status, "ATTENTION");
  assert.strictEqual(value.threads.resolved, 1);
  assert.strictEqual(value.threads.outdated_unresolved, 1);
}

function testStaleApprovalAndLatestReview() {
  const value = report(fixture({
    reviews: {
      nodes: [
        { id: "R1", state: "CHANGES_REQUESTED", submittedAt: "2026-07-16T09:00:00Z", author: { login: "reviewer" }, commit: { oid: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } },
        { id: "R2", state: "APPROVED", submittedAt: "2026-07-16T10:00:00Z", author: { login: "reviewer" }, commit: { oid: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" } },
      ],
    },
  }));
  assert.strictEqual(value.status, "ATTENTION");
  assert.strictEqual(value.reviews.current_changes_requested, 0);
  assert.deepStrictEqual(value.reviews.stale_approvals, ["reviewer"]);
}

function testChecks() {
  const pending = report(fixture({ metadata: { statusCheckRollup: [{ name: "build", status: "IN_PROGRESS", conclusion: null }] } }));
  assert.strictEqual(pending.status, "PENDING");
  assert.strictEqual(pending.checks.pending, 1);

  const failed = report(fixture({ metadata: { statusCheckRollup: [{ name: "test", status: "COMPLETED", conclusion: "FAILURE" }] } }));
  assert.strictEqual(failed.status, "BLOCKED");
  assert.strictEqual(failed.checks.failed, 1);
  assert.deepStrictEqual(helper.classifyFailedLog("npm test failed after tsc type error"), ["dependency", "test", "typecheck"]);
}

function testMetadataUnavailable() {
  const value = report(fixture({
    threads: { available: false, category: "permission_unavailable", nodes: [] },
    reviews: { available: false, category: "permission_unavailable", nodes: [] },
    files: { available: false, category: "permission_unavailable", nodes: [] },
    branchProtection: { state: "metadata_unavailable", required_checks: null, required_approving_reviews: null, dismisses_stale_reviews: null, requires_code_owner_reviews: null },
  }));
  assert.strictEqual(value.status, "ATTENTION");
  assert.strictEqual(value.signals.find((signal) => signal.id === "branch_protection").state, "METADATA_UNAVAILABLE");
}

function testRedactionAndValidation() {
  const syntheticBearer = ["Bear", "er ", "abcdefghijklmnopqrstuvwxyz"].join("");
  const homeSegment = ["ho", "me"].join("");
  const syntheticPrivatePath = ["", homeSegment, "example", "private", "file"].join("/");
  const redacted = helper.redactExcerpt(`Authorization: ${syntheticBearer} at https://example.com/private and ${syntheticPrivatePath}`);
  assert(!redacted.includes("abcdefghijklmnopqrstuvwxyz"));
  assert(!redacted.includes("example.com"));
  assert(!redacted.includes(syntheticPrivatePath));

  const value = report(fixture({
    threads: {
      nodes: [{ id: "T1", isResolved: true, isOutdated: false, path: "src/proof.js", line: 1, comments: { nodes: [{ author: { login: "reviewer" }, body: "token=abcdefghijklmnop", createdAt: "2026-07-16T11:00:00Z" }] } }],
    },
  }));
  assert.deepStrictEqual(helper.validateGithubDeepReview(value), []);
  assert(!JSON.stringify(value).includes("abcdefghijklmnop"));

  const leaky = structuredClone(value);
  leaky.pull_request.head_branch = ["", homeSegment, "example", "private"].join("/");
  assert(helper.validateGithubDeepReview(leaky).some((error) => error.includes("private absolute path")));
}

function testHumanOutputAndDeterminism() {
  const first = report();
  const second = report();
  assert.deepStrictEqual(first, second);
  const human = helper.renderHuman(first);
  assert(human.includes("# GitHub Deep Review"));
  assert(human.includes("READY_FOR_HANDOFF"));
  assert(human.includes("NOT_VERIFIED: merge_permission"));
  assert(!human.includes("raw_log"));
}

testArgumentsAndBoundaries();
testReadyReport();
testActionableThreadsAndRequestedChangesBlock();
testResolvedAndOutdatedThreads();
testStaleApprovalAndLatestReview();
testChecks();
testMetadataUnavailable();
testRedactionAndValidation();
testHumanOutputAndDeterminism();

console.log("github-deep-review tests passed");
