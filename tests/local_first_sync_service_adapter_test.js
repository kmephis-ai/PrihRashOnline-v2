'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/local_first/local_first_sync.v1.json'), 'utf8'));
const serviceSource = fs.readFileSync(path.join(ROOT, 'LocalFirstSyncService.js'), 'utf8');
const syncClient = require('../pwa/local_first_sync');

assert.strictEqual(contract.schema, 'PRH_LOCAL_FIRST_SYNC_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.roadmap_id, 'SYNC-LF-001');
assert.strictEqual(contract.transport.warm_path_required, false);
assert.strictEqual(contract.revision_binding.same_revision, 'NOOP');
assert.strictEqual(contract.revision_binding.full_bootstrap_generation_id, 'EQUALS_CANONICAL_REVISION');
assert.strictEqual(contract.authorities.canonical_financial_write, false);
assert.strictEqual(contract.authorities.network_on_warm_interaction, false);
assert.strictEqual(contract.client_semantics.delta_support, false);
assert.strictEqual(contract.client_semantics.delta_roadmap_id, 'DELTA-LF-001');
assert.ok(contract.invariants.includes('PARTIAL_OR_ERROR_CANNOT_REPLACE_ACTIVE'));
assert.ok(contract.invariants.includes('VERIFIED_LOCAL_READABLE_DURING_NETWORK_FAILURE'));

assert.ok(serviceSource.includes('prhR2DataCreateSnapshot_()'), 'Apps Script sync must reuse canonical R2 snapshot path');
assert.ok(!serviceSource.includes('prhGoogleRepositoryReadOperationsTable_('), 'sync service must not create a second raw Google mapping path');
assert.ok(!/\.setValue\s*\(|\.setValues\s*\(|\.appendRow\s*\(|\.deleteRow\s*\(/.test(serviceSource), 'sync service must not mutate Google canonical data');
assert.ok(serviceSource.includes('financial_write_authorized: false'));
assert.ok(serviceSource.includes('canonical_mutation_performed: false'));
assert.ok(serviceSource.includes('prhLocalFirstSyncHealthToken'));
assert.ok(serviceSource.includes('prhLocalFirstSyncAssertWireRoundTrip_'));
assert.ok(serviceSource.includes('prhLocalFirstSyncBootstrapWire'), 'browser RPC must cross Apps Script as scalar JSON wire');

const CANONICAL_KEYS = [
  'schema', 'schema_version', 'transaction_id', 'occurred_at', 'type', 'status',
  'amount_minor', 'currency', 'account_id', 'destination_account_id', 'category_id',
  'member_id', 'project_id', 'tags', 'counterparty', 'description',
  'reverses_transaction_id', 'adjustment_semantics', 'provenance'
].sort();
const PROVENANCE_KEYS = [
  'source_system', 'source_container', 'source_record_id', 'source_fingerprint',
  'identity_strategy', 'transform_version', 'source_position'
].sort();

const REV_A = 'a'.repeat(64);
let snapshotCalls = 0;
const transactions = Object.freeze([
  Object.freeze({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: 'tx-1',
    occurred_at: '2026-01-10T10:00:00Z',
    type: 'expense',
    status: 'posted',
    amount_minor: 12345,
    currency: 'RUB',
    account_id: 'account:1',
    destination_account_id: null,
    category_id: 'category:1',
    member_id: 'member:1',
    project_id: 'project:1',
    tags: Object.freeze(['home']),
    counterparty: null,
    description: 'Synthetic sync expense',
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: Object.freeze({
      source_system: 'SYNTHETIC',
      source_container: 'fixture:local_first_sync',
      source_record_id: 'sync-fixture-1',
      source_fingerprint: '1'.repeat(64),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYNTHETIC-v1',
      source_position: null
    })
  }),
  Object.freeze({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: 'tx-2',
    occurred_at: '2026-01-11T10:00:00Z',
    type: 'income',
    status: 'posted',
    amount_minor: 50000,
    currency: 'RUB',
    account_id: 'account:2',
    destination_account_id: null,
    category_id: 'category:2',
    member_id: null,
    project_id: null,
    tags: Object.freeze([]),
    counterparty: null,
    description: 'Synthetic sync income',
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: Object.freeze({
      source_system: 'SYNTHETIC',
      source_container: 'fixture:local_first_sync',
      source_record_id: 'sync-fixture-2',
      source_fingerprint: '2'.repeat(64),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYNTHETIC-v1',
      source_position: null
    })
  })
]);
const labels = {
  'account|account:1': 'Основной счёт',
  'account|account:2': 'Второй счёт',
  'category|category:1': 'Продукты',
  'category|category:2': 'Доход',
  'member|member:1': 'Член семьи',
  'project|project:1': 'Дом'
};

const context = {
  console,
  prhR2DataCreateSnapshot_: () => {
    snapshotCalls += 1;
    return Object.freeze({
      transactions,
      revision: REV_A,
      dimensions: Object.freeze({
        displayLabel: (kind, id) => labels[`${kind}|${id}`] || (() => { throw new Error('LABEL_MISSING'); })()
      })
    });
  }
};
vm.createContext(context);
vm.runInContext(serviceSource, context, { filename: 'LocalFirstSyncService.js' });

const full = context.prhLocalFirstSyncBootstrap({});
assert.strictEqual(snapshotCalls, 1);
assert.strictEqual(full.schema, 'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1');
assert.strictEqual(full.version, '1.0.0');
assert.strictEqual(full.state, 'FULL_BOOTSTRAP');
assert.strictEqual(full.revision, REV_A);
assert.strictEqual(full.generation_id, REV_A);
assert.strictEqual(full.transactions.length, 2);
assert.strictEqual(full.dimensions.length, 6);
assert.strictEqual(full.aggregates.length, 0);
assert.strictEqual(full.sync_journal.length, 1);
assert.deepStrictEqual(JSON.parse(JSON.stringify(full.expected_counts)), {
  transactions: 2,
  dimensions: 6,
  aggregates: 0,
  sync_journal: 1
});
assert.strictEqual(full.financial_write_authorized, false);
assert.strictEqual(full.canonical_mutation_performed, false);
assert.ok(Number.isInteger(full.serialized_chars) && full.serialized_chars > 0);
assert.deepStrictEqual(full.dimensions.map((row) => row.dimension_key), full.dimensions.map((row) => row.dimension_key).slice().sort());
for (const tx of full.transactions) {
  assert.deepStrictEqual(Object.keys(tx).sort(), CANONICAL_KEYS, 'transport must preserve exact canonical top-level keys');
  assert.deepStrictEqual(Object.keys(tx.provenance).sort(), PROVENANCE_KEYS, 'transport must preserve exact provenance keys');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(tx, 'destination_account_id'), true,
    'nullable destination_account_id must survive Apps Script/JSON transport shape');
}
assert.strictEqual(full.transactions[0].destination_account_id, null);
assert.strictEqual(full.transactions[1].destination_account_id, null);

const fullWire = context.prhLocalFirstSyncBootstrapWire({});
assert.strictEqual(snapshotCalls, 2);
assert.strictEqual(typeof fullWire, 'string');
assert.ok(fullWire.includes('"destination_account_id":null'), 'nullable key must exist in scalar JSON wire bytes');
const fullFromWire = JSON.parse(fullWire);
assert.deepStrictEqual(Object.keys(fullFromWire.transactions[0]).sort(), CANONICAL_KEYS);
assert.strictEqual(fullFromWire.transactions[0].destination_account_id, null);

const healthToken = context.prhLocalFirstSyncHealthToken();
assert.strictEqual(snapshotCalls, 3);
assert.strictEqual(healthToken, 'PRH_LOCAL_FIRST_SYNC_HEALTH_V1|EXACT_WIRE|DIMENSIONS|OK');

const noop = context.prhLocalFirstSyncBootstrap({ local_revision: REV_A });
assert.strictEqual(snapshotCalls, 4);
assert.strictEqual(noop.state, 'NOOP');
assert.strictEqual(noop.revision, REV_A);
assert.strictEqual(noop.generation_id, REV_A);
assert.strictEqual(noop.transactions, undefined);
assert.strictEqual(noop.financial_write_authorized, false);
assert.strictEqual(noop.canonical_mutation_performed, false);

assert.throws(
  () => context.prhLocalFirstSyncBootstrap({ local_revision: 'bad' }),
  /LOCAL_FIRST_SYNC_LOCAL_REVISION_INVALID/
);
assert.throws(
  () => context.prhLocalFirstSyncBootstrap({ local_revision: '', unknown: true }),
  /LOCAL_FIRST_SYNC_REQUEST_FIELD_UNKNOWN/
);

assert.strictEqual(syncClient.schema, 'PRH_LOCAL_FIRST_SYNC_V1');
assert.strictEqual(syncClient.version, '1.0.0');
const parsedWire = syncClient.parseWireEnvelope(fullWire);
assert.strictEqual(parsedWire.transactions[0].destination_account_id, null);
const validated = syncClient.validateRemoteEnvelope(parsedWire, null);
assert.strictEqual(validated.state, 'FULL_BOOTSTRAP');
assert.strictEqual(validated.generation_id, REV_A);
const validatedNoop = syncClient.validateRemoteEnvelope(JSON.parse(JSON.stringify(noop)), REV_A);
assert.strictEqual(validatedNoop.state, 'NOOP');
assert.throws(
  () => syncClient.validateRemoteEnvelope(Object.assign({}, JSON.parse(JSON.stringify(full)), { financial_write_authorized: true }), null),
  /LOCAL_FIRST_SYNC_WRITE_AUTHORITY_VIOLATION/
);
assert.throws(
  () => syncClient.validateRemoteEnvelope(Object.assign({}, JSON.parse(JSON.stringify(full)), { generation_id: 'b'.repeat(64) }), null),
  /LOCAL_FIRST_SYNC_GENERATION_REVISION_MISMATCH/
);
const malformedFull = JSON.parse(JSON.stringify(full));
delete malformedFull.transactions[0].destination_account_id;
assert.throws(
  () => syncClient.validateRemoteEnvelope(malformedFull, null),
  /LOCAL_FIRST_SYNC_WIRE_TRANSACTION_SHAPE_INVALID/
);
assert.throws(
  () => syncClient.parseWireEnvelope('{not-json'),
  /LOCAL_FIRST_SYNC_WIRE_RESPONSE_INVALID/
);

function runnerForFailure(error) {
  return {
    success: null,
    failure: null,
    withSuccessHandler(fn) { this.success = fn; return this; },
    withFailureHandler(fn) { this.failure = fn; return this; },
    prhLocalFirstSyncBootstrapWire() { this.failure(error); }
  };
}

let transportRequest = null;
const mockRunner = {
  success: null,
  failure: null,
  withSuccessHandler(fn) { this.success = fn; return this; },
  withFailureHandler(fn) { this.failure = fn; return this; },
  prhLocalFirstSyncBootstrapWire(request) { transportRequest = request; this.success(JSON.stringify({ ok: true })); }
};

(async () => {
  const transport = syncClient.createGoogleScriptTransport({ googleScriptRun: mockRunner });
  const result = await transport.fetchBootstrap({ local_revision: REV_A });
  assert.deepStrictEqual(result, { ok: true });
  assert.deepStrictEqual(transportRequest, { local_revision: REV_A });

  const malformedWireRunner = {
    success: null,
    failure: null,
    withSuccessHandler(fn) { this.success = fn; return this; },
    withFailureHandler(fn) { this.failure = fn; return this; },
    prhLocalFirstSyncBootstrapWire() { this.success('{malformed'); }
  };
  const malformedWireTransport = syncClient.createGoogleScriptTransport({ googleScriptRun: malformedWireRunner });
  await assert.rejects(
    () => malformedWireTransport.fetchBootstrap({ local_revision: '' }),
    (error) => error && error.code === 'LOCAL_FIRST_SYNC_WIRE_RESPONSE_INVALID'
  );

  const safeFailureTransport = syncClient.createGoogleScriptTransport({
    googleScriptRun: runnerForFailure(new Error('Exception: LOCAL_FIRST_SYNC_WIRE_TRANSACTION_SHAPE_INVALID'))
  });
  await assert.rejects(
    () => safeFailureTransport.fetchBootstrap({ local_revision: '' }),
    (error) => error && error.code === 'LOCAL_FIRST_SYNC_WIRE_TRANSACTION_SHAPE_INVALID'
  );

  const unsafeFailureTransport = syncClient.createGoogleScriptTransport({
    googleScriptRun: runnerForFailure(new Error('private row value and arbitrary server details'))
  });
  await assert.rejects(
    () => unsafeFailureTransport.fetchBootstrap({ local_revision: '' }),
    (error) => error && error.code === 'LOCAL_FIRST_SYNC_REMOTE_CALL_FAILED'
  );

  console.log('local_first_sync_service_adapter_test: PASS', {
    exactWireShape: true,
    scalarJsonRpcBoundary: true,
    nullableDestinationKeyPreserved: true,
    malformedWireFailsClosed: true,
    ownerHealthTokenScalarOnly: true,
    safeRemoteReasonPropagation: true
  });
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
