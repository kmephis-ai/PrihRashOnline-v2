# Public Git history remediation plan

Roadmap item: `SEC-001`  
Scope: planning only; **no history rewrite is performed by this item**.

## Why this plan exists

Cleaning the current default-branch tree does not remove content from older Git objects, forks, clones, caches, or previously downloaded artifacts. Historical exposure must therefore be treated as potentially irreversible.

The public repository policy is stricter going forward: source code, documentation, CI evidence, and regression fixtures may contain only independently generated synthetic finance data. Raw, transformed, sampled, scaled, or aggregate household finance data remains private.

## Current-tree action

`SEC-001` removes known production-derived fixture content from the active tree and adds `privacy-public-data` as a required PR gate. This is reversible normal engineering work and does not mutate the user workbook.

## Historical inventory — non-destructive

Before any destructive action, create a private inventory that records only:

- commit SHA / ref;
- affected path;
- finding class (financial fixture, export, identifier, credential, runtime artifact);
- remediation status.

The inventory must **not** reproduce financial values, descriptions, categories, screenshots, or response bodies. History scanning should use repository-native secret scanning plus a separately pinned scanner when `SEC-002/SEC-003` establish the security and supply-chain baseline.

## Required checkpoint before rewrite

A history rewrite / force-push is an owner-policy gate because it changes public Git identity and can disrupt existing clones, pull requests, tags, release references, and downstream automation. Before approval:

1. create and verify an independent private mirror/backup of all refs;
2. record current default-branch and release/tag SHAs;
3. finish the private historical finding inventory;
4. identify any credentials that require rotation independently of content removal;
5. prepare collaborator/clone recovery instructions;
6. define success criteria for a full post-rewrite rescan.

## If rewrite is explicitly approved later

Use a dedicated maintenance work item, not a normal feature PR:

1. freeze normal writers temporarily;
2. rewrite only the confirmed paths/pattern classes using a reviewed history-filtering tool;
3. rescan **all refs** before publishing rewritten objects;
4. force-update refs in a coordinated maintenance window;
5. restore branch protections/rulesets and verify CI;
6. rotate any exposed credentials even if the rewritten history no longer contains them;
7. require fresh clones where appropriate;
8. record only PASS/FAIL and technical metadata publicly.

## Important limitation

History rewriting cannot revoke content already copied outside the repository. The purpose is to reduce ongoing exposure and prevent easy retrieval from repository history, not to claim that prior publication never occurred.

## Decision state

`SEC-001`: current-tree remediation + prevention gate.  
Historical rewrite: **NOT AUTHORIZED / NOT EXECUTED** until an explicit owner-policy decision after backup and inventory evidence.
