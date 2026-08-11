'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ANL = require('../lib/analytics/contribution_decomposition');
const ANALYTICS = require('../lib/analytics/analytics_engine');
const VIZ090 = require('../lib/visualization/advanced_visualization_pack');

ANL.assertContract();
assert.strictEqual(ANL.SCHEMA, 'PRH_CONTRIBUTION_DECOMPOSITION_V1');
assert.strictEqual(ANL.VERSION, '1.0.0');
assert.strictEqual(ANL.CONTRACT.roadmap_id, 'ANL-090');
assert.strictEqual(ANL.CONTRACT.principles.additive_only, true);
assert.strictEqual(ANL.CONTRACT.principles.causality_claimed, false);
assert.strictEqual(ANL.CONTRACT.principles.financial_write_allowed, false);
assert(Object.values(ANL.CONTRACT.authorities).every((value) => value === false));

function expectCode(fn, code) {
  assert.throws(fn, (error) => error && error.code === code, `expected ${code}`);
}

function discoverTimeRange(start, end) {
  const candidates = [
    { start_date: start, end_date: end },
    { start, end },
    { from: start, to: end },
    { from_date: start, to_date: end },
    { start_inclusive: start, end_exclusive: end }
  ];
  for (const timeRange of candidates) {
    try {
      ANALYTICS.normalizeAnalyticsQuery({
        schema: ANALYTICS.QUERY_SCHEMA,
        contract_version: ANALYTICS.CONTRACT_VERSION,
        currency: 'RUB',
        measures: ['EXPENSE'],
        dimensions: ['category_id'],
        filters: [],
        time_range: timeRange,
        grain: 'NONE',
        comparison: { mode: 'NONE' },
        sort: [],
        parameters: {},
        limit: 5000
      });
      return timeRange;
    } catch (_) {}
  }
  throw new Error('No accepted explicit AnalyticsQuery time_range shape found');
}

function query(start, end, measure = 'EXPENSE', dimension = 'category_id', overrides = {}) {
  return {
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: 'RUB',
    measures: [measure],
    dimensions: [dimension],
    filters: [],
    time_range: discoverTimeRange(start, end),
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 5000,
    ...overrides
  };
}

function request(measure = 'EXPENSE', dimension = 'category_id', overrides = {}) {
  return {
    schema: ANL.REQUEST_SCHEMA,
    contract_version: ANL.VERSION,
    measure,
    dimension,
    current_query: query('2026-02-01', '2026-03-01', measure, dimension),
    reference_query: query('2026-01-01', '2026-01-29', measure, dimension),
    ...overrides
  };
}

function aggregate(rawQuery, rows, total, sourceContract = 'PRH_ANALYTICS_RESULT_V1@1.0.0') {
  const normalized = ANALYTICS.normalizeAnalyticsQuery(rawQuery);
  return {
    schema: ANL.AGGREGATE_SCHEMA,
    contract_version: ANL.VERSION,
    query_hash: ANALYTICS.analyticsQueryHash(normalized),
    source_contract: sourceContract,
    total,
    rows
  };
}

function scenario(measure = 'EXPENSE', dimension = 'category_id') {
  const req = request(measure, dimension);
  const currentRows = [
    { driver_id: 'food', value: 700 },
    { driver_id: 'home', value: 250 },
    { driver_id: 'new-driver', value: 150 },
    { driver_id: 'unchanged', value: 50 }
  ];
  const referenceRows = [
    { driver_id: 'food', value: 500 },
    { driver_id: 'home', value: 400 },
    { driver_id: 'removed-driver', value: 100 },
    { driver_id: 'unchanged', value: 50 }
  ];
  return {
    req,
    current: aggregate(req.current_query, currentRows, 1150),
    reference: aggregate(req.reference_query, referenceRows, 1050)
  };
}

