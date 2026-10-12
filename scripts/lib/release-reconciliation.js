"use strict";
const fs = require("fs");
const path = require("path");

const NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
function validate(config) {
  if (config?.schemaVersion !== 1 || !Array.isArray(config.packages) || !config.packages.length || config.packages.length > 50) throw new Error("INVALID_CONFIG");
  const names = new Set();
  for (const p of config.packages) {
    if (!NAME.test(p.name || "") || !REPO.test(p.repository || "") || !/^[a-z][a-z0-9-]*$/.test(p.tag || "") || names.has(p.name)) throw new Error("INVALID_PACKAGE");
    names.add(p.name);
    if (p.baseline && (!VERSION.test(p.baseline.version || "") || !/^[a-f0-9]{40}$/.test(p.baseline.commit || ""))) throw new Error("INVALID_BASELINE");
  }
  if (config.consumers !== undefined && (!Array.isArray(config.consumers) || config.consumers.length > 50)) throw new Error("INVALID_CONSUMERS");
  for (const c of config.consumers || []) {
    if (!/^[a-z0-9-]{1,60}$/.test(c.id || "") || !path.isAbsolute(c.root || "")) throw new Error("INVALID_CONSUMER");
  }
  return config;
}
function repository(value) {
  const raw = typeof value === "string" ? value : value?.url;
  const m = /^(?:git\+)?https:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(raw || "");
  return m ? m[1].toLowerCase() : null;
}
async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "error", headers: { Accept: "application/json", "User-Agent": "coding-workflow-release-reconciliation" } });
    if (!res.ok) throw new Error(res.status === 404 ? "NOT_FOUND" : res.status === 429 || res.status === 403 ? "RATE_OR_ACCESS_LIMIT" : "HTTP_FAILURE");
    const chunks = []; let bytes = 0;
    for await (const chunk of res.body) {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) throw new Error("RESPONSE_TOO_LARGE");
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
  } finally { clearTimeout(timer); }
}
function readJson(file, root) {
  const realRoot = fs.realpathSync(root), real = fs.realpathSync(file);
  if (!real.startsWith(realRoot + path.sep) || !fs.statSync(real).isFile() || fs.statSync(real).size > 8 * 1024 * 1024) throw new Error("UNSAFE_METADATA");
  return JSON.parse(fs.readFileSync(real, "utf8"));
}
function consumer(c, name, target) {
  const result = { id: c.id, declared: "UNKNOWN", locked: "UNKNOWN", installed: "UNKNOWN", runtime: "NOT_OBSERVED" };
  function version(v) { return VERSION.test(v || "") ? v : "UNKNOWN"; }
  try {
    const p = readJson(path.join(c.root, "package.json"), c.root);
    const spec = p.dependencies?.[name] || p.devDependencies?.[name] || p.optionalDependencies?.[name];
    result.declared = spec === undefined ? "NOT_DECLARED" : VERSION.test(spec) ? spec : "RANGE_OR_OTHER_SPEC";
  } catch { /* Missing or unsafe metadata is unknown, never aligned. */ }
  try {
    const lock = readJson(path.join(c.root, "package-lock.json"), c.root);
    result.locked = version(lock.packages?.["node_modules/" + name]?.version || lock.dependencies?.[name]?.version);
  } catch { /* npm locks only; other package managers stay unknown. */ }
  try {
    const p = readJson(path.join(c.root, "node_modules", name, "package.json"), c.root);
    result.installed = p.name === name ? version(p.version) : "UNKNOWN";
  } catch { /* No recursive discovery or symlink escape. */ }
  result.status = !target ? "UNKNOWN" : [result.locked, result.installed].some(v => VERSION.test(v) && v !== target) ? "VERSION_DIFFERS" : result.installed === target ? "INSTALLED_MATCH" : result.locked === target ? "LOCK_MATCH_ONLY" : "UNKNOWN";
  return result;
}
async function reconcile(config, get = getJson) {
  validate(config);
  const rows = [];
  for (const p of config.packages) {
    const row = { name: p.name, repository: p.repository, tag: p.tag, findings: [], consumers: [], source: null, registry: null, sourceRelation: "UNKNOWN" };
    try {
      const api = "https://api.github.com/repos/" + p.repository;
      const head = await get(api + "/commits/HEAD");
      if (!/^[a-f0-9]{40}$/.test(head.sha || "")) throw new Error("INVALID_HEAD");
      const content = await get(api + "/contents/package.json?ref=" + head.sha);
      if (content.encoding !== "base64" || typeof content.content !== "string") throw new Error("INVALID_SOURCE");
      const source = JSON.parse(Buffer.from(content.content, "base64").toString());
      if (!VERSION.test(source.version || "")) throw new Error("INVALID_SOURCE");
      row.source = { commit: head.sha, version: source.version };
      if (source.name !== p.name || repository(source.repository) !== p.repository.toLowerCase()) row.findings.push("SOURCE_IDENTITY_MISMATCH");
    } catch { row.findings.push("SOURCE_UNAVAILABLE"); }
    try {
      const meta = await get("https://registry.npmjs.org/" + encodeURIComponent(p.name));
      const version = meta["dist-tags"]?.[p.tag], release = meta.versions?.[version];
      if (!VERSION.test(version || "") || !release || release.name !== p.name || release.version !== version) throw new Error("INVALID_REGISTRY");
      row.registry = { version, integrity: /^sha512-[A-Za-z0-9+/]+=*$/.test(release.dist?.integrity || "") ? release.dist.integrity : null };
      if (!row.registry.integrity) row.findings.push("REGISTRY_INTEGRITY_MISSING");
      if (repository(release.repository) !== p.repository.toLowerCase()) row.findings.push("REGISTRY_IDENTITY_MISMATCH");
      if (row.source && row.source.version !== version) row.findings.push("SOURCE_VERSION_DIFFERS");
      if (p.baseline?.version === version && row.source) {
        row.baseline = p.baseline;
        if (row.source.commit === p.baseline.commit) row.sourceRelation = "EXACT_BASELINE";
        else {
          const cmp = await get("https://api.github.com/repos/" + p.repository + "/compare/" + p.baseline.commit + "..." + row.source.commit);
          if (cmp.status === "ahead") row.sourceRelation = "SOURCE_AHEAD_REVIEW_REQUIRED";
          else if (cmp.status === "identical") row.sourceRelation = "EXACT_BASELINE";
          else row.sourceRelation = "DIVERGED_OR_BEHIND";
        }
      }
      if (row.sourceRelation !== "EXACT_BASELINE") row.findings.push(row.sourceRelation);
    } catch { row.findings.push("REGISTRY_OR_COMPARISON_UNAVAILABLE"); }
    row.consumers = (config.consumers || []).map(c => consumer(c, p.name, row.registry?.version));
    if (!row.consumers.length) row.findings.push("CONSUMERS_NOT_CONFIGURED");
    if (row.consumers.some(c => c.status === "VERSION_DIFFERS")) row.findings.push("CONSUMER_VERSION_DIFFERS");
    if (row.consumers.some(c => c.status === "UNKNOWN")) row.findings.push("CONSUMER_VERSION_UNKNOWN");
    row.status = row.findings.length ? "REVIEW" : "OBSERVED_MATCH";
    rows.push(row);
  }
  return { schemaVersion: 1, observedAt: new Date().toISOString(), status: rows.some(r => r.status === "REVIEW") ? "REVIEW" : "OBSERVED_MATCH", packages: rows,
    boundaries: ["Public metadata GET requests only; no npm credentials.", "Baseline commits are configured release evidence, not independently proven artifact provenance.", "Source-ahead includes documentation changes; review before deciding to release.", "Consumer metadata does not prove the version loaded by a running process.", "No installation, publication, tagging, service control or runtime mutation."] };
}
module.exports = { validate, repository, consumer, reconcile };
