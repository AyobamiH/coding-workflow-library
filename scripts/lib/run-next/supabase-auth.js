"use strict";

const runtime = require("./runtime-context");
const { fs, path, DEFAULT_TEMP_ROOT, IMPORT_FUNCTION_NAME, IMPORT_FUNCTION_DIR, REQUIRED_IMPORT_SECRET, EXPECTED_SUPABASE_PROJECT_REF, targetRepo, evidence, actions, filesChanged, spawnSync } = runtime.pick(["fs","path","DEFAULT_TEMP_ROOT","IMPORT_FUNCTION_NAME","IMPORT_FUNCTION_DIR","REQUIRED_IMPORT_SECRET","EXPECTED_SUPABASE_PROJECT_REF","targetRepo","evidence","actions","filesChanged","spawnSync"]);
const loadEnvFile = runtime.lazy("loadEnvFile");
const run = runtime.lazy("run");
const summarizeList = runtime.lazy("summarizeList");
const sortedRelativeLines = runtime.lazy("sortedRelativeLines");
const relativizeLine = runtime.lazy("relativizeLine");
const sanitizeEnvEvidenceLine = runtime.lazy("sanitizeEnvEvidenceLine");
const sanitize = runtime.lazy("sanitize");
const firstLine = runtime.lazy("firstLine");

function collectSupabaseLinkRepoEvidence(repo, phase) {
  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-8"]);

  if ([status, branch, log].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: linkSecretReadinessBlocked(`${phase} git evidence failed`, "one or more read-only git evidence commands failed"),
    };
  }

  const data = {
    phase,
    status: status.stdout.trim() || "clean",
    branch: branch.stdout.trim() || "(detached)",
    log: log.stdout.trim(),
  };
  const unexpected = classifyUnexpectedTargetRepoChanges(data.status);
  if (unexpected.hasUnexpected) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED: unexpected target repo changes",
        ledgerStatus: "Blocked: unexpected target repo changes",
        summary: unexpected.summary,
        nextPermission: "manual review of target repo changes",
        nextSkill: "repo-map-skill",
        supabaseLinkSecretReadiness: buildSupabaseLinkSecretReadinessReport({
          repo: data,
          authResult: "not checked",
          linkResult: "not run",
          localFilesChangedByLink: "not checked",
          localSecretReadiness: "not checked",
          finalStatus: "BLOCKED: unexpected target repo changes",
        }),
        exitCode: 1,
      },
    };
  }

  return { ok: true, data };
}

