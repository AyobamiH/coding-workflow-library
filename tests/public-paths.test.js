#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const { scanRepo, scanText } = require(path.join(ROOT, "scripts", "check-public-paths"));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "public-paths-test-"));

function write(repo, relative, text) {
  const absolute = path.join(repo, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, text);
}

try {
  const repo = path.join(temporary, "repo");
  fs.mkdirSync(repo);
  assert.equal(spawnSync("git", ["init", "-b", "main"], { cwd: repo }).status, 0);

  const posixPath = ["", "home", "maintainer", "projects", "private-repo"].join("/");
  const windowsPath = ["C:", "Users", "Maintainer", "private-repo"].join("\\");
  write(repo, "safe.md", "# Safe\n\nUse `<TARGET_REPO>` or `$HOME/project`.\n");
  write(repo, "leaky.md", `# Leak\n\n${posixPath}\n${windowsPath}\n`);
  assert.equal(spawnSync("git", ["add", "safe.md", "leaky.md"], { cwd: repo }).status, 0);

  const report = scanRepo(repo);
  assert.equal(report.status, "FAIL", "private home paths should fail");
  assert.equal(report.findings.length, 2, "both POSIX and Windows home paths should be found");
  assert.ok(report.findings.every((finding) => finding.file === "leaky.md"));
  assert.doesNotMatch(JSON.stringify(report), /private-repo|maintainer/i, "reports must not repeat path contents");

  const safe = scanText("Use <LIBRARY_REPO>, <TARGET_REPO>, $HOME/project, or ~/project.\n", "safe.md");
  assert.deepEqual(safe, [], "portable placeholders should pass");

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.ok((packageJson.files || []).includes("scripts/"), "package should include public path helper");
  assert.ok((packageJson.files || []).includes("tests/"), "package should include public path tests");

  const real = scanRepo(ROOT);
  assert.equal(real.status, "PASS", "tracked library files should contain no absolute user-home paths");
  console.log("public path tests passed: tracked discovery, POSIX/Windows detection, safe reporting, placeholders, and package inclusion.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
