# Модель данных и границы записи

## Текущее положение

Google Sheets остаётся private primary store/current adapter. Public GitHub не является финансовой базой и не содержит real/real-derived household finance data.

R1 (`FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010`) завершён Main Verification; `MASTER-G3 / Canonical platform` complete. R2 `DESIGN-020` и `VIZ-020` также DONE. Текущий единственный R2 writer — `HOME-020`; он добавляет derived Financial Home view model и не меняет canonical/write semantics.

Canonical lineage: `docs/data/R1_DATA_LINEAGE.md`. Machine documentation map: `PRH_R1_DOCUMENTATION_V1@1.0.0`. Presentation: `PRH_DESIGN_SYSTEM_V1@1.0.0`. Visualization: `PRH_VISUALIZATION_FOUNDATION_V1@1.0.0`. Home: `PRH_FINANCIAL_HOME_V1@1.0.0`.

## Основные private sheets

| Лист | Роль | Write boundary |
|---|---|---|
| `01 Операции` | canonical transaction surface | Dashboard/Home read-only; future mutation only by separately proven policy |
| `09 Настройки` | technical settings/status | bounded technical writes only |
| `10 Контроль` | private KPI/control snapshots | only separately authorized append/readback |
| `11 Предпросмотр` | quality proposal staging/review | proposal state, not canonical transaction truth |
| `13 Журнал` | privacy-safe technical audit | bounded technical append |
| `14 Аналитика` | existing spreadsheet analytics/fallback | not canonical analytics/FIN truth |

Наличие UI, query, cache, visualization или Home contract не является разрешением записи. Generic Google canonical write остаётся fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Financial truth

KPI Dictionary `PRH_KPI_DICTIONARY_V1@1.0.0` / `FIN-TRUTH-v1` задаёт authoritative semantics Income / Expense / Cash Flow / Savings / Budget variance, transfer neutrality, refund behavior, integer minor units и period/currency rules.

Legacy totals/cells не являются golden truth. Analytics, performance read models, visualization и Home не дублируют formulas.

## Canonical Transaction v1

`PRH_CANONICAL_TRANSACTION_V1` определяет portable record со stable transaction identity, RFC3339 occurred time, type/status, integer `amount_minor`, currency, dimensions и provenance.

`source_position` — mutable adapter provenance и **не является logical identity**. Google column layout/header naming — adapter concern.

## Repository / storage boundary

