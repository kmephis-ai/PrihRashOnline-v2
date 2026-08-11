# TEST-070 — комбинаторный regression gate семантической аналитики

## Назначение

`TEST-070` завершает доказательную часть R7 / Semantic Analytics. Он не добавляет новую финансовую функциональность и не является новым источником финансовой истины. Его задача — связать уже реализованные и независимо протестированные контракты аналитики в один воспроизводимый bounded regression gate и доказать, что поддержанные комбинации сохраняют одинаковую canonical семантику.

Machine contract: `PRH_COMBINATORIAL_ANALYTICS_REGRESSION_V1@1.0.0`.

Upstream authority остаётся неизменной: canonical transactions + KPI Dictionary / `FIN-TRUTH-v1` → `AnalyticsQuery` / `AnalyticsResult`. Period/comparison, calculated metrics, scopes, personal benchmarks, Pivot/OLAP, exploration state и query planner/cache являются orchestration/derived слоями и не получают права переопределять KPI.

## Почему не полный декартов перебор

Полный Cartesian product всех periods, dimensions, filters, scopes, comparisons и visualization-oriented состояний быстро становится огромным, медленным и плохо сопровождаемым. Для обязательного GitHub gate это создало бы нестабильный CI и расход бесплатных минут без пропорционального роста доказательности.

Поэтому TEST-070 использует `SEEDED_BOUNDED_ROTATION`:

- фиксированный versioned seed;
- 48 representative cases в версии 1;
- hard limit 96 cases;
- deterministic выбор measure/dimension/filter/time/grain;
- любая ошибка воспроизводится по `seed + case_id`;
- изменение matrix/seed/bounds требует versioned contract change.

Это regression sampling, а не статистический fuzzing и не попытка доказать математическую полноту пространства входов.

## Representative matrix

Версия 1 комбинирует:

- measures: `EXPENSE`, `INCOME`, `CASH_FLOW`;
- scalar, `category_id`, `account_id`, `member_id`, `project_id`, `category_id + account_id`;
- без фильтра, posted, expense, expense/refund, account, category и tag filters;
- full history и годовые окна 2024–2026;
- native analytics grains `NONE`, `MONTH`, `YEAR`;
- отдельные cross-layer cases для `ALL_CANONICAL`, `DEFAULT_ANALYSIS`, `EMERGENCY_FUND_ONLY`;
- previous comparable period и personal rolling baseline;
- canonical evaluator, PERF-013 aggregate reuse, memory cache и Pivot/OLAP paths.

Public fixture строится только `generateSyntheticScaleTransactions()` и не содержит real или real-derived household finance data.

## Инварианты canonical analytics

Для каждого generated query gate проверяет canonical normalization и hash determinism. Порядок JSON keys, filters и values там, где upstream `AnalyticsQuery` объявляет его семантически незначимым, не должен менять query hash.

Каждый результат обязан иметь `FIN-TRUTH-v1` provenance, `legacy_total_cells_used=false`, `ui_logic_used=false` и integer-safe minor-unit measures. Для additive grouped results сумма rows обязана точно совпадать со scalar companion query на тех же time/filter boundaries.

TEST-070 не исправляет неподдержанную комбинацию. Если upstream contract запрещает состояние, ожидается versioned fail-closed reason. Примеры версии 1: grouped `BUDGET_VARIANCE` и truncated Pivot source.

## Query planner/cache parity

Каждый representative AnalyticsQuery исполняется authoritative evaluator и PERF-070 planner. Cold planner result обязан deep-equal canonical result. Повторный equivalent query на той же revision обязан возвращаться из memory cache без изменения результата.

Отдельные доказуемые PERF-013 projections проверяют `CATEGORY_ID`, `ACCOUNT_ID` и month-aligned `MONTH`: first execution = aggregate reuse, затем memory cache; оба результата deep-equal canonical evaluator.

После `replaceSnapshot()` новая canonical revision обязана инвалидировать old cache identity. Старое значение не может стать current truth.

## Scope и exploration composition

`ALL_CANONICAL` scoped evaluation обязан быть идентичен direct canonical evaluation. Для `DEFAULT_ANALYSIS` и `EMERGENCY_FUND_ONLY` TEST-070 сначала применяет versioned scope overlay, затем сравнивает scoped analytics с direct evaluation именно от полученного scoped transaction view.

Canonical source rows не мутируются.

Exploration filters проверяются отдельно как configuration state: INCLUDE пересекаются, EXCLUDE объединяются, перестановка filter order не меняет effective context. TEST-070 не преобразует `FilterContext` в скрытую альтернативную финансовую формулу.

## Period, calculated metrics и benchmark

Version 1 строит месячный period series поверх canonical evaluator и проверяет `MOVING_AVERAGE`. Затем тот же PeriodResult используется personal rolling baseline, а отдельный comparable PeriodResult — `PREVIOUS_COMPARABLE_PERIOD`.

Benchmark result остаётся `financial_truth=false`; reference provenance обязана указывать на существующие ANL-071/ANL-072 operators. TEST-070 не копирует delta или rolling formulas.

## Pivot/OLAP reconciliation

Для canonical result с axes `category_id × account_id` строится Pivot с additive `SUM` и bounded Top-N. Pivot grand total обязан точно совпасть со scalar canonical query, а Top-N source/output totals — reconciled. Перестановка source rows не меняет Pivot result identity.

## Transfer и currency boundaries

Query, ограниченный только canonical transfers, обязан давать нулевой household `CASH_FLOW`: transfer не становится внешним доходом или расходом.

Dataset версии 1 целиком RUB. Запрос EUR не выполняет implicit FX conversion и не получает RUB values. TEST-070 не вводит FX provider или market-data dependency.

## Privacy-safe evidence

Публичный TEST-070 report содержит только:

- schema/version;
- seed;
- case count;
- число уникальных query-hash prefixes;
- status/reason.

В evidence запрещены transaction rows, `amount_minor`/`value_minor`, account/category/member/project values, raw filters и другие финансовые payload. Detailed assertion failures могут содержать только `seed + case_id + technical reason`; synthetic row payload в публичный telemetry report не переносится.

## Runtime и стоимость

Gate имеет generous 20-second CI regression ceiling для 720 synthetic rows и 48 representative cases. Это не пользовательский SLA. Hard bounds нужны только для обнаружения случайного combinatorial explosion.

Network, paid provider, external OLAP backend и persistent cache не требуются. `FREE_ONLY` обязателен.

## Authority boundary

TEST-070 не имеет authority на financial truth, financial write, storage, network, runtime deployment, UI или renderer. Красный TEST-070 gate нельзя обходить; исправляется либо сам test/generator при доказанном defect, либо соответствующий upstream contract в его отдельном Roadmap scope.

После Main Verification `TEST-070 = DONE` закрывает `MASTER-G7 / Semantic analytics`, если все остальные R7 dependencies остаются DONE.
