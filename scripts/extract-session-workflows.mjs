#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

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

const SOURCE_STATUSES = [
  "parsed_successfully",
  "unsupported_format",
  "unreadable",
  "excluded_by_explicit_rule",
  "duplicate",
  "corrupted",
  "empty",
  "generated_by_extraction_process_itself",
];

const TERMINAL_COVERAGE_BUCKETS = {
  parsed_successfully: "parsed",
  unsupported_format: "unsupported",
  unreadable: "corrupt",
  excluded_by_explicit_rule: "excluded",
  duplicate: "duplicate",
  corrupted: "corrupt",
  empty: "empty",
  generated_by_extraction_process_itself: "excluded",
};

const DEFAULT_META_PATTERNS = [
  /workflow[- ]?corpus/i,
  /workflow extraction methodology/i,
  /session[- ]?log extraction/i,
  /extract-session-workflows/i,
  /agent[- ]?roadmap recovery/i,
  /backlog recovery/i,
  /evidence-first backlog/i,
];

const SKILL_RE = /\b[a-z][a-z0-9-]+-skill\b/g;
const HELPER_RE = /\b(?:scripts|bin|tests|schemas|templates|routes|docs)\/[A-Za-z0-9._/-]+\b/g;
const ROUTE_RE = /\b[a-z0-9]+(?:-[a-z0-9]+){2,}\b/g;
const AGENT_ROLE_RE = /\b(planner|worker|reviewer|researcher|trader|banker|executioner|controller(?: bot)?|subagent|agent role)\b/gi;
const PRODUCT_RE = /\b(wagging web wins|wagging-web-wins|oneclickpostfactory|opstruth|supabase|cloudflare|devvit|reddit)\b/gi;

function usage() {
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
    else if (arg === "--json") args.json = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (args.from && Number.isNaN(args.from.valueOf())) throw new Error("--from must be an ISO date");
  if (args.to && Number.isNaN(args.to.valueOf())) throw new Error("--to must be an ISO date");
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
    replace(/\/home\/[A-Za-z0-9._-]+(?:\/[^\s"'<>`]*)?/g, "paths", "LOCAL_PATH");
    replace(/\bjohnh\b/gi, "users", "USER");

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

export function discoverSources(sources, options = {}) {
  const found = [];
  for (const source of sources) {
    const absolute = path.resolve(source);
    if (!fs.existsSync(absolute)) {
      found.push({ absolute, discovery_status: "unreadable", discovery_error: "source path not found" });
      continue;
    }
    const stat = fs.statSync(absolute);
    if (stat.isFile()) {
      found.push({ absolute, stat });
      continue;
    }
    if (!stat.isDirectory()) {
      found.push({ absolute, discovery_status: "unsupported_format", discovery_error: "source path is not file or directory" });
      continue;
    }
    walk(absolute, found, options);
  }
  return found.sort((a, b) => a.absolute.localeCompare(b.absolute));
}

function walk(directory, found, options) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    found.push({ absolute: directory, discovery_status: "unreadable", discovery_error: error.message });
    return;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "node_modules", ".cache", "tmp", ".tmp"].includes(entry.name)) continue;
      walk(absolute, found, options);
    } else if (entry.isFile()) {
      const stat = fs.statSync(absolute);
      if (options.from && stat.mtime < options.from) continue;
      if (options.to && stat.mtime > options.to) continue;
      found.push({ absolute, stat });
    }
  }
}

