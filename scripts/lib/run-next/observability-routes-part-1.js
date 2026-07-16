"use strict";

// Zero-output investigation, observability patch, PR recovery, and deploy routing.

const runtime = require("./runtime-context");
const { fs, path, LIBRARY_ROOT, DEFAULT_ENV_FILE, EXPECTED_GITHUB_REPO, OBSERVABILITY_PR_NUMBER, OBSERVABILITY_PR_FILES, OBSERVABILITY_DEPLOYED_AT, OBSERVABILITY_FIRST_AUTOMATIC_RUN_AT, OBSERVABILITY_TELEMETRY_MARKER, IMPORT_FUNCTION_NAME, IMPORT_FUNCTION_DIR, REQUIRED_IMPORT_SECRET, EXPECTED_SUPABASE_PROJECT_REF, targetRepo, dryRun, evidence, actions, filesChanged } = runtime.pick(["fs","path","LIBRARY_ROOT","DEFAULT_ENV_FILE","EXPECTED_GITHUB_REPO","OBSERVABILITY_PR_NUMBER","OBSERVABILITY_PR_FILES","OBSERVABILITY_DEPLOYED_AT","OBSERVABILITY_FIRST_AUTOMATIC_RUN_AT","OBSERVABILITY_TELEMETRY_MARKER","IMPORT_FUNCTION_NAME","IMPORT_FUNCTION_DIR","REQUIRED_IMPORT_SECRET","EXPECTED_SUPABASE_PROJECT_REF","targetRepo","dryRun","evidence","actions","filesChanged"]);
const main = runtime.lazy("main");
const collectRuntimeNegativeEnvShape = runtime.lazy("collectRuntimeNegativeEnvShape");
const sqlIdentifier = runtime.lazy("sqlIdentifier");
const collectScheduledRunMonitoringRepoEvidence = runtime.lazy("collectScheduledRunMonitoringRepoEvidence");
const collectScheduledRunMonitoringEnvShape = runtime.lazy("collectScheduledRunMonitoringEnvShape");
const checkScheduledRunMonitoringEnv = runtime.lazy("checkScheduledRunMonitoringEnv");
const collectScheduledRunSchedulerMetadata = runtime.lazy("collectScheduledRunSchedulerMetadata");
const parseScheduledRunHistoryRows = runtime.lazy("parseScheduledRunHistoryRows");
const formatScheduledRunHistoryRow = runtime.lazy("formatScheduledRunHistoryRow");
const checkSchedulerVaultSqlTooling = runtime.lazy("checkSchedulerVaultSqlTooling");
const runPsqlRedacted = runtime.lazy("runPsqlRedacted");
const loadEnvFile = runtime.lazy("loadEnvFile");
const run = runtime.lazy("run");
const sanitizeSensitive = runtime.lazy("sanitizeSensitive");
const sqlQuote = runtime.lazy("sqlQuote");
const firstLine = runtime.lazy("firstLine");
const firstNonEmptyLine = runtime.lazy("firstNonEmptyLine");

// Cross-part calls stay late-bound so the run-next registry remains cycle-safe.
const buildZeroOutputInvestigationSkeleton = runtime.lazy("buildZeroOutputInvestigationSkeleton");
const collectObservabilityDeployRepoPreflight = runtime.lazy("collectObservabilityDeployRepoPreflight");
const collectZeroOutputDatabaseEvidence = runtime.lazy("collectZeroOutputDatabaseEvidence");
const nextDailyUtcRun = runtime.lazy("nextDailyUtcRun");
const observabilityDeployBlocked = runtime.lazy("observabilityDeployBlocked");
const zeroOutputBlocked = runtime.lazy("zeroOutputBlocked");
const zeroOutputCommandsNotRun = runtime.lazy("zeroOutputCommandsNotRun");

