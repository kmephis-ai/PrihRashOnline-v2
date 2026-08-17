'use strict';

const assert = require('assert');
const PIVOT = require('../lib/analytics/pivot_olap');
const ANALYTICS = require('../lib/analytics/analytics_engine');

function query(options = {}) {
  const input = {
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: options.currency || 'USD',
    measures: options.measures || ['EXPENSE'],
    dimensions: options.dimensions || [],
    filters: options.filters || [],
    time_range: options.time_range == null ? null : options.time_range,
    grain: options.grain || 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 5000
  };
  return ANALYTICS.normalizeAnalyticsQuery(input);
}

function analyticsResult(baseQuery, rows, options = {}) {
  const normalized = ANALYTICS.normalizeAnalyticsQuery(baseQuery);
  const hash = ANALYTICS.analyticsQueryHash(normalized);
  const outputRows = rows.map((row) => Object.freeze({
    dimensions: Object.freeze({ ...row.dimensions }),
    measures: Object.freeze({ ...row.measures }),
    comparison_measures: null
  }));
  return Object.freeze({
    schema: ANALYTICS.RESULT_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    query_hash: hash,
    currency: normalized.currency,
    time_range: normalized.time_range,
    grain: normalized.grain,
    comparison: Object.freeze({ mode: 'NONE', time_range: null }),
    total_rows: outputRows.length,
    truncated: options.truncated === true,
    rows: Object.freeze(outputRows),
    provenance: Object.freeze({
      contract_version: ANALYTICS.CONTRACT_VERSION,
      query_hash: hash,
      canonical_schema: 'PRH_CANONICAL_TRANSACTION_V1',
      kpi_dictionary_version: '1.0.0',
      financial_truth_policy: 'FIN-TRUTH-v1',
      input_revision: options.input_revision || 'synthetic-revision',
      legacy_total_cells_used: false,
      ui_logic_used: false
    })
  });
}

function axis(dimensionId, level = null) {
  return dimensionId === 'time_bucket'
    ? { dimension_id: 'time_bucket', hierarchy_id: 'TIME', level }
    : { dimension_id: dimensionId, hierarchy_id: null, level: null };
}

function spec(options = {}) {
  return {
    schema: PIVOT.SPEC_SCHEMA,
    contract_version: PIVOT.VERSION,
    rows: options.rows || [axis('category_id')],
    columns: options.columns || [axis('account_id')],
    measures: (options.measures || ['EXPENSE']).map((id) => ({ id, aggregation: 'SUM' })),
    subtotals: options.subtotals || { rows: true, columns: true },
    grand_total: options.grand_total == null ? true : options.grand_total,
    sort: options.sort == null ? null : options.sort,
    top_n: options.top_n == null ? null : options.top_n
  };
}

function row(dimensions, measures) {
  return { dimensions, measures };
}

function sumCells(result, measure) {
  return result.cells.reduce((sum, cell) => sum + cell.measures[measure], 0);
}

function memberByValues(members, expected) {
  return members.find((member) => Object.entries(expected).every(([key, value]) => member.values[key] === value));
}

assert.strictEqual(PIVOT.assertContract(), true);
assert.strictEqual(PIVOT.CONTRACT.schema, 'PRH_PIVOT_OLAP_V1');
assert.strictEqual(PIVOT.CONTRACT.version, '1.0.0');
assert.strictEqual(PIVOT.CONTRACT.roadmap_id, 'ANL-073');
assert.strictEqual(PIVOT.CONTRACT.principles.canonical_kpi_recalculated, false);
assert.strictEqual(PIVOT.CONTRACT.principles.top_n_reuses_calculated_metrics, true);
assert.strictEqual(PIVOT.CONTRACT.principles.non_additive_guessing, false);
assert.ok(Object.values(PIVOT.CONTRACT.authorities).every((value) => value === false));

