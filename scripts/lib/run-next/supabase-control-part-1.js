"use strict";

// Deployment, preflight, tooling, linking, and function-deploy orchestration.

const runtime = require("./runtime-context");
const { fs, path, LIBRARY_ROOT, DEFAULT_ENV_FILE, EXPECTED_GITHUB_REPO, EXPECTED_GITHUB_USER, SCHEDULER_BRANCH, SCHEDULER_PR_TITLE, SCHEDULER_PR_BODY_PATH, SCHEDULER_COMMIT_MESSAGE, IMPORT_FUNCTION_NAME, IMPORT_FUNCTION_DIR, REQUIRED_IMPORT_SECRET, EXPECTED_SUPABASE_PROJECT_REF, SCHEDULER_VAULT_SECRET_NAME, args, targetRepo, dryRun, evidence, actions, filesChanged } = runtime.pick(["fs","path","LIBRARY_ROOT","DEFAULT_ENV_FILE","EXPECTED_GITHUB_REPO","EXPECTED_GITHUB_USER","SCHEDULER_BRANCH","SCHEDULER_PR_TITLE","SCHEDULER_PR_BODY_PATH","SCHEDULER_COMMIT_MESSAGE","IMPORT_FUNCTION_NAME","IMPORT_FUNCTION_DIR","REQUIRED_IMPORT_SECRET","EXPECTED_SUPABASE_PROJECT_REF","SCHEDULER_VAULT_SECRET_NAME","args","targetRepo","dryRun","evidence","actions","filesChanged"]);
const main = runtime.lazy("main");
const viewSchedulerPr = runtime.lazy("viewSchedulerPr");
const collectSupabaseLinkRepoEvidence = runtime.lazy("collectSupabaseLinkRepoEvidence");
const classifyUnexpectedTargetRepoChanges = runtime.lazy("classifyUnexpectedTargetRepoChanges");
const decideSupabaseLinkAuthFailure = runtime.lazy("decideSupabaseLinkAuthFailure");
const collectSupabaseTempFiles = runtime.lazy("collectSupabaseTempFiles");
const summarizeLinkLocalFiles = runtime.lazy("summarizeLinkLocalFiles");
const ensureLocalImportSecret = runtime.lazy("ensureLocalImportSecret");
const summarizeSupabaseLinkFailure = runtime.lazy("summarizeSupabaseLinkFailure");
const linkSecretReadinessBlocked = runtime.lazy("linkSecretReadinessBlocked");
const buildSupabaseLinkSecretReadinessReport = runtime.lazy("buildSupabaseLinkSecretReadinessReport");
const buildSupabaseLinkSecretReadinessSkeleton = runtime.lazy("buildSupabaseLinkSecretReadinessSkeleton");
const collectSecretFunctionDeployRepoEvidence = runtime.lazy("collectSecretFunctionDeployRepoEvidence");
const inspectImportFunctionDeploySource = runtime.lazy("inspectImportFunctionDeploySource");
const checkSecretFunctionDeployEnv = runtime.lazy("checkSecretFunctionDeployEnv");
const checkSecretFunctionDeployAuth = runtime.lazy("checkSecretFunctionDeployAuth");
const writeTemporaryImportSecretEnv = runtime.lazy("writeTemporaryImportSecretEnv");
const removeTemporarySecretFile = runtime.lazy("removeTemporarySecretFile");
const buildSupabaseSecretFunctionDeployReport = runtime.lazy("buildSupabaseSecretFunctionDeployReport");
const buildSupabaseSecretFunctionDeploySkeleton = runtime.lazy("buildSupabaseSecretFunctionDeploySkeleton");
const secretFunctionDeployNeedsJohn = runtime.lazy("secretFunctionDeployNeedsJohn");
const secretFunctionDeployBlocked = runtime.lazy("secretFunctionDeployBlocked");
const collectRuntimeNegativeRepoEvidence = runtime.lazy("collectRuntimeNegativeRepoEvidence");
const inspectRuntimeNegativeSource = runtime.lazy("inspectRuntimeNegativeSource");
const collectRuntimeNegativeEnvShape = runtime.lazy("collectRuntimeNegativeEnvShape");
const checkRuntimeNegativeEnv = runtime.lazy("checkRuntimeNegativeEnv");
const runRuntimeHttpCheck = runtime.lazy("runRuntimeHttpCheck");
const detectRuntimeSecretExposure = runtime.lazy("detectRuntimeSecretExposure");
const summarizeRuntimeNegativeFailure = runtime.lazy("summarizeRuntimeNegativeFailure");
const buildRuntimeNegativeVerificationReport = runtime.lazy("buildRuntimeNegativeVerificationReport");
const buildRuntimeNegativeVerificationSkeleton = runtime.lazy("buildRuntimeNegativeVerificationSkeleton");
const runtimeNegativeBlocked = runtime.lazy("runtimeNegativeBlocked");
const collectSchedulerApplicationRepoEvidence = runtime.lazy("collectSchedulerApplicationRepoEvidence");
const inspectSchedulerApplicationEvidence = runtime.lazy("inspectSchedulerApplicationEvidence");
const collectSchedulerApplicationEnvShape = runtime.lazy("collectSchedulerApplicationEnvShape");
const checkSchedulerApplicationEnv = runtime.lazy("checkSchedulerApplicationEnv");
const inspectSchedulerApplicationCli = runtime.lazy("inspectSchedulerApplicationCli");
const discoverSchedulerApplicationCapabilities = runtime.lazy("discoverSchedulerApplicationCapabilities");
const decideSchedulerApplicationSafePath = runtime.lazy("decideSchedulerApplicationSafePath");
const buildSchedulerApplicationDecisionReport = runtime.lazy("buildSchedulerApplicationDecisionReport");
const buildSchedulerApplicationDecisionSkeleton = runtime.lazy("buildSchedulerApplicationDecisionSkeleton");
const schedulerApplicationBlocked = runtime.lazy("schedulerApplicationBlocked");
const collectSchedulerVaultRepoEvidence = runtime.lazy("collectSchedulerVaultRepoEvidence");
const collectSchedulerVaultEnvShape = runtime.lazy("collectSchedulerVaultEnvShape");
const checkSchedulerVaultEnv = runtime.lazy("checkSchedulerVaultEnv");
const checkSchedulerVaultSqlTooling = runtime.lazy("checkSchedulerVaultSqlTooling");
const classifySchedulerVaultDbUrlShape = runtime.lazy("classifySchedulerVaultDbUrlShape");
const checkSchedulerVaultDbConnectivity = runtime.lazy("checkSchedulerVaultDbConnectivity");
const discoverSchedulerVaultCapabilities = runtime.lazy("discoverSchedulerVaultCapabilities");
const decideSchedulerVaultSafePath = runtime.lazy("decideSchedulerVaultSafePath");
const upsertSchedulerVaultSecret = runtime.lazy("upsertSchedulerVaultSecret");
const applySchedulerVaultCron = runtime.lazy("applySchedulerVaultCron");
const inspectSchedulerVaultPostApplication = runtime.lazy("inspectSchedulerVaultPostApplication");
const buildSchedulerVaultReport = runtime.lazy("buildSchedulerVaultReport");
const buildSchedulerVaultReportSkeleton = runtime.lazy("buildSchedulerVaultReportSkeleton");
const schedulerVaultBlocked = runtime.lazy("schedulerVaultBlocked");
const collectSupabaseToolingRepoEvidence = runtime.lazy("collectSupabaseToolingRepoEvidence");
const collectSupabaseToolingAvailability = runtime.lazy("collectSupabaseToolingAvailability");
const collectSupabaseRuntimeEnvShape = runtime.lazy("collectSupabaseRuntimeEnvShape");
const checkSupabaseProjectRef = runtime.lazy("checkSupabaseProjectRef");
const checkNpxSupabaseVersion = runtime.lazy("checkNpxSupabaseVersion");
const checkSupabaseProjectAccess = runtime.lazy("checkSupabaseProjectAccess");
const decideSupabaseToolingAuthFinal = runtime.lazy("decideSupabaseToolingAuthFinal");
const buildSupabaseToolingAuthSkeleton = runtime.lazy("buildSupabaseToolingAuthSkeleton");
const supabaseToolingAuthCommandsNotRun = runtime.lazy("supabaseToolingAuthCommandsNotRun");
const formatVersionAvailability = runtime.lazy("formatVersionAvailability");
const collectSupabasePreflightRepoEvidence = runtime.lazy("collectSupabasePreflightRepoEvidence");
const collectSupabasePreflightSourceEvidence = runtime.lazy("collectSupabasePreflightSourceEvidence");
const buildSupabasePreflight = runtime.lazy("buildSupabasePreflight");
const buildSupabasePreflightSkeleton = runtime.lazy("buildSupabasePreflightSkeleton");
const collectDeploymentRepoEvidence = runtime.lazy("collectDeploymentRepoEvidence");
const collectDeploymentSourceEvidence = runtime.lazy("collectDeploymentSourceEvidence");
const collectCliAvailability = runtime.lazy("collectCliAvailability");
const buildDeploymentPlan = runtime.lazy("buildDeploymentPlan");
const buildDeploymentPlanSkeleton = runtime.lazy("buildDeploymentPlanSkeleton");
const loadEnvFile = runtime.lazy("loadEnvFile");
const buildGhEnv = runtime.lazy("buildGhEnv");
const run = runtime.lazy("run");
const relativizeLine = runtime.lazy("relativizeLine");
const classifySupabaseScheduler = runtime.lazy("classifySupabaseScheduler");
const formatCliAvailability = runtime.lazy("formatCliAvailability");
const firstLine = runtime.lazy("firstLine");
const timestampForMigration = runtime.lazy("timestampForMigration");

