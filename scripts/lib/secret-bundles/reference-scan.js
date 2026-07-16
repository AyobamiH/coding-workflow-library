const fs = require("fs");
const path = require("path");

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".codex",
  ".run-next",
  ".tmp",
  "build",
  "coverage",
  "dist",
  "evidence",
  "node_modules",
  "state",
  "tmp",
]);

function excludedFile(name) {
  return name === ".env" || name.startsWith(".env.") || name.endsWith(".tgz");
}

function discoverFiles(rootDirectory, currentDirectory = rootDirectory, output = []) {
  let entries;
  try {
    entries = fs.readdirSync(currentDirectory, { withFileTypes: true });
  } catch {
    return output;
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(currentDirectory, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry.name)) discoverFiles(rootDirectory, absolute, output);
    } else if (entry.isFile() && !excludedFile(entry.name)) {
      output.push(absolute);
    }
  }
  return output;
}

function textContains(filePath, needle) {
  let content;
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 2 * 1024 * 1024) return false;
    content = fs.readFileSync(filePath);
  } catch {
    return false;
  }
  // NUL bytes classify the file as binary for this bounded source scan.
  if (content.includes(0)) return false;
  return content.toString("utf8").includes(needle);
}

function findReferences(rootDirectory, needle) {
  return discoverFiles(rootDirectory)
    .filter((filePath) => textContains(filePath, needle))
    .map((filePath) => path.relative(rootDirectory, filePath).split(path.sep).join("/"))
    .sort();
}

module.exports = { discoverFiles, findReferences };
