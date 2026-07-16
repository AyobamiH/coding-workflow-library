#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const entryPath = path.join(ROOT, "scripts", "run-next");
const entry = fs.readFileSync(entryPath, "utf8");
const moduleDirectory = path.join(ROOT, "scripts", "lib", "run-next");
const modules = fs.readdirSync(moduleDirectory).filter((file) => file.endsWith(".js")).sort();

assert.ok(modules.length >= 10, "run-next was not decomposed into domain modules");
assert.ok(modules.includes("runtime-context.js"), "runtime context module is missing");
assert.ok(modules.includes("checkpoints.js"), "checkpoint module is missing");
assert.ok(modules.includes("reports.js"), "reporting module is missing");
assert.doesNotMatch(entry, /function runSupabaseToolingAuth\(/, "Supabase executor leaked back into the entrypoint");
assert.doesNotMatch(entry, /function runGithubHandoff\(/, "GitHub executor leaked back into the entrypoint");
assert.doesNotMatch(entry, /function printSchedulerVaultDesignApplyReport\(/, "specialised reporting leaked back into the entrypoint");

const exported = new Set();
const lazyDependencies = [];
for (const file of modules.filter((name) => name !== "runtime-context.js")) {
  const source = fs.readFileSync(path.join(moduleDirectory, file), "utf8");
  for (const match of source.matchAll(/^  ([A-Za-z_$][A-Za-z0-9_$]*),$/gm)) exported.add(match[1]);
  for (const match of source.matchAll(/runtime\.lazy\("([A-Za-z_$][A-Za-z0-9_$]*)"\)/g)) {
    lazyDependencies.push({ file, name: match[1] });
  }
}

const entryFunctions = new Set([...entry.matchAll(/^function ([A-Za-z_$][A-Za-z0-9_$]*)\(/gm)].map((match) => match[1]));
for (const dependency of lazyDependencies) {
  assert.ok(
    exported.has(dependency.name) || entryFunctions.has(dependency.name),
    `${dependency.file} references unavailable runtime function ${dependency.name}`,
  );
}

for (const match of entry.matchAll(/runtimeApi\(\)\.([A-Za-z_$][A-Za-z0-9_$]*)\(/g)) {
  assert.ok(exported.has(match[1]), `entrypoint references unexported module function ${match[1]}`);
}

const runtime = require(path.join(moduleDirectory, "runtime-context"));
runtime.configure({ testValue: 7, add: (left, right) => left + right });
assert.equal(runtime.get("testValue"), 7, "runtime value lookup failed");
assert.equal(runtime.lazy("add")(2, 3), 5, "lazy runtime function lookup failed");
assert.throws(() => runtime.get("missing"), /dependency is unavailable/, "missing runtime dependency should fail clearly");

console.log(`run-next module tests passed: ${modules.length} modules, ${exported.size} exports, and ${lazyDependencies.length} lazy dependencies validated.`);
