"use strict";

// Automatic-run evidence collection, telemetry parsing, and root-cause decisions.

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
const observabilityRunRecheckBlocked = runtime.lazy("observabilityRunRecheckBlocked");
const observabilityRunRecheckResult = runtime.lazy("observabilityRunRecheckResult");

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

module.exports = {
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
};