`PRH_TRANSACTION_REPOSITORY_V1` отделяет canonical model от storage. Current Google adapter поддерживает read/query. In-memory synthetic fake может иметь explicit test write authority. Current Google generic write всегда blocked `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## AnalyticsQuery / AnalyticsResult — ANL-010 — DONE

`PRH_ANALYTICS_CONTRACT_V1@1.0.0` renderer/storage-neutral. `AnalyticsResult` — derived read model, не новый financial source of truth или persistence authority. Real analytics results/aggregates остаются private.

ANL-010 завершён и не является current writer.

## DESIGN-020 — DONE

`PRH_DESIGN_SYSTEM_V1@1.0.0` описывает visual tokens/theme/focus/motion/breakpoints. Theme/layout state не меняет canonical records, FIN-TRUTH или AnalyticsQuery/Result и не получает persistence/write authority.

## VIZ-020 — DONE

`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` разделяет:

- configuration-only `PRH_CHART_SPEC_V1` / `PRH_WIDGET_SPEC_V1`;
- deterministic `PRH_FILTER_CONTEXT_V1` / `PRH_DRILL_CONTEXT_V1`;
- transient `PRH_VISUALIZATION_RENDER_DATASET_V1` для private runtime rendering.

ChartSpec/WidgetSpec рекурсивно запрещают rows/data/transactions/amount payload. Real renderer dataset/compiled option остаются private in-memory data, не persistence model и не public evidence. VIZ layer не получает query/storage/network/financial-write authority.

## HOME-020 — derived Financial Home view model

Machine contract: `PRH_FINANCIAL_HOME_V1@1.0.0`. Runtime view schema: `PRH_FINANCIAL_HOME_VIEW_V1`.

Home view является **derived private read/view model**, а не canonical entity или storage table.

### Financial cards

`INCOME`, `EXPENSE`, `CASH_FLOW`, `SAVINGS` и `BUDGET` происходят из одного FIN-010 `evaluateKpis()` result. Home не вычисляет KPI formulas повторно и не записывает полученные значения обратно в source sheets.

### Explicit budget input

Budget допускается только как explicit `budget_minor` того же period/currency, переданный FIN-010 evaluator. Home не сохраняет budget plan и не выводит его из history.

Без explicit plan:

```text
BUDGET.state = NOT_CONFIGURED
budget_minor = null
variance_minor = null
```

### Liquidity is not cash flow

HOME-020 намеренно не создаёт liquidity value без versioned balance observation source:

```text
LIQUIDITY.state = UNAVAILABLE_PENDING_BALANCE_SOURCE
value_minor = null
source = null
cash_flow_proxy_used = false
future_dependency = BAL-030
```

Cash flow — period flow metric, не stock/balance. Использование `CASH_FLOW` как liquidity balance proxy запрещено. HOME-020 имеет `balance_observation=false` authority.

### Explainable alerts

Home alerts — derived capability/read state, не persisted financial records:

- `NEGATIVE_CASH_FLOW` sourced from FIN KPI `CASH_FLOW`;
- `BUDGET_OVERRUN` sourced from FIN KPI `BUDGET_VARIANCE`;
- `BUDGET_NOT_CONFIGURED` sourced from explicit budget capability state;
- `LIQUIDITY_SOURCE_UNAVAILABLE` sourced from missing versioned balance capability.

Alerts не создают hidden financial formulas или writes.

### Drill/filter navigation state

`PRH_HOME_DRILL_ENVELOPE_V1` переносит explicit FIN period + VIZ `PRH_DRILL_CONTEXT_V1` / `PRH_FILTER_CONTEXT_V1`. Navigation state содержит semantic filters/context hash, но не financial values (`amount_minor`, income/expense/cash-flow/budget values).

### Home visualization data

Home WidgetSpecs configuration-only. Real `PRH_FINANCIAL_HOME_VIEW_V1`, render dataset и renderer option остаются private runtime data. Public Home tests/screenshots используют independently generated synthetic values only.

### Persistence authority

HOME-020 не создаёт новую таблицу/sheet/cache и имеет:

```text
financial_truth = false
query = false
storage = false
network = false
financial_write = false
balance_observation = false
```

Откат HOME-020 не требует data migration или financial rollback.

## R1 performance/read-model layers — PERF-010..014 — DONE

- `PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` — minimal mapped Google reads;
- `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` — exact-revision read reuse;
- `PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` — one immutable snapshot per bounded refresh;
- `PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0` — affected-bucket derived materializations;
- `PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0` — independently generated synthetic 20k/50k regression gate.

PERF-010..014 завершены, не являются current writer, не становятся canonical truth и не открывают writes. PERF-014 timings — CI guardrails, не production SLA.

## Source-to-canonical provenance / MIG-010

MIG-010 full-history migration DONE/OWNER_VERIFIED. Private post-write reconciliation: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, provenance complete, idempotent rerun verified.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` была exact-bound/non-reusable. GitHub Actions/AI не могут создать или повторно использовать её для future mutations. Generic Google write authority не изменилась.

## Recovery / observability

DR-001 owner backup остаётся private/encrypted. OBS-001/OBS-010 принимают allowlisted technical evidence; financial values, canonical rows, private analytics/Home aggregates/render options не telemetry.

## Public GitHub privacy boundary

Допустимы code/contracts/docs, independently generated synthetic finance/Home/render fixtures и technical PASS/FAIL/hash/count/timing evidence.

Запрещены real или **real-derived** transaction rows/IDs/amounts/totals/aggregates/category distributions/seasonality, real Home view/render payload, private screenshots/exports/reports, authenticated Dashboard/API bodies, OAuth/private clasp, backup bytes/key и private deployment locators.

`FREE_ONLY` mandatory. External paid/cloud/CDN dependency для DESIGN/VIZ/HOME не требуется.

## Canonical / view hierarchy

```text
PRH_CANONICAL_TRANSACTION_V1       canonical data
        ↓
FIN-TRUTH-v1 / KPI Dictionary     financial semantics
        ↓
PRH_ANALYTICS_RESULT_V1            derived analytics read model
        ↓
VIZ transient render dataset       private renderer input
        ↓
PRH_FINANCIAL_HOME_VIEW_V1         derived private Home composition
        ↓
UI                                presentation only
```

Ни один lower layer не может переопределить higher financial/data authority. `HOME-020` — единственный current R2 writer; dependent Roadmap work не начинается до его Main Verification.
