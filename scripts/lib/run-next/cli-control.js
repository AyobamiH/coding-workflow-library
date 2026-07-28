"use strict";

const fs = require("fs");
const path = require("path");
const laneState = require("../../lane-state");
const objectiveAuthority = require("../../objective-authority");
const autonomousBoundaries = require("../../autonomous-boundaries");
const routeMetadata = require("../../../routes/skill-routes.json");

const ALLOWED_FLAGS = new Set([
  "auth-check",
  "github-handoff",
  "push-pr",
  "local-validation",
  "local-edit",
  "commit",
  "pr-readiness",
  "pr-merge",
  "deployment-plan",
  "supabase-preflight",
  "supabase-tooling-auth",
  "supabase-link-secret-readiness",
  "scheduler-draft-pr",
  "scheduler-pr-merge",
  "supabase-secret-function-deploy",
  "runtime-negative-verification",
  "function-secret-deploy-negative-runtime",
  "controlled-success-invocation",
  "scheduled-run-monitoring-handoff",
  "zero-output-investigation",
  "zero-output-observability-patch",
  "observability-pr-recovery",
  "observability-deploy",
  "observability-run-recheck",
  "scheduler-application-decision",
  "scheduler-vault-design-apply",
  "scheduler-vault-apply-retry",
  "verification-bundle-self-test",
  "local-skill-workpack",
  "evidence-pack-write",
  "cloudflare-opstruth-packaging-bundle",
  "clean-temp-readiness-smoke",
  "license-package-candidate",
  "package-candidate-dry-run",
  "cli-package-smoke",
  "github-open-source-handoff",
  "first-version-tag",
  "workflow-corpus-recovery",
  "docs-list-foundation",
  "repo-map-helper-automation",
  "project-kb-compiler",
  "pre-commit-validation-hook",
  "migration-review-helper",
  "library-next-objective-assessment",
  "release-publication",
  "local_execution",
  "remote_publication",
  "production_mutation",
  "secret_mutation",
  "destructive_action",
  ...routeMetadata.routes.map((route) => route.permission_flag).filter(Boolean),
]);

