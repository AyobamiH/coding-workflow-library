"use strict";

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

function runObservabilityRunRecheck(active) {
  const deploymentAt = new Date(OBSERVABILITY_DEPLOYED_AT);
  const expectedRunAt = new Date(OBSERVABILITY_FIRST_AUTOMATIC_RUN_AT);
  const now = new Date();

  if (dryRun) {
    actions.push(`would verify current UTC is after ${expectedRunAt.toISOString()}`);
    actions.push("would inspect only the selected wagging-web-wins lane and leave other lanes unchanged");
    actions.push("would inspect target repo git metadata without editing or staging");
    actions.push("would load local env for set/not-set evidence and use SUPABASE_DB_URL only through redacted psql");
    actions.push("would query cron.job and cron.job_run_details read-only for the natural post-deployment run");
    actions.push(`would search supported read-only function logs only for ${OBSERVABILITY_TELEMETRY_MARKER}`);
    actions.push("would collect only pet_tips count and safe timestamp metadata");
    actions.push("would not invoke the function, call production endpoints, write SQL, mutate scheduler/Vault, deploy, set secrets, or edit product source");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: active.currentStatus,
      summary: "observability automatic-run recheck would run read-only and update only the selected lane",
      nextPermission: "observability-run-recheck",
      nextSkill: "runtime-verification-skill / production-handoff-skill",
      observabilityRunRecheck: buildObservabilityRunRecheckSkeleton(now),
      exitCode: 0,
    };
  }

  if (now < expectedRunAt) {
    return observabilityRunRecheckResult({
      finalStatus: "Observability run pending",
      summary: `current UTC ${now.toISOString()} is before expected automatic run ${expectedRunAt.toISOString()}`,
      nextPermission: "wait for scheduler completion and recheck",
      report: {
        ...buildObservabilityRunRecheckSkeleton(now),
        deploymentTimestampUtc: deploymentAt.toISOString(),
        expectedAutomaticRunUtc: expectedRunAt.toISOString(),
        postDeploymentAutomaticRun: "not due yet",
        runStatus: "pending",
      },
    });
  }

  if (!fs.existsSync(targetRepo)) {
    return observabilityRunRecheckBlocked("target repo is missing", { currentUtc: now.toISOString() });
  }

  const repo = collectScheduledRunMonitoringRepoEvidence(targetRepo);
  if (!repo.ok) {
    return observabilityRunRecheckBlocked(repo.result.summary || "target repo state is not safe for read-only observability recheck", {
      currentUtc: now.toISOString(),
    });
  }

  const envShape = collectScheduledRunMonitoringEnvShape(DEFAULT_ENV_FILE);
  const envCheck = checkScheduledRunMonitoringEnv(envShape);
  if (!envCheck.ok) {
    return observabilityRunRecheckBlocked(envCheck.summary, {
      currentUtc: now.toISOString(),
      repo: repo.data,
      envShape,
    });
  }

  const sqlTooling = checkSchedulerVaultSqlTooling();
  if (!sqlTooling.ok) {
    return observabilityRunRecheckBlocked(sqlTooling.summary, {
      currentUtc: now.toISOString(),
      repo: repo.data,
      envShape,
      sqlTooling: sqlTooling.report,
    });
  }

  const schedulerMetadata = collectScheduledRunSchedulerMetadata(envShape);
  if (!schedulerMetadata.ok) {
    return observabilityRunRecheckBlocked(schedulerMetadata.summary, {
      currentUtc: now.toISOString(),
      repo: repo.data,
      envShape,
      sqlTooling: sqlTooling.report,
      schedulerMetadata,
    });
  }

  const automaticRun = collectObservabilityAutomaticRun(envShape, expectedRunAt);
  const petTips = collectObservabilityPetTipsMetadata(envShape);
  const telemetry = collectObservabilityTelemetry(envShape, expectedRunAt);
  const exposure = detectObservabilitySecretExposure({
    envShape,
    schedulerMetadata,
    automaticRun,
    petTips,
    telemetry,
  });

  if (exposure.hasExposure) {
    return observabilityRunRecheckBlocked(exposure.summary, {
      currentUtc: now.toISOString(),
      repo: repo.data,
      envShape,
      sqlTooling: sqlTooling.report,
      schedulerMetadata,
      automaticRun,
      petTips,
      telemetry,
      exposure,
    });
  }

  const decision = decideObservabilityRunRecheck({ automaticRun, telemetry });
  const report = buildObservabilityRunRecheckReport({
    currentUtc: now.toISOString(),
    deploymentTimestampUtc: deploymentAt.toISOString(),
    expectedAutomaticRunUtc: expectedRunAt.toISOString(),
    repo: repo.data,
    envShape,
    sqlTooling: sqlTooling.report,
    schedulerMetadata,
    automaticRun,
    petTips,
    telemetry,
    decision,
    exposure,
  });

  return observabilityRunRecheckResult({
    finalStatus: decision.finalStatus,
    summary: decision.summary,
    nextPermission: decision.nextPermission,
    nextSkill: decision.nextSkill,
    report,
    exitCode: decision.exitCode,
  });
}

