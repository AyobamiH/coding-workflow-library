"use strict";

const fs = require("fs");
const path = require("path");
const { collectGitState } = require("./git-state");
const { inspectCheckpoint } = require("./checkpoint-state");
const { finalizeObjective, inspectLaneState } = require("./lane-state");
const { inspectProjectState } = require("./project-state");
const { containsPrivatePath, containsSecretShape, redactText } = require("./privacy");
const { validateSchema } = require("./schema-validation");

const SCHEMA_VERSION = 1;

function contradiction(code, classification, blocking = false) {
  return { code, classification, blocking };
}

function collectContradictions(git, laneState, checkpoint, project) {
  const items = [];
  if (git.upstream.relation === "diverged") items.push(contradiction("git_history_diverged", "BLOCKED_SAFETY", true));
  if (git.worktree.status === "dirty") items.push(contradiction("worktree_dirty", "BLOCKED_SAFETY", true));
  if (laneState.status === "unreadable") items.push(contradiction("lane_state_unreadable", "BLOCKED_SAFETY", true));
  if (laneState.lane && laneState.lane.match_status === "mismatch") items.push(contradiction("lane_repository_mismatch", "BLOCKED_SAFETY", true));
  if (laneState.objective && laneState.objective.freshness.startsWith("STALE")) items.push(contradiction("objective_stale", "BLOCKED_DECISION"));
  if (!["FRESH", "NO_CHECKPOINT"].includes(checkpoint.freshness)) items.push(contradiction("checkpoint_not_at_head", "BLOCKED_SAFETY"));
  if (!checkpoint.permission_consistent) items.push(contradiction("completed_checkpoint_retains_permission", "BLOCKED_SAFETY"));
  for (const issue of project.issues) items.push(contradiction(issue, "BLOCKED_SAFETY", issue.includes("unreadable")));
  if (project.product_route_warnings.some((item) => item.classification === "PRODUCT_ROUTE_SPLIT_DECISION_REQUIRED")) {
    items.push(contradiction("product_route_split_decision", "BLOCKED_DECISION"));
  }
  return items;
}

function nextAction(git, laneState, checkpoint, project) {
  if (!git.is_git_repo) return action("INSPECT_REPOSITORY", "BLOCKED_SAFETY", "target is not a Git repository");
  if (git.worktree.status === "dirty") return action("CLASSIFY_DIRTY_WORKTREE", "BLOCKED_SAFETY", "classify staged, unstaged, and untracked work before changing repository state");
  if (git.upstream.relation === "diverged") return action("RECONCILE_DIVERGED_HISTORY", "BLOCKED_SAFETY", "local and upstream histories diverged; do not force push");
  if (git.upstream.relation === "behind") return action("RECONCILE_REMOTE_ADVANCE", "BLOCKED_SAFETY", `local branch is ${git.upstream.behind} commit(s) behind its upstream`);
  if (laneState.status === "unreadable") return action("REFRESH_LANE_STATE", "BLOCKED_SAFETY", "lane state exists but is unreadable or invalid");
  if (laneState.lane && laneState.lane.match_status === "mismatch") return action("REFRESH_LANE_STATE", "BLOCKED_SAFETY", "selected lane does not match this repository");
  if (git.unpublished_local_commits > 0) {
    return action(
      "PUBLISH_LOCAL_COMMIT_OR_KEEP_LOCAL",
      "BLOCKED_DECISION",
      `${git.head.short_sha} is ${git.unpublished_local_commits} commit(s) ahead of ${git.upstream.ref || "upstream"}`,
    );
  }
  if (laneState.status === "missing" || laneState.status === "not_applicable") {
    return action("REFRESH_LANE_STATE", "BLOCKED_DECISION", "no live lane state was discovered for this repository");
  }
  if (laneState.objective && laneState.objective.freshness.startsWith("STALE")) {
    return action("RECONCILE_STALE_OBJECTIVE", "BLOCKED_DECISION", "replace or close stale objective metadata before autonomous routing");
  }
  if (!["FRESH", "NO_CHECKPOINT"].includes(checkpoint.freshness)) {
    return action("REFRESH_CHECKPOINT_EVIDENCE", "BLOCKED_SAFETY", "latest checkpoint does not verify current HEAD");
  }
  if (project.build_queue.classification === "ACTIVE_REUSABLE_GAP") {
    return action("IMPLEMENT_NEXT_BACKLOG_ITEM", "NONE", project.build_queue.next_action);
  }
  if (project.product_route_warnings.some((item) => item.classification === "PRODUCT_ROUTE_SPLIT_DECISION_REQUIRED")) {
    return action("BLOCKED_DECISION_PRODUCT_ROUTE_SPLIT", "BLOCKED_DECISION", "decide whether separate-product routes remain as adapters or move out of the core package");
  }
  if (project.build_queue.classification === "NO_ACTIVE_REUSABLE_GAP") {
    return action("SELECT_TARGET_REPOSITORY", "BLOCKED_DECISION", "select a target repository objective or record a new evidence-backed reusable gap");
  }
  if (project.build_queue.classification === "NOT_APPLICABLE") {
    const laneStatus = laneState.lane && laneState.lane.status;
    const summary = (laneState.lane && laneState.lane.next_permission) || project.build_queue.next_action;
    if (laneStatus === "hold") return action("OBJECTIVE_HELD", "BLOCKED_DECISION", summary);
    if (laneStatus === "complete" || (laneState.objective && laneState.objective.status === "complete")) {
      return action("NO_ACTIVE_PROJECT_OBJECTIVE", "NONE", summary);
    }
    return action("EXECUTE_SELECTED_PROJECT_OBJECTIVE", "NONE", summary);
  }
  return action("RUN_VALIDATION", "BLOCKED_SAFETY", "queue, route, or ledger evidence is inconsistent");
}