function parseArgs(rawArgs, allowedFlags) {
  const parsed = {
    allow: new Set(),
    dryRun: false,
    doctor: false,
    explain: false,
    explainNext: false,
    explainBoundary: null,
    resume: false,
    status: false,
    listApprovals: false,
    listRoutes: false,
    listLanes: false,
    untilBlocked: false,
    help: false,
    lane: null,
    stateFile: laneState.defaultStateFile(),
    repo: null,
    releaseManifest: null,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--doctor") parsed.doctor = true;
    else if (arg === "--resume") parsed.resume = true;
    else if (arg === "--status") parsed.status = true;
    else if (arg === "--explain") parsed.explain = true;
    else if (arg === "--explain-next") parsed.explainNext = true;
    else if (arg === "--list-approvals") parsed.listApprovals = true;
    else if (arg === "--list-routes") parsed.listRoutes = true;
    else if (arg === "--list-lanes") parsed.listLanes = true;
    else if (arg === "--until-blocked") parsed.untilBlocked = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--explain-boundary") parsed.explainBoundary = requireValue(rawArgs, ++index, arg);
    else if (arg === "--lane") parsed.lane = requireValue(rawArgs, ++index, arg);
    else if (arg === "--state-file") parsed.stateFile = requireValue(rawArgs, ++index, arg);
    else if (arg === "--repo") parsed.repo = requireValue(rawArgs, ++index, arg);
    else if (arg === "--release-manifest") parsed.releaseManifest = requireValue(rawArgs, ++index, arg);
    else if (arg === "--allow") {
      const value = requireValue(rawArgs, ++index, arg);
      if (!allowedFlags.has(value)) throw new Error(`unsupported permission flag: ${value}`);
      parsed.allow.add(value);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

function printHelp(allowedFlags) {
  console.log(`Usage:
  ./scripts/run-next [--dry-run|--explain|--doctor]
  ./scripts/run-next --repo <path> --status
  ./scripts/run-next --repo <path> --resume --dry-run
  ./scripts/run-next --repo <path> --allow <route-or-authority> [--dry-run]
  ./scripts/run-next --release-manifest <absolute-path> --dry-run
  ./scripts/run-next --lane <id> --state-file <path> --explain-next
  ./scripts/run-next --lane <id> --state-file <path> --allow <route-or-authority> [--dry-run]
  ./scripts/run-next --list-routes
  ./scripts/run-next --list-lanes --state-file <path>
  ./scripts/run-next --list-approvals
  ./scripts/run-next --explain-boundary <boundary-type>

Supported --allow values:
${[...allowedFlags].sort().map((value) => `  ${value}`).join("\n")}

Lane mode reads and updates only the selected local lane. If --lane is omitted,
legacy work-ledger.md routing remains available. Authority-class flags grant one
consequence class for the selected objective. Dry-run and explain modes do not
mutate target repos, lane state, work-ledger.md, or runs/skill-runs.md.`);
}

function printDoctor(libraryRoot) {
  const registryPath = path.join(libraryRoot, "state", "approval-registry.json");
  let registryStatus = "missing";
  try {
    const registry = autonomousBoundaries.loadApprovalRegistry(registryPath);
    const validation = autonomousBoundaries.validateApprovalRegistry(registry);
    registryStatus = `valid (${validation.approvals} approvals)`;
  } catch (error) {
    registryStatus = `invalid: ${error.message}`;
  }

  console.log("# run-next autonomy doctor");
  console.log(`workflow states: ${autonomousBoundaries.WORKFLOW_STATES.join(", ")}`);
  console.log(`boundary types: ${autonomousBoundaries.BOUNDARY_TYPES.join(", ")}`);
  console.log(`approval registry: ${registryStatus}`);
  console.log("automatic verified PR merge policy: enabled for workflow-authored, scoped, passing, unchanged-head PRs under normal repository rules");
  console.log("completion policy: PR merge is followed by post-merge validation before COMPLETED");
}

function printApprovalRegistry(libraryRoot) {
  const registryPath = path.join(libraryRoot, "state", "approval-registry.json");
  const registry = autonomousBoundaries.loadApprovalRegistry(registryPath);
  autonomousBoundaries.validateApprovalRegistry(registry);
  console.log("# approval registry");
  console.log(`path: ${path.relative(libraryRoot, registryPath)}`);
  console.log(`version: ${registry.version}`);
  const approvals = Array.isArray(registry.approvals) ? registry.approvals : [];
  console.log(`approvals: ${approvals.length}`);
  for (const approval of approvals) {
    console.log(`- ${approval.approvalId}: ${approval.status}; scope=${approval.scope.join(", ")}`);
  }
  if (!approvals.length) console.log("No committed approvals. Runtime approvals may remain local-only when they contain operational context.");
}

function printBoundaryExplanation(type) {
  const result = autonomousBoundaries.classifyBoundary({ boundaryType: type, reason: "Boundary explanation requested." });
  console.log("# boundary explanation");
  console.log(`boundary_type: ${result.boundary_type}`);
  console.log(`workflow state: ${result.state}`);
  console.log(`boundary_reason: ${result.boundary_reason}`);
  console.log(`evidence: ${result.evidence.join(", ") || "none"}`);
  console.log(`why_autonomous_resolution_is_unsafe_or_impossible: ${result.why_autonomous_resolution_is_unsafe_or_impossible}`);
  console.log(`safe to continue automatically: ${result.safeToContinueAutomatically ? "yes" : "no"}`);
  console.log(`exact_human_input_required: ${result.exact_human_input_required}`);
  console.log(`resume_condition: ${result.resume_condition}`);
  console.log(`resume_command: ${result.resume_command}`);
}

function printLaneList(stateFile) {
  const state = laneState.readState(stateFile);
  console.log(`# Workflow Lanes\n\nState file: ${stateFile}\nLanes: ${state.lanes.length}\n`);
  for (const lane of state.lanes) {
    console.log(`## ${lane.lane_id}`);
    console.log(`Name: ${lane.display_name}`);
    console.log(`Status: ${lane.status}`);
    console.log(`Current state: ${lane.current_state}`);
    console.log(`Next permission: ${lane.next_permission || "none"}`);
    if (lane.objective) {
      const objective = objectiveAuthority.normalizeObjective(lane.objective);
      const grants = objectiveAuthority.AUTHORITY_CLASSES.filter((name) => objective.authority[name]).join(", ") || "none";
      console.log(`Objective: ${objective.id}`);
      console.log(`Authority: ${grants}`);
    }
    console.log("");
  }
  console.log("This command reads local lane metadata only. State files must not contain secrets.");
}

function activeWorkItemFromLane(lane) {
  return {
    heading: `Lane: ${lane.lane_id}`,
    text: "",
    activeRepo: lane.repo_path,
    currentObjective: lane.notes || `Continue lane ${lane.lane_id}`,
    currentStatus: lane.current_state,
    selectedSkill: "coding-workflow-orchestrator-skill",
    laneId: lane.lane_id,
    laneStatus: lane.status,
    monitoringBaseline: lane.monitoring_baseline || "",
    rawLane: lane,
  };
}

function printRouteList(libraryRoot) {
  const routeFile = path.join(libraryRoot, "routes", "skill-routes.json");
  if (!fs.existsSync(routeFile)) throw new Error("missing route metadata: routes/skill-routes.json");
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(routeFile, "utf8"));
  } catch (error) {
    throw new Error(`route metadata is not valid JSON: ${error.message}`);
  }

  const routes = Array.isArray(parsed.routes) ? parsed.routes : [];
  console.log(`# Skill Routes

Route file: routes/skill-routes.json
Routes: ${routes.length}

${routes.map((route) => {
    const states = Array.isArray(route.ledger_states_handled) ? route.ledger_states_handled.join("; ") : "";
    return [
      `## ${route.id || "(missing id)"}`,
      `Skill: ${route.skill_file || "(missing skill file)"}`,
      `Authority grant: ${route.permission_flag || "(missing legacy grant flag)"}`,
      `States: ${states || "(none)"}`,
      `Success: ${route.success_ledger_state || "(missing success state)"}`,
      `Blocked: ${route.blocked_ledger_state || "(missing blocked state)"}`,
      `Next: ${route.next_permission || "(missing next permission)"}`,
    ].join("\n");
  }).join("\n\n")}

