"use strict";

// Controlled-success invocation evidence and read-only application metadata.

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

function runControlledSuccessInvocation() {
  if (dryRun) {
    actions.push("would inspect target repo status, branch, recent log, and staged files");
    actions.push("would load <RUNTIME_ENV_FILE> without printing values");
    actions.push(`would verify SUPABASE_PROJECT_REF is ${EXPECTED_SUPABASE_PROJECT_REF}`);
    actions.push(`would verify ${REQUIRED_IMPORT_SECRET} and SUPABASE_DB_URL are set without printing values`);
    actions.push("would read pet_tips count and safe columns before invocation with psql");
    actions.push("would run exactly one scheduler-secret POST to import-reddit-tips");
    actions.push("would read pet_tips count and safe recent metadata after invocation with psql");
    actions.push("would not deploy, db push, apply migrations, mutate scheduler, run SQL writes, run admin success, retry success POST, push, PR, merge, or stage files");
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: "Function deployed, negative runtime verified, success path not run",
      summary: "dry-run passed; controlled success invocation would collect before/after metadata and run exactly one scheduler-secret POST",
      nextPermission: "controlled-success-invocation",
      nextSkill: "runtime-verification-skill / controlled scheduler-path success invocation",
      controlledSuccessInvocation: buildControlledSuccessInvocationSkeleton(),
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    return controlledSuccessInvocationBlocked("Controlled success invocation blocked: target repo missing", `target repo does not exist: ${targetRepo}`);
  }

  const repo = collectControlledSuccessRepoEvidence(targetRepo);
  if (!repo.ok) return repo.result;

  const envShape = collectControlledSuccessEnvShape(DEFAULT_ENV_FILE);
  const envCheck = checkControlledSuccessEnv(envShape);
  if (!envCheck.ok) {
    return controlledSuccessInvocationBlocked(envCheck.status, envCheck.summary, {
      repo: repo.data,
      envShape,
    });
  }

  const sqlTooling = checkSchedulerVaultSqlTooling();
  if (!sqlTooling.ok) {
    return controlledSuccessInvocationBlocked("Controlled success invocation blocked: psql unavailable", sqlTooling.summary, {
      repo: repo.data,
      envShape,
      sqlTooling: sqlTooling.report,
    });
  }

  const before = collectPetTipsReadOnlyMetadata({
    dbUrl: envShape.dbUrl,
    secretValue: envShape.IMPORT_REDDIT_TIPS_SECRET,
    label: "before",
  });
  if (!before.ok) {
    return controlledSuccessInvocationBlocked("Controlled success invocation blocked: before metadata failed", before.summary, {
      repo: repo.data,
      envShape,
      sqlTooling: sqlTooling.report,
      before,
    });
  }

  const invocation = runControlledSchedulerSuccessPost(envShape);

  const after = collectPetTipsReadOnlyMetadata({
    dbUrl: envShape.dbUrl,
    secretValue: envShape.IMPORT_REDDIT_TIPS_SECRET,
    label: "after",
  });

  const exposure = detectControlledSuccessSecretExposure(invocation, envShape);
  const countDelta = computeCountDelta(before.count, after.count);
  const dataWriteEvidence = countDelta === null
    ? "count delta unavailable"
    : `pet_tips count delta: ${countDelta >= 0 ? "+" : ""}${countDelta}`;
  evidence.push(dataWriteEvidence);

  let finalStatus = "Controlled success invocation completed";
  let exitCode = 0;
  let summary = `exactly one scheduler-secret success invocation attempted; HTTP ${invocation.statusCode || "unknown"}; ${dataWriteEvidence}`;
  let nextPermission = "approve scheduled-run monitoring or final production handoff";
  let nextSkill = "production-handoff-skill / scheduled-run monitoring or production handoff";

  if (!after.ok) {
    finalStatus = "Controlled success invocation blocked: after metadata failed";
    exitCode = 1;
    summary = after.summary;
    nextPermission = "approve metadata failure triage";
    nextSkill = "error-evidence-skill / Supabase metadata failure triage";
  } else if (exposure.hasExposure) {
    finalStatus = "Controlled success invocation blocked: secret exposure concern";
    exitCode = 1;
    summary = exposure.summary;
    nextPermission = "approve secret exposure triage";
    nextSkill = "security-hardening-review-skill / response secret exposure triage";
  } else if (!invocation.passed) {
    finalStatus = `Controlled success invocation blocked: ${invocation.blocker}`;
    exitCode = 1;
    summary = invocation.summary;
    nextPermission = "approve controlled invocation failure triage";
    nextSkill = "security-hardening-review-skill / controlled invocation failure triage";
  }

  const report = buildControlledSuccessInvocationReport({
    repo: repo.data,
    envShape,
    sqlTooling: sqlTooling.report,
    before,
    invocation,
    after,
    dataWriteEvidence,
    exposure,
    finalStatus,
  });

  return {
    finalStatus,
    ledgerStatus: finalStatus,
    summary,
    nextPermission,
    nextSkill,
    controlledSuccessInvocation: report,
    exitCode,
  };
}

