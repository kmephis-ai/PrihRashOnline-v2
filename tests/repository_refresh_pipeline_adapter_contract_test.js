'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  CONTRACT,
  assertContract,
  createSingleScanRefresh
} = require('../lib/repository/single_scan_refresh');
const {
  applyQuery,
  createFakeTransactionRepository
} = require('../lib/repository/transaction_repository');
const {
  evaluateAnalytics
} = require('../lib/analytics/analytics_engine');
const {
  normalizeCanonicalTransaction
} = require('../lib/domain/canonical_transaction');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function canonical(id, overrides = {}) {
  return normalizeCanonicalTransaction({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: id,
    occurred_at: '2026-03-01T10:00:00Z',
    type: 'expense',
    status: 'posted',
    amount_minor: 1000,
    currency: 'RUB',
    account_id: 'ACC-MAIN',
    destination_account_id: null,
    category_id: 'CAT-FOOD',
    member_id: 'MEMBER-A',
    project_id: null,
    tags: ['home'],
    counterparty: null,
    description: 'Synthetic PERF-012 fixture',
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'perf012-single-scan',
      source_record_id: id,
      source_fingerprint: sha256(`perf012:${id}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYNTHETIC-PERF012-v1',
      source_position: null
    },
    ...overrides
  });
}

assert.strictEqual(assertContract(), true);
assert.strictEqual(CONTRACT.schema, 'PRH_SINGLE_SCAN_REFRESH_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'PERF-012');
assert.strictEqual(CONTRACT.snapshot.source, 'READ_ALL_ONCE_PER_CYCLE');
assert.strictEqual(CONTRACT.snapshot.cross_cycle_reuse, false);
assert.strictEqual(CONTRACT.execution.canonical_snapshot_reads_per_cycle, 1);
assert.strictEqual(CONTRACT.execution.underlying_get_revision_calls, 0);
assert.strictEqual(CONTRACT.execution.underlying_get_by_id_calls, 0);
assert.strictEqual(CONTRACT.execution.underlying_query_calls, 0);
assert.strictEqual(CONTRACT.telemetry.financial_payload_allowed, false);
assert.strictEqual(CONTRACT.authority.financial_write, false);
assert.strictEqual(CONTRACT.authority.paid_dependency_required, false);

const seed = [
  canonical('SYN-REFRESH-001', { type: 'income', amount_minor: 50000, category_id: 'CAT-SALARY', tags: ['salary'] }),
  canonical('SYN-REFRESH-002', { occurred_at: '2026-03-02T10:00:00Z', amount_minor: 2500, tags: ['food', 'home'] }),
  canonical('SYN-REFRESH-003', { occurred_at: '2026-03-03T10:00:00Z', status: 'pending', amount_minor: 900 })
];
const base = createFakeTransactionRepository(seed, { synthetic_write_authority: true });
const calls = { revision: 0, readAll: 0, getById: 0, query: 0 };
const counted = {
  schema: base.schema,
  capabilities: base.capabilities,
  getRevision: () => { calls.revision += 1; return base.getRevision(); },
  readAll: () => { calls.readAll += 1; return base.readAll(); },
  getById: (id) => { calls.getById += 1; return base.getById(id); },
  query: (query) => { calls.query += 1; return base.query(query); }
};
let now = 100000;
const cycle = createSingleScanRefresh(counted, {
  max_age_ms: 1000,
  max_operations: 16,
  now_ms: () => now
});
assert.strictEqual(cycle.schema, 'PRH_SINGLE_SCAN_REFRESH_CYCLE_V1');
assert.strictEqual(cycle.capabilities.single_scan, true);
assert.strictEqual(cycle.capabilities.write, false);
assert(/^[0-9a-f]{64}$/.test(cycle.getRevision()));
assert.deepStrictEqual(calls, { revision: 0, readAll: 1, getById: 0, query: 0 },
  'cycle start must perform exactly one canonical snapshot read and no secondary repository reads');

const all = cycle.readAll();
assert.strictEqual(all.length, 3);
const byId = cycle.getById('SYN-REFRESH-002');
assert.strictEqual(byId.transaction_id, 'SYN-REFRESH-002');
const queryInput = { statuses: ['posted'], types: ['expense', 'income'], limit: 10 };
const queried = cycle.query(queryInput);
assert.deepStrictEqual(queried, JSON.parse(JSON.stringify(applyQuery(seed, queryInput))));

const analyticsQuery = {
  schema: 'PRH_ANALYTICS_QUERY_V1',
  contract_version: '1.0.0',
  currency: 'RUB',
  measures: ['INCOME', 'EXPENSE', 'CASH_FLOW'],
  dimensions: ['category_id'],
  filters: [],
  time_range: { start: '2026-03-01', end: '2026-04-01' },
  grain: 'NONE',
  comparison: { mode: 'NONE' },
  sort: [],
  parameters: {},
  limit: 50
};
const analytics = cycle.analytics(analyticsQuery);
const analyticsBaseline = evaluateAnalytics(seed, analyticsQuery);
assert.deepStrictEqual(analytics, JSON.parse(JSON.stringify(analyticsBaseline)));
assert.strictEqual(analytics.provenance.input_revision, cycle.getRevision());
assert.deepStrictEqual(calls, { revision: 0, readAll: 1, getById: 0, query: 0 },
  'multiple logical consumers must reuse the same snapshot without repository get/query/revision calls');

const telemetry = cycle.getTelemetry();
assert.strictEqual(telemetry.canonical_snapshot_read_count, 1);
assert.strictEqual(telemetry.logical_operation_count, 4);
assert.strictEqual(telemetry.snapshot_reuse_count, 3);
assert.strictEqual(telemetry.read_all_count, 1);
assert.strictEqual(telemetry.get_by_id_count, 1);
assert.strictEqual(telemetry.query_count, 1);
assert.strictEqual(telemetry.analytics_count, 1);
assert(/^[0-9a-f]{64}$/.test(telemetry.cycle_hash));
assert(/^[0-9a-f]{12}$/.test(telemetry.revision_token_hash_prefix));

// A cycle is a bounded point-in-time snapshot. An underlying mutation cannot partially alter its results.
const revisionBeforeMutation = cycle.getRevision();
const receipt = base.writeBatch({
  idempotency_key: 'PERF012-SYNTHETIC-WRITE-0001',
  expected_revision: base.getRevision(),
  operations: [{ action: 'PUT', transaction: canonical('SYN-REFRESH-004', { amount_minor: 700 }) }]
});
assert.strictEqual(receipt.status, 'PASS');
assert.strictEqual(cycle.readAll().length, 3, 'active cycle must remain internally consistent after external mutation');
assert.strictEqual(cycle.getRevision(), revisionBeforeMutation);
assert.strictEqual(calls.readAll, 1);

// Every new refresh cycle materializes a new canonical snapshot and therefore observes the new revision.
now += 1;
const nextCycle = createSingleScanRefresh(counted, {
  max_age_ms: 1000,
  max_operations: 16,
  now_ms: () => now
});
assert.strictEqual(calls.readAll, 2);
assert.strictEqual(nextCycle.readAll().length, 4);
assert.notStrictEqual(nextCycle.getRevision(), revisionBeforeMutation);
assert.deepStrictEqual(calls, { revision: 0, readAll: 2, getById: 0, query: 0 });

// Explicit invalidation is fail-closed and cannot silently reopen the same snapshot.
assert.strictEqual(cycle.invalidate(), true);
assert.throws(() => cycle.query({ limit: 10 }), /SINGLE_SCAN_REFRESH_INVALIDATED/);
assert.strictEqual(cycle.getTelemetry().snapshot_status, 'INVALIDATED');
assert.strictEqual(cycle.getTelemetry().invalidation_count, 1);

// Max age is deterministic and stale cycle access fails closed.
let expiryNow = 200000;
const expiryCycle = createSingleScanRefresh(counted, {
  max_age_ms: 20,
  max_operations: 8,
  now_ms: () => expiryNow
});
expiryNow += 20;
assert.throws(() => expiryCycle.readAll(), /SINGLE_SCAN_REFRESH_EXPIRED/);
assert.strictEqual(expiryCycle.getTelemetry().snapshot_status, 'EXPIRED');

// Operation budget prevents an unbounded long-lived refresh context.
let boundedNow = 300000;
const boundedCycle = createSingleScanRefresh(counted, {
  max_age_ms: 1000,
  max_operations: 2,
  now_ms: () => boundedNow
});
boundedCycle.readAll();
boundedCycle.query({ limit: 10 });
assert.throws(() => boundedCycle.getById('SYN-REFRESH-001'), /SINGLE_SCAN_REFRESH_OPERATION_BUDGET_EXHAUSTED/);
assert.strictEqual(boundedCycle.getTelemetry().snapshot_status, 'EXHAUSTED');

// Refresh coordinator never inherits write authority.
const blockedWrite = nextCycle.writeBatch({ any: 'not inspected' });
assert.strictEqual(blockedWrite.status, 'BLOCKED');
assert.strictEqual(blockedWrite.reason_code, 'SINGLE_SCAN_REFRESH_WRITE_NOT_AUTHORIZED');

// Public telemetry is bounded technical metadata only.
const telemetryJson = JSON.stringify(nextCycle.getTelemetry());
for (const forbidden of [
  'SYN-REFRESH-', 'amount_minor', 'CAT-', 'ACC-', 'MEMBER-', 'Synthetic PERF-012 fixture',
  'transaction_id', 'tags', 'salary', 'food', 'PRH_ANALYTICS_QUERY_V1'
]) {
  assert(!telemetryJson.includes(forbidden), `single-scan telemetry leaked payload/query/identity: ${forbidden}`);
}

console.log('repository_refresh_pipeline_adapter_contract_test: OK', {
  contract: 'PRH_SINGLE_SCAN_REFRESH_V1@1.0.0',
  canonicalSnapshotReadsPerCycle: 1,
  underlyingRevisionCalls: 0,
  underlyingQueryCalls: 0,
  underlyingGetByIdCalls: 0,
  repositoryQueryParity: true,
  analyticsParity: true,
  pointInTimeSnapshot: true,
  newCycleReadsNewRevision: true,
  boundedLifetime: true,
  boundedOperations: true,
  financialWriteAuthority: false,
  telemetryFinancialPayload: false,
  externalProviderRequired: false,
  freeOnly: true
});
