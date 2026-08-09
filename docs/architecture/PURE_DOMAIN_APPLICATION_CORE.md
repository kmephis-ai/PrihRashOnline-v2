# Pure Domain / Application Core v1

`roadmap_id: ARCH-010`  
`contract: PRH_APPLICATION_CORE_V1`  
`version: 1.0.0`

## Назначение

ARCH-010 отделяет domain/application computation от Google Sheets, Apps Script UI и storage I/O. Pure core принимает plain domain data и возвращает plain domain data. Он не знает Sheet headers, ranges, SpreadsheetApp, Dashboard DOM или deployment/runtime identifiers.

Machine contract: `lib/application/application_core.v1.json`.  
Application facade: `lib/application/financial_core.js`.  
Contract test: `tests/pure_domain_application_core_contract_test.js`.

## Dependency direction

```text
application use-cases
      ↓
domain canonical transaction
finance KPI / FIN-TRUTH
migration reconciliation
```

Разрешённая pure boundary:

- `lib/domain/**`;
- `lib/finance/**`;
- `lib/migration/**`;
- `lib/application/**`.

Application/domain code не импортирует top-level Apps Script services, HTML/UI modules или future repository adapters. ARCH-011 позже подключит I/O через ports/adapters снаружи этого ядра.

## Запрещённые platform/UI зависимости

В pure JavaScript boundary запрещены прямые обращения к:

- `SpreadsheetApp`;
- `UrlFetchApp`;
- `HtmlService`;
- `PropertiesService`;
- `LockService`, `CacheService`;
- Drive/Document/Form Apps Script globals;
- browser `window`, `document`, `localStorage`, `fetch`.

Required tests выполняются локально на Node 24. Из Node builtins pure current core использует только `crypto` внутри deterministic DATA-001 fingerprint implementation.

## Use-cases

### VALIDATE_CANONICAL_DATASET

Принимает `canonical_transactions[]`, переиспользует strict DATA-010 collection validation и возвращает `PRH_DATASET_VALIDATION_RESULT_V1`.

Не выполняет read/write сам: массив передаёт будущий adapter/caller.

### CALCULATE_FINANCIAL_SNAPSHOT

Принимает canonical transactions + explicit KPI options и возвращает `PRH_FINANCIAL_SNAPSHOT_V1`.

Financial semantics не дублируются: computation делегируется FIN-010 KPI Dictionary / `FIN-TRUTH-v1`.

### REVIEW_MIGRATION

Принимает source records + migration-compatible canonical transactions и возвращает DATA-001 reconciliation result. Никакой source/canonical storage не читается самим application core.

### PLAN_IDEMPOTENT_IMPORT

Строит DATA-001 deterministic import plan (`REUSE/INSERT/BLOCK`) в памяти. План **не выполняет** write и не даёт migration authorization.

## Authority boundary

`PRH_APPLICATION_CORE_V1` фиксирует:

- `io_authority: false`;
- `financial_write_authority: false`;
- `network_authority: false`.

ARCH-010 не является repository adapter и не выполняет migration/cutover. Любая запись должна проходить отдельный application/repository write contract, recovery/idempotency/reconciliation gates и соответствующий Roadmap item.

## Error/observability contract

`runUseCase()` возвращает только bounded technical `reason_code`, если use-case blocked. Raw exception/private payload в shared result не включается.

Domain functions могут вычислять actual financial values в private process memory, но public CI evidence использует исключительно independently generated synthetic fixtures и не публикует household values.

## Test contract

`tests/pure_domain_application_core_contract_test.js` доказывает:

- application contract/version/authority;
- canonical DATA-010 validation reuse;
- FIN-010 KPI parity;
- DATA-001 migration reconciliation/idempotent plan parity;
- deterministic repeatability;
- отсутствие input mutation;
- Apps Script/UI/network dependency boundary;
- отсутствие imports из pure core наружу в top-level runtime/UI modules.

## Handoff к ARCH-011

ARCH-011 должен реализовать repository interfaces/adapters **вокруг** pure application core. Google Sheets mapping, query ranges, locks/readback/write operations не должны проникать обратно в domain/KPI/migration semantics.