const base = scenario();
const decomposition = ANL.decompose(base.req, base.current, base.reference);
assert.strictEqual(decomposition.result.schema, ANL.RESULT_SCHEMA);
assert.strictEqual(decomposition.result.current_total, 1150);
assert.strictEqual(decomposition.result.reference_total, 1050);
assert.strictEqual(decomposition.result.total_delta, 100);
assert.strictEqual(decomposition.result.driver_count, 5);
assert.strictEqual(decomposition.result.changed_count, 4);
assert.strictEqual(decomposition.result.arithmetic, 'CURRENT_MINUS_REFERENCE');
assert.strictEqual(decomposition.result.missing_driver_policy, 'EXPLICIT_ZERO_FOR_DECOMPOSITION_ONLY');
assert.strictEqual(decomposition.result.causality_claimed, false);
assert.strictEqual(decomposition.result.financial_truth_policy, 'FIN-TRUTH-v1');
assert.match(decomposition.result.result_hash, /^[0-9a-f]{64}$/);

const byId = new Map(decomposition.result.rows.map((row) => [row.driver_id, row]));
assert.strictEqual(byId.get('food').delta, 200);
assert.strictEqual(byId.get('food').state, 'INCREASE');
assert.strictEqual(byId.get('home').delta, -150);
assert.strictEqual(byId.get('home').state, 'DECREASE');
assert.strictEqual(byId.get('new-driver').delta, 150);
assert.strictEqual(byId.get('new-driver').state, 'NEW');
assert.strictEqual(byId.get('new-driver').reference_present, false);
assert.strictEqual(byId.get('removed-driver').delta, -100);
assert.strictEqual(byId.get('removed-driver').state, 'REMOVED');
assert.strictEqual(byId.get('removed-driver').current_present, false);
assert.strictEqual(byId.get('unchanged').delta, 0);
assert.strictEqual(byId.get('unchanged').state, 'UNCHANGED');
assert.strictEqual(decomposition.result.rows.reduce((sum, row) => sum + row.delta, 0), 100);
assert.strictEqual(decomposition.result.rows.reduce((sum, row) => sum + row.absolute_delta, 0), 600);
assert.deepStrictEqual(decomposition.result.rows.map((row) => row.driver_id), ['food', 'home', 'new-driver', 'removed-driver', 'unchanged']);
assert.deepStrictEqual(decomposition.result.rows.map((row) => row.rank), [1, 2, 3, 4, 5]);

// Evidence is exact current/reference read-only query context + driver filter, with no financial value in navigation metadata.
for (const row of decomposition.result.rows) {
  assert.strictEqual(row.evidence.schema, ANL.EVIDENCE_SCHEMA);
  assert.strictEqual(row.evidence.mode, 'READ_ONLY');
  assert.strictEqual(row.evidence.driver_dimension, 'category_id');
  assert.strictEqual(row.evidence.driver_id, row.driver_id);
  assert.strictEqual(row.evidence.financial_values_in_navigation, false);
  assert.strictEqual(row.evidence.financial_write, false);
  assert(row.evidence.current_query.filters.some((filter) => filter.field === 'category_id' && filter.values.includes(row.driver_id)));
  assert(row.evidence.reference_query.filters.some((filter) => filter.field === 'category_id' && filter.values.includes(row.driver_id)));
  assert.strictEqual(row.evidence.current_query_hash, ANALYTICS.analyticsQueryHash(row.evidence.current_query));
  assert.strictEqual(row.evidence.reference_query_hash, ANALYTICS.analyticsQueryHash(row.evidence.reference_query));
}

