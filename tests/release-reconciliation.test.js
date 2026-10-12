"use strict";
const assert = require("assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const { validate, consumer, reconcile } = require("../scripts/lib/release-reconciliation");
const old = "a".repeat(40), head = "b".repeat(40);
const p = { name: "test-package", repository: "Example/project", tag: "next", baseline: { version: "1.0.0-rc.1", commit: old } };
function fixture(options = {}) {
  return async url => {
    if (options.fail) throw new Error("secret-shaped upstream details");
    if (url.includes("/commits/")) return { sha: options.ahead ? head : old };
    if (url.includes("/contents/")) return { encoding: "base64", content: Buffer.from(JSON.stringify({ name: p.name, version: options.version || p.baseline.version, repository: "https://github.com/Example/project" })).toString("base64") };
    if (url.includes("/compare/")) return { status: "ahead" };
    return { "dist-tags": { latest: "0.9.0", next: p.baseline.version }, versions: { [p.baseline.version]: { name: p.name, version: p.baseline.version, repository: "git+https://github.com/" + (options.wrongRepo ? "Other/fork" : "Example/project") + ".git", dist: { integrity: "sha512-YWJjZA==" } } } };
  };
}
(async () => {
  const config = { schemaVersion: 1, packages: [p] };
  const r = await reconcile(config, fixture());
  assert.equal(r.packages[0].registry.version, "1.0.0-rc.1");
  assert.equal(r.packages[0].sourceRelation, "EXACT_BASELINE");
  assert(r.packages[0].findings.includes("CONSUMERS_NOT_CONFIGURED"));
  assert((await reconcile(config, fixture({ ahead: true }))).packages[0].findings.includes("SOURCE_AHEAD_REVIEW_REQUIRED"));
  assert((await reconcile(config, fixture({ version: "1.1.0" }))).packages[0].findings.includes("SOURCE_VERSION_DIFFERS"));
  assert((await reconcile(config, fixture({ wrongRepo: true }))).packages[0].findings.includes("REGISTRY_IDENTITY_MISMATCH"));
  const failed = await reconcile(config, fixture({ fail: true }));
  assert.equal(failed.status, "REVIEW"); assert(!JSON.stringify(failed).includes("secret-shaped"));
  assert.throws(() => validate({ ...config, packages: [{ ...p, name: "../escape" }] }));
  assert.throws(() => validate({ ...config, packages: [{ ...p, repository: "evil.test/a/b" }] }));
  assert.throws(() => validate({ ...config, packages: [p, p] }));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-consumer-"));
  try {
    fs.mkdirSync(path.join(root, "node_modules", p.name), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: { [p.name]: "^1.0.0" } }));
    fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ packages: { ["node_modules/" + p.name]: { version: "0.9.0" } } }));
    fs.writeFileSync(path.join(root, "node_modules", p.name, "package.json"), JSON.stringify({ name: p.name, version: p.baseline.version }));
    const c = consumer({ id: "fixture", root }, p.name, p.baseline.version);
    assert.equal(c.status, "VERSION_DIFFERS"); assert.equal(c.runtime, "NOT_OBSERVED");
    assert(!JSON.stringify(c).includes(root)); assert.equal(c.declared, "RANGE_OR_OTHER_SPEC");
    fs.unlinkSync(path.join(root, "package-lock.json"));
    assert.equal(consumer({ id: "fixture", root }, p.name, p.baseline.version).status, "INSTALLED_MATCH");
    const cli = spawnSync(process.execPath, [path.join(__dirname, "../scripts/release-reconciliation"), "--config", path.join(root, "missing.json")], { encoding: "utf8" });
    assert.equal(cli.status, 2); assert(!cli.stderr.includes(root));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  console.log("Release reconciliation contracts passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
