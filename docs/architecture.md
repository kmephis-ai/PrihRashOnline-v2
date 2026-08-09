# Архитектура ПрихРасхOnline v2

## Текущее состояние

ПрихРасхOnline v2 сегодня — приватное домашнее финансовое приложение на Google Sheets + Apps Script с HTML Web Dashboard. GitHub является инженерным control plane для source/tests/docs/policy; он не является хранилищем финансовой базы.

Google Sheets/GAS — **текущий adapter/runtime**, а не вечный domain boundary. Долгосрочная цель — modular monolith с pure domain/application core и repository adapters, чтобы Google и будущий Yandex backend можно было проверять одним domain contract и мигрировать shadow/canary path без big bang.

R1 уже закрепил:

- FIN-010 — versioned KPI Dictionary v1;
- DATA-010 — portable Canonical Transaction v1;
- ARCH-010 — текущий pure application boundary над этими contract'ами.

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
| `lib/migration/**` | pure deterministic migration reconciliation/planning |
| `lib/application/**` | pure use-cases без storage/UI/network authority |
| HTML Web Dashboard | current family UI |
| GitHub | source/policy/tests/docs/Roadmap control plane; synthetic-only financial content |
| GitHub Actions | zero-secret validation + trusted default-branch deploy/runtime/merge control plane |

## Текущий поток пользовательских данных

```text
private Google Sheets
        ↓
Apps Script / future repository adapter
        ↓
plain canonical transactions
        ↓
pure application core
        ↓
KPI / validation / migration-review results
        ↓
private MYSELF Web Dashboard / Sheets menu
```

Финансовые строки не реплицируются в GitHub ради tests, docs или release evidence.

## Pure domain/application boundary — ARCH-010

Machine contract: `lib/application/application_core.v1.json` (`PRH_APPLICATION_CORE_V1`).  
Facade: `lib/application/financial_core.js`.  
Normative detail: `docs/architecture/PURE_DOMAIN_APPLICATION_CORE.md`.

Core принимает plain data и не владеет I/O:

- `io_authority: false`;
- `financial_write_authority: false`;
- `network_authority: false`.

Use-cases:

1. canonical dataset validation через DATA-010;
2. financial snapshot через FIN-010 / FIN-TRUTH-v1;
3. migration review через DATA-001 reconciliation;
4. idempotent import planning через DATA-001 planner.

`SpreadsheetApp`, Apps Script services, DOM/UI и network calls не допускаются внутри `lib/domain|finance|migration|application`. Static dependency contract проверяет это в CI.

ARCH-011 должен подключить Google Sheets как внешний repository adapter; storage mapping/locks/ranges/readback не должны проникать обратно в pure semantics.

## Financial truth

Legacy итоговые ячейки не являются golden truth. Финансовые gates опираются на canonical transaction semantics, KPI Dictionary и invariant/reconciliation contracts.

Доказанный baseline включает:

- synthetic financial edge-case fixtures;
- FIN-001 financial reconciliation;
- FIN-010 KPI Dictionary parity;
- DATA-001 source-to-canonical provenance/idempotency/mismatch detection;
- DATA-010 strict canonical schema/source identity;
- public tree synthetic-only boundary.

Полный history migration/cutover остаётся отдельным MIG-010; наличие canonical contracts не означает, что full history уже мигрирована.

## Trust boundaries

### Public GitHub

Допускаются:

- исходный код;
- architecture/contracts/docs;
- независимо сгенерированные synthetic finance fixtures;
- privacy-safe technical PASS/FAIL/build/cost/health evidence.

Запрещены raw или transformed **real-derived** financial values, aggregates, distributions, seasonality, IDs, screenshots, exports, authenticated responses, OAuth material, backup bytes/keys и private control totals.

### Private Google runtime

Apps Script имеет доступ к приватной книге. Web App остаётся `MYSELF`; его private deployment locator не публикуется как README/release artifact.

### GitHub Actions trust split

```text
PR code
  ↓
PR Validation (zero deploy secrets)
  ↓
immutable candidate bound to exact PR SHA
  ↓
default-branch Trusted DEV Deploy
  ↓
authenticated Trusted Runtime Health
  ↓
CI-003 autonomous squash merge
  ↓
Main Verification -> Roadmap Issue DONE
```

Secret-bearing workflow policy берётся из default branch. Candidate artifact независимо реконструируется из exact candidate Git tree перед deployment. Runtime health доказывает exact deployed candidate SHA/source-tree через authenticated owner-only Execution API.

## R0 cross-cutting safety layers

### Security/privacy

- secret + public-data scanners обязательны до delivery;
- audit/telemetry fields — explicit allowlist;
- sensitive financial/user payload не считается telemetry;
- tracked deployment-specific private config не является source-of-truth.

### Recovery — DR-001

Owner-local portable backup:

- читает current private workbook read-only;
- связывает export с trusted runtime build/source-tree;
- собирается в памяти и шифруется AES-256-GCM **до** записи `.prhbackup`;
- key хранится отдельно;
- verify + isolated SQLite restore drill доказаны;
- public evidence содержит только technical checksum/reconciliation/RPO/RTO/hash/status.

### Observability — OBS-001

`13 Журнал` имеет bounded retention/rotation вместо hard-cap outage. Audit failure отделён от financial transaction correctness; Script Properties держат только privacy-safe technical health/counters. Latency/error/quota/resource metadata проходит через allowlist.

### FinOps — FINOPS-001

`FREE_ONLY` — runtime + CI invariant:

- paid overage disabled;
- billable provider должен иметь explicit conservative monthly safety envelope;
- unknown provider fail-closed;
- conservative atomic usage reservation выполняется до provider call;
- 50/70/85/95/100 threshold policy деградирует optional workload до возможного overage;
- provider allowlist по умолчанию пуст, поэтому FINOPS-001 сам не включает cloud/AI/OCR provider.

## Dashboard/application writes

Web Dashboard read paths не изменяют `01 Операции`. Текущие поддерживаемые bounded writes относятся к staging/control/config/reporting surfaces и имеют собственные guards/readback where applicable.

Pure application core также не имеет write authority. Любой будущий mutation path в canonical operations должен иметь отдельную write policy: idempotency, bounded scope, preconditions, audit, readback, rollback/snapshot и private reconciliation. Наличие schema/core/adapter не является разрешением такого write path.

## DEV и PROD

`main` означает code, прошедший autonomous DEV delivery evidence. Это **не** автоматическое разрешение PROD cutover, destructive migration, history rewrite или paid-service activation.

PROD/data-cutover decisions остаются отдельными policy gates с backup/reconciliation/rollback evidence.

## Целевая архитектура

```text
PWA / future family clients
        ↓
Application services (pure use-cases)
        ↓
Pure canonical domain + KPI/migration rules
        ↓
Repository contracts
        ↓
Google Sheets adapter  <->  future YDB adapter
```

Cross-cutting: auth, privacy, audit/telemetry, FREE_ONLY Cost Guard, recovery and idempotency.

Yandex migration допускается только shadow/strangler path после canonical schema/domain/adapters и private reconciliation. Микросервисы/event broker не требуются для household workload; модульность реализуется прежде всего в code/domain boundaries.

## Fail-closed

Delivery/mutation останавливается, если exact identity, privacy, financial correctness, provider-cost policy, runtime health или required evidence не доказаны. Исправление red CI выполняется на том же Roadmap writer branch; ручной marker, parallel release branch или ослабление privacy не являются recovery strategy.
