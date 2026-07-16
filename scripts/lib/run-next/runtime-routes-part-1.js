"use strict";

// Secret deployment plus bounded negative-runtime verification.

const runtime = require("./runtime-context");
const { fs, path, DEFAULT_ENV_FILE, IMPORT_FUNCTION_NAME, IMPORT_FUNCTION_DIR, REQUIRED_IMPORT_SECRET, EXPECTED_SUPABASE_PROJECT_REF, targetRepo, dryRun, evidence, actions, spawnSync } = runtime.pick(["fs","path","DEFAULT_ENV_FILE","IMPORT_FUNCTION_NAME","IMPORT_FUNCTION_DIR","REQUIRED_IMPORT_SECRET","EXPECTED_SUPABASE_PROJECT_REF","targetRepo","dryRun","evidence","actions","spawnSync"]);
const classifyTrackedTargetRepoChanges = runtime.lazy("classifyTrackedTargetRepoChanges");
const collectUntrackedStatusLines = runtime.lazy("collectUntrackedStatusLines");
const inspectImportFunctionDeploySource = runtime.lazy("inspectImportFunctionDeploySource");
const writeTemporaryImportSecretEnv = runtime.lazy("writeTemporaryImportSecretEnv");
const removeTemporarySecretFile = runtime.lazy("removeTemporarySecretFile");
const inspectRuntimeNegativeSource = runtime.lazy("inspectRuntimeNegativeSource");
const collectRuntimeNegativeEnvShape = runtime.lazy("collectRuntimeNegativeEnvShape");
const runRuntimeHttpCheck = runtime.lazy("runRuntimeHttpCheck");
const detectRuntimeSecretExposure = runtime.lazy("detectRuntimeSecretExposure");
const summarizeRuntimeNegativeFailure = runtime.lazy("summarizeRuntimeNegativeFailure");
const summarizeRuntimeCheck = runtime.lazy("summarizeRuntimeCheck");
const checkSchedulerVaultSqlTooling = runtime.lazy("checkSchedulerVaultSqlTooling");
const runPsqlRedacted = runtime.lazy("runPsqlRedacted");
const collectSupabaseToolingAvailability = runtime.lazy("collectSupabaseToolingAvailability");
const checkNpxSupabaseVersion = runtime.lazy("checkNpxSupabaseVersion");
const checkSupabaseProjectAccess = runtime.lazy("checkSupabaseProjectAccess");
const loadEnvFile = runtime.lazy("loadEnvFile");
const run = runtime.lazy("run");
const summarizeList = runtime.lazy("summarizeList");
const relativizeLine = runtime.lazy("relativizeLine");
const sanitizeEnvEvidenceLine = runtime.lazy("sanitizeEnvEvidenceLine");
const sanitizeSensitive = runtime.lazy("sanitizeSensitive");
const firstLine = runtime.lazy("firstLine");
const firstNonEmptyLine = runtime.lazy("firstNonEmptyLine");

