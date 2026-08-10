# Модель данных и границы записи

## Текущее положение

Google Sheets остаётся private primary store/current adapter. Public GitHub не является финансовой базой и не содержит real/real-derived household finance data.

R1 (`FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010`) завершён Main Verification; `MASTER-G3 / Canonical platform` complete. R2 `DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020` — DONE. Текущий единственный writer — `EXP-020`.

## Основные private sheets

| Лист | Роль | Write boundary |
|---|---|---|
| `01 Операции` | canonical transaction surface | Dashboard/Home/TX/EXP read-only; mutation only by separately proven policy |
| `09 Настройки` | technical settings/status | bounded technical writes |
| `10 Контроль` | private KPI/control snapshots | separately authorized append/readback |
| `11 Предпросмотр` | proposal staging/review | proposal state, not canonical truth |
| `13 Журнал` | privacy-safe technical audit | bounded technical append |
| `14 Аналитика` | spreadsheet analytics/fallback | not canonical FIN truth |

Generic Google canonical write remains fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Financial truth

`PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1` owns Income / Expense / Cash Flow / Savings / Budget variance semantics, transfer/refund behavior, integer minor units and explicit period/currency rules.

Legacy totals are not golden truth. Analytics, performance, VIZ, HOME, TX and EXP do not create alternative financial formulas.

## Canonical Transaction v1

`PRH_CANONICAL_TRANSACTION_V1` defines stable transaction identity, RFC3339 occurred time, type/status, integer `amount_minor`, currency, household dimensions and provenance.

`source_position` is mutable adapter provenance and **не является logical identity**. Spreadsheet columns/header order are adapter concerns.

## Repository / storage

`PRH_TRANSACTION_REPOSITORY_V1` separates canonical data from storage. Current Google adapter supports read/query. Generic Google write is blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Analytics / performance — DONE

`ANL-010` — DONE; `PRH_ANALYTICS_RESULT_V1` is a derived read model, not persistence/financial authority.  
`PERF-010..014` — DONE; projection/cache/single-scan/incremental aggregates/synthetic scale are derived read/performance layers and do not authorize writes.

## DESIGN / VIZ / HOME / TX — DONE

Design theme/layout state is presentation-only. VIZ specs are configuration-only; real renderer datasets/options remain private transient data. `PRH_FINANCIAL_HOME_VIEW_V1` and `PRH_TRANSACTION_EXPLORER_RESULT_V1` are derived private views and do not create storage authority.

TX edit-draft `VALID` means schema-valid only; runtime save remains `WRITE_BLOCKED` with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## EXP-020 Expense Analytics view model

Machine contract: `PRH_EXPENSE_ANALYTICS_V1@1.0.0`. View schema: `PRH_EXPENSE_ANALYTICS_VIEW_V1`.

EXP-020 adds **no canonical entity and no persistent table**. It consumes canonical transactions and FIN-backed results to produce transient analysis state.

### Period/comparison state

`period` and `comparison_period` are explicit start-inclusive/end-exclusive windows. Comparison is allowed only for equal day counts; no implicit proration is stored or inferred.

### Financial values

- `total_expense_minor` and `comparison_expense_minor` are FIN-010 `evaluateKpis()` results;
- trend bucket `expense_minor` values are separate FIN-010 evaluations;
- category mix uses FIN-TRUTH `by_expense_category_minor` partition, including refund reductions and transfer neutrality;
- driver `delta_minor` is current category Expense minus comparison category Expense and must conserve the total Expense delta.

These are derived read values. They do not become canonical transaction fields or persisted financial truth.

### Visualization state

`PRH_WIDGET_SPEC_V1` / `PRH_CHART_SPEC_V1` remain configuration-only and contain no financial rows/amount payload. Real `PRH_VISUALIZATION_RENDER_DATASET_V1` values are private transient runtime data. Public fixtures use independently generated synthetic values only.

### Drill/navigation state

`PRH_EXPENSE_DRILL_ENVELOPE_V1` contains period + `PRH_DRILL_CONTEXT_V1` + normalized TX-020 query. It preserves account/category/member filters but intentionally contains no amount/expense/delta values.

Navigation state does not grant write authority. TX remains the canonical transaction destination and its save path remains blocked without a separate write policy.

### Telemetry

Public EXP telemetry allowlist is schema/version/query hash/context hash/bucket/category/driver counts/status/reason/timing. Real amounts, category IDs, transaction IDs and private filter values are not public telemetry.

## MIG-010 historical boundary

MIG-010 deterministic full-history migration — **DONE / OWNER_VERIFIED**. Private post-write evidence: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion before post-write reconciliation.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable; GitHub Actions cannot create it, GitHub Actions/AI cannot reuse it for future edits. Generic Google write authority remains false.

## Recovery / observability

DR-001 owner backup is private/encrypted. OBS telemetry permits technical metadata only; financial values, canonical rows and private Analytics/Home/TX/EXP/render payload are not public telemetry.

## Public GitHub privacy boundary

Allowed: code/contracts/docs, independently generated synthetic finance/Home/TX/EXP/render fixtures and technical PASS/FAIL/hash/count/timing evidence.

Forbidden: real or **real-derived** transaction rows/IDs/amounts/totals/aggregates/category distributions/seasonality, private Explorer/Home/Expense/render payload, screenshots/exports/reports, authenticated responses, OAuth/private clasp, backup bytes/key or private deployment locators.

`FREE_ONLY` mandatory. External paid analytics/search/table/CDN provider is not required.

## Canonical / derived hierarchy

```text
PRH_CANONICAL_TRANSACTION_V1       canonical data authority
        ↓
FIN-TRUTH-v1 / KPI Dictionary     financial semantics
        ↓
Analytics/read models              derived analysis
        ↓
Home / Expense Analytics / TX      derived private view state
        ↓
VIZ / UI                           presentation only
```

Lower layers cannot override higher financial/data authority. `EXP-020` is the single current R2 writer.
