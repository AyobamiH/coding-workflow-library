#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "run-next-resume-"));
const runDir = path.join(temporary, "state");
const targetRepo = path.join(temporary, "target-repo");
let runCounter = 0;

fs.mkdirSync(targetRepo, { recursive: true });
fs.writeFileSync(path.join(targetRepo, "README.md"), "# Resume target\n");
spawnSync("git", ["init"], { cwd: targetRepo, encoding: "utf8" });
spawnSync("git", ["config", "user.name", "Test User"], { cwd: targetRepo, encoding: "utf8" });
spawnSync("git", ["config", "user.email", "test@example.invalid"], { cwd: targetRepo, encoding: "utf8" });
spawnSync("git", ["add", "README.md"], { cwd: targetRepo, encoding: "utf8" });
spawnSync("git", ["commit", "-m", "Initial test repo"], { cwd: targetRepo, encoding: "utf8" });

function repoKey(repo) {
  return Buffer.from(path.resolve(repo)).toString("base64url");
}

function run(args, options = {}) {
  const stdoutPath = path.join(temporary, `run-${++runCounter}.stdout`);
  const stderrPath = path.join(temporary, `run-${runCounter}.stderr`);
  const stdoutFd = fs.openSync(stdoutPath, "w");
  const stderrFd = fs.openSync(stderrPath, "w");
  try {
    const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "run-next"), ...args], {
      cwd: ROOT,
      env: { ...process.env, RUN_NEXT_DIR: runDir },
      stdio: ["ignore", stdoutFd, stderrFd],
      ...options,
    });
    result.stdout = fs.readFileSync(stdoutPath, "utf8");
    result.stderr = fs.readFileSync(stderrPath, "utf8");
    return result;
  } finally {
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
  }
}

function currentBranch() {
  return spawnSync("git", ["branch", "--show-current"], { cwd: targetRepo, encoding: "utf8" }).stdout.trim();
}

function currentHead() {
  return spawnSync("git", ["rev-parse", "HEAD"], { cwd: targetRepo, encoding: "utf8" }).stdout.trim();
}

function writeRun(run) {
  const dir = path.join(runDir, repoKey(run.repo));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${run.run_id}.json`), JSON.stringify(run, null, 2) + "\n");
}

function fixtureRun(overrides = {}) {
  return {
    run_id: overrides.run_id || "test-run-001",
    repo: overrides.repo || targetRepo,
    branch: overrides.branch || currentBranch(),
    job: overrides.job || "verification-bundle-self-test",
    skill: overrides.skill || "release-preflight-skill",
    phase: overrides.phase || "execute",
    status: overrides.status || "incomplete",
    checkpoints: overrides.checkpoints || [
      { name: "inspect", status: "completed" },
      { name: "route", status: "completed" },
      { name: "permission", status: "completed" },
      { name: "execute", status: "incomplete" },
      { name: "verify", status: "pending" },
      { name: "record", status: "pending" },
    ],
    permissions: overrides.permissions || ["verification-bundle-self-test"],
    required_permission: overrides.required_permission || "verification-bundle-self-test",
    last_verified_commit: overrides.last_verified_commit || currentHead(),
    stop_reason: overrides.stop_reason || "simulated interruption",
    active_heading: "test fixture",
    current_status: "Local verification and release evidence bundle built",
    selected_lane: null,
    created_at: overrides.created_at || "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at || "2026-01-01T00:00:00.000Z",
  };
}

try {
  const emptyStatus = run(["--repo", targetRepo, "--status"]);
  assert.equal(emptyStatus.status, 0, "status with no runs should pass");
  assert.match(emptyStatus.stdout, /run id: none/, "status should report no run state");

  const incomplete = fixtureRun();
  writeRun(incomplete);

  const status = run(["--repo", targetRepo, "--status"]);
  assert.equal(status.status, 0, "status should pass with incomplete run");
  assert.match(status.stdout, /run id: test-run-001/, "status should show run id");
  assert.match(status.stdout, /next incomplete checkpoint: execute/, "status should show next incomplete checkpoint");

  const before = fs.readFileSync(path.join(runDir, repoKey(targetRepo), "test-run-001.json"), "utf8");
  const dryRun = run(["--repo", targetRepo, "--resume", "--dry-run", "--allow", "verification-bundle-self-test"]);
  assert.equal(dryRun.status, 0, "resume dry-run should pass");
  assert.match(dryRun.stdout, /RESUME DRY RUN/, "resume dry-run should identify itself");
  assert.equal(fs.readFileSync(path.join(runDir, repoKey(targetRepo), "test-run-001.json"), "utf8"), before, "resume dry-run changed checkpoint state");

  const missingPermission = run(["--repo", targetRepo, "--resume", "--dry-run"]);
  assert.equal(missingPermission.status, 2, "missing permission should stop with permission exit");
  assert.match(missingPermission.stdout, /missing required permission/i, "missing permission should be explicit");

  writeRun(fixtureRun({ run_id: "test-run-branch", branch: "not-the-current-branch", updated_at: "2026-01-02T00:00:00.000Z" }));
  const branchMismatch = run(["--repo", targetRepo, "--resume", "--dry-run", "--allow", "verification-bundle-self-test"]);
  assert.equal(branchMismatch.status, 1, "branch mismatch should block resume");
  assert.match(branchMismatch.stdout, /target branch changed/i, "branch mismatch should be explicit");

  const complete = fixtureRun({
    run_id: "test-run-complete",
    status: "completed",
    updated_at: "2026-01-03T00:00:00.000Z",
    checkpoints: [
      { name: "inspect", status: "completed" },
      { name: "route", status: "completed" },
      { name: "permission", status: "completed" },
      { name: "execute", status: "completed" },
      { name: "verify", status: "completed" },
      { name: "record", status: "completed" },
    ],
  });
  writeRun(complete);
  const noIncomplete = run(["--repo", targetRepo, "--resume", "--dry-run", "--allow", "verification-bundle-self-test"]);
  assert.notEqual(noIncomplete.stdout, "", "resume should produce a clear report");
  assert.match(noIncomplete.stdout, /NO INCOMPLETE RUN/, "newer completed run should supersede older stale incomplete checkpoints");
  assert.match(noIncomplete.stdout, /older incomplete checkpoints are stale/i, "stale incomplete checkpoints should be named as stale");

  const stateText = fs.readFileSync(path.join(runDir, repoKey(targetRepo), "test-run-001.json"), "utf8");
  assert.doesNotMatch(stateText, /gh[pousr]_|github_pat_|sk-|eyJ[A-Za-z0-9_-]+\./, "checkpoint state contains secret-shaped content");

  console.log("run-next resume tests passed: status, discovery, dry-run immutability, permission stop, branch stop, and secret-safe state.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
