"use strict";

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

function runRuntimeNegativeVerification() {
  if (dryRun) {
    actions.push("would inspect target repo status, branch, and recent log");
    actions.push(`would inspect ${IMPORT_FUNCTION_DIR}/index.ts for auth-before-work evidence`);
    actions.push("would load <RUNTIME_ENV_FILE> without printing values");
    actions.push(`would derive https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}`);
    actions.push("would run OPTIONS, GET, POST without auth, POST with invalid scheduler secret, and optional anon-only POST checks");
    actions.push("would fail closed if any unsafe POST check returns a success/import-like response or if any response exposes a secret");
    actions.push("would not send a valid scheduler secret, admin bearer token, scheduler mutation, migration, SQL, or successful import request");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Function deployed and remote secret set, scheduler not applied",
      summary: "dry-run passed; only negative runtime checks would run with runtime-negative-verification permission",
      nextPermission: "runtime-negative-verification",
      nextSkill: "runtime-verification-skill / deployed function negative runtime verification",
      runtimeNegativeVerification: buildRuntimeNegativeVerificationSkeleton(),
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    return runtimeNegativeBlocked("Runtime negative checks failed, scheduler blocked", `target repo does not exist: ${targetRepo}`);
  }

  const repo = collectRuntimeNegativeRepoEvidence(targetRepo);
  if (!repo.ok) return repo.result;

  const source = inspectRuntimeNegativeSource(targetRepo);
  if (!source.ok) return source.result;

  const envShape = collectRuntimeNegativeEnvShape(DEFAULT_ENV_FILE);
  const envCheck = checkRuntimeNegativeEnv(envShape);
  if (!envCheck.ok) return envCheck.result;

  const endpoint = `https://${envShape.SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}`;
  evidence.push(`runtime negative endpoint: ${endpoint}`);

  const httpEnv = {
    ...process.env,
    ENDPOINT: endpoint,
  };

  const checks = [];
  checks.push(runRuntimeHttpCheck({
    name: "OPTIONS",
    script: 'curl -sS -i --max-time 20 -X OPTIONS "$ENDPOINT" | sed -n "1,20p"',
    env: httpEnv,
    expected: "cors",
  }));
  checks.push(runRuntimeHttpCheck({
    name: "GET/non-POST",
    script: 'curl -sS -i --max-time 20 -X GET "$ENDPOINT" | sed -n "1,40p"',
    env: httpEnv,
    expected: "reject",
  }));
  checks.push(runRuntimeHttpCheck({
    name: "POST without auth",
    script: 'curl -sS -i --max-time 20 -X POST "$ENDPOINT" -H "content-type: application/json" --data "{}" | sed -n "1,80p"',
    env: httpEnv,
    expected: "reject",
  }));
  checks.push(runRuntimeHttpCheck({
    name: "POST invalid scheduler secret",
    script: 'curl -sS -i --max-time 20 -X POST "$ENDPOINT" -H "content-type: application/json" -H "x-import-reddit-tips-secret: invalid-test-secret" --data "{}" | sed -n "1,80p"',
    env: httpEnv,
    expected: "reject",
  }));

  if (envShape.ANON_KEY) {
    const anonEnv = {
      ...httpEnv,
      SUPABASE_ANON_KEY: envShape.ANON_KEY,
    };
    checks.push(runRuntimeHttpCheck({
      name: "POST anon-only",
      script: 'curl -sS -i --max-time 20 -X POST "$ENDPOINT" -H "content-type: application/json" -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" --data "{}" | sed -n "1,80p"',
      env: anonEnv,
      expected: "reject",
    }));
  } else {
    checks.push({
      name: "POST anon-only",
      expected: "reject",
      statusLine: "skipped",
      statusCode: null,
      passed: true,
      skipped: true,
      summary: "anon-only check skipped because SUPABASE_ANON_KEY not available locally",
      raw: "",
      sanitized: "",
      importLike: false,
    });
    evidence.push("anon-only check skipped because SUPABASE_ANON_KEY not available locally");
  }

  const exposure = detectRuntimeSecretExposure(checks, envShape);
  const failures = checks.filter((check) => !check.passed);
  const postSuccess = checks.filter((check) => !check.skipped && check.expected === "reject" && check.statusCode && check.statusCode < 400);
  const importLike = checks.filter((check) => check.importLike);

  const failed = failures.length || postSuccess.length || importLike.length || exposure.hasExposure;
  const finalStatus = failed
    ? "Runtime negative checks failed, scheduler blocked"
    : "Runtime negative checks passed, scheduler not applied";
  const report = buildRuntimeNegativeVerificationReport({
    repo: repo.data,
    source,
    envShape,
    endpoint,
    checks,
    exposure,
    finalStatus,
  });

  if (failed) {
    return {
      finalStatus,
      ledgerStatus: finalStatus,
      summary: summarizeRuntimeNegativeFailure({ failures, postSuccess, importLike, exposure }),
      nextPermission: "approve runtime failure triage and source patch plan",
      nextSkill: "security-hardening-review-skill / runtime failure triage",
      runtimeNegativeVerification: report,
      exitCode: 1,
    };
  }

  return {
    finalStatus,
    ledgerStatus: finalStatus,
    summary: "deployed import-reddit-tips rejected unsafe negative requests; no valid scheduler/admin success request was sent",
    nextPermission: "approve scheduler application planning",
    nextSkill: "supabase-scheduler-vault-skill / scheduler application planning",
    runtimeNegativeVerification: report,
    exitCode: 0,
  };
}

