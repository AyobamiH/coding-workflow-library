"use strict";

// Runtime verification, scheduler decisions, Vault design, and PR orchestration.

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

// Cross-part calls stay late-bound so the run-next registry remains cycle-safe.
const buildSchedulerDraftPrReport = runtime.lazy("buildSchedulerDraftPrReport");
const createSchedulerMigrationDraft = runtime.lazy("createSchedulerMigrationDraft");
const inspectSchedulerSource = runtime.lazy("inspectSchedulerSource");
const prepareSchedulerGhEnv = runtime.lazy("prepareSchedulerGhEnv");
const runSchedulerLocalChecks = runtime.lazy("runSchedulerLocalChecks");
const schedulerDraftBlocked = runtime.lazy("schedulerDraftBlocked");
const updateImportTipsSecurityDocs = runtime.lazy("updateImportTipsSecurityDocs");
const writeSchedulerPrBody = runtime.lazy("writeSchedulerPrBody");

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

module.exports = {
  runRuntimeNegativeVerification,
  runSchedulerApplicationDecision,
  runSchedulerVaultDesignApply,
  runSchedulerDraftPr,
  collectSchedulerDraftRepoState,
};
