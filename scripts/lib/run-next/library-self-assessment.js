"use strict";

// The terminal library route verifies roadmap truth without inventing new work.

const runtime = require("./runtime-context");
const { fs, path, LIBRARY_ROOT, targetRepo, dryRun, evidence, actions } = runtime.pick([
  "fs",
  "path",
  "LIBRARY_ROOT",
  "targetRepo",
  "dryRun",
  "evidence",
  "actions",
]);
const run = runtime.lazy("run");

function runLibraryNextObjectiveAssessment() {
  const helper = "scripts/library-next-objective";
  evidence.push("assessment sources: build-queue.md and docs/agent-and-skill-roadmap.md");
  evidence.push("selection rule: active P1 evidence wins; otherwise an explicit verified no-gap boundary is valid");
  actions.push("product repos, remotes, package releases, production, and secret access remain outside this route");

  if (dryRun) {
    actions.push("would run the deterministic next-objective assessment in JSON validation mode");
    actions.push("would run docs, repo-map, module-size, route, and skill validation");
    actions.push("would update only the selected library lane after a real successful run");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "Role credentials retained, source cohesion hardening complete",
      summary: "library next-objective assessment would distinguish an active evidence-backed gap from a valid no-gap terminal boundary",
      nextPermission: "library-next-objective-assessment",
      nextSkill: "coding-workflow-orchestrator-skill",
      exitCode: 0,
    };
  }

  if (path.resolve(targetRepo) !== LIBRARY_ROOT) {
    return blocked(`library self-assessment may only run against the workflow library`);
  }
  if (!fs.existsSync(path.join(LIBRARY_ROOT, helper))) return blocked(`${helper} missing`);

  const commands = [
    ["next-objective assessment", `./${helper}`, ["--repo", ".", "--json", "--validate"]],
    ["documentation validation", "./scripts/docs-list", ["--validate"]],
    ["repository map validation", "./scripts/repo-map", ["--repo", ".", "--validate"]],
    ["module-size validation", "./scripts/check-module-size", []],
    ["route audit", "./scripts/route-audit", []],
    ["skill validation", "./scripts/validate-skills", []],
  ];
  let assessment = null;
  const failures = [];
  for (const [label, command, commandArgs] of commands) {
    const result = run(command, commandArgs, { cwd: LIBRARY_ROOT, allowFailure: true });
    evidence.push(`${label} exit: ${result.code}`);
    if (label === "next-objective assessment" && result.stdout.trim()) {
      try {
        assessment = JSON.parse(result.stdout);
      } catch {
        failures.push("next-objective assessment returned invalid JSON");
      }
    }
    if (result.code !== 0) failures.push(`${label} failed`);
  }
  if (!assessment) failures.push("next-objective assessment result unavailable");
  if (assessment) evidence.push(`next-objective classification: ${assessment.classification}`);
  if (failures.length || assessment?.classification === "EVIDENCE_INCONSISTENT") {
    return blocked(failures.join("; ") || "queue and roadmap evidence are inconsistent");
  }

  if (assessment.classification === "ACTIVE_REUSABLE_GAP") {
    const gap = assessment.active_gaps[0]?.title || "unclassified P1 gap";
    return {
      finalStatus: "ACTIVE GAP FOUND",
      ledgerStatus: `Evidence-backed reusable gap selected: ${gap}`,
      summary: `the public queue contains an active P1 gap: ${gap}`,
      nextPermission: `define or select the bounded route for ${gap}`,
      nextSkill: "coding-workflow-orchestrator-skill",
      objectiveStatus: "active",
      exitCode: 0,
    };
  }

  return {
    finalStatus: "COMPLETE",
    ledgerStatus: "Library self-assessment complete, no active reusable foundation gap",
    summary: "queue, roadmap, documentation, source map, module-size, route, and skill evidence agree that no reusable foundation gap is currently active",
    nextPermission: "select a target repository objective or record a new evidence-backed gap",
    nextSkill: "coding-workflow-orchestrator-skill",
    objectiveStatus: "complete",
    exitCode: 0,
  };
}

function blocked(summary) {
  return {
    finalStatus: "BLOCKED_SAFETY",
    ledgerStatus: "Library next-objective assessment blocked",
    summary,
    nextPermission: "repair queue, roadmap, or validation evidence",
    nextSkill: "coding-workflow-orchestrator-skill / error-evidence-skill",
    objectiveStatus: "blocked",
    exitCode: 1,
  };
}

module.exports = {
  runLibraryNextObjectiveAssessment,
};
