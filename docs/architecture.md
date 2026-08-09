# Архитектура ПрихРасхOnline v2

## Текущее состояние

ПрихРасхOnline v2 — приватное домашнее финансовое приложение на Google Sheets + Apps Script с HTML Web Dashboard. GitHub является инженерным control plane для source/tests/docs/policy; он не является хранилищем финансовой базы.

Google Sheets/GAS — текущий adapter/runtime, а не вечный domain boundary. Долгосрочная цель — modular monolith с pure domain/application/analytics core и repository adapters, чтобы Google Sheets adapter и future YDB adapter проверялись едиными contracts и мигрировали shadow/canary path без big bang.

R1 уже закрепил:

- FIN-010 — versioned KPI Dictionary v1;
- DATA-010 — portable Canonical Transaction v1;
- ARCH-010 — pure application boundary;
- ARCH-011 — storage-neutral transaction repository port + Google Sheets adapter;
- MIG-010 — deterministic owner-private full-history migration, DONE после owner reconciliation + Main Verification;
- ANL-010 — current writer: versioned renderer/storage-neutral analytics query/result boundary.

## Компоненты

| Компонент | Текущая роль |
|---|---|
| Google Sheets | private primary data store и spreadsheet adapter |
| `01 Операции` | canonical transaction surface; Web Dashboard read-only |
| `09 Настройки` | технические flags/config |
| `10 Контроль` | private KPI/control snapshots |
| `11 Предпросмотр` | staging/review queue для quality proposals |
| `13 Журнал` | bounded privacy-safe technical audit journal |
| `14 Аналитика` | существующая spreadsheet analytics/fallback, не canonical analytics contract |
| Apps Script | current platform/runtime adapter, owner-only runtime, reporting, guarded actions |
| `lib/domain/**` | portable canonical domain contracts |
| `lib/finance/**` | pure FIN-TRUTH/KPI semantics |
| `lib/application/**` | pure use-cases без storage/UI/network authority |
| `lib/analytics/**` | pure AnalyticsQuery/AnalyticsResult normalization/evaluation/provenance |
| `lib/migration/**` | pure deterministic reconciliation/migration planning |
| `lib/repository/**` | storage-neutral transaction repository port + deterministic fake |
| `lib/adapters/**` | platform/storage mapping adapters вне pure core |
| `GoogleTransactionRepositoryGateway.js` | current Apps Script Google operations read boundary; generic canonical writes blocked |
| `Mig010ExecutionGateway.js` | historical one-time exact-bound owner-authorized migration boundary |
| HTML Web Dashboard | current family UI/renderer consumer; financial semantics не authoritative |
| GitHub | source/policy/tests/docs/Roadmap control plane; synthetic-only financial content |
| GitHub Actions | zero-secret validation + trusted exact-SHA deploy/runtime/merge control plane |

## Текущий поток данных

```text
private Google Sheets
        ↓
Apps Script Google repository gateway
        ↓
Google Sheets transaction adapter
        ↓
PRH_TRANSACTION_REPOSITORY_V1
        ↓
plain PRH_CANONICAL_TRANSACTION_V1
        ↓
┌──────────────────────────────┐
│ pure application core        │
│ pure FIN-TRUTH / KPI         │
│ pure analytics contract      │
└──────────────────────────────┘
        ↓
plain results / view-model inputs
        ↓
private MYSELF Web Dashboard / Sheets menu
```

Analytics consumer не знает, какой storage adapter был источником canonical transactions. UI получает готовую domain result shape и не должен повторно пересчитывать KPI semantics.

## Pure domain/application boundary — ARCH-010

Machine contract: `lib/application/application_core.v1.json` (`PRH_APPLICATION_CORE_V1`). Core принимает plain data и не владеет I/O:

- `io_authority: false`;
- `financial_write_authority: false`;
- `network_authority: false`.

`SpreadsheetApp`, Apps Script services, DOM/UI и network calls не допускаются внутри pure core. ARCH-010 завершён Main Verification и не содержит repository I/O/write authority.

## Transaction repository boundary — ARCH-011

Machine contract: `lib/repository/transaction_repository.v1.json` (`PRH_TRANSACTION_REPOSITORY_V1`). Normative detail: `docs/architecture/TRANSACTION_REPOSITORY_PORT.md`.

Repository port предоставляет storage-neutral read/query/write-interface contract над canonical transactions. Query deterministic и bounded: explicit filters, stable ordering, `[period_start, period_end)` и pagination limits.

In-memory fake разрешает synthetic-only writes при explicit test authority. Google adapter:

- преобразует current operation headers в DATA-010 canonical transactions через versioned mapping;
- требует explicit currency и resolvers для dimensions;
- хранит Google row только как mutable `source_position`, не logical identity;
- поддерживает read/query;
- generic write interface всегда fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Apps Script gateway остаётся вне pure core. ARCH-011 DONE; adapter existence не даёт financial-write authority.

## Analytics boundary — ANL-010

Machine contract: `lib/analytics/analytics_contract.v1.json` (`PRH_ANALYTICS_CONTRACT_V1@1.0.0`). Normative detail: `docs/analytics/ANALYTICS_EXTENSION_CONTRACT.md`.

