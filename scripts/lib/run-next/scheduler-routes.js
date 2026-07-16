"use strict";

const runtime = require("./runtime-context");
const { fs, path, LIBRARY_ROOT, DEFAULT_ENV_FILE, DEFAULT_TEMP_ROOT, IMPORT_FUNCTION_NAME, IMPORT_FUNCTION_DIR, REQUIRED_IMPORT_SECRET, EXPECTED_SUPABASE_PROJECT_REF, SCHEDULER_VAULT_SECRET_NAME, args, targetRepo, dryRun, evidence, actions, spawnSync } = runtime.pick(["fs","path","LIBRARY_ROOT","DEFAULT_ENV_FILE","DEFAULT_TEMP_ROOT","IMPORT_FUNCTION_NAME","IMPORT_FUNCTION_DIR","REQUIRED_IMPORT_SECRET","EXPECTED_SUPABASE_PROJECT_REF","SCHEDULER_VAULT_SECRET_NAME","args","targetRepo","dryRun","evidence","actions","spawnSync"]);
const classifyTrackedTargetRepoChanges = runtime.lazy("classifyTrackedTargetRepoChanges");
const collectUntrackedStatusLines = runtime.lazy("collectUntrackedStatusLines");
const collectPetTipsReadOnlyMetadata = runtime.lazy("collectPetTipsReadOnlyMetadata");
const loadEnvFile = runtime.lazy("loadEnvFile");
const run = runtime.lazy("run");
const summarizeList = runtime.lazy("summarizeList");
const relativizeLine = runtime.lazy("relativizeLine");
const sanitizeEnvEvidenceLine = runtime.lazy("sanitizeEnvEvidenceLine");
const sanitizeSensitive = runtime.lazy("sanitizeSensitive");
const sqlQuote = runtime.lazy("sqlQuote");
const firstLine = runtime.lazy("firstLine");
const firstNonEmptyLine = runtime.lazy("firstNonEmptyLine");
const escapeRegExp = runtime.lazy("escapeRegExp");

function runScheduledRunMonitoringHandoff(active) {
  const baseline = scheduledMonitoringBaseline(active);
  if (dryRun) {
    actions.push("would inspect target repo status, branch, recent log, and staged files");
    actions.push("would load <RUNTIME_ENV_FILE> without printing values");
    actions.push(`would verify SUPABASE_PROJECT_REF is ${EXPECTED_SUPABASE_PROJECT_REF}`);
    actions.push("would verify SUPABASE_DB_URL is set without printing it");
    actions.push("would inspect import-reddit-tips-daily cron metadata and cron.job_run_details if available");
    actions.push("would inspect read-only pet_tips count, columns, and safe recent metadata");
    actions.push("would inspect import-reddit-tips source and security docs for final handoff evidence");
    actions.push(`would use explicit monitoring baseline ${baseline ? baseline.toISOString() : "(not proven)"}`);
    actions.push("would not invoke Edge Functions, deploy, mutate scheduler, run SQL writes, push, PR, merge, or stage files");
    if (!baseline) {
      return {
        finalStatus: "Scheduled run recheck blocked: monitoring baseline not proven",
        ledgerStatus: active.currentStatus,
        summary: "selected lane does not contain a valid monitoring_baseline",
        nextPermission: "establish a verified monitoring baseline",
        nextSkill: "production-handoff-skill / monitoring baseline recovery",
        scheduledRunMonitoringHandoff: buildScheduledRunMonitoringHandoffSkeleton(),
        exitCode: 1,
      };
    }
    return {
      finalStatus: "DRY RUN PASS",
      ledgerStatus: active.currentStatus,
      summary: "dry-run passed; scheduled-run monitoring and production handoff prep would run read-only",
      nextPermission: "scheduled-run-monitoring-handoff",
      nextSkill: "production-handoff-skill / scheduled-run monitoring and production handoff",
      scheduledRunMonitoringHandoff: buildScheduledRunMonitoringHandoffSkeleton(),
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    return scheduledRunMonitoringBlocked(
      "Scheduled run monitoring blocked: target repo missing",
      `target repo does not exist: ${targetRepo}`,
    );
  }

  if (!baseline) {
    return scheduledRunMonitoringBlocked(
      "Scheduled run recheck blocked: monitoring baseline not proven",
      "selected lane does not contain a valid monitoring_baseline; ledger modification time is not an acceptable production baseline",
    );
  }
  const repo = collectScheduledRunMonitoringRepoEvidence(targetRepo);
  if (!repo.ok) return repo.result;

  const envShape = collectScheduledRunMonitoringEnvShape(DEFAULT_ENV_FILE);
  const envCheck = checkScheduledRunMonitoringEnv(envShape);
  if (!envCheck.ok) {
    return scheduledRunMonitoringBlocked(envCheck.status, envCheck.summary, {
      repo: repo.data,
      envShape,
    });
  }

  const sqlTooling = checkSchedulerVaultSqlTooling();
  if (!sqlTooling.ok) {
    return scheduledRunMonitoringBlocked("Scheduled run monitoring blocked: psql unavailable", sqlTooling.summary, {
      repo: repo.data,
      envShape,
      sqlTooling: sqlTooling.report,
    });
  }

  const schedulerMetadata = collectScheduledRunSchedulerMetadata(envShape);
  if (!schedulerMetadata.ok) {
    return scheduledRunMonitoringBlocked("Scheduled run monitoring blocked: scheduler metadata unavailable", schedulerMetadata.summary, {
      repo: repo.data,
      envShape,
      sqlTooling: sqlTooling.report,
      schedulerMetadata,
    });
  }

  const runHistory = collectScheduledRunHistory(envShape, schedulerMetadata);
  const petTips = collectPetTipsReadOnlyMetadata({
    dbUrl: envShape.SUPABASE_DB_URL,
    secretValue: envShape.secretValueForRedaction,
    label: "handoff",
  });
  if (!petTips.ok) {
    return scheduledRunMonitoringBlocked("Scheduled run monitoring blocked: pet_tips metadata unavailable", petTips.summary, {
      repo: repo.data,
      envShape,
      sqlTooling: sqlTooling.report,
      schedulerMetadata,
      runHistory,
      petTips,
    });
  }

  const sourceDocs = inspectScheduledRunSourceDocsEvidence(targetRepo, envShape);
  const decision = decideScheduledRunMonitoringStatus({ baseline, runHistory });
  const exposure = detectScheduledRunMonitoringSecretExposure({
    schedulerMetadata,
    runHistory,
    petTips,
    sourceDocs,
    envShape,
  });

  let finalStatus = decision.finalStatus;
  let exitCode = 0;
  let summary = decision.summary;
  let nextPermission = decision.nextPermission;
  let nextSkill = "production-handoff-skill / scheduled-run monitoring and production handoff";

  if (exposure.hasExposure) {
    finalStatus = "Scheduled run monitoring blocked: secret exposure concern";
    exitCode = 1;
    summary = exposure.summary;
    nextPermission = "approve secret exposure triage";
    nextSkill = "security-hardening-review-skill / monitoring evidence secret exposure triage";
  } else if (decision.blocked) {
    exitCode = 1;
    nextSkill = "error-evidence-skill / scheduled-run failure triage";
  }

  const report = buildScheduledRunMonitoringHandoffReport({
    repo: repo.data,
    envShape,
    sqlTooling: sqlTooling.report,
    schedulerMetadata,
    runHistory,
    petTips,
    sourceDocs,
    decision,
    exposure,
    finalStatus,
  });

  return {
    finalStatus,
    ledgerStatus: finalStatus,
    summary,
    nextPermission,
    nextSkill,
    scheduledRunMonitoringHandoff: report,
    exitCode,
  };
}

function scheduledMonitoringBaseline(active) {
  const raw = active && active.monitoringBaseline ? active.monitoringBaseline : "";
  if (!raw && !args.lane) return fs.statSync(path.join(LIBRARY_ROOT, "work-ledger.md")).mtime;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function collectScheduledRunMonitoringRepoEvidence(repo) {
  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-12"]);
  const staged = run("git", ["-C", repo, "diff", "--cached", "--name-only"]);

  if ([status, branch, log, staged].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: scheduledRunMonitoringBlocked("Scheduled run monitoring blocked: repo evidence failed", "one or more read-only git evidence commands failed"),
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
      result: scheduledRunMonitoringBlocked(
        "Scheduled run monitoring blocked: staged files present",
        `staged files present before monitoring: ${data.staged.split(/\r?\n/).join(", ")}`,
        { repo: data },
      ),
    };
  }

  const trackedChanges = classifyTrackedTargetRepoChanges(data.status);
  if (trackedChanges.hasTrackedChanges) {
    return {
      ok: false,
      result: scheduledRunMonitoringBlocked(
        "Scheduled run monitoring blocked: tracked target repo changes",
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
      result: scheduledRunMonitoringBlocked(
        "Scheduled run monitoring blocked: unexpected target repo changes",
        `unexpected untracked target repo paths: ${unexpectedUntracked.join("; ")}`,
        { repo: data },
      ),
    };
  }

  evidence.push(`scheduled monitoring repo branch: ${data.branch}`);
  evidence.push(`scheduled monitoring git status: ${data.status}`);
  evidence.push(`scheduled monitoring recent log: ${firstLine(data.log)}`);
  const untracked = collectUntrackedStatusLines(data.status);
  if (untracked.length) {
    evidence.push(`untracked target repo paths excluded from scheduled monitoring: ${untracked.join("; ")}`);
  }

  return { ok: true, data };
}

function collectScheduledRunMonitoringEnvShape(file) {
  const parsed = loadEnvFile(file);
  return {
    file,
    SUPABASE_PROJECT_REF: parsed.SUPABASE_PROJECT_REF || "",
    ["SUPABASE_DB_" + "URL"]: parsed.SUPABASE_DB_URL || "",
    secretValueForRedaction: parsed[REQUIRED_IMPORT_SECRET] || "",
    supabaseAccessTokenForRedaction: parsed.SUPABASE_ACCESS_TOKEN || "",
    summary: [
      `SUPABASE_PROJECT_REF=${parsed.SUPABASE_PROJECT_REF ? "set" : "not set"}`,
      `SUPABASE_DB_URL=${parsed.SUPABASE_DB_URL ? "set" : "not set"}`,
    ].join("; "),
  };
}

function checkScheduledRunMonitoringEnv(envShape) {
  evidence.push(`scheduled monitoring env SUPABASE_PROJECT_REF: ${envShape.SUPABASE_PROJECT_REF ? "set" : "not set"}`);
  evidence.push(`scheduled monitoring env SUPABASE_DB_URL: ${envShape.SUPABASE_DB_URL ? "set" : "not set"}`);

  const missing = [];
  if (!envShape.SUPABASE_PROJECT_REF) missing.push("SUPABASE_PROJECT_REF");
  if (!envShape.SUPABASE_DB_URL) missing.push("SUPABASE_DB_URL");
  if (missing.length) {
    return {
      ok: false,
      status: "Scheduled run monitoring blocked: env missing",
      summary: `missing required local env variables: ${missing.join(", ")}`,
    };
  }
  if (envShape.SUPABASE_PROJECT_REF !== EXPECTED_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      status: "Scheduled run monitoring blocked: project ref mismatch",
      summary: `SUPABASE_PROJECT_REF does not match expected project ${EXPECTED_SUPABASE_PROJECT_REF}`,
    };
  }
  evidence.push(`scheduled monitoring project ref matches ${EXPECTED_SUPABASE_PROJECT_REF}`);
  return { ok: true };
}

function collectScheduledRunSchedulerMetadata(envShape) {
  const result = runPsqlRedacted({
    dbUrl: envShape.SUPABASE_DB_URL,
    secretValue: envShape.secretValueForRedaction,
    label: "scheduled monitoring scheduler metadata",
    input: `
select jobid || E'\\t' || jobname || E'\\t' || schedule || E'\\t' || active
from cron.job
where jobname = 'import-reddit-tips-daily';
`,
  });
  const line = firstNonEmptyLine(result.stdout);
  const parts = line.split("\t");
  const metadata = parts.length >= 4
    ? { jobid: parts[0], jobname: parts[1], schedule: parts[2], active: parts[3] }
    : null;
  const ok = result.code === 0 && metadata && metadata.jobname === "import-reddit-tips-daily";
  const summary = ok
    ? `jobid=${metadata.jobid}; jobname=${metadata.jobname}; schedule=${metadata.schedule}; active=${metadata.active}`
    : `scheduler metadata unavailable: ${firstLine(result.stderr || result.stdout)}`;
  evidence.push(`scheduled monitoring scheduler metadata: ${ok ? summary : "not found"}`);
  return {
    ok,
    metadata,
    stdout: result.stdout,
    stderr: result.stderr,
    summary,
  };
}

function collectScheduledRunHistory(envShape, schedulerMetadata) {
  const exists = runPsqlRedacted({
    dbUrl: envShape.SUPABASE_DB_URL,
    secretValue: envShape.secretValueForRedaction,
    label: "scheduled monitoring cron history table discovery",
    input: "select coalesce(to_regclass('cron.job_run_details')::text, '');\n",
  });
  const regclass = firstNonEmptyLine(exists.stdout);
  const available = exists.code === 0 && regclass === "cron.job_run_details";
  if (!available) {
    const summary = exists.code === 0
      ? "cron.job_run_details not available"
      : `cron.job_run_details discovery failed: ${firstLine(exists.stderr || exists.stdout)}`;
    evidence.push(`scheduled monitoring cron run history: ${summary}`);
    return {
      available: false,
      ok: exists.code === 0,
      rows: [],
      stdout: exists.stdout,
      stderr: exists.stderr,
      summary,
    };
  }

  const history = runPsqlRedacted({
    dbUrl: envShape.SUPABASE_DB_URL,
    secretValue: envShape.secretValueForRedaction,
    label: "scheduled monitoring safe cron run history",
    input: `
select r.jobid || E'\\t' || j.jobname || E'\\t' || coalesce(r.status, '') || E'\\t' || coalesce(r.start_time::text, '') || E'\\t' || coalesce(r.end_time::text, '') || E'\\t' || case when r.return_message is null or btrim(r.return_message) = '' then 'none' else 'present' end
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname = 'import-reddit-tips-daily'
order by r.start_time desc
limit 5;
`,
  });
  const rows = parseScheduledRunHistoryRows(history.stdout);
  const summary = history.code === 0
    ? (rows.length ? rows.map(formatScheduledRunHistoryRow).join(" | ") : "no rows returned")
    : `cron run history query failed: ${firstLine(history.stderr || history.stdout)}`;
  evidence.push(`scheduled monitoring cron run history: ${summary}`);
  return {
    available: true,
    ok: history.code === 0,
    rows,
    stdout: history.stdout,
    stderr: history.stderr,
    summary,
    schedulerJobId: schedulerMetadata && schedulerMetadata.metadata ? schedulerMetadata.metadata.jobid : "",
  };
}

function parseScheduledRunHistoryRows(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [jobid, jobname, status, startTime, endTime, returnMetadata] = line.split("\t");
      return { jobid, jobname, status, startTime, endTime, returnMetadata };
    });
}

