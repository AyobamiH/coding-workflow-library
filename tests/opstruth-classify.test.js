#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const script = path.join(ROOT, "scripts", "opstruth-classify");
const helper = require(script);

function input(overrides = {}) {
  const base = {
    schema_version: 1,
    subject: "Synthetic runtime truth",
    claims: [{ id: "claim_one", statement: "The local validation passed.", material: true, required_scopes: ["local_validation"] }],
    evidence: [{ id: "evidence_one", claim_id: "claim_one", scope: "local_validation", outcome: "passed", direct: true, freshness: "current", reference: "command:test", summary: "The local test command passed." }],
    commands_not_run: [],
    authority_gaps: [],
  };
  return { ...base, ...overrides };
}

function build(value = input()) {
  return helper.buildRuntimeTruthReport(value);
}

function testArgumentContract() {
  assert.deepStrictEqual(helper.parseArgs(["--self-test", "--json"]), {
    input: null,
    selfTest: true,
    json: true,
    validate: false,
    strict: false,
    help: false,
  });
  assert.throws(() => helper.parseArgs([]), /exactly one/);
  assert.throws(() => helper.parseArgs(["--self-test", "--input", "fixture.json"]), /exactly one/);
}

function testVerified() {
  const report = build();
  assert.strictEqual(report.claims[0].classification, "VERIFIED");
  assert.strictEqual(report.final_status, "VERIFIED");
  assert.deepStrictEqual(helper.validateReport(report), []);
}

function testWarning() {
  const value = input();
  value.evidence[0].freshness = "stale";
  const report = build(value);
  assert.strictEqual(report.claims[0].classification, "WARNING");
  assert.strictEqual(report.final_status, "VERIFIED WITH WARNINGS");
}

function testFailure() {
  const value = input();
  value.evidence[0].outcome = "failed";
  const report = build(value);
  assert.strictEqual(report.claims[0].classification, "FAILURE");
  assert.strictEqual(report.final_status, "FAILED");
}

function testSkipped() {
  const value = input();
  value.evidence[0] = { ...value.evidence[0], outcome: "skipped", direct: false, freshness: "unknown", reason: "the check was outside the current authority" };
  const report = build(value);
  assert.strictEqual(report.claims[0].classification, "SKIPPED");
  assert.strictEqual(report.final_status, "NOT VERIFIED");
}

function testNotVerifiedAndCiIsNotProduction() {
  const value = input({
    claims: [{ id: "production_claim", statement: "The production deployment is healthy.", material: true, required_scopes: ["deployment", "production"] }],
    evidence: [{ id: "ci_pass", claim_id: "production_claim", scope: "ci", outcome: "passed", direct: true, freshness: "current", reference: "ci:exact-commit", summary: "CI passed for the exact commit." }],
  });
  const report = build(value);
  assert.strictEqual(report.claims[0].classification, "NOT_VERIFIED");
  assert.strictEqual(report.final_status, "NOT VERIFIED");
  assert.deepStrictEqual(report.claims[0].missing_scopes, ["deployment", "production"]);
}

function testBlockedAuthorityGap() {
  const value = input({
    evidence: [{ id: "not_run", claim_id: "claim_one", scope: "local_validation", outcome: "not_run", direct: false, freshness: "unknown", reference: "gate:local-validation", summary: "Validation was not run." }],
    authority_gaps: [{ claim_id: "claim_one", reason: "local execution was unavailable" }],
  });
  assert.strictEqual(build(value).final_status, "BLOCKED");
}

function testNonMaterialFailureIsWarning() {
  const value = input();
  value.claims.push({ id: "optional_probe", statement: "The optional probe passed.", material: false, required_scopes: ["browser"] });
  value.evidence.push({ id: "optional_failure", claim_id: "optional_probe", scope: "browser", outcome: "failed", direct: true, freshness: "current", reference: "browser:optional", summary: "The optional browser probe failed." });
  const report = build(value);
  assert.strictEqual(report.final_status, "VERIFIED WITH WARNINGS");
  assert.strictEqual(report.claims.find((claim) => claim.id === "optional_probe").classification, "FAILURE");
}

function testBuiltInSelfTest() {
  const report = helper.attachSelfTest(build(helper.selfTestFixture()));
  assert.strictEqual(report.self_test.status, "PASS");
  assert.deepStrictEqual(report.self_test.category_coverage, {
    VERIFIED: true,
    WARNING: true,
    FAILURE: true,
    SKIPPED: true,
    NOT_VERIFIED: true,
  });
  assert.strictEqual(report.self_test.truth_rules.ci_is_not_production, true);
  assert.strictEqual(report.final_status, "FAILED");
  assert.deepStrictEqual(helper.validateReport(report), []);
}

function testUnsafeInputRejection() {
  const secretValue = ["Bear", "er ", "abcdefghijklmnopqrstuvwxyz"].join("");
  const secretInput = input();
  secretInput.evidence[0].summary = `Authorization: ${secretValue}`;
  assert(helper.validateInput(secretInput).some((error) => error.includes("secret-shaped")));

  const homeSegment = ["ho", "me"].join("");
  const pathInput = input();
  pathInput.evidence[0].reference = ["", homeSegment, "example", "evidence.json"].join("/");
  assert(helper.validateInput(pathInput).some((error) => error.includes("unsafe reference") || error.includes("private absolute")));

  const rawInput = input();
  rawInput.evidence[0].raw_log = "not allowed";
  assert(helper.validateInput(rawInput).some((error) => error.includes("forbidden raw fields")));
}

function testDeterminismAndHumanOutput() {
  const first = build(input());
  const second = build(input());
  assert.deepStrictEqual(first, second);
  const human = helper.renderHuman(first);
  assert(human.includes("# Runtime Truth Report"));
  assert(human.includes("| claim_one | VERIFIED |"));
  assert(!human.includes("raw_log"));
}

function testInputFileAndPackageBoundary() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "opstruth-classify-test-"));
  try {
    const file = path.join(temp, "redacted-evidence.json");
    fs.writeFileSync(file, JSON.stringify(input(), null, 2));
    assert.deepStrictEqual(helper.loadInput(file), input());
    fs.writeFileSync(file, "not json");
    assert.throws(() => helper.loadInput(file), /not valid JSON/);
    assert.throws(() => helper.loadInput(path.join(temp, "missing.json")), /could not be read/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert((packageJson.files || []).includes("scripts/"));
  assert((packageJson.files || []).includes("schemas/"));
  assert((packageJson.files || []).includes("tests/"));
}

testArgumentContract();
testVerified();
testWarning();
testFailure();
testSkipped();
testNotVerifiedAndCiIsNotProduction();
testBlockedAuthorityGap();
testNonMaterialFailureIsWarning();
testBuiltInSelfTest();
testUnsafeInputRejection();
testDeterminismAndHumanOutput();
testInputFileAndPackageBoundary();

console.log("opstruth-classify tests passed");
