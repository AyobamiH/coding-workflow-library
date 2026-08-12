"use strict";

const path = require("path");
const laneState = require("../../lane-state");
const { discoverLaneState, publicCandidates } = require("../lane-state-discovery");
const { redactText } = require("./privacy");

function sameRepository(left, right) {
  return Boolean(left && right && String(left).replace(/\.git$/, "").toLowerCase() === String(right).replace(/\.git$/, "").toLowerCase());
}

function findLane(state, options) {
  if (options.laneId) return state.lanes.find((lane) => lane.lane_id === options.laneId) || null;
  const byPath = state.lanes.find((lane) => lane.repo_path && path.resolve(lane.repo_path) === options.repo);
  if (byPath) return byPath;
  return state.lanes.find((lane) => sameRepository(lane.repository, options.repository)) || null;
}

function laneMatches(lane, options) {
  if (!lane) return "missing";
  const pathMatch = Boolean(lane.repo_path && path.resolve(lane.repo_path) === options.repo);
  const repositoryMatch = sameRepository(lane.repository, options.repository);
  return pathMatch || repositoryMatch ? "matched" : "mismatch";
}

const OBJECTIVE_STOP_WORDS = new Set(["coding", "current", "library", "objective", "project", "release", "workflow"]);

function comparableTokens(value) {
  return new Set(String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !OBJECTIVE_STOP_WORDS.has(token)));
}

function objectiveMatchesHead(objectiveId, headSubject) {
  const objectiveTokens = comparableTokens(objectiveId);
  const headTokens = comparableTokens(headSubject);
  if (!objectiveTokens.size || !headTokens.size) return null;
  return [...objectiveTokens].some((token) => headTokens.has(token));
}

function objectiveFreshness(objective, git, checkpoint) {
  if (!objective) return { classification: "NO_OBJECTIVE", authority_stale: false, reasons: [] };
  const reasons = [];
  const terminal = objective.status === "complete";
  const active = ["active", "blocked", "waiting"].includes(objective.status);
  const granted = Object.entries(objective.authority || {}).filter(([, value]) => value === true).map(([key]) => key).sort();
  const updated = Date.parse(objective.updated_at || "");
  const committed = Date.parse(git.head.committed_at || "");
  const headNewer = Number.isFinite(updated) && Number.isFinite(committed) && committed > updated;

  if (terminal && granted.length) reasons.push("terminal_objective_retains_authority");
  if (headNewer) reasons.push("head_commit_is_newer_than_objective");
  if (headNewer && objectiveMatchesHead(objective.id, git.head.subject) === false) reasons.push("objective_id_does_not_match_newer_head");
  const objectiveMarkers = String(objective.id || "").match(/(?:v?\d+(?:[.-]\d+){1,2}|\d{4}-\d{2}(?:-\d{2})?)/gi) || [];
  if (headNewer && objectiveMarkers.length && !objectiveMarkers.some((marker) => String(git.head.subject || "").includes(marker))) {
    reasons.push("objective_release_or_date_marker_does_not_match_head");
  }
  if (checkpoint && checkpoint.freshness === "ANCESTOR_OF_HEAD") reasons.push("checkpoint_predates_head");
  if (checkpoint && checkpoint.freshness === "MISSING_COMMIT") reasons.push("checkpoint_commit_missing");

  const authorityStale = terminal && granted.length > 0;
  let classification = "UNKNOWN";
  if (authorityStale) classification = "STALE_AUTHORITY";
  else if (terminal && (headNewer || reasons.length)) classification = "STALE_TERMINAL";
  else if (active && (headNewer || reasons.length)) classification = "STALE_ACTIVE";
  else if (terminal) classification = "TERMINAL_FRESH";
  else if (active) classification = "ACTIVE_FRESH";

  return { classification, authority_stale: authorityStale, reasons };
}

function inspectLaneState(options) {
  const discovery = discoverLaneState(options);
  const result = {
    status: discovery.status,
    selected_location_class: discovery.selected ? discovery.selected.location_class : null,
    candidates: publicCandidates(discovery),
    lane: null,
    objective: null,
    issues: [],
    _objective: null,
  };
  if (!discovery.selected || !discovery.selected.live) return result;

  let state;
  try {
    state = laneState.readState(discovery.selected.file);
  } catch {
    result.status = "unreadable";
    result.issues.push("lane_state_invalid_or_unreadable");
    return result;
  }

  const lane = findLane(state, options);
  const matchStatus = laneMatches(lane, options);
  if (!lane) {
    result.status = "stale";
    result.issues.push("repository_lane_not_found");
    return result;
  }
  if (matchStatus === "mismatch") {
    result.status = "stale";
    result.issues.push("selected_lane_repository_mismatch");
  }

  result.lane = {
    id: lane.lane_id,
    status: lane.status,
    current_state: redactText(lane.current_state),
    next_permission: redactText(lane.next_permission),
    last_updated: lane.last_updated,
    match_status: matchStatus,
  };
  result._objective = lane.objective || null;
  return result;
}

function finalizeObjective(result, git, checkpoint) {
  const objective = result._objective;
  delete result._objective;
  if (!objective) {
    result.objective = {
      id: null,
      status: null,
      freshness: "NO_OBJECTIVE",
      authority: null,
      granted_authorities: [],
      authority_stale: false,
      reasons: [],
      blockers: [],
    };
    return result;
  }

  const fresh = objectiveFreshness(objective, git, checkpoint);
  const authority = Object.fromEntries(Object.entries(objective.authority || {}).sort(([a], [b]) => a.localeCompare(b)));
  result.objective = {
    id: objective.id,
    status: objective.status,
    freshness: fresh.classification,
    authority,
    granted_authorities: Object.entries(authority).filter(([, value]) => value === true).map(([key]) => key),
    authority_stale: fresh.authority_stale,
    reasons: fresh.reasons,
    blockers: (objective.blockers || []).map((blocker) => ({
      state: blocker.state,
      reason: redactText(blocker.reason || ""),
      stage: redactText(blocker.stage || "unspecified"),
    })),
  };
  if (fresh.classification.startsWith("STALE")) result.status = "stale";
  return result;
}

module.exports = {
  finalizeObjective,
  findLane,
  inspectLaneState,
  laneMatches,
  objectiveMatchesHead,
  objectiveFreshness,
  sameRepository,
};