function formatScheduledRunHistoryRow(row) {
  return `jobid=${row.jobid}; status=${row.status || "unknown"}; start=${row.startTime || "unknown"}; end=${row.endTime || "unknown"}; return_metadata=${row.returnMetadata || "not checked"}`;
}

function inspectScheduledRunSourceDocsEvidence(repo, envShape) {
  const doc = path.join(repo, "docs", "import-reddit-tips-security.md");
  const source = path.join(repo, IMPORT_FUNCTION_DIR, "index.ts");
  const pattern = "IMPORT_REDDIT_TIPS_SECRET|x-import-reddit-tips-secret|scheduled|scheduler|Vault|not applied|deployed|negative runtime|success path|pet_tips|rateLimit|is_admin";
  const grep = run("grep", ["-nE", pattern, doc, source], {
    allowFailure: true,
  });
  const raw = sanitizeSensitive(grep.stdout || "", [
    envShape.SUPABASE_DB_URL,
    envShape.secretValueForRedaction,
    envShape.supabaseAccessTokenForRedaction,
  ]);
  const lines = raw
    .split(/\r?\n/)
    .map((line) => relativizeLine(repo, line.trim()))
    .filter(Boolean);
  const joined = lines.join("\n");
  const terms = [
    "IMPORT_REDDIT_TIPS_SECRET",
    "x-import-reddit-tips-secret",
    "scheduler",
    "Vault",
    "deployed",
    "negative runtime",
    "success path",
    "pet_tips",
    "rateLimit",
    "is_admin",
  ].filter((term) => new RegExp(escapeRegExp(term), "i").test(joined));
  const summary = lines.length
    ? `${lines.length} source/docs evidence lines; terms present: ${terms.join(", ") || "none"}`
    : "no source/docs evidence lines matched";
  evidence.push(`scheduled monitoring source/docs evidence: ${summary}`);
  return {
    ok: grep.code === 0 || grep.code === 1,
    files: [doc, source],
    lineCount: lines.length,
    terms,
    excerpt: lines.slice(0, 12).join(" | ") || "no matching lines",
    raw,
    summary,
  };
}

function decideScheduledRunMonitoringStatus({ baseline, runHistory }) {
  if (!runHistory.ok) {
    return {
      finalStatus: "Scheduled run monitoring blocked: cron history query failed",
      summary: runHistory.summary,
      nextPermission: "approve scheduler run history failure triage",
      blocked: true,
      observed: false,
      baseline: baseline.toISOString(),
    };
  }

  const rowsAfterBaseline = runHistory.rows.filter((row) => {
    const date = row.startTime ? new Date(row.startTime) : null;
    return date && !Number.isNaN(date.getTime()) && date > baseline;
  });
  const latestRow = rowsAfterBaseline[0] || null;
  const latestSuccessful = rowsAfterBaseline.find((row) => /succeed|success/i.test(row.status || "")) || null;

  if (latestSuccessful) {
    return {
      finalStatus: "Scheduled run observed, production handoff ready",
      summary: `scheduled run observed after workflow baseline: ${formatScheduledRunHistoryRow(latestSuccessful)}`,
      nextPermission: "complete production handoff or investigate zero-candidate source behaviour separately",
      blocked: false,
      observed: true,
      baseline: baseline.toISOString(),
      latestObserved: latestSuccessful,
    };
  }

  if (latestRow && !/succeed|success/i.test(latestRow.status || "") && !/running|started|queued/i.test(latestRow.status || "")) {
    return {
      finalStatus: "Scheduled run observed with failure: investigate scheduler/runtime",
      summary: `latest post-baseline cron history row is not successful: ${formatScheduledRunHistoryRow(latestRow)}`,
      nextPermission: "run failure investigation with read-only evidence",
      blocked: true,
      observed: false,
      baseline: baseline.toISOString(),
      latestObserved: latestRow,
    };
  }

  return {
    finalStatus: "Scheduled run pending, production handoff ready",
    summary: rowsAfterBaseline.length
      ? `no completed successful scheduled run observed after workflow baseline ${baseline.toISOString()}; latest post-baseline row: ${formatScheduledRunHistoryRow(latestRow)}`
      : `no cron history rows found for import-reddit-tips-daily after workflow baseline ${baseline.toISOString()}`,
    nextPermission: "wait for next scheduled run and recheck",
    blocked: false,
    observed: false,
    baseline: baseline.toISOString(),
    latestObserved: latestRow,
  };
}

