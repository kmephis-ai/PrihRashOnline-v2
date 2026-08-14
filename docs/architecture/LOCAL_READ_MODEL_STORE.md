# STORE-LF-001 — IndexedDB Local Read Model

Статус: `IMPLEMENTED ENGINEERING / PRODUCT DATA NOT CONNECTED`  
Contract: `PRH_LOCAL_READ_MODEL_V1@1.0.0`  
Roadmap: `STORE-LF-001`, LF1, `MASTER-LF-STORE`

## Назначение

Local Read Model — приватная производная копия данных в браузере, предназначенная для будущего Local-first пути PrihRashOnline. Она не является финансовой истиной, не получает права записи в Google Sheets/YDB и не заменяет canonical source.

На STORE-LF-001 remote bootstrap/sync ещё не подключён. Реальные household values в SPA не выводятся. Этот этап создаёт storage foundation для последующих `WORKER-LF-001`, `SYNC-LF-001`, `DELTA-LF-001`, `FIN-LF-001` и `DATA-LF-001`.

## База и stores

IndexedDB database: `prihrash-local-read-model`, version `1`.

Обязательные stores:

- `meta` — schema metadata, generation manifests, active pointer;
- `transactions` — generation-scoped canonical transaction projections;
- `dimensions` — generation-scoped dimension dictionary/projections;
- `aggregates` — generation-scoped derived aggregate payload;
- `sync_journal` — generation-scoped future sync/reconciliation journal.

Все data stores имеют `generation_id` index. Их primary key включает `generation_id`, поэтому записи разных поколений физически не смешиваются.

## Immutable generation protocol

Новая локальная ревизия никогда не перезаписывает current snapshot «на месте».

1. `beginGeneration(generationId, revision)` создаёт manifest `STAGING`.
2. `writeGenerationChunk(...)` записывает только records этой generation.
3. Пока generation `STAGING`, active pointer не меняется; UI/consumer продолжает видеть предыдущую `VERIFIED` generation.
4. `finalizeGeneration(...)` повторно проверяет exact revision и фактические counts всех stores.
5. Только после успешной проверки одна IndexedDB transaction переводит manifest в `VERIFIED` и меняет `active_generation` pointer.
6. Ошибка/partial bootstrap не может сделать staging data active.

`generation_id` и canonical `revision` имеют формат SHA-256 hex из 64 символов. STORE-LF-001 не определяет способ вычисления canonical revision — authority остаётся у canonical source/sync layer.

## Read contract

Нормативный инвариант: consumer может читать только состояние **ACTIVE + VERIFIED**. `STAGING`, partial bootstrap и любые неподтверждённые поколения невидимы для product read path.

Read API выдаёт payload только когда одновременно доказаны:

- существует `active_generation`;
- generation/revision имеют допустимый формат;
- active pointer указывает на существующий manifest;
- manifest = `VERIFIED`;
- revision pointer совпадает с manifest revision;
- фактические counts stores совпадают с verified manifest.

При нарушении любого из этих условий возвращается `REBUILD_REQUIRED` без неподтверждённого payload.

## Abort / recovery / wipe

`abortGeneration()` разрешён только для non-active generation и удаляет её staging records + manifest.

При incompatible schema или corruption local store fail-closed. Derived IndexedDB может быть перестроена через explicit `rebuild()`: local database удаляется и открывается пустой. Это не выполняет remote/canonical mutation.

`wipe()` — явный privacy control для полного удаления derived local browser storage. Remote source не затрагивается.

## Privacy

Local Read Model — private browser storage. Запрещено:

- публиковать database dump в GitHub artifacts;
- включать household financial payload в public telemetry/logs;
- помещать financial payload в URL/history;
- использовать данные STORE-LF-001 как публичный test fixture.

Public evidence допускает только schema/version, bounded hash prefixes, state/status/reason/count/duration и synthetic-only records.

## Network boundary

Модуль IndexedDB не имеет network authority. Его local read/write generation operations не используют mandatory network requests и не читают Google Sheets.

Network/revision bootstrap будет отдельной ответственностью `SYNC-LF-001`; delta protocol — `DELTA-LF-001`. Уже готовая verified local generation должна оставаться читаемой независимо от доступности сети.

## FIN-TRUTH / writes

`PRH_LOCAL_READ_MODEL_V1` не является FIN-TRUTH и не вычисляет финансовые значения как источник истины. Canonical financial write authority = `false`.

Любая будущая аналитика должна либо использовать canonical evaluator/parity contract, либо явно доказать parity. Renderer/Worker/IndexedDB не получают право изменять canonical financial data.

## Rollback

До подключения STORE в product path rollback тривиален: модуль не используется как primary data source. После последующих LF этапов derived IndexedDB всегда может быть wiped/rebuilt, а canonical remote source остаётся независимым источником восстановления.
