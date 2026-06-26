#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const authority = require("../scripts/objective-authority");
const laneState = require("../scripts/lane-state");

const ROOT = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "objective-authority-"));
const stateFile = path.join(temporary, "lanes.json");

function objective(id, grants = {}) {
  return authority.createObjective({
    id,
    description: `objective ${id}`,
    authority: authority.defaultAuthority(grants),
  });
}

function stage(id, options = {}) {
  return { id, ...options };
}

function runNext(args) {
  return spawnSync(process.execPath, [path.join(ROOT, "scripts", "run-next"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

try {
  const localOnly = objective("local-only");
  let result = authority.permissionGrantedForRoute({
    route: { permission: "verification-bundle-self-test" },
    objective: localOnly,
  });
  assert.equal(result.granted, true, "safe local work should run with implicit local_execution");
  assert.equal(result.requiredAuthority, "local_execution");

  const remote = authority.approveAuthority(localOnly, "remote_publication");
  for (const permission of ["github-handoff", "push-pr", "pr-merge", "tag-push", "github-release", "npm-publish"]) {
    result = authority.permissionGrantedForRoute({ route: { permission }, objective: remote });
    assert.equal(result.granted, true, `${permission} did not inherit remote_publication`);
  }

  const otherObjective = objective("other-objective");
  result = authority.permissionGrantedForRoute({ route: { permission: "github-release" }, objective: otherObjective });
  assert.equal(result.granted, false, "remote grant leaked into a different objective");
  assert.equal(result.requiredAuthority, "remote_publication");

  const missingNpm = authority.runObjectiveStages({
    objective: localOnly,
    capabilities: { npm_auth: false },
    stages: [
      stage("version_update"),
      stage("changelog"),
      stage("local_validation"),
      stage("npm_publish", { authority: "remote_publication", capability: "npm_auth", depends_on: ["local_validation"] }),
    ],
  });
  assert.equal(missingNpm.state, "BLOCKED_CAPABILITY", "missing npm auth must be capability, not permission");
  assert.deepEqual(missingNpm.executed, ["version_update", "changelog", "local_validation"], "npm auth blocker stopped independent local work");

  const remoteUngrant = authority.runObjectiveStages({
    objective: localOnly,
    stages: [
      stage("release_commit"),
      stage("push_main", { authority: "remote_publication", depends_on: ["release_commit"] }),
      stage("push_tag", { authority: "remote_publication", depends_on: ["release_commit"] }),
      stage("github_release", { authority: "remote_publication", depends_on: ["release_commit"] }),
      stage("npm_publish", { authority: "remote_publication", depends_on: ["release_commit"] }),
    ],
  });
  assert.equal(remoteUngrant.state, "BLOCKED_PERMISSION", "ungranted remote publication must be permission blocker");
  assert.equal(remoteUngrant.blocked.permission.length, 4, "remote publication blockers were not consolidated for one grant class");

  const safety = authority.runObjectiveStages({
    objective: localOnly,
    safety: { test: false },
    stages: [stage("test")],
  });
  assert.equal(safety.state, "BLOCKED_SAFETY");

  const decision = authority.runObjectiveStages({
    objective: localOnly,
    decisions: { package_name: "package name belongs to another owner" },
    stages: [stage("package_name")],
  });
  assert.equal(decision.state, "BLOCKED_DECISION");

  const waiting = authority.runObjectiveStages({
    objective: localOnly,
    waiting: { ci: "CI is still running" },
    stages: [stage("ci")],
  });
  assert.equal(waiting.state, "WAITING_CONDITION");

  const checkpointed = authority.runObjectiveStages({
    objective: authority.createObjective({
      id: "resume-test",
      checkpoints: { version_update: "complete" },
    }),
    stages: [stage("version_update"), stage("changelog"), stage("release_notes")],
  });
  assert.deepEqual(checkpointed.executed, ["changelog", "release_notes"], "completed checkpoints were duplicated");

  const idempotentExisting = authority.runObjectiveStages({
    objective: authority.createObjective({
      id: "idempotency-test",
      authority: authority.defaultAuthority({ remote_publication: true }),
      checkpoints: { tag: "complete", release: "complete" },
    }),
    stages: [
      stage("tag", { authority: "remote_publication" }),
      stage("release", { authority: "remote_publication" }),
    ],
  });
  assert.equal(idempotentExisting.executed.length, 0, "existing tag/release stages should be verified rather than recreated");

  const destructive = authority.permissionGrantedForRoute({
    route: { permission: "force-push" },
    objective: remote,
  });
  assert.equal(destructive.granted, false, "remote_publication must not imply destructive_action");
  assert.equal(destructive.requiredAuthority, "destructive_action");

  const limited = authority.runObjectiveStages({
    objective: localOnly,
    maxTransitions: 0,
    stages: [stage("loop_guard")],
  });
  assert.equal(limited.state, "BLOCKED_SAFETY", "transition limit should stop as safety blocker");

  const initial = {
    version: 1,
    lanes: [
      {
        lane_id: "lane-a",
        display_name: "Lane A",
        repo_path: ROOT,
        repository: "example/a",
        current_state: "State A",
        next_permission: "",
        status: "active",
        route_ids: [],
        last_updated: "2026-01-01T00:00:00.000Z",
        evidence_refs: [],
        hold_reason: "",
        notes: "",
        objective: localOnly,
      },
      {
        lane_id: "lane-b",
        display_name: "Lane B",
        repo_path: ROOT,
        repository: "example/b",
        current_state: "State B",
        next_permission: "",
        status: "active",
        route_ids: [],
        last_updated: "2026-01-01T00:00:00.000Z",
        evidence_refs: [],
        hold_reason: "",
        notes: "",
        objective: otherObjective,
      },
    ],
  };
  laneState.atomicWrite(stateFile, initial);
  laneState.approveObjectiveAuthority(initial, "lane-a", "remote_publication");
  assert.equal(laneState.getLane(initial, "lane-a").objective.authority.remote_publication, true);
  assert.equal(laneState.getLane(initial, "lane-b").objective.authority.remote_publication, false, "objective grant leaked between lanes");

  const beforeDryRun = fs.readFileSync(stateFile, "utf8");
  const dryRun = runNext(["--lane", "lane-a", "--state-file", stateFile, "--dry-run"]);
  assert.notEqual(dryRun.status, null, "dry-run did not return");
  assert.equal(fs.readFileSync(stateFile, "utf8"), beforeDryRun, "dry-run mutated lane state");

  const prohibited = JSON.parse(beforeDryRun);
  prohibited.lanes[0].objective.npm_token = "not-a-real-value";
  assert.throws(() => laneState.validateState(prohibited), /prohibited secret-shaped key/, "secret-shaped objective field was accepted");

  const legacy = authority.permissionGrantedForRoute({
    route: { permission: "github-handoff" },
    objective: null,
    allow: new Set(["github-handoff"]),
  });
  assert.equal(legacy.granted, true, "legacy --allow route flag should remain compatible");

  console.log("Objective authority tests passed: local autonomy, inheritance, blocker classes, checkpoints, idempotency, dry-run, lane isolation, destructive boundary, secret-key rejection, and legacy compatibility.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
