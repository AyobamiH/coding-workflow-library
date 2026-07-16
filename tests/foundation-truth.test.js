#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function section(markdown, heading, nextHeading) {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, `missing heading: ${heading}`);
  const bodyStart = start + heading.length;
  const end = nextHeading ? markdown.indexOf(nextHeading, bodyStart) : markdown.length;
  assert.notEqual(end, -1, `missing next heading: ${nextHeading}`);
  return markdown.slice(bodyStart, end);
}

const queue = read("build-queue.md");
const roadmap = read("docs/agent-and-skill-roadmap.md");
const maturity = read("docs/workflow-maturity-foundations.md");
const workflow = read(".github/workflows/validate.yml");

const implementedHelpers = [
  "scripts/add-skill-gap",
  "scripts/autonomy-outcomes",
  "scripts/multi-project-proof",
];

for (const helper of implementedHelpers) {
  assert.ok(fs.existsSync(path.join(ROOT, helper)), `implemented helper missing from source: ${helper}`);
  assert.ok(roadmap.includes(`\`${helper}\``), `implemented helper missing from roadmap: ${helper}`);
}

const missingHelpers = section(roadmap, "Missing helpers:", "## Routes And Control Plane");
assert.match(missingHelpers, /None currently evidence-backed/);
for (const helper of implementedHelpers) {
  assert.ok(!missingHelpers.includes(helper), `implemented helper still listed as missing: ${helper}`);
}

assert.ok(!roadmap.includes("Documented missing skills:"), "held capability is still described as a missing skill");
assert.ok(!roadmap.includes("(implemented locally)"), "roadmap contains stale local-only implementation status");
assert.ok(!queue.includes("remote CI remains unverified"), "queue contradicts recorded remote portability proof");
assert.match(queue, /No active P1 gaps are currently evidence-backed/);
assert.match(queue, /GitHub Actions run `29484530598`/);
assert.match(maturity, /official v7 releases/);
assert.match(maturity, /exact remote proof for this dependency update remains pending publication/);

const actionUses = [...workflow.matchAll(/uses:\s+actions\/(checkout|setup-node)@v(\d+)/g)];
assert.equal(actionUses.length, 4, "expected checkout and setup-node in both CI jobs");
for (const [, action, major] of actionUses) {
  assert.ok(Number(major) >= 7, `${action} must use the Node 24 action generation`);
}
assert.ok(!workflow.includes("actions/checkout@v4"), "deprecated checkout action remains");
assert.ok(!workflow.includes("actions/setup-node@v4"), "deprecated setup-node action remains");

console.log("Foundation truth validation passed.");
