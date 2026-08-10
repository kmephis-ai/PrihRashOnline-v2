'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');
const PERIOD = require('../lib/analytics/period_engine');
const TREND = require('../lib/analytics/long_term_trends');

function hash(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function tx(index, date, type, amountMinor, overrides = {}) {
  return normalizeCanonicalTransaction({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: `TREND-TX-${String(index).padStart(3, '0')}`,
    occurred_at: `${date}T12:00:00Z`,
    type,
    status: 'posted',
    amount_minor: amountMinor,
    currency: 'USD',
    account_id: overrides.account_id || 'acct-synthetic-main',
    destination_account_id: type === 'transfer' ? 'acct-synthetic-second' : null,
    category_id: overrides.category_id || (type === 'income' ? 'income-synthetic' : type === 'transfer' ? 'transfer-synthetic' : 'expense-synthetic'),
    member_id: overrides.member_id || null,
    project_id: null,
    tags: ['synthetic-trend'],
    counterparty: null,
    description: null,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'fixture:trend-030',
      source_record_id: `TREND-REC-${index}`,
      source_fingerprint: hash(`trend:${index}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'TREND-030-SYNTHETIC-v1',
      source_position: null
    }
  });
}

function query(trend, overrides = {}) {
  return {
    schema: TREND.QUERY_SCHEMA,
    contract_version: TREND.VERSION,
    currency: 'USD',
    measures: ['INCOME', 'EXPENSE', 'CASH_FLOW'],
    dimension: null,
    filters: [],
    sort: [],
    parameters: {},
    limit: 500,
    trend,
    ...overrides
  };
}

const fixture = [
  tx(1, '2024-02-10', 'income', 5000),
  tx(2, '2024-02-20', 'expense', 1200),
  tx(3, '2024-06-01', 'income', 4200),
  tx(4, '2024-12-20', 'expense', 900),
  tx(5, '2025-01-15', 'income', 5100),
  tx(6, '2025-03-03', 'expense', 1400),
  tx(7, '2025-07-08', 'income', 4600),
  tx(8, '2025-12-22', 'expense', 1100),
  tx(9, '2026-01-05', 'income', 5300, { member_id: 'member-synthetic-a' }),
  tx(10, '2026-02-07', 'expense', 1500, { member_id: 'member-synthetic-a' }),
  tx(11, '2026-03-01', 'transfer', 700),
  tx(12, '2026-06-10', 'income', 4800, { member_id: 'member-synthetic-b' })
];

assert.strictEqual(TREND.assertContract(), true);
assert.strictEqual(TREND.CONTRACT.schema, 'PRH_LONG_TERM_TRENDS_V1');
assert.strictEqual(TREND.CONTRACT.version, '1.0.0');
assert.strictEqual(TREND.CONTRACT.orchestration.kpi_formula_redefinition, false);
assert.strictEqual(TREND.CONTRACT.orchestration.calculated_metric_operators, false);
assert.strictEqual(TREND.CONTRACT.orchestration.window_metric_operators, false);
assert.strictEqual(TREND.CONTRACT.orchestration.forecasting, false);
assert.strictEqual(TREND.CONTRACT.orchestration.benchmarking, false);
assert.strictEqual(TREND.CONTRACT.free_only, true);
assert.ok(Object.values(TREND.CONTRACT.authorities).every((value) => value === false));
assert(!TREND.CONTRACT.allowed.measures.includes('BUDGET_VARIANCE'));

const rolling = query({ selector: { kind: 'ROLLING_365', as_of: '2026-06-30' }, grain: 'MONTH', comparison_mode: 'YEAR_OVER_YEAR' });
const normalized = TREND.normalizeTrendQuery(rolling);
assert.strictEqual(normalized.trend.primary.day_count, 365);
assert.strictEqual(normalized.trend.grain, 'MONTH');
assert.strictEqual(normalized.trend.comparison_mode, 'YEAR_OVER_YEAR');
assert.deepStrictEqual(normalized.measures, ['INCOME', 'EXPENSE', 'CASH_FLOW']);
assert.strictEqual(normalized.dimension, null);

const rollingResult = TREND.evaluateLongTermTrend(fixture, rolling);
const periodResult = PERIOD.evaluatePeriodSeries(fixture, TREND.buildPeriodQuery(normalized));
assert.deepStrictEqual(rollingResult.primary_buckets, periodResult.primary_buckets);
assert.deepStrictEqual(rollingResult.comparison_buckets, periodResult.comparison_buckets);
assert.deepStrictEqual(rollingResult.primary_range, periodResult.primary_range);
assert.deepStrictEqual(rollingResult.comparison, periodResult.comparison);
assert.strictEqual(rollingResult.provenance.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(rollingResult.provenance.formula_layer_added, false);
assert.strictEqual(rollingResult.provenance.period_result_passthrough, true);
assert(rollingResult.primary_buckets.every((bucket) => bucket.analytics_result.grain === 'NONE'));

const explicitPartial = TREND.evaluateLongTermTrend(fixture, query({
  selector: { kind: 'EXPLICIT_RANGE', start: '2025-01-15', end: '2026-03-11' },
  grain: 'MONTH',
  comparison_mode: 'YEAR_OVER_YEAR'
}));
assert.strictEqual(explicitPartial.primary_buckets[0].partial, true);
assert.strictEqual(explicitPartial.primary_buckets[explicitPartial.primary_buckets.length - 1].partial, true);
assert.strictEqual(explicitPartial.comparison.mode, 'YEAR_OVER_YEAR');
assert.ok(['CALENDAR_ALIGNED', 'CALENDAR_ALIGNED_DAY_COUNT_DIFF'].includes(explicitPartial.comparison.quality));

const leap = TREND.evaluateLongTermTrend(fixture, query({
  selector: { kind: 'EXPLICIT_RANGE', start: '2024-02-01', end: '2024-03-01' },
  grain: 'MONTH',
  comparison_mode: 'YEAR_OVER_YEAR'
}));
assert.strictEqual(leap.primary_range.day_count, 29);
assert.strictEqual(leap.comparison.day_count, 28);
assert.strictEqual(leap.comparison.quality, 'CALENDAR_ALIGNED_DAY_COUNT_DIFF');

const ytd = TREND.evaluateLongTermTrend(fixture, query({ selector: { kind: 'YTD', as_of: '2026-06-10' }, grain: 'QUARTER', comparison_mode: 'YEAR_OVER_YEAR' }));
assert.strictEqual(ytd.primary_range.partial, true);
assert.strictEqual(ytd.primary_buckets[0].key, 'QUARTER:2026-01-01');
assert.strictEqual(ytd.primary_buckets[ytd.primary_buckets.length - 1].partial, true);

const segmentedInput = query(
  { selector: { kind: 'ROLLING_90', as_of: '2026-06-30' }, grain: 'MONTH', comparison_mode: 'NONE' },
  { dimension: 'member_id', measures: ['INCOME'], filters: [{ field: 'member_id', operator: 'IN', values: ['member-synthetic-a', 'member-synthetic-b'] }] }
);
const segmented = TREND.evaluateLongTermTrend(fixture, segmentedInput);
assert.strictEqual(segmented.dimension_id, 'member_id');
assert.strictEqual(segmented.filter_count, 1);
assert.strictEqual(segmented.comparison, null);

const serialized = TREND.serializeTrendDefinition(segmentedInput);
assert(serialized.includes('ROLLING_90'));
assert(serialized.includes('member_id'));
assert(serialized.includes('"filter_count":1'));
assert(!serialized.includes('member-synthetic-a'));
assert(!serialized.includes('member-synthetic-b'));
for (const forbidden of ['amount_minor', 'transaction_id', 'account_id":"acct-', 'description', 'counterparty']) {
  assert.strictEqual(serialized.includes(forbidden), false, forbidden);
}

const telemetry = TREND.trendTelemetry(segmented);
assert.strictEqual(telemetry.schema, 'PRH_LONG_TERM_TREND_TELEMETRY_V1');
assert.strictEqual(telemetry.measure_count, 1);
assert.strictEqual(telemetry.dimension_count, 1);
assert.strictEqual(telemetry.filter_count, 1);
assert.strictEqual(telemetry.comparison_quality, 'NONE');
const telemetryText = JSON.stringify(telemetry);
assert(!telemetryText.includes('member-synthetic-a'));
assert(!telemetryText.includes('income_minor'));
assert(!telemetryText.includes('expense_minor'));

assert.throws(() => TREND.normalizeTrendQuery(query({ selector: { kind: 'ROLLING_30', as_of: '2026-06-30' }, grain: 'MONTH', comparison_mode: 'NONE' })), (error) => error.code === 'TREND_SELECTOR_KIND_INVALID');
assert.throws(() => TREND.normalizeTrendQuery(query({ selector: { kind: 'ROLLING_365', as_of: '2026-06-30' }, grain: 'WEEK', comparison_mode: 'NONE' })), (error) => error.code === 'TREND_GRAIN_INVALID');
assert.throws(() => TREND.normalizeTrendQuery(query({ selector: { kind: 'ROLLING_365', as_of: '2026-06-30' }, grain: 'MONTH', comparison_mode: 'PREVIOUS_COMPARABLE_PERIOD' })), (error) => error.code === 'TREND_COMPARISON_INVALID');
assert.throws(() => TREND.normalizeTrendQuery(query({ selector: { kind: 'ROLLING_365', as_of: '2026-06-30' }, grain: 'MONTH', comparison_mode: 'NONE' }, { measures: ['BUDGET_VARIANCE'] })), (error) => error.code === 'TREND_MEASURES_INVALID');
assert.throws(() => TREND.normalizeTrendQuery(query({ selector: { kind: 'ROLLING_365', as_of: '2026-06-30' }, grain: 'MONTH', comparison_mode: 'NONE' }, { dimension: 'status' })), (error) => error.code === 'TREND_DIMENSION_INVALID');
assert.throws(() => TREND.normalizeTrendQuery(query({ selector: { kind: 'ROLLING_365', as_of: '2026-06-30' }, grain: 'MONTH', comparison_mode: 'NONE' }, { measures: ['INCOME', 'INCOME'] })), (error) => error.code === 'TREND_MEASURES_INVALID');

console.log('long-term-trends-contract: PASS', {
  schema: TREND.CONTRACT.schema,
  version: TREND.CONTRACT.version,
  rollingDays: normalized.trend.primary.day_count,
  primaryBuckets: rollingResult.primary_buckets.length,
  comparisonBuckets: rollingResult.comparison_buckets.length,
  partialRangeTested: true,
  leapComparisonQuality: leap.comparison.quality,
  periodParity: true,
  formulaLayerAdded: false,
  financialWrite: TREND.CONTRACT.authorities.financial_write,
  freeOnly: TREND.CONTRACT.free_only
});
