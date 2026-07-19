"use strict";

const runtime = require("./runtime-context");

function parseJson(text, fallback) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    return fallback;
  }
}

function runCapabilityIntelligenceSearchTruth() {
  const { actions, dryRun, evidence, fs, LIBRARY_ROOT, path, targetRepo } = runtime.pick([
    "actions",
    "dryRun",
    "evidence",
    "fs",
    "LIBRARY_ROOT",
    "path",
    "targetRepo",
  ]);
  const run = runtime.lazy("run");

  if (dryRun) {
    actions.push("would verify the target is the standalone capability-intelligence package");
    actions.push("would run focused search, CLI, and HTTP regressions");
    actions.push("would run the complete local check and strict read-only inventory scan");
    actions.push("would prove unmatched and empty outcome searches return no capabilities");
    actions.push("would stop before commit, push, publication, release, deploy, capability execution, or secret access");
    evidence.push("dry-run selected the outcome-search truth route without changing the target or lane state");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "Capability intelligence outcome search truth hardening requested",
      summary: "search relevance and readiness ordering would be validated locally with no external consequence",
      nextPermission: "capability-intelligence-search-truth",
      nextSkill: "capability-intelligence-builder-skill",
      objectiveStatus: "active",
      exitCode: 0,
    };
  }

  const packagePath = path.join(targetRepo, "package.json");
  const packageJson = fs.existsSync(packagePath)
    ? parseJson(fs.readFileSync(packagePath, "utf8"), null)
    : null;
  if (packageJson?.name !== "capability-intelligence") {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: "Capability intelligence outcome search truth hardening blocked",
      summary: "target package is not capability-intelligence",
      nextPermission: "select the Capability Intelligence repository",
      nextSkill: "repo-map-skill",
      objectiveStatus: "blocked",
      exitCode: 1,
    };
  }

  const checks = [
    ["focused search tests", run("node", ["--test", "test/scanner.test.js", "test/cli-server.test.js"], { cwd: targetRepo })],
    ["complete local check", run("npm", ["run", "check"], { cwd: targetRepo })],
    ["documentation inventory", run(path.join(LIBRARY_ROOT, "scripts", "docs-list"), ["--repo", targetRepo, "--json"], { cwd: LIBRARY_ROOT })],
    ["repository map validation", run(path.join(LIBRARY_ROOT, "scripts", "repo-map"), ["--repo", targetRepo, "--validate"], { cwd: LIBRARY_ROOT })],
  ];
  const unmatched = run("node", ["bin/capability-intelligence.js", "ask", "qxvplm", "--json"], {
    cwd: targetRepo,
    allowFailure: true,
  });
  const relevant = run("node", ["bin/capability-intelligence.js", "ask", "create a product video", "--json"], {
    cwd: targetRepo,
    allowFailure: true,
  });
  const unmatchedResults = parseJson(unmatched.stdout, null);
  const relevantResults = parseJson(relevant.stdout, null);
  const probeChecks = [
    ["unmatched query exits with no-match status", unmatched.code === 2],
    ["unmatched query returns an empty result set", Array.isArray(unmatchedResults) && unmatchedResults.length === 0],
    ["relevant query succeeds", relevant.code === 0],
    ["relevant query returns matched capabilities", Array.isArray(relevantResults) && relevantResults.length > 0],
    ["every relevant result records a matched term", Array.isArray(relevantResults) && relevantResults.every((item) => item.matched?.length > 0)],
  ];

  for (const [name, result] of checks) evidence.push(`${name}: ${result.code === 0 ? "PASS" : "FAIL"}`);
  for (const [name, passed] of probeChecks) evidence.push(`${name}: ${passed ? "PASS" : "FAIL"}`);
  evidence.push("boundary: local read-only inventory only; no remote publication, capability invocation, secret access, deployment, or production mutation");

  const failures = [
    ...checks.filter(([, result]) => result.code !== 0).map(([name]) => name),
    ...probeChecks.filter(([, passed]) => !passed).map(([name]) => name),
  ];
  if (failures.length) {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: "Capability intelligence outcome search truth hardening blocked",
      summary: `local truth checks failed: ${failures.join(", ")}`,
      nextPermission: "repair the bounded local search defect and rerun validation",
      nextSkill: "capability-intelligence-builder-skill / error-evidence-skill",
      objectiveStatus: "blocked",
      exitCode: 1,
    };
  }

  return {
    finalStatus: "Capability intelligence outcome search truth hardening complete locally",
    ledgerStatus: "Capability intelligence outcome search truth hardening complete locally",
    summary: "positive relevance is required before readiness ranking; unmatched search, focused tests, full local checks, docs inventory, and repo-map validation passed",
    nextPermission: "review CLI input validation defects or select another evidence-backed product objective",
    nextSkill: "capability-intelligence-builder-skill",
    objectiveStatus: "complete",
    exitCode: 0,
  };
}