export function extractCorpus(options) {
  const redactor = new Redactor();
  const config = loadConfig(options.config);
  const discovered = discoverSources(options.sources, options);
  const seenHashes = new Map();
  const manifest = [];
  const events = [];
  const sourceRoots = options.sources.map((source, index) => ({
    root_id: `root_${String(index + 1).padStart(3, "0")}`,
    status: fs.existsSync(path.resolve(source)) ? "discovered" : "unreadable",
  }));

  for (const [index, item] of discovered.entries()) {
    const sourceIndex = index + 1;
    const baseRecord = {
      source_id: `src_${String(sourceIndex).padStart(5, "0")}`,
      source_format: "unknown",
      sha256: null,
      byte_size: item.stat?.size || 0,
      safe_mtime: item.stat?.mtime ? item.stat.mtime.toISOString() : null,
      parse_status: item.discovery_status || null,
      exclusion_reason: item.discovery_error || null,
      message_count: 0,
      event_count: 0,
      extraction_meta_session: false,
      duplicate_of: null,
    };

    if (item.discovery_status) {
      baseRecord.source_format = "unknown";
      baseRecord.parse_status = item.discovery_status;
      manifest.push(baseRecord);
      continue;
    }

    let text;
    try {
      text = fs.readFileSync(item.absolute, "utf8");
    } catch (error) {
      baseRecord.parse_status = "unreadable";
      baseRecord.exclusion_reason = error.message;
      manifest.push(baseRecord);
      continue;
    }

    const hash = sha256(text);
    baseRecord.sha256 = hash;
    baseRecord.source_id = `src_${hash.slice(0, 12)}_${String(sourceIndex).padStart(4, "0")}`;
    if (text.length === 0) {
      baseRecord.source_format = formatFor(item.absolute);
      baseRecord.parse_status = "empty";
      manifest.push(baseRecord);
      continue;
    }
    if (isGeneratedOutputName(path.basename(item.absolute))) {
      baseRecord.source_format = formatFor(item.absolute);
      baseRecord.parse_status = "generated_by_extraction_process_itself";
      baseRecord.exclusion_reason = "known extractor output file";
      manifest.push(baseRecord);
      continue;
    }
    if (seenHashes.has(hash)) {
      baseRecord.source_format = formatFor(item.absolute);
      baseRecord.parse_status = "duplicate";
      baseRecord.duplicate_of = seenHashes.get(hash);
      manifest.push(baseRecord);
      continue;
    }
    seenHashes.set(hash, baseRecord.source_id);

    const format = formatFor(item.absolute);
    baseRecord.source_format = format;
    if (format !== "jsonl") {
      baseRecord.parse_status = "unsupported_format";
      baseRecord.exclusion_reason = "only JSONL session-like files are parsed";
      manifest.push(baseRecord);
      continue;
    }

    const parsed = parseJsonlSource(text, baseRecord.source_id, redactor, config);
    baseRecord.parse_status = parsed.corrupt_lines ? "corrupted" : "parsed_successfully";
    baseRecord.exclusion_reason = parsed.corrupt_lines ? `${parsed.corrupt_lines} corrupt line(s)` : null;
    baseRecord.message_count = parsed.message_count;
    baseRecord.event_count = parsed.events.length;
    baseRecord.extraction_meta_session = parsed.extraction_meta_session;
    manifest.push(baseRecord);
    events.push(...parsed.events);
  }

  const coverage = buildCoverage({
    manifest,
    events,
    sourceRoots,
    includeMetaSessions: options.includeMetaSessions,
  });
  const validation = validateCorpus({ manifest, events, coverage });
  return {
    manifest,
    events,
    coverage,
    validation,
    pseudonymMap: redactor.toJSON(),
  };
}

function loadConfig(configPath) {
  const config = { metaPatterns: DEFAULT_META_PATTERNS };
  if (!configPath) return config;
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (Array.isArray(parsed.meta_session_patterns)) {
    config.metaPatterns = parsed.meta_session_patterns.map((item) => new RegExp(item, "i"));
  }
  return config;
}

function isGeneratedOutputName(name) {
  return [
    "source-manifest.json",
    "workflow-corpus.jsonl",
    "coverage-report.json",
    "coverage-report.md",
    "validation-report.json",
    "pseudonym-map.json",
  ].includes(name);
}

function formatFor(file) {
  const name = path.basename(file).toLowerCase();
  if (name.includes(".jsonl")) return "jsonl";
  return path.extname(name).replace(/^\./, "") || "unknown";
}

