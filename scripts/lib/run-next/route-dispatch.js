"use strict";

const runtime = require("./runtime-context");

const HANDLERS = {
  "github-handoff": "runGithubHandoff",
  "pr-readiness": "runPrReadiness",
  "pr-merge": "runPrMerge",
  "deployment-plan": "runDeploymentPlan",
  "supabase-preflight": "runSupabasePreflight",
  "supabase-tooling-auth": "runSupabaseToolingAuth",
  "supabase-link-secret-readiness": "runSupabaseLinkSecretReadiness",
  "scheduler-draft-pr": "runSchedulerDraftPr",
  "scheduler-pr-merge": "runSchedulerPrMerge",
  "supabase-secret-function-deploy": "runSupabaseSecretFunctionDeploy",
  "runtime-negative-verification": "runRuntimeNegativeVerification",
  "function-secret-deploy-negative-runtime": "runFunctionSecretDeployNegativeRuntime",
  "controlled-success-invocation": "runControlledSuccessInvocation",
  "scheduled-run-monitoring-handoff": "runScheduledRunMonitoringHandoff",
  "zero-output-pipeline-investigation": "runZeroOutputPipelineInvestigation",
  "zero-output-observability-patch": "runZeroOutputObservabilityPatch",
  "observability-pr-recovery": "runObservabilityPrRecovery",
  "zero-output-observability-deploy": "runZeroOutputObservabilityDeploy",
  "observability-run-recheck": "runObservabilityRunRecheck",
  "scheduler-application-decision": "runSchedulerApplicationDecision",
  "scheduler-vault-design-apply": "runSchedulerVaultDesignApply",
  "verification-bundle-self-test": "runVerificationBundleSelfTest",
  "local-skill-workpack": "runLocalSkillWorkpack",
  "cloudflare-opstruth-packaging-bundle": "runCloudflareOpstruthPackagingBundle",
  "clean-temp-readiness-smoke": "runCleanTempReadinessSmoke",
  "license-package-candidate": "runLicensePackageCandidate",
  "package-candidate-dry-run": "runPackageCandidateDryRun",
  "cli-entrypoint-package-smoke": "runCliEntrypointPackageSmoke",
  "github-open-source-handoff": "runGithubOpenSourceHandoff",
  "first-version-tag": "runFirstVersionTag",
  "semver-release-prep": "runSemverReleasePrep",
  "workflow-corpus-recovery": "runWorkflowCorpusRecovery",
  "docs-list-foundation": "runDocsListFoundation",
  "repo-map-helper-automation": "runRepoMapHelperAutomation",
  "project-kb-compiler": "runProjectKbCompiler",
  "pre-commit-validation-hook": "runPreCommitValidationHook",
  "migration-review-helper": "runMigrationReviewHelper",
  "library-next-objective-assessment": "runLibraryNextObjectiveAssessment",
  "capability-intelligence-search-truth": "runCapabilityIntelligenceSearchTruth",
  "capability-intelligence-cli-input-truth": "runCapabilityIntelligenceCliInputTruth",
};

function dispatchRoute(route, active) {
  if (route.kind === "human-boundary" || route.kind === "permission-boundary") {
    return runtime.get("stopAtBoundary")(route, active);
  }
  if (!runtime.get("permissionGranted")(route)) {
    return runtime.get("needsJohn")(route, active);
  }
  const handler = HANDLERS[route.kind];
  if (!handler) return runtime.get("notImplemented")(route, active);
  return runtime.get(handler)(active);
}

module.exports = {
  HANDLERS,
  dispatchRoute,
};