// VIZ-090 receives explicit START/DELTA/END and independently verifies exact conservation.
const waterfallSource = ANL.toWaterfallSource(decomposition);
assert.strictEqual(waterfallSource.schema, VIZ090.SOURCE_SCHEMA);
assert.strictEqual(waterfallSource.shape, 'WATERFALL');
assert.strictEqual(waterfallSource.source_contract, `${ANL.SCHEMA}@${ANL.VERSION}`);
assert.strictEqual(waterfallSource.query_hash, decomposition.request.current_query_hash);
assert.strictEqual(waterfallSource.data.rows[0].kind, 'START');
assert.strictEqual(waterfallSource.data.rows[0].value, 1050);
assert.strictEqual(waterfallSource.data.rows[waterfallSource.data.rows.length - 1].kind, 'END');
assert.strictEqual(waterfallSource.data.rows[waterfallSource.data.rows.length - 1].value, 1150);
const waterfallPlan = VIZ090.planAdvancedVisualization({
  schema: VIZ090.SPEC_SCHEMA,
  contract_version: VIZ090.VERSION,
  id: 'contribution-waterfall',
  type: 'WATERFALL',
  title: 'Синтетическая декомпозиция',
  interactions: { filter: true, drill: true }
}, waterfallSource, base.req.current_query, { viewport_width_px: 1440, assistive_mode: false, renderer: 'ECHARTS_6' });
assert.strictEqual(waterfallPlan.query_modified, false);
assert.strictEqual(waterfallPlan.normalized_source.data.start, 1050);
assert.strictEqual(waterfallPlan.normalized_source.data.end, 1150);

// Core additive measures have the same arithmetic semantics; expense delta is not silently inverted.
for (const measure of ['INCOME', 'EXPENSE', 'CASH_FLOW']) {
  const s = scenario(measure);
  const d = ANL.decompose(s.req, s.current, s.reference);
  assert.strictEqual(d.result.measure, measure);
  assert.strictEqual(d.result.total_delta, 100);
  assert.strictEqual(d.result.rows.find((row) => row.driver_id === 'food').delta, 200);
}

// Supported driver dimensions are registry-backed and exact.
for (const dimension of ANL.CONTRACT.supported_dimensions) {
  const req = request('EXPENSE', dimension);
  const cur = aggregate(req.current_query, [{ driver_id: 'd1', value: 10 }], 10);
  const ref = aggregate(req.reference_query, [{ driver_id: 'd1', value: 7 }], 7);
  const d = ANL.decompose(req, cur, ref);
  assert.strictEqual(d.result.dimension, dimension);
  assert.strictEqual(d.result.total_delta, 3);
}

// Zero net delta keeps exact offsets and makes net contribution percentage explicitly undefined.
const zeroReq = request('EXPENSE', 'category_id');
const zeroCur = aggregate(zeroReq.current_query, [{ driver_id: 'a', value: 150 }, { driver_id: 'b', value: 50 }], 200);
const zeroRef = aggregate(zeroReq.reference_query, [{ driver_id: 'a', value: 100 }, { driver_id: 'b', value: 100 }], 200);
const zero = ANL.decompose(zeroReq, zeroCur, zeroRef);
assert.strictEqual(zero.result.total_delta, 0);
assert.strictEqual(zero.result.changed_count, 2);
assert(zero.result.rows.every((row) => row.net_contribution_bps === null && row.zero_total_delta === true));
assert.strictEqual(zero.result.rows.reduce((sum, row) => sum + row.delta, 0), 0);
assert.doesNotThrow(() => VIZ090.planAdvancedVisualization({
  schema: VIZ090.SPEC_SCHEMA,
  contract_version: VIZ090.VERSION,
  id: 'zero-waterfall', type: 'WATERFALL', title: 'Нулевое изменение', interactions: { filter: true, drill: true }
}, ANL.toWaterfallSource(zero), zeroReq.current_query, { viewport_width_px: 390, assistive_mode: true, renderer: 'ECHARTS_6' }));

// Empty zero periods are valid; missing driver != imputed canonical fact.
const emptyReq = request('INCOME', 'category_id');
const empty = ANL.decompose(emptyReq, aggregate(emptyReq.current_query, [], 0), aggregate(emptyReq.reference_query, [], 0));
assert.strictEqual(empty.result.driver_count, 0);
assert.strictEqual(empty.result.total_delta, 0);
assert.strictEqual(empty.result.absolute_change_total, 0);

