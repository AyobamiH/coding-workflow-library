"use strict";

// Scheduler source inspection, local drafting, checks, PR body, and blockers.

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
  inspectSchedulerSource,
  createSchedulerMigrationDraft,
  updateImportTipsSecurityDocs,
  runSchedulerLocalChecks,
  prepareSchedulerGhEnv,
  writeSchedulerPrBody,
  buildSchedulerDraftPrReport,
  schedulerDraftBlocked,
};
