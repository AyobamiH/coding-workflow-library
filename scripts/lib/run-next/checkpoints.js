"use strict";

const runtime = require("./runtime-context");
const { fs, path, autonomousBoundaries, DEFAULT_RUN_NEXT_DIR, CHECKPOINT_NAMES, args, targetRepo, dryRun, selectedLane, spawnSync } = runtime.pick(["fs","path","autonomousBoundaries","DEFAULT_RUN_NEXT_DIR","CHECKPOINT_NAMES","args","targetRepo","dryRun","selectedLane","spawnSync"]);
const run = runtime.lazy("run");

function isNonBlockingResult(status) {
  return [
    "PR opened, not merged",
    "PR ready for merge approval",
    "PR_CHECKS_PENDING",
    "PR_READY",
    "MERGING",
    "POST_MERGE_VERIFY",
    "Merged, not deployed",
    "Deployment plan ready, not deployed",
    "Supabase execution preflight ready, not executed",
    "SUPABASE AUTH PASS FOR TOOLING",
    "Supabase linked and local secret ready, not deployed",
    "Scheduler migration PR opened, not merged",
    "Scheduler migration draft merged, not applied",
    "DRY RUN PASS",
  ].includes(status);
}

function shouldCompleteCheckpointRun(result, exitCode) {
  if (exitCode !== 0) return false;
  const status = result.ledgerStatus || result.finalStatus || "";
  if (status === "NEEDS JOHN" || status.startsWith("NEEDS JOHN:")) return false;
  if (result.lifecycleState) return result.lifecycleState === "COMPLETED";
  if (isNonBlockingResult(status)) return false;
  return true;
}

function checkpointDirectory() {
  fs.mkdirSync(DEFAULT_RUN_NEXT_DIR, { recursive: true });
  return DEFAULT_RUN_NEXT_DIR;
}

function repoKey(repo) {
  return Buffer.from(path.resolve(repo || targetRepo)).toString("base64url");
}

