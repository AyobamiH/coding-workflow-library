"use strict";

// Remaining local-foundation routes and package portability helpers.

const runtime = require("./runtime-context");
const { fs, os, path, LIBRARY_ROOT, DEFAULT_ENV_FILE, DEFAULT_TEMP_ROOT, DEFAULT_NPM_CACHE, EXPECTED_GITHUB_USER, OPEN_SOURCE_GITHUB_REPO, targetRepo, dryRun, evidence, actions, spawnSync } = runtime.pick(["fs","os","path","LIBRARY_ROOT","DEFAULT_ENV_FILE","DEFAULT_TEMP_ROOT","DEFAULT_NPM_CACHE","EXPECTED_GITHUB_USER","OPEN_SOURCE_GITHUB_REPO","targetRepo","dryRun","evidence","actions","spawnSync"]);
const main = runtime.lazy("main");
const releaseVersionFromObjective = runtime.lazy("releaseVersionFromObjective");
const loadEnvFile = runtime.lazy("loadEnvFile");
const buildGhEnv = runtime.lazy("buildGhEnv");
const run = runtime.lazy("run");
const firstNonEmptyLine = runtime.lazy("firstNonEmptyLine");
const escapeRegExp = runtime.lazy("escapeRegExp");
const gitHead = runtime.lazy("gitHead");

function runProjectKbCompiler() {
  const projectKb = "scripts/project-kb";
  evidence.push("project-KB purpose: deterministic privacy-safe source-only project knowledge base");
  evidence.push("project-KB inputs: repo-map, docs-list, package metadata, route metadata, skill index, and selected public control docs");
  actions.push("private paths, env values, tokens, DB URLs, private corpus outputs, raw sessions, and target-repo mutations remain excluded");

  if (dryRun) {
    actions.push("would verify scripts/project-kb syntax");
    actions.push("would run project-kb tests and Markdown, JSON, dry-run, and strict validation modes");
    actions.push("would verify CLI delegation through bin/coding-workflow.js");
    actions.push("would stop before migration-review helper, pre-commit hook, agent roles, package publication, tags, releases, deploys, or product repos");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "project-KB compiler dry-run complete",
      summary: "project-kb-compiler would verify deterministic source-only project memory synthesis and stop before the next dependency",
      nextPermission: "build migration-review helper or pre-commit validation hook",
      nextSkill: "migration-review-skill / coding-workflow-orchestrator-skill",
      exitCode: 0,
    };
  }

  const blockers = [];
  if (!fs.existsSync(path.join(LIBRARY_ROOT, projectKb))) blockers.push("scripts/project-kb missing");
  if (!fs.existsSync(path.join(LIBRARY_ROOT, "schemas", "project-kb.schema.json"))) blockers.push("project-kb schema missing");

  const commands = [
    ["project-kb syntax", process.execPath, ["--check", projectKb]],
    ["project-kb tests", process.execPath, ["tests/project-kb.test.js"]],
    ["project-kb dry run", `./${projectKb}`, ["--repo", ".", "--dry-run"]],
    ["project-kb markdown report", `./${projectKb}`, ["--repo", "."]],
    ["project-kb json report", `./${projectKb}`, ["--repo", ".", "--json"]],
    ["project-kb strict validation", `./${projectKb}`, ["--repo", ".", "--validate"]],
    ["project-kb CLI validation", "./bin/coding-workflow.js", ["project-kb", "--repo", ".", "--validate"]],
  ];

  for (const [label, command, commandArgs] of commands) {
    const result = run(command, commandArgs, { cwd: LIBRARY_ROOT, allowFailure: true });
    evidence.push(`${label} exit: ${result.code}`);
    if (result.code !== 0) blockers.push(`${label} failed`);
  }

  if (blockers.length) {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: "project-KB compiler blocked",
      summary: blockers.join("; "),
      nextPermission: "fix project-KB compiler or validation failures",
      nextSkill: "project-kb-builder-skill / error-evidence-skill",
      exitCode: 1,
    };
  }

  return {
    finalStatus: "READY",
    ledgerStatus: "project-KB compiler complete",
    summary: "deterministic source-only project KB compiler validates; next active dependency is migration-review helper or pre-commit validation hook",
    nextPermission: "build migration-review helper or pre-commit validation hook",
    nextSkill: "migration-review-skill / coding-workflow-orchestrator-skill",
    exitCode: 0,
  };
}