function runZeroOutputPipelineInvestigation(active) {
  const source = path.join(targetRepo, IMPORT_FUNCTION_DIR, "index.ts");
  const helper = path.join(LIBRARY_ROOT, "scripts", "pipeline-diagnostics");
  if (dryRun) {
    actions.push("would inspect the target repo and import function without editing it");
    actions.push("would trace configured sources, fetches, filters, dedupe, normalisation, insert preparation, insert, and response counters");
    actions.push("would load local env for presence only and use the DB URL only for read-only metadata queries");
    actions.push("would inspect retained pg_net response counters if available and report function logs as NOT VERIFIED when unsupported");
    actions.push("would not invoke the function, call its endpoint, fetch Reddit, write SQL, mutate scheduler/Vault, deploy, migrate, or edit Wagging without a proven deterministic defect");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: active.currentStatus,
      summary: "zero-output investigation would run source tracing and read-only metadata checks, then update only the selected lane",
      nextPermission: "zero-output-investigation",
      nextSkill: "route-trace-skill / runtime-verification-skill / error-evidence-skill",
      zeroOutputInvestigation: buildZeroOutputInvestigationSkeleton(),
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo) || !fs.existsSync(source)) {
    return zeroOutputBlocked("target repo or import function source is missing");
  }
  const repo = collectScheduledRunMonitoringRepoEvidence(targetRepo);
  if (!repo.ok) return zeroOutputBlocked(repo.result.summary || "target repo state is not safe for read-only investigation");

  const sourceRun = run(helper, ["--source", source, "--json"], { cwd: LIBRARY_ROOT });
  if (sourceRun.code !== 0) return zeroOutputBlocked(`source pipeline trace failed: ${firstLine(sourceRun.stderr || sourceRun.stdout)}`);
  let sourceTrace;
  try {
    sourceTrace = JSON.parse(sourceRun.stdout);
  } catch (error) {
    return zeroOutputBlocked(`source pipeline trace returned invalid JSON: ${error.message}`);
  }

  const env = loadEnvFile(DEFAULT_ENV_FILE);
  const envPresence = {
    SUPABASE_ACCESS_TOKEN: Boolean(env.SUPABASE_ACCESS_TOKEN),
    SUPABASE_PROJECT_REF: Boolean(env.SUPABASE_PROJECT_REF),
    SUPABASE_DB_URL: Boolean(env.SUPABASE_DB_URL),
    IMPORT_REDDIT_TIPS_SECRET: Boolean(env[REQUIRED_IMPORT_SECRET]),
  };
  for (const [key, value] of Object.entries(envPresence)) evidence.push(`zero-output env ${key}: ${value ? "set" : "not set"}`);
  if (!env.SUPABASE_DB_URL) return zeroOutputBlocked("SUPABASE_DB_URL is not set", { sourceTrace, envPresence });

  const sqlTooling = checkSchedulerVaultSqlTooling();
  if (!sqlTooling.ok) return zeroOutputBlocked(sqlTooling.summary, { sourceTrace, envPresence, sqlTooling: sqlTooling.report });

  const database = collectZeroOutputDatabaseEvidence(env);
  if (!database.ok) return zeroOutputBlocked(database.summary, { sourceTrace, envPresence, sqlTooling: sqlTooling.report, database });

  const configuredCount = sourceTrace.configured_sources ? sourceTrace.configured_sources.count : 0;
  const petTipsCount = database.petTipsCount;
  const counters = {
    candidates: 0,
    inserted: 0,
    provenance: "user-provided evidence from the previously approved controlled scheduler-path response",
  };
  const classification = "EVIDENCE_INSUFFICIENT";
  const firstNonZero = `in-code source configuration contains ${configuredCount} subreddit entries`;
  const firstZero = "post-filter candidates counter is 0";
  const rootCauseEvidence = [
    `configured source list count=${configuredCount}`,
    "response candidates=0 and inserted=0 from prior controlled-run evidence",
    `pet_tips count=${petTipsCount}; database deduplication cannot remove candidates when the table is empty`,
    "candidates is assigned after upstream fetch and score/body/UK-suitability filters",
    "raw allPosts and per-filter attrition are not counted in the response",
  ];
  const remaining = [
    "raw records returned by each upstream fetch",
    "score-filter attrition",
    "body-length-filter attrition",
    "UK-suitability-filter attrition",
    "safe per-subreddit upstream status categories for the 18 and 19 June runs",
    "function logs, because the installed Supabase CLI functions command exposes no logs subcommand",
  ];
  evidence.push(`zero-output configured sources: ${configuredCount}`);
  evidence.push(`zero-output database pet_tips count: ${petTipsCount}`);
  evidence.push(`zero-output classification: ${classification}`);
  evidence.push(`zero-output first proven non-zero stage: ${firstNonZero}`);
  evidence.push(`zero-output first proven zero stage: ${firstZero}`);

  const report = {
    repo: repo.data,
    sourceTrace,
    envPresence,
    sqlTooling: sqlTooling.report,
    database,
    functionLogs: "NOT VERIFIED: Supabase CLI 2.107.0 functions help lists no logs subcommand",
    counters,
    firstNonZero,
    firstZero,
    classification,
    rootCauseEvidence,
    remaining,
    productFilesUpdated: [],
    commandsNotRun: zeroOutputCommandsNotRun(),
  };

  return {
    finalStatus: "Zero-output pipeline investigation blocked",
    ledgerStatus: "Zero-output pipeline investigation blocked",
    summary: "EVIDENCE_INSUFFICIENT: zero is proven at the post-filter candidates stage, but available evidence cannot distinguish upstream-empty from filter-excluded-all",
    nextPermission: "provide retained read-only function logs with per-stage counts, or approve a separate observability patch plan",
    nextSkill: "route-trace-skill / runtime-verification-skill / error-evidence-skill",
    zeroOutputInvestigation: report,
    exitCode: 1,
  };
}