// Equivalent row/object ordering yields identical request/result/waterfall identity.
const reordered = ANL.decompose(
  { dimension: base.req.dimension, reference_query: base.req.reference_query, schema: base.req.schema, current_query: base.req.current_query, measure: base.req.measure, contract_version: base.req.contract_version },
  { ...base.current, rows: base.current.rows.slice().reverse() },
  { ...base.reference, rows: base.reference.rows.slice().reverse() }
);
assert.strictEqual(reordered.request.request_hash, decomposition.request.request_hash);
assert.strictEqual(reordered.result.result_hash, decomposition.result.result_hash);
assert.strictEqual(ANL.stableStringify(ANL.toWaterfallSource(reordered)), ANL.stableStringify(waterfallSource));

// Context and period compatibility fail closed.
const contextReq = request();
contextReq.reference_query = query('2026-01-01', '2026-01-29', 'EXPENSE', 'category_id', { currency: 'USD' });
expectCode(() => ANL.normalizeRequest(contextReq), 'ANL090_QUERY_CONTEXT_MISMATCH');
const unequalReq = request();
unequalReq.reference_query = query('2026-01-01', '2026-01-20', 'EXPENSE', 'category_id');
expectCode(() => ANL.normalizeRequest(unequalReq), 'ANL090_PERIOD_NOT_COMPARABLE');
const driverFilteredReq = request();
driverFilteredReq.current_query = query('2026-02-01', '2026-03-01', 'EXPENSE', 'category_id', {
  filters: [{ field: 'category_id', operator: 'IN', values: ['food'] }]
});
expectCode(() => ANL.normalizeRequest(driverFilteredReq), 'ANL090_DRIVER_FILTER_ALREADY_PRESENT');
expectCode(() => ANL.normalizeRequest(request('EXPENSE', 'merchant_id')), 'ANL090_DIMENSION_UNSUPPORTED');

// Aggregate integrity and exact query provenance are mandatory.
expectCode(() => ANL.decompose(base.req, { ...base.current, total: 999 }, base.reference), 'ANL090_PERIOD_TOTAL_RECONCILIATION_FAILED');
expectCode(() => ANL.decompose(base.req, { ...base.current, query_hash: '0'.repeat(64) }, base.reference), 'ANL090_AGGREGATE_QUERY_HASH_MISMATCH');
expectCode(() => ANL.decompose(base.req, { ...base.current, rows: [...base.current.rows, base.current.rows[0]] }, base.reference), 'ANL090_DRIVER_DUPLICATE');
expectCode(() => ANL.decompose(base.req, { ...base.current, source_contract: 'PRH_A@1.0.0' }, base.reference), 'ANL090_AGGREGATE_PROVENANCE_MISMATCH');
expectCode(() => ANL.normalizeAggregate({ ...base.current, total: Number.MAX_SAFE_INTEGER + 1 }, ANALYTICS.analyticsQueryHash(ANALYTICS.normalizeAnalyticsQuery(base.req.current_query))), 'ANL090_TOTAL_INVALID');

// Telemetry is fixed-shape and contains no financial values/private driver IDs.
const telemetry = ANL.telemetry(decomposition);
assert.deepStrictEqual(Object.keys(telemetry).sort(), ANL.CONTRACT.telemetry_allowlist.slice().sort());
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['food', 'home', 'new-driver', 'removed-driver', '1150', '1050']) {
  assert(!telemetryText.includes(forbidden), `telemetry leak: ${forbidden}`);
}

// Pure ANL-090 has no financial-write/storage/network/renderer execution authority.
const sourceText = fs.readFileSync(path.join(__dirname, '..', 'lib/analytics/contribution_decomposition.js'), 'utf8');
for (const forbidden of ["require('../finance", 'SpreadsheetApp', 'PropertiesService', 'UrlFetchApp', 'setProperties(', 'appendRow(', 'fetch(']) {
  assert(!sourceText.includes(forbidden), `ANL-090 gained forbidden authority: ${forbidden}`);
}

console.log('contribution_decomposition_contract_test: OK', {
  contract: `${ANL.SCHEMA}@${ANL.VERSION}`,
  drivers: decomposition.result.driver_count,
  changed: decomposition.result.changed_count,
  totalDelta: decomposition.result.total_delta,
  waterfallValidatedByVIZ090: true,
  causalityClaimed: false,
  financialWrite: false
});
