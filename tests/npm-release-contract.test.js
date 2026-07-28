#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const contract = require("../scripts/lib/run-next/npm-release-contract");

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "npm-release-contract-"));

function fixture(name = "@example/agentproof", version = "0.1.0-rc.4", npmTag = "next") {
  const root = fs.mkdtempSync(path.join(temporary, "repo-"));
  const packageDir = path.join(root, "package");
  const artifacts = path.join(root, "artifacts");
  fs.mkdirSync(path.join(packageDir, "bin"), { recursive: true });
  fs.mkdirSync(artifacts);
  const bin = path.join(packageDir, "bin", "cli.js");
  fs.writeFileSync(bin, "#!/usr/bin/env node\n");
  fs.chmodSync(bin, 0o755);
  fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({
    name, version, description: "Test package", repository: "https://github.com/example/repo.git",
    license: "MIT", bin: { agentproof: "bin/cli.js" },
  }));
  const tarball = path.join(artifacts, `${name.replace(/[@/]/g, "-")}-${version}.tgz`);
  fs.writeFileSync(tarball, `exact ${name}@${version}`);
  const notes = path.join(root, "release-notes.md");
  fs.writeFileSync(notes, `${version}\n`);
  const manifest = {
    schema_version: 1,
    repository: { root, github: "example/repo", branch: "main" },
    release: {
      package_name: name, version, package_dir: packageDir, tarball,
      tarball_sha256: contract.sha256(tarball), npm_access: "public", npm_tag: npmTag,
      unchanged_dist_tags: npmTag === "latest" ? [] : ["latest"], git_tag: `v${version}`,
      github_release_type: version.includes("-") ? "prerelease" : "final",
      github_assets: [tarball], release_notes: notes,
    },
    validation_commands: ["npm test", "npm run typecheck"],
    paths: { allowed: [packageDir, tarball], forbidden: [path.join(root, ".env")] },
    approval: { issuer: "test-authority", expires_at: "2099-01-01T00:00:00.000Z", identity: "" },
  };
  manifest.approval.identity = contract.approvalIdentity(manifest);
  return manifest;
}

function adapter(manifest, options = {}) {
  const calls = [];
  let npm = options.existingNpm || null;
  let github = options.existingGithub || null;
  let tags = { latest: "0.0.9", ...(options.tags || {}) };
  const expectedNpm = { name: manifest.release.package_name, version: manifest.release.version, digest: manifest.release.tarball_sha256 };
  const expectedGithub = {
    tag: manifest.release.git_tag,
    prerelease: manifest.release.github_release_type === "prerelease",
    assets: manifest.release.github_assets.map((item) => path.basename(item)).sort(),
  };
  return {
    calls,
    validate: async (command) => { calls.push(["validate", command]); return { ok: options.validationFail !== command }; },
    npmDistTags: async () => { calls.push(["npmDistTags"]); return { ...tags }; },
    npmVersion: async () => { calls.push(["npmVersion"]); return options.verifyNpmFail && calls.filter(([x]) => x === "npmVersion").length > 1 ? null : npm; },
    githubRelease: async () => { calls.push(["githubRelease"]); return github; },
    createGithubRelease: async () => {
      calls.push(["createGithubRelease"]);
      if (options.githubFail) return { ok: false };
      github = expectedGithub;
      return { ok: true };
    },
    publishTarball: async (file, flags) => {
      calls.push(["publishTarball", file, flags]);
      if (options.npmFail) return { ok: false };
      npm = expectedNpm;
      tags = { ...tags, [manifest.release.npm_tag]: manifest.release.version };
      return { ok: true };
    },
  };
}