const specA = spec({
  rows: [axis('category_id')],
  columns: [axis('account_id')],
  measures: ['EXPENSE', 'INCOME'],
  sort: { axis: 'ROWS', by: 'MEASURE', key: 'EXPENSE', direction: 'DESC' }
});
const specB = {
  top_n: null,
  sort: { direction: 'DESC', key: 'EXPENSE', by: 'MEASURE', axis: 'ROWS' },
  grand_total: true,
  subtotals: { columns: true, rows: true },
  measures: [{ aggregation: 'SUM', id: 'EXPENSE' }, { aggregation: 'SUM', id: 'INCOME' }],
  columns: [{ level: null, hierarchy_id: null, dimension_id: 'account_id' }],
  rows: [{ level: null, hierarchy_id: null, dimension_id: 'category_id' }],
  contract_version: PIVOT.VERSION,
  schema: PIVOT.SPEC_SCHEMA
};
assert.strictEqual(PIVOT.serializePivotSpec(specA), PIVOT.serializePivotSpec(specB));
assert.strictEqual(PIVOT.pivotSpecHash(specA), PIVOT.pivotSpecHash(specB));
assert.throws(() => PIVOT.normalizePivotSpec(spec({ measures: ['BUDGET_VARIANCE'] })), /PIVOT_NON_ADDITIVE_MEASURE_UNSUPPORTED/);
assert.throws(() => PIVOT.normalizePivotSpec(spec({ rows: [axis('category_id')], columns: [axis('category_id')] })), /PIVOT_DIMENSION_DUPLICATE_ACROSS_AXES/);
assert.throws(() => PIVOT.normalizePivotSpec(spec({ rows: [{ dimension_id: 'tag', hierarchy_id: null, level: null }] })), /PIVOT_AXIS_DIMENSION_UNSUPPORTED/);
assert.throws(() => PIVOT.normalizePivotSpec(spec({ rows: [axis('time_bucket', 'WEEK')] })), /PIVOT_TIME_HIERARCHY_INVALID/);
assert.throws(() => PIVOT.normalizePivotSpec(spec({ rows: [axis('category_id')], top_n: { axis: 'COLUMNS', measure: 'EXPENSE', n: 2 }, columns: [] })), /PIVOT_TOP_N_AXIS_EMPTY/);

const base = query({ measures: ['EXPENSE', 'INCOME'], dimensions: ['category_id', 'account_id'] });
const sourceRows = [
  row({ category_id: 'CAT-A', account_id: 'ACC-1' }, { EXPENSE: 100, INCOME: 10 }),
  row({ category_id: 'CAT-A', account_id: 'ACC-2' }, { EXPENSE: 200, INCOME: 20 }),
  row({ category_id: 'CAT-B', account_id: 'ACC-1' }, { EXPENSE: 300, INCOME: 30 })
];
const source = analyticsResult(base, sourceRows);
const basic = PIVOT.evaluatePivot(source, spec({ rows: [axis('category_id')], columns: [axis('account_id')], measures: ['EXPENSE', 'INCOME'] }));
assert.deepStrictEqual(basic.grand_total.measures, { EXPENSE: 600, INCOME: 60 });
assert.strictEqual(basic.row_members.length, 2);
assert.strictEqual(basic.column_members.length, 2);
assert.strictEqual(basic.cells.length, 4);
assert.strictEqual(sumCells(basic, 'EXPENSE'), 600);
assert.strictEqual(sumCells(basic, 'INCOME'), 60);
const catB = memberByValues(basic.row_members, { category_id: 'CAT-B' });
const acc2 = memberByValues(basic.column_members, { account_id: 'ACC-2' });
const sparse = basic.cells.find((cell) => cell.row_key === catB.key && cell.column_key === acc2.key);
assert.strictEqual(sparse.sparse_zero, true);
assert.deepStrictEqual(sparse.measures, { EXPENSE: 0, INCOME: 0 });
assert.strictEqual(basic.provenance.kpi_formula_redefined, false);
assert.strictEqual(basic.provenance.financial_write, false);

const reversed = PIVOT.evaluatePivot(analyticsResult(base, sourceRows.slice().reverse()), spec({ rows: [axis('category_id')], columns: [axis('account_id')], measures: ['EXPENSE', 'INCOME'] }));
assert.strictEqual(reversed.result_hash, basic.result_hash, 'source row ordering must not affect pivot result identity');
assert.deepStrictEqual(reversed.cells, basic.cells);

