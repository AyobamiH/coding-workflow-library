"use strict";

// Scheduled-run monitoring and the first scheduler-application evidence stage.

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

// Cross-part calls stay late-bound so the run-next registry remains cycle-safe.
const checkSchedulerVaultSqlTooling = runtime.lazy("checkSchedulerVaultSqlTooling");
const runPsqlRedacted = runtime.lazy("runPsqlRedacted");
const schedulerApplicationBlocked = runtime.lazy("schedulerApplicationBlocked");

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
};
