"use strict";

// Route selection for reusable library foundations stays separate from the
// executable entrypoint and from route execution side effects.

const runtime = require("./runtime-context");

function selectLibraryFoundationRoute(status) {
  const { args, path, targetRepo, LIBRARY_ROOT } = runtime.pick(["args", "path", "targetRepo", "LIBRARY_ROOT"]);
  if (path.resolve(targetRepo) !== LIBRARY_ROOT) return null;
  const normalized = String(status || "").toLowerCase();

  const explicitRoutes = [
    ["workflow-corpus-recovery", "session-log-extraction-skill / coding-workflow-orchestrator-skill", "workflow-corpus-recovery", "validate or regenerate the private workflow corpus, verify coverage, and stop before remote publication", ["local_execution"]],
    ["docs-list-foundation", "coding-workflow-orchestrator-skill / session-log-extraction-skill", "docs-list-foundation", "verify deterministic docs inventory, strict docs validation, and stop before package publication or release work", ["local_execution", "remote_publication"]],
    ["repo-map-helper-automation", "repo-map-skill / coding-workflow-orchestrator-skill", "repo-map-helper-automation", "verify deterministic source-only repo map helper, schema, CLI delegation, tests, package contents, and stop before the next dependency", ["local_execution", "remote_publication"]],
    ["project-kb-compiler", "project-kb-builder-skill / coding-workflow-orchestrator-skill", "project-kb-compiler", "verify deterministic source-only project KB compiler, schema, CLI delegation, tests, package contents, and stop before the next dependency", ["local_execution", "remote_publication"]],
    ["pre-commit-validation-hook", "build-verify-skill / github-handoff-skill / coding-workflow-orchestrator-skill", "pre-commit-validation-hook", "verify deterministic local pre-commit gate, staged secret scan, safe hook installer, CLI delegation, tests, and stop before migration-review work", ["local_execution", "remote_publication"]],
    ["migration-review-helper", "migration-review-skill / coding-workflow-orchestrator-skill", "migration-review-helper", "verify deterministic source-only migration review helper, schema, CLI delegation, tests, package contents, and stop before browser/GitHub/release work", ["local_execution", "remote_publication"]],
    ["library-next-objective-assessment", "coding-workflow-orchestrator-skill", "library-next-objective-assessment", "cross-check the queue and roadmap, validate the reusable foundation surface, and stop at an active gap or known no-gap boundary", ["local_execution"]],
  ];
  for (const [permission, skill, kind, nextAction, requiresAuthority] of explicitRoutes) {
    if (args.allow.has(permission)) return { skill, permission, kind, nextAction, requiresAuthority };
  }

  if ([
    "role credentials retained, source cohesion hardening complete",
    "library next-objective assessment blocked",
  ].includes(normalized)) {
    return {
      skill: "coding-workflow-orchestrator-skill",
      permission: "library-next-objective-assessment",
      requiresAuthority: ["local_execution"],
      kind: "library-next-objective-assessment",
      nextAction: "cross-check the queue and roadmap before selecting more reusable library work",
    };
  }

  if (normalized === "library self-assessment complete, no active reusable foundation gap") {
    return {
      skill: "coding-workflow-orchestrator-skill",
      permission: null,
      kind: "human-boundary",
      finalStatus: "Library self-assessment complete, no active reusable foundation gap",
      nextPermission: "select a target repository objective or record a new evidence-backed gap",
      nextAction: "no reusable library foundation is currently evidence-backed; select a target repository objective or record a bounded gap from new evidence",
    };
  }

  return null;
}

module.exports = {
  selectLibraryFoundationRoute,
};
