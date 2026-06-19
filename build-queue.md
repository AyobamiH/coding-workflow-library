# Immediate

## GitHub open-source handoff

- Why it matters: the package/CLI candidate has passed local smoke tests and now needs a public source handoff without conflating that with npm publication.
- Evidence from current files/logs: package candidate `autonomous-coding-workflow-library`, CLI `coding-workflow`, MIT license, `package-lock.json`, route audit, package smoke, and validation have passed locally; `routes/skill-routes.json` now owns `github-open-source-handoff`.
- Permission boundary: exact-file commit, public GitHub repo creation/verification, one non-force `main` push, and remote HEAD verification only; no npm publish, versioning, tags, GitHub release, deploy, Supabase, Cloudflare, production endpoints, secret printing, broad staging, or excluded-file staging.
- Done definition: `AyobamiH/coding-workflow-library` exists publicly, local validation passes, exact-file commit exists, `main` is pushed, remote HEAD matches local HEAD, and ledger/log record `GitHub open-source handoff complete`.

## CLI entrypoint package smoke

- Why it matters: John selected `coding-workflow` as the CLI command, so the package candidate needs to prove the wrapper, package `bin` metadata, clean-temp local install, and installed CLI behavior before any publish path is considered.
- Evidence from current files/logs: `package.json` declares candidate package `autonomous-coding-workflow-library`; `bin/coding-workflow.js` exists; `scripts/run-next` supports `--allow cli-package-smoke`; `routes/skill-routes.json` contains `cli-entrypoint-package-smoke`; the active ledger state is `Package candidate dry-run complete`.
- Permission boundary: local skills-library edits, package readiness, release preflight CLI mode, `npm pack --dry-run`, local temp tarball install, and validation only; no product repo edits, publish, version, tag, push, PR, GitHub release, deploy, Supabase, Cloudflare, secret reads, production endpoints, registry mutation, remote dependency install, or remote mutation.
- Done definition: CLI wrapper syntax, local CLI help/routes/package-readiness/release-preflight, package readiness with `--expect-cli`, release preflight CLI mode, npm pack dry-run, clean-temp local tarball install, installed CLI help/routes/validate, package content inspection, ledger update, and run-log update all pass locally.

## NPM package name ownership confirmation

- Why it matters: `autonomous-coding-workflow-library` is the local candidate name, but publishing still requires John to verify registry availability and ownership.
- Evidence from current files/logs: `package.json` now uses `autonomous-coding-workflow-library`; `LICENSE-DECISION.md` records the blocker as final name availability and ownership before publish.
- Permission boundary: planning and optional read-only registry name check only when approved; no npm auth, publish, version, tag, push, GitHub release, registry mutation, or package distribution without explicit approval.
- Done definition: John confirms availability/ownership or chooses a different package name/source-only path.

## Scheduled-run recheck option

- Why it matters: the previous Supabase production lane stopped with deployment/runtime gates separated from this local packaging lane.
- Evidence from current files/logs: `work-ledger.md` has Supabase scheduler/function states, runtime verification skills exist, and current local packaging work must not drift back into product repos without a fresh permission gate.
- Permission boundary: hold unless John explicitly selects the target repo, selected skill, and runtime/database/cloud permission.
- Done definition: if selected, the runner resumes from the recorded ledger state with the exact allowed flag and does not combine it with packaging/release work.

# Next

## NPM package publish readiness

- Why it matters: npm package readiness and release preflight exist, and the library now has a named local package candidate and CLI entrypoint, but no publish path is approved.
- Evidence from current files/logs: `npm-package-readiness-skill.md`, `release-preflight-skill.md`, `scripts/npm-package-readiness`, `scripts/release-preflight`, route metadata, `package.json`, and `bin/coding-workflow.js` cover local package/CLI readiness.
- Permission boundary: local readiness by default; package manifest edits, dependency installs, registry reads, `npm pack --dry-run`, publish, version changes, tags, pushes, and GitHub releases require separate gates.
- Done definition: package name ownership is confirmed, package contents are controlled, lockfile/CLI evidence remains current, local preflight evidence passes, and no publish-like side effects occur.

## Release preflight hardening

- Why it matters: release preflight should remain reliable across local library, open-source source drop, npm package, and CLI package modes.
- Evidence from current files/logs: `scripts/release-preflight` supports local/npm/CLI modes; clean-temp smoke exercises local mode from a copied library.
- Permission boundary: local validation unless John authorizes network, registry, pack dry-run, publish, tag, push, release, or deploy gates.
- Done definition: preflight reports stable local, npm, and CLI classifications and clearly separates blockers from release approval.

## Opstruth runtime truth self-test