function collectControlledSuccessRepoEvidence(repo) {
  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-10"]);
  const staged = run("git", ["-C", repo, "diff", "--cached", "--name-only"]);

  if ([status, branch, log, staged].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: controlledSuccessInvocationBlocked("Controlled success invocation blocked: repo evidence failed", "one or more read-only git evidence commands failed"),
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
      result: controlledSuccessInvocationBlocked(
        "Controlled success invocation blocked: staged files present",
        `staged files present before controlled invocation: ${data.staged.split(/\r?\n/).join(", ")}`,
        { repo: data },
      ),
    };
  }

  const trackedChanges = classifyTrackedTargetRepoChanges(data.status);
  if (trackedChanges.hasTrackedChanges) {
    return {
      ok: false,
      result: controlledSuccessInvocationBlocked(
        "Controlled success invocation blocked: tracked target repo changes",
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
      result: controlledSuccessInvocationBlocked(
        "Controlled success invocation blocked: unexpected target repo changes",
        `unexpected untracked target repo paths: ${unexpectedUntracked.join("; ")}`,
        { repo: data },
      ),
    };
  }

  evidence.push(`controlled invocation repo branch: ${data.branch}`);
  evidence.push(`controlled invocation git status: ${data.status}`);
  evidence.push(`controlled invocation recent log: ${firstLine(data.log)}`);
  const untracked = collectUntrackedStatusLines(data.status);
  if (untracked.length) {
    evidence.push(`untracked target repo paths excluded from controlled invocation: ${untracked.join("; ")}`);
  }

  return { ok: true, data };
}

function collectControlledSuccessEnvShape(file) {
  const parsed = loadEnvFile(file);
  const dbUrl = parsed.SUPABASE_DB_URL || "";
  return {
    file,
    SUPABASE_PROJECT_REF: parsed.SUPABASE_PROJECT_REF || "",
    [REQUIRED_IMPORT_SECRET]: parsed[REQUIRED_IMPORT_SECRET] || "",
    ["SUPABASE_DB_" + "URL"]: parsed.SUPABASE_DB_URL || "",
    dbUrl,
    summary: [
      `SUPABASE_PROJECT_REF=${parsed.SUPABASE_PROJECT_REF ? "set" : "not set"}`,
      `${REQUIRED_IMPORT_SECRET}=${parsed[REQUIRED_IMPORT_SECRET] ? "set" : "not set"}`,
      `SUPABASE_DB_URL=${parsed.SUPABASE_DB_URL ? "set" : "not set"}`,
    ].join("; "),
  };
}

