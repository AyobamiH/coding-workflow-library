# Interrupted Run Resume

## Problem

Long multi-lane runs can be interrupted by usage limits, terminal shutdowns, or process failures. John should not need to reconstruct a large manual prompt just to learn where `run-next` stopped.

## Checkpoint Model

Real `run-next` executions write safe metadata into `.run-next/`, which is ignored by git. Each run records:

- run id
- target repo
- branch
- selected skill/job
- current phase
- checkpoint names and statuses
- permission flags
- required permission
- last verified commit
- stop reason

The checkpoint file never stores secret values, environment values, raw command output bodies, or private credential text.

## Status Command

```bash
./scripts/run-next --repo /path/to/repo --status
```

The status command reports the latest checkpoint for the target repo, including completed checkpoints, the next incomplete checkpoint, stop reason, and a recommended resume command.

## Dry-Run Resume

```bash
./scripts/run-next --repo /path/to/repo --resume --dry-run
```

Dry-run resume locates the latest incomplete run, inspects current Git state, checks the branch, checks tracked changes, checks required permission, and explains what would resume. It makes no file changes.

## Real Resume

```bash
./scripts/run-next --repo /path/to/repo --resume --allow <permission>
```

The first implementation only completes checkpoints that can be completed without replaying a potentially mutating execution step. If the first incomplete checkpoint might represent an in-flight operation, `run-next` stops and asks for route-specific approval instead of guessing.

## Safety Checks

Resume stops when:

- the repo path is missing
- the target branch changed
- tracked files changed since the checkpoint
- required permission is absent
- checkpoint state is missing or invalid
- the resume action could replay a completed mutation

## Git And Remote Verification

The checkpoint records the last verified commit. Resume compares the current commit before deciding whether the run is already represented in Git state. Remote alignment remains a separate final validation command because network access may be unavailable in some execution sandboxes.

## Permission Boundaries

A checkpoint proves where a run stopped. It does not grant permission. Existing `--allow` flags remain required.

## Secret Handling

Checkpoint files must not contain:

- secret values
- environment values
- raw tokens
- private command output
- full logs from secret-bearing commands

Tests scan simulated checkpoint state for common token-shaped strings.

## Examples

```bash
./scripts/run-next --repo /home/johnh/wagging-web-wins --status
./scripts/run-next --repo /home/johnh/wagging-web-wins --resume --dry-run
./scripts/run-next --repo /home/johnh/wagging-web-wins --resume --allow scheduled-run-monitoring-handoff
```

## Failure And Stop Conditions

The correct resume behavior is sometimes to stop. A safe stop includes the run id, phase, next incomplete checkpoint, missing permission or changed-state reason, and the next command John can approve.
