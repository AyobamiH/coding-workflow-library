"use strict";

// Product-specific route selection stays outside the generic library roadmap.
// A real target defect can therefore exercise the workflow without pretending
// that it is a new reusable-library foundation.

function selectCapabilityIntelligenceRoute(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "capability intelligence cli input truth hardening complete locally") {
    return {
      skill: "capability-intelligence-builder-skill",
      permission: null,
      kind: "human-boundary",
      finalStatus: "Capability intelligence CLI input truth hardening complete locally",
      nextPermission: "review export overwrite safety or select another evidence-backed product objective",
      nextAction: "CLI input truth is locally proven; select the next bounded product defect rather than rerunning completed work",
    };
  }
  if ([
    "capability intelligence cli input truth hardening requested",
    "capability intelligence cli input truth hardening blocked",
  ].includes(normalized)) {
    return {
      skill: "capability-intelligence-builder-skill",
      permission: "capability-intelligence-cli-input-truth",
      requiresAuthority: ["local_execution"],
      kind: "capability-intelligence-cli-input-truth",
      nextAction: "reject unsupported options and invalid risk levels before scanning, then stop before publication",
    };
  }
  if (normalized === "capability intelligence outcome search truth hardening complete locally") {
    return {
      skill: "capability-intelligence-builder-skill",
      permission: null,
      kind: "human-boundary",
      finalStatus: "Capability intelligence outcome search truth hardening complete locally",
      nextPermission: "review CLI input validation defects or select another evidence-backed product objective",
      nextAction: "search truth is locally proven; select the next bounded product defect rather than rerunning completed work",
    };
  }
  if (![
    "capability intelligence outcome search truth hardening requested",
    "capability intelligence outcome search truth hardening blocked",
  ].includes(normalized)) return null;

  return {
    skill: "capability-intelligence-builder-skill",
    permission: "capability-intelligence-search-truth",
    requiresAuthority: ["local_execution"],
    kind: "capability-intelligence-search-truth",
    nextAction: "require a positive outcome match before readiness ranking, prove no-match behaviour, and stop before publication",
  };
}

module.exports = {
  selectCapabilityIntelligenceRoute,
};
