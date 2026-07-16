import os from "os";
import path from "path";

export const EVIDENCE_CLASSES = [
  "USER_REQUEST",
  "ASSISTANT_PROPOSAL",
  "ASSISTANT_DECISION",
  "TOOL_INVOCATION",
  "TOOL_RESULT",
  "SHELL_COMMAND_EXECUTED",
  "SHELL_COMMAND_PROPOSED",
  "FILE_CREATED",
  "FILE_UPDATED",
  "VALIDATION_RESULT",
  "FAILURE_OR_BLOCKER",
  "PERMISSION_OR_AUTHORITY_BOUNDARY",
  "CAPABILITY_BOUNDARY",
  "FUTURE_WORK",
  "BACKLOG_ITEM",
  "AGENT_ROLE_MENTION",
  "SKILL_MENTION",
  "SCRIPT_OR_HELPER_MENTION",
  "ROUTE_OR_CONTROL_PLANE_MENTION",
  "PRODUCT_SPECIFIC_MENTION",
];

export const SOURCE_STATUSES = [
  "parsed_successfully",
  "unsupported_format",
  "unreadable",
  "excluded_by_explicit_rule",
  "duplicate",
  "corrupted",
  "empty",
  "generated_by_extraction_process_itself",
];

export const TERMINAL_COVERAGE_BUCKETS = {
  parsed_successfully: "parsed",
  unsupported_format: "unsupported",
  unreadable: "corrupt",
  excluded_by_explicit_rule: "excluded",
  duplicate: "duplicate",
  corrupted: "corrupt",
  empty: "empty",
  generated_by_extraction_process_itself: "excluded",
};

export const DEFAULT_META_PATTERNS = [
  /workflow[- ]?corpus/i,
  /workflow extraction methodology/i,
  /session[- ]?log extraction/i,
  /extract-session-workflows/i,
  /agent[- ]?roadmap recovery/i,
  /backlog recovery/i,
  /evidence-first backlog/i,
];

export const SKILL_RE = /\b[a-z][a-z0-9-]+-skill\b/g;
export const HELPER_RE = /\b(?:scripts|bin|tests|schemas|templates|routes|docs)\/[A-Za-z0-9._/-]+\b/g;
export const ROUTE_RE = /\b[a-z0-9]+(?:-[a-z0-9]+){2,}\b/g;
export const AGENT_ROLE_RE = /\b(planner|worker|reviewer|researcher|trader|banker|executioner|controller(?: bot)?|subagent|agent role)\b/gi;
export const PRODUCT_RE = /\b(wagging web wins|wagging-web-wins|oneclickpostfactory|opstruth|supabase|cloudflare|devvit|reddit)\b/gi;

export function usage() {
  console.log(`Usage:
  node scripts/extract-session-workflows.mjs --source <session-root> --output-dir <private-output-dir>

Options:
  --source <path>                 Repeatable source root or file.
  --output-dir <path>             Private output directory. Default: ~/.coding-workflow/workflow-corpus
  --config <path>                 Optional JSON config.
  --from <ISO date>               Include sources modified on/after this date.
  --to <ISO date>                 Include sources modified on/before this date.
  --include-meta-sessions         Include extraction-meta sessions in rankings.
  --manifest-only                 Write manifest, coverage, validation, and pseudonym map only.
  --validate-only                 Validate an existing output directory.
  --compare-to <path>             Compare with a prior workflow-snapshot.json or output directory.
  --require-unchanged             Exit non-zero unless the compared snapshot is unchanged.
  --json                          Print JSON summary.
  --dry-run                       Inspect only; create or modify no files.

The extractor writes private corpus outputs only. It does not publish, deploy, push, tag, or read secret stores.`);
}

