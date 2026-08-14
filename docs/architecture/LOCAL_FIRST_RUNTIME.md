# Local-first Runtime Architecture

Статус: `APPROVED / ARCH-LF-001`  
Дата решения владельца: 2026-08-14  
Machine contract: `PRH_LOCAL_FIRST_RUNTIME_V1@1.0.0`  
Стоимость: `FREE_ONLY`

## 1. Решение

PrihRashOnline прекращает развивать модель, в которой каждый обычный пользовательский клик зависит от цепочки `Apps Script -> Google Sheets -> server analytics -> HtmlService iframe`.

Целевая модель:

```text
                    background / non-blocking
Google Sheets  <------------------------------>  Sync adapter
 canonical                                            |
 source                                                v
                                                IndexedDB
                                                    |
                                                    v
                                            in-memory read model
                                                    |
                       +----------------------------+-------------------------+
                       |                                                      |
                       v                                                      v
                 Web Worker analytics                                  SPA route state
                       |                                                      |
                       +----------------------------+-------------------------+
                                                    v
                                             ECharts / UI
```

После успешного bootstrap/sync обычные route/filter/chart actions **не должны требовать network request** и не должны читать Google Sheets.

Google Sheets остаётся каноническим источником на переходном этапе. Apps Script остаётся trusted sync/reconciliation adapter, но перестаёт быть request-per-view UI backend.

Будущий YDB вводится отдельно через shadow/dual-read/compare/canary/strangler migration. Big-bang cutover запрещён.

## 2. Что сохраняется

Local-first не создаёт новую финансовую истину. Сохраняются без изменения:

- `PRH_CANONICAL_TRANSACTION_V1` и canonical transaction semantics;
- `FIN-TRUTH-v1` и KPI Dictionary;
- `PRH_ANALYTICS_CONTRACT_V1` и semantic layer;
- integer minor-unit money rules;
- privacy, `MYSELF`, `FREE_ONLY`, zero-write и exact-revision boundaries;
- renderer-neutral `ChartSpec`/visualization contracts;
- существующие repository ports/adapters;
- PERF-010/011/012/013/070 как reusable correctness/performance building blocks.

Меняется **interaction/runtime topology**, а не финансовые формулы.

## 3. Local Read Model

### 3.1. Authority

Local Read Model — private derived read-only representation конкретной canonical revision.

Он обязан содержать provenance:

- `schema = PRH_LOCAL_READ_MODEL_V1`;
- version;
- exact 64-hex `canonical_revision`;
- source adapter identity;
- created/applied timestamps;
- dataset/count metadata без публичного financial payload;
- immutable generation identity.

Local Read Model не имеет canonical write authority. Любая финансовая запись остаётся отдельным policy-gated flow.

### 3.2. IndexedDB

IndexedDB используется как private browser storage, а не как server authority.

Минимальные stores:

- `meta` — schema/version/current revision/sync state;
- `transactions` — canonical read-only transactions;
- `dimensions` — локальные presentation/read indexes, если нужны;
- `aggregates` — revision-bound materialized analytics;
- `sync_journal` — bounded technical apply state без финансовой telemetry.

Основной key для transactions — stable canonical `transaction_id`.

Schema upgrade выполняется versioned migration. Неизвестная/несовместимая schema не читается эвристически: local store очищается или перестраивается из canonical source.

### 3.3. Privacy lifecycle

- IndexedDB не синхронизируется в GitHub/CI/artifacts.
- Browser local financial data никогда не попадает в telemetry.
- UI предоставляет действие «Очистить локальные данные».
- Logout/owner policy может инициировать wipe.
- Private data не переносится между origin без отдельного encrypted export contract.

## 4. Web Worker analytics

Все потенциально тяжёлые локальные расчёты выполняются вне main UI thread.

Versioned message boundary:

```text
UI -> Worker: INIT | SET_REVISION | ANALYTICS_QUERY | CANCEL_GENERATION
Worker -> UI: READY | ANALYTICS_RESULT | STALE_DISCARDED | ERROR
```

Обязательные свойства:

- worker принимает только normalized canonical/semantic request;
- worker не получает network/storage/write authority;
- renderer не вычисляет FIN-TRUTH;
- request имеет `generation` и revision identity;
- результат старой generation/revision отбрасывается до UI commit;
- cancellation — correctness boundary, а не только UX optimization;
- expensive work не блокирует scrolling/navigation/input.

## 5. Background synchronization

### 5.1. Состояния

```text
UNINITIALIZED
  -> BOOTSTRAPPING
  -> READY
  -> CHECKING_REVISION
  -> APPLYING_DELTA | REBUILDING
  -> READY

Failure -> DEGRADED_LOCAL
Fatal incompatible local state -> REBUILD_REQUIRED
```

`DEGRADED_LOCAL` означает: последняя доказанная local revision остаётся доступна для read-only UI, а интерфейс честно показывает, что обновление временно не удалось.

### 5.2. Bootstrap

Первый запуск или invalid local schema:

