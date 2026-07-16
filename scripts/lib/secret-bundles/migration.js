const fs = require("fs");
const path = require("path");
const { readDotEnv, sortedNames, namesFingerprint } = require("./dotenv");
const { coverage } = require("./inventory");
const { atomicWrite, ownerOnly } = require("./io");
const { encryptJson, encryptedFileStatus } = require("./tooling");
const { proveBundles } = require("./delivery");
const { fail } = require("./errors");

function payloadForBundle(bundle, sourceValues) {
  const payload = {};
  for (const variable of bundle.variables) {
    const value = sourceValues.get(variable.source);
    if (typeof value !== "string" || value.length === 0) fail("SOURCE_VALUE_MISSING_OR_EMPTY");
    payload[variable.runtime] = value;
  }
  return payload;
}

function inspectEncryptedJson(bundle) {
  if (!fs.existsSync(bundle.absoluteFile) || !ownerOnly(bundle.absoluteFile)) return false;
  let payload;
  try { payload = JSON.parse(fs.readFileSync(bundle.absoluteFile, "utf8")); } catch { return false; }
  const expected = bundle.variables.map((item) => item.runtime).sort();
  const actual = Object.keys(payload).filter((key) => key !== "sops").sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) return false;
  return expected.every((name) => typeof payload[name] === "string" && payload[name].startsWith("ENC["));
}

function validateBundleFiles(manifest, options = {}) {
  const fileStatus = options.encryptedFileStatusFn || encryptedFileStatus;
  const bundles = manifest.bundles.map((bundle) => ({
    id: bundle.id,
    file: path.basename(bundle.file),
    variable_count: bundle.variables.length,
    owner_only: fs.existsSync(bundle.absoluteFile) && ownerOnly(bundle.absoluteFile),
    encrypted_shape: inspectEncryptedJson(bundle),
    sops_encrypted: fs.existsSync(bundle.absoluteFile) && fileStatus(manifest, bundle.absoluteFile),
  }));
  return {
    schema_version: 1,
    operation: "validate",
    status: bundles.every((item) => item.owner_only && item.encrypted_shape && item.sops_encrypted) ? "PASS" : "FAIL",
    bundles,
    guarantees: { values_emitted: false, files_decrypted: false },
  };
}

async function migrate(manifest, envFile, options = {}) {
  if (!options.allowSecretMutation) fail("SECRET_MUTATION_PERMISSION_REQUIRED", 3);
  const sourceValues = readDotEnv(envFile);
  const names = sortedNames(sourceValues);
  const sourceCoverage = coverage(names, manifest);
  if (!sourceCoverage.complete) fail("SOURCE_COVERAGE_INCOMPLETE");

  const written = [];
  const encrypt = options.encryptJsonFn || encryptJson;
  for (const bundle of manifest.bundles) {
    if (fs.existsSync(bundle.absoluteFile) && !options.replace) fail("ENCRYPTED_BUNDLE_EXISTS", 3);
    const encrypted = await encrypt(manifest, bundle, payloadForBundle(bundle, sourceValues));
    atomicWrite(bundle.absoluteFile, encrypted, 0o600);
    encrypted.fill(0);
    written.push({ id: bundle.id, file: path.basename(bundle.file), variable_count: bundle.variables.length });
  }

  const validation = validateBundleFiles(manifest, options);
  if (validation.status !== "PASS") fail("POST_MIGRATION_VALIDATION_FAILED");
  return {
    schema_version: 1,
    operation: "migrate",
    status: "PASS",
    source: { variable_count: names.length, names_fingerprint: namesFingerprint(names) },
    coverage: sourceCoverage,
    bundles: written,
    guarantees: {
      values_emitted: false,
      plaintext_bundle_files_written: false,
      source_removed: false,
    },
  };
}

function retireSource(manifest, envFile, options = {}) {
  if (!options.allowDestructive) fail("DESTRUCTIVE_PERMISSION_REQUIRED", 3);
  const sourceValues = readDotEnv(envFile);
  const names = sortedNames(sourceValues);
  const sourceCoverage = coverage(names, manifest);
  if (!sourceCoverage.complete) fail("SOURCE_COVERAGE_INCOMPLETE");
  const validation = validateBundleFiles(manifest, options);
  if (validation.status !== "PASS") fail("BUNDLE_VALIDATION_REQUIRED");
  const prove = options.proveBundlesFn || proveBundles;
  const proof = prove(manifest, options.allowSecretAccess, options);
  fs.unlinkSync(envFile);
  return {
    schema_version: 1,
    operation: "retire-source",
    status: "PASS",
    source: {
      variable_count: names.length,
      names_fingerprint: namesFingerprint(names),
      removed: !fs.existsSync(envFile),
    },
    validation: validation.status,
    delivery_proof: proof.status,
    guarantees: {
      values_emitted: false,
      encrypted_bundles_retained: true,
      plaintext_source_removed: true,
    },
  };
}

module.exports = { migrate, retireSource, validateBundleFiles };
