'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  QUERY_SCHEMA,
  normalizeAnalyticsQuery,
  evaluateAnalytics
} = require('../lib/analytics/analytics_engine');

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function transaction(index, category, amount, occurredAt) {
  return {
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: `anl-edge-${index}`,
    occurred_at: occurredAt,
    type: 'expense',
    status: 'posted',
    amount_minor: amount,
    currency: 'RUB',
    account_id: 'acc-edge',
    destination_account_id: null,
    category_id: category,
    member_id: null,
    project_id: null,
    tags: ['synthetic-edge'],
    counterparty: null,
    description: `Synthetic edge ${index}`,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC_TEST',
      source_container: 'analytics-edge',
      source_record_id: `edge-${index}`,
      source_fingerprint: fingerprint(`edge:${index}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYN-ANL-010-edge-v1',
      source_position: null
    }
  };
}

function query(overrides = {}) {
  return {
    schema: QUERY_SCHEMA,
    contract_version: '1.0.0',
    currency: 'RUB',
    measures: ['EXPENSE'],
    dimensions: [],
    filters: [],
    time_range: { start: '2026-01-01', end: '2026-03-01' },
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 5000,
    ...overrides
  };
}

assert.throws(() => normalizeAnalyticsQuery(query({
  grain: 'MONTH',
  comparison: { mode: 'PREVIOUS_PERIOD' }
})), /ANALYTICS_COMPARISON_GRAIN_UNSUPPORTED/,
'v1 must fail closed instead of ambiguously aligning previous-period time buckets');

assert.throws(() => normalizeAnalyticsQuery(query({
  sort: [{ kind: 'DIMENSION', key: 'time_bucket', direction: 'ASC' }]
})), /ANALYTICS_SORT_DIMENSION_NOT_SELECTED/,
'time_bucket sort must require an active time grain');

const grained = normalizeAnalyticsQuery(query({
  grain: 'MONTH',
  sort: [{ kind: 'DIMENSION', key: 'time_bucket', direction: 'ASC' }]
}));
assert.strictEqual(grained.grain, 'MONTH');
assert.strictEqual(grained.sort[0].key, 'time_bucket');

const fixture = [
  transaction(1, 'cat-b', 30, '2026-01-10T09:00:00Z'),
  transaction(2, 'cat-a', 20, '2026-01-11T09:00:00Z'),
  transaction(3, 'cat-c', 10, '2026-01-12T09:00:00Z')
];
const groupedQuery = query({
  dimensions: ['category_id'],
  sort: [{ kind: 'MEASURE', key: 'EXPENSE', direction: 'DESC' }],
  limit: 1
});
const limited = evaluateAnalytics(fixture, groupedQuery);
assert.strictEqual(limited.total_rows, 3);
assert.strictEqual(limited.rows.length, 1);
assert.strictEqual(limited.truncated, true);
assert.strictEqual(limited.rows[0].dimensions.category_id, 'cat-b');

const forward = evaluateAnalytics(fixture, query());
const reversed = evaluateAnalytics(fixture.slice().reverse(), query());
assert.deepStrictEqual(reversed, forward,
  'analytics result and canonical input revision must be deterministic under input ordering');

// R9 feature contracts execute under the existing PURE_DOMAIN_APPLICATION
// analytics edge authority instead of weakening TEST-010 classification rules.
require('./analytics_contribution_decomposition_contract');
require('./analytics_seasonality_distribution_concentration_contract');

console.log('analytics_query_edge_contract_test: OK', {
  comparisonWithGrain: 'FAIL_CLOSED',
  timeBucketSortWithoutGrain: 'FAIL_CLOSED',
  boundedResultTruncation: true,
  inputOrderDeterministic: true,
  contributionDecomposition: 'PASS',
  seasonalityDistributionConcentration: 'PASS',
  financialWriteAuthority: false
});