const multiBase = query({ measures: ['EXPENSE'], dimensions: ['category_id', 'member_id', 'account_id'] });
const multiSource = analyticsResult(multiBase, [
  row({ category_id: 'CAT-A', member_id: 'MEM-1', account_id: 'ACC-1' }, { EXPENSE: 100 }),
  row({ category_id: 'CAT-A', member_id: 'MEM-2', account_id: 'ACC-1' }, { EXPENSE: 150 }),
  row({ category_id: 'CAT-B', member_id: 'MEM-1', account_id: 'ACC-1' }, { EXPENSE: 250 })
]);
const multi = PIVOT.evaluatePivot(multiSource, spec({
  rows: [axis('category_id'), axis('member_id')],
  columns: [axis('account_id')],
  subtotals: { rows: true, columns: true }
}));
assert.strictEqual(multi.row_subtotals.length, 2);
const subtotalA = multi.row_subtotals.find((item) => item.dimensions.category_id === 'CAT-A');
assert.deepStrictEqual(subtotalA.measures, { EXPENSE: 250 });
assert.strictEqual(multi.column_subtotals.length, 0);
assert.deepStrictEqual(multi.grand_total.measures, { EXPENSE: 500 });

const topBase = query({ measures: ['EXPENSE'], dimensions: ['category_id', 'account_id'] });
const topSourceRows = [
  row({ category_id: 'CAT-A', account_id: 'ACC-1' }, { EXPENSE: 100 }),
  row({ category_id: 'CAT-B', account_id: 'ACC-1' }, { EXPENSE: 300 }),
  row({ category_id: 'CAT-C', account_id: 'ACC-1' }, { EXPENSE: 200 }),
  row({ category_id: 'CAT-D', account_id: 'ACC-1' }, { EXPENSE: 50 })
];
const topSource = analyticsResult(topBase, topSourceRows);
const top = PIVOT.evaluatePivot(topSource, spec({
  top_n: { axis: 'ROWS', measure: 'EXPENSE', n: 2 },
  subtotals: { rows: false, columns: false }
}));
assert.deepStrictEqual(top.row_members.map((member) => member.kind), ['VALUE', 'VALUE', 'OTHER']);
assert.deepStrictEqual(top.row_members.slice(0, 2).map((member) => member.values.category_id), ['CAT-B', 'CAT-C']);
assert.strictEqual(top.row_members[2].values.category_id, '__OTHER__');
assert.strictEqual(top.top_n_evidence.operator, 'PRH_ANALYTICS_CALCULATED_METRICS_V1@1.0.0:TOP_N_OTHER');
assert.strictEqual(top.top_n_evidence.source_total_minor, 650);
assert.strictEqual(top.top_n_evidence.output_total_minor, 650);
const otherCell = top.cells.find((cell) => cell.row_key === '__OTHER__');
assert.strictEqual(otherCell.measures.EXPENSE, 150);
assert.strictEqual(sumCells(top, 'EXPENSE'), 650);

const sorted = PIVOT.evaluatePivot(topSource, spec({
  sort: { axis: 'ROWS', by: 'MEASURE', key: 'EXPENSE', direction: 'DESC' },
  subtotals: { rows: false, columns: false }
}));
assert.deepStrictEqual(sorted.row_members.map((member) => member.values.category_id), ['CAT-B', 'CAT-C', 'CAT-A', 'CAT-D']);
const sortedKey = PIVOT.evaluatePivot(topSource, spec({
  sort: { axis: 'ROWS', by: 'KEY', key: 'category_id', direction: 'ASC' },
  subtotals: { rows: false, columns: false }
}));
assert.deepStrictEqual(sortedKey.row_members.map((member) => member.values.category_id), ['CAT-A', 'CAT-B', 'CAT-C', 'CAT-D']);

const badTruncated = analyticsResult(base, sourceRows, { truncated: true });
assert.throws(() => PIVOT.evaluatePivot(badTruncated, spec({ rows: [axis('category_id')], columns: [axis('account_id')], measures: ['EXPENSE', 'INCOME'] })), /PIVOT_ANALYTICS_RESULT_INCOMPLETE/);
const wrongDimsQuery = query({ measures: ['EXPENSE'], dimensions: ['category_id'] });
const wrongDimsSource = analyticsResult(wrongDimsQuery, [row({ category_id: 'CAT-A' }, { EXPENSE: 100 })]);
assert.throws(() => PIVOT.evaluatePivot(wrongDimsSource, spec()), /PIVOT_SOURCE_DIMENSIONS_MISMATCH/);
const comparedSource = Object.freeze({ ...source, comparison: Object.freeze({ mode: 'PREVIOUS_PERIOD', time_range: null }) });
assert.throws(() => PIVOT.evaluatePivot(comparedSource, spec({ rows: [axis('category_id')], columns: [axis('account_id')], measures: ['EXPENSE', 'INCOME'] })), /PIVOT_ANALYTICS_COMPARISON_UNSUPPORTED/);