function runZeroOutputObservabilityPatch(active) {
  const expectedFiles = [
    "docs/import-reddit-tips-security.md",
    "supabase/functions/import-reddit-tips/index.ts",
    "supabase/functions/import-reddit-tips/pipelineTelemetry.ts",
    "supabase/functions/import-reddit-tips/pipelineTelemetry.test.ts",
  ];

  if (dryRun) {
    actions.push("would verify the local Wagging observability patch without staging or committing");
    actions.push("would require exact expected files only, plus excluded evidence/ and supabase/.temp/");
    actions.push("would run git diff --check and focused telemetry tests");
    actions.push("would update only the selected lane to Zero-output observability patch ready for review");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: active.currentStatus,
      summary: "zero-output observability patch preparation would validate local count-only telemetry and stop before GitHub handoff",
      nextPermission: "zero-output-observability-patch",
      nextSkill: "runtime-verification-skill / route-trace-skill / error-evidence-skill",
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    return {
      finalStatus: "Zero-output observability patch blocked",
      ledgerStatus: "Zero-output observability patch blocked",
      summary: "target repo is missing",
      nextPermission: "restore target repo path and retry local preparation",
      exitCode: 1,
    };
  }

  const statusRun = run("git", ["-C", targetRepo, "status", "--short"], { allowFailure: true });
  if (statusRun.code !== 0) {
    return zeroOutputObservabilityPatchBlocked(`git status failed: ${firstLine(statusRun.stderr || statusRun.stdout)}`);
  }

  const lines = statusRun.stdout.split(/\r?\n/).filter(Boolean);
  const allowedLines = new Set([
    " M docs/import-reddit-tips-security.md",
    " M supabase/functions/import-reddit-tips/index.ts",
    "?? evidence/",
    "?? supabase/.temp/",
    "?? supabase/functions/import-reddit-tips/pipelineTelemetry.test.ts",
    "?? supabase/functions/import-reddit-tips/pipelineTelemetry.ts",
  ]);
  const unexpected = lines.filter((line) => !allowedLines.has(line));
  if (unexpected.length) {
    return zeroOutputObservabilityPatchBlocked(`unexpected target repo changes: ${unexpected.join("; ")}`);
  }

  for (const file of expectedFiles) {
    if (!fs.existsSync(path.join(targetRepo, file))) {
      return zeroOutputObservabilityPatchBlocked(`expected observability file missing: ${file}`);
    }
  }

  const diffCheck = run("git", ["-C", targetRepo, "diff", "--check"], { allowFailure: true });
  evidence.push(`Wagging diff check exit: ${diffCheck.code}`);
  if (diffCheck.code !== 0) {
    return zeroOutputObservabilityPatchBlocked(`git diff --check failed: ${firstLine(diffCheck.stderr || diffCheck.stdout)}`);
  }

  const focusedTests = run("npm", ["test", "--", "--run", "supabase/functions/import-reddit-tips/pipelineTelemetry.test.ts"], {
    cwd: targetRepo,
    allowFailure: true,
  });
  evidence.push(`Wagging focused telemetry tests exit: ${focusedTests.code}`);
  if (focusedTests.code !== 0) {
    return zeroOutputObservabilityPatchBlocked(`focused telemetry tests failed: ${firstLine(focusedTests.stderr || focusedTests.stdout)}`);
  }

  for (const file of expectedFiles) filesChanged.push(file);
  evidence.push("count-only telemetry helper and tests are present");
  evidence.push("normal response remains business counters only");
  evidence.push("no deploy, endpoint invocation, SQL write, scheduler mutation, or Git staging occurred");

  return {
    finalStatus: "Zero-output observability patch ready for review",
    ledgerStatus: "Zero-output observability patch ready for review",
    summary: "local count-only telemetry patch validated and ready for exact-file GitHub handoff",
    nextPermission: "exact-file Wagging commit, branch push, and PR creation",
    nextSkill: "github-handoff-skill",
    exitCode: 0,
  };
}