function collectObservabilityAutomaticRun(envShape, expectedRunAt) {
  const exists = runPsqlRedacted({
    dbUrl: envShape.SUPABASE_DB_URL,
    secretValue: envShape.secretValueForRedaction,
    label: "observability cron history table discovery",
    input: "select coalesce(to_regclass('cron.job_run_details')::text, '');\n",
  });
  const regclass = firstNonEmptyLine(exists.stdout);
  if (exists.code !== 0 || regclass !== "cron.job_run_details") {
    const summary = exists.code === 0
      ? "cron.job_run_details not available"
      : `cron.job_run_details discovery failed: ${firstLine(exists.stderr || exists.stdout)}`;
    evidence.push(`observability post-deployment cron run: ${summary}`);
    return { ok: exists.code === 0, available: false, rows: [], latest: null, summary, stdout: exists.stdout, stderr: exists.stderr };
  }

  const history = runPsqlRedacted({
    dbUrl: envShape.SUPABASE_DB_URL,
    secretValue: envShape.secretValueForRedaction,
    label: "observability post-deployment cron history",
    input: `
select r.jobid || E'\\t' || j.jobname || E'\\t' || coalesce(r.status, '') || E'\\t' || coalesce(r.start_time::text, '') || E'\\t' || coalesce(r.end_time::text, '') || E'\\t' || case when r.return_message is null or btrim(r.return_message) = '' then 'none' else 'present' end
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname = 'import-reddit-tips-daily'
  and r.start_time >= ${sqlQuote(expectedRunAt.toISOString())}::timestamptz
order by r.start_time asc
limit 10;
`,
  });
  const rows = parseScheduledRunHistoryRows(history.stdout);
  const latest = rows.length ? rows[rows.length - 1] : null;
  const summary = history.code === 0
    ? (rows.length ? rows.map(formatScheduledRunHistoryRow).join(" | ") : `no rows at or after ${expectedRunAt.toISOString()}`)
    : `post-deployment cron history query failed: ${firstLine(history.stderr || history.stdout)}`;
  evidence.push(`observability post-deployment cron run: ${summary}`);
  return {
    ok: history.code === 0,
    available: true,
    rows,
    latest,
    summary,
    stdout: history.stdout,
    stderr: history.stderr,
  };
}

function collectObservabilityPetTipsMetadata(envShape) {
  const countResult = runPsqlRedacted({
    dbUrl: envShape.SUPABASE_DB_URL,
    secretValue: envShape.secretValueForRedaction,
    label: "observability pet_tips count",
    input: "select count(*) from public.pet_tips;\n",
  });
  const columnsResult = runPsqlRedacted({
    dbUrl: envShape.SUPABASE_DB_URL,
    secretValue: envShape.secretValueForRedaction,
    label: "observability pet_tips columns",
    input: `
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'pet_tips'
order by ordinal_position;
`,
  });
  const columns = columnsResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const timestampColumns = ["published_at", "created_at", "updated_at"].filter((column) => columns.includes(column));
  let timestampSummary = "no safe timestamp columns found";
  let timestampRows = "";
  if (countResult.code === 0 && columnsResult.code === 0 && timestampColumns.length) {
    const projection = timestampColumns
      .map((column) => `coalesce(min(${sqlIdentifier(column)})::text, '') || E'..' || coalesce(max(${sqlIdentifier(column)})::text, '')`)
      .join(" || E'\\t' || ");
    const timestampResult = runPsqlRedacted({
      dbUrl: envShape.SUPABASE_DB_URL,
      secretValue: envShape.secretValueForRedaction,
      label: "observability pet_tips safe timestamp ranges",
      input: `select ${projection} from public.pet_tips;\n`,
    });
    timestampRows = timestampResult.stdout;
    timestampSummary = timestampResult.code === 0
      ? timestampColumns.map((column, index) => `${column}=${(firstNonEmptyLine(timestampResult.stdout).split("\t")[index] || "..")}`).join("; ")
      : `timestamp range query failed: ${firstLine(timestampResult.stderr || timestampResult.stdout)}`;
  }
  const count = firstNonEmptyLine(countResult.stdout);
  const ok = countResult.code === 0 && columnsResult.code === 0;
  const summary = ok
    ? `pet_tips count=${count || "unknown"}; timestamp metadata=${timestampSummary}`
    : `pet_tips safe metadata failed: ${firstLine(countResult.stderr || columnsResult.stderr || countResult.stdout || columnsResult.stdout)}`;
  evidence.push(`observability pet_tips safe metadata: ${summary}`);
  return { ok, count, columns, timestampColumns, timestampSummary, timestampRows, summary };
}

