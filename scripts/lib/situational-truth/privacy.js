"use strict";

const PRIVATE_PATHS = [
  /\/(?:home|Users)\/[^/\s"'`<>]+(?:\/[^\s"'`<>]*)?/g,
  /[A-Za-z]:\\Users\\[^\\\s"'`<>]+(?:\\[^\s"'`<>]*)?/g,
];

const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9_]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
  /sk-[A-Za-z0-9_-]{12,}/g,
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /postgres(?:ql)?:\/\/[^\s"'<>]+/gi,
  /https?:\/\/[^:\s"'<>]+:[^@\s"'<>]+@[^\s"'<>]+/gi,
];

function redactText(input) {
  let value = String(input || "");
  value = value.replace(SECRET_PATTERNS[0], "[redacted-token]");
  value = value.replace(SECRET_PATTERNS[1], "[redacted-token]");
  value = value.replace(SECRET_PATTERNS[2], "[redacted-api-key]");
  value = value.replace(SECRET_PATTERNS[3], "[redacted-jwt]");
  value = value.replace(SECRET_PATTERNS[4], "postgres" + "://[redacted]");
  value = value.replace(SECRET_PATTERNS[5], "https://[redacted-credential]@[redacted-host]");
  value = value.replace(
    /(token|secret|password|passwd|api[_-]?key|access[_-]?key|auth|bearer|credential)\s*[:=]\s*[^\s"'<>]+/gi,
    "$1=[redacted]",
  );
  for (const pattern of PRIVATE_PATHS) value = value.replace(pattern, "<private-path>");
  return value;
}

function containsPrivatePath(input) {
  const value = String(input || "");
  return PRIVATE_PATHS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function containsSecretShape(input) {
  const value = String(input || "");
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

module.exports = {
  containsPrivatePath,
  containsSecretShape,
  redactText,
};
