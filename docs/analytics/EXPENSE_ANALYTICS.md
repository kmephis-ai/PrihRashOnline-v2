# EXP-020 — Expense Analytics

## Назначение

`EXP-020` вводит `PRH_EXPENSE_ANALYTICS_V1@1.0.0` как read-only аналитический слой расходов поверх уже проверенных `FIN-TRUTH-v1`, `PRH_KPI_DICTIONARY_V1@1.0.0`, `PRH_ANALYTICS_CONTRACT_V1@1.0.0`, `PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` и `PRH_TRANSACTION_EXPLORER_V1@1.0.0`.

Expense Analytics не владеет финансовыми формулами, canonical schema, storage, network или write authority. Его задача — собрать объяснимое представление расходов без дублирования FIN-010 semantics.

## Financial truth

Главный итог расходов текущего и сравнимого периода всегда получается через FIN-010 `evaluateKpis()` и обязан совпадать с KPI `EXPENSE`.

```text
canonical transactions
        ↓
FIN-010 / evaluateKpis()
        ↓
EXPENSE total
        ↓
EXP-020 presentation/read model
```

UI, renderer и Expense Analytics не пересчитывают gross expense, refund или transfer semantics самостоятельно.

## Периоды и сравнение

Границы периода: `START_INCLUSIVE_END_EXCLUSIVE`.

Сравнение разрешено только для двух явно заданных окон одинаковой длины в днях. Используется FIN-010 `assertComparablePeriods()`. Не допускаются implicit proration, автоматически «похожий» период или догадки для неполных окон.

Trend поддерживает `DAY`, `MONTH`, `YEAR`. Для `MONTH` требуются границы по первому дню месяца; для `YEAR` — по 1 января. Каждый trend bucket повторно проверяется через FIN-010 и сумма bucket totals обязана точно совпасть с итогом EXPENSE периода.

## Структура по категориям

Category mix использует `aggregateTransactions()` из `FIN-TRUTH-v1` и его `by_expense_category_minor`.

- expense увеличивает категорию;
- refund уменьшает категорию согласно FIN-010;
- transfer нейтрален;
- сумма категорий обязана точно равняться period `EXPENSE`;
- ordering: `EXPENSE_DESC_THEN_CATEGORY_ASC`;
- zero buckets исключаются из visual rows, но учитываются техническим count;
- residual должен быть ровно 0.

Если refund приводит отдельную category bucket к отрицательному значению, DONUT/category-mix representation считается неоднозначным и EXP-020 fail-closed с `EXP_CATEGORY_NEGATIVE_UNSUPPORTED`, а не маскирует знак или перераспределяет сумму.

## Драйверы изменения

Для каждой категории:

```text
delta(category) = current category EXPENSE - comparison category EXPENSE
```

Это разность уже FIN-backed category totals, а не новая финансовая формула. Сумма всех category deltas обязана точно совпасть с:

```text
current EXPENSE - comparison EXPENSE
```

Ordering: `ABS_DELTA_DESC_THEN_CATEGORY_ASC`. Zero drivers могут быть исключены из display rows, но учитываются техническим count.

## Visualization contract

Expense Analytics создаёт только configuration-only `PRH_WIDGET_SPEC_V1`:

- `expense-trend` → `LINE`;
- `expense-category-mix` → `DONUT`;
- `expense-drivers` → `BAR`.

WidgetSpec/ChartSpec не содержат rows, transactions, amounts, totals или series payload. Runtime render datasets передаются отдельно через VIZ-020 и остаются private runtime data для реальных данных.

Primary renderer остаётся replaceable `ECHARTS_6` adapter VIZ-020. External CDN/provider не требуется; `FREE_ONLY` обязателен.

## Drill-down к Transaction Explorer

Drill строится через `PRH_FILTER_CONTEXT_V1` + `PRH_DRILL_CONTEXT_V1` с target `TRANSACTION_EXPLORER`.

Expense Analytics сохраняет period/account/category/member filters и преобразует их в bounded `PRH_TRANSACTION_EXPLORER_QUERY_V1`. Navigation envelope содержит только context/query configuration и **не содержит денежных значений**.

`PRH_EXPENSE_DRILL_ENVELOPE_V1` не даёт mutation authority. TX-020 runtime save остаётся fail-closed с `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Privacy / telemetry

Public tests и screenshots используют только independently generated synthetic data.

Public telemetry allowlist:

- schema;
- version;
- query hash;
- context hash;
- bucket count;
- category count;
- driver count;
- status;
- reason code;
- bounded timing metadata, если оно добавляется отдельным caller.

Real/real-derived amounts, totals, category distributions, transaction IDs, private filter values, screenshots и runtime locators не являются public telemetry/evidence.

## Machine evidence

- `lib/expense/expense_analytics.v1.json` — machine contract;
- `lib/expense/expense_analytics.js` — pure/read-only core;
- `tests/expense_analytics_contract_test.js` — FIN parity, trend, category/refund, comparable-period, driver conservation, VIZ/TX drill and privacy contract;
- `ExpenseAnalyticsWebApp.html` — synthetic responsive browser surface;
- `tests/expense_analytics_visual_test.js` — desktop/laptop/mobile layout + drill interaction gate;
- named PR gates: `Expense Analytics`, `Expense Analytics visual gate`.

## Safety / rollback

EXP-020 не изменяет `01 Операции`, Google Sheets schema, FIN-TRUTH, canonical transaction schema, KPI Dictionary, AnalyticsQuery/Result или generic write policy.

Rollback — revert EXP contract/core/UI/tests/docs/gates. Canonical data, FIN/VIZ/TX, Google storage и historical MIG-010 evidence остаются неизменными.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` из MIG-010 не переиспользуется. Любая будущая financial mutation требует нового отдельного versioned policy и fresh owner authorization boundary.
