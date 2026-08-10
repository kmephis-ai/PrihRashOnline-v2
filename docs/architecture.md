# Архитектура ПрихРасхOnline v2

## Текущее состояние

ПрихРасхOnline v2 — приватное домашнее финансовое приложение на Google Sheets + Apps Script с HTML Web Dashboard. GitHub является инженерным **control plane** для source/tests/contracts/docs/policy; он не является хранилищем финансовой базы.

R0 platform baseline (`MASTER-G0..G2`) завершён. В R1 `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014` завершены Main Verification. `DOC-010` — текущий writer; его задача — machine-proven coherence документации перед закрытием `MASTER-G3`.

Канонические архитектурные entry points:

- `docs/architecture/R1_C4_CONTEXT.md` — C4/context + trust boundaries;
- `docs/data/R1_DATA_LINEAGE.md` — end-to-end data lineage;
- `lib/documentation/r1_documentation.v1.json` — machine-readable documentation map;
- `docs/ROADMAP.md` — executable order/dependencies.

Google Sheets/GAS — текущий adapter/runtime, а не вечный domain boundary. Целевая архитектура остаётся ports/adapters: **Google Sheets adapter** и future **YDB adapter** должны проходить одни canonical/query/financial contracts без big-bang migration.

## Компоненты

| Компонент | Текущая роль |
|---|---|
| Google Sheets | private primary data store/current adapter |
| `01 Операции` | canonical transaction surface; Dashboard read-only |
| Apps Script | current platform/runtime adapter, owner-only runtime |
| `lib/domain/**` | portable canonical contracts |
| `lib/finance/**` | pure FIN-TRUTH/KPI semantics |
| `lib/application/**` | pure use-cases без storage/UI/network authority |
| `lib/analytics/**` | AnalyticsQuery/Result + incremental read models |
| `lib/repository/**` | storage-neutral repository + cache/refresh layers |
| `lib/adapters/**` | platform/storage projection/mapping adapters |
| `GoogleTransactionRepositoryGateway.js` | Apps Script Google read gateway; generic canonical writes blocked |
| `Mig010ExecutionGateway.js` | historical exact-bound migration-specific writer |
| HTML Web Dashboard | private family UI/renderer consumer; financial semantics не authoritative |
| GitHub Actions | zero-secret validation + trusted exact-SHA deploy/runtime/merge control plane |

## Основной поток данных

```text
private Google Sheets
        ↓
GoogleTransactionRepositoryGateway.js
        ↓
Google Sheets transaction adapter / PERF-010 projection
        ↓
PRH_TRANSACTION_REPOSITORY_V1
        ↓
PRH_CANONICAL_TRANSACTION_V1
        ↓
FIN-TRUTH-v1 / PRH_KPI_DICTIONARY_V1
        ↓
PRH_ANALYTICS_CONTRACT_V1@1.0.0
        ↓
PERF-011 cache / PERF-012 refresh / PERF-013 aggregates as optional read optimizations
        ↓
private MYSELF Web Dashboard
```

Полный lineage с contract/code/test/check references: `docs/data/R1_DATA_LINEAGE.md`.

## Pure domain/application boundary — ARCH-010

Machine contract: `lib/application/application_core.v1.json` (`PRH_APPLICATION_CORE_V1`).

Authority:

- `io_authority: false`;
- `financial_write_authority: false`;
- `network_authority: false`.

`SpreadsheetApp`, Apps Script services, DOM/UI и network calls не допускаются внутри pure core. Machine check: `Pure domain/application core`.

## Transaction repository boundary — ARCH-011

Machine contract: `lib/repository/transaction_repository.v1.json` (`PRH_TRANSACTION_REPOSITORY_V1`). Human contract: `docs/architecture/TRANSACTION_REPOSITORY_PORT.md`.

Repository port предоставляет storage-neutral read/query/write-interface contract над canonical transactions. In-memory fake может иметь explicit synthetic write authority только в тестах. Current Google adapter поддерживает read/query, а generic canonical write всегда fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

`source_position` остаётся mutable adapter provenance и **не является logical identity**.

## Canonical transaction + financial truth

Machine schema: `lib/domain/canonical_transaction.v1.schema.json` (`PRH_CANONICAL_TRANSACTION_V1`).  
KPI contract: `lib/finance/kpi_dictionary.v1.json` (`PRH_KPI_DICTIONARY_V1`, `FIN-TRUTH-v1`).

**Legacy итоговые ячейки не являются golden truth или authoritative financial source.** Financial gates и analytics опираются на canonical transaction semantics + KPI Dictionary.

## Analytics boundary — ANL-010

Machine contract: `lib/analytics/analytics_contract.v1.json` (`PRH_ANALYTICS_CONTRACT_V1@1.0.0`). Human contract: `docs/analytics/ANALYTICS_EXTENSION_CONTRACT.md`.

Analytics layer renderer/storage-neutral и не владеет financial formulas. Measures делегируются FIN-010 `evaluateKpis()`. Query/result provenance связывает analytics contract, canonical schema, KPI Dictionary, FIN-TRUTH и exact input revision.

Authority: `io=false`, `network=false`, `financial_write=false`, `ui=false`.

