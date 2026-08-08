"use strict";

// Product-specific route selection stays outside the generic library roadmap.
// A real target defect can therefore exercise the workflow without pretending
// that it is a new reusable-library foundation.

function selectCapabilityIntelligenceRoute(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "capability intelligence evidence truth and maturity complete locally") {
    return {
      skill: "capability-intelligence-builder-skill",
      permission: null,
      kind: "human-boundary",
      finalStatus: "Capability intelligence evidence truth and maturity complete locally",
      nextPermission: "collect a second independent receipt producer or resolve product-recon draft provenance",
      nextAction: "the current P0 product truth queue is complete; do not invent issuer authentication or distribution work without new evidence",
    };
  }
  if ([
    "unlabelled plugin purpose audit and read-only inspection command complete locally at 5ded92a",
    "capability intelligence inspection surfaces mature locally at 1de53d8",
    "capability intelligence evidence truth and maturity requested",
    "capability intelligence evidence truth and maturity blocked",
  ].includes(normalized)) {
    return {
      skill: "capability-intelligence-builder-skill",
      permission: "capability-intelligence-evidence-truth",
      requiresAuthority: ["local_execution"],
      kind: "capability-intelligence-evidence-truth",
      nextAction: "keep connector cache flags as hints, validate explicit observed receipts, reconcile the product backlog, and stop before publication or capability invocation",
    };
  }
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
