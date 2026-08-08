#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const runtime = require("../scripts/lib/run-next/runtime-context");

const ROOT = path.resolve(__dirname, "..");
const target = fs.mkdtempSync(path.join(os.tmpdir(), "capability-intelligence-evidence-route-"));

try {
  fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "capability-intelligence" }));
  for (const file of [
    "docs/BACKLOG.md",
    "docs/MATURITY.md",
    "docs/observed-receipts.md",
    "schemas/observed-receipt.schema.json",
    "src/receipts.js",
    "test/receipts.test.js",
  ]) {
    fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
    fs.writeFileSync(path.join(target, file), "fixture\n");
  }

  runtime.configure({ args: { allow: new Set() } });
  const { selectCapabilityIntelligenceRoute } = require("../scripts/lib/run-next/capability-intelligence-route");
  const route = selectCapabilityIntelligenceRoute("Unlabelled plugin purpose audit and read-only inspection command complete locally at 5ded92a");
  assert.equal(route.kind, "capability-intelligence-evidence-truth");
  assert.deepEqual(route.requiresAuthority, ["local_execution"]);
  const { ALLOWED_FLAGS } = require("../scripts/lib/run-next/cli-control");
  assert.ok(ALLOWED_FLAGS.has(route.permission), "audited route permission was not accepted by the CLI");

  runtime.configure({
    actions: [],
    dryRun: false,
    evidence: [],
    fs,
    LIBRARY_ROOT: ROOT,
    path,
    targetRepo: target,
    run(command, args) {
      if (command === "node" && args.includes("--input-type=module")) {
        return {
          code: 0,
          stdout: JSON.stringify({
            coverage: "passed",
            count: 1,
            lifecycleUnknown: true,
            hintsSafe: true,
          }),
          stderr: "",
        };
      }
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const { runCapabilityIntelligenceEvidenceTruth } = require("../scripts/lib/run-next/capability-intelligence-product");
  const result = runCapabilityIntelligenceEvidenceTruth();
  assert.equal(result.exitCode, 0);
  assert.equal(result.objectiveStatus, "complete");
  assert.match(result.ledgerStatus, /evidence truth and maturity complete locally/i);

  const terminal = selectCapabilityIntelligenceRoute(result.ledgerStatus);
  assert.equal(terminal.kind, "human-boundary");
  assert.doesNotMatch(terminal.nextAction, /unknown/i);

  runtime.configure({ dryRun: true, actions: [], evidence: [] });
  const dryRun = runCapabilityIntelligenceEvidenceTruth();
  assert.equal(dryRun.finalStatus, "DRY RUN PASSED");
  assert.equal(dryRun.objectiveStatus, "active");
  console.log("Capability Intelligence evidence route tests passed: selection, lifecycle probes, maturity files, terminal state, and dry-run boundary.");
} finally {
  fs.rmSync(target, { recursive: true, force: true });
}
