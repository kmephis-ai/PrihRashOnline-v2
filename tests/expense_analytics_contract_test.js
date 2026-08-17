'use strict';

const assert = require('assert');
const CONTRACT = require('../lib/expense/expense_analytics.v1.json');
const expense = require('../lib/expense/expense_analytics');
const { evaluateKpis } = require('../lib/finance/kpi_dictionary');
const viz = require('../lib/visualization/visualization_foundation');

function expectCode(fn, prefix) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  assert(thrown, `Expected ${prefix}`);
  assert(String(thrown.code || thrown.message).startsWith(prefix), `Expected ${prefix}, got ${thrown.code || thrown.message}`);
}

function tx(id, date, type, amount, category, extra = {}) {
  return {
    transaction_id: id,
    occurred_at: `${date}T12:00:00Z`,
    type,
    status: 'posted',
    amount_minor: amount,
    currency: extra.currency || 'RUB',
    account_id: extra.account_id || 'SYN-ACCOUNT',
    destination_account_id: type === 'transfer' ? (extra.destination_account_id || 'SYN-SAVINGS') : null,
    category_id: category || 'SYN-OTHER',
    member_id: extra.member_id || 'SYN-MEMBER',
    project_id: null,
    tags: ['SYNTHETIC'],
    counterparty: 'SYN-COUNTERPARTY',
    description: 'Synthetic expense analytics fixture',
    reverses_transaction_id: extra.reverses_transaction_id || null,
    adjustment_semantics: extra.adjustment_semantics || null
  };
}

const INPUTS = [
  tx('SYN-2025-FOOD', '2025-01-10', 'expense', 30000, 'SYN-FOOD'),
  tx('SYN-2025-HOME', '2025-01-15', 'expense', 20000, 'SYN-HOME'),
  tx('SYN-2025-REFUND', '2025-02-05', 'refund', 5000, 'SYN-FOOD', { adjustment_semantics: 'expense_reduction' }),
  tx('SYN-2025-TRANSFER', '2025-02-11', 'transfer', 10000, 'SYN-TRANSFER'),
  tx('SYN-2026-FOOD', '2026-01-10', 'expense', 40000, 'SYN-FOOD'),
  tx('SYN-2026-HOME', '2026-01-20', 'expense', 25000, 'SYN-HOME'),
  tx('SYN-2026-TRAVEL', '2026-02-05', 'expense', 15000, 'SYN-TRAVEL'),
  tx('SYN-2026-REFUND', '2026-02-10', 'refund', 10000, 'SYN-FOOD', { adjustment_semantics: 'expense_reduction' }),
  tx('SYN-2026-INCOME', '2026-02-20', 'income', 100000, 'SYN-INCOME')
];

const OPTIONS = {
  currency: 'RUB',
  period: { start: '2026-01-01', end: '2026-03-01', partial: false },
  comparison_period: { start: '2025-01-01', end: '2025-03-01', partial: false },
  trend_grain: 'MONTH',
  base_filter_context: {
    schema: viz.FILTER_CONTEXT_SCHEMA,
    contract_version: viz.VERSION,
    filters: [{ kind: 'DIMENSION', field: 'account_id', operator: 'INCLUDE', values: ['SYN-ACCOUNT'] }]
  }
};

