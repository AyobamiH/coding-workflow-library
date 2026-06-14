---
name: public-market-scan-skill
description: Run public market-data scans with source caveats.
category: automation
routing_triggers:
  - market scan
  - stock scan
  - public data
  - Stooq scan
status: active
---
# Public Market Scan Skill

## Purpose

Run a public-data fallback scan for U.S. equities using permitted public sources and explicit caveats when live data is unavailable.

## When to Use

Use when the user asks for momentum, volume expansion, watchlist, or next-session trade candidates and authorizes public sources.

## Inputs Required

- Market filters: price range, average volume, relative volume, percent move.
- Allowed sources.
- Whether live, delayed, or latest completed session data is acceptable.
- Output constraints: notes only vs trade intent.

## Commands

Finviz confirmed commands:

```bash
cd /home/johnh/.openclaw/workspace && curl -s 'https://finviz.com/screener.ashx?v=111&f=sh_avgvol_o1000,sh_price_o5,sh_price_u150,ta_pattern_cta&ft=4'
cd /home/johnh/.openclaw/workspace && curl -s 'https://finviz.com/screener.ashx?v=111&o=-change&f=sh_avgvol_o1000,sh_price_o5,sh_price_u150,ta_pattern_flag,ta_sma20_pa,ta_sma50_pa'
cd /home/johnh/.openclaw/workspace-researcher && curl -s 'https://finviz.com/screener.ashx?v=111&f=sh_price_o5,sh_price_u150,sh_avgvol_o1000,sh_relvol_o1.5,ta_perf_dup,exch_nyse,exch_nasdaq'
```

Stooq Node pattern confirmed:

```bash
node - <<'NODE'
// Fetch https://stooq.com/q/d/l/?s=${ticker}&i=d for each ticker.
// Parse CSV.
// Compute percent move, 20-day average volume, volume multiple, SMA20/SMA50, high/low levels.
// Print JSON candidate list with asof date and caveats.
NODE
```

Subagent dispatch template:

```text
sessions_spawn {"agentId":"researcher","label":"Mission Brief V2 scan","task":"Mission Brief V2 active. Run the daily momentum + volume expansion scan for U.S. equities: ... Deliver NOTES only ...","runTimeoutSeconds":600}
```

## Procedure

1. Confirm allowed data sources and whether proxy/latest-session data is acceptable.
2. Try public screener data.
3. If the screener HTML is not parseable, use a public CSV source such as Stooq with a known ticker universe.
4. Compute objective fields: price, percent move, volume multiple, SMA/levels.
5. Label all delayed/proxy data clearly.
6. If running under the governed pipeline, Researcher returns notes only. Trader/Banker/Executioner are separate stages.

## Evidence Required

- Source URL or data provider.
- As-of date.
- Candidate metrics.
- Missing-data approximation statement.

## Safety Rules

- Do not fabricate live data.
- Do not output trade execution instructions from Researcher notes.
- Do not imply delayed/proxy data is real-time.
- Do not bypass risk approval.

## Common Failures

- Finviz bot/HTML changes: switch to Stooq/public CSV.
- Missing Python/yfinance: use Node fetch.
- Ticker suffix mismatch: verify provider symbol format.
- Over-extended move violates filters: note disqualification.

## Output Format

Research notes:

```text
Data source:
As of:
Candidate:
- Ticker:
- Why on radar:
- Volume/price evidence:
- Technical structure:
- Key levels:
- Risk/invalidation:
Missing data caveat:
```

## Upgrade Ideas

Create `scripts/stooq_scan.mjs` with ticker universe input, filter flags, and JSON/Markdown output.
