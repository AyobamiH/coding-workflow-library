---
name: session-log-extraction-skill
description: Extract reusable workflow skills from session logs.
category: skill-system
routing_triggers:
  - skill extraction
  - session logs
  - workflow inventory
  - command harvest
status: active
---
# Session Log Extraction Skill

## Purpose

Extract useful coding workflows from local OpenClaw/Codex session logs without leaking secrets or assistant private reasoning. The skill turns JSONL transcripts into a command/tool/prompt inventory that can be converted into reusable local skills.

## When to Use

Use when the user asks to mine a chat, session, transcript, run log, or evidence pack for commands, tool calls, debugging moves, prompts, repeated workflows, or skill candidates.

## Inputs Required

- Workspace root, usually `/home/johnh/.openclaw`.
- Session log folders, usually `agents/main/sessions` and `agents/researcher/sessions`.
- Optional evidence files such as `evidence/opstruth-report.md`.
- Redaction terms for secrets, tokens, and API keys.

## Commands

```bash
find agents/main/sessions -maxdepth 1 -type f -name '*.jsonl*' -printf '%f %s bytes\n'
find agents/researcher/sessions -maxdepth 1 -type f -name '*.jsonl*' -printf '%f %s bytes\n'
rg -n "command|cmd|exec|tool|npm|git|gh|wrangler|curl|Supabase|Cloudflare|deploy|build|test|lint|typecheck|publish|release|evidence" agents/main/sessions/*.jsonl -S
jq --version
```

When `jq` is unavailable, use a Node parser. Template:

```bash
node -e 'const fs=require("fs"); const files=[...fs.readdirSync("agents/main/sessions").map(f=>"agents/main/sessions/"+f), ...fs.readdirSync("agents/researcher/sessions").map(f=>"agents/researcher/sessions/"+f)].filter(f=>f.includes(".jsonl")); for (const f of files) { const lines=fs.readFileSync(f,"utf8").split(/\n/); lines.forEach((line,i)=>{ if(!line.trim()) return; let o; try{o=JSON.parse(line)}catch{return} const m=o.message||{}; const content=Array.isArray(m.content)?m.content:[]; for (const c of content) { if(c.type==="toolCall") console.log(`@@ ${f}:${i+1} TOOL ${c.name} ${JSON.stringify(c.arguments)}`); if(c.type==="text") console.log(`@@ ${f}:${i+1} ${(m.role||"unknown").toUpperCase()} TEXT ${(c.text||"").slice(0,1200)}`); } if(m.errorMessage) console.log(`@@ ${f}:${i+1} ERROR ${m.errorMessage}`); }); }'
```

## Procedure

1. Locate session and evidence files.
2. Count session files and identify large logs worth parsing.
3. Extract only user-visible `text`, `toolCall`, tool results, and error messages.
4. Skip `thinking`, encrypted reasoning, and hidden/system material.
5. Redact bearer tokens, API keys, `.env` content, and credential values.
6. Build a command ledger grouped into confirmed commands, suggested commands, and inferred gaps.
7. Convert repeated patterns into candidate local skills.

## Evidence Required

- File list proving which logs were inspected.
- Parser output showing tool calls and commands with source file/line.
- Redaction scan of the generated extraction.
- Explicit statement for categories with no confirmed commands.

## Safety Rules

- Do not quote assistant private reasoning.
- Do not print credential file contents.
- Do not treat unrelated skill documentation as a used command unless the session explicitly read or used it.
- Do not invent Cloudflare, Supabase, GitHub, migration, or deploy commands when none were confirmed.

## Common Failures

- `jq` missing: use Node parser.
- Output too large: filter by keywords, then inspect targeted line ranges.
- Secret leakage risk: scan output before finalizing.
- Confusing suggested commands with executed commands: maintain separate sections.

## Output Format

Return a report with:

- Scope and excluded sources.
- Raw extraction table.
- Confirmed command ledger.
- Suggested command ledger.
- Named skill inventory.
- Duplicate workflows.
- High-priority build queue.

## Upgrade Ideas

Create `scripts/extract_session_workflows.mjs` that accepts log directories, redaction rules, and keyword filters, then emits Markdown and JSON inventories.
