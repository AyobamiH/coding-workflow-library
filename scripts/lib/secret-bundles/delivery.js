const path = require("path");
const { bundleById, profileById } = require("./manifest");
const { decryptJson } = require("./tooling");
const { fail } = require("./errors");

const ROOT = path.resolve(__dirname, "../../..");
const LOW_LEVEL_HELPER = path.join(ROOT, "scripts", "sops-age-secret-access");
const ASSERT_ENV = path.join(__dirname, "assert-env.js");
const adapter = require(LOW_LEVEL_HELPER);

function portableCommandName(commandPath) {
  return String(commandPath).split(/[\\/]/).pop().replace(/\.exe$/i, "");
}

function adapterArguments(manifest, bundle, allowSecretAccess, command) {
  return [
    "run",
    "--file",
    bundle.absoluteFile,
    "--key-file",
    manifest.tooling.age_key_file,
    "--sops-bin",
    manifest.tooling.sops_bin,
    "--age-bin",
    manifest.tooling.age_bin,
    "--age-keygen-bin",
    manifest.tooling.age_keygen_bin,
    allowSecretAccess ? "--allow-secret-access" : "--dry-run",
    "--json",
    "--validate",
    "--",
    ...command,
  ];
}

function invokeAdapter(manifest, bundle, allowSecretAccess, command) {
  const args = adapter.parseArgs(adapterArguments(manifest, bundle, allowSecretAccess, command));
  const report = adapter.buildRunReport(args, process.env);
  const reportErrors = adapter.validateReport(report);
  return {
    passed: reportErrors.length === 0 && report.status === "PASS",
    status: adapter.statusCode(report),
    attempted: Boolean(report.execution && report.execution.attempted),
    command: report.execution ? report.execution.command_name : path.basename(command[0]),
  };
}

function assertAllowed(profile, command) {
  if (!command.length) fail("CHILD_COMMAND_MISSING");
  const commandName = portableCommandName(command[0]);
  const allowed = profile.allowed_commands.map(portableCommandName);
  if (!allowed.includes(commandName)) fail("CHILD_COMMAND_NOT_ALLOWED", 3);
}

function runProfile(manifest, profileId, command, allowSecretAccess, options = {}) {
  const profile = profileById(manifest, profileId);
  const bundle = bundleById(manifest, profile.bundle);
  assertAllowed(profile, command);
  const invoke = options.invokeAdapterFn || invokeAdapter;
  const execution = invoke(manifest, bundle, allowSecretAccess, command);
  if (!execution.passed) fail(allowSecretAccess ? "PROFILE_EXECUTION_FAILED" : "PROFILE_DRY_RUN_FAILED");
  return {
    schema_version: 1,
    operation: "run",
    status: "PASS",
    profile: profile.id,
    bundle: bundle.id,
    execution,
    guarantees: {
      values_emitted: false,
      child_output_emitted: false,
      consequence_authority_granted: false,
    },
  };
}

function proveBundles(manifest, allowSecretAccess, options = {}) {
  if (!allowSecretAccess) fail("SECRET_ACCESS_PERMISSION_REQUIRED", 3);
  const invoke = options.invokeAdapterFn || invokeAdapter;
  const results = manifest.bundles.map((bundle) => {
    const names = bundle.variables.map((item) => item.runtime);
    const execution = invoke(manifest, bundle, true, [process.execPath, ASSERT_ENV, ...names]);
    return { id: bundle.id, passed: execution.passed, variable_count: names.length };
  });
  if (results.some((item) => !item.passed)) fail("BUNDLE_DELIVERY_PROOF_FAILED");
  return {
    schema_version: 1,
    operation: "prove",
    status: "PASS",
    bundles: results,
    guarantees: {
      values_emitted: false,
      child_output_emitted: false,
      plaintext_files_written: false,
    },
  };
}

async function resolveRequest(manifest, profileId, request, allowSecretAccess, options = {}) {
  if (!allowSecretAccess) fail("SECRET_ACCESS_PERMISSION_REQUIRED", 3);
  if (process.stdout.isTTY) fail("RESOLVER_TTY_REFUSED", 3);
  if (!request || request.protocolVersion !== 1 || !Array.isArray(request.ids)) {
    fail("RESOLVER_REQUEST_INVALID");
  }
  const profile = profileById(manifest, profileId);
  if (!profile.openclaw_resolver) fail("RESOLVER_PROFILE_NOT_ENABLED");
  const bundle = bundleById(manifest, profile.bundle);
  const allowed = new Set(bundle.variables.map((item) => item.runtime));
  if (request.ids.some((id) => !allowed.has(id))) fail("RESOLVER_ID_NOT_ALLOWED", 3);
  const decrypt = options.decryptJsonFn || decryptJson;
  const payload = await decrypt(manifest, bundle.absoluteFile);
  const values = {};
  for (const id of request.ids) {
    if (typeof payload[id] !== "string" || payload[id].length === 0) fail("RESOLVER_VALUE_MISSING");
    values[id] = payload[id];
    delete payload[id];
  }
  return { protocolVersion: 1, values, errors: {} };
}

module.exports = { portableCommandName, proveBundles, resolveRequest, runProfile };