function collectObservabilityTelemetry(envShape, expectedRunAt) {
  const token = envShape.supabaseAccessTokenForRedaction || "";
  if (!token) {
    const summary = "Telemetry retrieval unavailable: SUPABASE_ACCESS_TOKEN is not set for read-only log inspection";
    evidence.push(summary);
    return { ok: false, available: false, method: "supabase functions logs", summary, safeTelemetry: null, stageCountChain: [], raw: "" };
  }

  const cliEnv = { ...process.env, SUPABASE_ACCESS_TOKEN: token };
  const help = run("npx", ["supabase", "functions", "--help"], {
    cwd: targetRepo,
    env: cliEnv,
    allowFailure: true,
    timeout: 120000,
  });
  const logsHelp = run("npx", ["supabase", "functions", "logs", "--help"], {
    cwd: targetRepo,
    env: cliEnv,
    allowFailure: true,
    timeout: 120000,
  });
  const helpText = `${help.stdout}\n${help.stderr}\n${logsHelp.stdout}\n${logsHelp.stderr}`;
  if (logsHelp.code !== 0 || !/("name":"logs"|\bfunctions\s+logs\b)/i.test(helpText)) {
    const summary = "Telemetry retrieval unavailable: installed Supabase CLI does not expose a supported functions logs command";
    evidence.push(summary);
    return { ok: false, available: false, method: "supabase functions logs", summary, safeTelemetry: null, stageCountChain: [], raw: helpText };
  }

  const logs = run("npx", ["supabase", "functions", "logs", IMPORT_FUNCTION_NAME, "--project-ref", envShape.SUPABASE_PROJECT_REF], {
    cwd: targetRepo,
    env: cliEnv,
    allowFailure: true,
    timeout: 120000,
  });
  const raw = sanitizeSensitive(`${logs.stdout}\n${logs.stderr}`, [
    envShape.SUPABASE_DB_URL,
    envShape.secretValueForRedaction,
    envShape.supabaseAccessTokenForRedaction,
  ]);
  if (logs.code !== 0) {
    const summary = `Telemetry retrieval unavailable: ${summarizeObservabilityLogFailure(raw)}`;
    evidence.push(summary);
    return { ok: false, available: true, method: "supabase functions logs", summary, safeTelemetry: null, stageCountChain: [], raw };
  }

  const parsed = extractObservabilityTelemetry(raw, expectedRunAt);
  const summary = parsed.safeTelemetry
    ? `telemetry marker found for ${parsed.safeTelemetry.startedAt}; trigger=${parsed.safeTelemetry.trigger}`
    : `Telemetry retrieval unavailable: ${OBSERVABILITY_TELEMETRY_MARKER} marker not found after ${expectedRunAt.toISOString()}`;
  evidence.push(summary);
  return {
    ok: Boolean(parsed.safeTelemetry),
    available: true,
    method: "supabase functions logs",
    summary,
    raw,
    ...parsed,
  };
}

function extractObservabilityTelemetry(raw, expectedRunAt) {
  const candidates = String(raw || "")
    .split(/\r?\n/)
    .filter((line) => line.includes(OBSERVABILITY_TELEMETRY_MARKER))
    .map((line) => parseTelemetryLine(line))
    .filter(Boolean)
    .filter((item) => {
      const date = new Date(item.startedAt || "");
      return date && !Number.isNaN(date.getTime()) && date >= expectedRunAt;
    })
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const latest = candidates[candidates.length - 1] || null;
  if (!latest) return { safeTelemetry: null, stageCountChain: [], rootCauseEvidence: [], remainingUnverified: ["telemetry marker was not available for the natural post-deployment run"] };
  const stageCountChain = observabilityStageCountChain(latest.stageCounts || {});
  const attrition = largestObservabilityAttrition(stageCountChain);
  const firstNonZero = firstObservabilityNonZero(stageCountChain);
  const firstZero = firstObservabilityZeroAfterNonZero(stageCountChain);
  const classification = classifyObservabilityTelemetry(latest, stageCountChain);
  return {
    safeTelemetry: {
      startedAt: latest.startedAt,
      trigger: latest.trigger,
      durationMs: Number.isFinite(Number(latest.durationMs)) ? Number(latest.durationMs) : null,
      safeFailureCategories: sanitizeFailureCategories(latest.safeFailureCategories),
    },
    stageCountChain,
    largestAttritionStep: attrition,
    firstNonZeroStage: firstNonZero,
    firstZeroStage: firstZero,
    rootCauseClassification: classification,
    rootCauseEvidence: buildObservabilityRootCauseEvidence(classification, latest, stageCountChain, firstNonZero, firstZero, attrition),
    remainingUnverified: [],
  };
}

function summarizeObservabilityLogFailure(raw) {
  const text = String(raw || "");
  if (/"usage":"supabase functions <subcommand>"/.test(text) && !/"name":"logs"/.test(text)) {
    return "installed Supabase CLI returned functions help and does not list a logs subcommand";
  }
  if (/unknown command|unknown subcommand|invalid command|not a command/i.test(text)) {
    return firstLine(text).slice(0, 240);
  }
  const line = firstLine(text);
  return line.length > 240 ? `${line.slice(0, 237)}...` : line;
}

function parseTelemetryLine(line) {
  const markerIndex = line.indexOf(OBSERVABILITY_TELEMETRY_MARKER);
  if (markerIndex === -1) return null;
  const afterMarker = line.slice(markerIndex + OBSERVABILITY_TELEMETRY_MARKER.length);
  const direct = parseJsonObjectFromText(afterMarker);
  if (direct) return direct;
  const envelope = parseJsonObjectFromText(line);
  if (envelope) {
    for (const key of ["event_message", "message", "log", "body"]) {
      if (typeof envelope[key] === "string" && envelope[key].includes(OBSERVABILITY_TELEMETRY_MARKER)) {
        const nested = parseJsonObjectFromText(envelope[key].slice(envelope[key].indexOf(OBSERVABILITY_TELEMETRY_MARKER) + OBSERVABILITY_TELEMETRY_MARKER.length));
        if (nested) return nested;
      }
    }
  }
  return null;
}