function zeroOutputObservabilityPatchBlocked(summary) {
  return {
    finalStatus: "Zero-output observability patch blocked",
    ledgerStatus: "Zero-output observability patch blocked",
    summary,
    nextPermission: "fix local observability patch or approve a narrower preparation retry",
    nextSkill: "build-verify-skill / route-trace-skill",
    exitCode: 1,
  };
}

function runObservabilityPrRecovery() {
  if (dryRun) {
    actions.push("would inspect PR #13 files, commits, mergeability, check rollup, and branch protection metadata");
    actions.push("would classify the failed Cloudflare Pages check before any merge decision");
    actions.push("would rerun the Wagging local quality gate with inert CI public Supabase placeholders");
    actions.push("would merge PR #13 only when quality passes, PR files are exact, main is unprotected, and GitHub reports the PR mergeable");
    actions.push("would update only the selected lane to Zero-output observability patch merged, not deployed");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Zero-output observability patch blocked",
      summary: "observability PR recovery would classify the external check and merge only if it is advisory and unrelated",
      nextPermission: "observability-pr-recovery",
      nextSkill: "error-evidence-skill / github-handoff-skill",
      exitCode: 0,
    };
  }

  const repoState = collectObservabilityTargetRepoState();
  if (!repoState.ok) return repoState.result;

  const pr = collectObservabilityPrEvidence();
  if (!pr.ok) return observabilityPrRecoveryBlocked(pr.summary, pr.partial);

  const expectedFiles = [...OBSERVABILITY_PR_FILES].sort();
  const actualFiles = pr.data.files.map((file) => file.path).sort();
  const fileMismatch = JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles);
  if (fileMismatch) {
    return observabilityPrRecoveryBlocked(
      `PR #${OBSERVABILITY_PR_NUMBER} changed unexpected files: ${actualFiles.join(", ")}`,
      { repoState: repoState.data, pr: pr.data },
    );
  }

  const cloudflare = classifyObservabilityCloudflareCheck(pr.data);
  evidence.push(`Cloudflare check classification: ${cloudflare.classification}`);
  evidence.push(`Cloudflare check required: ${cloudflare.required ? "yes" : "no"}`);
  evidence.push(`Cloudflare check relation to PR: ${cloudflare.relationship}`);

  if (cloudflare.classification !== "IRRELEVANT_EXTERNAL_CHECK") {
    return observabilityPrRecoveryBlocked(cloudflare.summary, {
      repoState: repoState.data,
      pr: pr.data,
      cloudflare,
    });
  }

  const localCi = runObservabilityLocalQualityGate();
  if (!localCi.ok) {
    return observabilityPrRecoveryBlocked(localCi.summary, {
      repoState: repoState.data,
      pr: pr.data,
      cloudflare,
      localCi: localCi.summary,
    });
  }

  if (pr.data.state === "MERGED") {
    const finalView = run("gh", ["pr", "view", "--repo", EXPECTED_GITHUB_REPO, OBSERVABILITY_PR_NUMBER, "--json", "url,title,state,mergedAt,mergeCommit,headRefName,baseRefName"], {
      allowFailure: true,
    });
    let finalPr = pr.data;
    if (finalView.code === 0) {
      try {
        finalPr = JSON.parse(finalView.stdout);
        evidence.push(`PR #${OBSERVABILITY_PR_NUMBER} already merged at: ${finalPr.mergedAt || "unknown"}`);
        if (finalPr.mergeCommit && finalPr.mergeCommit.oid) evidence.push(`PR #${OBSERVABILITY_PR_NUMBER} merge commit: ${finalPr.mergeCommit.oid}`);
      } catch {
        evidence.push("PR already-merged view JSON parse failed");
      }
    }

    return {
      finalStatus: "Zero-output observability patch merged, not deployed",
      ledgerStatus: "Zero-output observability patch merged, not deployed",
      summary: "PR #13 was already merged; exact files, advisory Cloudflare classification, and local quality were verified before advancing",
      nextPermission: "deploy only import-reddit-tips",
      nextSkill: "supabase-function-deploy-skill",
      observabilityPrRecovery: {
        pr: {
          url: pr.data.url,
          stateBeforeMerge: pr.data.state,
          head: pr.data.headRefName,
          headSha: pr.data.headRefOid,
          mergeable: pr.data.mergeable,
          mergeStateStatus: pr.data.mergeStateStatus,
          files: actualFiles,
        },
        cloudflare,
        localCi: localCi.summary,
        finalPr,
      },
      exitCode: 0,
    };
  }

  if (pr.data.state !== "OPEN" || pr.data.isDraft) {
    return observabilityPrRecoveryBlocked(`PR #${OBSERVABILITY_PR_NUMBER} is not an open ready PR`, {
      repoState: repoState.data,
      pr: pr.data,
      cloudflare,
      localCi: localCi.summary,
    });
  }

  if (pr.data.mergeable !== "MERGEABLE") {
    return observabilityPrRecoveryBlocked(`PR #${OBSERVABILITY_PR_NUMBER} is not mergeable: ${pr.data.mergeable}`, {
      repoState: repoState.data,
      pr: pr.data,
      cloudflare,
      localCi: localCi.summary,
    });
  }

  if (cloudflare.required) {
    return observabilityPrRecoveryBlocked("Cloudflare Pages appears to be required; refusing to bypass it", {
      repoState: repoState.data,
      pr: pr.data,
      cloudflare,
      localCi: localCi.summary,
    });
  }

  const merge = run("gh", ["pr", "merge", "--repo", EXPECTED_GITHUB_REPO, OBSERVABILITY_PR_NUMBER, "--merge"], {
    allowFailure: true,
    timeout: 120000,
  });
  if (merge.code !== 0) {
    return observabilityPrRecoveryBlocked(`PR merge failed: ${firstLine(merge.stderr || merge.stdout)}`, {
      repoState: repoState.data,
      pr: pr.data,
      cloudflare,
      localCi: localCi.summary,
    });
  }
  evidence.push(`PR #${OBSERVABILITY_PR_NUMBER} merge command exited 0`);

  const finalView = run("gh", ["pr", "view", "--repo", EXPECTED_GITHUB_REPO, OBSERVABILITY_PR_NUMBER, "--json", "url,title,state,mergedAt,mergeCommit,headRefName,baseRefName"], {
    allowFailure: true,
  });
  let finalPr = null;
  if (finalView.code === 0) {
    try {
      finalPr = JSON.parse(finalView.stdout);
      evidence.push(`PR #${OBSERVABILITY_PR_NUMBER} final state: ${finalPr.state}`);
      if (finalPr.mergeCommit && finalPr.mergeCommit.oid) evidence.push(`PR #${OBSERVABILITY_PR_NUMBER} merge commit: ${finalPr.mergeCommit.oid}`);
    } catch {
      evidence.push("PR final view JSON parse failed after merge");
    }
  }

  return {
    finalStatus: "Zero-output observability patch merged, not deployed",
    ledgerStatus: "Zero-output observability patch merged, not deployed",
    summary: "PR #13 was merged after classifying the failed Cloudflare Pages preview as advisory and unrelated to the four-file Supabase observability patch",
    nextPermission: "deploy only import-reddit-tips",
    nextSkill: "supabase-function-deploy-skill",
    observabilityPrRecovery: {
      pr: {
        url: pr.data.url,
        stateBeforeMerge: pr.data.state,
        head: pr.data.headRefName,
        headSha: pr.data.headRefOid,
        mergeable: pr.data.mergeable,
        mergeStateStatus: pr.data.mergeStateStatus,
        files: actualFiles,
      },
      cloudflare,
      localCi: localCi.summary,
      finalPr,
    },
    exitCode: 0,
  };
}