function runSchedulerApplicationDecision() {
  if (dryRun) {
    actions.push("would inspect target repo status, branch, and recent log");
    actions.push("would inspect scheduler migrations/docs/application plan for job name, schedule, URL, headers, guarded draft status, and safe secret-storage evidence");
    actions.push("would load <RUNTIME_ENV_FILE> without printing values");
    actions.push("would inspect Supabase CLI db/sql help and read-only project access");
    actions.push("would run read-only database capability queries only if a safe non-interactive SQL path is available");
    actions.push("would apply only import-reddit-tips-daily scheduler update if a non-hardcoded pg_cron secret path is proven");
    actions.push("would otherwise stop at SCHEDULER BLOCKED: safe scheduler secret storage path not proven");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Runtime negative checks passed, scheduler not applied",
      summary: "dry-run passed; scheduler application decision would fail closed unless a safe non-hardcoded secret path is proven",
      nextPermission: "scheduler-application-decision",
      nextSkill: "supabase-scheduler-vault-skill / scheduler application decision",
      schedulerApplicationDecision: buildSchedulerApplicationDecisionSkeleton(),
      exitCode: 0,
    };
  }

  const repo = collectSchedulerApplicationRepoEvidence(targetRepo);
  if (!repo.ok) return repo.result;

  const schedulerEvidence = inspectSchedulerApplicationEvidence(targetRepo);
  const envShape = collectSchedulerApplicationEnvShape(DEFAULT_ENV_FILE);
  const envCheck = checkSchedulerApplicationEnv(envShape);
  if (!envCheck.ok) {
    return schedulerApplicationBlocked(envCheck.status, envCheck.summary, {
      repo: repo.data,
      schedulerEvidence,
      envShape,
    });
  }

  const cli = inspectSchedulerApplicationCli(envShape);
  const discovery = discoverSchedulerApplicationCapabilities(cli);
  const decision = decideSchedulerApplicationSafePath({
    schedulerEvidence,
    cli,
    discovery,
  });

  const report = buildSchedulerApplicationDecisionReport({
    repo: repo.data,
    schedulerEvidence,
    envShape,
    cli,
    discovery,
    decision,
    plannedChange: decision.plannedChange,
    applicationResult: "not run",
    postApplicationEvidence: "not run",
    finalStatus: decision.safePathProven
      ? "Scheduler blocked: safe secret storage path not proven"
      : "Scheduler blocked: safe secret storage path not proven",
  });

  if (!decision.safePathProven) {
    evidence.push("safe path decision: SAFE PATH NOT PROVEN");
    evidence.push(`safe path blocker: ${decision.summary}`);
    return {
      finalStatus: "Scheduler blocked: safe secret storage path not proven",
      ledgerStatus: "Scheduler blocked: safe secret storage path not proven",
      summary: `SCHEDULER BLOCKED: safe scheduler secret storage path not proven; ${decision.summary}`,
      nextPermission: "approve scheduler secret storage design",
      nextSkill: "security-hardening-review-skill / scheduler secret storage design",
      schedulerApplicationDecision: report,
      exitCode: 1,
    };
  }

  return {
    finalStatus: "Scheduler blocked: safe secret storage path not proven",
    ledgerStatus: "Scheduler blocked: safe secret storage path not proven",
    summary: "SCHEDULER BLOCKED: safe scheduler secret storage path not proven; mutation path is not implemented without explicit proven SQL and post-application redaction checks",
    nextPermission: "approve scheduler secret storage design",
    nextSkill: "security-hardening-review-skill / scheduler secret storage design",
    schedulerApplicationDecision: report,
    exitCode: 1,
  };
}

