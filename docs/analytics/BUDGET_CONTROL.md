# BUD-020 — Budget Control

## Назначение

`BUD-020` вводит `PRH_BUDGET_CONTROL_V1@1.0.0` для контроля общего household expense budget без переноса financial truth в UI.

Upstream authority:

- `FIN-TRUTH-v1` / `PRH_KPI_DICTIONARY_V1@1.0.0` — факт расходов и `BUDGET_VARIANCE`;
- `PRH_EXPENSE_ANALYTICS_V1@1.0.0` — verified expense analysis boundary;
- `PRH_VISUALIZATION_FOUNDATION_V1@1.0.0` — configuration-only charts;
- `PRH_TRANSACTION_EXPLORER_V1@1.0.0` — explaining transactions.

BUD-020 не владеет canonical schema, financial truth, storage, network, balance/liquidity или write authority.

## Budget plan v1

Machine plan schema: `PRH_BUDGET_PLAN_V1@1.0.0`.

Initial scope intentionally narrow:

```text
TOTAL_EXPENSE_LINEAR_PERIOD_V1
```

Required plan fields:

- `currency`;
- full explicit period `[start, end)`;
- `as_of_exclusive` внутри full period;
- non-negative integer `budget_minor`.

Category allocation, recurring obligations и persistence в v1 отсутствуют.

## Explicit linear elapsed scope

FIN-010 требует, чтобы `budget_minor` относился к тому же explicit period/currency, что и fact. Поэтому полный периодный budget **не передаётся** в FIN-010 для partial fact window.

BUD-020 явно задаёт versioned linear pacing:

```text
total_days = end - start
elapsed_days = as_of_exclusive - start
elapsed_budget_minor = round_half_up_positive(
  full_budget_minor * elapsed_days / total_days
)
```

Это не implicit proration: scope, formula и rounding являются частью versioned machine contract.

Для exact elapsed window `[start, as_of_exclusive)` вызывается FIN-010:

```text
evaluateKpis(transactions, {
  currency,
  period: elapsed_window,
  budget_minor: elapsed_budget_minor
})
```

Отсюда authoritative:

- `fact_expense_minor = FIN-010 EXPENSE`;
- `elapsed_budget_variance_minor = FIN-010 BUDGET_VARIANCE`.

## Run-rate projection

Projection является planning-only metric:

```text
run_rate_projection_minor = round_half_up_positive(
  actual_expense_minor * total_days / elapsed_days
)
projected_variance_minor = full_budget_minor - run_rate_projection_minor
```

Projection не является FIN-TRUTH, не записывается в canonical data и не меняет actual expense/budget variance.

Если net Expense elapsed window отрицателен из-за credit/refund-dominated state, v1 fail-closed с `BUD_NEGATIVE_FACT_UNSUPPORTED`: такая ситуация требует отдельной будущей budget-scope semantics, а не скрытого знакового преобразования.

## Alert policy v1

Machine policy: `BUDGET_ALERT_V1`.

Порог риска versioned: `9500 basis points = 95%` projected full-period utilization.

1. `OVER_BUDGET`: elapsed FIN `BUDGET_VARIANCE < 0`.
2. `AT_RISK`: elapsed FIN variance ещё `>= 0`, но projected utilization `>= 95%`.
3. `ON_TRACK`: остальные состояния.

Почему `AT_RISK` не определяется как «projected variance < 0 при elapsed variance >= 0»: при строго линейном elapsed scope обе величины основаны на одной пропорции и такое условие практически недостижимо кроме rounding-edge. 95% threshold даёт полезный ранний warning и остаётся явной policy, а не UI magic number.

## Visualization

VIZ-020 specs остаются configuration-only:

- `budget-fact` → `BAR`, measure `EXPENSE`;
- `budget-variance` → `BAR`, measure `BUDGET_VARIANCE`.

Run-rate projection не маскируется под FIN `EXPENSE` measure в ChartSpec. Она показывается отдельным derived planning KPI. Real render data остаётся private transient payload.

## Explaining transactions / drill

`PRH_BUDGET_DRILL_ENVELOPE_V1` ведёт в `TRANSACTION_EXPLORER` на exact elapsed window.

Explaining types:

- `expense`;
- `refund`.

Transfer отсутствует. Navigation сохраняет supported account/category/member filters, но не содержит budget/expense/variance/projection/balance values.

`VALID` drill не означает mutation permission. Generic TX/Google runtime write остаётся `GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED`.

## Balance/liquidity boundary

Budget Control — не account balance и не liquidity authority.

`liquidity_state = NOT_A_BALANCE_METRIC`, `account_balance_authority=false`.

Budget plan/fact показывает spending control. Остатки, liquidity, runway и Net Worth требуют отдельного balance source (`BAL-030` и downstream contracts).

## Privacy / telemetry

Public tests/screenshots используют только independently generated synthetic plan + transactions.

Public telemetry allowlist:

- schema/version;
- query/context hashes;
- total/elapsed day counts;
- alert state;
- status/reason;
- bounded timing metadata.

Money values, real budget, real expense, private dimensions/IDs, screenshots и runtime locators не являются public telemetry/evidence.

## Machine evidence

- `lib/budget/budget_control.v1.json`;
- `lib/budget/budget_control.js`;
- `tests/budget_control_contract_test.js`;
- `BudgetControlWebApp.html`;
- `tests/budget_control_visual_test.js`;
- named gates `Budget Control`, `Budget Control visual gate`.

## Safety / rollback

BUD-020 не изменяет `01 Операции`, Google Sheets schema, FIN-TRUTH, canonical schema, VIZ/TX/EXP/CF или write policy. Plan persistence отсутствует.

Rollback — revert BUD contract/core/UI/tests/docs/gates. Historical MIG-010 authorization остаётся non-reusable; future financial mutation требует fresh exact-bound owner authorization.
