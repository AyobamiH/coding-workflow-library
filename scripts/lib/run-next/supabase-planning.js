"use strict";

const runtime = require("./runtime-context");
const { fs, path, EXPECTED_COMMIT, IMPORT_FUNCTION_NAME, IMPORT_FUNCTION_DIR, REQUIRED_IMPORT_SECRET, EXPECTED_SUPABASE_PROJECT_REF, targetRepo, evidence } = runtime.pick(["fs","path","EXPECTED_COMMIT","IMPORT_FUNCTION_NAME","IMPORT_FUNCTION_DIR","REQUIRED_IMPORT_SECRET","EXPECTED_SUPABASE_PROJECT_REF","targetRepo","evidence"]);
const loadEnvFile = runtime.lazy("loadEnvFile");
const run = runtime.lazy("run");
const summarizeList = runtime.lazy("summarizeList");
const summarizeCommitShow = runtime.lazy("summarizeCommitShow");
const sortedRelativeLines = runtime.lazy("sortedRelativeLines");
const relativizeLine = runtime.lazy("relativizeLine");
const parsePackageJson = runtime.lazy("parsePackageJson");
const summarizeSupabaseConfig = runtime.lazy("summarizeSupabaseConfig");
const summarizeImportFunction = runtime.lazy("summarizeImportFunction");
const classifySchedulerEvidence = runtime.lazy("classifySchedulerEvidence");
const extractSupabaseProjectRef = runtime.lazy("extractSupabaseProjectRef");
const classifySupabaseScheduler = runtime.lazy("classifySupabaseScheduler");
const classifySupabaseEnvEvidence = runtime.lazy("classifySupabaseEnvEvidence");
const sanitizeEnvEvidenceLine = runtime.lazy("sanitizeEnvEvidenceLine");
const formatCliAvailability = runtime.lazy("formatCliAvailability");
const firstLine = runtime.lazy("firstLine");

function collectSupabaseToolingRepoEvidence(repo) {
  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-8"]);

  if ([status, branch, log].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED: Node/npx/Supabase CLI unavailable",
        ledgerStatus: "Blocked: Supabase tooling/auth git evidence failed",
        summary: "one or more read-only git evidence commands failed",
        nextPermission: "manual repo repair",
        nextSkill: "repo-map-skill",
        supabaseToolingAuth: buildSupabaseToolingAuthSkeleton(),
        exitCode: 1,
      },
    };
  }

  return {
    ok: true,
    data: {
      status: status.stdout.trim() || "clean",
      branch: branch.stdout.trim() || "(detached)",
      log: log.stdout.trim(),
    },
  };
}

function collectSupabaseToolingAvailability() {
  const nodeVersion = run("node", ["--version"], { allowFailure: true });
  const npmVersion = run("npm", ["--version"], { allowFailure: true });
  const npxVersion = run("npx", ["--version"], { allowFailure: true });
  const supabasePath = run("bash", ["-lc", "command -v supabase || true"], { allowFailure: true });
  const npxPath = run("bash", ["-lc", "command -v npx || true"], { allowFailure: true });

  return {
    nodeVersion: nodeVersion.code === 0 ? nodeVersion.stdout.trim() : "unavailable",
    npmVersion: npmVersion.code === 0 ? npmVersion.stdout.trim() : "unavailable",
    npxVersion: npxVersion.code === 0 ? npxVersion.stdout.trim() : "unavailable",
    supabasePath: supabasePath.stdout.trim() || "not found",
    npxPath: npxPath.stdout.trim() || "not found",
    nodeOk: nodeVersion.code === 0,
    npmOk: npmVersion.code === 0,
    npxOk: npxVersion.code === 0 && Boolean(npxPath.stdout.trim()),
  };
}

