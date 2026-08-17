# DASH-081 — Widget factory и semantic bindings

## Назначение

`PRH_WIDGET_FACTORY_V1@1.0.0` — configuration-only слой между DASH-080 responsive layout и уже существующими canonical analytics/visualization contracts. Его задача — явно связать placeholder widget с `PRH_ANALYTICS_QUERY_V1` и presentation spec, не перенося финансовые вычисления в dashboard layer.

Поддерживается единый registry пяти типов:

- `KPI`;
- `CARD`;
- `CHART`;
- `TABLE`;
- `PIVOT`.

DASH-081 не создаёт новый источник FIN-TRUTH. Canonical финансовый смысл остаётся в Analytics/KPI/semantic layers, а widget binding только описывает, какой canonical query и какой presentation contract должны использоваться вместе.

## Границы authority

Widget factory не имеет прав:

- вычислять KPI или FIN-TRUTH из transactions;
- изменять `AnalyticsQuery`;
- выполнять query;
- записывать canonical transactions;
- выполнять financial write;
- выдавать authorization;
- обращаться к network/storage/deployment;
- сохранять dashboard versions;
- принимать financial result rows или transaction payload внутрь binding spec.

Все соответствующие authority равны `false`. `FREE_ONLY` обязателен.

## Versioned schemas

Основной contract: `PRH_WIDGET_FACTORY_V1@1.0.0`.

Binding: `PRH_WIDGET_BINDING_V1`.

Validation result: `PRH_WIDGET_BINDING_VALIDATION_V1`.

Явный bound descriptor для DASH-080 placeholder: `PRH_DASHBOARD_BOUND_WIDGET_V1`.

Value presentation для `KPI/CARD`: `PRH_VALUE_WIDGET_PRESENTATION_V1`.

Table presentation: `PRH_TABLE_PRESENTATION_V1`.

`CHART` использует существующий `PRH_CHART_SPEC_V1`. `PIVOT` использует существующий `PRH_PIVOT_SPEC_V1`.

## Canonical binding

Каждый `PRH_WIDGET_BINDING_V1` содержит:

- `widget_id`;
- `kind`;
- canonical normalized `PRH_ANALYTICS_QUERY_V1`;
- presentation spec выбранного kind.

Factory пересчитывает canonical `query_hash` через Analytics engine и `binding_hash` через `SHA256_CANONICAL_JSON_V1`. Derived hashes не принимаются как authority из входного payload.

Эквивалентный объект с другим порядком JSON keys даёт тот же binding identity. Порядок массивов, если он семантически значим для upstream contract, не переопределяется dashboard layer.

`query_modified=false` является обязательной границей: factory валидирует сочетание, но не переписывает query ради удобства renderer.

## KPI и CARD

`KPI` и `CARD` требуют ровно один measure, без dimensions и без time grain. Фильтры, time range и supported comparison остаются частью canonical AnalyticsQuery и не интерпретируются widget factory самостоятельно.

Presentation определяет только title и presentation-флаг comparison. Формула показателя отсутствует: measure ID уже принадлежит canonical analytics semantic layer.

## CHART

`CHART` принимает `PRH_CHART_SPEC_V1` и проверяется через `PRH_VISUALIZATION_REGISTRY_V2@2.0.0`.

Проверка включает существующие VIZ-070 invariants:

- exact dimension coverage;
- measure binding должен присутствовать в query;
- renderer не получает query authority;
- chart retype/renderer semantics не меняют FIN-TRUTH.

Если chart и query несовместимы, factory не строит fallback автоматически и возвращает стабильный reason code, например `VIZ070_QUERY_DIMENSION_COVERAGE_MISMATCH`.

## TABLE

`TABLE` использует `PRH_TABLE_PRESENTATION_V1` со списком columns `{kind,id}`.

Набор columns должен точно покрывать выбранные query dimensions и measures. При time grain derived `time_bucket` также должен присутствовать как dimension column. Это предотвращает скрытый fetch полей, которые не отображаются widget.

