#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "project-kb");
const {
  buildProjectKb,
  renderMarkdown,
  validateProjectKb,
} = require(script);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "project-kb-test-"));
const gitRepo = path.join(temp, "fixture repo");
const nonPackageRepo = path.join(temp, "plain repo");

function write(base, relativePath, text) {
  const full = path.join(base, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function listFiles(base) {
  return fs.existsSync(base) ? fs.readdirSync(base, { recursive: true }).sort() : [];
}

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
}

try {
  fs.mkdirSync(gitRepo, { recursive: true });
  assert.equal(run("git", ["init", "-b", "main"], gitRepo).status, 0, "git init should succeed");

  write(gitRepo, "README.md", "# Fixture Project\n\n- docs/guide.md\n");
  write(gitRepo, "AGENTS.md", "# Agents\n");
  write(gitRepo, "RUNBOOK.md", "# Runbook\n");
  write(gitRepo, "skills-index.md", "# Skills Index\n\n- skill-files/example-skill.md\n");
  write(gitRepo, "build-queue.md", "# Queue\n");
  write(gitRepo, "CHANGELOG.md", "# Changelog\n");
  write(gitRepo, "docs/guide.md", "# Guide\n");
  write(gitRepo, "docs/file with spaces.md", "# Space Doc\n");
  write(gitRepo, "skill-files/example-skill.md", "# Example Skill\n");
  write(gitRepo, "routes/skill-routes.json", JSON.stringify({
    version: 1,
    routes: [
      { id: "alpha-route" },
      { id: "beta-route" },
    ],
  }, null, 2));
  write(gitRepo, "src/index.ts", "export const value = 1;\n");
  write(gitRepo, "scripts/check.js", "console.log('check');\n");
  write(gitRepo, "package-lock.json", "{}\n");
  write(gitRepo, "package.json", JSON.stringify({
    name: "fixture-package",
    version: "1.2.3",
    description: "Synthetic package fixture.",
    repository: { type: "git", url: "git+https://example.invalid/fixture.git" },
    scripts: {
      build: "node scripts/check.js",
      test: "SECRET_TOKEN=super-secret-token-value node scripts/check.js",
      validate: "node scripts/check.js",
    },
  }, null, 2));
  write(gitRepo, ".env", "SECRET_TOKEN=super-secret-token-value\n");
  write(gitRepo, ".env.example", "SECRET_TOKEN=\n");
  write(gitRepo, "dist/generated.js", "ignored\n");
  write(gitRepo, "node_modules/pkg/index.js", "ignored\n");

  assert.equal(run("git", ["add", "README.md", "AGENTS.md", "RUNBOOK.md", "skills-index.md", "build-queue.md", "CHANGELOG.md", "docs/guide.md", "docs/file with spaces.md", "skill-files/example-skill.md", "routes/skill-routes.json", "src/index.ts", "scripts/check.js", "package-lock.json", "package.json", ".env", ".env.example"], gitRepo).status, 0, "fixture git add should succeed");

  const before = listFiles(gitRepo);
  const kb = buildProjectKb({ repo: gitRepo, maxDocs: 50, includeDocs: true, includeRoutes: true, includePackageScripts: true });
  const after = listFiles(gitRepo);
  const serialized = JSON.stringify(kb, null, 2);
  const markdown = renderMarkdown(kb);

  assert.equal(kb.project_identity.name, "fixture-package", "package metadata should define identity");
  assert.equal(kb.project_identity.version, "1.2.3", "package version should be captured");
  assert.equal(kb.stack_and_package_manager.package_manager, "npm", "package manager should come from repo-map evidence");
  assert.ok(kb.stack_and_package_manager.languages.some((item) => item.language === "typescript"), "repo-map language data should be consumed");
  assert.ok(kb.documentation_surface.available, "docs-list data should be available");
  assert.ok(kb.documentation_surface.key_documents.some((doc) => doc.path === "docs/file with spaces.md"), "filenames with spaces should be handled");
  assert.equal(kb.skills_and_routes.routes.count, 2, "route metadata should be summarized");
  assert.equal(kb.important_commands.package_scripts.validate, "node scripts/check.js", "package scripts should be extracted");
  assert.doesNotMatch(kb.important_commands.package_scripts.test, /super-secret-token-value/, "secret-like package script values should be redacted");
  assert.ok(kb.known_local_only_state.env_files.some((entry) => entry.path === ".env" && entry.status === "present"), "env files should be presence-only");
  assert.ok(kb.known_local_only_state.env_files.every((entry) => !("value" in entry)), "env values must not be present");
  assert.ok(!kb.repository_shape.top_level.directories.includes("dist"), "generated folders should be excluded");
  assert.ok(!kb.repository_shape.top_level.directories.includes("node_modules"), "cache/dependency folders should be excluded");
  assert.deepEqual(validateProjectKb(kb), [], "valid KB should pass validation");
  assert.deepEqual(buildProjectKb({ repo: gitRepo, maxDocs: 50, includeDocs: true, includeRoutes: true, includePackageScripts: true }), kb, "repeated runs should be equivalent");
  assert.deepEqual(before, after, "project-kb must not mutate target repo without output");
  assert.doesNotMatch(serialized, /super-secret-token-value/, "JSON must not include secret contents");
  assert.doesNotMatch(serialized, new RegExp(gitRepo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "JSON must not include private absolute fixture paths");
  assert.ok(markdown.includes("# Project Knowledge Base"), "Markdown output should include KB title");
  assert.ok(markdown.includes("## Verified Facts"), "Markdown output should include required sections");

  const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas", "project-kb.schema.json"), "utf8"));
  assert.ok(schema.required.includes("project_identity"), "schema should require project_identity");
  assert.ok(schema.required.includes("source_only_safety_boundaries"), "schema should require safety boundaries");
  assert.ok(validateProjectKb({}).length > 0, "malformed internal output should fail validation");

  const outputPath = path.join(temp, "PROJECT_KB.md");
  const dryRun = run(process.execPath, [script, "--repo", gitRepo, "--output", outputPath, "--dry-run"], root);
  assert.equal(dryRun.status, 0, "dry-run should pass");
  assert.equal(fs.existsSync(outputPath), false, "dry-run must not create output");

  const outputRun = run(process.execPath, [script, "--repo", gitRepo, "--output", outputPath], root);
  assert.equal(outputRun.status, 0, "output mode should pass");
  assert.equal(fs.existsSync(outputPath), true, "output mode should write requested file");
  assert.ok(fs.readFileSync(outputPath, "utf8").includes("Project Knowledge Base"), "output file should contain Markdown KB");
  const afterOutput = listFiles(gitRepo);
  assert.deepEqual(afterOutput, after, "output outside repo should not mutate target repo");

  const validateRun = run(process.execPath, [script, "--repo", gitRepo, "--validate"], root);
  assert.equal(validateRun.status, 0, "validation mode should pass");
  const jsonRun = run(process.execPath, [script, "--repo", gitRepo, "--json"], root);
  assert.equal(jsonRun.status, 0, "json mode should pass");

  fs.mkdirSync(nonPackageRepo, { recursive: true });
  write(nonPackageRepo, "README.md", "# Plain Repository\n");
  write(nonPackageRepo, "lib/tool.py", "print('plain')\n");
  const plainKb = buildProjectKb({ repo: nonPackageRepo, maxDocs: 10, includeDocs: true, includeRoutes: true, includePackageScripts: true });
  assert.equal(plainKb.project_identity.name, "unpackaged repository", "non-package repos should be handled safely");
  assert.equal(plainKb.stack_and_package_manager.package_manager, "not_detected", "non-package package manager should be not detected");

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok((packageJson.files || []).includes("scripts/"), "package contents should include helper scripts");
  assert.ok((packageJson.files || []).includes("schemas/"), "package contents should include schemas");
  assert.ok((packageJson.files || []).includes("tests/"), "package contents should include tests");

  console.log("project-kb tests passed: deterministic KB synthesis, safe metadata, dry-run/write boundaries, validation, and package inclusion.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