function runDeploymentPlan() {
  if (dryRun) {
    actions.push("would inspect target repo git state, merged commit stat, and remotes");
    actions.push("would inspect Supabase config, Edge Function source, docs, migrations, and scheduler references");
    actions.push("would inspect package scripts and deployment config files");
    actions.push("would check CLI availability with command -v only");
    actions.push("would draft later Supabase secret, function deploy, scheduler update, and runtime verification commands as not run");
    actions.push("would not deploy, set secrets, run migrations, mutate Supabase, call production endpoints, push, create PRs, or merge");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Merged, not deployed",
      summary: "dry-run passed; deployment planning would inspect local/source evidence only and stop before execution",
      nextPermission: "deployment-plan",
      nextSkill: "cloudflare-deploy-skill / supabase deployment planning",
      deploymentPlan: buildDeploymentPlanSkeleton(),
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Blocked: target repo missing",
      summary: `target repo does not exist: ${targetRepo}`,
      nextPermission: "manual repo repair",
      nextSkill: "repo-map-skill",
      exitCode: 1,
    };
  }

  const repoEvidence = collectDeploymentRepoEvidence(targetRepo);
  if (!repoEvidence.ok) return repoEvidence.result;

  const sourceEvidence = collectDeploymentSourceEvidence(targetRepo);
  const cliEvidence = collectCliAvailability(["supabase", "npx", "npm", "node", "gh"]);
  const plan = buildDeploymentPlan({
    repo: repoEvidence.data,
    source: sourceEvidence,
    cli: cliEvidence,
  });

  evidence.push(`deployment plan current branch: ${repoEvidence.data.branch}`);
  evidence.push(`deployment plan git status: ${repoEvidence.data.status}`);
  evidence.push(`merged commit evidence: ${repoEvidence.data.commitStatSummary}`);
  evidence.push(`Supabase files found: ${sourceEvidence.supabaseFiles.length}`);
  evidence.push(`deployment config files found: ${sourceEvidence.configFiles.length ? sourceEvidence.configFiles.join(", ") : "none"}`);
  evidence.push(`function source: ${sourceEvidence.functionExists ? IMPORT_FUNCTION_DIR : "missing"}`);
  evidence.push(`required secret name only: ${REQUIRED_IMPORT_SECRET}`);
  evidence.push(`scheduler evidence: ${plan.schedulerUpdateRequired}`);
  evidence.push(`CLI availability: ${formatCliAvailability(cliEvidence)}`);
  evidence.push("commands drafted but not run: Supabase secret setup, function deploy, scheduler update, runtime verification");

  return {
    finalStatus: "Deployment plan ready, not deployed",
    ledgerStatus: "Deployment plan ready, not deployed",
    summary: "deployment plan produced from local/source evidence only; no secret setup, deploy, migration, scheduler mutation, or runtime call was run",
    nextPermission: "approve Supabase secret/scheduler/deploy execution plan",
    nextSkill: "cloudflare-deploy-skill / supabase-runtime-verification planning",
    deploymentPlan: plan,
    localState: {
      branch: repoEvidence.data.branch,
      status: repoEvidence.data.status,
      log: repoEvidence.data.log,
    },
    exitCode: 0,
  };
}

