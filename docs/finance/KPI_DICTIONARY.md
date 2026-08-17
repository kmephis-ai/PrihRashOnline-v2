# KPI Dictionary v1

`roadmap_id: FIN-010`  
`schema: PRH_KPI_DICTIONARY_V1`  
`version: 1.0.0`  
`financial_truth_policy: FIN-TRUTH-v1`

## Назначение

KPI Dictionary — единый versioned machine-readable источник финансовой семантики PrihRashOnline. Он формализует уже доказанные правила FIN-001 и не создаёт параллельную бизнес-логику в Dashboard, формулах Google Sheets или chart renderer.

Канонический machine-readable файл: `lib/finance/kpi_dictionary.v1.json`. Deterministic evaluator: `lib/finance/kpi_dictionary.js`.

## Денежная модель

- Финансовая истина хранится и вычисляется только в целых `minor units`.
- Неявное floating-point округление запрещено.
- В KPI Dictionary v1 один evaluation scope содержит одну валюту.
- Mixed-currency evaluation fail-closed до отдельного versioned FX layer (`FX-030`).
- Legacy total cells не являются expected/golden truth.

## Transaction semantics

| Тип | Семантика |
|---|---|
| `income` | увеличивает Income и Cash Flow |
| `expense` | увеличивает Gross Expense и уменьшает Cash Flow |
| `refund` | уменьшает Expense и увеличивает Cash Flow; **не** является Income |
| `transfer` | измеряется отдельно, но нейтрален к Income / Expense / Cash Flow / Savings |
| `adjustment` | в `FIN-TRUTH-v1` разрешён только с нулевой суммой; новая ненулевая семантика требует новой versioned policy |

В расчёт входят только `posted` transactions. Неоднозначный refund/reversal обязан иметь explicit source link или `expense_reduction` semantics и иначе отклоняется fail-closed базовым FIN-TRUTH contract.

## KPI v1

### Income

`income_minor = SUM(posted income.amount_minor)`

### Expense

`expense_minor = gross_expense_minor - refund_minor`

Это canonical external/net expense. Refund не превращается в Income.

### Cash Flow

`cash_flow_minor = income_minor - expense_minor`

Internal transfer не меняет Cash Flow.

### Savings

`savings_minor = income_minor - expense_minor`

В v1 это **realized transaction-period savings**, то есть тот же transaction-only остаток потока, что Cash Flow. Net-worth valuation, assets/liabilities, FX revaluation и forecast сюда не входят и добавляются отдельными Roadmap contracts.

### Budget variance

`budget_variance_minor = budget_minor - expense_minor`

Положительное значение означает благоприятное отклонение «ниже бюджета». `budget_minor` обязан относиться к той же explicit period и currency; без budget input KPI не вычисляется.

## Периоды

Explicit period использует полуинтервал `[start, end)` по `occurred_at`.

- `start` включается;
- `end` не включается;
- partial period задаётся явно;
- hidden/automatic proration отсутствует;
- Budget для partial period должен быть передан уже для того же явного окна;
- comparison windows считаются comparable в v1 только при одинаковом количестве календарных дней.

Более богатые rolling/MTD/QTD/YTD/YoY правила принадлежат будущему analytics period engine и не должны неявно появляться в UI.

## Fail-closed reason codes

Evaluator использует bounded технические причины, включая:

- `KPI_DICTIONARY_SCHEMA_INVALID`;
- `KPI_DICTIONARY_VERSION_INVALID`;
- `KPI_FINANCIAL_POLICY_MISMATCH`;
- `KPI_ID_UNKNOWN`;
- `KPI_VERSION_UNSUPPORTED`;
- `KPI_CURRENCY_INVALID`;
- `KPI_MIXED_CURRENCY_UNSUPPORTED`;
- `KPI_BUDGET_REQUIRED`;
- `KPI_PERIOD_*` / `KPI_PERIODS_NOT_COMPARABLE`;
- `KPI_*_INVARIANT_FAILED`.

Shared evidence не содержит реальные суммы/категории/описания.

## Контракт тестирования

`tests/kpi_dictionary_contract_test.js` проверяет:

- schema/version identity;
- parity с `FIN-TRUTH-v1` / FIN-001 reconciliation;
- transfer neutrality;
- refund-as-expense-reduction;
- exact integer minor units;
- Savings/Cash Flow identity;
- Budget variance sign convention;
- explicit partial-period behavior без proration;
- comparable-window rule;
- mixed-currency fail-closed;
- unknown KPI/version fail-closed;
- deterministic synthetic property-style parity.

Public test data создаётся независимо synthetic generator'ом и не содержит real-derived household finance data.

## Scope boundary

FIN-010 **не** выполняет full-history migration, не меняет canonical transaction rows и не реализует DATA-010. Следующий data/schema layer обязан ссылаться на этот Dictionary вместо дублирования KPI semantics.
