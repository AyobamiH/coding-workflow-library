#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "extract-session-workflows.mjs");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-extraction-test-"));
const source = path.join(temp, "sources");
const output = path.join(temp, "out");
fs.mkdirSync(source, { recursive: true });

function writeJsonl(file, records) {
  fs.writeFileSync(path.join(source, file), records.map((record) => JSON.stringify(record)).join("\n") + "\n");
}

async function main() {
  const {
    extractCorpus,
    validateExistingOutput,
    writeOutputs,
  } = await import(script);

  writeJsonl("openclaw.jsonl", [
    { type: "session", timestamp: "2026-01-01T00:00:00.000Z" },
    {
      type: "message",
      timestamp: "2026-01-01T00:00:01.000Z",
      message: {
        role: "user",
        timestamp: "2026-01-01T00:00:01.000Z",
        content: [{ type: "text", text: "Please use repo-map-skill and scripts/docs-list for this agent role audit." }]
      }
    },
    {
      type: "message",
      timestamp: "2026-01-01T00:00:02.000Z",
      message: {
        role: "assistant",
        timestamp: "2026-01-01T00:00:02.000Z",
        content: [{ type: "text", text: "I will propose a command only.\n```bash\ngit status && node -e \"console.log('a;b')\" | cat\n```" }]
      }
    },
    {
      type: "message",
      timestamp: "2026-01-01T00:00:03.000Z",
      message: {
        role: "assistant",
        timestamp: "2026-01-01T00:00:03.000Z",
        content: [{ type: "toolCall", id: "call-1", name: "exec", arguments: { cmd: "npm test && git status; echo \"token=abc123abc123abc123\"" } }]
      }
    },
    {
      type: "message",
      timestamp: "2026-01-01T00:00:04.000Z",
      message: {
        role: "tool",
        toolCallId: "call-1",
        toolName: "exec",
        timestamp: "2026-01-01T00:00:04.000Z",
        content: [{ type: "text", text: "Result: PASS" }]
      }
    }
  ]);

  writeJsonl("codex.jsonl", [
    { type: "session_meta", timestamp: "2026-01-02T00:00:00.000Z", payload: { cwd: "/home/example/private" } },
    { type: "response_item", timestamp: "2026-01-02T00:00:01.000Z", payload: { type: "function_call", name: "functions.exec_command", call_id: "c1", arguments: { cmd: "rg foo /home/example/private && sed -n '1,5p' file" } } },
    { type: "response_item", timestamp: "2026-01-02T00:00:02.000Z", payload: { type: "function_call_output", call_id: "c1", output: "done" } }
  ]);

  fs.writeFileSync(path.join(source, "corrupt.jsonl"), "{\"type\":\"message\"}\nnot json\n{\"type\":\"message\",\"message\":{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"workflow corpus extraction methodology\"}]}}\n");
  fs.copyFileSync(path.join(source, "openclaw.jsonl"), path.join(source, "duplicate.jsonl"));
  fs.writeFileSync(path.join(source, "unsupported.txt"), "plain text");
  fs.writeFileSync(path.join(source, "empty.jsonl"), "");

  const dry = extractCorpus({ sources: [source], outputDir: output, includeMetaSessions: false });
  assert.equal(dry.validation.status, "PASS");
  assert.equal(fs.existsSync(output), false, "dry-run must not create output directory");

  const first = extractCorpus({ sources: [source], outputDir: output, includeMetaSessions: false });
  assert.equal(first.validation.status, "PASS");
  writeOutputs(output, first, { manifestOnly: false });

  const manifest = JSON.parse(fs.readFileSync(path.join(output, "source-manifest.json"), "utf8")).sources;
  const coverage = JSON.parse(fs.readFileSync(path.join(output, "coverage-report.json"), "utf8"));
  const events = fs.readFileSync(path.join(output, "workflow-corpus.jsonl"), "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));

  assert.ok(manifest.some((sourceRecord) => sourceRecord.parse_status === "parsed_successfully"));
  assert.ok(manifest.some((sourceRecord) => sourceRecord.parse_status === "unsupported_format"));
  assert.ok(manifest.some((sourceRecord) => sourceRecord.parse_status === "corrupted"));
  assert.ok(manifest.some((sourceRecord) => sourceRecord.parse_status === "empty"));
  assert.ok(manifest.some((sourceRecord) => sourceRecord.parse_status === "duplicate"));
  assert.ok(manifest.every((sourceRecord) => !Object.prototype.hasOwnProperty.call(sourceRecord, "local_path")));

  assert.ok(events.some((event) => event.primary_class === "SHELL_COMMAND_PROPOSED" && event.command_names.includes("git")));
  assert.ok(events.some((event) => event.primary_class === "SHELL_COMMAND_EXECUTED" && event.command_names.includes("npm") && event.command_names.includes("git")));
  assert.ok(events.some((event) => event.primary_class === "TOOL_RESULT" && event.evidence_tags.includes("VALIDATION_RESULT")));
  assert.ok(events.some((event) => event.evidence_tags.includes("EXTRACTION_META_SESSION")));
  assert.ok(events.some((event) => event.skill_mentions.includes("repo-map-skill")));
  assert.ok(events.some((event) => event.helper_mentions.includes("scripts/docs-list")));
  assert.ok(events.every((event) => !JSON.stringify(event).includes("/home/example")));
  assert.ok(events.some((event) => JSON.stringify(event).includes("<SECRET_REDACTED>")));

  const proposed = events.find((event) => event.primary_class === "SHELL_COMMAND_PROPOSED" && event.command_chain_redacted.includes("node -e"));
  assert.ok(proposed.command_components.some((component) => component.includes("a;b")), "quoted separator must stay inside component");

  const totals = coverage.totals;
  assert.equal(totals.discovered, totals.parsed + totals.unsupported + totals.corrupt + totals.empty + totals.duplicate + totals.excluded);
  assert.equal(coverage.extraction_meta_sessions, 1);

  const validation = validateExistingOutput(output);
  assert.equal(validation.status, "PASS");

  const secondOutput = path.join(temp, "out2");
  const second = extractCorpus({ sources: [source], outputDir: secondOutput, includeMetaSessions: false });
  assert.equal(second.validation.status, "PASS");
  writeOutputs(secondOutput, second, { manifestOnly: false });
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(output, "source-manifest.json"), "utf8")),
    JSON.parse(fs.readFileSync(path.join(secondOutput, "source-manifest.json"), "utf8"))
  );
  assert.deepEqual(
    fs.readFileSync(path.join(output, "workflow-corpus.jsonl"), "utf8"),
    fs.readFileSync(path.join(secondOutput, "workflow-corpus.jsonl"), "utf8")
  );

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(!JSON.stringify(packageJson.files || []).includes("workflow-corpus"));
  assert.ok(!JSON.stringify(packageJson.files || []).includes("pseudonym-map"));

  console.log("Workflow extraction tests passed: parsing, accounting, redaction, meta sessions, dry-run, schemas, and determinism.");
}

main().finally(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});
