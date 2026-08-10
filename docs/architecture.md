# Архитектура ПрихРасхOnline v2

## Текущее состояние

ПрихРасхOnline v2 — приватное домашнее финансовое приложение на Google Sheets + Apps Script. GitHub является инженерным **control plane** для code/tests/contracts/docs/policy и не является financial data store.

R0 (`MASTER-G0..G2`) и R1 `MASTER-G3 / Canonical platform` завершены. `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010`, а также R2 `DESIGN-020` и `VIZ-020` прошли Main Verification. Текущий единственный R2 writer — `HOME-020`.

Канонические entry points:

- `docs/ROADMAP.md` — executable order/dependencies;
- `docs/architecture/R1_C4_CONTEXT.md` — R1 C4/context + trust boundaries;
- `docs/data/R1_DATA_LINEAGE.md` — end-to-end data lineage;
- `lib/documentation/r1_documentation.v1.json` — machine R1 documentation map;
- `docs/design/DESIGN_SYSTEM.md` + `lib/design/design_system.v1.json` — DESIGN-020;
- `docs/architecture/VISUALIZATION_FOUNDATION.md` + `lib/visualization/visualization_foundation.v1.json` — VIZ-020;
- `lib/home/financial_home.v1.json` + `lib/home/financial_home.js` — HOME-020 Financial Home;
- `FinancialHomeWebApp.html` — responsive Home browser surface/synthetic visual evidence.

Google Sheets/GAS — текущий adapter/runtime, а не domain boundary. Storage portability сохраняется через `PRH_TRANSACTION_REPOSITORY_V1`.

## Компоненты

| Компонент | Authority / роль |
|---|---|
| Google Sheets | private primary store/current adapter |
| `01 Операции` | canonical transaction surface |
| Apps Script | current private owner runtime |
| `lib/domain/**` | canonical transaction semantics |
| `lib/finance/**` | `FIN-TRUTH-v1` / KPI authority |
| `lib/application/**` | pure use cases; no I/O/network/write authority |
| `lib/analytics/**` | renderer/storage-neutral analytics + read models |
| `lib/repository/**` | storage-neutral repository/cache/refresh boundaries |
| `lib/adapters/**` | platform/storage adapters |
| `lib/design/**` | presentation tokens/theme/a11y/responsive semantics |
| `lib/visualization/**` | renderer-neutral ChartSpec/WidgetSpec/interaction + replaceable renderer adapter |
| `lib/home/**` | FIN-backed Financial Home composition; no alternative KPI formulas |
| `DashboardWebApp.html` | existing private Dashboard UI |
| `FinancialHomeWebApp.html` | HOME-020 responsive Home surface; no silent route/cutover claim |
| GitHub Actions | exact-SHA validation/delivery control plane |

## Основной read/view поток

```text
private Google Sheets
        ↓
GoogleTransactionRepositoryGateway.js
        ↓
PRH_TRANSACTION_REPOSITORY_V1
        ↓
PRH_CANONICAL_TRANSACTION_V1
        ↓
FIN-TRUTH-v1 / PRH_KPI_DICTIONARY_V1
        ↓
PRH_ANALYTICS_CONTRACT_V1@1.0.0
        ↓ optional read optimizations
PERF-010..014
        ↓
PRH_VISUALIZATION_FOUNDATION_V1@1.0.0
        ↓
PRH_FINANCIAL_HOME_V1@1.0.0
  single FIN result + capability states + VIZ drill contexts
        ↓
private family UI / responsive Home view
        ↓ presentation only
PRH_DESIGN_SYSTEM_V1@1.0.0
```

Financial Home не становится новой финансовой истиной: FIN-010 остаётся authority для KPI semantics.

## Canonical transaction + financial truth

Canonical schema: `PRH_CANONICAL_TRANSACTION_V1`. KPI contract: `PRH_KPI_DICTIONARY_V1@1.0.0`, policy `FIN-TRUTH-v1`.

Legacy итоговые ячейки не являются golden truth. Financial calculations используют canonical transactions + FIN-010 evaluator. HOME-020 не реализует собственные income/expense/cash-flow/savings/budget formulas.

## Pure application boundary — ARCH-010

