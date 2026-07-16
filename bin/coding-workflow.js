#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

const COMMANDS = {
  routes: {
    script: "scripts/route-audit",
    description: "Audit local route metadata.",
  },
  validate: {
    script: "scripts/validate-skills",
    description: "Validate skills, indexes, route metadata, and safety markers.",
  },
  cleaner: {
    script: "scripts/skill-cleaner",
    description: "Run advisory skill-library hygiene checks.",
  },
  "package-readiness": {
    script: "scripts/npm-package-readiness",
    description: "Inspect local npm package or CLI readiness.",
  },
  "release-preflight": {
    script: "scripts/release-preflight",
    description: "Run local release preflight.",
  },
  "run-next": {
    script: "scripts/run-next",
    description: "Run the permission-gated autonomous work-loop runner.",
  },
  "lane-state": {
    script: "scripts/lane-state",
    description: "Inspect or update local project-scoped lane state.",
  },
  "extract-workflows": {
    script: "scripts/extract-session-workflows.mjs",
    description: "Extract private workflow corpus evidence from local session JSONL sources.",
  },
  "docs-list": {
    script: "scripts/docs-list",
    description: "Inventory tracked documentation files, titles, duplicate titles, and orphan references.",
  },
  "repo-map": {
    script: "scripts/repo-map",
    description: "Produce a privacy-safe source-only repository orientation report.",
  },
  "project-kb": {
    script: "scripts/project-kb",
    description: "Compile a deterministic source-only project knowledge base.",
  },
  "pre-commit-check": {
    script: "scripts/pre-commit-check",
    description: "Run deterministic local checks before committing.",
  },
  "migration-review": {
    script: "scripts/migration-review",
    description: "Run source-only migration risk review.",
  },
  "browser-live-proof": {
    script: "scripts/browser-live-proof",
    description: "Collect bounded, count-only browser rendering evidence.",
  },
  "github-deep-review": {
    script: "scripts/github-deep-review",
    description: "Inspect pull-request threads, reviews, checks, and exact patch scope without mutation.",
  },
  "opstruth-classify": {
    script: "scripts/opstruth-classify",
    description: "Classify existing evidence without collapsing skipped, unverified, CI, or production scopes.",
  },
  "skill-gap": {
    script: "scripts/add-skill-gap",
    description: "Validate or record a structured missing-skill backlog item.",
  },
  "autonomy-outcomes": {
    script: "scripts/autonomy-outcomes",
    description: "Aggregate privacy-safe workflow outcomes from local runtime metadata.",
  },
  "multi-project-proof": {
    script: "scripts/multi-project-proof",
    description: "Run one bounded read-only workflow contract across explicit local repositories.",
  },
  "next-objective": {
    script: "scripts/library-next-objective",
    description: "Cross-check the library queue and roadmap before selecting more reusable work.",
  },
  "sops-age": {
    script: "scripts/sops-age-secret-access",
    description: "Check and use local non-printing SOPS plus age secret injection.",
  },
  "secret-bundles": {
    script: "scripts/secret-bundles",
    description: "Inventory, encrypt, validate, and deliver purpose-scoped SOPS bundles.",
  },
  "install-hooks": {
    script: "scripts/install-git-hooks",
    description: "Install the optional local Git pre-commit hook when safe.",
    cwd: "caller",
  },
};