function parseJsonObjectFromText(text) {
  const value = String(text || "");
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(value.slice(start, end + 1));
  } catch {
    return null;
  }
}

function observabilityStageCountChain(counts) {
  return [
    ["configured sources", "configuredSources"],
    ["attempted sources", "sourcesAttempted"],
    ["upstream successes", "upstreamRequestsSucceeded"],
    ["upstream failures", "upstreamRequestsFailed"],
    ["raw posts received", "rawPostsReceived"],
    ["posts with required fields", "postsWithRequiredFields"],
    ["posts passing score filter", "postsPassingScoreFilter"],
    ["posts passing body filter", "postsPassingBodyFilter"],
    ["posts passing region filter", "postsPassingRegionFilter"],
    ["candidates", "candidates"],
    ["existing matches", "existingMatches"],
    ["fresh", "fresh"],
    ["normalised", "normalised"],
    ["insert-ready", "insertReady"],
    ["inserted", "inserted"],
    ["skipped", "skipped"],
  ].map(([label, key]) => ({
    label,
    key,
    value: Number.isFinite(Number(counts[key])) ? Number(counts[key]) : null,
  }));
}

function firstObservabilityNonZero(chain) {
  const found = chain.find((item) => Number(item.value) > 0);
  return found ? `${found.label}=${found.value}` : "none";
}

function firstObservabilityZeroAfterNonZero(chain) {
  let seenNonZero = false;
  for (const item of chain) {
    if (Number(item.value) > 0) seenNonZero = true;
    else if (seenNonZero && Number(item.value) === 0) return `${item.label}=0`;
  }
  return "none";
}

function largestObservabilityAttrition(chain) {
  const stages = chain.filter((item) => !["upstream failures", "existing matches", "skipped"].includes(item.label));
  let best = null;
  for (let index = 1; index < stages.length; index += 1) {
    const previous = stages[index - 1];
    const current = stages[index];
    if (previous.value === null || current.value === null) continue;
    const drop = previous.value - current.value;
    if (drop > 0 && (!best || drop > best.drop)) {
      best = { from: previous.label, to: current.label, drop, summary: `${previous.label} ${previous.value} -> ${current.label} ${current.value} (drop ${drop})` };
    }
  }
  return best ? best.summary : "none";
}

function classifyObservabilityTelemetry(telemetry, chain) {
  const counts = telemetry.stageCounts || {};
  const failures = telemetry.safeFailureCategories || {};
  if (Number(counts.upstreamRequestsSucceeded || 0) === 0 && Number(counts.upstreamRequestsFailed || 0) > 0) return "UPSTREAM_RETRIEVAL_BLOCKED";
  if (Number(counts.rawPostsReceived || 0) === 0 && Number(counts.upstreamRequestsSucceeded || 0) > 0) return "EXPECTED_EMPTY_INPUT";
  if (Number(counts.candidates || 0) === 0 && Number(counts.rawPostsReceived || 0) > 0) return "CONTENT_FILTER_EXCLUDES_ALL";
  if (Number(counts.fresh || 0) > 0 && Number(counts.normalised || 0) === 0) return "PARSING_OR_NORMALISATION_EMPTY";
  if (Number(counts.candidates || 0) > 0 && Number(counts.fresh || 0) === 0) return "INSERT_PRECONDITION_EXCLUDES_ALL";
  if (Number(counts.normalised || 0) > 0 && Number(counts.insertReady || 0) === 0) return "INSERT_PRECONDITION_EXCLUDES_ALL";
  if (Number(counts.insertReady || 0) > 0 && Number(counts.inserted || 0) === 0 && Number(failures.insert_failed || 0) > 0) return "INSERT_PRECONDITION_EXCLUDES_ALL";
  if (firstObservabilityZeroAfterNonZero(chain) !== "none") return "EVIDENCE_INSUFFICIENT";
  return "EVIDENCE_INSUFFICIENT";
}

function sanitizeFailureCategories(categories) {
  const allowed = new Set([
    "http_non_success",
    "network_error",
    "invalid_payload",
    "parse_error",
    "normalisation_empty",
    "insert_failed",
    "terminal_error",
  ]);
  const clean = {};
  for (const [key, value] of Object.entries(categories || {})) {
    if (allowed.has(key)) clean[key] = Number.isFinite(Number(value)) ? Number(value) : 0;
  }
  return clean;
}

function buildObservabilityRootCauseEvidence(classification, telemetry, chain, firstNonZero, firstZero, attrition) {
  const counts = telemetry.stageCounts || {};
  const failures = sanitizeFailureCategories(telemetry.safeFailureCategories);
  return [
    `classification=${classification}`,
    `trigger=${telemetry.trigger || "unknown"}`,
    `startedAt=${telemetry.startedAt || "unknown"}`,
    `first non-zero stage: ${firstNonZero}`,
    `first zero stage: ${firstZero}`,
    `largest attrition: ${attrition || "none"}`,
    `safe failure categories: ${Object.keys(failures).length ? Object.entries(failures).map(([key, value]) => `${key}=${value}`).join(", ") : "none"}`,
    `final business counters: candidates=${counts.candidates ?? "unknown"}, fresh=${counts.fresh ?? "unknown"}, inserted=${counts.inserted ?? "unknown"}, skipped=${counts.skipped ?? "unknown"}`,
  ];
}

