# TREND-030 — Long-term Trends

## Назначение

`PRH_LONG_TERM_TRENDS_V1@1.0.0` даёт единый long-term trend слой для rolling и Year-over-Year представлений. Он намеренно является orchestration layer поверх `PRH_ANALYTICS_PERIOD_ENGINE_V1@1.0.0`, а не новым финансовым калькулятором.

Финансовая истина остаётся `FIN-TRUTH-v1` / `PRH_KPI_DICTIONARY_V1@1.0.0`; bucket-level расчёт выполняет существующий ANL-010 evaluator. TREND-030 не меняет KPI formulas, refund/transfer semantics, exact-money policy или canonical transactions.

## Поддержанный контракт

Long-term query поддерживает:

- selectors: `EXPLICIT_RANGE`, `ROLLING_90`, `ROLLING_365`, `YTD`;
- grains: `MONTH`, `QUARTER`, `YEAR`;
- comparison: `NONE` или `YEAR_OVER_YEAR`;
- measures: существующие additive KPI measures, кроме `BUDGET_VARIANCE`;
- не более одной semantic dimension из `account_id`, `category_id`, `member_id`, `project_id`, `type`;
- обычный private AnalyticsQuery filter context на execution boundary.

`BUDGET_VARIANCE` не является additive temporal series и остаётся fail-closed до отдельной comparison semantics. TREND-030 также не реализует share/delta/cumulative/moving average/median/Top-N, CAGR, forecast или benchmark — это соседние Roadmap scopes.

## Временная семантика

Все calendar/range/comparison rules принадлежат ANL-071:

- UTC Gregorian date-only;
- half-open `[start,end)`;
- boundary buckets clip к выбранному диапазону и получают `partial=true`;
- YoY — calendar shift на один год назад с существующей leap-day clamp policy;
- comparison quality (`CALENDAR_ALIGNED`, `CALENDAR_ALIGNED_DAY_COUNT_DIFF` и т.д.) передаётся без переопределения;
- silent proration отсутствует.

Для каждого MONTH/QUARTER/YEAR bucket TREND-030 передаёт ANL-071 query, который вызывает ANL-010 с `grain=NONE` и `comparison=NONE`. Поэтому QUARTER остаётся orchestration grain, а не изменением `PRH_ANALYTICS_CONTRACT_V1@1.0.0`.

## Результат и provenance

`PRH_LONG_TERM_TREND_RESULT_V1` содержит primary/comparison ranges и bucket results от period engine. Provenance явно фиксирует:

- TREND contract version;
- period engine version;
- AnalyticsQuery version;
- semantic registry version;
- KPI Dictionary version;
- `FIN-TRUTH-v1`;
- `formula_layer_added=false`;
- `period_result_passthrough=true`.

TREND-030 не вычисляет процентные изменения или новые totals поверх результата.

## Serialization и privacy

`serializeTrendDefinition()` сериализует только reusable definition: measure IDs, optional dimension ID, temporal selector/grain/comparison и количество filters. Значения filters намеренно не сериализуются этим public-safe definition helper, потому что account/category/member/project IDs могут быть private configuration.

Financial result rows, amounts, transaction IDs и private filter values не входят в definition serialization или public telemetry. Public CI использует только independently generated synthetic canonical transactions.

Telemetry содержит только schema/version, selector/grain/comparison, counts, partial flag, comparison quality и leap-adjusted metadata. Financial values и private IDs отсутствуют.

## Authority и стоимость

TREND-030 имеет `financial_truth=false`, `financial_write=false`, `canonical_mutation=false`, `io/network/storage=false`, `renderer/ui=false`. Google/YDB backend ownership не меняется. `FREE_ONLY` mandatory; внешняя data/API service не требуется.

## Machine gate

Named gate `Long-term trends` выполняет `tests/long_term_trends_contract_test.js`. Тест доказывает:

- registry/KPI/period upstream parity;
- rolling 365 + monthly YoY;
- explicit partial boundary buckets;
- leap-year YoY day-count quality;
- YTD + quarter orchestration;
- one-dimension/filter execution;
- exact parity bucket results с ANL-071;
- forbidden selector/grain/comparison/measure/dimension fail-closed;
- financial-payload-free definition serialization/telemetry.

Gate относится к `PURE_DOMAIN_APPLICATION` и не требует Apps Script, DOM, network или storage.

## Definition of Done

TREND-030 завершён только после green named gate, existing FIN/MIG/analytics/profile/AI/LANG-RU/privacy/FREE_ONLY/full layered/UI/PWA regressions, immutable exact candidate, Trusted DEV Deploy, Trusted Runtime Health, CI-003 autonomous merge и Main Verification.
