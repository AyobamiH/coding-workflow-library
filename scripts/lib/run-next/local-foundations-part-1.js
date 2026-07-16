"use strict";

// Local verification, reusable workpacks, packaging bundles, and clean-temp smoke.

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

module.exports = {
  runVerificationBundleSelfTest,
  runLocalSkillWorkpack,
  runCloudflareOpstruthPackagingBundle,
  runCleanTempReadinessSmoke,
};
