"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const locks = new Map();

function fail(message, state = "BLOCKED_SAFETY", evidence = []) {
  return { ok: false, state, summary: message, evidence };
}

function canonicalExisting(input, label, kind = "file") {
  if (!path.isAbsolute(input || "")) throw new Error(`${label} must be an absolute path`);
  const resolved = fs.realpathSync(input);
  const stat = fs.statSync(resolved);
  if (kind === "file" && !stat.isFile()) throw new Error(`${label} must be a file`);
  if (kind === "directory" && !stat.isDirectory()) throw new Error(`${label} must be a directory`);
  if (resolved !== input) throw new Error(`${label} must already be canonical`);
  return resolved;
}

function inside(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function approvalIdentity(manifest) {
  const release = manifest.release;
  return crypto.createHash("sha256").update(stable({
    repository_root: manifest.repository.root,
    github_repository: manifest.repository.github,
    package_name: release.package_name,
    version: release.version,
    tarball_sha256: release.tarball_sha256,
    git_tag: release.git_tag,
    npm_tag: release.npm_tag,
    github_release_type: release.github_release_type,
    approval_issuer: manifest.approval?.issuer,
    approval_expires_at: manifest.approval?.expires_at,
    approval_nonce: manifest.approval?.nonce,
  })).digest("hex");
}

function validateManifest(manifest, now = new Date()) {
  try {
    if (!manifest || manifest.schema_version !== 1) throw new Error("manifest schema_version must be 1");
    const root = canonicalExisting(manifest.repository?.root, "repository.root", "directory");
    const packageDir = canonicalExisting(manifest.release?.package_dir, "release.package_dir", "directory");
    const tarball = canonicalExisting(manifest.release?.tarball, "release.tarball");
    if (!inside(root, packageDir)) throw new Error("release.package_dir must be inside repository.root");
    if (!/^[^/\s]+\/[^/\s]+$/.test(manifest.repository?.github || "")) throw new Error("repository.github must be owner/repository");
    const release = manifest.release || {};
    if (!release.package_name || !release.version || !release.git_tag || !release.npm_tag) throw new Error("release identity fields are required");
    if (!/^[a-f0-9]{64}$/.test(release.tarball_sha256 || "")) throw new Error("release.tarball_sha256 must be lowercase SHA-256");
    if (!["public", "restricted"].includes(release.npm_access)) throw new Error("release.npm_access must be public or restricted");
    if (!["prerelease", "final"].includes(release.github_release_type)) throw new Error("release.github_release_type must be prerelease or final");
    if (!Array.isArray(release.github_assets) || !release.github_assets.includes(tarball)) throw new Error("release.github_assets must include the exact tarball");
    for (const asset of release.github_assets) canonicalExisting(asset, "release.github_assets entry");
    if (!Array.isArray(manifest.validation_commands) || !manifest.validation_commands.length) throw new Error("validation_commands must be non-empty");
    if (!Array.isArray(manifest.paths?.allowed) || !Array.isArray(manifest.paths?.forbidden)) throw new Error("allowed and forbidden paths are required");
    canonicalExisting(release.release_notes, "release.release_notes");
    const approval = manifest.approval || {};
    if (!approval.issuer || !approval.expires_at || !approval.nonce || !approval.identity) throw new Error("approval issuer, expiry, nonce, and identity are required");
    const expires = new Date(approval.expires_at);
    if (!Number.isFinite(expires.getTime()) || expires <= now) throw new Error("approval is expired");
    const expected = approvalIdentity(manifest);
    if (approval.identity !== expected) throw new Error("approval identity does not match the exact release");
    return { ok: true, root, packageDir, tarball, identity: expected };
  } catch (error) {
    return fail(error.message);
  }
}

function packageRepository(pkg) {
  return typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url || "";
}

function validateArtifact(manifest) {
  const checked = validateManifest(manifest);
  if (!checked.ok) return checked;
  const evidence = [];
  const digest = sha256(checked.tarball);
  evidence.push(`tarball sha256: ${digest}`);
  if (digest !== manifest.release.tarball_sha256) return fail("exact tarball SHA-256 mismatch", "BLOCKED_SAFETY", evidence);
  const packagePath = path.join(checked.packageDir, "package.json");
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(packagePath, "utf8")); } catch (error) { return fail(`package.json invalid: ${error.message}`, "BLOCKED_SAFETY", evidence); }
  const release = manifest.release;
  if (pkg.name !== release.package_name || pkg.version !== release.version) return fail("package identity/version does not match manifest", "BLOCKED_SAFETY", evidence);
  if (pkg.private === true) return fail("private package cannot be published", "BLOCKED_SAFETY", evidence);
  if (!pkg.description || !packageRepository(pkg) || !pkg.license) return fail("package description, repository, and license are required", "BLOCKED_SAFETY", evidence);
  if (!packageRepository(pkg).includes(manifest.repository.github)) return fail("package repository does not match approved GitHub repository", "BLOCKED_SAFETY", evidence);
  const bins = typeof pkg.bin === "string" ? { [pkg.name]: pkg.bin } : pkg.bin || {};
  for (const [name, relative] of Object.entries(bins)) {
    const bin = path.resolve(checked.packageDir, relative);
    if (!inside(checked.packageDir, bin) || !fs.existsSync(bin)) return fail(`bin ${name} is missing or outside package`, "BLOCKED_SAFETY", evidence);
    if (!fs.readFileSync(bin, "utf8").startsWith("#!")) return fail(`bin ${name} lacks a shebang`, "BLOCKED_SAFETY", evidence);
    if ((fs.statSync(bin).mode & 0o111) === 0) return fail(`bin ${name} is not executable`, "BLOCKED_SAFETY", evidence);
  }
  evidence.push(`package identity: ${pkg.name}@${pkg.version}`);
  return { ok: true, ...checked, pkg, digest, evidence };
}

