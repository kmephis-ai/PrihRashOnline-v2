# DASH-085 — широкая визуальная кастомизация дашборда

## Назначение

`DASH-085` вводит versioned presentation-only слой `PRH_DASHBOARD_VISUAL_CUSTOMIZATION_V1@1.0.0` поверх уже связанных виджетов `DASH-081`. Пользователь получает управляемую настройку темы, палитры, типа диаграммы, осей, подписей, легенды, stacking, сортировки, Top-N, числового формата и плотности интерфейса без появления второго источника финансовой логики.

Кастомизация **не изменяет** `AnalyticsQuery`, `FIN-TRUTH-v1`, KPI Dictionary, canonical transactions или финансовые значения. Она описывает только то, как уже разрешённая семантика должна быть представлена.

## Источники authority

Финансовая истина остаётся у `FIN-TRUTH-v1`. Семантика запроса остаётся у canonical `AnalyticsQuery`. Связывание dashboard widget с query/presentation остаётся у `PRH_WIDGET_FACTORY_V1@1.0.0`. Безопасная совместимость и смена `BAR / LINE / DONUT` остаётся у `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`. Design tokens, темы, focus-visible и reduced-motion задаются `PRH_DESIGN_SYSTEM_V1@1.0.0`.

`DASH-085` не получает `financial_truth`, `financial_write`, `query`, `query_execution`, `canonical_mutation`, `storage`, `network`, `auth`, `deploy` или renderer authority.

## Темы

Разрешены только `SYSTEM`, `LIGHT`, `DARK`.

`SYSTEM` следует системной цветовой схеме. `LIGHT` и `DARK` являются явным presentation preference. Цвета не записываются произвольными HEX/RGB/CSS значениями: пользователь выбирает semantic palette ID, а фактические цвета берутся из DESIGN-020 tokens.

Это важно для доступности и сопровождаемости: смена дизайн-системы не требует миграции пользовательских сохранённых цветов.

## Палитры

Контракт содержит bounded registry:

- `DEFAULT` — основная продуктовая палитра;
- `CALM` — более спокойная аналитическая палитра;
- `STATUS` — акцент на positive/warning/danger semantics;
- `MONO` — преимущественно нейтральная палитра.

Каждая палитра содержит только идентификаторы semantic tokens, существующие одновременно в light и dark темах DESIGN-020. Произвольные CSS, HTML, URL, `javascript:` или external asset references запрещены fail-closed.

## Тип диаграммы

DASH-085 не создаёт новый renderer и не расширяет набор chart families. В scope только уже канонические `BAR`, `LINE`, `DONUT`.

Смена типа выполняется через `VIZ-070.retypeWidget()`. До и после retype обязан сохраняться exact canonical `query_hash`, а `query_modified=false`.

Если преобразование неоднозначно или теряет семантику, оно запрещается. Например, `BAR` с `series` нельзя молча превратить в `DONUT`: VIZ-070 завершает такую попытку `VIZ070_RETYPE_SERIES_AMBIGUOUS`.

Advanced families — waterfall, Sankey, treemap, heatmap, scatter и другие — остаются отдельным `VIZ-090` и не входят в DASH-085.

## Оси, labels, legend и stacking

Оси поддерживают `AUTO / SHOW / HIDE`. Они применимы только к CHART. Для `DONUT` оси всегда `HIDE`.

Labels и legend используют `AUTO / SHOW / HIDE`. Legend не может быть включена для не-chart widget.

Stacking поддерживает `AUTO / ON / OFF`; `ON` допустим только для `BAR` или `LINE`, когда исходный canonical ChartSpec имеет `series` binding. DASH-085 не создаёт series и не угадывает её из данных.

## Сортировка и Top-N

Сортировка — presentation directive `NONE / ASC / DESC` по `VALUE` или `LABEL`. Она разрешена только для `CHART` и `TABLE`, имеющих хотя бы одно effective dimension. Directive не переписывает `AnalyticsQuery.sort` и не получает query authority.

Top-N разрешён для `CHART` и `TABLE` с dimension и использует существующий upstream operator `TOP_N_OTHER` из `ANL-072`. Диапазон `N` ограничен `1..20`; остаток всегда представлен как `OTHER`. DASH-085 не реализует собственную формулу Top-N и не отбрасывает данные без reconciliation semantics upstream layer.

## Числовой формат

Разрешены стили `AUTO`, `GROUPED`, `COMPACT`; число дробных знаков `0..2`; знак `AUTO` или `ALWAYS`.

Это только display metadata. Исходные integer-minor значения не округляются и не преобразуются внутри DASH-085, currency/unit semantics не меняются.

## Плотность

Разрешены `COMFORTABLE` и `COMPACT`.

Плотность меняет пространство и presentation density, но не может скрывать данные как единственный способ адаптации. Для chart widgets сохраняются semantic-table fallback и textual summary; focus-visible и reduced-motion наследуются из DESIGN-020.

## Deterministic identity

Нормализованная customization configuration получает SHA-256 identity вместе с `widget_id`, upstream `binding_hash` и canonical `query_hash`. Порядок JSON keys не влияет на identity.

Исходный DASH-081 binding immutable. Результат применения всегда содержит:

- исходный `binding_hash`;
- исходный `query_hash`;
- `query_modified=false`;
- `financial_truth_policy=FIN-TRUTH-v1`;
- нормализованную customization configuration;
- semantic palette token IDs;
- effective ChartSpec только для CHART;
- accessibility plan;
- `customization_hash`.

## Privacy и hostile input

Customization spec не может содержать `AnalyticsResult`, transaction rows, dataset, amounts, balances или другие financial payload. Запрещены также script/html/css/url/href/src поля и строки, похожие на executable/browser injection.

Public tests используют только synthetic configuration. Telemetry содержит только schema/version/theme/chart type/density/customization hash prefix/decision/reason. Query filters, dimension values, financial values, private IDs и полный query/binding hash в telemetry не публикуются.

## FREE_ONLY

DASH-085 не требует CDN, SaaS, paid renderer или API. Он переиспользует локальные/versioned contracts проекта. `FREE_ONLY` остаётся обязательным.

## Machine gate

Named gate: `Dashboard visual customization`.

Он проверяет:

1. точные upstream version bindings;
2. все authority = false;
3. theme/palette/design-token allowlist;
4. VIZ-070 safe retype и exact query-hash invariance;
5. axis/legend/stack semantic constraints;
6. sort/Top-N presentation boundaries;
7. number-format и density boundaries;
8. deterministic identity и source immutability;
9. hostile CSS/HTML/URL/financial payload rejection;
10. privacy-safe telemetry и accessibility fallback.

Gate выполняется вместе со всеми существующими DASH-080..084, STUDIO/PRIV/VIZ/DESIGN/FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA проверками. После PR Validation exact candidate обязан пройти Trusted DEV Deploy, Trusted Runtime Health, CI-003 autonomous merge и Main Verification.

## Rollback

Rollback DASH-085 удаляет только customization contract/core/tests/docs/gate. `DASH-080..084`, canonical widget bindings, saved views, query semantics и financial truth остаются действующими без изменения.
