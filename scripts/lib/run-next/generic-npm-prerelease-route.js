"use strict";

const runtime = require("./runtime-context");
const route = require("./npm-release-route");

function runGenericNpmPrerelease() {
  const args = runtime.get("args");
  const evidence = runtime.get("evidence");
  const actions = runtime.get("actions");
  const loaded = route.loadManifest(args.releaseManifest);
  if (!loaded.ok) return { finalStatus: loaded.state, ledgerStatus: "generic npm prerelease preparation blocked", summary: loaded.summary, nextPermission: "repair the declarative release manifest", nextSkill: "release-preflight-skill", exitCode: 1 };
  const validation = route.validateDeclarativeRelease(loaded.manifest);
  evidence.push(...(validation.evidence || []));
  evidence.push(`release manifest: ${loaded.path}`);
  if (!validation.ok) return { finalStatus: validation.state, ledgerStatus: "generic npm prerelease preparation blocked", summary: validation.summary, nextPermission: "repair the failed exact-release safety gate", nextSkill: "release-preflight-skill / error-evidence-skill", exitCode: 1 };
  actions.push(`would publish only exact tarball ${loaded.manifest.release.tarball}`);
  actions.push(`would publish with explicit npm tag ${loaded.manifest.release.npm_tag}`);
  actions.push(`would reconcile exact ${loaded.manifest.release.github_release_type} GitHub assets`);
  evidence.push("dry-run made no git, npm, GitHub, credential, lane, ledger, or repository mutation");
  return {
    finalStatus: "DRY RUN PASSED",
    ledgerStatus: "generic npm prerelease manifest validated",
    summary: `${loaded.manifest.release.package_name}@${loaded.manifest.release.version} exact-tarball release contract validates`,
    nextPermission: "real mutation remains authority-gated and requires an installed authenticated adapter",
    nextSkill: "release-preflight-skill / github-handoff-skill",
    exitCode: 0,
  };
}

module.exports = { runGenericNpmPrerelease };