function runSchedulerVaultDesignApply() {
  if (dryRun) {
    actions.push("would inspect target repo status, branch, recent log, and staged area");
    actions.push("would load <RUNTIME_ENV_FILE> and report only variable presence");
    actions.push("would require SUPABASE_DB_URL or DATABASE_URL without printing it");
    actions.push("would verify psql availability");
    actions.push("would use psql with a redacted DB URL to prove Vault, pg_cron, pg_net, and current scheduler job capability");
    actions.push("would create/update one Vault secret named import_reddit_tips_scheduler_secret via a temporary SQL file outside the target repo");
    actions.push("would replace only import-reddit-tips-daily with a Vault-backed x-import-reddit-tips-secret header if safe");
    actions.push("would stop before any valid runtime import verification");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Scheduler blocked: safe secret storage path not proven",
      summary: "dry-run passed; scheduler Vault design/apply would require DB URL, psql, Vault, pg_cron, pg_net, and current job proof before mutation",
      nextPermission: args.allow.has("scheduler-vault-apply-retry") ? "scheduler-vault-apply-retry" : "scheduler-vault-design-apply",
      nextSkill: "security-hardening-review-skill / scheduler Vault design and apply gate",
      schedulerVaultDesignApply: buildSchedulerVaultReportSkeleton(),
      exitCode: 0,
    };
  }

  const repo = collectSchedulerVaultRepoEvidence(targetRepo);
  if (!repo.ok) return repo.result;

  const envShape = collectSchedulerVaultEnvShape(DEFAULT_ENV_FILE);
  const envCheck = checkSchedulerVaultEnv(envShape);
  if (!envCheck.ok) {
    return schedulerVaultBlocked(envCheck.status, envCheck.summary, {
      repo: repo.data,
      envShape,
      nextPermission: envCheck.nextPermission,
    });
  }

  const tooling = checkSchedulerVaultSqlTooling();
  if (!tooling.ok) {
    return schedulerVaultBlocked("Needs John: psql unavailable for non-interactive DB inspection", tooling.summary, {
      repo: repo.data,
      envShape,
      sqlTooling: tooling.report,
      nextPermission: "install psql locally or provide an approved non-interactive SQL tool",
    });
  }

  const dbUrlShape = classifySchedulerVaultDbUrlShape(envShape.dbUrl);
  evidence.push(`scheduler Vault DB URL shape: ${dbUrlShape.summary}`);
  if (dbUrlShape.kind === "direct") {
    return schedulerVaultBlocked("DB URL STILL POINTS TO DIRECT HOST", "SUPABASE_DB_URL appears to use direct DB host", {
      repo: repo.data,
      envShape,
      sqlTooling: tooling.report,
      dbUrlShape,
      nextPermission: "provide an IPv4-reachable Supabase pooler DB URL",
    });
  }

  const dbConnectivity = checkSchedulerVaultDbConnectivity(envShape.dbUrl, envShape.IMPORT_REDDIT_TIPS_SECRET);
  if (!dbConnectivity.ok) {
    return schedulerVaultBlocked("DB CONNECTIVITY BLOCKED", dbConnectivity.summary, {
      repo: repo.data,
      envShape,
      sqlTooling: tooling.report,
      dbUrlShape,
      dbConnectivity: dbConnectivity.report,
      nextPermission: "provide an IPv4-reachable Supabase pooler DB URL",
    });
  }

  const discovery = discoverSchedulerVaultCapabilities(envShape.dbUrl, envShape.IMPORT_REDDIT_TIPS_SECRET);
  const decision = decideSchedulerVaultSafePath(discovery);
  if (!decision.safePathProven) {
    return schedulerVaultBlocked("Scheduler blocked: Vault/pg_cron/pg_net capability not proven", decision.summary, {
      repo: repo.data,
      envShape,
      sqlTooling: tooling.report,
      dbUrlShape,
      dbConnectivity: dbConnectivity.report,
      discovery,
      decision,
      nextPermission: "approve manual Vault/dashboard scheduler path",
    });
  }

  const vaultResult = upsertSchedulerVaultSecret({
    dbUrl: envShape.dbUrl,
    secretValue: envShape.IMPORT_REDDIT_TIPS_SECRET,
    secretName: SCHEDULER_VAULT_SECRET_NAME,
  });
  if (!vaultResult.ok) {
    return schedulerVaultBlocked("Scheduler blocked: Vault/pg_cron/pg_net capability not proven", vaultResult.summary, {
      repo: repo.data,
      envShape,
      sqlTooling: tooling.report,
      dbUrlShape,
      dbConnectivity: dbConnectivity.report,
      discovery,
      decision,
      vaultResult: vaultResult.report,
      nextPermission: "approve manual Vault/dashboard scheduler path",
    });
  }

  const applyResult = applySchedulerVaultCron({
    dbUrl: envShape.dbUrl,
    schedule: discovery.currentJob.schedule,
  });
  if (!applyResult.ok) {
    return schedulerVaultBlocked("Scheduler blocked: Vault/pg_cron/pg_net capability not proven", applyResult.summary, {
      repo: repo.data,
      envShape,
      sqlTooling: tooling.report,
      dbUrlShape,
      dbConnectivity: dbConnectivity.report,
      discovery,
      decision,
      vaultResult: vaultResult.report,
      schedulerApply: applyResult.report,
      nextPermission: "approve manual Vault/dashboard scheduler path",
    });
  }

  const post = inspectSchedulerVaultPostApplication({
    dbUrl: envShape.dbUrl,
    secretValue: envShape.IMPORT_REDDIT_TIPS_SECRET,
  });
  if (!post.ok) {
    return schedulerVaultBlocked("Scheduler blocked: Vault/pg_cron/pg_net capability not proven", post.summary, {
      repo: repo.data,
      envShape,
      sqlTooling: tooling.report,
      dbUrlShape,
      dbConnectivity: dbConnectivity.report,
      discovery,
      decision,
      vaultResult: vaultResult.report,
      schedulerApply: applyResult.report,
      postApplication: post.report,
      nextPermission: "approve manual Vault/dashboard scheduler path",
    });
  }

  evidence.push("scheduler Vault safe path decision: SAFE PATH PROVEN");
  evidence.push("scheduler Vault secret upsert result: succeeded without printing secret value");
  evidence.push("scheduler cron apply result: import-reddit-tips-daily replaced with Vault-backed header");
  evidence.push("scheduler post-application command check: header and vault reference present; literal secret not found");

  const report = buildSchedulerVaultReport({
    repo: repo.data,
    envShape,
    sqlTooling: tooling.report,
    dbUrlShape,
    dbConnectivity: dbConnectivity.report,
    discovery,
    decision,
    vaultResult: vaultResult.report,
    schedulerApply: applyResult.report,
    postApplication: post.report,
    finalStatus: "Scheduler applied via Vault, runtime not verified",
  });

  return {
    finalStatus: "Scheduler applied via Vault, runtime not verified",
    ledgerStatus: "Scheduler applied via Vault, runtime not verified",
    summary: "Scheduler applied via Vault: import-reddit-tips-daily now references vault.decrypted_secrets for x-import-reddit-tips-secret; no runtime success request was sent",
    nextPermission: "approve runtime verification only",
    nextSkill: "runtime-verification-skill / controlled scheduler success verification",
    schedulerVaultDesignApply: report,
    exitCode: 0,
  };
}

