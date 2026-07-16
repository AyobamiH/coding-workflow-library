"use strict";

// Observability outcomes, deploy preflight, database evidence, and blockers.

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
const buildObservabilityRunRecheckReport = runtime.lazy("buildObservabilityRunRecheckReport");

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
