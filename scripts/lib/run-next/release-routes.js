"use strict";

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

function packageRepositoryMatches(pkg) {
  const repository = pkg?.repository;
  const value = typeof repository === "string" ? repository : repository?.url || "";
  return /github\.com[/:]AyobamiH\/coding-workflow-library(?:\.git)?/i.test(value) ||
    /github:AyobamiH\/coding-workflow-library/i.test(value);
}

function inspectNpmPackDryRun(repo) {
  const result = run("npm", ["pack", "--dry-run", "--json"], {
    cwd: repo,
    env: npmPackDryRunEnv(),
    allowFailure: true,
  });
  const files = parsePackFiles(result.stdout);
  const risks = packagePathRisks(files);
  return { result, files, risks };
}

function runSemverReleasePrep(active) {
  const expectedRepo = LIBRARY_ROOT;
  const version = releaseVersionFromObjective(active.rawLane?.objective?.id);
  const tag = version ? `v${version}` : "";
  const releaseNotesRelative = version ? `docs/releases/${tag}.md` : "";
  const releaseNotesPath = path.join(LIBRARY_ROOT, releaseNotesRelative);

  if (dryRun) {
    actions.push(`would verify the selected lane objective release-coding-workflow-library-${tag || "vX.Y.Z"}`);
    actions.push(`would verify package.json and package-lock.json version ${version || "X.Y.Z"}`);
    actions.push(`would require CHANGELOG.md and ${releaseNotesRelative || "docs/releases/vX.Y.Z.md"}`);
    actions.push("would run local validation, package readiness, release preflight, npm pack dry-run, and clean package smoke when invoked outside dry-run");
    actions.push("would require npm and GitHub authentication as capabilities, while keeping credentials out of reports");
    actions.push("after a clean exact-file release commit, the granted remote_publication authority covers non-force main push, exact-SHA CI, one annotated tag, npm publish, and one GitHub Release");
    actions.push("would classify deploy as NOT_APPLICABLE when the package defines no deployment target");
    evidence.push("dry-run made no lane, repo, package, git, npm, or remote changes");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: active.currentStatus,
      summary: `${tag || "semver release"} objective would validate the package and execute the already-authorized publication sequence only after all gates pass`,
      nextPermission: "none; remote_publication is inherited from the selected lane objective",
      nextSkill: "release-preflight-skill / github-handoff-skill",
      exitCode: 0,
    };
  }

  if (path.resolve(targetRepo) !== expectedRepo) {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: `${tag || "Release"} preparation blocked`,
      summary: `semver release preparation may only run against ${expectedRepo}`,
      nextPermission: "select the coding-workflow-library lane and repo",
      nextSkill: "coding-workflow-orchestrator-skill",
      exitCode: 1,
    };
  }

  const blockers = [];
  const packagePath = path.join(LIBRARY_ROOT, "package.json");
  const lockPath = path.join(LIBRARY_ROOT, "package-lock.json");
  const changelogPath = path.join(LIBRARY_ROOT, "CHANGELOG.md");
  let pkg = null;
  let lock = null;
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

  if (!version) blockers.push("release objective id does not contain a valid semver version");
  if (pkg?.version !== version) blockers.push(`package.json version is ${pkg?.version || "missing"}, expected ${version || "objective semver"}`);
  if (lock?.version !== version) blockers.push(`package-lock.json version is ${lock?.version || "missing"}, expected ${version || "objective semver"}`);
  if (lock?.packages?.[""]?.version !== version) blockers.push(`package-lock root package version is ${lock?.packages?.[""]?.version || "missing"}, expected ${version || "objective semver"}`);
  if (version && !new RegExp(`## \\[?${escapeRegExp(version)}\\]? - \\d{4}-\\d{2}-\\d{2}`).test(changelog)) blockers.push(`CHANGELOG.md lacks a dated ${version} entry`);
  if (!releaseNotes.includes(tag) || !/npm/i.test(releaseNotes) || !/github/i.test(releaseNotes)) blockers.push(`${releaseNotesRelative} lacks tag, npm, or GitHub release status`);

  evidence.push(`package version: ${pkg?.version || "unavailable"}`);
  evidence.push(`lockfile version: ${lock?.version || "unavailable"}`);
  evidence.push(`release notes present: ${fs.existsSync(releaseNotesPath) ? "yes" : "no"}`);

  const commands = [
    ["npm test", "npm", ["test"]],
    ["route audit", "./scripts/route-audit", []],
    ["skill validation", "./scripts/validate-skills", []],
    ["package readiness", "./scripts/npm-package-readiness", ["--repo", ".", "--expect-package", "--expect-cli", "--allow-pack-dry-run"]],
    ["release preflight", "./scripts/release-preflight", ["--repo", ".", "--mode", "cli", "--allow-pack-dry-run"]],
    ["npm pack dry-run", "npm", ["pack", "--dry-run", "--json", "--cache", DEFAULT_NPM_CACHE]],
  ];

  for (const [label, command, commandArgs] of commands) {
    const result = run(command, commandArgs, { cwd: LIBRARY_ROOT, env: npmPackDryRunEnv(), allowFailure: true });
    evidence.push(`${label} exit: ${result.code}`);
    if (result.code !== 0) blockers.push(`${label} failed`);
  }

  const npmAuth = run("npm", ["whoami", "--cache", DEFAULT_NPM_CACHE], {
    cwd: LIBRARY_ROOT,
    env: npmPackDryRunEnv(),
    allowFailure: true,
  });
  const npmAuthAvailable = npmAuth.code === 0;
  evidence.push(`npm authentication: ${npmAuthAvailable ? "available" : "BLOCKED_CAPABILITY"}`);
  const ghAuth = run("gh", ["api", "user", "--jq", ".login"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const ghAuthAvailable = ghAuth.code === 0 && firstNonEmptyLine(ghAuth.stdout) === EXPECTED_GITHUB_USER;
  evidence.push(`GitHub authentication: ${ghAuthAvailable ? `available as ${EXPECTED_GITHUB_USER}` : "BLOCKED_CAPABILITY"}`);
  const deployScript = Boolean(pkg?.scripts?.deploy);
  evidence.push(`deployment target: ${deployScript ? "package deploy script declared" : "NOT_APPLICABLE (no deployment target declared)"}`);

  if (blockers.length) {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: `${tag || "Release"} preparation blocked`,
      summary: blockers.join("; "),
      nextPermission: "fix failed local safety gate",
      nextSkill: "release-preflight-skill / error-evidence-skill",
      exitCode: 1,
    };
  }

  const capabilityBlockers = [];
  if (!npmAuthAvailable) capabilityBlockers.push("npm authentication unavailable");
  if (!ghAuthAvailable) capabilityBlockers.push(`GitHub authentication unavailable as ${EXPECTED_GITHUB_USER}`);
  if (capabilityBlockers.length) {
    return {
      finalStatus: "BLOCKED_CAPABILITY",
      ledgerStatus: `${tag} publication blocked by external authentication capability`,
      summary: capabilityBlockers.join("; "),
      nextPermission: "authenticate the unavailable external service, then resume the same objective",
      nextSkill: "github-auth-gate-skill / release-preflight-skill",
      capabilityBlockers,
      exitCode: 1,
    };
  }

  const publication = runSemverPublication({
    version,
    tag,
    packageName: pkg.name,
    releaseNotesPath,
  });
  if (!publication.ok) {
    return {
      finalStatus: publication.state,
      ledgerStatus: `${tag} publication blocked`,
      summary: publication.summary,
      nextPermission: publication.next || "resume the same objective after the blocking condition is resolved",
      nextSkill: "github-handoff-skill / release-preflight-skill / error-evidence-skill",
      capabilityBlockers: publication.state === "BLOCKED_CAPABILITY" ? [publication.summary] : [],
      waitingConditions: publication.state === "WAITING_CONDITION" ? [publication.summary] : [],
      publication,
      exitCode: 1,
    };
  }

  return {
    finalStatus: `${tag} published to npm and GitHub`,
    ledgerStatus: `${tag} published to npm and GitHub`,
    summary: `${tag} was pushed from the exact release commit, exact-SHA CI passed, the annotated tag resolves to that commit, npm publication is verified, and the GitHub Release is public; deploy is NOT_APPLICABLE`,
    nextPermission: "run scheduled maintenance or select the next evidence-backed objective",
    nextSkill: "github-handoff-skill / release-preflight-skill",
    capabilityBlockers: [],
    objectiveStatus: "complete",
    publication,
    exitCode: 0,
  };
}

