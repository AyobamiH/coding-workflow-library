"use strict";

// Scheduler, observability, tooling, preflight, and deployment-plan reports.

const runtime = require("./runtime-context");
const { objectiveAuthority, SCHEDULER_VAULT_SECRET_NAME, targetRepo, dryRun, selectedLane, evidence, actions } = runtime.pick(["objectiveAuthority","SCHEDULER_VAULT_SECRET_NAME","targetRepo","dryRun","selectedLane","evidence","actions"]);
const canRunNow = runtime.lazy("canRunNow");
const nextApprovalCommand = runtime.lazy("nextApprovalCommand");
const modeLabel = runtime.lazy("modeLabel");
const flattenExecutionCommands = runtime.lazy("flattenExecutionCommands");
const summarizeCommits = runtime.lazy("summarizeCommits");
const run = runtime.lazy("run");
const firstLine = runtime.lazy("firstLine");

function printScheduledRunMonitoringHandoffReport(result, active, route) {
  const report = result.scheduledRunMonitoringHandoff;
  console.log("# Scheduled Run Monitoring + Production Handoff Report");
  console.log("");
  console.log("## Files Read");
  for (const file of report.filesRead) console.log(`- ${file}`);
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
  console.log("## Scheduler Metadata");
  console.log(report.schedulerMetadata);
  console.log("");
  console.log("## Scheduler Run History");
  console.log(report.schedulerRunHistory);
  console.log("");
  console.log("## Pet Tips Metadata");
  console.log(`psql available: ${report.sqlTooling.psqlAvailable}`);
  console.log(`psql version: ${report.sqlTooling.psqlVersion}`);
  console.log(`Count: ${report.petTipsCount}`);
  console.log(`Recent safe metadata: ${report.petTipsRecent}`);
  console.log(`Summary: ${report.petTipsMetadata}`);
  console.log("");
  console.log("## Source/Docs Evidence");
  console.log(report.sourceDocsEvidence);
  console.log(`Excerpt: ${report.sourceDocsExcerpt}`);
  console.log("");
  console.log("## Production Handoff Summary");
  console.log(report.productionHandoffSummary);
  console.log("");
  console.log("## Commands Not Run");
  for (const command of report.commandsNotRun) console.log(`- ${command}`);
  console.log("");
  console.log("## Secret Exposure Check");
  console.log(report.secretExposureCheck);
  console.log("");
  console.log("## Ledger Update");
  console.log(dryRun ? "Dry-run only; no state updated." : selectedLane ? `Selected lane updated: ${selectedLane.lane_id}` : (result.ledgerStatus || result.finalStatus));
  console.log("");
  console.log("## Run Log Update");
  console.log(dryRun ? "Dry-run/explain only; run log not updated." : selectedLane ? "Public run log not updated; product runtime evidence remains local." : "Run entry appended.");
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

function printObservabilityRunRecheckReport(result, active, route) {
  const report = result.observabilityRunRecheck;
  console.log("# Observability Automatic-Run Recheck Report");
  console.log("");
  console.log("## Current UTC Time");
  console.log(report.currentUtc);
  console.log("");
  console.log("## Lane State Before");
  console.log(`${active.laneId || "legacy"}: ${active.currentStatus || "unknown"}`);
  console.log("");
  console.log("## Dry-Run Result");
  console.log(dryRun ? "Dry-run selected observability-run-recheck and made no state changes." : "Dry-run was performed separately before this real run.");
  console.log("");
  console.log("## Scheduler Job Metadata");
  console.log(report.schedulerJobMetadata);
  console.log("");
  console.log("## Post-Deployment Automatic Run");
  console.log(report.postDeploymentAutomaticRun);
  console.log("");
  console.log("## Run Status");
  console.log(report.runStatus);
  console.log("");
  console.log("## Telemetry Retrieval Method");
  console.log(report.telemetryRetrievalMethod);
  console.log("");
  console.log("## Safe Telemetry Evidence");
  console.log(report.safeTelemetryEvidence);
  console.log("");
  console.log("## Stage Count Chain");
  if (report.stageCountChain && report.stageCountChain.length) {
    for (const stage of report.stageCountChain) {
      console.log(`- ${stage.label}: ${stage.value === null ? "not available" : stage.value}`);
    }
  } else {
    console.log("- not available");
  }
  console.log("");
  console.log("## Largest Attrition Step");
  console.log(report.largestAttritionStep);
  console.log("");
  console.log("## First Proven Non-Zero Stage");
  console.log(report.firstNonZeroStage);
  console.log("");
  console.log("## First Proven Zero Stage");
  console.log(report.firstZeroStage);
  console.log("");
  console.log("## Root-Cause Classification");
  console.log(report.rootCauseClassification);
  console.log("");
  console.log("## Root-Cause Evidence");
  for (const item of report.rootCauseEvidence || []) console.log(`- ${item}`);
  console.log("");
  console.log("## Safe Pet Tips Metadata");
  console.log(report.petTipsMetadata);
  console.log("");
  console.log("## Remaining Unverified Areas");
  if (report.remainingUnverifiedAreas && report.remainingUnverifiedAreas.length) {
    for (const item of report.remainingUnverifiedAreas) console.log(`- ${item}`);
  } else {
    console.log("- none");
  }
  console.log("");
  console.log("## Wagging Lane After");
  console.log(dryRun ? "unchanged; dry-run only" : result.finalStatus);
  console.log("");
  console.log("## Lane Isolation Proof");
  console.log(dryRun ? "Dry-run did not update any lane." : selectedLane ? `Only selected lane updated by runner: ${selectedLane.lane_id}` : "Legacy ledger mode used.");
  console.log("");
  console.log("## Commands Not Run");
  for (const command of report.commandsNotRun) console.log(`- ${command}`);
  console.log("");
  console.log("## Reusable Library Changes");
  console.log("observability-run-recheck route support in scripts/run-next");
  console.log("");
  console.log("## Validation Result");
  console.log("Validation runs after this report are handled by the calling workflow.");
  console.log("");
  console.log("## Secret Exposure Check");
  console.log(report.secretExposureCheck);
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

function printSchedulerApplicationDecisionReport(result, active, route) {
  const decision = result.schedulerApplicationDecision;
  console.log("# Scheduler Application Decision Resume Report");
  console.log("");
  console.log("## Interrupted Work Recovered");
  console.log("Recovered partial scheduler-application-decision edits, repaired/finished runner routing and report support, and validated syntax before execution.");
  console.log("");
  console.log("## Files Read");
  console.log("- AGENTS.md");
  console.log("- RUNBOOK.md");
  console.log("- tools.md");
  console.log("- work-ledger.md");
  console.log("- scripts/run-next");
  console.log("- skill-files/coding-workflow-orchestrator-skill.md");
  console.log("- skill-files/security-hardening-review-skill.md");
  console.log("- skill-files/supabase-rls-audit-skill.md");
  console.log("- skill-files/build-verify-skill.md");
  console.log("- target repo scheduler migrations/docs evidence");
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
  console.log("## Local Repo State");
  if (decision.targetRepoState) {
    console.log(`Branch: ${decision.targetRepoState.branch}`);
    console.log(`Git status: ${decision.targetRepoState.status}`);
    console.log(`Recent log: ${firstLine(decision.targetRepoState.recentLog)}`);
  } else {
    console.log("Dry-run: repo state would be inspected.");
  }
  console.log("");
  console.log("## Existing Scheduler Evidence");
  if (decision.existingSchedulerEvidence) {
    console.log(`Summary: ${decision.existingSchedulerEvidence.summary}`);
    console.log(`Old job name: ${decision.existingSchedulerEvidence.oldJobName}`);
    console.log(`Old schedule: ${decision.existingSchedulerEvidence.oldSchedule}`);
    console.log(`Old URL: ${decision.existingSchedulerEvidence.oldUrl}`);
    console.log(`Old headers: ${decision.existingSchedulerEvidence.oldHeaders}`);
    console.log(`Guarded draft: ${decision.existingSchedulerEvidence.guardedDraft}`);
    console.log(`Safe storage documented: ${decision.existingSchedulerEvidence.safeStorageDocumented}`);
    console.log(`Evidence: ${decision.existingSchedulerEvidence.grepSummary}`);
  } else {
    console.log("Dry-run: scheduler source/docs would be inspected.");
  }
  console.log("");
  console.log("## Supabase CLI/DB Access Result");
  console.log(decision.cliDbAccessResult);
  console.log("");
  console.log("## Read-Only Capability Discovery");
  console.log(decision.readOnlyCapabilityDiscovery);
  console.log("");
  console.log("## Safe Path Decision");
  console.log(decision.safePathDecision);
  console.log("");
  console.log("## Planned Scheduler Change");
  console.log(decision.plannedSchedulerChange);
  console.log("");
  console.log("## Scheduler Application Result");
  console.log(decision.schedulerApplicationResult);
  console.log("");
  console.log("## Post-Application Scheduler Evidence");
  console.log(decision.postApplicationSchedulerEvidence);
  console.log("");
  console.log("## Commands Not Run");
  for (const command of decision.commandsNotRun) console.log(`- ${command}`);
  console.log("");
  console.log("## Secret Exposure Check");
  console.log(decision.secretExposureCheck);
  console.log("");
  console.log("## Ledger Update");
  console.log(dryRun ? "Dry-run only; ledger not updated." : (result.ledgerStatus || result.finalStatus));
  console.log("");
  console.log("## Run Log Update");
  console.log(dryRun ? "Dry-run/explain only; run log not updated." : "Run entry appended.");
  console.log("");
  console.log("## Next Permission Needed From John");
  console.log(result.nextPermission || decision.nextPermission || "hold");
  console.log("");
  console.log("Actions:");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

function printSchedulerVaultDesignApplyReport(result, active, route) {
  const report = result.schedulerVaultDesignApply;
  console.log("# Scheduler Vault Design + Apply Report");
  console.log("");
  console.log("## Files Read");
  console.log("- AGENTS.md");
  console.log("- RUNBOOK.md");
  console.log("- tools.md");
  console.log("- work-ledger.md");
  console.log("- scripts/run-next");
  console.log("- skill-files/coding-workflow-orchestrator-skill.md");
  console.log("- skill-files/security-hardening-review-skill.md");
  console.log("- skill-files/supabase-rls-audit-skill.md");
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
  console.log("## Local Repo State");
  if (report.targetRepoState) {
    console.log(`Branch: ${report.targetRepoState.branch}`);
    console.log(`Git status: ${report.targetRepoState.status}`);
    console.log(`Recent log: ${firstLine(report.targetRepoState.recentLog)}`);
  } else {
    console.log("Dry-run: repo state would be inspected.");
  }
  console.log("");
  console.log("## Env Presence");
  console.log(report.envPresence);
  console.log("");
  console.log("## SQL Tooling Result");
  console.log(`psql available: ${report.sqlTooling.psqlAvailable}`);
  console.log(`psql version: ${report.sqlTooling.psqlVersion}`);
  console.log("");
  console.log("## DB URL Shape");
  console.log(report.dbUrlShape);
  console.log("");
  console.log("## DB Connectivity Result");
  console.log(`Attempted: ${report.dbConnectivity.attempted || "no"}`);
  console.log(`Result: ${report.dbConnectivity.result || "not checked"}`);
  console.log("");
  console.log("## Read-Only DB Capability Discovery");
  console.log(report.readOnlyDiscovery);
  console.log(`Current job: ${report.currentJob}`);
  console.log("");
  console.log("## Vault Function Signatures");
  console.log(report.vaultFunctionSignatures);
  console.log("");
  console.log("## Safe Path Decision");
  console.log(report.safePathDecision);
  console.log(`Planned scheduler change: ${report.plannedSchedulerChange}`);
  console.log("");
  console.log("## Vault Secret Result");
  console.log(`Attempted: ${report.vaultSecretResult.attempted || "no"}`);
  console.log(`Secret name: ${report.vaultSecretResult.secretName || SCHEDULER_VAULT_SECRET_NAME}`);
  console.log(`Result: ${report.vaultSecretResult.result || "not run"}`);
  console.log(`Temporary SQL file deleted: ${report.vaultSecretResult.tempFileDeleted || "not applicable"}`);
  console.log("");
  console.log("## Scheduler Apply Result");
  console.log(`Attempted: ${report.schedulerApplyResult.attempted || "no"}`);
  console.log(`Job name: ${report.schedulerApplyResult.jobName || "not run"}`);
  console.log(`Schedule: ${report.schedulerApplyResult.schedule || "not run"}`);
  console.log(`Result: ${report.schedulerApplyResult.result || "not run"}`);
  console.log(`Command shape: ${report.schedulerApplyResult.commandShape || "not run"}`);
  console.log("");
  console.log("## Post-Application Metadata");
  console.log(`Metadata: ${report.postApplication.metadata || "not run"}`);
  console.log(`Contains header: ${report.postApplication.commandContainsHeader || "not run"}`);
  console.log(`Contains Vault reference: ${report.postApplication.commandContainsVaultReference || "not run"}`);
  console.log(`Contains literal secret: ${report.postApplication.commandContainsLiteralSecret || "not run"}`);
  console.log(`Long literal concern: ${report.postApplication.commandContainsLongLiteralConcern || "not run"}`);
  console.log("");
  console.log("## Secret Exposure Check");
  console.log(report.secretExposureCheck);
  console.log("");
  console.log("## Commands Not Run");
  for (const command of report.commandsNotRun) console.log(`- ${command}`);
  console.log("");
  console.log("## Ledger Update");
  console.log(dryRun ? "Dry-run only; ledger not updated." : (result.ledgerStatus || result.finalStatus));
  console.log("");
  console.log("## Run Log Update");
  console.log(dryRun ? "Dry-run/explain only; run log not updated." : "Run entry appended.");
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

function printSupabaseToolingAuthReport(result, active, route) {
  const auth = result.supabaseToolingAuth;
  console.log("# Supabase Tooling/Auth Report");
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
  if (auth.targetRepoState) {
    console.log(`Branch: ${auth.targetRepoState.branch}`);
    console.log(`Git status: ${auth.targetRepoState.status}`);
    console.log(`Recent log: ${firstLine(auth.targetRepoState.recentLog)}`);
  } else {
    console.log("Dry-run: repo state would be inspected.");
  }
  console.log("");
  console.log("## Node/npm/npx Availability");
  console.log(auth.nodeNpmNpxAvailability);
  console.log("");
  console.log("## Supabase CLI Path");
  console.log(auth.supabaseCliPath);
  console.log("");
  console.log("## npx Supabase Version Result");
  console.log(auth.npxSupabaseVersionResult);
  console.log("");
  console.log("## Local Env Shape");
  console.log(auth.localEnvShape);
  console.log("");
  console.log("## Project Ref Check");
  console.log(auth.projectRefCheck);
  console.log("");
  console.log("## Supabase Access Token Presence");
  console.log(auth.supabaseAccessTokenPresence);
  console.log("");
  console.log("## Supabase Project Access Result");
  console.log(auth.supabaseProjectAccessResult);
  console.log("");
  console.log("## Final Status");
  console.log(result.finalStatus);
  console.log("");
  console.log("## Commands Not Run");
  for (const command of auth.commandsNotRun) console.log(`- ${command}`);
  console.log("");
  console.log("## Ledger Update");
  console.log(dryRun ? "Dry-run only; ledger not updated." : (result.ledgerStatus || result.finalStatus));
  console.log("");
  console.log("## Run Log Update");
  console.log(dryRun ? "Dry-run/explain only; run log not updated." : "Run entry appended.");
  console.log("");
  console.log("## Next Permission Needed From John");
  console.log(result.nextPermission || auth.nextPermission || "hold");
  console.log("");
  console.log("Actions:");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

function printSupabasePreflightReport(result, active, route) {
  const preflight = result.supabasePreflight;
  console.log("# Supabase Execution Preflight Report");
  console.log("");
  console.log("## Current Ledger State");
  console.log(`Mode: ${dryRun ? "dry-run" : "real"}`);
  console.log(`Target repo: ${targetRepo}`);
  console.log(`Ledger item: ${active.heading || "unknown"}`);
  console.log(`Current status: ${active.currentStatus || "unknown"}`);
  console.log(`Selected skill: ${route.skill || "unknown"}`);
  console.log(`Required permission: ${route.permission || "none"}`);
  console.log(`Final status: ${result.finalStatus}`);
  console.log(`Summary: ${result.summary}`);
  console.log("");
  console.log("## Target Repo State");
  if (preflight.targetRepoState) {
    console.log(`Branch: ${preflight.targetRepoState.branch}`);
    console.log(`Git status: ${preflight.targetRepoState.status}`);
    console.log(`Recent log: ${firstLine(preflight.targetRepoState.recentLog)}`);
  } else {
    console.log("Dry-run: repo state would be inspected.");
  }
  console.log("");
  console.log("## Supabase CLI Availability");
  console.log(preflight.supabaseCliAvailability);
  console.log(preflight.cliDecision);
  console.log("");
  console.log("## Project Reference Evidence");
  console.log(preflight.projectReferenceEvidence);
  console.log("");
  console.log("## Function Deployment Evidence");
  console.log(preflight.functionDeploymentEvidence);
  console.log("");
  console.log("## Secret Setup Evidence");
  console.log(preflight.secretSetupEvidence);
  console.log("");
  console.log("## Scheduler Source Evidence");
  console.log(preflight.schedulerSourceEvidence);
  console.log("");
  console.log("## Scheduler Update Decision");
  console.log(preflight.schedulerUpdateDecision);
  console.log("");
  console.log("## Execution Sequence");
  for (const group of preflight.executionSequence) {
    console.log(`${group.gate}:`);
    for (const command of group.commands) console.log(`- ${command}`);
  }
  console.log("");
  console.log("## Permission Gates");
  for (const gate of preflight.permissionGates) console.log(`- ${gate}`);
  console.log("");
  console.log("## Commands Drafted But Not Run");
  for (const command of flattenExecutionCommands(preflight.executionSequence)) console.log(`- ${command}`);
  console.log("");
  console.log("## Blockers");
  if (preflight.blockers.length) {
    for (const blocker of preflight.blockers) console.log(`- ${blocker}`);
  } else {
    console.log("- none from source-only preflight");
  }
  console.log("");
  console.log("## Recommended Next Permission");
  console.log(preflight.recommendedNextPermission || result.nextPermission || "hold");
  console.log("");
  console.log("Actions:");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

function printDeploymentPlanningReport(result, active, route) {
  const plan = result.deploymentPlan;
  console.log("# Deployment Planning Report");
  console.log("");
  console.log("## Current State");
  console.log(`Mode: ${dryRun ? "dry-run" : "real"}`);
  console.log(`Target repo: ${targetRepo}`);
  console.log(`Ledger item: ${active.heading || "unknown"}`);
  console.log(`Current status: ${active.currentStatus || "unknown"}`);
  console.log(`Selected skill: ${route.skill || "unknown"}`);
  console.log(`Required permission: ${route.permission || "none"}`);
  console.log(`Final status: ${result.finalStatus}`);
  console.log(`Summary: ${result.summary}`);
  if (plan.currentState) {
    console.log(`Branch: ${plan.currentState.branch}`);
    console.log(`Git status: ${plan.currentState.status}`);
    console.log(`Merged commit: ${plan.currentState.mergedCommit}`);
  }
  console.log("");
  console.log("## Source Evidence");
  if (plan.sourceEvidence) {
    console.log(`Supabase files: ${plan.sourceEvidence.supabaseFiles.length}`);
    console.log(`Workflow files: ${plan.sourceEvidence.workflowFiles.length ? plan.sourceEvidence.workflowFiles.join(", ") : "none"}`);
    console.log(`Deployment config files: ${plan.sourceEvidence.deploymentConfigFiles.length ? plan.sourceEvidence.deploymentConfigFiles.join(", ") : "none"}`);
    console.log(`Supabase config: ${plan.sourceEvidence.supabaseConfig}`);
    console.log(`Function summary: ${plan.sourceEvidence.functionSummary}`);
    console.log(`Package scripts: ${plan.sourceEvidence.packageScripts.length ? plan.sourceEvidence.packageScripts.join(", ") : "none"}`);
    console.log(`Relevant grep hits: ${plan.sourceEvidence.grepSummary}`);
    console.log(`CLI availability: ${plan.sourceEvidence.cliAvailability}`);
  } else {
    console.log("Dry-run: source evidence would be collected from local files only.");
  }
  console.log("");
  console.log("## Function To Deploy");
  console.log(plan.functionToDeploy);
  console.log("");
  console.log("## Required Secret Setup");
  console.log(plan.requiredSecretSetup);
  console.log("");
  console.log("## Scheduler Update Required");
  console.log(plan.schedulerUpdateRequired);
  console.log("");
  console.log("## Runtime Verification Matrix");
  for (const item of plan.runtimeVerificationMatrix) console.log(`- ${item}`);
  console.log("");
  console.log("## Commands That Would Be Needed Later");
  for (const group of plan.commandsDraftedButNotRun) {
    console.log(`${group.gate}:`);
    for (const command of group.commands) console.log(`- ${command}`);
  }
  console.log("");
  console.log("## Commands Not Run");
  for (const command of plan.commandsNotRun) console.log(`- ${command}`);
  console.log("");
  console.log("## Risks");
  for (const risk of plan.risks) console.log(`- ${risk}`);
  console.log("");
  console.log("## Recommended Next Permission");
  console.log(plan.recommendedNextPermission || result.nextPermission || "hold");
  console.log("");
  console.log("Actions:");
  for (const action of actions) console.log(`- ${action}`);
  console.log("");
  console.log("Evidence:");
  for (const item of evidence) console.log(`- ${item}`);
}

module.exports = {
  printScheduledRunMonitoringHandoffReport,
  printObservabilityRunRecheckReport,
  printSchedulerApplicationDecisionReport,
  printSchedulerVaultDesignApplyReport,
  printSupabaseToolingAuthReport,
  printSupabasePreflightReport,
  printDeploymentPlanningReport,
};
