# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, owner-private mapper/snapshot/state/diagnostic/repair/execution payload здесь запрещены.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **каноническая Executable GitHub Roadmap v2.3**.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Architecture/ADR/operations docs.

Chat history/memory и stale Roadmap copies not authority. При явном предоставлении `Master Audit v2.1` и `AI Development Playbook v1.0` действует precedence из `AGENTS.md`.

## Current R0 truth

R0 machine-proven complete. `MASTER-G0`, `MASTER-G1`, `MASTER-G2` закрыты. AIENG chain: `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

## Current R1 truth

- `FIN-010` — DONE.
- `DATA-010` — DONE.
- `ARCH-010` — DONE, Issue #89 Main Verification PASS.
- `ARCH-011` — previous current writer, Issue #91; now DONE after Main Verification PASS.
- `MIG-010` — current P0 writer, Issue #96, draft PR #97; owner-private stage = `AUTHORIZATION_REQUIRED`.

`PRH_TRANSACTION_REPOSITORY_V1` — storage-neutral repository port. Generic Google adapter read/query работает, canonical write остаётся fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

`PRH_FULL_HISTORY_MIGRATION_V1` — deterministic migration protocol: dry-run, <=100 batches, idempotency, expected revision, HMAC resume, DR-001 backup binding, private reconciliation, irreversible-action gate.

`MIG010_REPAIR_POLICY_V1@1.1.0` + `REBUILD_LEGACY_SLICE_V1`: scoped legacy target rebuild from source, invalid source explained quarantine, duplicate semantics only owner decision. Owner-confirmed `PRESERVE_ALL` uses `CONTENT_FINGERPRINT_OCCURRENCE_V1`; CI/AI cannot decide duplicate financial semantics.

`PRH_CANONICAL_TRANSACTION_V1` remains schema version 1 and supports `EXTERNAL_ID`, `CONTENT_FINGERPRINT_V1`, `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Occurrence strategy keeps content fingerprint unchanged while owner-confirmed real occurrences receive deterministic distinct source/transaction identities.

## Owner-private checkpoint

Privacy-safe stage evidence:

- encrypted-backup snapshot — created;
- initial full-history dry-run — fail-closed `BLOCKED`, legacy anomalies identified;
- private diagnostics — complete;
- duplicate semantics — resolved by owner-private offline review;
- repair resolve — `READY_FOR_REBUILD_DRY_RUN`, no remaining repair blockers;
- independent resolved rebuild dry-run — `PASS`, `reconciliationReady=true`;
- current `writeAuthorized=false`;
- real migration batches — **not executed**.

Counts/details, financial payload, owner resolution contents and private hashes stay private.

## Pre-authorization execution layer

`MIG010_EXECUTION_POLICY_V1@1.0.0` uses `STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1`.

- `tools/mig010-execution-package.js` builds an owner-private exact package from encrypted backup + resolved candidate. It preserves target rows outside migrating legacy scope, creates batches <=100 and has no write command.
- `tools/mig010-authorized-executor.js request` verifies encrypted backup again and creates `MIG010_OWNER_AUTHORIZATION_REQUEST_V1` with `writeAuthorized=false`.
- `Mig010ExecutionGateway.js` is a separate migration-specific Apps Script boundary. Generic ARCH-011 repository write authority remains false.
- Gateway begin validates exact live raw-table hash, then creates hidden rollback copy + hidden staging while live target remains unchanged.
- Staging batches are sequential/idempotent, <=100 and require write/readback hash parity.
- Finalize is allowed only after full staging hash + live no-drift checks. Any finalize failure restores rollback and verifies initial hash.
- Successful finalize status is `FINALIZED_PENDING_RECONCILIATION`, never `DONE`.
- `tools/mig010-post-reconcile.js` requires a new encrypted backup after finalize and independently proves source revision + resolved candidate + candidate revision + final raw target hash, `unexplainedMismatch=0`, idempotent rerun.

Owner authorization is a separate private schema `MIG010_OWNER_IRREVERSIBLE_AUTHORIZATION_V1`. It is valid only with literal `IRREVERSIBLE_ACTION_AUTHORIZED`, exact request/package bindings and fresh backup verification <=24h. GitHub Actions, merge and AI-agent cannot create it.

## Current delivery