function runPreCommitValidationHook() {
  const preCommit = "scripts/pre-commit-check";
  const installer = "scripts/install-git-hooks";
  const template = "templates/hooks/pre-commit";
  evidence.push("pre-commit purpose: deterministic local commit gate for this library before manual commits");
  evidence.push("pre-commit boundaries: no staging, commits, pushes, package installs, publication, deployment, production calls, or product repo work");
  actions.push("staged secret-shaped diff findings are reported by file and category without values");

  if (dryRun) {
    actions.push("would verify pre-commit-check and install-git-hooks syntax");
    actions.push("would run pre-commit-check default, JSON, and staged modes");
    actions.push("would run install-git-hooks --dry-run and CLI delegation checks");
    actions.push("would run pre-commit tests and stop before migration-review helper, package publication, tags, releases, deploys, or product repos");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "pre-commit validation hook dry-run complete",
      summary: "pre-commit-validation-hook would verify deterministic local commit gating and safe opt-in hook installation",
      nextPermission: "build migration-review helper",
      nextSkill: "migration-review-skill / coding-workflow-orchestrator-skill",
      exitCode: 0,
    };
  }

  const blockers = [];
  for (const required of [preCommit, installer, template, "tests/pre-commit-check.test.js", "schemas/pre-commit-check.schema.json"]) {
    if (!fs.existsSync(path.join(LIBRARY_ROOT, required))) blockers.push(`${required} missing`);
  }

  const commands = [
    ["pre-commit syntax", process.execPath, ["--check", preCommit]],
    ["hook installer syntax", process.execPath, ["--check", installer]],
    ["pre-commit tests", process.execPath, ["tests/pre-commit-check.test.js"]],
    ["pre-commit fast gate", `./${preCommit}`, []],
    ["pre-commit json gate", `./${preCommit}`, ["--json"]],
    ["pre-commit staged gate", `./${preCommit}`, ["--staged"]],
    ["hook installer dry-run", `./${installer}`, ["--dry-run"]],
    ["pre-commit CLI json", "./bin/coding-workflow.js", ["pre-commit-check", "--json"]],
    ["install-hooks CLI dry-run", "./bin/coding-workflow.js", ["install-hooks", "--dry-run"]],
  ];

  for (const [label, command, commandArgs] of commands) {
    const result = run(command, commandArgs, { cwd: LIBRARY_ROOT, allowFailure: true });
    evidence.push(`${label} exit: ${result.code}`);
    if (result.code !== 0) blockers.push(`${label} failed`);
  }

  if (blockers.length) {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: "pre-commit validation hook blocked",
      summary: blockers.join("; "),
      nextPermission: "fix pre-commit hook or validation failures",
      nextSkill: "build-verify-skill / error-evidence-skill",
      exitCode: 1,
    };
  }

  return {
    finalStatus: "READY",
    ledgerStatus: "pre-commit validation hook complete",
    summary: "deterministic local pre-commit gate validates; next active dependency is migration-review helper",
    nextPermission: "build migration-review helper",
    nextSkill: "migration-review-skill / coding-workflow-orchestrator-skill",
    exitCode: 0,
  };
}