function collectObservabilityTargetRepoState() {
  const status = run("git", ["-C", targetRepo, "status", "--short"], { allowFailure: true });
  const branch = run("git", ["-C", targetRepo, "branch", "--show-current"], { allowFailure: true });
  const log = run("git", ["-C", targetRepo, "log", "--oneline", "--decorate", "-10"], { allowFailure: true });
  if ([status, branch, log].some((item) => item.code !== 0)) {
    return { ok: false, result: observabilityPrRecoveryBlocked("target repo git inspection failed") };
  }

  const lines = status.stdout.split(/\r?\n/).filter(Boolean);
  const unexpected = lines.filter((line) => line !== "?? evidence/" && line !== "?? supabase/.temp/");
  if (unexpected.length) {
    return {
      ok: false,
      result: observabilityPrRecoveryBlocked(`unexpected target repo changes before PR recovery: ${unexpected.join("; ")}`),
    };
  }

  evidence.push(`Wagging repo branch before PR recovery: ${branch.stdout.trim() || "(detached)"}`);
  evidence.push(`Wagging repo status before PR recovery: ${status.stdout.trim() || "clean"}`);
  return {
    ok: true,
    data: {
      status: status.stdout.trim() || "clean",
      branch: branch.stdout.trim() || "(detached)",
      log: log.stdout.trim(),
    },
  };
}

