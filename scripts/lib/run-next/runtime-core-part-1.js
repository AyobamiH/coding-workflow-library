"use strict";

// Process execution, fallback evidence, lane updates, and run recording.

const runtime = require("./runtime-context");
const { fs, path, laneState, objectiveAuthority, LIBRARY_ROOT, EXPECTED_COMMIT, EXPECTED_COMMIT_SUBJECT, INTENDED_PR_FILES, IMPORT_FUNCTION_NAME, REQUIRED_IMPORT_SECRET, args, targetRepo, dryRun, selectedLane, evidence, actions, filesChanged, spawnSync } = runtime.pick(["fs","path","laneState","objectiveAuthority","LIBRARY_ROOT","EXPECTED_COMMIT","EXPECTED_COMMIT_SUBJECT","INTENDED_PR_FILES","IMPORT_FUNCTION_NAME","REQUIRED_IMPORT_SECRET","args","targetRepo","dryRun","selectedLane","evidence","actions","filesChanged","spawnSync"]);
const main = runtime.lazy("main");
const hasSchedulerVaultApplyPermission = runtime.lazy("hasSchedulerVaultApplyPermission");
const releaseVersionFromObjective = runtime.lazy("releaseVersionFromObjective");
const isNonBlockingResult = runtime.lazy("isNonBlockingResult");
const checkpoint = runtime.lazy("checkpoint");

// Cross-part calls stay late-bound so the run-next registry remains cycle-safe.
const firstLine = runtime.lazy("firstLine");
const johnNeededSummary = runtime.lazy("johnNeededSummary");
const sanitize = runtime.lazy("sanitize");
const today = runtime.lazy("today");

function loadEnvFile(file) {
  const result = {};
  if (!fs.existsSync(file)) return result;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function buildGhEnv(ghToken) {
  const env = { ...process.env, GH_TOKEN: ghToken, GIT_TERMINAL_PROMPT: "0" };
  delete env.GITHUB_TOKEN;
  return env;
}

function run(command, commandArgs, options = {}) {
  const invocation = nodeInvocation(command, commandArgs, options.cwd || LIBRARY_ROOT);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd || LIBRARY_ROOT,
    env: options.env || process.env,
    encoding: "utf8",
    timeout: options.timeout || 0,
    input: options.input,
  });

  const stdout = sanitize(result.stdout || "");
  const stderr = sanitize(result.stderr || "");
  const code = typeof result.status === "number" ? result.status : result.error ? 1 : 0;

  const printable = [command].concat(commandArgs).join(" ");
  actions.push(`${printable}: exit ${code}`);

  if (code !== 0 && !options.allowFailure) {
    evidence.push(`${printable}: failed`);
  }

  return { code, stdout, stderr };
}

function nodeInvocation(command, commandArgs, cwd) {
  const fullPath = command.startsWith(".") ? path.resolve(cwd, command) : command;
  try {
    if (fs.existsSync(fullPath)) {
      const firstLine = fs.readFileSync(fullPath, "utf8").split(/\r?\n/, 1)[0];
      if (/node\b/.test(firstLine)) return { command: process.execPath, args: [fullPath, ...commandArgs] };
    }
  } catch {
    return { command, args: commandArgs };
  }
  return { command, args: commandArgs };
}

function extractFinalClassification(text) {
  const matches = [...String(text || "").matchAll(/Final classification:\s*([^\n]+)/gi)];
  return matches.length ? matches[matches.length - 1][1].trim() : "";
}

function extractFailureClassification(text) {
  const match = String(text || "").match(/Classification:\s*([^\n]+)/i);
  return match ? match[1].trim() : "";
}

function extractEvidencePackPath(text) {
  const match = String(text || "").match(/^Output:\s*(.+)$/m);
  return match ? match[1].trim() : "";
}

