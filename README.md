# ПрихРасхOnline v2

Домашняя финансовая система на Google Sheets + Apps Script с приватным Web Dashboard и GitHub как инженерным control plane.

> **Текущий статус:** доказанный **R0 platform baseline** (`MASTER-G0`, `MASTER-G1`, `MASTER-G2` complete) и почти завершённая R1 Canonical Financial Platform. `FIN-010`, `DATA-010`, `ARCH-010`, `ARCH-011`, `MIG-010`, `ANL-010`, `TEST-010`, `OBS-010`, `PERF-010..014` прошли Main Verification. `DOC-010` — текущий writer; `MASTER-G3` остаётся open только до его Main Verification.

## Принципы

- простота и сопровождаемость важнее лишней инфраструктуры;
- финансовая истина определяется canonical transaction rules + versioned KPI Dictionary (`FIN-TRUTH-v1`), а не legacy итоговыми ячейками;
- публичный GitHub содержит только код, документацию и **independently generated synthetic** financial fixtures/evidence;
- private Google Sheets остаётся текущим primary store/adapter, а domain/analytics contracts не зависят от spreadsheet layout;
- обычная инженерная доставка полностью автоматизирована, но privacy, paid-service activation и irreversible production-data actions остаются policy boundaries;
- `FREE_ONLY` — исполняемый invariant: неизвестный billable provider fail-closed, paid overage автоматически не включается;
- performance layers могут уменьшать reads/recompute, но не могут переопределять финансовую семантику или открывать write authority.

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

`PERF-014` проверяет independently generated synthetic 20k/50k operations как CI regression guardrail. Его wall-clock ceilings — не пользовательский SLA; correctness/parity остаётся выше latency.

Generic Google canonical write по-прежнему fail-closed: `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## AI agents

Root [`AGENTS.md`](AGENTS.md) — обязательный repository AI operating contract. Он фиксирует source precedence, Autonomy Contract v2, one-writer lifecycle, public/private data classification, `FREE_ONLY`, exact machine gates, financial-write/migration policy и CI-red recovery.

Короткие public-safe entry points:

- [`.ai-context/PROJECT_CONTEXT.md`](.ai-context/PROJECT_CONTEXT.md)
- [`llms.txt`](llms.txt)

Private household/runtime/credential/backup context в эти файлы не добавляется.

## Dashboard

Web Dashboard остаётся основным пользовательским интерфейсом текущей Google Apps Script реализации. DEV Web App закрыт границей доступа `MYSELF`.

**Приватный deployment URL не публикуется и не поддерживается через README/release commits.** Владелец открывает Dashboard через доверенный private deployment/book menu или собственную локальную закладку. Отсутствие публичной ссылки не является ошибкой release pipeline.

Текущий Dashboard сохраняет 10 представлений, Executive KPI, read-only drill-down, единый refresh, Quality Workbench и responsive desktop/laptop/mobile UI. UI не является authority для KPI formulas.

## Финансовая и data safety модель

- public tests/fixtures не используют реальные или **real-derived** финансовые значения, агрегаты, распределения, seasonality, IDs или screenshots;
- financial reconciliation строится из canonical transaction semantics; legacy totals не являются golden truth;
- canonical schema и repository/analytics layers не разрешают запись сами по себе;
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

После `DOC-010` Main Verification все обязательные условия `MASTER-G3 / Canonical platform` будут выполнены: canonical/KPI/domain/repository/analytics/migration foundations — DONE, private reconciliation — PASS, synthetic performance 20k/50k — PASS, documentation coherence — machine-proven. Следующий основной продуктовый переход по Roadmap — R2 `DESIGN-020` (design system + responsive shell), а затем `VIZ-020` и семейные dashboards поверх уже стабильных semantic/query contracts.
