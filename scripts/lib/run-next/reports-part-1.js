"use strict";

// General, Supabase deployment, runtime, and zero-output report renderers.

const runtime = require("./runtime-context");
const { objectiveAuthority, SCHEDULER_VAULT_SECRET_NAME, targetRepo, dryRun, selectedLane, evidence, actions } = runtime.pick(["objectiveAuthority","SCHEDULER_VAULT_SECRET_NAME","targetRepo","dryRun","selectedLane","evidence","actions"]);
const canRunNow = runtime.lazy("canRunNow");
const nextApprovalCommand = runtime.lazy("nextApprovalCommand");
const modeLabel = runtime.lazy("modeLabel");
const flattenExecutionCommands = runtime.lazy("flattenExecutionCommands");
const summarizeCommits = runtime.lazy("summarizeCommits");
const run = runtime.lazy("run");
const firstLine = runtime.lazy("firstLine");

// Cross-part calls stay late-bound so the run-next registry remains cycle-safe.
const printDeploymentPlanningReport = runtime.lazy("printDeploymentPlanningReport");
const printObservabilityRunRecheckReport = runtime.lazy("printObservabilityRunRecheckReport");
const printScheduledRunMonitoringHandoffReport = runtime.lazy("printScheduledRunMonitoringHandoffReport");
const printSchedulerApplicationDecisionReport = runtime.lazy("printSchedulerApplicationDecisionReport");
const printSchedulerVaultDesignApplyReport = runtime.lazy("printSchedulerVaultDesignApplyReport");
const printSupabasePreflightReport = runtime.lazy("printSupabasePreflightReport");
const printSupabaseToolingAuthReport = runtime.lazy("printSupabaseToolingAuthReport");