function parseJsonlSource(text, sourceId, redactor, config) {
  const lines = text.split(/\r?\n/);
  const events = [];
  const toolCalls = new Map();
  let sequence = 0;
  let corruptLines = 0;
  let messageCount = 0;
  let metaSession = false;

  for (let lineNo = 0; lineNo < lines.length; lineNo += 1) {
    const line = lines[lineNo];
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      corruptLines += 1;
      continue;
    }
    messageCount += 1;
    const extracted = eventsFromRecord(record, {
      sourceId,
      redactor,
      lineNo: lineNo + 1,
      toolCalls,
      config,
    });
    for (const event of extracted) {
      sequence += 1;
      const stableBasis = `${sourceId}:${sequence}:${event.primary_class}:${event.tool_name || ""}:${event.summary}:${event.command_chain_redacted || ""}`;
      events.push({
        event_id: `evt_${sha256(stableBasis).slice(0, 16)}`,
        source_id: sourceId,
        sequence,
        ...event,
      });
      if (event.evidence_tags.includes("EXTRACTION_META_SESSION")) metaSession = true;
    }
  }

  return {
    events,
    corrupt_lines: corruptLines,
    message_count: messageCount,
    extraction_meta_session: metaSession || events.some((event) => event.evidence_tags.includes("EXTRACTION_META_SESSION")),
  };
}

function eventsFromRecord(record, context) {
  if (record.type === "message" && record.message) return openClawMessageEvents(record, context);
  if (record.type === "response_item" && record.payload) return codexResponseEvents(record, context);
  if (record.type === "event_msg" && record.payload) return codexEventEvents(record, context);
  return [];
}

function openClawMessageEvents(record, context) {
  const msg = record.message || {};
  const role = msg.role || "unknown";
  const events = [];
  for (const content of Array.isArray(msg.content) ? msg.content : []) {
    if (!content || content.type === "thinking") continue;
    if (content.type === "text") {
      events.push(...textEvents({ text: content.text || "", actor: role, timestamp: msg.timestamp || record.timestamp || null }, context));
    } else if (content.type === "toolCall") {
      events.push(toolInvocationEvent({
        actor: "assistant",
        timestamp: record.timestamp || msg.timestamp || null,
        toolName: content.name || "unknown",
        argumentsValue: content.arguments,
        callId: content.id || null,
      }, context));
    }
  }
  if (role === "tool") {
    events.push(toolResultEvent({
      timestamp: msg.timestamp || record.timestamp || null,
      toolName: msg.toolName || "unknown",
      callId: msg.toolCallId || null,
      output: collectText(msg.content),
    }, context));
  }
  return events;
}

function codexResponseEvents(record, context) {
  const payload = record.payload || {};
  const type = payload.type || "";
  if (payload.name && Object.prototype.hasOwnProperty.call(payload, "arguments")) {
    return [toolInvocationEvent({
      actor: "assistant",
      timestamp: record.timestamp || null,
      toolName: payload.name,
      argumentsValue: payload.arguments,
      callId: payload.call_id || null,
    }, context)];
  }
  if (payload.call_id && Object.prototype.hasOwnProperty.call(payload, "output")) {
    return [toolResultEvent({
      timestamp: record.timestamp || null,
      toolName: "unknown",
      callId: payload.call_id,
      output: payload.output,
    }, context)];
  }
  if (payload.content && payload.role) {
    return textEvents({ text: collectText(payload.content), actor: payload.role, timestamp: record.timestamp || null }, context);
  }
  if (type === "reasoning") return [];
  return [];
}

function codexEventEvents(record, context) {
  const payload = record.payload || {};
  const text = payload.message || payload.text || collectText(payload.text_elements || []);
  if (!text) return [];
  return textEvents({ text, actor: "user", timestamp: record.timestamp || null }, context);
}

function textEvents({ text, actor, timestamp }, context) {
  if (!String(text || "").trim()) return [];
  const analysis = analyzeText(text, actor, context.redactor, context.config);
  const events = [{
    timestamp: normalizeTimestamp(timestamp),
    primary_class: analysis.primaryClass,
    evidence_tags: analysis.tags,
    actor,
    tool_name: null,
    command_names: [],
    summary: analysis.summary,
    agent_role_mentions: analysis.agentRoles,
    skill_mentions: analysis.skills,
    helper_mentions: analysis.helpers,
    route_mentions: analysis.routes,
    confidence: "medium",
    privacy_redactions: analysis.redactions,
  }];

  for (const command of proposedCommands(text)) {
    const redacted = context.redactor.redact(command);
    const names = commandNames(command);
    events.push({
      timestamp: normalizeTimestamp(timestamp),
      primary_class: "SHELL_COMMAND_PROPOSED",
      evidence_tags: ["SHELL_COMMAND_PROPOSED", actor === "assistant" ? "ASSISTANT_PROPOSAL" : "USER_REQUEST"],
      actor,
      tool_name: null,
      command_names: names,
      command_chain_redacted: redacted.text,
      command_components: splitCommandChain(redacted.text),
      summary: `proposed shell command chain with ${names.length || 0} command name(s)`,
      agent_role_mentions: [],
      skill_mentions: [],
      helper_mentions: mentions(command, HELPER_RE),
      route_mentions: [],
      confidence: "high",
      privacy_redactions: redacted.count,
    });
  }
  return events;
}