function detectScheduledRunMonitoringSecretExposure({ schedulerMetadata, runHistory, petTips, sourceDocs, envShape }) {
  const haystack = [
    schedulerMetadata && schedulerMetadata.stdout,
    schedulerMetadata && schedulerMetadata.stderr,
    runHistory && runHistory.stdout,
    runHistory && runHistory.stderr,
    petTips && petTips.summary,
    petTips && petTips.recent && petTips.recent.rows,
    sourceDocs && sourceDocs.raw,
  ].filter(Boolean).join("\n");
  const secrets = [
    ["SUPABASE_DB_URL", envShape.SUPABASE_DB_URL],
    [REQUIRED_IMPORT_SECRET, envShape.secretValueForRedaction],
    ["SUPABASE_ACCESS_TOKEN", envShape.supabaseAccessTokenForRedaction],
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
      ? `monitoring evidence exposed secret categories: ${exposed.join(", ")}`
      : "no secret values or secret-shaped values found in captured monitoring evidence",
  };
}

function buildScheduledRunMonitoringHandoffReport({
  repo,
  envShape,
  sqlTooling,
  schedulerMetadata,
  runHistory,
  petTips,
  sourceDocs,
  decision,
  exposure,
  finalStatus,
}) {
  return {
    filesRead: [
      "AGENTS.md",
      "RUNBOOK.md",
      "tools.md",
      "work-ledger.md",
      "scripts/run-next",
      "skill-files/coding-workflow-orchestrator-skill.md",
      "skill-files/supabase-rls-audit-skill.md",
      "skill-files/security-hardening-review-skill.md",
      "skill-files/build-verify-skill.md",
      "target repo git metadata",
      "docs/import-reddit-tips-security.md",
      `${IMPORT_FUNCTION_DIR}/index.ts`,
    ],
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
    schedulerMetadata: schedulerMetadata ? schedulerMetadata.summary : "not checked",
    schedulerRunHistory: runHistory ? runHistory.summary : "not checked",
    petTipsMetadata: petTips ? petTips.summary : "not checked",
    petTipsCount: petTips ? petTips.count : "not checked",
    petTipsRecent: petTips && petTips.recent ? petTips.recent.summary : "not checked",
    sourceDocsEvidence: sourceDocs ? sourceDocs.summary : "not checked",
    sourceDocsExcerpt: sourceDocs ? sourceDocs.excerpt : "not checked",
    productionHandoffSummary: decision ? decision.summary : "not decided",
    commandsNotRun: scheduledRunMonitoringCommandsNotRun(),
    secretExposureCheck: exposure ? exposure.summary : "not checked",
    finalStatus,
    nextPermission: decision ? decision.nextPermission : "hold",
  };
}

function buildScheduledRunMonitoringHandoffSkeleton() {
  return buildScheduledRunMonitoringHandoffReport({
    repo: null,
    envShape: null,
    sqlTooling: null,
    schedulerMetadata: null,
    runHistory: null,
    petTips: null,
    sourceDocs: null,
    decision: {
      summary: "dry-run",
      nextPermission: "scheduled-run-monitoring-handoff",
    },
    exposure: null,
    finalStatus: "DRY RUN PASS",
  });
}

function scheduledRunMonitoringCommandsNotRun() {
  return [
    "Edge Function invocation",
    "production endpoint call",
    "function deploy",
    "supabase db push",
    "migration apply",
    "SQL writes",
    "scheduler mutation",
    "manual insert/update/delete pet_tips",
    "Git push / PR / merge",
    "staging evidence/",
    "staging supabase/.temp/",
  ];
}

function scheduledRunMonitoringBlocked(ledgerStatus, summary, partial = {}) {
  return {
    finalStatus: ledgerStatus,
    ledgerStatus,
    summary,
    nextPermission: "approve scheduled-run monitoring failure triage",
    nextSkill: "error-evidence-skill / scheduled-run monitoring failure triage",
    scheduledRunMonitoringHandoff: buildScheduledRunMonitoringHandoffReport({
      repo: partial.repo || null,
      envShape: partial.envShape || null,
      sqlTooling: partial.sqlTooling || null,
      schedulerMetadata: partial.schedulerMetadata || null,
      runHistory: partial.runHistory || null,
      petTips: partial.petTips || null,
      sourceDocs: partial.sourceDocs || null,
      decision: {
        summary,
        nextPermission: "approve scheduled-run monitoring failure triage",
      },
      exposure: partial.exposure || null,
      finalStatus: ledgerStatus,
    }),
    exitCode: 1,
  };
}

function collectSchedulerApplicationRepoEvidence(repo) {
  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-12"]);
  const staged = run("git", ["-C", repo, "diff", "--cached", "--name-only"]);

  if ([status, branch, log, staged].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: schedulerApplicationBlocked(
        "Scheduler blocked: safe secret storage path not proven",
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
      result: schedulerApplicationBlocked(
        "Scheduler blocked: safe secret storage path not proven",
        `staged files present before scheduler decision: ${data.staged.split(/\r?\n/).join(", ")}`,
        { repo: data },
      ),
    };
  }

  const trackedChanges = classifyTrackedTargetRepoChanges(data.status);
  if (trackedChanges.hasTrackedChanges) {
    return {
      ok: false,
      result: schedulerApplicationBlocked(
        "Scheduler blocked: safe secret storage path not proven",
        trackedChanges.summary,
        { repo: data },
      ),
    };
  }

  const unexpectedUntracked = collectUntrackedStatusLines(data.status)
    .filter((line) => ![
      "?? docs/import-reddit-tips-supabase-application-plan.md",
      "?? evidence/",
      "?? supabase/.temp/",
    ].some((allowed) => line === allowed || line.startsWith(allowed)));
  if (unexpectedUntracked.length) {
    return {
      ok: false,
      result: schedulerApplicationBlocked(
        "Scheduler blocked: safe secret storage path not proven",
        `unexpected untracked target repo paths: ${unexpectedUntracked.join("; ")}`,
        { repo: data },
      ),
    };
  }

  evidence.push(`scheduler application repo branch: ${data.branch}`);
  evidence.push(`scheduler application git status: ${data.status}`);
  evidence.push(`scheduler application recent log: ${firstLine(data.log)}`);
  const untracked = collectUntrackedStatusLines(data.status);
  if (untracked.length) {
    evidence.push(`untracked target repo paths excluded from scheduler application: ${untracked.join("; ")}`);
  }

  return { ok: true, data };
}

