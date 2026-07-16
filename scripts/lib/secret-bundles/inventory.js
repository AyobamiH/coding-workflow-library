const path = require("path");
const { namesFingerprint, readDotEnv, sortedNames } = require("./dotenv");
const { findReferences } = require("./reference-scan");

function mappedSources(manifest) {
  return manifest.bundles.flatMap((bundle) => bundle.variables.map((variable) => variable.source)).sort();
}

function coverage(sourceNames, manifest) {
  const mapped = mappedSources(manifest);
  const expected = [...manifest.source.expected_names].sort();
  const sourceSet = new Set(sourceNames);
  const mappedSet = new Set(mapped);
  const expectedSet = new Set(expected);
  const missing = [...new Set([
    ...sourceNames.filter((name) => !mappedSet.has(name)),
    ...expected.filter((name) => !sourceSet.has(name)),
  ])].sort();
  const unexpected = [...new Set([
    ...mapped.filter((name) => !sourceSet.has(name)),
    ...sourceNames.filter((name) => !expectedSet.has(name)),
    ...mapped.filter((name) => !expectedSet.has(name)),
  ])].sort();
  return {
    complete: missing.length === 0 && unexpected.length === 0,
    missing,
    unexpected,
  };
}

function referencesFor(name, repositories) {
  const references = {};
  for (const repository of repositories) {
    const files = findReferences(repository.path, name)
      .filter((file) => !path.isAbsolute(file));
    if (files.length) references[repository.alias] = files;
  }
  return references;
}

function buildInventory(envFile, manifest, repositories = []) {
  const values = readDotEnv(envFile);
  const names = sortedNames(values);
  const result = coverage(names, manifest);
  return {
    schema_version: 1,
    operation: "inventory",
    source: {
      assignment_count: values.size,
      names,
      names_fingerprint: namesFingerprint(names),
    },
    coverage: result,
    bundles: manifest.bundles.map((bundle) => ({
      id: bundle.id,
      file: path.basename(bundle.file),
      variables: bundle.variables.map((item) => ({ source: item.source, runtime: item.runtime })),
      consumers: [...(bundle.consumers || [])].sort(),
    })),
    references: Object.fromEntries(names.map((name) => [name, referencesFor(name, repositories)])),
    guarantees: {
      values_emitted: false,
      absolute_repository_paths_emitted: false,
      source_mutated: false,
    },
  };
}

module.exports = { buildInventory, coverage, mappedSources };
