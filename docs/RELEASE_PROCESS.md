# Release Process

## Goal

Keep development comfortable from chat while preventing long-lived branch divergence, stale deployments and multi-hour release recovery.

## Branch model

1. `main` is the only long-lived source-of-truth branch.
2. Development happens in short-lived `agent/<block>` branches.
3. Feature PRs run `PR Validation` only; they do not deploy Apps Script.
4. When a block is ready to release, create a fresh snapshot branch from the current `main`:
   `agent/release/<version>`.
5. The release snapshot should contain the final product tree in 1–3 commits; the hard pipeline limit is 10 commits.
6. Only `agent/release/**` branches may execute DEV deployment and automatic merge.
7. After a release is merged, obsolete source branches/PRs are closed instead of being reused.

## Release preflight

Before installing dependencies or running Playwright, `Chat-Driven DEV Release` verifies:

- branch name is `agent/release/**`;
- an open PR to `main` exists;
- checked-out SHA equals the PR head;
- current `main` is an ancestor of the release candidate;
- the release branch contains no more than 10 commits after `main`.

If `main` moved after the release snapshot was created, the workflow fails in seconds with an instruction to rebuild the snapshot. It does not spend time on browser tests or Apps Script deployment for a stale candidate.

## Two gates

### PR Validation

Runs on ordinary pull requests:

- idempotent dashboard preparation;
- all contract tests;
- Playwright desktop/laptop/mobile;
- artifacts.

No deployment secrets are needed and no Apps Script deployment occurs.

### DEV Release

Runs only for `agent/release/**`:

1. fast history/preflight checks;
2. contract tests;
3. Playwright;
4. `clasp push --force`;
5. create/update the stable DEV Web App deployment;
6. verify PR head did not move;
7. merge with the validated SHA;
8. update the stable Dashboard link on `main` after merge.

## Dashboard URL

The Apps Script deployment is reused by description `PrihRashOnline Web Dashboard DEV`, so its `/exec` URL is stable across updates. README is updated only after a successful merge. The release workflow never changes the PR head merely to publish the URL.

## Safety

- no cron/scheduled development loops;
- no WSL or self-hosted runner dependency;
- no automatic financial-operation writes;
- `01 Операции` remains protected by service-level contracts;
- PROD is a separate explicit decision;
- any uncertainty is fail-closed.

## Operational rule for ChatGPT

After the user says `делай далее`, finish the agreed block on a short-lived branch. Before deployment, rebuild the result as a fresh release snapshot from the current `main`; never keep extending an old release PR across multiple blocks.
