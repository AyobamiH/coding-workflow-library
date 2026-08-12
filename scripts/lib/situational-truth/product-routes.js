"use strict";

const fs = require("fs");
const path = require("path");

const SIGNALS = [
  { pattern: /capability intelligence/i, label: "capability-intelligence", classification: "PRODUCT_ROUTE_SPLIT_DECISION_REQUIRED" },
  { pattern: /wagging web wins|\bwagging\b/i, label: "wagging", classification: "PRODUCT_ROUTE_PRESENT" },
  { pattern: /oneclickpostfactory|devvit/i, label: "oneclickpostfactory-devvit", classification: "PRODUCT_ROUTE_HOLD" },
  { pattern: /opstruth.*(?:video|hyperframes)|(?:video|hyperframes).*opstruth/i, label: "opstruth-video", classification: "PRODUCT_ROUTE_PRESENT" },
];

function routeSignalText(route) {
  return [
    route.id,
    route.skill_file,
    ...(route.ledger_states_handled || []),
    route.success_ledger_state,
    route.blocked_ledger_state,
    route.provenance,
  ].filter(Boolean).join(" ");
}

function warningFor(id, kind, text) {
  const normalized = String(text || "").replace(/\s+/g, " ");
  const matches = SIGNALS.filter((signal) => signal.pattern.test(normalized));
  if (!matches.length) return null;
  const strongest = matches.find((item) => item.classification === "PRODUCT_ROUTE_SPLIT_DECISION_REQUIRED") || matches[0];
  return {
    id,
    kind,
    classification: strongest.classification,
    signal: strongest.label,
  };
}

function detectProductWarnings(routes, repo) {
  const warnings = [];
  for (const route of routes) {
    const warning = warningFor(route.id || "unknown-route", "route", routeSignalText(route));
    if (warning) warnings.push(warning);
  }

  const skillFiles = [
    "skill-files/capability-intelligence-builder-skill.md",
    "skill-files/opstruth-runtime-truth-skill.md",
  ];
  for (const relative of skillFiles) {
    const file = path.join(repo, relative);
    if (!fs.existsSync(file)) continue;
    const warning = warningFor(relative, "skill", fs.readFileSync(file, "utf8"));
    if (warning) warnings.push(warning);
  }

  return warnings.sort((a, b) => a.id.localeCompare(b.id) || a.kind.localeCompare(b.kind));
}

module.exports = {
  detectProductWarnings,
  routeSignalText,
  warningFor,
};
