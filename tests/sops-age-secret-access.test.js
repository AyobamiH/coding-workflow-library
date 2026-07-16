#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "sops-age-secret-access");
const helper = require(SCRIPT);

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "coding-workflow-sops-age-"));
}

function write(file, content, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode });
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 10000,
  });
}

function makeFakeTools(directory) {
  const toolDirectory = path.join(directory, "tool fixtures");
  const sops = path.join(toolDirectory, "fake-sops.js");
  const age = path.join(toolDirectory, "fake-age.js");
  const ageKeygen = path.join(toolDirectory, "fake-age-keygen.js");

  write(sops, `#!/usr/bin/env node
const fs = require("fs");
const { spawnSync } = require("child_process");
const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("sops 3.13.2");
  process.exit(0);
}
if (args[0] === "filestatus") {
  const file = args[args.length - 1];
  const content = fs.readFileSync(file, "utf8");
  console.log(JSON.stringify({ encrypted: content.includes("sops_version=") }));
  process.exit(0);
}
if (args[0] === "exec-env") {
  const command = args[args.length - 1];
  const childEnv = {
    PATH: process.env.PATH || "",
    RUNTIME_INPUT: process.env.FIXTURE_VALUE || "fixture-value"
  };
  const result = spawnSync(command, {
    env: childEnv,
    encoding: "utf8",
    shell: true
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  process.exit(typeof result.status === "number" ? result.status : 1);
}
process.exit(2);
`, 0o700);
  write(age, "#!/usr/bin/env node\nconsole.log('v1.3.1')\n", 0o700);
  write(ageKeygen, "#!/usr/bin/env node\nconsole.log('v1.3.1')\n", 0o700);
  return { sops, age, ageKeygen };
}

function toolArgs(tools) {
  return [
    "--sops-bin",
    tools.sops,
    "--age-bin",
    tools.age,
    "--age-keygen-bin",
    tools.ageKeygen,
  ];
}

function testCapabilityAndIdentityStatus() {
  const directory = temporaryDirectory();
  const tools = makeFakeTools(directory);
  const identity = path.join(directory, "identity.txt");
  write(identity, "synthetic identity fixture\n", 0o600);

  const result = run([
    "status",
    ...toolArgs(tools),
    "--key-file",
    identity,
    "--json",
    "--validate",
  ]);
  assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.strictEqual(report.status, "PASS");
  assert.strictEqual(report.capability.sops.version, "3.13.2");
  assert.strictEqual(report.capability.age.version, "1.3.1");
  assert.strictEqual(report.capability.identity.source, "explicit_file");
  assert(!result.stdout.includes(directory));
  assert(!result.stdout.includes("synthetic identity fixture"));
  assert.deepStrictEqual(helper.validateReport(report), []);
  fs.rmSync(directory, { recursive: true, force: true });
}

function testMissingCapabilityAndIdentity() {
  const missing = path.join(os.tmpdir(), "missing-sops-age-tool");
  const report = helper.buildStatusReport({
    sopsBin: missing,
    ageBin: missing,
    ageKeygenBin: missing,
    keyFile: null,
    timeoutMs: 1000,
  }, {
    HOME: path.join(os.tmpdir(), "missing-sops-age-home"),
  });
  assert.strictEqual(report.status, "BLOCKED_CAPABILITY");
  assert.strictEqual(report.capability.sops.state, "MISSING");
  assert.strictEqual(report.capability.identity.state, "NOT_CONFIGURED");
  assert(!JSON.stringify(report).includes(os.tmpdir()));
}

function testSuccessfulExitOverridesNonFatalSpawnArtifact() {
  assert.strictEqual(helper.completedSuccessfully({
    status: 0,
    error: Object.assign(new Error("managed runtime artifact"), { code: "EPERM" }),
  }), true);
  assert.strictEqual(helper.completedSuccessfully({
    status: 1,
    error: null,
  }), false);
  assert.strictEqual(helper.completedSuccessfully({
    status: null,
    error: Object.assign(new Error("missing"), { code: "ENOENT" }),
  }), false);
}

function testIdentityPermissionBoundary() {
  if (process.platform === "win32") return;
  const directory = temporaryDirectory();
  const identity = path.join(directory, "identity.txt");
  write(identity, "synthetic identity fixture\n", 0o644);
  const state = helper.inspectIdentity({ keyFile: identity }, {});
  assert.strictEqual(state.state, "UNSAFE");
  assert.strictEqual(state.private_permissions, false);
  fs.rmSync(directory, { recursive: true, force: true });
}

function testEncryptedFileValidation() {
  const directory = temporaryDirectory();
  const tools = makeFakeTools(directory);
  const encrypted = path.join(directory, "runtime config.env");
  const plaintext = path.join(directory, "plain.env");
  write(encrypted, "RUNTIME_INPUT=ENC[AES256_GCM,data:fixture]\nsops_version=3.13.2\n");
  write(plaintext, "RUNTIME_INPUT=plain-fixture\n");

  const valid = run([
    "validate-file",
    "--file",
    encrypted,
    "--sops-bin",
    tools.sops,
    "--json",
    "--validate",
  ]);
  assert.strictEqual(valid.status, 0);
  const validReport = JSON.parse(valid.stdout);
  assert.strictEqual(validReport.encrypted_file.encrypted, true);
  assert.strictEqual(validReport.encrypted_file.file_name, "runtime config.env");
  assert(!valid.stdout.includes(directory));

  const refused = run([
    "validate-file",
    "--file",
    plaintext,
    "--sops-bin",
    tools.sops,
    "--json",
    "--validate",
  ]);
  assert.strictEqual(refused.status, 1);
  const refusedReport = JSON.parse(refused.stdout);
  assert(refusedReport.findings.some((finding) => finding.code === "PLAINTEXT_FILE_REFUSED"));
  assert(!refused.stdout.includes("plain-fixture"));
  fs.rmSync(directory, { recursive: true, force: true });
}

