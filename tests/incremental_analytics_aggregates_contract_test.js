'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  CONTRACT,
  PROJECTIONS,
  MEASURES,
  assertContract,
  validateState,
  buildIncrementalAggregates,
  updateIncrementalAggregates
} = require('../lib/analytics/incremental_aggregates');
const { evaluateAnalytics } = require('../lib/analytics/analytics_engine');
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function canonical(id, overrides = {}) {
  const base = {
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: id,
    occurred_at: '2026-01-10T10:00:00Z',
    type: 'expense',
    status: 'posted',
    amount_minor: 1000,
    currency: 'RUB',
    account_id: 'ACC-A',
    destination_account_id: null,
    category_id: 'CAT-FOOD',
    member_id: 'MEMBER-A',
    project_id: null,
    tags: ['synthetic'],
    counterparty: null,
    description: 'Synthetic PERF-013 fixture',
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'perf013-incremental',
      source_record_id: id,
      source_fingerprint: sha256(`perf013:${id}:${JSON.stringify(overrides)}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYNTHETIC-PERF013-v1',
      source_position: null
    }
  };
  return normalizeCanonicalTransaction({ ...base, ...overrides, provenance: { ...base.provenance, ...(overrides.provenance || {}) } });
}

function analyticsQuery(projection) {
  return {
    schema: 'PRH_ANALYTICS_QUERY_V1',
    contract_version: '1.0.0',
    currency: 'RUB',
    measures: MEASURES.slice(),
    dimensions: projection === 'CATEGORY_ID' ? ['category_id'] : projection === 'ACCOUNT_ID' ? ['account_id'] : [],
    filters: [],
    time_range: projection === 'MONTH' ? { start: '2026-01-01', end: '2026-05-01' } : null,
    grain: projection === 'MONTH' ? 'MONTH' : 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 500
  };
}

function analyticsKey(projection, row) {
  if (projection === 'MONTH') return row.dimensions.time_bucket;
  if (projection === 'CATEGORY_ID') return row.dimensions.category_id;
  return row.dimensions.account_id;
}

function assertProjectionParity(state, canonicalSet) {
  for (const projection of PROJECTIONS) {
    const baseline = evaluateAnalytics(canonicalSet, analyticsQuery(projection));
    const expected = baseline.rows.map((row) => ({ key: analyticsKey(projection, row), measures: row.measures }))
      .sort((a, b) => a.key.localeCompare(b.key));
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(state.projections[projection])),
      JSON.parse(JSON.stringify(expected)),
      `${projection} incremental projection must exactly match ANL-010 full recompute`
    );
  }
}

assert.strictEqual(assertContract(), true);
assert.strictEqual(CONTRACT.schema, 'PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'PERF-013');
assert.deepStrictEqual(CONTRACT.projections, ['MONTH', 'CATEGORY_ID', 'ACCOUNT_ID']);
assert.strictEqual(CONTRACT.delta.recompute_scope, 'AFFECTED_PROJECTION_BUCKETS_ONLY');
assert.strictEqual(CONTRACT.evidence.financial_payload_allowed, false);
assert.strictEqual(CONTRACT.authority.financial_write, false);
assert.strictEqual(CONTRACT.authority.paid_dependency_required, false);

const initial = [
  canonical('SYN-AGG-001', { type: 'income', amount_minor: 100000, category_id: 'CAT-SALARY', account_id: 'ACC-A' }),
  canonical('SYN-AGG-002', { occurred_at: '2026-01-12T10:00:00Z', amount_minor: 12000, category_id: 'CAT-FOOD', account_id: 'ACC-A' }),
  canonical('SYN-AGG-003', { occurred_at: '2026-01-14T10:00:00Z', type: 'refund', amount_minor: 2000, category_id: 'CAT-FOOD', account_id: 'ACC-A', adjustment_semantics: 'expense_reduction' }),
  canonical('SYN-AGG-004', { occurred_at: '2026-02-02T10:00:00Z', type: 'transfer', amount_minor: 15000, category_id: 'CAT-TRANSFER', account_id: 'ACC-A', destination_account_id: 'ACC-B' }),
  canonical('SYN-AGG-005', { occurred_at: '2026-02-05T10:00:00Z', status: 'pending', amount_minor: 3000, category_id: 'CAT-HOME', account_id: 'ACC-B' }),
  canonical('SYN-AGG-006', { occurred_at: '2026-03-01T10:00:00Z', amount_minor: 4500, category_id: 'CAT-HOME', account_id: 'ACC-B' })
];

const built = buildIncrementalAggregates(initial, { currency: 'RUB' });
assert.strictEqual(built.evidence.operation, 'FULL_BUILD');
assert.strictEqual(built.evidence.status, 'PASS');
assert.strictEqual(built.evidence.added_count, initial.length);
assert.strictEqual(validateState(built.state), built.state);
assertProjectionParity(built.state, initial);

// Identical canonical revision is a deterministic NOOP.
const noop = updateIncrementalAggregates(built.state, initial.slice().reverse(), {
  expected_base_revision: built.state.canonical_revision,
  currency: 'RUB'
});
assert.strictEqual(noop.evidence.status, 'NOOP');
assert.strictEqual(noop.evidence.added_count, 0);
assert.strictEqual(noop.evidence.removed_count, 0);
assert.strictEqual(noop.evidence.changed_count, 0);
assert.strictEqual(noop.evidence.recomputed_bucket_count, 0);
assert.deepStrictEqual(noop.state, built.state);

// Delta includes add/remove/change, dimension/month move and posted/pending semantic change.
const next = initial
  .filter((tx) => tx.transaction_id !== 'SYN-AGG-006')
  .map((tx) => {
    if (tx.transaction_id === 'SYN-AGG-002') {
      return canonical('SYN-AGG-002', {
        occurred_at: '2026-02-12T10:00:00Z',
        amount_minor: 14000,
        category_id: 'CAT-HOME',
        account_id: 'ACC-B'
      });
    }
    if (tx.transaction_id === 'SYN-AGG-005') {
      return canonical('SYN-AGG-005', {
        occurred_at: '2026-02-05T10:00:00Z',
        status: 'posted',
        amount_minor: 3000,
        category_id: 'CAT-HOME',
        account_id: 'ACC-B'
      });
    }
    return tx;
  })
  .concat([canonical('SYN-AGG-007', { occurred_at: '2026-04-03T10:00:00Z', type: 'income', amount_minor: 25000, category_id: 'CAT-BONUS', account_id: 'ACC-B' })]);

const updated = updateIncrementalAggregates(built.state, next, {
  expected_base_revision: built.state.canonical_revision,
  currency: 'RUB'
});
assert.strictEqual(updated.evidence.status, 'PASS');
assert.strictEqual(updated.evidence.added_count, 1);
assert.strictEqual(updated.evidence.removed_count, 1);
assert.strictEqual(updated.evidence.changed_count, 2);
assert(updated.evidence.affected_bucket_count > 0);
assert.strictEqual(updated.evidence.recomputed_bucket_count, updated.evidence.affected_bucket_count);
assert.notStrictEqual(updated.state.canonical_revision, built.state.canonical_revision);
assertProjectionParity(updated.state, next);

// Incremental result must equal a fresh full build byte-for-byte for financial projections and revision.
const rebuilt = buildIncrementalAggregates(next, { currency: 'RUB' });
assert.deepStrictEqual(updated.state.projections, rebuilt.state.projections);
assert.strictEqual(updated.state.canonical_revision, rebuilt.state.canonical_revision);
assert.deepStrictEqual(updated.state.membership_index, rebuilt.state.membership_index);
assert.strictEqual(updated.state.state_hash, rebuilt.state.state_hash);

// Tampered aggregate contents cannot become a trusted incremental base.
const tampered = JSON.parse(JSON.stringify(updated.state));
tampered.projections.MONTH[0].measures.EXPENSE += 1;
assert.throws(
  () => updateIncrementalAggregates(tampered, next, { expected_base_revision: updated.state.canonical_revision, currency: 'RUB' }),
  /INCREMENTAL_AGGREGATES_STATE_HASH_MISMATCH/
);

// Wrong expected base revision fails closed before accepting a delta.
assert.throws(
  () => updateIncrementalAggregates(updated.state, next, { expected_base_revision: sha256('wrong-base'), currency: 'RUB' }),
  /INCREMENTAL_AGGREGATES_BASE_REVISION_MISMATCH/
);

// Mixed currency remains fail-closed until the explicit FX layer.
const mixed = next.concat([canonical('SYN-AGG-USD', { currency: 'USD', category_id: 'CAT-USD', account_id: 'ACC-USD' })]);
assert.throws(() => buildIncrementalAggregates(mixed), /INCREMENTAL_AGGREGATES_CURRENCY_REQUIRED|INCREMENTAL_AGGREGATES_MIXED_CURRENCY_UNSUPPORTED/);
assert.throws(() => buildIncrementalAggregates(mixed, { currency: 'RUB' }), /INCREMENTAL_AGGREGATES_MIXED_CURRENCY_UNSUPPORTED/);

// Evidence is technical only: no financial values, raw identities or bucket labels.
const evidenceJson = JSON.stringify(updated.evidence);
for (const forbidden of ['SYN-AGG-', 'CAT-', 'ACC-', 'amount_minor', 'INCOME', 'EXPENSE', '100000', '14000']) {
  assert(!evidenceJson.includes(forbidden), `aggregate evidence leaked financial/identity data: ${forbidden}`);
}
assert(/^[0-9a-f]{12}$/.test(updated.evidence.base_revision_hash_prefix));
assert(/^[0-9a-f]{12}$/.test(updated.evidence.result_revision_hash_prefix));

console.log('incremental_analytics_aggregates_contract_test: OK', {
  contract: 'PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1@1.0.0',
  projections: PROJECTIONS,
  measures: MEASURES,
  fullBuildParity: true,
  analyticsParity: true,
  deltaClasses: ['ADDED', 'REMOVED', 'CHANGED'],
  affectedBucketsOnly: true,
  noop: true,
  tamperFailClosed: true,
  mixedCurrencyFailClosed: true,
  financialWriteAuthority: false,
  evidenceFinancialPayload: false,
  externalProviderRequired: false,
  freeOnly: true
});
