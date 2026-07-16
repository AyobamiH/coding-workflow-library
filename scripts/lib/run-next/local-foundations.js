"use strict";

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

function runVerificationBundleSelfTest() {
  const evidenceWriteAllowed = args.allow.has("evidence-pack-write");
  const evidencePackMode = evidenceWriteAllowed && !dryRun ? "write" : "dry-run";
  const evidencePackArgs = ["--repo", targetRepo, "--title", "Verification bundle self-test"];
  if (evidencePackMode !== "write") evidencePackArgs.push("--dry-run");

  if (dryRun) {
    actions.push(`would run scripts/npm-package-readiness --repo ${targetRepo}`);
    actions.push(`would run scripts/release-preflight --repo ${targetRepo}`);
    actions.push(`would run scripts/evidence-pack --repo ${targetRepo} --title "Verification bundle self-test" ${evidencePackMode === "write" ? "" : "--dry-run"}`.trim());
    actions.push("would run node --check for run-next and bundle helper scripts");
    actions.push("would run scripts/skill-cleaner and scripts/validate-skills");
    evidence.push(`verification bundle target repo: ${targetRepo}`);
    evidence.push(`evidence pack mode: ${evidencePackMode}`);
    evidence.push("dry-run verified route selection without writing evidence files, ledger, run log, target repo, or external state");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "Local verification and release evidence bundle built",
      summary: "verification bundle self-test route would run npm package readiness, release preflight, evidence-pack dry-run, and validation",
      nextPermission: "verification-bundle-self-test",
      nextSkill: "release-preflight-skill",
      exitCode: 0,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    evidence.push(`verification bundle target repo missing: ${targetRepo}`);
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Verification bundle self-test blocked",
      summary: `target repo does not exist: ${targetRepo}`,
      nextPermission: "provide an existing local repo path",
      nextSkill: "repo-map-skill",
      exitCode: 1,
    };
  }

  evidence.push(`verification bundle target repo: ${targetRepo}`);
  evidence.push(`evidence pack mode: ${evidencePackMode}`);
  evidence.push("release boundary: no npm publish, npm version, git tag, git push, GitHub release, deploy, remote mutation, secret read, or production call is permitted in this route");

  const npmReadiness = run(path.join(LIBRARY_ROOT, "scripts/npm-package-readiness"), ["--repo", targetRepo], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const npmClassification = extractFinalClassification(npmReadiness.stdout);
  evidence.push(`npm package readiness command exit: ${npmReadiness.code}`);
  evidence.push(`npm package readiness final classification: ${npmClassification || "unavailable"}`);

  const releasePreflight = run(path.join(LIBRARY_ROOT, "scripts/release-preflight"), ["--repo", targetRepo], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const releaseClassification = extractFinalClassification(releasePreflight.stdout);
  evidence.push(`release preflight command exit: ${releasePreflight.code}`);
  evidence.push(`release preflight final classification: ${releaseClassification || "unavailable"}`);

  const evidencePack = run(path.join(LIBRARY_ROOT, "scripts/evidence-pack"), evidencePackArgs, {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  evidence.push(`evidence pack command exit: ${evidencePack.code}`);
  evidence.push(`evidence pack wrote files: ${evidencePackMode === "write" ? "yes, under target repo evidence folder" : "no, dry-run mode"}`);

  const syntaxChecks = [
    ["node", ["--check", "scripts/run-next"]],
    ["node", ["--check", "scripts/evidence-pack"]],
    ["node", ["--check", "scripts/npm-package-readiness"]],
    ["node", ["--check", "scripts/release-preflight"]],
  ].map(([command, commandArgs]) => run(command, commandArgs, { cwd: LIBRARY_ROOT, allowFailure: true }));
  evidence.push(`script syntax checks: ${syntaxChecks.every((item) => item.code === 0) ? "passed" : "failed"}`);

  const cleaner = run("./scripts/skill-cleaner", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const validator = run("./scripts/validate-skills", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  evidence.push(`skill-cleaner exit: ${cleaner.code}`);
  evidence.push(`validate-skills exit: ${validator.code}`);
  evidence.push(`validate-skills result: ${extractValidationResult(validator.stdout) || "unavailable"}`);

  const commandFailures = [
    ["npm package readiness", npmReadiness],
    ["release preflight", releasePreflight],
    ["evidence pack", evidencePack],
    ["skill-cleaner", cleaner],
    ["validate-skills", validator],
    ...syntaxChecks.map((result, index) => [`syntax check ${index + 1}`, result]),
  ].filter(([, result]) => result.code !== 0);

  if (commandFailures.length) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Verification bundle self-test blocked",
      summary: `verification bundle self-test command failures: ${commandFailures.map(([name]) => name).join(", ")}`,
      nextPermission: "fix verification bundle self-test failures",
      nextSkill: "error-evidence-skill",
      exitCode: 1,
    };
  }

  return {
    finalStatus: "Verification bundle self-test complete",
    ledgerStatus: "Verification bundle self-test complete",
    summary: `verification bundle self-test ran safely; npm readiness=${npmClassification || "unavailable"}; release preflight=${releaseClassification || "unavailable"}; evidence pack mode=${evidencePackMode}`,
    nextPermission: "approve evidence-pack write test or route next immediate skill bundle",
    nextSkill: "release-preflight-skill",
    exitCode: 0,
  };
}

function runLocalSkillWorkpack() {
  const evidenceWriteAllowed = args.allow.has("evidence-pack-write");
  const expectedRepo = LIBRARY_ROOT;

  if (dryRun) {
    actions.push("would run verification classification helpers in local, npm, and expected-package modes");
    actions.push("would run scripts/failure-evidence with redacted stdin fixture");
    actions.push("would create exactly one evidence pack under the skills library evidence/ folder when evidence-pack-write is allowed");
    actions.push("would run node --check for run-next, evidence-pack, npm-package-readiness, release-preflight, and failure-evidence");
    actions.push("would run scripts/skill-cleaner and scripts/validate-skills");
    actions.push("would update work-ledger.md and runs/skill-runs.md only in real mode");
    evidence.push(`local skill workpack target repo: ${targetRepo}`);
    evidence.push(`evidence-pack-write flag: ${evidenceWriteAllowed ? "present" : "missing"}`);
    evidence.push("dry-run verified route selection without writing evidence files, ledger, run log, target repo, or external state");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "Verification bundle self-test complete",
      summary: "local skill workpack would harden verification classification, write one evidence pack, test failure evidence, validate runtime/GitHub skill extraction, and stop",
      nextPermission: "local-skill-workpack",
      nextSkill: "coding-workflow-orchestrator-skill",
      exitCode: 0,
    };
  }

  if (path.resolve(targetRepo) !== expectedRepo) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Local skill workpack blocked",
      summary: `local skill workpack may only run against ${expectedRepo}`,
      nextPermission: "select the local skills library repo",
      nextSkill: "coding-workflow-orchestrator-skill",
      exitCode: 1,
    };
  }

  if (!evidenceWriteAllowed) {
    return {
      finalStatus: "NEEDS JOHN",
      ledgerStatus: "Needs John: evidence-pack write permission",
      summary: "local skill workpack requires --allow evidence-pack-write to prove exactly one local evidence pack write",
      nextPermission: "evidence-pack-write",
      nextSkill: "evidence-pack-builder-skill",
      exitCode: 2,
    };
  }

  if (!fs.existsSync(targetRepo)) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Local skill workpack blocked",
      summary: `target repo does not exist: ${targetRepo}`,
      nextPermission: "provide the local skills library path",
      nextSkill: "repo-map-skill",
      exitCode: 1,
    };
  }

  const beforeEvidencePacks = listEvidencePackDirs(targetRepo);
  evidence.push(`local skill workpack target repo: ${targetRepo}`);
  evidence.push(`evidence packs before run: ${beforeEvidencePacks.length}`);
  evidence.push("boundary: no product repo edits, npm publish, npm version, tags, push, PR, deploy, Supabase, Cloudflare, secret reads, or production calls");

  const npmDefault = run(path.join(LIBRARY_ROOT, "scripts/npm-package-readiness"), ["--repo", targetRepo], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  if (!npmDefault.stdout.trim()) {
    Object.assign(npmDefault, fallbackPackageReadinessRun(targetRepo, { expectPackage: false, expectCli: false }));
  }
  const npmDefaultClassification = extractFinalClassification(npmDefault.stdout);
  evidence.push(`npm readiness default exit: ${npmDefault.code}; classification: ${npmDefaultClassification || "unavailable"}`);

  const npmExpectPackage = run(path.join(LIBRARY_ROOT, "scripts/npm-package-readiness"), ["--repo", targetRepo, "--expect-package"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  if (!npmExpectPackage.stdout.trim()) {
    Object.assign(npmExpectPackage, fallbackPackageReadinessRun(targetRepo, { expectPackage: true, expectCli: false }));
  }
  const npmExpectPackageClassification = extractFinalClassification(npmExpectPackage.stdout);
  evidence.push(`npm readiness expect-package exit: ${npmExpectPackage.code}; classification: ${npmExpectPackageClassification || "unavailable"}`);

  const releaseLocal = run(path.join(LIBRARY_ROOT, "scripts/release-preflight"), ["--repo", targetRepo, "--mode", "local"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  if (!releaseLocal.stdout.trim()) {
    Object.assign(releaseLocal, fallbackReleasePreflightRun(targetRepo, "local"));
  }
  const releaseLocalClassification = extractFinalClassification(releaseLocal.stdout);
  evidence.push(`release preflight local exit: ${releaseLocal.code}; classification: ${releaseLocalClassification || "unavailable"}`);

  const releaseNpm = run(path.join(LIBRARY_ROOT, "scripts/release-preflight"), ["--repo", targetRepo, "--mode", "npm"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  if (!releaseNpm.stdout.trim()) {
    Object.assign(releaseNpm, fallbackReleasePreflightRun(targetRepo, "npm"));
  }
  const releaseNpmClassification = extractFinalClassification(releaseNpm.stdout);
  evidence.push(`release preflight npm exit: ${releaseNpm.code}; classification: ${releaseNpmClassification || "unavailable"}`);

  const failureEvidenceInput =
    "psql: error: connection to server failed: Network is unreachable\n" +
    "fatal: Authentication failed for https://example.invalid/private/repo.git\n" +
    "operation blocked: external service mutation not permitted by current gate\n";
  const failureEvidence = run(path.join(LIBRARY_ROOT, "scripts/failure-evidence"), ["--stdin"], {
    cwd: LIBRARY_ROOT,
    input: failureEvidenceInput,
    allowFailure: true,
  });
  if (!failureEvidence.stdout.trim()) {
    Object.assign(failureEvidence, fallbackFailureEvidenceRun(failureEvidenceInput));
  }
  evidence.push(`failure-evidence exit: ${failureEvidence.code}; classification line: ${extractFailureClassification(failureEvidence.stdout) || "unavailable"}`);

  const evidencePack = run(
    path.join(LIBRARY_ROOT, "scripts/evidence-pack"),
    ["--repo", targetRepo, "--title", "Local skill workpack"],
    { cwd: LIBRARY_ROOT, allowFailure: true },
  );
  if (!evidencePack.stdout.trim()) {
    Object.assign(evidencePack, fallbackEvidencePackRun(targetRepo, "Local skill workpack"));
  }
  const evidencePackPath = extractEvidencePackPath(evidencePack.stdout);
  const afterEvidencePacks = listEvidencePackDirs(targetRepo);
  const newEvidencePacks = afterEvidencePacks.filter((item) => !beforeEvidencePacks.includes(item));
  evidence.push(`evidence pack command exit: ${evidencePack.code}`);
  evidence.push(`new evidence packs created: ${newEvidencePacks.length}`);
  if (evidencePackPath) evidence.push(`evidence pack path: ${evidencePackPath}`);

  const syntaxChecks = [
    ["node", ["--check", "scripts/run-next"]],
    ["node", ["--check", "scripts/evidence-pack"]],
    ["node", ["--check", "scripts/npm-package-readiness"]],
    ["node", ["--check", "scripts/release-preflight"]],
    ["node", ["--check", "scripts/failure-evidence"]],
  ].map(([command, commandArgs]) => run(command, commandArgs, { cwd: LIBRARY_ROOT, allowFailure: true }));
  evidence.push(`script syntax checks: ${syntaxChecks.every((item) => item.code === 0) ? "passed" : "failed"}`);

  const cleaner = run("./scripts/skill-cleaner", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const validator = run("./scripts/validate-skills", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  evidence.push(`skill-cleaner exit: ${cleaner.code}`);
  evidence.push(`validate-skills exit: ${validator.code}`);
  evidence.push(`validate-skills result: ${extractValidationResult(validator.stdout) || "unavailable"}`);

  const commandFailures = [
    ["npm package readiness default", npmDefault],
    ["npm package readiness expect-package", npmExpectPackage],
    ["release preflight local", releaseLocal],
    ["release preflight npm", releaseNpm],
    ["failure evidence", failureEvidence],
    ["evidence pack", evidencePack],
    ["skill-cleaner", cleaner],
    ["validate-skills", validator],
    ...syntaxChecks.map((result, index) => [`syntax check ${index + 1}`, result]),
  ].filter(([, result]) => result.code !== 0);

  if (commandFailures.length) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Local skill workpack blocked",
      summary: `local skill workpack command failures: ${commandFailures.map(([name]) => name).join(", ")}`,
      nextPermission: "fix local skill workpack failures",
      nextSkill: "error-evidence-skill",
      localSkillWorkpack: {
        evidencePackPath,
        newEvidencePacks,
        npmDefaultClassification,
        npmExpectPackageClassification,
        releaseLocalClassification,
        releaseNpmClassification,
      },
      exitCode: 1,
    };
  }

  if (newEvidencePacks.length !== 1) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Local skill workpack blocked",
      summary: `expected exactly one new evidence pack, found ${newEvidencePacks.length}`,
      nextPermission: "manual evidence-pack review",
      nextSkill: "evidence-pack-builder-skill",
      localSkillWorkpack: {
        evidencePackPath,
        newEvidencePacks,
        npmDefaultClassification,
        npmExpectPackageClassification,
        releaseLocalClassification,
        releaseNpmClassification,
      },
      exitCode: 1,
    };
  }

  return {
    finalStatus: "Local skill workpack complete",
    ledgerStatus: "Local skill workpack complete",
    summary:
      `local skill workpack ran safely; npm default=${npmDefaultClassification || "unavailable"}; ` +
      `npm expect-package=${npmExpectPackageClassification || "unavailable"}; ` +
      `release local=${releaseLocalClassification || "unavailable"}; ` +
      `release npm=${releaseNpmClassification || "unavailable"}; evidence pack=${newEvidencePacks[0]}`,
    nextPermission: "route next immediate skill bundle",
    nextSkill: "coding-workflow-orchestrator-skill",
    localSkillWorkpack: {
      evidencePackPath: evidencePackPath || path.join(targetRepo, "evidence", newEvidencePacks[0]),
      newEvidencePacks,
      npmDefaultClassification,
      npmExpectPackageClassification,
      releaseLocalClassification,
      releaseNpmClassification,
    },
    exitCode: 0,
  };
}

function runCloudflareOpstruthPackagingBundle() {
  const expectedRepo = LIBRARY_ROOT;

  if (dryRun) {
    actions.push("would verify target repo is the local skills library");
    actions.push("would run node --check for run-next, route-audit, library-packaging-readiness, release-preflight, npm-package-readiness, evidence-pack, and failure-evidence");
    actions.push("would run scripts/route-audit and scripts/route-audit --json");
    actions.push("would run scripts/library-packaging-readiness against the local skills library");
    actions.push("would run scripts/release-preflight --mode local against the local skills library");
    actions.push("would run scripts/skill-cleaner and scripts/validate-skills");
    actions.push("would not touch product repos, deploy Cloudflare, run Wrangler deploy, publish npm, version, tag, push, create PRs, set/read secrets, run Supabase commands, or call production endpoints");
    evidence.push(`bundle target repo: ${targetRepo}`);
    evidence.push("dry-run verified route selection without writing ledger, run log, target repos, or external state");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "Embedded production lanes extracted into reusable routes",
      summary: "Cloudflare, Opstruth, and packaging bundle would run local route/readiness/preflight/validation checks only",
      nextPermission: "cloudflare-opstruth-packaging-bundle",
      nextSkill: "coding-workflow-orchestrator-skill / cloudflare-deploy-skill / opstruth-runtime-truth-skill / skills-library-packaging-skill",
      exitCode: 0,
    };
  }

  if (path.resolve(targetRepo) !== expectedRepo) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Cloudflare Opstruth packaging bundle blocked",
      summary: `bundle may only run against ${expectedRepo}`,
      nextPermission: "select the local skills library repo",
      nextSkill: "coding-workflow-orchestrator-skill",
      exitCode: 1,
    };
  }

  evidence.push(`bundle target repo: ${targetRepo}`);
  evidence.push("boundary: no product repo edits, Cloudflare deploy, Wrangler deploy, npm publish, npm version, tags, push, PR, Supabase command, secret read, production call, or remote service mutation");

  const scriptsToCheck = [
    "scripts/run-next",
    "scripts/route-audit",
    "scripts/evidence-pack",
    "scripts/failure-evidence",
    "scripts/npm-package-readiness",
    "scripts/release-preflight",
    "scripts/library-packaging-readiness",
  ];
  const syntaxChecks = scriptsToCheck.map((script) => run("node", ["--check", script], { cwd: LIBRARY_ROOT, allowFailure: true }));
  evidence.push(`script syntax checks: ${syntaxChecks.every((item) => item.code === 0) ? "passed" : "failed"}`);

  const routeAudit = run("./scripts/route-audit", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const routeAuditJson = run("./scripts/route-audit", ["--json"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const routeAuditResult = extractValidationResult(routeAudit.stdout) || "unavailable";
  evidence.push(`route audit exit: ${routeAudit.code}; result: ${routeAuditResult}`);
  evidence.push(`route audit JSON exit: ${routeAuditJson.code}`);

  const packaging = run("./scripts/library-packaging-readiness", ["--repo", LIBRARY_ROOT], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const packagingClassification = extractFinalClassification(packaging.stdout) || "unavailable";
  evidence.push(`library packaging readiness exit: ${packaging.code}; classification: ${packagingClassification}`);

  const releaseLocal = run("./scripts/release-preflight", ["--repo", LIBRARY_ROOT, "--mode", "local"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const releaseClassification = extractFinalClassification(releaseLocal.stdout) || "unavailable";
  evidence.push(`release preflight local exit: ${releaseLocal.code}; classification: ${releaseClassification}`);

  const cleaner = run("./scripts/skill-cleaner", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const validator = run("./scripts/validate-skills", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  evidence.push(`skill-cleaner exit: ${cleaner.code}`);
  evidence.push(`validate-skills exit: ${validator.code}`);
  evidence.push(`validate-skills result: ${extractValidationResult(validator.stdout) || "unavailable"}`);

  const commandFailures = [
    ["route audit", routeAudit],
    ["route audit json", routeAuditJson],
    ["library packaging readiness", packaging],
    ["release preflight local", releaseLocal],
    ["skill-cleaner", cleaner],
    ["validate-skills", validator],
    ...syntaxChecks.map((result, index) => [`syntax check ${scriptsToCheck[index]}`, result]),
  ].filter(([, result]) => result.code !== 0);

  if (commandFailures.length) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Cloudflare Opstruth packaging bundle blocked",
      summary: `local bundle command failures: ${commandFailures.map(([name]) => name).join(", ")}`,
      nextPermission: "fix local bundle failures",
      nextSkill: "error-evidence-skill",
      exitCode: 1,
    };
  }

  return {
    finalStatus: "Cloudflare Opstruth packaging routes extracted",
    ledgerStatus: "Cloudflare Opstruth packaging routes extracted",
    summary:
      `local bundle ran safely; route audit=${routeAuditResult}; ` +
      `packaging=${packagingClassification}; release local=${releaseClassification}; validate=${extractValidationResult(validator.stdout) || "unavailable"}`,
    nextPermission: "run clean-temp package/open-source readiness smoke or scheduled-run recheck",
    nextSkill: "skills-library-packaging-skill / opstruth-runtime-truth-skill / cloudflare-deploy-skill",
    cloudflareOpstruthPackagingBundle: {
      routeAuditResult,
      packagingClassification,
      releaseClassification,
    },
    exitCode: 0,
  };
}

function runCleanTempReadinessSmoke() {
  const expectedRepo = LIBRARY_ROOT;

  if (dryRun) {
    actions.push("would verify target repo is the local skills library");
    actions.push("would create a clean temp copy under <TEMP_ROOT>");
    actions.push("would exclude .git, .env files, node_modules, evidence, package caches, and credential-shaped files from the temp copy");
    actions.push("would run route-audit, run-next --list-routes, library-packaging-readiness, release-preflight local mode, skill-cleaner, and validate-skills in the temp copy");
    actions.push("would remove the clean temp copy after collecting evidence");
    actions.push("would run no deploy, publish, push, tag, PR, Supabase, Cloudflare, secret, production endpoint, or remote mutation commands");
    evidence.push(`clean-temp smoke target repo: ${targetRepo}`);
    evidence.push("dry-run verified route selection without creating the temp copy, writing ledger/run-log, touching product repos, or mutating external state");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "Cloudflare Opstruth packaging routes extracted",
      summary: "clean-temp readiness smoke would prove the library can validate from a copied local folder and classify open-source/package blockers",
      nextPermission: "clean-temp-readiness-smoke",
      nextSkill: "skills-library-packaging-skill",
      exitCode: 0,
    };
  }

  if (path.resolve(targetRepo) !== expectedRepo) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Clean-temp readiness smoke blocked",
      summary: `clean-temp readiness smoke may only run against ${expectedRepo}`,
      nextPermission: "select the local skills library repo",
      nextSkill: "coding-workflow-orchestrator-skill",
      exitCode: 1,
    };
  }

  const tempParent = DEFAULT_TEMP_ROOT;
  const tempPath = path.join(tempParent, `coding-workflow-library-smoke-${timestampForFolder()}`);
  fs.mkdirSync(tempParent, { recursive: true, mode: 0o700 });
  const copyResult = copyLibraryForSmoke(LIBRARY_ROOT, tempPath);
  ensureSmokeScriptsExecutable(tempPath);

  evidence.push(`clean temp path: ${tempPath}`);
  evidence.push(`clean temp files copied: ${copyResult.filesCopied}`);
  evidence.push(`clean temp excluded paths: ${copyResult.excluded.slice(0, 12).join(", ") || "none"}${copyResult.excluded.length > 12 ? `, and ${copyResult.excluded.length - 12} more` : ""}`);
  evidence.push("boundary: no product repo edits, deploy, publish, npm version, tags, push, PR, Supabase, Cloudflare, secret reads, production calls, or remote service mutation");

  const routeAudit = run("./scripts/route-audit", [], { cwd: tempPath, allowFailure: true });
  const listRoutes = run("./scripts/run-next", ["--list-routes"], { cwd: tempPath, allowFailure: true });
  const packagingDefault = run("./scripts/library-packaging-readiness", ["--repo", "."], {
    cwd: tempPath,
    allowFailure: true,
  });
  const packagingOpenSource = run("./scripts/library-packaging-readiness", ["--repo", ".", "--expect-open-source"], {
    cwd: tempPath,
    allowFailure: true,
  });
  const releaseLocal = run("./scripts/release-preflight", ["--repo", ".", "--mode", "local"], {
    cwd: tempPath,
    allowFailure: true,
  });
  const cleaner = run("./scripts/skill-cleaner", [], { cwd: tempPath, allowFailure: true });
  const validator = run("./scripts/validate-skills", [], { cwd: tempPath, allowFailure: true });

  const routeAuditResult = extractValidationResult(routeAudit.stdout) || "unavailable";
  const packagingDefaultClassification = extractFinalClassification(packagingDefault.stdout) || "unavailable";
  const packagingOpenSourceClassification = extractFinalClassification(packagingOpenSource.stdout) || "unavailable";
  const releaseClassification = extractFinalClassification(releaseLocal.stdout) || "unavailable";
  const validatorResult = extractValidationResult(validator.stdout) || "unavailable";

  evidence.push(`temp route-audit exit: ${routeAudit.code}; result: ${routeAuditResult}`);
  evidence.push(`temp run-next --list-routes exit: ${listRoutes.code}`);
  evidence.push(`temp library packaging default exit: ${packagingDefault.code}; classification: ${packagingDefaultClassification}`);
  evidence.push(`temp library packaging open-source exit: ${packagingOpenSource.code}; classification: ${packagingOpenSourceClassification}`);
  evidence.push(`temp release preflight local exit: ${releaseLocal.code}; classification: ${releaseClassification}`);
  evidence.push(`temp skill-cleaner exit: ${cleaner.code}`);
  evidence.push(`temp validate-skills exit: ${validator.code}; result: ${validatorResult}`);

  const removed = removeSmokeTempDir(tempPath);
  evidence.push(`clean temp copy removed: ${removed ? "yes" : "no"}`);

  const requiredFailures = [
    ["temp route audit", routeAudit],
    ["temp route list", listRoutes],
    ["temp library packaging default", packagingDefault],
    ["temp release preflight local", releaseLocal],
    ["temp skill-cleaner", cleaner],
    ["temp validate-skills", validator],
  ].filter(([, result]) => result.code !== 0);

  const openSourceCrashed = packagingOpenSource.code !== 0 && packagingOpenSourceClassification === "unavailable";
  if (openSourceCrashed) requiredFailures.push(["temp library packaging open-source", packagingOpenSource]);

  if (!removed) {
    requiredFailures.push(["temp cleanup", { code: 1 }]);
  }

  if (requiredFailures.length) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Clean-temp readiness smoke blocked",
      summary: `clean-temp readiness smoke command failures: ${requiredFailures.map(([name]) => name).join(", ")}`,
      nextPermission: "fix clean-temp portability failures",
      nextSkill: "error-evidence-skill",
      cleanTempReadinessSmoke: {
        tempPath,
        routeAuditResult,
        packagingDefaultClassification,
        packagingOpenSourceClassification,
        releaseClassification,
        validatorResult,
        removed,
      },
      exitCode: 1,
    };
  }

  return {
    finalStatus: "Clean-temp readiness smoke complete",
    ledgerStatus: "Clean-temp readiness smoke complete",
    summary:
      `clean-temp smoke ran safely; route audit=${routeAuditResult}; ` +
      `packaging=${packagingDefaultClassification}; open-source=${packagingOpenSourceClassification}; ` +
      `release local=${releaseClassification}; validate=${validatorResult}; temp removed=${removed ? "yes" : "no"}`,
    nextPermission: "choose licence/package path or run scheduled-run recheck",
    nextSkill: "skills-library-packaging-skill / opstruth-runtime-truth-skill",
    cleanTempReadinessSmoke: {
      tempPath,
      routeAuditResult,
      packagingDefaultClassification,
      packagingOpenSourceClassification,
      releaseClassification,
      validatorResult,
      removed,
    },
    exitCode: 0,
  };
}

function runLicensePackageCandidate() {
  const expectedRepo = LIBRARY_ROOT;

  if (dryRun) {
    actions.push("would verify target repo is the local skills library");
    actions.push("would verify LICENSE exists and is MIT for John W.O.E");
    actions.push("would verify LICENSE-DECISION.md records John's MIT decision");
    actions.push("would verify package.json is a local package candidate scaffold with MIT metadata");
    actions.push("would run local package/open-source readiness checks and stop before publish, version, tag, push, release, deploy, or remote mutation");
    evidence.push(`license/package candidate target repo: ${targetRepo}`);
    evidence.push("dry-run verified route selection without writing ledger/run-log, touching product repos, or mutating external state");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "Clean-temp readiness smoke complete",
      summary: "MIT license and package candidate scaffold would be verified locally without release side effects",
      nextPermission: "license-package-candidate",
      nextSkill: "skills-library-packaging-skill / npm-package-readiness-skill",
      exitCode: 0,
    };
  }

  if (path.resolve(targetRepo) !== expectedRepo) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "MIT licence and package candidate scaffold blocked",
      summary: `license/package candidate route may only run against ${expectedRepo}`,
      nextPermission: "select the local skills library repo",
      nextSkill: "coding-workflow-orchestrator-skill",
      exitCode: 1,
    };
  }

  evidence.push(`license/package candidate repo: ${targetRepo}`);
  evidence.push("boundary: no npm publish, npm version, git tag, git push, GitHub release, deploy, Supabase, Cloudflare, secret reads, production calls, or remote service mutation");

  const licensePath = path.join(LIBRARY_ROOT, "LICENSE");
  const licenseDecisionPath = path.join(LIBRARY_ROOT, "LICENSE-DECISION.md");
  const packagePath = path.join(LIBRARY_ROOT, "package.json");
  const changelogPath = path.join(LIBRARY_ROOT, "CHANGELOG.md");

  const licenseText = fs.existsSync(licensePath) ? fs.readFileSync(licensePath, "utf8") : "";
  const decisionText = fs.existsSync(licenseDecisionPath) ? fs.readFileSync(licenseDecisionPath, "utf8") : "";
  const changelogText = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, "utf8") : "";
  let packageJson = null;
  let packageParseError = "";
  if (fs.existsSync(packagePath)) {
    try {
      packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    } catch (error) {
      packageParseError = error.message;
    }
  }

  const fileChecks = [
    ["LICENSE file", fs.existsSync(licensePath), "LICENSE missing"],
    ["MIT license heading", /MIT License/.test(licenseText), "LICENSE does not contain MIT License heading"],
    ["John W.O.E copyright", /John W\.O\.E/.test(licenseText), "LICENSE does not name John W.O.E"],
    ["LICENSE-DECISION.md", fs.existsSync(licenseDecisionPath), "LICENSE-DECISION.md missing"],
    ["MIT decision recorded", /MIT is selected|selected MIT|John selected MIT/i.test(decisionText), "MIT decision not recorded"],
    ["package.json", fs.existsSync(packagePath), "package.json missing"],
    ["package.json parse", Boolean(packageJson), packageParseError || "package.json did not parse"],
    ["package license", packageJson?.license === "MIT", "package.json license is not MIT"],
    ["package version", packageJson?.version === "0.0.0", "package.json version is not 0.0.0"],
    ["package files allowlist", Array.isArray(packageJson?.files) && packageJson.files.length > 0, "package.json files allowlist missing"],
    ["no CLI bin", !packageJson?.bin, "package.json declares a CLI bin before CLI path is approved"],
    ["changelog records MIT", /MIT/i.test(changelogText), "CHANGELOG.md does not record MIT/package candidate change"],
  ];

  for (const [label, ok, message] of fileChecks) {
    evidence.push(`${label}: ${ok ? "PASS" : `FAIL (${message})`}`);
  }

  const failedFileChecks = fileChecks.filter(([, ok]) => !ok);
  if (failedFileChecks.length) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "MIT licence and package candidate scaffold blocked",
      summary: `license/package candidate file checks failed: ${failedFileChecks.map(([label]) => label).join(", ")}`,
      nextPermission: "fix local license/package scaffold",
      nextSkill: "skills-library-packaging-skill",
      exitCode: 1,
    };
  }

  const openSource = run("./scripts/library-packaging-readiness", ["--repo", ".", "--expect-open-source"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const npmExpected = run("./scripts/library-packaging-readiness", ["--repo", ".", "--expect-npm"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const npmReadiness = run("./scripts/npm-package-readiness", ["--repo", ".", "--expect-package"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const releaseLocal = run("./scripts/release-preflight", ["--repo", ".", "--mode", "local"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });

  const openSourceClassification = extractFinalClassification(openSource.stdout) || "unavailable";
  const npmExpectedClassification = extractFinalClassification(npmExpected.stdout) || "unavailable";
  const npmReadinessClassification = extractFinalClassification(npmReadiness.stdout) || "unavailable";
  const releaseClassification = extractFinalClassification(releaseLocal.stdout) || "unavailable";

  evidence.push(`library packaging open-source exit: ${openSource.code}; classification: ${openSourceClassification}`);
  evidence.push(`library packaging npm exit: ${npmExpected.code}; classification: ${npmExpectedClassification}`);
  evidence.push(`npm package readiness exit: ${npmReadiness.code}; classification: ${npmReadinessClassification}`);
  evidence.push(`release preflight local exit: ${releaseLocal.code}; classification: ${releaseClassification}`);
  evidence.push("remaining release blocker: NEEDS JOHN: confirm final npm package name availability and ownership before publish");

  const commandFailures = [
    ["library packaging open-source", openSource],
    ["library packaging npm", npmExpected],
    ["npm package readiness", npmReadiness],
    ["release preflight local", releaseLocal],
  ].filter(([, result]) => result.code !== 0);

  if (commandFailures.length) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "MIT licence and package candidate scaffold blocked",
      summary: `license/package candidate command failures: ${commandFailures.map(([name]) => name).join(", ")}`,
      nextPermission: "fix local package readiness failures",
      nextSkill: "error-evidence-skill",
      exitCode: 1,
    };
  }

  return {
    finalStatus: "MIT licence and package candidate scaffold complete",
    ledgerStatus: "MIT licence and package candidate scaffold complete",
    summary:
      `MIT license and package candidate scaffold verified; ` +
      `open-source=${openSourceClassification}; packaging-npm=${npmExpectedClassification}; ` +
      `npm-readiness=${npmReadinessClassification}; release-local=${releaseClassification}`,
    nextPermission: "run package-candidate dry-run or scheduled-run recheck",
    nextSkill: "skills-library-packaging-skill / npm-package-readiness-skill / production-handoff-skill",
    licensePackageCandidate: {
      openSourceClassification,
      npmExpectedClassification,
      npmReadinessClassification,
      releaseClassification,
    },
    exitCode: 0,
  };
}

function runPackageCandidateDryRun() {
  const expectedRepo = LIBRARY_ROOT;

  if (dryRun) {
    actions.push("would verify target repo is the local skills library");
    actions.push("would verify package.json identity: autonomous-coding-workflow-library, version 0.0.0, MIT, AyobamiH/coding-workflow-library");
    actions.push("would verify no CLI bin is declared before a CLI entrypoint is approved");
    actions.push("would run package readiness, release preflight npm mode, npm pack dry-run, and package content risk inspection");
    actions.push("would run a clean-temp package smoke under <TEMP_ROOT> and remove the temp copy");
    actions.push("would run local skill cleanup and validation");
    actions.push("would not publish, version, tag, push, create PRs, create releases, deploy, run Supabase/Cloudflare commands, read secrets, call production endpoints, or mutate remote services");
    evidence.push(`package candidate dry-run target repo: ${targetRepo}`);
    evidence.push("dry-run verified route selection without running package checks, writing ledger/run-log, or mutating external state");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "MIT licence and package candidate scaffold complete",
      summary: "package candidate dry-run route would verify package identity, run local readiness checks, run npm pack dry-runs, inspect package contents, and validate",
      nextPermission: "package-candidate-dry-run",
      nextSkill: "skills-library-packaging-skill / npm-package-readiness-skill / release-preflight-skill",
      exitCode: 0,
    };
  }

  if (path.resolve(targetRepo) !== expectedRepo) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Package candidate dry-run blocked",
      summary: `package candidate dry-run may only run against ${expectedRepo}`,
      nextPermission: "select the local skills library repo",
      nextSkill: "coding-workflow-orchestrator-skill",
      exitCode: 1,
    };
  }

  evidence.push(`package candidate dry-run repo: ${targetRepo}`);
  evidence.push("boundary: no npm publish, npm version, git tag, git push, GitHub PR/release creation, deploy, Supabase, Cloudflare, secret reads, production calls, registry mutation, or remote service mutation");

  const identity = verifyPackageCandidateIdentity(LIBRARY_ROOT);
  for (const item of identity.checks) {
    evidence.push(`${item.label}: ${item.ok ? "PASS" : `FAIL (${item.message})`}`);
  }
  if (!identity.ok) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Package candidate dry-run blocked",
      summary: `package identity checks failed: ${identity.checks.filter((item) => !item.ok).map((item) => item.label).join(", ")}`,
      nextPermission: "fix package candidate metadata",
      nextSkill: "skills-library-packaging-skill / npm-package-readiness-skill",
      packageCandidateDryRun: {
        identity,
      },
      exitCode: 1,
    };
  }

  const packaging = run("./scripts/library-packaging-readiness", ["--repo", ".", "--expect-open-source", "--expect-npm"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const npmReadiness = run("./scripts/npm-package-readiness", ["--repo", ".", "--expect-package", "--allow-pack-dry-run"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const releaseNpm = run("./scripts/release-preflight", ["--repo", ".", "--mode", "npm", "--allow-pack-dry-run"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const packOriginal = inspectNpmPackDryRun(LIBRARY_ROOT);

  const packagingClassification = extractFinalClassification(packaging.stdout) || "unavailable";
  const npmReadinessClassification = extractFinalClassification(npmReadiness.stdout) || "unavailable";
  const releaseNpmClassification = extractFinalClassification(releaseNpm.stdout) || "unavailable";
  evidence.push(`library packaging readiness npm exit: ${packaging.code}; classification: ${packagingClassification}`);
  evidence.push(`npm package readiness pack dry-run exit: ${npmReadiness.code}; classification: ${npmReadinessClassification}`);
  evidence.push(`release preflight npm exit: ${releaseNpm.code}; classification: ${releaseNpmClassification}`);
  evidence.push(`npm pack dry-run JSON exit: ${packOriginal.result.code}; files: ${packOriginal.files.length}; risky paths: ${packOriginal.risks.length ? packOriginal.risks.join(", ") : "none"}`);

  const tempParent = DEFAULT_TEMP_ROOT;
  const tempPath = path.join(tempParent, `coding-workflow-library-smoke-${timestampForFolder()}-package-candidate`);
  fs.mkdirSync(tempParent, { recursive: true, mode: 0o700 });
  const copyResult = copyLibraryForSmoke(LIBRARY_ROOT, tempPath);
  ensureSmokeScriptsExecutable(tempPath);
  const packTemp = inspectNpmPackDryRun(tempPath);
  const tempRemoved = removeSmokeTempDir(tempPath);
  evidence.push(`clean temp package smoke path: ${tempPath}`);
  evidence.push(`clean temp files copied: ${copyResult.filesCopied}`);
  evidence.push(`clean temp npm pack dry-run exit: ${packTemp.result.code}; files: ${packTemp.files.length}; risky paths: ${packTemp.risks.length ? packTemp.risks.join(", ") : "none"}`);
  evidence.push(`clean temp package smoke removed: ${tempRemoved ? "yes" : "no"}`);

  const routeAudit = run("./scripts/route-audit", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const routeAuditResult = extractValidationResult(routeAudit.stdout) || "unavailable";
  const cleaner = run("./scripts/skill-cleaner", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const validator = run("./scripts/validate-skills", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const validatorResult = extractValidationResult(validator.stdout) || "unavailable";
  evidence.push(`route audit exit: ${routeAudit.code}; result: ${routeAuditResult}`);
  evidence.push(`skill-cleaner exit: ${cleaner.code}`);
  evidence.push(`validate-skills exit: ${validator.code}; result: ${validatorResult}`);
  evidence.push("remaining publish blocker: NEEDS JOHN: confirm final npm package name availability and ownership before publish");

  const commandFailures = [
    ["library packaging readiness", packaging],
    ["npm package readiness", npmReadiness],
    ["release preflight npm", releaseNpm],
    ["npm pack dry-run JSON", packOriginal.result],
    ["clean temp npm pack dry-run JSON", packTemp.result],
    ["route audit", routeAudit],
    ["skill-cleaner", cleaner],
    ["validate-skills", validator],
  ].filter(([, result]) => result.code !== 0);

  if (commandFailures.length || packOriginal.risks.length || packTemp.risks.length || !tempRemoved) {
    const blockers = [];
    if (commandFailures.length) blockers.push(`command failures: ${commandFailures.map(([name]) => name).join(", ")}`);
    if (packOriginal.risks.length) blockers.push(`original pack risks: ${packOriginal.risks.join(", ")}`);
    if (packTemp.risks.length) blockers.push(`temp pack risks: ${packTemp.risks.join(", ")}`);
    if (!tempRemoved) blockers.push("clean temp copy was not removed");
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "Package candidate dry-run blocked",
      summary: blockers.join("; "),
      nextPermission: "fix package candidate dry-run blockers",
      nextSkill: "error-evidence-skill / npm-package-readiness-skill",
      packageCandidateDryRun: {
        identity,
        packagingClassification,
        npmReadinessClassification,
        releaseNpmClassification,
        originalPackFileCount: packOriginal.files.length,
        tempPackFileCount: packTemp.files.length,
        originalPackRisks: packOriginal.risks,
        tempPackRisks: packTemp.risks,
        tempRemoved,
      },
      exitCode: 1,
    };
  }

  return {
    finalStatus: "Package candidate dry-run complete",
    ledgerStatus: "Package candidate dry-run complete",
    summary:
      `package candidate dry-run passed locally; packaging=${packagingClassification}; ` +
      `npm-readiness=${npmReadinessClassification}; release-npm=${releaseNpmClassification}; ` +
      `pack files=${packOriginal.files.length}; temp pack files=${packTemp.files.length}; validate=${validatorResult}`,
    nextPermission: "choose CLI entrypoint or run scheduled-run recheck",
    nextSkill: "skills-library-packaging-skill / npm-package-readiness-skill / production-handoff-skill",
    packageCandidateDryRun: {
      identity,
      packagingClassification,
      npmReadinessClassification,
      releaseNpmClassification,
      originalPackFileCount: packOriginal.files.length,
      tempPackFileCount: packTemp.files.length,
      originalPackRisks: packOriginal.risks,
      tempPackRisks: packTemp.risks,
      tempRemoved,
    },
    exitCode: 0,
  };
}

function runCliEntrypointPackageSmoke() {
  const expectedRepo = LIBRARY_ROOT;

  if (dryRun) {
    actions.push("would verify target repo is the local skills library");
    actions.push(`would verify package.json declares bin ${CLI_COMMAND_NAME} -> ${CLI_BIN_RELATIVE}`);
    actions.push("would run the local CLI help, route audit, package-readiness, and release-preflight commands");
    actions.push("would run package readiness with --expect-cli and npm pack dry-run");
    actions.push("would create a local tarball under <TEMP_ROOT>, install it into a clean temp consumer with --ignore-scripts --no-audit --no-fund, run the installed CLI, and remove temp files");
    actions.push("would run route audit, skill cleanup, and validation");
    actions.push("would not publish, version, tag, push, create PRs, create releases, deploy, run Supabase/Cloudflare commands, read secrets, call production endpoints, install remote dependencies, or mutate remote services");
    evidence.push(`CLI package smoke target repo: ${targetRepo}`);
    evidence.push("dry-run verified route selection without creating tarballs, writing ledger/run-log, or mutating external state");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "Package candidate dry-run complete",
      summary: "CLI package smoke route would verify local CLI metadata, run CLI/readiness/preflight checks, perform clean-temp tarball install smoke, and validate",
      nextPermission: "cli-package-smoke",
      nextSkill: "skills-library-packaging-skill / npm-package-readiness-skill / release-preflight-skill",
      exitCode: 0,
    };
  }

  if (path.resolve(targetRepo) !== expectedRepo) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "CLI entrypoint package smoke blocked",
      summary: `CLI package smoke may only run against ${expectedRepo}`,
      nextPermission: "select the local skills library repo",
      nextSkill: "coding-workflow-orchestrator-skill",
      exitCode: 1,
    };
  }

  evidence.push(`CLI package smoke repo: ${targetRepo}`);
  evidence.push("boundary: no npm publish, npm version, git tag, git push, GitHub PR/release creation, deploy, Supabase, Cloudflare, secret reads, production calls, registry mutation, or remote service mutation");

  const identity = verifyCliPackageCandidate(LIBRARY_ROOT);
  for (const item of identity.checks) {
    evidence.push(`${item.label}: ${item.ok ? "PASS" : `FAIL (${item.message})`}`);
  }
  if (!identity.ok) {
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "CLI entrypoint package smoke blocked",
      summary: `CLI package metadata checks failed: ${identity.checks.filter((item) => !item.ok).map((item) => item.label).join(", ")}`,
      nextPermission: "fix CLI package metadata",
      nextSkill: "skills-library-packaging-skill / npm-package-readiness-skill",
      cliPackageSmoke: { identity },
      exitCode: 1,
    };
  }

  const syntaxChecks = [
    ["node", ["--check", CLI_BIN_RELATIVE]],
    ["node", ["--check", "scripts/run-next"]],
    ["node", ["--check", "scripts/route-audit"]],
    ["node", ["--check", "scripts/npm-package-readiness"]],
    ["node", ["--check", "scripts/release-preflight"]],
    ["node", ["--check", "scripts/library-packaging-readiness"]],
  ].map(([command, commandArgs]) => run(command, commandArgs, { cwd: LIBRARY_ROOT, allowFailure: true }));
  evidence.push(`CLI/package script syntax checks: ${syntaxChecks.every((item) => item.code === 0) ? "passed" : "failed"}`);

  const localHelp = run("./bin/coding-workflow.js", ["--help"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const localRoutes = run("./bin/coding-workflow.js", ["routes"], { cwd: LIBRARY_ROOT, allowFailure: true });
  const localPackageReadiness = run(
    "./bin/coding-workflow.js",
    ["package-readiness", "--repo", ".", "--expect-package", "--expect-cli"],
    { cwd: LIBRARY_ROOT, allowFailure: true },
  );
  const localReleasePreflight = run(
    "./bin/coding-workflow.js",
    ["release-preflight", "--repo", ".", "--mode", "cli", "--allow-pack-dry-run"],
    { cwd: LIBRARY_ROOT, allowFailure: true },
  );

  const packagingCli = run("./scripts/library-packaging-readiness", ["--repo", ".", "--expect-cli"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const npmReadiness = run("./scripts/npm-package-readiness", ["--repo", ".", "--expect-package", "--expect-cli", "--allow-pack-dry-run"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const releaseCli = run("./scripts/release-preflight", ["--repo", ".", "--mode", "cli", "--allow-pack-dry-run"], {
    cwd: LIBRARY_ROOT,
    allowFailure: true,
  });
  const packOriginal = inspectNpmPackDryRun(LIBRARY_ROOT);
  const cliInPack = packOriginal.files.includes(CLI_BIN_RELATIVE);

  const packagingCliClassification = extractFinalClassification(packagingCli.stdout) || "unavailable";
  const npmReadinessClassification = extractFinalClassification(npmReadiness.stdout) || "unavailable";
  const releaseCliClassification = extractFinalClassification(releaseCli.stdout) || "unavailable";
  evidence.push(`local CLI help exit: ${localHelp.code}`);
  evidence.push(`local CLI routes exit: ${localRoutes.code}`);
  evidence.push(`local CLI package-readiness exit: ${localPackageReadiness.code}; classification: ${extractFinalClassification(localPackageReadiness.stdout) || "unavailable"}`);
  evidence.push(`local CLI release-preflight exit: ${localReleasePreflight.code}; classification: ${extractFinalClassification(localReleasePreflight.stdout) || "unavailable"}`);
  evidence.push(`library packaging readiness CLI exit: ${packagingCli.code}; classification: ${packagingCliClassification}`);
  evidence.push(`npm package readiness CLI pack dry-run exit: ${npmReadiness.code}; classification: ${npmReadinessClassification}`);
  evidence.push(`release preflight CLI exit: ${releaseCli.code}; classification: ${releaseCliClassification}`);
  evidence.push(`npm pack dry-run JSON exit: ${packOriginal.result.code}; files: ${packOriginal.files.length}; CLI bin included: ${cliInPack ? "yes" : "no"}; risky paths: ${packOriginal.risks.length ? packOriginal.risks.join(", ") : "none"}`);

  const tempSmoke = runCliTempInstallSmoke();
  evidence.push(`clean temp CLI smoke path: ${tempSmoke.tempPath}`);
  evidence.push(`clean temp tarball created: ${tempSmoke.tarballCreated ? "yes" : "no"}`);
  evidence.push(`clean temp package files: ${tempSmoke.files.length}; risky paths: ${tempSmoke.risks.length ? tempSmoke.risks.join(", ") : "none"}`);
  evidence.push(`clean temp npm install exit: ${tempSmoke.installCode}`);
  evidence.push(`installed CLI help exit: ${tempSmoke.helpCode}`);
  evidence.push(`installed CLI routes exit: ${tempSmoke.routesCode}`);
  evidence.push(`installed CLI validate exit: ${tempSmoke.validateCode}`);
  evidence.push(`clean temp CLI smoke removed: ${tempSmoke.removed ? "yes" : "no"}`);

  const routeAudit = run("./scripts/route-audit", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const routeAuditResult = extractValidationResult(routeAudit.stdout) || "unavailable";
  const cleaner = run("./scripts/skill-cleaner", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const validator = run("./scripts/validate-skills", [], { cwd: LIBRARY_ROOT, allowFailure: true });
  const validatorResult = extractValidationResult(validator.stdout) || "unavailable";
  evidence.push(`route audit exit: ${routeAudit.code}; result: ${routeAuditResult}`);
  evidence.push(`skill-cleaner exit: ${cleaner.code}`);
  evidence.push(`validate-skills exit: ${validator.code}; result: ${validatorResult}`);
  evidence.push("remaining publish blocker: NEEDS JOHN: confirm final npm package name availability and ownership before publish");

  const commandFailures = [
    ["local CLI help", localHelp],
    ["local CLI routes", localRoutes],
    ["local CLI package-readiness", localPackageReadiness],
    ["local CLI release-preflight", localReleasePreflight],
    ["library packaging readiness CLI", packagingCli],
    ["npm package readiness CLI", npmReadiness],
    ["release preflight CLI", releaseCli],
    ["npm pack dry-run JSON", packOriginal.result],
    ["clean temp package pack", { code: tempSmoke.packCode }],
    ["clean temp npm install", { code: tempSmoke.installCode }],
    ["installed CLI help", { code: tempSmoke.helpCode }],
    ["installed CLI routes", { code: tempSmoke.routesCode }],
    ["installed CLI validate", { code: tempSmoke.validateCode }],
    ["route audit", routeAudit],
    ["skill-cleaner", cleaner],
    ["validate-skills", validator],
    ...syntaxChecks.map((result, index) => [`syntax check ${index + 1}`, result]),
  ].filter(([, result]) => result.code !== 0);

  if (
    commandFailures.length ||
    packOriginal.risks.length ||
    !cliInPack ||
    !tempSmoke.ok ||
    tempSmoke.risks.length ||
    !tempSmoke.removed
  ) {
    const blockers = [];
    if (commandFailures.length) blockers.push(`command failures: ${commandFailures.map(([name]) => name).join(", ")}`);
    if (packOriginal.risks.length) blockers.push(`original pack risks: ${packOriginal.risks.join(", ")}`);
    if (!cliInPack) blockers.push(`${CLI_BIN_RELATIVE} missing from package dry-run contents`);
    if (!tempSmoke.ok) blockers.push(tempSmoke.summary);
    if (tempSmoke.risks.length) blockers.push(`temp pack risks: ${tempSmoke.risks.join(", ")}`);
    if (!tempSmoke.removed) blockers.push("clean temp CLI smoke folder was not removed");
    return {
      finalStatus: "BLOCKED",
      ledgerStatus: "CLI entrypoint package smoke blocked",
      summary: blockers.join("; "),
      nextPermission: "fix CLI package smoke blockers",
      nextSkill: "error-evidence-skill / npm-package-readiness-skill",
      cliPackageSmoke: {
        identity,
        packagingCliClassification,
        npmReadinessClassification,
        releaseCliClassification,
        originalPackFileCount: packOriginal.files.length,
        originalPackRisks: packOriginal.risks,
        tempSmoke,
      },
      exitCode: 1,
    };
  }

  return {
    finalStatus: "CLI entrypoint package smoke complete",
    ledgerStatus: "CLI entrypoint package smoke complete",
    summary:
      `CLI package smoke passed locally; packaging=${packagingCliClassification}; ` +
      `npm-readiness=${npmReadinessClassification}; release-cli=${releaseCliClassification}; ` +
      `pack files=${packOriginal.files.length}; installed CLI help/routes/validate passed; validate=${validatorResult}`,
    nextPermission: "run scheduled-run recheck or prepare GitHub repo handoff",
    nextSkill: "skills-library-packaging-skill / production-handoff-skill / github-handoff-skill",
    cliPackageSmoke: {
      identity,
      packagingCliClassification,
      npmReadinessClassification,
      releaseCliClassification,
      originalPackFileCount: packOriginal.files.length,
      originalPackRisks: packOriginal.risks,
      tempSmoke,
    },
    exitCode: 0,
  };
}

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
  runVerificationBundleSelfTest,
  runLocalSkillWorkpack,
  runCloudflareOpstruthPackagingBundle,
  runCleanTempReadinessSmoke,
  runLicensePackageCandidate,
  runPackageCandidateDryRun,
  runCliEntrypointPackageSmoke,
  runGithubOpenSourceHandoff,
  runFirstVersionTag,
  verifyCliPackageCandidate,
  runCliTempInstallSmoke,
  resolvePackedTarballPath,
  removeCliSmokeTempDir,
  verifyPackageCandidateIdentity,
};
