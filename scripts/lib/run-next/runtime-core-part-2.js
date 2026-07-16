"use strict";

// Safe summaries, source classification, sanitisation, SQL, and time helpers.

const runtime = require("./runtime-context");
const { fs, path, laneState, objectiveAuthority, LIBRARY_ROOT, EXPECTED_COMMIT, EXPECTED_COMMIT_SUBJECT, INTENDED_PR_FILES, IMPORT_FUNCTION_NAME, REQUIRED_IMPORT_SECRET, args, targetRepo, dryRun, selectedLane, evidence, actions, filesChanged, spawnSync } = runtime.pick(["fs","path","laneState","objectiveAuthority","LIBRARY_ROOT","EXPECTED_COMMIT","EXPECTED_COMMIT_SUBJECT","INTENDED_PR_FILES","IMPORT_FUNCTION_NAME","REQUIRED_IMPORT_SECRET","args","targetRepo","dryRun","selectedLane","evidence","actions","filesChanged","spawnSync"]);
const main = runtime.lazy("main");
const hasSchedulerVaultApplyPermission = runtime.lazy("hasSchedulerVaultApplyPermission");
const releaseVersionFromObjective = runtime.lazy("releaseVersionFromObjective");
const isNonBlockingResult = runtime.lazy("isNonBlockingResult");
const checkpoint = runtime.lazy("checkpoint");

// Cross-part calls stay late-bound so the run-next registry remains cycle-safe.
const run = runtime.lazy("run");

function johnNeededSummary(result) {
  if (result.finalStatus === "Scheduled run pending, production handoff ready") {
    return "Yes to wait for next scheduled run and recheck monitoring, finalize production handoff, verify deployed RLS/grants, or hold.";
  }
  if (result.finalStatus === "Scheduled run observed, production handoff ready") {
    return "Yes to finalize production handoff, verify deployed RLS/grants, or hold.";
  }
  if (String(result.finalStatus || "").startsWith("Scheduled run monitoring blocked:")) {
    return "Yes for scheduled-run monitoring failure triage.";
  }
  if (result.finalStatus === "Controlled success invocation completed") {
    return "Yes for scheduled-run monitoring, deployed RLS/grants verification, final production handoff, or hold.";
  }
  if (String(result.finalStatus || "").startsWith("Controlled success invocation blocked:")) {
    return "Yes for controlled invocation failure triage.";
  }
  if (
    result.finalStatus === "Function deployed, negative runtime verified, success path not run" ||
    result.finalStatus === "Function deployed, dry-run runtime verified, success path not run"
  ) {
    return "Yes for controlled success invocation, waiting for scheduled run, deployed RLS/grants verification, production confidence, or hold.";
  }
  if (result.finalStatus === "Function deployed, negative runtime checks failed, success path not run") {
    return "Yes for runtime failure triage and source/deployment patch planning.";
  }
  if (
    result.finalStatus === "Scheduler applied via Vault, runtime success not verified" ||
    result.finalStatus === "Scheduler applied via Vault, runtime not verified"
  ) {
    return "Yes for runtime verification only, admin success request, deployed RLS/grants verification, or hold.";
  }
  if (result.finalStatus === "DB CONNECTIVITY BLOCKED") {
    return "Yes to provide or repair an IPv4-reachable Supabase pooler DB URL.";
  }
  if (result.finalStatus === "DB URL STILL POINTS TO DIRECT HOST") {
    return "Yes to replace SUPABASE_DB_URL with an IPv4-reachable Supabase pooler DB URL.";
  }
  if (result.finalStatus === "Needs John: database connection URL missing") {
    return "Yes to add SUPABASE_DB_URL or DATABASE_URL locally.";
  }
  if (result.finalStatus === "Needs John: psql unavailable for non-interactive DB inspection") {
    return "Yes to install psql locally or approve another non-interactive SQL tool.";
  }
  if (result.finalStatus === "Scheduler blocked: Vault/pg_cron/pg_net capability not proven") {
    return "Yes for manual Vault/dashboard scheduler path or capability provisioning.";
  }
  if (result.finalStatus === "Scheduler applied, runtime success not verified") {
    return "Yes for controlled scheduler success verification, admin success request, deployed RLS/grants verification, or hold.";
  }
  if (result.finalStatus === "Scheduler blocked: safe secret storage path not proven") {
    return "Yes for scheduler secret storage design.";
  }
  if (result.finalStatus === "Runtime negative checks passed, scheduler not applied") {
    return "Yes for scheduler application planning, valid scheduler request, admin success request, db push, migration execution, SQL, production success checks, or hold.";
  }
  if (result.finalStatus === "Runtime negative checks failed, scheduler blocked") {
    return "Yes for runtime failure triage and source patch planning.";
  }
  if (result.finalStatus === "Function deployed and remote secret set, scheduler not applied") {
    return "Yes for runtime verification, scheduler application, db push, migration execution, SQL, production endpoint checks, or hold.";
  }
  if (result.finalStatus === "Scheduler migration draft merged, not applied") {
    return "Yes for any Supabase remote secret setup, scheduler application, deployment, migration execution, runtime verification, or production check.";
  }
  if (result.finalStatus === "Scheduler migration PR opened, not merged") {
    return "Yes for scheduler migration PR readiness/merge decision, remote secret setup, reviewed scheduler application, function deploy, runtime verification, or hold.";
  }
  if (result.finalStatus === "Supabase linked and local secret ready, not deployed") {
    return "Yes for remote secret setup and scheduler migration draft, function deploy, runtime verification, unrelated validation fixes, or hold.";
  }
  if (
    result.finalStatus === "NEEDS JOHN: Supabase link requires interactive credential" ||
    result.finalStatus === "NEEDS JOHN: Supabase project access failed" ||
    result.finalStatus === "NEEDS JOHN: Supabase project ref mismatch" ||
    result.finalStatus === "BLOCKED: unexpected target repo changes"
  ) {
    return "Yes for the reported Supabase link/local secret readiness boundary.";
  }
  if (result.finalStatus === "SUPABASE AUTH PASS FOR TOOLING") {
    return "Yes for Supabase link/secret readiness, local scheduler migration draft, runtime verification, unrelated validation fixes, or hold.";
  }
  if (
    result.finalStatus === "NEEDS JOHN: Supabase access token missing" ||
    result.finalStatus === "NEEDS JOHN: Supabase access token invalid" ||
    result.finalStatus === "NEEDS JOHN: Supabase token lacks project access" ||
    result.finalStatus === "NEEDS JOHN: Supabase project ref mismatch" ||
    result.finalStatus === "BLOCKED: Node/npx/Supabase CLI unavailable"
  ) {
    return "Yes for the reported Supabase tooling/auth fix.";
  }
  if (result.finalStatus === "Supabase execution preflight ready, not executed") {
    return "Yes for Supabase tooling/auth setup, local scheduler migration draft, runtime verification, unrelated validation fixes, or hold.";
  }
  if (result.finalStatus === "Deployment plan ready, not deployed") {
    return "Yes for Supabase secret/scheduler/deploy execution planning, runtime verification, unrelated validation fixes, or hold.";
  }
  if (result.finalStatus === "Merged, not deployed") {
    return "Yes for deployment planning, unrelated validation fixes, or hold.";
  }
  if (isNonBlockingResult(result.finalStatus)) {
    return "Yes for merge, deployment planning, or unrelated validation fixes.";
  }
  return "Yes for the next permission boundary.";
}