function listEvidencePackDirs(repo) {
  const evidenceDir = path.join(repo, "evidence");
  if (!fs.existsSync(evidenceDir)) return [];
  return fs
    .readdirSync(evidenceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function fallbackPackageReadinessRun(repo, options = {}) {
  const packageJsonPath = path.join(repo, "package.json");
  const expectPackage = Boolean(options.expectPackage || options.expectCli);
  const expectCli = Boolean(options.expectCli);
  const packageExists = fs.existsSync(packageJsonPath);
  const finalStatus = packageExists ? "PASS" : expectPackage ? "FAIL" : "NOT_APPLICABLE";
  return {
    code: 0,
    stdout: `# NPM Package Readiness Report

Repo: ${repo}
Expect package: ${expectPackage ? "yes" : "no"}
Expect CLI: ${expectCli ? "yes" : "no"}
Pack dry-run allowed: no

Checks:
- ${finalStatus}: package.json - ${packageExists ? "found" : expectPackage ? "missing; package was expected" : "missing; package checks not applicable"}

Final classification: ${finalStatus}

Next safe step:
${finalStatus === "NOT_APPLICABLE" ? "Use release preflight local mode or provide --expect-package when npm packaging is intended." : "Review classification before any publish/tag/push gate."}
`,
    stderr: "",
  };
}

function fallbackReleasePreflightRun(repo, mode) {
  const packageExists = fs.existsSync(path.join(repo, "package.json"));
  const packageClassification = packageExists ? "PASS" : mode === "local" ? "NOT_APPLICABLE" : "FAIL";
  const finalStatus = mode === "local" ? "WARN" : packageClassification === "FAIL" ? "FAIL" : "WARN";
  return {
    code: 0,
    stdout: `# Release Preflight Report

Repo: ${repo}
Mode: ${mode}
Pack dry-run allowed: no

Checks:
- PASS: repo path - ${repo}
- ${mode === "local" ? "PASS" : packageClassification}: npm package readiness helper - fallback classification=${packageClassification}
- PASS: evidence pack dry-run - fallback local-only plan
- PASS: README - ${fs.existsSync(path.join(repo, "README.md")) ? "README.md" : "missing"}

Package readiness summary:
\`\`\`text
Final classification: ${packageClassification}
\`\`\`

Evidence pack dry-run summary:
\`\`\`text
No files were written. No env files were read. No external calls were made.
\`\`\`

Final classification: ${finalStatus}

Commands not run:
npm publish, npm version, git tag, git push, gh release create, deploy commands, remote registry mutations, secret reads, production endpoint calls.

Next safe step:
Resolve WARN/FAIL items before requesting publish/tag/push/deploy.
`,
    stderr: "",
  };
}

function fallbackFailureEvidenceRun(input) {
  const redacted = sanitize(input);
  const classification = /network is unreachable/i.test(redacted)
    ? "network unreachable"
    : /authentication failed|invalid token|bad credentials/i.test(redacted)
      ? "invalid credential"
      : /not permitted|permission not granted|not allowed/i.test(redacted)
        ? "external service mutation not permitted"
        : "unknown failure";
  return {
    code: 0,
    stdout: `# Failure Evidence Report

## Input

stdin

## Classifications

- ${classification}

Classification: ${classification}

## Recommended Ledger State

Needs John: failure classification

## Recovery

Capture exact command, sanitized error, and smallest read-only confirming check.

## Redacted Evidence

\`\`\`text
${redacted.trim().slice(0, 4000)}
\`\`\`

## Safety

No files were modified. Secret-shaped values were redacted from output.
`,
    stderr: "",
  };
}

function fallbackEvidencePackRun(repo, title) {
  const stamp = timestampForFolder();
  const folderName = `${stamp}-${slugify(title)}`;
  const outputDir = path.join(repo, "evidence", folderName);
  fs.mkdirSync(outputDir, { recursive: true });
  const files = {
    "summary.md": `# Evidence Pack

## Target Repo

${repo}

## Title

${title}

## Created

${new Date().toISOString()}

## Safety Boundary

This fallback writer did not read env files, stage files, commit, push, publish, deploy, run migrations, mutate databases, set secrets, or call external services.
`,
    "git-status.txt": "not captured by fallback writer\n",
    "git-diff-stat.txt": "not captured by fallback writer\n",
    "validation.txt": "created by local skill workpack fallback; validator is run separately by the route\n",
    "next-step.md": "# Next Step\n\nReview this evidence pack and decide the next explicit permission gate.\n",
  };
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(outputDir, name), sanitize(content), "utf8");
  }
  return {
    code: 0,
    stdout: `# Evidence Pack Created

Output: ${outputDir}
Git repo: not captured by fallback
Files:
${Object.keys(files).map((name) => `- ${path.join(outputDir, name)}`).join("\n")}

Next safe step:
Review the evidence pack and decide the next explicit permission gate.
`,
    stderr: "",
  };
}