function runSchedulerDraftPr() {
  const schedulerFiles = [];

  if (dryRun) {
    actions.push("would confirm target repo status, branch, recent log, remote, and clean tracked state");
    actions.push(`would fetch origin/main and switch -C ${SCHEDULER_BRANCH} origin/main`);
    actions.push("would inspect scheduler SQL/docs for import-reddit-tips, pg_cron/net.http_post, headers, and safe secret-storage evidence");
    actions.push("would create one guarded local migration draft with no secret values");
    actions.push("would update docs/import-reddit-tips-security.md scheduler status");
    actions.push("would run git status, git diff --stat, git diff --check, and docs/migrations secret-pattern scan");
    actions.push("would commit only the new migration and docs/import-reddit-tips-security.md via scripts/committer");
    actions.push(`would push only ${SCHEDULER_BRANCH} and create or confirm PR into main`);
    actions.push("would not set remote secrets, deploy functions, run db push, apply migrations, execute SQL, mutate scheduler, invoke Edge Functions, call production endpoints, or merge PR");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Supabase linked and local secret ready, not deployed",
      summary: "dry-run passed; scheduler migration draft + exact-file commit + push/PR path would run with scheduler-draft-pr permission",
      nextPermission: "scheduler-draft-pr",
      nextSkill: "supabase-scheduler-vault-skill / scheduler migration draft and GitHub handoff",
      schedulerDraftPr: buildSchedulerDraftPrReport({
        branchResult: "dry-run",
        schedulerEvidence: "dry-run",
        migrationPath: "dry-run",
        safetyDecision: "guarded draft would be created unless a safe SQL secret-storage path is proven",
        localChecks: "dry-run",
        commitResult: "dry-run",
        pushResult: "dry-run",
        prResult: "dry-run",
        prUrl: "",
        includedFiles: [],
        excludedFiles: ["evidence/", "supabase/.temp/"],
        finalStatus: "DRY RUN PASS",
      }),
      exitCode: 0,
    };
  }

  const starting = collectSchedulerDraftRepoState("starting");
  if (!starting.ok) return starting.result;
  const unexpected = classifyUnexpectedTargetRepoChanges(starting.data.status);
  if (unexpected.hasUnexpected) {
    return schedulerDraftBlocked("Blocked: unexpected target repo changes", unexpected.summary);
  }
  const staged = run("git", ["-C", targetRepo, "diff", "--cached", "--name-only"]);
  if (staged.code !== 0) return schedulerDraftBlocked("Blocked: staged-area check failed", firstLine(staged.stderr || staged.stdout));
  if (staged.stdout.trim()) {
    return schedulerDraftBlocked("Blocked: staged files present", `staged files present before drafting: ${staged.stdout.trim().split(/\r?\n/).join(", ")}`);
  }

  const fetch = run("git", ["-C", targetRepo, "fetch", "origin", "main"], { timeout: 120000 });
  if (fetch.code !== 0) return schedulerDraftBlocked("Blocked: fetch failed", firstLine(fetch.stderr || fetch.stdout));

  const switched = run("git", ["-C", targetRepo, "switch", "-C", SCHEDULER_BRANCH, "origin/main"]);
  if (switched.code !== 0) return schedulerDraftBlocked("Blocked: branch switch failed", firstLine(switched.stderr || switched.stdout));
  evidence.push(`branch result: switched ${SCHEDULER_BRANCH} from origin/main`);

  const afterSwitch = collectSchedulerDraftRepoState("post-branch");
  if (!afterSwitch.ok) return afterSwitch.result;
  const afterUnexpected = classifyUnexpectedTargetRepoChanges(afterSwitch.data.status);
  if (afterUnexpected.hasUnexpected) {
    return schedulerDraftBlocked("Blocked: unexpected target repo changes", afterUnexpected.summary);
  }

  const schedulerEvidence = inspectSchedulerSource();
  evidence.push(`scheduler source evidence: ${schedulerEvidence.summary}`);

  const migration = createSchedulerMigrationDraft(schedulerEvidence);
  schedulerFiles.push(migration.relative);
  filesChanged.push(path.join(targetRepo, migration.relative));
  evidence.push(`migration draft created: ${migration.relative}`);
  evidence.push(`migration safety decision: ${migration.safetyDecision}`);

  const docsUpdate = updateImportTipsSecurityDocs(migration.relative);
  schedulerFiles.push("docs/import-reddit-tips-security.md");
  filesChanged.push(path.join(targetRepo, "docs/import-reddit-tips-security.md"));
  evidence.push(`docs update: ${docsUpdate}`);

  const checks = runSchedulerLocalChecks();
  if (!checks.ok) return checks.result;
  evidence.push(`local checks: ${checks.summary}`);

  const commit = run(
    path.join(LIBRARY_ROOT, "scripts", "committer"),
    [
      "--repo",
      targetRepo,
      "--message",
      SCHEDULER_COMMIT_MESSAGE,
      "--files",
      migration.relative,
      "docs/import-reddit-tips-security.md",
    ],
    { timeout: 120000 },
  );
  if (commit.code !== 0) {
    return schedulerDraftBlocked("Blocked: exact-file commit failed", firstLine(commit.stderr || commit.stdout));
  }
  const commitHash = run("git", ["-C", targetRepo, "rev-parse", "--short", "HEAD"]);
  const commitResult = commitHash.code === 0
    ? `commit ${commitHash.stdout.trim()} created`
    : "commit created; hash unavailable";
  evidence.push(`commit result: ${commitResult}`);

  const gh = prepareSchedulerGhEnv();
  if (!gh.ok) return gh.result;

  const setupGit = run("gh", ["auth", "setup-git", "--hostname", "github.com"], {
    env: gh.env,
    allowFailure: true,
  });
  actions.push(`gh auth setup-git: ${setupGit.code === 0 ? "ok" : "nonfatal failure"}`);

  const push = run("git", ["-C", targetRepo, "push", "-u", "origin", SCHEDULER_BRANCH], {
    env: { ...gh.env, GIT_TERMINAL_PROMPT: "0" },
    timeout: 120000,
  });
  if (push.code !== 0) {
    return schedulerDraftBlocked("Blocked: scheduler branch push failed", firstLine(push.stderr || push.stdout));
  }
  evidence.push(`push result: pushed origin/${SCHEDULER_BRANCH}`);

  const existingPr = viewSchedulerPr(gh.env);
  let prUrl = "";
  let prResult = "";
  if (existingPr.ok) {
    prUrl = existingPr.url;
    prResult = "existing PR confirmed; no duplicate PR created";
  } else {
    writeSchedulerPrBody();
    const createPr = run(
      "gh",
      [
        "pr",
        "create",
        "--repo",
        EXPECTED_GITHUB_REPO,
        "--base",
        "main",
        "--head",
        SCHEDULER_BRANCH,
        "--title",
        SCHEDULER_PR_TITLE,
        "--body-file",
        SCHEDULER_PR_BODY_PATH,
      ],
      { env: gh.env },
    );
    if (createPr.code !== 0) {
      const afterFailure = viewSchedulerPr(gh.env);
      if (!afterFailure.ok) {
        return schedulerDraftBlocked("Blocked: scheduler PR creation failed", firstLine(createPr.stderr || createPr.stdout));
      }
      prUrl = afterFailure.url;
      prResult = "PR exists after create failure; treating as confirmed";
    } else {
      prUrl = createPr.stdout.trim();
      prResult = "PR created";
    }
  }
  evidence.push(`PR result: ${prResult}`);
  evidence.push("commands not run: remote supabase secrets set, function deploy, db push, migration apply, SQL execution, scheduler mutation, Edge Function invoke, production endpoint curl, PR merge");

  const finalState = collectSchedulerDraftRepoState("final");
  if (finalState.ok) {
    evidence.push(`final branch: ${finalState.data.branch}`);
    evidence.push(`final git status: ${finalState.data.status}`);
  }

  return {
    finalStatus: "Scheduler migration PR opened, not merged",
    ledgerStatus: "Scheduler migration PR opened, not merged",
    summary: "guarded scheduler migration draft was created, local checks passed, exact-file commit succeeded, branch was pushed, and PR was created or confirmed; no remote Supabase mutation was run",
    nextPermission: "approve scheduler migration PR readiness/merge decision",
    nextSkill: "github-handoff-skill / scheduler migration PR readiness",
    prUrl,
    branch: SCHEDULER_BRANCH,
    schedulerDraftPr: buildSchedulerDraftPrReport({
      branchResult: `switched ${SCHEDULER_BRANCH} from origin/main`,
      schedulerEvidence: schedulerEvidence.summary,
      migrationPath: migration.relative,
      safetyDecision: migration.safetyDecision,
      localChecks: checks.summary,
      commitResult,
      pushResult: `pushed origin/${SCHEDULER_BRANCH}`,
      prResult,
      prUrl,
      includedFiles: schedulerFiles,
      excludedFiles: ["evidence/", "supabase/.temp/"],
      finalStatus: "Scheduler migration PR opened, not merged",
    }),
    localState: finalState.ok ? {
      branch: finalState.data.branch,
      status: finalState.data.status,
      log: finalState.data.log,
    } : null,
    exitCode: 0,
  };
}