function runFunctionSecretDeployNegativeRuntime() {
  if (dryRun) {
    actions.push("would inspect target repo status, branch, recent log, and staged files");
    actions.push(`would inspect ${IMPORT_FUNCTION_DIR}/index.ts for hardened auth, service-role boundary, and dry-run/no-write evidence`);
    actions.push("would load <RUNTIME_ENV_FILE> without printing values");
    actions.push(`would verify SUPABASE_PROJECT_REF is ${EXPECTED_SUPABASE_PROJECT_REF}`);
    actions.push(`would verify SUPABASE_ACCESS_TOKEN and ${REQUIRED_IMPORT_SECRET} are set without printing values`);
    actions.push("would run npx supabase --version and read-only projects list");
    actions.push(`would set remote ${REQUIRED_IMPORT_SECRET} using a chmod 600 temp env file outside the target repo`);
    actions.push(`would deploy only ${IMPORT_FUNCTION_NAME}`);
    actions.push("would run OPTIONS, GET, POST without auth, POST with invalid scheduler secret, and optional anon-only POST checks");
    actions.push("would not use the real scheduler secret or admin success auth unless a true no-write dry-run mode is proven");
    actions.push("would not run db push, migrations, SQL, scheduler mutation, app table writes, pet_tips writes, push, PR, or merge");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Scheduler applied via Vault, runtime not verified",
      summary: "dry-run passed; remote secret setup, single function deploy, and non-mutating runtime checks would run with function-secret-deploy-negative-runtime permission",
      nextPermission: "function-secret-deploy-negative-runtime",
      nextSkill: "supabase-function-deploy-skill / Edge Function secret, deploy, and negative runtime gate",
      functionSecretDeployNegativeRuntime: buildFunctionSecretDeployNegativeRuntimeSkeleton(),
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    return functionSecretDeployNegativeRuntimeBlocked(
      "Blocked: target repo missing",
      `target repo does not exist: ${targetRepo}`,
    );
  }

  const repo = collectFunctionSecretDeployNegativeRuntimeRepoEvidence(targetRepo);
  if (!repo.ok) return repo.result;

  const deploySource = inspectImportFunctionDeploySource(targetRepo);
  if (!deploySource.ok) {
    return functionSecretDeployNegativeRuntimeBlocked(
      "Blocked: hardened source boundary incomplete",
      deploySource.result.summary,
      { repo: repo.data },
    );
  }

  const runtimeSource = inspectRuntimeNegativeSource(targetRepo);
  if (!runtimeSource.ok) {
    return functionSecretDeployNegativeRuntimeBlocked(
      "Blocked: runtime source boundary incomplete",
      runtimeSource.result.summary,
      { repo: repo.data, deploySource },
    );
  }

  const dryRunDecision = inspectImportFunctionDryRunDecision(targetRepo);
  const envShape = collectRuntimeNegativeEnvShape(DEFAULT_ENV_FILE);
  const envCheck = checkFunctionSecretDeployNegativeRuntimeEnv(envShape);
  if (!envCheck.ok) {
    return functionSecretDeployNegativeRuntimeNeedsJohn(envCheck.status, envCheck.summary, {
      repo: repo.data,
      deploySource,
      runtimeSource,
      dryRunDecision,
      envShape,
    });
  }

  const tooling = collectSupabaseToolingAvailability();
  const version = checkNpxSupabaseVersion(tooling);
  const projectAccess = checkSupabaseProjectAccess(envShape, version);
  const authCheck = checkFunctionSecretDeployNegativeRuntimeAuth({ tooling, version, projectAccess });
  if (!authCheck.ok) {
    return functionSecretDeployNegativeRuntimeNeedsJohn(authCheck.status, authCheck.summary, {
      repo: repo.data,
      deploySource,
      runtimeSource,
      dryRunDecision,
      envShape,
      version,
      projectAccess,
    });
  }

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
  const envFileSupported = /--env-file\b/.test(`${secretHelp.stdout}\n${secretHelp.stderr}`);
  evidence.push(`Supabase secrets set --help inspected: ${secretHelp.code === 0 ? "ok" : "nonzero"}`);
  evidence.push(`Supabase secrets set --env-file support: ${envFileSupported ? "yes" : "no"}`);

  if (!envFileSupported) {
    return functionSecretDeployNegativeRuntimeNeedsJohn(
      "NEEDS JOHN: choose safe Supabase secret transfer method",
      "Supabase CLI help did not confirm --env-file support for secrets set",
      {
        repo: repo.data,
        deploySource,
        runtimeSource,
        dryRunDecision,
        envShape,
        version,
        projectAccess,
      },
    );
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
      return functionSecretDeployNegativeRuntimeBlocked(
        "Blocked: remote secret setup failed",
        `Supabase secrets set failed: ${firstLine(secretSet.stderr || secretSet.stdout)}`,
        {
          repo: repo.data,
          deploySource,
          runtimeSource,
          dryRunDecision,
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
      return functionSecretDeployNegativeRuntimeBlocked(
        "Blocked: function deploy failed after remote secret set",
        `Supabase function deploy failed: ${firstLine(deploy.stderr || deploy.stdout)}`,
        {
          repo: repo.data,
          deploySource,
          runtimeSource,
          dryRunDecision,
          envShape,
          version,
          projectAccess,
          secretSetupResult: `remote ${REQUIRED_IMPORT_SECRET} set via env-file`,
          tempHandling: "temporary secret env file created and removed",
          deployResult: `failed: ${firstLine(deploy.stderr || deploy.stdout)}`,
        },
      );
    }
    evidence.push(`${IMPORT_FUNCTION_NAME} Edge Function deploy command exited 0`);

    const runtime = executeFunctionSecretDeployNegativeRuntimeChecks(envShape);
    const failed = runtime.failed;
    const successPathDecision = dryRunDecision.trueNoWriteMode
      ? "NO-WRITE DRY-RUN MODE PROVEN, but no generic success call was run by this gate without a source-specific request contract"
      : "SUCCESS PATH NOT RUN: no no-write verification mode proven";
    evidence.push(successPathDecision);

    const finalStatus = failed
      ? "Function deployed, negative runtime checks failed, success path not run"
      : "Function deployed, negative runtime verified, success path not run";

    const report = buildFunctionSecretDeployNegativeRuntimeReport({
      repo: repo.data,
      deploySource,
      runtimeSource,
      dryRunDecision,
      envShape,
      version,
      projectAccess,
      secretSetupResult: `remote ${REQUIRED_IMPORT_SECRET} set via env-file`,
      tempHandling: "temporary secret env file created, chmod 600, removed, and absence verified",
      deployResult: `${IMPORT_FUNCTION_NAME} deployed`,
      endpoint: runtime.endpoint,
      checks: runtime.checks,
      exposure: runtime.exposure,
      successPathDecision,
      finalStatus,
    });

    if (failed) {
      return {
        finalStatus,
        ledgerStatus: finalStatus,
        summary: summarizeRuntimeNegativeFailure({
          failures: runtime.failures,
          postSuccess: runtime.postSuccess,
          importLike: runtime.importLike,
          exposure: runtime.exposure,
        }),
        nextPermission: "approve runtime failure triage and source patch plan",
        nextSkill: "security-hardening-review-skill / runtime failure triage",
        functionSecretDeployNegativeRuntime: report,
        exitCode: 1,
      };
    }

    return {
      finalStatus,
      ledgerStatus: finalStatus,
      summary: "remote import secret was set, only import-reddit-tips was deployed, and deployed function rejected non-mutating negative requests; no valid scheduler/admin success request was sent",
      nextPermission: "approve controlled success invocation or wait for scheduled run",
      nextSkill: "cloudflare-deploy-skill / controlled success invocation or scheduled-run observation",
      functionSecretDeployNegativeRuntime: report,
      localState: {
        branch: repo.data.branch,
        status: repo.data.status,
        log: repo.data.log,
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

function collectFunctionSecretDeployNegativeRuntimeRepoEvidence(repo) {
  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-10"]);
  const staged = run("git", ["-C", repo, "diff", "--cached", "--name-only"]);

  if ([status, branch, log, staged].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: functionSecretDeployNegativeRuntimeBlocked(
        "Blocked: repo evidence failed",
        "one or more read-only git evidence commands failed",
      ),
    };
  }

  const data = {
    status: status.stdout.trim() || "clean",
    branch: branch.stdout.trim() || "(detached)",
    log: log.stdout.trim(),
    staged: staged.stdout.trim(),
  };

  if (data.staged) {
    return {
      ok: false,
      result: functionSecretDeployNegativeRuntimeBlocked(
        "Blocked: staged files present",
        `staged files present before function deploy/runtime gate: ${data.staged.split(/\r?\n/).join(", ")}`,
        { repo: data },
      ),
    };
  }

  const trackedChanges = classifyTrackedTargetRepoChanges(data.status);
  if (trackedChanges.hasTrackedChanges) {
    return {
      ok: false,
      result: functionSecretDeployNegativeRuntimeBlocked(
        "Blocked: tracked target repo changes",
        trackedChanges.summary,
        { repo: data },
      ),
    };
  }

  const unexpectedUntracked = collectUntrackedStatusLines(data.status)
    .filter((line) => ![
      "?? evidence/",
      "?? supabase/.temp/",
    ].some((allowed) => line === allowed || line.startsWith(allowed)));
  if (unexpectedUntracked.length) {
    return {
      ok: false,
      result: functionSecretDeployNegativeRuntimeBlocked(
        "Blocked: unexpected target repo changes",
        `unexpected untracked target repo paths: ${unexpectedUntracked.join("; ")}`,
        { repo: data },
      ),
    };
  }

  evidence.push(`function deploy/runtime repo branch: ${data.branch}`);
  evidence.push(`function deploy/runtime git status: ${data.status}`);
  evidence.push(`function deploy/runtime recent log: ${firstLine(data.log)}`);
  const untracked = collectUntrackedStatusLines(data.status);
  if (untracked.length) {
    evidence.push(`untracked target repo paths excluded from function deploy/runtime gate: ${untracked.join("; ")}`);
  }

  return { ok: true, data };
}

function inspectImportFunctionDryRunDecision(repo) {
  const functionPath = path.join(repo, IMPORT_FUNCTION_DIR, "index.ts");
  if (!fs.existsSync(functionPath)) {
    return {
      functionSource: `${IMPORT_FUNCTION_DIR}/index.ts`,
      trueNoWriteMode: false,
      summary: "function source missing; no dry-run/no-write mode proven",
      grepSummary: "not checked",
    };
  }

  const grep = run(
    "grep",
    [
      "-nE",
      "IMPORT_REDDIT_TIPS_SECRET|x-import-reddit-tips-secret|is_admin|rateLimit|SUPABASE_SERVICE_ROLE_KEY|pet_tips|insert|upsert|dry|dryRun|preview|validate",
      functionPath,
    ],
    { allowFailure: true },
  );
  const grepLines = grep.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => sanitizeEnvEvidenceLine(relativizeLine(repo, line)));
  const text = fs.readFileSync(functionPath, "utf8");
  const hasDryTerms = /\b(dryRun|dry_run|dry-run|noWrite|no_write|preview|validateOnly|validate-only)\b/i.test(text);
  const hasWritePath = /\.from\(["']pet_tips["']\)[\s\S]{0,600}\.(insert|upsert)\s*\(/i.test(text) || /\.insert\s*\(/i.test(text);
  const hasExplicitNoWriteReturn = /(dryRun|dry_run|dry-run|noWrite|no_write|preview|validateOnly)[\s\S]{0,500}(return\s+jsonResponse|return\s+new Response|skipped|would|no write|not insert)/i.test(text);
  const trueNoWriteMode = hasDryTerms && hasExplicitNoWriteReturn && !/(?:dry|preview).*TO[D]O/i.test(text);

  const summary = trueNoWriteMode
    ? "source appears to contain an explicit no-write dry-run path, but success invocation still requires source-specific review"
    : hasWritePath
      ? "no true no-write dry-run mode proven; normal success path can insert published pet_tips"
      : "no true no-write dry-run mode proven";

  evidence.push(`function dry-run/no-write source decision: ${summary}`);

  return {
    functionSource: path.relative(repo, functionPath),
    hasDryTerms,
    hasWritePath,
    hasExplicitNoWriteReturn,
    trueNoWriteMode,
    summary,
    grepSummary: summarizeList(grepLines, 14),
  };
}

function checkFunctionSecretDeployNegativeRuntimeEnv(envShape) {
  const missing = [];
  if (!envShape.SUPABASE_ACCESS_TOKEN) missing.push("SUPABASE_ACCESS_TOKEN");
  if (!envShape.SUPABASE_PROJECT_REF) missing.push("SUPABASE_PROJECT_REF");
  if (!envShape.IMPORT_REDDIT_TIPS_SECRET) missing.push(REQUIRED_IMPORT_SECRET);

  evidence.push(`combined gate env SUPABASE_ACCESS_TOKEN: ${envShape.SUPABASE_ACCESS_TOKEN ? "set" : "not set"}`);
  evidence.push(`combined gate env SUPABASE_PROJECT_REF: ${envShape.SUPABASE_PROJECT_REF ? "set" : "not set"}`);
  evidence.push(`combined gate env ${REQUIRED_IMPORT_SECRET}: ${envShape.IMPORT_REDDIT_TIPS_SECRET ? "set" : "not set"}`);
  evidence.push(`combined gate env anon key available: ${envShape.ANON_KEY ? "yes" : "no"}`);

  if (missing.length) {
    return {
      ok: false,
      status: "NEEDS JOHN: Supabase deploy/runtime env missing",
      summary: `missing required local env variables: ${missing.join(", ")}`,
    };
  }
  if (envShape.SUPABASE_PROJECT_REF !== EXPECTED_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      status: "NEEDS JOHN: Supabase project ref mismatch",
      summary: `SUPABASE_PROJECT_REF does not match expected project ${EXPECTED_SUPABASE_PROJECT_REF}`,
    };
  }
  evidence.push(`combined gate project ref matches ${EXPECTED_SUPABASE_PROJECT_REF}`);
  return { ok: true };
}

function checkFunctionSecretDeployNegativeRuntimeAuth({ tooling, version, projectAccess }) {
  if (!tooling.nodeOk || !tooling.npmOk || !tooling.npxOk || !version.ok) {
    return {
      ok: false,
      status: "Blocked: Node/npx/Supabase CLI unavailable",
      summary: version.summary || "Node/npm/npx or npx Supabase CLI version check is unavailable",
    };
  }
  if (!projectAccess.ok) {
    return {
      ok: false,
      status: projectAccess.authInvalid || projectAccess.lacksProjectAccess
        ? "NEEDS JOHN: Supabase project access failed"
        : "Blocked: Supabase project access not confirmed",
      summary: projectAccess.summary,
    };
  }
  evidence.push(`combined gate npx Supabase version result: ${version.summary}`);
  evidence.push(`combined gate Supabase project access result: ${projectAccess.summary}`);
  return { ok: true };
}

function executeFunctionSecretDeployNegativeRuntimeChecks(envShape) {
  const endpoint = `https://${envShape.SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}`;
  evidence.push(`combined runtime endpoint: ${endpoint}`);
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
    checks.push(runRuntimeHttpCheck({
      name: "POST anon-only",
      script: 'curl -sS -i --max-time 20 -X POST "$ENDPOINT" -H "content-type: application/json" -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" --data "{}" | sed -n "1,80p"',
      env: {
        ...httpEnv,
        SUPABASE_ANON_KEY: envShape.ANON_KEY,
      },
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

  return {
    endpoint,
    checks,
    exposure,
    failures,
    postSuccess,
    importLike,
    failed,
  };
}

function buildFunctionSecretDeployNegativeRuntimeReport({
  repo,
  deploySource,
  runtimeSource,
  dryRunDecision,
  envShape,
  version,
  projectAccess,
  secretSetupResult,
  tempHandling,
  deployResult,
  endpoint,
  checks,
  exposure,
  successPathDecision,
  finalStatus,
}) {
  const findCheck = (name) => (checks || []).find((check) => check.name === name) || null;
  return {
    targetRepoState: repo
      ? {
          repo: targetRepo,
          branch: repo.branch,
          status: repo.status,
          recentLog: repo.log,
        }
      : null,
    sourceBoundary: {
      deploySource: deploySource ? {
        functionSource: deploySource.path || `${IMPORT_FUNCTION_DIR}/index.ts`,
        hardenedTermsPresent: deploySource.present || [],
        hardenedTermsMissing: deploySource.missing || [],
        grepSummary: deploySource.grepSummary || "not checked",
      } : null,
      runtimeSource: runtimeSource ? {
        functionSource: runtimeSource.path || `${IMPORT_FUNCTION_DIR}/index.ts`,
        termsPresent: runtimeSource.present || [],
        termsMissing: runtimeSource.missing || [],
        grepSummary: runtimeSource.grepSummary || "not checked",
      } : null,
      dryRunDecision: dryRunDecision || {
        trueNoWriteMode: false,
        summary: "not checked",
        grepSummary: "not checked",
      },
    },
    envPresence: envShape ? envShape.summary : "not checked",
    supabaseCliResult: version ? version.summary : "not checked",
    supabaseAuthResult: projectAccess ? projectAccess.summary : "not checked",
    secretSetupResult,
    tempSecretFileHandling: tempHandling,
    functionDeployResult: deployResult,
    endpoint: endpoint || `https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}`,
    options: summarizeRuntimeCheck(findCheck("OPTIONS")),
    get: summarizeRuntimeCheck(findCheck("GET/non-POST")),
    postNoAuth: summarizeRuntimeCheck(findCheck("POST without auth")),
    invalidSchedulerSecret: summarizeRuntimeCheck(findCheck("POST invalid scheduler secret")),
    anonOnly: summarizeRuntimeCheck(findCheck("POST anon-only")),
    runtimeSecretExposure: exposure ? exposure.summary : "not checked",
    successPathDecision,
    commandsNotRun: functionSecretDeployNegativeRuntimeCommandsNotRun(),
    secretExposureCheck: "no secret values, partial secrets, prefixes, suffixes, token lengths, DB URL, or DB password printed; temporary secret file stayed outside the target repo and was removed",
    finalStatus,
    nextPermission: finalStatus === "Function deployed, negative runtime verified, success path not run" ||
      finalStatus === "Function deployed, dry-run runtime verified, success path not run"
      ? "approve controlled success invocation or wait for scheduled run"
      : "approve runtime failure triage and source patch plan",
  };
}

function buildFunctionSecretDeployNegativeRuntimeSkeleton() {
  return buildFunctionSecretDeployNegativeRuntimeReport({
    repo: null,
    deploySource: null,
    runtimeSource: null,
    dryRunDecision: null,
    envShape: null,
    version: null,
    projectAccess: null,
    secretSetupResult: "dry-run",
    tempHandling: "dry-run",
    deployResult: "dry-run",
    endpoint: `https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}`,
    checks: [],
    exposure: null,
    successPathDecision: "dry-run; success path would remain gated unless true no-write mode is proven",
    finalStatus: "DRY RUN PASS",
  });
}

function functionSecretDeployNegativeRuntimeCommandsNotRun() {
  return [
    "supabase db push",
    "migration apply",
    "SQL execution",
    "pg_cron/scheduler mutation",
    "app table writes",
    "pet_tips writes",
    "valid scheduler success request",
    "admin bearer success request",
    "successful import/write request",
    "Git push / PR / merge",
    "staging evidence/",
    "staging supabase/.temp/",
  ];
}

function functionSecretDeployNegativeRuntimeNeedsJohn(ledgerStatus, summary, partial = {}) {
  return {
    finalStatus: ledgerStatus,
    ledgerStatus,
    summary,
    nextPermission: "provide required local Supabase env/auth or choose safe secret transfer method",
    nextSkill: "supabase-function-deploy-skill / Edge Function secret, deploy, and negative runtime gate",
    functionSecretDeployNegativeRuntime: buildFunctionSecretDeployNegativeRuntimeReport({
      repo: partial.repo || null,
      deploySource: partial.deploySource || null,
      runtimeSource: partial.runtimeSource || null,
      dryRunDecision: partial.dryRunDecision || null,
      envShape: partial.envShape || null,
      version: partial.version || null,
      projectAccess: partial.projectAccess || null,
      secretSetupResult: partial.secretSetupResult || "not run",
      tempHandling: partial.tempHandling || "not created",
      deployResult: partial.deployResult || "not run",
      endpoint: "",
      checks: [],
      exposure: null,
      successPathDecision: "not reached",
      finalStatus: ledgerStatus,
    }),
    exitCode: 2,
  };
}

function functionSecretDeployNegativeRuntimeBlocked(ledgerStatus, summary, partial = {}) {
  return {
    finalStatus: ledgerStatus,
    ledgerStatus,
    summary,
    nextPermission: "manual review of function secret/deploy/runtime gate",
    nextSkill: "supabase-function-deploy-skill / Edge Function secret, deploy, and negative runtime gate",
    functionSecretDeployNegativeRuntime: buildFunctionSecretDeployNegativeRuntimeReport({
      repo: partial.repo || null,
      deploySource: partial.deploySource || null,
      runtimeSource: partial.runtimeSource || null,
      dryRunDecision: partial.dryRunDecision || null,
      envShape: partial.envShape || null,
      version: partial.version || null,
      projectAccess: partial.projectAccess || null,
      secretSetupResult: partial.secretSetupResult || "not run",
      tempHandling: partial.tempHandling || "not created",
      deployResult: partial.deployResult || "not run",
      endpoint: "",
      checks: [],
      exposure: null,
      successPathDecision: "not reached",
      finalStatus: ledgerStatus,
    }),
    exitCode: 1,
  };
}

module.exports = {
  runFunctionSecretDeployNegativeRuntime,
  collectFunctionSecretDeployNegativeRuntimeRepoEvidence,
  inspectImportFunctionDryRunDecision,
  checkFunctionSecretDeployNegativeRuntimeEnv,
  checkFunctionSecretDeployNegativeRuntimeAuth,
  executeFunctionSecretDeployNegativeRuntimeChecks,
  buildFunctionSecretDeployNegativeRuntimeReport,
  buildFunctionSecretDeployNegativeRuntimeSkeleton,
  functionSecretDeployNegativeRuntimeCommandsNotRun,
  functionSecretDeployNegativeRuntimeNeedsJohn,
  functionSecretDeployNegativeRuntimeBlocked,
};