## R1 performance architecture — PERF-010..014

Performance layers оптимизируют physical reads/reuse/recompute и не создают альтернативную financial truth.

| ID | Machine contract | Проверяемое свойство |
|---|---|---|
| PERF-010 | `PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` | minimal mapped Google ranges/rows |
| PERF-011 | `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` | cache HIT только после exact revision proof |
| PERF-012 | `PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` | один immutable canonical snapshot на bounded refresh cycle |
| PERF-013 | `PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0` | affected-bucket-only recompute с FIN/ANL parity |
| PERF-014 | `PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0` | blocking synthetic 20k/50k latency/read/write guardrail |

Normative runbooks: `docs/operations/PERF010_QUERY_PROJECTION.md` … `docs/operations/PERF014_SYNTHETIC_SCALE_GATE.md`. Named gates закреплены в `.github/workflows/pr-validation.yml`.

PERF-014 wall-clock ceilings — CI regression guardrails, а не production/user-facing SLA. Correctness/parity failure всегда важнее latency PASS.

## Full-history migration boundary — MIG-010

MIG-010 deterministic **full-history migration DONE** после owner-private staging/readback/finalize, fresh encrypted backup, post-write reconciliation и Main Verification.

Machine contracts:

- `PRH_FULL_HISTORY_MIGRATION_V1@1.0.0`;
- `MIG010_EXECUTION_POLICY_V1@1.0.0`;
- owner-confirmed `CONTENT_FINGERPRINT_OCCURRENCE_V1`.

Historical machine anchors: **Current write authority = false**. The **owner-verified MIG-010 private full-history reconciliation** remains the completed private correctness proof; it does not grant later generic write authority.

`MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`. Historical `IRREVERSIBLE_ACTION_AUTHORIZED` была exact-bound: GitHub Actions не могут создать её и GitHub Actions/AI не могут повторно использовать её для later mutations. Generic repository write authority не изменился.

Recovery runbook: `docs/operations/DR001_DIRECT_OWNER_BACKUP.md`.

## Observability / SLO

OBS-001 задаёт bounded privacy-safe technical telemetry. OBS-010 machine contract `PRH_SLO_ERROR_BUDGET_V1@1.0.0` определяет availability/latency/correctness/freshness/migration-error SLI и error budget.

Human contract: `docs/operations/OBS010_SLO_ERROR_BUDGET.md`. Financial/raw payload не telemetry. `FREE_ONLY` обязателен.

## Trust boundaries

### Public GitHub

Разрешены code/contracts/docs, independently generated synthetic finance fixtures и technical PASS/FAIL/timing/hash/count evidence.

Запрещены raw/transformed **real-derived** financial values/aggregates/distributions, private screenshots/exports, authenticated responses, OAuth, backup bytes/keys, private deployment locators и private aggregate/cache contents.

### Private Google/owner runtime

Apps Script имеет доступ к приватной книге. Web App остаётся `MYSELF`; private deployment locator не публикуется.

### Delivery trust chain

```text
PR Validation
  ↓
Trusted DEV Deploy
  ↓
Trusted Runtime Health
  ↓
CI-003 autonomous squash merge
  ↓
Main Verification
```

Machine delivery PASS не является mutation authorization для private financial writes.

## Dashboard/application writes

Web Dashboard read paths не изменяют canonical operations. Pure application/analytics cores, PERF-010..014 и DOC-010 не имеют financial write authority. Current Google generic write blocked `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Любой future canonical mutation требует отдельного versioned policy contract, idempotency, bounded scope, preconditions, backup/rollback, audit, readback и private reconciliation; irreversible action требует нового owner authorization.

## DEV и PROD

`main` означает code, прошедший autonomous DEV delivery evidence. Это не автоматическое разрешение PROD cutover, destructive migration, history rewrite, real financial write или paid-service activation.

## Целевая архитектура

```text
PWA / family clients
        ↓
UI/view adapters
        ↓
Application services + AnalyticsQuery/Result
        ↓
Pure canonical domain + FIN/KPI rules
        ↓
PRH_TRANSACTION_REPOSITORY_V1
        ↓
Google Sheets adapter  <->  future YDB adapter
```

Cross-cutting: authentication, privacy, audit/telemetry, `FREE_ONLY`, recovery, exact revision and idempotency.

## Documentation authority

Machine documentation map: `lib/documentation/r1_documentation.v1.json` (`PRH_R1_DOCUMENTATION_V1@1.0.0`). C4 context: `docs/architecture/R1_C4_CONTEXT.md`. Data lineage: `docs/data/R1_DATA_LINEAGE.md`.

Source precedence: policy/security/privacy/cost → `docs/ROADMAP.md` + live Issues → exact-SHA code/tests/workflows/evidence → versioned contracts → human docs. Markdown никогда не может отменить красный machine gate.

## Fail-closed

Delivery/mutation останавливается, если exact identity, privacy, financial correctness, query/aggregate parity, backup binding, cost policy, runtime health или required evidence не доказаны. Красный CI исправляется на том же writer branch; manual marker, release snapshot или ослабление privacy не являются recovery strategy.