`PRH_APPLICATION_CORE_V1` имеет `io_authority: false`, `network_authority: false`, `financial_write_authority: false`. `SpreadsheetApp`, DOM/UI и network services запрещены внутри pure core.

## Repository boundary — ARCH-011

`PRH_TRANSACTION_REPOSITORY_V1` отделяет canonical model от storage. Current Google adapter поддерживает bounded reads/query. Generic Google canonical write остаётся fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

`source_position` — mutable adapter provenance, не logical transaction identity.

## Analytics boundary — ANL-010

`PRH_ANALYTICS_CONTRACT_V1@1.0.0` renderer/storage-neutral и делегирует financial measures FIN-010 `evaluateKpis()`. Authority: `io=false`, `network=false`, `financial_write=false`, `ui=false`.

ANL-010 завершён; он не является current writer.

## R2 design boundary — DESIGN-020 — DONE

`PRH_DESIGN_SYSTEM_V1@1.0.0` задаёт semantic typography/spacing/radius/elevation/colors/focus/motion, explicit light/dark theme boundary, `:focus-visible`, reduced-motion и responsive breakpoints 760/1250 px.

Design contract не имеет FIN/query/storage/write authority. External CDN/font/design provider не требуется; `FREE_ONLY` mandatory.

## R2 visualization boundary — VIZ-020 — DONE

`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` определяет:

- configuration-only `PRH_CHART_SPEC_V1` / `PRH_WIDGET_SPEC_V1`;
- registry `BAR`, `LINE`, `DONUT`;
- deterministic `PRH_FILTER_CONTEXT_V1` / `PRH_DRILL_CONTEXT_V1`;
- transient `PRH_VISUALIZATION_RENDER_DATASET_V1`;
- replaceable primary browser adapter `ECHARTS_6` with `LOCAL_OR_BUNDLED` loading policy.

Persistable specs рекурсивно запрещают rows/data/transactions/amount payload. Real render dataset/compiled renderer option — private in-memory data и не public evidence. Renderer не имеет query/network/storage/persistence/financial-write authority. Existing Dashboard native SVG path остаётся совместимым до explicit migration.

## R2 Financial Home boundary — HOME-020 — IN_PROGRESS

Machine contract: `lib/home/financial_home.v1.json` (`PRH_FINANCIAL_HOME_V1@1.0.0`). View model: `PRH_FINANCIAL_HOME_VIEW_V1`. Implementation: `lib/home/financial_home.js`.

### Financial value source

`buildFinancialHome()` выполняет один FIN-010 `evaluateKpis()` и затем композитит Home view. Карточки `INCOME`, `EXPENSE`, `CASH_FLOW`, `SAVINGS` и `BUDGET` получают values/provenance из этого результата. `kpi_evaluation_count=1`, `ui_financial_formula_used=false`.

### Budget fail-safe

Budget существует только при explicit `budget_minor`, переданном в тот же FIN-010 evaluation для того же explicit period/currency. Если plan отсутствует:

```text
BUDGET.state = NOT_CONFIGURED
variance_minor = null
```

Implicit plan, inference from history и UI-side variance formula запрещены.

### Liquidity fail-safe

Периодный cash flow не является балансом и не может использоваться как liquidity proxy. Пока versioned balance-observation source не реализован:

```text
LIQUIDITY.state = UNAVAILABLE_PENDING_BALANCE_SOURCE
value_minor = null
source = null
cash_flow_proxy_used = false
future_dependency = BAL-030
```

HOME-020 не получает `balance_observation` authority.

### Explainable alerts

Versioned alerts строятся только из already-evaluated FIN values или capability states:

- `NEGATIVE_CASH_FLOW` → source KPI `CASH_FLOW`;
- `BUDGET_OVERRUN` → source KPI `BUDGET_VARIANCE`;
- `BUDGET_NOT_CONFIGURED` → budget capability state;
- `LIQUIDITY_SOURCE_UNAVAILABLE` → liquidity capability state.

Alert rule не выполняет hidden financial calculation.

### Drill/filter state

`PRH_HOME_DRILL_ENVELOPE_V1` сохраняет:

- explicit FIN period;
- VIZ `PRH_DRILL_CONTEXT_V1`;
- normalized `PRH_FILTER_CONTEXT_V1` + deterministic context hash.

