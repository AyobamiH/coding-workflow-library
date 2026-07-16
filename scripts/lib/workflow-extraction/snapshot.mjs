import crypto from "crypto";
import fs from "fs";
import path from "path";

import { EVIDENCE_CLASSES, SOURCE_STATUSES, TERMINAL_COVERAGE_BUCKETS } from "./core.mjs";

export function buildCoverage({ manifest, events, sourceRoots, includeMetaSessions }) {
  const totals = {
    discovered: manifest.length,
    parsed: 0,
    unsupported: 0,
    corrupt: 0,
    empty: 0,
    duplicate: 0,
    excluded: 0,
  };
  for (const source of manifest) {
    const bucket = TERMINAL_COVERAGE_BUCKETS[source.parse_status] || "corrupt";
    totals[bucket] += 1;
  }
  const eventTimestamps = events.map((event) => event.timestamp).filter(Boolean).sort();
  const metaSourceIds = new Set(manifest.filter((source) => source.extraction_meta_session).map((source) => source.source_id));
  const rankedEvents = includeMetaSessions ? events : events.filter((event) => !metaSourceIds.has(event.source_id));
  return {
    source_roots: sourceRoots,
    totals,
    extraction_meta_sessions: metaSourceIds.size,
    total_events: events.length,
    ranked_events: rankedEvents.length,
    date_range: {
      from: eventTimestamps[0] || null,
      to: eventTimestamps[eventTimestamps.length - 1] || null,
    },
    class_counts: countBy(events, "primary_class"),
    command_counts: countCommandNames(rankedEvents),
    skill_mentions: countMentions(rankedEvents, "skill_mentions"),
    helper_mentions: countMentions(rankedEvents, "helper_mentions"),
    agent_role_mentions: countMentions(rankedEvents, "agent_role_mentions"),
    confidence_limitations: [
      "Text summaries are redacted and do not preserve full transcript bodies.",
      "Executed shell commands require tool invocation evidence.",
      "Extraction-meta sessions are excluded from rankings unless include-meta-sessions is enabled.",
    ],
  };
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function countCommandNames(events) {
  const counts = {};
  for (const event of events) {
    for (const name of event.command_names || []) counts[name] = (counts[name] || 0) + 1;
  }
  return sortCounts(counts);
}

function countMentions(events, key) {
  const counts = {};
  for (const event of events) {
    for (const value of event[key] || []) counts[value] = (counts[value] || 0) + 1;
  }
  return sortCounts(counts);
}

function sortCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

export function validateCorpus({ manifest, events, coverage }) {
  const errors = [];
  const sourceIds = new Set();
  for (const source of manifest) {
    if (!source.source_id) errors.push("source missing source_id");
    if (sourceIds.has(source.source_id)) errors.push(`duplicate source_id ${source.source_id}`);
    sourceIds.add(source.source_id);
    if (!SOURCE_STATUSES.includes(source.parse_status)) errors.push(`${source.source_id}: invalid parse_status ${source.parse_status}`);
    if (source.local_path) errors.push(`${source.source_id}: portable manifest must not include local_path`);
  }
  const eventIds = new Set();
  for (const event of events) {
    if (!event.event_id) errors.push("event missing event_id");
    if (eventIds.has(event.event_id)) errors.push(`duplicate event_id ${event.event_id}`);
    eventIds.add(event.event_id);
    if (!sourceIds.has(event.source_id)) errors.push(`${event.event_id}: unknown source_id`);
    if (!EVIDENCE_CLASSES.includes(event.primary_class)) errors.push(`${event.event_id}: invalid primary_class ${event.primary_class}`);
    if (!Array.isArray(event.evidence_tags) || !event.evidence_tags.length) errors.push(`${event.event_id}: missing evidence_tags`);
    if (containsPrivateLeak(JSON.stringify(event))) errors.push(`${event.event_id}: event contains private-looking value`);
  }
  const totals = coverage.totals;
  const reconciled = totals.parsed + totals.unsupported + totals.corrupt + totals.empty + totals.duplicate + totals.excluded;
  if (totals.discovered !== reconciled) errors.push(`coverage does not reconcile: discovered ${totals.discovered}, buckets ${reconciled}`);
  return {
    status: errors.length ? "FAIL" : "PASS",
    errors,
    corpus_schema: errors.some((error) => error.includes("event")) ? "FAIL" : "PASS",
    manifest_schema: errors.some((error) => error.includes("source")) ? "FAIL" : "PASS",
    coverage_reconciled: totals.discovered === reconciled,
  };
}

export function containsPrivateLeak(text) {
  return /\/home\/[A-Za-z0-9._-]+|postgres(?:ql)?:\/\/|Bearer\s+[A-Za-z0-9._-]+|gh[pousr]_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{12,}/i.test(text);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value) {
  return sha256(canonicalJson(value));
}

function snapshotManifest(manifest) {
  return manifest.map((source) => {
    const { safe_mtime: ignoredSafeMtime, ...contentDerived } = source;
    return contentDerived;
  });
}

export function createWorkflowSnapshot(result, options = {}) {
  const manifestOnly = Boolean(options.manifestOnly);
  const sourceManifestFingerprint = fingerprint({
    schema: "workflow-source-manifest.v1",
    sources: snapshotManifest(result.manifest),
  });
  const corpusFingerprint = manifestOnly ? null : fingerprint(result.events);
  const coverageFingerprint = fingerprint(result.coverage);
  const counts = {
    sources: result.manifest.length,
    events: result.events.length,
    ...result.coverage.totals,
  };
  const snapshotFingerprint = fingerprint({
    schema: "workflow-corpus-snapshot.v1",
    algorithm: "sha256",
    mode: manifestOnly ? "manifest_only" : "full",
    source_manifest: sourceManifestFingerprint,
    corpus: corpusFingerprint,
    coverage: coverageFingerprint,
    counts,
  });
  return {
    schema: "workflow-corpus-snapshot.v1",
    algorithm: "sha256",
    mode: manifestOnly ? "manifest_only" : "full",
    fingerprints: {
      source_manifest: sourceManifestFingerprint,
      corpus: corpusFingerprint,
      coverage: coverageFingerprint,
      snapshot: snapshotFingerprint,
    },
    counts,
    boundaries: [
      "fingerprints are content-derived and omit source mtimes and local paths",
      "the snapshot contains no transcript bodies, source paths, pseudonym map, or credentials",
      "a changed fingerprint identifies drift but does not explain intent or correctness",
    ],
  };
}

export function validateWorkflowSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== "object") return ["snapshot must be an object"];
  if (snapshot.schema !== "workflow-corpus-snapshot.v1") errors.push("unsupported snapshot schema");
  if (snapshot.algorithm !== "sha256") errors.push("snapshot algorithm must be sha256");
  if (!["full", "manifest_only"].includes(snapshot.mode)) errors.push("snapshot mode is invalid");
  const hashes = snapshot.fingerprints || {};
  for (const key of ["source_manifest", "coverage", "snapshot"]) {
    if (!/^[a-f0-9]{64}$/.test(hashes[key] || "")) errors.push(`${key} fingerprint is invalid`);
  }
  if (snapshot.mode === "full" && !/^[a-f0-9]{64}$/.test(hashes.corpus || "")) {
    errors.push("corpus fingerprint is required in full mode");
  }
  if (snapshot.mode === "manifest_only" && hashes.corpus !== null) {
    errors.push("corpus fingerprint must be null in manifest_only mode");
  }
  for (const key of ["sources", "events", "discovered", "parsed", "unsupported", "corrupt", "empty", "duplicate", "excluded"]) {
    if (!Number.isInteger(snapshot.counts?.[key]) || snapshot.counts[key] < 0) errors.push(`${key} count is invalid`);
  }
  if (!errors.length) {
    const expected = fingerprint({
      schema: snapshot.schema,
      algorithm: snapshot.algorithm,
      mode: snapshot.mode,
      source_manifest: hashes.source_manifest,
      corpus: hashes.corpus,
      coverage: hashes.coverage,
      counts: snapshot.counts,
    });
    if (expected !== hashes.snapshot) errors.push("snapshot fingerprint does not match its components");
  }
  if (containsPrivateLeak(JSON.stringify(snapshot))) errors.push("snapshot contains private-looking material");
  return errors;
}