function testDryRunAndPermissionBoundary() {
  const directory = temporaryDirectory();
  const tools = makeFakeTools(directory);
  const identity = path.join(directory, "identity.txt");
  const encrypted = path.join(directory, "runtime.env");
  const child = path.join(directory, "child script.js");
  write(identity, "synthetic identity fixture\n", 0o600);
  write(encrypted, "RUNTIME_INPUT=ENC[AES256_GCM,data:fixture]\nsops_version=3.13.2\n");
  write(child, "process.stdout.write('child-ran')\n");

  const common = [
    "--file",
    encrypted,
    "--key-file",
    identity,
    ...toolArgs(tools),
  ];
  const dryRun = run([
    "run",
    ...common,
    "--dry-run",
    "--json",
    "--validate",
    "--",
    process.execPath,
    child,
  ]);
  assert.strictEqual(dryRun.status, 0);
  assert.strictEqual(JSON.parse(dryRun.stdout).execution.attempted, false);
  assert(!dryRun.stdout.includes("child-ran"));

  const blocked = run([
    "run",
    ...common,
    "--json",
    "--validate",
    "--",
    process.execPath,
    child,
  ]);
  assert.strictEqual(blocked.status, 3);
  assert.strictEqual(JSON.parse(blocked.stdout).status, "BLOCKED_PERMISSION");
  fs.rmSync(directory, { recursive: true, force: true });
}

function testInjectionSuppressesDecryptedAndChildOutput() {
  const directory = temporaryDirectory();
  const tools = makeFakeTools(directory);
  const identity = path.join(directory, "identity.txt");
  const encrypted = path.join(directory, "runtime.env");
  const child = path.join(directory, "child script.js");
  const sensitive = ["synthetic", "decrypted", "fixture"].join("-");
  write(identity, "synthetic identity fixture\n", 0o600);
  write(encrypted, "RUNTIME_INPUT=ENC[AES256_GCM,data:fixture]\nsops_version=3.13.2\n");
  write(child, [
    "process.stdout.write(process.env.RUNTIME_INPUT || 'missing')",
    "process.stderr.write('child diagnostic')",
  ].join(";\n"));

  const result = run([
    "run",
    "--file",
    encrypted,
    "--key-file",
    identity,
    ...toolArgs(tools),
    "--allow-secret-access",
    "--json",
    "--validate",
    "--",
    process.execPath,
    child,
  ], {
    FIXTURE_VALUE: sensitive,
  });
  assert.strictEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.strictEqual(report.status, "PASS");
  assert.strictEqual(report.execution.attempted, true);
  assert(report.execution.stdout_bytes_suppressed > 0);
  assert(report.execution.stderr_bytes_suppressed > 0);
  assert(!result.stdout.includes(sensitive));
  assert(!result.stdout.includes("child diagnostic"));
  assert(!result.stderr.includes(sensitive));
  fs.rmSync(directory, { recursive: true, force: true });
}

function testChildFailureIsRedacted() {
  const directory = temporaryDirectory();
  const tools = makeFakeTools(directory);
  const identity = path.join(directory, "identity.txt");
  const encrypted = path.join(directory, "runtime.env");
  const child = path.join(directory, "failure.js");
  const sensitive = ["synthetic", "failure", "fixture"].join("-");
  write(identity, "synthetic identity fixture\n", 0o600);
  write(encrypted, "RUNTIME_INPUT=ENC[AES256_GCM,data:fixture]\nsops_version=3.13.2\n");
  write(child, "process.stderr.write(process.env.RUNTIME_INPUT || 'missing'); process.exit(7)\n");

  const result = run([
    "run",
    "--file",
    encrypted,
    "--key-file",
    identity,
    ...toolArgs(tools),
    "--allow-secret-access",
    "--json",
    "--validate",
    "--",
    process.execPath,
    child,
  ], {
    FIXTURE_VALUE: sensitive,
  });
  assert.strictEqual(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.strictEqual(report.execution.exit_code, 7);
  assert(!result.stdout.includes(sensitive));
  assert(!result.stderr.includes(sensitive));
  fs.rmSync(directory, { recursive: true, force: true });
}

function testPackageBoundary() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert(packageJson.files.includes("scripts/"));
  assert(packageJson.files.includes("schemas/"));
  assert(packageJson.files.includes("skill-files/"));
  assert(packageJson.files.includes("tests/"));
  assert(fs.existsSync(SCRIPT));
  assert(fs.existsSync(path.join(ROOT, "schemas", "sops-age-secret-access.schema.json")));
  assert(fs.existsSync(path.join(ROOT, "skill-files", "sops-age-secret-access-skill.md")));
  assert(!fs.existsSync(path.join(ROOT, "scripts", "one-password-secret-access")));
}

testCapabilityAndIdentityStatus();
testMissingCapabilityAndIdentity();
testSuccessfulExitOverridesNonFatalSpawnArtifact();
testIdentityPermissionBoundary();
testEncryptedFileValidation();
testDryRunAndPermissionBoundary();
testInjectionSuppressesDecryptedAndChildOutput();
testChildFailureIsRedacted();
testPackageBoundary();

console.log("sops-age-secret-access tests passed");
