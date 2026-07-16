# Capability Adapter Evaluation

## Decision

The coding workflow library should use narrow provider adapters only when they satisfy an existing workflow contract. It should not import the Capability Intelligence catalogue, copy its discovered skills, add automatic skill installation, or build a generic capability broker or prefetch layer.

Capability Intelligence remains a separate inventory product. Its evidence is useful for discovering candidates and correcting assumptions, but its catalogue is not the coding workflow control plane.

## Question Evaluated

Does the current local skill and plugin inventory justify adding a capability broker or moving discovered resources into the coding workflow library?

Answer: no. One optional read-only GitHub provider is useful now, several authoring resources are useful as references, and the remaining candidates are overlapping, task-specific, unverified, or decision-gated.

## Evidence Reviewed

- The strict Capability Intelligence scan passed with 6,369 artifacts across 10 available source surfaces.
- The scan represented 736 skills, 180 plugin manifests, 7 installed plugin versions, 34 coding-workflow routes, and 111 unlabelled plugin manifests.
- The 111 records are plugin manifests without a standard capability label. They are not 111 ready-to-run skills.
- Installed plugin metadata still classified `enabled`, `authenticated`, `runnable`, and `verified` as unknown. Installation alone was not treated as runtime proof.
- A bounded read-only call through the installed GitHub plugin successfully returned safe repository metadata for the workflow library. This verifies only that repository-metadata read path in the current session; it does not verify every GitHub tool or any write path.
- The library already has bounded browser proof, GitHub auth/handoff/deep-review, skill validation, package/release preflight, and explicit authority gates.
- The built-in skill creator, plugin creator, skill installer, and installed GitHub plugin guidance were inspected directly.

The scan and adapter observation used no credential output, plugin installation, provider write, repository mutation, or Capability Intelligence source change.

## Selection Rules

An adapter belongs in the workflow only when all of these conditions hold:

1. It serves a concrete existing workflow state or repeated evidence gap.
2. Its output maps into the library's current evidence and blocker vocabulary.
3. Discovery, installation, enablement, authentication, runnability, and verification remain separate states.
4. Read and write consequences are explicit; provider availability never grants authority.
5. It has a deterministic fallback or a precise `BLOCKED_CAPABILITY` result.
6. It does not copy external instructions into the library as a second source of control truth.
7. It preserves portable operation when the provider is absent.

## Candidate Decisions

| Candidate | Decision | Reason |
|---|---|---|
| GitHub plugin repository and PR reads | Adopt as an optional provider | Structured reads align with GitHub triage and deep-review contracts. The repository-metadata path was observed successfully. Local `git` and `gh` remain valid fallbacks, and Actions logs may still require `gh`. |
| GitHub plugin write tools | Hold behind `remote_publication` | Tool availability does not authorise comments, reviews, branch changes, PR creation, reruns, merges, or repository writes. Existing handoff rules remain canonical. |
| `gh-address-comments` and `gh-fix-ci` | Reuse as advisory guidance | They contain useful thread and Actions inspection patterns, but overlap existing GitHub skills. Copying them would create conflicting routing and approval semantics. |
| `yeet` | Reject as a replacement workflow | Its broad publish sequence overlaps `github-handoff-skill`, exact-file staging, objective authority, and post-merge verification. Useful provider calls may be used through existing gates. |
| `skill-creator` | Adopt as an authoring reference | Progressive disclosure and bundled-resource guidance improve future skill work. Library frontmatter, route metadata, validators, and templates remain the package contract. |
| `plugin-creator` | Hold for a concrete plugin objective | Plugin scaffolding is not required by the current CLI/library distribution. Creating a plugin now would add another distribution surface without a proven user need. |
| `skill-installer` and `find-skills` | Reject for automatic acquisition | Network installation, provenance, version drift, instruction trust, and destination mutation require a separate intake contract. They may be used manually only for an explicit installation objective. |
| `verification`, `investigation-mode`, `track-findings`, and `triage-finding` catalogue skills | Hold | They are catalogue discoveries rather than verified local runtime dependencies and overlap existing evidence, error, security, and orchestration skills. |
| Figma and HyperFrames stacks | Keep task-specific | They are valuable for design and media objectives, not core autonomous coding control. Load them only when the selected product task requires them. |
| Secret-manager adapter | `BLOCKED_DECISION` | A non-printing identity, scope, provider, retrieval, injection, expiry, audit, and revocation contract has not been selected. |
| Generic capability broker or prefetch | Reject for the current roadmap | Current adapters can be selected directly. A broker would recreate Capability Intelligence inside the workflow library and add routing complexity before repeated adapter insufficiency is proven. |

## Optional Provider Contract

Provider use is subordinate to the selected workflow skill and route:

1. Select the workflow from repository state, objective authority, and route metadata.
2. Prefer the workflow's deterministic local helper when it provides the required evidence.
3. Use an available provider for a bounded missing read only when its result maps to the same evidence contract.
4. Record the exact provider surface observed. Do not promote one successful call into proof of the whole plugin.
5. Classify unavailable or unauthenticated providers as `BLOCKED_CAPABILITY`, not as permission requests.
6. Require the existing consequence authority before any provider write.
7. Fall back to local `git`, `gh`, or another documented helper only when that fallback preserves scope and redaction.

## GitHub Adapter Boundary

The GitHub plugin may provide repository, issue, pull-request, patch, comment, review, and workflow metadata reads when available. The library's `github-auth-gate-skill`, `github-deep-review-skill`, and `github-handoff-skill` continue to own classification, redaction, exact-file scope, check interpretation, and write authority.

The observed repository read proves only:

- the plugin was callable in this session;
- it could read safe metadata for the selected public repository;
- it returned the expected repository identity, default branch, and visibility classification.

It does not prove connector reliability, all repository access, Actions log coverage, comment/thread completeness, write permission, merge safety, deployment state, or production state.

## Stop Conditions

Stop adapter expansion when any of these occur:

- the proposal mainly adds catalogue, search, ranking, or discovery behavior;
- it duplicates an active skill or route without a proven evidence gap;
- it makes an installed capability appear authenticated, runnable, or verified;
- it requires automatic installation, secret retrieval, provider writes, or open-ended network access without a separate objective;
- it weakens exact-file staging, authority inheritance, redaction, or not-verified classifications;
- it makes the library dependent on one Codex host or plugin cache.

## Result

Capability adapter evaluation is complete. The library should keep direct, workflow-owned adapters, recognise the GitHub plugin as an optional read provider, and retain task-specific skills as task-specific. No capability broker, prefetch layer, automatic installer, plugin distribution, secret adapter, or bulk skill cutover is justified now.

The next automatic work remains maintenance of the proven workflow foundations. A future adapter should enter the queue only after a real workflow records repeated `BLOCKED_CAPABILITY` evidence that existing helpers and fallbacks cannot resolve.
