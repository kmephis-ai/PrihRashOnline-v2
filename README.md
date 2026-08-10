# ПрихРасхOnline v2

Домашняя финансовая система на Google Sheets + Apps Script с приватным Web Dashboard и GitHub как инженерным control plane.

> **Текущий статус:** доказаны **R0 platform baseline** (`MASTER-G0`, `MASTER-G1`, `MASTER-G2` complete) и **R1 Canonical Financial Platform** (`MASTER-G3` complete). `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014`, `DOC-010` прошли Main Verification. В R2 `DESIGN-020` DONE; текущий writer — `VIZ-020` (versioned visualization foundation).

## Принципы

- простота и сопровождаемость важнее лишней инфраструктуры;
- финансовая истина определяется canonical transaction rules + versioned KPI Dictionary (`FIN-TRUTH-v1`), а не legacy итоговыми ячейками;
- публичный GitHub содержит только код, документацию и **independently generated synthetic** financial fixtures/evidence;
- private Google Sheets остаётся текущим primary store/adapter, а domain/analytics contracts не зависят от spreadsheet layout;
- обычная инженерная доставка полностью автоматизирована, но privacy, paid-service activation и irreversible production-data actions остаются policy boundaries;
- `FREE_ONLY` — исполняемый invariant: неизвестный billable provider fail-closed, paid overage автоматически не включается;
- performance layers могут уменьшать reads/recompute, но не могут переопределять финансовую семантику или открывать write authority;
- presentation/design/visualization layers не владеют financial/query/storage semantics и не публикуют private financial payload.

## Каноническая R1 архитектура

Основной read lineage:

```text
private Google Sheets
  -> Apps Script Google repository gateway / adapter
  -> PRH_TRANSACTION_REPOSITORY_V1
  -> PRH_CANONICAL_TRANSACTION_V1
  -> FIN-TRUTH-v1 / PRH_KPI_DICTIONARY_V1
  -> PRH_ANALYTICS_CONTRACT_V1
  -> private MYSELF Web Dashboard
```

Подробные проверяемые карты:

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — единственная Executable GitHub Roadmap;
- [`docs/architecture/R1_C4_CONTEXT.md`](docs/architecture/R1_C4_CONTEXT.md) — C4/context и trust boundaries;
- [`docs/data/R1_DATA_LINEAGE.md`](docs/data/R1_DATA_LINEAGE.md) — source → canonical → KPI/analytics → performance/read models → UI;
- [`lib/documentation/r1_documentation.v1.json`](lib/documentation/r1_documentation.v1.json) — machine-readable R1 documentation map.

## R1 canonical/performance foundation

| Область | Проверенный контракт |
|---|---|
| Финансовая истина | `PRH_KPI_DICTIONARY_V1` / `FIN-TRUTH-v1` |
| Canonical data | `PRH_CANONICAL_TRANSACTION_V1` |
| Pure application | `PRH_APPLICATION_CORE_V1` |
| Repository port | `PRH_TRANSACTION_REPOSITORY_V1` |
| Analytics | `PRH_ANALYTICS_CONTRACT_V1@1.0.0` |
| SLO/error budget | `PRH_SLO_ERROR_BUDGET_V1@1.0.0` |
| Minimal Google reads | `PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0` |
| Exact-revision cache | `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0` |
| One-scan refresh | `PRH_SINGLE_SCAN_REFRESH_V1@1.0.0` |
| Incremental aggregates | `PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0` |
| Synthetic scale gate | `PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0` |
| R1 documentation | `PRH_R1_DOCUMENTATION_V1@1.0.0` |

`PERF-014` проверяет independently generated synthetic 20k/50k operations как CI regression guardrail. Его wall-clock ceilings — не пользовательский SLA; correctness/parity остаётся выше latency.

Generic Google canonical write по-прежнему fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## R2 design system — DESIGN-020

