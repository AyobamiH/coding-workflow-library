"use strict";

// GitHub handoff, first-version checks, and clean consumer package helpers.

const runtime = require("./runtime-context");
const { fs, path, LIBRARY_ROOT, DEFAULT_ENV_FILE, DEFAULT_TEMP_ROOT, DEFAULT_NPM_CACHE, EXPECTED_GITHUB_USER, CLI_COMMAND_NAME, CLI_BIN_RELATIVE, OPEN_SOURCE_GITHUB_REPO, FIRST_VERSION, FIRST_VERSION_TAG, FIRST_VERSION_RELEASE_NOTES, args, targetRepo, dryRun, evidence, actions } = runtime.pick(["fs","path","LIBRARY_ROOT","DEFAULT_ENV_FILE","DEFAULT_TEMP_ROOT","DEFAULT_NPM_CACHE","EXPECTED_GITHUB_USER","CLI_COMMAND_NAME","CLI_BIN_RELATIVE","OPEN_SOURCE_GITHUB_REPO","FIRST_VERSION","FIRST_VERSION_TAG","FIRST_VERSION_RELEASE_NOTES","args","targetRepo","dryRun","evidence","actions"]);
const main = runtime.lazy("main");
const packageRepositoryMatches = runtime.lazy("packageRepositoryMatches");
const inspectNpmPackDryRun = runtime.lazy("inspectNpmPackDryRun");
const npmPackDryRunEnv = runtime.lazy("npmPackDryRunEnv");
const parsePackFiles = runtime.lazy("parsePackFiles");
const packagePathRisks = runtime.lazy("packagePathRisks");
const copyLibraryForSmoke = runtime.lazy("copyLibraryForSmoke");
const ensureSmokeScriptsExecutable = runtime.lazy("ensureSmokeScriptsExecutable");
const removeSmokeTempDir = runtime.lazy("removeSmokeTempDir");
const loadEnvFile = runtime.lazy("loadEnvFile");
const buildGhEnv = runtime.lazy("buildGhEnv");
const run = runtime.lazy("run");
const extractFinalClassification = runtime.lazy("extractFinalClassification");
const extractFailureClassification = runtime.lazy("extractFailureClassification");
const extractEvidencePackPath = runtime.lazy("extractEvidencePackPath");
const listEvidencePackDirs = runtime.lazy("listEvidencePackDirs");
const fallbackPackageReadinessRun = runtime.lazy("fallbackPackageReadinessRun");
const fallbackReleasePreflightRun = runtime.lazy("fallbackReleasePreflightRun");
const fallbackFailureEvidenceRun = runtime.lazy("fallbackFailureEvidenceRun");
const fallbackEvidencePackRun = runtime.lazy("fallbackEvidencePackRun");
const timestampForFolder = runtime.lazy("timestampForFolder");
const extractValidationResult = runtime.lazy("extractValidationResult");
const firstNonEmptyLine = runtime.lazy("firstNonEmptyLine");
const escapeRegExp = runtime.lazy("escapeRegExp");