const yearQuery = query({
  measures: ['EXPENSE'],
  dimensions: ['category_id'],
  time_range: { start: '2025-01-01', end: '2027-01-01' },
  grain: 'YEAR'
});
const yearSpec = spec({ rows: [axis('time_bucket', 'YEAR')], columns: [axis('category_id')] });
const yearSource = analyticsResult(yearQuery, [
  row({ time_bucket: '2025', category_id: 'CAT-A' }, { EXPENSE: 100 }),
  row({ time_bucket: '2026', category_id: 'CAT-A' }, { EXPENSE: 200 })
]);
const yearPivot = PIVOT.evaluatePivot(yearSource, yearSpec);
assert.deepStrictEqual(yearPivot.grand_total.measures, { EXPENSE: 300 });
const expanded = PIVOT.deriveHierarchyRequery(yearQuery, yearSpec, { axis: 'ROWS', index: 0, action: 'EXPAND' });
assert.strictEqual(expanded.from_level, 'YEAR');
assert.strictEqual(expanded.to_level, 'MONTH');
assert.strictEqual(expanded.analytics_query.grain, 'MONTH');
assert.deepStrictEqual(expanded.analytics_query.dimensions, ['category_id']);
assert.notStrictEqual(expanded.previous_query_hash, expanded.next_query_hash);
assert.strictEqual(expanded.provenance.implicit_detail_synthesis, false);
const collapsed = PIVOT.deriveHierarchyRequery(expanded.analytics_query, expanded.pivot_spec, { axis: 'ROWS', index: 0, action: 'COLLAPSE' });
assert.strictEqual(collapsed.to_level, 'YEAR');
assert.strictEqual(collapsed.analytics_query.grain, 'YEAR');
assert.throws(() => PIVOT.deriveHierarchyRequery(yearQuery, yearSpec, { axis: 'ROWS', index: 0, action: 'COLLAPSE' }), /PIVOT_HIERARCHY_BOUNDARY_REACHED/);

const basicSpec = spec({ rows: [axis('category_id')], columns: [axis('account_id')], measures: ['EXPENSE', 'INCOME'] });
const basicCatA = memberByValues(basic.row_members, { category_id: 'CAT-A' });
const basicAcc1 = memberByValues(basic.column_members, { account_id: 'ACC-1' });
const drill = PIVOT.buildDrillDescriptor(source, basicSpec, basic, base, {
  row_key: basicCatA.key,
  column_key: basicAcc1.key,
  measure: 'EXPENSE',
  source_widget_id: 'pivot-main',
  target: 'TRANSACTION_EXPLORER'
});
assert.strictEqual(drill.schema, PIVOT.DRILL_SCHEMA);
assert.strictEqual(drill.analytics_query.grain, 'NONE');
assert.deepStrictEqual(drill.analytics_query.dimensions, []);
assert.deepStrictEqual(drill.analytics_query.measures, ['EXPENSE']);
assert.deepStrictEqual(drill.analytics_query.filters.map((item) => [item.field, item.operator, item.values]), [
  ['account_id', 'EQ', ['ACC-1']],
  ['category_id', 'EQ', ['CAT-A']]
]);
assert.strictEqual(drill.drill_context.target, 'TRANSACTION_EXPLORER');
assert.strictEqual(drill.provenance.runtime_private_descriptor, true);
assert.strictEqual(drill.provenance.persisted_in_pivot_spec, false);

const monthQuery = query({
  measures: ['EXPENSE'],
  dimensions: ['category_id'],
  filters: [{ field: 'status', operator: 'EQ', values: ['posted'] }],
  time_range: { start: '2026-01-01', end: '2026-03-01' },
  grain: 'MONTH'
});
const monthSpec = spec({ rows: [axis('time_bucket', 'MONTH')], columns: [axis('category_id')] });
const monthSource = analyticsResult(monthQuery, [
  row({ time_bucket: '2026-01', category_id: 'CAT-A' }, { EXPENSE: 120 }),
  row({ time_bucket: '2026-02', category_id: 'CAT-A' }, { EXPENSE: 140 })
]);
const monthPivot = PIVOT.evaluatePivot(monthSource, monthSpec);
const jan = memberByValues(monthPivot.row_members, { time_bucket: '2026-01' });
const monthCatA = memberByValues(monthPivot.column_members, { category_id: 'CAT-A' });
const monthDrill = PIVOT.buildDrillDescriptor(monthSource, monthSpec, monthPivot, monthQuery, {
  row_key: jan.key,
  column_key: monthCatA.key,
  measure: 'EXPENSE',
  source_widget_id: 'pivot-time',
  target: 'TRANSACTION_EXPLORER'
});
assert.deepStrictEqual(monthDrill.analytics_query.time_range, { start: '2026-01-01', end: '2026-02-01' });
assert(monthDrill.analytics_query.filters.some((item) => item.field === 'status' && item.values[0] === 'posted'));
assert(monthDrill.analytics_query.filters.some((item) => item.field === 'category_id' && item.values[0] === 'CAT-A'));

