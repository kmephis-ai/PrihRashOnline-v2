'use strict';

const assert = require('assert');
const delta = require('../pwa/local_first_delta');

const REVISION = 'a'.repeat(64);

function canonicalTransaction() {
  return {
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: 'shape-rebuild-001',
    occurred_at: '2026-08-15T00:00:00Z',
    type: 'expense',
    status: 'posted',
    amount_minor: 12345,
    currency: 'RUB',
    account_id: 'acc-main',
    destination_account_id: null,
    category_id: 'cat-home',
    member_id: null,
    project_id: null,
    tags: ['synthetic'],
    counterparty: null,
    description: null,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC_TEST',
      source_container: 'shape-rebuild',
      source_record_id: 'row-1',
      source_fingerprint: 'b'.repeat(64),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYN-v1',
      source_position: null
    }
  };
}

function snapshot(transaction) {
  return {
    status: 'READY',
    generation_id: REVISION,
    revision: REVISION,
    counts: { transactions: 1, dimensions: 0, aggregates: 0, sync_journal: 1 },
    transactions: [transaction],
    dimensions: [],
    aggregates: [],
    sync_journal: [{ sequence: 1, event: 'SYNTHETIC', revision: REVISION }]
  };
}

(async () => {
  const exact = canonicalTransaction();
  assert.doesNotThrow(() => delta.revisionRow(exact));

  const missingOptionalKey = canonicalTransaction();
  delete missingOptionalKey.description;
  assert.throws(
    () => delta.revisionRow(missingOptionalKey),
    (error) => error && error.code === 'LOCAL_FIRST_DELTA_TRANSACTION_SHAPE_INVALID'
  );

  const extraStorageKey = Object.assign({}, canonicalTransaction(), { generation_id: REVISION });
  assert.throws(
    () => delta.revisionRow(extraStorageKey),
    (error) => error && error.code === 'LOCAL_FIRST_DELTA_TRANSACTION_SHAPE_INVALID'
  );

  const missingProvenanceKey = canonicalTransaction();
  missingProvenanceKey.provenance = Object.assign({}, missingProvenanceKey.provenance);
  delete missingProvenanceKey.provenance.source_position;
  assert.throws(
    () => delta.revisionRow(missingProvenanceKey),
    (error) => error && error.code === 'LOCAL_FIRST_DELTA_PROVENANCE_SHAPE_INVALID'
  );

  let active = snapshot(missingOptionalKey);
  let wipeCalls = 0;
  let openCalls = 0;
  let transportCalls = 0;
  let fullSyncCalls = 0;

  const store = {
    async status() {
      if (!active) return { status: 'EMPTY' };
      return {
        status: 'READY',
        generation_id: active.generation_id,
        revision: active.revision,
        counts: active.counts
      };
    },
    async getActiveSnapshot() {
      return active || { status: 'EMPTY' };
    },
    async wipe() {
      wipeCalls += 1;
      active = null;
      return { status: 'WIPED' };
    },
    async open() {
      openCalls += 1;
      return { status: 'OPEN' };
    },
    async beginGeneration() { throw new Error('unexpected beginGeneration'); },
    async writeGenerationChunk() { throw new Error('unexpected writeGenerationChunk'); },
    async finalizeGeneration() { throw new Error('unexpected finalizeGeneration'); },
    async abortGeneration() { return { status: 'ABORTED' }; }
  };

  const transport = {
    async fetchDelta() {
      transportCalls += 1;
      throw new Error('delta transport must not be called for invalid local inventory');
    }
  };

  const fullSyncCoordinator = {
    async sync() {
      fullSyncCalls += 1;
      assert.strictEqual(active, null, 'derived local cache must be wiped before canonical full rebuild');
      active = snapshot(canonicalTransaction());
      return {
        status: 'UPDATED',
        active: {
          generation_id: REVISION,
          revision: REVISION,
          counts: active.counts
        }
      };
    }
  };

  const coordinator = delta.createDeltaCoordinator({ store, transport, fullSyncCoordinator });
  const result = await coordinator.sync();

  assert.strictEqual(result.status, 'FULL_REBUILT');
  assert.strictEqual(result.reason, 'LOCAL_FIRST_DELTA_TRANSACTION_SHAPE_INVALID');
  assert.strictEqual(wipeCalls, 1, 'invalid derived generation must be removed exactly once');
  assert.strictEqual(openCalls, 1, 'local store must be reopened before canonical rebuild');
  assert.strictEqual(fullSyncCalls, 1, 'canonical full bootstrap must be requested exactly once');
  assert.strictEqual(transportCalls, 0, 'delta NOOP must not preserve structurally invalid local data');
  assert.strictEqual(active.status, 'READY');
  assert.doesNotThrow(() => delta.revisionRow(active.transactions[0]));
  await delta.buildInventory(active);

  console.log('local_first_delta_shape_rebuild_adapter_test: PASS', {
    exactCanonicalShapeRequired: true,
    driftedCacheWiped: true,
    canonicalFullRebuild: true,
    deltaNoopBypassed: true,
    financialWriteAuthority: false
  });
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
