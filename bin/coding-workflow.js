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
};

function printHelp() {
  console.log(`coding-workflow

Local CLI for the autonomous coding workflow library.

Usage:
  coding-workflow --help
  coding-workflow routes [--json]
  coding-workflow validate
  coding-workflow cleaner
  coding-workflow package-readiness --repo /path/to/repo [--expect-package] [--expect-cli]
  coding-workflow release-preflight --repo /path/to/repo --mode local|npm|cli
  coding-workflow run-next --repo /path/to/repo --dry-run --allow <flag>
  coding-workflow lanes --state-file /path/to/lanes.json
  coding-workflow lane show <lane-id> --state-file /path/to/lanes.json
  coding-workflow objective show --lane <lane-id> --state-file /path/to/lanes.json
  coding-workflow objective approve --lane <lane-id> --grant remote_publication --state-file /path/to/lanes.json
  coding-workflow run-next --lane <lane-id> --state-file /path/to/lanes.json --explain-next
  coding-workflow run-next --lane <lane-id> --state-file /path/to/lanes.json --until-blocked
  coding-workflow resume --lane <lane-id> --state-file /path/to/lanes.json
  coding-workflow explain-blocker --lane <lane-id> --state-file /path/to/lanes.json

The system requests authority for consequences, not permission for every tool call.

Lane state is local runtime metadata and must not contain secrets. This CLI delegates to local scripts and preserves objective authority gates. It does not publish, deploy, push, tag, create releases, read secrets, or call production endpoints on its own.`);
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
    cwd: ROOT,
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
