# Модель данных и границы записи

## Текущее положение

Google Sheets остаётся private primary store/current adapter. Web Dashboard не копирует финансовую историю в GitHub и не создаёт public shadow database.

R1 закрепил FIN-010 KPI Dictionary, DATA-010 Canonical Transaction, ARCH-010 pure core, ARCH-011 repository port/Google adapter, MIG-010 verified migration, ANL-010 analytics contract, TEST-010, OBS-010 и PERF-010..014. Все перечисленные work items прошли Main Verification; `DOC-010` — текущий writer, связывающий contracts/code/tests/runbooks в machine-proven documentation map.

End-to-end lineage: `docs/data/R1_DATA_LINEAGE.md`. Machine documentation map: `lib/documentation/r1_documentation.v1.json` (`PRH_R1_DOCUMENTATION_V1@1.0.0`).

## Основные private sheets

| Лист | Текущая роль | Типичный write boundary |
|---|---|---|
| `01 Операции` | canonical transaction surface / source for Dashboard and reconciliation | Dashboard read-only; future canonical mutations only via separately proven write policy |
| `09 Настройки` | technical settings/status | bounded technical values |
| `10 Контроль` | private KPI/control snapshots | append + readback where separately authorized |
| `11 Предпросмотр` | quality proposal staging/review | bounded proposal state |
| `13 Журнал` | privacy-safe technical audit | bounded rotating append |
| `14 Аналитика` | existing spreadsheet analytics/fallback | not canonical analytics truth |

Наличие sheet/service/query/read-model contract не является разрешением записи. Generic Google canonical write остаётся fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Financial truth

Legacy monthly/summary cells не используются как authoritative golden truth.

KPI Dictionary v1 (`PRH_KPI_DICTIONARY_V1`, `FIN-TRUTH-v1`) задаёт semantics Income / Expense / Cash Flow / Savings / Budget variance, transfer neutrality, refund behavior, integer minor units и explicit period/currency rules.

Machine source: `lib/finance/kpi_dictionary.v1.json`; human contract: `docs/finance/KPI_DICTIONARY.md`; named check: `KPI Dictionary`.

Analytics и incremental aggregates не дублируют formulas: они вызывают FIN-010 evaluator.

## Canonical Transaction v1

Portable record определён в:

- `lib/domain/canonical_transaction.v1.schema.json` — `PRH_CANONICAL_TRANSACTION_V1`;
- `lib/domain/canonical_transaction.js` — strict validator/compatibility helpers;
- `docs/data/CANONICAL_TRANSACTION_SCHEMA.md` — normative human contract;
- `tests/canonical_transaction_schema_contract_test.js` → named check `Canonical transaction schema`.

Schema содержит stable transaction identity, RFC3339 occurred time, type/status, integer `amount_minor` + currency, household dimensions и provenance.

`source_position` — mutable adapter provenance и **не является logical identity**. Google column order/header naming — adapter concern, не domain schema.

## Repository / storage boundary

`PRH_TRANSACTION_REPOSITORY_V1` (`lib/repository/transaction_repository.v1.json`) отделяет canonical model от storage. Human contract: `docs/architecture/TRANSACTION_REPOSITORY_PORT.md`.

