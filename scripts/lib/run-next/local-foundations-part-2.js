"use strict";

// Licence, package-candidate, and CLI package-smoke foundations.

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

// Cross-part calls stay late-bound so the run-next registry remains cycle-safe.
const runCliTempInstallSmoke = runtime.lazy("runCliTempInstallSmoke");
const verifyCliPackageCandidate = runtime.lazy("verifyCliPackageCandidate");
const verifyPackageCandidateIdentity = runtime.lazy("verifyPackageCandidateIdentity");

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

module.exports = {
  runLicensePackageCandidate,
  runPackageCandidateDryRun,
  runCliEntrypointPackageSmoke,
};
