# VIZ-070 — Visualization Registry v2

## Назначение

`VIZ-070` вводит versioned registry визуализаций поверх уже канонического VIZ-020. Registry отвечает только за совместимость semantic bindings, безопасную смену типа графика, выбор renderer capability и deterministic responsive/a11y fallback. Он не вычисляет финансовые показатели, не меняет `AnalyticsQuery` и не является источником `FIN-TRUTH-v1`.

Machine contract: `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`.

Upstream остаются:

- `PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` — ChartSpec/WidgetSpec, FilterContext/DrillContext, render dataset и ECharts adapter;
- `PRH_EXPLORATION_STATE_V1@1.0.0` — shared filter/drill/navigation state;
- `PRH_ANALYTICS_CONTRACT_V1@1.0.0` — canonical query/result semantics;
- `FIN-TRUTH-v1` — финансовая истина.

## Что входит в Registry v2

Версия 2 намеренно поддерживает только уже существующие `BAR`, `LINE` и `DONUT`. Расширенные семейства — waterfall, Sankey, treemap/sunburst, heatmap, scatter/bubble, distribution и другие — относятся к отдельному `VIZ-090` и не скрываются внутри базового registry.

Каждая registry entry фиксирует:

- required/optional semantic encoding roles;
- допустимые `DIMENSION`/`MEASURE` bindings;
- primary renderer;
- filter/drill capabilities;
- responsive strategy для mobile/tablet/desktop;
- обязательный semantic-table fallback;
- обязательность текстового доступного summary.

## Query compatibility

ChartSpec считается совместимым только с normalized `AnalyticsQuery`.

Registry требует, чтобы множество dimension bindings графика **точно совпадало** с effective query dimensions. Если query содержит дополнительную dimension, которая не закодирована chart spec, plan отклоняется. Это защищает от скрытого объединения разных canonical rows в одну визуальную категорию.

Для `grain != NONE` effective dimension включает `time_bucket`. Поэтому временной LINE/BAR должен явно кодировать `time_bucket` по оси.

Каждый measure binding обязан присутствовать в query measures. Registry никогда не добавляет и не удаляет measures, dimensions, filters, period, comparison, scope или sort.

Результат compatibility содержит исходный canonical `query_hash`, `query_modified=false` и `financial_truth_policy=FIN-TRUTH-v1`.

## Безопасная смена типа графика

`BAR <-> LINE` сохраняет `x`, `y` и optional `series` без изменения `query_ref` и query hash.

`BAR|LINE -> DONUT` разрешён только когда отсутствует `series` и существует однозначная пара `DIMENSION + MEASURE`. Mapping:

- `x -> category`;
- `y -> value`.

`DONUT -> BAR|LINE` выполняет обратное однозначное mapping.

Если BAR/LINE использует `series`, преобразование в DONUT fail-closed с `VIZ070_RETYPE_SERIES_AMBIGUOUS`: registry не имеет права выбрасывать query dimension ради визуального удобства.

После retype новая ChartSpec повторно проходит VIZ-020 normalization и query-compatibility. До и после retype canonical query hash обязан быть идентичным.

## Renderer capabilities

Primary browser renderer остаётся `ECHARTS_6`:

- Apache ECharts 6;
- local-or-bundled loading;
- replaceable adapter;
- no external CDN requirement;
- no network/storage/query/financial-truth authority.

Registry также объявляет `SEMANTIC_TABLE_V1` как встроенный accessible fallback. Он не является альтернативным financial engine: таблица получает уже подготовленный private render dataset через существующую presentation boundary.

Registry plan не компилирует ECharts option самостоятельно — это остаётся обязанностью VIZ-020 adapter. Благодаря этому ECharts остаётся заменяемым, а semantic registry не связывается с конкретным renderer API.

## Responsive plan

Breakpoints версии 2:

- mobile: 240–479 px;
- tablet: 480–1023 px;
- desktop: 1024–8192 px.

Strategy определяется chart registry и не меняет dataset/query:

- BAR mobile: `HORIZONTAL_SCROLL_OR_REDUCE_LABEL_DENSITY`;
- LINE mobile/tablet: `REDUCE_LABEL_DENSITY`;
- DONUT mobile/tablet: `LEGEND_BELOW`;
- desktop: `STANDARD`.

Невалидная ширина не clamp-ится молча и завершается fail-closed.

## Accessibility

Для каждого chart type обязательны:

- semantic table fallback;
- текстовое summary;
- запрет использовать hover/click/animation как единственный канал доказательств.

`assistive_mode=true` детерминированно выбирает `SEMANTIC_TABLE_V1`. Это presentation decision; query hash и financial truth не меняются.

Filter/drill interactions продолжают использовать VIZ-020 `FilterContext`/`DrillContext`. Safe chart retype обязан давать тот же semantic filter context при эквивалентном выборе dimension value. Полученный context может быть передан ANL-074 Exploration State без schema fork.

## Privacy-safe telemetry

Публичная telemetry содержит только:

- schema/version;
- chart type;
- renderer;
- responsive mode/strategy;
- a11y fallback flags;
- query-hash prefix;
- `query_modified`;
- decision/reason.

Запрещены financial values, render rows, raw filters, query payload, widget/query references и private dimension values.

## Границы authority

Registry имеет `query=false`, `financial_truth=false`, `financial_write=false`, `storage=false`, `network=false`, `persistence=false`.

Он не меняет KPI Dictionary, canonical transactions, AnalyticsQuery/AnalyticsResult, scopes, periods, comparisons или calculated metrics. Нельзя «починить» несовместимый chart автоматическим изменением запроса — такой случай должен завершиться объяснимым fail-closed reason.

## Стоимость и зависимости

Обязательные tests работают локально на synthetic configuration. Network и paid dependency отсутствуют; `FREE_ONLY` обязателен. ECharts не загружается с внешнего CDN.

После Main Verification VIZ-070 становится reusable presentation registry для R8 Analytics Studio/Dashboard и будущего VIZ-090 advanced visualization pack, не передавая им финансовую authority.
