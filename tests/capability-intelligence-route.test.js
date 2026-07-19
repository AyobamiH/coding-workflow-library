#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const runtime = require("../scripts/lib/run-next/runtime-context");

const ROOT = path.resolve(__dirname, "..");
const target = fs.mkdtempSync(path.join(os.tmpdir(), "capability-intelligence-route-"));

try {
  fs.writeFileSync(path.join(target, "package.json"), JSON.stringify({ name: "capability-intelligence" }));
  runtime.configure({ args: { allow: new Set() } });
  const { selectCapabilityIntelligenceRoute } = require("../scripts/lib/run-next/capability-intelligence-route");
  const route = selectCapabilityIntelligenceRoute("Capability intelligence outcome search truth hardening requested");
  assert.equal(route.kind, "capability-intelligence-search-truth");
  assert.deepEqual(route.requiresAuthority, ["local_execution"]);
  assert.equal(selectCapabilityIntelligenceRoute("Unrelated state"), null);
  const { ALLOWED_FLAGS } = require("../scripts/lib/run-next/cli-control");
  assert.ok(ALLOWED_FLAGS.has(route.permission), "audited route permission was not accepted by the CLI");
  const terminal = selectCapabilityIntelligenceRoute("Capability intelligence outcome search truth hardening complete locally");
  assert.equal(terminal.kind, "human-boundary");
  assert.doesNotMatch(terminal.nextAction, /unknown/i);

  runtime.configure({
    actions: [],
    dryRun: false,
    evidence: [],
    fs,
    LIBRARY_ROOT: ROOT,
    path,
    targetRepo: target,
    run(command, args) {
      if (command === "node" && args.includes("qxvplm")) return { code: 2, stdout: "[]", stderr: "" };
      if (command === "node" && args.includes("create a product video")) {
        return { code: 0, stdout: JSON.stringify([{ matched: ["video"] }]), stderr: "" };
      }
      return { code: 0, stdout: "", stderr: "" };
    },
  });
  const { runCapabilityIntelligenceSearchTruth } = require("../scripts/lib/run-next/capability-intelligence-product");
  const result = runCapabilityIntelligenceSearchTruth();
  assert.equal(result.exitCode, 0);
  assert.equal(result.objectiveStatus, "complete");
  assert.match(result.ledgerStatus, /complete locally/);

  runtime.configure({ dryRun: true, actions: [], evidence: [] });
  const dryRun = runCapabilityIntelligenceSearchTruth();
  assert.equal(dryRun.finalStatus, "DRY RUN PASSED");
  assert.equal(dryRun.objectiveStatus, "active");
  console.log("Capability Intelligence route tests passed: selection, local validation contract, and dry-run boundary.");
} finally {
  fs.rmSync(target, { recursive: true, force: true });
}