function collectObservabilityPrEvidence() {
  const fields = "url,title,state,mergeable,mergeStateStatus,isDraft,headRefName,headRefOid,baseRefName,files,commits,statusCheckRollup,changedFiles";
  const view = run("gh", ["pr", "view", "--repo", EXPECTED_GITHUB_REPO, OBSERVABILITY_PR_NUMBER, "--json", fields], {
    allowFailure: true,
  });
  if (view.code !== 0) return { ok: false, summary: `PR view failed: ${firstLine(view.stderr || view.stdout)}` };
  let data;
  try {
    data = JSON.parse(view.stdout);
  } catch (error) {
    return { ok: false, summary: `PR view JSON parse failed: ${error.message}` };
  }
  evidence.push(`PR #${OBSERVABILITY_PR_NUMBER} state: ${data.state}`);
  evidence.push(`PR #${OBSERVABILITY_PR_NUMBER} mergeable: ${data.mergeable}`);
  evidence.push(`PR #${OBSERVABILITY_PR_NUMBER} merge state: ${data.mergeStateStatus}`);
  evidence.push(`PR #${OBSERVABILITY_PR_NUMBER} files: ${data.files.map((file) => file.path).join(", ")}`);
  return { ok: true, data };
}

function classifyObservabilityCloudflareCheck(pr) {
  const checks = Array.isArray(pr.statusCheckRollup) ? pr.statusCheckRollup : [];
  const cloudflare = checks.find((check) => check.name === "Cloudflare Pages");
  const quality = checks.find((check) => check.name === "quality");
  const branch = run("gh", ["api", `repos/${EXPECTED_GITHUB_REPO}/branches/main`], { allowFailure: true });
  let protectedBranch = true;
  let requiredContexts = [];
  if (branch.code === 0) {
    try {
      const branchData = JSON.parse(branch.stdout);
      protectedBranch = Boolean(branchData.protected);
      requiredContexts = branchData.protection && branchData.protection.required_status_checks
        ? (branchData.protection.required_status_checks.contexts || [])
        : [];
    } catch {
      protectedBranch = true;
    }
  }
  const required = protectedBranch && requiredContexts.includes("Cloudflare Pages");
  const qualityPassed = quality && quality.conclusion === "SUCCESS";
  const changedOnlyExpected = JSON.stringify(pr.files.map((file) => file.path).sort()) === JSON.stringify([...OBSERVABILITY_PR_FILES].sort());
  const appSurface = run("rg", [
    "-n",
    "pipelineTelemetry|from ['\\\"]\\.\\.?/.*pipelineTelemetry|supabase/functions/import-reddit-tips/pipelineTelemetry",
    path.join(targetRepo, "src"),
    path.join(targetRepo, "scripts"),
    path.join(targetRepo, "public"),
    path.join(targetRepo, "vite.config.ts"),
    path.join(targetRepo, "package.json"),
    path.join(targetRepo, ".github"),
  ], { allowFailure: true });
  const telemetryImportedByBuild = appSurface.code === 0 && appSurface.stdout.trim();
  const failureEvidence = cloudflare
    ? `${cloudflare.name}: ${cloudflare.conclusion || cloudflare.status}; details: ${cloudflare.detailsUrl || "none"}`
    : "Cloudflare Pages check not present";

  const classification = cloudflare &&
    cloudflare.conclusion === "FAILURE" &&
    qualityPassed &&
    changedOnlyExpected &&
    !required &&
    !telemetryImportedByBuild
    ? "IRRELEVANT_EXTERNAL_CHECK"
    : "EVIDENCE_INSUFFICIENT";

  return {
    identity: cloudflare ? {
      name: cloudflare.name,
      conclusion: cloudflare.conclusion,
      status: cloudflare.status,
      startedAt: cloudflare.startedAt,
      completedAt: cloudflare.completedAt,
      detailsUrl: cloudflare.detailsUrl,
    } : null,
    quality: quality ? `${quality.name}:${quality.conclusion}` : "quality check missing",
    required,
    protectedBranch,
    requiredContexts,
    relationship: telemetryImportedByBuild
      ? "telemetry files appear in the frontend build surface"
      : "PR files are Supabase Edge Function/docs/tests and telemetry helper is not imported by frontend build scripts",
    failureEvidence,
    classification,
    summary: classification === "IRRELEVANT_EXTERNAL_CHECK"
      ? "Cloudflare Pages failed as an advisory external preview; branch protection is off, quality/local CI pass, and PR #13 does not affect frontend build inputs"
      : "Cloudflare Pages failure could not be proven advisory and unrelated",
  };
}