function summarizeList(items, limit) {
  if (!items.length) return "none";
  const shown = items.slice(0, limit).join(" | ");
  const suffix = items.length > limit ? ` | ... ${items.length - limit} more` : "";
  return shown + suffix;
}

function summarizeCommitShow(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const commitLine = lines.find((line) => /^commit\s+/i.test(line));
  const subjectLine = lines.find((line) => line === EXPECTED_COMMIT_SUBJECT) || lines.find((line) => !/^(commit|author:|date:)/i.test(line));
  const files = lines.filter((line) => INTENDED_PR_FILES.includes(line));
  const statLine = lines.find((line) => /\bfile(s)? changed\b/.test(line));
  return [commitLine ? commitLine.replace(/^commit\s+/, "").slice(0, 7) : EXPECTED_COMMIT, subjectLine, files.length ? `files: ${files.join(", ")}` : "", statLine]
    .filter(Boolean)
    .join("; ");
}

function sortedRelativeLines(repo, text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => path.isAbsolute(line) ? path.relative(repo, line) : line)
    .sort();
}

function relativizeLine(repo, line) {
  return String(line || "").replace(new RegExp(escapeRegExp(`${repo}/`), "g"), "");
}

function parsePackageJson(text) {
  try {
    const parsed = JSON.parse(text || "{}");
    const scripts = parsed && parsed.scripts && typeof parsed.scripts === "object"
      ? Object.keys(parsed.scripts).sort()
      : [];
    return { ok: true, scripts };
  } catch (error) {
    return { ok: false, scripts: [`package.json parse failed: ${error.message}`] };
  }
}