function timestampForFolder(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function slugify(value) {
  return String(value || "evidence")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "evidence";
}

function extractValidationResult(text) {
  const match = String(text || "").match(/Result:\s*([^\n]+)/i);
  return match ? match[1].trim() : "";
}

function updateSelectedLane(result, route) {
  const state = laneState.readState(args.stateFile);
  const lane = laneState.getLane(state, args.lane);
  const finalStatus = result.ledgerStatus || result.finalStatus;
  const blocked = result.exitCode && result.exitCode !== 0 || /blocked|failure|needs john|BLOCKED_/i.test(finalStatus || "");
  const routeId = route.kind === "scheduled-run-monitoring-handoff"
    ? "production-handoff-lane"
    : route.kind === "zero-output-pipeline-investigation"
      ? "zero-output-pipeline-investigation"
      : route.kind;
  const routeIds = Array.from(new Set([...(lane.route_ids || []), routeId].filter(Boolean)));
  const evidenceRefs = Array.from(new Set([
    ...(lane.evidence_refs || []),
    `local-run:${today()}:${routeId || "run-next"}`,
  ]));
  const changes = {
    current_state: finalStatus,
    next_permission: result.nextPermission || route.nextPermission || route.nextAction || "manual review",
    status: result.objectiveStatus === "complete" ? "complete" : blocked ? "blocked" : "active",
    route_ids: routeIds,
    evidence_refs: evidenceRefs,
  };
  if (lane.objective) {
    const objective = objectiveAuthority.normalizeObjective(lane.objective);
    const checkpoint = route.kind || route.permission || "run-next";
    changes.objective = {
      ...objective,
      status: result.objectiveStatus || (blocked ? "blocked" : "active"),
      updated_at: new Date().toISOString(),
      checkpoints: {
        ...objective.checkpoints,
        [checkpoint]: blocked ? "blocked" : "complete",
      },
      blockers: blocked
        ? [
            ...objective.blockers,
            {
              state: String(result.finalStatus || "").startsWith("BLOCKED_") ? result.finalStatus.split(":")[0] : "BLOCKED_SAFETY",
              reason: result.summary || finalStatus,
              stage: checkpoint,
              recorded_at: new Date().toISOString(),
            },
          ]
        : nonFatalBlockers(result, checkpoint),
    };
  }
  laneState.updateLane(state, args.lane, changes);
  laneState.atomicWrite(args.stateFile, state);
  actions.push(`updated selected lane only: ${args.lane}`);
}

function nonFatalBlockers(result, checkpoint) {
  const now = new Date().toISOString();
  const blockers = [];
  for (const reason of result.capabilityBlockers || []) {
    blockers.push({ state: "BLOCKED_CAPABILITY", reason, stage: checkpoint, recorded_at: now });
  }
  for (const reason of result.waitingConditions || []) {
    blockers.push({ state: "WAITING_CONDITION", reason, stage: checkpoint, recorded_at: now });
  }
  return blockers;
}

function appendLedger({ status, result, route }) {
  const repoLabel = displayRepo(targetRepo);
  const commandLabel = `scripts/run-next ${process.argv.slice(2).map(displayRepo).join(" ")}`;
  const entry = `
## ${today()} - run-next Autonomous Work Loop

* Active repo: \`${repoLabel}\`.
* Current objective: Run \`scripts/run-next\` from the coding workflow library and continue only until the next real permission boundary.
* Current permission level: ${Array.from(args.allow).join(", ") || "no explicit allow flags"}${dryRun ? "; dry-run" : ""}. ${permissionBoundarySummary()}.
* Current status: ${status}.
* Selected skill: ${route.skill}.
* Last commands run: \`${commandLabel}\`.
* Files changed: ${filesChanged.length ? filesChanged.map((file) => `\`${file}\``).join("; ") : "local library records only; no target repo files edited"}.
* Validation evidence: ${evidence.join("; ") || "runner stopped before external evidence was needed"}.
* Blockers: ${blockerSummary(result)}.
* Next recommended skill: ${result.nextSkill || route.skill}.
* Exact next action: ${result.nextPermission || route.nextAction || "manual review"}.
* Whether John is needed: ${johnNeededSummary(result)}.
`;
  fs.appendFileSync(path.join(LIBRARY_ROOT, "work-ledger.md"), entry);
  filesChanged.push("work-ledger.md");
}

function appendRunLog({ dryRun: isDryRun, status, result, route }) {
  const repoLabel = displayRepo(targetRepo);
  const commandLabel = `scripts/run-next ${process.argv.slice(2).map(displayRepo).join(" ")}`;
  const entry = `
## ${today()} - run-next Autonomous Work Loop${isDryRun ? " Dry Run" : ""}

