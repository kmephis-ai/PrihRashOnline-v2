# Архитектура ПрихРасхOnline v2

## Текущее состояние

ПрихРасхOnline v2 — приватное домашнее финансовое приложение на Google Sheets + Apps Script с HTML Web Dashboard. GitHub является инженерным control plane для source/tests/docs/policy; он не является хранилищем финансовой базы.

Google Sheets/GAS — текущий adapter/runtime, а не вечный domain boundary. Долгосрочная цель — modular monolith с pure domain/application core и repository adapters, чтобы Google Sheets adapter и future YDB adapter проверялись одним domain contract и мигрировали shadow/canary path без big bang.

R1 уже закрепил:

- FIN-010 — versioned KPI Dictionary v1;
- DATA-010 — portable Canonical Transaction v1;
- ARCH-010 — pure application boundary;
- ARCH-011 — storage-neutral transaction repository port + Google Sheets adapter;
- MIG-010 — текущий P0: deterministic owner-private full-history migration protocol поверх этих границ.

## Компоненты

| Компонент | Текущая роль |
|---|---|
| Google Sheets | private primary data store и spreadsheet adapter |
| `01 Операции` | текущий transaction surface; Web Dashboard read-only |
| `09 Настройки` | технические flags/config |
| `10 Контроль` | private KPI/control snapshots |
| `11 Предпросмотр` | staging/review queue для quality proposals |
| `13 Журнал` | bounded privacy-safe technical audit journal |
| `14 Аналитика` | существующая spreadsheet analytics/fallback |
| Apps Script | current platform/runtime adapter, owner-only runtime, reporting, guarded actions |
| `lib/domain/**` | portable canonical domain contracts |
| `lib/finance/**` | pure FIN-TRUTH/KPI semantics |
| `lib/migration/**` | pure deterministic reconciliation/migration planning |
| `lib/application/**` | pure use-cases без storage/UI/network authority |
| `lib/repository/**` | storage-neutral transaction repository port + deterministic fake |
| `lib/adapters/**` | platform/storage mapping adapters вне pure core |
| `GoogleTransactionRepositoryGateway.js` | current Apps Script Google operations read boundary; canonical writes blocked |
| `tools/mig010-owner.js` | owner-local private snapshot/dry-run state boundary; real write disabled pending explicit authorization |
| HTML Web Dashboard | current family UI |
| GitHub | source/policy/tests/docs/Roadmap control plane; synthetic-only financial content |
| GitHub Actions | zero-secret validation + trusted default-branch deploy/runtime/merge control plane |

## Текущий поток пользовательских данных

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
pure application core
        ↓
KPI / validation / migration-review results
        ↓
private MYSELF Web Dashboard / Sheets menu
```

MIG-010 добавляет отдельный owner-private migration path, а не меняет этот runtime flow:

```text
verified encrypted DR-001 backup
        ↓ local only
private mapper outside Git repository
        ↓
private source + canonical snapshot
        ↓
PRH_FULL_HISTORY_MIGRATION_V1 dry-run
        ↓
AUTHORIZATION_REQUIRED
        ↓ future explicit owner action only
