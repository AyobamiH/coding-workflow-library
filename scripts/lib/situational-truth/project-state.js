"use strict";

const fs = require("fs");
const path = require("path");
const nextObjective = require("../../library-next-objective");
const { detectProductWarnings } = require("./product-routes");
const { redactText } = require("./privacy");

function routeStates(route) {
  return [
    ...(route.ledger_states_handled || []),
    ...(route.retry_ledger_states || []),
    ...(route.success_ledger_states || []),
    route.success_ledger_state,
    route.blocked_ledger_state,
  ].filter(Boolean);
}

function isTerminalLane(lane) {
  return Boolean(lane && ["complete", "hold"].includes(lane.status));
}

function inspectProjectState(options, lane) {
  const routeFile = options.routesFile || path.join(options.repo, "routes", "skill-routes.json");
  let routes = [];
  const issues = [];
  const routeFileExists = fs.existsSync(routeFile);
  if (routeFileExists) {
    try {
      const parsed = JSON.parse(fs.readFileSync(routeFile, "utf8"));
      routes = Array.isArray(parsed) ? parsed : parsed.routes || [];
    } catch {
      issues.push("route_metadata_invalid");
    }
  }

  const currentState = lane && lane.current_state;
  const terminalLane = isTerminalLane(lane);
  const matching = currentState
    ? routes.filter((route) => routeStates(route).includes(currentState)).map((route) => route.id).sort()
    : [];
  const ledgerFile = options.ledgerFile || path.join(options.repo, "work-ledger.md");
  let ledgerRecognized = null;
  const ledgerFileExists = fs.existsSync(ledgerFile);
  if (currentState && ledgerFileExists) {
    try {
      ledgerRecognized = fs.readFileSync(ledgerFile, "utf8").includes(currentState);
    } catch {
      issues.push("public_ledger_unreadable");
    }
  }
  if (currentState && routeFileExists && !matching.length && !terminalLane) issues.push("lane_state_not_recognized_by_routes");
  if (currentState && ledgerRecognized === false && !terminalLane) issues.push("lane_state_not_present_in_public_ledger");

  let queue;
  const queueFile = path.join(options.repo, "build-queue.md");
  if (!fs.existsSync(queueFile)) {
    queue = {
      status: "NOT_APPLICABLE",
      classification: "NOT_APPLICABLE",
      active_gaps: [],
      next_action: redactText((lane && lane.next_permission) || "use the selected project lane and its documented backlog"),
    };
  } else {
    try {
      const report = nextObjective.buildReport(options.repo);
      queue = {
        status: report.status,
        classification: report.classification,
        active_gaps: report.active_gaps.map((gap) => ({
          title: redactText(gap.title),
          status: redactText(gap.status),
        })),
        next_action: redactText(report.next_action),
      };
    } catch {
      queue = {
        status: "FAIL",
        classification: "EVIDENCE_INCONSISTENT",
        active_gaps: [],
        next_action: "repair queue evidence",
      };
      issues.push("build_queue_unreadable");
    }
  }

  const productWarnings = detectProductWarnings(routes, options.repo);
  const routeStatus = issues.includes("route_metadata_invalid")
    ? "FAIL"
    : !routeFileExists
      ? "NOT_APPLICABLE"
      : productWarnings.length
        ? "WARN"
        : "PASS";
  return {
    routes: {
      status: routeStatus,
      count: routes.length,
      lane_state_recognized: currentState && routeFileExists ? matching.length > 0 || terminalLane : null,
      matching_route_ids: matching,
      ledger_state_present: ledgerRecognized,
    },
    build_queue: queue,
    product_route_warnings: productWarnings,
    issues,
  };
}

module.exports = {
  inspectProjectState,
  isTerminalLane,
  routeStates,
};