function runFilePath(run) {
  const dir = path.join(checkpointDirectory(), repoKey(run.repo));
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${run.run_id}.json`);
}

function checkpointTemplate() {
  return CHECKPOINT_NAMES.map((name) => ({ name, status: "pending" }));
}

function createCheckpointRun({ active, route }) {
  const repo = path.resolve(targetRepo);
  const now = new Date().toISOString();
  const run = {
    run_id: `${now.replace(/[:.]/g, "-")}-${process.pid}`,
    repo,
    branch: gitBranch(repo),
    job: route.kind || route.nextAction || "unknown",
    skill: route.skill || "coding-workflow-orchestrator-skill",
    phase: "inspect",
    status: "incomplete",
    checkpoints: checkpointTemplate(),
    permissions: Array.from(args.allow).sort(),
    required_permission: route.permission || null,
    last_verified_commit: gitHead(repo),
    stop_reason: "",
    active_heading: active.heading || "",
    current_status: active.currentStatus || "",
    selected_lane: selectedLane ? selectedLane.lane_id : null,
    created_at: now,
    updated_at: now,
  };
  writeCheckpointRun(run);
  return run;
}

function writeCheckpointRun(run) {
  run.updated_at = new Date().toISOString();
  fs.writeFileSync(runFilePath(run), JSON.stringify(run, null, 2) + "\n");
}

function checkpoint(run, name) {
  return run.checkpoints.find((item) => item.name === name);
}

function startCheckpoint(run, name) {
  const item = checkpoint(run, name);
  if (!item || item.status === "completed") return;
  item.status = "in_progress";
  run.phase = name;
  writeCheckpointRun(run);
}

function completeCheckpoint(run, name, metadata = {}) {
  const item = checkpoint(run, name);
  if (!item) return;
  item.status = "completed";
  if (Object.keys(metadata).length) item.metadata = metadata;
  run.phase = name;
  writeCheckpointRun(run);
}

function stopCheckpointRun(run, reason, metadata = {}) {
  run.status = "incomplete";
  run.stop_reason = reason || "stopped before completion";
  if (Object.keys(metadata).length) run.stop_metadata = metadata;
  const current = checkpoint(run, run.phase);
  if (current && current.status === "in_progress") current.status = "incomplete";
  writeCheckpointRun(run);
}

function finalizeCheckpointRun(run, result) {
  const exitCode = result.exitCode || 0;
  if (shouldCompleteCheckpointRun(result, exitCode)) {
    for (const name of CHECKPOINT_NAMES) completeCheckpoint(run, name);
    run.status = "completed";
    run.stop_reason = result.summary || result.finalStatus || "completed";
    run.last_verified_commit = gitHead(run.repo);
  } else {
    if (checkpoint(run, "execute") && checkpoint(run, "execute").status === "in_progress") {
      checkpoint(run, "execute").status = "incomplete";
    }
    run.status = "incomplete";
    run.stop_reason = result.summary || result.finalStatus || "stopped before completion";
  }
  writeCheckpointRun(run);
}

function listCheckpointRuns(repo) {
  const dir = path.join(DEFAULT_RUN_NEXT_DIR, repoKey(repo));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
}

function latestRun(repo, incompleteOnly = false) {
  return listCheckpointRuns(repo).find((run) => !incompleteOnly || run.status !== "completed") || null;
}

function nextIncompleteCheckpoint(run) {
  return run.checkpoints.find((item) => item.status !== "completed") || null;
}

function printCheckpointStatus(repo) {
  const run = latestRun(repo, false);
  console.log("# run-next checkpoint status");
  console.log(`target repository: ${path.resolve(repo)}`);
  if (!run) {
    console.log("run id: none");
    console.log("current phase: none");
    console.log("completed checkpoints: none");
    console.log("next incomplete checkpoint: none");
    console.log("stop reason: no checkpoint state found");
    console.log(`recommended resume command: none; run a normal bounded job first`);
    return;
  }
  const incomplete = nextIncompleteCheckpoint(run);
  console.log(`run id: ${run.run_id}`);
  console.log(`selected skill/job: ${run.skill} / ${run.job}`);
  console.log(`current phase: ${run.phase}`);
  console.log(`completed checkpoints: ${run.checkpoints.filter((item) => item.status === "completed").map((item) => item.name).join(", ") || "none"}`);
  console.log(`next incomplete checkpoint: ${incomplete ? incomplete.name : "none"}`);
  console.log(`permissions granted: ${(run.permissions || []).join(", ") || "none"}`);
  console.log(`permissions still required: ${run.required_permission && !(run.permissions || []).includes(run.required_permission) ? run.required_permission : "none"}`);
  console.log(`last verified commit: ${run.last_verified_commit || "none"}`);
  console.log(`stop reason: ${run.stop_reason || (run.status === "completed" ? "completed" : "not recorded")}`);
  console.log(`recommended resume command: ${incomplete ? `./scripts/run-next --repo ${run.repo} --resume --dry-run` : "none; latest run is complete"}`);
}

function runResume() {
  const newest = latestRun(targetRepo, false);
  if (newest && newest.status === "completed") {
    return {
      finalStatus: "NO INCOMPLETE RUN",
      lifecycleState: "COMPLETED",
      summary: `Latest run-next checkpoint for ${path.resolve(targetRepo)} is completed; older incomplete checkpoints are stale and were not resumed.`,
      exitCode: 0,
      checkpoint: newest,
    };
  }

  const run = latestRun(targetRepo, true);
  if (!run) {
    return {
      finalStatus: "NO INCOMPLETE RUN",
      summary: `No incomplete run-next checkpoint was found for ${path.resolve(targetRepo)}.`,
      exitCode: 0,
      checkpoint: null,
    };
  }

  const validation = validateResumeRun(run);
  if (!validation.ok) {
    return {
      finalStatus: "RESUME BLOCKED",
      summary: validation.reason,
      exitCode: validation.exitCode || 1,
      checkpoint: run,
      validation,
    };
  }

  const next = nextIncompleteCheckpoint(run);
  if (dryRun) {
    return {
      finalStatus: "RESUME DRY RUN",
      summary: next
        ? `Would resume from checkpoint '${next.name}' for ${run.job}.`
        : "No incomplete checkpoint remains after validation.",
      exitCode: 0,
      checkpoint: run,
      validation,
    };
  }

  if (!next) {
    run.status = "completed";
    run.stop_reason = "resume found no incomplete checkpoint";
    writeCheckpointRun(run);
    return {
      finalStatus: "RESUME COMPLETE",
      summary: "No incomplete checkpoint remained; checkpoint was marked complete.",
      exitCode: 0,
      checkpoint: run,
      validation,
    };
  }

  if (next.name !== "record") {
    const resumeBoundary = autonomousBoundaries.classifyBoundary({
      capabilityUnavailable: true,
      reason: `Checkpoint '${next.name}' may represent a partially executed operation and this generic resume path has no route-specific replay plan.`,
    });
    return {
      finalStatus: "RESUME BLOCKED: ROUTE-SPECIFIC REPLAY PLAN REQUIRED",
      lifecycleState: resumeBoundary.state,
      boundaryType: resumeBoundary.boundaryType,
      summary: `${resumeBoundary.reason} Use the route-specific resume path or complete the safe verification/record phase first.`,
      exitCode: 2,
      checkpoint: run,
      validation,
    };
  }

  completeCheckpoint(run, "record", { resumed: true });
  run.status = "completed";
  run.stop_reason = "resume completed record checkpoint";
  run.last_verified_commit = gitHead(run.repo);
  writeCheckpointRun(run);
  return {
    finalStatus: "RESUME COMPLETE",
    summary: "Completed the record checkpoint without replaying execution.",
    exitCode: 0,
    checkpoint: run,
    validation,
  };
}

function validateResumeRun(run) {
  if (!run.repo || !fs.existsSync(run.repo)) {
    return { ok: false, reason: "checkpoint references a missing target repository" };
  }
  const currentBranch = gitBranch(run.repo);
  if (run.branch && currentBranch && run.branch !== currentBranch) {
    return { ok: false, reason: `target branch changed from ${run.branch} to ${currentBranch}` };
  }
  const trackedChanges = gitTrackedStatus(run.repo);
  if (trackedChanges.length) {
    return { ok: false, reason: `tracked files changed since checkpoint: ${trackedChanges.join(", ")}` };
  }
  if (run.required_permission && !args.allow.has(run.required_permission)) {
    return { ok: false, reason: `missing required permission: ${run.required_permission}`, exitCode: 2 };
  }
  const currentHead = gitHead(run.repo);
  const alreadyVerified = run.last_verified_commit && currentHead && run.last_verified_commit === currentHead;
  return {
    ok: true,
    currentBranch,
    currentHead,
    alreadyVerified,
    nextCheckpoint: nextIncompleteCheckpoint(run)?.name || null,
  };
}

function printResumeReport(result) {
  console.log("# run-next resume");
  console.log(`final status: ${result.finalStatus}`);
  if (result.lifecycleState) console.log(`lifecycle state: ${result.lifecycleState}`);
  if (result.boundaryType) console.log(`boundary type: ${result.boundaryType}`);
  console.log(`summary: ${result.summary}`);
  if (!result.checkpoint) return;
  const run = result.checkpoint;
  const next = nextIncompleteCheckpoint(run);
  console.log(`run id: ${run.run_id}`);
  console.log(`target repository: ${run.repo}`);
  console.log(`selected skill/job: ${run.skill} / ${run.job}`);
  console.log(`current phase: ${run.phase}`);
  console.log(`completed checkpoints: ${run.checkpoints.filter((item) => item.status === "completed").map((item) => item.name).join(", ") || "none"}`);
  console.log(`next incomplete checkpoint: ${next ? next.name : "none"}`);
  console.log(`permissions granted: ${Array.from(args.allow).sort().join(", ") || "none"}`);
  console.log(`permissions still required: ${run.required_permission && !args.allow.has(run.required_permission) ? run.required_permission : "none"}`);
  console.log(`last verified commit: ${run.last_verified_commit || "none"}`);
  console.log(`stop reason: ${run.stop_reason || "not recorded"}`);
  console.log(`recommended resume command: ${next ? `./scripts/run-next --repo ${run.repo} --resume --dry-run` : "none"}`);
}

function gitBranch(repo) {
  const result = spawnSync("git", ["branch", "--show-current"], { cwd: repo, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function gitHead(repo) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function gitTrackedStatus(repo) {
  const result = spawnSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" });
  if (result.status !== 0) return ["git status unavailable"];
  return result.stdout.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("??"));
}

function die(message) {
  throw new Error(message);
}

module.exports = {
  isNonBlockingResult,
  shouldCompleteCheckpointRun,
  checkpointDirectory,
  repoKey,
  runFilePath,
  checkpointTemplate,
  createCheckpointRun,
  writeCheckpointRun,
  checkpoint,
  startCheckpoint,
  completeCheckpoint,
  stopCheckpointRun,
  finalizeCheckpointRun,
  listCheckpointRuns,
  latestRun,
  nextIncompleteCheckpoint,
  printCheckpointStatus,
  runResume,
  validateResumeRun,
  printResumeReport,
  gitBranch,
  gitHead,
  gitTrackedStatus,
  die,
};
