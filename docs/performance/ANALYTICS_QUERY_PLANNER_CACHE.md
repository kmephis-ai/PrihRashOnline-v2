# PERF-070 — Analytics query planner + cache

## Назначение

`PERF-070` ускоряет повторные аналитические запросы, не создавая новый источник финансовой истины. Machine authority — `PRH_ANALYTICS_QUERY_PLANNER_CACHE_V1@1.0.0`. Planner располагается над canonical `AnalyticsQuery`/`AnalyticsResult` и использует уже завершённые слои PERF-011/012/013/014 и ANL-073.

Correctness всегда важнее cache hit. Любой cache/aggregate reuse привязан к точной canonical revision. При несовместимости planner детерминированно возвращается к authoritative `evaluateAnalytics`; heuristic reuse запрещён.

## Query fingerprint

Fingerprint строится из canonical serialization следующих компонентов:

- normalized `PRH_ANALYTICS_QUERY_V1`;
- exact canonical revision SHA-256;
- Analytics contract version;
- Semantic Registry version;
- Planner version.

Порядок JSON keys и порядок независимых filters/значений, которые нормализует AnalyticsQuery, не меняют fingerprint. Семантически значимый порядок dimensions/measures сохраняется upstream contract и поэтому влияет на identity. Raw query не входит в public telemetry.

## Revision-bound cache

In-memory cache имеет bounded TTL и LRU. Default — 64 entries / 60 секунд; hard limits — 256 entries / 300 секунд. Cache entry живёт только в namespace exact fingerprint, включающем revision и schema versions.

При смене canonical revision весь cache очищается. Это optimisation-only state: eviction, expiration или process restart могут ухудшить latency, но не меняют финансовый результат. Financial write, migration, authorization и irreversible-action results в planner не кэшируются.

## Materialized aggregate reuse

Planner может переиспользовать `PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0` только для доказуемого subset:

- projection `CATEGORY_ID`: `grain=NONE`, dimensions=`category_id`, без time range;
- projection `ACCOUNT_ID`: `grain=NONE`, dimensions=`account_id`, без time range;
- projection `MONTH`: `grain=MONTH`, без дополнительных dimensions, только month-aligned half-open range;
- только additive measures из PERF-013;
- `comparison=NONE`;
- filters пусты;
- sort пуст;
- `budget_minor=null`;
- aggregate state revision и currency точно совпадают с source snapshot/query.

Для совместимого запроса из aggregate state строится обычный `PRH_ANALYTICS_RESULT_V1` с canonical query hash и `FIN-TRUTH-v1` provenance. Отдельного «aggregate financial truth» не существует. Contract tests требуют byte/deep parity с `evaluateAnalytics` для CATEGORY_ID, ACCOUNT_ID и MONTH.

Частичный месяц, фильтры, comparison, sort, unsupported measure или иная несовместимость никогда не «подгоняются» под aggregate projection — planner использует canonical evaluator.

## In-flight coalescing

Async execution registry имеет ключ `generation + fingerprint`. Два одинаковых запроса одной generation/revision используют одну underlying computation. Запросы разных generation/revision никогда не coalesce.

Planner не обещает background service: это bounded in-process orchestration. `executeAsync()` существует для UI/request layer, чтобы не запускать несколько одинаковых expensive evaluations одновременно.

## Stale completion и cancellation generation

Каждая async computation запоминает generation и revision на старте. Перед cache commit/result delivery planner повторно сравнивает их с текущим состоянием.

Если за время computation:

- UI/request generation была увеличена;
- canonical snapshot/revision была заменена;

completion возвращается как `DISCARDED_STALE`, result=null и **никогда не помещается в cache**. Старый request generation, переданный после смены generation, отклоняется до computation. Это correctness boundary, а не best-effort cancellation.

## Interaction budget 20k/50k

Отдельный synthetic gate использует существующий `PRH_SYNTHETIC_SCALE_FIXTURE_V1`, профили 20 000 и 50 000 операций и materialized PERF-013 state.

Для поддерживаемого CATEGORY_ID запроса проверяется:

1. cold planner call использует exact-revision `AGGREGATE_REUSE`;
2. следующий same-revision call — `MEMORY_CACHE`;
3. warm call не вызывает новый canonical evaluator;
4. warm call не перестраивает aggregates;
5. financial writes = 0;
6. warm execution укладывается в generous CI ceiling 100 ms.

100 ms — **regression ceiling CI**, а не пользовательский SLA. PERF-014 wall-clock policy остаётся `wall_clock_is_user_sla=false`.

## Privacy и telemetry

Public telemetry содержит только allowlisted technical metadata:

- schema/version/status/reason;
- fingerprint/revision hash prefix;
- cache/inflight entry counts;
- generation;
- hit/miss/reuse/evaluation/coalesce/stale-discard/eviction/expiration counters.

В telemetry/evidence отсутствуют raw query, filters, cached AnalyticsResult, amount/value fields, transaction IDs, category/account/member/project values и private revision payload. Runtime cache contents могут содержать private AnalyticsResult только внутри private process memory и не являются public artifact.

## Safety boundary

`financial_truth=false`, `financial_write=false`, `migration=false`, `network=false`, `storage=false`, `ui=false`, `renderer=false`, `paid_dependency_required=false`. Planner не использует Redis/YDB/paid backend и не изменяет canonical transactions, AnalyticsQuery semantics, Pivot/OLAP semantics или FIN-TRUTH.

Если planner недоступен или rollback выполнен, authoritative fallback — прямой `evaluateAnalytics` и существующие PERF-010..014 components.

## Machine gate и rollback

Named gate `Analytics query planner/cache` запускает correctness/race contract и 20k/50k performance contract. TEST-010 обязан классифицировать correctness test как `PURE_DOMAIN_APPLICATION`, а scale budget test как `ADAPTER_INTEGRATION`.

Rollback — удалить PERF-070 contract/core/tests/doc/gates. PERF-010..014, ANL-073 и canonical evaluator остаются рабочими. DONE возможен только после полного PR Validation, immutable exact candidate, Trusted DEV Deploy, Trusted Runtime Health, autonomous squash merge и Main Verification.
