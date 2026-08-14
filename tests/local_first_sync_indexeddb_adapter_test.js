'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(ROOT, 'pwa/local_read_model_store.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(ROOT, 'pwa/local_first_sync.js'), 'utf8');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const networkRequests = [];
  page.on('request', (request) => networkRequests.push(request.url()));

  try {
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: storeSource });
    await page.addScriptTag({ content: syncSource });

    const result = await page.evaluate(async () => {
      const REV_A = 'a'.repeat(64);
      const REV_B = 'b'.repeat(64);
      const dbName = 'prh-sync-test-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      const store = PrhLocalReadModelStore.createStore({ indexedDB, IDBKeyRange, name: dbName });
      let transportCalls = 0;
      let mode = 'A';

      function tx(id, amount) {
        return {
          schema: 'PRH_CANONICAL_TRANSACTION_V1',
          schema_version: 1,
          transaction_id: id,
          occurred_at: '2026-08-01T10:00:00.000Z',
          type: amount >= 0 ? 'income' : 'expense',
          status: 'posted',
          amount_minor: Math.abs(amount),
          currency: 'RUB',
          account_id: 'account:test',
          destination_account_id: null,
          category_id: 'category:test',
          member_id: null,
          project_id: null,
          tags: [],
          counterparty: null,
          description: null,
          reverses_transaction_id: null,
          adjustment_semantics: null,
          provenance: {
            source_system: 'SYNTHETIC',
            source_container: 'test',
            source_record_id: id,
            source_fingerprint: 'c'.repeat(64),
            identity_strategy: 'EXTERNAL_ID',
            transform_version: 'test',
            source_position: 'row:2'
          }
        };
      }

      function fullEnvelope(revision, transactions) {
        const dimensions = [{ dimension_key: 'account|account:test', kind: 'account', dimension_id: 'account:test', label: 'Synthetic account' }];
        const journal = [{ sequence: 1, event: 'FULL_BOOTSTRAP', revision, transaction_count: transactions.length, dimension_count: dimensions.length }];
        return {
          schema: 'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1',
          version: '1.0.0',
          state: 'FULL_BOOTSTRAP',
          revision,
          generation_id: revision,
          transactions,
          dimensions,
          aggregates: [],
          sync_journal: journal,
          expected_counts: {
            transactions: transactions.length,
            dimensions: dimensions.length,
            aggregates: 0,
            sync_journal: journal.length
          },
          financial_write_authorized: false,
          canonical_mutation_performed: false
        };
      }

      const transport = {
        async fetchBootstrap(request) {
          transportCalls += 1;
          if (mode === 'NETWORK_FAIL') throw Object.assign(new Error('offline'), { code: 'SYNTHETIC_NETWORK_FAILURE' });
          if (mode === 'A') {
            if (request.local_revision === REV_A) {
              return {
                schema: 'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1', version: '1.0.0', state: 'NOOP',
                revision: REV_A, generation_id: REV_A,
                financial_write_authorized: false, canonical_mutation_performed: false
              };
            }
            return fullEnvelope(REV_A, [tx('a-1', 10000), tx('a-2', -2500)]);
          }
          if (mode === 'B_BAD') {
            // Two rows with one key intentionally collapse in IndexedDB. The
            // STORE-LF count verification must fail before active switch.
            return fullEnvelope(REV_B, [tx('b-duplicate', 12000), tx('b-duplicate', -3000)]);
          }
          if (mode === 'B') {
            return fullEnvelope(REV_B, [tx('b-1', 12000), tx('b-2', -3000), tx('b-3', -500)]);
          }
          throw new Error('UNKNOWN_TEST_MODE');
        }
      };

      const coordinator = PrhLocalFirstSync.createSyncCoordinator({ store, transport, chunkSize: 1 });

      const before = await coordinator.readLocal({ includeJournal: true });
      const callsAfterLocalRead = transportCalls;

      const initial = await coordinator.sync();
      const activeA = await coordinator.readLocal({ includeJournal: true });
      const callsAfterInitial = transportCalls;

      const sameRevision = await coordinator.sync();
      const activeAfterNoop = await coordinator.readLocal({ includeJournal: true });

      mode = 'NETWORK_FAIL';
      const degradedNetwork = await coordinator.sync();
      const activeAfterNetworkFailure = await coordinator.readLocal({ includeJournal: true });

      mode = 'B_BAD';
      const failedGeneration = await coordinator.sync();
      const activeAfterFailedGeneration = await coordinator.readLocal({ includeJournal: true });

      mode = 'B';
      const updatedB = await coordinator.startBackgroundSync();
      const activeB = await coordinator.readLocal({ includeJournal: true });

      store.close();
      const cleanupStore = PrhLocalReadModelStore.createStore({ indexedDB, IDBKeyRange, name: dbName });
      await cleanupStore.wipe();

      return {
        before,
        callsAfterLocalRead,
        initial,
        activeA,
        callsAfterInitial,
        sameRevision,
        activeAfterNoop,
        degradedNetwork,
        activeAfterNetworkFailure,
        failedGeneration,
        activeAfterFailedGeneration,
        updatedB,
        activeB,
        transportCalls
      };
    });

    assert.strictEqual(result.before.status, 'EMPTY');
    assert.strictEqual(result.callsAfterLocalRead, 0, 'local read must not invoke remote transport');

    assert.strictEqual(result.initial.status, 'UPDATED');
    assert.strictEqual(result.activeA.status, 'READY');
    assert.strictEqual(result.activeA.revision, 'a'.repeat(64));
    assert.strictEqual(result.activeA.generation_id, 'a'.repeat(64));
    assert.strictEqual(result.activeA.transactions.length, 2);
    assert.strictEqual(result.activeA.sync_journal.length, 1);
    assert.strictEqual(result.callsAfterInitial, 1);

    assert.strictEqual(result.sameRevision.status, 'NOOP');
    assert.strictEqual(result.activeAfterNoop.generation_id, result.activeA.generation_id);
    assert.strictEqual(result.activeAfterNoop.revision, result.activeA.revision);
    assert.strictEqual(result.activeAfterNoop.transactions.length, 2);

    assert.strictEqual(result.degradedNetwork.status, 'DEGRADED');
    assert.strictEqual(result.degradedNetwork.reason, 'SYNTHETIC_NETWORK_FAILURE');
    assert.strictEqual(result.activeAfterNetworkFailure.status, 'READY');
    assert.strictEqual(result.activeAfterNetworkFailure.revision, 'a'.repeat(64));
    assert.strictEqual(result.activeAfterNetworkFailure.transactions.length, 2);

    assert.strictEqual(result.failedGeneration.status, 'DEGRADED');
    assert.strictEqual(result.failedGeneration.reason, 'GENERATION_COUNT_MISMATCH');
    assert.strictEqual(result.activeAfterFailedGeneration.status, 'READY');
    assert.strictEqual(result.activeAfterFailedGeneration.revision, 'a'.repeat(64));
    assert.strictEqual(result.activeAfterFailedGeneration.transactions.length, 2);

    assert.strictEqual(result.updatedB.status, 'UPDATED');
    assert.strictEqual(result.activeB.status, 'READY');
    assert.strictEqual(result.activeB.revision, 'b'.repeat(64));
    assert.strictEqual(result.activeB.generation_id, 'b'.repeat(64));
    assert.strictEqual(result.activeB.transactions.length, 3);
    assert.strictEqual(result.activeB.sync_journal.length, 1);

    assert.strictEqual(networkRequests.length, 0, 'synthetic local/read-model browser integration must not create real network requests');
    assert.strictEqual(result.transportCalls, 5, 'only explicit sync calls may invoke transport');

    console.log('local_first_sync_indexeddb_adapter_test: PASS');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
