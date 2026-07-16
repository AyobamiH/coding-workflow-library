"use strict";

// Scheduler decisions, Vault preflight, and redacted database connectivity.

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
const schedulerVaultBlocked = runtime.lazy("schedulerVaultBlocked");

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

module.exports = {
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
};