function collectSupabaseRuntimeEnvShape(file) {
  const parsed = loadEnvFile(file);
  const names = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF", REQUIRED_IMPORT_SECRET];
  const presentNames = names.filter((name) => Boolean(parsed[name]));
  const shape = names.map((name) => `${name}=${parsed[name] ? "<redacted>" : "<not set>"}`);
  const summary = fs.existsSync(file)
    ? `${shape.join("; ")}`
    : `${file} not found; ${shape.join("; ")}`;

  return {
    file,
    presentNames,
    summary,
    ["SUPABASE_ACCESS_" + "TOKEN"]: parsed.SUPABASE_ACCESS_TOKEN || "",
    SUPABASE_PROJECT_REF: parsed.SUPABASE_PROJECT_REF || "",
    [REQUIRED_IMPORT_SECRET]: parsed[REQUIRED_IMPORT_SECRET] || "",
  };
}

function checkSupabaseProjectRef(envShape) {
  if (envShape.SUPABASE_PROJECT_REF && envShape.SUPABASE_PROJECT_REF !== EXPECTED_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      mismatch: true,
      summary: `NEEDS JOHN: Supabase project ref mismatch; source ref is ${EXPECTED_SUPABASE_PROJECT_REF}`,
    };
  }

  if (!envShape.SUPABASE_PROJECT_REF) {
    return {
      ok: true,
      mismatch: false,
      summary: `SUPABASE_PROJECT_REF not set; source ref is ${EXPECTED_SUPABASE_PROJECT_REF}`,
    };
  }

  return {
    ok: true,
    mismatch: false,
    summary: `SUPABASE_PROJECT_REF matches source ref ${EXPECTED_SUPABASE_PROJECT_REF}`,
  };
}

function checkNpxSupabaseVersion(tooling) {
  if (!tooling.nodeOk || !tooling.npmOk || !tooling.npxOk) {
    return {
      ok: false,
      summary: "not run because Node/npm/npx tooling is unavailable",
    };
  }

  const version = run("npx", ["supabase", "--version"], {
    allowFailure: true,
    timeout: 120000,
  });
  if (version.code !== 0) {
    return {
      ok: false,
      summary: `npx supabase --version failed: ${firstLine(version.stderr || version.stdout)}`,
    };
  }

  return {
    ok: true,
    summary: firstLine(version.stdout || version.stderr),
  };
}

function checkSupabaseProjectAccess(envShape, version) {
  if (!envShape.SUPABASE_ACCESS_TOKEN) {
    return {
      ok: false,
      attempted: false,
      summary: "not attempted because SUPABASE_ACCESS_TOKEN is not set",
    };
  }

  if (!version.ok) {
    return {
      ok: false,
      attempted: false,
      summary: "not attempted because npx supabase --version did not pass",
    };
  }

  const env = {
    ...process.env,
    ["SUPABASE_ACCESS_" + "TOKEN"]: envShape.SUPABASE_ACCESS_TOKEN,
  };
  const projects = run("npx", ["supabase", "projects", "list"], {
    env,
    allowFailure: true,
    timeout: 120000,
  });

  if (projects.code !== 0) {
    const line = firstLine(projects.stderr || projects.stdout);
    const invalid = /auth|token|unauthorized|forbidden|401|403|invalid|expired|not logged/i.test(line);
    return {
      ok: false,
      attempted: true,
      authInvalid: invalid,
      summary: invalid
        ? `NEEDS JOHN: Supabase access token invalid: ${line}`
        : `NEEDS JOHN: Supabase access token invalid or missing project access: ${line}`,
    };
  }

  if (projects.stdout.includes(EXPECTED_SUPABASE_PROJECT_REF)) {
    return {
      ok: true,
      attempted: true,
      summary: `project ref ${EXPECTED_SUPABASE_PROJECT_REF} appears in read-only projects list`,
    };
  }

  return {
    ok: false,
    attempted: true,
    lacksProjectAccess: true,
    summary: `NEEDS JOHN: Supabase token lacks project access or wrong account; ${EXPECTED_SUPABASE_PROJECT_REF} was not found`,
  };
}

