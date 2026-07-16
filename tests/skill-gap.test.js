#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const script = path.join(ROOT, "scripts", "add-skill-gap");
const {
  inspect,
  insertRecord,
  renderRecord,
  safetyCategories,
} = require(script);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "skill-gap-test-"));
const queue = path.join(temporary, "build-queue.md");
const baseQueue = `# Build Queue

# P1 - Current Maturity Gaps

## Existing gap

- Evidence source: Existing evidence.
- Primary type: \`VALIDATION\`.
- Dependency: Existing dependency.
- Authority required: \`local_execution\`.
- Done definition: Existing completion.
- Reason for priority: Existing reason.

# P2 - Follow-On Autonomy Improvements

## Later work

Held.
`;
const record = {
  title: "Bounded capability note",
  evidence: "Two independent local runs reported the same missing deterministic helper.",
  primaryType: "SCRIPT_OR_HELPER, VALIDATION",
  dependency: "Existing public queue and validation contracts.",
  authority: "local_execution",
  done: "A deterministic helper records one bounded entry without changing unrelated queue content.",
  reason: "Repeated manual recording makes the control rule inconsistent.",
};

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function flags(input) {
  return [
    "--queue", queue,
    "--title", input.title,
    "--evidence", input.evidence,
    "--primary-type", input.primaryType,
    "--dependency", input.dependency,
    "--authority", input.authority,
    "--done", input.done,
    "--reason", input.reason,
  ];
}

try {
  fs.writeFileSync(queue, baseQueue);

  const valid = inspect({ queueText: baseQueue, record });
  assert.equal(valid.status, "PASS", "complete safe record should pass");
  assert.equal(valid.issues.length, 0);

  const rendered = renderRecord(record);
  assert.match(rendered, /^## Bounded capability note/m);
  assert.match(rendered, /`SCRIPT_OR_HELPER`, `VALIDATION`/);
  const inserted = insertRecord(baseQueue, rendered);
  assert.equal(
    inserted,
    `${baseQueue.slice(0, baseQueue.indexOf("# P2"))}${rendered}\n\n${baseQueue.slice(baseQueue.indexOf("# P2"))}`,
  );
  assert.equal(inserted.slice(inserted.indexOf("# P2")), baseQueue.slice(baseQueue.indexOf("# P2")), "content after the insertion boundary changed");

  const beforeDryRun = fs.readFileSync(queue, "utf8");
  const dryRun = run([...flags(record), "--dry-run", "--json"]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  const dryReport = JSON.parse(dryRun.stdout);
  assert.equal(dryReport.mode, "dry-run");
  assert.equal(dryReport.written, false);
  assert.equal(fs.readFileSync(queue, "utf8"), beforeDryRun, "dry-run mutated the queue");

  const write = run([...flags(record), "--json"]);
  assert.equal(write.status, 0, write.stderr);
  const writeReport = JSON.parse(write.stdout);
  assert.equal(writeReport.written, true);
  const updated = fs.readFileSync(queue, "utf8");
  assert.match(updated, /## Bounded capability note/);
  assert.equal(updated.slice(updated.indexOf("# P2")), baseQueue.slice(baseQueue.indexOf("# P2")), "write changed content after P2");

  const duplicate = run([...flags(record), "--dry-run", "--json"]);
  assert.equal(duplicate.status, 1, "duplicate record should fail");
  const duplicateReport = JSON.parse(duplicate.stdout);
  assert.ok(duplicateReport.issues.some((issue) => issue.category === "duplicate-title"));
  assert.equal(fs.readFileSync(queue, "utf8"), updated, "duplicate attempt changed the queue");

  const incomplete = inspect({ queueText: baseQueue, record: { title: "Incomplete" } });
  assert.equal(incomplete.status, "FAIL");
  assert.ok(incomplete.issues.some((issue) => issue.category === "missing-field"));

  const privatePath = ["", "home", "maintainer", "private", "source"].join("/");
  const unsafe = inspect({
    queueText: baseQueue,
    record: { ...record, title: "Unsafe note", evidence: `Observed in ${privatePath}` },
  });
  assert.equal(unsafe.status, "FAIL");
  assert.ok(unsafe.issues.some((issue) => issue.category === "posix-user-home"));
  assert.doesNotMatch(JSON.stringify(unsafe), /maintainer|private\/source/, "unsafe report repeated rejected content");
  assert.deepEqual(safetyCategories("Use $HOME/project or <TARGET_REPO>."), []);

  const validate = run(["--queue", queue, "--validate", "--json"]);
  assert.equal(validate.status, 0, validate.stderr);
  assert.equal(JSON.parse(validate.stdout).candidate_present, false);

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.ok((packageJson.files || []).includes("scripts/"));
  assert.ok((packageJson.files || []).includes("schemas/"));
  assert.ok((packageJson.files || []).includes("tests/"));

  console.log("skill-gap tests passed: bounded insertion, dry-run, validation, duplicate refusal, malformed input, and safe reporting.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
