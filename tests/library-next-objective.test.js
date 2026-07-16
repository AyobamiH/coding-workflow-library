#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const laneState = require("../scripts/lane-state");
const { buildReport, classifyDisposition, validateReport } = require("../scripts/library-next-objective");
const runtime = require("../scripts/lib/run-next/runtime-context");

const ROOT = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "library-next-objective-"));

function write(repo, relative, content) {
  const file = path.join(repo, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function fixtureRepo(active = false) {
  const repo = fs.mkdtempSync(path.join(temporary, "repo-"));
  write(repo, "build-queue.md", `# P0 - Foundations

# P1 - Current Maturity Gaps

${active ? "An active gap is recorded below." : "No active P1 gaps are currently evidence-backed."}

## Existing Foundation

- Status: implemented and published.
${active ? "\n## New Bounded Gap\n\n- Evidence source: repeated fixture failure.\n- Primary type: `VALIDATION`.\n" : ""}
# P2 - Follow-On Autonomy Improvements

All listed P2 items are complete.
`);
  write(repo, "docs/agent-and-skill-roadmap.md", `# Roadmap

Current status: no reusable agent role is verified for implementation.

Missing helpers:

- None currently evidence-backed.

No additional generic foundation is currently proven missing.
`);
  return repo;
}

function runNext(args) {
  return spawnSync(process.execPath, [path.join(ROOT, "scripts", "run-next"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function lane(id, state) {
  return {
    lane_id: id,
    display_name: id,
    repo_path: ROOT,
    repository: `example/${id}`,
    current_state: state,
    next_permission: "assess next objective",
    status: "complete",
    route_ids: [],
    last_updated: "2026-01-01T00:00:00.000Z",
    evidence_refs: [],
    hold_reason: "",
    notes: "fixture",
  };
}

try {
  assert.equal(classifyDisposition("implemented and published"), "complete");
  assert.equal(classifyDisposition("blocked pending evidence"), "active");
  assert.equal(classifyDisposition(""), "active");

  const noGapRepo = fixtureRepo(false);
  const noGap = buildReport(noGapRepo);
  assert.equal(noGap.status, "PASS");
  assert.equal(noGap.classification, "NO_ACTIVE_REUSABLE_GAP");
  assert.deepEqual(validateReport(noGap), []);

  const active = buildReport(fixtureRepo(true));
  assert.equal(active.classification, "ACTIVE_REUSABLE_GAP");
  assert.equal(active.active_gaps[0].title, "New Bounded Gap");
  assert.ok(!JSON.stringify(active).includes(temporary), "report leaked an absolute temporary path");

  const repeated = buildReport(noGapRepo);
  assert.deepEqual(repeated, noGap, "repeated assessment was not deterministic");
  const missingRepo = buildReport(path.join(temporary, "missing"));
  assert.equal(missingRepo.classification, "EVIDENCE_INCONSISTENT");

  const stateFile = path.join(temporary, "lanes.json");
  const initial = {
    version: 1,
    lanes: [
      lane("library", "Role credentials retained, source cohesion hardening complete"),
      lane("other", "Unchanged product hold"),
    ],
  };
  laneState.atomicWrite(stateFile, initial);
  const before = fs.readFileSync(stateFile, "utf8");
  const dryRun = runNext([
    "--lane", "library",
    "--state-file", stateFile,
    "--repo", ROOT,
    "--dry-run",
    "--allow", "library-next-objective-assessment",
  ]);
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  assert.equal(fs.readFileSync(stateFile, "utf8"), before, "dry-run changed lane state");

  runtime.configure({
    fs,
    path,
    LIBRARY_ROOT: ROOT,
    targetRepo: ROOT,
    dryRun: false,
    evidence: [],
    actions: [],
    run(command) {
      return command.endsWith("library-next-objective")
        ? { code: 0, stdout: JSON.stringify(noGap), stderr: "" }
        : { code: 0, stdout: "", stderr: "" };
    },
  });
  const { runLibraryNextObjectiveAssessment } = require("../scripts/lib/run-next/library-self-assessment");
  const result = runLibraryNextObjectiveAssessment();
  assert.equal(result.ledgerStatus, "Library self-assessment complete, no active reusable foundation gap");
  assert.equal(result.objectiveStatus, "complete");

  const state = laneState.readState(stateFile);
  const otherBefore = JSON.stringify(laneState.getLane(state, "other"));
  laneState.updateLane(state, "library", {
    current_state: result.ledgerStatus,
    next_permission: result.nextPermission,
    status: result.objectiveStatus,
  });
  laneState.atomicWrite(stateFile, state);
  const after = laneState.readState(stateFile);
  assert.equal(laneState.getLane(after, "library").current_state, result.ledgerStatus);
  assert.equal(JSON.stringify(laneState.getLane(after, "other")), otherBefore, "selected-lane result changed another lane");

  runtime.configure({ args: { allow: new Set() } });
  const { selectLibraryFoundationRoute } = require("../scripts/lib/run-next/library-route-selection");
  const terminal = selectLibraryFoundationRoute(result.ledgerStatus);
  assert.equal(terminal.kind, "human-boundary");
  assert.match(terminal.finalStatus, /no active reusable foundation gap/i);
  assert.doesNotMatch(terminal.nextAction, /unknown ledger status/i);

  console.log("Library next-objective tests passed: deterministic classification, active-gap detection, dry-run immutability, selected-lane update, and known terminal state.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