function runGithubOpenSourceHandoff() {
  const expectedRepo = LIBRARY_ROOT;

  if (dryRun) {
    actions.push("would verify target repo is the local skills library");
    actions.push("would require public repository hardening files, package quality scripts, CI workflow, route metadata, and local validation to pass");
    actions.push(`would verify GitHub auth as ${EXPECTED_GITHUB_USER} without printing token values`);
    actions.push(`would create or verify public repository ${OPEN_SOURCE_GITHUB_REPO} without overwriting existing unrelated content`);
    actions.push("would require exact-file commit, push main once, and verify local HEAD equals remote main");
    actions.push("would stop before npm publish, npm version, tag creation, GitHub release creation, deploy, Supabase, Cloudflare, production calls, force push, or broad staging");
    evidence.push(`GitHub open-source handoff target repo: ${targetRepo}`);
    evidence.push("dry-run verified route selection without committing, pushing, creating repos, or mutating remote services");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "CLI entrypoint package smoke complete",
      summary: "GitHub open-source handoff route would verify public repo hardening, exact-file commit/push evidence, and remote HEAD without publish/version/tag/release/deploy",
      nextPermission: "github-open-source-handoff",
      nextSkill: "github-handoff-skill / skills-library-packaging-skill",
      exitCode: 0,
    };
  }

  if (path.resolve(targetRepo) !== expectedRepo) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "GitHub open-source handoff blocked",
      summary: `GitHub open-source handoff may only run against ${expectedRepo}`,
      nextPermission: "select the local skills library repo",
      nextSkill: "coding-workflow-orchestrator-skill",
      exitCode: 1,
    };
  }

  evidence.push(`GitHub open-source handoff repo: ${targetRepo}`);
  evidence.push("boundary: no npm publish, npm version, git tag, GitHub release, deploy, Supabase, Cloudflare, secret read/print, production call, force push, broad staging, or excluded-file staging");

  const requiredFiles = [
    ".gitignore",
    "CONTRIBUTING.md",
    "SECURITY.md",
    ".github/workflows/validate.yml",
    "docs/architecture.md",
    "scripts/check-js",
    "package.json",
    "package-lock.json",
    "routes/skill-routes.json",
  ];
  const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(LIBRARY_ROOT, file)));
  evidence.push(`public hardening files: ${missing.length ? `missing ${missing.join(", ")}` : "present"}`);
  if (missing.length) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "GitHub open-source handoff blocked",
      summary: `required public handoff files missing: ${missing.join(", ")}`,
      nextPermission: "fix public repository hardening files",
      nextSkill: "skills-library-packaging-skill",
      exitCode: 1,
    };
  }

  const identity = verifyCliPackageCandidate(LIBRARY_ROOT);
  for (const item of identity.checks) {
    evidence.push(`${item.label}: ${item.ok ? "PASS" : `FAIL (${item.message})`}`);
  }
  if (!identity.ok) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "GitHub open-source handoff blocked",
      summary: `package/CLI identity checks failed: ${identity.checks.filter((item) => !item.ok).map((item) => item.label).join(", ")}`,
      nextPermission: "fix package metadata before GitHub handoff",
      nextSkill: "npm-package-readiness-skill",
      exitCode: 1,
    };
  }

  const test = run("npm", ["test"], { cwd: LIBRARY_ROOT, allowFailure: true, timeout: 120000 });
  const packageReadiness = run("./scripts/npm-package-readiness", ["--repo", ".", "--expect-package", "--expect-cli", "--allow-pack-dry-run"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
    timeout: 120000,
  });
  const releasePreflight = run("./scripts/release-preflight", ["--repo", ".", "--mode", "cli", "--allow-pack-dry-run"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
    timeout: 120000,
  });
  const routeAudit = run("./scripts/route-audit", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const validator = run("./scripts/validate-skills", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  evidence.push(`npm test exit: ${test.code}`);
  evidence.push(`npm package readiness exit: ${packageReadiness.code}; classification: ${extractFinalClassification(packageReadiness.stdout) || "unavailable"}`);
  evidence.push(`release preflight cli exit: ${releasePreflight.code}; classification: ${extractFinalClassification(releasePreflight.stdout) || "unavailable"}`);
  evidence.push(`route audit exit: ${routeAudit.code}; result: ${extractValidationResult(routeAudit.stdout) || "unavailable"}`);
  evidence.push(`validate-skills exit: ${validator.code}; result: ${extractValidationResult(validator.stdout) || "unavailable"}`);

  const envFile = loadEnvFile(DEFAULT_ENV_FILE);
  const ghToken = envFile.GH_TOKEN || process.env.GH_TOKEN || "";
  const ghEnv = ghToken ? buildGhEnv(ghToken) : process.env;
  evidence.push(`GH_TOKEN presence: ${ghToken ? "set" : "not set"}`);
  const ghUser = run("gh", ["api", "user", "--jq", ".login"], { env: ghEnv, allowFailure: true });
  const activeUser = firstNonEmptyLine(ghUser.stdout);
  evidence.push(`GitHub active user: ${activeUser || "unavailable"}`);

  const repoView = run("gh", ["repo", "view", OPEN_SOURCE_GITHUB_REPO, "--json", "nameWithOwner,visibility,url,defaultBranchRef"], {
    env: ghEnv,
    allowFailure: true,
  });
  let repoData = null;
  if (repoView.code === 0) {
    try {
      repoData = JSON.parse(repoView.stdout);
    } catch (error) {
      evidence.push(`GitHub repo view parse: failed (${error.message})`);
    }
  }
  evidence.push(`GitHub repo view: ${repoView.code === 0 && repoData ? `${repoData.nameWithOwner} ${repoData.visibility}` : "unavailable"}`);

  const status = run("git", ["status", "--short"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const branch = run("git", ["branch", "--show-current"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const remote = run("git", ["remote", "get-url", "origin"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const head = run("git", ["rev-parse", "HEAD"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const remoteHead = run("git", ["ls-remote", "origin", "refs/heads/main"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const branchName = firstNonEmptyLine(branch.stdout);
  const localHead = firstNonEmptyLine(head.stdout);
  const remoteHeadSha = firstNonEmptyLine(remoteHead.stdout).split(/\s+/)[0] || "";
  evidence.push(`git branch: ${branchName || "unavailable"}`);
  evidence.push(`git status clean: ${status.stdout.trim() ? "no" : "yes"}`);
  evidence.push(`origin URL: ${firstNonEmptyLine(remote.stdout) || "unavailable"}`);
  evidence.push(`local HEAD: ${localHead || "unavailable"}`);
  evidence.push(`remote main HEAD: ${remoteHeadSha || "unavailable"}`);

  const blockers = [];
  if ([test, packageReadiness, releasePreflight, routeAudit, validator].some((result) => result.code !== 0)) {
    blockers.push("local validation command failed");
  }
  if (ghUser.code !== 0 || activeUser !== EXPECTED_GITHUB_USER) blockers.push(`GitHub auth is not confirmed as ${EXPECTED_GITHUB_USER}`);
  if (repoView.code !== 0 || !repoData) blockers.push(`${OPEN_SOURCE_GITHUB_REPO} was not viewable`);
  if (repoData && repoData.nameWithOwner !== OPEN_SOURCE_GITHUB_REPO) blockers.push("GitHub repository identity mismatch");
  if (repoData && String(repoData.visibility || "").toUpperCase() !== "PUBLIC") blockers.push("GitHub repository is not public");
  if (branchName !== "main") blockers.push("local branch is not main");
  if (remote.code !== 0 || !/github\.com[:/]AyobamiH\/coding-workflow-library(?:\.git)?$/i.test(firstNonEmptyLine(remote.stdout))) blockers.push("origin remote does not point to AyobamiH/coding-workflow-library");
  if (status.stdout.trim()) blockers.push("working tree is not clean before route recording");
  if (head.code !== 0 || remoteHead.code !== 0 || !localHead || !remoteHeadSha || localHead !== remoteHeadSha) blockers.push("local HEAD does not match remote main");

  if (blockers.length) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "GitHub open-source handoff blocked",
      summary: blockers.join("; "),
      nextPermission: "fix GitHub handoff blockers",
      nextSkill: "github-handoff-skill / release-preflight-skill",
      githubOpenSourceHandoff: {
        repo: OPEN_SOURCE_GITHUB_REPO,
        activeUser,
        branch: branchName,
        localHead,
        remoteHead: remoteHeadSha,
        repoViewCode: repoView.code,
        status: status.stdout.trim(),
      },
      exitCode: 1,
    };
  }

  return {
    finalStatus: "GitHub open-source handoff complete",
    ledgerStatus: "GitHub open-source handoff complete",
    summary: `${OPEN_SOURCE_GITHUB_REPO} verified public; local HEAD matches remote main; package/route/skill validation passed; publish/version/tag/release/deploy remain blocked`,
    nextPermission: "run scheduled-run recheck or prepare first version/tag without publishing",
    nextSkill: "release-preflight-skill / github-handoff-skill",
    githubOpenSourceHandoff: {
      repo: OPEN_SOURCE_GITHUB_REPO,
      repoUrl: repoData.url || "",
      activeUser,
      branch: branchName,
      localHead,
      remoteHead: remoteHeadSha,
    },
    exitCode: 0,
  };
}

function runFirstVersionTag() {
  const expectedRepo = LIBRARY_ROOT;

  if (dryRun) {
    actions.push("would verify target repo is the local skills library on main with origin pointing to AyobamiH/coding-workflow-library");
    actions.push(`would prepare package.json and package-lock.json version ${FIRST_VERSION}`);
    actions.push(`would require CHANGELOG.md and ${FIRST_VERSION_RELEASE_NOTES}`);
    actions.push("would run npm ci, npm test, CLI smoke, route audit, package readiness, release preflight, npm pack dry-run, skill-cleaner, validate-skills, and clean-temp tarball smoke");
    actions.push("would exact-file commit release files, push main non-force, wait for Validate workflow success for the release commit, create annotated tag v0.1.0, push that tag, and verify remote tag dereferences to the release commit");
    actions.push("would record post-tag bookkeeping in a second exact-file commit and push main again");
    actions.push("would not run npm publish, npm version, GitHub release creation, deploy, Supabase, Cloudflare, production endpoints, force push, broad staging, or secret printing");
    evidence.push(`first-version-tag target repo: ${targetRepo}`);
    evidence.push("dry-run verified release/tag route selection without editing, committing, pushing, tagging, or mutating remote services");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "GitHub open-source handoff complete",
      summary: "first-version-tag route would prepare v0.1.0, verify CI, push an annotated tag, record post-tag evidence, and stop before npm publish or GitHub release",
      nextPermission: "first-version-tag",
      nextSkill: "release-preflight-skill / github-handoff-skill",
      exitCode: 0,
    };
  }

  if (path.resolve(targetRepo) !== expectedRepo) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "First version tag blocked",
      summary: `first-version-tag may only run against ${expectedRepo}`,
      nextPermission: "select the local skills library repo",
      nextSkill: "coding-workflow-orchestrator-skill",
      exitCode: 1,
    };
  }

  evidence.push(`first-version-tag repo: ${targetRepo}`);
  evidence.push("boundary: no npm publish, npm version, GitHub release, deploy, Supabase, Cloudflare, production endpoint, secret print, force push, history rewrite, broad staging, excluded-file staging, or extra repository creation");

  const packagePath = path.join(LIBRARY_ROOT, "package.json");
  const lockPath = path.join(LIBRARY_ROOT, "package-lock.json");
  const changelogPath = path.join(LIBRARY_ROOT, "CHANGELOG.md");
  const releaseNotesPath = path.join(LIBRARY_ROOT, FIRST_VERSION_RELEASE_NOTES);
  let pkg = null;
  let lock = null;
  const blockers = [];
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch (error) {
    blockers.push(`package.json parse failed: ${error.message}`);
  }
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (error) {
    blockers.push(`package-lock.json parse failed: ${error.message}`);
  }

  const changelog = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, "utf8") : "";
  const releaseNotes = fs.existsSync(releaseNotesPath) ? fs.readFileSync(releaseNotesPath, "utf8") : "";
  if (pkg?.version !== FIRST_VERSION) blockers.push(`package.json version is ${pkg?.version || "missing"}, expected ${FIRST_VERSION}`);
  if (lock?.version !== FIRST_VERSION) blockers.push(`package-lock.json version is ${lock?.version || "missing"}, expected ${FIRST_VERSION}`);
  if (lock?.packages?.[""]?.version !== FIRST_VERSION) blockers.push(`package-lock root package version is ${lock?.packages?.[""]?.version || "missing"}, expected ${FIRST_VERSION}`);
  if (!new RegExp(`## \\[?${escapeRegExp(FIRST_VERSION)}\\]? - 2026-06-19`).test(changelog)) blockers.push("CHANGELOG.md lacks dated v0.1.0 entry");
  if (!releaseNotes.includes(FIRST_VERSION_TAG) || !/npm unpublished/i.test(releaseNotes)) blockers.push(`${FIRST_VERSION_RELEASE_NOTES} missing required npm-unpublished release notes`);

  evidence.push(`package version: ${pkg?.version || "unavailable"}`);
  evidence.push(`lockfile version: ${lock?.version || "unavailable"}`);
  evidence.push(`release notes present: ${fs.existsSync(releaseNotesPath) ? "yes" : "no"}`);

  const branch = run("git", ["branch", "--show-current"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const status = run("git", ["status", "--short"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const remote = run("git", ["remote", "get-url", "origin"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const localHead = run("git", ["rev-parse", "HEAD"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const remoteMain = run("git", ["ls-remote", "origin", "refs/heads/main"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const tagList = run("git", ["tag", "--list", FIRST_VERSION_TAG], { cwd: LIBRARY_ROOT, allowFailure: true });
  const tagCommit = run("git", ["rev-list", "-n", "1", FIRST_VERSION_TAG], { cwd: LIBRARY_ROOT, allowFailure: true });
  const remoteTagObject = run("git", ["ls-remote", "origin", `refs/tags/${FIRST_VERSION_TAG}`], { cwd: LIBRARY_ROOT, allowFailure: true });
  const remoteTagCommit = run("git", ["ls-remote", "origin", `refs/tags/${FIRST_VERSION_TAG}^{}`], { cwd: LIBRARY_ROOT, allowFailure: true });

  const branchName = firstNonEmptyLine(branch.stdout);
  const localHeadSha = firstNonEmptyLine(localHead.stdout);
  const remoteMainSha = firstNonEmptyLine(remoteMain.stdout).split(/\s+/)[0] || "";
  const localTagCommitSha = firstNonEmptyLine(tagCommit.stdout);
  const remoteTagObjectSha = firstNonEmptyLine(remoteTagObject.stdout).split(/\s+/)[0] || "";
  const remoteTagCommitSha = firstNonEmptyLine(remoteTagCommit.stdout).split(/\s+/)[0] || remoteTagObjectSha;
  evidence.push(`git branch: ${branchName || "unavailable"}`);
  evidence.push(`git status clean: ${status.stdout.trim() ? "no" : "yes"}`);
  evidence.push(`origin URL: ${firstNonEmptyLine(remote.stdout) || "unavailable"}`);
  evidence.push(`local HEAD: ${localHeadSha || "unavailable"}`);
  evidence.push(`remote main HEAD: ${remoteMainSha || "unavailable"}`);
  evidence.push(`${FIRST_VERSION_TAG} local tag commit: ${localTagCommitSha || "unavailable"}`);
  evidence.push(`${FIRST_VERSION_TAG} remote tag object: ${remoteTagObjectSha || "unavailable"}`);
  evidence.push(`${FIRST_VERSION_TAG} remote tag commit: ${remoteTagCommitSha || "unavailable"}`);

  if (branchName !== "main") blockers.push("local branch is not main");
  if (status.stdout.trim()) blockers.push("working tree is not clean");
  if (!/github\.com[:/]AyobamiH\/coding-workflow-library(?:\.git)?$/i.test(firstNonEmptyLine(remote.stdout))) blockers.push("origin remote does not point to AyobamiH/coding-workflow-library");
  if (!localHeadSha || !remoteMainSha || localHeadSha !== remoteMainSha) blockers.push("local HEAD does not match remote main");
  if (!tagList.stdout.trim()) blockers.push(`${FIRST_VERSION_TAG} tag is missing`);
  if (!localTagCommitSha) blockers.push(`${FIRST_VERSION_TAG} local tag target is unavailable`);
  if (!remoteTagCommitSha) blockers.push(`${FIRST_VERSION_TAG} remote tag target is unavailable`);
  if (localTagCommitSha && remoteTagCommitSha && localTagCommitSha !== remoteTagCommitSha) blockers.push(`${FIRST_VERSION_TAG} local and remote tag targets differ`);

  const envFile = loadEnvFile(DEFAULT_ENV_FILE);
  const ghToken = envFile.GH_TOKEN || process.env.GH_TOKEN || "";
  const ghEnv = ghToken ? buildGhEnv(ghToken) : process.env;
  const ghUser = run("gh", ["api", "user", "--jq", ".login"], { env: ghEnv, allowFailure: true });
  const activeUser = firstNonEmptyLine(ghUser.stdout);
  evidence.push(`GitHub active user: ${activeUser || "unavailable"}`);
  if (ghUser.code !== 0 || activeUser !== EXPECTED_GITHUB_USER) blockers.push(`GitHub auth is not confirmed as ${EXPECTED_GITHUB_USER}`);

  const repoView = run("gh", ["repo", "view", OPEN_SOURCE_GITHUB_REPO, "--json", "nameWithOwner,visibility,url,defaultBranchRef"], {
    env: ghEnv,
    allowFailure: true,
  });
  let repoData = null;
  try {
    repoData = repoView.code === 0 ? JSON.parse(repoView.stdout) : null;
  } catch (error) {
    blockers.push(`GitHub repo view parse failed: ${error.message}`);
  }
  evidence.push(`GitHub repo view: ${repoData ? `${repoData.nameWithOwner} ${repoData.visibility}` : "unavailable"}`);
  if (!repoData || repoData.nameWithOwner !== OPEN_SOURCE_GITHUB_REPO) blockers.push(`${OPEN_SOURCE_GITHUB_REPO} was not viewable`);
  if (repoData && String(repoData.visibility || "").toUpperCase() !== "PUBLIC") blockers.push(`${OPEN_SOURCE_GITHUB_REPO} is not public`);

  const ciSha = localTagCommitSha || "";
  const ciRun = ciSha
    ? run("gh", ["run", "list", "--repo", OPEN_SOURCE_GITHUB_REPO, "--workflow", "validate.yml", "--branch", "main", "--commit", ciSha, "--limit", "5", "--json", "databaseId,headSha,status,conclusion,displayTitle,url"], {
        env: ghEnv,
        allowFailure: true,
      })
    : { code: 1, stdout: "", stderr: "" };
  let ciRuns = [];
  try {
    ciRuns = ciRun.code === 0 ? JSON.parse(ciRun.stdout) : [];
  } catch (error) {
    blockers.push(`CI run list parse failed: ${error.message}`);
  }
  const successfulRun = ciRuns.find((runItem) => runItem.headSha === ciSha && runItem.status === "completed" && runItem.conclusion === "success");
  const pendingRun = ciRuns.find((runItem) => runItem.headSha === ciSha && runItem.status !== "completed");
  evidence.push(`CI runs for tag commit: ${ciRuns.length}; successful run: ${successfulRun ? successfulRun.databaseId : "none"}; pending run: ${pendingRun ? pendingRun.databaseId : "none"}`);
  if (!successfulRun) blockers.push(pendingRun ? "CI is pending for the release commit" : "CI success was not found for the release commit");

  const test = run("npm", ["test"], { cwd: LIBRARY_ROOT, allowFailure: true, timeout: 120000 });
  const routeAudit = run("./scripts/route-audit", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const validator = run("./scripts/validate-skills", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  evidence.push(`npm test exit: ${test.code}`);
  evidence.push(`route audit exit: ${routeAudit.code}; result: ${extractValidationResult(routeAudit.stdout) || "unavailable"}`);
  evidence.push(`validate-skills exit: ${validator.code}; result: ${extractValidationResult(validator.stdout) || "unavailable"}`);
  if ([test, routeAudit, validator].some((result) => result.code !== 0)) blockers.push("final local validation failed");

  if (blockers.length) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "First version tag blocked",
      summary: blockers.join("; "),
      nextPermission: "fix first-version tag blockers",
      nextSkill: "release-preflight-skill / github-handoff-skill",
      firstVersionTag: {
        version: FIRST_VERSION,
        tag: FIRST_VERSION_TAG,
        localHead: localHeadSha,
        remoteMain: remoteMainSha,
        tagCommit: localTagCommitSha,
        remoteTagCommit: remoteTagCommitSha,
        ciRuns,
      },
      exitCode: 1,
    };
  }

  return {
    finalStatus: "v0.1.0 tagged and pushed, npm unpublished",
    ledgerStatus: "v0.1.0 tagged and pushed, npm unpublished",
    summary: `${FIRST_VERSION_TAG} verified; remote tag resolves to ${localTagCommitSha}; remote main is ${localHeadSha}; CI passed for release commit; npm publish and GitHub release remain blocked`,
    nextPermission: "prepare GitHub release or npm publication gate, or run scheduled-run recheck",
    nextSkill: "release-preflight-skill / github-handoff-skill",
    firstVersionTag: {
      version: FIRST_VERSION,
      tag: FIRST_VERSION_TAG,
      localHead: localHeadSha,
      remoteMain: remoteMainSha,
      tagCommit: localTagCommitSha,
      remoteTagCommit: remoteTagCommitSha,
      ciRun: successfulRun,
    },
    exitCode: 0,
  };
}

function verifyCliPackageCandidate(repo) {
  const packagePath = path.join(repo, "package.json");
  const cliPath = path.join(repo, CLI_BIN_RELATIVE);
  const checks = [];
  let pkg = null;
  let parseError = "";
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch (error) {
    parseError = error.message;
  }

  function add(label, ok, message) {
    checks.push({ label, ok: Boolean(ok), message });
  }

  const binTarget = pkg?.bin && typeof pkg.bin === "object" ? pkg.bin[CLI_COMMAND_NAME] : null;
  const files = Array.isArray(pkg?.files) ? pkg.files : [];

  add("package.json exists", fs.existsSync(packagePath), "package.json missing");
  add("package.json parses", Boolean(pkg), parseError || "package JSON unavailable");
  add("package name", pkg?.name === "autonomous-coding-workflow-library", `expected autonomous-coding-workflow-library, got ${pkg?.name || "missing"}`);
  add("package version", pkg?.version === "0.0.0", `expected 0.0.0, got ${pkg?.version || "missing"}`);
  add("package license", pkg?.license === "MIT", `expected MIT, got ${pkg?.license || "missing"}`);
  add("repository owner/name", packageRepositoryMatches(pkg), "repository must point to AyobamiH/coding-workflow-library");
  add("CLI bin mapping", binTarget === CLI_BIN_RELATIVE, `expected ${CLI_COMMAND_NAME} -> ${CLI_BIN_RELATIVE}`);
  add("CLI bin file exists", fs.existsSync(cliPath), `${CLI_BIN_RELATIVE} missing`);
  add("CLI bin executable", fs.existsSync(cliPath) && Boolean(fs.statSync(cliPath).mode & 0o111), `${CLI_BIN_RELATIVE} is not executable`);
  add("package files allowlist includes bin", files.includes("bin/") || files.includes(CLI_BIN_RELATIVE), "package files allowlist must include bin/");
  add("description says autonomous workflow", /autonomous/i.test(pkg?.description || "") && /workflow/i.test(pkg?.description || ""), "description should describe the autonomous coding workflow library");

  return {
    ok: checks.every((item) => item.ok),
    checks,
    package: pkg
      ? {
          name: pkg.name || null,
          version: pkg.version || null,
          license: pkg.license || null,
          repository: pkg.repository || null,
          bin: pkg.bin || null,
          filesCount: files.length,
        }
      : null,
  };
}

function runCliTempInstallSmoke() {
  const tempParent = DEFAULT_TEMP_ROOT;
  const tempPath = path.join(tempParent, `coding-workflow-cli-smoke-${timestampForFolder()}`);
  const packDir = path.join(tempPath, "pack");
  const consumerDir = path.join(tempPath, "consumer");
  fs.mkdirSync(packDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(consumerDir, { recursive: true, mode: 0o700 });

  let removed = false;
  const report = {
    ok: false,
    tempPath,
    tarballCreated: false,
    tarballPath: "",
    files: [],
    risks: [],
    packCode: 1,
    installCode: 1,
    helpCode: 1,
    routesCode: 1,
    validateCode: 1,
    removed: false,
    summary: "clean temp CLI smoke did not finish",
  };

  try {
    const pack = run("npm", ["pack", "--json", "--pack-destination", packDir, "--cache", DEFAULT_NPM_CACHE], {
      cwd: LIBRARY_ROOT,
      env: npmPackDryRunEnv(),
      allowFailure: true,
      timeout: 120000,
    });
    report.packCode = pack.code;
    report.files = parsePackFiles(pack.stdout);
    report.risks = packagePathRisks(report.files);
    const tarballPath = resolvePackedTarballPath(pack.stdout, packDir);
    report.tarballPath = tarballPath || "";
    report.tarballCreated = Boolean(tarballPath && fs.existsSync(tarballPath));

    if (pack.code !== 0 || report.risks.length || !report.tarballCreated) {
      report.summary = pack.code !== 0
        ? "npm pack failed in temp smoke"
        : report.risks.length
          ? "package contents risk found in temp tarball"
          : "npm pack did not produce a local tarball";
      return report;
    }

    const install = run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", DEFAULT_NPM_CACHE, tarballPath], {
      cwd: consumerDir,
      env: npmPackDryRunEnv(),
      allowFailure: true,
      timeout: 120000,
    });
    report.installCode = install.code;
    if (install.code !== 0) {
      report.summary = "local tarball npm install failed";
      return report;
    }

    const help = run("./node_modules/.bin/coding-workflow", ["--help"], { cwd: consumerDir, allowFailure: true });
    const routes = run("./node_modules/.bin/coding-workflow", ["routes"], { cwd: consumerDir, allowFailure: true });
    const validate = run("./node_modules/.bin/coding-workflow", ["validate"], { cwd: consumerDir, allowFailure: true });
    report.helpCode = help.code;
    report.routesCode = routes.code;
    report.validateCode = validate.code;
    report.ok = [help, routes, validate].every((result) => result.code === 0);
    report.summary = report.ok ? "clean-temp installed CLI help/routes/validate passed" : "installed CLI command failed in clean temp consumer";
    return report;
  } finally {
    removed = removeCliSmokeTempDir(tempPath);
    report.removed = removed;
  }
}

function resolvePackedTarballPath(stdout, packDir) {
  const text = String(stdout || "").trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    const explicitPath = entry?.path || "";
    if (explicitPath && fs.existsSync(explicitPath)) return explicitPath;
    const filename = entry?.filename || "";
    if (filename) return path.join(packDir, filename);
  } catch {
    const line = text.split(/\r?\n/).find((item) => /\.tgz$/.test(item.trim()));
    if (line) return path.resolve(packDir, line.trim());
  }
  const candidates = fs.existsSync(packDir)
    ? fs.readdirSync(packDir).filter((file) => file.endsWith(".tgz")).sort()
    : [];
  return candidates.length ? path.join(packDir, candidates[0]) : "";
}

function removeCliSmokeTempDir(tempPath) {
  const safePrefix = path.join(DEFAULT_TEMP_ROOT, "coding-workflow-cli-smoke-");
  if (!String(tempPath).startsWith(safePrefix)) {
    throw new Error(`refusing to remove unexpected temp path: ${tempPath}`);
  }
  fs.rmSync(tempPath, { recursive: true, force: true });
  return !fs.existsSync(tempPath);
}

function verifyPackageCandidateIdentity(repo) {
  const packagePath = path.join(repo, "package.json");
  const checks = [];
  let pkg = null;
  let parseError = "";
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch (error) {
    parseError = error.message;
  }

  function add(label, ok, message) {
    checks.push({ label, ok: Boolean(ok), message });
  }

  add("package.json exists", fs.existsSync(packagePath), "package.json missing");
  add("package.json parses", Boolean(pkg), parseError || "package JSON unavailable");
  add("package name", pkg?.name === "autonomous-coding-workflow-library", `expected autonomous-coding-workflow-library, got ${pkg?.name || "missing"}`);
  add("package version", pkg?.version === "0.0.0", `expected 0.0.0, got ${pkg?.version || "missing"}`);
  add("package license", pkg?.license === "MIT", `expected MIT, got ${pkg?.license || "missing"}`);
  add("package is publishable candidate", pkg?.private === false, "private must be false only for this approved local candidate");
  add("repository owner/name", packageRepositoryMatches(pkg), "repository must point to AyobamiH/coding-workflow-library");
  add("files allowlist", Array.isArray(pkg?.files) && pkg.files.length > 0, "package files allowlist missing");
  add("no CLI bin", !pkg?.bin, "CLI bin must not be declared before CLI entrypoint approval");
  add("description says autonomous workflow", /autonomous/i.test(pkg?.description || "") && /workflow/i.test(pkg?.description || ""), "description should describe the autonomous coding workflow library");

  return {
    ok: checks.every((item) => item.ok),
    checks,
    package: pkg
      ? {
          name: pkg.name || null,
          version: pkg.version || null,
          license: pkg.license || null,
          private: pkg.private,
          repository: pkg.repository || null,
          hasBin: Boolean(pkg.bin),
          filesCount: Array.isArray(pkg.files) ? pkg.files.length : 0,
        }
      : null,
  };
}

module.exports = {
  runGithubOpenSourceHandoff,
  runFirstVersionTag,
  verifyCliPackageCandidate,
  runCliTempInstallSmoke,
  resolvePackedTarballPath,
  removeCliSmokeTempDir,
  verifyPackageCandidateIdentity,
};
