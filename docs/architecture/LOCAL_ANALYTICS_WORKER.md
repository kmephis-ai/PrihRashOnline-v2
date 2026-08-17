# WORKER-LF-001 — Local Analytics Web Worker

Статус: `IMPLEMENTED ENGINEERING / PRODUCT PATH NOT CONNECTED`  
Contract: `PRH_LOCAL_ANALYTICS_WORKER_V1@1.0.0`  
Roadmap: `WORKER-LF-001`, LF2, `MASTER-LF-WORKER`

## Назначение

Local Analytics Worker переносит тяжёлое чтение/агрегацию уже подготовленного Local Read Model snapshot с main UI thread в отдельный Web Worker. Он не является новым финансовым движком и не получает собственной финансовой семантики.

Нормативный evaluator остаётся один: `lib/analytics/analytics_engine.js#evaluateAnalytics`. Worker bundle детерминированно собирает именно этот tracked canonical module и его tracked dependency graph. Отдельные browser-only финансовые формулы запрещены.

## Authority boundary

Worker имеет только compute authority над входным in-memory message payload.

Запрещены:

- network authority;
- IndexedDB или иная storage authority;
- canonical financial write authority;
- Apps Script / Google Sheets authority;
- YDB authority;
- external package/provider runtime dependency.

Worker entry не использует `fetch`, XHR, WebSocket/EventSource, `importScripts`, IndexedDB, Local/Session Storage или Google runtime APIs.

## Browser bundle

`tools/build-local-analytics-worker.js` строит deterministic CommonJS browser bundle без нового npm bundler dependency.

Правила:

1. entry = `pwa/local_analytics_worker_entry.js`;
2. разрешены только статические relative `require()` tracked repository modules;
3. JSON включается как deterministic `module.exports`;
4. единственный разрешённый builtin — `crypto`, и только через узкий virtual SHA-256 shim;
5. SHA-256 shim использует tracked `lib/crypto/sha256.js`;
6. любой другой external/builtin require блокирует сборку `WORKER_BUNDLE_EXTERNAL_REQUIRE_FORBIDDEN`;
7. raw CommonJS `require()` не остаётся в browser bundle.

Это позволяет использовать тот же canonical evaluator без появления второй implementation authority и без платного/внешнего bundler.

## Message protocol

Вход:

- `INIT`;
- `SET_REVISION { generation_id, revision }`;
- `ANALYTICS_QUERY { request_id, generation_id, revision, transactions, query }`;
- `CANCEL_GENERATION { generation_id }`.

Выход:

- `READY`;
- `ANALYTICS_RESULT`;
- `STALE_DISCARDED`;
- `ERROR`.

`generation_id` и `revision` — SHA-256 hex из 64 символов. `request_id` bounded и не содержит financial payload.

## Generation / revision / cancellation

`SET_REVISION` меняет current binding и увеличивает internal epoch. `CANCEL_GENERATION` для current generation также увеличивает epoch и помечает current binding cancelled до следующего `SET_REVISION`.

Каждая accepted query захватывает тройку:

`generation_id + revision + epoch`.

Binding проверяется:

1. при приёме query;
2. непосредственно перед `evaluateAnalytics()`;
3. повторно после `evaluateAnalytics()` до `ANALYTICS_RESULT`.

Если binding больше не current, результат не публикуется. Worker отправляет только `STALE_DISCARDED` без analytics payload.

Queued analytics запускается в отдельном task-turn. Это позволяет immediately-following `CANCEL_GENERATION` или `SET_REVISION` инвалидировать queued work до вычисления и не блокирует message handler.

## FIN-TRUTH parity

Worker не интерпретирует суммы самостоятельно. `evaluateAnalytics()` продолжает использовать существующие canonical transaction, KPI dictionary, FIN-TRUTH и repository revision contracts.

Acceptance требует real Chromium parity test:

`direct Node canonical evaluateAnalytics(synthetic fixture, query)`

должен быть semantically/deep equal

`real Web Worker evaluateAnalytics(same synthetic fixture, same query)`.

Synthetic dataset специально проходит полный canonical validation/provenance path; real household values не входят в public test.

## Privacy-safe failure

`ERROR` содержит только bounded `request_id` и machine `reason`. Stack/message/input transactions/query/result не публикуются.

`STALE_DISCARDED` содержит binding metadata и reason, но не analytics result/transactions/query.

Public CI evidence разрешает только synthetic payload и bounded metadata. Real household finance data, labels и values не публикуются.

## Zero-network proof

Real Chromium test сначала загружает Worker asset и ждёт `READY`. После `READY` включается network counter. Все `SET_REVISION`, `ANALYTICS_QUERY`, cancellation и stale operations обязаны завершиться при `postReadyNetworkRequests = 0`.

Это доказывает compute-path boundary самого Worker. Background synchronization будет отдельной ответственностью `SYNC-LF-001`.

## Rollback

WORKER-LF-001 пока не подключает Worker к primary product path. Rollback — не использовать Worker bridge и продолжить прямой вызов того же canonical evaluator. Canonical source/data при этом не изменяются.

Подключение Worker к реальному Local Read Model/UI выполняется последующими Local-first items и требует тех же generation/revision guards.