function classifyUnexpectedTargetRepoChanges(statusText) {
  const lines = String(statusText || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const unexpected = lines.filter((line) => {
    if (line === "?? evidence/" || line.startsWith("?? evidence/")) return false;
    if (line === "?? supabase/.temp/" || line.startsWith("?? supabase/.temp/")) return false;
    return true;
  });

  return {
    hasUnexpected: unexpected.length > 0,
    unexpected,
    summary: unexpected.length
      ? `unexpected target repo changes: ${unexpected.join("; ")}`
      : "no unexpected target repo changes",
  };
}

function classifyTrackedTargetRepoChanges(statusText) {
  const lines = String(statusText || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const tracked = lines.filter((line) => !line.startsWith("?? "));

  return {
    hasTrackedChanges: tracked.length > 0,
    tracked,
    summary: tracked.length
      ? `tracked target repo changes: ${tracked.join("; ")}`
      : "no tracked target repo changes",
  };
}

function collectUntrackedStatusLines(statusText) {
  return String(statusText || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("?? "));
}

function decideSupabaseLinkAuthFailure({ envShape, projectRef, version, projectAccess }) {
  const nextSkill = "cloudflare-deploy-skill / Supabase link and local secret readiness";
  if (projectRef.mismatch) {
    return {
      finalStatus: "NEEDS JOHN: Supabase project ref mismatch",
      ledgerStatus: "Needs John: Supabase project ref mismatch",
      summary: projectRef.summary,
      nextPermission: "fix SUPABASE_PROJECT_REF locally or confirm intended project",
      nextSkill,
      exitCode: 2,
    };
  }
  if (!envShape.SUPABASE_ACCESS_TOKEN) {
    return {
      finalStatus: "NEEDS JOHN: Supabase project access failed",
      ledgerStatus: "Needs John: Supabase project access failed",
      summary: "SUPABASE_ACCESS_TOKEN is not set in local runtime env",
      nextPermission: "add SUPABASE_ACCESS_TOKEN locally without pasting it into chat",
      nextSkill,
      exitCode: 2,
    };
  }
  if (!version.ok) {
    return {
      finalStatus: "NEEDS JOHN: Supabase project access failed",
      ledgerStatus: "Needs John: Supabase project access failed",
      summary: version.summary,
      nextPermission: "fix local npx Supabase CLI availability",
      nextSkill,
      exitCode: 2,
    };
  }
  if (!projectAccess.ok) {
    return {
      finalStatus: "NEEDS JOHN: Supabase project access failed",
      ledgerStatus: "Needs John: Supabase project access failed",
      summary: projectAccess.summary,
      nextPermission: "provide Supabase access token with target project access",
      nextSkill,
      exitCode: 2,
    };
  }
  return null;
}

function collectSupabaseTempFiles(repo) {
  const tempDir = path.join(repo, "supabase", ".temp");
  const result = run("find", [tempDir, "-maxdepth", "3", "-type", "f"], {
    allowFailure: true,
  });
  return sortedRelativeLines(repo, result.stdout);
}

function summarizeLinkLocalFiles(statusText, tempFiles) {
  const status = String(statusText || "").trim() || "clean";
  const tempSummary = tempFiles.length ? `supabase/.temp files: ${tempFiles.join(", ")}` : "no supabase/.temp files listed";
  return `git status: ${status}; ${tempSummary}`;
}

function ensureLocalImportSecret(envFile) {
  const current = loadEnvFile(envFile);
  if (current[REQUIRED_IMPORT_SECRET]) {
    return { changed: false, summary: `${REQUIRED_IMPORT_SECRET} is set` };
  }

  const generated = require("crypto").randomBytes(32).toString("hex");
  const existingText = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  const lines = existingText.split(/\r?\n/);
  let replaced = false;
  const updatedLines = lines.map((line) => {
    if (new RegExp(`^(?:export\\s+)?${REQUIRED_IMPORT_SECRET}\\s*=`).test(line.trim())) {
      replaced = true;
      return `${REQUIRED_IMPORT_SECRET}=${generated}`;
    }
    return line;
  });

  if (!replaced) {
    if (updatedLines.length && updatedLines[updatedLines.length - 1] !== "") updatedLines.push("");
    updatedLines.push(`${REQUIRED_IMPORT_SECRET}=${generated}`);
  }

  fs.writeFileSync(envFile, updatedLines.join("\n").replace(/\n*$/, "\n"));
  filesChanged.push(envFile);
  return { changed: true, summary: `${REQUIRED_IMPORT_SECRET} generated and stored locally` };
}

function summarizeSupabaseLinkFailure(result) {
  const first = firstLine(result.stderr || result.stdout);
  if (/password|credential|interactive|prompt|stdin|db/i.test(first)) {
    return `link requires interactive project/database credential: ${first}`;
  }
  return `link did not complete non-interactively: ${first}`;
}

function linkSecretReadinessBlocked(ledgerStatus, summary) {
  return {
    finalStatus: "BLOCKED: unexpected target repo changes",
    ledgerStatus: `Blocked: ${ledgerStatus}`,
    summary,
    nextPermission: "manual review",
    nextSkill: "repo-map-skill",
    supabaseLinkSecretReadiness: buildSupabaseLinkSecretReadinessSkeleton(),
    exitCode: 1,
  };
}

function buildSupabaseLinkSecretReadinessReport({
  repo,
  authResult,
  linkResult,
  localFilesChangedByLink,
  localSecretReadiness,
  finalStatus,
}) {
  return {
    currentLedgerState: "Supabase tooling/auth ready, not linked",
    targetRepoState: repo
      ? {
          repo: targetRepo,
          branch: repo.branch,
          status: repo.status,
          recentLog: repo.log,
        }
      : null,
    authResult,
    linkResult,
    localFilesChangedByLink,
    localSecretReadiness,
    commandsRun: actions.slice(),
    commandsNotRun: supabaseLinkSecretReadinessCommandsNotRun(),
    finalStatus,
    nextPermission: finalStatus === "Supabase linked and local secret ready, not deployed"
      ? "approve remote secret setup and scheduler migration draft"
      : "manual review",
  };
}

function buildSupabaseLinkSecretReadinessSkeleton() {
  return buildSupabaseLinkSecretReadinessReport({
    repo: null,
    authResult: "not checked",
    linkResult: "not run",
    localFilesChangedByLink: "not checked",
    localSecretReadiness: "not checked",
    finalStatus: "DRY RUN PASS",
  });
}

function supabaseLinkSecretReadinessCommandsNotRun() {
  return [
    `supabase secrets set ${REQUIRED_IMPORT_SECRET}=<redacted>`,
    `npx supabase secrets set ${REQUIRED_IMPORT_SECRET}=<redacted>`,
    `supabase functions deploy ${IMPORT_FUNCTION_NAME}`,
    `npx supabase functions deploy ${IMPORT_FUNCTION_NAME}`,
    "supabase db push",
    "Supabase migrations",
    "SQL execution",
    "scheduler mutation",
    "Edge Function invoke",
    "production endpoint curl",
    "git push / PR / merge",
    "staging evidence/",
  ];
}

function collectSecretFunctionDeployRepoEvidence(repo) {
  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-10"]);
  const remote = run("git", ["-C", repo, "remote", "-v"]);
  const staged = run("git", ["-C", repo, "diff", "--cached", "--name-only"]);

  if ([status, branch, log, remote, staged].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: secretFunctionDeployBlocked("Blocked: repo evidence failed", "one or more read-only git evidence commands failed"),
    };
  }

  const data = {
    status: status.stdout.trim() || "clean",
    branch: branch.stdout.trim() || "(detached)",
    log: log.stdout.trim(),
    remote: remote.stdout.trim(),
    staged: staged.stdout.trim(),
  };

  if (data.staged) {
    return {
      ok: false,
      result: secretFunctionDeployBlocked("Blocked: staged files present", `staged files present before deploy: ${data.staged.split(/\r?\n/).join(", ")}`, {
        repo: data,
      }),
    };
  }

  const trackedChanges = classifyTrackedTargetRepoChanges(data.status);
  if (trackedChanges.hasTrackedChanges) {
    return {
      ok: false,
      result: secretFunctionDeployBlocked("Blocked: tracked target repo changes", trackedChanges.summary, {
        repo: data,
      }),
    };
  }

  evidence.push(`remote setup repo branch: ${data.branch}`);
  evidence.push(`remote setup git status: ${data.status}`);
  evidence.push(`remote setup recent log: ${firstLine(data.log)}`);
  evidence.push(`remote setup remote: ${firstLine(data.remote)}`);
  const untracked = collectUntrackedStatusLines(data.status);
  if (untracked.length) {
    evidence.push(`untracked target repo paths not staged or deployed: ${untracked.join("; ")}`);
  }
  return { ok: true, data };
}

function inspectImportFunctionDeploySource(repo) {
  const functionPath = path.join(repo, IMPORT_FUNCTION_DIR, "index.ts");
  if (!fs.existsSync(functionPath)) {
    return {
      ok: false,
      result: secretFunctionDeployBlocked("Blocked: function source missing", `${IMPORT_FUNCTION_DIR}/index.ts not found`),
    };
  }

  const text = fs.readFileSync(functionPath, "utf8");
  const requiredTerms = [
    REQUIRED_IMPORT_SECRET,
    "x-import-reddit-tips-secret",
    "is_admin",
    "rateLimit",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const present = requiredTerms.filter((term) => text.includes(term));
  const missing = requiredTerms.filter((term) => !text.includes(term));
  const grep = run(
    "grep",
    [
      "-nE",
      "IMPORT_REDDIT_TIPS_SECRET|x-import-reddit-tips-secret|is_admin|rateLimit|SUPABASE_SERVICE_ROLE_KEY",
      functionPath,
    ],
    { allowFailure: true },
  );
  const grepLines = grep.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => sanitizeEnvEvidenceLine(relativizeLine(repo, line)));

  evidence.push(`${IMPORT_FUNCTION_NAME} function source exists`);
  evidence.push(`hardened boundary terms present: ${present.join(", ") || "none"}`);
  if (missing.length) {
    return {
      ok: false,
      result: secretFunctionDeployBlocked("Blocked: hardened source boundary incomplete", `missing function terms: ${missing.join(", ")}`, {
        source: {
          exists: true,
          present,
          missing,
          grepSummary: summarizeList(grepLines, 8),
        },
      }),
    };
  }

  return {
    ok: true,
    exists: true,
    present,
    missing,
    grepSummary: summarizeList(grepLines, 8),
    path: path.relative(repo, functionPath),
  };
}

function checkSecretFunctionDeployEnv(envShape) {
  const missing = [];
  if (!envShape.SUPABASE_ACCESS_TOKEN) missing.push("SUPABASE_ACCESS_TOKEN");
  if (!envShape.SUPABASE_PROJECT_REF) missing.push("SUPABASE_PROJECT_REF");
  if (!envShape.IMPORT_REDDIT_TIPS_SECRET) missing.push(REQUIRED_IMPORT_SECRET);

  evidence.push(`deploy env SUPABASE_ACCESS_TOKEN: ${envShape.SUPABASE_ACCESS_TOKEN ? "set" : "not set"}`);
  evidence.push(`deploy env SUPABASE_PROJECT_REF: ${envShape.SUPABASE_PROJECT_REF ? "set" : "not set"}`);
  evidence.push(`deploy env ${REQUIRED_IMPORT_SECRET}: ${envShape.IMPORT_REDDIT_TIPS_SECRET ? "set" : "not set"}`);

  if (missing.length) {
    return {
      ok: false,
      result: secretFunctionDeployNeedsJohn(
        "NEEDS JOHN: Supabase deploy env missing",
        `missing required local env variables: ${missing.join(", ")}`,
        { envShape },
      ),
    };
  }

  if (envShape.SUPABASE_PROJECT_REF !== EXPECTED_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      result: secretFunctionDeployNeedsJohn(
        "NEEDS JOHN: Supabase project ref mismatch",
        `SUPABASE_PROJECT_REF does not match expected project ${EXPECTED_SUPABASE_PROJECT_REF}`,
        { envShape },
      ),
    };
  }

  evidence.push(`deploy env project ref matches ${EXPECTED_SUPABASE_PROJECT_REF}`);
  return { ok: true };
}

