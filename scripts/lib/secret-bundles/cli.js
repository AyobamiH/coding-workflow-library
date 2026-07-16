const fs = require("fs");
const path = require("path");
const { loadManifest, profileById } = require("./manifest");
const { buildInventory } = require("./inventory");
const { migrate, retireSource, validateBundleFiles } = require("./migration");
const { proveBundles, resolveRequest, runProfile } = require("./delivery");
const { emitReport } = require("./report");
const { atomicWriteJson } = require("./io");
const { fail } = require("./errors");

function usage() {
  console.log(`Usage:
  secret-bundles inventory --manifest <path> --env-file <path> [--repo alias=/path] [--json]
  secret-bundles validate --manifest <path> [--json]
  secret-bundles migrate --manifest <path> --env-file <path> --allow-secret-mutation [--replace]
  secret-bundles prove --manifest <path> --allow-secret-access [--json]
  secret-bundles run --manifest <path> --profile <id> --dry-run -- command arg
  secret-bundles run --manifest <path> --profile <id> --allow-secret-access -- command arg
  secret-bundles resolve --manifest <path> --profile <id> --allow-secret-access
  secret-bundles retire-source --manifest <path> --env-file <path> --allow-secret-access --allow-destructive

All reports contain names and status only. Decrypted values are limited to a selected child environment or an OpenClaw resolver pipe.`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, repositories: [], child: [] };
  let afterSeparator = false;
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (afterSeparator) { options.child.push(token); continue; }
    if (token === "--") { afterSeparator = true; continue; }
    if (token === "--json") options.json = true;
    else if (token === "--validate") options.validate = true;
    else if (token === "--dry-run") options.dryRun = true;
    else if (token === "--allow-secret-access") options.allowSecretAccess = true;
    else if (token === "--allow-secret-mutation") options.allowSecretMutation = true;
    else if (token === "--allow-destructive") options.allowDestructive = true;
    else if (token === "--replace") options.replace = true;
    else if (["--manifest", "--env-file", "--profile", "--output", "--audit-file"].includes(token)) {
      const key = { "--manifest": "manifest", "--env-file": "envFile", "--profile": "profile", "--output": "output", "--audit-file": "auditFile" }[token];
      options[key] = rest[++index];
    } else if (token === "--repo") {
      const entry = rest[++index] || "";
      const separator = entry.indexOf("=");
      if (separator <= 0) fail("REPOSITORY_ARGUMENT_INVALID");
      options.repositories.push({ alias: entry.slice(0, separator), path: path.resolve(entry.slice(separator + 1)) });
    } else if (token === "--help" || token === "-h") options.help = true;
    else fail("ARGUMENT_UNKNOWN");
  }
  return options;
}

function requireCommon(options) {
  if (!options.manifest) fail("MANIFEST_ARGUMENT_REQUIRED");
  return loadManifest(options.manifest);
}

function readResolverRequest() {
  return new Promise((resolve, reject) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
      if (input.length > 1024 * 1024) reject(new Error("RESOLVER_REQUEST_TOO_LARGE"));
    });
    process.stdin.on("error", reject);
    process.stdin.on("end", () => {
      try { resolve(JSON.parse(input || "{}")); } catch { reject(new Error("RESOLVER_REQUEST_INVALID")); }
    });
  });
}

async function dispatch(options) {
  if (options.help || !options.command) { usage(); return; }
  const manifest = requireCommon(options);
  let report;
  if (options.command === "inventory") {
    if (!options.envFile || !fs.existsSync(options.envFile)) fail("ENV_FILE_ARGUMENT_REQUIRED");
    report = buildInventory(options.envFile, manifest, options.repositories);
  } else if (options.command === "validate") {
    report = validateBundleFiles(manifest);
  } else if (options.command === "migrate") {
    if (!options.envFile || !fs.existsSync(options.envFile)) fail("ENV_FILE_ARGUMENT_REQUIRED");
    report = await migrate(manifest, options.envFile, options);
  } else if (options.command === "prove") {
    report = proveBundles(manifest, options.allowSecretAccess);
  } else if (options.command === "run") {
    if (!options.profile) fail("PROFILE_ARGUMENT_REQUIRED");
    profileById(manifest, options.profile);
    if (!options.dryRun && !options.allowSecretAccess) fail("SECRET_ACCESS_PERMISSION_REQUIRED", 3);
    report = runProfile(manifest, options.profile, options.child, options.dryRun ? false : options.allowSecretAccess);
  } else if (options.command === "resolve") {
    if (!options.profile) fail("PROFILE_ARGUMENT_REQUIRED");
    const request = await readResolverRequest();
    options.resolverRequestSummary = {
      protocol_version_type: typeof request.protocolVersion,
      protocol_version: request.protocolVersion,
      provider_type: typeof request.provider,
      ids_type: Array.isArray(request.ids) ? "array" : typeof request.ids,
      ids: Array.isArray(request.ids) ? request.ids : [],
    };
    if (options.auditFile) atomicWriteJson(options.auditFile, {
      schema_version: 1,
      operation: "resolve",
      status: "REQUEST_ACCEPTED",
      profile: options.profile,
      ids: Array.isArray(request.ids) ? request.ids : [],
      values_emitted_to_audit: false,
    });
    const response = await resolveRequest(manifest, options.profile, request, options.allowSecretAccess);
    if (options.auditFile) atomicWriteJson(options.auditFile, {
      schema_version: 1,
      operation: "resolve",
      status: "PASS",
      profile: options.profile,
      ids: Array.isArray(request.ids) ? request.ids : [],
      values_emitted_to_audit: false,
    });
    process.stdout.write(JSON.stringify(response));
    return;
  } else if (options.command === "retire-source") {
    if (!options.envFile || !fs.existsSync(options.envFile)) fail("ENV_FILE_ARGUMENT_REQUIRED");
    report = retireSource(manifest, options.envFile, options);
  } else {
    fail("COMMAND_UNKNOWN");
  }
  emitReport(report, options);
  if (options.validate && (report.status === "FAIL" || report.coverage?.complete === false)) process.exitCode = 1;
}

async function main(argv) {
  if (!argv.length || ["--help", "-h", "help"].includes(argv[0])) {
    usage();
    return;
  }
  const options = parseArgs(argv);
  try {
    await dispatch(options);
  } catch (error) {
    if (options.auditFile) atomicWriteJson(options.auditFile, {
      schema_version: 1,
      operation: options.command,
      status: "FAIL",
      code: error && error.safeCode ? error.safeCode : "SECRET_BUNDLES_FAILED",
      request: options.resolverRequestSummary || null,
      values_emitted_to_audit: false,
    });
    throw error;
  }
}

module.exports = { main, parseArgs };