function inspectSchedulerApplicationEvidence(repo) {
  const migrationsDir = path.join(repo, "supabase", "migrations");
  const docsDir = path.join(repo, "docs");
  const securityDoc = path.join(docsDir, "import-reddit-tips-security.md");
  const planDoc = path.join(docsDir, "import-reddit-tips-supabase-application-plan.md");
  const grepPattern = "import-reddit-tips|cron\\.schedule|cron\\.unschedule|cron\\.alter_job|pg_cron|net\\.http_post|http_post|apikey|Authorization|Bearer|x-import-reddit-tips-secret|IMPORT_REDDIT_TIPS_SECRET|vault|decrypted_secret|secret";
  const grep = run("grep", ["-RniE", grepPattern, migrationsDir, docsDir], {
    allowFailure: true,
  });
  const hits = String(grep.stdout || "")
    .split(/\r?\n/)
    .map((line) => sanitizeEnvEvidenceLine(relativizeLine(repo, line.trim())))
    .filter(Boolean);
  const securityText = fs.existsSync(securityDoc) ? fs.readFileSync(securityDoc, "utf8") : "";
  const planText = fs.existsSync(planDoc) ? fs.readFileSync(planDoc, "utf8") : "";
  const combined = `${hits.join("\n")}\n${securityText}\n${planText}`;
  const urlMatch = combined.match(/https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/import-reddit-tips/i);
  const scheduleMatch = combined.match(/schedule\s*=>\s*['"]([^'"]+)['"]|cron\.schedule\([^,\n]+,\s*['"]([^'"]+)['"]/i);
  const guardedDraft = /REVIEW REQUIRED|must not be applied|Do not hardcode|guarded|comment-only|non-executable/i.test(combined);
  const hasVaultMention = /\bvault\b|decrypted_secret|supabase_vault/i.test(combined);
  const hasSecretHeader = /x-import-reddit-tips-secret/i.test(combined);
  const hasJobName = /import-reddit-tips-daily/i.test(combined);
  const hasNetHttpPost = /net\.http_post|http_post/i.test(combined);
  const hasAnonHeaders = /apikey|Authorization|Bearer/i.test(combined);
  const safeStorageDocumented = hasVaultMention && /not hardcode|without hardcoding|secret storage|secret-storage|decrypted_secret/i.test(combined);

  evidence.push(`scheduler source grep hits: ${hits.length}`);
  evidence.push(`scheduler old job name evidence: ${hasJobName ? "import-reddit-tips-daily found" : "not found"}`);
  evidence.push(`scheduler guarded draft status: ${guardedDraft ? "guarded/comment-only evidence found" : "not confirmed"}`);
  evidence.push(`scheduler secret-storage documentation: ${safeStorageDocumented ? "mentioned but not proven" : "not proven"}`);

  return {
    hits,
    grepSummary: summarizeList(hits, 12),
    oldJobName: hasJobName ? "import-reddit-tips-daily" : "not confirmed",
    oldSchedule: scheduleMatch ? (scheduleMatch[1] || scheduleMatch[2] || "found but not parsed") : "not confirmed",
    oldUrl: urlMatch ? urlMatch[0] : `https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}`,
    oldHeaders: [
      hasAnonHeaders ? "apikey/Authorization/Bearer evidence" : "",
      hasSecretHeader ? "x-import-reddit-tips-secret evidence" : "",
    ].filter(Boolean).join("; ") || "not confirmed",
    hasNetHttpPost,
    hasSecretHeader,
    guardedDraft,
    safeStorageDocumented,
    hasVaultMention,
    securityDocPresent: Boolean(securityText),
    planDocPresent: Boolean(planText),
    summary: [
      hasJobName ? "old job name import-reddit-tips-daily found" : "old job name not confirmed",
      scheduleMatch ? `old schedule candidate ${scheduleMatch[1] || scheduleMatch[2]}` : "old schedule not confirmed",
      hasNetHttpPost ? "net/http_post scheduler evidence found" : "net/http_post scheduler evidence not confirmed",
      guardedDraft ? "existing draft appears guarded/comment-only" : "guarded draft not confirmed",
      safeStorageDocumented ? "secret-storage idea documented but not proven from deployed DB" : "safe SQL secret-storage path not documented as proven",
    ].join("; "),
  };
}

function collectSchedulerApplicationEnvShape(file) {
  const parsed = loadEnvFile(file);
  return {
    file,
    ["SUPABASE_ACCESS_" + "TOKEN"]: parsed.SUPABASE_ACCESS_TOKEN || "",
    SUPABASE_PROJECT_REF: parsed.SUPABASE_PROJECT_REF || "",
    [REQUIRED_IMPORT_SECRET]: parsed[REQUIRED_IMPORT_SECRET] || "",
    summary: [
      `SUPABASE_ACCESS_TOKEN=${parsed.SUPABASE_ACCESS_TOKEN ? "set" : "not set"}`,
      `SUPABASE_PROJECT_REF=${parsed.SUPABASE_PROJECT_REF ? "set" : "not set"}`,
      `${REQUIRED_IMPORT_SECRET}=${parsed[REQUIRED_IMPORT_SECRET] ? "set" : "not set"}`,
    ].join("; "),
  };
}

function checkSchedulerApplicationEnv(envShape) {
  evidence.push(`scheduler env SUPABASE_ACCESS_TOKEN: ${envShape.SUPABASE_ACCESS_TOKEN ? "set" : "not set"}`);
  evidence.push(`scheduler env SUPABASE_PROJECT_REF: ${envShape.SUPABASE_PROJECT_REF ? "set" : "not set"}`);
  evidence.push(`scheduler env ${REQUIRED_IMPORT_SECRET}: ${envShape.IMPORT_REDDIT_TIPS_SECRET ? "set" : "not set"}`);

  const missing = [];
  if (!envShape.SUPABASE_ACCESS_TOKEN) missing.push("SUPABASE_ACCESS_TOKEN");
  if (!envShape.SUPABASE_PROJECT_REF) missing.push("SUPABASE_PROJECT_REF");
  if (!envShape.IMPORT_REDDIT_TIPS_SECRET) missing.push(REQUIRED_IMPORT_SECRET);
  if (missing.length) {
    return {
      ok: false,
      status: "Scheduler blocked: safe secret storage path not proven",
      summary: `missing required local env variables: ${missing.join(", ")}`,
    };
  }
  if (envShape.SUPABASE_PROJECT_REF !== EXPECTED_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      status: "Scheduler blocked: safe secret storage path not proven",
      summary: `SUPABASE_PROJECT_REF does not match expected project ${EXPECTED_SUPABASE_PROJECT_REF}`,
    };
  }
  evidence.push(`scheduler env project ref matches ${EXPECTED_SUPABASE_PROJECT_REF}`);
  return { ok: true };
}

function inspectSchedulerApplicationCli(envShape) {
  const cliEnv = {
    ...process.env,
    ["SUPABASE_ACCESS_" + "TOKEN"]: envShape.SUPABASE_ACCESS_TOKEN,
  };
  const version = run("npx", ["supabase", "--version"], {
    cwd: targetRepo,
    env: cliEnv,
    allowFailure: true,
    timeout: 120000,
  });
  const projects = run("npx", ["supabase", "projects", "list"], {
    cwd: targetRepo,
    env: cliEnv,
    allowFailure: true,
    timeout: 120000,
  });
  const dbHelp = run("npx", ["supabase", "db", "--help"], {
    cwd: targetRepo,
    env: cliEnv,
    allowFailure: true,
    timeout: 120000,
  });
  const dbRemoteHelp = run("npx", ["supabase", "db", "remote", "--help"], {
    cwd: targetRepo,
    env: cliEnv,
    allowFailure: true,
    timeout: 120000,
  });
  const sqlHelp = run("npx", ["supabase", "sql", "--help"], {
    cwd: targetRepo,
    env: cliEnv,
    allowFailure: true,
    timeout: 120000,
  });

  const projectAccess = projects.code === 0 && projects.stdout.includes(EXPECTED_SUPABASE_PROJECT_REF);
  evidence.push(`scheduler Supabase CLI version: ${version.code === 0 ? firstLine(version.stdout) : "unavailable"}`);
  evidence.push(`scheduler Supabase project access: ${projectAccess ? "target project listed" : "not confirmed"}`);
  evidence.push(`scheduler Supabase db help: ${dbHelp.code === 0 ? "available" : "unavailable/nonzero"}`);
  evidence.push(`scheduler Supabase db remote help: ${dbRemoteHelp.code === 0 ? "available" : "unavailable/nonzero"}`);
  evidence.push(`scheduler Supabase sql help: ${sqlHelp.code === 0 ? "available" : "unavailable/nonzero"}`);

  return {
    version: version.code === 0 ? firstLine(version.stdout) : `unavailable: ${firstLine(version.stderr || version.stdout)}`,
    projectAccess,
    dbHelpAvailable: dbHelp.code === 0,
    dbRemoteHelpAvailable: dbRemoteHelp.code === 0,
    sqlHelpAvailable: sqlHelp.code === 0,
    dbHelpText: `${dbHelp.stdout}\n${dbHelp.stderr}`,
    dbRemoteHelpText: `${dbRemoteHelp.stdout}\n${dbRemoteHelp.stderr}`,
    sqlHelpText: `${sqlHelp.stdout}\n${sqlHelp.stderr}`,
    summary: [
      `npx supabase version: ${version.code === 0 ? firstLine(version.stdout) : "unavailable"}`,
      `project ${EXPECTED_SUPABASE_PROJECT_REF}: ${projectAccess ? "accessible" : "not confirmed"}`,
      `db help: ${dbHelp.code === 0 ? "available" : "unavailable"}`,
      `db remote help: ${dbRemoteHelp.code === 0 ? "available" : "unavailable"}`,
      `sql help: ${sqlHelp.code === 0 ? "available" : "unavailable"}`,
    ].join("; "),
  };
}

function discoverSchedulerApplicationCapabilities(cli) {
  const hasSqlCommand = cli.sqlHelpAvailable && /Usage:|supabase sql/i.test(cli.sqlHelpText);
  const sqlLooksNonInteractive = hasSqlCommand && /--project-ref|--db-url|--file|--execute|--query/i.test(cli.sqlHelpText) && !/password/i.test(cli.sqlHelpText);
  const discoverySummary = sqlLooksNonInteractive
    ? "potential non-interactive SQL command detected, but runner requires explicit implementation before mutation"
    : "read-only SQL not run: Supabase CLI did not expose a proven non-interactive read-only SQL query path";

  evidence.push(`scheduler read-only DB capability discovery: ${discoverySummary}`);

  return {
    readOnlySqlAvailable: false,
    readOnlySqlAttempted: false,
    readOnlySqlResult: discoverySummary,
    extensions: "not inspected",
    schemas: "not inspected",
    functions: "not inspected",
    currentJob: "not inspected",
    currentJobInspectable: false,
    secretStorageConfirmed: false,
    safeSecretReference: "not proven",
    summary: discoverySummary,
  };
}

function decideSchedulerApplicationSafePath({ schedulerEvidence, cli, discovery }) {
  const blockers = [];
  if (!cli.projectAccess) blockers.push(`Supabase project ${EXPECTED_SUPABASE_PROJECT_REF} access not confirmed`);
  if (!discovery.readOnlySqlAvailable || !discovery.currentJobInspectable) blockers.push("current cron job cannot be inspected with available non-interactive read-only DB tooling");
  if (!discovery.secretStorageConfirmed) blockers.push("no deployed vault/secret-storage mechanism confirmed for pg_cron header use");
  if (!schedulerEvidence.safeStorageDocumented) blockers.push("local docs/migrations do not prove a safe non-hardcoded SQL secret path");
  if (!schedulerEvidence.hasSecretHeader) blockers.push("scheduler replacement header shape is not proven from deployed scheduler metadata");

  return {
    safePathProven: false,
    decision: "SAFE PATH NOT PROVEN",
    summary: blockers.join("; "),
    blockers,
    plannedChange: [
      "not applied",
      `job name would be import-reddit-tips-daily`,
      `endpoint would be https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}`,
      "required header name would be x-import-reddit-tips-secret",
      "secret storage reference is not proven",
      "no secret value will be printed or hardcoded",
    ].join("; "),
  };
}

