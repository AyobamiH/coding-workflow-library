const fs = require("fs");
const { spawn, spawnSync } = require("child_process");
const { fail } = require("./errors");

const MAX_PROVIDER_OUTPUT = 4 * 1024 * 1024;

function toolEnvironment(manifest) {
  return {
    ...process.env,
    SOPS_AGE_KEY_FILE: manifest.tooling.age_key_file,
    SOPS_DECRYPTION_ORDER: "age",
  };
}

function spawnCaptured(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let overflow = false;

    const append = (current, chunk) => {
      const next = Buffer.concat([current, chunk]);
      if (next.length > MAX_PROVIDER_OUTPUT) overflow = true;
      return next.subarray(0, MAX_PROVIDER_OUTPUT);
    };
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.on("error", () => reject(new Error("PROVIDER_SPAWN_FAILED")));
    child.on("close", (status, signal) => resolve({ status, signal, stdout, stderr, overflow }));
    if (options.input !== undefined) child.stdin.end(options.input);
    else child.stdin.end();
  });
}

function assertTooling(manifest) {
  const required = ["sops_bin", "age_bin", "age_keygen_bin", "age_key_file", "policy_file"];
  if (required.some((key) => !manifest.tooling[key] || !fs.existsSync(manifest.tooling[key]))) {
    fail("SECRET_TOOLING_UNAVAILABLE", 4);
  }
}

async function encryptJson(manifest, bundle, payload) {
  assertTooling(manifest);
  const result = await spawnCaptured(manifest.tooling.sops_bin, [
    "--config",
    manifest.tooling.policy_file,
    "encrypt",
    "--filename-override",
    bundle.file,
    "--input-type",
    "json",
    "--output-type",
    "json",
  ], {
    env: toolEnvironment(manifest),
    input: `${JSON.stringify(payload, null, 2)}\n`,
  });
  if (result.status !== 0 || result.overflow || !result.stdout.includes(Buffer.from("ENC["))) {
    fail("SOPS_ENCRYPT_FAILED");
  }
  return result.stdout;
}

function encryptedFileStatus(manifest, filePath) {
  assertTooling(manifest);
  const result = spawnSync(manifest.tooling.sops_bin, ["filestatus", filePath], {
    encoding: "utf8",
    env: toolEnvironment(manifest),
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) return false;
  try {
    return JSON.parse(result.stdout).encrypted === true;
  } catch {
    return false;
  }
}

async function decryptJson(manifest, filePath) {
  assertTooling(manifest);
  // Decrypted bytes remain captured in this process and are never inherited by
  // the terminal. The caller must either inject them or answer one resolver pipe.
  const result = await spawnCaptured(manifest.tooling.sops_bin, [
    "decrypt",
    "--input-type",
    "json",
    "--output-type",
    "json",
    filePath,
  ], { env: toolEnvironment(manifest) });
  if (result.status !== 0 || result.overflow) fail("SOPS_DECRYPT_FAILED");
  try {
    const payload = JSON.parse(result.stdout.toString("utf8"));
    result.stdout.fill(0);
    return payload;
  } catch {
    result.stdout.fill(0);
    fail("SOPS_DECRYPT_PAYLOAD_INVALID");
  }
}

module.exports = {
  assertTooling,
  decryptJson,
  encryptJson,
  encryptedFileStatus,
  spawnCaptured,
  toolEnvironment,
};