function decideSupabaseToolingAuthFinal({ tooling, envShape, projectRef, version, projectAccess }) {
  const nextSkill = "cloudflare-deploy-skill / Supabase tooling/auth setup";

  if (!tooling.nodeOk || !tooling.npmOk || !tooling.npxOk || !version.ok) {
    return {
      status: "BLOCKED: Node/npx/Supabase CLI unavailable",
      ledgerStatus: "Blocked: Node/npx/Supabase CLI unavailable",
      summary: "Node/npm/npx or npx Supabase CLI version check is unavailable",
      nextPermission: "approve Supabase tooling/auth setup",
      nextSkill,
      exitCode: 1,
    };
  }

  if (projectRef.mismatch) {
    return {
      status: "NEEDS JOHN: Supabase project ref mismatch",
      ledgerStatus: "Needs John: Supabase project ref mismatch",
      summary: projectRef.summary,
      nextPermission: "fix SUPABASE_PROJECT_REF locally or confirm intended project",
      nextSkill,
      exitCode: 2,
    };
  }

  if (!envShape.SUPABASE_ACCESS_TOKEN) {
    return {
      status: "NEEDS JOHN: Supabase access token missing",
      ledgerStatus: "Needs John: Supabase access token missing",
      summary: "SUPABASE_ACCESS_TOKEN is not set in local runtime env",
      nextPermission: "add SUPABASE_ACCESS_TOKEN locally without pasting it into chat",
      nextSkill,
      exitCode: 2,
    };
  }

  if (!projectAccess.ok && projectAccess.lacksProjectAccess) {
    return {
      status: "NEEDS JOHN: Supabase token lacks project access",
      ledgerStatus: "Needs John: Supabase token lacks project access",
      summary: projectAccess.summary,
      nextPermission: "provide a Supabase access token with access to the target project",
      nextSkill,
      exitCode: 2,
    };
  }

  if (!projectAccess.ok) {
    return {
      status: "NEEDS JOHN: Supabase access token invalid",
      ledgerStatus: "Needs John: Supabase access token invalid",
      summary: projectAccess.summary,
      nextPermission: "replace SUPABASE_ACCESS_TOKEN locally without pasting it into chat",
      nextSkill,
      exitCode: 2,
    };
  }

  return {
    status: "SUPABASE AUTH PASS FOR TOOLING",
    ledgerStatus: "Supabase tooling/auth ready, not linked",
    summary: `Supabase token can list project ${EXPECTED_SUPABASE_PROJECT_REF}; no link, secret, deploy, migration, SQL, scheduler, or runtime action was run`,
    nextPermission: "approve Supabase link/secret readiness",
    nextSkill: "cloudflare-deploy-skill / Supabase link and secret readiness",
    exitCode: 0,
  };
}

function buildSupabaseToolingAuthSkeleton() {
  return {
    currentLedgerState: "Supabase execution preflight ready, not executed",
    targetRepoState: null,
    nodeNpmNpxAvailability: "not checked",
    supabaseCliPath: "not checked",
    npxSupabaseVersionResult: "not checked",
    localEnvShape: "not checked",
    projectRefCheck: `source ref is ${EXPECTED_SUPABASE_PROJECT_REF}`,
    supabaseAccessTokenPresence: "not checked",
    supabaseProjectAccessResult: "not checked",
    finalStatus: "DRY RUN PASS",
    commandsNotRun: supabaseToolingAuthCommandsNotRun(),
    nextPermission: "approve Supabase tooling/auth setup",
  };
}

function supabaseToolingAuthCommandsNotRun() {
  return [
    "npm install -g supabase",
    "supabase login",
    "npx supabase login",
    `npx supabase link --project-ref ${EXPECTED_SUPABASE_PROJECT_REF}`,
    `supabase link --project-ref ${EXPECTED_SUPABASE_PROJECT_REF}`,
    `supabase secrets set ${REQUIRED_IMPORT_SECRET}=<redacted>`,
    `supabase functions deploy ${IMPORT_FUNCTION_NAME}`,
    "supabase db push",
    "Supabase migrations",
    "SQL execution",
    "scheduler mutation",
    "Edge Function invoke",
    "production endpoint curl",
    "git push / PR / merge",
  ];
}