function runSemverPublication({ version, tag, packageName, releaseNotesPath }) {
  const failure = (state, summary, next = "resume the same objective after resolving the blocker") => ({
    ok: false,
    state,
    summary,
    next,
    version,
    tag,
  });
  const ghEnvFile = loadEnvFile(DEFAULT_ENV_FILE);
  const ghToken = ghEnvFile.GH_TOKEN || process.env.GH_TOKEN || "";
  const ghEnv = ghToken ? buildGhEnv(ghToken) : process.env;

  const branch = run("git", ["branch", "--show-current"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const status = run("git", ["status", "--short"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const origin = run("git", ["remote", "get-url", "origin"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const branchName = firstNonEmptyLine(branch.stdout);
  const originUrl = firstNonEmptyLine(origin.stdout);
  if (branch.code !== 0 || branchName !== "main") return failure("BLOCKED_SAFETY", "release publication requires local branch main");
  if (status.code !== 0 || status.stdout.trim()) return failure("BLOCKED_SAFETY", "release publication requires a clean working tree");
  if (!/github\.com[:/]AyobamiH\/coding-workflow-library(?:\.git)?$/i.test(originUrl)) {
    return failure("BLOCKED_SAFETY", "origin does not point to AyobamiH/coding-workflow-library");
  }

  const fetch = run("git", ["fetch", "origin", "main", "--tags", "--prune"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
    timeout: 120000,
  });
  if (fetch.code !== 0) return failure("BLOCKED_CAPABILITY", "unable to fetch origin/main and tags");

  const localHeadRun = run("git", ["rev-parse", "HEAD"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const remoteHeadRun = run("git", ["rev-parse", "origin/main"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const localHead = firstNonEmptyLine(localHeadRun.stdout);
  let remoteHead = firstNonEmptyLine(remoteHeadRun.stdout);
  if (!localHead || !remoteHead) return failure("BLOCKED_SAFETY", "local or remote main commit could not be resolved");

  if (localHead !== remoteHead) {
    const fastForward = run("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"], {
      cwd: LIBRARY_ROOT,
      allowFailure: true,
    });
    if (fastForward.code !== 0) return failure("BLOCKED_SAFETY", "origin/main is not an ancestor of the exact local release commit; force push is forbidden");
    const push = run("git", ["push", "origin", "main"], { cwd: LIBRARY_ROOT, allowFailure: true, timeout: 180000 });
    if (push.code !== 0) return failure("BLOCKED_CAPABILITY", "non-force main push failed");
  }

  const remoteVerify = run("git", ["ls-remote", "origin", "refs/heads/main"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
    timeout: 120000,
  });
  remoteHead = firstNonEmptyLine(remoteVerify.stdout).split(/\s+/)[0] || "";
  if (remoteVerify.code !== 0 || remoteHead !== localHead) return failure("BLOCKED_SAFETY", "remote main does not match the exact release commit after push");
  evidence.push(`local main commit: ${localHead}`);
  evidence.push(`remote main verification: ${remoteHead}`);

  const releaseTarget = resolveSemverReleaseTarget(tag, version, localHead);
  if (!releaseTarget.ok) return failure(releaseTarget.state, releaseTarget.summary);
  const releaseCommit = releaseTarget.commit;

  const ci = waitForExactValidateWorkflow(releaseCommit, ghEnv);
  if (!ci.ok) return failure(ci.state, ci.summary, ci.next);
  evidence.push(`release exact-commit CI: success (run ${ci.run.databaseId})`);

  let mainCi = ci;
  if (localHead !== releaseCommit) {
    mainCi = waitForExactValidateWorkflow(localHead, ghEnv);
    if (!mainCi.ok) return failure(mainCi.state, mainCi.summary, mainCi.next);
    evidence.push(`post-release main exact-commit CI: success (run ${mainCi.run.databaseId})`);
  }

  const tagResult = ensureAnnotatedReleaseTag(tag, releaseCommit);
  if (!tagResult.ok) return failure(tagResult.state, tagResult.summary);
  evidence.push(`${tag} remote tag commit: ${tagResult.commit}`);

  const npmResult = ensureNpmPublication(packageName, version, releaseCommit);
  if (!npmResult.ok) return failure(npmResult.state, npmResult.summary, npmResult.next);
  evidence.push(`npm publication: ${packageName}@${version} verified${npmResult.created ? " after publish" : " (already present)"}`);

  const releaseResult = ensureGithubRelease(tag, releaseNotesPath, ghEnv);
  if (!releaseResult.ok) return failure(releaseResult.state, releaseResult.summary);
  evidence.push(`GitHub Release: ${releaseResult.url}`);
  evidence.push("deployment: NOT_APPLICABLE (package.json declares no deploy target)");

  return {
    ok: true,
    state: "COMPLETE",
    version,
    tag,
    releaseCommit,
    remoteMain: remoteHead,
    ciRun: ci.run,
    mainCiRun: mainCi.run,
    tagCommit: tagResult.commit,
    npm: npmResult.metadata,
    githubRelease: releaseResult,
    deployment: "NOT_APPLICABLE",
  };
}

function resolveSemverReleaseTarget(tag, version, localHead) {
  const local = run("git", ["rev-list", "-n", "1", tag], { cwd: LIBRARY_ROOT, allowFailure: true });
  const remoteObject = run("git", ["ls-remote", "origin", `refs/tags/${tag}`], { cwd: LIBRARY_ROOT, allowFailure: true });
  const remotePeeled = run("git", ["ls-remote", "origin", `refs/tags/${tag}^{}`], { cwd: LIBRARY_ROOT, allowFailure: true });
  const localCommit = firstNonEmptyLine(local.stdout);
  const remoteObjectCommit = firstNonEmptyLine(remoteObject.stdout).split(/\s+/)[0] || "";
  const remoteCommit = firstNonEmptyLine(remotePeeled.stdout).split(/\s+/)[0] || "";

  if (remoteObjectCommit && !remoteCommit) {
    return { ok: false, state: "BLOCKED_SAFETY", summary: `${tag} exists remotely but is not an annotated tag` };
  }
  if (localCommit && remoteCommit && localCommit !== remoteCommit) {
    return { ok: false, state: "BLOCKED_SAFETY", summary: `${tag} local and remote targets differ` };
  }
  const commit = remoteCommit || localCommit || localHead;
  if (localCommit && !remoteCommit && localCommit !== localHead) {
    return { ok: false, state: "BLOCKED_SAFETY", summary: `${tag} exists only locally at a commit other than current HEAD` };
  }
  if (commit !== localHead) {
    const ancestor = run("git", ["merge-base", "--is-ancestor", commit, localHead], { cwd: LIBRARY_ROOT, allowFailure: true });
    if (ancestor.code !== 0) return { ok: false, state: "BLOCKED_SAFETY", summary: `${tag} release commit is not an ancestor of current main` };
    const taggedPackage = run("git", ["show", `${commit}:package.json`], { cwd: LIBRARY_ROOT, allowFailure: true });
    let taggedVersion = "";
    try { taggedVersion = JSON.parse(taggedPackage.stdout).version || ""; } catch { taggedVersion = ""; }
    if (taggedPackage.code !== 0 || taggedVersion !== version) {
      return { ok: false, state: "BLOCKED_SAFETY", summary: `${tag} does not contain package version ${version}` };
    }
  }
  return { ok: true, commit };
}

function waitForExactValidateWorkflow(commit, ghEnv) {
  const listRuns = () => {
    const result = run("gh", [
      "run", "list",
      "--repo", OPEN_SOURCE_GITHUB_REPO,
      "--workflow", "validate.yml",
      "--branch", "main",
      "--commit", commit,
      "--limit", "5",
      "--json", "databaseId,headSha,status,conclusion,url",
    ], { env: ghEnv, allowFailure: true, timeout: 120000 });
    if (result.code !== 0) return { result, runs: [] };
    try {
      return { result, runs: JSON.parse(result.stdout) };
    } catch {
      return { result: { ...result, code: 1 }, runs: [] };
    }
  };

  let listed = null;
  let exact = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    listed = listRuns();
    if (listed.result.code !== 0) {
      return { ok: false, state: "BLOCKED_CAPABILITY", summary: "GitHub Actions run listing failed", next: "restore read-only GitHub Actions access and resume" };
    }
    exact = listed.runs.find((item) => item.headSha === commit) || null;
    if (exact) break;
    spawnSync("sleep", ["5"], { encoding: "utf8" });
  }
  if (!exact) {
    return { ok: false, state: "WAITING_CONDITION", summary: `no Validate workflow run appeared for exact commit ${commit}`, next: "wait for the exact-commit workflow to start, then resume" };
  }

  if (exact.status !== "completed") {
    run("gh", ["run", "watch", String(exact.databaseId), "--repo", OPEN_SOURCE_GITHUB_REPO, "--exit-status"], {
      env: ghEnv,
      allowFailure: true,
      timeout: 900000,
    });
    listed = listRuns();
    exact = listed.runs.find((item) => item.headSha === commit) || exact;
  }
  if (exact.status !== "completed") {
    return { ok: false, state: "WAITING_CONDITION", summary: `Validate workflow ${exact.databaseId} is still ${exact.status}`, next: "wait for exact-commit CI completion, then resume" };
  }
  if (exact.conclusion !== "success") {
    return { ok: false, state: "BLOCKED_SAFETY", summary: `Validate workflow ${exact.databaseId} concluded ${exact.conclusion}; release artifacts were not created`, next: "inspect safe CI failure logs and fix only the release defect" };
  }
  return { ok: true, run: exact };
}

function ensureAnnotatedReleaseTag(tag, commit) {
  const local = run("git", ["rev-list", "-n", "1", tag], { cwd: LIBRARY_ROOT, allowFailure: true });
  let localCommit = firstNonEmptyLine(local.stdout);
  const remoteObject = run("git", ["ls-remote", "origin", `refs/tags/${tag}`], { cwd: LIBRARY_ROOT, allowFailure: true });
  const remotePeeled = run("git", ["ls-remote", "origin", `refs/tags/${tag}^{}`], { cwd: LIBRARY_ROOT, allowFailure: true });
  const remoteObjectCommit = firstNonEmptyLine(remoteObject.stdout).split(/\s+/)[0] || "";
  let remoteCommit = firstNonEmptyLine(remotePeeled.stdout).split(/\s+/)[0] || "";

  if (localCommit && localCommit !== commit) return { ok: false, state: "BLOCKED_SAFETY", summary: `${tag} already exists locally at an unexpected commit` };
  if (remoteObjectCommit && (!remoteCommit || remoteCommit !== commit)) {
    return { ok: false, state: "BLOCKED_SAFETY", summary: `${tag} already exists remotely but is not an annotated tag for the exact release commit` };
  }

  if (!localCommit && !remoteObjectCommit) {
    const create = run("git", ["tag", "-a", tag, "-m", tag], { cwd: LIBRARY_ROOT, allowFailure: true });
    if (create.code !== 0) return { ok: false, state: "BLOCKED_SAFETY", summary: `failed to create annotated tag ${tag}` };
    localCommit = commit;
  }

  if (localCommit) {
    const tagType = run("git", ["cat-file", "-t", tag], { cwd: LIBRARY_ROOT, allowFailure: true });
    if (firstNonEmptyLine(tagType.stdout) !== "tag") return { ok: false, state: "BLOCKED_SAFETY", summary: `${tag} is not an annotated tag` };
  }

  if (!remoteObjectCommit) {
    const push = run("git", ["push", "origin", tag], { cwd: LIBRARY_ROOT, allowFailure: true, timeout: 180000 });
    if (push.code !== 0) return { ok: false, state: "BLOCKED_CAPABILITY", summary: `failed to push ${tag}` };
  }

  const verify = run("git", ["ls-remote", "origin", `refs/tags/${tag}^{}`], { cwd: LIBRARY_ROOT, allowFailure: true });
  remoteCommit = firstNonEmptyLine(verify.stdout).split(/\s+/)[0] || "";
  if (verify.code !== 0 || remoteCommit !== commit) return { ok: false, state: "BLOCKED_SAFETY", summary: `${tag} remote dereference does not match the exact release commit` };
  return { ok: true, commit: remoteCommit };
}

function ensureNpmPublication(packageName, version, commit) {
  const spec = `${packageName}@${version}`;
  const view = () => run("npm", ["view", spec, "name", "version", "gitHead", "--json", "--cache", DEFAULT_NPM_CACHE], {
    cwd: LIBRARY_ROOT,
    env: npmPackDryRunEnv(),
    allowFailure: true,
    timeout: 120000,
  });
  const parse = (result) => {
    if (result.code !== 0) return null;
    try { return JSON.parse(result.stdout); } catch { return null; }
  };

  let result = view();
  let metadata = parse(result);
  let created = false;
  if (result.code !== 0) {
    const missing = /E404|404 Not Found|is not in this registry/i.test(`${result.stdout}\n${result.stderr}`);
    if (!missing) return { ok: false, state: "BLOCKED_CAPABILITY", summary: `npm could not determine whether ${spec} exists`, next: "restore npm registry access and resume" };
    const publish = run("npm", ["publish", "--access", "public", "--cache", DEFAULT_NPM_CACHE], {
      cwd: LIBRARY_ROOT,
      env: npmPackDryRunEnv(),
      allowFailure: true,
      timeout: 600000,
    });
    if (publish.code !== 0) return { ok: false, state: "BLOCKED_CAPABILITY", summary: `npm publish failed for ${spec}`, next: "resolve npm authentication, ownership, or registry policy and resume" };
    created = true;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      result = view();
      metadata = parse(result);
      if (metadata) break;
      spawnSync("sleep", ["5"], { encoding: "utf8" });
    }
  }

  if (!metadata || metadata.name !== packageName || metadata.version !== version) {
    return { ok: false, state: "WAITING_CONDITION", summary: `${spec} publication is not yet verifiable from npm`, next: "wait for npm registry propagation, then resume" };
  }
  if (metadata.gitHead && metadata.gitHead !== commit) {
    return { ok: false, state: "BLOCKED_SAFETY", summary: `${spec} exists but its gitHead does not match the exact release commit` };
  }
  return { ok: true, created, metadata };
}

function ensureGithubRelease(tag, releaseNotesPath, ghEnv) {
  const view = () => run("gh", ["release", "view", tag, "--repo", OPEN_SOURCE_GITHUB_REPO, "--json", "tagName,url,isDraft,isPrerelease"], {
    env: ghEnv,
    allowFailure: true,
    timeout: 120000,
  });
  const parse = (result) => {
    if (result.code !== 0) return null;
    try { return JSON.parse(result.stdout); } catch { return null; }
  };
  let result = view();
  let metadata = parse(result);
  if (!metadata) {
    const list = run("gh", ["release", "list", "--repo", OPEN_SOURCE_GITHUB_REPO, "--limit", "100", "--json", "tagName"], {
      env: ghEnv,
      allowFailure: true,
      timeout: 120000,
    });
    if (list.code !== 0) return { ok: false, state: "BLOCKED_CAPABILITY", summary: "GitHub Release listing failed" };
    let releases = [];
    try { releases = JSON.parse(list.stdout); } catch { return { ok: false, state: "BLOCKED_CAPABILITY", summary: "GitHub Release listing returned invalid JSON" }; }
    if (releases.some((item) => item.tagName === tag)) return { ok: false, state: "BLOCKED_SAFETY", summary: `${tag} GitHub Release exists but could not be inspected` };
    const create = run("gh", ["release", "create", tag, "--repo", OPEN_SOURCE_GITHUB_REPO, "--title", tag, "--notes-file", releaseNotesPath, "--verify-tag"], {
      env: ghEnv,
      allowFailure: true,
      timeout: 180000,
    });
    if (create.code !== 0) return { ok: false, state: "BLOCKED_CAPABILITY", summary: `GitHub Release creation failed for ${tag}` };
    result = view();
    metadata = parse(result);
  }
  if (!metadata || metadata.tagName !== tag || metadata.isDraft || metadata.isPrerelease) {
    return { ok: false, state: "BLOCKED_SAFETY", summary: `${tag} GitHub Release verification failed` };
  }
  return { ok: true, ...metadata };
}

function runWorkflowCorpusRecovery() {
  const home = process.env.HOME || os.homedir();
  const outputDir = path.join(home, ".openclaw", "state", "coding-workflow", "workflow-corpus");
  const sources = [
    path.join(home, ".codex", "sessions"),
    path.join(home, ".openclaw", "agents", "main", "sessions"),
    path.join(home, ".openclaw", "agents", "researcher", "sessions"),
    path.join(home, ".openclaw", "logs"),
  ];
  const extractor = "scripts/extract-session-workflows.mjs";

  evidence.push("workflow corpus output: private local state outside the package repository");
  evidence.push(`workflow corpus source roots inspected: ${sources.length}`);
  actions.push("raw sessions, raw prompts, raw responses, generated corpus files, and pseudonym maps remain excluded from commits");

  if (dryRun) {
    actions.push("would validate existing private corpus first");
    actions.push("would regenerate private corpus only if validation is missing or failing");
    actions.push("would use only aggregate corpus findings in public roadmap docs");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "Workflow corpus recovery dry-run complete",
      summary: "workflow-corpus-recovery would validate or regenerate the private corpus and stop before remote publication",
      nextPermission: "run without --dry-run under local_execution, or grant remote_publication later to push local commits",
      nextSkill: "session-log-extraction-skill",
      exitCode: 0,
    };
  }

  let existingValid = false;
  if (fs.existsSync(path.join(outputDir, "validation-report.json"))) {
    const validation = run(process.execPath, [extractor, "--output-dir", outputDir, "--validate-only", "--json"], {
      cwd: LIBRARY_ROOT,
      allowFailure: true,
    });
    existingValid = validation.code === 0 && /"status":\s*"PASS"/.test(validation.stdout);
    evidence.push(`existing private corpus validation: ${existingValid ? "PASS" : "not valid"}`);
  } else {
    evidence.push("existing private corpus validation: not present");
  }

  if (!existingValid) {
    const generated = run(process.execPath, [
      extractor,
      ...sources.flatMap((source) => ["--source", source]),
      "--output-dir",
      outputDir,
      "--json",
    ], {
      cwd: LIBRARY_ROOT,
      allowFailure: true,
      timeout: 120000,
    });
    if (generated.code !== 0) {
      return {
        finalStatus: "BLOCKED_CAPABILITY",
        ledgerStatus: "Workflow corpus recovery blocked",
        summary: "private workflow corpus could not be generated or validated",
        nextPermission: "repair local session source access or extractor validation",
        nextSkill: "session-log-extraction-skill / error-evidence-skill",
        exitCode: 1,
      };
    }
  }

  const validation = run(process.execPath, [extractor, "--output-dir", outputDir, "--validate-only", "--json"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  if (validation.code !== 0) {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: "Workflow corpus recovery blocked",
      summary: "private workflow corpus validation failed",
      nextPermission: "fix extractor privacy or schema validation",
      nextSkill: "session-log-extraction-skill / error-evidence-skill",
      exitCode: 1,
    };
  }

  const coveragePath = path.join(outputDir, "coverage-report.json");
  if (fs.existsSync(coveragePath)) {
    try {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
      const totals = coverage.totals || {};
      const reconciled = totals.discovered === totals.parsed + totals.unsupported + totals.corrupt + totals.empty + totals.duplicate + totals.excluded;
      evidence.push(`private corpus sources discovered: ${totals.discovered ?? "unknown"}`);
      evidence.push(`private corpus events: ${coverage.total_events ?? "unknown"}`);
      evidence.push(`private corpus coverage reconciled: ${reconciled}`);
    } catch (error) {
      evidence.push(`private coverage summary unavailable: ${error.message}`);
    }
  }

  return {
    finalStatus: "READY",
    ledgerStatus: "Corrected workflow corpus and roadmap rebuilt locally",
    summary: "corrected private workflow corpus validated and public-safe roadmap artifacts are ready locally",
    nextPermission: "grant remote_publication if John wants the local commits pushed",
    nextSkill: "github-handoff-skill / session-log-extraction-skill",
    exitCode: 0,
  };
}

function runDocsListFoundation() {
  const docsList = "scripts/docs-list";
  evidence.push("docs-list source: tracked Markdown inventory");
  evidence.push("strict failures: duplicate current titles and orphaned current docs");
  actions.push("private corpus outputs, local lane state, caches, temp files, package output, and raw sessions remain excluded");

  if (dryRun) {
    actions.push("would verify scripts/docs-list syntax");
    actions.push("would run docs-list human, JSON, orphan, and strict validation modes");
    actions.push("would keep npm publish, version bumps, tags, GitHub releases, deploys, and product repos out of scope");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "docs-list foundation dry-run complete",
      summary: "docs-list-foundation would verify deterministic documentation inventory and stop at repo-map helper automation",
      nextPermission: "build repo-map helper automation",
      nextSkill: "repo-map-skill / coding-workflow-orchestrator-skill",
      exitCode: 0,
    };
  }

  const blockers = [];
  if (!fs.existsSync(path.join(LIBRARY_ROOT, docsList))) blockers.push("scripts/docs-list missing");

  const commands = [
    ["docs-list syntax", process.execPath, ["--check", docsList]],
    ["docs-list human inventory", `./${docsList}`, []],
    ["docs-list json inventory", `./${docsList}`, ["--json"]],
    ["docs-list orphan inventory", `./${docsList}`, ["--orphans"]],
    ["docs-list strict validation", `./${docsList}`, ["--validate"]],
  ];

  for (const [label, command, commandArgs] of commands) {
    const result = run(command, commandArgs, { cwd: LIBRARY_ROOT, allowFailure: true });
    evidence.push(`${label} exit: ${result.code}`);
    if (result.code !== 0) blockers.push(`${label} failed`);
  }

  if (blockers.length) {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: "docs-list foundation blocked",
      summary: blockers.join("; "),
      nextPermission: "fix docs-list helper or documentation index failures",
      nextSkill: "coding-workflow-orchestrator-skill / error-evidence-skill",
      exitCode: 1,
    };
  }

  return {
    finalStatus: "READY",
    ledgerStatus: "docs-list foundation complete",
    summary: "deterministic documentation inventory validates; next active dependency is repo-map helper automation",
    nextPermission: "build repo-map helper automation",
    nextSkill: "repo-map-skill / coding-workflow-orchestrator-skill",
    exitCode: 0,
  };
}

function runRepoMapHelperAutomation() {
  const repoMap = "scripts/repo-map";
  evidence.push("repo-map purpose: deterministic privacy-safe source-only repository orientation");
  evidence.push("repo-map strict boundaries: no dependency install, build/test execution in target repos, git mutation, external calls, production calls, or secret reads");
  actions.push("private paths, env values, tokens, DB URLs, generated outputs, caches, and target-repo mutations remain excluded");

  if (dryRun) {
    actions.push("would verify scripts/repo-map syntax");
    actions.push("would run repo-map human, JSON, and strict validation modes against the library");
    actions.push("would run repo-map tests and CLI delegation checks");
    actions.push("would stop before planner/worker/reviewer agents, package publication, release work, tags, deploys, or product repos");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "repo-map helper automation dry-run complete",
      summary: "repo-map-helper-automation would verify deterministic source-only repository mapping and stop before project-KB compiler work",
      nextPermission: "build project-KB compiler or migration-review helper",
      nextSkill: "project-kb-builder-skill / migration-review-skill",
      exitCode: 0,
    };
  }

  const blockers = [];
  if (!fs.existsSync(path.join(LIBRARY_ROOT, repoMap))) blockers.push("scripts/repo-map missing");
  if (!fs.existsSync(path.join(LIBRARY_ROOT, "schemas", "repo-map.schema.json"))) blockers.push("repo-map schema missing");

  const commands = [
    ["repo-map syntax", process.execPath, ["--check", repoMap]],
    ["repo-map tests", process.execPath, ["tests/repo-map.test.js"]],
    ["repo-map human report", `./${repoMap}`, ["--repo", "."]],
    ["repo-map json report", `./${repoMap}`, ["--repo", ".", "--json"]],
    ["repo-map strict validation", `./${repoMap}`, ["--repo", ".", "--validate"]],
    ["repo-map CLI validation", "./bin/coding-workflow.js", ["repo-map", "--repo", ".", "--validate"]],
  ];

  for (const [label, command, commandArgs] of commands) {
    const result = run(command, commandArgs, { cwd: LIBRARY_ROOT, allowFailure: true });
    evidence.push(`${label} exit: ${result.code}`);
    if (result.code !== 0) blockers.push(`${label} failed`);
  }

  if (blockers.length) {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: "repo-map helper automation blocked",
      summary: blockers.join("; "),
      nextPermission: "fix repo-map helper or validation failures",
      nextSkill: "repo-map-skill / error-evidence-skill",
      exitCode: 1,
    };
  }

  return {
    finalStatus: "READY",
    ledgerStatus: "repo-map helper automation complete",
    summary: "deterministic source-only repository map helper validates; next active dependency is project-KB compiler or migration-review helper",
    nextPermission: "build project-KB compiler or migration-review helper",
    nextSkill: "project-kb-builder-skill / migration-review-skill",
    exitCode: 0,
  };
}

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
  packageRepositoryMatches,
  inspectNpmPackDryRun,
  runSemverReleasePrep,
  runSemverPublication,
  resolveSemverReleaseTarget,
  waitForExactValidateWorkflow,
  ensureAnnotatedReleaseTag,
  ensureNpmPublication,
  ensureGithubRelease,
  runWorkflowCorpusRecovery,
  runDocsListFoundation,
  runRepoMapHelperAutomation,
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
