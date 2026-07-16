#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const packageHelper = require(path.join(ROOT, "scripts", "npm-package-readiness"));
const releaseHelper = require(path.join(ROOT, "scripts", "release-preflight"));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "release-preflight-test-"));

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 1024 * 1024 * 8 });
}

function write(base, relativePath, value, mode = null) {
  const target = path.join(base, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
  if (mode !== null) fs.chmodSync(target, mode);
}

function writeJson(base, relativePath, value) {
  write(base, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function initRepo(name) {
  const repo = path.join(temp, name);
  fs.mkdirSync(repo, { recursive: true });
  assert.equal(run("git", ["init", "-b", "main"], repo).status, 0);
  assert.equal(run("git", ["config", "user.email", "fixture@example.invalid"], repo).status, 0);
  assert.equal(run("git", ["config", "user.name", "Fixture"], repo).status, 0);
  return repo;
}

function commitAll(repo, message) {
  assert.equal(run("git", ["add", "--all"], repo).status, 0);
  assert.equal(run("git", ["commit", "-m", message], repo).status, 0);
}

function packageJson(version = "1.1.0") {
  return {
    name: "fixture-package",
    version,
    description: "Synthetic package fixture.",
    license: "MIT",
    repository: { type: "git", url: "https://example.invalid/fixture.git" },
    bin: { fixture: "bin/fixture.js" },
    files: ["bin/", "README.md", "CHANGELOG.md"],
    scripts: { test: "node --test", prepack: "node --check bin/fixture.js" },
  };
}

function packResult(paths) {
  return {
    status: 0,
    stdout: `prepack summary\n${JSON.stringify([{ files: paths.map((item) => ({ path: item, size: 1, mode: 420 })) }])}`,
    stderr: "",
  };
}

function packageReport(repo, paths = ["bin/fixture.js", "README.md", "CHANGELOG.md", "package.json"]) {
  return packageHelper.buildPackageReadiness(
    { repo, expectPackage: true, expectCli: true, allowPackDryRun: true },
    { runPack: () => packResult(paths) },
  );
}

function validCorpus(dir) {
  writeJson(dir, "coverage-report.json", {
    totals: { discovered: 4, parsed: 3, unsupported: 1, corrupt: 0, empty: 0, duplicate: 0, excluded: 0 },
    extraction_meta_sessions: 1,
    total_events: 120,
    ranked_events: 100,
    date_range: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00.000Z" },
    command_counts: { git: 20, gh: 3, npm: 12 },
    skill_mentions: { "build-verify-skill": 5, "release-preflight-skill": 4, "npm-package-readiness-skill": 3 },
    helper_mentions: { "scripts/release-preflight": 2, "scripts/npm-package-readiness": 2 },
    source_roots: ["must-not-be-emitted"],
  });
  writeJson(dir, "validation-report.json", {
    status: "PASS",
    errors: [],
    corpus_schema: "PASS",
    manifest_schema: "PASS",
    coverage_reconciled: true,
  });
}

try {
  const repo = initRepo("release repo");
  writeJson(repo, "package.json", packageJson("1.0.0"));
  writeJson(repo, "package-lock.json", { name: "fixture-package", version: "1.0.0", lockfileVersion: 3, packages: {} });
  write(repo, "README.md", "# Fixture Package\n");
  write(repo, "CHANGELOG.md", "# Changelog\n\n## 1.0.0\n\n- Initial release.\n");
  write(repo, "bin/fixture.js", "#!/usr/bin/env node\nconsole.log('fixture');\n", 0o755);
  commitAll(repo, "Initial release");
  assert.equal(run("git", ["tag", "v1.0.0"], repo).status, 0);

  writeJson(repo, "package.json", packageJson("1.1.0"));
  write(repo, "CHANGELOG.md", "# Changelog\n\n## 1.1.0\n\n- Harden release evidence.\n\n## 1.0.0\n\n- Initial release.\n");
  commitAll(repo, "Prepare next release");

  const readyPackage = packageReport(repo);
  assert.equal(readyPackage.final_status, "PASS", "complete package fixture should pass");
  assert.deepEqual(packageHelper.validatePackageReport(readyPackage), []);
  assert.equal(readyPackage.pack_dry_run.entry_count, 4);
  assert.equal(readyPackage.script_inventory.includes("test"), true);
  assert.equal(JSON.stringify(readyPackage).includes("node --test"), false, "script bodies must not be emitted");
  assert.equal(JSON.stringify(readyPackage).includes(repo), false, "package report must not emit fixture root");
  assert.match(packageHelper.renderHuman(readyPackage), /Final classification: PASS/);
  const followedManifest = packageHelper.extractPackManifest(`${packResult(["package.json"]).stdout}\ntrailing diagnostic`);
  assert.equal(followedManifest.files.length, 1, "pack JSON should parse when diagnostics follow the manifest");

  const riskyPackage = packageReport(repo, ["bin/fixture.js", ".env.production", "evidence/private.md"]);
  assert.equal(riskyPackage.final_status, "FAIL", "forbidden package paths should fail");
  assert(riskyPackage.pack_dry_run.risks.some((risk) => risk.code === "ENV_FILE_INCLUDED"));
  assert(riskyPackage.pack_dry_run.risks.some((risk) => risk.code === "EVIDENCE_INCLUDED"));
  assert(riskyPackage.blockers.some((blocker) => blocker.code === "PACK_DRY_RUN_FAILED"));

  const noPackageRepo = initRepo("no package repo");
  write(noPackageRepo, "README.md", "# Local only\n");
  commitAll(noPackageRepo, "Local docs");
  assert.equal(packageHelper.buildPackageReadiness({ repo: noPackageRepo }).final_status, "NOT_APPLICABLE");
  assert.equal(packageHelper.buildPackageReadiness({ repo: noPackageRepo, expectPackage: true }).final_status, "FAIL");

  const unsafeMetadataRepo = path.join(temp, "unsafe metadata repo");
  fs.mkdirSync(unsafeMetadataRepo, { recursive: true });
  const privateTarget = ["", "home", "fixture-user", "bin", "unsafe.js"].join("/");
  const secretBody = ["Bearer", "abcdefghijklmnopqrstuvwxyz"].join(" ");
  writeJson(unsafeMetadataRepo, "package.json", {
    name: "Invalid Package Name",
    version: "1.0.0",
    license: "MIT",
    bin: { unsafe: privateTarget },
    scripts: { test: `echo ${secretBody}` },
  });
  const unsafeMetadata = packageHelper.buildPackageReadiness({ repo: unsafeMetadataRepo, expectPackage: true, expectCli: true });
  const unsafeSerialized = JSON.stringify(unsafeMetadata);
  assert.equal(unsafeMetadata.final_status, "FAIL");
  assert.equal(unsafeSerialized.includes(privateTarget), false, "private bin targets must not be emitted");
  assert.equal(unsafeSerialized.includes(secretBody), false, "package script bodies must not be emitted");

  const corpusDir = path.join(temp, "corpus aggregate");
  fs.mkdirSync(corpusDir, { recursive: true });
  validCorpus(corpusDir);
  const corpus = releaseHelper.loadCorpusEvidence(corpusDir, true);
  assert.equal(corpus.status, "PASS");
  assert.equal(corpus.coverage_reconciled, true);
  assert.equal(corpus.release_signals.command_mentions.npm, 12);
  assert.equal(JSON.stringify(corpus).includes("must-not-be-emitted"), false, "source roots must not be emitted");
  assert.equal(JSON.stringify(corpus).includes(corpusDir), false, "corpus path must remain private");

  const dependencies = {
    packageBuilder: () => readyPackage,
    evidenceDryRun: () => ({ status: 0, stdout: "", stderr: "" }),
  };
  const beforeStatus = run("git", ["status", "--short"], repo).stdout;
  const release = releaseHelper.buildReleasePreflight({
    repo,
    mode: "cli",
    allowPackDryRun: true,
    corpusDir,
    requireCorpus: true,
  }, dependencies);
  const afterStatus = run("git", ["status", "--short"], repo).stdout;
  assert.equal(release.final_status, "PASS", "advanced version, changed notes, package proof, and corpus proof should pass");
  assert.equal(release.release_notes.changed_since_baseline, true);
  assert.equal(release.corpus_evidence.status, "PASS");
  assert.deepEqual(releaseHelper.validateReleaseReport(release), []);
  assert.equal(beforeStatus, afterStatus, "release preflight must not mutate the repository");
  assert.equal(JSON.stringify(release).includes(repo), false, "release report must not emit fixture root");
  assert.match(releaseHelper.renderHuman(release), /Corpus evidence:/);
  assert(release.commands_not_run.includes("npm publish"));

  const stalePackage = JSON.parse(JSON.stringify(readyPackage));
  stalePackage.package.version = "1.0.0";
  const stale = releaseHelper.buildReleasePreflight({ repo, mode: "cli", corpusDir, requireCorpus: true }, {
    ...dependencies,
    packageBuilder: () => stalePackage,
  });
  assert.equal(stale.final_status, "FAIL");
  assert(stale.blockers.some((blocker) => blocker.code === "VERSION_NOT_ADVANCED"));

  const missingCorpus = releaseHelper.buildReleasePreflight({ repo, mode: "cli", requireCorpus: true }, dependencies);
  assert.equal(missingCorpus.final_status, "FAIL");
  assert(missingCorpus.blockers.some((blocker) => blocker.code === "CORPUS_EVIDENCE_REQUIRED"));

  const invalidCorpusDir = path.join(temp, "invalid corpus");
  fs.mkdirSync(invalidCorpusDir, { recursive: true });
  validCorpus(invalidCorpusDir);
  const invalidCoverage = JSON.parse(fs.readFileSync(path.join(invalidCorpusDir, "coverage-report.json"), "utf8"));
  invalidCoverage.totals.discovered = 99;
  writeJson(invalidCorpusDir, "coverage-report.json", invalidCoverage);
  const invalidCorpus = releaseHelper.buildReleasePreflight({ repo, mode: "cli", corpusDir: invalidCorpusDir, requireCorpus: true }, dependencies);
  assert.equal(invalidCorpus.final_status, "FAIL");
  assert(invalidCorpus.blockers.some((blocker) => blocker.code === "CORPUS_EVIDENCE_INVALID"));

  const unchangedRepo = initRepo("unchanged notes repo");
  writeJson(unchangedRepo, "package.json", packageJson("1.0.0"));
  write(unchangedRepo, "README.md", "# Unchanged Notes\n");
  write(unchangedRepo, "CHANGELOG.md", "# Changelog\n\n## 1.0.0\n");
  write(unchangedRepo, "bin/fixture.js", "#!/usr/bin/env node\n", 0o755);
  commitAll(unchangedRepo, "Release one");
  assert.equal(run("git", ["tag", "v1.0.0"], unchangedRepo).status, 0);
  write(unchangedRepo, "README.md", "# Unchanged Notes\n\nMore detail.\n");
  commitAll(unchangedRepo, "Change without notes");
  const unchanged = releaseHelper.buildReleasePreflight({ repo: unchangedRepo, mode: "npm" }, {
    packageBuilder: () => readyPackage,
    evidenceDryRun: () => ({ status: 0 }),
  });
  assert.equal(unchanged.final_status, "FAIL");
  assert(unchanged.blockers.some((blocker) => blocker.code === "RELEASE_NOTE_NOT_CHANGED"));

  const localOnly = releaseHelper.buildReleasePreflight({ repo: noPackageRepo, mode: "local" }, {
    evidenceDryRun: () => ({ status: 0 }),
  });
  assert.equal(localOnly.final_status, "PASS", "local mode must not fail because package metadata is absent");

  assert.deepEqual(releaseHelper.parseArgs(["--repo", ".", "--mode", "npm", "--json", "--validate", "--strict"]), {
    allowPackDryRun: false,
    mode: "npm",
    json: true,
    validate: true,
    strict: true,
    requireCorpus: false,
    repo: ".",
  });
  assert.throws(() => releaseHelper.parseArgs(["--repo", ".", "--require-corpus"]), /requires --corpus-dir/);
  assert(packageHelper.validatePackageReport({}).length > 0);
  assert(releaseHelper.validateReleaseReport({}).length > 0);

  const packageSchema = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas", "npm-package-readiness.schema.json"), "utf8"));
  const releaseSchema = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas", "release-preflight.schema.json"), "utf8"));
  assert(packageSchema.required.includes("blockers"));
  assert(releaseSchema.required.includes("corpus_evidence"));

  const rootPackage = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert((rootPackage.files || []).includes("schemas/"));
  assert((rootPackage.files || []).includes("scripts/"));
  assert((rootPackage.files || []).includes("tests/"));

  console.log("release preflight tests passed: package boundaries, corpus aggregates, mode contracts, blockers, version and release-note checks.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
