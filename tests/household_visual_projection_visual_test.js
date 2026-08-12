'use strict';

const assert = require('assert');
const home = require('../lib/home/financial_home');
const projection = require('../lib/visualization/household_visual_projection');

function errorCode(fn) {
  try {
    fn();
  } catch (error) {
    return String(error && (error.code || error.message) || '');
  }
  return '';
}

const expectedBuckets = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
const expectedCashFlow = [12000, -5000, 18000, 9000, 24000, 30000];
const cashFlow = projection.cashFlowRenderDataset(expectedBuckets.map((bucket, index) => {
  const [year, month] = bucket.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return {
    period: {
      start: `${bucket}-01`,
      end: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`
    },
    cash_flow_minor: expectedCashFlow[index]
  };
}));
assert.strictEqual(cashFlow.schema, 'PRH_VISUALIZATION_RENDER_DATASET_V1');
assert.strictEqual(cashFlow.rows.length, 6);
for (let index = 0; index < 6; index += 1) {
  assert.strictEqual(cashFlow.rows[index].dimensions.time_bucket, expectedBuckets[index]);
  assert.strictEqual(cashFlow.rows[index].measures.CASH_FLOW, expectedCashFlow[index]);
}

const expenseInput = [
  ['Дом', 58000], ['Кредиты', 10000], ['Продукты', 8000], ['Коммуналка', 4000],
  ['Подарки', 3000], ['Разное', 3000], ['Связь', 2500], ['Бензин', 2000], ['Одежда', 1000]
];
const shaped = projection.topNExpenseMix(expenseInput, 6);
assert.strictEqual(shaped.length, 7);
assert.strictEqual(shaped[0].label, 'Дом');
assert.strictEqual(shaped[0].value_minor, 58000);
assert.strictEqual(shaped[1].label, 'Кредиты');
assert.strictEqual(shaped[2].label, 'Продукты');
const other = shaped.find((entry) => entry.label === 'Прочее');
assert(other, 'Top-N must expose one Прочее bucket when categories exceed the limit');
assert.strictEqual(other.value_minor, 5500);
assert.strictEqual(other.source_count, 3);
assert.strictEqual(
  shaped.reduce((sum, entry) => sum + entry.value_minor, 0),
  expenseInput.reduce((sum, entry) => sum + entry[1], 0),
  'Top-N + Прочее must preserve authoritative expense total exactly'
);

const expenseDataset = projection.expenseMixRenderDataset(expenseInput, 6);
assert.strictEqual(expenseDataset.rows.length, 7);
const otherRow = expenseDataset.rows.find((row) => row.dimensions.category_id === 'Прочее');
assert(otherRow, 'RenderDataset must preserve the Прочее bucket');
assert.strictEqual(otherRow.measures.EXPENSE, 5500);

const specs = home.homeWidgetSpecs();
const lineWidget = specs.find((widget) => widget.id === 'home-cash-flow-trend');
const donutWidget = specs.find((widget) => widget.id === 'home-expense-mix');
assert(lineWidget && donutWidget, 'Existing Home ChartSpec widgets must remain canonical');
const line = projection.compileHouseholdChart(lineWidget.chart_spec, cashFlow);
const donut = projection.compileHouseholdChart(donutWidget.chart_spec, expenseDataset);
assert.strictEqual(line.renderer, 'ECHARTS_6');
assert.strictEqual(line.option.aria.enabled, true);
assert.strictEqual(line.option.xAxis.data.length, 6);
assert.strictEqual(line.option.series[0].data.length, 6);
for (let index = 0; index < 6; index += 1) {
  assert.strictEqual(line.option.xAxis.data[index], expectedBuckets[index]);
  assert.strictEqual(line.option.series[0].data[index], expectedCashFlow[index]);
}
assert.strictEqual(donut.renderer, 'ECHARTS_6');
assert.strictEqual(donut.option.aria.enabled, true);
const donutOther = donut.option.series[0].data.find((entry) => entry.name === 'Прочее');
assert(donutOther, 'ECHARTS_6 option must contain the Прочее slice');
assert.strictEqual(donutOther.value, 5500);

assert.strictEqual(errorCode(() => projection.cashFlowRenderDataset([
  { period: { start: '2026-01-01', end: '2026-02-01' }, cash_flow_minor: 1 },
  { period: { start: '2026-01-15', end: '2026-02-15' }, cash_flow_minor: 2 }
])), 'VIZ_HOUSEHOLD_CASH_FLOW_PERIOD_DUPLICATE');
assert.strictEqual(errorCode(() => projection.topNExpenseMix([['Дом', -1]], 6)), 'VIZ_HOUSEHOLD_EXPENSE_ENTRY_INVALID');
assert.strictEqual(errorCode(() => projection.topNExpenseMix([['Дом', 10], ['Дом', 20]], 6)), 'VIZ_HOUSEHOLD_EXPENSE_LABEL_DUPLICATE');

const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'lib', 'visualization', 'household_visual_projection.js'), 'utf8');
const localRequires = [...source.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((match) => match[2]);
assert.strictEqual(localRequires.length, 1);
assert.strictEqual(localRequires[0], './visualization_foundation', 'visual projection may depend only on renderer-neutral visualization foundation');
assert(!/https?:\/\//i.test(source), 'visual projection must not require an external asset/CDN');

console.log('household_visual_projection_visual_test: OK', {
  periods: cashFlow.rows.length,
  expenseRows: expenseDataset.rows.length,
  topN: 6,
  otherSourceCount: other.source_count,
  renderer: line.renderer,
  financialAuthority: false
});
