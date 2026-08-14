'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(ROOT, 'pwa/local_read_model_store.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(ROOT, 'pwa/local_first_sync.js'), 'utf8');
const harness = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${storeSource}</script><script>${syncSource}</script></body></html>`;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

(async () => {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(harness);
  });
  const address = await listen(server);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const localOperationRequests = [];
  let measureLocalNetwork = false;
  page.on('request', (request) => {
    if (measureLocalNetwork) localOperationRequests.push(request.url());
  });

  try {
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() => !!window.PrhLocalReadModelStore && !!window.PrhLocalFirstSync);
    measureLocalNetwork = true;

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
            // Same IndexedDB compound key intentionally overwrites one row.
            // STORE-LF exact count verification must fail before active switch.
            return fullEnvelope(REV_B, [tx('b-duplicate', 12000), tx('b-duplicate', -3000)]);
          }
          if (mode === 'B') {
            return fullEnvelope(REV_B, [tx('b-1', 12000), tx('b-2', -3000), tx('b-3', -500)]);
          }
          throw new Error('UNKNOWN_TEST_MODE');
        }
      };

      await store.wipe();
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

      const wiped = await store.wipe();
      const reopened = await store.open();
      const afterWipe = await coordinator.readLocal({ includeJournal: true });
      store.close();

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
        wiped,
        reopened,
        afterWipe,
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

    assert.strictEqual(result.wiped.status, 'WIPED');
    assert.strictEqual(result.reopened.status, 'OPEN');
    assert.strictEqual(result.afterWipe.status, 'EMPTY');
    assert.deepStrictEqual(localOperationRequests, [], `local/synthetic sync operations emitted real network requests: ${localOperationRequests.join(' | ')}`);
    assert.strictEqual(result.transportCalls, 5, 'only explicit sync calls may invoke transport');

    console.log('Local-first sync IndexedDB adapter: PASS', {
      initialBootstrap: true,
      sameRevisionNoop: true,
      networkFailurePreservesVerified: true,
      failedGenerationPreservesPrevious: true,
      retryAtomicSwitch: true,
      explicitWipe: true,
      localNetworkRequests: localOperationRequests.length,
      transportCalls: result.transportCalls
    });
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    await closeServer(server);
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