This command only reads local route metadata. It does not update the ledger, call external services, or mutate repos.`);
}

function readControlFiles(libraryRoot, evidence) {
  for (const file of ["AGENTS.md", "RUNBOOK.md", "tools.md", "work-ledger.md"]) {
    const full = path.join(libraryRoot, file);
    if (!fs.existsSync(full)) throw new Error(`missing required control file: ${file}`);
    fs.readFileSync(full, "utf8");
    evidence.push(`read ${file}`);
  }
}

function readText(libraryRoot, relativePath) {
  return fs.readFileSync(path.join(libraryRoot, relativePath), "utf8");
}

function findActiveWorkItem(ledgerText, repo) {
  const sections = ledgerText
    .split(/\n(?=## \d{4}-\d{2}-\d{2} - )/)
    .map((section) => section.trim())
    .filter(Boolean);
  const parsed = sections.map((section) => ({
    heading: (section.match(/^## (.+)$/m) || [])[1] || "",
    text: section,
    activeRepo: cleanField(extractField(section, "Active repo")),
    currentObjective: cleanField(extractField(section, "Current objective")),
    currentStatus: cleanField(extractField(section, "Current status")),
    selectedSkill: cleanField(extractField(section, "Selected skill")),
  }));
  const repoMatches = parsed.filter((section) => section.activeRepo === repo);
  if (repoMatches.length) return repoMatches[repoMatches.length - 1];
  if (repo) {
    return {
      heading: `No ledger entry for ${repo}`,
      text: "",
      activeRepo: repo,
      currentObjective: "Create or select a ledger item before mutation",
      currentStatus: "No ledger item for repo",
      selectedSkill: "coding-workflow-orchestrator-skill",
    };
  }
  if (parsed.length) return parsed[parsed.length - 1];
  throw new Error("work-ledger.md has no parseable work items");
}

function extractField(section, label) {
  const pattern = new RegExp(`^\\* ${escapeRegExp(label)}:\\s*(.+)$`, "m");
  const match = section.match(pattern);
  return match ? match[1] : "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanField(value) {
  return String(value || "")
    .replace(/`/g, "")
    .replace(/\.$/, "")
    .trim();
}

module.exports = {
  ALLOWED_FLAGS,
  activeWorkItemFromLane,
  cleanField,
  findActiveWorkItem,
  parseArgs,
  printApprovalRegistry,
  printBoundaryExplanation,
  printDoctor,
  printHelp,
  printLaneList,
  printRouteList,
  readControlFiles,
  readText,
};
