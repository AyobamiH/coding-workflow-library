#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const { loadManifest } = require(path.join(ROOT, "scripts/lib/secret-bundles/manifest"));
const { buildInventory } = require(path.join(ROOT, "scripts/lib/secret-bundles/inventory"));
const { migrate, retireSource, validateBundleFiles } = require(path.join(ROOT, "scripts/lib/secret-bundles/migration"));
const {
  portableCommandName,
  proveBundles,
  resolveRequest,
  runProfile,
} = require(path.join(ROOT, "scripts/lib/secret-bundles/delivery"));
const { postgresEnvironment } = require(path.join(ROOT, "scripts/lib/secret-bundles/read-only-probes"));

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "coding-workflow-secret-bundles-"));
}

function write(filePath, content, mode = 0o600) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { mode });
}

function makeFakeTools(directory) {
  const tools = path.join(directory, "tools");
  const sops = path.join(tools, "sops.js");
  const age = path.join(tools, "age.js");
  const ageKeygen = path.join(tools, "age-keygen.js");
  write(sops, "#!/usr/bin/env node\nprocess.exit(0)\n", 0o700);
  write(age, "#!/usr/bin/env node\nconsole.log('v1.3.1')\n", 0o700);
  write(ageKeygen, "#!/usr/bin/env node\nconsole.log('v1.3.1')\n", 0o700);
  return { sops, age, ageKeygen };
}

async function fakeEncryptJson(_manifest, _bundle, payload) {
  const encrypted = Object.fromEntries(Object.entries(payload).map(([key, value]) => [
    key,
    `ENC[FAKE,data:${Buffer.from(value).toString("base64")}]`,
  ]));
  encrypted.sops = { version: "3.13.2", mac: "ENC[FAKE,data:bWFj]" };
  return Buffer.from(`${JSON.stringify(encrypted)}\n`);
}

function fakeFileStatus() {
  return true;
}

function fakeInvokeAdapter(_manifest, _bundle, allowSecretAccess, command) {
  return {
    passed: true,
    status: 0,
    attempted: allowSecretAccess,
    command: path.basename(command[0]),
  };
}

async function fakeDecryptJson(_manifest, filePath) {
  const encrypted = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Object.fromEntries(Object.entries(encrypted).filter(([key]) => key !== "sops").map(([key, value]) => [
    key,
    Buffer.from(value.slice(14, -1), "base64").toString("utf8"),
  ]));
}

function makeManifest(directory, tools, expectedNames = ["CF_TOKEN", "GH_USER", "LEGACY_ROLE", "OPENAI_KEY"]) {
  const manifestPath = path.join(directory, "manifest.json");
  const identity = path.join(directory, "identity.txt");
  const policy = path.join(directory, ".sops.yaml");
  write(identity, "synthetic identity\n", 0o600);
  write(policy, "creation_rules: []\n", 0o600);
  const manifest = {
    schema_version: 1,
    source: { expected_names: expectedNames },
    tooling: {
      sops_bin: tools.sops,
      age_bin: tools.age,
      age_keygen_bin: tools.ageKeygen,
      age_key_file: identity,
      policy_file: policy,
    },
    bundles: [
      {
        id: "github-user",
        file: "github-user.enc.json",
        consumers: ["github-cli"],
        variables: [{ source: "GH_USER", runtime: "GH_TOKEN" }],
      },
      {
        id: "cloud-service",
        file: "cloud-service.enc.json",
        consumers: ["cloud-cli"],
        variables: [{ source: "CF_TOKEN", runtime: "CLOUD_TOKEN" }],
      },
      {
        id: "openclaw-runtime",
        file: "openclaw-runtime.enc.json",
        consumers: ["openclaw"],
        variables: [
          { source: "OPENAI_KEY", runtime: "OPENAI_API_KEY" },
          { source: "LEGACY_ROLE", runtime: "LEGACY_ROLE" },
        ],
      },
    ],
    profiles: [
      { id: "github-read", bundle: "github-user", allowed_commands: ["node"] },
      { id: "cloud-read", bundle: "cloud-service", allowed_commands: ["node"] },
      { id: "openclaw-runtime", bundle: "openclaw-runtime", allowed_commands: ["node"], openclaw_resolver: true },
    ],
  };
  write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 0o600);
  return manifestPath;
}

function makeSource(directory) {
  const source = path.join(directory, ".env");
  write(source, [
    "GH_USER=synthetic-github-value",
    ["CF_TOKEN", "='synthetic-cloud-value'"].join(""),
    "OPENAI_KEY=synthetic-openai-value",
    'LEGACY_ROLE="synthetic-role-value"',
    "",
  ].join("\n"), 0o600);
  return source;
}