function runSupabasePreflight() {
  if (dryRun) {
    actions.push("would inspect target repo git state and remotes");
    actions.push("would inspect Supabase config, import-reddit-tips source, migrations, scheduler SQL, docs, and env variable names only");
    actions.push("would check local CLI availability with command -v only");
    actions.push("would draft Supabase tooling/auth, secret setup, scheduler update, function deploy, and runtime verification sequence as not run");
    actions.push("would not install Supabase CLI, run npx supabase, login, link, set secrets, deploy, run migrations, mutate scheduler, run SQL, invoke functions, call production endpoints, push, create PRs, or merge");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Deployment plan ready, not deployed",
      summary: "dry-run passed; Supabase execution preflight would inspect local/source prerequisites only and stop before execution",
      nextPermission: "supabase-preflight",
      nextSkill: "cloudflare-deploy-skill / supabase execution preflight",
      supabasePreflight: buildSupabasePreflightSkeleton(),
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Blocked: target repo missing",
      summary: `target repo does not exist: ${targetRepo}`,
      nextPermission: "manual repo repair",
      nextSkill: "repo-map-skill",
      exitCode: 1,
    };
  }

  const repoEvidence = collectSupabasePreflightRepoEvidence(targetRepo);
  if (!repoEvidence.ok) return repoEvidence.result;

  const sourceEvidence = collectSupabasePreflightSourceEvidence(targetRepo);
  const cliEvidence = collectCliAvailability(["supabase", "npx", "npm", "node"]);
  const preflight = buildSupabasePreflight({
    repo: repoEvidence.data,
    source: sourceEvidence,
    cli: cliEvidence,
  });

  evidence.push(`preflight current branch: ${repoEvidence.data.branch}`);
  evidence.push(`preflight git status: ${repoEvidence.data.status}`);
  evidence.push(`Supabase files found: ${sourceEvidence.supabaseFiles.length}`);
  evidence.push(`project ref evidence: ${preflight.projectReferenceEvidence}`);
  evidence.push(`function deployment evidence: ${preflight.functionDeploymentEvidence}`);
  evidence.push(`secret setup evidence: ${preflight.secretSetupEvidence}`);
  evidence.push(`scheduler source evidence: ${preflight.schedulerSourceEvidence}`);
  evidence.push(`scheduler update decision: ${preflight.schedulerUpdateDecision}`);
  evidence.push(`CLI availability: ${formatCliAvailability(cliEvidence)}`);
  evidence.push("commands drafted but not run: Supabase tooling/auth, secret setup, scheduler update, function deploy, runtime verification");

  return {
    finalStatus: "Supabase execution preflight ready, not executed",
    ledgerStatus: "Supabase execution preflight ready, not executed",
    summary: "Supabase execution preflight produced from local/source evidence only; no CLI install/auth/link, secret setup, deploy, migration, scheduler mutation, SQL, function invoke, or runtime call was run",
    nextPermission: preflight.recommendedNextPermission,
    nextSkill: "cloudflare-deploy-skill / supabase execution gate",
    supabasePreflight: preflight,
    localState: {
      branch: repoEvidence.data.branch,
      status: repoEvidence.data.status,
      log: repoEvidence.data.log,
    },
    exitCode: 0,
  };
}

