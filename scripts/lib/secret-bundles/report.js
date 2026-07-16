const { atomicWriteJson, safeBasename } = require("./io");

function humanLines(report) {
  const lines = [
    `secret-bundles ${report.operation}: ${report.status || (report.coverage && report.coverage.complete ? "PASS" : "WARN")}`,
  ];
  if (report.source) lines.push(`source variables: ${report.source.variable_count ?? report.source.assignment_count}`);
  if (report.coverage) {
    lines.push(`coverage: ${report.coverage.complete ? "complete" : "incomplete"}`);
    if (report.coverage.missing.length) lines.push(`unmapped names: ${report.coverage.missing.join(", ")}`);
    if (report.coverage.unexpected.length) lines.push(`unexpected mappings: ${report.coverage.unexpected.join(", ")}`);
  }
  if (report.bundles) {
    for (const bundle of report.bundles) {
      const count = bundle.variable_count ?? (Array.isArray(bundle.variables) ? bundle.variables.length : 0);
      lines.push(`bundle ${bundle.id}: ${bundle.passed === false || bundle.sops_encrypted === false ? "FAIL" : "PASS"} (${count} variables)`);
    }
  }
  lines.push("secret values emitted: no");
  return lines;
}

function emitReport(report, options = {}) {
  if (options.output) atomicWriteJson(options.output, report);
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(`${humanLines(report).join("\n")}\n`);
}

function safeCommandPlan(manifest, profile, command) {
  return {
    schema_version: 1,
    operation: "run",
    status: "PASS",
    manifest: safeBasename(manifest.manifestPath),
    profile: profile.id,
    command: safeBasename(command[0]),
    dry_run: true,
    values_emitted: false,
  };
}

module.exports = { emitReport, safeCommandPlan };
