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
- `DATA-010` Canonical transaction schema v1 — **IN_PROGRESS**, Issue #87.
- `ARCH-010` и последующие domain/adapters остаются dependency-blocked до DATA-010 DONE.

FIN-010 contracts: `lib/finance/kpi_dictionary.v1.json`, `lib/finance/kpi_dictionary.js`, `docs/finance/KPI_DICTIONARY.md`.

DATA-010 candidate contracts:

- `lib/domain/canonical_transaction.v1.schema.json` — strict portable schema;
- `lib/domain/canonical_transaction.js` — validation, source-identity и migration-compatibility layer;
- `tests/canonical_transaction_schema_contract_test.js` — schema/identity/FIN/KPI/DATA-001 compatibility tests;
- `docs/data/CANONICAL_TRANSACTION_SCHEMA.md` — normative human contract.

### MASTER-G3 / Canonical platform — **open**

Exit требует `FIN-010 + DATA-010 + ARCH-010 + ARCH-011 + ANL-010 + MIG-010 + PERF-014 + DOC-010 = DONE`, а также private full-history reconciliation и synthetic performance PASS.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract.

- `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` задают continuation, one-writer ownership и lifecycle.
- `tools/multi-ai-review-protocol.js` + `PRH_MULTI_AI_REVIEW_PACKET_V1` / `PRH_MULTI_AI_REVIEW_REPORT_V1` задают supplementary exact-candidate review.
- reviewers всегда `READ_ONLY`, `writer_authority=false`; unresolved P0/P1 blocks review evidence, P2/P3 advisory.
- required AI checks deterministic/local и не требуют paid AI/API provider.

## Current runtime truth

- private primary store/runtime: Google Sheets + Apps Script;
- family UI: private `MYSELF` Apps Script Web Dashboard;
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
- DATA-010 не разрешает canonical writes и не означает migration/cutover;
- ARCH-010 и последующие R1 items не считаются DONE до собственных machine gates/Main Verification.

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
