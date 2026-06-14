# Coding Workflow Library Repo Split Plan

## Purpose

Create a separate private repository for the autonomous coding workflow library so its runbooks, skills, scripts, ledger patterns, and handoff procedures can evolve independently from product repos.

## Why This Must Be Separate From OpsTruth

OpsTruth is the public proof product: a local, read-only operational truth checker for AI-assisted engineering. The workflow library is the internal operating loop that decides when to inspect, validate, commit, push, open PRs, and stop at permission gates.

Keeping them separate prevents private workflow notes, local run logs, and repo-operation habits from becoming part of the public OpsTruth product surface.

## Why This Must Be Separate From Wagging Web Wins

Wagging Web Wins is a real website/app and validation target. It should contain app code, app docs, and app evidence only. The workflow library should not be mixed into that repo because it is a reusable local automation system, not part of the website/app.

## Source Directory

```text
/home/johnh/.openclaw/skills/coding-workflow-library
```

## Proposed Repo Name

```text
coding-workflow-library
```

## Proposed Visibility

```text
private
```

The first remote must be private unless John explicitly approves a different visibility.

## Files To Include

- `AGENTS.md`
- `README.md`
- `RUNBOOK.md`
- `tools.md`
- `tool-patterns.md`
- `command-library.md`
- `evidence-checklist.md`
- `skills-index.md`
- `build-queue.md`
- `work-ledger.md`
- `runs/`
- `scripts/`
- `skill-files/`
- `templates/`
- `tests/`
- `docs/`
- `.gitignore`

## Files To Exclude

- `.env`
- `.env.*`
- token files
- logs
- temporary files
- caches
- `node_modules/`
- `dist/`
- `build/`
- `.wrangler/`
- `supabase/.temp/`
- `evidence/private/`
- `vendor-intake/` snapshots unless explicitly approved
- target repo checkouts
- generated archives or tarballs

## Secret Handling Rules

- Never commit runtime env files.
- Never print, echo, count, infer, or expose token values.
- Secret variable names may appear in docs when needed.
- Real token-looking values must block the first push.
- Ledger entries must describe credential state without recording credential values.
- Use local runtime env files only for execution, never as source files.

## Validation Required Before First Push

- `./scripts/validate-skills`
- Secret-pattern scan over the workflow library excluding `.git`, caches, logs, and temporary files.
- Review `git status --short`.
- Review `git diff --cached --stat`.
- Review `git diff --cached --name-only`.
- Confirm no `.env`, token, log, cache, build output, or private evidence file is staged.

## First Push Plan

1. Initialize a local git repo only after validation and secret scan pass.
2. Create a private GitHub repo named `coding-workflow-library`.
3. Add the private remote.
4. Push the initial branch only after confirming the remote visibility is private.
5. Do not connect this repo to OpsTruth or Wagging Web Wins as a submodule unless that relationship is explicitly approved later.

## Future Relationship To OpsTruth

The workflow system is the internal operating loop. OpsTruth is the public proof product. Wagging Web Wins is a real project and validation target.

The workflow system can use OpsTruth as a completion/proof gate. OpsTruth case studies can use evidence from workflow runs, but the repositories must remain separate.