Current Google adapter переводит Sheet representation в canonical records и поддерживает read/query. In-memory fake допускает synthetic write только при explicit test authority. Current Google generic write возвращает `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## AnalyticsQuery / AnalyticsResult v1

Machine contract: `lib/analytics/analytics_contract.v1.json` (`PRH_ANALYTICS_CONTRACT_V1@1.0.0`). Engine: `lib/analytics/analytics_engine.js`. Human contract: `docs/analytics/ANALYTICS_EXTENSION_CONTRACT.md`.

`PRH_ANALYTICS_QUERY_V1` задаёт currency/measures/dimensions/filters/time/grain/comparison/sort/parameters/limit. `PRH_ANALYTICS_RESULT_V1` содержит deterministic rows, query hash, truncation and provenance.

Analytics result — derived read model, а не новый financial source of truth или persistence authority. Real analytics results/aggregates остаются private.

## R1 performance/read-model layers

Performance lineage полностью описан в `docs/data/R1_DATA_LINEAGE.md`.

- PERF-010 `PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` — минимизирует physical Google ranges/rows;
- PERF-011 `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` — переиспользует independent read/query result только после exact revision proof;
- PERF-012 `PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` — один immutable canonical snapshot на bounded refresh cycle;
- PERF-013 `PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0` — MONTH/CATEGORY_ID/ACCOUNT_ID materializations с exact state revision/hash и affected-bucket-only recompute;
- PERF-014 `PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0` — blocking independently generated synthetic 20k/50k CI performance guardrail.

Все эти layers read/derived-only с точки зрения financial authority. Они не становятся canonical truth и не разрешают writes. PERF-014 timings — CI regression ceilings, не production SLA.

## Source-to-canonical provenance и MIG-010

Migration reconciliation использует deterministic source identity/fingerprint и fail-closed обнаруживает missing/duplicate/changed/core-mismatch states.

MIG-010 deterministic **full-history migration DONE** после exact owner-authorized staging/readback/finalize, fresh encrypted backup и Main Verification. Private evidence: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, provenance complete, idempotent rerun verified.

Owner-confirmed identical occurrences могут использовать `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical execution policy: `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` не считался completion до private post-write reconciliation.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` не является reusable permission: GitHub Actions не могут создать её, и GitHub Actions/AI не могут повторно использовать её для future mutations. Generic Google write authority не изменился.

## Recovery

DR-001 owner backup runbook: `docs/operations/DR001_DIRECT_OWNER_BACKUP.md`. Backup шифруется до persistence, verify + isolated restore drill проверяют recoverability. Backup bytes/key/OAuth/private restored data не становятся public evidence.

## Observability / SLO

OBS-001 технический audit/telemetry bounded и privacy-safe. OBS-010 contract `PRH_SLO_ERROR_BUDGET_V1@1.0.0` задаёт SLI/error-budget semantics; human runbook: `docs/operations/OBS010_SLO_ERROR_BUDGET.md`; named check: `SLO error budget`.

Financial amounts, canonical rows, private aggregates/query payload — не telemetry.

## Quality queue — `11 Предпросмотр`

Proposal staging/review state не равно изменению canonical operation. Classifier/AI/proposal output не является financial truth без deterministic validation и отдельного write action.

## Control snapshots — `10 Контроль`

KPI/control snapshots могут содержать реальные household aggregates, поэтому остаются private. Public tests используют independently generated synthetic equivalents. Snapshot не становится authoritative выше canonical transaction/KPI rules.

## Public GitHub privacy boundary

В public repository допустимы code/contracts/docs, independently generated synthetic finance fixtures и non-financial technical evidence.

Не допускаются real или **real-derived** transaction rows/IDs/amounts/totals/aggregates/category distributions/seasonality, private screenshots/exports/reports, authenticated Dashboard/API bodies, OAuth/private clasp, backup bytes/key или private deployment locators.

`FREE_ONLY` остаётся обязательным для текущих и future adapters/providers.

## R1 canonical model

1. `FIN-010` KPI Dictionary — DONE;
2. `DATA-010` Canonical Transaction — DONE;
3. `ARCH-010` pure application core — DONE;
4. `ARCH-011` repository + Google adapter — DONE;
5. `MIG-010` deterministic full-history migration — DONE / OWNER_VERIFIED;
6. `ANL-010` Analytics extension contract — DONE;
7. `TEST-010` layered testing — DONE;
8. `OBS-010` SLO/error budget — DONE;
9. `PERF-010..014` read/performance foundation — DONE;
10. `DOC-010` R1 documentation coherence — IN_PROGRESS.

После DOC-010 Main Verification обязательные R1 `MASTER-G3` dependencies будут выполнены. UI/renderer по-прежнему не знает storage adapter и не владеет financial formulas.
