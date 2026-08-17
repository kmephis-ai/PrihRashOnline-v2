'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ANALYTICS = require('../lib/analytics/analytics_engine');
const ANL = require('../lib/analytics/seasonality_distribution_concentration');

ANL.assertContract();
assert.strictEqual(ANL.SCHEMA, 'PRH_SEASONALITY_DISTRIBUTION_CONCENTRATION_V1');
assert.strictEqual(ANL.VERSION, '1.0.0');
assert.strictEqual(ANL.CONTRACT.roadmap_id, 'ANL-091');
assert(Object.values(ANL.CONTRACT.authorities).every((value) => value === false));

function expectCode(fn, code) {
  assert.throws(fn, (error) => error && error.code === code, `expected ${code}`);
}

function query(overrides = {}) {
  return {
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: 'RUB',
    measures: ['EXPENSE'],
    dimensions: ['category_id'],
    filters: [],
    time_range: { start: '2026-01-01', end: '2026-01-11' },
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 5000,
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    schema: ANL.REQUEST_SCHEMA,
    contract_version: ANL.VERSION,
    measure: 'EXPENSE',
    dimension: 'category_id',
    query: query(),
    timezone: 'Europe/Moscow',
    ...overrides
  };
}

function dataset(req, overrides = {}) {
  const normalized = ANALYTICS.normalizeAnalyticsQuery(req.query);
  return {
    schema: ANL.DATASET_SCHEMA,
    contract_version: ANL.VERSION,
    query_hash: ANALYTICS.analyticsQueryHash(normalized),
    source_contract: 'PRH_ANALYTICS_RESULT_V1@1.0.0',
    observed_days: [
      '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05',
      '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10'
    ],
    rows: [
      { date: '2026-01-01', driver_id: 'food', value: 40 },
      { date: '2026-01-01', driver_id: 'home', value: 10 },
      { date: '2026-01-02', driver_id: 'food', value: 20 },
      { date: '2026-01-03', driver_id: 'transport', value: 10 },
      { date: '2026-01-04', driver_id: 'food', value: 30 },
      { date: '2026-01-05', driver_id: 'home', value: 30 },
      { date: '2026-01-06', driver_id: 'food', value: 10 },
      { date: '2026-01-07', driver_id: 'transport', value: 20 },
      { date: '2026-01-08', driver_id: 'food', value: 20 },
      { date: '2026-01-10', driver_id: 'home', value: 10 }
    ],
    ...overrides
  };
}

const req = request();
const input = dataset(req);
const analysis = ANL.analyze(req, input);
assert.strictEqual(analysis.result.schema, ANL.RESULT_SCHEMA);
assert.strictEqual(analysis.result.period_days, 10);
assert.strictEqual(analysis.result.observed_day_count, 10);
assert.strictEqual(analysis.result.missing_day_count, 0);
assert.strictEqual(analysis.result.coverage_status, 'COMPLETE');
assert.strictEqual(analysis.result.daily_distribution.count, 10);
assert.strictEqual(analysis.result.daily_distribution.zero_count, 1, 'observed day without rows is an explicit zero');
assert.strictEqual(analysis.result.daily_distribution.percentiles.p50, 20);
assert.strictEqual(analysis.result.driver_distribution.count, 3);
assert.strictEqual(analysis.result.concentration.status, 'AVAILABLE');
assert.strictEqual(analysis.result.concentration.total, 200);
assert.strictEqual(analysis.result.concentration.driver_count, 3);
assert.strictEqual(analysis.result.concentration.rows.reduce((sum, row) => sum + row.value, 0), 200);
assert.strictEqual(analysis.result.concentration.rows[0].driver_id, 'food');
assert.strictEqual(analysis.result.concentration.rows[0].value, 120);
assert.strictEqual(analysis.result.concentration.top1_bps, 6000);
assert.strictEqual(analysis.result.concentration.pareto80_driver_count, 2);
assert(analysis.result.concentration.hhi_10000 > 0 && analysis.result.concentration.hhi_10000 <= 10000);
assert.strictEqual(analysis.result.financial_write, false);
assert.match(analysis.result.result_hash, /^[0-9a-f]{64}$/);

const weekdayCount = analysis.result.seasonality.weekday.reduce((sum, row) => sum + row.observed_day_count, 0);
const monthCount = analysis.result.seasonality.month_of_year.reduce((sum, row) => sum + row.observed_day_count, 0);
const dayCount = analysis.result.seasonality.day_of_month.reduce((sum, row) => sum + row.observed_day_count, 0);
assert.strictEqual(weekdayCount, 10);
assert.strictEqual(monthCount, 10);
assert.strictEqual(dayCount, 10);
assert.strictEqual(analysis.result.seasonality.weekday.length, 7);
assert.strictEqual(analysis.result.seasonality.month_of_year.length, 12);
assert.strictEqual(analysis.result.seasonality.day_of_month.length, 31);

