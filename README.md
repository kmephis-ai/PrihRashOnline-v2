# ПрихРасхOnline v2

Домашняя финансовая система на Google Sheets + Apps Script с приватным семейным Web Dashboard и GitHub как инженерным control plane.

> **Текущий статус:** R0/R1 canonical/security/delivery foundation доказан. Forensic baseline на 107 items: 75/107 = 70,1%; после добавления Recovery Wave текущая формальная доля = 75/116 = 64,7%. Ни один из этих issue-count показателей не равен overall Product Readiness ≈25%: private runtime binding есть у Home, остальные семь Daily routes не интегрированы. Текущий единственный writer — **GOV-REC-001**, Issue #219; R9/R10 frozen, ANL-090/PR #218 paused.

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
| Read/performance | `PERF-010..014` — DONE_ENGINEERING; canonical integration partial |
| Design | `PRH_DESIGN_SYSTEM_V1@1.0.0` — DONE_ENGINEERING |
| Visualization | `PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` — DONE_ENGINEERING; browser ECharts adapter unbound |
| Financial Home | `PRH_FINANCIAL_HOME_V1@1.0.0` — private-bound, product partial |
| Transaction Explorer | `PRH_TRANSACTION_EXPLORER_V1@1.0.0` — DONE_ENGINEERING, private route unbound |
| Expense Analytics | `PRH_EXPENSE_ANALYTICS_V1@1.0.0` — DONE_ENGINEERING, private route unbound |
| Income Analytics | `PRH_INCOME_ANALYTICS_V1@1.0.0` — DONE_ENGINEERING, private route unbound |

R1 20k/50k performance profiles are CI regression guardrails, not production SLA. Correctness/privacy remain higher priority than latency.

## INC-020 Income Analytics — engineering scope

Canonical document: [`docs/analytics/INCOME_ANALYTICS.md`](docs/analytics/INCOME_ANALYTICS.md).

INC-020 строит read-only аналитику доходов без альтернативной financial truth:

- current/comparison `INCOME` totals берутся из FIN-010 `evaluateKpis()`;
- time trend состоит из bounded DAY/MONTH/YEAR buckets, каждый имеет FIN-010 parity и exact conservation period total;
- source dimension — canonical income `category_id`, поэтому drill к TX-020 использует exact filter вместо fuzzy text search;
- source totals вычисляются FIN-TRUTH `aggregateTransactions()` внутри каждой canonical category group;
- comparable periods — только explicit equal-day windows, без implicit proration;
- variance/stddev/CV/stability score считаются только над FIN-backed bucket totals и являются explanatory statistics, а не финансовой формулой;
- source deltas обязаны точно суммироваться в total INCOME delta;
- VIZ-020 `LINE` / `DONUT` / `BAR` WidgetSpecs configuration-only; financial render payload separate/private;
- drill-down сохраняет period/account/source context и ведёт в TX-020 Transaction Explorer без денежных/variance значений в navigation state;
- `IncomeAnalyticsWebApp.html` + Playwright дают synthetic responsive desktop/laptop/mobile evidence.

Income Analytics не меняет FIN-TRUTH, canonical schema, AnalyticsQuery/Result или Google write policy.

## R2 engineering foundations

### DESIGN-020

`PRH_DESIGN_SYSTEM_V1@1.0.0` provides semantic typography/colors/spacing/radius/elevation, explicit light/dark theme, focus-visible, reduced-motion and responsive breakpoints. No external paid design/CDN/font provider is required.

### VIZ-020

`PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` provides configuration-only ChartSpec/WidgetSpec, FilterContext/DrillContext and replaceable ECharts 6.x adapter. Real render rows/options remain private; renderer does not own FIN/query/storage/write semantics.

### HOME-020

`PRH_FINANCIAL_HOME_V1@1.0.0` derives Home cards from one FIN-010 evaluation. Budget without explicit plan is `NOT_CONFIGURED`; liquidity remains `UNAVAILABLE_PENDING_BALANCE_SOURCE` until BAL-030 rather than using cash flow as a fake balance.

### TX-020

`PRH_TRANSACTION_EXPLORER_V1@1.0.0` provides deterministic canonical transaction search/filter/sort/pagination and schema-valid edit drafts. Explorer is a row projection, not a KPI engine. Runtime save remains `WRITE_BLOCKED` with `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED` until a separately proven write policy exists.

### EXP-020

`PRH_EXPENSE_ANALYTICS_V1@1.0.0` provides FIN-backed expense trend/category/comparison/drivers and exact TX drill. It is read-only and passed Main Verification.

## Private runtime

Web Dashboard remains private with access boundary `MYSELF`. **Private deployment URL is not published in README or release commits.** Current canonical router private-binds Home; TX/EXP/INC/CF/BUD/OBL/DQ fail closed until Recovery items prove bindings. Synthetic browser surfaces do not create private routes.

## Privacy and financial safety

- public tests do not use real or **real-derived** transaction rows, amounts, IDs, aggregates, distributions or screenshots;
- private Analytics/Home/Explorer/Expense/Income/render payload is not public telemetry;
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
Product Ready E2E (только work_class=user_facing)
        ↓
CI-003 autonomous squash merge
        ↓
Main Verification
        ↓
Issue: DONE_ENGINEERING или user-facing DONE
```

Manual merge, release-snapshot branches, anonymous private health probes and post-merge deployment-URL commits are not the normal delivery model.

## Recovery / observability / cost

- **DR-001:** owner-local encrypted backup + verify + isolated restore drill;
- **OBS-001:** bounded privacy-safe technical audit/telemetry without financial payload;
- **FINOPS-001:** executable `FREE_ONLY` circuit breaker for providers/cost.

## Документация

- [Executable Roadmap](docs/ROADMAP.md)
- [Текущий статус](docs/PROJECT_STATUS.md)
- [Product/Runtime forensic audit](docs/audits/PRODUCT_RUNTIME_FORENSIC_AUDIT_2026-08-11.md)
- [ADR Product Readiness governance](docs/adr/ADR-GOV-REC-001-PRODUCT-READINESS.md)
- [Архитектура](docs/architecture.md)
- [R1 C4/context](docs/architecture/R1_C4_CONTEXT.md)
- [R1 data lineage](docs/data/R1_DATA_LINEAGE.md)
- [Canonical Transaction](docs/data/CANONICAL_TRANSACTION_SCHEMA.md)
- [KPI Dictionary](docs/finance/KPI_DICTIONARY.md)
- [Expense Analytics](docs/analytics/EXPENSE_ANALYTICS.md)
- [Income Analytics](docs/analytics/INCOME_ANALYTICS.md)
- [Transaction Explorer](docs/architecture/TRANSACTION_EXPLORER.md)
- [Design system](docs/design/DESIGN_SYSTEM.md)
- [Visualization foundation](docs/architecture/VISUALIZATION_FOUNDATION.md)
- [Release process](docs/RELEASE_PROCESS.md)
- [Web Dashboard](docs/dashboard.md)
- [User guide](docs/user-guide.md)

## Что дальше

Текущий Roadmap item — `INC-020`. До его Main Verification соседний writer не стартует. После INC-020 следующий item выбирается строго по `docs/ROADMAP.md` dependencies/priority/order и live GitHub lifecycle.
