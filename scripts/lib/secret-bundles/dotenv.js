const crypto = require("crypto");
const fs = require("fs");

const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function decodeDoubleQuoted(value) {
  return value.replace(/\\(n|r|t|"|\\)/g, (_, token) => ({
    n: "\n",
    r: "\r",
    t: "\t",
    '"': '"',
    "\\": "\\",
  })[token]);
}

function parseValue(rawValue) {
  const value = rawValue.trim();
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  if (value.startsWith('"') && value.endsWith('"')) return decodeDoubleQuoted(value.slice(1, -1));
  return value.replace(/\s+#.*$/, "").trim();
}

function parseDotEnv(text) {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    values.set(match[1], parseValue(match[2]));
  }
  return values;
}

function readDotEnv(filePath) {
  return parseDotEnv(fs.readFileSync(filePath, "utf8"));
}

function sortedNames(values) {
  return [...values.keys()].sort();
}

function namesFingerprint(names) {
  return crypto.createHash("sha256").update([...names].sort().join("\n")).digest("hex");
}

function assertVariableName(name) {
  return NAME_PATTERN.test(name);
}

module.exports = {
  NAME_PATTERN,
  assertVariableName,
  namesFingerprint,
  parseDotEnv,
  readDotEnv,
  sortedNames,
};