function runMigrationReviewHelper() {
  const helper = "scripts/migration-review";
  const schema = "schemas/migration-review.schema.json";
  const testFile = "tests/migration-review.test.js";
  evidence.push("migration-review purpose: deterministic source-only migration risk classification before any database apply/deploy step");
  evidence.push("migration-review boundaries: no SQL execution, Supabase commands, database connections, migration apply, deploy, staging, commits, package publication, or production calls");
  actions.push("migration review reports secret-shaped findings by file and category without values");

  if (dryRun) {
    actions.push("would verify migration-review syntax, schema, synthetic tests, and CLI delegation");
    actions.push("would run migration-review human, JSON, and validate modes against the library");
    actions.push("would run fail-on-high-risk coverage through synthetic fixtures");
    actions.push("would stop before browser live proof, GitHub deep review, release work, package publication, tags, releases, deploys, SQL, or product repos");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "migration-review helper dry-run complete",
      summary: "migration-review-helper would verify deterministic source-only migration risk review",
      nextPermission: "build next verified dependency after migration-review",
      nextSkill: "migration-review-skill / coding-workflow-orchestrator-skill",
      exitCode: 0,
    };
  }

  const blockers = [];
  for (const required of [helper, schema, testFile]) {
    if (!fs.existsSync(path.join(LIBRARY_ROOT, required))) blockers.push(`${required} missing`);
  }

  const commands = [
    ["migration-review syntax", process.execPath, ["--check", helper]],
    ["migration-review tests", process.execPath, [testFile]],
    ["migration-review human", `./${helper}`, ["--repo", "."]],
    ["migration-review json", `./${helper}`, ["--repo", ".", "--json"]],
    ["migration-review validate", `./${helper}`, ["--repo", ".", "--validate"]],
    ["migration-review CLI validate", "./bin/coding-workflow.js", ["migration-review", "--repo", ".", "--validate"]],
    ["pre-commit full gate", "./scripts/pre-commit-check", ["--full"]],
  ];

  for (const [label, command, commandArgs] of commands) {
    const result = run(command, commandArgs, { cwd: LIBRARY_ROOT, allowFailure: true });
    evidence.push(`${label} exit: ${result.code}`);
    if (result.code !== 0) blockers.push(`${label} failed`);
  }

  if (blockers.length) {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: "migration-review helper blocked",
      summary: blockers.join("; "),
      nextPermission: "fix migration-review helper or validation failures",
      nextSkill: "migration-review-skill / error-evidence-skill",
      exitCode: 1,
    };
  }

  return {
    finalStatus: "READY",
    ledgerStatus: "migration-review helper complete",
    summary: "deterministic source-only migration review helper validates; next active dependency must come from the verified roadmap",
    nextPermission: "choose browser live proof, GitHub deep review, Opstruth self-test, or release/package preflight hardening",
    nextSkill: "migration-review-skill / coding-workflow-orchestrator-skill",
    exitCode: 0,
  };
}

function npmPackDryRunEnv() {
  const preferred = DEFAULT_NPM_CACHE;
  const fallback = path.join(os.tmpdir(), "coding-workflow-library-npm-cache-fallback");
  let cache = preferred;
  try {
    fs.mkdirSync(preferred, { recursive: true, mode: 0o700 });
  } catch {
    cache = fallback;
    fs.mkdirSync(fallback, { recursive: true, mode: 0o700 });
  }
  return { ...process.env, NPM_CONFIG_CACHE: cache };
}

function parsePackFiles(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries
      .flatMap((entry) => Array.isArray(entry.files) ? entry.files : [])
      .map((file) => String(file.path || ""))
      .filter(Boolean)
      .sort();
  } catch {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .sort();
  }
}

