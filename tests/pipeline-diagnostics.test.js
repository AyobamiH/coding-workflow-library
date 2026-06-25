#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { inspectSource } = require("../scripts/pipeline-diagnostics");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-diagnostics-"));
const source = path.join(directory, "pipeline.ts");

try {
  fs.writeFileSync(source, `
const SUBREDDITS = ["one", "two"];
async function fetchItems() { return await fetch("https://example.invalid"); }
Deno.serve(async () => {
  const allPosts = await fetchItems();
  const candidates = allPosts.filter((item) => item.score > 1);
  const existingIds = new Set();
  const fresh = candidates.filter((item) => !existingIds.has(item.id));
  const inserted = [];
  await client.from("items").insert({ id: fresh[0]?.id });
  return jsonResponse({
    candidates: candidates.length,
    fresh: fresh.length,
    inserted: inserted.length,
    skipped: 0,
  }, 200);
});
`);
  const report = inspectSource(source);
  assert.equal(report.configured_sources.count, 2);
  assert.deepEqual(report.database_tables, ["items"]);
  assert.ok(report.filter_lines.length >= 2);
  assert.ok(report.insert_lines.length === 1);
  assert.ok(report.response_counters.some((item) => item.counter === "candidates" && item.expression === "candidates.length"));
  assert.ok(report.stages.find((item) => item.stage === "upstream retrieval").present);
  console.log("Pipeline diagnostics tests passed: staged trace, configured sources, filters, tables, insert, and response counters.");
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