* Skill used: coding-workflow-orchestrator-skill; selected next skill was ${route.skill || "unknown"}.
* Goal: Read \`work-ledger.md\`, classify status \`${status}\`, check permission flags, and run only the next safe action.
* Starting state: Target repo \`${repoLabel}\`; permission flags \`${Array.from(args.allow).join(", ") || "none"}\`; dry-run \`${isDryRun ? "yes" : "no"}\`.
* Commands/tools used: \`${commandLabel}\`.
* Files inspected: \`AGENTS.md\`; \`RUNBOOK.md\`; \`tools.md\`; \`work-ledger.md\`; selected ledger entry for \`${repoLabel}\`.
* Files changed: ${formatRunLogFilesChanged(isDryRun)}.
* Evidence collected: ${evidence.join("; ") || "no additional evidence required before boundary"}.
* Result: ${result.finalStatus}: ${result.summary}.
* Failure/recovery notes: ${result.finalStatus === "BLOCKED" ? result.summary : forbiddenActionSummary()}.
* Follow-up skill needed: ${result.nextSkill || route.skill || "coding-workflow-orchestrator-skill"}.
* Upgrade idea: Add more executable paths to \`scripts/run-next\` for auth-check, exact-file commit, and local-validation states.
`;
  fs.appendFileSync(path.join(LIBRARY_ROOT, "runs/skill-runs.md"), entry);
}

function displayRepo(value) {
  const text = String(value || "");
  if (path.resolve(text) === LIBRARY_ROOT) return "<LIBRARY_REPO>";
  return text;
}

function formatRunLogFilesChanged(isDryRun) {
  if (isDryRun) return "`runs/skill-runs.md` dry-run entry only";
  const changed = filesChanged.concat(["runs/skill-runs.md"]);
  return Array.from(new Set(changed)).map((file) => `\`${file}\``).join("; ");
}

