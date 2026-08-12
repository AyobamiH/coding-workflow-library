"use strict";

const fs = require("fs");
const path = require("path");
const { commitRelation } = require("./git-state");
const { redactText } = require("./privacy");

function repoKey(repo) {
  return Buffer.from(path.resolve(repo)).toString("base64url");
}

function checkpointRoot(options) {
  if (options.checkpointDir) return path.resolve(options.checkpointDir);
  const env = options.env || process.env;
  return path.resolve(env.RUN_NEXT_DIR || path.join(options.repo, ".run-next"));
}

function readLatest(directory) {
  if (!fs.existsSync(directory)) return null;
  const records = [];
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".json"))) {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
      records.push(record);
    } catch {
      // Malformed historical records are ignored here and counted by autonomy-outcomes.
    }
  }
  records.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  return records[0] || null;
}

function inspectCheckpoint(options, git) {
  const root = checkpointRoot(options);
  const latest = readLatest(path.join(root, repoKey(options.repo)));
  if (!latest) {
    return {
      status: "missing",
      freshness: "NO_CHECKPOINT",
      run_id: null,
      run_status: null,
      last_verified_commit: null,
      required_permission: null,
      permission_consistent: true,
      issues: [],
    };
  }

  const freshness = commitRelation(options.repo, latest.last_verified_commit, git.head.sha);
  const completed = latest.status === "completed";
  const permissionConsistent = !(completed && latest.required_permission);
  const issues = [];
  if (!permissionConsistent) issues.push("completed_checkpoint_retains_required_permission");
  if (!["FRESH", "NO_CHECKPOINT"].includes(freshness)) issues.push("checkpoint_not_fresh");
  return {
    status: "found",
    freshness,
    run_id: redactText(latest.run_id || "") || null,
    run_status: redactText(latest.status || "") || null,
    last_verified_commit: latest.last_verified_commit || null,
    required_permission: completed ? null : redactText(latest.required_permission || "") || null,
    permission_consistent: permissionConsistent,
    issues,
  };
}

module.exports = {
  checkpointRoot,
  inspectCheckpoint,
  readLatest,
  repoKey,
};