function formatVersionAvailability(tooling) {
  return [
    `node: ${tooling.nodeVersion || "unavailable"}`,
    `npm: ${tooling.npmVersion || "unavailable"}`,
    `npx: ${tooling.npxVersion || "unavailable"}`,
    `npx path: ${tooling.npxPath || "not found"}`,
  ].join("; ");
}

function collectSupabasePreflightRepoEvidence(repo) {
  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-8"]);
  const remote = run("git", ["-C", repo, "remote", "-v"]);

  if ([status, branch, log, remote].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: Supabase preflight git evidence failed",
        summary: "one or more read-only git evidence commands failed",
        nextPermission: "manual repo repair",
        nextSkill: "repo-map-skill",
        exitCode: 1,
      },
    };
  }

  return {
    ok: true,
    data: {
      status: status.stdout.trim() || "clean",
      branch: branch.stdout.trim() || "(detached)",
      log: log.stdout.trim(),
      remote: remote.stdout.trim(),
    },
  };
}

function collectSupabasePreflightSourceEvidence(repo) {
  const supabaseDir = path.join(repo, "supabase");
  const configToml = path.join(repo, "supabase", "config.toml");
  const functionIndex = path.join(repo, IMPORT_FUNCTION_DIR, "index.ts");
  const migrationsDir = path.join(repo, "supabase", "migrations");
  const docsDir = path.join(repo, "docs");

  const supabaseFilesResult = run("find", [supabaseDir, "-maxdepth", "5", "-type", "f"], {
    allowFailure: true,
  });
  const configTomlResult = run("sed", ["-n", "1,240p", configToml], { allowFailure: true });
  const functionHeadResult = run("sed", ["-n", "1,260p", functionIndex], { allowFailure: true });
  const functionTailResult = run("sed", ["-n", "260,560p", functionIndex], { allowFailure: true });
  const schedulerGrep = run(
    "grep",
    [
      "-RniE",
      "import-reddit-tips|cron\\.schedule|cron\\.unschedule|cron\\.alter_job|pg_cron|net\\.http_post|http_post|x-import-reddit-tips-secret|apikey|Authorization|Bearer|IMPORT_REDDIT_TIPS_SECRET",
      migrationsDir,
      docsDir,
    ],
    { allowFailure: true },
  );
  const envFilesResult = run("find", [
    repo,
    "-maxdepth",
    "3",
    "-type",
    "f",
    "(",
    "-name",
    ".env.example",
    "-o",
    "-name",
    "*.example",
    "-o",
    "-name",
    "*.md",
    ")",
    "-print",
  ], {
    allowFailure: true,
  });
  const envGrep = run(
    "grep",
    [
      "-RniE",
      "SUPABASE_ACCESS_TOKEN|SUPABASE_PROJECT_REF|IMPORT_REDDIT_TIPS_SECRET|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY",
      path.join(repo, ".env.example"),
      docsDir,
    ],
    { allowFailure: true },
  );

  const supabaseFiles = sortedRelativeLines(repo, supabaseFilesResult.stdout);
  const envShapeFiles = sortedRelativeLines(repo, envFilesResult.stdout);
  const functionText = `${functionHeadResult.stdout}\n${functionTailResult.stdout}`;
  const schedulerHits = schedulerGrep.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => relativizeLine(repo, line));
  const envHits = envGrep.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => sanitizeEnvEvidenceLine(relativizeLine(repo, line)));

  return {
    supabaseFiles,
    configTomlExists: configTomlResult.code === 0,
    configTomlText: configTomlResult.stdout,
    configTomlSummary: summarizeSupabaseConfig(configTomlResult.stdout),
    functionExists: functionHeadResult.code === 0,
    functionSummary: summarizeImportFunction(functionText),
    functionText,
    schedulerHits,
    envShapeFiles,
    envHits,
  };
}