function runSupabaseToolingAuth() {
  if (dryRun) {
    actions.push("would inspect target repo git state");
    actions.push("would check node, npm, npx, local supabase path, and npx supabase --version");
    actions.push("would inspect <RUNTIME_ENV_FILE> variable names and presence only");
    actions.push(`would compare SUPABASE_PROJECT_REF, if set, to ${EXPECTED_SUPABASE_PROJECT_REF}`);
    actions.push("would run read-only npx supabase projects list only if SUPABASE_ACCESS_TOKEN is set and npx supabase --version works");
    actions.push("would not install Supabase CLI as a dependency, run supabase login/link, set secrets, deploy, run migrations, SQL, scheduler mutation, Edge Function invoke, production curl, push, PR, or merge");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Supabase execution preflight ready, not executed",
      summary: "dry-run passed; Supabase tooling/auth setup would run only safe local tooling and read-only project access checks",
      nextPermission: "supabase-tooling-auth",
      nextSkill: "cloudflare-deploy-skill / Supabase tooling/auth setup",
      supabaseToolingAuth: buildSupabaseToolingAuthSkeleton(),
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    return {
      finalStatus: "BLOCKED: Node/npx/Supabase CLI unavailable",
      ledgerStatus: "Blocked: target repo missing",
      summary: `target repo does not exist: ${targetRepo}`,
      nextPermission: "manual repo repair",
      nextSkill: "repo-map-skill",
      supabaseToolingAuth: buildSupabaseToolingAuthSkeleton(),
      exitCode: 1,
    };
  }

  const repoEvidence = collectSupabaseToolingRepoEvidence(targetRepo);
  if (!repoEvidence.ok) return repoEvidence.result;

  const tooling = collectSupabaseToolingAvailability();
  const envShape = collectSupabaseRuntimeEnvShape(DEFAULT_ENV_FILE);
  const projectRef = checkSupabaseProjectRef(envShape);
  const version = checkNpxSupabaseVersion(tooling);
  const projectAccess = checkSupabaseProjectAccess(envShape, version);

  const final = decideSupabaseToolingAuthFinal({
    tooling,
    envShape,
    projectRef,
    version,
    projectAccess,
  });

  const report = {
    currentLedgerState: "Supabase execution preflight ready, not executed",
    targetRepoState: {
      repo: targetRepo,
      branch: repoEvidence.data.branch,
      status: repoEvidence.data.status,
      recentLog: repoEvidence.data.log,
    },
    nodeNpmNpxAvailability: formatVersionAvailability(tooling),
    supabaseCliPath: tooling.supabasePath || "not found",
    npxSupabaseVersionResult: version.summary,
    localEnvShape: envShape.summary,
    projectRefCheck: projectRef.summary,
    supabaseAccessTokenPresence: envShape.SUPABASE_ACCESS_TOKEN ? "set" : "not set",
    supabaseProjectAccessResult: projectAccess.summary,
    finalStatus: final.status,
    commandsNotRun: supabaseToolingAuthCommandsNotRun(),
    nextPermission: final.nextPermission,
  };

  evidence.push(`tooling/auth current branch: ${repoEvidence.data.branch}`);
  evidence.push(`tooling/auth git status: ${repoEvidence.data.status}`);
  evidence.push(`node/npm/npx availability: ${report.nodeNpmNpxAvailability}`);
  evidence.push(`Supabase CLI path: ${report.supabaseCliPath}`);
  evidence.push(`npx Supabase version result: ${version.summary}`);
  evidence.push(`local env shape: ${envShape.summary}`);
  evidence.push(`project ref check: ${projectRef.summary}`);
  evidence.push(`Supabase access token presence: ${report.supabaseAccessTokenPresence}`);
  evidence.push(`Supabase project access result: ${projectAccess.summary}`);

  return {
    finalStatus: final.status,
    ledgerStatus: final.ledgerStatus,
    summary: final.summary,
    nextPermission: final.nextPermission,
    nextSkill: final.nextSkill,
    supabaseToolingAuth: report,
    localState: {
      branch: repoEvidence.data.branch,
      status: repoEvidence.data.status,
      log: repoEvidence.data.log,
    },
    exitCode: final.exitCode,
  };
}

