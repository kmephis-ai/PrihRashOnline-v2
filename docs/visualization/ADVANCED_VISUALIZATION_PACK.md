# VIZ-090 — Advanced visualization pack

## Назначение

`PRH_ADVANCED_VISUALIZATION_PACK_V1@1.0.0` расширяет визуальный слой PrihRashOnline сложными типами графиков, сохраняя ключевую архитектурную границу: **визуализация получает уже вычисленный semantic source и не становится источником финансовой истины**.

Pack строится поверх:

- `PRH_VISUALIZATION_REGISTRY_V2@2.0.0` / VIZ-070;
- `PRH_ANALYTICS_CONTRACT_V1@1.0.0`;
- renderer `ECHARTS_6` только в режиме `LOCAL_OR_BUNDLED`;
- accessible fallback `SEMANTIC_TABLE_V1`;
- `FIN-TRUTH-v1`.

VIZ-070 `BAR / LINE / DONUT` остаются каноническими и не переписываются VIZ-090. Advanced pack является отдельным versioned semantic planner над существующим renderer/query boundary.

## Поддерживаемые семейства

V1 регистрирует:

- `AREA`;
- `GROUPED_BAR`;
- `STACKED_BAR`;
- `PERCENT_STACKED_BAR`;
- `WATERFALL`;
- `SANKEY`;
- `TREEMAP`;
- `SUNBURST`;
- `CALENDAR_HEATMAP`;
- `MATRIX_HEATMAP`;
- `PARETO`;
- `SCATTER`;
- `BUBBLE`;
- `HISTOGRAM`;
- `BOX`;
- `VIOLIN`;
- `SMALL_MULTIPLES`;
- `BULLET_KPI`.

Existing `LINE` остаётся VIZ-070 и входит в regression parity как базовая линия.

## Semantic source вместо renderer options

Каждый advanced source использует `PRH_ADVANCED_VISUALIZATION_SOURCE_V1`:

- `query_hash` — exact identity уже нормализованного `AnalyticsQuery`;
- `source_contract` — versioned upstream contract, создавший semantic facts;
- `shape` — явная форма данных;
- `data` — bounded typed payload.

VIZ-090 не принимает arbitrary ECharts option, formatter callback, JavaScript, HTML, CSS или URL как configuration API.

Planner заново вычисляет hash переданного `AnalyticsQuery` и требует точного совпадения с `source.query_hash`. Ни measure, ни dimension, ни filter, ни period, ни scope/comparison не могут быть добавлены или удалены ради выбранного графика.

`query_modified=false` обязателен для каждого plan.

## Registry и совместимость

Каждый chart type machine-declared:

- expected `source_shape`;
- required/optional semantic roles;
- filter/drill capability;
- mobile/tablet/desktop responsive strategy;
- universal accessible table/text fallback.

Несовместимая source shape fail-closed. Silent conversion к «похожему» графику не используется.

## Area и bar families

`AREA` использует explicit time-series rows.

`GROUPED_BAR`, `STACKED_BAR`, `PERCENT_STACKED_BAR` используют explicit category/series/value rows.

Для stack families series dimension обязателен. `PERCENT_STACKED_BAR` принимает только non-negative values, сохраняет исходные absolute values и отдельно вычисляет presentation `share_bps`.

Для каждой positive-total категории basis points распределяются deterministic largest-remainder rule и в сумме дают ровно `10000`. Для категории с total=0 все `share_bps=0` и состояние явно `ZERO_TOTAL`. Нормализованные проценты никогда не заменяют upstream total.

## Waterfall

`WATERFALL` принимает explicit ordered rows:

- один `START`;
- zero-or-more `DELTA`;
- один `END`.

Order обязан быть unique contiguous. Planner проверяет exact safe-integer invariant:

`START + Σ DELTA = END`.

VIZ-090 **не вычисляет contribution decomposition**. Будущий ANL-090 должен предоставить уже объяснённые deltas с provenance; renderer только проверяет conservation и строит presentation plan.

## Sankey

`SANKEY` принимает bounded source/target/value edges:

- node IDs opaque и deterministic;
- duplicate/self edges запрещены;
- values non-negative safe integers;
- node/edge count bounded.

Cycles в общей topology не превращаются в причинные утверждения. Plan маркирует `causality_claimed=false`.

## Treemap / Sunburst

`HIERARCHY` содержит explicit node ID, `parent_id`, value.

Требования:

- ровно один root;
- orphan запрещён;
- disconnected/cyclic structure запрещена;
- depth bounded;
- non-negative exact values;
- для каждого non-leaf parent выполняется exact `parent.value = Σ direct children.value`.

Это presentation hierarchy validation, а не финансовая классификация.

## Heatmaps

`CALENDAR_HEATMAP` и `MATRIX_HEATMAP` хранят `present` отдельно от `value`.

- `present=true` требует numeric value, включая явный zero;
- `present=false` требует `value=null`.

Таким образом missing bucket не смешивается с финансовым нулём.

Palette/color mapping остаётся presentation concern и не меняет значения.

