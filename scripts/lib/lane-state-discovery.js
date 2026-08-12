"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

function candidateSpecs(options = {}) {
  const homeDir = options.homeDir || os.homedir();
  const repo = path.resolve(options.repo || process.cwd());
  const env = options.env || process.env;
  return [
    candidate("explicit", options.stateFile, true),
    candidate("environment_override", env.CODING_WORKFLOW_STATE_FILE, true),
    candidate("home_coding_workflow_state", path.join(homeDir, ".coding-workflow", "lanes.json"), true),
    candidate("home_openclaw_state", path.join(homeDir, ".openclaw", "state", "coding-workflow", "lanes.json"), true),
    candidate("repo_example", path.join(repo, "templates", "work-lanes.example.json"), false),
  ];
}

function candidate(locationClass, file, live) {
  return {
    location_class: locationClass,
    file: file ? path.resolve(file) : null,
    live,
  };
}

function inspectCandidate(spec) {
  if (!spec.file) return { ...spec, status: "not_applicable" };
  try {
    const stat = fs.statSync(spec.file);
    if (!stat.isFile()) return { ...spec, status: "unreadable" };
    fs.accessSync(spec.file, fs.constants.R_OK);
    return { ...spec, status: "found" };
  } catch (error) {
    return {
      ...spec,
      status: error && error.code === "ENOENT" ? "missing" : "unreadable",
    };
  }
}

function discoverLaneState(options = {}) {
  const candidates = candidateSpecs(options).map(inspectCandidate);
  const selected = candidates.find((item) => item.live && item.status === "found")
    || candidates.find((item) => !item.live && item.status === "found")
    || null;
  return {
    selected,
    candidates,
    status: selected ? (selected.live ? "found" : "not_applicable") : candidates.some((item) => item.status === "unreadable") ? "unreadable" : "missing",
  };
}

function defaultStateFile(options = {}) {
  const homeDir = options.homeDir || os.homedir();
  const env = options.env || process.env;
  if (env.CODING_WORKFLOW_STATE_FILE) return path.resolve(env.CODING_WORKFLOW_STATE_FILE);

  const canonical = path.join(homeDir, ".coding-workflow", "lanes.json");
  const openclaw = path.join(homeDir, ".openclaw", "state", "coding-workflow", "lanes.json");
  if (fs.existsSync(canonical)) return canonical;
  if (fs.existsSync(openclaw)) return openclaw;
  return canonical;
}

function publicCandidates(discovery) {
  return discovery.candidates.map((item) => ({
    location_class: item.location_class,
    status: item.status,
    live: item.live,
    selected: Boolean(discovery.selected && discovery.selected.location_class === item.location_class && discovery.selected.file === item.file),
  }));
}

module.exports = {
  candidateSpecs,
  defaultStateFile,
  discoverLaneState,
  publicCandidates,
};
