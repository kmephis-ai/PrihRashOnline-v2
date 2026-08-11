# BENCH-070 — персональные эталоны и механизм сравнений

## Назначение

`BENCH-070` добавляет единый семантический слой сравнений поверх уже существующих контрактов аналитики. Он не создаёт новый финансовый движок и не меняет `FIN-TRUTH-v1`. Источником текущих значений остаются canonical `AnalyticsResult` и `PRH_ANALYTICS_PERIOD_RESULT_V1`, периодическая семантика принадлежит `ANL-071`, области аналитики — `SCOPE-070`, а безопасные производные изменения и скользящие средние — `ANL-072`.

Machine authority: `PRH_PERSONAL_BENCHMARK_V1@1.0.0`. Comparison core остаётся renderer-neutral, storage-neutral, offline и `FREE_ONLY`. Он не получает права записи финансовых данных, сетевого доступа, изменения canonical transactions, управления UI или публикации реальных семейных финансовых значений.

## Поддерживаемые типы сравнений

Разрешён только фиксированный allowlist:

- `PREVIOUS_COMPARABLE_PERIOD` — сравнение с предыдущим сопоставимым периодом. Границы и quality берутся из `PRH_ANALYTICS_PERIOD_ENGINE_V1`; абсолютное и процентное изменение рассчитываются через allowlisted `DELTA_ABS` и `DELTA_PCT` из `PRH_ANALYTICS_CALCULATED_METRICS_V1`.
- `PERSONAL_ROLLING_BASELINE` — персональный baseline из предыдущих bucket текущего ряда. Текущий последний bucket не входит в baseline, чтобы результат не влиял сам на собственный эталон. Среднее строится через `MOVING_AVERAGE` ANL-072 с явным окном 2..24 и политикой `REQUIRE_FULL` либо `ALLOW_PARTIAL`.
- `BUDGET` — сравнение текущего period total с явно переданным budget reference. Такой reference имеет provenance `DECLARED_BUDGET` и не становится canonical financial truth.
- `TARGET` — сравнение с явно объявленной целью `DECLARED_TARGET`. Цель является reference input, а не фактом хозяйственной операции и не создаёт право записи.
- `MANUAL_INDEX` — пользовательский индекс, заданный как явная база в minor units и положительный bounded коэффициент в PPM. Provenance — `USER_DEFINED_MANUAL_INDEX`. Это ручной аналитический эталон, а не внешний рыночный факт.

Неизвестный comparison type, произвольная формула, JavaScript, `eval`, SQL expression или скрытый executable DSL не разрешаются.

## Совместимость period / currency / scope

Любое declared comparison reference обязано быть привязано к тому же периоду, валюте и нормализованной области аналитики, что и основной результат. Scope сравнивается через canonical serialization `PRH_ANALYTICS_SCOPE_V1`, а не по произвольной подписи. Несовпадение периода, валюты или scope завершается fail-closed; автоматическое «похожее» сопоставление запрещено.

Первичная версия BENCH-070 работает со scalar additive semantic measures. Это намеренное ограничение до появления `ANL-073`: multi-dimensional Pivot/OLAP не должен быть неявно реализован внутри benchmark layer. Non-additive KPI, включая `BUDGET_VARIANCE`, не агрегируются как временной ряд и отклоняются.

## Сопоставимый предыдущий период

`PREVIOUS_COMPARABLE_PERIOD` не вычисляет календарные границы самостоятельно. BENCH получает уже рассчитанный `PeriodResult` с `comparison_mode=PREVIOUS_COMPARABLE_PERIOD`, агрегирует primary и reference buckets в scalar total и передаёт компактный typed comparison в ANL-072. Поэтому leap-year, partial-period и clipped-shorter-calendar правила остаются исключительно authority ANL-071.

Поле `quality` сохраняет upstream качество сопоставления. `CLIPPED_SHORTER_CALENDAR_PERIOD` не маскируется как точное сравнение. Если reference равен нулю, используются те же явные состояния ANL-072: `ZERO_REFERENCE_NO_CHANGE` при 0→0 и `ZERO_REFERENCE_UNDEFINED` при ненулевом текущем значении. NaN и Infinity не применяются.

## Персональный rolling baseline

Для rolling baseline история состоит только из bucket, предшествующих текущему последнему bucket. Это исключает самоусреднение текущего периода. Окно ограничено 2..24 значениями. При `REQUIRE_FULL` недостаточная история означает fail-closed `BENCH_ROLLING_BASELINE_INCOMPLETE`. При `ALLOW_PARTIAL` расчёт разрешён, но результат обязан иметь `sample_complete=false` и quality `PARTIAL_BASELINE`.

Расчёт среднего не дублируется в BENCH: используется `MOVING_AVERAGE` из ANL-072. Таким образом правила округления, safe integer arithmetic и missing additive partition наследуются из уже проверенного calculated-metrics layer.

## Budget, Target и Manual Index

Budget и Target передаются через `PRH_PERSONAL_BENCHMARK_MONEY_REFERENCE_V1`. Reference содержит только private runtime value, currency, scope, period и допустимую provenance. BENCH не сохраняет reference и не публикует его в telemetry.

Manual index передаётся через `PRH_PERSONAL_BENCHMARK_MANUAL_INDEX_V1`. Коэффициент выражен в integer PPM (`1 000 000 = 100%`). Reference вычисляется детерминированно с тем же `HALF_AWAY_FROM_ZERO` rounding, который экспортирует ANL-072. Нулевой или отрицательный index, выход за bounded range, несовместимый period/scope/currency и arithmetic overflow завершаются fail-closed.

Внешние market-data providers не входят в required core. В будущем они могут существовать как отдельные optional adapters с собственными privacy/cost contracts, но BENCH-070 и обязательные CI gates не требуют сети, API key или платного SKU.

## Privacy и telemetry

Public repository и CI используют только независимо сгенерированные synthetic fixtures. Runtime result может содержать private calculated values для отображения внутри private приложения, но `benchmarkTelemetry()` отдаёт только allowlisted metadata: schema/version, comparison type, measure ID, scope ID, периодические метаданные, sample count/completeness, quality, decision/reason и версии upstream contracts.

В telemetry запрещены `current_minor`, `reference_minor`, `delta_minor`, `delta_ppm`, transaction IDs, account/category/member/project IDs и другие реальные финансовые payload. `external_market_provider_used=false` в core provenance.

## Safety boundary

`financial_truth=false`, `financial_write=false`, `io=false`, `network=false`, `storage=false`, `renderer=false`, `ui=false`, `external_market_data=false`. Declared reference не может переписать canonical transaction, KPI Dictionary или FIN-TRUTH. BENCH не делает inference пользовательской цели или бюджета из истории и не подменяет отсутствующее значение synthetic fallback.

## Machine gate и rollback

Named PR gate: `Personal benchmark comparisons`. Contract/property tests обязаны доказать deterministic serialization, reuse ANL-071/072/SCOPE-070, previous-period parity, rolling complete/partial behavior, budget/target/manual references, explicit zero-reference states, currency/scope/period mismatch fail-closed, privacy-safe telemetry и отсутствие executable formula/network dependency.

Rollback — удалить BENCH-070 contract/core/tests/doc/gates. `ANL-070`, `ANL-071`, `ANL-072`, `SCOPE-070`, canonical financial data и существующие dashboards при этом не меняются. DONE возможен только после полного PR Validation, trusted exact-head deploy, Trusted Runtime Health, autonomous squash merge и Main Verification.
