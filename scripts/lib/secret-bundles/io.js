const fs = require("fs");
const path = require("path");

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") fs.chmodSync(directory, 0o700);
}

function atomicWrite(filePath, content, mode = 0o600) {
  ensurePrivateDirectory(path.dirname(filePath));
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(temporaryPath, content, { mode });
  if (process.platform !== "win32") fs.chmodSync(temporaryPath, mode);
  fs.renameSync(temporaryPath, filePath);
}

function atomicWriteJson(filePath, value) {
  atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function ownerOnly(filePath) {
  if (process.platform === "win32") return true;
  return (fs.statSync(filePath).mode & 0o077) === 0;
}

function safeBasename(filePath) {
  return filePath ? path.basename(filePath) : null;
}

module.exports = {
  atomicWrite,
  atomicWriteJson,
  ensurePrivateDirectory,
  ownerOnly,
  safeBasename,
};
