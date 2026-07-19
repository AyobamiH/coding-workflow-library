#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const runtime = require("../scripts/lib/run-next/runtime-context");

const ROOT = path.resolve(__dirname, "..");
const target = fs.mkdtempSync(path.join(os.tmpdir(), "capability-intelligence-cli-route-"));

try {
  fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "capability-intelligence" }));
  runtime.configure({ args: { allow: new Set() } });
  const { selectCapabilityIntelligenceRoute } = require("../scripts/lib/run-next/capability-intelligence-route");
  const route = selectCapabilityIntelligenceRoute("Capability intelligence CLI input truth hardening requested");
  assert.equal(route.kind, "capability-intelligence-cli-input-truth");
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
      if (command === "node" && args.includes("--bogus")) {
        return { code: 1, stdout: "", stderr: "Unknown option for scan: --bogus" };
      }
      if (command === "node" && args.includes("nonsense")) {
        return { code: 1, stdout: "", stderr: "--level must be one of: critical, high, medium, low, unknown." };
      }
      if (command === "node" && args.includes("high")) return { code: 0, stdout: "[]", stderr: "" };
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const { runCapabilityIntelligenceCliInputTruth } = require("../scripts/lib/run-next/capability-intelligence-product");
  const result = runCapabilityIntelligenceCliInputTruth();
  assert.equal(result.exitCode, 0);
  assert.equal(result.objectiveStatus, "complete");
  assert.match(result.ledgerStatus, /complete locally/);

  const terminal = selectCapabilityIntelligenceRoute(result.ledgerStatus);
  assert.equal(terminal.kind, "human-boundary");
  assert.doesNotMatch(terminal.nextAction, /unknown/i);

  runtime.configure({ dryRun: true, actions: [], evidence: [] });
  const dryRun = runCapabilityIntelligenceCliInputTruth();
  assert.equal(dryRun.finalStatus, "DRY RUN PASSED");
  assert.equal(dryRun.objectiveStatus, "active");
  console.log("Capability Intelligence CLI route tests passed: selection, fail-closed probes, terminal state, and dry-run boundary.");
} finally {
  fs.rmSync(target, { recursive: true, force: true });
}