function decideObservabilityRunRecheck({ automaticRun, telemetry }) {
  if (!automaticRun.ok) {
    return {
      finalStatus: "Observability run failed: investigate runtime",
      summary: automaticRun.summary,
      nextPermission: "run failure investigation with read-only evidence",
      nextSkill: "error-evidence-skill / production-handoff-skill",
      exitCode: 1,
    };
  }
  if (!automaticRun.rows || !automaticRun.rows.length) {
    return {
      finalStatus: "Observability run pending",
      summary: automaticRun.summary,
      nextPermission: "wait for scheduler completion and recheck",
      nextSkill: "production-handoff-skill / runtime-verification-skill",
      exitCode: 0,
    };
  }
  const failed = automaticRun.rows.find((row) => !/succeed|success/i.test(row.status || "") && !/running|started|queued/i.test(row.status || ""));
  if (failed) {
    return {
      finalStatus: "Observability run failed: investigate runtime",
      summary: `post-deployment cron row is not successful: ${formatScheduledRunHistoryRow(failed)}`,
      nextPermission: "run failure investigation with read-only evidence",
      nextSkill: "error-evidence-skill / production-handoff-skill",
      exitCode: 1,
    };
  }
  const running = automaticRun.rows.find((row) => /running|started|queued/i.test(row.status || ""));
  if (running && !automaticRun.rows.some((row) => /succeed|success/i.test(row.status || ""))) {
    return {
      finalStatus: "Observability run pending",
      summary: `post-deployment cron row is still in progress: ${formatScheduledRunHistoryRow(running)}`,
      nextPermission: "wait for scheduler completion and recheck",
      nextSkill: "production-handoff-skill / runtime-verification-skill",
      exitCode: 0,
    };
  }
  if (!telemetry.ok || !telemetry.safeTelemetry) {
    return {
      finalStatus: "Observability evidence insufficient",
      summary: telemetry.summary || "Telemetry retrieval unavailable",
      nextPermission: "provide read-only Supabase function logs containing IMPORT_REDDIT_TIPS_PIPELINE_TELEMETRY for the natural scheduled run",
      nextSkill: "runtime-verification-skill / error-evidence-skill",
      exitCode: 0,
    };
  }

  const classification = telemetry.rootCauseClassification || "EVIDENCE_INSUFFICIENT";
  const stateByClassification = {
    EXPECTED_EMPTY_INPUT: {
      finalStatus: "Expected empty input proven, production handoff ready",
      nextPermission: "complete production handoff or configure additional source inputs separately",
    },
    UPSTREAM_RETRIEVAL_BLOCKED: {
      finalStatus: "Upstream retrieval blocker proven, remediation pending",
      nextPermission: "approve upstream retrieval remediation plan",
    },
    CONTENT_FILTER_EXCLUDES_ALL: {
      finalStatus: "Candidate filter attrition proven, product decision pending",
      nextPermission: "review filter intent before changing business logic",
    },
    PARSING_OR_NORMALISATION_EMPTY: {
      finalStatus: "Parsing or normalisation boundary proven, fix planning pending",
      nextPermission: "approve bounded parser or normalisation fix",
    },
    INSERT_PRECONDITION_EXCLUDES_ALL: {
      finalStatus: "Insert precondition boundary proven, fix planning pending",
      nextPermission: "approve bounded insert-path fix",
    },
    CODE_DEFECT_PROVEN: {
      finalStatus: "Zero-output stage boundary proven",
      nextPermission: "approve bounded local fix plan",
    },
    EVIDENCE_INSUFFICIENT: {
      finalStatus: "Observability evidence insufficient",
      nextPermission: "provide complete read-only telemetry for the natural scheduled run",
    },
  };
  const selected = stateByClassification[classification] || stateByClassification.EVIDENCE_INSUFFICIENT;
  return {
    ...selected,
    summary: `${classification}: ${telemetry.rootCauseEvidence ? telemetry.rootCauseEvidence.join("; ") : telemetry.summary}`,
    nextSkill: "runtime-verification-skill / error-evidence-skill",
    exitCode: 0,
  };
}

