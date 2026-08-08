# CI-003 — Fully autonomous merge loop

## Purpose

CI-003 removes ordinary human merge/marker/snapshot gates while preserving fail-closed trust boundaries. A Roadmap PR may merge automatically only after the exact immutable candidate passes public-safe PR validation, trusted DEV promotion, and authenticated exact-build runtime health.

## Eligibility

A PR is autonomous-merge eligible only when all of the following are true:

- the PR originates from this repository and targets `main`;
- the PR is open, non-draft, and its current head equals the validated candidate SHA;
- its body contains exactly one standalone `Closes #<issue>` line;
- that Issue is open, contains a machine task packet with `roadmap_id`, and has exactly one `status: IN_PROGRESS` line;
- latest `trusted-dev-deploy` and `trusted-runtime-health` statuses on the exact candidate are `success`.

A PR without a qualifying `Closes` link is not merged automatically. It remains a normal manually controlled PR; CI-003 does not reinterpret `Refs` as merge consent.

## Merge

The trusted default-branch `Trusted Runtime Health` workflow owns merge eligibility. After authenticated runtime health passes it re-resolves the PR and exact head SHA, rechecks trusted statuses, and calls the GitHub merge API with:

- `merge_method=squash`;
- `sha=<exact candidate SHA>`.

The SHA match makes the merge atomic with respect to PR-head changes. If the head moves or any prerequisite is stale, the workflow fails closed.

The workflow never uses `--admin`, never performs `git push`, and never writes README/docs directly after merge.

## Main verification and Issue close

After a successful squash merge, the trusted runtime workflow emits a technical `repository_dispatch` event `ci003-main-verification`. The dispatch contains only PR number, Issue number, exact candidate SHA, and merge SHA.

`Main Verification` is secret-free. It verifies:

- the PR was merged by `github-actions[bot]`;
- the merge commit corresponds to the dispatched PR and remains on `main`;
- the PR head is the dispatched exact candidate SHA;
- source candidate statuses `trusted-dev-deploy`, `trusted-runtime-health`, and `autonomous-merge` are green;
- the PR still links exactly one qualifying in-progress Roadmap Issue.

Only after those checks pass does Main Verification replace `status: IN_PROGRESS` with `status: DONE`, append technical merge evidence, and close the Issue as completed.

## Deliberately removed gates

The autonomous surface does not use release-branch skips, commit-count thresholds, release snapshots, manual markers, post-merge direct commits, or admin bypasses. PR Validation applies to every branch targeting `main` that changes a watched path.

## Privacy and cost

Public evidence is limited to PR/Issue numbers, exact commit hashes, and technical PASS/FAIL reason codes. OAuth material and financial payloads are never emitted. Required automation uses GitHub Actions and the existing private Apps Script DEV environment; no paid service is required.

## Live proof

The implementation PR is installed manually because the autonomous workflow cannot govern itself before it exists on `main`. A follow-up canary PR linked with `Closes #<CI-003 Issue>` must then be merged by the new loop and have the Issue closed by Main Verification. CI-003 is not DONE until that live proof succeeds.

### Live canary

This documentation-only change is the CI-003 live canary. Its PR is intentionally eligible for the autonomous loop; GitHub machine state for the exact candidate, autonomous squash merge, main verification, and linked Issue closure is the authoritative proof.

### Final live canary after reliability hardening

This second documentation-only canary validates the complete default-branch implementation after Main Verification YAML registration was repaired and trusted Apps Script promotion was changed to one explicit immutable version shared by the stable Web App and API Executable. No manual merge or manual Issue closure is valid evidence for this canary.