const topOther = top.row_members.find((member) => member.kind === 'OTHER');
const topColumn = top.column_members[0];
assert.throws(() => PIVOT.buildDrillDescriptor(topSource, spec({ top_n: { axis: 'ROWS', measure: 'EXPENSE', n: 2 }, subtotals: { rows: false, columns: false } }), top, topBase, {
  row_key: topOther.key,
  column_key: topColumn.key,
  measure: 'EXPENSE',
  source_widget_id: 'pivot-top',
  target: 'TRANSACTION_EXPLORER'
}), /PIVOT_DRILL_OTHER_UNSUPPORTED/);

let seed = 0x5eed1234;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}
function shuffled(items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

for (let iteration = 0; iteration < 50; iteration += 1) {
  const randomRows = [];
  let expected = 0;
  for (let category = 0; category < 5; category += 1) {
    for (let account = 0; account < 3; account += 1) {
      if (random() < 0.25) continue;
      const value = Math.floor(random() * 20001) - 5000;
      expected += value;
      randomRows.push(row({ category_id: `CAT-${category}`, account_id: `ACC-${account}` }, { EXPENSE: value }));
    }
  }
  const randomQuery = query({ measures: ['EXPENSE'], dimensions: ['category_id', 'account_id'] });
  const randomSpec = spec({
    top_n: iteration % 3 === 0 ? { axis: 'ROWS', measure: 'EXPENSE', n: 3 } : null,
    sort: iteration % 4 === 0 ? { axis: 'COLUMNS', by: 'KEY', key: 'account_id', direction: 'DESC' } : null,
    subtotals: { rows: false, columns: false }
  });
  const first = PIVOT.evaluatePivot(analyticsResult(randomQuery, randomRows, { input_revision: `synthetic-${iteration}` }), randomSpec);
  const second = PIVOT.evaluatePivot(analyticsResult(randomQuery, shuffled(randomRows), { input_revision: `synthetic-${iteration}` }), randomSpec);
  assert.strictEqual(first.result_hash, second.result_hash, `randomized deterministic parity ${iteration}`);
  assert.strictEqual(first.grand_total.measures.EXPENSE, expected, `grand total parity ${iteration}`);
  assert.strictEqual(sumCells(first, 'EXPENSE'), expected, `cell reconciliation ${iteration}`);
}

const telemetry = PIVOT.pivotTelemetry(basic);
assert.deepStrictEqual(Object.keys(telemetry).sort(), PIVOT.CONTRACT.telemetry_allowlist.slice().sort());
for (const forbidden of ['currency', 'current_minor', 'value_minor', 'amount_minor', 'row_members', 'column_members', 'cells', 'dimension_values', 'transaction_id']) {
  assert.strictEqual(Object.prototype.hasOwnProperty.call(telemetry, forbidden), false, forbidden);
}
assert.strictEqual(telemetry.decision, 'ALLOW');
assert.strictEqual(telemetry.reason, 'OK');
assert.strictEqual(telemetry.financial_truth_policy, 'FIN-TRUTH-v1');

console.log('pivot_olap_contract_test: OK', {
  contract: `${PIVOT.SCHEMA}@${PIVOT.VERSION}`,
  axes: ['ROWS', 'COLUMNS'],
  additiveOnly: true,
  sparseZeroExplicit: true,
  grandTotalReconciles: true,
  prefixSubtotals: true,
  topNReusesAnl072: true,
  hierarchyRequeryRequired: true,
  drillReproducesCanonicalQuery: true,
  randomizedParityIterations: 50,
  publicTelemetryFinancialPayload: false,
  financialWrite: false,
  freeOnly: true
});
