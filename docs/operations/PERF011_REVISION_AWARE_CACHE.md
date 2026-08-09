# PERF-011 — revision-aware read cache

Roadmap item: `PERF-011`  
Contract: `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0`  
Depends on: `PERF-010`  
Cost class: `FREE_ONLY`

## Назначение

PERF-011 добавляет bounded read/query cache поверх `PRH_TRANSACTION_REPOSITORY_V1`. Cache не является источником финансовой истины и не имеет права самостоятельно решать, что данные «достаточно свежие».

Главное правило: **перед каждым потенциальным HIT cache обязан получить exact repository revision.** HIT разрешён только если совпадают revision, cache schema/version, repository schema, operation и normalized operation identity.

## Cache identity

Machine key включает:

1. `PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0`;
2. repository schema;
3. exact 64-hex repository revision;
4. operation: `READ_ALL`, `GET_BY_ID` или `QUERY`;
5. SHA-256 normalized operation identity.

`QUERY` identity строится после authoritative `normalizeQuery()`, поэтому semantically identical query objects с другим порядком ключей/list values не создают разные cache keys.

Raw query и raw transaction ID не публикуются в telemetry.

## Freshness и invalidation

- revision отсутствует/не exact 64-hex -> fail-closed `REVISION_CACHE_REVISION_UNKNOWN`; underlying loader не выполняется;
- revision изменилась -> все entries invalidated до проверки HIT;
- TTL истёк -> MISS + reload;
- schema/version/key mismatch -> MISS;
- explicit invalidation очищает entries и forgets last revision.

PERF-011 намеренно **не кэширует revision probe**. Текущий Google `getRevision()` остаётся correctness authority; если future task введёт более дешёвый exact revision producer, cache key/semantics менять не потребуется.

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
- salted-by-domain revision-token hash prefix;
- entry count;
- age ms;
- eviction/invalidation counts.

Telemetry не содержит canonical rows, amounts, descriptions, categories, accounts, members, projects, tags, raw query или raw transaction IDs. Public tests используют только independently generated synthetic finance fixtures.

## PERF-010 interaction

PERF-011 не меняет projection planner или Google bounded range semantics. MISS делегирует underlying repository; поэтому PERF-010 остаётся authoritative read path. Cache HIT может избежать повторной materialization/query работы только после exact revision confirmation.

## Machine evidence

Primary behavioral contract: `tests/repository_cache_adapter_contract_test.js`.

Он проверяет:

- exact revision probe перед HIT;
- same-revision HIT;
- normalized-query identity;
- revision-change invalidation;
- TTL expiry;
- bounded LRU eviction;
- unknown revision fail-closed до loader;
- cache write blocking;
- telemetry privacy.

Dedicated workflow `PERF-011 Cache Contract` даёт независимый signal, но **не заменяет** PR Validation, trusted deploy/runtime health, autonomous merge или Main Verification.

## Rollback

Удалить cache contract/decorator/tests/workflow/docs и продолжить читать напрямую через repository/PERF-010 projection path. Financial/canonical state не требует восстановления.
