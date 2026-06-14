---
name: security-hardening-review-skill
description: Plan and verify security hardening changesets.
category: security
routing_triggers:
  - security hardening
  - patch plan
  - risk review
  - rollback plan
status: active
---
# Security Hardening Review Skill

## Purpose

Turn security hardening work into staged, evidenced changesets with risk, rollback, and policy checks.

## When to Use

Use for OpenClaw host hardening, firewall review, bot identity, mTLS, Vault PKI, gateway policy, Supabase Edge Function authorization boundaries, RLS/RPC hardening plans, or any change that can affect access or security posture.

## Inputs Required

- Target host/workspace.
- User risk posture.
- Access path: local console, SSH, RDP, LAN, VPS, WSL.
- Current config and audit evidence.
- Explicit approval for state-changing commands.

## Commands

Read-only baseline:

```bash
cd /home/johnh/.openclaw/workspace && uname -a
cd /home/johnh/.openclaw/workspace && cat /etc/os-release
cd /home/johnh/.openclaw/workspace && ss -ltnup
cd /home/johnh/.openclaw/workspace && ufw status
cd /home/johnh/.openclaw/workspace && openclaw security audit --deep
cd /home/johnh/.openclaw/workspace && openclaw update status
```

Windows evidence request:

```bash
manage-bde -status
netsh advfirewall show allprofiles
```

Suggested commands from extraction, approval required:

```bash
netsh advfirewall set currentprofile state on
netsh advfirewall export
openclaw security audit --fix
vault secrets enable pki
```

## Procedure

1. Run read-only baseline checks.
2. Identify host boundary: WSL, Windows host, VPS, local machine.
3. Request host-side evidence that cannot be collected from the sandbox.
4. Classify findings by severity and blast radius.
5. Package each proposed change with:
   - Gate A: spec.
   - Gate B: risk.
   - Gate C: evidence.
   - Gate D: rollback.
   - Gate E: policy check.
6. For Supabase hardening, explicitly check Data API grants versus RLS, exposed-schema RLS, public `SECURITY DEFINER` functions, `auth.role()` policy drift, ownership/tenant predicates, service-role callers, and whether migration/deploy/runtime verification are separate permission gates.
7. Ask for explicit approval before state-changing commands.
8. Verify after each approved change.

## Evidence Required

- OS/network baseline.
- OpenClaw audit result.
- Windows firewall/BitLocker status if relevant.
- Changeset with evidence and rollback.
- Post-change verification.

## Safety Rules

- Never change firewall/remote access without confirming access path.
- Never print secrets.
- Never claim OpenClaw changes OS firewall/updates by itself.
- Never let sub-bots receive raw secrets.
- Require owner approval for privilege expansion or security-control changes.
- For Supabase, do not treat source hardening, local migration drafting, remote secret setup, migration application, function deploy, or runtime endpoint checks as the same permission.

## Common Failures

- WSL cannot inspect Windows firewall: ask user for `netsh` output.
- `ufw` missing: explain Linux-side firewall is unavailable.
- Hardening breaks subagents: check OpenClaw allowlists and tool deny lists.
- Process overhead too high: still keep evidence/rollback for risky changes.

## Output Format

```text
Security review:
- Baseline:
- Findings:
- Proposed changesets:
- Required approvals:
- Verification plan:
- Rollback:
```

## Upgrade Ideas

Create references for Gate A-E templates, Windows evidence, Vault PKI, and secrets-handling rules.