async function main() {
  const scoped = fixture();
  assert.equal(contract.validateArtifact(scoped).ok, true, "scoped package/prerelease manifest should validate");
  const arbitrary = fixture("arbitrary-package", "2.3.4-rc.1");
  assert.equal(contract.validateArtifact(arbitrary).ok, true, "arbitrary repository/package should validate");

  const relative = fixture();
  relative.release.tarball = path.relative(process.cwd(), relative.release.tarball);
  assert.match(contract.validateManifest(relative).summary, /absolute/);
  const missing = fixture();
  missing.release.tarball = path.join(missing.repository.root, "missing.tgz");
  assert.match(contract.validateManifest(missing).summary, /ENOENT/);

  const badHash = fixture();
  badHash.release.tarball_sha256 = "0".repeat(64);
  badHash.approval.identity = contract.approvalIdentity(badHash);
  assert.match(contract.validateArtifact(badHash).summary, /SHA-256 mismatch/);

  const wrongIdentity = fixture();
  wrongIdentity.release.package_name = "different";
  wrongIdentity.approval.identity = contract.approvalIdentity(wrongIdentity);
  assert.match(contract.validateArtifact(wrongIdentity).summary, /identity\/version/);

  for (const mutation of [
    (pkg) => { pkg.private = true; },
    (pkg) => { delete pkg.description; },
    (pkg) => { delete pkg.repository; },
    (pkg) => { delete pkg.license; },
  ]) {
    const current = fixture();
    const pkgPath = path.join(current.release.package_dir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath));
    mutation(pkg);
    fs.writeFileSync(pkgPath, JSON.stringify(pkg));
    assert.equal(contract.validateArtifact(current).ok, false);
  }

  const nonexec = fixture();
  fs.chmodSync(path.join(nonexec.release.package_dir, "bin", "cli.js"), 0o644);
  assert.match(contract.validateArtifact(nonexec).summary, /not executable/);

  const approvedRc3 = fixture("@example/agentproof", "0.1.0-rc.3");
  const rc4 = fixture("@example/agentproof", "0.1.0-rc.4");
  rc4.approval.identity = approvedRc3.approval.identity;
  assert.match(contract.validateManifest(rc4).summary, /approval identity/);

  const dry = fixture();
  const dryAdapter = adapter(dry);
  assert.equal((await contract.executeRelease(dry, dryAdapter, { dryRun: true })).state, "DRY_RUN");
  assert.deepEqual(dryAdapter.calls, [], "dry-run made external adapter calls");

  const successful = fixture();
  const successfulAdapter = adapter(successful);
  const result = await contract.executeRelease(successful, successfulAdapter);
  assert.equal(result.state, "COMPLETE");
  const publishCall = successfulAdapter.calls.find(([name]) => name === "publishTarball");
  assert.equal(publishCall[1], successful.release.tarball, "publish did not use exact tarball");
  assert.deepEqual(publishCall[2], { access: "public", tag: "next" });
  assert.equal(result.distTags.latest, "0.0.9", "prerelease changed latest");
  assert.equal(result.github.prerelease, true);
  assert.deepEqual(result.github.assets, [path.basename(successful.release.tarball)]);

  const matching = fixture();
  const matchingNpm = { name: matching.release.package_name, version: matching.release.version, digest: matching.release.tarball_sha256 };
  const matchingGithub = { tag: matching.release.git_tag, prerelease: true, assets: [path.basename(matching.release.tarball)] };
  const matchingAdapter = adapter(matching, { existingNpm: matchingNpm, existingGithub: matchingGithub, tags: { next: matching.release.version } });
  assert.equal((await contract.executeRelease(matching, matchingAdapter)).state, "COMPLETE");
  assert.equal(matchingAdapter.calls.some(([name]) => name === "publishTarball"), false, "matching retry republished");
  assert.equal(matchingAdapter.calls.some(([name]) => name === "createGithubRelease"), false, "matching retry recreated GitHub release");

  const conflict = fixture();
  const conflictAdapter = adapter(conflict, { existingNpm: { name: conflict.release.package_name, version: conflict.release.version, digest: "bad" } });
  assert.match((await contract.executeRelease(conflict, conflictAdapter)).summary, /conflicts/);

  const npmFailure = fixture();
  const npmFailureAdapter = adapter(npmFailure, { npmFail: true });
  const npmFailureResult = await contract.executeRelease(npmFailure, npmFailureAdapter);
  assert.match(npmFailureResult.summary, /after GitHub release/);
  assert(npmFailureResult.evidence.some((item) => /GitHub release creation: created/.test(item)), "partial GitHub evidence missing");

  const verifyFailure = fixture();
  const verifyFailureAdapter = adapter(verifyFailure, { verifyNpmFail: true });
  assert.equal((await contract.executeRelease(verifyFailure, verifyFailureAdapter)).state, "WAITING_CONDITION");

  const concurrent = fixture();
  const concurrentAdapter = adapter(concurrent);
  const [first, second] = await Promise.all([
    contract.executeRelease(concurrent, concurrentAdapter),
    contract.executeRelease(concurrent, concurrentAdapter),
  ]);
  assert.equal(first.ok && second.ok, true);
  assert.equal(concurrentAdapter.calls.filter(([name]) => name === "publishTarball").length, 1, "concurrent duplicate published more than once");

  console.log("Generic npm release contract tests passed: arbitrary/scoped identity, exact artifact, metadata/bin gates, bound approval, dry-run, prerelease tags/assets, idempotency, conflicts, partial failure, verification, and serialization.");
}

main().finally(() => fs.rmSync(temporary, { recursive: true, force: true })).catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
