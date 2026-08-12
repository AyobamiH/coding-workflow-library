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

function inspectProjectState(options, lane) {
  const routeFile = options.routesFile || path.join(options.repo, "routes", "skill-routes.json");
  let routes = [];
  const issues = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(routeFile, "utf8"));
    routes = Array.isArray(parsed) ? parsed : parsed.routes || [];
  } catch {
    issues.push("route_metadata_missing_or_invalid");
  }

  const currentState = lane && lane.current_state;
  const matching = currentState
    ? routes.filter((route) => routeStates(route).includes(currentState)).map((route) => route.id).sort()
    : [];
  const ledgerFile = options.ledgerFile || path.join(options.repo, "work-ledger.md");
  let ledgerRecognized = null;
  if (currentState) {
    try {
      ledgerRecognized = fs.readFileSync(ledgerFile, "utf8").includes(currentState);
    } catch {
      ledgerRecognized = false;
    }
  }
  if (currentState && !matching.length) issues.push("lane_state_not_recognized_by_routes");
  if (currentState && ledgerRecognized === false) issues.push("lane_state_not_present_in_public_ledger");

  let queue;
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

  const productWarnings = detectProductWarnings(routes, options.repo);
  return {
    routes: {
      status: issues.some((item) => item.startsWith("route_")) ? "FAIL" : productWarnings.length ? "WARN" : "PASS",
      count: routes.length,
      lane_state_recognized: currentState ? matching.length > 0 : null,
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
  routeStates,
};