function collectSchedulerDraftRepoState(phase) {
  if (!fs.existsSync(targetRepo)) {
    return {
      ok: false,
      result: schedulerDraftBlocked("Blocked: target repo missing", `target repo does not exist: ${targetRepo}`),
    };
  }

  const status = run("git", ["-C", targetRepo, "status", "--short"]);
  const branch = run("git", ["-C", targetRepo, "branch", "--show-current"]);
  const log = run("git", ["-C", targetRepo, "log", "--oneline", "-8"]);
  const remote = run("git", ["-C", targetRepo, "remote", "-v"]);

  if ([status, branch, log, remote].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: schedulerDraftBlocked("Blocked: repo evidence failed", `one or more ${phase} repo evidence commands failed`),
    };
  }

  const data = {
    phase,
    status: status.stdout.trim() || "clean",
    branch: branch.stdout.trim() || "(detached)",
    log: log.stdout.trim(),
    remote: remote.stdout.trim(),
  };
  evidence.push(`${phase} branch: ${data.branch}`);
  evidence.push(`${phase} git status: ${data.status}`);
  evidence.push(`${phase} recent log: ${firstLine(data.log)}`);
  evidence.push(`${phase} remote: ${firstLine(data.remote)}`);
  return { ok: true, data };
}

function inspectSchedulerSource() {
  const migrationsDir = path.join(targetRepo, "supabase", "migrations");
  const docsDir = path.join(targetRepo, "docs");
  const pattern = "import-reddit-tips|cron.schedule|cron.unschedule|cron.alter_job|pg_cron|net.http_post|http_post|apikey|Authorization|Bearer|x-import-reddit-tips-secret|IMPORT_REDDIT_TIPS_SECRET|vault";
  const grep = run("grep", ["-RniE", pattern, migrationsDir, docsDir], {
    allowFailure: true,
  });
  const hits = String(grep.stdout || "")
    .split(/\r?\n/)
    .map((line) => relativizeLine(targetRepo, line.trim()))
    .filter(Boolean);
  const scheduler = classifySupabaseScheduler(hits);
  const safeSecretStorage = hits.some((line) => /supabase\/migrations/i.test(line) && /\bvault\b|vault\.|decrypted_secret|secrets\.|current_setting\(/i.test(line));
  const existingHeader = hits.some((line) => /x-import-reddit-tips-secret/i.test(line) && /supabase\/migrations/i.test(line));
  return {
    hits,
    scheduler,
    safeSecretStorage,
    existingHeader,
    summary: [
      scheduler.summary,
      safeSecretStorage ? "possible SQL secret-storage pattern found and needs review" : "no proven safe pg_cron SQL secret-storage path found",
      existingHeader ? "a migration already mentions x-import-reddit-tips-secret" : "no migration evidence found for x-import-reddit-tips-secret header",
    ].join(" "),
  };
}

function createSchedulerMigrationDraft(schedulerEvidence) {
  const migrationsDir = path.join(targetRepo, "supabase", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`missing migrations directory: ${migrationsDir}`);
  }
  const filename = `${timestampForMigration()}_update_import_reddit_tips_scheduler_secret.sql`;
  const relative = path.join("supabase", "migrations", filename).replaceAll("\\", "/");
  const full = path.join(targetRepo, relative);
  if (fs.existsSync(full)) {
    throw new Error(`migration file already exists: ${relative}`);
  }

  const jobName = schedulerEvidence.scheduler.jobName || "import-reddit-tips-daily";
  const safetyDecision = schedulerEvidence.safeSecretStorage
    ? "guarded draft created; possible secret-storage pattern still requires human review before applying"
    : "guarded non-executable draft created because no safe pg_cron secret-storage path was proven";
  const hits = schedulerEvidence.hits.slice(0, 12).map((line) => `-- - ${line}`).join("\n") || "-- - No scheduler source hits captured.";
  const content = `-- Guarded local draft: update import-reddit-tips scheduler secret header.
--
-- REVIEW REQUIRED BEFORE APPLYING:
-- This migration draft is intentionally non-executable.
-- Do not apply it until the scheduler secret storage path is confirmed.
-- Do not hardcode IMPORT_REDDIT_TIPS_SECRET in SQL, migrations, docs, or source.
-- Remote Supabase secret setup, scheduler secret storage, migration application,
-- function deployment, and runtime verification are separate permission gates.
--
-- Existing scheduled job identified from source review:
-- - ${jobName}
--
-- Required scheduler behavior after import-reddit-tips hardening:
-- - scheduled calls must include the x-import-reddit-tips-secret header
-- - the header value must come from a reviewed secure secret-storage path
-- - anon/apikey/Authorization-only scheduling is insufficient after hardening
--
-- Source evidence reviewed:
${hits}
--
-- Draft shape once a safe secret-storage path is approved:
--
-- select cron.unschedule('${jobName}');
--
-- select cron.schedule(
--   '${jobName}',
--   '<reviewed schedule expression>',
--   $$
--   select net.http_post(
--     url := '<existing import-reddit-tips URL>',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'apikey', '<existing public anon key source if still required>',
--       'Authorization', '<existing bearer anon key source if still required>',
--       'x-import-reddit-tips-secret', '<secret>'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- Safety decision: ${safetyDecision}.
`;
  fs.writeFileSync(full, content, { flag: "wx" });
  return { relative, full, safetyDecision };
}

