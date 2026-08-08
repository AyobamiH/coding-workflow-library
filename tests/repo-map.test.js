#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "repo-map");
const {
  buildRepoMap,
  detectPackageManager,
  safeScriptCommand,
  shouldExclude,
  validateRepoMap,
} = require(script);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "repo-map-test-"));
const gitRepo = path.join(temp, "fixture repo");
const nonGitRepo = path.join(temp, "non-git");

function write(base, relativePath, text) {
  const full = path.join(base, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
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

  write(gitRepo, "README.md", "# Fixture\n\n- docs/guide.md\n- skill-files/example-skill.md\n");
  write(gitRepo, "RUNBOOK.md", "# Runbook\n");
  write(gitRepo, "AGENTS.md", "# Agents\n");
  write(gitRepo, "build-queue.md", "# Queue\n");
  write(gitRepo, "skills-index.md", "# Skills Index\n\n- skill-files/example-skill.md\n");
  write(gitRepo, "docs/agent-and-skill-roadmap.md", "# Roadmap\n");
  write(gitRepo, "docs/guide.md", "# Guide\n");
  write(gitRepo, "skill-files/example-skill.md", "# Example Skill\n");
  write(gitRepo, "templates/example template.md", "# Example Template\n");
  write(gitRepo, "src/index.ts", "export const value = 1;\n");
  write(gitRepo, "scripts/build.js", "console.log('build');\n");
  write(gitRepo, "supabase/migrations/001_init.sql", "select 1;\n");
  write(gitRepo, "package-lock.json", "{}\n");
  write(gitRepo, "package.json", JSON.stringify({
    scripts: {
      build: "node scripts/build.js",
      "receipts:test": "node scripts/build.js --receipts",
      test: "SECRET_TOKEN=super-secret-token-value node scripts/build.js",
      lint: "eslint .",
    },
  }, null, 2));
  write(gitRepo, ".env", "SECRET_TOKEN=super-secret-token-value\n");
  write(gitRepo, ".env.example", "SECRET_TOKEN=\n");
  write(gitRepo, "dist/generated.js", "ignored\n");
  write(gitRepo, "node_modules/pkg/index.js", "ignored\n");
  write(gitRepo, "file with spaces.js", "console.log('space');\n");

  assert.equal(run("git", ["add", "README.md", "RUNBOOK.md", "AGENTS.md", "build-queue.md", "skills-index.md", "docs/agent-and-skill-roadmap.md", "docs/guide.md", "skill-files/example-skill.md", "templates/example template.md", "src/index.ts", "scripts/build.js", "supabase/migrations/001_init.sql", "package-lock.json", "package.json", ".env", ".env.example", "file with spaces.js"], gitRepo).status, 0, "git add fixture should succeed");

  const before = fs.readdirSync(gitRepo, { recursive: true }).sort();
  const map = buildRepoMap({ repo: gitRepo, maxFiles: 500 });
  const after = fs.readdirSync(gitRepo, { recursive: true }).sort();

  assert.equal(map.git.repo_root_found, true, "git repo root should be detected");
  assert.equal(map.git.current_branch, "main", "current branch should be detected");
  assert.equal(map.package_manager, "npm", "package manager should be detected from lockfile");
  assert.ok(map.top_level.files.includes("README.md"), "top-level files should be listed");
  assert.ok(map.top_level.directories.includes("src"), "top-level dirs should be listed");
  assert.deepEqual(map.top_level.files, [...map.top_level.files].sort((a, b) => a.localeCompare(b)), "top-level files should sort deterministically");
  assert.ok(map.languages.some((item) => item.language === "typescript"), "TypeScript should be detected");
  assert.ok(map.languages.some((item) => item.language === "javascript"), "JavaScript should be detected");
  assert.equal(map.package_scripts.build, "node scripts/build.js", "package scripts should be extracted");
  assert.equal(map.command_candidates.test, "npm run test", "canonical test command should win over focused variants");
  assert.ok(map.docs.available, "docs-list integration should be available");
  assert.ok(map.docs.documents >= 5, "docs-list summary should report documents");
  assert.ok(map.env_files.some((entry) => entry.path === ".env" && entry.status === "present"), "env file presence should be reported");
  assert.ok(map.env_files.every((entry) => !("value" in entry)), "env values must not be present");
  assert.doesNotMatch(JSON.stringify(map), /super-secret-token-value/, "secret-shaped contents must not be emitted");
  assert.ok(!JSON.stringify(map).includes(gitRepo), "JSON map must not include private absolute repo paths");
  assert.ok(!map.top_level.directories.includes("dist"), "generated dirs should be excluded");
  assert.ok(!map.top_level.directories.includes("node_modules"), "dependency dirs should be excluded");
  assert.ok(map.top_level.files.includes("file with spaces.js"), "filenames with spaces should be handled");
  assert.deepEqual(before, after, "repo-map must not mutate target repo files");
  assert.deepEqual(validateRepoMap(map), [], "valid map should pass validation");
  assert.deepEqual(buildRepoMap({ repo: gitRepo, maxFiles: 500 }), map, "repeated runs should be equivalent");

  const limited = buildRepoMap({ repo: gitRepo, maxFiles: 3 });
  assert.equal(limited.repo.file_count_considered, 3, "max file limit should be respected");
  assert.equal(limited.repo.limit_reached, true, "limit reached should be reported");

  fs.mkdirSync(nonGitRepo, { recursive: true });
  write(nonGitRepo, "README.md", "# Non Git\n");
  write(nonGitRepo, "app/main.py", "print('hello')\n");
  const nonGitMap = buildRepoMap({ repo: nonGitRepo, maxFiles: 500 });
  assert.equal(nonGitMap.git.status, "not_a_git_repo", "non-git dir should be handled safely");
  assert.equal(nonGitMap.git.repo_root_found, false, "non-git dir should not claim a root");

  assert.equal(detectPackageManager(["pnpm-lock.yaml", "package.json"]), "pnpm");
  assert.equal(shouldExclude("node_modules/pkg/index.js"), true);
  assert.equal(shouldExclude("src/index.ts"), false);
  const dbUrlKey = ["DATABASE", "URL"].join("_");
  const dbUrlScript = `${dbUrlKey}=${["postgres", "://"].join("")}user:pass@example/db node x`;
  assert.equal(safeScriptCommand(dbUrlScript), `${dbUrlKey}=<redacted> node x`);
  const localCache = ["", "home", "maintainer", ".local", "tmp", "npm-cache"].join("/");
  assert.equal(safeScriptCommand(`npm pack --cache ${localCache}`), "npm pack --cache <local-path>");
  assert.ok(validateRepoMap({}).length > 0, "malformed output should fail internal validation");

  const cliValidation = run(process.execPath, [script, "--repo", gitRepo, "--validate"], root);
  assert.equal(cliValidation.status, 0, "validation mode should pass for valid fixture output");
  const jsonResult = run(process.execPath, [script, "--repo", gitRepo, "--json"], root);
  assert.equal(jsonResult.status, 0, "json mode should pass");
  const serialized = JSON.stringify(map, null, 2);
  assert.doesNotThrow(() => JSON.parse(serialized), "json output should parse");
  assert.doesNotMatch(serialized, /super-secret-token-value/, "json output should not include secret contents");
  assert.doesNotMatch(serialized, new RegExp(gitRepo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "json output should not include absolute fixture path");

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok((packageJson.files || []).includes("scripts/"), "package contents should include helper scripts");
  assert.ok((packageJson.files || []).includes("schemas/"), "package contents should include schemas");

  console.log("repo-map tests passed: git/non-git handling, deterministic inventory, safe metadata, validation, redaction, and package inclusion.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