async function testInventoryMigrationDeliveryAndRetirement() {
  const directory = temporaryDirectory();
  const tools = makeFakeTools(directory);
  const manifest = makeManifest(directory, tools);
  const source = makeSource(directory);
  const consumer = path.join(directory, "consumer-repo");
  write(path.join(consumer, "README.md"), "# Consumer\n\nUses `GH_USER`.\n");
  write(path.join(consumer, ".env"), "GH_USER=must-not-be-scanned\n");

  const loaded = loadManifest(manifest);
  const inventoryReport = buildInventory(source, loaded, [{ alias: "consumer", path: consumer }]);
  assert.strictEqual(inventoryReport.coverage.complete, true);
  assert.deepStrictEqual(inventoryReport.references.GH_USER.consumer, ["README.md"]);
  const inventoryJson = JSON.stringify(inventoryReport);
  assert(!inventoryJson.includes(directory));
  assert(!inventoryJson.includes("synthetic-github-value"));

  const testOptions = { encryptJsonFn: fakeEncryptJson, encryptedFileStatusFn: fakeFileStatus };
  const migrated = await migrate(loaded, source, { allowSecretMutation: true, ...testOptions });
  assert.strictEqual(migrated.status, "PASS");
  const githubCiphertext = fs.readFileSync(path.join(directory, "github-user.enc.json"), "utf8");
  assert(githubCiphertext.includes("GH_TOKEN"));
  assert(!githubCiphertext.includes("synthetic-github-value"));
  assert(fs.existsSync(source));

  const validated = validateBundleFiles(loaded, testOptions);
  assert.strictEqual(validated.status, "PASS");

  const proved = proveBundles(loaded, true, { invokeAdapterFn: fakeInvokeAdapter });
  assert(proved.bundles.every((bundle) => bundle.passed));

  const child = path.join(directory, "check.js");
  write(child, "process.exit(process.env.GH_TOKEN ? 0 : 1)\n");
  const delivered = runProfile(loaded, "github-read", [process.execPath, child], true, { invokeAdapterFn: fakeInvokeAdapter });
  assert.strictEqual(delivered.status, "PASS");
  assert(!JSON.stringify(delivered).includes("synthetic-github-value"));

  assert.throws(
    () => runProfile(loaded, "github-read", ["curl", "https://example.invalid"], true, { invokeAdapterFn: fakeInvokeAdapter }),
    (error) => error.safeCode === "CHILD_COMMAND_NOT_ALLOWED" && error.exitCode === 3,
  );

  const resolver = await resolveRequest(
    loaded,
    "openclaw-runtime",
    { protocolVersion: 1, provider: "fixture", ids: ["OPENAI_API_KEY"] },
    true,
    { decryptJsonFn: fakeDecryptJson },
  );
  assert.strictEqual(resolver.values.OPENAI_API_KEY, "synthetic-openai-value");

  const retired = retireSource(loaded, source, {
    allowSecretAccess: true,
    allowDestructive: true,
    encryptedFileStatusFn: fakeFileStatus,
    proveBundlesFn: (loadedManifest, allowed) => proveBundles(loadedManifest, allowed, { invokeAdapterFn: fakeInvokeAdapter }),
  });
  assert.strictEqual(fs.existsSync(source), false);
  assert.strictEqual(retired.source.removed, true);
  fs.rmSync(directory, { recursive: true, force: true });
}

async function testIncompleteCoverageRefusesMigrationAndDeletion() {
  const directory = temporaryDirectory();
  const tools = makeFakeTools(directory);
  const manifest = makeManifest(directory, tools, ["GH_USER"]);
  const source = makeSource(directory);
  const loaded = loadManifest(manifest);
  await assert.rejects(
    migrate(loaded, source, { allowSecretMutation: true, encryptJsonFn: fakeEncryptJson, encryptedFileStatusFn: fakeFileStatus }),
    (error) => error.safeCode === "SOURCE_COVERAGE_INCOMPLETE",
  );
  assert(fs.existsSync(source));
  fs.rmSync(directory, { recursive: true, force: true });
}

function testPublicTemplateIsNeutralAndParseable() {
  const templatePath = path.join(ROOT, "templates", "secret-bundles.example.json");
  const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  assert.strictEqual(template.schema_version, 1);
  const serialized = JSON.stringify(template);
  const privateHomeMarker = path.posix.join("/", "home", "private-user");
  assert(!serialized.includes(privateHomeMarker));
}

function testPortableCommandNames() {
  assert.strictEqual(portableCommandName("/usr/local/bin/node"), "node");
  assert.strictEqual(portableCommandName("C:\\hostedtoolcache\\node.exe"), "node");
}

function testPostgresProbeKeepsCredentialsOutOfArguments() {
  const fixtureUrl = new URL(["postgresql", "://", "example.invalid:6543/fixture-db?sslmode=require"].join(""));
  fixtureUrl.username = "fixture-user";
  fixtureUrl.password = "fixture-password";
  const env = postgresEnvironment(fixtureUrl.toString());
  assert.strictEqual(env.PGHOST, "example.invalid");
  assert.strictEqual(env.PGPORT, "6543");
  assert.strictEqual(env.PGDATABASE, "fixture-db");
  assert.throws(() => postgresEnvironment("https://example.invalid"), /POSTGRES_URL_INVALID/);
}

(async () => {
  await testInventoryMigrationDeliveryAndRetirement();
  await testIncompleteCoverageRefusesMigrationAndDeletion();
  testPublicTemplateIsNeutralAndParseable();
  testPortableCommandNames();
  testPostgresProbeKeepsCredentialsOutOfArguments();
  console.log("secret-bundles tests passed");
})().catch((error) => {
  console.error(error && error.safeCode ? error.safeCode : error);
  process.exit(1);
});
