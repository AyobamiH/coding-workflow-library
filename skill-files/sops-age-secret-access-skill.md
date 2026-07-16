---
name: sops-age-secret-access-skill
description: Validate and use local open-source SOPS plus age secret injection without printing decrypted values or private identities.
category: security
routing_triggers:
  - sops age secret access
  - encrypted environment injection
  - open source secret management
  - non-printing credentials
status: active
---
# SOPS + age Secret Access Skill

## Purpose

Provide a local, open-source credential adapter with no hosted account or subscription. `scripts/sops-age-secret-access` verifies SOPS and age, detects a private age identity without emitting it, validates SOPS encryption metadata, and delegates one approved runtime injection to `sops exec-env --pristine` while suppressing provider and child output.

This is not a general secret broker. It does not decrypt to stdout, materialise plaintext files, edit encrypted files, rotate identities, publish SOPS data, or grant the delegated command publication, deployment, production, secret-mutation, or destructive authority.

## When to Use

Use when:

- a workflow credential should be stored in a versionable encrypted file rather than plaintext;
- local secret handling must work offline without a hosted subscription;
- SOPS/age availability or identity readiness needs safe classification;
- an encrypted dotenv, INI, JSON, or YAML file needs metadata validation;
- one exact subprocess needs separately authorised runtime injection.

Do not use this skill to print decrypted values, inspect secret contents, generate activity merely to prove access, or weaken a child workflow's own authority gates.

## Inputs Required

- Exact operation: status, encrypted-file validation, dry-run, or injection.
- Exact SOPS-encrypted file.
- Input type when the filename does not reveal it.
- Exact child executable and arguments.
- Active objective and consequence authority for the child command.
- Explicit `secret-access` approval before runtime decryption.
- Private age identity outside source, normally `$XDG_CONFIG_HOME/sops/age/keys.txt` or `~/.config/sops/age/keys.txt`.

## Commands

Read-only capability and metadata checks:

```bash
./scripts/sops-age-secret-access status --validate
./scripts/sops-age-secret-access validate-file \
  --file /private/path/runtime.enc.env \
  --validate
```

Non-decrypting execution plan:

```bash
./scripts/sops-age-secret-access run \
  --file /private/path/runtime.enc.env \
  --dry-run \
  --validate \
  -- command arg
```

One separately authorised injection:

```bash
./scripts/sops-age-secret-access run \
  --file /private/path/runtime.enc.env \
  --allow-secret-access \
  --validate \
  -- command arg
```

CLI delegation:

```bash
coding-workflow sops-age status --validate
coding-workflow sops-age validate-file --file /private/path/runtime.enc.env --validate
```

The helper reports only tool versions, identity source category, encrypted filename, input type, file size, command basename, exit state, and suppressed output byte counts.

## Initial Local Setup

Create a workstation identity outside source:

```bash
umask 077
mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/sops/age"
age-keygen -o "${XDG_CONFIG_HOME:-$HOME/.config}/sops/age/keys.txt"
```

Derive the public recipient when creating a SOPS policy:

```bash
age-keygen -y "${XDG_CONFIG_HOME:-$HOME/.config}/sops/age/keys.txt"
```

The recipient is public. The identity file is private and must be backed up securely. Never commit it.

For real use, create a separate recovery identity and encrypt each operational file for both public recipients:

```bash
umask 077
age-keygen -o /private/recovery/location/age-identity.txt
age-keygen -y /private/recovery/location/age-identity.txt
```

Store the recovery identity independently from the workstation. A SOPS creation rule may list both public recipients as a comma-separated `age` value. Test both identities against a non-production encrypted fixture before relying on the policy. Never record either private identity in a repository, evidence pack, transcript, or command argument.

## Procedure

1. Read `AGENTS.md`, `tools.md`, and the selected child workflow skill.
2. Run `status`. Treat missing tools or identity as `BLOCKED_CAPABILITY`.
3. Keep the age identity outside source with owner-only permissions.
4. Store only SOPS-encrypted files in a repository. Keep `.sops.yaml` public and recipient-only.
5. Run `validate-file`; it uses `sops filestatus` and does not decrypt.
6. Run the exact child with `--dry-run`.
7. Confirm the child command's own consequence authority.
8. Use `--allow-secret-access` for one bounded `sops exec-env --pristine` attempt.
9. Record only safe status metadata and suppressed byte counts.
10. If the child fails, investigate the child contract without relaying captured output.

## Evidence Required

- SOPS, age, and age-keygen availability and numeric versions.
- Identity state, source category, and owner-only permission result.
- Encrypted filename, input type, size, and `filestatus` result.
- Dry-run result before decryption.
- Explicit secret-access flag for a real injection.
- Child command basename, exit state, signal, and suppressed output byte counts.
- Confirmation that no decrypted value, private identity, provider output, or plaintext file was emitted.
- Exact child consequence authority and commands deliberately not run.

## Output Format

Report:

- operation: `status`, `validate-file`, or `run`
- status: `PASS`, `FAIL`, `BLOCKED_CAPABILITY`, or `BLOCKED_PERMISSION`
- tooling: SOPS, age, and age-keygen state plus numeric version when available
- identity: safe source category and private-permission result only
- encrypted file: basename, input type, size, encrypted state, and validation state
- execution: dry-run/attempted state, child command basename, exit state, signal, and suppressed stdout/stderr byte counts
- guarantees: decrypted values, provider output, private identity, plaintext files, and repository writes were not emitted or created
- findings: safe code and severity only
- next action: one bounded non-secret step

Never include decrypted values, environment contents, age recipients or private identities, raw provider output, raw child output, or private absolute paths.

## Safety Rules

- Never run `sops decrypt` from this helper.
- Never run `sops exec-file`; this adapter is environment-only.
- Never run `sops edit`, `set`, `unset`, `publish`, `rotate`, or `updatekeys`.
- Never add `--ignore-mac`.
- Never print, log, diff, stage, or commit decrypted values or age identities.
- Never pass decrypted values as child arguments.
- Never treat secret access as permission for the child command's consequences.
- Reject plaintext files before execution.
- Restrict decryption order to age.
- Keep identity permissions owner-only on Unix systems.
- Prefer `--pristine` so the child receives the decrypted file's variables without inheriting unrelated environment state.

## Common Failures

- SOPS or age missing: install verified official binaries and rerun status.
- Identity missing: create or restore a private age identity outside source.
- Identity permissions too open: set owner-only permissions before use.
- `filestatus` reports plaintext: stop and encrypt the file before workflow use.
- Decryption fails: verify recipient/identity matching without printing either private material or decrypted data.
- Child command exits non-zero: report only safe failure metadata and suppressed byte counts.

## Upgrade Ideas

Add key rotation automation only after repeated real use proves the manual two-recipient procedure is insufficient. Do not add hosted providers, generic capability brokering, automatic cloud KMS adoption, decrypted-file output, or secret mutation without independent evidence and authority.
