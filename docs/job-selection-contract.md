# Job Selection Contract

## Inputs

- target repo path from `--repo`
- `work-ledger.md`
- skill frontmatter
- `skills-index.md`
- supplied `--allow` flags
- mode: real, `--dry-run`, or `--explain`

## Ledger States

The runner selects the latest ledger item whose `Active repo` exactly matches the requested repo. If none exists, it returns `No ledger item for repo` and stops safely.

## Skill Eligibility

A skill is eligible when its frontmatter or routing docs match the current ledger status and its safety rules cover the requested step.

## Permission Flags

The route's `requires_permission` value must match one supplied `--allow` flag before real execution. Missing permission produces a decision brief and a next approval command.

## Priority Rules

1. Exact target repo ledger item.
2. Current ledger status.
3. Implemented `scripts/run-next` route.
4. Skill frontmatter.
5. `skills-index.md` and `RUNBOOK.md` fallback.
6. Human boundary if still ambiguous.

## Safety Rules

- Never print secrets.
- Never mutate production without explicit permission.
- Never deploy without explicit permission.
- Never run database writes without explicit permission.
- Never merge PRs without explicit permission.
- Never publish npm or create releases without explicit permission.
- Never borrow another repo's ledger state.
- Never let dry-run or explain modes mutate files.

## Execution Rules

Real execution runs one bounded job. Dry-run and explain modes only report what would happen.

## Evidence Rules

The output must include detected repo, current ledger state, selected skill/job, required permission, whether it can run now, why it stopped, and the next command if approval is required.

## Stop Rules

Stop immediately when a required permission is absent, a secret value is found, a repo state is unexpected, a route is unknown, a credential check fails, or the next action crosses a deploy/database/production/release boundary.

## Output Contract

Every run reports mode, target repo, ledger item, current status, selected skill, required permission, can-run-now status, final status, summary, actions, evidence, and next permission or command when needed.