function toolInvocationEvent({ actor, timestamp, toolName, argumentsValue, callId }, context) {
  const argsText = typeof argumentsValue === "string" ? argumentsValue : JSON.stringify(argumentsValue || {});
  const command = extractCommand(argumentsValue);
  const tags = ["TOOL_INVOCATION"];
  const event = {
    timestamp: normalizeTimestamp(timestamp),
    primary_class: "TOOL_INVOCATION",
    evidence_tags: tags,
    actor,
    tool_name: toolName,
    command_names: [],
    summary: `tool invocation: ${toolName}`,
    agent_role_mentions: mentions(argsText, AGENT_ROLE_RE),
    skill_mentions: mentions(argsText, SKILL_RE),
    helper_mentions: mentions(argsText, HELPER_RE),
    route_mentions: routeMentions(argsText),
    confidence: "high",
    privacy_redactions: 0,
  };
  if (command) {
    const redacted = context.redactor.redact(command);
    event.primary_class = "SHELL_COMMAND_EXECUTED";
    event.evidence_tags = ["TOOL_INVOCATION", "SHELL_COMMAND_EXECUTED"];
    event.command_names = commandNames(redacted.text);
    event.command_chain_redacted = redacted.text;
    event.command_components = splitCommandChain(redacted.text);
    event.summary = `executed shell command chain with ${event.command_names.length || 0} command name(s)`;
    event.privacy_redactions = redacted.count;
  }
  if (callId) context.toolCalls.set(callId, { toolName, command, commandRedacted: event.command_chain_redacted || null });
  return event;
}

function toolResultEvent({ timestamp, toolName, callId, output }, context) {
  const linked = callId ? context.toolCalls.get(callId) : null;
  const outputText = typeof output === "string" ? output : JSON.stringify(output || {});
  const redacted = context.redactor.redact(outputText.slice(0, 2000));
  const tags = ["TOOL_RESULT"];
  if (/error|failed|blocked|denied|not found|exit code [1-9]/i.test(outputText)) tags.push("FAILURE_OR_BLOCKER");
  if (/pass|passed|success|result:\s*pass/i.test(outputText)) tags.push("VALIDATION_RESULT");
  return {
    timestamp: normalizeTimestamp(timestamp),
    primary_class: tags.includes("FAILURE_OR_BLOCKER") ? "FAILURE_OR_BLOCKER" : "TOOL_RESULT",
    evidence_tags: tags,
    actor: "tool",
    tool_name: linked?.toolName || toolName,
    linked_call_id: callId || null,
    command_names: linked?.commandRedacted ? commandNames(linked.commandRedacted) : linked?.command ? commandNames(linked.command) : [],
    summary: summarizeToolResult(redacted.text),
    agent_role_mentions: [],
    skill_mentions: mentions(outputText, SKILL_RE),
    helper_mentions: mentions(outputText, HELPER_RE),
    route_mentions: routeMentions(outputText),
    confidence: "high",
    privacy_redactions: redacted.count,
  };
}