Financial values не помещаются в navigation state/URL. Filter/drill identity не становится financial source of truth.

### Home visualizations

HOME-020 использует configuration-only VIZ WidgetSpecs:

- `home-cash-flow-trend`: `LINE`, `time_bucket -> CASH_FLOW`;
- `home-expense-mix`: `DONUT`, `category_id -> EXPENSE`.

Widget specs не содержат runtime rows/amounts. Real Home view/render payload остаётся private. Public tests/screenshots используют independently generated synthetic values only.

### Browser/runtime scope

`FinancialHomeWebApp.html` реализует responsive desktop/laptop/mobile Home surface и synthetic Playwright evidence. HOME-020 не утверждает новый private Apps Script route или automatic replacement existing Dashboard без отдельной integration boundary.

Named gates: `Financial Home`, `Financial Home visual gate`.

## R1 performance architecture — PERF-010..014 — DONE

| ID | Machine contract | Authority |
|---|---|---|
| PERF-010 | `PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` | minimal bounded Google read plan |
| PERF-011 | `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` | exact-revision read reuse |
| PERF-012 | `PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` | one immutable snapshot per bounded refresh |
| PERF-013 | `PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0` | affected-bucket read-model materialization |
| PERF-014 | `PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0` | synthetic 20k/50k CI regression guardrail |

PERF-010..014 завершены и не являются current writer. Они не создают альтернативную FIN truth и не открывают financial writes. PERF-014 wall-clock ceilings — CI guardrails, не production SLA.

## MIG-010 historical boundary

MIG-010 завершён OWNER_VERIFIED private reconciliation: `MIG010_OWNER_POST_RECONCILIATION_V1 = PASS`, `unexplainedMismatch=0`, provenance complete, idempotent rerun verified.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` была exact-bound/non-reusable. GitHub Actions/AI не могут создать или повторно использовать её для future mutations. Generic repository write authority не изменилась.

## Trust/privacy boundaries

### Public GitHub

Разрешены code/contracts/docs, independently generated synthetic finance/render/Home fixtures и technical PASS/FAIL/hash/count/timing evidence.

Запрещены real/real-derived transaction values/aggregates/distributions, real Home view/render payload, private screenshots/exports, authenticated responses, OAuth, backup bytes/keys и private deployment locators.

### Private owner runtime

Google Sheets + Apps Script имеют доступ к private household data. Web App остаётся `MYSELF`. Real AnalyticsResult/Home view/render option остаются private runtime data.

## Observability / FREE_ONLY

OBS-001/OBS-010 telemetry техническая и bounded; financial/raw/Home payload не telemetry. `FREE_ONLY` mandatory. External CDN/paid design/visualization/Home provider не требуется.

## Delivery trust chain

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

Delivery PASS не является mutation authorization.

## Dashboard/application writes

Dashboard, HOME-020, DESIGN-020, VIZ-020, ANL-010, PERF-010..014 не имеют financial write authority. Current generic Google write remains `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Future canonical mutation требует отдельного versioned policy contract, bounded scope, idempotency, backup/rollback, audit/readback/private reconciliation и — для irreversible action — нового owner authorization.

## Целевая архитектура

```text
PWA / family clients
        ↓
Financial Home / domain dashboards
        ↓
PRH_DESIGN_SYSTEM_V1 + PRH_VISUALIZATION_FOUNDATION_V1
        ↓
Application services + AnalyticsQuery/Result
        ↓
Pure canonical domain + FIN/KPI rules
        ↓
PRH_TRANSACTION_REPOSITORY_V1
        ↓
Google Sheets adapter  <->  future YDB adapter
```

Cross-cutting: auth, privacy, audit/telemetry, `FREE_ONLY`, recovery, exact revision, deterministic interaction identity and idempotency.

## Documentation authority / fail-closed

Source precedence: security/privacy/cost/irreversible policy → `docs/ROADMAP.md` + live Issues → exact-SHA code/tests/workflows/evidence → versioned contracts → human docs.

Delivery останавливается, если identity, privacy, FIN correctness, query/read-model parity, visualization/Home contract validity, recovery/cost/runtime evidence не доказаны. Markdown не может override red gate; красный CI исправляется на том же writer branch.
