import fs from "fs";
import path from "path";

import {
  AGENT_ROLE_RE,
  DEFAULT_META_PATTERNS,
  EVIDENCE_CLASSES,
  HELPER_RE,
  PRODUCT_RE,
  ROUTE_RE,
  Redactor,
  SKILL_RE,
  commandNames,
  splitCommandChain,
} from "./core.mjs";
import {
  buildCoverage,
  containsPrivateLeak,
  createWorkflowSnapshot,
  sha256,
  validateCorpus,
} from "./snapshot.mjs";

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
  const result = {
    manifest,
    events,
    coverage,
    validation,
    pseudonymMap: redactor.toJSON(),
  };
  result.snapshot = createWorkflowSnapshot(result, { manifestOnly: Boolean(options.manifestOnly) });
  return result;
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
    "workflow-snapshot.json",
    "snapshot-comparison.json",
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