function buildSupabasePreflight({ repo, source, cli }) {
  const skeleton = buildSupabasePreflightSkeleton();
  const projectRef = extractSupabaseProjectRef(source.configTomlText, source.schedulerHits, repo.remote);
  const scheduler = classifySupabaseScheduler(source.schedulerHits);
  const envEvidence = classifySupabaseEnvEvidence(source.envHits, source.functionText);
  const cliSummary = formatCliAvailability(cli);
  const supabaseCli = cli.find((item) => item.name === "supabase");
  const cliDecision = supabaseCli && supabaseCli.path !== "not found"
    ? "Supabase CLI is available locally; auth/link still require separate permission"
    : "Supabase CLI is missing; choose install Supabase CLI, use npx supabase only with explicit dependency/tool-execution permission, or use Supabase Dashboard manually";

  const blockers = [];
  if (!projectRef.value) blockers.push("Needs John: Supabase project ref");
  if (!envEvidence.secretValueAvailable) blockers.push("Needs John: provide secret value locally or approve secret generation");
  if (!supabaseCli || supabaseCli.path === "not found") blockers.push("Supabase CLI not installed");
  if (scheduler.usesAnonOnlyHeaders) blockers.push("old scheduled call will fail after deploy unless updated to send x-import-reddit-tips-secret");

  const recommendedNextPermission = !supabaseCli || supabaseCli.path === "not found"
    ? "approve Supabase tooling/auth setup"
    : scheduler.hasSqlScheduler
      ? "approve local scheduler migration draft"
      : "approve Supabase tooling/auth setup";

  return {
    ...skeleton,
    currentLedgerState: "Deployment plan ready, not deployed",
    targetRepoState: {
      repo: targetRepo,
      branch: repo.branch,
      status: repo.status,
      recentLog: repo.log,
      remote: repo.remote,
    },
    supabaseCliAvailability: cliSummary,
    cliDecision,
    projectReferenceEvidence: projectRef.summary,
    projectReference: projectRef.value || null,
    functionDeploymentEvidence: source.functionExists
      ? `${IMPORT_FUNCTION_DIR} exists; ${source.functionSummary}`
      : `${IMPORT_FUNCTION_DIR} not found`,
    secretSetupEvidence: envEvidence.summary,
    schedulerSourceEvidence: scheduler.summary,
    schedulerUpdateDecision: scheduler.updateDecision,
    executionSequence: buildSupabaseExecutionSequence(scheduler),
    blockers,
    recommendedNextPermission,
    sourceEvidence: {
      supabaseFiles: source.supabaseFiles,
      envShapeFiles: source.envShapeFiles,
      envHits: source.envHits,
      schedulerHits: source.schedulerHits,
      configSummary: source.configTomlSummary,
    },
  };
}

function buildSupabasePreflightSkeleton() {
  return {
    currentLedgerState: "Deployment plan ready, not deployed",
    targetRepoState: null,
    supabaseCliAvailability: "not checked",
    cliDecision: "not checked",
    projectReferenceEvidence: "not checked",
    functionDeploymentEvidence: `${IMPORT_FUNCTION_DIR}`,
    secretSetupEvidence: `${REQUIRED_IMPORT_SECRET} required; value not available in source and must not be invented`,
    schedulerSourceEvidence: "not checked",
    schedulerUpdateDecision: "not checked",
    executionSequence: buildSupabaseExecutionSequence({ hasSqlScheduler: true }),
    permissionGates: [
      "Gate A: Tooling/auth readiness",
      "Gate B: Secret setup",
      "Gate C: Scheduler update",
      "Gate D: Function deploy",
      "Gate E: Runtime verification",
    ],
    commandsDraftedButNotRun: flattenExecutionCommands(buildSupabaseExecutionSequence({ hasSqlScheduler: true })),
    blockers: [
      "Needs John: Supabase project ref if not discoverable from source",
      "Needs John: provide secret value locally or approve secret generation",
    ],
    recommendedNextPermission: "approve Supabase tooling/auth setup",
  };
}

