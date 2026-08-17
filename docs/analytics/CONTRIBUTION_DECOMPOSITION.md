# ANL-090 — Contribution and change decomposition

## Назначение

`PRH_CONTRIBUTION_DECOMPOSITION_V1@1.0.0` — детерминированный read-only слой аналитики, который раскладывает **арифметическое изменение canonical additive measure между двумя сопоставимыми периодами** по semantic drivers.

ANL-090 отвечает на вопрос «какие агрегированные компоненты составили изменение», но не утверждает причинность. Обязательный invariant: `causality_claimed=false`.

## Upstream authority

ANL-090 опирается на существующие контракты и не расширяет их самостоятельно:

- `PRH_ANALYTICS_CONTRACT_V1@1.0.0`;
- `PRH_ANALYTICS_SEMANTIC_REGISTRY_V1@1.0.0`;
- `PRH_ANALYTICS_PERIOD_ENGINE_V1@1.0.0`;
- `PRH_ADVANCED_VISUALIZATION_PACK_V1@1.0.0`;
- `FIN-TRUTH-v1`.

Финансовую истину и canonical query semantics ANL-090 не вычисляет заново. На вход поступают уже вычисленные semantic aggregates с exact query identity.

## Поддерживаемый scope V1

Core additive measures:

- `INCOME`;
- `EXPENSE`;
- `CASH_FLOW`.

Дополнительная measure допустима только если semantic registry явно доказывает additive/SUM semantics. Ratio/share/average/median/window/non-additive measures fail closed.

Driver dimensions V1:

- `category_id`;
- `account_id`;
- `member_id`;
- `project_id`.

`tag` в текущем `PRH_ANALYTICS_CONTRACT_V1` является filter field, но не groupable dimension. Поэтому ANL-090 **не вводит отдельный `tag_id`** и не расширяет upstream semantic authority. Tag decomposition может появиться только после отдельного изменения canonical analytics/semantic contracts.

## Request contract

`PRH_CONTRIBUTION_REQUEST_V1` содержит:

- одну additive `measure`;
- одну supported `dimension`;
- explicit `current_query`;
- explicit `reference_query`.

Оба query проходят canonical `normalizeAnalyticsQuery()`.

Требования:

1. measure совпадает в request/current/reference;
2. driver dimension присутствует в обоих queries;
3. driver dimension не имеет base filter, иначе decomposition неполная;
4. query context идентичен за исключением `time_range`;
5. периоды explicit и имеют одинаковый span;
6. currency, остальные filters, dimensions, grain, comparison, sort, parameters и limit совместимы.

Любое несовпадение fail closed.

## Period aggregate input

`PRH_CONTRIBUTION_PERIOD_AGGREGATE_V1` содержит:

- exact `query_hash`;
- versioned `source_contract`;
- exact safe-integer `total`;
- zero-or-more unique `{driver_id,value}` rows.

Для каждого периода отдельно проверяется:

`Σ driver values == period total`.

Duplicate driver, unsafe integer, wrong query identity, incompatible source provenance или total mismatch блокируют результат.

## Missing driver semantics

Union drivers строится детерминированно по current/reference rows. Если driver присутствует только в одном периоде, отсутствующая сторона получает zero **только для arithmetic decomposition**. Это не является imputation canonical данных.

States:

- `NEW`;
- `REMOVED`;
- `UNCHANGED`;
- `INCREASE`;
- `DECREASE`.

Arithmetic invariant единственный:

`delta = current - reference`.

Для `EXPENSE` знак не инвертируется ради интерфейса.

## Exact reconciliation

ANL-090 доказывает одновременно:

1. `Σ current driver values = current total`;
2. `Σ reference driver values = reference total`;
3. `Σ contribution deltas = current total - reference total`.

Overflow или mismatch fail closed.

Rows сортируются детерминированно:

1. `absolute_delta` descending;
2. signed `delta` descending;
3. opaque `driver_id` ascending.

`materiality_bps` и `net_contribution_bps` — presentation metadata. Exact integer delta остаётся authority. При zero net delta `net_contribution_bps=null`.

## Evidence и drill-through

Каждая contribution row получает `PRH_CONTRIBUTION_EVIDENCE_V1`:

- read-only current/reference AnalyticsQuery proposal;
- exact driver filter;
- exact query hashes;
- current/reference period hashes;
- hashed driver identity;
- `financial_values_in_navigation=false`;
- `financial_write=false`.

ANL-090 не исполняет evidence query и не получает write authority.

## Waterfall handoff

`toWaterfallSource()` формирует `PRH_ADVANCED_VISUALIZATION_SOURCE_V1` / `WATERFALL`:

- `START = reference total`;
- `DELTA = non-zero contributions` в deterministic order;
- `END = current total`.

VIZ-090 независимо повторно проверяет:

`START + Σ DELTA = END`.

Renderer получает готовую decomposition и не становится источником финансовой истины.

## Privacy и telemetry

Public evidence — synthetic-only. Runtime driver IDs и финансовые значения остаются private.

Telemetry allowlist содержит только:

- schema/version;
- measure/dimension;
- request/result/query hash prefixes;
- driver/changed counts;
- decision/reason.

Запрещены amounts, raw driver IDs/labels, filter values, transaction IDs и runtime locators.

## Authority boundary

Все дополнительные authorities ANL-090 равны false:

- financial truth;
- financial write;
- query execution/mutation;
- canonical mutation;
- storage/network;
- authorization/deployment;
- renderer.

External/paid analytics services отсутствуют; `FREE_ONLY` обязателен.

## Machine evidence

`tests/contribution_decomposition_contract_test.js` проверяет:

- INCOME/EXPENSE/CASH_FLOW arithmetic;
- category/account/member/project dimensions;
- NEW/REMOVED/UNCHANGED/INCREASE/DECREASE;
- triple reconciliation;
- positive/negative/zero net delta;
- empty periods;
- deterministic result/waterfall identity;
- incompatible periods/query contexts;
- aggregate/query/provenance/duplicate/overflow failures;
- exact read-only evidence queries;
- VIZ-090 WATERFALL conservation;
- telemetry privacy;
- отсутствие financial-write/storage/network authority.

Кроме этого обязательны existing full layered/UI/PWA, FIN/privacy/FREE_ONLY и trusted exact-head delivery gates.

## Rollback

Rollback удаляет ANL-090 contract/core/tests/docs. Canonical transactions, FIN-TRUTH, VIZ-090 и работающий Analytics Studio не изменяются и не требуют миграции данных.