function buildObservabilityRunRecheckReport({
  currentUtc,
  deploymentTimestampUtc,
  expectedAutomaticRunUtc,
  repo,
  envShape,
  sqlTooling,
  schedulerMetadata,
  automaticRun,
  petTips,
  telemetry,
  decision,
  exposure,
}) {
  return {
    currentUtc,
    deploymentTimestampUtc,
    expectedAutomaticRunUtc,
    targetRepoState: repo ? { repo: targetRepo, branch: repo.branch, status: repo.status, head: firstLine(repo.log) } : null,
    envPresence: envShape ? envShape.summary : "not checked",
    sqlTooling: sqlTooling || { psqlAvailable: "not checked", psqlVersion: "not checked" },
    schedulerJobMetadata: schedulerMetadata ? schedulerMetadata.summary : "not checked",
    postDeploymentAutomaticRun: automaticRun ? automaticRun.summary : "not checked",
    runStatus: automaticRun && automaticRun.latest ? automaticRun.latest.status : (automaticRun && automaticRun.rows && automaticRun.rows.length ? "multiple rows" : "not found"),
    telemetryRetrievalMethod: telemetry ? telemetry.method : "not checked",
    safeTelemetryEvidence: telemetry && telemetry.safeTelemetry
      ? `startedAt=${telemetry.safeTelemetry.startedAt}; trigger=${telemetry.safeTelemetry.trigger}; durationMs=${telemetry.safeTelemetry.durationMs}; safeFailureCategories=${Object.keys(telemetry.safeTelemetry.safeFailureCategories || {}).length ? JSON.stringify(telemetry.safeTelemetry.safeFailureCategories) : "none"}`
      : (telemetry ? telemetry.summary : "not checked"),
    stageCountChain: telemetry && telemetry.stageCountChain ? telemetry.stageCountChain : [],
    largestAttritionStep: telemetry && telemetry.largestAttritionStep ? telemetry.largestAttritionStep : "not available",
    firstNonZeroStage: telemetry && telemetry.firstNonZeroStage ? telemetry.firstNonZeroStage : "not available",
    firstZeroStage: telemetry && telemetry.firstZeroStage ? telemetry.firstZeroStage : "not available",
    rootCauseClassification: telemetry && telemetry.rootCauseClassification ? telemetry.rootCauseClassification : "EVIDENCE_INSUFFICIENT",
    rootCauseEvidence: telemetry && telemetry.rootCauseEvidence ? telemetry.rootCauseEvidence : [telemetry ? telemetry.summary : "telemetry not checked"],
    petTipsMetadata: petTips ? petTips.summary : "not checked",
    remainingUnverifiedAreas: telemetry && telemetry.remainingUnverified && telemetry.remainingUnverified.length
      ? telemetry.remainingUnverified
      : (telemetry && telemetry.ok ? [] : ["stage-count telemetry for the natural scheduled run"]),
    secretExposureCheck: exposure ? exposure.summary : "not checked",
    commandsNotRun: observabilityRunRecheckCommandsNotRun(),
    finalStatus: decision ? decision.finalStatus : "not decided",
    nextPermission: decision ? decision.nextPermission : "hold",
  };
}

function buildObservabilityRunRecheckSkeleton(now = new Date()) {
  return buildObservabilityRunRecheckReport({
    currentUtc: now.toISOString(),
    deploymentTimestampUtc: OBSERVABILITY_DEPLOYED_AT,
    expectedAutomaticRunUtc: OBSERVABILITY_FIRST_AUTOMATIC_RUN_AT,
    repo: null,
    envShape: null,
    sqlTooling: null,
    schedulerMetadata: null,
    automaticRun: null,
    petTips: null,
    telemetry: null,
    decision: {
      finalStatus: "DRY RUN PASS",
      nextPermission: "observability-run-recheck",
    },
    exposure: null,
  });
}

function observabilityRunRecheckCommandsNotRun() {
  return [
    "Edge Function invocation",
    "production endpoint call",
    "scheduler trigger",
    "scheduler mutation",
    "Vault mutation",
    "SQL writes",
    "app table writes",
    "pet_tips insert/update/delete",
    "function deploy",
    "migration apply",
    "secret set/rotation",
    "filter/source changes",
    "Wagging commit/push/PR",
    "npm publish",
    "git tag / GitHub Release",
  ];
}

function detectObservabilitySecretExposure({ envShape, schedulerMetadata, automaticRun, petTips, telemetry }) {
  const haystack = [
    schedulerMetadata && schedulerMetadata.stdout,
    schedulerMetadata && schedulerMetadata.stderr,
    automaticRun && automaticRun.stdout,
    automaticRun && automaticRun.stderr,
    petTips && petTips.summary,
    petTips && petTips.timestampRows,
    telemetry && telemetry.raw,
  ].filter(Boolean).join("\n");
  const secrets = [
    ["SUPABASE_DB_URL", envShape && envShape.SUPABASE_DB_URL],
    [REQUIRED_IMPORT_SECRET, envShape && envShape.secretValueForRedaction],
    ["SUPABASE_ACCESS_TOKEN", envShape && envShape.supabaseAccessTokenForRedaction],
  ].filter(([, value]) => Boolean(value));
  const exposedNames = new Set();
  for (const [name, value] of secrets) {
    if (value && haystack.includes(value)) exposedNames.add(name);
  }
  if (/sbp_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+|BEGIN (RSA|OPENSSH|PRIVATE) KEY/i.test(haystack)) {
    exposedNames.add("secret-shaped value");
  }
  const exposed = Array.from(exposedNames);
  return {
    hasExposure: exposed.length > 0,
    summary: exposed.length
      ? `observability evidence exposed secret categories: ${exposed.join(", ")}`
      : "no secret values or secret-shaped values found in captured observability evidence",
  };
}

function observabilityRunRecheckResult({ finalStatus, summary, nextPermission, nextSkill, report, exitCode = 0 }) {
  return {
    finalStatus,
    ledgerStatus: finalStatus,
    summary,
    nextPermission,
    nextSkill: nextSkill || "runtime-verification-skill / production-handoff-skill",
    observabilityRunRecheck: report,
    exitCode,
  };
}

