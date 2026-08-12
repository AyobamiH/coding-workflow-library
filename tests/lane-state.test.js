#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const laneState = require("../scripts/lane-state");

const ROOT = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "coding-workflow-lanes-"));
const stateFile = path.join(temporary, "lanes.json");
const runNextDir = path.join(temporary, ".run-next");
let runCounter = 0;

const initial = {
  version: 1,
  lanes: [
    lane("lane-a", "State A", ROOT),
    lane("lane-b", "State B", path.join(temporary, "missing-repo")),
  ],
};

function lane(id, state, repoPath) {
  return {
    lane_id: id,
    display_name: id,
    repo_path: repoPath,
    repository: `example/${id}`,
    current_state: state,
    next_permission: "hold",
    status: "active",
    route_ids: [],
    last_updated: "2026-01-01T00:00:00.000Z",
    evidence_refs: [],
    hold_reason: "",
    notes: "test fixture",
  };
}

function run(args) {
  const runId = ++runCounter;
  const stdoutPath = path.join(temporary, `run-${runId}.stdout`);
  const stderrPath = path.join(temporary, `run-${runId}.stderr`);
  const stdoutFd = fs.openSync(stdoutPath, "w");
  const stderrFd = fs.openSync(stderrPath, "w");
  try {
    const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "run-next"), ...args], {
      cwd: ROOT,
      env: { ...process.env, RUN_NEXT_DIR: runNextDir },
      stdio: ["ignore", stdoutFd, stderrFd],
    });
    result.stdout = fs.readFileSync(stdoutPath, "utf8");
    result.stderr = fs.readFileSync(stderrPath, "utf8");
    return result;
  } finally {
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
  }
}

try {
  laneState.atomicWrite(stateFile, initial);

  laneState.updateLane(initial, "lane-a", { current_state: "Changed A" });
  assert.equal(laneState.getLane(initial, "lane-b").current_state, "State B", "updating lane A changed lane B");
  laneState.atomicWrite(stateFile, initial);

  const beforeDryRun = fs.readFileSync(stateFile, "utf8");
  const dryRun = run(["--lane", "lane-a", "--state-file", stateFile, "--dry-run"]);
  assert.notEqual(dryRun.status, null, "dry-run did not exit");
  assert.equal(fs.readFileSync(stateFile, "utf8"), beforeDryRun, "dry-run changed lane state");

  const state = laneState.readState(stateFile);
  laneState.updateLane(state, "lane-b", {
    current_state: "Scheduled run pending, production handoff ready",
    next_permission: "run scheduled-run recheck",
    monitoring_baseline: "2026-06-17T08:40:51.588Z",
  });
  laneState.atomicWrite(stateFile, state);
  const laneABeforeBlocked = JSON.stringify(laneState.getLane(state, "lane-a"));
  const blocked = run(["--lane", "lane-b", "--state-file", stateFile, "--allow", "scheduled-run-monitoring-handoff"]);
  assert.equal(blocked.status, 1, "missing-repo route should stop blocked");
  const afterBlocked = laneState.readState(stateFile);
  assert.equal(JSON.stringify(laneState.getLane(afterBlocked, "lane-a")), laneABeforeBlocked, "blocked route changed unselected lane");
  assert.match(laneState.getLane(afterBlocked, "lane-b").current_state, /target repo missing/i, "blocked route did not update selected lane");

  laneState.updateLane(afterBlocked, "lane-b", {
    current_state: "Scheduled run observed, production handoff ready",
    next_permission: "run zero-output investigation",
    status: "active",
  });
  laneState.atomicWrite(stateFile, afterBlocked);
  const beforeZeroDryRun = fs.readFileSync(stateFile, "utf8");
  const zeroDryRun = run(["--lane", "lane-b", "--state-file", stateFile, "--dry-run", "--allow", "zero-output-investigation"]);
  assert.equal(zeroDryRun.status, 0, "zero-output dry-run should pass");
  assert.equal(fs.readFileSync(stateFile, "utf8"), beforeZeroDryRun, "zero-output dry-run changed lane state");

  const laneABeforeZeroBlocked = JSON.stringify(laneState.getLane(afterBlocked, "lane-a"));
  const zeroBlocked = run(["--lane", "lane-b", "--state-file", stateFile, "--allow", "zero-output-investigation"]);
  assert.equal(zeroBlocked.status, 1, "missing-repo zero-output route should stop blocked");
  const afterZeroBlocked = laneState.readState(stateFile);
  assert.equal(JSON.stringify(laneState.getLane(afterZeroBlocked, "lane-a")), laneABeforeZeroBlocked, "zero-output blocked route changed unselected lane");
  assert.equal(laneState.getLane(afterZeroBlocked, "lane-b").current_state, "Zero-output pipeline investigation blocked");

  const missing = run(["--lane", "missing-lane", "--state-file", stateFile, "--explain-next"]);
  assert.equal(missing.status, 1, "missing lane should fail");
  assert.throws(() => laneState.getLane(afterZeroBlocked, "missing-lane"), /lane not found: missing-lane/, "missing lane error was unclear");

  const fallbackState = laneState.readState(stateFile);
  laneState.updateLane(fallbackState, "lane-a", {
    current_state: "Product pilot intentionally paused",
    next_permission: "select a concrete product objective",
    status: "hold",
    hold_reason: "real-user evidence is required before implementation continues",
  });
  laneState.updateLane(fallbackState, "lane-b", {
    current_state: "Bounded product objective completed locally",
    next_permission: "gather independent usage evidence",
    status: "complete",
  });
  laneState.atomicWrite(stateFile, fallbackState);

  const held = run(["--lane", "lane-a", "--state-file", stateFile, "--explain-next"]);
  const heldOutput = `${held.stdout}${held.stderr}`;
  assert.equal(held.status, 0, heldOutput);
  assert.match(heldOutput, /Final status: HELD/);
  assert.match(heldOutput, /real-user evidence is required/i);
  assert.doesNotMatch(heldOutput, /NEEDS JOHN|unknown ledger status/i);

  const beforeHeldReal = fs.readFileSync(stateFile, "utf8");
  const heldReal = run(["--lane", "lane-a", "--state-file", stateFile]);
  assert.equal(heldReal.status, 0, `${heldReal.stdout}${heldReal.stderr}`);
  assert.equal(fs.readFileSync(stateFile, "utf8"), beforeHeldReal, "real held fallback changed lane state");

  const completed = run(["--lane", "lane-b", "--state-file", stateFile, "--explain-next"]);
  const completedOutput = `${completed.stdout}${completed.stderr}`;
  assert.equal(completed.status, 0, completedOutput);
  assert.match(completedOutput, /Final status: COMPLETE/);
  assert.match(completedOutput, /gather independent usage evidence/i);
  assert.doesNotMatch(completedOutput, /NEEDS JOHN|unknown ledger status/i);

  const beforeCompletedReal = fs.readFileSync(stateFile, "utf8");
  const completedReal = run(["--lane", "lane-b", "--state-file", stateFile]);
  assert.equal(completedReal.status, 0, `${completedReal.stdout}${completedReal.stderr}`);
  assert.equal(fs.readFileSync(stateFile, "utf8"), beforeCompletedReal, "real terminal fallback changed lane state");

  const prohibited = JSON.parse(JSON.stringify(afterZeroBlocked));
  prohibited.lanes[0].api_token = "not-a-real-value";
  assert.throws(() => laneState.validateState(prohibited), /prohibited secret-shaped key/);

  console.log("Lane isolation tests passed: selected-lane update, dry-run immutability, blocked-route isolation, missing-lane failure, and secret-key refusal.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
