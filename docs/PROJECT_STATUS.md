# PrihRashOnline-v2 — текущий статус проекта

Это public-safe human summary. Authoritative execution state: `docs/ROADMAP.md` + live GitHub Issues + exact-SHA code/tests/workflows + machine evidence. Этот файл не может отменять красный gate.

## R0 — завершён

### MASTER-G0 / Truth — **complete**

`TEST-001 + SEC-001 + FIN-001 + DATA-001 + DOC-001 = DONE`.

### MASTER-G1 / Autonomous delivery + AI engineering — **complete**

`SEC-003 + CI-001 + CI-002 + CI-003 + AIENG-001 + AIENG-002 + AIENG-003 = DONE`.

### MASTER-G2 / Recoverability — **complete**

`DR-001 + OBS-001 + FINOPS-001 = DONE`.

## R1 / Canonical Financial Platform — текущая волна

- `FIN-010` Versioned KPI Dictionary — **DONE**, Issue #85 Main Verification PASS.
- `DATA-010` Canonical transaction schema v1 — **DONE**, Issue #87 Main Verification PASS.
- `ARCH-010` Pure domain/application core — **DONE**, Issue #89 Main Verification PASS.
- `ARCH-011` Repository interfaces + Google Sheets adapter — **DONE**, Issue #91 Main Verification PASS.
- `MIG-010` Deterministic full-history migration — **DONE**, Issue #96 Main Verification PASS; owner-private `OWNER_VERIFIED`, fresh encrypted post-write reconciliation PASS.
- `ANL-010` Analytics extension contract v1 — **DONE**, Issue #98 Main Verification PASS.
- `TEST-010` Layered test architecture — **DONE**, Issue #100 Main Verification PASS.
- `OBS-010` SLO/error-budget layer — **DONE**, Issue #103 Main Verification PASS.
- `PERF-010` Query projection/minimal ranges — **IN_PROGRESS**, Issue #105; current R1 writer.
- другие items остаются dependency/priority-gated до завершения current writer.

FIN-010 contracts: `lib/finance/kpi_dictionary.v1.json`, `lib/finance/kpi_dictionary.js`, `docs/finance/KPI_DICTIONARY.md`.
DATA-010 contracts: `lib/domain/canonical_transaction.v1.schema.json`, `lib/domain/canonical_transaction.js`, `docs/data/CANONICAL_TRANSACTION_SCHEMA.md`.
ARCH-010: `PRH_APPLICATION_CORE_V1`, pure use-cases без I/O/network/financial-write authority.
ARCH-011: `PRH_TRANSACTION_REPOSITORY_V1`, deterministic fake + Google adapter; generic Google canonical write остаётся fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.
ANL-010: `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, renderer/storage-neutral query/result contract, `financial_write=false`.
TEST-010: `PRH_TEST_ARCHITECTURE_V1@1.0.0`, deterministic fail-closed test inventory/layers + structured lifecycle/workflow parsers.
OBS-010: `PRH_SLO_ERROR_BUDGET_V1@1.0.0`, integer ppm/bps SLI/error-budget authority без financial truth/write authority.

## PERF-010 current truth

PERF-010 вводит `PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` поверх ARCH-011 Google Sheets adapter без изменения `PRH_TRANSACTION_REPOSITORY_V1` query/output semantics.

Read model:

- header discovery может читать одну полную строку заголовков как control plane;
- data rows читаются только по requested mapped contiguous column spans и bounded row interval;
- `readAll()`/`getRevision()` читают 15 canonical mapped columns вместо всех worksheet columns;
- `getById()` сначала сканирует только `ID`, затем дочитывает full mapped projection найденной строки;
- `query()` сначала читает только `ID` + `Дата и время` + headers задействованных filters, выбирает/sorts source rows, а full mapped projection дочитывает только для выбранной page;
- соседние selected row numbers группируются в contiguous row intervals.

Projection telemetry public-safe и содержит только projection/header/span/row/range/cell counts. Financial values, descriptions, categories, account IDs и transaction payload туда не входят.

Synthetic 4-row/20-column fixture даёт deterministic evidence: old full-width baseline `80` data cells; mapped `readAll = 60`; `getById = 19`; narrow type/status/category query = `35` cells. Query semantic parity проверяется против authoritative repository `applyQuery()`.

`GoogleTransactionRepositoryGateway.js` version `1.1.0` не использует `getDataRange()` или write primitives; canonical financial write остаётся `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Named PR gate: `Query projection minimal ranges`; full TEST-010 layered suite также обязан запускать `repository_projection_adapter_contract_test.js` под `ADAPTER_INTEGRATION`.

Normative runbook: `docs/operations/PERF010_QUERY_PROJECTION.md`.

## OBS-010 verified boundary

OBS-010 завершён Main Verification. Единственный versioned contract `PRH_SLO_ERROR_BUDGET_V1@1.0.0` использует integer ppm/bps, half-open windows и SLI `AVAILABILITY`, `LATENCY`, zero-tolerance `CORRECTNESS`, `FRESHNESS`, zero-tolerance `MIGRATION_ERRORS`.

