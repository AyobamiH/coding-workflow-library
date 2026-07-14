#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "migration-review");
const {
  buildMigrationReview,
  renderHuman,
  validateMigrationReview,
} = require(script);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "migration-review-test-"));

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
}

function write(base, relativePath, text) {
  const full = path.join(base, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}

function listFiles(base) {
  return fs.existsSync(base) ? fs.readdirSync(base, { recursive: true }).sort() : [];
}

function initRepo(name) {
  const repo = path.join(temp, name);
  fs.mkdirSync(repo, { recursive: true });
  assert.equal(run("git", ["init", "-b", "main"], repo).status, 0, "git init should pass");
  return repo;
}

try {
  const emptyRepo = initRepo("empty repo");
  write(emptyRepo, "README.md", "# Empty\n");
  assert.equal(run("git", ["add", "README.md"], emptyRepo).status, 0, "empty repo add should pass");
  const emptyReview = buildMigrationReview({ repo: emptyRepo, maxFiles: 500 });
  assert.equal(emptyReview.status, "NO_MIGRATIONS_FOUND", "no-migration repo should be handled safely");
  assert.equal(emptyReview.summary.files_reviewed, 0, "no migrations should be reviewed");

  const repo = initRepo("fixture repo");
  write(repo, "README.md", "# Fixture\n");
  write(repo, "supabase/migrations/20260101010101_add_pets.sql", [
    "create table if not exists public.pets (",
    "  id uuid primary key",
    ");",
    "create index if not exists pets_id_idx on public.pets(id);",
  ].join("\n"));
  write(repo, "supabase/migrations/20260101010202_drop_table.sql", "drop table public.old_pets;\n");
  write(repo, "supabase/migrations/20260101010303_delete_rows.sql", "delete from public.pets;\n");
  write(repo, "supabase/migrations/20260101010404_update_all.sql", "update public.pets set name = 'unknown';\n");
  write(repo, "supabase/migrations/20260101010505_rls_policy.sql", [
    "alter table public.pets enable row level security;",
    "create policy pets_read on public.pets for select using (true);",
  ].join("\n"));
  write(repo, "supabase/migrations/20260101010606_grants.sql", [
    "grant select on public.pets to public;",
    "revoke update on public.pets from anon;",
  ].join("\n"));
  write(repo, "supabase/migrations/20260101010707_functions.sql", [
    "create function public.pet_count() returns int",
    "language sql security definer",
    "as $$ select count(*) from public.pets $$;",
    "create trigger pets_touch before update on public.pets for each row execute function public.pet_count();",
  ].join("\n"));
  write(repo, "supabase/migrations/20260101010808_scheduler_vault.sql", [
    "create extension if not exists pg_cron;",
    "select cron.schedule('daily', '0 8 * * *', $$ select net.http_post(url := 'https://example.invalid', headers := jsonb_build_object('x-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'safe_name'))) $$);",
  ].join("\n"));
  const secretValue = ["sk", "migrationreviewsecretvalue"].join("-");
  write(repo, "supabase/migrations/20260101010909_secret_literal.sql", `select '${secretValue}' as unsafe;\n`);
  write(repo, "database/migrations/001_custom.sql", "comment on table public.pets is 'safe';\n");
  write(repo, "supabase/migrations/20260101011010_file with spaces.sql", "alter table public.pets add column if not exists age int;\n");
  write(repo, "tmp/generated.sql", "drop table ignored;\n");

  assert.equal(run("git", ["add", "README.md", "supabase/migrations", "database/migrations"], repo).status, 0, "fixture git add should pass");

  const before = listFiles(repo);
  const review = buildMigrationReview({ repo, maxFiles: 500 });
  const after = listFiles(repo);
  const serialized = JSON.stringify(review, null, 2);
  const human = renderHuman(review);

  assert.equal(review.repo.root, ".", "output must use portable root");
  assert.equal(review.migration_directories.some((dir) => dir.path === "supabase/migrations"), true, "supabase/migrations should be discovered");
  assert.deepEqual(review.migrations.map((migration) => migration.path), [...review.migrations.map((migration) => migration.path)].sort((a, b) => a.localeCompare(b)), "migration files should sort deterministically");
  assert.equal(review.status, "FAIL", "high-risk fixture should produce FAIL status");
  assert.ok(review.migrations.find((migration) => migration.path.endsWith("add_pets.sql") && migration.risk === "LOW"), "additive migration should be low risk");
  assert.ok(review.migrations.find((migration) => migration.path.endsWith("drop_table.sql") && migration.risk === "HIGH"), "drop table should be high risk");
  assert.ok(review.migrations.find((migration) => migration.path.endsWith("delete_rows.sql") && migration.risk === "HIGH"), "delete from should be high risk");
  assert.ok(review.migrations.find((migration) => migration.path.endsWith("update_all.sql") && migration.risk === "HIGH"), "update without where should be high risk");
  assert.ok(review.migrations.find((migration) => migration.path.endsWith("rls_policy.sql")).statement_categories.includes("policy_change"), "policy changes should be detected");
  assert.ok(review.migrations.find((migration) => migration.path.endsWith("rls_policy.sql")).statement_categories.includes("rls_change"), "RLS changes should be detected");
  assert.ok(review.migrations.find((migration) => migration.path.endsWith("grants.sql")).statement_categories.includes("grant"), "grant should be detected");
  assert.ok(review.migrations.find((migration) => migration.path.endsWith("grants.sql")).statement_categories.includes("revoke"), "revoke should be detected");
  assert.ok(review.migrations.find((migration) => migration.path.endsWith("functions.sql")).statement_categories.includes("function_change"), "function changes should be detected");
  assert.ok(review.migrations.find((migration) => migration.path.endsWith("functions.sql")).statement_categories.includes("trigger_change"), "trigger changes should be detected");
  assert.ok(review.migrations.find((migration) => migration.path.endsWith("functions.sql")).statement_categories.includes("unsafe_security_definer"), "unsafe security definer should be detected");
  const scheduler = review.migrations.find((migration) => migration.path.endsWith("scheduler_vault.sql"));
  assert.ok(scheduler.statement_categories.includes("scheduler_change"), "pg_cron should be categorised");
  assert.ok(scheduler.statement_categories.includes("pg_net_change"), "pg_net should be categorised");
  assert.ok(scheduler.statement_categories.includes("vault_reference"), "Vault references should be categorised");
  const secretFinding = review.migrations.find((migration) => migration.path.endsWith("secret_literal.sql"));
  assert.equal(secretFinding.secret_shaped_value_detected, true, "secret-shaped SQL should be flagged");
  assert.doesNotMatch(serialized, new RegExp(secretValue), "JSON output must not print secret value");
  assert.doesNotMatch(human, new RegExp(secretValue), "human output must not print secret value");
  assert.doesNotMatch(serialized, new RegExp(repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "JSON output must not include absolute fixture path");
  assert.ok(review.migrations.some((migration) => migration.filename.includes("file with spaces")), "filenames containing spaces should be handled safely");
  assert.deepEqual(before, after, "migration-review must not mutate target repo");
  assert.deepEqual(validateMigrationReview(review), [], "valid review should pass internal validation");
  assert.deepEqual(buildMigrationReview({ repo, maxFiles: 500 }), review, "repeated output should be deterministic");

  const customReview = buildMigrationReview({ repo, migrationsDir: "database/migrations", maxFiles: 500 });
  assert.equal(customReview.summary.files_reviewed, 1, "custom migration directory should be honoured");
  assert.equal(customReview.migrations[0].path, "database/migrations/001_custom.sql", "custom directory should return expected file");

  const lowRepo = initRepo("low repo");
  write(lowRepo, "migrations/001_init.sql", "create table if not exists public.safe (id uuid primary key);\n");
  assert.equal(run("git", ["add", "migrations/001_init.sql"], lowRepo).status, 0, "low repo add should pass");
  const lowReview = buildMigrationReview({ repo: lowRepo, maxFiles: 500 });
  assert.equal(lowReview.status, "PASS", "low-risk migration repo should pass");
  assert.deepEqual(validateMigrationReview(lowReview), [], "validation mode should pass for valid low-risk output");
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(lowReview)), "json output should parse");
  assert.doesNotMatch(renderHuman(review), new RegExp(secretValue), "human output must not include secret value");
  assert.equal(review.summary.high_risk_files > 0, true, "fail-on-high-risk has high-risk evidence to fail on");
  assert.deepEqual(validateMigrationReview(emptyReview), [], "validate mode should allow no-migration repos");

  const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas", "migration-review.schema.json"), "utf8"));
  assert.ok(schema.required.includes("migrations"), "schema should require migrations");
  assert.ok(schema.required.includes("source_only_boundaries"), "schema should require source-only boundaries");
  assert.ok(validateMigrationReview({}).length > 0, "malformed internal output should fail validation");

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok((packageJson.files || []).includes("scripts/"), "package allowlist should include helper scripts");
  assert.ok((packageJson.files || []).includes("schemas/"), "package allowlist should include schemas");
  assert.ok((packageJson.files || []).includes("tests/"), "package allowlist should include tests");
  assert.ok(fs.existsSync(script), "migration-review helper should exist");
  assert.ok(fs.existsSync(path.join(root, "schemas", "migration-review.schema.json")), "migration-review schema should exist");
  assert.ok(!fs.existsSync(path.join(root, "tmp", "migration-review-test")), "test temp data should not be in package root");

  console.log("migration-review tests passed: discovery, risk classification, privacy, validation, determinism, and package inclusion.");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
