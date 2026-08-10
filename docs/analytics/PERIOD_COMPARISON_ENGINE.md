# ANL-071 — универсальный движок периодов и сравнений

## Назначение

`PRH_ANALYTICS_PERIOD_ENGINE_V1@1.0.0` добавляет детерминированный temporal orchestration layer поверх `PRH_ANALYTICS_CONTRACT_V1@1.0.0`. Он отвечает за выбор периода, календарные buckets и сопоставимый период, но **не меняет финансовые формулы, canonical data или KPI authority**.

Ключевой принцип совместимости: ANL-010 v1 остаётся неизменным. Его enum grains по-прежнему не обязан знать `WEEK` и `QUARTER`. ANL-071 разбивает выбранный диапазон на half-open buckets и для каждого выполняет обычный ANL-010 query с `grain=NONE` и `comparison=NONE`. Поэтому новые temporal возможности появляются без заднего изменения уже закрытого контракта.

## Календарная модель

- календарь: proleptic Gregorian;
- timezone semantics: UTC date-only;
- формат даты: `YYYY-MM-DD`;
- диапазон: `[start, end)`, start включён, end исключён;
- неделя начинается в понедельник по ISO convention;
- hidden wall-clock `today` запрещён.

Rolling и period-to-date selectors всегда требуют явную дату `as_of`. Это делает одинаковый query воспроизводимым независимо от времени выполнения.

## Selectors

### `EXPLICIT_RANGE`

Пользователь задаёт exact `start` и `end`. Диапазон должен быть непустым и корректным.

### `ROLLING_7`, `ROLLING_30`, `ROLLING_90`, `ROLLING_365`

Диапазон заканчивается на дне после `as_of` и содержит ровно N календарных дней, включая `as_of`.

### `MTD`, `QTD`, `YTD`

Начало привязано к началу текущего месяца, квартала или года; end = день после `as_of`. Engine хранит natural period bounds и explicit `partial` flag. Если `as_of` — последний день natural period, selector считается полным.

## Grains и buckets

Поддерживаются:

- `NONE` — один bucket на весь выбранный range;
- `DAY`;
- `WEEK` — Monday-to-Monday;
- `MONTH`;
- `QUARTER`;
- `YEAR`.

Boundary bucket обрезается к выбранному range и получает `partial=true`, если его начало или конец не совпадает с natural calendar boundary. Bucket sequence обязан полностью покрывать исходный диапазон без gaps и overlaps; сумма day counts обязана совпадать с day count исходного range.

## Previous comparable period

### Explicit и rolling

`PREVIOUS_COMPARABLE_PERIOD` — непосредственно предшествующий диапазон с тем же exact day count. Quality = `EXACT_DAY_COUNT`.

### MTD/QTD/YTD

Comparison начинается в начале предыдущего natural calendar period и пытается взять тот же elapsed day count. Если предыдущий период короче, end обрезается по его boundary и quality становится `CLIPPED_SHORTER_CALENDAR_PERIOD`.

Пример: полный март имеет 31 день, но previous comparable February в невисокосном году содержит только 28 дней. Engine не выходит за границу февраля и явно сообщает clipping.

## Year over year

`YEAR_OVER_YEAR` calendar-shifts primary start/end на один год назад. 29 февраля детерминированно clamp'ится к 28 февраля в невисокосном году.

Quality:

- `CALENDAR_ALIGNED` — календарно выровненный диапазон имеет тот же day count;
- `CALENDAR_ALIGNED_DAY_COUNT_DIFF` — календарное выравнивание корректно, но число дней отличается, например полный февраль високосного и невисокосного года.

`leap_adjusted=true` фиксируется, когда конкретная endpoint date потребовала clamp.

## Исполнение через ANL-010

`PRH_ANALYTICS_PERIOD_QUERY_V1` содержит обычные currency/measures/dimensions/filters/sort/parameters/limit и отдельный `period` object. Он **не** добавляет новые grains в ANL-010 query.

Для каждого period bucket строится `PRH_ANALYTICS_QUERY_V1`:

- тот же currency/measures/dimensions/filters/sort/parameters/limit;
- `time_range = bucket [start,end)`;
- `grain=NONE`;
- `comparison={mode:NONE}`.

После этого вызывается существующий `evaluateAnalytics()`. Финансовый результат и provenance остаются у ANL-010/FIN-TRUTH. Period engine лишь оркестрирует ranges.

## `BUDGET_VARIANCE`

Текущий KPI требует scalar `budget_minor` на конкретный query range и не определяет, как автоматически делить один budget между несколькими temporal buckets или сравниваемыми периодами.

Поэтому ANL-071 fail-closed:

- `BUDGET_VARIANCE` разрешён только при `grain=NONE` и `comparison_mode=NONE`;
- temporal bucket series и period comparison для него возвращают `PERIOD_BUDGET_VARIANCE_TEMPORAL_UNSUPPORTED`.

Это не ограничение будущей архитектуры: явная plan/fact/budget comparison semantics относится к последующим Roadmap items и не должна угадываться здесь.

## Serialization и privacy

`serializePeriodSpec()` сериализует только temporal policy: selector dates, grain и comparison mode. Он не сериализует transaction/account/category/member/project IDs, financial values или analytics result.

Public-safe telemetry содержит только temporal metadata: selector kind, grain, comparison mode, day counts, bucket counts, partial/clipped flags, comparison quality и leap-adjusted flag. Financial series и private IDs в telemetry запрещены.

## Границы ответственности

ANL-071:

- не меняет `FIN-TRUTH-v1`, KPI Dictionary или canonical transactions;
- не изменяет enum/semantics закрытого ANL-010 v1;
- не реализует calculated/window metrics ANL-072;
- не реализует personal benchmarks BENCH-070;
- не реализует pivot/OLAP ANL-073 или exploration state ANL-074;
- не имеет IO/network/storage/renderer/UI/financial-write authority;
- использует public synthetic evidence;
- соблюдает `FREE_ONLY`.

## Проверка

Named gate `Period/comparison engine` запускает `tests/period_comparison_engine_contract_test.js`. Property tests проверяют strict dates, leap year, ISO week crossing year, month/quarter/year boundaries, rolling windows, MTD/QTD/YTD, previous comparable clipping, YoY, complete bucket coverage, deterministic serialization, `BUDGET_VARIANCE` fail-closed boundary и ANL-010 parity для synthetic data.
