# ПрихРасхOnline v2

Домашняя финансовая система на Google Sheets + Apps Script с приватным семейным Web Dashboard и GitHub как инженерным control plane.

> **Текущий статус:** доказаны **R0 platform baseline** (`MASTER-G0`, `MASTER-G1`, `MASTER-G2` complete) и **R1 Canonical Financial Platform** (`MASTER-G3` complete). R2 `DESIGN-020`, `VIZ-020`, `HOME-020`, `TX-020` прошли Main Verification. Текущий единственный writer — **EXP-020 Expense Analytics**, Issue #126.

## Принципы

- простота, гибкость, функциональность, модульность и сопровождаемость;
- financial truth определяется `PRH_CANONICAL_TRANSACTION_V1` + `FIN-TRUTH-v1` / versioned KPI Dictionary, а не legacy итоговыми ячейками или UI;
- public GitHub содержит только code/docs и **independently generated synthetic** financial fixtures/evidence;
- private Google Sheets остаётся current primary store/adapter; domain contracts не зависят от spreadsheet layout;
- `FREE_ONLY` — executable invariant: paid overage/provider не включается автоматически;
- generic Google canonical write fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`;
- DEV delivery автономна по exact SHA, но irreversible real-data actions требуют отдельного policy/owner boundary.

## Проверенная платформа

| Область | Contract / состояние |
|---|---|
| Financial truth | `PRH_KPI_DICTIONARY_V1` / `FIN-TRUTH-v1` — DONE |
| Canonical data | `PRH_CANONICAL_TRANSACTION_V1` — DONE |
| Pure application | `PRH_APPLICATION_CORE_V1` — DONE |
| Repository port | `PRH_TRANSACTION_REPOSITORY_V1` — DONE |
| Analytics | `PRH_ANALYTICS_CONTRACT_V1@1.0.0` — DONE |
| Read/performance | `PERF-010..014` — DONE |
| Design | `PRH_DESIGN_SYSTEM_V1@1.0.0` — DONE |
| Visualization | `PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` — DONE |
| Financial Home | `PRH_FINANCIAL_HOME_V1@1.0.0` — DONE |
| Transaction Explorer | `PRH_TRANSACTION_EXPLORER_V1@1.0.0` — DONE |
| Expense Analytics | `PRH_EXPENSE_ANALYTICS_V1@1.0.0` — IN_PROGRESS |

R1 20k/50k performance profiles are CI regression guardrails, not production SLA. Correctness/privacy remain higher priority than latency.

## EXP-020 Expense Analytics

Canonical document: [`docs/analytics/EXPENSE_ANALYTICS.md`](docs/analytics/EXPENSE_ANALYTICS.md).

EXP-020 строит read-only аналитику расходов без новой финансовой формулы:

- current/comparison Expense totals берутся из FIN-010 `evaluateKpis()`;
- trend bucket totals каждый раз проверяются через FIN-010 и обязаны суммироваться в period EXPENSE;
- category mix использует FIN-TRUTH partition: expense добавляет, refund уменьшает, transfer нейтрален;
- comparable periods — только явно заданные equal-day windows, без implicit proration;
- drivers показывают category contribution к изменению расходов, а их сумма обязана точно равняться total delta;
- VIZ-020 `LINE` / `DONUT` / `BAR` WidgetSpecs остаются configuration-only;
- drill-down сохраняет period/account/category/member context и ведёт в TX-020 Transaction Explorer без денежных значений в navigation state;
- `ExpenseAnalyticsWebApp.html` + Playwright дают synthetic responsive desktop/laptop/mobile evidence.

Expense Analytics не меняет FIN-TRUTH, canonical schema, AnalyticsQuery/Result или Google write policy.

## R2 verified foundations

### DESIGN-020

`PRH_DESIGN_SYSTEM_V1@1.0.0` provides semantic typography/colors/spacing/radius/elevation, explicit light/dark theme, focus-visible, reduced-motion and responsive breakpoints. No external paid design/CDN/font provider is required.

### VIZ-020

`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` provides configuration-only ChartSpec/WidgetSpec, FilterContext/DrillContext and replaceable ECharts 6.x adapter. Real render rows/options remain private; renderer does not own FIN/query/storage/write semantics.

### HOME-020

`PRH_FINANCIAL_HOME_V1@1.0.0` derives Home cards from one FIN-010 evaluation. Budget without explicit plan is `NOT_CONFIGURED`; liquidity remains `UNAVAILABLE_PENDING_BALANCE_SOURCE` until BAL-030 rather than using cash flow as a fake balance.

### TX-020

`PRH_TRANSACTION_EXPLORER_V1@1.0.0` provides deterministic canonical transaction search/filter/sort/pagination and schema-valid edit drafts. Explorer is a row projection, not a KPI engine. Runtime save remains `WRITE_BLOCKED` with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED` until a separately proven write policy exists.

## Private runtime

Web Dashboard remains private with access boundary `MYSELF`. **Private deployment URL is not published in README or release commits.** Existing Dashboard/Home/TX surfaces remain compatible; EXP synthetic browser surface does not silently create a new private route.

## Privacy and financial safety

- public tests do not use real or **real-derived** transaction rows, amounts, IDs, aggregates, distributions or screenshots;
- private Analytics/Home/Explorer/Expense/render payload is not public telemetry;
- generic Google financial write stays blocked until separately proven;
- historical `IRREVERSIBLE_ACTION_AUTHORIZED` from MIG-010 was exact-bound and cannot be reused;
- merge to `main` does not by itself authorize PROD cutover/destructive financial mutation.

## Автономная доставка

```text
Roadmap Issue: IN_PROGRESS
        ↓
agent/<ID>-<slug> PR to main
        ↓
PR Validation (zero deploy secrets)
        ↓
immutable exact-SHA Apps Script candidate
        ↓
Trusted DEV Deploy
        ↓
Trusted Runtime Health
        ↓
CI-003 autonomous squash merge
        ↓
Main Verification
        ↓
Issue: DONE
```

Manual merge, release-snapshot branches, anonymous private health probes and post-merge deployment-URL commits are not the normal delivery model.

## Recovery / observability / cost

- **DR-001:** owner-local encrypted backup + verify + isolated restore drill;
- **OBS-001:** bounded privacy-safe technical audit/telemetry without financial payload;
- **FINOPS-001:** executable `FREE_ONLY` circuit breaker for providers/cost.

## Документация

- [Executable Roadmap](docs/ROADMAP.md)
- [Текущий статус](docs/PROJECT_STATUS.md)
- [Архитектура](docs/architecture.md)
- [R1 C4/context](docs/architecture/R1_C4_CONTEXT.md)
- [R1 data lineage](docs/data/R1_DATA_LINEAGE.md)
- [Canonical Transaction](docs/data/CANONICAL_TRANSACTION_SCHEMA.md)
- [KPI Dictionary](docs/finance/KPI_DICTIONARY.md)
- [Expense Analytics](docs/analytics/EXPENSE_ANALYTICS.md)
- [Transaction Explorer](docs/architecture/TRANSACTION_EXPLORER.md)
- [Design system](docs/design/DESIGN_SYSTEM.md)
- [Visualization foundation](docs/architecture/VISUALIZATION_FOUNDATION.md)
- [Release process](docs/RELEASE_PROCESS.md)
- [Web Dashboard](docs/dashboard.md)
- [User guide](docs/user-guide.md)

## Что дальше

Текущий Roadmap item — `EXP-020`. До его Main Verification соседний writer не стартует. После EXP-020 следующий item выбирается строго по `docs/ROADMAP.md` dependencies/priority/order и live GitHub lifecycle.