assert.strictEqual(CONTRACT.schema, 'PRH_EXPENSE_ANALYTICS_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'EXP-020');
assert.strictEqual(CONTRACT.measure, 'EXPENSE');
assert.strictEqual(CONTRACT.category_mix.refund_semantics_source, 'FIN-010');
assert.strictEqual(CONTRACT.category_mix.partition_must_equal_total, true);
assert.strictEqual(CONTRACT.period.comparison, 'EXPLICIT_EQUAL_DAY_WINDOWS_ONLY');
assert.strictEqual(CONTRACT.period.implicit_proration, false);
assert.strictEqual(CONTRACT.drivers.financial_formula_authority, false);
assert.strictEqual(CONTRACT.drill.target, 'TRANSACTION_EXPLORER');
assert.strictEqual(CONTRACT.drill.navigation_financial_payload, false);
assert.strictEqual(CONTRACT.cost.mode, 'FREE_ONLY');
assert.strictEqual(CONTRACT.cost.external_provider_required, false);
assert(Object.values(CONTRACT.authority).every((value) => value === false), 'EXP-020 must not gain financial/query/storage/write authority');

const view = expense.buildExpenseAnalytics(INPUTS, OPTIONS);
assert.strictEqual(view.schema, expense.VIEW_SCHEMA);
assert.strictEqual(view.contract_version, expense.VERSION);
assert.strictEqual(view.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(view.currency, 'RUB');

const primaryFin = evaluateKpis(INPUTS, { currency: 'RUB', period: OPTIONS.period });
const comparisonFin = evaluateKpis(INPUTS, { currency: 'RUB', period: OPTIONS.comparison_period });
assert.strictEqual(view.total_expense_minor, primaryFin.expense_minor, 'Primary expense total must come from FIN-010');
assert.strictEqual(view.comparison_expense_minor, comparisonFin.expense_minor, 'Comparison total must come from FIN-010');
assert.strictEqual(view.total_expense_minor, 70000);
assert.strictEqual(view.comparison_expense_minor, 45000);
assert.strictEqual(view.delta_minor, 25000);

assert.deepStrictEqual(view.trend.points.map((item) => [item.time_bucket, item.expense_minor]), [
  ['2026-01', 65000],
  ['2026-02', 5000]
]);
assert.strictEqual(view.trend.sum_minor, view.total_expense_minor, 'Trend buckets must conserve primary FIN total');
for (const point of view.trend.points) {
  const fin = evaluateKpis(INPUTS, { currency: 'RUB', period: { start: point.start, end: point.end, partial: false } });
  assert.strictEqual(point.expense_minor, fin.expense_minor, `Trend bucket ${point.time_bucket} must equal FIN-010`);
}

assert.deepStrictEqual(view.category_mix.rows.map((item) => [item.category_id, item.expense_minor]), [
  ['SYN-FOOD', 30000],
  ['SYN-HOME', 25000],
  ['SYN-TRAVEL', 15000]
]);
assert.strictEqual(view.category_mix.total_minor, view.total_expense_minor);
assert.strictEqual(view.category_mix.residual_minor, 0);
assert.strictEqual(view.category_mix.zero_category_count, 0);

assert.deepStrictEqual(view.drivers.rows.map((item) => [item.category_id, item.delta_minor]), [
  ['SYN-TRAVEL', 15000],
  ['SYN-FOOD', 5000],
  ['SYN-HOME', 5000]
]);
assert.strictEqual(view.drivers.delta_minor, view.delta_minor);
assert.strictEqual(view.drivers.rows.reduce((sum, item) => sum + item.delta_minor, 0), view.delta_minor);

assert.deepStrictEqual(view.widgets.map((item) => [item.id, item.chart_spec.type]), [
  ['expense-trend', 'LINE'],
  ['expense-category-mix', 'DONUT'],
  ['expense-drivers', 'BAR']
]);
const specText = JSON.stringify(view.widgets);
for (const forbidden of ['amount_minor', 'expense_minor', 'total_expense_minor', 'rows', 'transactions']) {
  assert(!specText.includes(forbidden), `WidgetSpec must remain configuration-only: ${forbidden}`);
}

const trendOption = viz.compileEChartsOption(view.widgets[0].chart_spec, view.render_datasets.trend);
const mixOption = viz.compileEChartsOption(view.widgets[1].chart_spec, view.render_datasets.category_mix);
const driversOption = viz.compileEChartsOption(view.widgets[2].chart_spec, view.render_datasets.drivers);
assert(trendOption.option.series.every((series) => series.type === 'line'), 'Expense trend must compile as LINE');
assert.strictEqual(mixOption.option.series[0].type, 'pie', 'Expense mix must compile as DONUT/pie');
assert(driversOption.option.series.every((series) => series.type === 'bar'), 'Expense drivers must compile as BAR');
assert.strictEqual(trendOption.option.xAxis.data.length, 2);
assert.strictEqual(mixOption.option.series[0].data.length, 3);
assert.strictEqual(driversOption.option.series[0].data.length, 3);

const drill = expense.buildExpenseDrill(view, { widget_id: 'expense-category-mix', category_id: 'SYN-FOOD' });
assert.strictEqual(drill.schema, expense.DRILL_SCHEMA);
assert.strictEqual(drill.drill_context.schema, viz.DRILL_CONTEXT_SCHEMA);
assert.strictEqual(drill.drill_context.target, 'TRANSACTION_EXPLORER');
assert.strictEqual(drill.period.start, '2026-01-01');
assert.strictEqual(drill.period.end, '2026-03-01');
assert.deepStrictEqual(drill.explorer_query.account_ids, ['SYN-ACCOUNT']);
assert.deepStrictEqual(drill.explorer_query.category_ids, ['SYN-FOOD']);
assert.strictEqual(drill.explorer_query.date_from, '2026-01-01');
assert.strictEqual(drill.explorer_query.date_to, '2026-03-01');
const drillText = JSON.stringify(drill);
for (const forbidden of ['amount_minor', 'expense_minor', 'total_expense_minor', 'delta_minor', 'value_minor']) {
  assert(!drillText.includes(forbidden), `Navigation state must not embed financial payload: ${forbidden}`);
}

assert(/^[0-9a-f]{64}$/.test(view.telemetry.query_hash), 'Telemetry query hash must be SHA-256');
assert(/^[0-9a-f]{64}$/.test(view.telemetry.context_hash), 'Telemetry context hash must be SHA-256');
assert.deepStrictEqual(Object.keys(view.telemetry).sort(), [
  'bucket_count', 'category_count', 'context_hash', 'driver_count', 'query_hash', 'reason_code', 'schema', 'status', 'version'
].sort());
const telemetryText = JSON.stringify(view.telemetry);
for (const privateOrFinancial of ['SYN-FOOD', 'SYN-ACCOUNT', '70000', '45000', '25000']) {
  assert(!telemetryText.includes(privateOrFinancial), `Telemetry must not contain payload/dimension value: ${privateOrFinancial}`);
}

expectCode(() => expense.buildExpenseAnalytics(INPUTS, {
  ...OPTIONS,
  comparison_period: { start: '2025-01-01', end: '2025-02-28', partial: false }
}), 'KPI_PERIODS_NOT_COMPARABLE');
expectCode(() => expense.buildExpenseAnalytics(INPUTS, {
  ...OPTIONS,
  period: { start: '2026-01-15', end: '2026-03-15', partial: false },
  comparison_period: { start: '2025-01-15', end: '2025-03-15', partial: false }
}), 'EXP_TREND_MONTH_ALIGNMENT_REQUIRED');
expectCode(() => expense.buildExpenseAnalytics([...INPUTS, tx('SYN-USD', '2026-01-07', 'expense', 1000, 'SYN-FOOD', { currency: 'USD' })], OPTIONS), 'KPI_MIXED_CURRENCY_UNSUPPORTED');
expectCode(() => expense.buildExpenseAnalytics([
  tx('SYN-NEG-EXP', '2026-01-10', 'expense', 1000, 'SYN-NEG'),
  tx('SYN-NEG-REFUND', '2026-01-12', 'refund', 2000, 'SYN-NEG', { adjustment_semantics: 'expense_reduction' }),
  tx('SYN-COMP', '2025-01-10', 'expense', 1000, 'SYN-NEG')
], OPTIONS), 'EXP_CATEGORY_NEGATIVE_UNSUPPORTED');
expectCode(() => expense.buildExpenseDrill(view, { widget_id: 'missing-widget', category_id: 'SYN-FOOD' }), 'EXP_DRILL_WIDGET_UNKNOWN');

console.log('expense_analytics_contract_test: OK', {
  contract: `${CONTRACT.schema}@${CONTRACT.version}`,
  finParity: true,
  trendBuckets: view.trend.points.length,
  categoryCount: view.category_mix.rows.length,
  driverCount: view.drivers.rows.length,
  comparisonConservation: true,
  drillTarget: drill.drill_context.target,
  configurationOnlySpecs: true,
  publicTelemetryPayload: false,
  freeOnly: true,
  financialWriteAuthority: false
});