function runObservabilityLocalQualityGate() {
  const env = {
    ...process.env,
    VITE_SUPABASE_URL: "https://example.invalid",
    VITE_SUPABASE_ANON_KEY: "ci-public-anon-key-placeholder",
  };
  const result = run("npm", ["run", "ci"], {
    cwd: targetRepo,
    env,
    allowFailure: true,
    timeout: 240000,
  });
  evidence.push(`Wagging local quality gate exit: ${result.code}`);
  if (result.code !== 0) {
    return { ok: false, summary: `local quality gate failed: ${firstLine(result.stderr || result.stdout)}` };
  }
  return { ok: true, summary: "npm run ci passed with inert CI public Supabase placeholders" };
}

function observabilityPrRecoveryBlocked(summary, partial = {}) {
  return {
    finalStatus: "Zero-output observability patch blocked",
    ledgerStatus: "Zero-output observability patch blocked",
    summary,
    nextPermission: "repair required external check or provide missing Cloudflare evidence",
    nextSkill: "error-evidence-skill / cloudflare-deploy-skill",
    observabilityPrRecovery: partial,
    exitCode: 1,
  };
}

function runZeroOutputObservabilityDeploy() {
  if (dryRun) {
    actions.push("would fetch origin and fast-forward local main after PR #13 merge");
    actions.push(`would verify ${IMPORT_FUNCTION_DIR}/pipelineTelemetry.ts is present on main`);
    actions.push("would verify Supabase CLI/project access using local env without printing values");
    actions.push(`would deploy only ${IMPORT_FUNCTION_NAME}`);
    actions.push("would not set secrets, run migrations, run SQL, mutate scheduler/Vault, or invoke the function");
    actions.push("would calculate the next natural 0 8 * * * UTC run and update only the selected lane");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Zero-output observability patch merged, not deployed",
      summary: "observability deploy would deploy only import-reddit-tips and stop before manual runtime invocation",
      nextPermission: "observability-deploy",
      nextSkill: "supabase-function-deploy-skill / production-handoff-skill",
      exitCode: 0,
    };
  }

  const clean = collectObservabilityDeployRepoPreflight();
  if (!clean.ok) return clean.result;

  const envShape = collectRuntimeNegativeEnvShape(DEFAULT_ENV_FILE);
  evidence.push(`deploy env SUPABASE_PROJECT_REF: ${envShape.SUPABASE_PROJECT_REF ? "set" : "not set"}`);
  evidence.push(`deploy env SUPABASE_ACCESS_TOKEN: ${envShape.SUPABASE_ACCESS_TOKEN ? "set" : "not set"}`);
  if (!envShape.SUPABASE_PROJECT_REF || envShape.SUPABASE_PROJECT_REF !== EXPECTED_SUPABASE_PROJECT_REF) {
    return observabilityDeployBlocked(`SUPABASE_PROJECT_REF missing or not ${EXPECTED_SUPABASE_PROJECT_REF}`, { envShape });
  }
  if (!envShape.SUPABASE_ACCESS_TOKEN) {
    return observabilityDeployBlocked("SUPABASE_ACCESS_TOKEN is not set", { envShape });
  }

  const deployEnv = {
    ...process.env,
    ["SUPABASE_ACCESS_" + "TOKEN"]: envShape.SUPABASE_ACCESS_TOKEN,
  };
  const version = run("npx", ["supabase", "--version"], { cwd: targetRepo, env: deployEnv, allowFailure: true, timeout: 120000 });
  if (version.code !== 0) return observabilityDeployBlocked(`npx supabase --version failed: ${firstLine(version.stderr || version.stdout)}`, { envShape });
  evidence.push(`Supabase CLI version check: ${firstLine(version.stdout || version.stderr)}`);

  const projects = run("npx", ["supabase", "projects", "list"], { cwd: targetRepo, env: deployEnv, allowFailure: true, timeout: 120000 });
  if (projects.code !== 0 || !projects.stdout.includes(EXPECTED_SUPABASE_PROJECT_REF)) {
    return observabilityDeployBlocked("Supabase project access check failed or expected ref not visible", { envShape });
  }
  evidence.push(`Supabase project ${EXPECTED_SUPABASE_PROJECT_REF} visible to CLI`);

  const deploy = run("npx", ["supabase", "functions", "deploy", IMPORT_FUNCTION_NAME, "--project-ref", envShape.SUPABASE_PROJECT_REF], {
    cwd: targetRepo,
    env: deployEnv,
    allowFailure: true,
    timeout: 240000,
  });
  if (deploy.code !== 0) {
    return observabilityDeployBlocked(`Supabase function deploy failed: ${firstLine(deploy.stderr || deploy.stdout)}`, { envShape });
  }

  const deployedAt = new Date();
  const nextRun = nextDailyUtcRun(deployedAt, 8);
  const now = new Date();
  const pending = nextRun.getTime() > now.getTime();
  const finalStatus = pending ? "Observability run pending" : "Zero-output observability deployed, awaiting automatic run";
  evidence.push(`${IMPORT_FUNCTION_NAME} deploy command exited 0`);
  evidence.push(`deployment timestamp UTC: ${deployedAt.toISOString()}`);
  evidence.push(`next 0 8 * * * UTC run after deployment: ${nextRun.toISOString()}`);

  return {
    finalStatus,
    ledgerStatus: finalStatus,
    summary: pending
      ? "import-reddit-tips was deployed with observability; the next natural scheduled run has not occurred yet"
      : "import-reddit-tips was deployed with observability and the next natural scheduled run is eligible for read-only recheck",
    nextPermission: pending
      ? "wait for next scheduled run and recheck telemetry"
      : "run observability telemetry recheck",
    nextSkill: "runtime-verification-skill / production-handoff-skill",
    observabilityDeploy: {
      branch: clean.data.branch,
      status: clean.data.status,
      head: clean.data.head,
      deployResult: `${IMPORT_FUNCTION_NAME} deployed`,
      deploymentTimestampUtc: deployedAt.toISOString(),
      schedule: "0 8 * * *",
      nextAutomaticRunUtc: nextRun.toISOString(),
      manualInvocationRun: false,
      secretsChanged: false,
      schedulerChanged: false,
    },
    exitCode: 0,
  };
}

module.exports = {
  runZeroOutputPipelineInvestigation,
  runZeroOutputObservabilityPatch,
  zeroOutputObservabilityPatchBlocked,
  runObservabilityPrRecovery,
  collectObservabilityTargetRepoState,
  collectObservabilityPrEvidence,
  classifyObservabilityCloudflareCheck,
  runObservabilityLocalQualityGate,
  observabilityPrRecoveryBlocked,
  runZeroOutputObservabilityDeploy,
};