Analytics v1 состоит из:

- `PRH_ANALYTICS_QUERY_V1` — strict measures, dimensions, filters, explicit time range/grain, comparison, sort, bounded parameters/limit;
- `PRH_ANALYTICS_RESULT_V1` — deterministic rows, query hash, truncation state и provenance.

Ключевой invariant: analytics layer **не владеет финансовыми формулами**. Supported measures делегируются FIN-010 `evaluateKpis()` и наследуют `FIN-TRUTH-v1`. Legacy totals, spreadsheet formulas и chart/UI code не могут переопределить Income/Expense/Cash Flow/Savings/Budget semantics.

Query canonicalization создаёт deterministic SHA-256 identity. Equivalent filter ordering/value ordering даёт один query hash. Canonical input revision берётся из storage-neutral transaction collection identity.

V1 поддерживает bounded grouping по canonical dimensions и `DAY/MONTH/YEAR` time grain. `PREVIOUS_PERIOD` — explicit equal-day preceding interval. `BUDGET_VARIANCE` не группируется без отдельной allocation policy, чтобы analytics layer не изобретал новую financial semantics.

Analytics authority contract:

- `io=false`;
- `network=false`;
- `financial_write=false`;
- `ui=false`;
- renderer-neutral;
- storage-neutral.

ChartSpec/WidgetSpec, renderer selection и advanced pivot/window/formula semantic layer остаются отдельными Roadmap scopes.

## Full-history migration boundary — MIG-010

Machine contract: `lib/migration/full_history_migration.v1.json` (`PRH_FULL_HISTORY_MIGRATION_V1`). Runbook: `docs/operations/MIG010_FULL_HISTORY_MIGRATION.md`.

MIG-010 DONE после exact owner authorization, bounded staging/readback/finalize, fresh encrypted backup, private reconciliation и Main Verification.

Owner-verified MIG-010 private full-history reconciliation доказала `unexplainedMismatch=0`, full provenance, exact final raw-table parity и idempotent rerun. **Current write authority = false** для generic Google repository и owner/repair/rebuild tools. One-time migration authorization не создаёт постоянного generic permission.

Hidden rollback/staging cleanup остаётся отдельной bounded operation и не выполняется автоматически.

## Financial truth

Legacy итоговые ячейки не являются golden truth или authoritative financial source. Финансовые gates опираются на canonical transaction semantics, KPI Dictionary и invariant/reconciliation contracts.

ANL-010 добавляет новый consumer этого truth, а не новую параллельную truth system. Поэтому analytics parity с FIN-010 проверяется synthetic property tests.

## Trust boundaries

### Public GitHub

Допускаются code/contracts/docs, independently generated synthetic finance fixtures и privacy-safe technical PASS/FAIL/build/hash evidence.

Запрещены raw или transformed **real-derived** financial values, aggregates, distributions, seasonality, IDs, screenshots, exports, authenticated responses, OAuth material, backup bytes/keys и owner-private artifacts.

Real analytics query/results являются private runtime payload и не используются как public fixtures/evidence.

### Private Google/owner runtime

Apps Script имеет доступ к приватной книге. Web App остаётся `MYSELF`; private deployment locator не публикуется. Dashboard render использует raw `HtmlOutput` placeholder injection; privacy-safe Web App render smoke v2 — обязательная часть authenticated runtime health.

### GitHub Actions trust split

```text
PR Validation
  ↓
immutable exact candidate
  ↓
Trusted DEV Deploy
  ↓
Trusted Runtime Health + Web App render smoke v2
  ↓
CI-003 autonomous squash merge
  ↓
Main Verification
```

Machine delivery PASS не является mutation authorization для private financial writes.

## R0 cross-cutting safety layers

DR-001: owner-local portable encrypted backup, verify + isolated restore drill.  
OBS-001: bounded privacy-safe audit/telemetry.  
FINOPS-001: executable `FREE_ONLY`, unknown/billable provider fail-closed.

## Dashboard/application writes

Web Dashboard read paths не изменяют `01 Операции`. Pure application/analytics cores не имеют write authority. ARCH-011 current Google canonical write blocked. MIG-010 historical exact-bound gateway не разблокирует generic writes.

Любой future canonical mutation должен иметь idempotency, bounded scope, preconditions, audit, readback, rollback/snapshot, private reconciliation и при irreversible action — новое explicit owner authorization.

## DEV и PROD

`main` означает code, прошедший autonomous DEV delivery evidence. Это не автоматическое разрешение PROD cutover, destructive migration, history rewrite, нового real financial write или paid-service activation.

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

Cross-cutting: auth, privacy, audit/telemetry, FREE_ONLY Cost Guard, recovery and idempotency.

Yandex migration допускается только shadow/strangler path после canonical schema/domain/adapters и private reconciliation. Household workload не требует microservice/event-broker complexity.

## Fail-closed

Delivery/mutation останавливается, если exact identity, privacy, financial correctness, query contract, backup binding, provider-cost policy, runtime health или required evidence не доказаны. Красный CI исправляется на том же writer branch; manual marker, parallel release branch или ослабление privacy не являются recovery strategy.