function action(code, classification, summary) {
  return {
    code,
    summary: redactText(summary),
    blocker: {
      classification,
      reason: classification === "NONE" ? null : redactText(summary),
    },
  };
}

function buildReport(options) {
  const repo = path.resolve(options.repo);
  if (!fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) throw new Error("repo path is not a directory");
  const git = collectGitState(repo);
  const laneState = inspectLaneState({ ...options, repo, repository: git.repository });
  const checkpoint = inspectCheckpoint({ ...options, repo }, git);
  finalizeObjective(laneState, git, checkpoint);
  const project = inspectProjectState(options, laneState.lane);
  const contradictions = collectContradictions(git, laneState, checkpoint, project);
  const selectedAction = nextAction(git, laneState, checkpoint, project);

  const report = {
    schema_version: SCHEMA_VERSION,
    status: contradictions.some((item) => item.blocking) ? "FAIL" : contradictions.length || selectedAction.blocker.classification !== "NONE" ? "WARN" : "PASS",
    repo: {
      root: ".",
      name: path.basename(repo),
      repository: git.repository,
    },
    git,
    lane_state: laneState,
    checkpoint,
    routes: project.routes,
    build_queue: project.build_queue,
    product_route_warnings: project.product_route_warnings,
    contradictions,
    privacy: {
      paths_redacted: true,
      secret_values_excluded: true,
      warnings: [],
    },
    next_action: {
      code: selectedAction.code,
      summary: selectedAction.summary,
    },
    blocker: selectedAction.blocker,
  };

  const serialized = JSON.stringify(report);
  if (containsPrivatePath(serialized)) report.privacy.warnings.push("private_absolute_path_detected");
  if (containsSecretShape(serialized)) report.privacy.warnings.push("secret_shaped_value_detected");
  if (report.privacy.warnings.length) report.status = "FAIL";
  return report;
}

function validateReport(report, schema) {
  const errors = validateSchema(report, schema);
  const serialized = JSON.stringify(report);
  if (containsPrivatePath(serialized)) errors.push("$: private path");
  if (containsSecretShape(serialized)) errors.push("$: secret shape");
  return errors;
}

function printHuman(report) {
  console.log("# Situational Truth");
  console.log(`Status: ${report.status}`);
  console.log(`Repository: ${report.repo.repository || report.repo.name}`);
  console.log(`Branch: ${report.git.branch || "unknown"}`);
  console.log(`Worktree: ${report.git.worktree.status} (staged=${report.git.worktree.staged}, unstaged=${report.git.worktree.unstaged}, untracked=${report.git.worktree.untracked})`);
  console.log(`HEAD: ${report.git.head.short_sha || "unknown"}`);
  console.log(`Upstream: ${report.git.upstream.ref || "none"} (${report.git.upstream.relation}; ahead=${report.git.upstream.ahead}, behind=${report.git.upstream.behind})`);
  console.log(`Unpublished local commits: ${report.git.unpublished_local_commits}`);
  console.log(`Latest local tag: ${report.git.release_summary.latest_tag || "none"}`);
  console.log(`Lane state: ${report.lane_state.status} (${report.lane_state.selected_location_class || "none"})`);
  console.log(`Lane: ${report.lane_state.lane ? `${report.lane_state.lane.id} / ${report.lane_state.lane.status}` : "none"}`);
  console.log(`Objective: ${report.lane_state.objective.id || "none"} (${report.lane_state.objective.freshness})`);
  console.log(`Checkpoint: ${report.checkpoint.freshness} (${report.checkpoint.last_verified_commit ? report.checkpoint.last_verified_commit.slice(0, 7) : "none"})`);
  console.log(`Routes: ${report.routes.status}; lane state recognized=${report.routes.lane_state_recognized === null ? "n/a" : report.routes.lane_state_recognized ? "yes" : "no"}`);
  console.log(`Build queue: ${report.build_queue.classification}`);
  console.log(`Product route warnings: ${report.product_route_warnings.length}`);
  for (const warning of report.product_route_warnings) console.log(`- ${warning.classification}: ${warning.id}`);
  console.log(`Privacy warnings: ${report.privacy.warnings.length ? report.privacy.warnings.join(", ") : "none"}`);
  console.log(`Next bounded action: ${report.next_action.code}`);
  console.log(`Reason: ${report.next_action.summary}`);
  console.log(`Blocker classification: ${report.blocker.classification}`);
}

module.exports = {
  SCHEMA_VERSION,
  buildReport,
  collectContradictions,
  nextAction,
  printHuman,
  validateReport,
};