function buildSupabaseExecutionSequence(scheduler) {
  const schedulerCommands = scheduler && scheduler.hasSqlScheduler
    ? [
        "select cron.unschedule('<existing-job-name>');",
        "create a new reviewed cron.schedule(...) or cron.alter_job(...) SQL path including x-import-reddit-tips-secret",
      ]
    : [
        "exact scheduler command depends on where scheduler is managed",
        "if external scheduler is used, update it to send x-import-reddit-tips-secret",
      ];

  return [
    {
      gate: "Gate A: Tooling/auth readiness",
      commands: [
        "supabase --version",
        "supabase login",
        "supabase link --project-ref <project-ref>",
      ],
    },
    {
      gate: "Gate B: Secret setup",
      commands: [`supabase secrets set ${REQUIRED_IMPORT_SECRET}=<redacted>`],
    },
    {
      gate: "Gate C: Scheduler update",
      commands: schedulerCommands,
    },
    {
      gate: "Gate D: Function deploy",
      commands: [`supabase functions deploy ${IMPORT_FUNCTION_NAME}`],
    },
    {
      gate: "Gate E: Runtime verification",
      commands: [
        "curl -i -X OPTIONS <SUPABASE_FUNCTION_URL>",
        "curl -i -X GET <SUPABASE_FUNCTION_URL>",
        "curl -i -X POST <SUPABASE_FUNCTION_URL> -d '<payload-without-auth>'",
        "curl -i -X POST <SUPABASE_FUNCTION_URL> -H 'Authorization: Bearer <anon-jwt>' -d '<payload>'",
        "curl -i -X POST <SUPABASE_FUNCTION_URL> -H 'Authorization: Bearer <non-admin-user-jwt>' -d '<payload>'",
        "curl -i -X POST <SUPABASE_FUNCTION_URL> -H 'x-import-reddit-tips-secret: <redacted>' -d '<payload>'",
        "curl -i -X POST <SUPABASE_FUNCTION_URL> -H 'x-import-reddit-tips-secret: <invalid>' -d '<payload>'",
        "repeat authorised request until 429 rate-limit evidence is observed",
      ],
    },
  ];
}

function flattenExecutionCommands(sequence) {
  return sequence.flatMap((group) => group.commands);
}

function collectDeploymentRepoEvidence(repo) {
  const status = run("git", ["-C", repo, "status", "--short"]);
  const branch = run("git", ["-C", repo, "branch", "--show-current"]);
  const log = run("git", ["-C", repo, "log", "--oneline", "-5"]);
  const remote = run("git", ["-C", repo, "remote", "-v"]);
  const show = run("git", ["-C", repo, "show", "--stat", "--name-only", EXPECTED_COMMIT]);

  if ([status, branch, log, remote, show].some((item) => item.code !== 0)) {
    return {
      ok: false,
      result: {
        finalStatus: "BLOCKED",
        ledgerStatus: "Blocked: deployment planning git evidence failed",
        summary: "one or more read-only git evidence commands failed",
        nextPermission: "manual repo repair",
        nextSkill: "repo-map-skill",
        exitCode: 1,
      },
    };
  }

  const data = {
    status: status.stdout.trim() || "clean",
    branch: branch.stdout.trim() || "(detached)",
    log: log.stdout.trim(),
    remote: remote.stdout.trim(),
    commitStat: show.stdout.trim(),
    commitStatSummary: summarizeCommitShow(show.stdout),
  };

  return { ok: true, data };
}

