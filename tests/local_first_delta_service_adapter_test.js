'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { repositoryRevision } = require('../lib/repository/transaction_repository');
const clientDelta = require('../pwa/local_first_delta');

const ROOT = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/local_first/local_first_delta.v1.json'), 'utf8'));
const syncServiceSource = fs.readFileSync(path.join(ROOT, 'LocalFirstSyncService.js'), 'utf8');
const deltaServiceSource = fs.readFileSync(path.join(ROOT, 'LocalFirstDeltaService.js'), 'utf8');

assert.strictEqual(contract.schema, 'PRH_LOCAL_FIRST_DELTA_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.roadmap_id, 'DELTA-LF-001');
assert.strictEqual(contract.revision_binding.apply_requires_active_revision_equals_base, true);
assert.strictEqual(contract.revision_binding.post_apply_requires_recomputed_revision_equals_target, true);
assert.strictEqual(contract.apply.idempotent_target_replay, 'ALREADY_APPLIED');
assert.strictEqual(contract.apply.base_mismatch, 'FULL_REBUILD_REQUIRED');
assert.strictEqual(contract.authorities.canonical_financial_write, false);
assert.strictEqual(contract.authorities.network_on_warm_interaction, false);
assert.strictEqual(contract.fallback.handler, 'SYNC_LF_001_FULL_BOOTSTRAP');

assert.ok(deltaServiceSource.includes('prhR2DataCreateSnapshot_()'), 'delta server must reuse canonical snapshot authority');
assert.ok(deltaServiceSource.includes('prhLocalFirstSyncDimensionRecords_'), 'delta server must reuse SYNC-LF dimension projection');
assert.ok(!deltaServiceSource.includes('prhGoogleRepositoryReadOperationsTable_('), 'delta server must not create a duplicate raw Google path');
assert.ok(!/\.setValue\s*\(|\.setValues\s*\(|\.appendRow\s*\(|\.deleteRow\s*\(/.test(deltaServiceSource), 'delta server must not mutate canonical source');

function sha256(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function tx(index, amount = index * 1000) {
  const id = `tx-${String(index).padStart(2, '0')}`;
  return Object.freeze({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: id,
    occurred_at: `2026-08-${String(index).padStart(2, '0')}T10:00:00.000Z`,
    type: index % 3 === 0 ? 'income' : 'expense',
    status: 'posted',
    amount_minor: Math.abs(amount),
    currency: 'RUB',
    account_id: 'account:main',
    destination_account_id: null,
    category_id: 'category:general',
    member_id: null,
    project_id: null,
    tags: [],
    counterparty: null,
    description: `Synthetic ${index}`,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: Object.freeze({
      source_system: 'SYNTHETIC',
      source_container: 'test',
      source_record_id: `source-${id}`,
      source_fingerprint: sha256(`source-${id}-${amount}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'test-v1',
      source_position: `row:${index + 1}`
    })
  });
}

const labels = {
  'account|account:main': 'Synthetic account',
  'category|category:general': 'Synthetic category'
};
function makeSnapshot(transactions) {
  return Object.freeze({
    transactions: Object.freeze(transactions.slice()),
    revision: repositoryRevision(transactions),
    dimensions: Object.freeze({
      displayLabel(kind, id) {
        const value = labels[`${kind}|${id}`];
        if (!value) throw new Error('TEST_LABEL_MISSING');
        return value;
      }
    })
  });
}

const baseTransactions = Array.from({ length: 10 }, (_, idx) => tx(idx + 1));
const currentTransactions = baseTransactions
  .filter((row) => row.transaction_id !== 'tx-09')
  .map((row) => row.transaction_id === 'tx-03' ? tx(3, 9999) : row)
  .concat([tx(11)])
  .sort((a, b) => a.transaction_id.localeCompare(b.transaction_id));
const baseSnapshot = makeSnapshot(baseTransactions);
const currentSnapshot = makeSnapshot(currentTransactions);
let activeServerSnapshot = baseSnapshot;

const context = {
  console,
  Date,
  Object,
  JSON,
  String,
  Number,
  Array,
  RegExp,
  Math,
  prhR2FinSha256Hex_: sha256,
  prhR2DataCreateSnapshot_: () => activeServerSnapshot
};
vm.createContext(context);
vm.runInContext(syncServiceSource, context, { filename: 'LocalFirstSyncService.js' });
vm.runInContext(deltaServiceSource, context, { filename: 'LocalFirstDeltaService.js' });

function inventoryFor(snapshot) {
  const dimensions = context.prhLocalFirstSyncDimensionRecords_(snapshot);
  const transactions = snapshot.transactions.map((row) => ({
    key: row.transaction_id,
    etag: context.prhLocalFirstDeltaTransactionEtag_(row)
  })).sort((a, b) => a.key.localeCompare(b.key));
  const dimensionInventory = dimensions.map((row) => ({
    key: row.dimension_key,
    etag: context.prhLocalFirstDeltaDimensionEtag_(row)
  })).sort((a, b) => a.key.localeCompare(b.key));
  return {
    transactions,
    dimensions: dimensionInventory,
    digest: context.prhLocalFirstDeltaInventoryDigest_(transactions, dimensionInventory)
  };
}

const baseInventory = inventoryFor(baseSnapshot);
const baseRequest = { base_revision: baseSnapshot.revision, inventory: baseInventory };

const noop = context.prhLocalFirstDelta(baseRequest);
assert.strictEqual(noop.state, 'NOOP');
assert.strictEqual(noop.base_revision, baseSnapshot.revision);
assert.strictEqual(noop.target_revision, baseSnapshot.revision);
assert.strictEqual(noop.target_generation_id, baseSnapshot.revision);
assert.strictEqual(noop.financial_write_authorized, false);
assert.strictEqual(noop.canonical_mutation_performed, false);

activeServerSnapshot = currentSnapshot;
const delta = context.prhLocalFirstDelta(baseRequest);
assert.strictEqual(delta.state, 'DELTA');
assert.strictEqual(delta.base_revision, baseSnapshot.revision);
assert.strictEqual(delta.target_revision, currentSnapshot.revision);
assert.strictEqual(delta.target_generation_id, currentSnapshot.revision);
assert.strictEqual(delta.base_inventory_digest, baseInventory.digest);
assert.strictEqual(delta.transaction_upserts.length, 2, 'one changed + one added transaction');
assert.deepStrictEqual(Array.from(delta.transaction_upserts, (row) => row.transaction_id), ['tx-03', 'tx-11']);
assert.deepStrictEqual(Array.from(delta.transaction_deletes), ['tx-09']);
assert.strictEqual(delta.dimension_upserts.length, 0);
assert.strictEqual(delta.dimension_deletes.length, 0);
assert.deepStrictEqual(JSON.parse(JSON.stringify(delta.expected_counts)), {
  transactions: 10,
  dimensions: 2,
  aggregates: 0,
  sync_journal: 1
});
assert.strictEqual(delta.delta_id, sha256(`PRH_LOCAL_FIRST_DELTA_V1|${baseSnapshot.revision}|${currentSnapshot.revision}|${baseInventory.digest}`));
assert.strictEqual(delta.financial_write_authorized, false);
assert.strictEqual(delta.canonical_mutation_performed, false);

const emptyTransactions = [];
const emptyDimensions = [];
const emptyInventory = {
  transactions: emptyTransactions,
  dimensions: emptyDimensions,
  digest: context.prhLocalFirstDeltaInventoryDigest_(emptyTransactions, emptyDimensions)
};
const rebuild = context.prhLocalFirstDelta({ base_revision: baseSnapshot.revision, inventory: emptyInventory });
assert.strictEqual(rebuild.state, 'FULL_REBUILD_REQUIRED');
assert.strictEqual(rebuild.reason_code, 'DELTA_RATIO_THRESHOLD_EXCEEDED');
assert.strictEqual(rebuild.transaction_upserts, undefined);

assert.throws(
  () => context.prhLocalFirstDelta({
    base_revision: baseSnapshot.revision,
    inventory: { transactions: baseInventory.transactions, dimensions: baseInventory.dimensions, digest: 'f'.repeat(64) }
  }),
  /LOCAL_FIRST_DELTA_INVENTORY_DIGEST_MISMATCH/
);

(async () => {
  const clientBaseRevision = await clientDelta.repositoryRevision(baseTransactions);
  const clientCurrentRevision = await clientDelta.repositoryRevision(currentTransactions);
  assert.strictEqual(clientBaseRevision, baseSnapshot.revision, 'browser delta revision algorithm must equal canonical repositoryRevision');
  assert.strictEqual(clientCurrentRevision, currentSnapshot.revision, 'browser delta target revision must equal canonical repositoryRevision');
  const browserStyleInventory = await clientDelta.buildInventory({
    status: 'READY',
    generation_id: baseSnapshot.revision,
    revision: baseSnapshot.revision,
    transactions: baseTransactions,
    dimensions: context.prhLocalFirstSyncDimensionRecords_(baseSnapshot)
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(browserStyleInventory.inventory)), JSON.parse(JSON.stringify(baseInventory)), 'client/server inventory etag contract must match');
  const validated = await clientDelta.validateRemoteEnvelope(JSON.parse(JSON.stringify(delta)), browserStyleInventory);
  assert.strictEqual(validated.state, 'DELTA');
  assert.strictEqual(validated.delta_id, delta.delta_id);
  console.log('local_first_delta_service_adapter_test: PASS');
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