for (const row of analysis.result.concentration.rows) {
  assert.strictEqual(row.drill.schema, ANL.DRILL_SCHEMA);
  assert.strictEqual(row.drill.mode, 'READ_ONLY');
  assert.strictEqual(row.drill.financial_values_in_navigation, false);
  assert.strictEqual(row.drill.financial_write, false);
  assert.strictEqual(row.drill.source_query_hash, analysis.request.query_hash);
  assert(row.drill.query.filters.some((filter) => filter.field === 'category_id' && filter.values.includes(row.driver_id)));
}

const partialInput = dataset(req, { observed_days: input.observed_days.filter((day) => day !== '2026-01-08'), rows: input.rows.filter((row) => row.date !== '2026-01-08') });
const partial = ANL.analyze(req, partialInput);
assert.strictEqual(partial.result.coverage_status, 'PARTIAL');
assert.strictEqual(partial.result.missing_day_count, 1);
assert.deepStrictEqual(partial.result.missing_days, ['2026-01-08']);
assert.strictEqual(partial.result.daily_distribution.count, 9);

const cashReq = request({ measure: 'CASH_FLOW', query: query({ measures: ['CASH_FLOW'] }) });
const negative = ANL.analyze(cashReq, dataset(cashReq, {
  rows: [
    { date: '2026-01-01', driver_id: 'a', value: 100 },
    { date: '2026-01-02', driver_id: 'b', value: -50 }
  ]
}));
assert.strictEqual(negative.result.driver_distribution.negative_count, 1);
assert.strictEqual(negative.result.concentration.status, 'NOT_APPLICABLE');
assert.strictEqual(negative.result.concentration.reason, 'NEGATIVE_DRIVER_VALUE');

const reordered = ANL.analyze(req, { ...input, rows: input.rows.slice().reverse(), observed_days: input.observed_days.slice().reverse() });
assert.strictEqual(reordered.dataset.dataset_hash, analysis.dataset.dataset_hash);
assert.strictEqual(reordered.result.result_hash, analysis.result.result_hash);

expectCode(() => ANL.analyze(req, { ...input, query_hash: '0'.repeat(64) }), 'ANL091_DATASET_QUERY_HASH_MISMATCH');
expectCode(() => ANL.analyze(req, { ...input, observed_days: [...input.observed_days, input.observed_days[0]] }), 'ANL091_OBSERVED_DAY_DUPLICATE');
expectCode(() => ANL.analyze(req, { ...input, rows: [...input.rows, input.rows[0]] }), 'ANL091_ROW_DUPLICATE');
expectCode(() => ANL.analyze(req, { ...input, observed_days: input.observed_days.filter((day) => day !== '2026-01-01') }), 'ANL091_ROW_DAY_NOT_OBSERVED');
expectCode(() => ANL.normalizeRequest(request({ timezone: 'UTC' })), 'ANL091_TIMEZONE_INVALID');
expectCode(() => ANL.normalizeRequest(request({ dimension: 'merchant_id' })), 'ANL091_DIMENSION_UNSUPPORTED');
const filteredReq = request();
filteredReq.query = query({ filters: [{ field: 'category_id', operator: 'IN', values: ['food'] }] });
expectCode(() => ANL.normalizeRequest(filteredReq), 'ANL091_DIMENSION_FILTER_ALREADY_PRESENT');

const telemetry = ANL.telemetry(analysis);
assert.deepStrictEqual(Object.keys(telemetry).sort(), ANL.CONTRACT.telemetry_allowlist.slice().sort());
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['food', 'home', 'transport', '120', '200']) assert(!telemetryText.includes(forbidden), `telemetry leak: ${forbidden}`);

const sourceText = fs.readFileSync(path.join(__dirname, '..', 'lib/analytics/seasonality_distribution_concentration.js'), 'utf8');
for (const forbidden of ["require('../finance", 'SpreadsheetApp', 'PropertiesService', 'UrlFetchApp', 'appendRow(', 'setProperties(', 'fetch(', 'window.', 'document.']) {
  assert(!sourceText.includes(forbidden), `ANL-091 gained forbidden authority: ${forbidden}`);
}

console.log('analytics_seasonality_distribution_concentration_contract: OK', {
  contract: `${ANL.SCHEMA}@${ANL.VERSION}`,
  coverage: analysis.result.coverage_status,
  observedDays: analysis.result.observed_day_count,
  drivers: analysis.result.concentration.driver_count,
  concentration: analysis.result.concentration.status,
  financialWrite: false
});