TABLE не содержит renderer-specific financial formulas и не является альтернативой AnalyticsResult semantics.

## PIVOT

`PIVOT` принимает canonical `PRH_PIVOT_SPEC_V1` из ANL-073 и нормализуется через `pivot_olap.normalizePivotSpec()`.

Factory дополнительно проверяет:

- exact axis dimension coverage относительно bound query;
- exact selected measure coverage;
- совпадение Pivot time level с AnalyticsQuery grain;
- отсутствие comparison mode, который ANL-073 source-result contract не поддерживает.

PIVOT binding не вызывает `evaluatePivot()` и не принимает `PRH_ANALYTICS_RESULT_V1`. Финансовое вычисление остаётся upstream responsibility.

## Явный переход DASH-080 UNBOUND -> DASH-081 BOUND

DASH-080 намеренно сохраняет placeholder schema `PRH_DASHBOARD_PLACEHOLDER_WIDGET_V1` с `semantic_binding_status=UNBOUND` и запрещает `AnalyticsQuery`/`ChartSpec` внутри layout spec.

DASH-081 **не меняет этот контракт**. `bindPlaceholder()` принимает canonical UNBOUND placeholder и отдельный binding с тем же `widget_id`, после чего создаёт `PRH_DASHBOARD_BOUND_WIDGET_V1`.

Bound descriptor:

- имеет `semantic_binding_status=BOUND`;
- не содержит geometry;
- имеет `geometry_mutation=false`;
- имеет `layout_identity_authority=false`.

Таким образом, semantic binding не переписывает DASH-080 grid geometry и не становится источником layout identity. Implicit auto-bind запрещён.

## Fail-closed validation

`normalizeBinding()` завершает обработку ошибкой при broken/unknown/incompatible binding.

`validateBinding()` предоставляет UI-safe validation envelope:

- `VALID / OK` с hashes;
- `INVALID / <STABLE_REASON_CODE>` без financial/query payload.

Silent downgrade, automatic query rewrite или fallback на другой widget kind запрещены.

## Privacy

Binding configuration может в private runtime содержать query filters/identifiers, необходимые canonical AnalyticsQuery. Поэтому binding object не является public telemetry payload.

Public repository tests используют только synthetic identifiers. Telemetry содержит только:

- `schema`;
- `version`;
- `widget_kind`;
- `query_hash_prefix`;
- `binding_hash_prefix`;
- `decision`;
- `reason`.

Filter values, dimension values, currency, transaction rows, financial values и private identifiers в telemetry запрещены.

Отдельный payload guard запрещает financial result/data keys, включая transaction/result datasets и canonical measure output values. `budget_minor` остаётся допустим только внутри canonical AnalyticsQuery parameters, где его валидирует Analytics engine.

## Тестирование

`tests/widget_factory_semantic_bindings_contract_test.js` проверяет:

- versioned contract и отсутствие authority;
- все пять widget kinds;
- canonical AnalyticsQuery hash;
- deterministic binding identity при другом порядке JSON keys;
- VIZ-070 chart compatibility;
- PIVOT/query semantic parity;
- KPI/CARD single-measure boundary;
- TABLE exact field coverage;
- explicit UNBOUND -> BOUND без geometry mutation;
- stable broken-binding reason codes;
- hostile financial result payload rejection;
- privacy-safe telemetry;
- `SYNTHETIC_ONLY` и `FREE_ONLY` boundaries.

Required named gate: `Widget factory semantic bindings`.

Existing DASH-080, PRIV-080, STUDIO-080, VIZ-070, ANL-073, FIN/MIG/privacy/FREE_ONLY/full layered/UI/PWA gates обязаны оставаться green.

## Rollback

Rollback DASH-081 удаляет widget factory contract/core/tests/docs и binding affordances. DASH-080 responsive composer остаётся canonical с UNBOUND placeholders; STUDIO-080, PRIV-080, VIZ-070, ANL-073 и Financial Home не изменяются.