function checkSecretFunctionDeployAuth({ tooling, version, projectAccess }) {
  if (!tooling.nodeOk || !tooling.npmOk || !tooling.npxOk || !version.ok) {
    return {
      ok: false,
      result: secretFunctionDeployBlocked(
        "Blocked: Node/npx/Supabase CLI unavailable",
        version.summary || "Node/npm/npx or npx Supabase CLI version check is unavailable",
        { version, projectAccess },
      ),
    };
  }

  if (!projectAccess.ok) {
    return {
      ok: false,
      result: secretFunctionDeployNeedsJohn("NEEDS JOHN: Supabase project access failed", projectAccess.summary, {
        version,
        projectAccess,
      }),
    };
  }

  evidence.push(`npx Supabase version result: ${version.summary}`);
  evidence.push(`Supabase project access result: ${projectAccess.summary}`);
  return { ok: true };
}

function writeTemporaryImportSecretEnv(secret) {
  const tmpDir = DEFAULT_TEMP_ROOT;
  fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(tmpDir, 0o700);
  const file = path.join(tmpDir, "import-reddit-tips-secret.env");
  fs.writeFileSync(file, `${REQUIRED_IMPORT_SECRET}=${secret}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return { path: file };
}

function removeTemporarySecretFile(file) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
  if (fs.existsSync(file)) {
    evidence.push("temporary secret env file removal verification: still present");
  } else {
    evidence.push("temporary secret env file removal verification: absent");
  }
}

function buildSupabaseSecretFunctionDeployReport({
  repo,
  source,
  envShape,
  version,
  projectAccess,
  secretSetupResult,
  tempHandling,
  deployResult,
  finalStatus,
}) {
  return {
    targetRepoState: repo
      ? {
          repo: targetRepo,
          branch: repo.branch,
          status: repo.status,
          recentLog: repo.log,
          remote: repo.remote,
        }
      : null,
    sourceBoundary: source
      ? {
          functionSource: source.path || `${IMPORT_FUNCTION_DIR}/index.ts`,
          hardenedTermsPresent: source.present || [],
          hardenedTermsMissing: source.missing || [],
          grepSummary: source.grepSummary || "not checked",
        }
      : null,
    envPresence: envShape
      ? [
          `SUPABASE_ACCESS_TOKEN=${envShape.SUPABASE_ACCESS_TOKEN ? "set" : "not set"}`,
          `SUPABASE_PROJECT_REF=${envShape.SUPABASE_PROJECT_REF ? "set" : "not set"}`,
          `${REQUIRED_IMPORT_SECRET}=${envShape.IMPORT_REDDIT_TIPS_SECRET ? "set" : "not set"}`,
        ].join("; ")
      : "not checked",
    supabaseAuthResult: projectAccess ? projectAccess.summary : "not checked",
    supabaseCliResult: version ? version.summary : "not checked",
    secretSetupResult,
    tempSecretFileHandling: tempHandling,
    functionDeployResult: deployResult,
    commandsNotRun: supabaseSecretFunctionDeployCommandsNotRun(),
    finalStatus,
    nextPermission: finalStatus === "Function deployed and remote secret set, scheduler not applied"
      ? "approve runtime verification and scheduler application decision"
      : "manual review",
  };
}

function buildSupabaseSecretFunctionDeploySkeleton() {
  return buildSupabaseSecretFunctionDeployReport({
    repo: null,
    source: null,
    envShape: null,
    version: null,
    projectAccess: null,
    secretSetupResult: "dry-run",
    tempHandling: "dry-run",
    deployResult: "dry-run",
    finalStatus: "DRY RUN PASS",
  });
}

function supabaseSecretFunctionDeployCommandsNotRun() {
  return [
    "supabase db push",
    "migration apply",
    "SQL execution",
    "pg_cron/scheduler mutation",
    "Edge Function invoke",
    "runtime verification",
    "production endpoint curl",
    "Git push / PR / merge",
    "staging evidence/",
    "staging supabase/.temp/",
  ];
}

function secretFunctionDeployNeedsJohn(ledgerStatus, summary, partial = {}) {
  return {
    finalStatus: ledgerStatus,
    ledgerStatus,
    summary,
    nextPermission: "provide required local Supabase env/auth or choose safe secret transfer method",
      nextSkill: "supabase-function-deploy-skill / Supabase remote secret setup and single Edge Function deploy",
    supabaseSecretFunctionDeploy: buildSupabaseSecretFunctionDeployReport({
      repo: partial.repo || null,
      source: partial.source || null,
      envShape: partial.envShape || null,
      version: partial.version || null,
      projectAccess: partial.projectAccess || null,
      secretSetupResult: partial.secretSetupResult || "not run",
      tempHandling: partial.tempHandling || "not created",
      deployResult: partial.deployResult || "not run",
      finalStatus: ledgerStatus,
    }),
    exitCode: 2,
  };
}

function secretFunctionDeployBlocked(ledgerStatus, summary, partial = {}) {
  return {
    finalStatus: ledgerStatus.startsWith("Blocked") ? "BLOCKED" : ledgerStatus,
    ledgerStatus,
    summary,
    nextPermission: "manual review of Supabase secret/function deploy workflow",
    nextSkill: "supabase-function-deploy-skill / Supabase remote secret setup and single Edge Function deploy",
    supabaseSecretFunctionDeploy: buildSupabaseSecretFunctionDeployReport({
      repo: partial.repo || null,
      source: partial.source || null,
      envShape: partial.envShape || null,
      version: partial.version || null,
      projectAccess: partial.projectAccess || null,
      secretSetupResult: partial.secretSetupResult || "not run",
      tempHandling: partial.tempHandling || "not created",
      deployResult: partial.deployResult || "not run",
      finalStatus: ledgerStatus,
    }),
    exitCode: 1,
  };
}

function collectRuntimeNegativeRepoEvidence(repo) {
  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-10"]);
  const staged = run("git", ["-C", repo, "diff", "--cached", "--name-only"]);

  if ([status, branch, log, staged].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: runtimeNegativeBlocked("Runtime negative checks failed, scheduler blocked", "one or more read-only git evidence commands failed"),
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
      result: runtimeNegativeBlocked("Runtime negative checks failed, scheduler blocked", `staged files present before runtime checks: ${data.staged.split(/\r?\n/).join(", ")}`, { repo: data }),
    };
  }

  const trackedChanges = classifyTrackedTargetRepoChanges(data.status);
  if (trackedChanges.hasTrackedChanges) {
    return {
      ok: false,
      result: runtimeNegativeBlocked("Runtime negative checks failed, scheduler blocked", trackedChanges.summary, { repo: data }),
    };
  }

  evidence.push(`runtime negative repo branch: ${data.branch}`);
  evidence.push(`runtime negative git status: ${data.status}`);
  evidence.push(`runtime negative recent log: ${firstLine(data.log)}`);
  const untracked = collectUntrackedStatusLines(data.status);
  if (untracked.length) {
    evidence.push(`untracked target repo paths not staged or used for runtime checks: ${untracked.join("; ")}`);
  }

  return { ok: true, data };
}

function inspectRuntimeNegativeSource(repo) {
  const functionPath = path.join(repo, IMPORT_FUNCTION_DIR, "index.ts");
  if (!fs.existsSync(functionPath)) {
    return {
      ok: false,
      result: runtimeNegativeBlocked("Runtime negative checks failed, scheduler blocked", `${IMPORT_FUNCTION_DIR}/index.ts not found`),
    };
  }

  const grep = run(
    "grep",
    [
      "-nE",
      "OPTIONS|method|POST|x-import-reddit-tips-secret|IMPORT_REDDIT_TIPS_SECRET|is_admin|rateLimit|SUPABASE_SERVICE_ROLE_KEY|createClient|pet_tips|insert",
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
  const requiredTerms = ["OPTIONS", "POST", "x-import-reddit-tips-secret", REQUIRED_IMPORT_SECRET, "is_admin", "rateLimit", "SUPABASE_SERVICE_ROLE_KEY", "pet_tips"];
  const present = requiredTerms.filter((term) => text.includes(term));
  const missing = requiredTerms.filter((term) => !text.includes(term));
  evidence.push(`${IMPORT_FUNCTION_NAME} runtime source inspected`);
  evidence.push(`runtime auth-boundary terms present: ${present.join(", ") || "none"}`);

  if (missing.length) {
    return {
      ok: false,
      result: runtimeNegativeBlocked("Runtime negative checks failed, scheduler blocked", `missing runtime source terms: ${missing.join(", ")}`, {
        source: {
          path: path.relative(repo, functionPath),
          present,
          missing,
          grepSummary: summarizeList(grepLines, 12),
        },
      }),
    };
  }

  return {
    ok: true,
    path: path.relative(repo, functionPath),
    present,
    missing,
    grepSummary: summarizeList(grepLines, 12),
  };
}

function collectRuntimeNegativeEnvShape(file) {
  const parsed = loadEnvFile(file);
  const anonKeySource = parsed.SUPABASE_ANON_KEY
    ? "SUPABASE_ANON_KEY"
    : parsed.VITE_SUPABASE_ANON_KEY
      ? "VITE_SUPABASE_ANON_KEY"
      : "";

  return {
    file,
    SUPABASE_PROJECT_REF: parsed.SUPABASE_PROJECT_REF || "",
    ["SUPABASE_ACCESS_" + "TOKEN"]: parsed.SUPABASE_ACCESS_TOKEN || "",
    [REQUIRED_IMPORT_SECRET]: parsed[REQUIRED_IMPORT_SECRET] || "",
    ANON_KEY: anonKeySource ? parsed[anonKeySource] : "",
    anonKeySource,
    summary: [
      `SUPABASE_PROJECT_REF=${parsed.SUPABASE_PROJECT_REF ? "set" : "not set"}`,
      `SUPABASE_ACCESS_TOKEN=${parsed.SUPABASE_ACCESS_TOKEN ? "set" : "not set"}`,
      `${REQUIRED_IMPORT_SECRET}=${parsed[REQUIRED_IMPORT_SECRET] ? "set" : "not set"}`,
      `SUPABASE_ANON_KEY=${parsed.SUPABASE_ANON_KEY ? "set" : "not set"}`,
      `VITE_SUPABASE_ANON_KEY=${parsed.VITE_SUPABASE_ANON_KEY ? "set" : "not set"}`,
    ].join("; "),
  };
}

function checkRuntimeNegativeEnv(envShape) {
  evidence.push(`runtime env SUPABASE_PROJECT_REF: ${envShape.SUPABASE_PROJECT_REF ? "set" : "not set"}`);
  evidence.push(`runtime env SUPABASE_ACCESS_TOKEN: ${envShape.SUPABASE_ACCESS_TOKEN ? "set" : "not set"}`);
  evidence.push(`runtime env ${REQUIRED_IMPORT_SECRET}: ${envShape.IMPORT_REDDIT_TIPS_SECRET ? "set" : "not set"}`);
  evidence.push(`runtime env anon key available: ${envShape.ANON_KEY ? "yes" : "no"}`);

  if (!envShape.SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      result: runtimeNegativeBlocked("Runtime negative checks failed, scheduler blocked", "SUPABASE_PROJECT_REF is not set", { envShape }),
    };
  }

  if (envShape.SUPABASE_PROJECT_REF !== EXPECTED_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      result: runtimeNegativeBlocked("Runtime negative checks failed, scheduler blocked", `SUPABASE_PROJECT_REF does not match expected project ${EXPECTED_SUPABASE_PROJECT_REF}`, { envShape }),
    };
  }

  evidence.push(`runtime env project ref matches ${EXPECTED_SUPABASE_PROJECT_REF}`);
  return { ok: true };
}

function runRuntimeHttpCheck({ name, script, env, expected }) {
  const result = spawnSync("bash", ["-lc", script], {
    cwd: targetRepo,
    env,
    encoding: "utf8",
    timeout: 30000,
  });
  const code = typeof result.status === "number" ? result.status : result.error ? 1 : 0;
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`;
  const sanitized = sanitize(raw);
  const statusLine = extractHttpStatusLine(sanitized);
  const statusCode = extractHttpStatusCode(statusLine);
  const importLike = expected === "reject" && /import(ed|ing)?|insert(ed|ing)?|success|created|published/i.test(sanitized);
  let passed = code === 0 && Boolean(statusCode);

  if (expected === "cors") {
    passed = passed && statusCode >= 200 && statusCode < 400;
  } else {
    passed = passed && statusCode >= 400 && !importLike;
  }

  const summary = `${statusLine || "no HTTP status"}; ${passed ? "PASS" : "FAIL"}`;
  actions.push(`curl negative runtime check ${name}: exit ${code}`);
  evidence.push(`${name} result: ${summary}`);

  return {
    name,
    expected,
    code,
    statusLine: statusLine || "no HTTP status",
    statusCode,
    passed,
    skipped: false,
    summary,
    raw,
    sanitized: summarizeHttpResponse(sanitized),
    importLike,
  };
}

function extractHttpStatusLine(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => /^HTTP\/\S+\s+\d{3}/i.test(line)) || "";
}