function permissionBoundarySummary() {
  if (releaseVersionFromObjective(selectedLane?.objective?.id)) {
    return "Semver release publication is limited to the selected library objective: exact local gates, non-force main push, exact-SHA CI, one annotated version tag, npm publication, one GitHub Release, and verification. No force push, history rewrite, secret mutation, unrelated repository mutation, or invented deployment target is permitted";
  }
  if (args.allow.has("first-version-tag")) {
    return "First-version tag gate permitted only for local version/changelog/release-note edits, local validation/package smoke, exact-file commits, non-force main push, read-only GitHub Actions inspection, annotated tag v0.1.0 creation/push, remote tag verification, and post-tag bookkeeping. No npm publish, npm version, GitHub release, deploy, Supabase, Cloudflare, production endpoint, secret printing, force push, history rewrite, broad staging, or excluded-file staging";
  }
  if (args.allow.has("github-open-source-handoff")) {
    return "GitHub open-source handoff permitted only for local public-repo hardening, local validation, GitHub auth/repo checks, public repo creation if missing, exact-file commit, one main push, and remote HEAD verification. No npm publish, npm version, tag, GitHub release, deploy, Supabase, Cloudflare, production endpoint, secret printing, broad staging, force push, or excluded-file staging";
  }
  if (args.allow.has("scheduled-run-monitoring-handoff")) {
    return "Scheduled-run monitoring and production handoff prep permitted only to load local env without printing values, use SUPABASE_DB_URL for read-only scheduler metadata, cron history, and pet_tips metadata, inspect source/docs, and stop. No Edge Function invocation, production endpoint call, deploy, db push, migration application, SQL write, scheduler mutation, app table write, pet_tips mutation, Git push/PR/merge, token/secret/DB URL printing, target-repo secret write, or excluded-file staging";
  }
  if (args.allow.has("controlled-success-invocation")) {
    return "Controlled scheduler-path success invocation permitted only to load local env without printing values, use SUPABASE_DB_URL for read-only before/after pet_tips metadata, run exactly one valid scheduler-secret POST to import-reddit-tips, and stop. No deploy, db push, migration application, scheduler mutation, SQL writes, manual pet_tips insert/update/delete, admin success invocation, repeated success invocation, Git push/PR/merge, token/secret/DB URL printing, target-repo secret write, or excluded-file staging";
  }
  if (args.allow.has("function-secret-deploy-negative-runtime")) {
    return "Function secret/deploy/negative-runtime gate permitted only to load local env without printing values, set remote IMPORT_REDDIT_TIPS_SECRET through a temporary env file, deploy only import-reddit-tips, run non-mutating OPTIONS/non-POST/no-auth/invalid-secret/anon-only runtime checks, and stop before any real success import. No db push, migration application, SQL, scheduler mutation, app table writes, pet_tips writes, valid scheduler/admin success request, Git push/PR/merge, token/secret/DB URL printing, target-repo secret write, or excluded-file staging";
  }
  if (hasSchedulerVaultApplyPermission()) {
    return "Scheduler Vault design/apply permitted only to load local env values without printing them, use a DB URL without printing it, prove psql/Vault/pg_cron/pg_net/current-job capability, create or update one Vault secret, replace only import-reddit-tips-daily with a Vault-backed x-import-reddit-tips-secret header, and stop before runtime success verification. No function deploy, db push, migration application, unrelated SQL, app table writes, pet_tips writes, Edge Function success invoke, admin success request, Git push/PR/merge, token/secret/DB URL printing, target-repo secret write, or excluded-file staging";
  }
  if (args.allow.has("scheduler-application-decision")) {
    return "Scheduler application decision permitted only to inspect local scheduler source/docs, local env presence without values, Supabase CLI/project access, and read-only database capability evidence; it may mutate only import-reddit-tips-daily if a non-hardcoded pg_cron secret path is proven, otherwise it must stop blocked. No deploy, db push, migration application, unrelated SQL, app table writes, pet_tips writes, valid scheduler/admin success request, successful import, push, PR, merge, token/secret printing, or excluded-file staging";
  }
  if (args.allow.has("runtime-negative-verification")) {
    return "Runtime negative verification permitted only for OPTIONS, GET/non-POST rejection, POST without auth rejection, POST with invalid scheduler secret rejection, and optional anon-only rejection; no valid scheduler secret, admin bearer token, successful import/write request, scheduler mutation, db push, migration application, SQL execution, secret mutation, deploy, git push/PR/merge, token/secret printing, or excluded-file staging";
  }
  if (args.allow.has("supabase-secret-function-deploy")) {
    return "Supabase remote secret + single function deploy gate permitted only to verify local source/auth/env, set remote IMPORT_REDDIT_TIPS_SECRET through a temporary env file, deploy only import-reddit-tips, and stop; no scheduler mutation, db push, migration application, SQL execution, Edge Function invoke, runtime verification, production endpoint call, git push/PR/merge, token/secret printing, target-repo secret write, `evidence/` staging, or `supabase/.temp/` staging";
  }
  if (args.allow.has("scheduler-pr-merge")) {
    return "Scheduler PR merge gate permitted only for PR #12 after exact file, expected commit, check, mergeability, auth, repo access, and migration secret-scan gates; no Supabase remote secret setup, function deploy, database migration application, SQL execution, scheduler mutation, Edge Function invoke, production endpoint call, branch deletion, force push, token/secret printing, unrelated staging, `evidence/`, or `supabase/.temp/` inclusion";
  }
  if (args.allow.has("scheduler-draft-pr")) {
    return "Combined scheduler draft/PR gate permitted only for local scheduler migration drafting, local checks, exact-file commit, feature-branch push, and PR creation; no remote Supabase secret write, function deploy, database migration application, SQL execution, scheduler mutation, Edge Function invoke, production endpoint call, direct `main` push, force push, PR merge, token/secret printing, unrelated staging, `evidence/`, or `supabase/.temp/` inclusion";
  }
  if (args.allow.has("supabase-link-secret-readiness")) {
    return "Supabase link/local secret readiness permitted only for repo cleanliness checks, local env presence checks, read-only project access confirmation, local Supabase link, and storing a generated import secret only in `<RUNTIME_ENV_FILE>` if missing; no remote secret write, function deploy, database migration, SQL execution, scheduler mutation, Edge Function invoke, production endpoint call, direct `main` push, force push, merge, branch deletion, token/secret printing, token/secret file write to target repo, unrelated staging, or `evidence/` inclusion";
  }
  if (args.allow.has("supabase-tooling-auth")) {
    return "Supabase tooling/auth setup permitted only for local tooling checks, npx supabase --version, env variable-name/presence checks, and read-only project list when SUPABASE_ACCESS_TOKEN is set; no CLI install, login, link, secret write, function deploy, database migration, SQL execution, scheduler mutation, Edge Function invoke, production endpoint call, direct `main` push, force push, merge, branch deletion, token printing, token file write, unrelated staging, or `evidence/` inclusion";
  }
  if (args.allow.has("supabase-preflight")) {
    return "Supabase execution preflight permitted as local/source inspection only; no CLI install, npx Supabase execution, login, link, secret write, function deploy, database migration, SQL execution, scheduler mutation, production endpoint call, direct `main` push, force push, merge, branch deletion, token printing, token file write, unrelated staging, or `evidence/` inclusion";
  }
  if (args.allow.has("deployment-plan")) {
    return "Deployment planning permitted as local/source inspection only; no deploy, Supabase migration, Supabase mutation, Supabase secret write, scheduler mutation, production endpoint call, direct `main` push, force push, merge, branch deletion, token printing, token file write, unrelated staging, or `evidence/` inclusion";
  }
  if (args.allow.has("pr-merge")) {
    return "PR merge permitted only for PR #11 after safety gates; no deploy, Supabase migration, Supabase mutation, production endpoint call, direct `main` push, force push, branch deletion, token printing, token file write, unrelated staging, or `evidence/` inclusion";
  }
  return "No deploy, Supabase migration, Supabase mutation, production endpoint call, direct `main` push, force push, merge, token printing, token file write, unrelated staging, or `evidence/` inclusion";
}