```text
Roadmap Issue IN_PROGRESS
-> agent/<ID>-<slug> PR to main
-> PR Validation
-> immutable exact candidate
-> Trusted DEV Deploy
-> Trusted Runtime Health + Web App render smoke v2
-> CI-003 autonomous squash merge
-> Main Verification -> Issue DONE/closed
```

For MIG-010 the PR intentionally remains draft until actual owner-private migration + post-write reconciliation are complete. Code readiness alone must not close Issue #96.

После INC-001 Web Dashboard использует raw `HtmlOutput` placeholder injection; authenticated Web App render smoke v2 обязателен для runtime health.

## Executable continuation protocol

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` выбирают/продолжают ровно один dependency-ready writer. Multiple writers, missing dependencies или private context fail closed.

## Read-only multi-AI review

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers всегда `READ_ONLY`, `writer_authority: false`; P0/P1 block review evidence, P2/P3 advisory. Review supplementary и не отменяет machine gates/Main Verification.

## Privacy / financial / cost boundaries

Real or real-derived household finance data must stay private. Public finance fixtures — independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys, migration mapper/snapshot/state/diagnostic/proposal/review/resolution/resolved/execution-package/authorization stay private.

Full-history migration is not complete. Rebuild PASS, execution package, authorization request, code merge или CI не являются real-write authorization. New canonical mutation требует exact preconditions, readback, reconciliation, rollback and explicit owner irreversible-action authorization. `FREE_ONLY` обязателен.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`, integer minor units, posted-only, transfer-neutral, refund as expense reduction, mixed-currency fail-closed.

DATA-010: `PRH_CANONICAL_TRANSACTION_V1`; `source_position` mutable locator, not identity. DATA-001 compatibility uses `CONTENT_FINGERPRINT_V1`; owner-confirmed identical real operations use `CONTENT_FINGERPRINT_OCCURRENCE_V1` without modifying financial fields for uniqueness.

ARCH-010: `PRH_APPLICATION_CORE_V1`; `io_authority=false`, `financial_write_authority=false`, `network_authority=false`.

ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; generic Google mutation remains blocked. MIG-010 execution gateway is a separate policy-gated migration path and does not grant generic repository authority.

## MIG-010 irreversible boundary

```text
CODE_READY
-> OWNER_PRIVATE_SNAPSHOT
-> OWNER_DRY_RUN
     -> BLOCKED -> OWNER_PRIVATE_DIAGNOSTICS -> REPAIR_PROPOSAL
          -> DUPLICATE_OWNER_REVIEW
          -> REPAIR_RESOLVE
          -> RESOLVED_REBUILD_DRY_RUN = PASS
-> EXECUTION_PACKAGE
-> AUTHORIZATION_REQUEST
-> AUTHORIZATION_REQUIRED
-> owner IRREVERSIBLE_ACTION_AUTHORIZED only
-> STAGING + READBACK
-> FINALIZED_PENDING_RECONCILIATION
-> FRESH ENCRYPTED BACKUP
-> POST-WRITE RECONCILIATION, unexplainedMismatch=0
-> OWNER_VERIFIED
```

Before explicit authorization there are no real financial writes. After finalize rollback remains available until post-write PASS.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Issue #96
4. `/docs/PROJECT_STATUS.md`
5. `/docs/operations/MIG010_FULL_HISTORY_MIGRATION.md`
6. `/docs/operations/MIG010_REPAIR_POLICY.md`
7. `/docs/operations/MIG010_AUTHORIZED_EXECUTION.md`
8. `/docs/adr/ADR-MIG-010-OCCURRENCE-IDENTITY.md`
9. `/lib/migration/full_history_migration.v1.json`
10. `/lib/migration/mig010_repair_policy.v1.json`
11. `/lib/migration/mig010_execution_policy.v1.json`
12. `/tools/mig010-execution-package.js`
13. `/Mig010ExecutionGateway.js`
14. `/tools/mig010-authorized-executor.js`
15. `/tools/mig010-post-reconcile.js`
16. `/docs/architecture/TRANSACTION_REPOSITORY_PORT.md`
17. exact candidate code/tests/workflows

## Scope handoff

`AIENG-001/002/003`, `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011` = DONE. `MIG-010` = current R1 P0 writer. Other R1 items остаются dependency/priority-gated.
