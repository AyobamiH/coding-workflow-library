#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "docs-list");
const {
  buildInventory,
  classify,
  extractTitle,
} = require(script);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "docs-list-test-"));

function write(relativePath, text) {
  const full = path.join(temp, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

try {
  write("README.md", [
    "# Fixture Readme",
    "",
    "- docs/current.md",
    "- docs/nested/deep.md",
    "- docs/space doc.md",
    "- docs/no-h1.md",
    "- skill-files/example-skill.md",
    "- templates/example-template.md",
    "- tests/library-validation-checklist.md",
  ].join("\n"));
  write("RUNBOOK.md", "# Fixture Runbook\n");
  write("skills-index.md", "# Skills Index\n\n- skill-files/example-skill.md\n");
  write("docs/agent-and-skill-roadmap.md", "# Roadmap\n\n- docs/current.md\n");
  write("build-queue.md", "# Queue\n");
  write("docs/current.md", "# Current Doc\n");
  write("docs/nested/deep.md", "# Deep Doc\n");
  write("docs/space doc.md", "# Space Doc\n");
  write("docs/orphan.md", "# Orphan Doc\n");
  write("docs/no-h1.md", "No heading here\n");
  write("docs/dup-a.md", "# Duplicate\n");
  write("docs/dup-b.md", "# Duplicate\n");
  write("docs/releases/v0.1.0.md", "# v0.1.0\n");
  write("skill-files/example-skill.md", "# Example Skill\n");
  write("templates/example-template.md", "# Example Template\n");
  write("tests/library-validation-checklist.md", "# Checklist\n");
  write("state/workflow-corpus/private.md", "# Private Corpus\n");
  write(".run-next/private.md", "# Private Run State\n");
  write("node_modules/pkg/README.md", "# Dependency Readme\n");

  const trackedFiles = [
    "README.md",
    "RUNBOOK.md",
    "skills-index.md",
    "docs/agent-and-skill-roadmap.md",
    "build-queue.md",
    "docs/current.md",
    "docs/nested/deep.md",
    "docs/space doc.md",
    "docs/orphan.md",
    "docs/no-h1.md",
    "docs/dup-a.md",
    "docs/dup-b.md",
    "docs/releases/v0.1.0.md",
    "skill-files/example-skill.md",
    "templates/example-template.md",
    "tests/library-validation-checklist.md",
    "state/workflow-corpus/private.md",
    ".run-next/private.md",
    "node_modules/pkg/README.md",
  ];

  const report = buildInventory({ repo: temp, trackedFiles });
  const paths = report.documents.map((doc) => doc.path);

  assert.ok(paths.includes("README.md"), "root documentation should be discovered");
  assert.ok(paths.includes("docs/nested/deep.md"), "nested docs should be discovered");
  assert.equal(report.documents.find((doc) => doc.path === "skill-files/example-skill.md").category, "skill");
  assert.equal(report.documents.find((doc) => doc.path === "templates/example-template.md").category, "template");
  assert.equal(report.documents.find((doc) => doc.path === "docs/releases/v0.1.0.md").category, "release");
  assert.deepEqual(paths, [...paths].sort((a, b) => a.localeCompare(b)), "documents should sort deterministically");
  assert.equal(extractTitle("# Hello\n"), "Hello");
  assert.ok(report.warnings.missing_h1.includes("docs/no-h1.md"), "missing H1 should be reported");
  assert.equal(report.warnings.duplicate_titles.length, 1, "duplicate titles should be reported");
  assert.ok(report.warnings.orphans.includes("docs/orphan.md"), "orphan documents should be reported");
  assert.ok(!report.warnings.orphans.includes("docs/current.md"), "linked docs should not be orphaned");
  assert.ok(!paths.includes("state/workflow-corpus/private.md"), "private corpus outputs must be excluded");
  assert.ok(!paths.includes(".run-next/private.md"), "private run-next outputs must be excluded");
  assert.ok(!paths.includes("node_modules/pkg/README.md"), "generated dependency docs must be excluded");
  assert.ok(paths.includes("docs/space doc.md"), "filenames with spaces should be handled");
  assert.equal(classify("docs/releases/v0.1.0.md"), "release");

  const second = buildInventory({ repo: temp, trackedFiles });
  assert.deepEqual(report, second, "repeated execution should be deterministic");
  assert.doesNotMatch(JSON.stringify(report), new RegExp(temp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "absolute temp path should not be emitted");
  assert.ok(report.strict_failures.some((failure) => failure.includes("orphan current document")), "strict failures should document orphan failures");
  assert.ok(report.strict_failures.some((failure) => failure.includes("duplicate title")), "strict failures should document duplicate failures");

  const jsonText = JSON.stringify(report, null, 2);
  assert.doesNotThrow(() => JSON.parse(jsonText), "json output should parse");
  assert.doesNotMatch(jsonText, new RegExp(temp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "json output should not include absolute repo path");
  assert.ok(report.strict_failures.length > 0, "validation should fail only for documented strict failures");

  const clean = path.join(temp, "clean");
  write("clean/README.md", "# Clean Readme\n\n- docs/clean.md\n");
  write("clean/RUNBOOK.md", "# Clean Runbook\n");
  write("clean/skills-index.md", "# Skills Index\n");
  write("clean/docs/agent-and-skill-roadmap.md", "# Clean Roadmap\n");
  write("clean/build-queue.md", "# Clean Queue\n");
  write("clean/docs/clean.md", "# Clean Doc\n");
  const cleanReport = buildInventory({ repo: clean });
  assert.equal(cleanReport.strict_failures.length, 0, "validation should pass without strict failures");

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok((packageJson.files || []).includes("scripts/"), "package contents should include helper scripts");
  assert.ok(!JSON.stringify(packageJson.files || []).includes("workflow-corpus"), "package contents should not include private workflow corpus");

  console.log("docs-list tests passed: discovery, categories, H1s, duplicates, orphans, exclusions, JSON, validation, and determinism.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