function runCapabilityIntelligenceCliInputTruth() {
  const { actions, dryRun, evidence, fs, LIBRARY_ROOT, path, targetRepo } = runtime.pick([
    "actions",
    "dryRun",
    "evidence",
    "fs",
    "LIBRARY_ROOT",
    "path",
    "targetRepo",
  ]);
  const run = runtime.lazy("run");

  if (dryRun) {
    actions.push("would verify the target is the standalone capability-intelligence package");
    actions.push("would prove unsupported options and invalid risk levels fail before inventory work");
    actions.push("would prove documented risk levels still succeed");
    actions.push("would run focused CLI tests, the complete local check, docs inventory, and repo-map validation");
    actions.push("would stop before commit, push, publication, release, deploy, capability execution, or secret access");
    evidence.push("dry-run selected the CLI input-truth route without changing the target or lane state");
    return {
      finalStatus: "DRY RUN PASSED",
      ledgerStatus: "Capability intelligence CLI input truth hardening requested",
      summary: "command-specific option and risk-level validation would be proved locally with no external consequence",
      nextPermission: "capability-intelligence-cli-input-truth",
      nextSkill: "capability-intelligence-builder-skill",
      objectiveStatus: "active",
      exitCode: 0,
    };
  }

  const packagePath = path.join(targetRepo, "package.json");
  const packageJson = fs.existsSync(packagePath)
    ? parseJson(fs.readFileSync(packagePath, "utf8"), null)
    : null;
  if (packageJson?.name !== "capability-intelligence") {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: "Capability intelligence CLI input truth hardening blocked",
      summary: "target package is not capability-intelligence",
      nextPermission: "select the Capability Intelligence repository",
      nextSkill: "repo-map-skill",
      objectiveStatus: "blocked",
      exitCode: 1,
    };
  }

  const checks = [
    ["focused CLI tests", run("node", ["--test", "test/cli-server.test.js"], { cwd: targetRepo })],
    ["complete local check", run("npm", ["run", "check"], { cwd: targetRepo })],
    ["documentation inventory", run(path.join(LIBRARY_ROOT, "scripts", "docs-list"), ["--repo", targetRepo, "--json"], { cwd: LIBRARY_ROOT })],
    ["repository map validation", run(path.join(LIBRARY_ROOT, "scripts", "repo-map"), ["--repo", targetRepo, "--validate"], { cwd: LIBRARY_ROOT })],
  ];
  const unknownOption = run("node", ["bin/capability-intelligence.js", "scan", "--bogus", "value"], {
    cwd: targetRepo,
    allowFailure: true,
  });
  const invalidRisk = run("node", ["bin/capability-intelligence.js", "risks", "--level", "nonsense"], {
    cwd: targetRepo,
    allowFailure: true,
  });
  const validRisk = run("node", ["bin/capability-intelligence.js", "risks", "--level", "high", "--json"], {
    cwd: targetRepo,
    allowFailure: true,
  });
  const validRiskRecords = parseJson(validRisk.stdout, null);
  const probeChecks = [
    ["unsupported option exits non-zero", unknownOption.code === 1],
    ["unsupported option is named safely", /unknown option.+--bogus/i.test(unknownOption.stderr)],
    ["invalid risk level exits non-zero", invalidRisk.code === 1],
    ["invalid risk error lists the accepted model", /critical.+high.+medium.+low.+unknown/i.test(invalidRisk.stderr)],
    ["documented risk level succeeds", validRisk.code === 0],
    ["documented risk level returns only requested records", Array.isArray(validRiskRecords) && validRiskRecords.every((item) => item.risk?.level === "high")],
  ];

  for (const [name, result] of checks) evidence.push(`${name}: ${result.code === 0 ? "PASS" : "FAIL"}`);
  for (const [name, passed] of probeChecks) evidence.push(`${name}: ${passed ? "PASS" : "FAIL"}`);
  evidence.push("boundary: local read-only inventory only; no remote publication, capability invocation, secret access, deployment, or production mutation");

  const failures = [
    ...checks.filter(([, result]) => result.code !== 0).map(([name]) => name),
    ...probeChecks.filter(([, passed]) => !passed).map(([name]) => name),
  ];
  if (failures.length) {
    return {
      finalStatus: "BLOCKED_SAFETY",
      ledgerStatus: "Capability intelligence CLI input truth hardening blocked",
      summary: `local CLI truth checks failed: ${failures.join(", ")}`,
      nextPermission: "repair the bounded local CLI validation defect and rerun validation",
      nextSkill: "capability-intelligence-builder-skill / error-evidence-skill",
      objectiveStatus: "blocked",
      exitCode: 1,
    };
  }

  return {
    finalStatus: "Capability intelligence CLI input truth hardening complete locally",
    ledgerStatus: "Capability intelligence CLI input truth hardening complete locally",
    summary: "command-specific options and risk levels fail closed before scanning; focused tests, full local checks, docs inventory, and repo-map validation passed",
    nextPermission: "review export overwrite safety or select another evidence-backed product objective",
    nextSkill: "capability-intelligence-builder-skill",
    objectiveStatus: "complete",
    exitCode: 0,
  };
}

module.exports = {
  runCapabilityIntelligenceCliInputTruth,
  runCapabilityIntelligenceSearchTruth,
};
