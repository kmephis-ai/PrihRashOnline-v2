# DELTA-LF-001 — idempotent revision-bound delta sync

Статус: engineering implementation для `MASTER-LF-SYNC-DELTA`.

## 1. Роль delta

Delta — это оптимизация передачи изменившихся данных между canonical Google source и уже готовым Local Read Model. Она **не** меняет source of truth и не превращает IndexedDB в canonical database.

Warm UI path остаётся полностью локальным:

```text
SPA -> IndexedDB / memory -> Web Worker -> UI
```

Delta запускается только как explicit/background sync.

## 2. Exact base и target

Каждый delta request строится только из текущей `ACTIVE + VERIFIED` local generation:

- `base_revision` = revision этой generation;
- inventory transactions = `transaction_id + SHA-256 etag`;
- inventory dimensions = `dimension_key + SHA-256 etag`;
- `inventory.digest` = SHA-256 от отсортированных inventories.

Transaction etag использует ровно тот же stable revision row, что canonical `PRH_TRANSACTION_REPOSITORY_V1` при вычислении repository revision. Поэтому browser и server сравнивают одну и ту же семантику данных.

Server заново читает current canonical snapshot через существующий `prhR2DataCreateSnapshot_()`. Отдельной Google mapping, финансовой формулы или write authority DELTA-LF-001 не создаёт.

## 3. Server response

`PRH_LOCAL_FIRST_DELTA_V1@1.0.0` допускает три состояния.

### NOOP

`base_revision == current canonical revision`.

Новая generation не создаётся.

### DELTA

Server возвращает:

- exact `base_revision`;
- exact `target_revision`;
- deterministic `target_generation_id == target_revision`;
- `delta_id`, связанный с base, target и request inventory digest;
- transaction upserts/deletes;
- dimension upserts/deletes;
- target counts.

### FULL_REBUILD_REQUIRED

Server не пытается передать сомнительную или слишком большую delta. Full rebuild выбирается, если bounded operation limit или delta ratio превышены. Browser также сам переводит выполнение в full rebuild при любой недоказанной base/target chain.

## 4. Apply не меняет active generation in-place

Client сначала читает active verified snapshot в память, применяет delta к копии и строит **полный target candidate**.

Затем выполняется критическая проверка:

```text
repositoryRevision(target.transactions) == delta.target_revision
```

Browser implementation повторяет canonical repository revision algorithm:

1. canonical revision row для каждой transaction;
2. sort по `transaction_id`;
3. JSON serialization stable collection;
4. SHA-256.

Только после exact equality target допускается к IndexedDB:

```text
beginGeneration(STAGING)
-> write target records
-> STORE-LF expected-count verification
-> finalizeGeneration()
-> atomic ACTIVE pointer switch
```

До `finalizeGeneration()` старая `ACTIVE + VERIFIED` generation остаётся единственным visible snapshot.

## 5. Idempotency

Повторная синхронизация уже достигнутого target даёт `NOOP`. Если target стал active между network response и apply, coordinator возвращает `ALREADY_APPLIED` и не создаёт ещё одну generation.

Delta не имеет side effect на Google source, поэтому network retry безопасен.

## 6. Base mismatch и fail-closed fallback

Перед materialization coordinator повторно читает store status.

Если current active revision больше не совпадает с `delta.base_revision`, delta не применяется. Используется уже доказанный SYNC-LF-001 full bootstrap coordinator.

Тот же fallback включается при:

- invalid response/request binding;
- invalid `delta_id`;
- transaction/dimension operation conflict;
- target revision mismatch;
- target count mismatch;
- explicit `FULL_REBUILD_REQUIRED` от server.

Если full bootstrap временно недоступен, последняя verified local generation сохраняется и остаётся readable; fake household data не создаются.

## 7. Bounded delta

Baseline contract ограничивает:

- transactions inventory: 50 000;
- dimensions inventory: 20 000;
- delta operations: 10 000;
- delta/full threshold: 75% от большей из base/current inventory sizes.

Большая delta не считается ошибкой продукта: она автоматически заменяется full bootstrap, который уже имеет отдельный verified path.

## 8. Privacy и cost

Inventory и delta payload являются owner-private runtime data. В GitHub/CI допустимы только synthetic fixtures и payload-free metadata/hash prefixes/counts/status/reason/timing.

Canonical financial write = `false`. Paid provider/API dependency отсутствует. YDB в DELTA-LF-001 не создаётся.

## 9. Доказательства

`tests/local_first_delta_service_adapter_test.js` проверяет:

- server reuse canonical snapshot authority;
- absence canonical write/raw duplicate mapping;
- same-revision NOOP;
- deterministic add/update/delete delta;
- bounded full rebuild fallback;
- invalid inventory digest fail-closed;
- **browser `repositoryRevision()` parity с canonical Node implementation**;
- exact client/server inventory etag parity.

`tests/local_first_delta_indexeddb_adapter_test.js` запускает настоящий Chromium + IndexedDB и проверяет:

- local read до sync не вызывает transport;
- initial verified full bootstrap;
- add/update/delete delta;
- exact target revision readback;
- idempotent repeated NOOP;
- corrupt delta + failed full fallback сохраняет verified base;
- explicit FULL_REBUILD_REQUIRED использует SYNC-LF-001 full bootstrap;
- zero real network requests после загрузки harness;
- wipe/reopen recovery.

## 10. Rollback

Delta можно полностью отключить и оставить SYNC-LF-001 full bootstrap единственным remote update path. Это не требует изменения Google source, FIN-TRUTH или локальной verified generation.
