# ANL-091 — Seasonality, distribution and concentration

`PRH_SEASONALITY_DISTRIBUTION_CONCENTRATION_V1@1.0.0` — deterministic read-only analytics layer поверх canonical `PRH_ANALYTICS_CONTRACT_V1`.

## Граница ответственности

ANL-091 **не выполняет AnalyticsQuery**, не читает Google Sheets/IndexedDB самостоятельно и не получает financial-write/storage/network/renderer authority. Входом служит exact-query-bound набор уже рассчитанных дневных агрегатов. Поэтому финансовая истина остаётся в canonical analytics/domain layer.

## Явная семантика дней и timezone

Request содержит IANA timezone и explicit time range canonical AnalyticsQuery. Даты dataset — уже агрегированные local calendar days в этой timezone; ANL-091 не делает скрытых timezone-конверсий.

Dataset отдельно перечисляет `observed_days`:

- день в `observed_days`, но без строк = **явный финансовый ноль** для этого агрегированного набора;
- день периода, отсутствующий в `observed_days` = **не наблюдался / coverage gap**, а не ноль;
- строка для ненаблюдаемого дня запрещена fail-closed.

Результат всегда сообщает `COMPLETE` или `PARTIAL`, число наблюдаемых и пропущенных дней и список coverage gaps.

## Seasonality

На дневных totals строятся три фиксированных календарных представления:

- `DAY_OF_MONTH` — 1..31;
- `WEEKDAY` — ISO Monday=1 .. Sunday=7;
- `MONTH_OF_YEAR` — 1..12.

Каждый bucket хранит число наблюдаемых дней, exact integer sum и rational mean (`numerator/denominator`, плюс floor/remainder). Пустой bucket не превращается в synthetic financial value.

## Distribution / percentiles

Отдельно рассчитываются distributions для:

- `DAILY_TOTALS`;
- `DRIVER_TOTALS`.

Percentiles P10/P25/P50/P75/P90/P95 используют `NEAREST_RANK_V1`. Возвращаются count, exact integer sum, min/max, zero/negative/positive counts и rational mean. Алгоритм не использует floating-point финансовые формулы для итоговых денежных значений.

## Pareto / ABC / concentration

Concentration применяется только когда все driver totals неотрицательны и denominator > 0. Иначе результат — `NOT_APPLICABLE` с явной причиной; отрицательные Cash Flow значения не нормализуются и не превращаются в ложные доли.

Доступные deterministic metrics:

- Top-1 / Top-3 / Top-5 share в basis points;
- `HHI_10000`;
- число drivers, достигающих Pareto 80%;
- ABC classification с thresholds A=80%, B=95%, C=остаток.

Сумма driver totals обязана быть точной; сортировка deterministic: value DESC, затем opaque `driver_id` ASC. Drill descriptor остаётся read-only и exact-query-bound.

## Privacy / evidence

Runtime result может содержать приватные driver IDs и финансовые значения, потому что это private analytics result. Public telemetry ограничена hash-prefix/count/status/decision metadata и не содержит financial values, private labels или IDs.

Public tests используют только independently generated synthetic data. FREE_ONLY обязателен; внешние analytics/AI providers не нужны.

## Fail-closed cases

Contract отвергает как минимум:

- query/dataset hash mismatch;
- unsupported measure/dimension;
- driver-filtered request, который сделал бы concentration неоднозначным;
- invalid timezone/time range;
- duplicate observed day;
- row outside explicit observed coverage;
- duplicate `(date, driver_id)`;
- unsafe integer / period / row / driver limits.

Rollback: удалить ANL-091 module/contract/test/doc и вернуть analytics edge gate; ANL-090, semantic registry, FIN-TRUTH и product runtime остаются неизменными.