function buildSchedulerApplicationDecisionReport({
  repo,
  schedulerEvidence,
  envShape,
  cli,
  discovery,
  decision,
  plannedChange,
  applicationResult,
  postApplicationEvidence,
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
    existingSchedulerEvidence: schedulerEvidence
      ? {
          summary: schedulerEvidence.summary,
          oldJobName: schedulerEvidence.oldJobName,
          oldSchedule: schedulerEvidence.oldSchedule,
          oldUrl: schedulerEvidence.oldUrl,
          oldHeaders: schedulerEvidence.oldHeaders,
          guardedDraft: schedulerEvidence.guardedDraft ? "yes" : "not confirmed",
          safeStorageDocumented: schedulerEvidence.safeStorageDocumented ? "mentioned but not proven" : "not proven",
          grepSummary: schedulerEvidence.grepSummary,
        }
      : null,
    envPresence: envShape ? envShape.summary : "not checked",
    cliDbAccessResult: cli ? cli.summary : "not checked",
    readOnlyCapabilityDiscovery: discovery ? discovery.summary : "not checked",
    safePathDecision: decision ? `${decision.decision}: ${decision.summary}` : "not decided",
    plannedSchedulerChange: plannedChange || "not planned",
    schedulerApplicationResult: applicationResult || "not run",
    postApplicationSchedulerEvidence: postApplicationEvidence || "not run",
    commandsNotRun: schedulerApplicationCommandsNotRun(),
    secretExposureCheck: "no secret values printed; no scheduler SQL with a secret literal was generated or run",
    finalStatus,
    nextPermission: finalStatus === "Scheduler applied, runtime success not verified"
      ? "approve controlled scheduler success verification"
      : "approve scheduler secret storage design",
  };
}

function buildSchedulerApplicationDecisionSkeleton() {
  return buildSchedulerApplicationDecisionReport({
    repo: null,
    schedulerEvidence: null,
    envShape: null,
    cli: null,
    discovery: null,
    decision: null,
    plannedChange: "dry-run",
    applicationResult: "dry-run",
    postApplicationEvidence: "dry-run",
    finalStatus: "DRY RUN PASS",
  });
}

function schedulerApplicationCommandsNotRun() {
  return [
    "supabase db push",
    "migration apply",
    "function deploy",
    "unrelated SQL",
    "app table writes",
    "pet_tips writes",
    "Edge Function valid scheduler invocation",
    "admin bearer success request",
    "manual successful import request",
    "hardcoded scheduler secret SQL",
    "Git push / PR / merge",
    "staging evidence/",
    "staging supabase/.temp/",
  ];
}

function schedulerApplicationBlocked(ledgerStatus, summary, partial = {}) {
  return {
    finalStatus: ledgerStatus,
    ledgerStatus,
    summary: ledgerStatus.toLowerCase().startsWith("scheduler blocked")
      ? `SCHEDULER BLOCKED: safe scheduler secret storage path not proven; ${summary}`
      : summary,
    nextPermission: "approve scheduler secret storage design",
    nextSkill: "security-hardening-review-skill / scheduler secret storage design",
    schedulerApplicationDecision: buildSchedulerApplicationDecisionReport({
      repo: partial.repo || null,
      schedulerEvidence: partial.schedulerEvidence || null,
      envShape: partial.envShape || null,
      cli: partial.cli || null,
      discovery: partial.discovery || null,
      decision: partial.decision || null,
      plannedChange: partial.plannedChange || "not planned",
      applicationResult: partial.applicationResult || "not run",
      postApplicationEvidence: partial.postApplicationEvidence || "not run",
      finalStatus: ledgerStatus,
    }),
    exitCode: 1,
  };
}

function collectSchedulerVaultRepoEvidence(repo) {
  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-12"]);
  const staged = run("git", ["-C", repo, "diff", "--cached", "--name-only"]);

  if ([status, branch, log, staged].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: schedulerVaultBlocked(
        "Scheduler blocked: Vault/pg_cron/pg_net capability not proven",
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
      result: schedulerVaultBlocked(
        "Scheduler blocked: Vault/pg_cron/pg_net capability not proven",
        `staged files present before scheduler Vault gate: ${data.staged.split(/\r?\n/).join(", ")}`,
        { repo: data },
      ),
    };
  }

  const trackedChanges = classifyTrackedTargetRepoChanges(data.status);
  if (trackedChanges.hasTrackedChanges) {
    return {
      ok: false,
      result: schedulerVaultBlocked(
        "Scheduler blocked: Vault/pg_cron/pg_net capability not proven",
        trackedChanges.summary,
        { repo: data },
      ),
    };
  }

  const unexpectedUntracked = collectUntrackedStatusLines(data.status)
    .filter((line) => ![
      "?? docs/import-reddit-tips-supabase-application-plan.md",
      "?? evidence/",
      "?? supabase/.temp/",
    ].some((allowed) => line === allowed || line.startsWith(allowed)));
  if (unexpectedUntracked.length) {
    return {
      ok: false,
      result: schedulerVaultBlocked(
        "Scheduler blocked: Vault/pg_cron/pg_net capability not proven",
        `unexpected untracked target repo paths: ${unexpectedUntracked.join("; ")}`,
        { repo: data },
      ),
    };
  }

  evidence.push(`scheduler Vault repo branch: ${data.branch}`);
  evidence.push(`scheduler Vault git status: ${data.status}`);
  evidence.push(`scheduler Vault recent log: ${firstLine(data.log)}`);
  const untracked = collectUntrackedStatusLines(data.status);
  if (untracked.length) {
    evidence.push(`untracked target repo paths excluded from scheduler Vault gate: ${untracked.join("; ")}`);
  }

  return { ok: true, data };
}

function collectSchedulerVaultEnvShape(file) {
  const parsed = loadEnvFile(file);
  const dbUrl = parsed.SUPABASE_DB_URL || parsed.DATABASE_URL || "";
  const dbUrlSource = parsed.SUPABASE_DB_URL ? "SUPABASE_DB_URL" : parsed.DATABASE_URL ? "DATABASE_URL" : "missing";
  return {
    file,
    ["SUPABASE_ACCESS_" + "TOKEN"]: parsed.SUPABASE_ACCESS_TOKEN || "",
    SUPABASE_PROJECT_REF: parsed.SUPABASE_PROJECT_REF || "",
    [REQUIRED_IMPORT_SECRET]: parsed[REQUIRED_IMPORT_SECRET] || "",
    ["SUPABASE_DB_" + "URL"]: parsed.SUPABASE_DB_URL || "",
    DATABASE_URL: parsed.DATABASE_URL || "",
    dbUrl,
    dbUrlSource,
    summary: [
      `SUPABASE_ACCESS_TOKEN=${parsed.SUPABASE_ACCESS_TOKEN ? "set" : "not set"}`,
      `SUPABASE_PROJECT_REF=${parsed.SUPABASE_PROJECT_REF ? "set" : "not set"}`,
      `${REQUIRED_IMPORT_SECRET}=${parsed[REQUIRED_IMPORT_SECRET] ? "set" : "not set"}`,
      `SUPABASE_DB_URL=${parsed.SUPABASE_DB_URL ? "set" : "not set"}`,
      `DATABASE_URL=${parsed.DATABASE_URL ? "set" : "not set"}`,
      `DB URL source=${dbUrlSource}`,
    ].join("; "),
  };
}

function checkSchedulerVaultEnv(envShape) {
  evidence.push(`scheduler Vault env SUPABASE_ACCESS_TOKEN: ${envShape.SUPABASE_ACCESS_TOKEN ? "set" : "not set"}`);
  evidence.push(`scheduler Vault env SUPABASE_PROJECT_REF: ${envShape.SUPABASE_PROJECT_REF ? "set" : "not set"}`);
  evidence.push(`scheduler Vault env ${REQUIRED_IMPORT_SECRET}: ${envShape.IMPORT_REDDIT_TIPS_SECRET ? "set" : "not set"}`);
  evidence.push(`scheduler Vault env SUPABASE_DB_URL: ${envShape.SUPABASE_DB_URL ? "set" : "not set"}`);
  evidence.push(`scheduler Vault env DATABASE_URL: ${envShape.DATABASE_URL ? "set" : "not set"}`);

  const missing = [];
  if (!envShape.SUPABASE_ACCESS_TOKEN) missing.push("SUPABASE_ACCESS_TOKEN");
  if (!envShape.SUPABASE_PROJECT_REF) missing.push("SUPABASE_PROJECT_REF");
  if (!envShape.IMPORT_REDDIT_TIPS_SECRET) missing.push(REQUIRED_IMPORT_SECRET);
  if (missing.length) {
    return {
      ok: false,
      status: "Scheduler blocked: Vault/pg_cron/pg_net capability not proven",
      summary: `missing required local env variables: ${missing.join(", ")}`,
      nextPermission: "add missing Supabase scheduler variables locally",
    };
  }
  if (!envShape.dbUrl) {
    return {
      ok: false,
      status: "Needs John: database connection URL missing",
      summary: "SUPABASE_DB_URL and DATABASE_URL are not set in <RUNTIME_ENV_FILE>",
      nextPermission: "add SUPABASE_DB_URL locally",
    };
  }
  if (envShape.SUPABASE_PROJECT_REF !== EXPECTED_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      status: "Scheduler blocked: Vault/pg_cron/pg_net capability not proven",
      summary: `SUPABASE_PROJECT_REF does not match expected project ${EXPECTED_SUPABASE_PROJECT_REF}`,
      nextPermission: "fix SUPABASE_PROJECT_REF locally",
    };
  }
  evidence.push(`scheduler Vault env project ref matches ${EXPECTED_SUPABASE_PROJECT_REF}`);
  evidence.push(`scheduler Vault DB URL source: ${envShape.dbUrlSource}`);
  return { ok: true };
}