1. получить trusted source revision + snapshot manifest;
2. получить canonical snapshot bounded batches;
3. проверить schema, FIN/repository invariants и revision;
4. записать staging IndexedDB generation;
5. после успешной проверки атомарно переключить `current_generation`;
6. старую generation удалить асинхронно.

Partial bootstrap никогда не становится visible current state.

### 5.3. Delta synchronization

После bootstrap обычный refresh:

1. дешёвый revision probe;
2. same revision -> `NOOP`;
3. new revision -> запрос versioned delta относительно известной base revision;
4. проверка `base_revision`, sequence, idempotency и canonical shape;
5. apply в staging transaction;
6. вычисление/обновление затронутых indexes/aggregates;
7. вычисление/проверка resulting revision;
8. atomic switch;
9. UI получает событие `REVISION_COMMITTED`.

Если server не может доказать delta chain, клиент выполняет полный rebuild вместо эвристического merge.

### 5.4. UI не ждёт sync

При наличии verified local snapshot приложение сначала показывает его, затем запускает background revision check.

Нормальный startup:

```text
IndexedDB -> first meaningful paint -> user interaction enabled -> background sync
```

а не:

```text
network -> Sheets -> analytics -> UI unlocked
```

## 6. SPA topology

`Home`, `Transactions`, `Expenses`, `Income`, `Cash Flow`, `Data Quality` и будущие routes становятся views одного живого приложения.

Route change меняет client state/history, но не загружает новый HtmlService document.

Обязательные свойства:

- один app shell;
- один ECharts runtime;
- client-side History API;
- shared `FilterContext`;
- Back/Forward без server reload;
- route precomputation/prefetch допустимы, но network не обязателен для warm navigation;
- loading state относится к local computation/sync, а не к перезапуску Web App.

## 7. Performance contract

Следующие значения — **target Product SLO**, а не утверждение о текущем runtime:

| Interaction | Target p95 |
|---|---:|
| warm route switch при готовом local snapshot | <= 100 ms |
| KPI/filter update без тяжёлого chart render | <= 200 ms |
| filter + обычный chart repaint desktop | <= 300 ms |
| filter + обычный chart repaint средний mobile | <= 500 ms |
| browser Back/Forward | <= 100 ms |
| first cached meaningful paint | <= 800 ms |

Архитектурный gate сильнее конкретной цифры: для warm route/filter/chart actions test обязан доказать **zero required network calls** и **zero Google Sheets reads**.

Cold bootstrap/sync измеряется отдельно и не имеет права блокировать уже доступную verified local revision.

## 8. Failure model

- Нет local data + сеть недоступна -> truthful bootstrap unavailable state.
- Есть verified local data + сеть недоступна -> read-only `DEGRADED_LOCAL`, данные остаются доступны.
- Revision changed во время sync -> staging result discard/retry.
- Delta base mismatch -> full rebuild.
- IndexedDB corruption/schema mismatch -> wipe/rebuild, не heuristic repair.
- Worker crash -> worker restart; UI shell остаётся responsive.
- Analytics stale completion -> discard по generation/revision.
- Cache/aggregate mismatch -> canonical local transaction evaluation fallback.

## 9. YDB migration ladder

Local-first специально отделяет UI от текущего Google source adapter, поэтому будущая миграция не требует переписывать Dashboard.

Этапы:

1. `GOOGLE_AUTHORITATIVE + LOCAL_FIRST_READ_MODEL`.
2. `YDB_SHADOW_REPLICA`: Google write authority сохраняется, YDB получает verified shadow copy.
3. `DUAL_READ_COMPARE`: одинаковые revision/query results сравниваются автоматически.
4. `YDB_READ_CANARY`: ограниченная доля read traffic использует YDB с fallback на Google/local sync.
5. `YDB_READ_AUTHORITY`: YDB становится основным remote read source, Google остаётся reconciliation/fallback.
6. Отдельный будущий owner-authorized work item может рассмотреть write cutover; автоматического перехода write authority нет.

YC-040 PoC остаётся фундаментом YDB adapter/cost envelope. Любое live YDB использование сохраняет `paidOverageAllowed=false` и fail-closed billing state.

## 10. Запрещённые shortcuts

- не превращать `CacheService` в новую финансовую истину;
- не использовать shared/public cache для private household payload;
- не считать server technical health latency пользовательским chart/route SLA;
- не хранить финансовый payload в URL/history/telemetry;
- не добавлять network call обратно в каждый filter/route ради удобства реализации;
- не вводить SQLite/DuckDB/Redis/YDB в mandatory path без отдельного доказанного need/ADR;
- не делать iframe routing частью целевой SPA.

## 11. Rollback

ARCH-LF-001 не выполняет financial mutation. Rollback удаляет architecture/contracts/docs и оставляет существующий `main` runtime неизменным.

Последующие LF implementation items обязаны сохранять старый runtime как bounded fallback до Product Ready нового local-first path. Cutover выполняется только после authenticated exact-candidate browser UAT и performance gates.
