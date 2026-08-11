'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');
const { evaluateAnalytics } = require('../lib/analytics/analytics_engine');
const period = require('../lib/analytics/period_engine');
const calc = require('../lib/analytics/calculated_metrics');

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function tx(index, day, type, amountMinor, categoryId) {
  return normalizeCanonicalTransaction({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: `CALC-TX-${String(index).padStart(3, '0')}`,
    occurred_at: `${day}T12:00:00Z`,
    type,
    status: 'posted',
    amount_minor: amountMinor,
    currency: 'USD',
    account_id: 'acct-main',
    destination_account_id: null,
    category_id: categoryId,
    member_id: null,
    project_id: null,
    tags: ['synthetic-anl-072'],
    counterparty: null,
    description: null,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'fixture:anl-072',
      source_record_id: `CALC-REC-${index}`,
      source_fingerprint: fingerprint(`calc:${index}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'ANL-072-SYNTHETIC-v1',
      source_position: null
    }
  });
}

const fixture = [
  tx(1, '2026-01-02', 'income', 5000, 'salary'),
  tx(2, '2026-01-05', 'expense', 1000, 'food'),
  tx(3, '2026-01-10', 'expense', 2000, 'rent'),
  tx(4, '2026-01-15', 'expense', 500, 'fun'),
  tx(5, '2026-01-20', 'expense', 500, 'utilities'),
  tx(6, '2026-02-02', 'income', 5000, 'salary'),
  tx(7, '2026-02-05', 'expense', 1500, 'food'),
  tx(8, '2026-02-10', 'expense', 2000, 'rent'),
  tx(9, '2026-02-20', 'expense', 500, 'utilities'),
  tx(10, '2026-03-02', 'income', 6000, 'salary'),
  tx(11, '2026-03-05', 'expense', 1000, 'food'),
  tx(12, '2026-03-10', 'expense', 2000, 'rent'),
  tx(13, '2026-03-15', 'expense', 1000, 'fun'),
  tx(14, '2026-04-02', 'income', 5500, 'salary'),
  tx(15, '2026-04-05', 'expense', 1500, 'food'),
  tx(16, '2026-04-10', 'expense', 2000, 'rent'),
  tx(17, '2026-04-15', 'expense', 500, 'fun'),
  tx(18, '2026-04-20', 'expense', 1000, 'utilities')
];

function analyticsQuery(overrides = {}) {
  return {
    schema: 'PRH_ANALYTICS_QUERY_V1',
    contract_version: '1.0.0',
    currency: 'USD',
    measures: ['EXPENSE'],
    dimensions: [],
    filters: [],
    time_range: { start: '2026-01-01', end: '2026-05-01' },
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 500,
    ...overrides
  };
}

function periodQuery(start, end, grain = 'MONTH', comparisonMode = 'NONE', overrides = {}) {
  return {
    schema: period.QUERY_SCHEMA,
    contract_version: period.VERSION,
    currency: 'USD',
    measures: ['EXPENSE'],
    dimensions: [],
    filters: [],
    sort: [],
    parameters: {},
    limit: 500,
    period: {
      selector: { kind: 'EXPLICIT_RANGE', start, end },
      grain,
      comparison_mode: comparisonMode
    },
    ...overrides
  };
}

function metricSpec(operator, options, measure = 'EXPENSE') {
  return {
    schema: calc.SPEC_SCHEMA,
    contract_version: calc.VERSION,
    operator,
    measure,
    options
  };
}

assert.strictEqual(calc.assertContract(), true);
assert.strictEqual(calc.CONTRACT.schema, 'PRH_ANALYTICS_CALCULATED_METRICS_V1');
assert.strictEqual(calc.CONTRACT.roadmap_id, 'ANL-072');
assert.strictEqual(calc.CONTRACT.semantics.arbitrary_executable_formula_allowed, false);
assert.strictEqual(calc.CONTRACT.semantics.kpi_formula_redefinition, false);
assert.strictEqual(calc.CONTRACT.semantics.ratio_scale, 1000000);
assert.ok(Object.values(calc.CONTRACT.authorities).every((value) => value === false));
assert.deepStrictEqual(calc.OPERATORS.slice().sort(), [
  'CUMULATIVE', 'DELTA_ABS', 'DELTA_PCT', 'MOVING_AVERAGE', 'MOVING_MEDIAN', 'SHARE', 'TOP_N_OTHER'
]);

const movingA = metricSpec('MOVING_AVERAGE', { window: 3, partial_window: 'REQUIRE_FULL' });
const movingB = {
  options: { partial_window: 'REQUIRE_FULL', window: 3 },
  measure: 'EXPENSE',
  operator: 'MOVING_AVERAGE',
  contract_version: calc.VERSION,
  schema: calc.SPEC_SCHEMA
};
assert.strictEqual(calc.serializeCalculatedSpec(movingA), calc.serializeCalculatedSpec(movingB));
for (const hostile of [
  { ...movingA, formula: 'return amount_minor * 2' },
  { ...movingA, expression: 'EXPENSE / INCOME' },
  metricSpec('EVAL', { code: 'process.exit()' }),
  metricSpec('MOVING_AVERAGE', { window: 0, partial_window: 'REQUIRE_FULL' }),
  metricSpec('MOVING_MEDIAN', { window: 25, partial_window: 'ALLOW_PARTIAL' }),
  metricSpec('SHARE', { denominator_scope: 'PRIVATE_DYNAMIC_SCOPE' }),
  metricSpec('DELTA_PCT', { reference: 'ARBITRARY_SERIES' })
]) {
  assert.throws(() => calc.normalizeCalculatedSpec(hostile), /CALC_/);
}
assert.throws(() => calc.normalizeCalculatedSpec(metricSpec('CUMULATIVE', {}, 'BUDGET_VARIANCE')), /CALC_MEASURE_NON_ADDITIVE_UNSUPPORTED/);
const safeSerialized = calc.serializeCalculatedSpec(metricSpec('TOP_N_OTHER', { n: 3 }));
for (const forbidden of ['amount_minor', 'transaction_id', 'account_id', 'category_id', 'description', 'counterparty', 'formula', 'eval(', 'SELECT ']) {
  assert.strictEqual(safeSerialized.includes(forbidden), false, forbidden);
}

const grouped = evaluateAnalytics(fixture, analyticsQuery({ dimensions: ['category_id'] }));
assert.strictEqual(grouped.truncated, false);
const share = calc.evaluateCalculatedMetric(grouped, metricSpec('SHARE', { denominator_scope: 'RESULT_TOTAL' }));
assert.strictEqual(share.source_kind, 'ANALYTICS_RESULT');
assert.strictEqual(share.denominator_minor, 17000);
assert.strictEqual(share.rows.reduce((sum, row) => sum + row.value_ppm, 0), calc.RATIO_SCALE);
assert.strictEqual(share.reconciliation_ppm, calc.RATIO_SCALE);
assert.strictEqual(share.provenance.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(share.provenance.kpi_formula_redefined, false);
assert.strictEqual(share.provenance.arbitrary_formula_executed, false);

const zeroExpense = evaluateAnalytics(
  [tx(40, '2025-12-01', 'income', 1000, 'salary')],
  analyticsQuery({ dimensions: [], time_range: { start: '2025-12-01', end: '2026-01-01' } })
);
assert.throws(() => calc.evaluateCalculatedMetric(zeroExpense, metricSpec('SHARE', { denominator_scope: 'RESULT_TOTAL' })), /CALC_SHARE_DENOMINATOR_ZERO/);

const top = calc.evaluateCalculatedMetric(grouped, metricSpec('TOP_N_OTHER', { n: 3 }));
assert.strictEqual(top.rows.length, 4);
assert.strictEqual(top.rows[0].dimensions.category_id, 'rent');
assert.strictEqual(top.rows[1].dimensions.category_id, 'food');
assert.strictEqual(top.rows[2].dimensions.category_id, 'fun');
assert.strictEqual(top.rows[2].value_minor, 2000);
assert.strictEqual(top.rows[3].bucket_kind, 'OTHER');
assert.strictEqual(top.rows[3].bucket_key, '__OTHER__');
assert.strictEqual(top.rows[3].value_minor, 2000);
assert.strictEqual(top.source_total_minor, 17000);
assert.strictEqual(top.output_total_minor, 17000);
assert.strictEqual(top.other_included, true);

const scalarPeriod = period.evaluatePeriodSeries(fixture, periodQuery('2026-01-01', '2026-05-01'));
const cumulative = calc.evaluateCalculatedMetric(scalarPeriod, metricSpec('CUMULATIVE', {}));
assert.deepStrictEqual(cumulative.rows.map((row) => row.value_minor), [4000, 8000, 12000, 17000]);
assert.deepStrictEqual(cumulative.rows.map((row) => row.source_value_minor), [4000, 4000, 4000, 5000]);

const movingAvgFull = calc.evaluateCalculatedMetric(scalarPeriod, metricSpec('MOVING_AVERAGE', {
  window: 2,
  partial_window: 'REQUIRE_FULL'
}));
assert.deepStrictEqual(movingAvgFull.rows.map((row) => row.value_minor), [null, 4000, 4000, 4500]);
assert.deepStrictEqual(movingAvgFull.rows.map((row) => row.status), ['WINDOW_INCOMPLETE', 'OK', 'OK', 'OK']);

const movingMedianPartial = calc.evaluateCalculatedMetric(scalarPeriod, metricSpec('MOVING_MEDIAN', {
  window: 3,
  partial_window: 'ALLOW_PARTIAL'
}));
assert.deepStrictEqual(movingMedianPartial.rows.map((row) => row.value_minor), [4000, 4000, 4000, 4000]);
assert.deepStrictEqual(movingMedianPartial.rows.map((row) => row.status), ['OK_PARTIAL_WINDOW', 'OK_PARTIAL_WINDOW', 'OK', 'OK']);

const groupedPeriod = period.evaluatePeriodSeries(fixture, periodQuery('2026-01-01', '2026-05-01', 'MONTH', 'NONE', {
  dimensions: ['category_id']
}));
const groupedCumulative = calc.evaluateCalculatedMetric(groupedPeriod, metricSpec('CUMULATIVE', {}));
const funSeries = groupedCumulative.rows.filter((row) => row.dimensions.category_id === 'fun');
assert.deepStrictEqual(funSeries.map((row) => row.source_value_minor), [500, 0, 1000, 500]);
assert.deepStrictEqual(funSeries.map((row) => row.value_minor), [500, 500, 1500, 2000]);
const utilitiesSeries = groupedCumulative.rows.filter((row) => row.dimensions.category_id === 'utilities');
assert.deepStrictEqual(utilitiesSeries.map((row) => row.source_value_minor), [500, 500, 0, 1000]);
assert.deepStrictEqual(utilitiesSeries.map((row) => row.value_minor), [500, 1000, 1000, 2000]);

const compared = period.evaluatePeriodSeries(fixture, periodQuery(
  '2026-03-01', '2026-05-01', 'MONTH', 'PREVIOUS_COMPARABLE_PERIOD'
));
const deltaAbs = calc.evaluateCalculatedMetric(compared, metricSpec('DELTA_ABS', { reference: 'PERIOD_COMPARISON' }));
assert.deepStrictEqual(deltaAbs.rows.map((row) => row.reference_value_minor), [4000, 4000]);
assert.deepStrictEqual(deltaAbs.rows.map((row) => row.source_value_minor), [4000, 5000]);
assert.deepStrictEqual(deltaAbs.rows.map((row) => row.value_minor), [0, 1000]);
const deltaPct = calc.evaluateCalculatedMetric(compared, metricSpec('DELTA_PCT', { reference: 'PERIOD_COMPARISON' }));
assert.deepStrictEqual(deltaPct.rows.map((row) => row.value_ppm), [0, 250000]);
assert.deepStrictEqual(deltaPct.rows.map((row) => row.status), ['OK', 'OK']);

const zeroReference = period.evaluatePeriodSeries(fixture, periodQuery(
  '2026-01-01', '2026-02-01', 'MONTH', 'PREVIOUS_COMPARABLE_PERIOD'
));
const zeroReferencePct = calc.evaluateCalculatedMetric(zeroReference, metricSpec('DELTA_PCT', { reference: 'PERIOD_COMPARISON' }));
assert.strictEqual(zeroReferencePct.rows[0].reference_value_minor, 0);
assert.strictEqual(zeroReferencePct.rows[0].value_ppm, null);
assert.strictEqual(zeroReferencePct.rows[0].status, 'ZERO_REFERENCE_UNDEFINED');
const bothZero = period.evaluatePeriodSeries(fixture, periodQuery(
  '2025-11-01', '2025-12-01', 'MONTH', 'PREVIOUS_COMPARABLE_PERIOD'
));
const bothZeroPct = calc.evaluateCalculatedMetric(bothZero, metricSpec('DELTA_PCT', { reference: 'PERIOD_COMPARISON' }));
assert.strictEqual(bothZeroPct.rows[0].source_value_minor, 0);
assert.strictEqual(bothZeroPct.rows[0].reference_value_minor, 0);
assert.strictEqual(bothZeroPct.rows[0].value_ppm, 0);
assert.strictEqual(bothZeroPct.rows[0].status, 'ZERO_REFERENCE_NO_CHANGE');

const leap = period.evaluatePeriodSeries(fixture, periodQuery(
  '2024-02-01', '2024-03-01', 'DAY', 'YEAR_OVER_YEAR'
));
assert.strictEqual(leap.primary_buckets.length, 29);
assert.strictEqual(leap.comparison_buckets.length, 28);
assert.throws(() => calc.evaluateCalculatedMetric(leap, metricSpec('DELTA_ABS', { reference: 'PERIOD_COMPARISON' })), /CALC_REFERENCE_BUCKET_COUNT_MISMATCH/);

const truncated = { ...grouped, truncated: true, total_rows: grouped.rows.length + 1 };
assert.throws(() => calc.evaluateCalculatedMetric(truncated, metricSpec('TOP_N_OTHER', { n: 2 })), /CALC_ANALYTICS_RESULT_INCOMPLETE/);

assert.strictEqual(calc.roundRatioHalfAway(3, 2), 2);
assert.strictEqual(calc.roundRatioHalfAway(-3, 2), -2);
assert.strictEqual(calc.roundRatioHalfAway(1, 2), 1);
assert.strictEqual(calc.roundRatioHalfAway(-1, 2), -1);
assert.strictEqual(calc.roundRatioHalfAway(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), 1);

const telemetry = calc.calculatedTelemetry(movingAvgFull);
assert.deepStrictEqual(telemetry, {
  schema: 'PRH_ANALYTICS_CALCULATED_METRICS_V1',
  version: '1.0.0',
  operator: 'MOVING_AVERAGE',
  measure_id: 'EXPENSE',
  source_kind: 'PERIOD_RESULT',
  window: 2,
  top_n: null,
  input_count: 4,
  output_count: 4,
  decision: 'ALLOW',
  reason: 'OK',
  financial_truth_policy: 'FIN-TRUTH-v1',
  semantic_registry_version: '1.0.0',
  period_engine_version: '1.0.0'
});
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['amount_minor', 'source_value_minor', 'reference_value_minor', 'category_id', 'acct-main', 'food', 'rent']) {
  assert.strictEqual(telemetryText.includes(forbidden), false, forbidden);
}

console.log('calculated_metrics_contract_test: OK', {
  schema: calc.SCHEMA,
  operators: calc.OPERATORS.length,
  ratioScale: calc.RATIO_SCALE,
  shareReconciles: true,
  topNOtherReconciles: true,
  deterministicTieBreak: true,
  zeroReferenceExplicit: true,
  groupedMissingAsZero: true,
  arbitraryFormulaSurface: false,
  financialTruthAuthority: false
});