function printHelp() {
  console.log(`coding-workflow

Local CLI for the autonomous coding workflow library.

Usage:
  coding-workflow --help
  coding-workflow routes [--json]
  coding-workflow validate
  coding-workflow cleaner
  coding-workflow package-readiness --repo /path/to/repo [--expect-package] [--expect-cli] [--json] [--validate] [--strict]
  coding-workflow release-preflight --repo /path/to/repo --mode local|npm|cli [--json] [--validate] [--strict]
  coding-workflow release-preflight --repo /path/to/repo --corpus-dir /path/to/generated-corpus [--require-corpus]
  coding-workflow run-next --repo /path/to/repo --dry-run --allow <flag>
  coding-workflow lanes --state-file /path/to/lanes.json
  coding-workflow lane show <lane-id> --state-file /path/to/lanes.json
  coding-workflow extract-workflows --source /path/to/sessions --output-dir /private/path
  coding-workflow docs-list [--json] [--validate] [--orphans]
  coding-workflow repo-map --repo /path/to/repo [--json] [--validate]
  coding-workflow project-kb --repo /path/to/repo [--output /path/to/PROJECT_KB.md] [--json] [--validate] [--dry-run]
  coding-workflow pre-commit-check [--staged] [--full] [--json]
  coding-workflow migration-review --repo /path/to/repo [--json] [--validate] [--migrations-dir relative/path]
  coding-workflow browser-live-proof --url http://127.0.0.1:4173 [--viewport 390x844] [--screenshot /tmp/proof.png] [--json] [--validate]
  coding-workflow github-deep-review --repo OWNER/REPO --pr NUMBER [--inspect-failed-checks] [--json] [--validate]
  coding-workflow opstruth-classify --self-test [--json] [--validate]
  coding-workflow opstruth-classify --input /path/to/redacted-evidence.json [--json] [--validate] [--strict]
  coding-workflow skill-gap --title "..." --evidence "..." --primary-type SCRIPT_OR_HELPER --dependency "..." --authority local_execution --done "..." --reason "..." [--dry-run] [--json]
  coding-workflow autonomy-outcomes --repo /path/to/library [--state-file /path/to/lanes.json] [--json] [--validate]
  coding-workflow multi-project-proof --repo project-a=/path/to/repo --repo project-b=/path/to/repo --repo project-c=/path/to/repo [--json] [--validate]
  coding-workflow next-objective --repo /path/to/library [--json] [--validate]
  coding-workflow sops-age status [--json] [--validate]
  coding-workflow sops-age validate-file --file /private/path/runtime.enc.env [--json] [--validate]
  coding-workflow sops-age run --file /private/path/runtime.enc.env --dry-run -- command arg
  coding-workflow sops-age run --file /private/path/runtime.enc.env --allow-secret-access -- command arg
  coding-workflow secret-bundles inventory --manifest /private/path/manifest.json --env-file /private/path/.env [--json]
  coding-workflow secret-bundles validate --manifest /private/path/manifest.json [--json]
  coding-workflow secret-bundles prove --manifest /private/path/manifest.json --allow-secret-access [--json]
  coding-workflow secret-bundles run --manifest /private/path/manifest.json --profile <id> --dry-run -- command arg
  coding-workflow install-hooks [--dry-run] [--force]
  coding-workflow objective show --lane <lane-id> --state-file /path/to/lanes.json
  coding-workflow objective approve --lane <lane-id> --grant remote_publication --state-file /path/to/lanes.json
  coding-workflow run-next --lane <lane-id> --state-file /path/to/lanes.json --explain-next
  coding-workflow run-next --lane <lane-id> --state-file /path/to/lanes.json --until-blocked
  coding-workflow resume --lane <lane-id> --state-file /path/to/lanes.json
  coding-workflow explain-blocker --lane <lane-id> --state-file /path/to/lanes.json

The system requests authority for consequences, not permission for every tool call.

Lane state is local runtime metadata and must not contain secrets. This CLI delegates to local scripts and preserves objective authority gates. The sops-age command decrypts one validated file into one child environment only when --allow-secret-access is explicit; secret-bundles adds exact name coverage, purpose profiles, command allowlists, and same-run delivery proof. Neither grants child consequence authority. The CLI does not publish, deploy, push, tag, create releases, mutate external secrets, or call production endpoints on its own.`);
}

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

function delegate(commandName, args) {
  const command = COMMANDS[commandName];
  if (!command) fail(`unknown command: ${commandName}`);

  const scriptPath = path.join(ROOT, command.script);
  if (!fs.existsSync(scriptPath)) {
    fail(`missing delegated script: ${command.script}`, 1);
  }

  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: command.cwd === "caller" ? process.cwd() : ROOT,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    fail(`failed to run ${command.script}: ${result.error.message}`, 1);
  }

  process.exit(typeof result.status === "number" ? result.status : 1);
}

function main() {
  const [commandName, ...rest] = process.argv.slice(2);

  if (!commandName || commandName === "--help" || commandName === "-h" || commandName === "help") {
    printHelp();
    return;
  }

  if (commandName === "lanes") {
    delegate("lane-state", [...rest, "list"]);
    return;
  }

  if (commandName === "lane") {
    delegate("lane-state", rest);
    return;
  }

  if (commandName === "objective") {
    const [subcommand, ...objectiveArgs] = rest;
    const laneIndex = objectiveArgs.indexOf("--lane");
    const laneId = laneIndex >= 0 ? objectiveArgs[laneIndex + 1] : null;
    if (!laneId) fail("objective commands require --lane <lane-id>");
    const forwarded = objectiveArgs.filter((_, index) => index !== laneIndex && index !== laneIndex + 1);
    if (subcommand === "show") delegate("lane-state", ["objective-show", laneId, ...forwarded]);
    if (subcommand === "approve") delegate("lane-state", ["objective-approve", laneId, ...forwarded]);
    fail("objective supports: show, approve");
    return;
  }

  if (commandName === "resume") {
    delegate("run-next", ["--resume", ...rest]);
    return;
  }

  if (commandName === "explain-blocker") {
    delegate("run-next", ["--explain-next", ...rest]);
    return;
  }

  delegate(commandName, rest);
}

main();
