'use strict';

const assert = require('assert');
const finance = require('../pwa/local_finance_runtime');

const REVISION = 'c'.repeat(64);

function canonicalTransaction() {
  return {
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: 'same-revision-recovery-001',
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
      source_container: 'same-revision-recovery',
      source_record_id: 'row-1',
      source_fingerprint: 'd'.repeat(64),
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
    transactions: [transaction],
    dimensions: [],
    aggregates: [],
    sync_journal: []
  };
}

function analyticsEnvelope(activeSnapshot) {
  return {
    result: {
      schema: 'PRH_ANALYTICS_RESULT_V1',
      contract_version: '1.0.0',
      rows: [],
      provenance: {
        financial_truth_policy: 'FIN-TRUTH-v1',
        input_revision: activeSnapshot.revision
      }
    }
  };
}

(async () => {
  const malformed = canonicalTransaction();
  delete malformed.description;
  const repaired = canonicalTransaction();
  let active = snapshot(malformed);
  let queryCalls = 0;
  let releaseSync;
  let markSyncStarted;
  const syncGate = new Promise((resolve) => { releaseSync = resolve; });
  const syncStarted = new Promise((resolve) => { markSyncStarted = resolve; });

  const store = {
    async status() {
      return {
        status: 'READY',
        generation_id: active.generation_id,
        revision: active.revision
      };
    },
    async getActiveSnapshot() {
      return active;
    }
  };

  const workerClient = {
    async bind() { return true; },
    async query(activeSnapshot) {
      queryCalls += 1;
      if (!Object.prototype.hasOwnProperty.call(activeSnapshot.transactions[0], 'description')) {
        const error = new Error('CANONICAL_TRANSACTION_SHAPE_INVALID');
        error.code = 'CANONICAL_TRANSACTION_SHAPE_INVALID';
        throw error;
      }
      return analyticsEnvelope(activeSnapshot);
    }
  };

  const deltaCoordinator = {
    async sync() {
      markSyncStarted();
      await syncGate;
      active = snapshot(repaired);
      return {
        status: 'FULL_REBUILT',
        reason: 'LOCAL_FIRST_DELTA_TRANSACTION_SHAPE_INVALID',
        active: {
          generation_id: REVISION,
          revision: REVISION
        }
      };
    }
  };

  const states = [];
  const runtime = finance.createRuntime({
    store,
    workerClient,
    deltaCoordinator,
    onState: (state) => states.push(state)
  });

  await runtime.start('home');
  const failedBeforeRepair = runtime.getState();
  assert.strictEqual(failedBeforeRepair.revision, REVISION);
  assert.strictEqual(failedBeforeRepair.view.status, 'ERROR');
  assert.strictEqual(failedBeforeRepair.view.reason, 'CANONICAL_TRANSACTION_SHAPE_INVALID');

  await syncStarted;
  releaseSync();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = runtime.getState();
    if (current.sync_status === 'READY' && current.view && current.view.status === 'READY') break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  const recovered = runtime.getState();
  assert.strictEqual(recovered.sync_status, 'READY');
  assert.strictEqual(recovered.revision, REVISION, 'repair intentionally keeps the same financial revision');
  assert.strictEqual(recovered.generation_id, REVISION);
  assert.strictEqual(recovered.view.status, 'READY', 'same-revision FULL_REBUILT must force a fresh Worker render');
  assert.strictEqual(recovered.view.revision, REVISION);
  assert.strictEqual(recovered.view.provenance.input_revision, REVISION);
  assert(queryCalls >= 4, 'Home must be evaluated once before repair and once again after repair');
  assert(states.some((state) => state.view && state.view.status === 'ERROR'));
  assert(states.some((state) => state.view && state.view.status === 'READY'));

  console.log('local_finance_same_revision_recovery_runtime_test: PASS', {
    initialCanonicalShapeFailure: true,
    fullRebuildSameRevision: true,
    forcedWorkerRerender: true,
    recoveredWithoutManualCacheClear: true,
    financialWriteAuthority: false
  });
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
