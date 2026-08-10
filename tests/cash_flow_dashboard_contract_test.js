'use strict';

const assert = require('assert');
const CONTRACT = require('../lib/cashflow/cash_flow_dashboard.v1.json');
const cashflow = require('../lib/cashflow/cash_flow_dashboard');
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
    description: 'Synthetic cash flow fixture',
    reverses_transaction_id: extra.reverses_transaction_id || null,
    adjustment_semantics: extra.adjustment_semantics || null
  };
}

const INPUTS = [
  tx('SYN-25-INCOME-A', '2025-01-10', 'income', 40000, 'SYN-SALARY'),
  tx('SYN-25-INCOME-B', '2025-02-10', 'income', 20000, 'SYN-BONUS'),
  tx('SYN-25-EXP-A', '2025-01-15', 'expense', 20000, 'SYN-HOME'),
  tx('SYN-25-EXP-B', '2025-02-15', 'expense', 10000, 'SYN-FOOD'),
  tx('SYN-25-REFUND', '2025-02-20', 'refund', 5000, 'SYN-FOOD', { adjustment_semantics: 'expense_reduction' }),
  tx('SYN-25-TRANSFER', '2025-02-22', 'transfer', 100000, 'SYN-TRANSFER'),
  tx('SYN-26-INCOME-A', '2026-01-10', 'income', 50000, 'SYN-SALARY'),
  tx('SYN-26-INCOME-B', '2026-02-10', 'income', 75000, 'SYN-SALARY'),
  tx('SYN-26-EXP-A', '2026-01-15', 'expense', 20000, 'SYN-HOME'),
  tx('SYN-26-EXP-B', '2026-02-15', 'expense', 30000, 'SYN-FOOD'),
  tx('SYN-26-REFUND', '2026-02-20', 'refund', 10000, 'SYN-FOOD', { adjustment_semantics: 'expense_reduction' }),
  tx('SYN-26-TRANSFER', '2026-02-22', 'transfer', 500000, 'SYN-TRANSFER')
];

const OPTIONS = {
  currency: 'RUB',
  period: { start: '2026-01-01', end: '2026-03-01', partial: false },
  comparison_period: { start: '2025-01-01', end: '2025-03-01', partial: false },
  grain: 'MONTH',
  base_filter_context: {
    schema: viz.FILTER_CONTEXT_SCHEMA,
    contract_version: viz.VERSION,
    filters: [{ kind: 'DIMENSION', field: 'account_id', operator: 'INCLUDE', values: ['SYN-ACCOUNT'] }]
  }
};

assert.strictEqual(CONTRACT.schema, 'PRH_CASH_FLOW_DASHBOARD_V1');
assert.strictEqual(CONTRACT.measures.inflow, 'INCOME');
assert.strictEqual(CONTRACT.measures.outflow, 'EXPENSE');
assert.strictEqual(CONTRACT.measures.net, 'CASH_FLOW');
assert.strictEqual(CONTRACT.invariants.transfer_neutral, true);
assert.strictEqual(CONTRACT.invariants.liquidity_or_balance_authority, false);
assert.strictEqual(CONTRACT.period.comparison, 'EXPLICIT_EQUAL_DAY_WINDOWS_ONLY');
assert.strictEqual(CONTRACT.period.implicit_proration, false);
assert.strictEqual(CONTRACT.drill.transfer_included, false);
assert.strictEqual(CONTRACT.cost.mode, 'FREE_ONLY');
assert(Object.values(CONTRACT.authority).every((value) => value === false));

const view = cashflow.buildCashFlowDashboard(INPUTS, OPTIONS);
const primary = evaluateKpis(INPUTS, { currency: 'RUB', period: OPTIONS.period });
const previous = evaluateKpis(INPUTS, { currency: 'RUB', period: OPTIONS.comparison_period });
assert.strictEqual(view.inflow_minor, primary.income_minor);
assert.strictEqual(view.outflow_minor, primary.expense_minor);
assert.strictEqual(view.net_minor, primary.cash_flow_minor);
assert.strictEqual(view.inflow_minor, 125000);
assert.strictEqual(view.outflow_minor, 40000);
assert.strictEqual(view.net_minor, 85000);
assert.strictEqual(view.inflow_minor - view.outflow_minor, view.net_minor);
assert.strictEqual(view.comparison.inflow_minor, 60000);
assert.strictEqual(view.comparison.outflow_minor, 25000);
assert.strictEqual(view.comparison.net_minor, 35000);
assert.strictEqual(view.comparison.inflow_delta_minor, 65000);
assert.strictEqual(view.comparison.outflow_delta_minor, 15000);
assert.strictEqual(view.comparison.net_delta_minor, 50000);
assert.strictEqual(view.comparison.inflow_delta_minor - view.comparison.outflow_delta_minor, view.comparison.net_delta_minor);
assert.strictEqual(view.liquidity_state, 'NOT_A_BALANCE_METRIC');
assert.strictEqual(view.account_balance_authority, false);

assert.deepStrictEqual(view.trend.points.map((point) => [point.time_bucket, point.inflow_minor, point.outflow_minor, point.net_minor]), [
  ['2026-01', 50000, 20000, 30000],
  ['2026-02', 75000, 20000, 55000]
]);
for (const point of view.trend.points) {
  assert.strictEqual(point.inflow_minor - point.outflow_minor, point.net_minor);
  const fin = evaluateKpis(INPUTS, { currency: 'RUB', period: { start: point.start, end: point.end, partial: false } });
  assert.strictEqual(point.inflow_minor, fin.income_minor);
  assert.strictEqual(point.outflow_minor, fin.expense_minor);
  assert.strictEqual(point.net_minor, fin.cash_flow_minor);
}
assert.strictEqual(view.trend.inflow_sum_minor, view.inflow_minor);
assert.strictEqual(view.trend.outflow_sum_minor, view.outflow_minor);
assert.strictEqual(view.trend.net_sum_minor, view.net_minor);

