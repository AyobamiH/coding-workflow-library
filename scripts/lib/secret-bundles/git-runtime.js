"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

function portableName(command) {
  return path.basename(String(command || "")).replace(/\.exe$/i, "");
}

function hasGitHubRuntime(bundle) {
  return (bundle.variables || []).some((item) => ["GH_TOKEN", "GITHUB_TOKEN"].includes(item.runtime));
}

function delegatedCommand(bundle, command) {
  if (portableName(command[0]) !== "git" || !hasGitHubRuntime(bundle)) return command;
  return [process.execPath, __filename, ...command];
}

function githubGitEnvironment(source = process.env) {
  const token = source.GH_TOKEN || source.GITHUB_TOKEN;
  if (!token) return null;

  const configuredCount = Number.parseInt(source.GIT_CONFIG_COUNT || "0", 10);
  const index = Number.isInteger(configuredCount) && configuredCount >= 0 ? configuredCount : 0;
  const environment = {
    ...source,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: String(index + 1),
    [`GIT_CONFIG_KEY_${index}`]: "http.https://github.com/.extraheader",
    [`GIT_CONFIG_VALUE_${index}`]: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
  };
  delete environment.GH_TOKEN;
  delete environment.GITHUB_TOKEN;
  return environment;
}

function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  if (portableName(command) !== "git") process.exit(3);
  const env = githubGitEnvironment(process.env);
  if (!env) process.exit(4);

  // The header exists only in the Git child environment. The outer SOPS
  // adapter captures and suppresses Git output, including provider failures.
  const result = spawnSync(command, ["-c", "credential.helper=", ...args], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  process.exit(typeof result.status === "number" ? result.status : 1);
}

if (require.main === module) main();

module.exports = {
  delegatedCommand,
  githubGitEnvironment,
  hasGitHubRuntime,
  portableName,
};