export function parseArgs(argv) {
  const args = {
    sources: [],
    outputDir: path.join(os.homedir(), ".coding-workflow", "workflow-corpus"),
    config: null,
    from: null,
    to: null,
    includeMetaSessions: false,
    manifestOnly: false,
    validateOnly: false,
    compareTo: null,
    requireUnchanged: false,
    json: false,
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source") args.sources.push(requireValue(argv, ++i, "--source"));
    else if (arg === "--output-dir") args.outputDir = requireValue(argv, ++i, "--output-dir");
    else if (arg === "--config") args.config = requireValue(argv, ++i, "--config");
    else if (arg === "--from") args.from = new Date(requireValue(argv, ++i, "--from"));
    else if (arg === "--to") args.to = new Date(requireValue(argv, ++i, "--to"));
    else if (arg === "--include-meta-sessions") args.includeMetaSessions = true;
    else if (arg === "--manifest-only") args.manifestOnly = true;
    else if (arg === "--validate-only") args.validateOnly = true;
    else if (arg === "--compare-to") args.compareTo = requireValue(argv, ++i, "--compare-to");
    else if (arg === "--require-unchanged") args.requireUnchanged = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (args.from && Number.isNaN(args.from.valueOf())) throw new Error("--from must be an ISO date");
  if (args.to && Number.isNaN(args.to.valueOf())) throw new Error("--to must be an ISO date");
  if (args.requireUnchanged && !args.compareTo) throw new Error("--require-unchanged requires --compare-to");
  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

export class Redactor {
  constructor() {
    this.maps = {
      users: new Map(),
      emails: new Map(),
      paths: new Map(),
      urls: new Map(),
      hosts: new Map(),
    };
  }

  redact(value) {
    let text = String(value || "");
    let count = 0;
    const replace = (regex, mapName, prefix) => {
      text = text.replace(regex, (match) => {
        count += 1;
        return this.pseudonym(mapName, match, prefix);
      });
    };

    text = text.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, () => {
      count += 1;
      return "<SECRET_REDACTED>";
    });
    text = text.replace(/gh[pousr]_[A-Za-z0-9_]{12,}/g, () => {
      count += 1;
      return "<SECRET_REDACTED>";
    });
    text = text.replace(/sk-[A-Za-z0-9_-]{12,}/g, () => {
      count += 1;
      return "<SECRET_REDACTED>";
    });
    text = text.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, () => {
      count += 1;
      return "<SECRET_REDACTED>";
    });
    text = text.replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, () => {
      count += 1;
      return "<SECRET_REDACTED>";
    });
    text = text.replace(/(?:token|secret|password|api[_-]?key)\s*[:=]\s*[^\s"'<>]+/gi, (match) => {
      count += 1;
      const key = match.split(/[:=]/)[0].trim();
      return `${key}=<SECRET_REDACTED>`;
    });
    replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "emails", "EMAIL");
    replace(/\bhttps?:\/\/[^\s"'<>`]+/gi, "urls", "URL");
    replace(/(?:\/home\/[A-Za-z0-9._-]+|\/Users\/[A-Za-z0-9._-]+)(?:\/[^\s"'<>`]*)?/g, "paths", "LOCAL_PATH");
    replace(/[A-Za-z]:\\\\Users\\\\[A-Za-z0-9._-]+(?:\\\\[^\s"'<>`]*)?/g, "paths", "LOCAL_PATH");
    const localUser = path.basename(os.homedir());
    if (localUser) replace(new RegExp(`\\b${escapeRegExp(localUser)}\\b`, "gi"), "users", "USER");

    return { text, count };
  }

  pseudonym(mapName, raw, prefix) {
    const map = this.maps[mapName];
    if (!map.has(raw)) {
      const id = String(map.size + 1).padStart(3, "0");
      map.set(raw, `<${prefix}_${id}>`);
    }
    return map.get(raw);
  }

  toJSON() {
    const result = {};
    for (const [name, map] of Object.entries(this.maps)) {
      result[name] = Object.fromEntries([...map.entries()].sort((a, b) => a[1].localeCompare(b[1])));
    }
    return result;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitCommandChain(command) {
  const parts = [];
  let current = "";
  let quote = null;
  let escaped = false;

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    const next = command[i + 1];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      current += char;
      quote = char;
      continue;
    }
    if ((char === "&" && next === "&") || (char === "|" && next === "|")) {
      pushPart(parts, current);
      current = "";
      i += 1;
      continue;
    }
    if (char === ";" || char === "|") {
      pushPart(parts, current);
      current = "";
      continue;
    }
    if (char === "(" || char === ")") {
      pushPart(parts, current);
      current = "";
      continue;
    }
    current += char;
  }

  pushPart(parts, current);
  return parts;
}

function pushPart(parts, value) {
  const trimmed = value.trim();
  if (trimmed) parts.push(trimmed);
}

export function commandNames(command) {
  return [...new Set(splitCommandChain(command).map(commandName).filter(Boolean))];
}

function commandName(component) {
  const tokens = tokenize(component);
  while (tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0])) tokens.shift();
  if (!tokens.length) return null;
  if (tokens[0] === "sudo") tokens.shift();
  if (tokens[0] === "env") {
    tokens.shift();
    while (tokens.length && (tokens[0].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0]))) tokens.shift();
  }
  if (!tokens[0]) return null;
  if (/^\d+$/.test(tokens[0])) return null;
  if (/^<LOCAL_PATH_\d+>$/.test(tokens[0])) return "local-path-executable";
  if (path.isAbsolute(tokens[0])) return path.basename(tokens[0]) || "local-path-executable";
  return tokens[0].replace(/^\.?\//, "");
}

function tokenize(value) {
  const tokens = [];
  let current = "";
  let quote = null;
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}