function summarizeSupabaseConfig(text) {
  if (!text) return "not found or unreadable";
  const lines = text.split(/\r?\n/);
  const functionSection = lines.find((line) => line.includes(`[functions.${IMPORT_FUNCTION_NAME}]`));
  const verifyJwt = lines.find((line) => /verify_jwt\s*=/.test(line));
  return [
    functionSection ? `${IMPORT_FUNCTION_NAME} section present` : `${IMPORT_FUNCTION_NAME} section not found`,
    verifyJwt ? verifyJwt.trim() : "verify_jwt not found in captured config excerpt",
  ].join("; ");
}

function summarizeImportFunction(text) {
  if (!text) return "not found or unreadable";
  const markers = [];
  if (text.includes(REQUIRED_IMPORT_SECRET)) markers.push(`${REQUIRED_IMPORT_SECRET} referenced`);
  if (text.includes("x-import-reddit-tips-secret")) markers.push("x-import-reddit-tips-secret header referenced");
  if (text.includes("SUPABASE_SERVICE_ROLE_KEY")) markers.push("SUPABASE_SERVICE_ROLE_KEY referenced");
  if (/auth\.getUser|is_admin|admin/i.test(text)) markers.push("admin/auth check evidence present");
  if (/rateLimit|rate limit|429/i.test(text)) markers.push("rate-limit evidence present");
  if (/pet_tips/.test(text) && /\.(insert|upsert|update|delete)\s*\(/.test(text)) markers.push("pet_tips write evidence present");
  return markers.length ? markers.join("; ") : "function source read, but expected security markers were not summarized";
}

function classifySchedulerEvidence(grepHits) {
  const relativeHits = grepHits.map((line) => relativizeLine(targetRepo, line));
  const hasSqlScheduler = relativeHits.some((line) => /pg_cron|cron|net\.http/i.test(line) && /supabase\/migrations/i.test(line));
  const hasDocsScheduler = relativeHits.some((line) => /schedule|scheduler|cron|x-import-reddit-tips-secret/i.test(line) && /docs\//i.test(line));
  const hasFunctionSecretHeader = relativeHits.some((line) => /x-import-reddit-tips-secret|IMPORT_REDDIT_TIPS_SECRET/i.test(line) && /supabase\/functions/i.test(line));

  let summary = "scheduled calls must send x-import-reddit-tips-secret; old anon-key-only scheduled calls are not sufficient";
  if (hasSqlScheduler) {
    summary += "; source suggests a SQL/pg_cron scheduler path exists and needs a reviewed migration or SQL update later";
  } else if (hasDocsScheduler) {
    summary += "; source docs mention scheduler requirements, but no SQL/pg_cron scheduler definition was confirmed in this planning run";
  } else {
    summary += "; no scheduler definition was found in inspected source, so an external scheduler update may be required";
  }

  return {
    summary,
    sqlSchedulerEvidence: hasSqlScheduler,
    docsSchedulerEvidence: hasDocsScheduler,
    functionHeaderEvidence: hasFunctionSecretHeader,
    hits: relativeHits,
  };
}

function extractSupabaseProjectRef(configText, schedulerHits, remoteText) {
  const configMatch = String(configText || "").match(/project_id\s*=\s*["']?([a-z0-9-]+)["']?/i);
  if (configMatch) {
    return {
      value: configMatch[1],
      summary: `project ref found in supabase/config.toml as project_id (${configMatch[1]})`,
    };
  }

  const urlHit = schedulerHits.find((line) => /https:\/\/([a-z0-9-]+)\.supabase\.co/i.test(line));
  if (urlHit) {
    const match = urlHit.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
    if (match) {
      return {
        value: match[1],
        summary: `project ref inferred from source Supabase URL (${match[1]}); verify before linking`,
      };
    }
  }

  if (/AyobamiH\/wagging-web-wins/i.test(remoteText || "")) {
    return {
      value: null,
      summary: "Needs John: Supabase project ref; GitHub remote does not prove Supabase project ref",
    };
  }

  return {
    value: null,
    summary: "Needs John: Supabase project ref",
  };
}

function classifySupabaseScheduler(schedulerHits) {
  const hasSqlScheduler = schedulerHits.some((line) => /cron\.schedule|pg_cron|net\.http_post|http_post/i.test(line) && /supabase\/migrations/i.test(line));
  const hasUnschedule = schedulerHits.some((line) => /cron\.unschedule/i.test(line));
  const hasAlterJob = schedulerHits.some((line) => /cron\.alter_job/i.test(line));
  const hasSecretHeader = schedulerHits.some((line) => /x-import-reddit-tips-secret/i.test(line));
  const hasAuthorization = schedulerHits.some((line) => /authorization|bearer|apikey/i.test(line));
  const usesAnonOnlyHeaders = hasSqlScheduler && !hasSecretHeader;
  const jobNameHit = schedulerHits.find((line) => /import-reddit-tips-daily/i.test(line));
  const jobName = jobNameHit ? "import-reddit-tips-daily" : "<existing-job-name>";

  let summary = "No scheduler source was confirmed in inspected migrations/docs.";
  if (hasSqlScheduler) {
    summary = `SQL/pg_cron scheduler evidence found in migrations; existing job name appears to be ${jobName}.`;
    if (usesAnonOnlyHeaders) summary += " Existing source does not show x-import-reddit-tips-secret in scheduler headers.";
    if (hasAuthorization || schedulerHits.some((line) => /apikey/i.test(line))) summary += " Existing source references Authorization/apikey style headers.";
  }

  let updateDecision = "Scheduler location unclear; determine source of scheduled calls before execution.";
  if (hasSqlScheduler) {
    updateDecision = "Do not edit old applied migration directly; draft a new reviewed migration or use Dashboard/Cron update to add x-import-reddit-tips-secret. Old scheduled call will fail after deploy unless updated.";
    if (hasAlterJob) updateDecision += " Source mentions cron.alter_job, so verify support before choosing unschedule/reschedule.";
    if (hasUnschedule) updateDecision += " Source already mentions cron.unschedule, so a replacement migration may follow that pattern.";
  }

  return {
    hasSqlScheduler,
    hasSecretHeader,
    hasAuthorization,
    hasUnschedule,
    hasAlterJob,
    usesAnonOnlyHeaders,
    jobName,
    summary,
    updateDecision,
  };
}

function classifySupabaseEnvEvidence(envHits, functionText) {
  const variableNames = Array.from(new Set(envHits
    .map((line) => {
      const match = line.match(/(SUPABASE_ACCESS_TOKEN|SUPABASE_PROJECT_REF|IMPORT_REDDIT_TIPS_SECRET|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY)/);
      return match ? match[1] : null;
    })
    .filter(Boolean)))
    .sort();
  const functionRequiresSecret = String(functionText || "").includes(REQUIRED_IMPORT_SECRET);
  const hasSecretName = variableNames.includes(REQUIRED_IMPORT_SECRET) || functionRequiresSecret;
  const summaryParts = [];

  if (variableNames.length) summaryParts.push(`env/docs mention variable names: ${variableNames.join(", ")}`);
  else summaryParts.push("no requested Supabase env variable names found in .env.example/docs");
  if (hasSecretName) summaryParts.push(`${REQUIRED_IMPORT_SECRET} name is present, but no value was inspected or printed`);
  else summaryParts.push(`${REQUIRED_IMPORT_SECRET} name not confirmed in env docs`);

  return {
    variableNames,
    secretValueAvailable: false,
    summary: `${summaryParts.join("; ")}; Needs John: provide secret value locally or approve secret generation`,
  };
}

function sanitizeEnvEvidenceLine(line) {
  return String(line || "")
    .replace(/=(['"]?)[^'"\s]+/g, "=<redacted>")
    .replace(/:\s*(gh[pousr]_|github_pat_|sk-|eyJ)[^\s]+/g, ": <redacted>");
}

function formatCliAvailability(items) {
  return items.map((item) => `${item.name}: ${item.path}`).join("; ");
}

function sanitize(text) {
  return String(text)
    .replace(/^set-cookie:.*$/gim, "set-cookie: [cookie-redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[database-url-redacted]")
    .replace(/password\s*=\s*'[^']*'/gi, "password='[redacted]'")
    .replace(/password\s*=\s*[^\s]+/gi, "password=[redacted]")
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[github-token-redacted]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[github-token-redacted]")
    .replace(/sbp_[A-Za-z0-9_]+/g, "[supabase-token-redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[secret-key-redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt-redacted]");
}

function sanitizeSensitive(text, values = []) {
  let output = sanitize(text);
  for (const value of values) {
    if (!value) continue;
    output = output.replace(new RegExp(escapeRegExp(value), "g"), "[sensitive-value-redacted]");
  }
  return output;
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function firstLine(text) {
  return String(text || "")
    .trim()
    .split(/\r?\n/)[0] || "(no output)";
}

function firstNonEmptyLine(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0] || "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function timestampForMigration() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

module.exports = {
  johnNeededSummary,
  summarizeList,
  summarizeCommitShow,
  sortedRelativeLines,
  relativizeLine,
  parsePackageJson,
  summarizeSupabaseConfig,
  summarizeImportFunction,
  classifySchedulerEvidence,
  extractSupabaseProjectRef,
  classifySupabaseScheduler,
  classifySupabaseEnvEvidence,
  sanitizeEnvEvidenceLine,
  formatCliAvailability,
  sanitize,
  sanitizeSensitive,
  sqlQuote,
  firstLine,
  firstNonEmptyLine,
  escapeRegExp,
  today,
  timestampForMigration,
};