function checkSchedulerVaultSqlTooling() {
  const version = run("psql", ["--version"], {
    allowFailure: true,
    timeout: 30000,
  });
  const ok = version.code === 0;
  evidence.push(`psql availability: ${ok ? firstLine(version.stdout) : "unavailable"}`);
  return {
    ok,
    summary: ok ? `psql available: ${firstLine(version.stdout)}` : "psql unavailable for non-interactive DB inspection",
    report: {
      psqlAvailable: ok ? "yes" : "no",
      psqlVersion: ok ? firstLine(version.stdout) : "unavailable",
    },
  };
}

function classifySchedulerVaultDbUrlShape(dbUrl) {
  const host = extractDbUrlHost(dbUrl);
  let kind = "unknown";
  let summary = "SUPABASE_DB_URL host shape unknown";
  if (host) {
    const normalizedHost = host.toLowerCase();
    if (normalizedHost.startsWith("db.") && normalizedHost.endsWith(".supabase.co")) {
      kind = "direct";
      summary = "SUPABASE_DB_URL appears to use direct DB host";
    } else if (
      normalizedHost.includes("pooler.supabase.com") ||
      normalizedHost.includes("pooler.supabase.co") ||
      normalizedHost.includes("pooler") ||
      normalizedHost.includes("supavisor")
    ) {
      kind = "pooler";
      summary = "SUPABASE_DB_URL appears to use pooler host";
    }
  }
  return {
    kind,
    summary,
  };
}

function extractDbUrlHost(dbUrl) {
  const raw = String(dbUrl || "").trim();
  if (!raw) return "";
  if (/^postgres(?:ql)?:\/\//i.test(raw)) {
    const withoutScheme = raw.replace(/^postgres(?:ql)?:\/\//i, "");
    const atIndex = withoutScheme.lastIndexOf("@");
    const hostAndPath = atIndex === -1 ? withoutScheme : withoutScheme.slice(atIndex + 1);
    const [hostPathPart] = splitOnce(hostAndPath, "?");
    const [hostPortPart] = splitOnce(hostPathPart, "/");
    return parseHostPort(hostPortPart).host;
  }
  const hostMatch = raw.match(/(?:^|\s)host=(?:'([^']*)'|([^'\s]*))/i);
  if (hostMatch) return hostMatch[1] || hostMatch[2] || "";
  return "";
}

function buildPsqlConnectionTarget(dbUrl) {
  const raw = String(dbUrl || "").trim();
  if (!/^postgres(?:ql)?:\/\//i.test(raw)) {
    return {
      value: raw,
      sensitiveValues: [raw],
    };
  }

  const withoutScheme = raw.replace(/^postgres(?:ql)?:\/\//i, "");
  const atIndex = withoutScheme.lastIndexOf("@");
  if (atIndex === -1) {
    return {
      value: raw,
      sensitiveValues: [raw],
    };
  }

  const userInfo = withoutScheme.slice(0, atIndex);
  const hostAndPath = withoutScheme.slice(atIndex + 1);
  const colonIndex = userInfo.indexOf(":");
  const user = maybeDecode(colonIndex === -1 ? userInfo : userInfo.slice(0, colonIndex));
  const password = maybeDecode(colonIndex === -1 ? "" : userInfo.slice(colonIndex + 1));
  const [hostPathPart, queryPart = ""] = splitOnce(hostAndPath, "?");
  const [hostPortPart, dbPath = ""] = splitOnce(hostPathPart, "/");
  const hostPort = parseHostPort(hostPortPart);
  const params = parseConnectionQuery(queryPart);
  if (!params.sslmode) params.sslmode = "require";

  const fields = {
    host: hostPort.host,
    port: hostPort.port,
    dbname: maybeDecode(dbPath || "postgres"),
    user,
    password,
    ...params,
  };
  const conninfo = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
    .map(([key, value]) => `${key}=${libpqQuote(value)}`)
    .join(" ");

  return {
    value: conninfo,
    sensitiveValues: [raw, password].filter(Boolean),
  };
}

function splitOnce(value, delimiter) {
  const index = String(value).indexOf(delimiter);
  if (index === -1) return [String(value), ""];
  return [String(value).slice(0, index), String(value).slice(index + delimiter.length)];
}

function parseHostPort(value) {
  const raw = String(value || "");
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    const host = end === -1 ? raw : raw.slice(1, end);
    const rest = end === -1 ? "" : raw.slice(end + 1);
    return {
      host,
      port: rest.startsWith(":") ? rest.slice(1) : "",
    };
  }
  const colonIndex = raw.lastIndexOf(":");
  if (colonIndex !== -1 && /^\d+$/.test(raw.slice(colonIndex + 1))) {
    return {
      host: raw.slice(0, colonIndex),
      port: raw.slice(colonIndex + 1),
    };
  }
  return {
    host: raw,
    port: "",
  };
}

function parseConnectionQuery(query) {
  const params = {};
  for (const part of String(query || "").split("&")) {
    if (!part) continue;
    const [key, value = ""] = splitOnce(part, "=");
    const cleanKey = maybeDecode(key);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleanKey)) continue;
    params[cleanKey] = maybeDecode(value);
  }
  return params;
}