## Pareto

`PARETO` принимает unique category + non-negative exact value.

Rows сортируются deterministic descending value + category tie-break. Planner сохраняет original total и вычисляет cumulative basis points. При positive total последняя строка обязана завершаться точно на `10000 bps`.

Pareto ordering/cumulative presentation не изменяет upstream category totals.

## Scatter / Bubble

`SCATTER` принимает finite numeric `x/y`; `BUBBLE` дополнительно требует non-negative `size`.

IDs unique, series bounded, NaN/Infinity и слишком большие значения fail-closed.

Visualization plan явно хранит:

- `correlation_claimed=false`;
- `causality_claimed=false`.

Интерпретация статистической связи относится к будущему ANL-092, а не к renderer.

## Histogram / Box / Violin

Distribution families получают `DISTRIBUTION_SAMPLES` с explicit samples и bounded series/sample counts.

V1 хранит `source_semantics=EXPLICIT_SAMPLES` и детерминированно сортирует sample values. Renderer не имеет права при отсутствии samples молча подставлять средние, percentile summary или синтетическое распределение.

Более сложные distribution facts/seasonality будут authority ANL-091.

## Small multiples

`SMALL_MULTIPLES` принимает explicit facet/x/series/value rows.

Facet count bounded. Все facets используют `scale_policy=SHARED_COMPATIBLE`; mobile strategy `STACK_FACETS`, tablet/desktop `GRID_FACETS`.

Ни один facet не удаляется молча ради viewport.

## Bullet/KPI

`BULLET_KPI` требует explicit:

- `actual`;
- `reference`;
- `target`;
- `reference_provenance`;
- `target_provenance`.

Provenance должен быть versioned upstream contract ID. VIZ-090 не invent’ит budget/target/reference и не превращает presentation reference в FIN-TRUTH.

## Numeric и capacity boundaries

V1 limits:

- rows: 5000;
- series: 16;
- nodes: 500;
- edges: 1000;
- hierarchy depth: 12;
- facets: 12;
- samples: 5000;
- opaque IDs: 128 chars;
- title: 160 chars.

Exact monetary-like presentation rows используют safe integers. Scatter/distribution numeric samples требуют finite values с bounded magnitude. Overflow, NaN, Infinity и ambiguous shape fail closed.

## Responsive и accessibility

Для каждого family registry задаёт deterministic strategy на MOBILE/TABLET/DESKTOP через VIZ-070 viewport classifier.

Во всех случаях обязательны:

- `semantic_table_required=true`;
- `text_summary_required=true`;
- `interaction_only_evidence_allowed=false`.

Assistive mode всегда переключает active renderer на built-in `SEMANTIC_TABLE_V1`. Small screen может предпочесть table/stack/reduced labels, но не имеет права скрыть данные как единственный fallback.

## Renderer boundary

Primary renderer остаётся VIZ-070 `ECHARTS_6`:

- `LOCAL_OR_BUNDLED`;
- replaceable;
- no network authority;
- no storage authority;
- no financial truth authority;
- no query authority.

VIZ-090 не добавляет external CDN, fonts, SaaS или paid dependency. `FREE_ONLY` обязателен.

## Privacy и telemetry

Runtime normalized source может содержать private values/labels и остаётся private ephemeral presentation payload.

Telemetry allowlist содержит только:

- schema/version;
- chart type;
- renderer;
- result-shape hash prefix;
- query hash prefix;
- row/series counts;
- responsive mode;
- decision/reason.

Financial values, category/account/member/project IDs/labels и raw samples в telemetry отсутствуют. Public GitHub fixtures используют independently generated synthetic data only.

## Authority boundary

Все VIZ-090 authorities = false:

- financial truth/write;
- query/query mutation;
- storage/persistence;
- network;
- authorization;
- deployment.

Pack не читает canonical transactions, finance/KPI modules или persistence adapters.

## Machine evidence

`tests/advanced_visualization_pack_contract_test.js` проверяет:

- registry coverage всех 18 advanced families;
- VIZ-070 LINE/renderer parity;
- exact AnalyticsQuery hash invariant;
- deterministic order/hash;
- percent-stack exact 10000 bps;
- waterfall conservation;
- Sankey topology/value guards;
- hierarchy root/orphan/reconciliation rules;
- missing-vs-zero heatmap semantics;
- Pareto total/cumulative invariant;
- scatter/bubble numeric/no-causality boundary;
- explicit distribution samples;
- small-multiple facet bound/no-drop policy;
- bullet provenance;
- shape mismatch and unsupported interactions;
- hostile renderer payload rejection;
- privacy-safe telemetry;
- assistive `SEMANTIC_TABLE_V1` fallback.

Required named gate: `Advanced visualization pack`.

Existing VIZ-070/DASH-086..080/ANL/PRIV/STUDIO/DESIGN/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

## Rollback

Rollback VIZ-090 удаляет advanced pack contract/core/tests/docs/gate. VIZ-070 `BAR/LINE/DONUT` и полностью завершённый R8 Analytics Studio остаются canonical и работоспособными.
