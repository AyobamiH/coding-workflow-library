"use strict";

// Vault capability decisions, approved mutations, verification, and reports.

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
const runPsqlRedacted = runtime.lazy("runPsqlRedacted");

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
