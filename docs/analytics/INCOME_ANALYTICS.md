# INC-020 — Income Analytics

## Назначение

`INC-020` вводит `PRH_INCOME_ANALYTICS_V1@1.0.0` как read-only слой анализа доходов поверх уже проверенных `FIN-TRUTH-v1`, `PRH_KPI_DICTIONARY_V1@1.0.0`, `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` и `PRH_TRANSACTION_EXPLORER_V1@1.0.0`.

Income Analytics не владеет financial truth, canonical schema, query semantics, storage, network или write authority. Он собирает объяснимый view над FIN-backed результатами и не создаёт альтернативные формулы дохода.

## Financial truth и time trend

Primary и comparison totals всегда вычисляются FIN-010 `evaluateKpis()` и обязаны совпадать с KPI `INCOME`.

```text
canonical transactions
        ↓
FIN-010 / evaluateKpis()
        ↓
INCOME total
        ↓
INC-020 derived view
```

Trend поддерживает `DAY`, `MONTH`, `YEAR`. Каждый bucket является отдельным FIN-010 evaluation, поэтому:

- bucket semantics принадлежат FIN-010;
- сумма bucket `INCOME` обязана точно равняться period `INCOME`;
- `MONTH` требует границы по первому дню месяца;
- `YEAR` требует границы по 1 января;
- unsupported/misaligned grain fail-closed.

## Источник дохода

На текущем canonical уровне понятие источника задаётся как **canonical income `category_id`** (`CANONICAL_INCOME_CATEGORY_AS_SOURCE`). Это намеренно обеспечивает детерминированный exact drill через TX-020 `category_ids`, а не fuzzy-поиск по описанию/counterparty.

Для каждой source category INC-020 группирует canonical rows и передаёт их в FIN-TRUTH `aggregateTransactions()`. Поэтому expense/transfer/refund/non-income rows не становятся доходом по решению UI.

Инварианты source mix:

- ordering: `INCOME_DESC_THEN_SOURCE_ASC`;
- сумма source totals = period `INCOME`;
- residual = 0;
- zero-income groups могут быть исключены из visual rows, но учитываются техническим count;
- отрицательная source bucket считается неоднозначной для DONUT и fail-closed.

## Сравнимые периоды

Используется FIN-010 `assertComparablePeriods()`.

Допускаются только два явно заданных окна с одинаковым числом дней и границами `START_INCLUSIVE_END_EXCLUSIVE`. `implicit_proration = false`: Income Analytics не угадывает «сопоставимый» неполный период и не нормализует суммы скрытой формулой.

## Stability / variance

Stability — **статистика над уже FIN-backed trend bucket totals**, а не финансовая формула.

Для bucket values `x1..xn`:

```text
mean = Σx / n
population_variance = Σ(x - mean)^2 / n
stddev = sqrt(population_variance)
coefficient_of_variation = stddev / abs(mean)
stability_score = round(100 - min(100, coefficient_of_variation * 100))
```

Если `mean = 0`, состояние = `NO_INCOME`, а `coefficient_of_variation` и `stability_score` = `null`.

Variance/stddev/CV/score являются derived explanatory metrics и никогда не могут изменить `INCOME`, canonical rows или FIN-TRUTH.

## Изменение по источникам

Для каждой source category:

```text
source_delta = current source INCOME - comparison source INCOME
```

Сумма source deltas обязана точно совпасть с:

```text
current period INCOME - comparison period INCOME
```

Это conservation check над FIN-backed source totals, а не новая денежная authority.

## Visualization contract

Income Analytics создаёт только configuration-only `PRH_WIDGET_SPEC_V1`:

- `income-trend` → `LINE`;
- `income-source-mix` → `DONUT`;
- `income-source-compare` → `BAR`.

WidgetSpec/ChartSpec не содержит rows, transaction IDs, amounts, totals или series payload. `PRH_VISUALIZATION_RENDER_DATASET_V1` передаётся отдельно и для real runtime остаётся private transient data.

Primary browser renderer VIZ-020 остаётся replaceable `ECHARTS_6` adapter. External CDN/provider не требуется; `FREE_ONLY` обязателен.

## Drill-down в Transaction Explorer

Drill использует `PRH_FILTER_CONTEXT_V1` + `PRH_DRILL_CONTEXT_V1`, target `TRANSACTION_EXPLORER`.

INC сохраняет period/account/category/member filters и формирует bounded `PRH_TRANSACTION_EXPLORER_QUERY_V1`. Source click добавляет exact `category_id` filter.

`PRH_INCOME_DRILL_ENVELOPE_V1` содержит только navigation/query configuration и **не содержит денежных значений**, variance или stability input values. Он не даёт mutation authority; TX runtime save остаётся fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Privacy / telemetry

Public tests/screenshots используют только independently generated synthetic data.

Public telemetry allowlist:

- schema;
- version;
- query hash;
- context hash;
- bucket count;
- source count;
- stability state;
- status;
- reason code;
- bounded timing metadata, если caller добавляет его отдельным техническим слоем.

Real/real-derived amounts, totals, source distributions, canonical transaction IDs, private source/category values, screenshots и runtime locators не являются public telemetry/evidence.

## Machine evidence

- `lib/income/income_analytics.v1.json` — machine contract;
- `lib/income/income_analytics.js` — pure/read-only core;
- `tests/income_analytics_contract_test.js` — FIN parity, source partition, comparison, variance/stability, VIZ/TX drill/privacy contract;
- `IncomeAnalyticsWebApp.html` — synthetic responsive browser surface;
- `tests/income_analytics_visual_test.js` — desktop/laptop/mobile layout + source drill interaction;
- named PR gates: `Income Analytics`, `Income Analytics visual gate`.

## Safety / rollback

INC-020 не изменяет `01 Операции`, Google Sheets schema, FIN-TRUTH, canonical transaction schema, KPI Dictionary, AnalyticsQuery/Result, VIZ-020 или TX-020 write policy.

Rollback — revert INC contract/core/UI/tests/docs/gates. FIN/canonical/ANL/VIZ/TX/EXP, storage и historical MIG-010 evidence остаются неизменными.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` из MIG-010 не переиспользуется. Любая future financial mutation требует отдельного versioned policy и fresh exact-bound owner authorization.
