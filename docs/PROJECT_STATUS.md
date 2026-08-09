# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Этот файл не может отменять красный gate.

## R0 — завершён

### MASTER-G0 / Truth — **complete**

`TEST-001 + SEC-001 + FIN-001 + DATA-001 + DOC-001 = DONE`.

### MASTER-G1 / Autonomous delivery + AI engineering — **complete**

`SEC-003 + CI-001 + CI-002 + CI-003 + AIENG-001 + AIENG-002 + AIENG-003 = DONE`.

AIENG chain: `AIENG-001 = DONE`, `AIENG-002 = DONE`, `AIENG-003 = DONE`.

### MASTER-G2 / Recoverability — **complete**

`DR-001 + OBS-001 + FINOPS-001 = DONE`.

## R1 / Canonical Financial Platform — текущая волна

- `FIN-010` Versioned KPI Dictionary — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` Canonical transaction schema v1 — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` Pure domain/application core — **DONE**, Issue #89 Main Verification PASS; предыдущий lifecycle state был `IN_PROGRESS`.
- `ARCH-011` Repository interfaces + Google Sheets adapter — **IN_PROGRESS**, Issue #91, active PR #95.
- `ANL-010`, `TEST-010`, `OBS-010` и другие dependent items остаются blocked до выполнения своих declared dependencies; ARCH-011 ещё не считается DONE до Main Verification.

FIN-010 contracts: `lib/finance/kpi_dictionary.v1.json`, `lib/finance/kpi_dictionary.js`, `docs/finance/KPI_DICTIONARY.md`.

DATA-010 contracts: `lib/domain/canonical_transaction.v1.schema.json`, `lib/domain/canonical_transaction.js`, `docs/data/CANONICAL_TRANSACTION_SCHEMA.md`.

ARCH-010 contracts:

- `lib/application/application_core.v1.json` — `PRH_APPLICATION_CORE_V1` purity/authority/use-case contract;
- `lib/application/financial_core.js` — pure canonical validation/KPI/migration use-cases;
- `tests/pure_domain_application_core_contract_test.js` — behavior + dependency-boundary contracts;
- `docs/architecture/PURE_DOMAIN_APPLICATION_CORE.md` — normative architecture boundary.

ARCH-011 candidate contracts:

- `lib/repository/transaction_repository.v1.json` — `PRH_TRANSACTION_REPOSITORY_V1` storage-neutral port;
- `lib/repository/transaction_repository.js` — deterministic query/revision + in-memory fake repository;
- `lib/adapters/google_sheets_operations_mapping.v1.json` — versioned current-sheet mapping;
- `lib/adapters/google_sheets_transaction_repository.js` — Google Sheets adapter над canonical transactions;
- `GoogleTransactionRepositoryGateway.js` — Apps Script read boundary; canonical financial write fail-closed;
- `tests/repository_adapter_contract_test.js` — synthetic repository/fake/Google mapping/gateway parity gate;
- `docs/architecture/TRANSACTION_REPOSITORY_PORT.md` + `docs/adr/ADR-ARCH-011-TRANSACTION-REPOSITORY.md` — normative boundary/decision.

### MASTER-G3 / Canonical platform — **open**

Exit требует `FIN-010 + DATA-010 + ARCH-010 + ARCH-011 + ANL-010 + MIG-010 + PERF-014 + DOC-010 = DONE`, а также private full-history reconciliation и synthetic performance PASS.

## Pure core + repository boundary

`lib/domain/**`, `lib/finance/**`, `lib/migration/**`, `lib/application/**` являются локально исполняемым pure boundary. Application core принимает plain data, не имеет I/O/network/financial-write authority и не зависит от `SpreadsheetApp`, Apps Script UI, DOM или Google Sheet layout.

ARCH-011 добавляет storage-neutral repository port и Google Sheets adapter **снаружи** pure core. Наличие `writeBatch()` interface не создаёт permission: current Google adapter возвращает `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`, а Apps Script gateway не содержит operation-write primitives.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract.

- `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` задают continuation, one-writer ownership и lifecycle.
- `tools/multi-ai-review-protocol.js` + `PRH_MULTI_AI_REVIEW_PACKET_V1` / `PRH_MULTI_AI_REVIEW_REPORT_V1` задают supplementary exact-candidate review.
- reviewers всегда `READ_ONLY`, `writer_authority=false`; unresolved P0/P1 blocks review evidence, P2/P3 advisory.
- required AI checks deterministic/local и не требуют paid AI/API provider.

## Current runtime truth

- private primary store/runtime: Google Sheets + Apps Script;
- family UI: private `MYSELF` Apps Script Web Dashboard;
- Dashboard render path после INC-001 использует raw `HtmlOutput` placeholder injection; trusted runtime health включает Web App render smoke v2;
- public GitHub finance content: independently generated synthetic only;
- DEV delivery: exact-SHA autonomous pipeline;
- PROD/cutover/destructive data actions: separate policy gates;
- `FREE_ONLY` обязателен; paid-by-usage provider activation не разрешён автоматически.

## Что намеренно не утверждается

- full-history migration **не** завершена;
- Google -> Yandex cutover **не** выполнен;
- private Dashboard **не** сделан публичным;
- public Git history rewrite **не authorized/executed**;
- paid cloud/AI/OCR provider **не** включён;
- ARCH-010 не предоставляет repository I/O и не разрешает financial writes;
- ARCH-011 пока не DONE и не разрешает canonical Google financial writes;
- последующие R1 items не считаются DONE до собственных machine gates/Main Verification.

## Source precedence

1. security/privacy/cost/irreversible boundaries;
2. repository `docs/ROADMAP.md` v2.3;
3. external Master Audit / AI Development Playbook, когда явно предоставлены;
4. active Roadmap Issue/task packet;
5. executable exact-SHA code/tests/workflows;
6. architecture/ADR/operations docs;
7. README/user docs;
8. historical changelog/release notes.

Stale lower-priority документ никогда не разрешает bypass current machine gate.