function observabilityRunRecheckBlocked(summary, partial = {}) {
  return observabilityRunRecheckResult({
    finalStatus: "Observability evidence insufficient",
    summary,
    nextPermission: "provide read-only observability evidence or fix the reusable route defect",
    nextSkill: "runtime-verification-skill / error-evidence-skill",
    report: buildObservabilityRunRecheckReport({
      currentUtc: partial.currentUtc || new Date().toISOString(),
      deploymentTimestampUtc: OBSERVABILITY_DEPLOYED_AT,
      expectedAutomaticRunUtc: OBSERVABILITY_FIRST_AUTOMATIC_RUN_AT,
      repo: partial.repo || null,
      envShape: partial.envShape || null,
      sqlTooling: partial.sqlTooling || null,
      schedulerMetadata: partial.schedulerMetadata || null,
      automaticRun: partial.automaticRun || null,
      petTips: partial.petTips || null,
      telemetry: partial.telemetry || null,
      decision: {
        finalStatus: "Observability evidence insufficient",
        nextPermission: "provide read-only observability evidence or fix the reusable route defect",
      },
      exposure: partial.exposure || null,
    }),
    exitCode: 1,
  });
}

function collectObservabilityDeployRepoPreflight() {
  const fetch = run("git", ["-C", targetRepo, "fetch", "origin", "--prune"], { allowFailure: true, timeout: 120000 });
  if (fetch.code !== 0) return { ok: false, result: observabilityDeployBlocked(`git fetch failed: ${firstLine(fetch.stderr || fetch.stdout)}`) };

  const statusBefore = run("git", ["-C", targetRepo, "status", "--short"], { allowFailure: true });
  if (statusBefore.code !== 0) return { ok: false, result: observabilityDeployBlocked("git status before deploy failed") };
  const unexpected = statusBefore.stdout.split(/\r?\n/).filter(Boolean)
    .filter((line) => line !== "?? evidence/" && line !== "?? supabase/.temp/");
  if (unexpected.length) return { ok: false, result: observabilityDeployBlocked(`unexpected target repo changes before deploy: ${unexpected.join("; ")}`) };

  const switchMain = run("git", ["-C", targetRepo, "switch", "main"], { allowFailure: true });
  if (switchMain.code !== 0) return { ok: false, result: observabilityDeployBlocked(`git switch main failed: ${firstLine(switchMain.stderr || switchMain.stdout)}`) };

  const pull = run("git", ["-C", targetRepo, "pull", "--ff-only", "origin", "main"], { allowFailure: true, timeout: 120000 });
  if (pull.code !== 0) return { ok: false, result: observabilityDeployBlocked(`git pull --ff-only failed: ${firstLine(pull.stderr || pull.stdout)}`) };

  const status = run("git", ["-C", targetRepo, "status", "--short"], { allowFailure: true });
  const branch = run("git", ["-C", targetRepo, "branch", "--show-current"], { allowFailure: true });
  const head = run("git", ["-C", targetRepo, "rev-parse", "HEAD"], { allowFailure: true });
  if ([status, branch, head].some((item) => item.code !== 0)) return { ok: false, result: observabilityDeployBlocked("post-pull git metadata failed") };
  const lines = status.stdout.split(/\r?\n/).filter(Boolean);
  const bad = lines.filter((line) => line !== "?? evidence/" && line !== "?? supabase/.temp/");
  if (bad.length) return { ok: false, result: observabilityDeployBlocked(`unexpected target repo changes after main update: ${bad.join("; ")}`) };

  const telemetry = path.join(targetRepo, IMPORT_FUNCTION_DIR, "pipelineTelemetry.ts");
  const test = path.join(targetRepo, IMPORT_FUNCTION_DIR, "pipelineTelemetry.test.ts");
  if (!fs.existsSync(telemetry) || !fs.existsSync(test)) {
    return { ok: false, result: observabilityDeployBlocked("merged telemetry files are not present on local main") };
  }

  evidence.push(`observability deploy branch: ${branch.stdout.trim()}`);
  evidence.push(`observability deploy status: ${status.stdout.trim() || "clean"}`);
  evidence.push(`observability deploy local main head: ${head.stdout.trim()}`);
  evidence.push("merged telemetry files present on main");
  return {
    ok: true,
    data: {
      status: status.stdout.trim() || "clean",
      branch: branch.stdout.trim(),
      head: head.stdout.trim(),
    },
  };
}

function nextDailyUtcRun(after, hour) {
  const candidate = new Date(Date.UTC(
    after.getUTCFullYear(),
    after.getUTCMonth(),
    after.getUTCDate(),
    hour,
    0,
    0,
    0,
  ));
  if (candidate.getTime() <= after.getTime()) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate;
}

function observabilityDeployBlocked(summary, partial = {}) {
  return {
    finalStatus: "Zero-output observability deploy blocked",
    ledgerStatus: "Zero-output observability patch merged, not deployed",
    summary,
    nextPermission: "repair deploy preflight or approve narrower deploy retry",
    nextSkill: "supabase-function-deploy-skill / error-evidence-skill",
    observabilityDeploy: partial,
    exitCode: 1,
  };
}