function extractHttpStatusCode(statusLine) {
  const match = String(statusLine || "").match(/^HTTP\/\S+\s+(\d{3})/i);
  return match ? Number(match[1]) : null;
}

function summarizeHttpResponse(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => /^set-cookie:/i.test(line) ? "set-cookie: <redacted>" : line)
    .filter(Boolean)
    .slice(0, 10)
    .join(" | ") || "(no response body)";
}

function detectRuntimeSecretExposure(checks, envShape) {
  const secrets = [
    ["SUPABASE_ACCESS_TOKEN", envShape.SUPABASE_ACCESS_TOKEN],
    [REQUIRED_IMPORT_SECRET, envShape.IMPORT_REDDIT_TIPS_SECRET],
    ["anon key", envShape.ANON_KEY],
  ].filter(([, value]) => Boolean(value));
  const exposedNames = new Set();

  for (const check of checks) {
    const raw = check.raw || "";
    for (const [name, value] of secrets) {
      if (value && raw.includes(value)) exposedNames.add(name);
    }
    if (/sbp_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+|BEGIN (RSA|OPENSSH|PRIVATE) KEY/i.test(raw)) {
      exposedNames.add("secret-shaped value");
    }
  }

  const exposed = Array.from(exposedNames);
  return {
    hasExposure: exposed.length > 0,
    summary: exposed.length
      ? `response exposed secret categories: ${exposed.join(", ")}`
      : "no secret values or secret-shaped values found in captured negative responses",
  };
}

