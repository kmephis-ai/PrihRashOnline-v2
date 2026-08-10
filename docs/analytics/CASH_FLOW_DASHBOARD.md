# CF-020 — Cash Flow dashboard

## Назначение

`CF-020` вводит `PRH_CASH_FLOW_DASHBOARD_V1@1.0.0` как read-only dashboard денежных потоков поверх `FIN-TRUTH-v1`, `PRH_KPI_DICTIONARY_V1@1.0.0`, `PRH_FINANCIAL_HOME_V1@1.0.0`, `PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` и `PRH_TRANSACTION_EXPLORER_V1@1.0.0`.

Cash Flow dashboard не владеет financial truth, canonical schema, storage, network, balance/liquidity semantics или write authority.

## Financial truth

Для каждого периода:

```text
inflow = FIN-010 INCOME
outflow = FIN-010 EXPENSE
net = FIN-010 CASH_FLOW
net = inflow - outflow
```

Все три значения берутся из одного FIN-010 `evaluateKpis()` для данного окна. UI не вычисляет альтернативные income/expense/refund/transfer правила.

## Transfer-neutral semantics

Transfer не является внешним доходом или расходом household cash flow и не входит в inflow/outflow/net.

Machine contract и tests проверяют, что добавление произвольно крупной transfer-only операции не меняет:

- period inflow;
- period outflow;
- period net;
- любой trend bucket.

Refund уменьшает `EXPENSE` согласно FIN-010 и поэтому влияет на outflow/net только через FIN-TRUTH.

## Time dynamics

Поддерживаются `DAY`, `MONTH`, `YEAR` buckets с границами `START_INCLUSIVE_END_EXCLUSIVE`.

Каждый bucket повторно оценивается FIN-010 и обязан удовлетворять:

```text
bucket.inflow - bucket.outflow = bucket.net
```

Суммы всех bucket inflow/outflow/net обязаны точно совпасть с period FIN totals.

`MONTH` требует первого дня месяца на обеих границах. `YEAR` требует 1 января. Misaligned или unsupported grain fail-closed.

## Сравнимые периоды

Используется FIN-010 `assertComparablePeriods()`.

Допускаются только explicit windows одинаковой длины в днях. `implicit_proration = false`.

```text
inflow_delta = current.inflow - comparison.inflow
outflow_delta = current.outflow - comparison.outflow
net_delta = current.net - comparison.net
inflow_delta - outflow_delta = net_delta
```

## Cash Flow не равен balance/liquidity

`liquidity_state = NOT_A_BALANCE_METRIC`, `account_balance_authority = false`.

Cash Flow показывает изменение денежных потоков за период. Он **не** является:

- текущим остатком на счёте;
- balance observation;
- liquidity/runway truth;
- Net Worth.

Balance/liquidity требуют отдельной versioned source/contract (`BAL-030` и последующие зависимости). Cash Flow нельзя использовать как proxy остатка.

## Visualization

CF-020 использует четыре configuration-only WidgetSpecs:

- `cash-flow-net-trend` → `LINE`, measure `CASH_FLOW`;
- `cash-flow-inflow-trend` → `BAR`, measure `INCOME`;
- `cash-flow-outflow-trend` → `BAR`, measure `EXPENSE`;
- `cash-flow-compare` → `BAR`, measure `CASH_FLOW`.

Это согласуется с VIZ-020: один ChartSpec не маскирует несколько независимых measures на одной Y-authority. Financial render rows передаются отдельно через `PRH_VISUALIZATION_RENDER_DATASET_V1` и для real runtime остаются private transient data.

## Drill-down

`PRH_CASH_FLOW_DRILL_ENVELOPE_V1` использует `PRH_DRILL_CONTEXT_V1`, target `TRANSACTION_EXPLORER`.

Component filters:

- `INFLOW` → `income`;
- `OUTFLOW` → `expense`, `refund`;
- `NET` → `income`, `expense`, `refund`.

`transfer` намеренно отсутствует. `adjustment` в canonical v1 имеет zero amount и также не нужен для explaining financial rows.

Navigation сохраняет explicit period и supported account/category/member filters, но не содержит amount/inflow/outflow/net/balance values. Drill не предоставляет write authority; TX save остаётся `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Privacy / telemetry

Public tests/screenshots используют только independently generated synthetic data.

Public telemetry allowlist:

- schema;
- version;
- query hash;
- context hash;
- bucket count;
- status;
- reason code;
- bounded timing metadata, если caller добавляет его отдельно.

Real/real-derived cash-flow values, transaction IDs, dimension values, trends, screenshots, authenticated runtime responses и private locators не являются public telemetry/evidence.

## Machine evidence

- `lib/cashflow/cash_flow_dashboard.v1.json` — machine contract;
- `lib/cashflow/cash_flow_dashboard.js` — pure/read-only core;
- `tests/cash_flow_dashboard_contract_test.js` — FIN parity, transfer-neutral, comparison/VIZ/TX/privacy contract;
- `CashFlowWebApp.html` — synthetic responsive browser surface;
- `tests/cash_flow_visual_test.js` — desktop/laptop/mobile + component drill interaction;
- named gates: `Cash Flow`, `Cash Flow visual gate`.

## Safety / rollback

CF-020 не изменяет `01 Операции`, Google Sheets schema, FIN-TRUTH, canonical schema, Home, VIZ или TX write policy.

Rollback — revert CF contract/core/UI/tests/docs/gates. FIN/canonical/HOME/VIZ/TX/EXP/INC, storage и historical MIG-010 evidence остаются неизменными.

Historical `IRREVERSIBLE_ACTION_AUTHORIZED` не переиспользуется. Future financial mutation требует отдельного policy и fresh exact-bound owner authorization.
