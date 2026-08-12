'use strict';

const assert = require('assert');
const home = require('../lib/home/financial_home');
const { evaluateKpis } = require('../lib/finance/kpi_dictionary');
const viz = require('../lib/visualization/visualization_foundation');
const projection = require('../lib/visualization/household_visual_projection');

function tx(id, date, type, amount, category = 'SYN-BASE') {
  return {
    transaction_id: id,
    occurred_at: `${date}T12:00:00Z`,
    type,
    status: 'posted',
    amount_minor: amount,
    currency: 'RUB',
    account_id: 'SYN-ACCOUNT',
    category_id: category
  };
}

function expectCode(fn, prefix) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  assert(thrown, `Expected ${prefix}`);
  assert(String(thrown.code || thrown.message).startsWith(prefix), `Expected ${prefix}, got ${thrown.code || thrown.message}`);
}

const period = { start: '2026-01-01', end: '2026-02-01', partial: false };
const baseFilter = {
  schema: viz.FILTER_CONTEXT_SCHEMA,
  contract_version: viz.VERSION,
  filters: [
    { kind: 'DIMENSION', field: 'account_id', operator: 'INCLUDE', values: ['SYN-ACCOUNT'] }
  ]
};

const positive = [
  tx('SYN-HOME-001', '2026-01-03', 'income', 100000, 'SYN-INCOME'),
  tx('SYN-HOME-002', '2026-01-10', 'expense', 70000, 'SYN-FOOD')
];
const negative = [
  tx('SYN-HOME-101', '2026-01-03', 'income', 50000, 'SYN-INCOME'),
  tx('SYN-HOME-102', '2026-01-10', 'expense', 70000, 'SYN-FOOD')
];

assert.strictEqual(home.CONTRACT.schema, 'PRH_FINANCIAL_HOME_V1');
assert.strictEqual(home.CONTRACT.version, '1.0.0');
assert.strictEqual(home.CONTRACT.roadmap_id, 'HOME-020');
assert.strictEqual(home.CONTRACT.view_model.financial_values_source, 'SINGLE_FIN010_EVALUATION');
assert.strictEqual(home.CONTRACT.budget.implicit_plan_allowed, false);
assert.strictEqual(home.CONTRACT.liquidity.cash_flow_proxy_allowed, false);
assert.strictEqual(home.CONTRACT.liquidity.current_source, null);
assert.strictEqual(home.CONTRACT.liquidity.future_dependency, 'BAL-030');
assert.strictEqual(home.CONTRACT.privacy.public_finance_evidence, 'SYNTHETIC_ONLY');
assert.strictEqual(home.CONTRACT.cost.class, 'FREE_ONLY');
assert.strictEqual(home.CONTRACT.cost.paid_dependency_required, false);
assert.strictEqual(home.CONTRACT.cost.external_cdn_required, false);
assert(Object.values(home.CONTRACT.authorities).every((value) => value === false));

const fin = evaluateKpis(positive, { currency: 'RUB', period, budget_minor: 90000 });
const view = home.buildFinancialHome(positive, {
  currency: 'RUB', period, budget_minor: 90000, base_filter_context: baseFilter
});

