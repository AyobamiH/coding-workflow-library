#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const preCommitScript = path.join(root, "scripts", "pre-commit-check");
const installerScript = path.join(root, "scripts", "install-git-hooks");
const templatePath = path.join(root, "templates", "hooks", "pre-commit");
const {
  buildDefaultChecks,
  runPreCommitCheck,
  scanDiffForSecrets,
} = require(preCommitScript);
const { MARKER, install } = require(installerScript);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pre-commit-check-test-"));

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 16,
  });
}

function write(base, relativePath, text) {
  const full = path.join(base, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function initRepo(name) {
  const repo = path.join(temp, name);
  fs.mkdirSync(repo, { recursive: true });
  assert.equal(run("git", ["init", "-b", "main"], repo).status, 0, "git init should pass");
  return repo;
}

function stagedNames(repo) {
  const result = run("git", ["diff", "--cached", "--name-only"], repo);
  assert.equal(result.status, 0, "staged name inspection should pass");
  return result.stdout.trim();
}

try {
  const realFast = runPreCommitCheck({ repo: root, checkPlan: [] });
  assert.equal(realFast.status, "pass", "real library pre-commit runner should pass with an empty injected plan");

  const parsed = JSON.parse(JSON.stringify(runPreCommitCheck({ repo: root, checkPlan: [] })));
  assert.equal(parsed.status, "pass", "json status should pass");
  assert.equal(parsed.repo.root, ".", "json must not expose absolute repo root");
  assert.ok(Array.isArray(parsed.checks), "json checks should be an array");

  const forced = runPreCommitCheck({
    repo: root,
    checkPlan: [
      { id: "forced-fail", command: "git", args: ["definitely-not-a-real-git-command"] },
      { id: "should-not-run", command: "git", args: ["status"] },
    ],
  });
  assert.equal(forced.status, "fail", "failed check should fail the helper");
  assert.equal(forced.first_failure.id, "forced-fail", "first failure should be reported");
  assert.equal(forced.checks.length, 1, "checks should stop after the first required failure");

  const noStagedRepo = initRepo("no staged repo");
  const noStaged = runPreCommitCheck({ repo: noStagedRepo, staged: true, checkPlan: [] });
  assert.equal(noStaged.status, "pass", "staged mode should pass with no staged files");
  assert.equal(noStaged.checks[0].status, "skipped", "no staged files should be explicit");

  const stagedRepo = initRepo("staged repo");
  write(stagedRepo, "safe.txt", "safe\n");
  assert.equal(run("git", ["add", "safe.txt"], stagedRepo).status, 0, "git add safe fixture should pass");
  const before = stagedNames(stagedRepo);
  const stagedSafe = runPreCommitCheck({ repo: stagedRepo, staged: true, checkPlan: [] });
  const after = stagedNames(stagedRepo);
  assert.equal(stagedSafe.status, "pass", "safe staged diff should pass");
  assert.equal(before, after, "staged mode must not stage or unstage files");

  const hookTemplate = fs.readFileSync(templatePath, "utf8");
  assert.ok(hookTemplate.includes(MARKER), "hook template should include managed marker");
  assert.ok(hookTemplate.includes("scripts/pre-commit-check --staged"), "hook template should delegate to pre-commit-check");

  const dryRepo = initRepo("dry repo");
  const dryRun = install({ cwd: dryRepo, dryRun: true });
  assert.equal(dryRun.status, "ok", "installer dry-run should pass");
  assert.equal(fs.existsSync(path.join(dryRepo, ".git", "hooks", "pre-commit")), false, "dry-run must not write hook");

  const unmanagedRepo = initRepo("unmanaged repo");
  write(unmanagedRepo, ".git/hooks/pre-commit", "#!/bin/sh\necho custom\n");
  const refused = install({ cwd: unmanagedRepo });
  assert.equal(refused.status, "refused", "installer should refuse unmanaged hook");
  assert.equal(refused.reason, "existing unmanaged pre-commit hook preserved", "refusal should be clear");

  const managedRepo = initRepo("managed repo");
  write(managedRepo, ".git/hooks/pre-commit", `#!/bin/sh\n# ${MARKER}\n`);
  const managed = install({ cwd: managedRepo, dryRun: true });
  assert.equal(managed.status, "ok", "managed hook dry-run should pass");
  assert.equal(managed.action, "update", "managed hook should be updateable");

  const installRepo = initRepo("install repo");
  const installed = install({ cwd: installRepo });
  assert.equal(installed.status, "ok", "installer should pass");
  const installedHook = fs.readFileSync(path.join(installRepo, ".git", "hooks", "pre-commit"), "utf8");
  assert.ok(installedHook.includes(MARKER), "installer should write managed hook");

  const nonRepo = path.join(temp, "not a repo");
  fs.mkdirSync(nonRepo);
  const outside = install({ cwd: nonRepo });
  assert.equal(outside.status, "fail", "installer should not install outside a git repo");

  const forceRepo = initRepo("force repo");
  write(forceRepo, ".git/hooks/pre-commit", "#!/bin/sh\necho custom\n");
  const forcedInstall = install({ cwd: forceRepo, force: true });
  assert.equal(forcedInstall.status, "ok", "force should explicitly replace unmanaged hook in fixture");
  assert.ok(fs.readFileSync(path.join(forceRepo, ".git", "hooks", "pre-commit"), "utf8").includes(MARKER), "force should install managed marker");

  const secretValue = "super-secret-token-value-123456";
  const secretRepo = initRepo("secret repo");
  write(secretRepo, ".env", `SECRET_TOKEN=${secretValue}\n`);
  assert.equal(run("git", ["add", ".env"], secretRepo).status, 0, "git add secret fixture should pass");
  const secretCheck = runPreCommitCheck({ repo: secretRepo, staged: true, checkPlan: [] });
  const serializedSecretCheck = JSON.stringify(secretCheck);
  assert.equal(secretCheck.status, "fail", "secret-shaped staged diff should fail");
  assert.doesNotMatch(serializedSecretCheck, new RegExp(secretValue), "secret value must not be printed");
  assert.ok(secretCheck.checks[0].risks.some((risk) => risk.file === ".env"), "risk should name the file");
  assert.ok(secretCheck.checks[0].risks.every((risk) => risk.category), "risk should name a category");

  const directRisks = scanDiffForSecrets([
    "diff --git a/a b/a",
    "+++ b/a",
    "@@ -0,0 +1 @@",
    `+DATABASE_URL=${"postgres"}://${"user"}:${"pass"}@example.invalid/db`,
    "",
  ].join("\n"));
  assert.equal(directRisks.length > 0, true, "direct staged scan should classify secret-looking values");

  const commandList = buildDefaultChecks({ full: true }).map((check) => [check.command, ...check.args].join(" "));
  assert.equal(commandList.some((command) => /\bnpm publish\b|\bnpm version\b|\bgit tag\b|\bdeploy\b/.test(command)), false, "pre-commit checks must not publish, version, tag, or deploy");

  const repeatedA = runPreCommitCheck({ repo: root, checkPlan: [] });
  const repeatedB = runPreCommitCheck({ repo: root, checkPlan: [] });
  assert.equal(repeatedA.status, repeatedB.status, "repeated runs should have stable status");
  assert.equal(repeatedA.checks_run, repeatedB.checks_run, "repeated runs should have stable check count");

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok((packageJson.files || []).includes("scripts/"), "package allowlist should include helper scripts");
  assert.ok((packageJson.files || []).includes("templates/"), "package allowlist should include hook templates");
  assert.ok((packageJson.files || []).includes("tests/"), "package allowlist should include tests");
  assert.ok(fs.existsSync(path.join(root, "scripts", "pre-commit-check")), "pre-commit helper should exist");
  assert.ok(fs.existsSync(path.join(root, "scripts", "install-git-hooks")), "hook installer should exist");
  assert.ok(fs.existsSync(templatePath), "hook template should exist");
  assert.equal((packageJson.files || []).some((entry) => entry.includes(".git") || entry.includes("tmp")), false, "package allowlist should not include temp hooks or private git state");

  console.log("pre-commit tests passed: check helper, staged scan, installer safety, CLI package inclusion, and privacy boundaries.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
