# SYNC-LF-001 — background full bootstrap и exact revision sync

Статус: engineering implementation для `MASTER-LF-SYNC-BASE`.

## 1. Зачем нужен этот слой

После STORE-LF-001 браузер уже умеет хранить приватный `ACTIVE + VERIFIED` Local Read Model. SYNC-LF-001 добавляет только безопасный механизм его обновления из текущего canonical Google source.

Ключевая цель — не ускорить сам Google read, а убрать Google/network из обычного пользовательского пути после того, как локальная verified generation уже существует.

Нормальный warm path остаётся:

```text
SPA -> IndexedDB / memory -> Web Worker -> UI
```

Background sync идёт отдельно и не является prerequisite для route/filter/chart interaction.

## 2. Source of truth не меняется

SYNC-LF-001 не создаёт новую финансовую истину.

Apps Script функция `prhLocalFirstSyncBootstrap()` вызывает существующий `prhR2DataCreateSnapshot_()`. Этот путь уже строит validated canonical transaction snapshot через canonical Google adapter + PERF-012 single-scan и вычисляет exact canonical repository revision.

Поэтому SYNC-LF-001 не имеет собственной таблицы mapping, собственной FIN-формулы или canonical write path.

Границы authority:

- canonical source: Google / `PRH_TRANSACTION_REPOSITORY_V1`;
- canonical revision: existing repository revision SHA-256;
- local write authority: только derived IndexedDB Local Read Model;
- canonical financial write: запрещён;
- paid dependency: отсутствует.

## 3. Protocol `PRH_LOCAL_FIRST_SYNC_V1@1.0.0`

Request содержит только `local_revision` — revision текущей локальной `ACTIVE + VERIFIED` generation или пустую строку для первого bootstrap.

Server response имеет два допустимых состояния.

### `NOOP`

Если Google canonical revision совпадает с `local_revision`, payload не передаётся и новая generation не создаётся.

### `FULL_BOOTSTRAP`

Если revision изменилась либо локальной generation ещё нет, server возвращает owner-private canonical snapshot:

- `transactions`;
- `dimensions`;
- `aggregates` — в baseline пустой массив, потому что canonical analytics остаётся в Worker;
- `sync_journal`;
- exact `expected_counts`;
- exact `revision`.

Для full bootstrap `generation_id == revision`. Это даёт простую детерминированную one-revision/one-generation identity без отдельного ID authority.

## 4. Atomic update

Client coordinator никогда не заменяет current snapshot напрямую.

Последовательность:

```text
read current ACTIVE + VERIFIED
        |
        v
background remote snapshot
        |
        v
validate protocol/revision/no-write
        |
        v
cleanup stale STAGING for target generation
        |
        v
beginGeneration(STAGING)
        |
        v
chunk writes
        |
        v
STORE-LF count verification
        |
        v
finalizeGeneration()
        |
        v
atomic ACTIVE pointer switch
```

До последнего шага consumer продолжает читать предыдущую generation.

Если chunk/finalize/protocol/network/source failure произошёл до verified switch, staging generation abort-ится, а предыдущая active generation остаётся текущей.

## 5. Degraded mode

Если локальная verified generation уже есть и remote sync недоступен, результат sync — `DEGRADED`, а не потеря продукта.

Это означает:

- `readLocal()` продолжает работать;
- warm navigation/analytics не ждут retry;
- UI в будущих FIN-LF/DATA-LF items сможет честно показать stale/degraded sync state;
- network recovery может быть повторён позже.

Если локальной generation ещё нет и первый bootstrap не удался, состояние — `FAILED`; fake/synthetic household data вместо source не подставляются.

## 6. Что намеренно не входит в SYNC-LF-001

Delta protocol не реализуется здесь.

`DELTA-LF-001` отдельно добавит:

- exact base revision;
- idempotent delta apply;
- base mismatch -> full rebuild;
- replay/order semantics;
- bounded delta chain.

До этого любое реальное изменение canonical revision обновляется full bootstrap.

## 7. Privacy

Remote snapshot содержит реальные owner-private household данные и существует только внутри authenticated owner runtime/browser.

В public repository/evidence разрешены только synthetic fixtures и payload-free metadata: schema/version, hash prefixes, status/reason, counts и timings. Реальные суммы, labels, IDs и transaction rows в CI/GitHub evidence запрещены.

## 8. Проверки

`tests/local_first_sync_service_adapter_test.js` проверяет:

- versioned contract;
- reuse canonical `prhR2DataCreateSnapshot_()`;
- отсутствие raw duplicate Google mapping/write path;
- same-revision `NOOP`;
- exact revision/generation binding;
- no-write response boundary;
- Google Script transport contract.

`tests/local_first_sync_indexeddb_adapter_test.js` запускает настоящий Chromium и IndexedDB и проверяет:

- local read до sync не вызывает transport;
- initial full bootstrap;
- same-revision `NOOP`;
- network failure -> `DEGRADED` с сохранением active generation;
- partial/bad new generation не переключает active pointer;
- retry очищает staging и успешно делает atomic switch;
- synthetic browser integration не создаёт реальных network requests.

## 9. Rollback

Rollback безопасен: перестать вызывать background sync coordinator.

Последняя verified IndexedDB generation остаётся читаемой. Derived local database можно wipe/rebuild. Google canonical source и write ownership не меняются.
