# PrihRashOnline-v2 — public-safe AI context

Этот файл безопасен для public repository: real financial rows/aggregates, private runtime locators, OAuth, backup bytes/keys, owner-private mapper/snapshot/state здесь запрещены.

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

Owner tool `tools/mig010-owner.js` creates private snapshot from encrypted backup through a private mapper outside repository, then private dry-run/state. Commands `execute/write/apply` are intentionally disabled until explicit owner authorization stage.

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

Real or real-derived household finance data must stay private. Public finance fixtures — independently generated synthetic only. Private deployment identifiers, authenticated responses, OAuth, backups/keys, migration mapper/snapshot/state/resume token stay private.

Full-history migration is not complete. MIG-010 code readiness/merge does not authorize real writes. New canonical mutation требует idempotency, preconditions, readback, reconciliation, rollback and explicit owner irreversible-action authorization. `FREE_ONLY` обязателен.

## Domain boundaries

FIN-010: `FIN-TRUTH-v1`, integer minor units, posted-only, transfer-neutral, refund as expense reduction, mixed-currency fail-closed.

DATA-010: `PRH_CANONICAL_TRANSACTION_V1`; `source_position` mutable locator, not identity; DATA-001 compatibility uses `CONTENT_FINGERPRINT_V1` stable across row movement.

ARCH-010: `PRH_APPLICATION_CORE_V1`; `io_authority=false`, `financial_write_authority=false`, `network_authority=false`. Pure `lib/domain|finance|migration|application` has no `SpreadsheetApp`/DOM/storage/network dependency.

ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`; fake repository supports synthetic optimistic/idempotent tests. Google adapter maps versioned source to canonical and keeps Google row only as `source_position`. Production Google canonical mutation remains blocked.

## MIG-010 irreversible boundary

```text
CODE_READY
-> OWNER_PRIVATE_SNAPSHOT
-> OWNER_DRY_RUN
-> AUTHORIZATION_REQUIRED
-> BATCHING
-> PRIVATE_RECONCILIATION
-> OWNER_VERIFIED
```

Before `AUTHORIZATION_REQUIRED` there are no real financial writes. GitHub Actions, merge or AI-agent cannot create `IRREVERSIBLE_ACTION_AUTHORIZED`. Future first write requires exact plan hash, fresh verified DR-001 backup, migration-specific write/readback/rollback adapter and owner action.

## Start-reading order

1. `/AGENTS.md`
2. `/docs/ROADMAP.md`
3. active GitHub Issue
4. `/docs/PROJECT_STATUS.md`
5. `/docs/operations/MIG010_FULL_HISTORY_MIGRATION.md`
6. `/lib/migration/full_history_migration.v1.json`
7. `/docs/architecture/TRANSACTION_REPOSITORY_PORT.md`
8. `/docs/architecture.md`
9. exact candidate code/tests/workflows

## Scope handoff

`AIENG-001/002/003`, `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011` = DONE. `MIG-010` = current R1 P0 writer. Other R1 items остаются dependency/priority-gated.
