# Модель данных и границы записи

## Текущее положение

Google Sheets остаётся private primary store/current adapter. Public GitHub не является финансовой базой и не содержит real/real-derived household finance data.

R1 (`FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010`) завершён Main Verification; `MASTER-G3 / Canonical platform` complete. R2 `DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020`, `EXP-020` — DONE. Текущий единственный writer — `INC-020`.

## Основные private sheets

| Лист | Роль | Write boundary |
|---|---|---|
| `01 Операции` | canonical transaction surface | Dashboard/Home/TX/EXP/INC read-only; mutation only by separately proven policy |
| `09 Настройки` | technical settings/status | bounded technical writes |
| `10 Контроль` | private KPI/control snapshots | separately authorized append/readback |
| `11 Предпросмотр` | proposal staging/review | proposal state, not canonical truth |
| `13 Журнал` | privacy-safe technical audit | bounded technical append |
| `14 Аналитика` | spreadsheet analytics/fallback | not canonical FIN truth |

Generic Google canonical write remains fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Financial truth

`PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1` owns Income / Expense / Cash Flow / Savings / Budget variance semantics, transfer/refund behavior, integer minor units and explicit period/currency rules.

Legacy totals are not golden truth. Analytics, performance, VIZ, HOME, TX, EXP and INC do not create alternative financial formulas.

## Canonical Transaction v1

`PRH_CANONICAL_TRANSACTION_V1` defines stable transaction identity, RFC3339 occurred time, type/status, integer `amount_minor`, currency, household dimensions and provenance.

`source_position` is mutable adapter provenance and **не является logical identity**. Spreadsheet columns/header order are adapter concerns.

## Repository / storage

`PRH_TRANSACTION_REPOSITORY_V1` separates canonical data from storage. Current Google adapter supports read/query. Generic Google write is blocked by `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Analytics / performance — DONE

`ANL-010` — DONE; `PRH_ANALYTICS_RESULT_V1` is a derived read model, not persistence/financial authority.  
`PERF-010..014` — DONE; projection/cache/single-scan/incremental aggregates/synthetic scale are derived read/performance layers and do not authorize writes.

## DESIGN / VIZ / HOME / TX / EXP — DONE

Design theme/layout state is presentation-only. VIZ specs are configuration-only; real renderer datasets/options remain private transient data. `PRH_FINANCIAL_HOME_VIEW_V1`, `PRH_TRANSACTION_EXPLORER_RESULT_V1` and `PRH_EXPENSE_ANALYTICS_VIEW_V1` are derived private views and do not create storage authority.

TX edit-draft `VALID` means schema-valid only; runtime save remains `WRITE_BLOCKED` with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## INC-020 Income Analytics view model

Machine contract: `PRH_INCOME_ANALYTICS_V1@1.0.0`. View schema: `PRH_INCOME_ANALYTICS_VIEW_V1`.

INC-020 adds **no canonical entity and no persistent table**. It consumes canonical transactions and FIN-backed results to produce transient analysis state.

### Period/comparison state

`period` and `comparison_period` are explicit start-inclusive/end-exclusive windows. Comparison is allowed only for equal day counts; no implicit proration is stored or inferred.

### Financial values

- `total_income_minor` and `comparison_income_minor` are FIN-010 `evaluateKpis()` results;
- trend bucket `income_minor` values are separate FIN-010 evaluations;
- source mix groups canonical rows by income `category_id`, then evaluates every group through FIN-TRUTH `aggregateTransactions()`;
- source `delta_minor` is current source Income minus comparison source Income and must conserve the total Income delta.

These are derived read values. They do not become canonical transaction fields or persisted financial truth.

### Source identity

Current source semantics: `CANONICAL_INCOME_CATEGORY_AS_SOURCE`. `category_id` is used because TX-020 supports exact `category_ids` drill. Counterparty/description fuzzy matching is not used as source identity.

Source partition must exactly equal FIN INCOME and residual must be zero. A negative source bucket is fail-closed for DONUT ambiguity.

### Stability / variance state

`variance_minor2`, `stddev_minor`, `coefficient_of_variation` and `stability_score` are derived statistics over FIN-backed trend bucket totals:

- population variance;
- stddev = sqrt(variance);
- CV = stddev / abs(mean);
- score = `round(100 - min(100, CV*100))`;
- zero mean → state `NO_INCOME`, null CV/score.

These fields do not alter `INCOME` and are not FIN-TRUTH.

### Visualization state

`PRH_WIDGET_SPEC_V1` / `PRH_CHART_SPEC_V1` remain configuration-only and contain no financial rows/amount payload. Real `PRH_VISUALIZATION_RENDER_DATASET_V1` values are private transient runtime data. Public fixtures use independently generated synthetic values only.

### Drill/navigation state

`PRH_INCOME_DRILL_ENVELOPE_V1` contains period + `PRH_DRILL_CONTEXT_V1` + normalized TX-020 query. It preserves account/category/member filters but intentionally contains no amount/income/delta/variance values.

Navigation state does not grant write authority. TX remains the canonical transaction destination and its save path remains blocked without a separate write policy.

### Telemetry

Public INC telemetry allowlist is schema/version/query hash/context hash/bucket/source counts/stability state/status/reason/timing. Real amounts, source/category IDs, transaction IDs and private filter values are not public telemetry.

## EXP-020 historical verified view

`PRH_EXPENSE_ANALYTICS_V1@1.0.0` / `PRH_EXPENSE_ANALYTICS_VIEW_V1` is DONE/Main Verification PASS. Expense trend/category/drivers remain derived FIN-backed read state and do not create write/storage authority.

## MIG-010 historical boundary

MIG-010 deterministic full-history migration — **DONE / OWNER_VERIFIED**. Private post-write evidence: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, `provenanceComplete=true`, `idempotentRerunNoop=true`, `rollbackCanBeReleased=true`.

Owner-confirmed occurrence identity remains `CONTENT_FINGERPRINT_OCCURRENCE_V1`. Historical execution policy remains `MIG010_EXECUTION_POLICY_V1@1.0.0`; `FINALIZED_PENDING_RECONCILIATION` was not completion before post-write reconciliation.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` was exact-bound/non-reusable; GitHub Actions cannot create it, GitHub Actions/AI cannot reuse it for future edits. Generic Google write authority remains false.

## Recovery / observability

DR-001 owner backup is private/encrypted. OBS telemetry permits technical metadata only; financial values, canonical rows and private Analytics/Home/TX/EXP/INC/render payload are not public telemetry.

## Public GitHub privacy boundary

Allowed: code/contracts/docs, independently generated synthetic finance/Home/TX/EXP/INC/render fixtures and technical PASS/FAIL/hash/count/timing evidence.

Forbidden: real or **real-derived** transaction rows/IDs/amounts/totals/aggregates/source/category distributions/seasonality, private Explorer/Home/Expense/Income/render payload, screenshots/exports/reports, authenticated responses, OAuth/private clasp, backup bytes/key or private deployment locators.

`FREE_ONLY` mandatory. External paid analytics/search/table/CDN provider is not required.

## Canonical / derived hierarchy

```text
PRH_CANONICAL_TRANSACTION_V1       canonical data authority
        ↓
FIN-TRUTH-v1 / KPI Dictionary     financial semantics
        ↓
Analytics/read models              derived analysis
        ↓
Home / Expense / Income / TX       derived private view state
        ↓
VIZ / UI                           presentation only
```

Lower layers cannot override higher financial/data authority. `INC-020` is the single current R2 writer.