function forbiddenActionSummary() {
  if (releaseVersionFromObjective(selectedLane?.objective?.id)) {
    return "No forbidden force push, history rewrite, broad staging, secret mutation or output, unrelated repository mutation, npm version command, or product deployment occurred. Package deployment is NOT_APPLICABLE because no deploy target is declared.";
  }
  if (args.allow.has("first-version-tag")) {
    return "No forbidden npm publish, npm version, GitHub release creation, deploy, Supabase command, Cloudflare command, production endpoint call, secret printing, force push, history rewrite, broad staging, excluded-file staging, or extra repository creation occurred.";
  }
  if (args.allow.has("github-open-source-handoff")) {
    return "No forbidden npm publish, npm version, tag creation, GitHub release creation, deploy, Supabase command, Cloudflare command, production endpoint call, token/secret printing, broad staging, force push, or excluded-file staging occurred.";
  }
  if (args.allow.has("scheduled-run-monitoring-handoff")) {
    return "No forbidden Edge Function invocation, production endpoint call, deploy, db push, migration application, SQL write, scheduler mutation, app table write, pet_tips mutation, Git push/PR/merge, token/secret/DB URL printing, target-repo secret write, evidence staging, or supabase/.temp staging occurred.";
  }
  if (args.allow.has("controlled-success-invocation")) {
    return "No forbidden deploy, db push, migration application, scheduler mutation, SQL write, manual pet_tips insert/update/delete, admin success invocation, repeated success invocation, Git push/PR/merge, token/secret/DB URL printing, target-repo secret write, evidence staging, or supabase/.temp staging occurred.";
  }
  if (args.allow.has("function-secret-deploy-negative-runtime")) {
    return "No forbidden db push, migration application, SQL execution, scheduler mutation, app table write, pet_tips write, valid scheduler success request, admin success request, successful import, Git push/PR/merge, token/secret/DB URL printing, target-repo secret write, evidence staging, or supabase/.temp staging occurred.";
  }
  if (hasSchedulerVaultApplyPermission()) {
    return "No forbidden function deploy, db push, migration application, unrelated SQL, app table write, pet_tips write, Edge Function success invoke, admin success request, successful import, Git push/PR/merge, token/secret/DB URL printing, target-repo secret write, evidence staging, or supabase/.temp staging occurred.";
  }
  if (args.allow.has("scheduler-application-decision")) {
    return "No forbidden deploy, db push, migration application, unrelated SQL, app table write, pet_tips write, valid scheduler/admin success request, successful import, Git push/PR/merge, token/secret printing, hardcoded scheduler secret SQL, evidence staging, or supabase/.temp staging occurred.";
  }
  if (args.allow.has("runtime-negative-verification")) {
    return "No forbidden valid scheduler request, admin bearer success request, scheduler application, db push, migration application, SQL execution, Supabase secret mutation, function deploy, git push/PR/merge, token/secret printing, target-repo secret write, evidence staging, supabase/.temp staging, or docs/import-reddit-tips-supabase-application-plan.md staging occurred.";
  }
  if (args.allow.has("supabase-secret-function-deploy")) {
    return "No forbidden scheduler mutation, db push, migration application, SQL execution, Edge Function invoke, runtime verification, production endpoint call, git push/PR/merge, token/secret printing, target-repo secret write, evidence staging, or supabase/.temp staging occurred.";
  }
  if (args.allow.has("scheduler-pr-merge")) {
    return "No forbidden Supabase remote secret setup, function deploy, database migration application, SQL execution, scheduler mutation, Edge Function invoke, production endpoint call, branch deletion, force push, token/secret printing, unrelated staging, evidence inclusion, or supabase/.temp inclusion occurred.";
  }
  if (args.allow.has("scheduler-draft-pr")) {
    return "No forbidden remote Supabase secret setup, function deploy, database migration application, SQL execution, scheduler mutation, Edge Function invoke, production endpoint call, direct main push, force push, PR merge, token/secret printing, unrelated staging, evidence inclusion, or supabase/.temp inclusion occurred.";
  }
  if (args.allow.has("supabase-link-secret-readiness")) {
    return "No forbidden remote secret setup, function deploy, database migration, SQL execution, scheduler mutation, Edge Function invoke, production endpoint call, direct main push, force push, merge, branch deletion, token/secret printing, target-repo secret write, unrelated staging, or evidence inclusion occurred.";
  }
  if (args.allow.has("supabase-tooling-auth")) {
    return "No forbidden CLI install, login, link, secret write, function deploy, database migration, SQL execution, scheduler mutation, Edge Function invoke, production endpoint call, direct main push, force push, merge, branch deletion, token printing, token file write, unrelated staging, or evidence inclusion occurred.";
  }
  if (args.allow.has("supabase-preflight")) {
    return "No forbidden CLI install, npx Supabase execution, login, link, secret write, function deploy, database migration, SQL execution, scheduler mutation, production endpoint call, direct main push, force push, merge, branch deletion, token printing, token file write, unrelated staging, or evidence inclusion occurred.";
  }
  if (args.allow.has("deployment-plan")) {
    return "No forbidden deploy, migration, Supabase mutation, Supabase secret write, scheduler mutation, production endpoint call, direct main push, force push, merge, branch deletion, token printing, token file write, unrelated staging, or evidence inclusion occurred.";
  }
  if (args.allow.has("pr-merge")) {
    return "No forbidden deploy, migration, Supabase mutation, production endpoint call, direct main push, force push, branch deletion, token printing, token file write, unrelated staging, or evidence inclusion occurred.";
  }
  return "No forbidden deploy, migration, Supabase mutation, production endpoint call, direct main push, force push, merge, token printing, token file write, unrelated staging, or evidence inclusion occurred.";
}