export function compareWorkflowSnapshots(current, baseline) {
  const currentErrors = validateWorkflowSnapshot(current);
  const baselineErrors = validateWorkflowSnapshot(baseline);
  if (currentErrors.length || baselineErrors.length || current.schema !== baseline.schema || current.algorithm !== baseline.algorithm || current.mode !== baseline.mode) {
    return {
      schema: "workflow-snapshot-comparison.v1",
      status: "INCOMPATIBLE",
      changed_components: [],
      count_deltas: {},
      current_fingerprint: current?.fingerprints?.snapshot || null,
      baseline_fingerprint: baseline?.fingerprints?.snapshot || null,
      reason: currentErrors.length || baselineErrors.length ? "snapshot validation failed" : "snapshot modes or formats differ",
    };
  }
  const changedComponents = ["source_manifest", "corpus", "coverage"]
    .filter((key) => current.fingerprints[key] !== baseline.fingerprints[key]);
  const countDeltas = {};
  for (const key of Object.keys(current.counts).sort()) {
    const delta = current.counts[key] - baseline.counts[key];
    if (delta !== 0) countDeltas[key] = delta;
  }
  return {
    schema: "workflow-snapshot-comparison.v1",
    status: changedComponents.length ? "CHANGED" : "UNCHANGED",
    changed_components: changedComponents,
    count_deltas: countDeltas,
    current_fingerprint: current.fingerprints.snapshot,
    baseline_fingerprint: baseline.fingerprints.snapshot,
    reason: changedComponents.length ? "content-derived corpus components changed" : "content-derived corpus components match",
  };
}

