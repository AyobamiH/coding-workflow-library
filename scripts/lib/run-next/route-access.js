"use strict";

const runtime = require("./runtime-context");

function permissionGranted(route) {
  const objectiveAuthority = runtime.get("objectiveAuthority");
  const selectedLane = runtime.get("selectedLane");
  const args = runtime.get("args");
  const objective = selectedLane?.objective || null;
  const result = objectiveAuthority.permissionGrantedForRoute({ route, objective, allow: args.allow });
  route.requiredAuthority = result.requiredAuthority;
  route.permissionSource = result.source;
  return result.granted;
}

function hasSchedulerVaultApplyPermission() {
  const args = runtime.get("args");
  return args.allow.has("scheduler-vault-design-apply") || args.allow.has("scheduler-vault-apply-retry");
}

function canRunNow(route) {
  if (route.kind === "human-boundary" || route.kind === "permission-boundary") return false;
  if (route.kind === "not-implemented") return false;
  return permissionGranted(route);
}

function nextApprovalCommand(route) {
  if (!route.permission) return "";
  return `./scripts/run-next --repo ${runtime.get("targetRepo")} --allow ${route.permission}`;
}

function modeLabel() {
  const args = runtime.get("args");
  if (args.explain || args.explainNext) return "explain";
  if (args.dryRun) return "dry-run";
  return "real";
}

function needsJohn(route) {
  const objectiveAuthority = runtime.get("objectiveAuthority");
  const dryRun = runtime.get("dryRun");
  const requiredAuthority = route.requiredAuthority || objectiveAuthority.routeAuthority(route);
  return {
    finalStatus: `BLOCKED_PERMISSION: ${requiredAuthority} is not granted`,
    ledgerStatus: `BLOCKED_PERMISSION: ${requiredAuthority} is not granted`,
    summary: `${requiredAuthority} is not granted for ${route.permission || route.kind || "selected route"}`,
    nextPermission: `grant ${requiredAuthority} once for this objective`,
    nextSkill: route.skill,
    exitCode: dryRun ? 0 : 2,
  };
}

function stopAtBoundary(route) {
  return {
    finalStatus: route.finalStatus || "NEEDS JOHN",
    ledgerStatus: route.finalStatus || "Needs John",
    summary: route.nextAction,
    nextPermission: route.nextPermission || route.permission || route.nextAction || "manual review",
    nextSkill: route.skill,
    exitCode: 0,
  };
}

function notImplemented(route) {
  const dryRun = runtime.get("dryRun");
  return {
    finalStatus: "NEEDS JOHN",
    ledgerStatus: "Needs John: runner path not implemented",
    summary: `run-next v1 understands this state but does not execute ${route.nextAction} yet`,
    nextPermission: route.permission || "manual routing",
    nextSkill: route.skill,
    exitCode: dryRun ? 0 : 2,
  };
}

function releaseVersionFromObjective(objectiveId) {
  const match = String(objectiveId || "").match(/^release-coding-workflow-library-v(\d+\.\d+\.\d+)$/);
  return match ? match[1] : null;
}

module.exports = {
  canRunNow,
  hasSchedulerVaultApplyPermission,
  modeLabel,
  needsJohn,
  nextApprovalCommand,
  notImplemented,
  permissionGranted,
  releaseVersionFromObjective,
  stopAtBoundary,
};