`DESIGN-020` завершён Main Verification. Presentation contract: [`docs/design/DESIGN_SYSTEM.md`](docs/design/DESIGN_SYSTEM.md) + [`lib/design/design_system.v1.json`](lib/design/design_system.v1.json), machine schema `PRH_DESIGN_SYSTEM_V1@1.0.0`.

DESIGN-020 стандартизует typography/spacing/radius/elevation/semantic colors/focus/motion, explicit light/dark theme boundary и system theme preference. `:focus-visible` и `prefers-reduced-motion` являются обязательными accessibility boundaries; responsive shell сохраняет проверенные breakpoints 760/1250 px и существующие 10 top-level tabs. Ключевые normal-text пары имеют WCAG-oriented contrast >=4.5:1.

Design layer не меняет FIN-TRUTH, canonical schema, AnalyticsQuery/Result, storage или write authority. External CDN/font/design provider не требуется, `FREE_ONLY` сохраняется.

## R2 visualization foundation — VIZ-020

Текущий R2 contract: [`docs/architecture/VISUALIZATION_FOUNDATION.md`](docs/architecture/VISUALIZATION_FOUNDATION.md) + [`lib/visualization/visualization_foundation.v1.json`](lib/visualization/visualization_foundation.v1.json), machine schema `PRH_VISUALIZATION_FOUNDATION_V1@1.0.0`.

VIZ-020 вводит:

- configuration-only `PRH_CHART_SPEC_V1` / `PRH_WIDGET_SPEC_V1`;
- machine chart registry для `BAR`, `LINE`, `DONUT`;
- deterministic `PRH_FILTER_CONTEXT_V1` / `PRH_DRILL_CONTEXT_V1`;
- transient `PRH_VISUALIZATION_RENDER_DATASET_V1` для private in-memory renderer path;
- replaceable primary browser renderer baseline `ECHARTS_6` по [`ADR-VIZ-020-ECHARTS-6`](docs/adr/ADR-VIZ-020-ECHARTS-6.md).

ChartSpec/WidgetSpec не могут содержать rows/data/transactions/amount payload. ECharts option создаётся adapter-ом только из normalized spec + runtime dataset и не получает query/network/storage/persistence/financial-write authority. Real render dataset/option остаются private; public tests synthetic-only. External CDN/provider не требуется; loading policy `LOCAL_OR_BUNDLED`; `FREE_ONLY` сохраняется.

Existing Dashboard native SVG charts пока остаются active renderer path: VIZ-020 создаёт foundation, но не делает silent UI cutover. HOME-020 и остальные VIZ-dependent dashboards начнутся только после VIZ-020 Main Verification.

## AI agents

Root [`AGENTS.md`](AGENTS.md) — обязательный repository AI operating contract. Он фиксирует source precedence, Autonomy Contract v2, one-writer lifecycle, public/private data classification, `FREE_ONLY`, exact machine gates, financial-write/migration policy и CI-red recovery.

Короткие public-safe entry points:

- [`.ai-context/PROJECT_CONTEXT.md`](.ai-context/PROJECT_CONTEXT.md)
- [`llms.txt`](llms.txt)

Private household/runtime/credential/backup context в эти файлы не добавляется.

## Dashboard

Web Dashboard остаётся основным пользовательским интерфейсом текущей Google Apps Script реализации. DEV Web App закрыт границей доступа `MYSELF`.

**Приватный deployment URL не публикуется и не поддерживается через README/release commits.** Владелец открывает Dashboard через доверенный private deployment/book menu или собственную локальную закладку. Отсутствие публичной ссылки не является ошибкой release pipeline.

Dashboard сохраняет 10 представлений, Executive KPI, read-only drill-down, единый refresh, Quality Workbench и responsive desktop/laptop/mobile UI. DESIGN-020 перевёл shell на semantic `--ds-*` CSS tokens без изменения существующей финансовой/query логики. VIZ-020 добавляет reusable renderer-neutral visualization foundation, не меняя текущий native SVG renderer автоматически. UI/renderer не являются authority для KPI formulas.

