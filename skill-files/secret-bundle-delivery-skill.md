---
name: secret-bundle-delivery-skill
description: Migrate a plaintext dotenv surface into purpose-scoped SOPS age bundles, map bundles to explicit consumer profiles, prove non-printing delivery, and retire the source only after complete coverage.
category: security
routing_triggers:
  - modular encrypted secret bundles
  - dotenv migration
  - purpose scoped credential delivery
  - OpenClaw SOPS SecretRef resolver
status: active
---
# Secret Bundle Delivery Skill

## Purpose

Use `scripts/secret-bundles` above the narrow `sops-age-secret-access` adapter when one dotenv file contains credentials for several unrelated consumers. The helper inventories names without values, enforces exact source coverage, creates one encrypted JSON bundle per purpose, restricts each delivery profile to named command basenames, and proves every runtime variable through an output-suppressed child.

This is a manifest-driven delivery layer, not a general capability broker. Secret access never grants publication, deployment, database, provider-write, or production authority to the child command.

## When to Use

Use when one dotenv source contains credentials for several unrelated consumers, when runtime variable aliases differ from storage names, when an exact consumer allowlist is needed, or when plaintext retirement needs evidence stronger than file encryption alone.

Keep using `sops-age-secret-access-skill` for one already encrypted file and one child. Do not use this skill to copy values between hosted providers, print credentials, infer a consumer's mutation authority, or create a generic capability broker.

## Inputs Required

- Private manifest path based on `templates/secret-bundles.example.json`.
- Plaintext source path for inventory, migration, or retirement.
- Exact expected source-variable names.
- Purpose bundle ids, encrypted output paths, source names, and runtime names.
- Delivery profile ids and exact allowed command basenames.
- SOPS policy and owner-only age identity outside source.
- Explicit secret-mutation, secret-access, or destructive authority for the selected operation.

## Procedure

1. Keep the real manifest and encrypted files outside source with owner-only permissions.
2. Copy `templates/secret-bundles.example.json` and map every source name exactly once.
3. Record neutral consumer labels and exact command allowlists.
4. Run `inventory`; resolve every missing or unexpected mapping.
5. Run `migrate --allow-secret-mutation`; plaintext values travel from memory to SOPS stdin and are never written as bundle files.
6. Run `validate` and `prove --allow-secret-access`.
7. Dry-run each real profile before running a separately authorised child.
8. For OpenClaw, enable only a designated `openclaw_resolver` profile and use the exec SecretRef protocol over a private pipe.
9. Run `retire-source` only after coverage, encryption validation, and delivery proof all pass in the same operation.

## Commands

```bash
coding-workflow secret-bundles inventory \
  --manifest <PRIVATE_MANIFEST> \
  --env-file <PLAINTEXT_SOURCE> \
  --repo app=<TARGET_REPO>

coding-workflow secret-bundles migrate \
  --manifest <PRIVATE_MANIFEST> \
  --env-file <PLAINTEXT_SOURCE> \
  --allow-secret-mutation

coding-workflow secret-bundles prove \
  --manifest <PRIVATE_MANIFEST> \
  --allow-secret-access

coding-workflow secret-bundles run \
  --manifest <PRIVATE_MANIFEST> \
  --profile <PROFILE_ID> \
  --dry-run -- command arg
```

## Evidence Required

- Source variable names and a name-only fingerprint.
- Complete one-to-one source coverage.
- Bundle ids, encrypted basenames, variable counts, and owner-only permissions.
- SOPS encrypted-file status for every bundle.
- Output-suppressed delivery proof for every runtime name.
- Exact selected profile and child command basename.
- Plaintext source removal result, when separately approved.
- Explicit confirmation that values, private identities, child output, and private paths were not emitted.

## Safety Rules

Stop when coverage is incomplete, a source value is empty, a bundle already exists without explicit replacement, an encrypted file fails MAC/status checks, a command is outside the profile allowlist, resolver stdout is a terminal, delivery proof fails, or required authority is absent.

Never print decrypted values, place values in arguments, write plaintext temporary bundles, commit private manifests or ciphertext, broaden a command allowlist to bypass a failure, or delete the plaintext source before same-run validation and delivery proof pass.

## Common Failures

- `SOURCE_COVERAGE_INCOMPLETE`: reconcile expected, source, and mapped names before migration.
- `BUNDLE_ALREADY_EXISTS`: validate the existing bundle; use explicit replacement only for an intentional re-encryption.
- `COMMAND_NOT_ALLOWED`: select the correct profile or document a real consumer before changing the allowlist.
- `ENCRYPTED_FILE_INVALID`: stop; verify SOPS policy, identity matching, and file integrity without terminal decryption.
- `RESOLVER_TTY_REFUSED`: connect the resolver through a private pipe, never an interactive terminal.
- Child failure: report only exit metadata; investigate the child without relaying captured output.

## Output Format

Report operation and `PASS`, `FAIL`, `BLOCKED_PERMISSION`, or `BLOCKED_CAPABILITY`; name-only coverage counts; bundle ids and encrypted basenames; owner-only and SOPS status; profile id and child basename; proof or retirement result; non-emission guarantees; safe finding codes; and one bounded next action. Never include values, recipients, identity contents, private absolute paths, provider output, or child output.

## Upgrade Ideas

Add a new purpose profile only after a real consumer proves the need. Keep provider-specific probes separate from the manifest core. Do not add automatic provider writes, broad process launch, hosted subscription dependencies, generic brokering, or secret prefetch without repeated evidence and a separate authority model.