function checkControlledSuccessEnv(envShape) {
  evidence.push(`controlled invocation env SUPABASE_PROJECT_REF: ${envShape.SUPABASE_PROJECT_REF ? "set" : "not set"}`);
  evidence.push(`controlled invocation env ${REQUIRED_IMPORT_SECRET}: ${envShape.IMPORT_REDDIT_TIPS_SECRET ? "set" : "not set"}`);
  evidence.push(`controlled invocation env SUPABASE_DB_URL: ${envShape.SUPABASE_DB_URL ? "set" : "not set"}`);

  const missing = [];
  if (!envShape.SUPABASE_PROJECT_REF) missing.push("SUPABASE_PROJECT_REF");
  if (!envShape.IMPORT_REDDIT_TIPS_SECRET) missing.push(REQUIRED_IMPORT_SECRET);
  if (!envShape.SUPABASE_DB_URL) missing.push("SUPABASE_DB_URL");
  if (missing.length) {
    return {
      ok: false,
      status: "Controlled success invocation blocked: env missing",
      summary: `missing required local env variables: ${missing.join(", ")}`,
    };
  }
  if (envShape.SUPABASE_PROJECT_REF !== EXPECTED_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      status: "Controlled success invocation blocked: project ref mismatch",
      summary: `SUPABASE_PROJECT_REF does not match expected project ${EXPECTED_SUPABASE_PROJECT_REF}`,
    };
  }
  evidence.push(`controlled invocation project ref matches ${EXPECTED_SUPABASE_PROJECT_REF}`);
  return { ok: true };
}

function collectPetTipsReadOnlyMetadata({ dbUrl, secretValue, label }) {
  const countResult = runPsqlRedacted({
    dbUrl,
    secretValue,
    label: `${label} pet_tips count`,
    input: "select count(*) from public.pet_tips;\n",
  });
  const columnsResult = runPsqlRedacted({
    dbUrl,
    secretValue,
    label: `${label} pet_tips columns`,
    input: `
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'pet_tips'
order by ordinal_position;
`,
  });

  const count = firstNonEmptyLine(countResult.stdout);
  const columns = columnsResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const safeColumns = chooseSafePetTipsColumns(columns);
  let recent = {
    attempted: "no",
    summary: "not run",
    rows: "",
  };

  if (countResult.code === 0 && columnsResult.code === 0 && safeColumns.length) {
    const orderColumn = choosePetTipsOrderColumn(columns);
    const recentSql = `
select ${safeColumns.map(sqlIdentifier).join(", ")}
from public.pet_tips
${orderColumn ? `order by ${sqlIdentifier(orderColumn)} desc nulls last` : ""}
limit 3;
`;
    const recentResult = runPsqlRedacted({
      dbUrl,
      secretValue,
      label: `${label} safe recent pet_tips metadata`,
      input: recentSql,
    });
    recent = {
      attempted: "yes",
      summary: recentResult.code === 0
        ? summarizeSafeRecentRows(recentResult.stdout)
        : `failed: ${firstLine(recentResult.stderr || recentResult.stdout)}`,
      rows: recentResult.stdout,
    };
  }

  const ok = countResult.code === 0 && columnsResult.code === 0;
  const summary = ok
    ? `${label} pet_tips count=${count || "unknown"}; columns inspected=${columns.length}; safe recent metadata=${recent.summary}`
    : `${label} pet_tips metadata failed: ${firstLine(countResult.stderr || columnsResult.stderr || countResult.stdout || columnsResult.stdout)}`;
  evidence.push(summary);

  return {
    ok,
    label,
    count,
    columns,
    safeColumns,
    recent,
    summary,
  };
}

function chooseSafePetTipsColumns(columns) {
  const allowed = [
    "id",
    "slug",
    "title",
    "source_reddit_id",
    "source_subreddit",
    "published",
    "published_at",
    "created_at",
    "updated_at",
  ];
  return allowed.filter((column) => columns.includes(column)).slice(0, 6);
}

function choosePetTipsOrderColumn(columns) {
  for (const candidate of ["published_at", "created_at", "updated_at", "id"]) {
    if (columns.includes(candidate)) return candidate;
  }
  return "";
}

function sqlIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function summarizeSafeRecentRows(text) {
  const rows = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((line) => line.length > 220 ? `${line.slice(0, 217)}...` : line);
  return rows.length ? rows.join(" | ") : "no rows returned";
}

function runControlledSchedulerSuccessPost(envShape) {
  const endpoint = `https://${envShape.SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}`;
  evidence.push(`controlled invocation endpoint: ${endpoint}`);
  evidence.push("controlled scheduler success invocation attempted exactly once");
  const result = spawnSync("bash", ["-lc", 'curl -sS --max-time 180 -X POST "$ENDPOINT" -H "Content-Type: application/json" -H "x-import-reddit-tips-secret: $IMPORT_REDDIT_TIPS_SECRET" -d "{}" -w "\\nHTTP_STATUS:%{http_code}\\n"'], {
    cwd: targetRepo,
    env: {
      ...process.env,
      ENDPOINT: endpoint,
      [REQUIRED_IMPORT_SECRET]: envShape.IMPORT_REDDIT_TIPS_SECRET,
    },
    encoding: "utf8",
    timeout: 210000,
  });
  const code = typeof result.status === "number" ? result.status : result.error ? 1 : 0;
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`;
  const sanitized = sanitizeSensitive(raw, [envShape.IMPORT_REDDIT_TIPS_SECRET]);
  const statusMatch = sanitized.match(/HTTP_STATUS:(\d{3})/);
  const statusCode = statusMatch ? Number(statusMatch[1]) : null;
  const responseText = sanitized.replace(/\n?HTTP_STATUS:\d{3}\s*$/m, "").trim();
  const passed = code === 0 && statusCode !== null && statusCode >= 200 && statusCode < 300;
  const blocker = code !== 0
    ? `curl exit ${code}`
    : statusCode === null
      ? "no HTTP status"
      : `HTTP ${statusCode}`;
  const summary = `${statusCode ? `HTTP ${statusCode}` : "no HTTP status"}; ${passed ? "PASS" : "FAIL"}; response excerpt: ${summarizeControlledSuccessResponse(responseText)}`;
  actions.push(`curl controlled scheduler success invocation: exit ${code}`);
  evidence.push(`controlled scheduler success invocation result: ${statusCode ? `HTTP ${statusCode}` : "no HTTP status"}; ${passed ? "PASS" : "FAIL"}`);

  return {
    attempted: "yes",
    code,
    statusCode,
    passed,
    blocker,
    raw,
    sanitized,
    responseSummary: summarizeControlledSuccessResponse(responseText),
    summary,
  };
}

function summarizeControlledSuccessResponse(text) {
  const clean = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  return clean ? (clean.length > 500 ? `${clean.slice(0, 497)}...` : clean) : "(empty response body)";
}

function detectControlledSuccessSecretExposure(invocation, envShape) {
  const secrets = [
    [REQUIRED_IMPORT_SECRET, envShape.IMPORT_REDDIT_TIPS_SECRET],
    ["SUPABASE_DB_URL", envShape.SUPABASE_DB_URL],
  ].filter(([, value]) => Boolean(value));
  const raw = invocation.raw || "";
  const exposedNames = new Set();
  for (const [name, value] of secrets) {
    if (value && raw.includes(value)) exposedNames.add(name);
  }
  if (/sbp_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+|BEGIN (RSA|OPENSSH|PRIVATE) KEY/i.test(raw)) {
    exposedNames.add("secret-shaped value");
  }
  const exposed = Array.from(exposedNames);
  return {
    hasExposure: exposed.length > 0,
    summary: exposed.length
      ? `response exposed secret categories: ${exposed.join(", ")}`
      : "no secret values or secret-shaped values found in captured success response",
  };
}

function computeCountDelta(before, after) {
  const beforeNumber = Number(String(before || "").trim());
  const afterNumber = Number(String(after || "").trim());
  if (!Number.isFinite(beforeNumber) || !Number.isFinite(afterNumber)) return null;
  return afterNumber - beforeNumber;
}

function buildControlledSuccessInvocationReport({
  repo,
  envShape,
  sqlTooling,
  before,
  invocation,
  after,
  dataWriteEvidence,
  exposure,
  finalStatus,
}) {
  return {
    targetRepoState: repo
      ? {
          repo: targetRepo,
          branch: repo.branch,
          status: repo.status,
          recentLog: repo.log,
        }
      : null,
    envPresence: envShape ? envShape.summary : "not checked",
    sqlTooling: sqlTooling || { psqlAvailable: "not checked", psqlVersion: "not checked" },
    beforeMetadata: before ? before.summary : "not checked",
    beforeCount: before ? before.count : "not checked",
    beforeColumns: before ? summarizeList(before.columns || [], 12) : "not checked",
    beforeRecent: before && before.recent ? before.recent.summary : "not checked",
    invocationResult: invocation ? invocation.summary : "not run",
    invocationStatus: invocation && invocation.statusCode ? `HTTP ${invocation.statusCode}` : "not available",
    afterMetadata: after ? after.summary : "not checked",
    afterCount: after ? after.count : "not checked",
    afterRecent: after && after.recent ? after.recent.summary : "not checked",
    dataWriteEvidence: dataWriteEvidence || "not checked",
    secretExposureCheck: exposure ? exposure.summary : "not checked",
    commandsNotRun: controlledSuccessCommandsNotRun(),
    finalStatus,
    nextPermission: finalStatus === "Controlled success invocation completed"
      ? "approve scheduled-run monitoring or final production handoff"
      : "approve controlled invocation failure triage",
  };
}

function buildControlledSuccessInvocationSkeleton() {
  return buildControlledSuccessInvocationReport({
    repo: null,
    envShape: null,
    sqlTooling: null,
    before: null,
    invocation: null,
    after: null,
    dataWriteEvidence: "dry-run",
    exposure: null,
    finalStatus: "DRY RUN PASS",
  });
}

function controlledSuccessCommandsNotRun() {
  return [
    "supabase db push",
    "migration apply",
    "function deploy",
    "scheduler mutation",
    "SQL writes",
    "manual insert/update/delete pet_tips",
    "admin success invocation",
    "second/retry success invocation",
    "Git push / PR / merge",
    "staging evidence/",
    "staging supabase/.temp/",
  ];
}

function controlledSuccessInvocationBlocked(ledgerStatus, summary, partial = {}) {
  return {
    finalStatus: ledgerStatus,
    ledgerStatus,
    summary,
    nextPermission: "approve controlled invocation failure triage",
    nextSkill: "security-hardening-review-skill / controlled invocation failure triage",
    controlledSuccessInvocation: buildControlledSuccessInvocationReport({
      repo: partial.repo || null,
      envShape: partial.envShape || null,
      sqlTooling: partial.sqlTooling || null,
      before: partial.before || null,
      invocation: partial.invocation || null,
      after: partial.after || null,
      dataWriteEvidence: partial.dataWriteEvidence || "not checked",
      exposure: partial.exposure || null,
      finalStatus: ledgerStatus,
    }),
    exitCode: 1,
  };
}

module.exports = {
  runControlledSuccessInvocation,
  collectControlledSuccessRepoEvidence,
  collectControlledSuccessEnvShape,
  checkControlledSuccessEnv,
  collectPetTipsReadOnlyMetadata,
  chooseSafePetTipsColumns,
  choosePetTipsOrderColumn,
  sqlIdentifier,
  summarizeSafeRecentRows,
  runControlledSchedulerSuccessPost,
  summarizeControlledSuccessResponse,
  detectControlledSuccessSecretExposure,
  computeCountDelta,
  buildControlledSuccessInvocationReport,
  buildControlledSuccessInvocationSkeleton,
  controlledSuccessCommandsNotRun,
  controlledSuccessInvocationBlocked,
};