function analyzeText(text, actor, redactor, config) {
  const skills = mentions(text, SKILL_RE);
  const helpers = mentions(text, HELPER_RE);
  const routes = routeMentions(text);
  const agentRoles = mentions(text, AGENT_ROLE_RE);
  const productMentions = mentions(text, PRODUCT_RE);
  const tags = [];
  let primaryClass = actor === "user" ? "USER_REQUEST" : "ASSISTANT_PROPOSAL";
  if (actor === "assistant" && /\b(i will|i'm going to|next i|i’ll|implemented|created|updated|decision)\b/i.test(text)) primaryClass = "ASSISTANT_DECISION";
  tags.push(primaryClass);
  if (skills.length) tags.push("SKILL_MENTION");
  if (helpers.length) tags.push("SCRIPT_OR_HELPER_MENTION");
  if (routes.length) tags.push("ROUTE_OR_CONTROL_PLANE_MENTION");
  if (agentRoles.length) tags.push("AGENT_ROLE_MENTION");
  if (productMentions.length) tags.push("PRODUCT_SPECIFIC_MENTION");
  if (/\b(next|follow[- ]?up|future|backlog|later|upgrade idea)\b/i.test(text)) tags.push("FUTURE_WORK", "BACKLOG_ITEM");
  if (/\b(not allowed|permission|authority|grant|boundary|do not|blocked|capability)\b/i.test(text)) tags.push("PERMISSION_OR_AUTHORITY_BOUNDARY", "CAPABILITY_BOUNDARY");
  if (config.metaPatterns.some((pattern) => pattern.test(text))) tags.push("EXTRACTION_META_SESSION");
  const redacted = redactor.redact(text);
  return {
    primaryClass,
    tags: [...new Set(tags.filter((tag) => EVIDENCE_CLASSES.includes(tag) || tag === "EXTRACTION_META_SESSION"))],
    summary: summarizeText(redacted.text, actor, { skills, helpers, routes, agentRoles, productMentions }),
    skills,
    helpers,
    routes,
    agentRoles,
    redactions: redacted.count,
  };
}

function proposedCommands(text) {
  const commands = [];
  const fenceRe = /```(?:bash|sh|shell|zsh|console)?\n([\s\S]*?)```/gi;
  let match;
  while ((match = fenceRe.exec(text))) {
    for (const line of match[1].split(/\r?\n/)) {
      const trimmed = line.trim();
      if (looksLikeCommand(trimmed)) commands.push(trimmed.replace(/^\$\s*/, ""));
    }
  }
  return commands;
}

function looksLikeCommand(line) {
  if (!line || line.startsWith("#")) return false;
  return /^(\$\s*)?(cd|git|npm|npx|node|deno|python|python3|rg|sed|grep|find|cat|curl|gh|psql|supabase|wrangler|chmod|mkdir|rm|cp|mv|env|sudo|\.\/|\/[A-Za-z0-9._/-]+)/.test(line);
}

function extractCommand(argumentsValue) {
  if (!argumentsValue) return null;
  if (typeof argumentsValue === "string") {
    try {
      return extractCommand(JSON.parse(argumentsValue));
    } catch {
      return looksLikeCommand(argumentsValue.trim()) ? argumentsValue.trim() : null;
    }
  }
  if (typeof argumentsValue !== "object") return null;
  return argumentsValue.cmd || argumentsValue.command || argumentsValue.shell_command || null;
}

function collectText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (item?.type === "text") return item.text || "";
    if (typeof item?.text === "string") return item.text;
    return "";
  }).filter(Boolean).join("\n");
}

function summarizeText(text, actor, found) {
  const pieces = [];
  if (found.skills.length) pieces.push(`${found.skills.length} skill mention(s)`);
  if (found.helpers.length) pieces.push(`${found.helpers.length} helper mention(s)`);
  if (found.routes.length) pieces.push(`${found.routes.length} route/control-plane mention(s)`);
  if (found.agentRoles.length) pieces.push(`${found.agentRoles.length} agent-role mention(s)`);
  if (found.productMentions.length) pieces.push(`${found.productMentions.length} product-specific mention(s)`);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return `${actor} text event (${words} redacted word(s)${pieces.length ? `; ${pieces.join("; ")}` : ""})`;
}

function summarizeToolResult(text) {
  if (/error|failed|blocked|denied|not found/i.test(text)) return "tool result reported failure or blocker";
  if (/pass|passed|success|result:\s*pass/i.test(text)) return "tool result reported validation success";
  const lines = text.split(/\r?\n/).filter(Boolean).length;
  return `tool result with ${lines} redacted output line(s)`;
}

function mentions(text, regex) {
  const found = new Set();
  for (const match of String(text || "").matchAll(regex)) {
    const value = match[0].toLowerCase();
    if (!containsPrivateLeak(value) && value.length <= 96) found.add(value);
  }
  return [...found].sort();
}