function maybeDecode(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function libpqQuote(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function runPsqlRedacted({ dbUrl, secretValue, label, input, file, allowFailure = false, psqlVariables = {} }) {
  const connectionTarget = buildPsqlConnectionTarget(dbUrl);
  const psqlArgs = ["-v", "ON_ERROR_STOP=1"];
  for (const [name, value] of Object.entries(psqlVariables)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    psqlArgs.push("-v", `${name}=${value}`);
  }
  psqlArgs.push("-X", "-q", "-t", "-A", connectionTarget.value);
  if (file) {
    psqlArgs.push("-f", file);
  }
  const result = spawnSync("psql", psqlArgs, {
    cwd: LIBRARY_ROOT,
    env: process.env,
    encoding: "utf8",
    timeout: 120000,
    input: file ? undefined : input,
  });
  const code = typeof result.status === "number" ? result.status : result.error ? 1 : 0;
  const sensitiveValues = [dbUrl, secretValue]
    .concat(Object.values(psqlVariables))
    .concat(connectionTarget.sensitiveValues || []);
  const stdout = sanitizeSensitive(result.stdout || "", sensitiveValues);
  const stderr = sanitizeSensitive(result.stderr || "", sensitiveValues);
  actions.push(`psql <redacted-db-url> ${label}: exit ${code}`);
  if (code !== 0 && !allowFailure) {
    evidence.push(`psql ${label}: failed`);
    evidence.push(`psql ${label} error: ${firstLine(stderr || stdout)}`);
  }
  return { code, stdout, stderr };
}

function checkSchedulerVaultDbConnectivity(dbUrl, secretValue) {
  const result = runPsqlRedacted({
    dbUrl,
    secretValue,
    label: "minimal DB connectivity test",
    input: "select current_database(), current_user;\n",
  });
  const ok = result.code === 0;
  evidence.push(`psql minimal DB connectivity test: ${ok ? "ok" : "failed"}`);
  return {
    ok,
    summary: ok ? "DB connectivity succeeded through SUPABASE_DB_URL" : `DB CONNECTIVITY BLOCKED: ${firstLine(result.stderr || result.stdout)}`,
    report: {
      attempted: "yes",
      result: ok ? "succeeded" : "failed",
    },
  };
}

function discoverSchedulerVaultCapabilities(dbUrl, secretValue) {
  const capabilitySql = `
select 'ext=' || extname
from pg_extension
where extname in ('pg_cron', 'pg_net', 'supabase_vault', 'vault')
order by extname;
select 'schema=' || nspname
from pg_namespace
where nspname in ('cron', 'net', 'vault')
order by nspname;
select 'proc=' || n.nspname || '.' || p.proname || '(' || pg_get_function_arguments(p.oid) || ')'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('cron', 'net', 'vault')
  and p.proname in ('schedule', 'unschedule', 'alter_job', 'http_post', 'create_secret', 'update_secret')
order by 1;
select 'regclass=cron.job:' || (to_regclass('cron.job') is not null);
select 'regclass=vault.secrets:' || (to_regclass('vault.secrets') is not null);
select 'regclass=vault.decrypted_secrets:' || (to_regclass('vault.decrypted_secrets') is not null);
`;
  const capability = runPsqlRedacted({
    dbUrl,
    secretValue,
    label: "read-only capability discovery",
    input: capabilitySql,
  });

  const lines = capability.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hasCronSchema = lines.includes("schema=cron");
  const hasNetSchema = lines.includes("schema=net");
  const hasVaultSchema = lines.includes("schema=vault");
  const hasPgCronExt = lines.includes("ext=pg_cron");
  const hasPgNetExt = lines.includes("ext=pg_net");
  const hasSchedule = lines.some((line) => /^proc=cron\.schedule\(/.test(line));
  const hasUnschedule = lines.some((line) => /^proc=cron\.unschedule\(/.test(line));
  const hasHttpPost = lines.some((line) => /^proc=net\.http_post\(/.test(line));
  const hasCreateSecret = lines.some((line) => /^proc=vault\.create_secret\(/.test(line));
  const hasUpdateSecret = lines.some((line) => /^proc=vault\.update_secret\(/.test(line));
  const hasCronJobTable = lines.includes("regclass=cron.job:true");
  const hasVaultSecretsTable = lines.includes("regclass=vault.secrets:true");
  const hasVaultDecryptedSecrets = lines.includes("regclass=vault.decrypted_secrets:true");
  const vaultFunctionSignatures = lines
    .filter((line) => /^proc=vault\.(create_secret|update_secret)\(/.test(line))
    .map((line) => line.replace(/^proc=/, ""));
  const vaultFunctionSignaturesSummary = vaultFunctionSignatures.length
    ? vaultFunctionSignatures.join("; ")
    : "not found";

  let job = null;
  let jobQuery = { code: 1, stdout: "", stderr: "" };
  if (hasCronJobTable) {
    jobQuery = runPsqlRedacted({
      dbUrl,
      secretValue,
      label: "read-only import-reddit-tips-daily job metadata",
      input: `
select jobid || E'\\t' || jobname || E'\\t' || schedule || E'\\t' || active
from cron.job
where jobname = 'import-reddit-tips-daily';
`,
    });
    const jobLine = jobQuery.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] || "";
    const parts = jobLine.split("\t");
    if (parts.length >= 4) {
      job = {
        jobid: parts[0],
        jobname: parts[1],
        schedule: parts[2],
        active: parts[3],
      };
    }
  }

  evidence.push(`Vault capability psql connection: ${capability.code === 0 ? "ok" : "failed"}`);
  evidence.push(`Vault capability schemas: cron=${hasCronSchema ? "yes" : "no"}, net=${hasNetSchema ? "yes" : "no"}, vault=${hasVaultSchema ? "yes" : "no"}`);
  evidence.push(`Vault capability functions: cron.schedule=${hasSchedule ? "yes" : "no"}, cron.unschedule=${hasUnschedule ? "yes" : "no"}, net.http_post=${hasHttpPost ? "yes" : "no"}, vault.create_secret=${hasCreateSecret ? "yes" : "no"}, vault.update_secret=${hasUpdateSecret ? "yes" : "no"}`);
  evidence.push(`Vault function signatures: ${vaultFunctionSignaturesSummary}`);
  evidence.push(`Vault capability tables/views: cron.job=${hasCronJobTable ? "yes" : "no"}, vault.secrets=${hasVaultSecretsTable ? "yes" : "no"}, vault.decrypted_secrets=${hasVaultDecryptedSecrets ? "yes" : "no"}`);
  evidence.push(`current import-reddit-tips-daily job: ${job ? `found with schedule ${job.schedule}` : "not found"}`);

  return {
    psqlConnected: capability.code === 0,
    rawSummary: summarizeList(lines, 20),
    hasCronSchema,
    hasNetSchema,
    hasVaultSchema,
    hasPgCronExt,
    hasPgNetExt,
    hasSchedule,
    hasUnschedule,
    hasHttpPost,
    hasCreateSecret,
    hasUpdateSecret,
    hasCronJobTable,
    hasVaultSecretsTable,
    hasVaultDecryptedSecrets,
    vaultFunctionSignatures,
    vaultFunctionSignaturesSummary,
    currentJob: job,
    jobQueryOk: jobQuery.code === 0,
    summary: [
      `psql connected=${capability.code === 0 ? "yes" : "no"}`,
      `cron schema=${hasCronSchema ? "yes" : "no"}`,
      `net.http_post=${hasHttpPost ? "yes" : "no"}`,
      `vault schema=${hasVaultSchema ? "yes" : "no"}`,
      `vault.create_secret=${hasCreateSecret ? "yes" : "no"}`,
      `vault.update_secret=${hasUpdateSecret ? "yes" : "no"}`,
      `vault.decrypted_secrets=${hasVaultDecryptedSecrets ? "yes" : "no"}`,
      `current job=${job ? "found" : "not found"}`,
    ].join("; "),
  };
}

function decideSchedulerVaultSafePath(discovery) {
  const blockers = [];
  if (!discovery.psqlConnected) blockers.push("psql could not connect non-interactively");
  if (!discovery.hasCronSchema) blockers.push("cron schema not proven");
  if (!discovery.hasSchedule) blockers.push("cron.schedule not proven");
  if (!discovery.hasUnschedule) blockers.push("cron.unschedule not proven");
  if (!discovery.hasNetSchema) blockers.push("net schema not proven");
  if (!discovery.hasHttpPost) blockers.push("net.http_post not proven");
  if (!discovery.hasVaultSchema) blockers.push("vault schema not proven");
  if (!discovery.hasCreateSecret) blockers.push("vault.create_secret not proven");
  if (!discovery.hasUpdateSecret) blockers.push("vault.update_secret not proven");
  if (!discovery.hasVaultSecretsTable) blockers.push("vault.secrets table not proven for idempotent update");
  if (!discovery.hasVaultDecryptedSecrets) blockers.push("vault.decrypted_secrets view not proven");
  if (!discovery.currentJob) blockers.push("current import-reddit-tips-daily job/schedule not proven");

  const safePathProven = blockers.length === 0;
  const plannedChange = safePathProven
    ? [
        `Vault secret name ${SCHEDULER_VAULT_SECRET_NAME}`,
        "replace only import-reddit-tips-daily",
        `schedule ${discovery.currentJob.schedule}`,
        `endpoint https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}`,
        "headers Content-Type and x-import-reddit-tips-secret",
        "secret read from vault.decrypted_secrets by name",
        "no literal secret in cron command",
      ].join("; ")
    : "not applied; capability proof incomplete";

  evidence.push(`scheduler Vault safe path decision: ${safePathProven ? "SAFE PATH PROVEN" : "SAFE PATH NOT PROVEN"}`);
  if (blockers.length) evidence.push(`scheduler Vault blockers: ${blockers.join("; ")}`);

  return {
    safePathProven,
    decision: safePathProven ? "SAFE PATH PROVEN" : "SAFE PATH NOT PROVEN",
    summary: safePathProven ? "Vault, pg_cron, pg_net, current job, and non-hardcoded secret reference path proven" : blockers.join("; "),
    blockers,
    plannedChange,
  };
}

function upsertSchedulerVaultSecret({ dbUrl, secretValue, secretName }) {
  const tmpDir = DEFAULT_TEMP_ROOT;
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.chmodSync(tmpDir, 0o700);
  const tempPath = path.join(tmpDir, `scheduler-vault-secret-${process.pid}-${Date.now()}.sql`);
  let runResult = { code: 1, stdout: "", stderr: "not run" };
  let tempFileDeleted = "no";
  const sql = `
begin;
with existing as (
  select id
  from vault.secrets
  where name = :'scheduler_secret_name'
  order by created_at desc
  limit 1
),
updated as (
  select vault.update_secret(id, :'scheduler_secret_value', :'scheduler_secret_name', 'Scheduler secret for import-reddit-tips pg_cron calls') as result
  from existing
),
created as (
  select vault.create_secret(:'scheduler_secret_value', :'scheduler_secret_name', 'Scheduler secret for import-reddit-tips pg_cron calls') as result
  where not exists (select 1 from existing)
)
select 'vault_secret_upserted'
from (
  select 1 from updated
  union all
  select 1 from created
) applied
limit 1;
commit;
`;

  try {
    fs.writeFileSync(tempPath, sql, { mode: 0o600 });
    fs.chmodSync(tempPath, 0o600);
    evidence.push("temporary Vault secret SQL file created outside target repo");
    runResult = runPsqlRedacted({
      dbUrl,
      secretValue,
      label: "Vault secret create/update via temp SQL file",
      file: tempPath,
      psqlVariables: {
        scheduler_secret_name: secretName,
        scheduler_secret_value: secretValue,
      },
    });
  } finally {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (error) {
      evidence.push("temporary Vault secret SQL file removal failed");
    }
    const absent = !fs.existsSync(tempPath);
    evidence.push(`temporary Vault secret SQL file removal verification: ${absent ? "absent" : "still present"}`);
    tempFileDeleted = absent ? "yes" : "no";
  }

  return {
    ok: runResult.code === 0 && tempFileDeleted === "yes",
    summary: runResult.code === 0
      ? "Vault secret create/update succeeded"
      : `Vault secret create/update failed: ${firstLine(runResult.stderr || runResult.stdout)}`,
    report: {
      attempted: "yes",
      secretName,
      tempFileDeleted,
      result: runResult.code === 0 ? "succeeded" : "failed",
    },
  };
}

function applySchedulerVaultCron({ dbUrl, schedule }) {
  const sql = `
begin;
select cron.unschedule('import-reddit-tips-daily');
select cron.schedule(
  'import-reddit-tips-daily',
  ${sqlQuote(schedule)},
  $cron$
  select
    net.http_post(
      url := 'https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-import-reddit-tips-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = '${SCHEDULER_VAULT_SECRET_NAME}'
        )
      ),
      body := '{}'::jsonb
    ) as request_id;
  $cron$
);
commit;
`;
  const result = runPsqlRedacted({
    dbUrl,
    secretValue: "",
    label: "replace import-reddit-tips-daily scheduler job",
    input: sql,
  });
  return {
    ok: result.code === 0,
    summary: result.code === 0 ? "import-reddit-tips-daily replaced with Vault-backed scheduler command" : `scheduler replacement failed: ${firstLine(result.stderr || result.stdout)}`,
    report: {
      attempted: "yes",
      jobName: "import-reddit-tips-daily",
      schedule,
      result: result.code === 0 ? "succeeded" : "failed",
      commandShape: "net.http_post with x-import-reddit-tips-secret from vault.decrypted_secrets",
    },
  };
}

function inspectSchedulerVaultPostApplication({ dbUrl, secretValue }) {
  const metadata = runPsqlRedacted({
    dbUrl,
    secretValue,
    label: "post-application scheduler metadata",
    input: `
select jobid || E'\\t' || jobname || E'\\t' || schedule || E'\\t' || active
from cron.job
where jobname = 'import-reddit-tips-daily';
`,
  });
  const command = runPsqlRedacted({
    dbUrl,
    secretValue,
    label: "post-application scheduler command inspection",
    input: `
select command
from cron.job
where jobname = 'import-reddit-tips-daily';
`,
  });
  const commandText = command.stdout || "";
  const containsHeader = /x-import-reddit-tips-secret/i.test(commandText);
  const containsVault = /vault\.decrypted_secrets/i.test(commandText);
  const containsLiteralSecret = secretValue ? commandText.includes(secretValue) : false;
  const containsLongLiteral = /[A-Za-z0-9_-]{48,}/.test(commandText.replace(SCHEDULER_VAULT_SECRET_NAME, ""));
  const ok = metadata.code === 0 && command.code === 0 && containsHeader && containsVault && !containsLiteralSecret && !containsLongLiteral;

  evidence.push(`post-application scheduler metadata query: ${metadata.code === 0 ? "ok" : "failed"}`);
  evidence.push(`post-application scheduler command header present: ${containsHeader ? "yes" : "no"}`);
  evidence.push(`post-application scheduler command vault reference present: ${containsVault ? "yes" : "no"}`);
  evidence.push(`post-application scheduler command literal secret present: ${containsLiteralSecret ? "yes" : "no"}`);
  evidence.push(`post-application scheduler command long literal concern: ${containsLongLiteral ? "yes" : "no"}`);

  const metadataLine = metadata.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0] || "";
  const metadataParts = metadataLine.split("\t");
  const metadataSummary = metadataParts.length >= 4
    ? `jobid=${metadataParts[0]}; jobname=${metadataParts[1]}; schedule=${metadataParts[2]}; active=${metadataParts[3]}`
    : "metadata unavailable";

  return {
    ok,
    summary: ok ? "post-application scheduler metadata and redacted command checks passed" : "post-application scheduler command check failed or unsafe literal concern found",
    report: {
      metadata: metadataSummary,
      commandContainsHeader: containsHeader ? "yes" : "no",
      commandContainsVaultReference: containsVault ? "yes" : "no",
      commandContainsLiteralSecret: containsLiteralSecret ? "yes" : "no",
      commandContainsLongLiteralConcern: containsLongLiteral ? "yes" : "no",
    },
  };
}

function buildSchedulerVaultReport({
  repo,
  envShape,
  sqlTooling,
  dbUrlShape,
  dbConnectivity,
  discovery,
  decision,
  vaultResult,
  schedulerApply,
  postApplication,
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
    dbUrlShape: dbUrlShape ? dbUrlShape.summary : "not checked",
    dbConnectivity: dbConnectivity || { attempted: "no", result: "not checked" },
    readOnlyDiscovery: discovery ? discovery.summary : "not checked",
    vaultFunctionSignatures: discovery ? discovery.vaultFunctionSignaturesSummary : "not checked",
    currentJob: discovery && discovery.currentJob
      ? `jobid=${discovery.currentJob.jobid}; jobname=${discovery.currentJob.jobname}; schedule=${discovery.currentJob.schedule}; active=${discovery.currentJob.active}`
      : "not found",
    safePathDecision: decision ? `${decision.decision}: ${decision.summary}` : "not decided",
    plannedSchedulerChange: decision ? decision.plannedChange : "not planned",
    vaultSecretResult: vaultResult || { attempted: "no", result: "not run" },
    schedulerApplyResult: schedulerApply || { attempted: "no", result: "not run" },
    postApplication: postApplication || { metadata: "not run" },
    commandsNotRun: schedulerVaultCommandsNotRun(),
    secretExposureCheck: "no DB URL or secret values printed; temporary secret SQL file stayed outside the target repo and was deleted; cron command check did not print full command",
    finalStatus,
    nextPermission: finalStatus === "Scheduler applied via Vault, runtime not verified"
      ? "approve runtime verification only"
      : finalStatus === "Needs John: database connection URL missing"
        ? "add SUPABASE_DB_URL locally"
        : finalStatus === "DB CONNECTIVITY BLOCKED" || finalStatus === "DB URL STILL POINTS TO DIRECT HOST"
          ? "provide an IPv4-reachable Supabase pooler DB URL"
        : "approve manual Vault/dashboard scheduler path",
  };
}

function buildSchedulerVaultReportSkeleton() {
  return buildSchedulerVaultReport({
      repo: null,
      envShape: null,
      sqlTooling: null,
      dbUrlShape: null,
      dbConnectivity: null,
      discovery: null,
    decision: null,
    vaultResult: null,
    schedulerApply: null,
    postApplication: null,
    finalStatus: "DRY RUN PASS",
  });
}

function schedulerVaultCommandsNotRun() {
  return [
    "function deploy",
    "supabase db push",
    "migration apply",
    "unrelated SQL",
    "app table writes",
    "pet_tips writes",
    "Edge Function valid scheduler invocation",
    "admin bearer success request",
    "manual successful import request",
    "Git push / PR / merge",
    "staging evidence/",
    "staging supabase/.temp/",
  ];
}

function schedulerVaultBlocked(ledgerStatus, summary, partial = {}) {
  return {
    finalStatus: ledgerStatus,
    ledgerStatus,
    summary,
    nextPermission: partial.nextPermission || (
      ledgerStatus === "Needs John: database connection URL missing"
        ? "add SUPABASE_DB_URL locally"
        : "approve manual Vault/dashboard scheduler path"
    ),
    nextSkill: ledgerStatus === "Needs John: database connection URL missing"
      ? "env-audit-skill / Supabase database URL provisioning"
      : "security-hardening-review-skill / scheduler secret storage design",
    schedulerVaultDesignApply: buildSchedulerVaultReport({
      repo: partial.repo || null,
      envShape: partial.envShape || null,
      sqlTooling: partial.sqlTooling || null,
      dbUrlShape: partial.dbUrlShape || null,
      dbConnectivity: partial.dbConnectivity || null,
      discovery: partial.discovery || null,
      decision: partial.decision || null,
      vaultResult: partial.vaultResult || null,
      schedulerApply: partial.schedulerApply || null,
      postApplication: partial.postApplication || null,
      finalStatus: ledgerStatus,
    }),
    exitCode: 1,
  };
}

module.exports = {
  runScheduledRunMonitoringHandoff,
  scheduledMonitoringBaseline,
  collectScheduledRunMonitoringRepoEvidence,
  collectScheduledRunMonitoringEnvShape,
  checkScheduledRunMonitoringEnv,
  collectScheduledRunSchedulerMetadata,
  collectScheduledRunHistory,
  parseScheduledRunHistoryRows,
  formatScheduledRunHistoryRow,
  inspectScheduledRunSourceDocsEvidence,
  decideScheduledRunMonitoringStatus,
  detectScheduledRunMonitoringSecretExposure,
  buildScheduledRunMonitoringHandoffReport,
  buildScheduledRunMonitoringHandoffSkeleton,
  scheduledRunMonitoringCommandsNotRun,
  scheduledRunMonitoringBlocked,
  collectSchedulerApplicationRepoEvidence,
  inspectSchedulerApplicationEvidence,
  collectSchedulerApplicationEnvShape,
  checkSchedulerApplicationEnv,
  inspectSchedulerApplicationCli,
  discoverSchedulerApplicationCapabilities,
  decideSchedulerApplicationSafePath,
  buildSchedulerApplicationDecisionReport,
  buildSchedulerApplicationDecisionSkeleton,
  schedulerApplicationCommandsNotRun,
  schedulerApplicationBlocked,
  collectSchedulerVaultRepoEvidence,
  collectSchedulerVaultEnvShape,
  checkSchedulerVaultEnv,
  checkSchedulerVaultSqlTooling,
  classifySchedulerVaultDbUrlShape,
  extractDbUrlHost,
  buildPsqlConnectionTarget,
  splitOnce,
  parseHostPort,
  parseConnectionQuery,
  maybeDecode,
  libpqQuote,
  runPsqlRedacted,
  checkSchedulerVaultDbConnectivity,
  discoverSchedulerVaultCapabilities,
  decideSchedulerVaultSafePath,
  upsertSchedulerVaultSecret,
  applySchedulerVaultCron,
  inspectSchedulerVaultPostApplication,
  buildSchedulerVaultReport,
  buildSchedulerVaultReportSkeleton,
  schedulerVaultCommandsNotRun,
  schedulerVaultBlocked,
};
