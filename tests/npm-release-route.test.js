#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const base = require("../scripts/lib/run-next/npm-release-contract");
const route = require("../scripts/lib/run-next/npm-release-route");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "npm-release-route-"));

function manifest() {
  const packageDir = path.join(root, "package");
  const artifacts = path.join(root, "artifacts");
  fs.mkdirSync(path.join(packageDir, "bin"), { recursive: true });
  fs.mkdirSync(artifacts, { recursive: true });
  const bin = path.join(packageDir, "bin", "cli.js");
  fs.writeFileSync(bin, "#!/usr/bin/env node\n");
  fs.chmodSync(bin, 0o755);
  fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({
    name: "@example/release", version: "1.0.0-rc.4", description: "release",
    repository: "https://github.com/example/repo.git", license: "MIT", bin: { release: "bin/cli.js" },
  }));
  const tarball = path.join(artifacts, "release.tgz");
  fs.writeFileSync(tarball, "exact tarball");
  const notes = path.join(root, "notes.md");
  fs.writeFileSync(notes, "notes");
  const value = {
    schema_version: 1,
    repository: { root, github: "example/repo", branch: "main" },
    release: {
      package_name: "@example/release", version: "1.0.0-rc.4", package_dir: packageDir,
      tarball, tarball_sha256: base.sha256(tarball), npm_access: "public", npm_tag: "next",
      unchanged_dist_tags: ["latest", "beta"], git_tag: "v1.0.0-rc.4",
      github_release_type: "prerelease", github_assets: [tarball], release_notes: notes,
    },
    validation_commands: ["npm test"],
    paths: { allowed: [packageDir, artifacts, notes], forbidden: [path.join(root, ".env")] },
    approval: { issuer: "release-authority", expires_at: "2099-01-01T00:00:00.000Z", identity: "" },
  };
  value.approval.identity = base.approvalIdentity(value);
  return value;
}

async function main() {
  const valid = manifest();
  assert.equal(route.validateDeclarativeRelease(valid).ok, true);

  const forbidden = structuredClone(valid);
  forbidden.paths.forbidden = [forbidden.release.tarball];
  assert.match(route.validateDeclarativeRelease(forbidden).summary, /forbidden/);
  const latest = structuredClone(valid);
  latest.release.npm_tag = "latest";
  latest.release.unchanged_dist_tags = [];
  latest.approval.identity = base.approvalIdentity(latest);
  assert.match(route.validateDeclarativeRelease(latest).summary, /non-latest/);
  const wrongTag = structuredClone(valid);
  wrongTag.release.git_tag = "v1.0.0-rc.3";
  wrongTag.approval.identity = base.approvalIdentity(wrongTag);
  assert.match(route.validateDeclarativeRelease(wrongTag).summary, /Git tag/);
  assert.match(route.validateDeclarativeRelease(valid, new Date("2100-01-01")).summary, /expired/);

  const calls = [];
  let npm = null;
  let github = null;
  let tags = { latest: "0.9.0", beta: "0.9.0-beta.1" };
  const adapter = {
    validate: async () => ({ ok: true }),
    npmDistTags: async () => ({ ...tags }),
    npmVersion: async () => npm,
    githubRelease: async () => github,
    createGithubRelease: async (input, identity) => {
      calls.push(["github", identity]);
      github = { tag: input.release.git_tag, prerelease: true, assets: ["release.tgz"], asset_digests: [{ name: "release.tgz", sha256: input.release.tarball_sha256 }] };
      return { ok: true };
    },
    publishTarball: async (tarball, flags, identity) => {
      calls.push(["npm", tarball, flags, identity]);
      npm = { name: valid.release.package_name, version: valid.release.version, digest: valid.release.tarball_sha256 };
      tags = { ...tags, next: valid.release.version };
      return { ok: true };
    },
  };
  const dryCalls = [];
  const dry = await route.executeDeclarativeRelease(valid, new Proxy({}, { get: (_, key) => (...args) => { dryCalls.push([key, ...args]); } }), { dryRun: true });
  assert.equal(dry.state, "DRY_RUN");
  assert.equal(dryCalls.length, 0);
  const released = await route.executeDeclarativeRelease(valid, adapter);
  assert.equal(released.state, "COMPLETE");
  assert.equal(released.distTags.latest, "0.9.0");
  assert.equal(released.distTags.beta, "0.9.0-beta.1");
  assert.equal(calls[1][1], valid.release.tarball);
  assert.equal(calls[0][1].version, valid.release.version, "approval identity was not passed to GitHub boundary");
  assert.equal(calls[1][3].tarball_sha256, valid.release.tarball_sha256, "approval identity was not passed to npm boundary");

  const manifestPath = path.join(root, "release-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(valid));
  const canonicalDryRun = spawnSync(process.execPath, [path.resolve(__dirname, "../scripts/run-next"), "--release-manifest", manifestPath, "--dry-run"], { cwd: root, encoding: "utf8" });
  assert.equal(canonicalDryRun.status, 0, canonicalDryRun.stderr || canonicalDryRun.stdout);
  assert.match(canonicalDryRun.stdout, new RegExp("DRY RUN PASSED"));
  assert.match(canonicalDryRun.stdout, new RegExp("dry-run made no git, npm, GitHub, credential"));

  console.log("Generic npm prerelease route tests passed: declarative paths/tags/expiry, dry-run zero calls, exact artifact, bound identity, unchanged dist-tags, and prerelease assets.");
}

main().finally(() => fs.rmSync(root, { recursive: true, force: true })).catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
