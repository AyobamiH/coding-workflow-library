const fs = require("fs");
const path = require("path");
const { assertVariableName } = require("./dotenv");
const { fail } = require("./errors");

const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

function resolveFrom(baseDirectory, candidate) {
  if (!candidate) return null;
  return path.isAbsolute(candidate) ? candidate : path.resolve(baseDirectory, candidate);
}

function requireId(value, code) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) fail(code);
}

function validateVariable(variable) {
  if (!variable || typeof variable !== "object") fail("MANIFEST_VARIABLE_INVALID");
  if (!assertVariableName(variable.source) || !assertVariableName(variable.runtime)) {
    fail("MANIFEST_VARIABLE_NAME_INVALID");
  }
}

function validateBundle(bundle) {
  requireId(bundle && bundle.id, "MANIFEST_BUNDLE_ID_INVALID");
  if (typeof bundle.file !== "string" || !bundle.file.endsWith(".enc.json")) {
    fail("MANIFEST_BUNDLE_FILE_INVALID");
  }
  if (!Array.isArray(bundle.variables) || bundle.variables.length === 0) {
    fail("MANIFEST_BUNDLE_VARIABLES_MISSING");
  }
  bundle.variables.forEach(validateVariable);
  const runtime = bundle.variables.map((item) => item.runtime);
  if (new Set(runtime).size !== runtime.length) fail("MANIFEST_RUNTIME_NAME_DUPLICATE");
  if (bundle.consumers && !Array.isArray(bundle.consumers)) fail("MANIFEST_CONSUMERS_INVALID");
}

function validateProfile(profile, bundleIds) {
  requireId(profile && profile.id, "MANIFEST_PROFILE_ID_INVALID");
  if (!bundleIds.has(profile.bundle)) fail("MANIFEST_PROFILE_BUNDLE_UNKNOWN");
  if (!Array.isArray(profile.allowed_commands) || profile.allowed_commands.length === 0) {
    fail("MANIFEST_PROFILE_COMMANDS_MISSING");
  }
  if (profile.allowed_commands.some((item) => typeof item !== "string" || path.basename(item) !== item)) {
    fail("MANIFEST_PROFILE_COMMAND_INVALID");
  }
}

function validateManifest(manifest) {
  if (!manifest || manifest.schema_version !== 1) fail("MANIFEST_SCHEMA_UNSUPPORTED");
  if (!manifest.source || !Array.isArray(manifest.source.expected_names)) {
    fail("MANIFEST_SOURCE_NAMES_MISSING");
  }
  if (manifest.source.expected_names.some((name) => !assertVariableName(name))) {
    fail("MANIFEST_SOURCE_NAME_INVALID");
  }
  if (new Set(manifest.source.expected_names).size !== manifest.source.expected_names.length) {
    fail("MANIFEST_SOURCE_NAME_DUPLICATE");
  }
  if (!Array.isArray(manifest.bundles) || manifest.bundles.length === 0) fail("MANIFEST_BUNDLES_MISSING");
  manifest.bundles.forEach(validateBundle);
  const bundleIds = new Set(manifest.bundles.map((item) => item.id));
  if (bundleIds.size !== manifest.bundles.length) fail("MANIFEST_BUNDLE_ID_DUPLICATE");
  const mappedSources = manifest.bundles.flatMap((bundle) => bundle.variables.map((item) => item.source));
  if (new Set(mappedSources).size !== mappedSources.length) fail("MANIFEST_SOURCE_MAPPING_DUPLICATE");
  if (!Array.isArray(manifest.profiles) || manifest.profiles.length === 0) fail("MANIFEST_PROFILES_MISSING");
  manifest.profiles.forEach((profile) => validateProfile(profile, bundleIds));
  const profileIds = new Set(manifest.profiles.map((item) => item.id));
  if (profileIds.size !== manifest.profiles.length) fail("MANIFEST_PROFILE_ID_DUPLICATE");
  if (!manifest.tooling || typeof manifest.tooling !== "object") fail("MANIFEST_TOOLING_MISSING");
  return manifest;
}

function loadManifest(manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    fail("MANIFEST_READ_FAILED");
  }
  validateManifest(manifest);
  const baseDirectory = path.dirname(path.resolve(manifestPath));
  const bundles = manifest.bundles.map((bundle) => ({
    ...bundle,
    absoluteFile: resolveFrom(baseDirectory, bundle.file),
  }));
  const tooling = Object.fromEntries(
    Object.entries(manifest.tooling).map(([key, value]) => [key, resolveFrom(baseDirectory, value)]),
  );
  return {
    ...manifest,
    manifestPath: path.resolve(manifestPath),
    baseDirectory,
    bundles,
    tooling,
  };
}

function bundleById(manifest, bundleId) {
  const bundle = manifest.bundles.find((item) => item.id === bundleId);
  if (!bundle) fail("BUNDLE_NOT_FOUND");
  return bundle;
}

function profileById(manifest, profileId) {
  const profile = manifest.profiles.find((item) => item.id === profileId);
  if (!profile) fail("PROFILE_NOT_FOUND");
  return profile;
}

module.exports = {
  bundleById,
  loadManifest,
  profileById,
  validateManifest,
};