Observation shapes deny-by-default; correctness принимает только allowlisted PASS/FAIL machine evidence. Public evidence — bounded technical metadata only. Financial/raw payload запрещён; `FREE_ONLY`, `financial_write=false`, `financial_correctness=false`.

Normative runbook: `docs/operations/OBS010_SLO_ERROR_BUDGET.md`.

## TEST-010 verified boundary

TEST-010 завершён Main Verification. `PRH_TEST_ARCHITECTURE_V1@1.0.0` разделяет `PURE_DOMAIN_APPLICATION`, `MIGRATION_RECOVERY`, `ADAPTER_INTEGRATION`, `RUNTIME_INTEGRATION`, `UI_E2E`, `POLICY_GOVERNANCE`.

`unclassified_test=FAIL`, `ambiguous_classification=FAIL`, `duplicate_machine_authority=FAIL`. Full suite исполняется в deterministic path order; pure suite не получает platform-service authority. Lifecycle/workflow machine authority использует structured parsers вместо hard-coded successor IDs.

## ANL-010 verified boundary

ANL-010 завершён Main Verification. `PRH_ANALYTICS_QUERY_V1` / `PRH_ANALYTICS_RESULT_V1` сохраняют deterministic query identity, canonical/KPI provenance, bounded grouping/filter/time/comparison/sort semantics и делегируют financial calculations FIN-010 `evaluateKpis()`.

Analytics contract renderer/storage-neutral и не имеет I/O/network/UI/financial-write authority. ChartSpec/WidgetSpec и advanced OLAP остаются отдельными Roadmap scopes.

## MIG-010 verified historical boundary

MIG-010 owner-private flow completed:

```text
RESOLVED_REBUILD_DRY_RUN = PASS
-> exact execution package/request
-> owner IRREVERSIBLE_ACTION_AUTHORIZED
-> STAGING + READBACK
-> FINALIZED_PENDING_RECONCILIATION
-> FRESH ENCRYPTED BACKUP
-> POST-WRITE RECONCILIATION
-> OWNER_VERIFIED
-> PR/Main Verification
-> DONE
```

Private evidence established `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`. Generic repository write authority did not change. Hidden staging/rollback cleanup was not performed automatically and is not implied by DONE.

Owner-confirmed identical real operations remain represented by `CONTENT_FINGERPRINT_OCCURRENCE_V1`; this capability does not create generic financial-write authority.

### MASTER-G3 / Canonical platform — **open**

Private full-history reconciliation gate is PASS. MASTER-G3 still requires `FIN-010 + DATA-010 + ARCH-010 + ARCH-011 + ANL-010 + MIG-010 + PERF-014 + DOC-010 = DONE` and synthetic performance PASS.

## Pure core + repository boundary

`lib/domain/**`, `lib/finance/**`, `lib/migration/**`, `lib/application/**`, `lib/analytics/**` are pure boundaries. They do not own platform I/O/network/financial-write authority.

ARCH-011 exposes the storage-neutral repository port outside the pure domain. Presence of `writeBatch()` interface does not grant Google mutation permission; current generic Google adapter returns `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Executable AI engineering baseline

Root `AGENTS.md` is the public-safe repository AI operating contract.

- `tools/roadmap-task-protocol.js` + `PRH_ROADMAP_TASK_V1` define continuation, one-writer ownership and lifecycle.
- `tools/multi-ai-review-protocol.js` + `PRH_MULTI_AI_REVIEW_PACKET_V1` / `PRH_MULTI_AI_REVIEW_REPORT_V1` define supplementary exact-candidate review.
- reviewers always `READ_ONLY`, `writer_authority=false`; unresolved P0/P1 blocks review evidence, P2/P3 advisory.
- required AI checks deterministic/local and require no paid AI/API provider.

## Current runtime truth

- private primary store/runtime: Google Sheets + Apps Script;
- family UI: private `MYSELF` Apps Script Web Dashboard;
- Dashboard trusted runtime health includes authenticated Web App render smoke v2;
- public GitHub finance content: independently generated synthetic only;
- DEV delivery: exact-SHA autonomous pipeline;
- PROD/cutover/destructive data actions: separate policy gates;
- `FREE_ONLY` mandatory; paid-by-usage provider activation is not automatic.

## Что намеренно не утверждается

- PERF-010 не считается DONE до CI-003 merge + Main Verification/Issue close;
- PERF-010 не вводит PERF-011 cache, PERF-012 single-scan refresh или PERF-013 incremental aggregates;
- projection planner не является источником financial/query semantics и не меняет canonical output;
- projection telemetry не разрешает публикацию financial payload;
- OBS-010 SLO layer не заменяет FIN/DATA/MIG/ANL correctness authorities;
- TEST-010 layered runner не заменяет required trusted deploy/runtime/Main Verification gates;
- owner authorization MIG-010 не переносится на future mutations;
- hidden MIG staging/rollback cleanup не выполнен автоматически;
- Google -> Yandex cutover не выполнен;
- private Dashboard не сделан публичным;
- public Git history rewrite не authorized/executed;
- paid cloud/AI/OCR/observability provider не включён.

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