function packagePathRisks(files) {
  const risks = [];
  for (const original of files) {
    const file = String(original || "").replace(/^package\//, "");
    if (/(^|\/)\.env($|[./-])/.test(file)) risks.push(`env file included: ${file}`);
    if (/(^|\/)evidence($|\/)/.test(file)) risks.push(`evidence folder included: ${file}`);
    if (/(^|\/)(node_modules|\.git|\.openclaw)($|\/)/.test(file)) risks.push(`local runtime folder included: ${file}`);
    if (/(^|\/)(\.npmrc|\.netrc)$/.test(file)) risks.push(`credential config file included: ${file}`);
    if (/\.(pem|key|p12|pfx|crt|cer)$/i.test(file)) risks.push(`key-like file included: ${file}`);
    if (/(^|\/)(tmp|temp)($|\/)/i.test(file)) risks.push(`temp path included: ${file}`);
  }
  return [...new Set(risks)];
}

function copyLibraryForSmoke(sourceRoot, destinationRoot) {
  const result = { excluded: [], filesCopied: 0 };

  function copyEntry(sourcePath, destinationPath, relativePath) {
    const stat = fs.lstatSync(sourcePath);
    if (shouldExcludeFromSmokeCopy(relativePath, stat)) {
      result.excluded.push(relativePath || path.basename(sourcePath));
      return;
    }

    if (stat.isSymbolicLink()) {
      result.excluded.push(relativePath || path.basename(sourcePath));
      return;
    }

    if (stat.isDirectory()) {
      fs.mkdirSync(destinationPath, { recursive: true, mode: stat.mode & 0o777 });
      for (const entry of fs.readdirSync(sourcePath)) {
        copyEntry(
          path.join(sourcePath, entry),
          path.join(destinationPath, entry),
          relativePath ? path.join(relativePath, entry) : entry,
        );
      }
      return;
    }

    if (stat.isFile()) {
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.copyFileSync(sourcePath, destinationPath);
      fs.chmodSync(destinationPath, stat.mode & 0o777);
      result.filesCopied += 1;
    }
  }

  copyEntry(sourceRoot, destinationRoot, "");
  return result;
}

function shouldExcludeFromSmokeCopy(relativePath, stat) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  const basename = path.basename(normalized);
  const firstSegment = normalized.split("/", 1)[0];

  if (!normalized) return false;
  if (stat.isSymbolicLink()) return true;
  if ([".git", "node_modules", "evidence", ".npm", ".pnpm-store", ".yarn", ".cache"].includes(firstSegment)) return true;
  if ([".env", ".npmrc", ".netrc"].includes(basename)) return true;
  if (/^\.env\./.test(basename)) return true;
  if (/\.(pem|key|p12|pfx|crt|cer)$/i.test(basename)) return true;
  if (/secret|credential|token/i.test(basename) && !/skill|readiness|decision/i.test(basename)) return true;
  if (normalized === "vendor-intake/supabase-agent-skills/node_modules") return true;
  return false;
}

function ensureSmokeScriptsExecutable(root) {
  const scriptDir = path.join(root, "scripts");
  if (!fs.existsSync(scriptDir)) return;
  for (const entry of fs.readdirSync(scriptDir)) {
    const full = path.join(scriptDir, entry);
    try {
      if (fs.statSync(full).isFile()) fs.chmodSync(full, fs.statSync(full).mode | 0o111);
    } catch {
      // The validator will report any script that cannot be inspected.
    }
  }
}

function removeSmokeTempDir(tempPath) {
  const safePrefix = path.join(DEFAULT_TEMP_ROOT, "coding-workflow-library-smoke-");
  if (!String(tempPath).startsWith(safePrefix)) {
    throw new Error(`refusing to remove unexpected temp path: ${tempPath}`);
  }
  fs.rmSync(tempPath, { recursive: true, force: true });
  return !fs.existsSync(tempPath);
}

module.exports = {
  runProjectKbCompiler,
  runPreCommitValidationHook,
  runMigrationReviewHelper,
  npmPackDryRunEnv,
  parsePackFiles,
  packagePathRisks,
  copyLibraryForSmoke,
  shouldExcludeFromSmokeCopy,
  ensureSmokeScriptsExecutable,
  removeSmokeTempDir,
};
