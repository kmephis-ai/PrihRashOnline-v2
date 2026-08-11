# DASH-085 — Wide visual customization

## Назначение

`PRH_DASHBOARD_VISUAL_CUSTOMIZATION_V1@1.0.0` — presentation-only слой для настройки внешнего вида Analytics Studio. Он меняет только способ представления уже существующей semantic result/bound widget configuration и не получает права менять `AnalyticsQuery`, FIN-TRUTH, canonical transactions или dashboard layout.

Поддерживаются:

- theme `SYSTEM / LIGHT / DARK`;
- bounded palette registry;
- density `COMPACT / COMFORTABLE`;
- chart type retype `BAR / LINE / DONUT` через VIZ-070;
- axes;
- labels;
- legend и position;
- stack;
- sort;
- Top-N с обязательным remainder `__OTHER__`;
- number format `AUTO / MONEY / INTEGER / PERCENT / COMPACT`;
- deterministic high-contrast/reduced-motion fallback.

## DESIGN-020 остаётся владельцем design tokens

Customization document не содержит raw theme surface/text/focus colors. `SYSTEM/LIGHT/DARK` разрешаются только в ссылки на существующие DESIGN-020 token sets:

- `DESIGN:light`;
- `DESIGN:dark`.

`SYSTEM` использует system color scheme, который уже является DESIGN-020 accessibility contract.

Density также хранит только aliases на DESIGN tokens:

- `COMPACT` -> spacing `2`, font-size `sm`, line-height `normal`;
- `COMFORTABLE` -> spacing `4`, font-size `md`, line-height `relaxed`.

Оба режима сохраняют minimum hit target >= 44 px и `focus_visible_required=true`.

DASH-085 не создаёт второй CSS/design authority.

## Palette registry

V1 разрешает только три machine-defined palette IDs:

- `DEFAULT`;
- `COLORBLIND`;
- `MONO`.

Arbitrary hex/RGB/RGBA/CSS в preference payload запрещены. Raw series colors находятся только внутри versioned machine registry DASH-085, а не в пользовательском preference document.

При `high_contrast=true` любой цветной palette deterministically разрешается в `MONO`. `MONO` использует DESIGN token references `DESIGN:text`, `DESIGN:text_secondary`, `DESIGN:text_muted`.

Это presentation fallback; финансовые значения/категории не меняются.

## Preference schema

`PRH_DASHBOARD_VISUAL_PREFERENCE_V1` содержит только:

- schema/version;
- theme;
- palette ID;
- density;
- reduced-motion flag;
- high-contrast flag;
- отсортированный массив per-widget overrides.

Canonical preference hash = `SHA256_CANONICAL_JSON_V1`. Порядок object keys и исходный порядок widget overrides не меняют identity.

Preference не содержит financial values, filter values, private labels, transaction IDs, raw CSS, formatter code или HTML/SVG.

## Per-widget override

`PRH_DASHBOARD_WIDGET_VISUAL_OVERRIDE_V1` содержит bounded поля:

- `widget_id`;
- optional target `chart_type`;
- `axes.x/y = AUTO|SHOW|HIDE`;
- `labels = AUTO|SHOW|HIDE`;
- `legend.mode = AUTO|SHOW|HIDE`;
- `legend.position = AUTO|TOP|RIGHT|BOTTOM`;
- `stack = NONE|NORMAL`;
- `sort = NONE|ASC|DESC`;
- optional `top_n {limit, other_policy=REMAINDER}`;
- `number_format` allowlist.

Unknown keys fail closed. Поэтому поля вроде `css`, `color`, `formatter`, `html`, `transaction_id`, `amount_minor` не могут быть незаметно сохранены как visual option.

## Chart retype через VIZ-070

DASH-085 **не реализует собственную chart conversion logic**.

Для bound CHART создаётся canonical `PRH_VISUALIZATION_WIDGET_V2` adapter и вызывается `visualization_registry_v2.retypeWidget()`.

После retype обязательно:

- `query_hash` равен исходному DASH-081 binding query hash;
- `query_modified=false`;
- input binding hash сохраняется как immutable source identity.

Следовательно BAR -> LINE/DONUT не может ради визуального пожелания переписать measure/dimension/filter/query semantics.

VIZ-070 incompatibility остаётся fail-closed. Например BAR с дополнительным `series` нельзя неоднозначно превратить в DONUT — возвращается upstream reason `VIZ070_RETYPE_SERIES_AMBIGUOUS`.

## Semantic capability constraints

