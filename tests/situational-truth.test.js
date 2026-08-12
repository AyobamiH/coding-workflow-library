#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { buildReport, validateReport } = require("../scripts/lib/situational-truth/report");
const { classify: classifyFailure, redact: redactFailure } = require("../scripts/failure-evidence");

const root = path.resolve(__dirname, "..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas", "situational-truth.schema.json"), "utf8"));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "situational-truth-test-"));

function run(command, args, cwd, options = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    input: options.input,
    env: { ...process.env, ...(options.env || {}) },
    maxBuffer: 1024 * 1024 * 16,
  });
}

function git(repo, args, options = {}) {
  const result = run("git", args, repo, options);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function write(base, relative, contents) {
  const file = path.join(base, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function commit(repo, message) {
  const result = run("git", ["commit", "-m", message], repo, {
    env: {
      GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return git(repo, ["rev-parse", "HEAD"]);
}

function remoteChild(repo, parent, message) {
  const tree = git(repo, ["rev-parse", `${parent}^{tree}`]);
  return git(repo, ["commit-tree", tree, "-p", parent, "-m", message], {
    env: {
      GIT_AUTHOR_DATE: "2026-01-02T00:00:00Z",
      GIT_COMMITTER_DATE: "2026-01-02T00:00:00Z",
    },
  });
}

function queueText() {
  return `# P1 - Current Maturity Gaps

No active P1 gaps are currently evidence-backed.

## Existing contract

- Status: implemented and locally proven.

# P2 - Follow-On Autonomy Improvements

All listed P2 items are complete.
`;
}

function roadmapText() {
  return `# Roadmap

Missing helpers:

- None currently evidence-backed.

Current status: no reusable agent role is verified for implementation.

No additional generic foundation is currently proven missing.
`;
}

function lane(repo, objective = activeObjective()) {
  return {
    lane_id: "fixture",
    display_name: "Fixture",
    repo_path: repo,
    repository: "example/fixture",
    current_state: "Fixture complete",
    next_permission: "select next objective",
    status: "complete",
    route_ids: ["fixture-route"],
    last_updated: "2026-01-02T00:00:00.000Z",
    evidence_refs: [],
    hold_reason: "",
    notes: "synthetic fixture",
    objective,
  };
}

function activeObjective(overrides = {}) {
  return {
    id: "fixture-objective",
    description: "synthetic objective",
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    authority: {
      local_execution: true,
      remote_publication: false,
      production_mutation: false,
      secret_mutation: false,
      destructive_action: false,
    },
    checkpoints: {},
    blockers: [],
    ...overrides,
  };
}

function writeState(file, lanes) {
  write(path.dirname(file), path.basename(file), `${JSON.stringify({ version: 1, lanes }, null, 2)}\n`);
}

function writeCheckpoint(repo, rootDir, commitSha, overrides = {}) {
  const directory = path.join(rootDir, Buffer.from(path.resolve(repo)).toString("base64url"));
  fs.mkdirSync(directory, { recursive: true });
  write(directory, "run.json", `${JSON.stringify({
    run_id: "fixture-run",
    repo,
    status: "completed",
    required_permission: null,
    last_verified_commit: commitSha,
    updated_at: "2026-01-02T00:00:00.000Z",
    checkpoints: [{ name: "record", status: "completed" }],
    ...overrides,
  }, null, 2)}\n`);
}

function createRepo(name) {
  const repo = path.join(temporary, name);
  fs.mkdirSync(repo, { recursive: true });
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.name", "Fixture"]);
  git(repo, ["config", "user.email", "fixture@example.invalid"]);
  write(repo, "README.md", "# Fixture\n");
  write(repo, "AGENTS.md", "# Agents\n");
  write(repo, "RUNBOOK.md", "# Runbook\n");
  write(repo, "work-ledger.md", "# Ledger\n\nFixture complete\n");
  write(repo, "build-queue.md", queueText());
  write(repo, "docs/agent-and-skill-roadmap.md", roadmapText());
  write(repo, "routes/skill-routes.json", `${JSON.stringify({ routes: [{
    id: "fixture-route",
    skill_file: "skill-files/fixture-skill.md",
    ledger_states_handled: ["Fixture requested"],
    success_ledger_state: "Fixture complete",
    blocked_ledger_state: "Fixture blocked",
    provenance: "generic synthetic route",
  }] }, null, 2)}\n`);
  write(repo, "skill-files/fixture-skill.md", "# Fixture Skill\n");
  write(repo, "staged.txt", "base\n");
  write(repo, "unstaged.txt", "base\n");
  const files = ["README.md", "AGENTS.md", "RUNBOOK.md", "work-ledger.md", "build-queue.md", "docs/agent-and-skill-roadmap.md", "routes/skill-routes.json", "skill-files/fixture-skill.md", "staged.txt", "unstaged.txt"];
  git(repo, ["add", "--", ...files]);
  const base = commit(repo, "Fixture base");
  git(repo, ["remote", "add", "origin", "https://github.com/example/fixture.git"]);
  git(repo, ["update-ref", "refs/remotes/origin/main", base]);
  git(repo, ["config", "branch.main.remote", "origin"]);
  git(repo, ["config", "branch.main.merge", "refs/heads/main"]);
  return { repo, base };
}

function optionsFor(fixture, overrides = {}) {
  const homeDir = path.join(temporary, `${path.basename(fixture.repo)}-home`);
  const stateFile = path.join(homeDir, ".coding-workflow", "lanes.json");
  const checkpointDir = path.join(temporary, `${path.basename(fixture.repo)}-checkpoints`);
  writeState(stateFile, [lane(fixture.repo, overrides.objective || activeObjective())]);
  writeCheckpoint(fixture.repo, checkpointDir, overrides.checkpointCommit || git(fixture.repo, ["rev-parse", "HEAD"]), overrides.checkpoint || {});
  return {
    repo: fixture.repo,
    homeDir,
    stateFile: overrides.stateFile,
    env: overrides.env || {},
    checkpointDir,
    laneId: overrides.laneId,
  };
}

function fileSnapshot(repo) {
  const result = {};
  const visit = (directory, relative = "") => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === ".run-next") continue;
      const childRelative = path.join(relative, entry.name);
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(child, childRelative);
      else result[childRelative.replaceAll(path.sep, "/")] = fs.readFileSync(child, "utf8");
    }
  };
  visit(repo);
  return result;
}

try {
  const aligned = createRepo("aligned repo");
  const alignedOptions = optionsFor(aligned);
  const before = fileSnapshot(aligned.repo);
  const alignedReport = buildReport(alignedOptions);
  assert.equal(alignedReport.git.upstream.relation, "aligned", "clean aligned repo was not classified");
  assert.equal(alignedReport.git.worktree.status, "clean");
  assert.equal(alignedReport.git.worktree.staged, 0);
  assert.equal(alignedReport.git.worktree.unstaged, 0);
  assert.equal(alignedReport.git.worktree.untracked, 0);
  assert.equal(alignedReport.lane_state.status, "found", "alternate live lane path was not discovered");
  assert.equal(alignedReport.lane_state.selected_location_class, "home_coding_workflow_state");
  assert.equal(alignedReport.lane_state.lane.match_status, "matched");
  assert.equal(alignedReport.checkpoint.freshness, "FRESH");
  assert.deepEqual(fileSnapshot(aligned.repo), before, "helper mutated the repository");
  assert.deepEqual(buildReport(alignedOptions), alignedReport, "next action or output was not deterministic");
  assert.deepEqual(validateReport(alignedReport, schema), [], "JSON report did not validate against schema");
  assert.ok(!JSON.stringify(alignedReport).includes(aligned.repo), "JSON exposed an absolute private path");

  const serialized = JSON.stringify(alignedReport, null, 2);
  assert.doesNotThrow(() => JSON.parse(serialized), "JSON output was invalid");
  assert.ok(!serialized.includes(aligned.repo), "JSON exposed the private fixture path");

  const ahead = createRepo("ahead repo");
  write(ahead.repo, "ahead.txt", "local\n");
  git(ahead.repo, ["add", "--", "ahead.txt"]);
  commit(ahead.repo, "Local work");
  const aheadReport = buildReport(optionsFor(ahead));
  assert.equal(aheadReport.git.upstream.relation, "ahead");
  assert.equal(aheadReport.git.unpublished_local_commits, 1);
  assert.equal(aheadReport.next_action.code, "PUBLISH_LOCAL_COMMIT_OR_KEEP_LOCAL");
  assert.equal(aheadReport.blocker.classification, "BLOCKED_DECISION");

  const capabilityBlocked = createRepo("capability blocked repo");
  write(capabilityBlocked.repo, "local-fix.txt", "validated locally\n");
  git(capabilityBlocked.repo, ["add", "--", "local-fix.txt"]);
  commit(capabilityBlocked.repo, "Validated local fix");
  const blockedObjective = activeObjective({
    status: "blocked",
    blockers: [{
      state: "BLOCKED_CAPABILITY",
      reason: "GitHub publication transport is unavailable.",
      stage: "remote_publication",
      recorded_at: "2026-01-02T00:00:00.000Z",
    }],
  });
  const capabilityBlockedReport = buildReport(optionsFor(capabilityBlocked, { objective: blockedObjective }));
  assert.equal(capabilityBlockedReport.next_action.code, "BLOCKED_CAPABILITY_REMOTE_PUBLICATION", "explicit capability blocker lost precedence to unpublished Git state");
  assert.equal(capabilityBlockedReport.blocker.classification, "BLOCKED_CAPABILITY", "explicit blocker classification was downgraded");
  assert.equal(capabilityBlockedReport.lane_state.objective.blockers[0].stage, "remote_publication");
  assert.deepEqual(validateReport(capabilityBlockedReport, schema), [], "explicit blocker report did not validate against schema");

  const behind = createRepo("behind repo");
  git(behind.repo, ["update-ref", "refs/remotes/origin/main", remoteChild(behind.repo, behind.base, "Remote work")]);
  assert.equal(buildReport(optionsFor(behind)).git.upstream.relation, "behind");

  const diverged = createRepo("diverged repo");
  write(diverged.repo, "local.txt", "local\n");
  git(diverged.repo, ["add", "--", "local.txt"]);
  commit(diverged.repo, "Local branch");
  git(diverged.repo, ["update-ref", "refs/remotes/origin/main", remoteChild(diverged.repo, diverged.base, "Remote branch")]);
  const divergedReport = buildReport(optionsFor(diverged));
  assert.equal(divergedReport.git.upstream.relation, "diverged");
  assert.equal(divergedReport.blocker.classification, "BLOCKED_SAFETY");

  const dirty = createRepo("dirty repo");
  write(dirty.repo, "staged.txt", "staged\n");
  git(dirty.repo, ["add", "--", "staged.txt"]);
  write(dirty.repo, "unstaged.txt", "unstaged\n");
  write(dirty.repo, "untracked.txt", "untracked\n");
  const dirtyReport = buildReport(optionsFor(dirty));
  assert.equal(dirtyReport.git.worktree.status, "dirty");
  assert.equal(dirtyReport.git.worktree.staged, 1);
  assert.equal(dirtyReport.git.worktree.unstaged, 1);
  assert.equal(dirtyReport.git.worktree.untracked, 1);
  assert.equal(dirtyReport.next_action.code, "CLASSIFY_DIRTY_WORKTREE");

  const missing = createRepo("missing lane repo");
  const missingReport = buildReport({ repo: missing.repo, homeDir: path.join(temporary, "absent-home"), env: {}, checkpointDir: path.join(temporary, "absent-checkpoints") });
  assert.equal(missingReport.lane_state.status, "missing", "missing lane state should not crash");

  const envRepo = createRepo("env lane repo");
  const envHome = path.join(temporary, "env-home");
  const envState = path.join(temporary, "provided", "lanes.json");
  writeState(envState, [lane(envRepo.repo)]);
  const envReport = buildReport({ repo: envRepo.repo, homeDir: envHome, env: { CODING_WORKFLOW_STATE_FILE: envState }, checkpointDir: path.join(temporary, "env-checkpoints") });
  assert.equal(envReport.lane_state.selected_location_class, "environment_override", "env-provided state was not discovered");

  const openclawRepo = createRepo("openclaw lane repo");
  const openclawHome = path.join(temporary, "openclaw-home");
  const openclawState = path.join(openclawHome, ".openclaw", "state", "coding-workflow", "lanes.json");
  writeState(openclawState, [lane(openclawRepo.repo)]);
  const openclawReport = buildReport({ repo: openclawRepo.repo, homeDir: openclawHome, env: {}, checkpointDir: path.join(temporary, "openclaw-checkpoints") });
  assert.equal(openclawReport.lane_state.selected_location_class, "home_openclaw_state", "OpenClaw compatibility state was not discovered after a missing canonical default");

  const stale = createRepo("stale objective repo");
  const terminal = activeObjective({
    status: "complete",
    authority: {
      local_execution: true,
      remote_publication: true,
      production_mutation: false,
      secret_mutation: false,
      destructive_action: false,
    },
  });
  const staleReport = buildReport(optionsFor(stale, { objective: terminal }));
  assert.equal(staleReport.lane_state.objective.freshness, "STALE_AUTHORITY", "stale terminal objective was not detected");
  assert.equal(staleReport.lane_state.objective.authority_stale, true, "stale authority was not detected");

  const staleCheckpointPermission = createRepo("stale checkpoint permission repo");
  const staleCheckpointPermissionReport = buildReport(optionsFor(staleCheckpointPermission, {
    checkpoint: { required_permission: "fixture-route" },
  }));
  assert.equal(staleCheckpointPermissionReport.checkpoint.permission_consistent, false, "legacy completed checkpoint permission was not detected");
  assert.ok(staleCheckpointPermissionReport.checkpoint.issues.includes("completed_checkpoint_retains_required_permission"));

  const mismatchObjectiveRepo = createRepo("objective mismatch repo");
  write(mismatchObjectiveRepo.repo, "new-work.txt", "new work\n");
  git(mismatchObjectiveRepo.repo, ["add", "--", "new-work.txt"]);
  commit(mismatchObjectiveRepo.repo, "Harden current-state reconciliation");
  const mismatchObjective = activeObjective({ id: "old-portability-release-v0.1.0", updated_at: "2025-12-31T00:00:00.000Z" });
  const mismatchObjectiveReport = buildReport(optionsFor(mismatchObjectiveRepo, { objective: mismatchObjective }));
  assert.ok(mismatchObjectiveReport.lane_state.objective.reasons.includes("objective_id_does_not_match_newer_head"), "objective/head mismatch reason was not reported");
  assert.ok(mismatchObjectiveReport.lane_state.objective.reasons.includes("objective_release_or_date_marker_does_not_match_head"), "stale release marker reason was not reported");

  const oldCheckpoint = createRepo("old checkpoint repo");
  write(oldCheckpoint.repo, "new.txt", "new\n");
  git(oldCheckpoint.repo, ["add", "--", "new.txt"]);
  commit(oldCheckpoint.repo, "New work");
  const oldReport = buildReport(optionsFor(oldCheckpoint, { checkpointCommit: oldCheckpoint.base }));
  assert.equal(oldReport.checkpoint.freshness, "ANCESTOR_OF_HEAD", "checkpoint behind HEAD was not detected");

  const missingCommit = createRepo("missing checkpoint repo");
  const missingCommitReport = buildReport(optionsFor(missingCommit, { checkpointCommit: "1111111111111111111111111111111111111111" }));
  assert.equal(missingCommitReport.checkpoint.freshness, "MISSING_COMMIT");

  const mismatch = createRepo("mismatch repo");
  const mismatchOptions = optionsFor(mismatch);
  writeState(mismatchOptions.stateFile || path.join(mismatchOptions.homeDir, ".coding-workflow", "lanes.json"), [{
    ...lane(path.join(temporary, "different-repo")),
    repository: "example/different",
  }]);
  const mismatchReport = buildReport({ ...mismatchOptions, laneId: "fixture" });
  assert.equal(mismatchReport.lane_state.lane.match_status, "mismatch", "selected lane mismatch was not detected");
  assert.equal(mismatchReport.blocker.classification, "BLOCKED_SAFETY");

  const product = createRepo("product route repo");
  write(product.repo, "routes/skill-routes.json", `${JSON.stringify({ routes: [{
    id: "capability-intelligence-product-route",
    skill_file: "skill-files/fixture-skill.md",
    ledger_states_handled: ["Fixture requested"],
    success_ledger_state: "Fixture complete",
    blocked_ledger_state: "Fixture blocked",
    provenance: "Capability Intelligence belongs to a separate product",
  }] }, null, 2)}\n`);
  const productReport = buildReport(optionsFor(product));
  assert.ok(productReport.product_route_warnings.some((item) => item.classification === "PRODUCT_ROUTE_SPLIT_DECISION_REQUIRED"), "product-specific route warning was missing");

  const productWithoutLibraryControls = createRepo("product without library controls");
  git(productWithoutLibraryControls.repo, ["rm", "build-queue.md", "docs/agent-and-skill-roadmap.md", "routes/skill-routes.json", "work-ledger.md"]);
  commit(productWithoutLibraryControls.repo, "Use product-native control files");
  git(productWithoutLibraryControls.repo, ["update-ref", "refs/remotes/origin/main", git(productWithoutLibraryControls.repo, ["rev-parse", "HEAD"])]);
  const inactiveAuthority = Object.fromEntries(Object.keys(activeObjective().authority).map((name) => [name, false]));
  const productWithoutControlsReport = buildReport(optionsFor(productWithoutLibraryControls, {
    objective: activeObjective({ status: "complete", authority: inactiveAuthority }),
  }));
  assert.equal(productWithoutControlsReport.routes.status, "NOT_APPLICABLE", "missing product-local route metadata should be not applicable");
  assert.equal(productWithoutControlsReport.routes.lane_state_recognized, null, "external route ownership should not become a false mismatch");
  assert.equal(productWithoutControlsReport.routes.ledger_state_present, null, "missing historical public ledger should be not applicable");
  assert.equal(productWithoutControlsReport.build_queue.classification, "NOT_APPLICABLE", "missing library build queue should be not applicable");
  assert.equal(productWithoutControlsReport.next_action.code, "NO_ACTIVE_PROJECT_OBJECTIVE", "terminal product lane should remain the bounded truth");
  assert.equal(productWithoutControlsReport.blocker.classification, "NONE", "terminal product lane should not manufacture a safety blocker");
  assert.deepEqual(validateReport(productWithoutControlsReport, schema), [], "product-native report did not validate against schema");

  const privatePath = ["", "home", "private-user", "workspace", "repo"].join("/");
  const failureText = redactFailure(`gh auth status: not logged in while reading ${privatePath}\n`);
  const failure = classifyFailure(failureText);
  assert.equal(failure[0].severity, "BLOCKED_CAPABILITY", "failure classification was vague");
  assert.doesNotMatch(JSON.stringify(failure), /John-required|Needs John/, "legacy vague failure boundary remained");
  assert.ok(!failureText.includes(privatePath), "failure report exposed a private absolute path");

  const evidenceSource = fs.readFileSync(path.join(root, "scripts", "evidence-pack"), "utf8");
  assert.match(evidenceSource, /situational-truth\.json/, "evidence pack did not collect actual situational evidence");
  assert.match(evidenceSource, /Target repo: <target-repo>/, "evidence pack dry-run did not redact the target path");

  console.log("situational-truth tests passed: Git relations, worktree counts, lane discovery, explicit blocker precedence, stale objective/authority, checkpoint freshness, product-native control boundaries, route warnings, schema, privacy, immutability, and deterministic next actions.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