function routeMentions(text) {
  return mentions(text, ROUTE_RE).filter((item) => item.includes("-"));
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function buildCoverage({ manifest, events, sourceRoots, includeMetaSessions }) {
  const totals = {
    discovered: manifest.length,
    parsed: 0,
    unsupported: 0,
    corrupt: 0,
    empty: 0,
    duplicate: 0,
    excluded: 0,
  };
  for (const source of manifest) {
    const bucket = TERMINAL_COVERAGE_BUCKETS[source.parse_status] || "corrupt";
    totals[bucket] += 1;
  }
  const eventTimestamps = events.map((event) => event.timestamp).filter(Boolean).sort();
  const metaSourceIds = new Set(manifest.filter((source) => source.extraction_meta_session).map((source) => source.source_id));
  const rankedEvents = includeMetaSessions ? events : events.filter((event) => !metaSourceIds.has(event.source_id));
  return {
    source_roots: sourceRoots,
    totals,
    extraction_meta_sessions: metaSourceIds.size,
    total_events: events.length,
    ranked_events: rankedEvents.length,
    date_range: {
      from: eventTimestamps[0] || null,
      to: eventTimestamps[eventTimestamps.length - 1] || null,
    },
    class_counts: countBy(events, "primary_class"),
    command_counts: countCommandNames(rankedEvents),
    skill_mentions: countMentions(rankedEvents, "skill_mentions"),
    helper_mentions: countMentions(rankedEvents, "helper_mentions"),
    agent_role_mentions: countMentions(rankedEvents, "agent_role_mentions"),
    confidence_limitations: [
      "Text summaries are redacted and do not preserve full transcript bodies.",
      "Executed shell commands require tool invocation evidence.",
      "Extraction-meta sessions are excluded from rankings unless include-meta-sessions is enabled.",
    ],
  };
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function countCommandNames(events) {
  const counts = {};
  for (const event of events) {
    for (const name of event.command_names || []) counts[name] = (counts[name] || 0) + 1;
  }
  return sortCounts(counts);
}

function countMentions(events, key) {
  const counts = {};
  for (const event of events) {
    for (const value of event[key] || []) counts[value] = (counts[value] || 0) + 1;
  }
  return sortCounts(counts);
}

function sortCounts(counts) {
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

export function validateCorpus({ manifest, events, coverage }) {
  const errors = [];
  const sourceIds = new Set();
  for (const source of manifest) {
    if (!source.source_id) errors.push("source missing source_id");
    if (sourceIds.has(source.source_id)) errors.push(`duplicate source_id ${source.source_id}`);
    sourceIds.add(source.source_id);
    if (!SOURCE_STATUSES.includes(source.parse_status)) errors.push(`${source.source_id}: invalid parse_status ${source.parse_status}`);
    if (source.local_path) errors.push(`${source.source_id}: portable manifest must not include local_path`);
  }
  const eventIds = new Set();
  for (const event of events) {
    if (!event.event_id) errors.push("event missing event_id");
    if (eventIds.has(event.event_id)) errors.push(`duplicate event_id ${event.event_id}`);
    eventIds.add(event.event_id);
    if (!sourceIds.has(event.source_id)) errors.push(`${event.event_id}: unknown source_id`);
    if (!EVIDENCE_CLASSES.includes(event.primary_class)) errors.push(`${event.event_id}: invalid primary_class ${event.primary_class}`);
    if (!Array.isArray(event.evidence_tags) || !event.evidence_tags.length) errors.push(`${event.event_id}: missing evidence_tags`);
    if (containsPrivateLeak(JSON.stringify(event))) errors.push(`${event.event_id}: event contains private-looking value`);
  }
  const totals = coverage.totals;
  const reconciled = totals.parsed + totals.unsupported + totals.corrupt + totals.empty + totals.duplicate + totals.excluded;
  if (totals.discovered !== reconciled) errors.push(`coverage does not reconcile: discovered ${totals.discovered}, buckets ${reconciled}`);
  return {
    status: errors.length ? "FAIL" : "PASS",
    errors,
    corpus_schema: errors.some((error) => error.includes("event")) ? "FAIL" : "PASS",
    manifest_schema: errors.some((error) => error.includes("source")) ? "FAIL" : "PASS",
    coverage_reconciled: totals.discovered === reconciled,
  };
}

function containsPrivateLeak(text) {
  return /\/home\/[A-Za-z0-9._-]+|postgres(?:ql)?:\/\/|Bearer\s+[A-Za-z0-9._-]+|gh[pousr]_[A-Za-z0-9_]{12,}|sk-[A-Za-z0-9_-]{12,}/i.test(text);
}

export function writeOutputs(outputDir, result, options) {
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  writeJson(path.join(outputDir, "source-manifest.json"), {
    schema: "workflow-source-manifest.v1",
    sources: result.manifest,
  });
  writeJson(path.join(outputDir, "coverage-report.json"), result.coverage);
  fs.writeFileSync(path.join(outputDir, "coverage-report.md"), coverageMarkdown(result.coverage), { mode: 0o600 });
  writeJson(path.join(outputDir, "validation-report.json"), result.validation);
  writeJson(path.join(outputDir, "pseudonym-map.json"), result.pseudonymMap, 0o600);
  if (!options.manifestOnly) {
    fs.writeFileSync(
      path.join(outputDir, "workflow-corpus.jsonl"),
      result.events.map((event) => JSON.stringify(event)).join("\n") + (result.events.length ? "\n" : ""),
      { mode: 0o600 }
    );
  }
}

function writeJson(file, value, mode = 0o600) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode });
}

