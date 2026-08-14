'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(ROOT, 'pwa/local_read_model_store.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(ROOT, 'pwa/local_first_sync.js'), 'utf8');
const deltaSource = fs.readFileSync(path.join(ROOT, 'pwa/local_first_delta.js'), 'utf8');
const harness = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${storeSource}</script><script>${syncSource}</script><script>${deltaSource}</script></body></html>`;

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
    await page.waitForFunction(() => !!window.PrhLocalReadModelStore && !!window.PrhLocalFirstSync && !!window.PrhLocalFirstDelta);
    measureLocalNetwork = true;

    const result = await page.evaluate(async () => {
      const dbName = 'prh-delta-test-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      const store = PrhLocalReadModelStore.createStore({ indexedDB, IDBKeyRange, name: dbName });
      let fullCalls = 0;
      let deltaCalls = 0;
      let fullFailure = false;
      let fullMode = 'A';
      let deltaMode = 'B';

      function tx(index, amount) {
        const id = `tx-${String(index).padStart(2, '0')}`;
        const value = amount == null ? index * 1000 : amount;
        return {
          schema: 'PRH_CANONICAL_TRANSACTION_V1',
          schema_version: 1,
          transaction_id: id,
          occurred_at: `2026-08-${String(index).padStart(2, '0')}T10:00:00.000Z`,
          type: index % 3 === 0 ? 'income' : 'expense',
          status: 'posted',
          amount_minor: Math.abs(value),
          currency: 'RUB',
          account_id: 'account:test',
          destination_account_id: null,
          category_id: 'category:test',
          member_id: null,
          project_id: null,
          tags: [],
          counterparty: null,
          description: `Synthetic ${index}`,
          reverses_transaction_id: null,
          adjustment_semantics: null,
          provenance: {
            source_system: 'SYNTHETIC',
            source_container: 'test',
            source_record_id: `source-${id}`,
            source_fingerprint: 'c'.repeat(64),
            identity_strategy: 'EXTERNAL_ID',
            transform_version: 'test-v1',
            source_position: `row:${index + 1}`
          }
        };
      }

      const dimensions = [
        { dimension_key: 'account|account:test', kind: 'account', dimension_id: 'account:test', label: 'Synthetic account' },
        { dimension_key: 'category|category:test', kind: 'category', dimension_id: 'category:test', label: 'Synthetic category' }
      ];
      const A = Array.from({ length: 8 }, (_, idx) => tx(idx + 1));
      const B = A.filter((row) => row.transaction_id !== 'tx-07')
        .map((row) => row.transaction_id === 'tx-03' ? tx(3, 33333) : row)
        .concat([tx(9)])
        .sort((left, right) => left.transaction_id.localeCompare(right.transaction_id));
      const C = B.map((row) => row.transaction_id === 'tx-04' ? tx(4, 44444) : row)
        .concat([tx(10)])
        .sort((left, right) => left.transaction_id.localeCompare(right.transaction_id));
      const REV_A = await PrhLocalFirstDelta.repositoryRevision(A);
      const REV_B = await PrhLocalFirstDelta.repositoryRevision(B);
      const REV_C = await PrhLocalFirstDelta.repositoryRevision(C);

      function fullEnvelope(revision, transactions) {
        const journal = [{ sequence: 1, event: 'FULL_BOOTSTRAP', revision, transaction_count: transactions.length, dimension_count: dimensions.length }];
        return {
          schema: 'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1', version: '1.0.0', state: 'FULL_BOOTSTRAP',
          revision, generation_id: revision,
          transactions, dimensions, aggregates: [], sync_journal: journal,
          expected_counts: { transactions: transactions.length, dimensions: dimensions.length, aggregates: 0, sync_journal: 1 },
          financial_write_authorized: false, canonical_mutation_performed: false
        };
      }

      const fullTransport = {
        async fetchBootstrap(request) {
          fullCalls += 1;
          if (fullFailure) throw Object.assign(new Error('synthetic full offline'), { code: 'SYNTHETIC_FULL_SYNC_FAILURE' });
          const rows = fullMode === 'C' ? C : A;
          const revision = fullMode === 'C' ? REV_C : REV_A;
          if (request.local_revision === revision) {
            return {
              schema: 'PRH_LOCAL_FIRST_SYNC_SNAPSHOT_V1', version: '1.0.0', state: 'NOOP',
              revision, generation_id: revision,
              financial_write_authorized: false, canonical_mutation_performed: false
            };
          }
          return fullEnvelope(revision, rows);
        }
      };
      const fullSync = PrhLocalFirstSync.createSyncCoordinator({ store, transport: fullTransport, chunkSize: 2 });

      async function deltaId(request, targetRevision) {
        return PrhLocalFirstDelta.sha256Hex(`PRH_LOCAL_FIRST_DELTA_V1|${request.base_revision}|${targetRevision}|${request.inventory.digest}`);
      }
      async function deltaEnvelope(request, targetRevision, upserts, deletes) {
        return {
          schema: 'PRH_LOCAL_FIRST_DELTA_RESPONSE_V1', version: '1.0.0', state: 'DELTA',
          delta_id: await deltaId(request, targetRevision),
          base_revision: request.base_revision,
          target_revision: targetRevision,
          target_generation_id: targetRevision,
          base_inventory_digest: request.inventory.digest,
          transaction_upserts: upserts,
          transaction_deletes: deletes,
          dimension_upserts: [], dimension_deletes: [],
          expected_counts: { transactions: targetRevision === REV_B ? B.length : C.length, dimensions: dimensions.length, aggregates: 0, sync_journal: 1 },
          financial_write_authorized: false, canonical_mutation_performed: false
        };
      }

      const deltaTransport = {
        async fetchDelta(request) {
          deltaCalls += 1;
          if (deltaMode === 'B') return deltaEnvelope(request, REV_B, [tx(3, 33333), tx(9)], ['tx-07']);
          if (deltaMode === 'NOOP_B') {
            return {
              schema: 'PRH_LOCAL_FIRST_DELTA_RESPONSE_V1', version: '1.0.0', state: 'NOOP',
              base_revision: request.base_revision, target_revision: request.base_revision, target_generation_id: request.base_revision,
              base_inventory_digest: request.inventory.digest,
              financial_write_authorized: false, canonical_mutation_performed: false
            };
          }
          if (deltaMode === 'CORRUPT_C') return deltaEnvelope(request, REV_C, [], []);
          if (deltaMode === 'REBUILD_C') {
            return {
              schema: 'PRH_LOCAL_FIRST_DELTA_RESPONSE_V1', version: '1.0.0', state: 'FULL_REBUILD_REQUIRED',
              base_revision: request.base_revision, target_revision: REV_C, target_generation_id: REV_C,
              base_inventory_digest: request.inventory.digest, reason_code: 'DELTA_RATIO_THRESHOLD_EXCEEDED',
              financial_write_authorized: false, canonical_mutation_performed: false
            };
          }
          if (deltaMode === 'NOOP_C') {
            return {
              schema: 'PRH_LOCAL_FIRST_DELTA_RESPONSE_V1', version: '1.0.0', state: 'NOOP',
              base_revision: request.base_revision, target_revision: request.base_revision, target_generation_id: request.base_revision,
              base_inventory_digest: request.inventory.digest,
              financial_write_authorized: false, canonical_mutation_performed: false
            };
          }
          throw new Error('UNKNOWN_DELTA_MODE');
        }
      };
      const delta = PrhLocalFirstDelta.createDeltaCoordinator({ store, transport: deltaTransport, fullSyncCoordinator: fullSync, chunkSize: 2 });

      await store.wipe();
      const localBefore = await store.getActiveSnapshot({ includeJournal: true });
      const callsBeforeBootstrap = { full: fullCalls, delta: deltaCalls };
      const bootstrapA = await fullSync.sync();
      const activeA = await store.getActiveSnapshot({ includeJournal: true });

      deltaMode = 'B';
      const applyB = await delta.sync();
      const activeB = await store.getActiveSnapshot({ includeJournal: true });
      const revisionBReadback = await PrhLocalFirstDelta.repositoryRevision(activeB.transactions);

      deltaMode = 'NOOP_B';
      const replayB = await delta.sync();
      const activeAfterReplay = await store.getActiveSnapshot({ includeJournal: true });

      deltaMode = 'CORRUPT_C';
      fullFailure = true;
      const corruptC = await delta.sync();
      const activeAfterCorrupt = await store.getActiveSnapshot({ includeJournal: true });

      deltaMode = 'REBUILD_C';
      fullFailure = false;
      fullMode = 'C';
      const rebuildC = await delta.sync();
      const activeC = await store.getActiveSnapshot({ includeJournal: true });
      const revisionCReadback = await PrhLocalFirstDelta.repositoryRevision(activeC.transactions);

      deltaMode = 'NOOP_C';
      const replayC = await delta.startBackgroundSync();
      const activeAfterCReplay = await store.getActiveSnapshot({ includeJournal: true });

      const wiped = await store.wipe();
      const reopened = await store.open();
      const afterWipe = await store.getActiveSnapshot({ includeJournal: true });
      store.close();

      return {
        REV_A, REV_B, REV_C,
        localBefore, callsBeforeBootstrap, bootstrapA, activeA,
        applyB, activeB, revisionBReadback,
        replayB, activeAfterReplay,
        corruptC, activeAfterCorrupt,
        rebuildC, activeC, revisionCReadback,
        replayC, activeAfterCReplay,
        wiped, reopened, afterWipe,
        fullCalls, deltaCalls
      };
    });

    assert.strictEqual(result.localBefore.status, 'EMPTY');
    assert.deepStrictEqual(result.callsBeforeBootstrap, { full: 0, delta: 0 }, 'local read must not invoke transport');

    assert.strictEqual(result.bootstrapA.status, 'UPDATED');
    assert.strictEqual(result.activeA.status, 'READY');
    assert.strictEqual(result.activeA.revision, result.REV_A);
    assert.strictEqual(result.activeA.transactions.length, 8);

    assert.strictEqual(result.applyB.status, 'UPDATED_DELTA');
    assert.strictEqual(result.activeB.status, 'READY');
    assert.strictEqual(result.activeB.revision, result.REV_B);
    assert.strictEqual(result.activeB.generation_id, result.REV_B);
    assert.strictEqual(result.activeB.transactions.length, 8);
    assert.strictEqual(result.revisionBReadback, result.REV_B, 'target revision must be recomputed exactly before/after finalize');
    assert.deepStrictEqual(result.activeB.transactions.map((row) => row.transaction_id), ['tx-01','tx-02','tx-03','tx-04','tx-05','tx-06','tx-08','tx-09']);
    assert.strictEqual(result.activeB.transactions.find((row) => row.transaction_id === 'tx-03').amount_minor, 33333);

    assert.strictEqual(result.replayB.status, 'NOOP');
    assert.strictEqual(result.activeAfterReplay.revision, result.REV_B);
    assert.strictEqual(result.activeAfterReplay.generation_id, result.REV_B);

    assert.strictEqual(result.corruptC.status, 'DEGRADED', 'corrupt target + failed full fallback must preserve verified base');
    assert.strictEqual(result.corruptC.reason, 'LOCAL_FIRST_DELTA_TARGET_REVISION_MISMATCH');
    assert.strictEqual(result.activeAfterCorrupt.status, 'READY');
    assert.strictEqual(result.activeAfterCorrupt.revision, result.REV_B);
    assert.strictEqual(result.activeAfterCorrupt.transactions.length, 8);

    assert.strictEqual(result.rebuildC.status, 'FULL_REBUILT');
    assert.strictEqual(result.rebuildC.reason, 'DELTA_RATIO_THRESHOLD_EXCEEDED');
    assert.strictEqual(result.activeC.status, 'READY');
    assert.strictEqual(result.activeC.revision, result.REV_C);
    assert.strictEqual(result.activeC.generation_id, result.REV_C);
    assert.strictEqual(result.activeC.transactions.length, 9);
    assert.strictEqual(result.revisionCReadback, result.REV_C);

    assert.strictEqual(result.replayC.status, 'NOOP');
    assert.strictEqual(result.activeAfterCReplay.revision, result.REV_C);

    assert.strictEqual(result.wiped.status, 'WIPED');
    assert.strictEqual(result.reopened.status, 'OPEN');
    assert.strictEqual(result.afterWipe.status, 'EMPTY');
    assert.deepStrictEqual(localOperationRequests, [], `local/synthetic delta operations emitted real network requests: ${localOperationRequests.join(' | ')}`);
    assert.strictEqual(result.deltaCalls, 5, 'only explicit delta sync calls may invoke delta transport');
    assert.strictEqual(result.fullCalls, 3, 'full bootstrap only initial + corrupt fallback attempt + explicit rebuild fallback');

    console.log('Local-first delta IndexedDB adapter: PASS', {
      addUpdateDelete: true,
      idempotentReplay: true,
      targetRevisionRecomputed: true,
      corruptDeltaPreservesVerified: true,
      fullRebuildFallback: true,
      explicitWipe: true,
      localNetworkRequests: localOperationRequests.length,
      deltaCalls: result.deltaCalls,
      fullCalls: result.fullCalls
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