const withHugeTransfer = cashflow.buildCashFlowDashboard([
  ...INPUTS,
  tx('SYN-26-TRANSFER-EXTRA', '2026-01-25', 'transfer', 999999999, 'SYN-TRANSFER', { destination_account_id: 'SYN-VAULT' })
], OPTIONS);
assert.strictEqual(withHugeTransfer.inflow_minor, view.inflow_minor);
assert.strictEqual(withHugeTransfer.outflow_minor, view.outflow_minor);
assert.strictEqual(withHugeTransfer.net_minor, view.net_minor);
assert.deepStrictEqual(withHugeTransfer.trend.points, view.trend.points, 'Transfer-only changes must not alter Cash Flow trend');

assert.deepStrictEqual(view.widgets.map((widget) => [widget.id, widget.chart_spec.type, widget.chart_spec.encoding.y.id]), [
  ['cash-flow-net-trend', 'LINE', 'CASH_FLOW'],
  ['cash-flow-inflow-trend', 'BAR', 'INCOME'],
  ['cash-flow-outflow-trend', 'BAR', 'EXPENSE'],
  ['cash-flow-compare', 'BAR', 'CASH_FLOW']
]);
const specText = JSON.stringify(view.widgets);
for (const forbidden of ['inflow_minor', 'outflow_minor', 'net_minor', 'rows', 'transactions']) assert(!specText.includes(forbidden));
const compiled = [
  viz.compileEChartsOption(view.widgets[0].chart_spec, view.render_datasets.net),
  viz.compileEChartsOption(view.widgets[1].chart_spec, view.render_datasets.inflow),
  viz.compileEChartsOption(view.widgets[2].chart_spec, view.render_datasets.outflow),
  viz.compileEChartsOption(view.widgets[3].chart_spec, view.render_datasets.compare)
];
assert(compiled[0].option.series.every((series) => series.type === 'line'));
assert(compiled.slice(1).every((entry) => entry.option.series.every((series) => series.type === 'bar')));

const inflowDrill = cashflow.buildCashFlowDrill(view, { component: 'INFLOW', widget_id: 'cash-flow-inflow-trend' });
const outflowDrill = cashflow.buildCashFlowDrill(view, { component: 'OUTFLOW', widget_id: 'cash-flow-outflow-trend' });
const netDrill = cashflow.buildCashFlowDrill(view, { component: 'NET', widget_id: 'cash-flow-net-trend' });
assert.deepStrictEqual(inflowDrill.explorer_query.types, ['income']);
assert.deepStrictEqual(outflowDrill.explorer_query.types, ['expense', 'refund']);
assert.deepStrictEqual(netDrill.explorer_query.types, ['expense', 'income', 'refund']);
for (const drill of [inflowDrill, outflowDrill, netDrill]) {
  assert.strictEqual(drill.drill_context.target, 'TRANSACTION_EXPLORER');
  assert.deepStrictEqual(drill.explorer_query.account_ids, ['SYN-ACCOUNT']);
  assert(!drill.explorer_query.types.includes('transfer'));
  assert.strictEqual(drill.financial_payload, false);
  assert.strictEqual(drill.liquidity_or_balance_payload, false);
  const text = JSON.stringify(drill);
  for (const forbidden of ['amount_minor', 'inflow_minor', 'outflow_minor', 'net_minor', 'cash_flow_minor', 'balance_minor']) assert(!text.includes(forbidden));
}

assert(/^[0-9a-f]{64}$/.test(view.telemetry.query_hash));
assert(/^[0-9a-f]{64}$/.test(view.telemetry.context_hash));
assert.deepStrictEqual(Object.keys(view.telemetry).sort(), ['schema','version','query_hash','context_hash','bucket_count','status','reason_code'].sort());
const telemetryText = JSON.stringify(view.telemetry);
for (const forbidden of ['125000', '40000', '85000', 'SYN-ACCOUNT', 'SYN-SALARY']) assert(!telemetryText.includes(forbidden));

expectCode(() => cashflow.buildCashFlowDashboard(INPUTS, { ...OPTIONS, comparison_period: { start: '2025-01-01', end: '2025-02-28', partial: false } }), 'KPI_PERIODS_NOT_COMPARABLE');
expectCode(() => cashflow.buildCashFlowDashboard(INPUTS, { ...OPTIONS, period: { start: '2026-01-15', end: '2026-03-15', partial: false }, comparison_period: { start: '2025-01-15', end: '2025-03-15', partial: false } }), 'CF_TREND_MONTH_ALIGNMENT_REQUIRED');
expectCode(() => cashflow.buildCashFlowDashboard([...INPUTS, tx('SYN-USD', '2026-01-07', 'income', 1000, 'SYN-INCOME', { currency: 'USD' })], OPTIONS), 'KPI_MIXED_CURRENCY_UNSUPPORTED');
expectCode(() => cashflow.buildCashFlowDrill(view, { component: 'TRANSFER' }), 'CF_DRILL_COMPONENT_UNKNOWN');

console.log('cash_flow_dashboard_contract_test: OK', {
  contract: `${CONTRACT.schema}@${CONTRACT.version}`,
  finParity: true,
  transferNeutral: true,
  buckets: view.trend.points.length,
  netIdentity: true,
  comparablePeriods: true,
  drillTransferExcluded: true,
  liquidityProxy: false,
  configurationOnlySpecs: true,
  publicTelemetryPayload: false,
  freeOnly: true,
  financialWriteAuthority: false
});