function runSupabaseLinkSecretReadiness() {
  if (dryRun) {
    actions.push("would inspect target repo git state and stop on unexpected tracked changes");
    actions.push("would load <RUNTIME_ENV_FILE> without printing values");
    actions.push(`would verify SUPABASE_PROJECT_REF matches ${EXPECTED_SUPABASE_PROJECT_REF}`);
    actions.push("would reconfirm npx supabase --version and read-only project access");
    actions.push("would run npx supabase link with SUPABASE_ACCESS_TOKEN only after auth/project checks pass");
    actions.push(`would generate ${REQUIRED_IMPORT_SECRET} only if missing and store it only in <RUNTIME_ENV_FILE>`);
    actions.push("would not set remote secrets, deploy functions, run migrations, SQL, scheduler mutation, Edge Function invoke, production curl, push, PR, or merge");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Supabase tooling/auth ready, not linked",
      summary: "dry-run passed; Supabase link/local secret readiness would run only local link and local env secret readiness checks",
      nextPermission: "supabase-link-secret-readiness",
      nextSkill: "cloudflare-deploy-skill / Supabase link and local secret readiness",
      supabaseLinkSecretReadiness: buildSupabaseLinkSecretReadinessSkeleton(),
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    return linkSecretReadinessBlocked("target repo does not exist", `target repo does not exist: ${targetRepo}`);
  }

  const beforeRepo = collectSupabaseLinkRepoEvidence(targetRepo, "pre-link");
  if (!beforeRepo.ok) return beforeRepo.result;

  const envFile = DEFAULT_ENV_FILE;
  const envShape = collectSupabaseRuntimeEnvShape(envFile);
  const projectRef = checkSupabaseProjectRef(envShape);
  const tooling = collectSupabaseToolingAvailability();
  const version = checkNpxSupabaseVersion(tooling);
  const projectAccess = checkSupabaseProjectAccess(envShape, version);
  const authFailure = decideSupabaseLinkAuthFailure({ envShape, projectRef, version, projectAccess });
  if (authFailure) {
    authFailure.supabaseLinkSecretReadiness = buildSupabaseLinkSecretReadinessReport({
      repo: beforeRepo.data,
      authResult: authFailure.summary,
      linkResult: "not run",
      localFilesChangedByLink: "not checked",
      localSecretReadiness: "not checked",
      finalStatus: authFailure.finalStatus,
    });
    return authFailure;
  }

  const linkEnv = {
    ...process.env,
    ["SUPABASE_ACCESS_" + "TOKEN"]: envShape.SUPABASE_ACCESS_TOKEN,
  };
  const link = run("npx", ["supabase", "link", "--project-ref", EXPECTED_SUPABASE_PROJECT_REF], {
    cwd: targetRepo,
    env: linkEnv,
    allowFailure: true,
    timeout: 120000,
    input: "",
  });

  if (link.code !== 0) {
    const summary = summarizeSupabaseLinkFailure(link);
    return {
      finalStatus: "NEEDS JOHN: Supabase link requires interactive credential",
      ledgerStatus: "Needs John: Supabase link requires interactive credential",
      summary,
      nextPermission: "provide required local project/database credential or approve alternate link path",
      nextSkill: "cloudflare-deploy-skill / Supabase link and local secret readiness",
      supabaseLinkSecretReadiness: buildSupabaseLinkSecretReadinessReport({
        repo: beforeRepo.data,
        authResult: "project access confirmed before link",
        linkResult: summary,
        localFilesChangedByLink: "not checked after failed link",
        localSecretReadiness: "not checked",
        finalStatus: "NEEDS JOHN: Supabase link requires interactive credential",
      }),
      exitCode: 2,
    };
  }

  const afterRepo = collectSupabaseLinkRepoEvidence(targetRepo, "post-link");
  if (!afterRepo.ok) return afterRepo.result;
  const tempFiles = collectSupabaseTempFiles(targetRepo);
  const afterUnexpected = classifyUnexpectedTargetRepoChanges(afterRepo.data.status);
  if (afterUnexpected.hasUnexpected) {
    return {
      finalStatus: "BLOCKED: unexpected target repo changes",
      ledgerStatus: "Blocked: unexpected target repo changes",
      summary: afterUnexpected.summary,
      nextPermission: "manual review of target repo changes",
      nextSkill: "repo-map-skill",
      supabaseLinkSecretReadiness: buildSupabaseLinkSecretReadinessReport({
        repo: afterRepo.data,
        authResult: "project access confirmed before link",
        linkResult: "link command exited 0",
        localFilesChangedByLink: summarizeLinkLocalFiles(afterRepo.data.status, tempFiles),
        localSecretReadiness: "not checked because unexpected repo changes were found",
        finalStatus: "BLOCKED: unexpected target repo changes",
      }),
      exitCode: 1,
    };
  }

  const secretResult = ensureLocalImportSecret(envFile);
  const report = buildSupabaseLinkSecretReadinessReport({
    repo: afterRepo.data,
    authResult: `project ref ${EXPECTED_SUPABASE_PROJECT_REF} appears in read-only projects list`,
    linkResult: "link command exited 0",
    localFilesChangedByLink: summarizeLinkLocalFiles(afterRepo.data.status, tempFiles),
    localSecretReadiness: secretResult.summary,
    finalStatus: "Supabase linked and local secret ready, not deployed",
  });

  evidence.push(`link/secret current branch: ${beforeRepo.data.branch}`);
  evidence.push(`link/secret pre-link git status: ${beforeRepo.data.status}`);
  evidence.push(`Supabase auth result: ${report.authResult}`);
  evidence.push(`link result: ${report.linkResult}`);
  evidence.push(`local files changed by link: ${report.localFilesChangedByLink}`);
  evidence.push(`local secret readiness: ${secretResult.summary}`);
  evidence.push("commands not run: remote secret setup, function deploy, db push, migrations, SQL, scheduler mutation, Edge Function invoke, production endpoint curl, git push/PR/merge");

  return {
    finalStatus: "Supabase linked and local secret ready, not deployed",
    ledgerStatus: "Supabase linked and local secret ready, not deployed",
    summary: "local Supabase link succeeded and local import secret readiness is satisfied; no remote secret setup, deploy, migration, SQL, scheduler, runtime, push, PR, or merge was run",
    nextPermission: "approve remote secret setup and scheduler migration draft",
    nextSkill: "cloudflare-deploy-skill / remote secret setup and scheduler migration draft",
    supabaseLinkSecretReadiness: report,
    localState: {
      branch: afterRepo.data.branch,
      status: afterRepo.data.status,
      log: afterRepo.data.log,
    },
    exitCode: 0,
  };
}

