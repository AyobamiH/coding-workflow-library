#!/usr/bin/env node

import path from "path";
import { fileURLToPath } from "url";

import { parseArgs, usage } from "./lib/workflow-extraction/core.mjs";
import { extractCorpus } from "./lib/workflow-extraction/corpus.mjs";
import {
  compareWorkflowSnapshots,
  loadWorkflowSnapshot,
  validateExistingOutput,
  writeOutputs,
} from "./lib/workflow-extraction/snapshot.mjs";

export {
  EVIDENCE_CLASSES,
  Redactor,
  commandNames,
  parseArgs,
  splitCommandChain,
} from "./lib/workflow-extraction/core.mjs";
export { discoverSources, extractCorpus } from "./lib/workflow-extraction/corpus.mjs";
export {
  compareWorkflowSnapshots,
  createWorkflowSnapshot,
  loadWorkflowSnapshot,
  validateCorpus,
  validateExistingOutput,
  validateWorkflowSnapshot,
  writeOutputs,
} from "./lib/workflow-extraction/snapshot.mjs";

const __filename = fileURLToPath(import.meta.url);

function printSummary(result, args) {
  const summary = {
    output_dir: args.outputDir,
    dry_run: args.dryRun,
    manifest_only: args.manifestOnly,
    sources_discovered: result.manifest.length,
    events: result.events.length,
    validation: result.validation.status,
    coverage: result.coverage.totals,
    extraction_meta_sessions: result.coverage.extraction_meta_sessions,
    snapshot_fingerprint: result.snapshot.fingerprints.snapshot,
    comparison: result.comparison?.status || null,
  };
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`# Workflow Extraction Summary

Output dir: ${args.dryRun ? "(dry-run; no writes)" : args.outputDir}
Sources discovered: ${summary.sources_discovered}
Events: ${summary.events}
Validation: ${summary.validation}
Coverage: ${JSON.stringify(summary.coverage)}
Extraction meta sessions: ${summary.extraction_meta_sessions}`);
    if (result.comparison) {
      console.log(`Snapshot comparison: ${result.comparison.status}${result.comparison.changed_components.length ? ` (${result.comparison.changed_components.join(", ")})` : ""}`);
    }
  }
}

function comparisonExitCode(comparison, requireUnchanged) {
  if (!comparison) return 0;
  if (comparison.status === "INCOMPATIBLE") return 1;
  if (requireUnchanged && comparison.status !== "UNCHANGED") return 1;
  return 0;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    usage();
    process.exit(2);
  }

  if (args.help) {
    usage();
    return;
  }

  if (args.validateOnly) {
    const validation = validateExistingOutput(path.resolve(args.outputDir));
    const comparison = args.compareTo
      ? compareWorkflowSnapshots(loadWorkflowSnapshot(path.resolve(args.outputDir)), loadWorkflowSnapshot(args.compareTo))
      : null;
    const report = comparison ? { ...validation, comparison } : validation;
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Validation: ${validation.status}${validation.errors.length ? `\n${validation.errors.join("\n")}` : ""}`);
      if (comparison) console.log(`Snapshot comparison: ${comparison.status}`);
    }
    process.exit(validation.status === "PASS" && comparisonExitCode(comparison, args.requireUnchanged) === 0 ? 0 : 1);
  }

  if (!args.sources.length) {
    console.error("at least one --source is required unless --validate-only is used");
    process.exit(2);
  }

  const result = extractCorpus(args);
  if (args.compareTo) result.comparison = compareWorkflowSnapshots(result.snapshot, loadWorkflowSnapshot(args.compareTo));
  if (!args.dryRun) writeOutputs(path.resolve(args.outputDir), result, args);
  printSummary(result, args);
  process.exit(result.validation.status === "PASS" && comparisonExitCode(result.comparison, args.requireUnchanged) === 0 ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
