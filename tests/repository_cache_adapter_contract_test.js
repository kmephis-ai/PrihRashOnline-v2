'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  CONTRACT,
  assertContract,
  stableStringify,
  operationIdentityHash,
  cacheKeyHash,
  createRevisionAwareReadCache
} = require('../lib/repository/revision_aware_cache');
const {
  createFakeTransactionRepository
} = require('../lib/repository/transaction_repository');
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
    description: 'Synthetic cache fixture',
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'perf011-cache',
      source_record_id: id,
      source_fingerprint: sha256(`perf011:${id}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYNTHETIC-PERF011-v1',
      source_position: null
    },
    ...overrides
  });
}

assert.strictEqual(assertContract(), true);
assert.strictEqual(CONTRACT.schema, 'PRH_REVISION_AWARE_READ_CACHE_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'PERF-011');
assert.strictEqual(CONTRACT.freshness.revision_required_before_hit, true);
assert.strictEqual(CONTRACT.freshness.unknown_revision, 'FAIL_CLOSED');
assert.strictEqual(CONTRACT.freshness.revision_change, 'INVALIDATE_ALL');
assert.strictEqual(CONTRACT.telemetry.financial_payload_allowed, false);
assert.strictEqual(CONTRACT.authority.financial_write, false);
assert.strictEqual(CONTRACT.authority.network, false);
assert.strictEqual(CONTRACT.authority.paid_dependency_required, false);

assert.strictEqual(stableStringify({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');
const queryHashA = operationIdentityHash('QUERY', { types: ['expense', 'income'], statuses: ['posted'] });
const queryHashB = operationIdentityHash('QUERY', { statuses: ['posted'], types: ['income', 'expense'] });
assert.strictEqual(queryHashA, queryHashB, 'normalized semantically identical query must share cache identity');
const revisionA = sha256('revision-a');
const revisionB = sha256('revision-b');
assert.notStrictEqual(
  cacheKeyHash('PRH_TRANSACTION_REPOSITORY_V1', revisionA, 'READ_ALL', null),
  cacheKeyHash('PRH_TRANSACTION_REPOSITORY_V1', revisionB, 'READ_ALL', null),
  'revision must participate in cache key'
);

const seed = [
  canonical('SYN-CACHE-001', { type: 'income', amount_minor: 50000, category_id: 'CAT-SALARY', tags: ['salary'] }),
  canonical('SYN-CACHE-002', { occurred_at: '2026-03-02T10:00:00Z', amount_minor: 2500, tags: ['food', 'home'] }),
  canonical('SYN-CACHE-003', { occurred_at: '2026-03-03T10:00:00Z', status: 'pending', amount_minor: 900 })
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
const cache = createRevisionAwareReadCache(counted, {
  ttl_ms: 1000,
  max_entries: 2,
  now_ms: () => now
});
assert.strictEqual(cache.schema, 'PRH_TRANSACTION_REPOSITORY_READ_CACHE_V1');
assert.strictEqual(cache.capabilities.write, false);
assert.strictEqual(cache.capabilities.cache, true);

// First read is MISS, exact same revision/key becomes HIT. Revision probe is mandatory on both calls.
const firstAll = cache.readAll();
assert.strictEqual(firstAll.length, 3);
assert.deepStrictEqual(calls, { revision: 1, readAll: 1, getById: 0, query: 0 });
assert.strictEqual(cache.getTelemetry().cache_status, 'MISS');
assert.strictEqual(cache.getTelemetry().reason_code, 'CACHE_KEY_ABSENT');
now += 100;
const secondAll = cache.readAll();
assert.deepStrictEqual(secondAll, firstAll);
assert.deepStrictEqual(calls, { revision: 2, readAll: 1, getById: 0, query: 0 });
assert.strictEqual(cache.getTelemetry().cache_status, 'HIT');
assert.strictEqual(cache.getTelemetry().reason_code, 'EXACT_REVISION_KEY_MATCH');
assert.strictEqual(cache.getTelemetry().age_ms, 100);

// Query object key order/list order normalization does not create a second semantic cache key.
now += 10;
const q1 = cache.query({ types: ['expense', 'income'], statuses: ['posted'], limit: 10 });
assert.strictEqual(q1.total_count, 2);
assert.strictEqual(calls.query, 1);
now += 10;
const q2 = cache.query({ statuses: ['posted'], limit: 10, types: ['income', 'expense'] });
assert.deepStrictEqual(q2, q1);
assert.strictEqual(calls.query, 1, 'normalized equivalent query must HIT');
assert.strictEqual(cache.getTelemetry().cache_status, 'HIT');

// LRU bound: touch READ_ALL, add GET_BY_ID, then QUERY must evict least recently used entry.
now += 10;
cache.readAll();
now += 10;
const tx = cache.getById('SYN-CACHE-002');
assert.strictEqual(tx.transaction_id, 'SYN-CACHE-002');
assert.strictEqual(cache.getEntryCount(), 2);
assert(cache.getTelemetry().eviction_count >= 1, 'bounded LRU must evict over max_entries');

// TTL expiry is MISS and reload, never stale HIT.
const getCallsBeforeExpiry = calls.getById;
now += 1001;
cache.getById('SYN-CACHE-002');
assert.strictEqual(calls.getById, getCallsBeforeExpiry + 1);
assert.strictEqual(cache.getTelemetry().cache_status, 'MISS');
assert.strictEqual(cache.getTelemetry().reason_code, 'TTL_EXPIRED');

// External/synthetic underlying mutation changes revision; old cache is invalidated before any HIT.
const beforeMutationRevision = base.getRevision();
const writeReceipt = base.writeBatch({
  idempotency_key: 'PERF011-SYNTHETIC-WRITE-0001',
  expected_revision: beforeMutationRevision,
  operations: [{ action: 'PUT', transaction: canonical('SYN-CACHE-004', { amount_minor: 700 }) }]
});
assert.strictEqual(writeReceipt.status, 'PASS');
const invalidationsBefore = cache.getTelemetry().invalidation_count;
now += 1;
const afterMutation = cache.readAll();
assert.strictEqual(afterMutation.length, 4);
assert.strictEqual(cache.getTelemetry().cache_status, 'MISS');
assert.strictEqual(cache.getTelemetry().reason_code, 'REVISION_CHANGED');
assert(cache.getTelemetry().invalidation_count > invalidationsBefore);

// Cache layer itself never grants write authority, even when synthetic wrapped repository is writable.
const blockedWrite = cache.writeBatch({ any: 'not inspected' });
assert.strictEqual(blockedWrite.status, 'BLOCKED');
assert.strictEqual(blockedWrite.reason_code, 'REVISION_CACHE_WRITE_NOT_AUTHORIZED');
assert.strictEqual(base.readAll().length, 4);

// Explicit invalidation empties cache and has bounded technical telemetry only.
assert.strictEqual(cache.invalidate(), true);
assert.strictEqual(cache.getEntryCount(), 0);
assert.strictEqual(cache.getTelemetry().cache_status, 'EMPTY');
assert.strictEqual(cache.getTelemetry().reason_code, 'EXPLICIT_INVALIDATION');

// Unknown/non-exact revision fails closed and cannot return cached data.
let badReadCount = 0;
const badRevisionRepo = {
  schema: 'PRH_TRANSACTION_REPOSITORY_V1',
  getRevision: () => 'unknown',
  readAll: () => { badReadCount += 1; return []; },
  getById: () => null,
  query: () => ({ schema: 'PRH_REPOSITORY_QUERY_RESULT_V1', total_count: 0, offset: 0, limit: 100, has_more: false, items: [] })
};
const failClosed = createRevisionAwareReadCache(badRevisionRepo, { now_ms: () => 1 });
assert.throws(() => failClosed.readAll(), /REVISION_CACHE_REVISION_UNKNOWN/);
assert.strictEqual(badReadCount, 0, 'loader must not run without exact revision');
assert.strictEqual(failClosed.getTelemetry().reason_code, 'REVISION_UNKNOWN');

// Telemetry contains only technical bounded metadata and never raw identity/query/finance payload.
now += 1;
cache.readAll();
const telemetryJson = JSON.stringify(cache.getTelemetry());
for (const forbidden of ['SYN-CACHE-', 'amount_minor', 'CAT-', 'ACC-', 'Synthetic cache fixture', 'transaction_id', 'tags']) {
  assert(!telemetryJson.includes(forbidden), `cache telemetry leaked payload/identity: ${forbidden}`);
}
assert(/^[0-9a-f]{64}$/.test(cache.getTelemetry().cache_key_hash));
assert(/^[0-9a-f]{12}$/.test(cache.getTelemetry().revision_token_hash_prefix));

console.log('repository_cache_adapter_contract_test: OK', {
  contract: 'PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0',
  revisionProbeBeforeHit: true,
  normalizedQueryIdentity: true,
  revisionChangeInvalidation: true,
  ttlMiss: true,
  boundedLru: true,
  cacheWriteAuthority: false,
  telemetryFinancialPayload: false,
  externalProviderRequired: false,
  freeOnly: true
});