function summarizeRuntimeNegativeFailure({ failures, postSuccess, importLike, exposure }) {
  const parts = [];
  if (failures.length) parts.push(`failed checks: ${failures.map((check) => check.name).join(", ")}`);
  if (postSuccess.length) parts.push(`unsafe success status from: ${postSuccess.map((check) => check.name).join(", ")}`);
  if (importLike.length) parts.push(`import-like response from: ${importLike.map((check) => check.name).join(", ")}`);
  if (exposure.hasExposure) parts.push(exposure.summary);
  return parts.join("; ") || "negative runtime verification failed";
}

function buildRuntimeNegativeVerificationReport({
  repo,
  source,
  envShape,
  endpoint,
  checks,
  exposure,
  finalStatus,
}) {
  const findCheck = (name) => checks.find((check) => check.name === name) || null;
  return {
    targetRepoState: repo
      ? {
          repo: targetRepo,
          branch: repo.branch,
          status: repo.status,
          recentLog: repo.log,
        }
      : null,
    sourceBoundary: source
      ? {
          functionSource: source.path || `${IMPORT_FUNCTION_DIR}/index.ts`,
          termsPresent: source.present || [],
          termsMissing: source.missing || [],
          grepSummary: source.grepSummary || "not checked",
        }
      : null,
    envPresence: envShape ? envShape.summary : "not checked",
    endpoint: endpoint || `https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}`,
    options: summarizeRuntimeCheck(findCheck("OPTIONS")),
    get: summarizeRuntimeCheck(findCheck("GET/non-POST")),
    postNoAuth: summarizeRuntimeCheck(findCheck("POST without auth")),
    invalidSchedulerSecret: summarizeRuntimeCheck(findCheck("POST invalid scheduler secret")),
    anonOnly: summarizeRuntimeCheck(findCheck("POST anon-only")),
    secretExposure: exposure ? exposure.summary : "not checked",
    commandsNotRun: runtimeNegativeCommandsNotRun(),
    finalStatus,
    nextPermission: finalStatus === "Runtime negative checks passed, scheduler not applied"
      ? "approve scheduler application planning"
      : "approve runtime failure triage and source patch plan",
  };
}