function sameObject(actual, expected) {
  return stable(actual) === stable(expected);
}

async function withReleaseLock(key, callback) {
  const previous = locks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  locks.set(key, previous.then(() => current));
  await previous;
  try { return await callback(); } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
}

async function executeRelease(manifest, adapter, options = {}) {
  const key = `${manifest?.release?.package_name || "unknown"}@${manifest?.release?.version || "unknown"}`;
  return withReleaseLock(key, async () => {
    const validation = validateArtifact(manifest);
    if (!validation.ok) return validation;
    const evidence = [...validation.evidence];
    if (options.dryRun) return { ok: true, state: "DRY_RUN", evidence, calls: [] };

    for (const command of manifest.validation_commands) {
      const result = await adapter.validate(command, manifest.repository.root);
      evidence.push(`validation ${command}: ${result.ok ? "passed" : "failed"}`);
      if (!result.ok) return fail(`validation command failed: ${command}`, "BLOCKED_SAFETY", evidence);
    }

    const beforeTags = await adapter.npmDistTags(manifest.release.package_name);
    const existingNpm = await adapter.npmVersion(manifest.release.package_name, manifest.release.version);
    const expectedGithub = {
      tag: manifest.release.git_tag,
      prerelease: manifest.release.github_release_type === "prerelease",
      assets: manifest.release.github_assets.map((item) => path.basename(item)).sort(),
    };
    const existingGithub = await adapter.githubRelease(manifest.repository.github, manifest.release.git_tag);
    if (existingNpm && !sameObject(existingNpm, { name: manifest.release.package_name, version: manifest.release.version, digest: manifest.release.tarball_sha256 })) {
      return fail("existing npm version conflicts with the exact release", "BLOCKED_SAFETY", evidence);
    }
    if (existingGithub && !sameObject(existingGithub, expectedGithub)) return fail("existing GitHub release conflicts with the exact release", "BLOCKED_SAFETY", evidence);

    if (!existingGithub) {
      const created = await adapter.createGithubRelease(manifest);
      evidence.push(`GitHub release creation: ${created.ok ? "created" : "failed"}`);
      if (!created.ok) return fail("GitHub release creation failed", "BLOCKED_CAPABILITY", evidence);
    } else evidence.push("GitHub release: matching existing artifact");

    if (!existingNpm) {
      const immediateDigest = sha256(validation.tarball);
      if (immediateDigest !== manifest.release.tarball_sha256) return fail("exact tarball changed immediately before npm publish", "BLOCKED_SAFETY", evidence);
      const published = await adapter.publishTarball(validation.tarball, {
        access: manifest.release.npm_access,
        tag: manifest.release.npm_tag,
      });
      evidence.push(`npm exact-tarball publish: ${published.ok ? "submitted" : "failed"}`);
      if (!published.ok) return fail("npm exact-tarball publication failed after GitHub release", "BLOCKED_CAPABILITY", evidence);
    } else evidence.push("npm publication: matching existing artifact");

    const verifiedNpm = await adapter.npmVersion(manifest.release.package_name, manifest.release.version);
    if (!sameObject(verifiedNpm, { name: manifest.release.package_name, version: manifest.release.version, digest: manifest.release.tarball_sha256 })) {
      return fail("npm publication could not be independently verified", "WAITING_CONDITION", evidence);
    }
    const afterTags = await adapter.npmDistTags(manifest.release.package_name);
    if (manifest.release.npm_tag !== "latest" && beforeTags.latest !== afterTags.latest) return fail("npm latest dist-tag changed during prerelease", "BLOCKED_SAFETY", evidence);
    if (afterTags[manifest.release.npm_tag] !== manifest.release.version) return fail("requested npm dist-tag does not resolve to released version", "BLOCKED_SAFETY", evidence);
    const verifiedGithub = await adapter.githubRelease(manifest.repository.github, manifest.release.git_tag);
    if (!sameObject(verifiedGithub, expectedGithub)) return fail("GitHub prerelease/assets verification failed", "BLOCKED_SAFETY", evidence);
    evidence.push("offline release verification: npm identity/digest/dist-tags and GitHub type/assets match");
    return { ok: true, state: "COMPLETE", evidence, npm: verifiedNpm, github: verifiedGithub, distTags: afterTags };
  });
}

module.exports = {
  approvalIdentity,
  executeRelease,
  sha256,
  stable,
  validateArtifact,
  validateManifest,
};
