# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, owner-private mapper/snapshot/state/diagnostic/repair payload здесь запрещены.

## Канонические источники

1. `/AGENTS.md` — AI operating contract.
2. `/docs/ROADMAP.md` — **каноническая Executable GitHub Roadmap v2.3**.
3. GitHub Issues — live lifecycle/status.
4. Exact-SHA code/tests/workflows и machine evidence.
5. Architecture/ADR/operations docs.

Chat history/memory и stale Roadmap copies не authority. При явном предоставлении `Master Audit v2.1` и `AI Development Playbook v1.0` действует precedence из `AGENTS.md`.

## Current R0 truth

R0 machine-proven complete. `MASTER-G0`, `MASTER-G1`, `MASTER-G2` закрыты. AIENG chain: `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

## Current R1 truth

- `FIN-010` — DONE.
- `DATA-010` — DONE.
- `ARCH-010` — DONE, Issue #89 Main Verification PASS.
- `ARCH-011` — previous current writer, Issue #91; now DONE after Main Verification PASS.
- `MIG-010` — current P0 writer, Issue #96, draft PR #97.

`PRH_TRANSACTION_REPOSITORY_V1` — storage-neutral repository port. Current Google adapter has read/query but canonical write remains fail-closed with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`; repository interface existence is not write authority.

`PRH_FULL_HISTORY_MIGRATION_V1` — current MIG-010 protocol: deterministic dry-run, <=100 batches, idempotency, expected target revision, HMAC resume, DR-001 backup binding, private reconciliation and separate irreversible-action authorization.

`MIG010_REPAIR_POLICY_V1@1.1.0` — owner-private blocked-dry-run repair layer. Strategy `REBUILD_LEGACY_SLICE_V1`: scoped old legacy-derived target anomalies are rebuilt from source, invalid source is explained quarantine, duplicate semantics require owner decision. `PRESERVE_ALL` uses `CONTENT_FINGERPRINT_OCCURRENCE_V1`; CI/AI cannot select it automatically.

`PRH_CANONICAL_TRANSACTION_V1` remains schema version 1 and supports `EXTERNAL_ID`, `CONTENT_FINGERPRINT_V1`, `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Occurrence strategy is an additive migration capability: same content fingerprint, distinct owner-confirmed source occurrences, deterministic distinct source_record_id/transaction_id, mutable source_position remains separate.

Owner checkpoint is privacy-safe: snapshot created, dry-run = BLOCKED, state verify = PASS, diagnostics written, write authority remains false. Public-safe blocker classes are `CORE_MISMATCH`, `SOURCE_DUPLICATE`, `SOURCE_INVALID`, `SOURCE_MISSING`; counts/details and owner resolution payload remain private.

`tools/mig010-owner.js` creates private snapshot/dry-run/state/diagnostics. `tools/mig010-repair.js` creates private repair proposal + offline duplicate review + owner-bound resolution/resolved rebuild candidate. Both reject `execute/write/apply` until a later explicit authorization stage.

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

После INC-001 Web Dashboard использует raw `HtmlOutput` placeholder injection; authenticated Web App render smoke v2 обязателен для runtime health.

## Executable continuation protocol

`tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` выбирают/продолжают ровно один dependency-ready writer. Multiple writers, missing dependencies или private context fail closed.

## Read-only multi-AI review

Required roles: `ARCHITECTURE`, `SECURITY_PRIVACY`, `FINANCIAL_DATA`, `TEST_OPERATIONS`. Reviewers всегда `READ_ONLY`, `writer_authority: false`; P0/P1 block review evidence, P2/P3 advisory. Review supplementary и не отменяет machine gates/Main Verification.

## Privacy / financial / cost boundaries

Real or real-derived household finance data must stay private. Public finance fixtures — independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys, migration mapper/snapshot/state/diagnostic/proposal/review/resolution/resolved/resume token stay private.

Full-history migration is not complete. MIG-010 code readiness/merge/repair resolution does not authorize real writes. New canonical mutation требует idempotency, preconditions, readback, reconciliation, rollback and explicit owner irreversible-action authorization. `FREE_ONLY` обязателен.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`, integer minor units, posted-only, transfer-neutral, refund as expense reduction, mixed-currency fail-closed.

DATA-010: `PRH_CANONICAL_TRANSACTION_V1`; `source_position` mutable locator, not identity. DATA-001 compatibility uses `CONTENT_FINGERPRINT_V1` stable across row movement. Owner-confirmed identical real operations use `CONTENT_FINGERPRINT_OCCURRENCE_V1`; financial core fields are not modified merely to create uniqueness.

ARCH-010: `PRH_APPLICATION_CORE_V1`; `io_authority=false`, `financial_write_authority=false`, `network_authority=false`. Pure `lib/domain|finance|migration|application` has no `SpreadsheetApp`/DOM/storage/network dependency.

ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; fake repository supports synthetic optimistic/idempotent tests. Google adapter maps versioned source to canonical and keeps Google row only as `source_position`. Production Google canonical mutation remains blocked.

## MIG-010 irreversible boundary

```text
CODE_READY
-> OWNER_PRIVATE_SNAPSHOT
-> OWNER_DRY_RUN
     -> BLOCKED -> OWNER_PRIVATE_DIAGNOSTICS -> REPAIR_PROPOSAL
          -> DUPLICATE_OWNER_REVIEW (если требуется)
          -> RESOLVED_REBUILD_DRY_RUN
     -> READY -> AUTHORIZATION_REQUIRED
-> BATCHING
-> PRIVATE_RECONCILIATION
-> OWNER_VERIFIED
```

Before `AUTHORIZATION_REQUIRED` there are no real financial writes. GitHub Actions, merge or AI-agent cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`. Future first write requires exact plan/rebuild hash, fresh verified DR-001 backup, migration-specific write/readback/rollback adapter and owner action.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Issue
4. `/docs/PROJECT_STATUS.md`
5. `/docs/operations/MIG010_FULL_HISTORY_MIGRATION.md`
6. `/docs/operations/MIG010_REPAIR_POLICY.md`
7. `/docs/adr/ADR-MIG-010-OCCURRENCE-IDENTITY.md`
8. `/lib/migration/full_history_migration.v1.json`
9. `/lib/migration/mig010_repair_policy.v1.json`
10. `/docs/data/CANONICAL_TRANSACTION_SCHEMA.md`
11. `/docs/architecture/TRANSACTION_REPOSITORY_PORT.md`
12. `/docs/architecture.md`
13. exact candidate code/tests/workflows

## Scope handoff

`AIENG-001/002/003`, `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011` = DONE. `MIG-010` = current R1 P0 writer. Other R1 items остаются dependency/priority-gated.