function buildRuntimeNegativeVerificationSkeleton() {
  return buildRuntimeNegativeVerificationReport({
    repo: null,
    source: null,
    envShape: null,
    endpoint: `https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co/functions/v1/${IMPORT_FUNCTION_NAME}`,
    checks: [],
    exposure: null,
    finalStatus: "DRY RUN PASS",
  });
}

function summarizeRuntimeCheck(check) {
  if (!check) return "not checked";
  if (check.skipped) return check.summary;
  return `${check.summary}; response excerpt: ${check.sanitized}`;
}

function runtimeNegativeCommandsNotRun() {
  return [
    "valid scheduler request",
    "admin bearer success request",
    "successful import/write request",
    "scheduler application",
    "supabase db push",
    "migration apply",
    "SQL execution",
    "pg_cron/scheduler mutation",
    "Supabase secret mutation",
    "Edge Function deploy",
    "Git push / PR / merge",
    "staging evidence/",
    "staging supabase/.temp/",
    "staging docs/import-reddit-tips-supabase-application-plan.md",
  ];
}

function runtimeNegativeBlocked(ledgerStatus, summary, partial = {}) {
  return {
    finalStatus: ledgerStatus,
    ledgerStatus,
    summary,
    nextPermission: "approve runtime failure triage and source patch plan",
    nextSkill: "security-hardening-review-skill / runtime failure triage",
    runtimeNegativeVerification: buildRuntimeNegativeVerificationReport({
      repo: partial.repo || null,
      source: partial.source || null,
      envShape: partial.envShape || null,
      endpoint: "",
      checks: [],
      exposure: null,
      finalStatus: ledgerStatus,
    }),
    exitCode: 1,
  };
}

