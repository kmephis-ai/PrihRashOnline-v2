'use strict';

const assert = require('assert');
const home = require('../lib/home/financial_home');
const projection = require('../lib/visualization/household_visual_projection');

const cashFlow = projection.cashFlowRenderDataset([
  { period: { start: '2026-01-01', end: '2026-02-01' }, cash_flow_minor: 12000 },
  { period: { start: '2026-02-01', end: '2026-03-01' }, cash_flow_minor: -5000 },
  { period: { start: '2026-03-01', end: '2026-04-01' }, cash_flow_minor: 18000 },
  { period: { start: '2026-04-01', end: '2026-05-01' }, cash_flow_minor: 9000 },
  { period: { start: '2026-05-01', end: '2026-06-01' }, cash_flow_minor: 24000 },
  { period: { start: '2026-06-01', end: '2026-07-01' }, cash_flow_minor: 30000 }
]);
assert.strictEqual(cashFlow.schema, 'PRH_VISUALIZATION_RENDER_DATASET_V1');
assert.strictEqual(cashFlow.rows.length, 6);
assert.deepStrictEqual(cashFlow.rows.map((row) => row.dimensions.time_bucket), [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'
]);
assert.deepStrictEqual(cashFlow.rows.map((row) => row.measures.CASH_FLOW), [12000, -5000, 18000, 9000, 24000, 30000]);

const expenseInput = [
  ['Дом', 58000], ['Кредиты', 10000], ['Продукты', 8000], ['Коммуналка', 4000],
  ['Подарки', 3000], ['Разное', 3000], ['Связь', 2500], ['Бензин', 2000], ['Одежда', 1000]
];
const shaped = projection.topNExpenseMix(expenseInput, 6);
assert.deepStrictEqual(shaped.slice(0, 6).map((entry) => entry.label), ['Дом', 'Кредиты', 'Продукты', 'Коммуналка', 'Подарки', 'Разное']);
assert.deepStrictEqual(shaped[6], { label: 'Прочее', value_minor: 5500, source_count: 3 });
assert.strictEqual(
  shaped.reduce((sum, entry) => sum + entry.value_minor, 0),
  expenseInput.reduce((sum, entry) => sum + entry[1], 0),
  'Top-N + Прочее must preserve authoritative expense total exactly'
);

const expenseDataset = projection.expenseMixRenderDataset(expenseInput, 6);
assert.strictEqual(expenseDataset.rows.length, 7);
assert.strictEqual(expenseDataset.rows[6].dimensions.category_id, 'Прочее');
assert.strictEqual(expenseDataset.rows[6].measures.EXPENSE, 5500);

const specs = home.homeWidgetSpecs();
const lineSpec = specs.find((widget) => widget.id === 'home-cash-flow-trend').chart_spec;
const donutSpec = specs.find((widget) => widget.id === 'home-expense-mix').chart_spec;
const line = projection.compileHouseholdChart(lineSpec, cashFlow);
const donut = projection.compileHouseholdChart(donutSpec, expenseDataset);
assert.strictEqual(line.renderer, 'ECHARTS_6');
assert.deepStrictEqual(line.option.xAxis.data, ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
assert.deepStrictEqual(line.option.series[0].data, [12000, -5000, 18000, 9000, 24000, 30000]);
assert.strictEqual(line.option.aria.enabled, true);
assert.strictEqual(donut.renderer, 'ECHARTS_6');
assert.strictEqual(donut.option.series[0].data.length, 7);
assert.deepStrictEqual(donut.option.series[0].data[6], { name: 'Прочее', value: 5500 });
assert.strictEqual(donut.option.aria.enabled, true);

assert.throws(
  () => projection.cashFlowRenderDataset([
    { period: { start: '2026-01-01', end: '2026-02-01' }, cash_flow_minor: 1 },
    { period: { start: '2026-01-15', end: '2026-02-15' }, cash_flow_minor: 2 }
  ]),
  /VIZ_HOUSEHOLD_CASH_FLOW_PERIOD_DUPLICATE/
);
assert.throws(() => projection.topNExpenseMix([['Дом', -1]], 6), /VIZ_HOUSEHOLD_EXPENSE_ENTRY_INVALID/);
assert.throws(() => projection.topNExpenseMix([['Дом', 10], ['Дом', 20]], 6), /VIZ_HOUSEHOLD_EXPENSE_LABEL_DUPLICATE/);

const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'lib', 'visualization', 'household_visual_projection.js'), 'utf8');
const forbiddenAuthorityPatterns = [
  /evaluateKpis\s*\(/i,
  /financialReconciliation/i,
  /reconcileFinancial/i,
  /kpi_dictionary/i,
  /google_sheets_transaction_repository/i,
  /canonical_transactions/i,
  /income_minor\s*-\s*expense_minor/i
];
for (const pattern of forbiddenAuthorityPatterns) {
  assert(!pattern.test(source), `visual projection must not become financial/query authority: ${pattern}`);
}
assert(!/https?:\/\//i.test(source), 'visual projection must not require an external asset/CDN');

console.log('household_visual_projection_visual_test: OK', {
  periods: cashFlow.rows.length,
  expenseRows: expenseDataset.rows.length,
  topN: 6,
  otherSourceCount: shaped[6].source_count,
  renderer: line.renderer,
  financialAuthority: false
});
