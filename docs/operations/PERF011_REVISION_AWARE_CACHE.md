# PERF-011 — revision-aware read cache

Roadmap item: `PERF-011`  
Contract: `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0`  
Depends on: `PERF-010`  
Cost class: `FREE_ONLY`

## Назначение

PERF-011 добавляет bounded read/query cache поверх `PRH_TRANSACTION_REPOSITORY_V1`. Cache не является источником финансовой истины и не имеет права самостоятельно решать, что данные «достаточно свежие».

Главное правило: **перед каждым потенциальным HIT cache обязан получить exact repository revision.** HIT разрешён только если совпадают revision, cache schema/version, repository/adapter/projection namespace, operation и normalized operation identity.

## Cache identity

Machine key включает:

1. `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0`;
2. repository schema;
3. versioned repository adapter namespace (`adapter_schema/adapter_version/mapping_version`, если они доступны; generic repository получает deterministic generic namespace);
4. versioned `projection_identity`;
5. exact 64-hex repository revision;
6. operation: `READ_ALL`, `GET_BY_ID` или `QUERY`;
7. SHA-256 normalized operation identity.

`QUERY` identity строится после authoritative `normalizeQuery()`, поэтому semantically identical query objects с другим порядком ключей/list values не создают разные cache keys.

Если wrapped repository объявляет `capabilities.projection=true`, explicit `projection_identity` обязателен; отсутствие identity fail-closed `REVISION_CACHE_PROJECTION_IDENTITY_REQUIRED`. Для PERF-010 Google path вызывающая сторона должна передать exact `PRH_GOOGLE_QUERY_PROJECTION_V1@<version>`. Смена adapter/mapping/projection version создаёт другой key namespace даже при совпавших revision и query, поэтому старый entry не может дать ложный HIT.

Raw query, raw transaction ID и raw adapter/projection namespace не публикуются в telemetry: namespace участвует только внутри SHA-256 cache key.

## Freshness и invalidation

- revision отсутствует/не exact 64-hex -> fail-closed `REVISION_CACHE_REVISION_UNKNOWN`; underlying loader не выполняется;
- revision изменилась -> все entries invalidated до проверки HIT;
- TTL истёк -> MISS + reload;
- cache schema/version mismatch -> MISS;
- adapter/mapping/projection namespace change -> новый key/MISS;
- explicit invalidation очищает entries и forgets last revision.

PERF-011 намеренно **не кэширует revision probe**. Текущий Google `getRevision()` остаётся correctness authority; если future task введёт более дешёвый exact revision producer, cache key/freshness semantics менять не потребуется.

Это означает, что PERF-011 не обещает сам по себе устранить стоимость exact revision producer. Его задача — не повторять materialization/query computation, когда exact revision уже доказана. Более крупная single-scan/revision pipeline относится к PERF-012.

## Bounds

Versioned defaults:

- TTL `30 000 ms`, maximum `300 000 ms`;
- max entries `64`, hard maximum `512`;
- eviction `LRU`.

Eviction влияет только на performance: evicted entry превращается в MISS, а не в stale/unknown result.

## Read-only authority

Decorator exposes `readAll`, `getById`, `query`, `getRevision`, explicit `invalidate` and technical cache telemetry.

`writeBatch()` cache layer всегда возвращает:

```text
BLOCKED / REVISION_CACHE_WRITE_NOT_AUTHORIZED
```

Даже если synthetic wrapped repository имеет test-only write authority, cache layer не наследует её. Migration/write authorization/rollback state никогда не кэшируются.

## Privacy-safe telemetry

Разрешены только:

- cache HIT/MISS/EMPTY;
- bounded reason code;
- operation name;
- cache key SHA-256;
- domain-separated revision-token hash prefix;
- entry count;
- age ms;
- eviction/invalidation counts.

Telemetry не содержит canonical rows, amounts, descriptions, categories, accounts, members, projects, tags, raw query, raw transaction IDs или raw cache namespace. Public tests используют только independently generated synthetic finance fixtures.

## PERF-010 interaction

PERF-011 не меняет projection planner или Google bounded range semantics. MISS делегирует underlying repository; поэтому PERF-010 остаётся authoritative read path. Cache HIT может избежать повторной materialization/query работы только после exact revision confirmation.

Projection-aware repository не может быть обёрнут cache без exact versioned projection identity. Это связывает PERF-011 с PERF-010 semantics fail-closed, но не создаёт compile-time dependency generic cache module на Google adapter.

## Machine evidence

Primary behavioral contract: `tests/repository_cache_adapter_contract_test.js`.

Он проверяет:

- exact revision probe перед HIT;
- same-revision HIT;
- normalized-query identity;
- adapter/projection namespace входит в cache key;
- projection-capable repository без identity fail-closed;
- projection namespace change меняет key;
- revision-change invalidation;
- TTL expiry;
- bounded LRU eviction;
- unknown revision fail-closed до loader;
- cache write blocking;
- telemetry privacy, включая отсутствие raw adapter/projection namespace.

Dedicated workflow `PERF-011 Cache Contract` даёт независимый signal, но **не заменяет** canonical PR Validation, trusted deploy/runtime health, autonomous merge или Main Verification. PR Validation также обязан запускать named PERF-011 gate и full TEST-010 layered suite.

## Rollback

Удалить cache contract/decorator/tests/workflow/docs и продолжить читать напрямую через repository/PERF-010 projection path. Financial/canonical state не требует восстановления.