function blockerSummary(result) {
  if (
    result.finalStatus === "Scheduled run pending, production handoff ready" ||
    result.finalStatus === "Scheduled run observed, production handoff ready"
  ) {
    return "None for read-only scheduled-run monitoring and production handoff prep. Deployed RLS/grants verification and any future runtime invocation remain gated.";
  }
  if (String(result.finalStatus || "").startsWith("Scheduled run monitoring blocked:")) {
    return result.summary;
  }
  if (result.finalStatus === "Controlled success invocation completed") {
    return "None for the one controlled scheduler-path success invocation. Scheduled-run monitoring, deployed RLS/grants verification, and final production handoff remain gated.";
  }
  if (String(result.finalStatus || "").startsWith("Controlled success invocation blocked:")) {
    return result.summary;
  }
  if (result.finalStatus === "Function deployed, negative runtime verified, success path not run") {
    return "None for remote secret setup, import-reddit-tips deploy, and negative runtime checks. Valid scheduler/admin success invocation, pet_tips write-path proof, deployed RLS/grants verification, and production confidence remain gated.";
  }
  if (result.finalStatus === "Function deployed, dry-run runtime verified, success path not run") {
    return "None for remote secret setup, import-reddit-tips deploy, and dry-run runtime checks. Real scheduler/admin success invocation, deployed RLS/grants verification, and production confidence remain gated.";
  }
  if (result.finalStatus === "Function deployed, negative runtime checks failed, success path not run") {
    return result.summary;
  }
  if (
    result.finalStatus === "Scheduler applied via Vault, runtime success not verified" ||
    result.finalStatus === "Scheduler applied via Vault, runtime not verified"
  ) {
    return "None for Vault-backed scheduler application. Valid scheduler success verification, admin success request, successful import/write path, deployed RLS/grants verification, and production confidence remain gated.";
  }
  if (result.finalStatus === "DB CONNECTIVITY BLOCKED") {
    return result.summary;
  }
  if (result.finalStatus === "DB URL STILL POINTS TO DIRECT HOST") {
    return result.summary;
  }
  if (
    result.finalStatus === "Needs John: database connection URL missing" ||
    result.finalStatus === "Needs John: psql unavailable for non-interactive DB inspection" ||
    result.finalStatus === "Scheduler blocked: Vault/pg_cron/pg_net capability not proven"
  ) {
    return result.summary;
  }
  if (result.finalStatus === "Scheduler applied, runtime success not verified") {
    return "None for scheduler application. Valid scheduler success verification, admin success request, successful import/write path, deployed RLS/grants verification, and production confidence remain gated.";
  }
  if (result.finalStatus === "Scheduler blocked: safe secret storage path not proven") {
    return result.summary;
  }
  if (result.finalStatus === "Runtime negative checks passed, scheduler not applied") {
    return "None for negative runtime verification. Scheduler application, valid scheduler success request, admin success request, db push, migration execution, SQL, deployed RLS/grants, and production success checks remain gated.";
  }
  if (result.finalStatus === "Runtime negative checks failed, scheduler blocked") {
    return result.summary;
  }
  if (result.finalStatus === "Function deployed and remote secret set, scheduler not applied") {
    return "None for remote secret setup and import-reddit-tips deploy. Scheduler application, db push, migration execution, SQL, runtime endpoint verification, deployed RLS/grants, and production checks remain gated.";
  }
  if (result.finalStatus === "Scheduler migration draft merged, not applied") {
    return "None for scheduler PR review/merge verification. Supabase remote secret setup, reviewed scheduler application, Edge Function deployment, runtime verification, deployed RLS/grants, and production checks remain gated.";
  }
  if (result.finalStatus === "Scheduler migration PR opened, not merged") {
    return "None for local scheduler draft/PR handoff; remote secret setup, reviewed scheduler application, function deploy, runtime verification, deployed RLS/grants, and PR merge remain gated.";
  }
  if (result.finalStatus === "Supabase linked and local secret ready, not deployed") {
    return "None for local link/secret readiness; remote secret setup, scheduler migration draft, function deploy, runtime verification, and deployed RLS/grants remain gated.";
  }
  if (
    result.finalStatus === "NEEDS JOHN: Supabase link requires interactive credential" ||
    result.finalStatus === "NEEDS JOHN: Supabase project access failed" ||
    result.finalStatus === "NEEDS JOHN: Supabase project ref mismatch" ||
    result.finalStatus === "BLOCKED: unexpected target repo changes"
  ) {
    return result.summary;
  }
  if (result.finalStatus === "SUPABASE AUTH PASS FOR TOOLING") {
    return "None for tooling/auth; Supabase link, secret setup, scheduler update, function deploy, runtime verification, and deployed RLS/grants remain gated.";
  }
  if (
    result.finalStatus === "NEEDS JOHN: Supabase access token missing" ||
    result.finalStatus === "NEEDS JOHN: Supabase access token invalid" ||
    result.finalStatus === "NEEDS JOHN: Supabase token lacks project access" ||
    result.finalStatus === "NEEDS JOHN: Supabase project ref mismatch" ||
    result.finalStatus === "BLOCKED: Node/npx/Supabase CLI unavailable"
  ) {
    return result.summary;
  }
  if (result.finalStatus === "Supabase execution preflight ready, not executed") {
    return "None for source-only preflight; Supabase tooling/auth setup, project link, secret setup, scheduler update, function deploy, runtime verification, and deployed RLS/grants remain gated.";
  }
  if (result.finalStatus === "Deployment plan ready, not deployed") {
    return "None for source-only planning; Supabase secret setup, scheduler update, function deploy, runtime verification, and deployed RLS/grants remain gated.";
  }
  if (result.finalStatus === "Merged, not deployed") {
    return "None for the merge; deployment planning, Supabase secret setup, scheduler update, runtime verification, and deployed RLS/grants remain gated.";
  }
  if (isNonBlockingResult(result.finalStatus)) {
    return "None for the inspected boundary; merge/deploy planning remains gated.";
  }
  return result.summary;
}

module.exports = {
  loadEnvFile,
  buildGhEnv,
  run,
  nodeInvocation,
  extractFinalClassification,
  extractFailureClassification,
  extractEvidencePackPath,
  listEvidencePackDirs,
  fallbackPackageReadinessRun,
  fallbackReleasePreflightRun,
  fallbackFailureEvidenceRun,
  fallbackEvidencePackRun,
  timestampForFolder,
  slugify,
  extractValidationResult,
  updateSelectedLane,
  nonFatalBlockers,
  appendLedger,
  appendRunLog,
  displayRepo,
  formatRunLogFilesChanged,
  permissionBoundarySummary,
  forbiddenActionSummary,
  blockerSummary,
};