function collectZeroOutputDatabaseEvidence(env) {
  const counts = runPsqlRedacted({
    dbUrl: env.SUPABASE_DB_URL,
    secretValue: env[REQUIRED_IMPORT_SECRET] || "",
    label: "zero-output pet_tips safe counts",
    input: `
select count(*) || E'\\t' || count(*) filter (where published) || E'\\t' || count(distinct source_reddit_id) || E'\\t' || coalesce(min(published_at)::text, '') || E'\\t' || coalesce(max(published_at)::text, '')
from public.pet_tips;
`,
  });
  const parts = firstNonEmptyLine(counts.stdout).split("\t");
  if (counts.code !== 0 || parts.length < 3) {
    return { ok: false, summary: `pet_tips read-only metadata failed: ${firstLine(counts.stderr || counts.stdout)}` };
  }

  const retained = runPsqlRedacted({
    dbUrl: env.SUPABASE_DB_URL,
    secretValue: env[REQUIRED_IMPORT_SECRET] || "",
    label: "zero-output retained pg_net counter metadata",
    allowFailure: true,
    input: `
select coalesce(to_regclass('net._http_response')::text, 'missing');
select created::text || E'\\t' || status_code || E'\\t' || coalesce(content::jsonb->>'candidates', '') || E'\\t' || coalesce(content::jsonb->>'fresh', '') || E'\\t' || coalesce(content::jsonb->>'inserted', '') || E'\\t' || coalesce(content::jsonb->>'skipped', '')
from net._http_response
where content like '%"candidates"%'
  and content like '%"inserted"%'
  and (
    created between '2026-06-18 07:59:00+00' and '2026-06-18 08:02:00+00'
    or created between '2026-06-19 07:59:00+00' and '2026-06-19 08:02:00+00'
  )
order by created desc
limit 10;
`,
  });
  const retainedLines = retained.code === 0
    ? retained.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(1)
    : [];
  const retainedSummary = retained.code !== 0
    ? "NOT VERIFIED: retained pg_net response counter query unavailable"
    : retainedLines.length
      ? `${retainedLines.length} retained response counter row(s) found`
      : "no retained response counter rows found";
  evidence.push(`zero-output retained pg_net metadata: ${retainedSummary}`);
  return {
    ok: true,
    summary: `pet_tips total=${parts[0]}; published=${parts[1]}; distinct source ids=${parts[2]}; retained responses=${retainedLines.length}`,
    petTipsCount: Number(parts[0]),
    publishedCount: Number(parts[1]),
    distinctSourceIds: Number(parts[2]),
    earliestPublishedAt: parts[3] || "none",
    latestPublishedAt: parts[4] || "none",
    retainedResponseRows: retainedLines,
    retainedResponseSummary: retainedSummary,
  };
}

function zeroOutputBlocked(summary, partial = {}) {
  return {
    finalStatus: "Zero-output pipeline investigation blocked",
    ledgerStatus: "Zero-output pipeline investigation blocked",
    summary,
    nextPermission: "provide the smallest missing read-only evidence needed for staged count attribution",
    nextSkill: "route-trace-skill / runtime-verification-skill / error-evidence-skill",
    zeroOutputInvestigation: { ...buildZeroOutputInvestigationSkeleton(), ...partial },
    exitCode: 1,
  };
}

function buildZeroOutputInvestigationSkeleton() {
  return {
    repo: null,
    sourceTrace: null,
    envPresence: null,
    sqlTooling: null,
    database: null,
    functionLogs: "not checked",
    counters: null,
    firstNonZero: "not proven",
    firstZero: "not proven",
    classification: "not classified",
    rootCauseEvidence: [],
    remaining: [],
    productFilesUpdated: [],
    commandsNotRun: zeroOutputCommandsNotRun(),
  };
}

function zeroOutputCommandsNotRun() {
  return [
    "Edge Function invocation or production endpoint call",
    "Reddit or other upstream fetch",
    "SQL write or app-table mutation",
    "scheduler or Vault mutation",
    "function deploy or migration apply",
    "Wagging commit, push, or PR",
    "npm publish, version, tag, or GitHub Release",
  ];
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
  runObservabilityRunRecheck,
  collectObservabilityAutomaticRun,
  collectObservabilityPetTipsMetadata,
  collectObservabilityTelemetry,
  extractObservabilityTelemetry,
  summarizeObservabilityLogFailure,
  parseTelemetryLine,
  parseJsonObjectFromText,
  observabilityStageCountChain,
  firstObservabilityNonZero,
  firstObservabilityZeroAfterNonZero,
  largestObservabilityAttrition,
  classifyObservabilityTelemetry,
  sanitizeFailureCategories,
  buildObservabilityRootCauseEvidence,
  decideObservabilityRunRecheck,
  buildObservabilityRunRecheckReport,
  buildObservabilityRunRecheckSkeleton,
  observabilityRunRecheckCommandsNotRun,
  detectObservabilitySecretExposure,
  observabilityRunRecheckResult,
  observabilityRunRecheckBlocked,
  collectObservabilityDeployRepoPreflight,
  nextDailyUtcRun,
  observabilityDeployBlocked,
  collectZeroOutputDatabaseEvidence,
  zeroOutputBlocked,
  buildZeroOutputInvestigationSkeleton,
  zeroOutputCommandsNotRun,
};