assert.strictEqual(view.schema, 'PRH_FINANCIAL_HOME_VIEW_V1');
assert.strictEqual(view.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(view.kpi_dictionary_version, '1.0.0');
assert.strictEqual(view.cards.INCOME.value_minor, fin.income_minor);
assert.strictEqual(view.cards.EXPENSE.value_minor, fin.expense_minor);
assert.strictEqual(view.cards.CASH_FLOW.value_minor, fin.cash_flow_minor);
assert.strictEqual(view.cards.SAVINGS.value_minor, fin.savings_minor);
assert.strictEqual(view.cards.BUDGET.expense_minor, fin.expense_minor);
assert.strictEqual(view.cards.BUDGET.variance_minor, fin.budget_variance_minor);
assert.strictEqual(view.cards.BUDGET.budget_minor, 90000);
assert.strictEqual(view.cards.BUDGET.state, 'READY');
assert.strictEqual(view.provenance.financial_values, 'FIN010_EVALUATE_KPIS_RESULT');
assert.strictEqual(view.provenance.kpi_evaluation_count, 1);
assert.strictEqual(view.provenance.ui_financial_formula_used, false);
assert.strictEqual(view.provenance.liquidity_proxy_used, false);

assert.strictEqual(view.cards.LIQUIDITY.state, 'UNAVAILABLE_PENDING_BALANCE_SOURCE');
assert.strictEqual(view.cards.LIQUIDITY.value_minor, null);
assert.strictEqual(view.cards.LIQUIDITY.source, null);
assert.strictEqual(view.cards.LIQUIDITY.cash_flow_proxy_used, false);
assert.strictEqual(view.cards.LIQUIDITY.future_dependency, 'BAL-030');
assert(view.alerts.some((item) => item.code === 'LIQUIDITY_SOURCE_UNAVAILABLE'));
assert(!view.alerts.some((item) => item.code === 'NEGATIVE_CASH_FLOW'));
assert(!view.alerts.some((item) => item.code === 'BUDGET_OVERRUN'));

const noBudget = home.buildFinancialHome(positive, {
  currency: 'RUB', period, base_filter_context: baseFilter
});
assert.strictEqual(noBudget.cards.BUDGET.state, 'NOT_CONFIGURED');
assert.strictEqual(noBudget.cards.BUDGET.budget_minor, null);
assert.strictEqual(noBudget.cards.BUDGET.variance_minor, null);
assert(noBudget.alerts.some((item) => item.code === 'BUDGET_NOT_CONFIGURED'));

const negativeView = home.buildFinancialHome(negative, {
  currency: 'RUB', period, budget_minor: 60000, base_filter_context: baseFilter
});
assert.strictEqual(negativeView.cards.CASH_FLOW.value_minor, -20000);
assert.strictEqual(negativeView.cards.BUDGET.variance_minor, -10000);
const negativeAlert = negativeView.alerts.find((item) => item.code === 'NEGATIVE_CASH_FLOW');
const budgetAlert = negativeView.alerts.find((item) => item.code === 'BUDGET_OVERRUN');
assert(negativeAlert);
assert(budgetAlert);
assert.strictEqual(negativeAlert.source_kpi, 'CASH_FLOW');
assert.strictEqual(budgetAlert.source_kpi, 'BUDGET_VARIANCE');
assert.strictEqual(negativeView.cards.ALERTS.highest_severity, 'WARNING');

for (const alert of negativeView.alerts) {
  assert.strictEqual(alert.drill.schema, 'PRH_HOME_DRILL_ENVELOPE_V1');
  assert.deepStrictEqual(alert.drill.period, negativeView.period);
  assert.strictEqual(alert.drill.drill_context.schema, viz.DRILL_CONTEXT_SCHEMA);
  assert.strictEqual(alert.drill.drill_context.filter_context.filters.length, 1);
  assert.deepStrictEqual(alert.drill.drill_context.filter_context.filters[0].values, ['SYN-ACCOUNT']);
  assert(/^[0-9a-f]{64}$/.test(alert.drill.drill_context.context_hash));
}

for (const card of Object.values(view.cards)) {
  assert.strictEqual(card.drill.schema, 'PRH_HOME_DRILL_ENVELOPE_V1');
  assert.deepStrictEqual(card.drill.period, view.period);
  assert.strictEqual(card.drill.drill_context.filter_context.filters[0].field, 'account_id');
}

assert.strictEqual(view.widgets.length, 2);
assert.deepStrictEqual(view.widgets.map((item) => item.chart_spec.type), ['LINE', 'DONUT']);
assert.deepStrictEqual(view.widgets.map((item) => item.chart_spec.encoding), [
  {
    x: { kind: 'DIMENSION', id: 'time_bucket' },
    y: { kind: 'MEASURE', id: 'CASH_FLOW' }
  },
  {
    category: { kind: 'DIMENSION', id: 'category_id' },
    value: { kind: 'MEASURE', id: 'EXPENSE' }
  }
]);
const widgetText = JSON.stringify(view.widgets);
for (const forbidden of ['amount_minor', 'income_minor', 'expense_minor', 'cash_flow_minor', 'rows', 'transactions']) {
  assert(!widgetText.includes(forbidden), `Home WidgetSpecs must remain configuration-only: ${forbidden}`);
}

// VIZ-REC-001: keep truthful household projection coverage inside the canonical
// Financial Home contract instead of creating a parallel visual-test authority.
const visualPeriods = [
  ['2026-01-01', '2026-02-01', 12000],
  ['2026-02-01', '2026-03-01', -5000],
  ['2026-03-01', '2026-04-01', 18000],
  ['2026-04-01', '2026-05-01', 9000],
  ['2026-05-01', '2026-06-01', 24000],
  ['2026-06-01', '2026-07-01', 30000]
].map(([start, end, cash_flow_minor]) => ({ period: { start, end }, cash_flow_minor }));
const cashFlowDataset = projection.cashFlowRenderDataset(visualPeriods);
assert.strictEqual(cashFlowDataset.schema, viz.RENDER_DATASET_SCHEMA);
assert.strictEqual(cashFlowDataset.rows.length, 6);
assert.deepStrictEqual(cashFlowDataset.rows.map((row) => row.dimensions.time_bucket), [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'
]);
assert.deepStrictEqual(cashFlowDataset.rows.map((row) => row.measures.CASH_FLOW), [
  12000, -5000, 18000, 9000, 24000, 30000
]);

const expenseInput = [
  ['Дом', 60000], ['Кредиты', 10000], ['Продукты', 8000], ['Коммуналка', 4000],
  ['Подарки', 3000], ['Связь', 2500], ['Бензин', 2000], ['Одежда', 1000]
];
const shapedExpense = projection.topNExpenseMix(expenseInput, 6);
assert.strictEqual(shapedExpense.length, 7);
const otherExpense = shapedExpense.find((entry) => entry.label === 'Прочее');
assert(otherExpense, 'Top-N must expose Прочее when categories exceed the limit');
assert.strictEqual(otherExpense.value_minor, 3000);
assert.strictEqual(otherExpense.source_count, 2);
assert.strictEqual(
  shapedExpense.reduce((sum, entry) => sum + entry.value_minor, 0),
  expenseInput.reduce((sum, entry) => sum + entry[1], 0),
  'Top-N + Прочее must preserve the authoritative expense total exactly'
);

const expenseDataset = projection.expenseMixRenderDataset(expenseInput, 6);
const lineWidget = view.widgets.find((widget) => widget.id === 'home-cash-flow-trend');
const donutWidget = view.widgets.find((widget) => widget.id === 'home-expense-mix');
assert(lineWidget && donutWidget, 'Canonical Home LINE/DONUT widgets must remain present');
const lineOption = projection.compileHouseholdChart(lineWidget.chart_spec, cashFlowDataset);
const donutOption = projection.compileHouseholdChart(donutWidget.chart_spec, expenseDataset);
assert.strictEqual(lineOption.renderer, 'ECHARTS_6');
assert.strictEqual(lineOption.option.aria.enabled, true);
assert.strictEqual(lineOption.option.aria.label.description, 'Денежный поток');
assert(/[А-Яа-яЁё]/.test(lineOption.option.aria.label.description), 'Cash-flow ARIA description must be household-facing Russian');
assert.deepStrictEqual(lineOption.option.xAxis.data, ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
assert.deepStrictEqual(lineOption.option.series[0].data, [12000, -5000, 18000, 9000, 24000, 30000]);
assert.strictEqual(donutOption.renderer, 'ECHARTS_6');
assert.strictEqual(donutOption.option.aria.enabled, true);
assert.strictEqual(donutOption.option.aria.label.description, 'Структура расходов');
assert(/[А-Яа-яЁё]/.test(donutOption.option.aria.label.description), 'Expense ARIA description must be household-facing Russian');
assert.strictEqual(donutOption.option.series[0].data.find((item) => item.name === 'Прочее').value, 3000);

expectCode(() => projection.cashFlowRenderDataset([
  { period: { start: '2026-01-01', end: '2026-02-01' }, cash_flow_minor: 1 },
  { period: { start: '2026-01-15', end: '2026-02-15' }, cash_flow_minor: 2 }
]), 'VIZ_HOUSEHOLD_CASH_FLOW_PERIOD_DUPLICATE');
expectCode(() => projection.topNExpenseMix([['Дом', -1]], 6), 'VIZ_HOUSEHOLD_EXPENSE_ENTRY_INVALID');
expectCode(() => projection.topNExpenseMix([['Дом', 10], ['Дом', 20]], 6), 'VIZ_HOUSEHOLD_EXPENSE_LABEL_DUPLICATE');

const same = home.buildFinancialHome(negative, {
  currency: 'RUB', period, budget_minor: 60000, base_filter_context: baseFilter
});
assert.strictEqual(
  same.alerts.find((item) => item.code === 'NEGATIVE_CASH_FLOW').drill.drill_context.context_hash,
  negativeAlert.drill.drill_context.context_hash,
  'Alert drill identity must be deterministic'
);

expectCode(() => home.buildFinancialHome(positive, { currency: 'RUB', period, budget_minor: -1 }), 'budget_minor must be non-negative');

console.log('financial_home_contract_test: OK', {
  contract: `${home.CONTRACT.schema}@${home.CONTRACT.version}`,
  finParity: true,
  budgetConfigured: 'READY',
  budgetMissing: 'NOT_CONFIGURED',
  liquidity: 'UNAVAILABLE_PENDING_BALANCE_SOURCE',
  negativeCashFlowAlert: true,
  budgetOverrunAlert: true,
  deterministicDrill: true,
  widgetSpecsConfigurationOnly: true,
  vizRecPeriods: cashFlowDataset.rows.length,
  vizRecTopN: 6,
  vizRecRenderer: lineOption.renderer,
  vizRecRussianAria: true,
  freeOnly: true
});