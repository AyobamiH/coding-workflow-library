#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const {
  boundaryClass,
  buildReport,
  checkpointIsSensitive,
  classifyResult,
  validateReport,
} = require(path.join(ROOT, "scripts", "autonomy-outcomes"));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "autonomy-outcomes-test-"));
const stateFile = path.join(temporary, "lanes.json");
const checkpointDir = path.join(temporary, ".run-next");
const ledger = path.join(temporary, "work-ledger.md");
const runLog = path.join(temporary, "runs", "skill-runs.md");

function write(relative, text) {
  const file = path.join(temporary, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}

function checkpoint(overrides = {}) {
  return {
    run_id: "run-001",
    repo: "<TARGET_REPO>",
    branch: "main",
    job: "verification-bundle-self-test",
    skill: "build-verify-skill",
    phase: "record",
    status: "incomplete",
    checkpoints: [
      { name: "inspect", status: "completed" },
      { name: "route", status: "completed" },
      { name: "permission", status: "completed" },
      { name: "execute", status: "completed" },
      { name: "verify", status: "completed" },
      { name: "record", status: "pending" },
    ],
    permissions: [],
    required_permission: null,
    last_verified_commit: "abc123",
    stop_reason: "waiting for record checkpoint",
    active_heading: "",
    current_status: "",
    selected_lane: "fixture",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

try {
  write("lanes.json", `${JSON.stringify({
    version: 1,
    lanes: [{
      lane_id: "fixture",
      display_name: "Fixture",
      repo_path: "<TARGET_REPO>",
      repository: "example/project",
      current_state: "Local validation complete",
      next_permission: "remote publication",
      status: "active",
      route_ids: ["verification-bundle-self-test"],
      last_updated: "2026-01-01T00:00:00.000Z",
      evidence_refs: [],
      hold_reason: "",
      notes: "",
      objective: {
        id: "fixture-objective",
        description: "Fixture objective",
        status: "blocked",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        authority: {
          local_execution: true,
          remote_publication: false,
          production_mutation: false,
          secret_mutation: false,
          destructive_action: false
        },
        checkpoints: { local_validation: "complete", push: "blocked" },
        blockers: [{ state: "BLOCKED_PERMISSION", reason: "remote publication is not granted", stage: "push" }]
      }
    }]
  }, null, 2)}\n`);
  write(".run-next/repo/run-001.json", `${JSON.stringify(checkpoint(), null, 2)}\n`);
  write(".run-next/repo/run-002.json", `${JSON.stringify(checkpoint({
    run_id: "run-002",
    status: "completed",
    phase: "record",
    stop_reason: "resume completed record checkpoint",
    checkpoints: checkpoint().checkpoints.map((item) => ({
      ...item,
      status: "completed",
      ...(item.name === "record" ? { metadata: { resumed: true } } : {}),
    })),
  }), null, 2)}\n`);
  write("work-ledger.md", `# Work Ledger

## 2026-01-01 - Fixture

* Current status: COMPLETE LOCALLY.
* Recovery evidence: one bounded recovery completed.
`);
  write("runs/skill-runs.md", `# Skill Runs Log

## 2026-01-01 - Fixture

* Result: BLOCKED_PERMISSION: remote publication is not granted.
* Failure/recovery notes: local validation passed; resume remains available.
`);

  const report = buildReport({ stateFile, checkpointDir, ledger, runLog });
  assert.equal(report.status, "PASS");
  assert.equal(report.sources.checkpoints.records, 2);
  assert.equal(report.checkpoints.statuses.completed, 1);
  assert.equal(report.checkpoints.statuses.incomplete, 1);
  assert.equal(report.checkpoints.recovery_candidates, 1);
  assert.equal(report.checkpoints.record_only_resume_candidates, 1);
  assert.equal(report.checkpoints.resume_events, 2);
  assert.equal(report.checkpoints.routes["verification-bundle-self-test"].total, 2);
  assert.equal(report.lanes.blocker_states.blocked_permission, 1);
  assert.equal(report.history.run_log.result_classifications.blocked_or_failed, 1);
  assert.deepEqual(report.not_verified, []);
  assert.deepEqual(validateReport(report), []);
  assert.doesNotMatch(JSON.stringify(report), /remote publication is not granted|<TARGET_REPO>/, "report leaked raw local metadata");

  const missing = buildReport({
    stateFile: path.join(temporary, "missing-lanes.json"),
    checkpointDir: path.join(temporary, "missing-checkpoints"),
    ledger: path.join(temporary, "missing-ledger.md"),
    runLog: path.join(temporary, "missing-runs.md"),
  });
  assert.equal(missing.status, "WARN");
  assert.equal(missing.not_verified.length, 4);

  write(".run-next/repo/unsafe.json", `${JSON.stringify({ ...checkpoint(), api_token: "not-a-real-value" })}\n`);
  const unsafe = buildReport({ stateFile, checkpointDir, ledger, runLog });
  assert.equal(unsafe.status, "FAIL");
  assert.equal(unsafe.checkpoints.invalid_records, 1);
  assert.ok(unsafe.validation_errors.includes("checkpoint-record-invalid"));
  assert.doesNotMatch(JSON.stringify(unsafe), /not-a-real-value|api_token/);

  assert.equal(boundaryClass("missing target repository"), "capability");
  assert.equal(boundaryClass("approval required"), "permission");
  assert.equal(classifyResult("READY: local work complete"), "completed_or_ready");
  assert.equal(classifyResult("NOT_VERIFIED until remote CI"), "waiting_or_unverified");
  assert.equal(checkpointIsSensitive({ authorization: "redacted" }), true);

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.ok((packageJson.files || []).includes("scripts/"));
  assert.ok((packageJson.files || []).includes("schemas/"));

  console.log("autonomy outcome tests passed: aggregate routes, blockers, recovery, resume, missing sources, and secret-safe invalid records.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