## Финансовая и data safety модель

- public tests/fixtures не используют реальные или **real-derived** финансовые значения, агрегаты, распределения, seasonality, IDs или screenshots;
- financial reconciliation строится из canonical transaction semantics; legacy totals не являются golden truth;
- canonical schema и repository/analytics/visualization layers не разрешают запись сами по себе;
- ChartSpec/WidgetSpec не хранят financial payload; real runtime renderer data/options не публикуются;
- `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED` остаётся generic Google write boundary;
- historical MIG-010 owner action `IRREVERSIBLE_ACTION_AUTHORIZED` была exact-bound; это разрешение не может повторно использоваться для future mutations;
- DEV и PROD — разные policy boundaries; merge в `main` сам по себе не разрешает необратимое PROD действие.

## Автономная доставка

Обычный Roadmap item проходит одну canonical цепочку:

```text
Roadmap Issue: IN_PROGRESS
        ↓
agent/<ID>-<slug> + PR to main
        ↓
PR Validation (zero deploy secrets)
        ↓
immutable Apps Script candidate bound to exact PR SHA
        ↓
Trusted DEV Deploy
        ↓
Trusted Runtime Health (authenticated owner-only runtime proof)
        ↓
CI-003 autonomous squash merge
        ↓
Main Verification
        ↓
Issue: DONE
```

Нет штатных release-snapshot branches, commit-count gates, manual runtime markers, anonymous private health probes или post-merge direct README commits.

## Recovery / observability / cost

- **DR-001:** owner-local portable encrypted backup + verify + isolated restore drill; backup/key/OAuth/private payload никогда не попадают в GitHub/CI/chat.
- **OBS-001:** bounded privacy-safe audit/telemetry, allowlisted technical metadata, no financial payload.
- **FINOPS-001:** `FREE_ONLY` provider envelopes и 50/70/85/95/100 circuit-breaker policy; неизвестный/billable provider fail-closed.

## Документация

- [Executable Roadmap](docs/ROADMAP.md)
- [Текущий статус](docs/PROJECT_STATUS.md)
- [Архитектура](docs/architecture.md)
- [R1 C4/context](docs/architecture/R1_C4_CONTEXT.md)
- [R1 data lineage](docs/data/R1_DATA_LINEAGE.md)
- [Design system](docs/design/DESIGN_SYSTEM.md)
- [Visualization foundation](docs/architecture/VISUALIZATION_FOUNDATION.md)
- [ECharts 6 renderer ADR](docs/adr/ADR-VIZ-020-ECHARTS-6.md)
- [Canonical Transaction](docs/data/CANONICAL_TRANSACTION_SCHEMA.md)
- [KPI Dictionary](docs/finance/KPI_DICTIONARY.md)
- [Repository port](docs/architecture/TRANSACTION_REPOSITORY_PORT.md)
- [Analytics contract](docs/analytics/ANALYTICS_EXTENSION_CONTRACT.md)
- [SLO/error budget](docs/operations/OBS010_SLO_ERROR_BUDGET.md)
- [PERF-010..014 runbooks](docs/operations/PERF014_SYNTHETIC_SCALE_GATE.md)
- [Release / autonomous delivery](docs/RELEASE_PROCESS.md)
- [DR-001 owner backup](docs/operations/DR001_DIRECT_OWNER_BACKUP.md)
- [Web Dashboard](docs/dashboard.md)
- [Руководство пользователя](docs/user-guide.md)

## Что дальше

Текущий Roadmap item — `VIZ-020`. Он должен пройти `Visualization foundation`, full layered/visual gates, Trusted DEV Deploy, Trusted Runtime Health, autonomous squash merge и Main Verification. Только после VIZ-020 DONE будут dependency-ready следующие R2 dashboards, прежде всего `HOME-020`.