# ANL-073 — Multi-dimensional Pivot/OLAP engine

## Назначение

`ANL-073` добавляет renderer-neutral Pivot/OLAP слой поверх уже рассчитанного `PRH_ANALYTICS_RESULT_V1`. Он не читает canonical transactions напрямую и не вычисляет KPI заново. Финансовая истина остаётся у `FIN-TRUTH-v1`, KPI Dictionary и `PRH_ANALYTICS_CONTRACT_V1`; Pivot только перестраивает уже подтверждённые additive значения в многомерную матрицу.

Machine authority: `PRH_PIVOT_OLAP_V1@1.0.0`. Pivot v1 поддерживает rows/columns/measures, prefix subtotals, grand total, deterministic sort, bounded Top-N + Other, TIME hierarchy re-query и runtime drill descriptor. Engine остаётся offline, storage-neutral, renderer-neutral и `FREE_ONLY`.

## Источник и семантическая совместимость

Вход — полный non-truncated `AnalyticsResult` с `total_rows == rows.length`, `comparison.mode=NONE`, provenance `FIN-TRUTH-v1`, совпадающими `query_hash` в result и provenance и отсутствием legacy/UI authority. Pivot никогда не восстанавливает пропущенные source rows эвристически.

Rows + columns должны в точности покрывать dimensions входного AnalyticsResult. Всего допускается до трёх semantic dimensions, в соответствии с `PRH_ANALYTICS_SEMANTIC_REGISTRY_V1`. `time_bucket` является отдельной derived dimension и обязан иметь hierarchy `TIME` с level `YEAR`, `MONTH` или `DAY`, совпадающим с source grain.

Measures задаются semantic ID + aggregation. В версии 1 разрешён только `SUM` для measures, у которых semantic registry фиксирует `additive=true`. `BUDGET_VARIANCE` и другие non-additive semantics не суммируются «примерно» и завершаются fail-closed до появления отдельной доказанной aggregation policy.

## Reproducible PivotSpec

`PRH_PIVOT_SPEC_V1` содержит только конфигурацию: rows, columns, measures, subtotal/grand-total flags, deterministic sort и optional Top-N. В spec отсутствуют реальные dimension values и financial values. Canonical JSON сериализация определяет `spec_hash`; перестановка ключей JSON не меняет identity, а изменение порядка axis dimensions является осмысленным изменением PivotSpec.

Sort всегда explicit: axis `ROWS`/`COLUMNS`, `KEY` или selected `MEASURE`, direction `ASC`/`DESC`. При равенстве применяется canonical axis-key ascending tie-break. Technical `__OTHER__` после Top-N всегда остаётся отдельным bounded bucket и не смешивается с обычным member.

## Матрица, sparse cells и totals

Composite member key строится из canonical serialization полного набора значений выбранной оси, поэтому delimiter collision отсутствует. Runtime PivotResult может содержать private dimension values и financial values, но этот result не является public evidence и не сериализуется в telemetry.

Engine строит полный row × column cross-product. Если canonical AnalyticsResult не содержит конкретной комбинации dimensions, для additive measures создаётся explicit sparse cell с zero и `sparse_zero=true`. Это orchestration semantics, а не synthetic transaction mutation.

Grand total рассчитывается независимым суммированием source rows и обязан точно совпасть с суммой итоговой матрицы после Top-N/Other. Любое расхождение завершает `PIVOT_GRAND_TOTAL_RECONCILIATION_FAILED`. Prefix subtotals вычисляются только для многоуровневых axes и используют exact safe-integer accumulation.

## Top-N + Other

Pivot не реализует собственную сортировку Top-N по финансовой формуле. Для axis total строится внутренний typed orchestration `AnalyticsResult`, после чего применяется существующий `TOP_N_OTHER` из `PRH_ANALYTICS_CALCULATED_METRICS_V1`. Затем исходные cells детерминированно сворачиваются в kept members и технический `__OTHER__`.