function collectDeploymentSourceEvidence(repo) {
  const supabaseDir = path.join(repo, "supabase");
  const workflowsDir = path.join(repo, ".github", "workflows");
  const configToml = path.join(repo, "supabase", "config.toml");
  const functionIndex = path.join(repo, IMPORT_FUNCTION_DIR, "index.ts");
  const packageJson = path.join(repo, "package.json");

  const supabaseFilesResult = run("find", [supabaseDir, "-maxdepth", "4", "-type", "f"], {
    allowFailure: true,
  });
  const workflowFilesResult = run("find", [workflowsDir, "-maxdepth", "1", "-type", "f", "-print"], {
    allowFailure: true,
  });
  const configFilesResult = run("find", [
    repo,
    "-maxdepth",
    "2",
    "-type",
    "f",
    "(",
    "-name",
    "wrangler.toml",
    "-o",
    "-name",
    "wrangler.jsonc",
    "-o",
    "-name",
    "netlify.toml",
    "-o",
    "-name",
    "vercel.json",
    "-o",
    "-name",
    "package.json",
    ")",
    "-print",
  ], {
    allowFailure: true,
  });

  const configTomlResult = run("sed", ["-n", "1,220p", configToml], { allowFailure: true });
  const functionHeadResult = run("sed", ["-n", "1,260p", functionIndex], { allowFailure: true });
  const functionTailResult = run("sed", ["-n", "260,520p", functionIndex], { allowFailure: true });
  const grepResult = run(
    "grep",
    [
      "-RniE",
      "import-reddit-tips|cron|schedule|pg_cron|net.http|x-import-reddit-tips-secret|IMPORT_REDDIT_TIPS_SECRET|verify_jwt|service_role|SUPABASE_SERVICE_ROLE_KEY",
      path.join(repo, "supabase"),
      path.join(repo, "docs"),
    ],
    { allowFailure: true },
  );
  const packageResult = run("cat", [packageJson], { allowFailure: true });

  const supabaseFiles = sortedRelativeLines(repo, supabaseFilesResult.stdout);
  const workflowFiles = sortedRelativeLines(repo, workflowFilesResult.stdout);
  const configFiles = sortedRelativeLines(repo, configFilesResult.stdout);
  const grepHits = grepResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const functionText = `${functionHeadResult.stdout}\n${functionTailResult.stdout}`;
  const packageInfo = parsePackageJson(packageResult.stdout);

  return {
    supabaseFiles,
    workflowFiles,
    configFiles,
    configTomlExists: configTomlResult.code === 0,
    configTomlSummary: summarizeSupabaseConfig(configTomlResult.stdout),
    functionExists: functionHeadResult.code === 0,
    functionSummary: summarizeImportFunction(functionText),
    grepHits,
    grepSummary: summarizeList(grepHits.map((line) => relativizeLine(repo, line)), 14),
    packageExists: packageResult.code === 0,
    packageInfo,
  };
}

function collectCliAvailability(names) {
  return names.map((name) => {
    const result = run("bash", ["-lc", `command -v ${name} || true`], { allowFailure: true });
    return {
      name,
      path: result.stdout.trim() || "not found",
    };
  });
}

function buildDeploymentPlan({ repo, source, cli }) {
  const skeleton = buildDeploymentPlanSkeleton();
  const schedulerEvidence = classifySchedulerEvidence(source.grepHits);
  return {
    ...skeleton,
    currentState: {
      repo: targetRepo,
      branch: repo.branch,
      status: repo.status,
      recentLog: repo.log,
      remote: repo.remote,
      mergedCommit: repo.commitStatSummary,
    },
    sourceEvidence: {
      supabaseFiles: source.supabaseFiles,
      workflowFiles: source.workflowFiles,
      deploymentConfigFiles: source.configFiles,
      supabaseConfig: source.configTomlSummary,
      functionSummary: source.functionSummary,
      packageScripts: source.packageInfo.scripts,
      grepSummary: source.grepSummary,
      cliAvailability: formatCliAvailability(cli),
    },
    functionToDeploy: IMPORT_FUNCTION_DIR,
    requiredSecretSetup: `${REQUIRED_IMPORT_SECRET} must be set in Supabase secrets; value must be generated/provided outside chat and is not in source.`,
    schedulerUpdateRequired: schedulerEvidence.summary,
    schedulerEvidence,
  };
}