function updateImportTipsSecurityDocs(migrationRelativePath) {
  const docsFile = path.join(targetRepo, "docs", "import-reddit-tips-security.md");
  let text = fs.existsSync(docsFile) ? fs.readFileSync(docsFile, "utf8") : "# Import Reddit Tips Security\n";
  const section = `\n## Scheduler Migration Status\n\n- Local scheduler migration draft created: \`${migrationRelativePath}\`.\n- The draft has not been applied.\n- \`IMPORT_REDDIT_TIPS_SECRET\` must not be hardcoded in SQL, migrations, docs, or source.\n- The old anon/apikey-only scheduler is insufficient after \`import-reddit-tips\` hardening.\n- Remote secret setup, scheduler secret storage, migration application, function deploy, and runtime verification remain separate gates.\n`;

  if (/## Scheduler Migration Status[\s\S]*?(?=\n## |\s*$)/.test(text)) {
    text = text.replace(/## Scheduler Migration Status[\s\S]*?(?=\n## |\s*$)/, section.trimEnd());
  } else {
    if (!text.endsWith("\n")) text += "\n";
    text += section;
  }
  fs.mkdirSync(path.dirname(docsFile), { recursive: true });
  fs.writeFileSync(docsFile, text.replace(/\n*$/, "\n"));
  return "scheduler migration status section updated";
}

function runSchedulerLocalChecks() {
  const status = run("git", ["-C", targetRepo, "status", "--short"]);
  const diffStat = run("git", ["-C", targetRepo, "diff", "--stat"]);
  const diffCheck = run("git", ["-C", targetRepo, "diff", "--check"], { allowFailure: true });
  const secretScan = run(
    "grep",
    [
      "-RniE",
      "IMPORT_REDDIT_TIPS_SECRET=.*[A-Za-z0-9_-]{12,}|x-import-reddit-tips-secret.*[A-Za-z0-9_-]{12,}|SUPABASE_SERVICE_ROLE_KEY=.*[A-Za-z0-9_-]{12,}",
      path.join(targetRepo, "supabase", "migrations"),
      path.join(targetRepo, "docs"),
    ],
    { allowFailure: true },
  );

  if (status.code !== 0 || diffStat.code !== 0) {
    return {
      ok: false,
      result: schedulerDraftBlocked("Blocked: local check failed", "git status or diff stat failed"),
    };
  }
  if (diffCheck.code !== 0) {
    return {
      ok: false,
      result: schedulerDraftBlocked("Blocked: git diff --check failed", firstLine(diffCheck.stderr || diffCheck.stdout)),
    };
  }
  if (secretScan.stdout.trim()) {
    return {
      ok: false,
      result: schedulerDraftBlocked("Blocked: secret-pattern scan found potential hardcoded value", "secret-pattern scan over docs/migrations returned one or more matches"),
    };
  }

  return {
    ok: true,
    summary: [
      `git status: ${status.stdout.trim() || "clean"}`,
      `diff stat: ${diffStat.stdout.trim() || "(no diff)"}`,
      "git diff --check passed",
      "secret-pattern scan over docs/migrations passed",
    ].join("; "),
  };
}

function prepareSchedulerGhEnv() {
  const envFile = loadEnvFile(DEFAULT_ENV_FILE);
  const ghToken = envFile.GH_TOKEN || process.env.GH_TOKEN || "";
  const githubTokenPresent = Boolean(envFile.GITHUB_TOKEN || process.env.GITHUB_TOKEN);
  const ghTokenPresent = Boolean(ghToken);
  evidence.push(`GH_TOKEN presence: ${ghTokenPresent ? "set" : "not set"}`);
  evidence.push(`GITHUB_TOKEN presence: ${githubTokenPresent ? "set" : "not set"}`);

  if (!ghTokenPresent) {
    return {
      ok: false,
      result: {
        finalStatus: "NEEDS JOHN",
        ledgerStatus: "Needs John token replacement",
        summary: "GH_TOKEN is not set in runtime env",
        nextPermission: "provide valid local GH_TOKEN without pasting it into chat",
        nextSkill: "github-auth-gate-skill",
        schedulerDraftPr: buildSchedulerDraftPrReport({
          branchResult: SCHEDULER_BRANCH,
          schedulerEvidence: "completed before GitHub auth gate",
          migrationPath: "created before GitHub auth gate",
          safetyDecision: "guarded local draft only",
          localChecks: "passed before GitHub auth gate",
          commitResult: "completed before GitHub auth gate",
          pushResult: "not run",
          prResult: "not run",
          prUrl: "",
          includedFiles: [],
          excludedFiles: ["evidence/", "supabase/.temp/"],
          finalStatus: "NEEDS JOHN",
        }),
        exitCode: 2,
      },
    };
  }

  const ghEnv = buildGhEnv(ghToken);
  const user = run("gh", ["api", "user", "--jq", ".login"], { env: ghEnv });
  if (user.code !== 0 || user.stdout.trim() !== EXPECTED_GITHUB_USER) {
    return {
      ok: false,
      result: schedulerDraftBlocked("Needs John token replacement", `GH_TOKEN user check failed: ${firstLine(user.stderr || user.stdout)}`),
    };
  }
  evidence.push(`GH_TOKEN user: ${EXPECTED_GITHUB_USER}`);

  const repoView = run(
    "gh",
    ["repo", "view", EXPECTED_GITHUB_REPO, "--json", "nameWithOwner,visibility,viewerPermission"],
    { env: ghEnv },
  );
  if (repoView.code !== 0) {
    return {
      ok: false,
      result: schedulerDraftBlocked("Needs John token permission fix", `repo view failed: ${firstLine(repoView.stderr || repoView.stdout)}`),
    };
  }
  let repoJson;
  try {
    repoJson = JSON.parse(repoView.stdout);
  } catch (error) {
    return {
      ok: false,
      result: schedulerDraftBlocked("Blocked: repo view parse failed", `could not parse repo view JSON: ${error.message}`),
    };
  }
  if (repoJson.nameWithOwner !== EXPECTED_GITHUB_REPO || !["WRITE", "MAINTAIN", "ADMIN"].includes(repoJson.viewerPermission)) {
    return {
      ok: false,
      result: schedulerDraftBlocked("Needs John token permission fix", `repo access check returned ${repoJson.nameWithOwner || "unknown"} ${repoJson.viewerPermission || "unknown"}`),
    };
  }
  evidence.push(`repo access: ${repoJson.nameWithOwner} ${repoJson.viewerPermission}`);
  return { ok: true, env: ghEnv };
}

function writeSchedulerPrBody() {
  const body = `## Summary

* Adds a local scheduler migration draft for \`import-reddit-tips\`
* Documents that scheduled calls must include \`x-import-reddit-tips-secret\`
* Preserves the safety rule that \`IMPORT_REDDIT_TIPS_SECRET\` must not be hardcoded in SQL
* Keeps remote secret setup, scheduler application, deploy, and runtime checks as separate gates

## Validation

* \`git diff --check\` passed
* secret-pattern scan over docs/migrations passed
* exact-file commit used
* no secrets printed or committed

## Known Caveats

* migration is a guarded local draft unless a safe scheduler secret-storage path is confirmed
* no remote Supabase secret was set
* no migration was applied
* no function was deployed
* no production endpoint was called

## Next Gates

* approve reviewed scheduler application path
* approve remote \`IMPORT_REDDIT_TIPS_SECRET\` setup
* approve function deploy
* approve runtime verification
`;
  fs.writeFileSync(SCHEDULER_PR_BODY_PATH, body);
  filesChanged.push(SCHEDULER_PR_BODY_PATH);
}

function buildSchedulerDraftPrReport({
  branchResult,
  schedulerEvidence,
  migrationPath,
  safetyDecision,
  localChecks,
  commitResult,
  pushResult,
  prResult,
  prUrl,
  includedFiles,
  excludedFiles,
  finalStatus,
}) {
  return {
    branchResult,
    schedulerEvidence,
    migrationPath,
    safetyDecision,
    localChecks,
    commitResult,
    pushResult,
    prResult,
    prUrl,
    includedFiles,
    excludedFiles,
    commandsNotRun: [
      `supabase secrets set ${REQUIRED_IMPORT_SECRET}=<redacted>`,
      `npx supabase functions deploy ${IMPORT_FUNCTION_NAME}`,
      "supabase db push",
      "migration apply",
      "SQL execution",
      "scheduler mutation",
      "Edge Function invoke",
      "production endpoint curl",
      "PR merge",
    ],
    finalStatus,
  };
}

function schedulerDraftBlocked(ledgerStatus, summary) {
  return {
    finalStatus: ledgerStatus.startsWith("Needs John") ? "NEEDS JOHN" : "BLOCKED",
    ledgerStatus,
    summary,
    nextPermission: "manual review of scheduler draft workflow",
    nextSkill: "coding-workflow-orchestrator-skill",
    schedulerDraftPr: buildSchedulerDraftPrReport({
      branchResult: "blocked before completion",
      schedulerEvidence: "see evidence log",
      migrationPath: "not completed",
      safetyDecision: "not completed",
      localChecks: "not completed",
      commitResult: "not completed",
      pushResult: "not run",
      prResult: "not run",
      prUrl: "",
      includedFiles: [],
      excludedFiles: ["evidence/", "supabase/.temp/"],
      finalStatus: ledgerStatus,
    }),
    exitCode: ledgerStatus.startsWith("Needs John") ? 2 : 1,
  };
}

module.exports = {
  runDeploymentPlan,
  runSupabasePreflight,
  runSupabaseToolingAuth,
  runSupabaseLinkSecretReadiness,
  runSupabaseSecretFunctionDeploy,
  runRuntimeNegativeVerification,
  runSchedulerApplicationDecision,
  runSchedulerVaultDesignApply,
  runSchedulerDraftPr,
  collectSchedulerDraftRepoState,
  inspectSchedulerSource,
  createSchedulerMigrationDraft,
  updateImportTipsSecurityDocs,
  runSchedulerLocalChecks,
  prepareSchedulerGhEnv,
  writeSchedulerPrBody,
  buildSchedulerDraftPrReport,
  schedulerDraftBlocked,
};