Evidence сохраняет operator binding `PRH_ANALYTICS_CALCULATED_METRICS_V1@1.0.0:TOP_N_OTHER` и source/output reconciliation. Drill из `__OTHER__` в v1 запрещён fail-closed: простого positive filter недостаточно, чтобы точно воспроизвести множество исключённых members.

## TIME hierarchy: expand/collapse только через re-query

Semantic registry разрешает только `YEAR -> MONTH -> DAY`. Pivot не может синтезировать месяцы из годового total или дни из месячного total. `deriveHierarchyRequery()` принимает исходный canonical AnalyticsQuery и current PivotSpec, проверяет exact semantic transition и возвращает:

- новый PivotSpec с изменённым TIME level;
- полный нормализованный AnalyticsQuery с target grain;
- previous/next query hashes;
- provenance `implicit_detail_synthesis=false`, `query_reexecution_required=true`.

Expand использует `validateHierarchyTransition()` ANL-070. Collapse разрешён только как обратный ход уже зарегистрированного drill-down transition. Попытка выйти выше YEAR или ниже DAY завершается fail-closed.

## Drill из Pivot cell

`PRH_PIVOT_DRILL_DESCRIPTOR_V1` — private runtime descriptor. Для его построения обязателен исходный normalized AnalyticsQuery, hash которого должен совпадать с `source_query_hash` AnalyticsResult. Cell dimension values сужают исходные filters до exact EQ; исходные фильтры других полей сохраняются. TIME member превращается в exact half-open `[start,end)` range. Итоговый query — scalar canonical AnalyticsQuery по выбранному measure.

Параллельно создаётся существующий `PRH_DRILL_CONTEXT_V1` VIZ-020 для UI interaction. В него входят только selected non-time dimension filters; time range остаётся в private Pivot drill descriptor/AnalyticsQuery. `OTHER` и nullable dimension, которую текущий AnalyticsQuery не умеет выразить как exact null-filter, не получают эвристический drill.

## Determinism и randomized parity

Public tests используют независимо сгенерированные synthetic AnalyticsResult. Seeded randomized tests переставляют source rows и требуют identical `result_hash`, exact grand-total/cell reconciliation и одинаковое Top-N поведение. Проверяются sparse cells, negative additive values, ties, hierarchy transition, drill query reproduction и hostile specs.

`result_hash` является private runtime identity PivotResult и не входит в public telemetry. Он может зависеть от private result values и поэтому не должен публиковаться как GitHub evidence.

## Privacy и telemetry

`pivotTelemetry()` содержит только allowlisted metadata: schema/version, safe `spec_hash`, source query hash, counts, Top-N axis presence, hierarchy-active flag, decision/reason и версии upstream contracts. В telemetry отсутствуют currency, row/column member values, cells, financial values, transaction IDs и private dimension values.

Public repository содержит только synthetic fixtures. Runtime PivotResult и drill descriptor остаются внутри private application boundary. Renderer не получает financial truth authority, persistence authority или write authority.

## Safety boundary

`financial_truth=false`, `financial_write=false`, `io=false`, `network=false`, `storage=false`, `renderer=false`, `ui=false`, `query_execution=false`. Pivot не выполняет SQL/MDX/JavaScript/eval и не требует внешнего OLAP backend или paid provider. `FREE_ONLY` обязателен.

## Machine gate и rollback

Named PR gate: `Pivot/OLAP engine`. Он обязан доказать semantic compatibility ANL-070, additive-only aggregation, ANL-072 Top-N reuse, sparse/total/subtotal reconciliation, deterministic source-order parity, hierarchy re-query, drill reproduction и privacy-safe telemetry.

Rollback — удалить ANL-073 contract/core/tests/doc/gates. `ANL-010`, `ANL-070`, `ANL-071`, `ANL-072`, `ANL-074`, BENCH-070, canonical data и текущий R2 Web App при этом не меняются. DONE возможен только после полного PR Validation, immutable exact candidate, Trusted DEV Deploy, Trusted Runtime Health, autonomous squash merge и Main Verification.
