#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const { inspectRepository } = require(path.join(ROOT, "scripts", "check-module-size"));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "module-size-"));

try {
  fs.mkdirSync(path.join(temporary, "scripts", "lib"), { recursive: true });
  fs.writeFileSync(path.join(temporary, "scripts", "small.js"), "const value = 1;\n");
  fs.writeFileSync(path.join(temporary, "scripts", "lib", "large.js"), "line\n".repeat(8));
  fs.mkdirSync(path.join(temporary, "node_modules", "ignored"), { recursive: true });
  fs.writeFileSync(path.join(temporary, "node_modules", "ignored", "huge.js"), "line\n".repeat(50));

  const failed = inspectRepository({ repo: temporary, maxLines: 5 });
  assert.deepEqual(failed.oversized, [{ path: "scripts/lib/large.js", lines: 9 }], "nested oversized module should be reported");

  fs.writeFileSync(path.join(temporary, "scripts", "lib", "large.js"), "line\n".repeat(3));
  const passed = inspectRepository({ repo: temporary, maxLines: 5 });
  assert.equal(passed.oversized.length, 0, "bounded modules should pass");

  const repository = inspectRepository({ repo: ROOT, maxLines: 2200 });
  assert.equal(repository.oversized.length, 0, `repository module-size check failed: ${JSON.stringify(repository.oversized)}`);

  console.log("module size tests passed: nested discovery, hard limit, exclusions, and repository budget.");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