function buildDeploymentPlanSkeleton() {
  return {
    functionToDeploy: IMPORT_FUNCTION_DIR,
    requiredSecretSetup: `${REQUIRED_IMPORT_SECRET} must be set in Supabase secrets; value must not be printed or committed.`,
    schedulerUpdateRequired: "scheduled calls must send x-import-reddit-tips-secret; old anon-key-only scheduled calls are not sufficient",
    runtimeVerificationMatrix: [
      "OPTIONS returns CORS",
      "GET/non-POST returns 405",
      "POST without auth fails",
      "POST with anon-only auth fails",
      "POST with non-admin user fails",
      "POST with admin user succeeds",
      "POST with valid scheduler secret succeeds",
      "POST with missing/invalid scheduler secret fails",
      "repeated authorised calls hit rate limit",
      "no service-role work happens before auth/rate gate",
    ],
    commandsDraftedButNotRun: [
      {
        gate: "Secret setup gate",
        commands: [`supabase secrets set ${REQUIRED_IMPORT_SECRET}=<redacted>`],
      },
      {
        gate: "Function deploy gate",
        commands: [`supabase functions deploy ${IMPORT_FUNCTION_NAME}`],
      },
      {
        gate: "Scheduler update gate",
        commands: [
          "exact command depends on where scheduler is managed",
          "if source shows SQL/pg_cron, propose a migration or SQL change but do not create it yet",
          "if source shows external scheduler, update the external scheduler to send x-import-reddit-tips-secret",
        ],
      },
      {
        gate: "Runtime verification gate",
        commands: [
          "curl -i -X OPTIONS <SUPABASE_FUNCTION_URL>",
          "curl -i -X GET <SUPABASE_FUNCTION_URL>",
          "curl -i -X POST <SUPABASE_FUNCTION_URL> -H 'Authorization: Bearer <anon-or-user-jwt>' -d '<payload>'",
          "curl -i -X POST <SUPABASE_FUNCTION_URL> -H 'x-import-reddit-tips-secret: <redacted>' -d '<payload>'",
        ],
      },
    ],
    commandsNotRun: [
      "supabase secrets set",
      "supabase functions deploy",
      "supabase db push/pull/reset/migration commands",
      "Supabase function invoke",
      "production curl/runtime calls",
      "Git push, PR creation, or merge",
      "Cloudflare/Netlify/Vercel deploy commands",
    ],
    risks: [
      "Source-only planning does not prove deployed function code, deployed secrets, scheduler headers, or deployed RLS/grants.",
      "The scheduler location was not mutated; if external, it must be updated outside this source-only run.",
      "Runtime 401/403/200/405/429 behavior remains unverified until explicit runtime verification is approved.",
    ],
    recommendedNextPermission: "approve Supabase secret/scheduler/deploy execution plan",
  };
}

module.exports = {
  collectSupabaseToolingRepoEvidence,
  collectSupabaseToolingAvailability,
  collectSupabaseRuntimeEnvShape,
  checkSupabaseProjectRef,
  checkNpxSupabaseVersion,
  checkSupabaseProjectAccess,
  decideSupabaseToolingAuthFinal,
  buildSupabaseToolingAuthSkeleton,
  supabaseToolingAuthCommandsNotRun,
  formatVersionAvailability,
  collectSupabasePreflightRepoEvidence,
  collectSupabasePreflightSourceEvidence,
  buildSupabasePreflight,
  buildSupabasePreflightSkeleton,
  buildSupabaseExecutionSequence,
  flattenExecutionCommands,
  collectDeploymentRepoEvidence,
  collectDeploymentSourceEvidence,
  collectCliAvailability,
  buildDeploymentPlan,
  buildDeploymentPlanSkeleton,
};