function printReport(result, active, route) {
  if (result.zeroOutputInvestigation) {
    printZeroOutputInvestigationReport(result, active, route);
    return;
  }
  if (result.schedulerDraftPr) {
    printSchedulerDraftPrReport(result, active, route);
    return;
  }

  if (result.supabaseLinkSecretReadiness) {
    printSupabaseLinkSecretReadinessReport(result, active, route);
    return;
  }

  if (result.supabaseSecretFunctionDeploy) {
    printSupabaseSecretFunctionDeployReport(result, active, route);
    return;
  }

  if (result.runtimeNegativeVerification) {
    printRuntimeNegativeVerificationReport(result, active, route);
    return;
  }

  if (result.functionSecretDeployNegativeRuntime) {
    printFunctionSecretDeployNegativeRuntimeReport(result, active, route);
    return;
  }

  if (result.controlledSuccessInvocation) {
    printControlledSuccessInvocationReport(result, active, route);
    return;
  }

  if (result.scheduledRunMonitoringHandoff) {
    printScheduledRunMonitoringHandoffReport(result, active, route);
    return;
  }

  if (result.observabilityRunRecheck) {
    printObservabilityRunRecheckReport(result, active, route);
    return;
  }

  if (result.schedulerVaultDesignApply) {
    printSchedulerVaultDesignApplyReport(result, active, route);
    return;
  }

  if (result.schedulerApplicationDecision) {
    printSchedulerApplicationDecisionReport(result, active, route);
    return;
  }

  if (result.supabaseToolingAuth) {
    printSupabaseToolingAuthReport(result, active, route);
    return;
  }

  if (result.supabasePreflight) {
    printSupabasePreflightReport(result, active, route);
    return;
  }

  if (result.deploymentPlan) {
    printDeploymentPlanningReport(result, active, route);
    return;
  }

  console.log("# run-next report");
  console.log("");
  console.log(`Mode: ${modeLabel()}`);
  console.log(`Target repo: ${targetRepo}`);
  console.log(`Ledger item: ${active.heading || "unknown"}`);
  console.log(`Current status: ${active.currentStatus || "unknown"}`);
  console.log(`Selected skill: ${route.skill || "unknown"}`);
  console.log(`Required authority: ${route.requiredAuthority || objectiveAuthority.routeAuthority(route) || "none"}`);
  console.log(`Legacy allow flag: ${route.permission || "none"}`);
  console.log(`Can run now: ${canRunNow(route) ? "yes" : "no"}`);
  console.log(`Final status: ${result.finalStatus}`);
  console.log(`Summary: ${result.summary}`);
  if (!canRunNow(route)) console.log(`Stopped because: ${result.summary || route.nextAction || "permission boundary"}`);
  if (!canRunNow(route) && nextApprovalCommand(route)) console.log(`Next approval command: ${nextApprovalCommand(route)}`);
  if (result.branch) console.log(`Branch: ${result.branch}`);
  if (result.prUrl) console.log(`PR URL: ${result.prUrl}`);
  if (result.autoDeploy) {
    console.log(`Auto-deploy source check: ${result.autoDeploy.summary}`);
    console.log(`Auto-deploy caveat: ${result.autoDeploy.caveat}`);
    if (result.autoDeploy.blockingFiles && result.autoDeploy.blockingFiles.length) {
      console.log(`Auto-deploy blocking files: ${result.autoDeploy.blockingFiles.join(", ")}`);
    }
  }
  if (result.prMetadata) {
    console.log(`PR title: ${result.prMetadata.title || "unknown"}`);
    console.log(`PR state: ${result.prMetadata.state || "unknown"}`);
    console.log(`PR base/head: ${result.prMetadata.baseRefName || "unknown"}/${result.prMetadata.headRefName || "unknown"}`);
    console.log(`PR mergeable: ${result.prMetadata.mergeable || "unavailable"}`);
    console.log(`PR review decision: ${result.prMetadata.reviewDecision || "unavailable"}`);
  }
  if (result.finalPrMetadata) {
    console.log(`PR final state: ${result.finalPrMetadata.state || "unknown"}`);
    console.log(`PR merged at: ${result.finalPrMetadata.mergedAt || "unavailable"}`);
    console.log(`PR final base/head: ${result.finalPrMetadata.baseRefName || "unknown"}/${result.finalPrMetadata.headRefName || "unknown"}`);
  }
  if (result.checks) console.log(`PR checks: ${result.checks.summary}`);
  if (result.changedFiles) console.log(`Changed files: ${result.changedFiles.join(", ") || "none"}`);
  if (result.unexpectedFiles) console.log(`Unexpected files: ${result.unexpectedFiles.join(", ") || "none"}`);
  if (result.missingFiles) console.log(`Missing intended files: ${result.missingFiles.join(", ") || "none"}`);
  if (result.commits) console.log(`Commits: ${summarizeCommits(result.commits)}`);
  if (result.localState) {
    console.log(`Local branch: ${result.localState.branch}`);
    console.log(`Local status: ${result.localState.status}`);
    console.log(`Local recent log: ${firstLine(result.localState.log)}`);
  }
  if (result.nextPermission) console.log(`Next permission: ${result.nextPermission}`);
  console.log("");
  console.log("Actions:");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

function printSchedulerDraftPrReport(result, active, route) {
  const draft = result.schedulerDraftPr;
  console.log("# Scheduler Migration Draft + PR Report");
  console.log("");
  console.log("## Current Ledger State");
  console.log(`Mode: ${modeLabel()}`);
  console.log(`Target repo: ${targetRepo}`);
  console.log(`Ledger item: ${active.heading || "unknown"}`);
  console.log(`Current status: ${active.currentStatus || "unknown"}`);
  console.log(`Selected skill: ${route.skill || "unknown"}`);
  console.log(`Required permission: ${route.permission || "none"}`);
  console.log("");
  console.log("## Branch Result");
  console.log(draft.branchResult);
  console.log("");
  console.log("## Scheduler Evidence");
  console.log(draft.schedulerEvidence);
  console.log("");
  console.log("## Migration Draft");
  console.log(draft.migrationPath);
  console.log("");
  console.log("## Migration Safety Decision");
  console.log(draft.safetyDecision);
  console.log("");
  console.log("## Local Checks");
  console.log(draft.localChecks);
  console.log("");
  console.log("## Commit Result");
  console.log(draft.commitResult);
  console.log("");
  console.log("## Push Result");
  console.log(draft.pushResult);
  console.log("");
  console.log("## PR Result");
  console.log(draft.prResult);
  if (draft.prUrl) console.log(`PR URL: ${draft.prUrl}`);
  console.log("");
  console.log("## Files Included");
  for (const file of draft.includedFiles || []) console.log(`- ${file}`);
  if (!draft.includedFiles || !draft.includedFiles.length) console.log("- none");
  console.log("");
  console.log("## Files Excluded");
  for (const file of draft.excludedFiles || []) console.log(`- ${file}`);
  console.log("");
  console.log("## Commands Not Run");
  for (const command of draft.commandsNotRun || []) console.log(`- ${command}`);
  console.log("");
  console.log("## Final Status");
  console.log(result.finalStatus);
  console.log("");
  console.log("## Ledger Update");
  console.log(dryRun ? "Dry-run only; ledger not updated." : (result.ledgerStatus || result.finalStatus));
  console.log("");
  console.log("## Run Log Update");
  console.log(dryRun ? "Dry-run/explain only; run log not updated." : "Run entry appended.");
  console.log("");
  console.log("## Next Permission Needed From John");
  console.log(result.nextPermission || "hold");
  console.log("");
  console.log("Actions:");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

function printSupabaseLinkSecretReadinessReport(result, active, route) {
  const readiness = result.supabaseLinkSecretReadiness;
  console.log("# Supabase Link + Secret Readiness Report");
  console.log("");
  console.log("## Current Ledger State");
  console.log(`Mode: ${modeLabel()}`);
  console.log(`Target repo: ${targetRepo}`);
  console.log(`Ledger item: ${active.heading || "unknown"}`);
  console.log(`Current status: ${active.currentStatus || "unknown"}`);
  console.log(`Selected skill: ${route.skill || "unknown"}`);
  console.log(`Required permission: ${route.permission || "none"}`);
  console.log("");
  console.log("## Target Repo State");
  if (readiness.targetRepoState) {
    console.log(`Branch: ${readiness.targetRepoState.branch}`);
    console.log(`Git status: ${readiness.targetRepoState.status}`);
    console.log(`Recent log: ${firstLine(readiness.targetRepoState.recentLog)}`);
  } else {
    console.log("Dry-run: repo state would be inspected.");
  }
  console.log("");
  console.log("## Supabase Auth Result");
  console.log(readiness.authResult);
  console.log("");
  console.log("## Link Result");
  console.log(readiness.linkResult);
  console.log("");
  console.log("## Local Files Changed By Link");
  console.log(readiness.localFilesChangedByLink);
  console.log("");
  console.log("## Local Secret Readiness");
  console.log(readiness.localSecretReadiness);
  console.log("");
  console.log("## Commands Run");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("## Commands Not Run");
  for (const command of readiness.commandsNotRun) console.log(`- ${command}`);
  console.log("");
  console.log("## Final Status");
  console.log(result.finalStatus);
  console.log("");
  console.log("## Ledger Update");
  console.log(dryRun ? "Dry-run only; ledger not updated." : (result.ledgerStatus || result.finalStatus));
  console.log("");
  console.log("## Run Log Update");
  console.log(dryRun ? "Dry-run/explain only; run log not updated." : "Run entry appended.");
  console.log("");
  console.log("## Next Permission Needed From John");
  console.log(result.nextPermission || readiness.nextPermission || "hold");
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

function printSupabaseSecretFunctionDeployReport(result, active, route) {
  const deploy = result.supabaseSecretFunctionDeploy;
  console.log("# Supabase Remote Secret + Function Deploy Report");
  console.log("");
  console.log("## Current Ledger State");
  console.log(`Mode: ${modeLabel()}`);
  console.log(`Target repo: ${targetRepo}`);
  console.log(`Ledger item: ${active.heading || "unknown"}`);
  console.log(`Current status: ${active.currentStatus || "unknown"}`);
  console.log(`Selected skill: ${route.skill || "unknown"}`);
  console.log(`Required permission: ${route.permission || "none"}`);
  console.log("");
  console.log("## Repo State");
  if (deploy.targetRepoState) {
    console.log(`Branch: ${deploy.targetRepoState.branch}`);
    console.log(`Git status: ${deploy.targetRepoState.status}`);
    console.log(`Recent log: ${firstLine(deploy.targetRepoState.recentLog)}`);
  } else {
    console.log("Dry-run: repo state would be inspected.");
  }
  console.log("");
  console.log("## Source Boundary");
  if (deploy.sourceBoundary) {
    console.log(`Function source: ${deploy.sourceBoundary.functionSource}`);
    console.log(`Terms present: ${deploy.sourceBoundary.hardenedTermsPresent.join(", ") || "none"}`);
    console.log(`Terms missing: ${deploy.sourceBoundary.hardenedTermsMissing.join(", ") || "none"}`);
    console.log(`Evidence: ${deploy.sourceBoundary.grepSummary}`);
  } else {
    console.log("Dry-run: function source would be inspected.");
  }
  console.log("");
  console.log("## Env Presence");
  console.log(deploy.envPresence);
  console.log("");
  console.log("## Supabase Auth Result");
  console.log(deploy.supabaseAuthResult);
  console.log("");
  console.log("## Supabase CLI Result");
  console.log(deploy.supabaseCliResult);
  console.log("");
  console.log("## Secret Setup Result");
  console.log(deploy.secretSetupResult);
  console.log("");
  console.log("## Temporary Secret File Handling");
  console.log(deploy.tempSecretFileHandling);
  console.log("");
  console.log("## Function Deploy Result");
  console.log(deploy.functionDeployResult);
  console.log("");
  console.log("## Commands Not Run");
  for (const command of deploy.commandsNotRun) console.log(`- ${command}`);
  console.log("");
  console.log("## Final Status");
  console.log(result.finalStatus);
  console.log("");
  console.log("## Ledger Update");
  console.log(dryRun ? "Dry-run only; ledger not updated." : (result.ledgerStatus || result.finalStatus));
  console.log("");
  console.log("## Run Log Update");
  console.log(dryRun ? "Dry-run/explain only; run log not updated." : "Run entry appended.");
  console.log("");
  console.log("## Next Permission Needed From John");
  console.log(result.nextPermission || deploy.nextPermission || "hold");
  console.log("");
  console.log("Actions:");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

function printRuntimeNegativeVerificationReport(result, active, route) {
  const runtime = result.runtimeNegativeVerification;
  console.log("# Runtime Negative Verification Report");
  console.log("");
  console.log("## Files Read");
  console.log("- AGENTS.md");
  console.log("- RUNBOOK.md");
  console.log("- tools.md");
  console.log("- work-ledger.md");
  console.log("- scripts/run-next");
  if (runtime.sourceBoundary) console.log(`- ${runtime.sourceBoundary.functionSource}`);
  console.log("");
  console.log("## Files Updated");
  if (dryRun) console.log("- none; dry-run only");
  else if (selectedLane) console.log(`- local lane state only: ${selectedLane.lane_id}`);
  else {
    console.log("- work-ledger.md");
    console.log("- runs/skill-runs.md");
  }
  console.log("");
  console.log("## Runner Update");
  console.log(`Mode: ${modeLabel()}`);
  console.log(`Selected skill: ${route.skill || "unknown"}`);
  console.log(`Required permission: ${route.permission || "none"}`);
  console.log(`Final status: ${result.finalStatus}`);
  console.log("");
  console.log("## Local Repo State");
  if (runtime.targetRepoState) {
    console.log(`Branch: ${runtime.targetRepoState.branch}`);
    console.log(`Git status: ${runtime.targetRepoState.status}`);
    console.log(`Recent log: ${firstLine(runtime.targetRepoState.recentLog)}`);
  } else {
    console.log("Dry-run: repo state would be inspected.");
  }
  console.log("");
  console.log("## Endpoint Checked");
  console.log(runtime.endpoint);
  console.log("");
  console.log("## Source Auth-Boundary Evidence");
  if (runtime.sourceBoundary) {
    console.log(`Terms present: ${runtime.sourceBoundary.termsPresent.join(", ") || "none"}`);
    console.log(`Terms missing: ${runtime.sourceBoundary.termsMissing.join(", ") || "none"}`);
    console.log(`Evidence: ${runtime.sourceBoundary.grepSummary}`);
  } else {
    console.log("Dry-run: source would be inspected.");
  }
  console.log("");
  console.log("## OPTIONS Result");
  console.log(runtime.options);
  console.log("");
  console.log("## GET/Non-POST Result");
  console.log(runtime.get);
  console.log("");
  console.log("## POST Without Auth Result");
  console.log(runtime.postNoAuth);
  console.log("");
  console.log("## Invalid Scheduler Secret Result");
  console.log(runtime.invalidSchedulerSecret);
  console.log("");
  console.log("## Anon-Only Result");
  console.log(runtime.anonOnly);
  console.log("");
  console.log("## Secret Exposure Check");
  console.log(runtime.secretExposure);
  console.log("");
  console.log("## Commands Not Run");
  for (const command of runtime.commandsNotRun) console.log(`- ${command}`);
  console.log("");
  console.log("## Ledger Update");
  console.log(dryRun ? "Dry-run only; no state updated." : selectedLane ? `Selected lane updated: ${selectedLane.lane_id}` : (result.ledgerStatus || result.finalStatus));
  console.log("");
  console.log("## Run Log Update");
  console.log(dryRun ? "Dry-run/explain only; run log not updated." : selectedLane ? "Public run log not updated; product runtime evidence remains local." : "Run entry appended.");
  console.log("");
  console.log("## Next Permission Needed From John");
  console.log(result.nextPermission || runtime.nextPermission || "hold");
  console.log("");
  console.log("Actions:");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

function printFunctionSecretDeployNegativeRuntimeReport(result, active, route) {
  const report = result.functionSecretDeployNegativeRuntime;
  console.log("# Function Secret + Deploy + Negative Runtime Report");
  console.log("");
  console.log("## Files Read");
  console.log("- AGENTS.md");
  console.log("- RUNBOOK.md");
  console.log("- tools.md");
  console.log("- work-ledger.md");
  console.log("- scripts/run-next");
  console.log("- skill-files/coding-workflow-orchestrator-skill.md");
  console.log("- skill-files/supabase-rls-audit-skill.md");
  console.log("- skill-files/security-hardening-review-skill.md");
  console.log("- skill-files/build-verify-skill.md");
  if (report.sourceBoundary.deploySource) console.log(`- ${report.sourceBoundary.deploySource.functionSource}`);
  console.log("");
  console.log("## Files Updated");
  console.log(dryRun ? "- none; dry-run only" : "- scripts/run-next");
  console.log(dryRun ? "- none; dry-run only" : "- work-ledger.md");
  console.log(dryRun ? "- none; dry-run only" : "- runs/skill-runs.md");
  console.log("");
  console.log("## Runner Update");
  console.log(`Mode: ${modeLabel()}`);
  console.log(`Selected skill: ${route.skill || "unknown"}`);
  console.log(`Required permission: ${route.permission || "none"}`);
  console.log(`Final status: ${result.finalStatus}`);
  console.log("");
  console.log("## Repo State");
  if (report.targetRepoState) {
    console.log(`Branch: ${report.targetRepoState.branch}`);
    console.log(`Git status: ${report.targetRepoState.status}`);
    console.log(`Recent log: ${firstLine(report.targetRepoState.recentLog)}`);
  } else {
    console.log("Dry-run or blocked before repo state was collected.");
  }
  console.log("");
  console.log("## Function Source Decision");
  if (report.sourceBoundary.deploySource) {
    console.log(`Hardened terms present: ${report.sourceBoundary.deploySource.hardenedTermsPresent.join(", ") || "none"}`);
    console.log(`Hardened terms missing: ${report.sourceBoundary.deploySource.hardenedTermsMissing.join(", ") || "none"}`);
    console.log(`Runtime terms present: ${report.sourceBoundary.runtimeSource ? report.sourceBoundary.runtimeSource.termsPresent.join(", ") : "not checked"}`);
    console.log(`Dry-run/no-write: ${report.sourceBoundary.dryRunDecision.summary}`);
    console.log(`Evidence: ${report.sourceBoundary.dryRunDecision.grepSummary}`);
  } else {
    console.log("Dry-run or blocked before source inspection completed.");
  }
  console.log("");
  console.log("## Env Presence");
  console.log(report.envPresence);
  console.log("");
  console.log("## Supabase Auth Result");
  console.log(`CLI: ${report.supabaseCliResult}`);
  console.log(`Project access: ${report.supabaseAuthResult}`);
  console.log("");
  console.log("## Remote Secret Setup Result");
  console.log(report.secretSetupResult);
  console.log("");
  console.log("## Temporary Secret File Handling");
  console.log(report.tempSecretFileHandling);
  console.log("");
  console.log("## Function Deploy Result");
  console.log(report.functionDeployResult);
  console.log("");
  console.log("## Runtime Checks Run");
  console.log(`Endpoint: ${report.endpoint}`);
  console.log("- OPTIONS");
  console.log("- GET/non-POST");
  console.log("- POST without auth");
  console.log("- POST invalid scheduler secret");
  console.log("- POST anon-only when anon key is locally available");
  console.log("");
  console.log("## Runtime Checks Result");
  console.log(`OPTIONS: ${report.options}`);
  console.log(`GET/non-POST: ${report.get}`);
  console.log(`POST without auth: ${report.postNoAuth}`);
  console.log(`Invalid scheduler secret: ${report.invalidSchedulerSecret}`);
  console.log(`Anon-only: ${report.anonOnly}`);
  console.log(`Runtime response secret exposure: ${report.runtimeSecretExposure}`);
  console.log("");
  console.log("## Success Path Decision");
  console.log(report.successPathDecision);
  console.log("");
  console.log("## Commands Not Run");
  for (const command of report.commandsNotRun) console.log(`- ${command}`);
  console.log("");
  console.log("## Secret Exposure Check");
  console.log(report.secretExposureCheck);
  console.log("");
  console.log("## Ledger Update");
  console.log(dryRun ? "Dry-run only; ledger not updated." : (result.ledgerStatus || result.finalStatus));
  console.log("");
  console.log("## Run Log Update");
  console.log(dryRun ? "Dry-run/explain only; run log not updated." : "Run entry appended.");
  console.log("");
  console.log("## Validation Result");
  console.log("Validation runs after this report are handled by the calling workflow.");
  console.log("");
  console.log("## Next Permission Needed From John");
  console.log(result.nextPermission || report.nextPermission || "hold");
  console.log("");
  console.log("Actions:");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

function printControlledSuccessInvocationReport(result, active, route) {
  const report = result.controlledSuccessInvocation;
  console.log("# Controlled Success Invocation Report");
  console.log("");
  console.log("## Files Read");
  console.log("- AGENTS.md");
  console.log("- RUNBOOK.md");
  console.log("- tools.md");
  console.log("- work-ledger.md");
  console.log("- scripts/run-next");
  console.log("- skill-files/coding-workflow-orchestrator-skill.md");
  console.log("- skill-files/supabase-rls-audit-skill.md");
  console.log("- skill-files/security-hardening-review-skill.md");
  console.log("- skill-files/build-verify-skill.md");
  console.log("");
  console.log("## Files Updated");
  console.log(dryRun ? "- none; dry-run only" : "- scripts/run-next");
  console.log(dryRun ? "- none; dry-run only" : "- work-ledger.md");
  console.log(dryRun ? "- none; dry-run only" : "- runs/skill-runs.md");
  console.log("");
  console.log("## Runner Update");
  console.log(`Mode: ${modeLabel()}`);
  console.log(`Selected skill: ${route.skill || "unknown"}`);
  console.log(`Required permission: ${route.permission || "none"}`);
  console.log(`Final status: ${result.finalStatus}`);
  console.log("");
  console.log("## Repo State");
  if (report.targetRepoState) {
    console.log(`Branch: ${report.targetRepoState.branch}`);
    console.log(`Git status: ${report.targetRepoState.status}`);
    console.log(`Recent log: ${firstLine(report.targetRepoState.recentLog)}`);
  } else {
    console.log("Dry-run or blocked before repo state was collected.");
  }
  console.log("");
  console.log("## Env Presence");
  console.log(report.envPresence);
  console.log("");
  console.log("## Before Metadata");
  console.log(`psql available: ${report.sqlTooling.psqlAvailable}`);
  console.log(`psql version: ${report.sqlTooling.psqlVersion}`);
  console.log(`Count: ${report.beforeCount}`);
  console.log(`Columns: ${report.beforeColumns}`);
  console.log(`Recent safe metadata: ${report.beforeRecent}`);
  console.log("");
  console.log("## Invocation Result");
  console.log(report.invocationResult);
  console.log("");
  console.log("## After Metadata");
  console.log(`Count: ${report.afterCount}`);
  console.log(`Recent safe metadata: ${report.afterRecent}`);
  console.log("");
  console.log("## Data Write Evidence");
  console.log(report.dataWriteEvidence);
  console.log("");
  console.log("## Commands Not Run");
  for (const command of report.commandsNotRun) console.log(`- ${command}`);
  console.log("");
  console.log("## Secret Exposure Check");
  console.log(report.secretExposureCheck);
  console.log("");
  console.log("## Ledger Update");
  console.log(dryRun ? "Dry-run only; ledger not updated." : (result.ledgerStatus || result.finalStatus));
  console.log("");
  console.log("## Run Log Update");
  console.log(dryRun ? "Dry-run/explain only; run log not updated." : "Run entry appended.");
  console.log("");
  console.log("## Validation Result");
  console.log("Validation runs after this report are handled by the calling workflow.");
  console.log("");
  console.log("## Next Permission Needed From John");
  console.log(result.nextPermission || report.nextPermission || "hold");
  console.log("");
  console.log("Actions:");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

function printZeroOutputInvestigationReport(result, active, route) {
  const report = result.zeroOutputInvestigation;
  console.log("# Zero-Output Pipeline Investigation Runner Report");
  console.log("");
  console.log(`Mode: ${modeLabel()}`);
  console.log(`Lane: ${active.laneId || "legacy ledger"}`);
  console.log(`Selected skill: ${route.skill || "unknown"}`);
  console.log(`Final status: ${result.finalStatus}`);
  console.log(`Summary: ${result.summary}`);
  console.log("");
  console.log("## Static Pipeline Trace");
  if (report.sourceTrace) {
    console.log(`Configured sources: ${report.sourceTrace.configured_sources.count}`);
    console.log(`Database tables: ${report.sourceTrace.database_tables.join(", ") || "none"}`);
    for (const stage of report.sourceTrace.stages) console.log(`- ${stage.stage}: ${stage.present ? `line ${stage.line}` : "not found"}`);
  } else console.log("not collected");
  console.log("");
  console.log("## Response Counters");
  if (report.sourceTrace) {
    for (const counter of report.sourceTrace.response_counters) console.log(`- ${counter.counter} = ${counter.expression} (line ${counter.line || "unknown"})`);
  } else console.log("not collected");
  console.log("");
  console.log("## Env Presence");
  if (report.envPresence) for (const [key, value] of Object.entries(report.envPresence)) console.log(`- ${key}: ${value ? "set" : "not set"}`);
  else console.log("not checked");
  console.log("");
  console.log("## Safe Database Evidence");
  console.log(report.database ? report.database.summary : "not collected");
  if (report.database) console.log(`Retained response evidence: ${report.database.retainedResponseSummary}`);
  console.log("");
  console.log("## Function Log Evidence");
  console.log(report.functionLogs);
  console.log("");
  console.log("## First Proven Non-Zero Stage");
  console.log(report.firstNonZero);
  console.log("");
  console.log("## First Proven Zero Stage");
  console.log(report.firstZero);
  console.log("");
  console.log("## Classification");
  console.log(report.classification);
  console.log("");
  console.log("## Root-Cause Evidence");
  for (const item of report.rootCauseEvidence || []) console.log(`- ${item}`);
  console.log("");
  console.log("## Remaining Unverified");
  for (const item of report.remaining || []) console.log(`- ${item}`);
  console.log("");
  console.log("## Product Files Updated");
  console.log(report.productFilesUpdated && report.productFilesUpdated.length ? report.productFilesUpdated.join(", ") : "none");
  console.log("");
  console.log("## Commands Not Run");
  for (const item of report.commandsNotRun || []) console.log(`- ${item}`);
  console.log("");
  console.log("## Lane Update");
  console.log(dryRun ? "none; dry-run" : `selected lane only: ${active.laneId || "legacy"}`);
  console.log("");
  console.log("## Next Permission");
  console.log(result.nextPermission || "hold");
  console.log("");
  console.log("Actions:");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

module.exports = {
  printReport,
  printSchedulerDraftPrReport,
  printSupabaseLinkSecretReadinessReport,
  printSupabaseSecretFunctionDeployReport,
  printRuntimeNegativeVerificationReport,
  printFunctionSecretDeployNegativeRuntimeReport,
  printControlledSuccessInvocationReport,
  printZeroOutputInvestigationReport,
};
