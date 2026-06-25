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
  return spawnSync(process.execPath, [path.join(ROOT, "scripts", "run-next"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
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

  const prohibited = JSON.parse(JSON.stringify(afterZeroBlocked));
  prohibited.lanes[0].api_token = "not-a-real-value";
  assert.throws(() => laneState.validateState(prohibited), /prohibited secret-shaped key/);

  console.log("Lane isolation tests passed: selected-lane update, dry-run immutability, blocked-route isolation, missing-lane failure, and secret-key refusal.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