export function loadWorkflowSnapshot(inputPath) {
  const absolute = path.resolve(inputPath);
  const file = fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()
    ? path.join(absolute, "workflow-snapshot.json")
    : absolute;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeOutputs(outputDir, result, options) {
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  writeJson(path.join(outputDir, "source-manifest.json"), {
    schema: "workflow-source-manifest.v1",
    sources: result.manifest,
  });
  writeJson(path.join(outputDir, "coverage-report.json"), result.coverage);
  fs.writeFileSync(path.join(outputDir, "coverage-report.md"), coverageMarkdown(result.coverage), { mode: 0o600 });
  writeJson(path.join(outputDir, "validation-report.json"), {
    ...result.validation,
    snapshot_status: validateWorkflowSnapshot(result.snapshot).length ? "FAIL" : "PASS",
    snapshot_fingerprint: result.snapshot.fingerprints.snapshot,
  });
  writeJson(path.join(outputDir, "pseudonym-map.json"), result.pseudonymMap, 0o600);
  writeJson(path.join(outputDir, "workflow-snapshot.json"), result.snapshot, 0o600);
  if (result.comparison) writeJson(path.join(outputDir, "snapshot-comparison.json"), result.comparison, 0o600);
  if (!options.manifestOnly) {
    fs.writeFileSync(
      path.join(outputDir, "workflow-corpus.jsonl"),
      result.events.map((event) => JSON.stringify(event)).join("\n") + (result.events.length ? "\n" : ""),
      { mode: 0o600 }
    );
  }
}

function writeJson(file, value, mode = 0o600) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode });
}

function coverageMarkdown(coverage) {
  const totals = coverage.totals;
  return `# Workflow Corpus Coverage Report

## Source Roots

${coverage.source_roots.map((root) => `- ${root.root_id}: ${root.status}`).join("\n") || "- None"}

## Totals

- discovered: ${totals.discovered}
- parsed: ${totals.parsed}
- unsupported: ${totals.unsupported}
- corrupt: ${totals.corrupt}
- empty: ${totals.empty}
- duplicate: ${totals.duplicate}
- excluded: ${totals.excluded}
- extraction meta sessions: ${coverage.extraction_meta_sessions}
- total events: ${coverage.total_events}
- ranked events: ${coverage.ranked_events}
- date range: ${coverage.date_range.from || "unknown"} to ${coverage.date_range.to || "unknown"}

Coverage reconciliation: ${totals.discovered === totals.parsed + totals.unsupported + totals.corrupt + totals.empty + totals.duplicate + totals.excluded ? "PASS" : "FAIL"}

## Confidence Limitations

${coverage.confidence_limitations.map((item) => `- ${item}`).join("\n")}
`;
}

export function validateExistingOutput(outputDir) {
  const manifestPath = path.join(outputDir, "source-manifest.json");
  const corpusPath = path.join(outputDir, "workflow-corpus.jsonl");
  const coveragePath = path.join(outputDir, "coverage-report.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")).sources || [];
  const events = fs.existsSync(corpusPath)
    ? fs.readFileSync(corpusPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
  const validation = validateCorpus({ manifest, events, coverage });
  const snapshotPath = path.join(outputDir, "workflow-snapshot.json");
  if (!fs.existsSync(snapshotPath)) {
    return { ...validation, snapshot_status: "NOT_VERIFIED", snapshot_fingerprint: null };
  }
  const storedSnapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const snapshotErrors = validateWorkflowSnapshot(storedSnapshot);
  const expectedSnapshot = createWorkflowSnapshot(
    { manifest, events, coverage },
    { manifestOnly: !fs.existsSync(corpusPath) },
  );
  if (!snapshotErrors.length && storedSnapshot.fingerprints.snapshot !== expectedSnapshot.fingerprints.snapshot) {
    snapshotErrors.push("stored snapshot does not match corpus outputs");
  }
  return {
    ...validation,
    status: validation.status === "PASS" && !snapshotErrors.length ? "PASS" : "FAIL",
    errors: [...validation.errors, ...snapshotErrors],
    snapshot_status: snapshotErrors.length ? "FAIL" : "PASS",
    snapshot_fingerprint: storedSnapshot?.fingerprints?.snapshot || null,
  };
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