function coverageMarkdown(coverage) {
  const totals = coverage.totals;
  return `# Workflow Corpus Coverage Report

## Source Roots

${coverage.source_roots.map((root) => `- ${root.root_id}: ${root.status}`).join("\n") || "- None"}

## Totals

- discovered: ${totals.discovered}
- parsed: ${totals.parsed}
- unsupported: ${totals.unsupported}
- corrupt: ${totals.corrupt}
- empty: ${totals.empty}
- duplicate: ${totals.duplicate}
- excluded: ${totals.excluded}
- extraction meta sessions: ${coverage.extraction_meta_sessions}
- total events: ${coverage.total_events}
- ranked events: ${coverage.ranked_events}
- date range: ${coverage.date_range.from || "unknown"} to ${coverage.date_range.to || "unknown"}

Coverage reconciliation: ${totals.discovered === totals.parsed + totals.unsupported + totals.corrupt + totals.empty + totals.duplicate + totals.excluded ? "PASS" : "FAIL"}

## Confidence Limitations

${coverage.confidence_limitations.map((item) => `- ${item}`).join("\n")}
`;
}

export function validateExistingOutput(outputDir) {
  const manifestPath = path.join(outputDir, "source-manifest.json");
  const corpusPath = path.join(outputDir, "workflow-corpus.jsonl");
  const coveragePath = path.join(outputDir, "coverage-report.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")).sources || [];
  const events = fs.existsSync(corpusPath)
    ? fs.readFileSync(corpusPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const coverage = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
  return validateCorpus({ manifest, events, coverage });
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function printSummary(result, args) {
  const summary = {
    output_dir: args.outputDir,
    dry_run: args.dryRun,
    manifest_only: args.manifestOnly,
    sources_discovered: result.manifest.length,
    events: result.events.length,
    validation: result.validation.status,
    coverage: result.coverage.totals,
    extraction_meta_sessions: result.coverage.extraction_meta_sessions,
  };
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`# Workflow Extraction Summary

Output dir: ${args.dryRun ? "(dry-run; no writes)" : args.outputDir}
Sources discovered: ${summary.sources_discovered}
Events: ${summary.events}
Validation: ${summary.validation}
Coverage: ${JSON.stringify(summary.coverage)}
Extraction meta sessions: ${summary.extraction_meta_sessions}`);
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    usage();
    process.exit(2);
  }

  if (args.help) {
    usage();
    return;
  }

  if (args.validateOnly) {
    const validation = validateExistingOutput(path.resolve(args.outputDir));
    if (args.json) console.log(JSON.stringify(validation, null, 2));
    else console.log(`Validation: ${validation.status}${validation.errors.length ? `\n${validation.errors.join("\n")}` : ""}`);
    process.exit(validation.status === "PASS" ? 0 : 1);
  }

  if (!args.sources.length) {
    console.error("at least one --source is required unless --validate-only is used");
    process.exit(2);
  }

  const result = extractCorpus(args);
  if (!args.dryRun) writeOutputs(path.resolve(args.outputDir), result, args);
  printSummary(result, args);
  process.exit(result.validation.status === "PASS" ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
