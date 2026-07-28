"use strict";

const fs = require("fs");
const path = require("path");
const base = require("./npm-release-contract");

function blocked(summary, evidence = []) {
  return { ok: false, state: "BLOCKED_SAFETY", summary, evidence };
}

function isInside(root, target) {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function validateDeclarativeRelease(manifest, now = new Date()) {
  const validated = base.validateArtifact(manifest);
  if (!validated.ok) return validated;
  const release = manifest.release;
  if (!manifest.repository.branch) return blocked("repository.branch is required", validated.evidence);
  if (release.git_tag !== `v${release.version}`) return blocked("annotated Git tag must be v<package version>", validated.evidence);
  if (!Array.isArray(release.unchanged_dist_tags)) return blocked("release.unchanged_dist_tags is required", validated.evidence);
  if (release.unchanged_dist_tags.includes(release.npm_tag)) return blocked("published npm tag cannot also be declared unchanged", validated.evidence);
  if (release.github_release_type === "prerelease" && release.npm_tag === "latest") return blocked("prereleases must use an explicit non-latest npm tag", validated.evidence);
  if (new Date(manifest.approval.expires_at) <= now) return blocked("approval is expired", validated.evidence);
  const allowed = manifest.paths.allowed.map((item) => path.resolve(item));
  for (const item of [release.package_dir, release.tarball, release.release_notes, ...release.github_assets]) {
    if (!allowed.some((entry) => isInside(entry, item) || isInside(item, entry))) return blocked(`release path is outside allowed paths: ${item}`, validated.evidence);
  }
  for (const forbidden of manifest.paths.forbidden.map((item) => path.resolve(item))) {
    for (const item of [release.package_dir, release.tarball, release.release_notes, ...release.github_assets]) {
      if (isInside(forbidden, item) || isInside(item, forbidden)) return blocked(`release path intersects forbidden path: ${forbidden}`, validated.evidence);
    }
  }
  const assetDigests = release.github_assets.map((asset) => ({
    name: path.basename(asset),
    sha256: base.sha256(asset),
  })).sort((a, b) => a.name.localeCompare(b.name));
  if (new Set(assetDigests.map((item) => item.name)).size !== assetDigests.length) return blocked("GitHub asset basenames must be unique", validated.evidence);
  return { ...validated, assetDigests };
}

function releaseIdentity(manifest, assetDigests) {
  return {
    repository: manifest.repository.github,
    branch: manifest.repository.branch,
    package: manifest.release.package_name,
    version: manifest.release.version,
    tarball_sha256: manifest.release.tarball_sha256,
    git_tag: manifest.release.git_tag,
    npm_tag: manifest.release.npm_tag,
    github_release_type: manifest.release.github_release_type,
    assets: assetDigests,
  };
}

async function executeDeclarativeRelease(manifest, adapter, options = {}) {
  const initial = validateDeclarativeRelease(manifest, options.now || new Date());
  if (!initial.ok) return initial;
  if (options.dryRun) {
    return {
      ok: true,
      state: "DRY_RUN",
      identity: releaseIdentity(manifest, initial.assetDigests),
      evidence: [...initial.evidence, "dry-run: zero publication adapter calls"],
    };
  }
  const expectedTags = {};
  const beforeTags = await adapter.npmDistTags(manifest.release.package_name);
  for (const tag of manifest.release.unchanged_dist_tags) expectedTags[tag] = beforeTags[tag];

  let observedAssetDigests = null;
  const guarded = {
    ...adapter,
    githubRelease: async (repository, tag) => {
      const current = await adapter.githubRelease(repository, tag);
      if (!current) return current;
      observedAssetDigests = current.asset_digests;
      if (base.stable(observedAssetDigests) !== base.stable(initial.assetDigests)) return current;
      return { tag: current.tag, prerelease: current.prerelease, assets: current.assets };
    },
    createGithubRelease: async (input) => {
      const current = validateDeclarativeRelease(input, options.now || new Date());
      if (!current.ok) return { ok: false, safety: current.summary };
      return adapter.createGithubRelease(input, releaseIdentity(input, current.assetDigests));
    },
    publishTarball: async (tarball, flags) => {
      const current = validateDeclarativeRelease(manifest, options.now || new Date());
      if (!current.ok || current.digest !== initial.digest) return { ok: false, safety: current.summary || "artifact drift" };
      return adapter.publishTarball(tarball, flags, releaseIdentity(manifest, current.assetDigests));
    },
  };
  const result = await base.executeRelease(manifest, guarded, options);
  if (!result.ok) return result;
  for (const [tag, version] of Object.entries(expectedTags)) {
    if (result.distTags[tag] !== version) return blocked(`npm ${tag} dist-tag changed during release`, result.evidence);
  }
  const expectedAssets = initial.assetDigests;
  const actualAssets = observedAssetDigests;
  if (base.stable(actualAssets) !== base.stable(expectedAssets)) return blocked("GitHub asset digest verification failed", result.evidence);
  return { ...result, identity: releaseIdentity(manifest, expectedAssets), assetDigests: expectedAssets };
}

function loadManifest(manifestPath) {
  if (!path.isAbsolute(manifestPath || "")) return blocked("manifest path must be absolute");
  try {
    const canonical = fs.realpathSync(manifestPath);
    if (canonical !== manifestPath) return blocked("manifest path must already be canonical");
    return { ok: true, manifest: JSON.parse(fs.readFileSync(canonical, "utf8")), path: canonical };
  } catch (error) {
    return blocked(`manifest could not be loaded: ${error.message}`);
  }
}

module.exports = {
  executeDeclarativeRelease,
  loadManifest,
  releaseIdentity,
  validateDeclarativeRelease,
};
