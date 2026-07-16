#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const {
  buildReport,
  parseRepo,
  validateInputs,
  validateReport,
} = require(path.join(ROOT, "scripts", "multi-project-proof"));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "multi-project-proof-test-"));

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 1024 * 1024 * 8 });
}

function fixture(label) {
  const repo = path.join(temporary, label);
  fs.mkdirSync(repo, { recursive: true });
  assert.equal(run("git", ["init", "-b", "main"], repo).status, 0);
  fs.writeFileSync(path.join(repo, "README.md"), `# ${label}\n`);
  fs.writeFileSync(path.join(repo, "package.json"), `${JSON.stringify({
    name: `fixture-${label}`,
    version: "1.0.0",
    private: true,
    scripts: { test: "node --version" },
  }, null, 2)}\n`);
  assert.equal(run("git", ["add", "README.md", "package.json"], repo).status, 0);
  return { label, repo };
}

try {
  assert.deepEqual(validateInputs([]), ["minimum-three-repositories-required"]);
  assert.ok(validateInputs([
    { label: "one", repo: "/tmp/a" },
    { label: "one", repo: "/tmp/b" },
    { label: "three", repo: "/tmp/a" },
  ]).includes("duplicate-label"));
  assert.equal(parseRepo("project=/tmp/project").label, "project");
  assert.throws(() => parseRepo("Bad Label=/tmp/project"), /labels/);

  const repos = [fixture("alpha"), fixture("beta"), fixture("gamma")];
  const before = repos.map((item) => run("git", ["status", "--porcelain"], item.repo).stdout);
  const report = buildReport({ repos });
  const after = repos.map((item) => run("git", ["status", "--porcelain"], item.repo).stdout);

  assert.equal(report.status, "PASS", JSON.stringify(report.failures));
  assert.equal(report.repositories_observed, 3);
  assert.deepEqual(report.results.map((item) => item.label), ["alpha", "beta", "gamma"]);
  assert.ok(report.results.every((item) => item.git.unchanged));
  assert.ok(report.results.every((item) => item.lane_state_unchanged));
  assert.ok(report.results.every((item) => item.contracts.length === 4));
  assert.deepEqual(before, after, "proof changed a target repository");
  assert.deepEqual(validateReport(report), []);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(temporary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "report leaked private paths");

  const missing = buildReport({
    repos: [
      { label: "one", repo: path.join(temporary, "missing-one") },
      { label: "two", repo: path.join(temporary, "missing-two") },
      { label: "three", repo: path.join(temporary, "missing-three") },
    ],
  });
  assert.equal(missing.status, "FAIL");
  assert.ok(missing.failures.every((item) => /repository-unavailable/.test(item)));

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.ok((packageJson.files || []).includes("scripts/"));
  assert.ok((packageJson.files || []).includes("schemas/"));

  console.log("multi-project proof tests passed: three repositories, shared contracts, explicit failure, target immutability, and lane isolation.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
