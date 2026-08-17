# PERF-012 — Single-scan refresh pipeline

Статус: `IN_PROGRESS` до Main Verification.  
Machine contract: `PRH_SINGLE_SCAN_REFRESH_V1@1.0.0`.  
Roadmap: `PERF-012`, dependency `PERF-011 = DONE`.

## Цель

Один refresh cycle должен материализовать canonical dataset один раз и использовать этот неизменяемый snapshot для связанных repository-query и analytics calculations. Это устраняет повторные canonical data-plane reads внутри одного обновления dashboard, не создавая нового источника финансовой истины.

## Граница семантики

Single-scan coordinator не определяет финансовые правила.

- repository query semantics остаются у `PRH_TRANSACTION_REPOSITORY_V1.applyQuery`;
- analytics semantics остаются у `PRH_ANALYTICS_CONTRACT_V1.evaluateAnalytics` и FIN-010 KPI Dictionary;
- canonical validation остаётся у `PRH_CANONICAL_TRANSACTION_V1`;
- Google projection semantics остаются PERF-010;
- PERF-011 остаётся отдельным exact-revision request cache и не превращается в snapshot authority.

`financial_write=false`. Migration/cutover/network/provider authority отсутствуют.

## Snapshot model

Каждый новый cycle выполняет ровно один вызов `repository.readAll()` и затем:

1. валидирует полный canonical collection;
2. вычисляет exact 64-hex content revision через `repositoryRevision()` на том же snapshot;
3. фиксирует snapshot как immutable point-in-time input;
4. обслуживает `READ_ALL`, `GET_BY_ID`, `QUERY` и `ANALYTICS` локально, без вызовов underlying `getRevision()`, `getById()` или `query()`;
5. не переносит snapshot в следующий refresh cycle.

Такой revision является provenance именно прочитанного canonical snapshot. Separate pre-read `getRevision()` намеренно не используется: в текущем Google adapter он сам требует canonical read и удвоил бы scan budget до начала вычислений.

Изменение источника после старта cycle не должно частично менять уже начатый refresh: старый cycle остаётся согласованным point-in-time snapshot до bounded expiry/invalidation. Следующий cycle обязан снова выполнить canonical read и получить новый revision, если данные изменились.

## Bounds и fail-closed

Default:

- `max_age_ms = 30000`;
- `max_operations = 64`.

Hard max:

- `max_age_ms = 300000`;
- `max_operations = 512`.

После expiry, explicit invalidation или exhaustion следующий logical access fail-closed. Reopen того же snapshot невозможен: нужен новый cycle и новый `readAll()`.

## Read budget

Machine evidence различает:

- `canonical_snapshot_read_count` — сколько canonical snapshot materialization выполнено для cycle; норма `1`;
- `logical_operation_count` — сколько consumers использовали snapshot;
- `snapshot_reuse_count` — сколько consumers после первого повторно использовали уже материализованный snapshot;
- counts по `READ_ALL`, `GET_BY_ID`, `QUERY`, `ANALYTICS`.

Это repository-level read budget. PERF-010 продолжает отдельно измерять физические Google range/cell reads внутри единственного `readAll()`.

## Privacy / telemetry

Public-safe telemetry содержит только bounded technical metadata:

`snapshot_status`, `reason_code`, `cycle_hash`, domain-separated `revision_token_hash_prefix`, read/operation/reuse counts, invalidation count, age и configured bounds.

Запрещены raw query, transaction IDs, canonical rows, суммы, категории, счета, участники, проекты, tags, descriptions и иные financial payload.

## Write boundary

`writeBatch()` coordinator-а всегда возвращает:

`BLOCKED / SINGLE_SCAN_REFRESH_WRITE_NOT_AUTHORIZED`.

Наличие synthetic write capability у wrapped repository не наследуется.

## Verification

Canonical gate: `Single-scan refresh pipeline` в `PR Validation`.

Synthetic contract обязан доказать:

- один canonical `readAll()` на cycle;
- zero underlying `getRevision/getById/query` calls;
- несколько logical operations используют тот же snapshot;
- repository query parity с `applyQuery()`;
- analytics parity с `evaluateAnalytics()` и exact `input_revision`;
- external mutation не создаёт mixed snapshot внутри активного cycle;
- новый cycle читает источник заново и видит новый revision;
- expiry/invalidation/operation budget fail-closed;
- write authority отсутствует;
- telemetry не содержит financial/query/identity payload.

Полный TEST-010 layered suite, responsive UI, security/privacy/FREE_ONLY, trusted deploy/runtime и Main Verification остаются обязательными.

## Rollback

Удалить `single_scan_refresh.*`, его contract test, named PR gate и эту документацию. PERF-010 projection + PERF-011 revision-aware read path остаются authoritative и работоспособными без PERF-012 coordinator.