module.exports = {
  collectSupabaseLinkRepoEvidence,
  classifyUnexpectedTargetRepoChanges,
  classifyTrackedTargetRepoChanges,
  collectUntrackedStatusLines,
  decideSupabaseLinkAuthFailure,
  collectSupabaseTempFiles,
  summarizeLinkLocalFiles,
  ensureLocalImportSecret,
  summarizeSupabaseLinkFailure,
  linkSecretReadinessBlocked,
  buildSupabaseLinkSecretReadinessReport,
  buildSupabaseLinkSecretReadinessSkeleton,
  supabaseLinkSecretReadinessCommandsNotRun,
  collectSecretFunctionDeployRepoEvidence,
  inspectImportFunctionDeploySource,
  checkSecretFunctionDeployEnv,
  checkSecretFunctionDeployAuth,
  writeTemporaryImportSecretEnv,
  removeTemporarySecretFile,
  buildSupabaseSecretFunctionDeployReport,
  buildSupabaseSecretFunctionDeploySkeleton,
  supabaseSecretFunctionDeployCommandsNotRun,
  secretFunctionDeployNeedsJohn,
  secretFunctionDeployBlocked,
  collectRuntimeNegativeRepoEvidence,
  inspectRuntimeNegativeSource,
  collectRuntimeNegativeEnvShape,
  checkRuntimeNegativeEnv,
  runRuntimeHttpCheck,
  extractHttpStatusLine,
  extractHttpStatusCode,
  summarizeHttpResponse,
  detectRuntimeSecretExposure,
  summarizeRuntimeNegativeFailure,
  buildRuntimeNegativeVerificationReport,
  buildRuntimeNegativeVerificationSkeleton,
  summarizeRuntimeCheck,
  runtimeNegativeCommandsNotRun,
  runtimeNegativeBlocked,
};