- Why it matters: runtime truth should classify evidence without overclaiming skipped or not-verified checks.
- Evidence from current files/logs: `opstruth-runtime-truth-skill.md` exists, but a local mixed-evidence self-test is still pending.
- Permission boundary: local parsing or approved local CLI execution only; network, browser, package publish, deploy, and external mutation require separate gates.
- Done definition: a self-test classifies a mixed evidence report into `Verified`, `Warning`, `Failure`, `Skipped`, and `Not Verified`, then recommends the next safe step.

## Cloudflare real deploy proof

- Why it matters: Cloudflare deployment needs target-specific evidence before any deployed-state claim.
- Evidence from current files/logs: `cloudflare-deploy-skill.md` is hardened for Pages/Workers planning, but no live Wrangler deploy proof has been run in this library.
- Permission boundary: source inspection and planning only until John supplies a Cloudflare target and explicit preview or production deploy approval.
- Done definition: a real Cloudflare run captures discovered commands, env/secret-name handling without values, deploy output, rollback notes, logs, and post-deploy proof.

# Later

## Repo-map, route-trace, and KB helpers

- Why it matters: repo orientation, route tracing, and project memory are reusable but still mostly Markdown-driven.
- Evidence from current files/logs: `repo-map-skill.md`, `route-trace-skill.md`, and `project-kb-builder-skill.md` exist.
- Permission boundary: local inspection and local docs only unless a target repo edit is explicitly approved.
- Done definition: small helpers produce repo maps, route traces, and project memory updates with redaction and validation.

## Migration review automation

- Why it matters: source-only migration review is reusable beyond Supabase scheduler work.
- Evidence from current files/logs: `migration-review-skill.md` exists, and scheduler migration work proved secret-safety and source-versus-deployed-state concerns.
- Permission boundary: source-only by default; SQL execution, `db push`, migration apply, and deployed-state verification require separate gates.
- Done definition: a helper inventories migration files, flags destructive changes, secret hardcoding, deploy ambiguity, rollback gaps, and source-only limits.

## Browser live proof

- Why it matters: user-facing behavior sometimes needs browser evidence after build/source checks.
- Evidence from current files/logs: `runtime-verification-skill.md` and `opstruth-runtime-truth-skill.md` exist, but generic browser-live proof is not yet packaged here.
- Permission boundary: local browser or read-only public checks first; logged-in or mutating browser actions require separate approval.
- Done definition: a skill defines browser checks, screenshots, console/network evidence, mutation boundaries, and final proof language.

## Deep GitHub review

- Why it matters: PR lifecycle handles files/checks/mergeability, but not full review-thread triage.
- Evidence from current files/logs: GitHub handoff is hardened; review comment resolution is still outside the local skill set.
- Permission boundary: read-only PR/review inspection by default; replies, resolutions, commits, and merges require separate gates.
- Done definition: a skill inspects review threads, requested changes, check logs, and patch scope without mutating remote state by default.

# Hold

## OneClickPostFactory / Devvit / Reddit lane

- Why it matters: Reddit-related work in this library came from one Supabase content import feature and should not become a Devvit lane by accident.
- Evidence from current files/logs: the proven Reddit work is centered on `import-reddit-tips`; no OneClickPostFactory or Devvit target repo is currently selected.
- Permission boundary: hold until John supplies a target repo, platform rules, commands, and a concrete goal.
- Done definition: resume only with explicit repo, selected platform, safety requirements, and permission gates.

## HyperFrames/video workflow support

- Why it matters: HyperFrames skills exist elsewhere, but this coding workflow library has not imported or wrapped them.
- Evidence from current files/logs: no local `skill-files/` entry or route metadata owns HyperFrames/video work.
- Permission boundary: hold unless John asks to integrate HyperFrames workflows here.
- Done definition: decide whether to reference external HyperFrames skills or create local workflow wrappers.

## One-password secret access

- Why it matters: secret-manager integration is powerful and high-risk.
- Evidence from current files/logs: secret handling rules exist, but no safe manager integration is proven.
- Permission boundary: no secret-manager integration until John approves the tool, account scope, and non-printing behavior.
- Done definition: a credential presence workflow exists that never prints values and only exports values into approved local runtime contexts.

## Live product/deploy work until selected

- Why it matters: this run is local skills-library work and must not drift back into a product lane.
- Evidence from current files/logs: recent work spent many runs in `/home/johnh/wagging-web-wins`; current clean-temp smoke is local-only.
- Permission boundary: hold product repo edits, Supabase, Cloudflare, GitHub mutations, npm publish, production endpoints, and remote service mutation until selected.
- Done definition: resume only with a new explicit target repo, selected skill, and exact permission gate.