Некоторые presentation options зависят от chart type:

- DONUT не имеет x/y axes: non-AUTO axes fail closed;
- DONUT не поддерживает stack;
- `stack=NORMAL` v1 разрешён только BAR с explicit series encoding;
- hidden legend не может иметь non-AUTO position;
- non-chart widget не принимает chart-only axes/labels/legend/stack/chart_type.

Silent downgrade не используется. Пользовательский preference либо совместим, либо получает stable reason code.

## Sort и Top-N

Sort/Top-N — presentation transform над уже произведённым semantic result, а не изменение `AnalyticsQuery`.

`applyTopN()` работает с bounded semantic rows `{key,value}` и не имеет доступа к canonical transaction storage. Значения должны быть safe integers.

При Top-N:

1. rows сортируются deterministic rule;
2. сохраняются первые N;
3. все остальные суммируются в explicit row `__OTHER__`;
4. machine invariant проверяет `source_total == presented_total`.

Если conservation нарушена, operation fail closed `DASH085_TOP_N_CONSERVATION_FAILED`.

Таким образом Top-N может уменьшить визуальный шум, но не менять финансовый total.

`__OTHER__` зарезервирован и не принимается как source key.

## Number format

Допустимые semantic formats:

- `AUTO`;
- `MONEY`;
- `INTEGER`;
- `PERCENT`;
- `COMPACT`.

Locale v1 = `ru-RU`.

Arbitrary format strings, JavaScript functions и external formatter callbacks запрещены. Number format не выполняет financial calculation — только задаёт presentation intent renderer layer.

## Accessibility

DASH-085 сохраняет DESIGN-020 invariants:

- focus-visible required;
- minimum hit target >= 44 px;
- `prefers-color-scheme` / SYSTEM theme;
- reduced-motion support;
- deterministic high-contrast palette fallback.

При `reduced_motion=true` plan ссылается на `DESIGN:motion:reduced_motion_ms`; иначе — на standard DESIGN motion token. Custom animation duration в preference не допускается.

## Presentation plan

`PRH_DASHBOARD_VISUAL_PLAN_V1` содержит:

- widget ID/kind;
- immutable input binding hash;
- immutable query hash;
- `query_modified=false`;
- `binding_modified=false`;
- `FIN-TRUTH-v1` marker;
- customization hash;
- resolved theme/palette/density/accessibility refs;
- validated presentation options;
- resulting ChartSpec при CHART.

Plan является transient presentation artifact, а не новый source of truth для query/finance/storage.

## Privacy и telemetry

Telemetry allowlist:

- `schema`;
- `version`;
- `theme`;
- `density`;
- `widget_kind`;
- `customization_hash_prefix`;
- `query_hash_prefix`;
- `decision`;
- `reason`.

Telemetry не содержит:

- widget ID;
- filter/query values;
- category/account/member labels/IDs;
- transaction IDs;
- financial values;
- palette raw colors;
- formatter/CSS payload.

Public evidence = configuration-only synthetic.

## Authority boundary

Все DASH-085 authority остаются false:

- `financial_truth`;
- `financial_write`;
- `query_execution`;
- `query_mutation`;
- `binding_mutation`;
- `canonical_mutation`;
- `authorization`;
- `storage`;
- `network`;
- `deployment`;
- `renderer`.

`FREE_ONLY` обязателен; external asset/CDN/theme/font service не требуется.

## Тестирование

`tests/dashboard_visual_customization_contract_test.js` проверяет:

- contract/authority/design-token parity;
- deterministic preference identity;
- SYSTEM/LIGHT/DARK theme resolution;
- high-contrast MONO fallback;
- COMPACT/COMFORTABLE DESIGN aliases и 44px target;
- BAR -> LINE/DONUT через VIZ-070 с invariant query hash;
- ambiguous series->DONUT fail-closed;
- axes/legend/stack capability rules;
- non-chart chart-option rejection;
- semantic number formats;
- Top-N deterministic sort + `__OTHER__` + total conservation;
- integer overflow protection;
- raw CSS/color/formatter/private/financial payload rejection;
- privacy-safe telemetry.

Required named gate: `Dashboard visual customization`.

Existing DASH-084/DASH-083/DASH-082/DASH-081/DESIGN/VIZ/ANL/PRIV/STUDIO/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

## Rollback

Rollback DASH-085 удаляет customization contract/core/tests/docs/gate. Default presentation, DESIGN-020, VIZ-070 и DASH-080..084 остаются canonical; data migration не требуется.