bounded migration batches + private reconciliation
```

Финансовые строки не реплицируются в GitHub ради tests, docs или release evidence.

## Pure domain/application boundary — ARCH-010

Machine contract: `lib/application/application_core.v1.json` (`PRH_APPLICATION_CORE_V1`). Core принимает plain data и не владеет I/O:

- `io_authority: false`;
- `financial_write_authority: false`;
- `network_authority: false`.

`SpreadsheetApp`, Apps Script services, DOM/UI и network calls не допускаются внутри `lib/domain|finance|migration|application`. ARCH-010 завершён Main Verification и намеренно не содержит repository I/O/write authority.

## Transaction repository boundary — ARCH-011

Machine contract: `lib/repository/transaction_repository.v1.json` (`PRH_TRANSACTION_REPOSITORY_V1`). Normative detail: `docs/architecture/TRANSACTION_REPOSITORY_PORT.md`.

Repository port предоставляет storage-neutral read/query/write-interface contract над canonical transactions. Query deterministic и bounded: explicit filters, stable ordering `occurred_at ASC, transaction_id ASC`, `[period_start, period_end)` и pagination limits.

In-memory fake разрешает synthetic-only writes при explicit test authority для optimistic revision/idempotency/readback. Google adapter:

- преобразует current operation headers в DATA-010 canonical transactions через versioned mapping;
- требует explicit currency и resolvers для domain dimensions;
- хранит Google row только как mutable `source_position`, не logical identity;
- поддерживает read/query;
- generic write interface всегда fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

Apps Script gateway остаётся вне pure core и может использовать `SpreadsheetApp`, но не содержит `setValue`, `setValues`, `appendRow`, `deleteRow` operation-write primitives. ARCH-011 завершён Main Verification; adapter existence не даёт financial-write authority.

## Full-history migration boundary — MIG-010

Machine contract: `lib/migration/full_history_migration.v1.json` (`PRH_FULL_HISTORY_MIGRATION_V1`). Runbook: `docs/operations/MIG010_FULL_HISTORY_MIGRATION.md`.

Protocol фиксирует:

- deterministic source revision и target repository revision;
- DATA-001 `INSERT / REUSE / BLOCK` dry-run;
- batch size `<=100`, order по source fingerprint;
- idempotency key + exact expected target revision на batch;
- HMAC-SHA256 resume token, привязанный к exact plan hash/next batch/revision;
- DR-001 encrypted backup SHA binding;
- private reconciliation с обязательным `unexplainedMismatch = 0`;
- rerun должен быть reuse-only.

Owner-local `tools/mig010-owner.js` создаёт private snapshot только из encrypted backup через mapper, который должен лежать вне Git repository. Snapshot/state/resume secret тоже обязаны находиться вне repo. Stdout содержит только technical hashes/status/reason codes.

**Current write authority = false.** Команды `execute/write/apply` намеренно выключены и возвращают `MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED`. Реальный first write нельзя включить посредством GitHub Actions, merge или AI-agent. Нужны отдельное owner-private `IRREVERSIBLE_ACTION_AUTHORIZED`, fresh verified DR backup, exact plan binding и migration-specific write/readback/rollback adapter.

## Financial truth

Legacy итоговые ячейки не являются golden truth или authoritative financial source. Финансовые gates опираются на canonical transaction semantics, KPI Dictionary и invariant/reconciliation contracts.

Доказанный baseline включает FIN-001/FIN-010, DATA-001/DATA-010, ARCH-010, ARCH-011, synthetic financial edge cases и public-tree synthetic-only boundary. Полный history migration/cutover **не считается завершённым**, пока MIG-010 private reconciliation не доказан.

## Trust boundaries

### Public GitHub

Допускаются code/contracts/docs, independently generated synthetic finance fixtures и privacy-safe technical PASS/FAIL/build/hash evidence.

Запрещены raw или transformed **real-derived** financial values, aggregates, distributions, seasonality, IDs, screenshots, exports, authenticated responses, OAuth material, backup bytes/keys, private mapper/snapshot/state и private control totals.

### Private Google/owner runtime

Apps Script имеет доступ к приватной книге. Web App остаётся `MYSELF`; private deployment locator не публикуется. Dashboard render использует raw `HtmlOutput` placeholder injection; privacy-safe Web App render smoke v2 — обязательная часть authenticated runtime health.

MIG-010 private mapper, decrypted snapshot/state and future authorization live only in owner-private environment outside repository.

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

Machine delivery PASS не является mutation authorization для private full-history migration.

## R0 cross-cutting safety layers

DR-001: owner-local portable encrypted backup, verify + isolated restore drill.  
OBS-001: bounded privacy-safe audit/telemetry.  
FINOPS-001: executable `FREE_ONLY`, unknown/billable provider fail-closed.

## Dashboard/application writes

Web Dashboard read paths не изменяют `01 Операции`. Pure application core не имеет write authority. ARCH-011 current Google canonical write blocked. MIG-010 создаёт migration protocol, но пока также не имеет активного real-write command.

Любой future canonical mutation должен иметь idempotency, bounded scope, preconditions, audit, readback, rollback/snapshot и private reconciliation.

## DEV и PROD

`main` означает code, прошедший autonomous DEV delivery evidence. Это не автоматическое разрешение PROD cutover, destructive migration, history rewrite, real full-history write или paid-service activation.

## Целевая архитектура

```text
PWA / future family clients
        ↓
Application services (pure use-cases)
        ↓
Pure canonical domain + KPI/migration rules
        ↓
PRH_TRANSACTION_REPOSITORY_V1
        ↓
Google Sheets adapter  <->  future YDB adapter
```

Cross-cutting: auth, privacy, audit/telemetry, FREE_ONLY Cost Guard, recovery and idempotency.

Yandex migration допускается только shadow/strangler path после canonical schema/domain/adapters и private reconciliation. Микросервисы/event broker не требуются для household workload.

## Fail-closed

Delivery/mutation останавливается, если exact identity, privacy, financial correctness, backup binding, target revision, resume integrity, provider-cost policy, runtime health или required evidence не доказаны. Красный CI исправляется на том же writer branch; manual marker, parallel release branch или ослабление privacy не являются recovery strategy.