function runSupabaseSecretFunctionDeploy() {
  if (dryRun) {
    actions.push("would inspect target repo status, branch, recent log, and remote");
    actions.push(`would confirm ${IMPORT_FUNCTION_DIR}/index.ts exists and contains the hardened boundary terms`);
    actions.push("would load <RUNTIME_ENV_FILE> without printing values");
    actions.push(`would verify SUPABASE_PROJECT_REF is ${EXPECTED_SUPABASE_PROJECT_REF}`);
    actions.push(`would verify SUPABASE_ACCESS_TOKEN and ${REQUIRED_IMPORT_SECRET} are set without printing values`);
    actions.push("would run npx supabase --version and read-only projects list");
    actions.push("would inspect npx supabase secrets set --help and functions deploy --help");
    actions.push("would create a chmod 600 temp env file outside the target repo only if --env-file is supported");
    actions.push(`would set remote ${REQUIRED_IMPORT_SECRET} with --env-file, delete the temp file, and verify absence only`);
    actions.push(`would deploy only ${IMPORT_FUNCTION_NAME}`);
    actions.push("would not run scheduler mutation, db push, migration apply, SQL, function invoke, runtime checks, production curl, push, PR, or merge");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Scheduler migration draft merged, not applied",
      summary: "dry-run passed; Supabase remote secret setup and single function deploy would run with supabase-secret-function-deploy permission",
      nextPermission: "supabase-secret-function-deploy",
      nextSkill: "supabase-function-deploy-skill / Supabase remote secret setup and single Edge Function deploy",
      supabaseSecretFunctionDeploy: buildSupabaseSecretFunctionDeploySkeleton(),
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    return secretFunctionDeployBlocked("Blocked: target repo missing", `target repo does not exist: ${targetRepo}`);
  }

  const repo = collectSecretFunctionDeployRepoEvidence(targetRepo);
  if (!repo.ok) return repo.result;

  const source = inspectImportFunctionDeploySource(targetRepo);
  if (!source.ok) return source.result;

  const envFile = DEFAULT_ENV_FILE;
  const envShape = collectSupabaseRuntimeEnvShape(envFile);
  const envCheck = checkSecretFunctionDeployEnv(envShape);
  if (!envCheck.ok) return envCheck.result;

  const tooling = collectSupabaseToolingAvailability();
  const version = checkNpxSupabaseVersion(tooling);
  const projectAccess = checkSupabaseProjectAccess(envShape, version);
  const authCheck = checkSecretFunctionDeployAuth({ tooling, version, projectAccess });
  if (!authCheck.ok) return authCheck.result;

  const deployEnv = {
    ...process.env,
    ["SUPABASE_ACCESS_" + "TOKEN"]: envShape.SUPABASE_ACCESS_TOKEN,
  };

  const secretHelp = run("npx", ["supabase", "secrets", "set", "--help"], {
    cwd: targetRepo,
    env: deployEnv,
    allowFailure: true,
    timeout: 120000,
  });
  const deployHelp = run("npx", ["supabase", "functions", "deploy", "--help"], {
    cwd: targetRepo,
    env: deployEnv,
    allowFailure: true,
    timeout: 120000,
  });
  const secretHelpText = `${secretHelp.stdout}\n${secretHelp.stderr}`;
  const deployHelpText = `${deployHelp.stdout}\n${deployHelp.stderr}`;
  const envFileSupported = /--env-file\b/.test(secretHelpText);
  evidence.push(`Supabase secrets set --help inspected: ${secretHelp.code === 0 ? "ok" : "nonzero"}`);
  evidence.push(`Supabase functions deploy --help inspected: ${deployHelp.code === 0 ? "ok" : "nonzero"}`);
  evidence.push(`Supabase secrets set --env-file support: ${envFileSupported ? "yes" : "no"}`);

  if (!envFileSupported) {
    return secretFunctionDeployNeedsJohn("NEEDS JOHN: choose safe Supabase secret transfer method", "Supabase CLI help did not confirm --env-file support for secrets set");
  }

  const tempSecret = writeTemporaryImportSecretEnv(envShape.IMPORT_REDDIT_TIPS_SECRET);
  evidence.push("temporary secret env file created outside target repo");
  let tempRemoved = false;

  try {
    const secretSet = run(
      "npx",
      [
        "supabase",
        "secrets",
        "set",
        "--env-file",
        tempSecret.path,
        "--project-ref",
        envShape.SUPABASE_PROJECT_REF,
      ],
      {
        cwd: targetRepo,
        env: deployEnv,
        allowFailure: true,
        timeout: 180000,
      },
    );

    removeTemporarySecretFile(tempSecret.path);
    tempRemoved = true;
    evidence.push("temporary secret env file removed");

    if (secretSet.code !== 0) {
      return secretFunctionDeployBlocked(
        "Blocked: remote secret setup failed",
        `Supabase secrets set failed: ${firstLine(secretSet.stderr || secretSet.stdout)}`,
        {
          repo: repo.data,
          source,
          envShape,
          version,
          projectAccess,
          secretSetupResult: `failed: ${firstLine(secretSet.stderr || secretSet.stdout)}`,
          tempHandling: "temporary secret env file created and removed",
          deployResult: "not run",
        },
      );
    }
    evidence.push(`remote ${REQUIRED_IMPORT_SECRET} set via env-file`);

    const deploy = run(
      "npx",
      ["supabase", "functions", "deploy", IMPORT_FUNCTION_NAME, "--project-ref", envShape.SUPABASE_PROJECT_REF],
      {
        cwd: targetRepo,
        env: deployEnv,
        allowFailure: true,
        timeout: 240000,
      },
    );

    if (deploy.code !== 0) {
      return secretFunctionDeployBlocked(
        "Blocked: function deploy failed after remote secret set",
        `Supabase function deploy failed: ${firstLine(deploy.stderr || deploy.stdout)}`,
        {
          repo: repo.data,
          source,
          envShape,
          version,
          projectAccess,
          secretSetupResult: "remote secret set via env-file",
          tempHandling: "temporary secret env file created and removed",
          deployResult: `failed: ${firstLine(deploy.stderr || deploy.stdout)}`,
        },
      );
    }
    evidence.push(`${IMPORT_FUNCTION_NAME} Edge Function deploy command exited 0`);

    const postStatus = run("git", ["-C", targetRepo, "status", "--short"]);
    const postBranch = run("git", ["-C", targetRepo, "branch", "--show-current"]);
    const postRepoState = {
      status: postStatus.stdout.trim() || "clean",
      branch: postBranch.stdout.trim() || "(detached)",
      log: repo.data.log,
      remote: repo.data.remote,
    };
    evidence.push(`post-deploy git status: ${postRepoState.status}`);
    evidence.push(`post-deploy branch: ${postRepoState.branch}`);

    const report = buildSupabaseSecretFunctionDeployReport({
      repo: postRepoState,
      source,
      envShape,
      version,
      projectAccess,
      secretSetupResult: `remote ${REQUIRED_IMPORT_SECRET} set via env-file`,
      tempHandling: "temporary secret env file created, chmod 600, removed, and absence verified",
      deployResult: `${IMPORT_FUNCTION_NAME} deployed`,
      finalStatus: "Function deployed and remote secret set, scheduler not applied",
    });

    return {
      finalStatus: "Function deployed and remote secret set, scheduler not applied",
      ledgerStatus: "Function deployed and remote secret set, scheduler not applied",
      summary: "remote import secret was set and only import-reddit-tips was deployed; no scheduler mutation, db push, migration, SQL, function invoke, or production endpoint call was run",
      nextPermission: "approve runtime verification and scheduler application decision",
      nextSkill: "cloudflare-deploy-skill / runtime verification and scheduler application decision",
      supabaseSecretFunctionDeploy: report,
      localState: {
        branch: postRepoState.branch,
        status: postRepoState.status,
        log: postRepoState.log,
      },
      exitCode: 0,
    };
  } finally {
    if (!tempRemoved) {
      removeTemporarySecretFile(tempSecret.path);
      evidence.push("temporary secret env file removed in cleanup");
    }
  }
}

module.exports = {
  runDeploymentPlan,
  runSupabasePreflight,
  runSupabaseToolingAuth,
  runSupabaseLinkSecretReadiness,
  runSupabaseSecretFunctionDeploy,
};
