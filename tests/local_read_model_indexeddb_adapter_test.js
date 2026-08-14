'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(root, 'pwa/local_read_model_store.js'), 'utf8');
const harness = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${storeSource}</script></body></html>`;

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
    await page.waitForFunction(() => !!window.PrhLocalReadModelStore);
    measureLocalNetwork = true;

    const evidence = await page.evaluate(async () => {
      const api = window.PrhLocalReadModelStore;
      const dbName = `${api.databaseName}-contract-test`;
      const store = api.createStore({ indexedDB, IDBKeyRange, name: dbName });
      const revision1 = 'a'.repeat(64);
      const revision2 = 'b'.repeat(64);
      const generation1 = '1'.repeat(64);
      const generation2 = '2'.repeat(64);
      const missingGeneration = 'f'.repeat(64);
      const expected1 = { transactions: 2, dimensions: 1, aggregates: 1, sync_journal: 1 };
      const expected2 = { transactions: 1, dimensions: 1, aggregates: 0, sync_journal: 1 };

      await store.wipe();
      const opened = await store.open();
      const initiallyEmpty = await store.getActiveSnapshot();

      await store.beginGeneration({ generationId: generation1, revision: revision1 });
      await store.writeGenerationChunk({
        generationId: generation1,
        revision: revision1,
        transactions: [
          { transaction_id: 'SYN-LOCAL-001', kind: 'SYNTHETIC_ONLY' },
          { transaction_id: 'SYN-LOCAL-002', kind: 'SYNTHETIC_ONLY' }
        ],
        dimensions: [{ dimension_key: 'category:SYN-A', kind: 'SYNTHETIC_ONLY' }],
        aggregates: [{ aggregate_key: 'period:SYN-2026-01', kind: 'SYNTHETIC_ONLY' }],
        sync_journal: [{ sequence: 1, event: 'SYNTHETIC_BOOTSTRAP' }]
      });
      const stagingNotVisible = await store.getActiveSnapshot();
      const activated1 = await store.finalizeGeneration({
        generationId: generation1,
        revision: revision1,
        expectedCounts: expected1
      });
      const snapshot1 = await store.getActiveSnapshot({ includeJournal: true });

      await store.beginGeneration({ generationId: generation2, revision: revision2 });
      await store.writeGenerationChunk({
        generationId: generation2,
        revision: revision2,
        transactions: [{ transaction_id: 'SYN-LOCAL-003', kind: 'SYNTHETIC_ONLY' }]
      });
      const partialGenerationStillOld = await store.getActiveSnapshot();
      const aborted2 = await store.abortGeneration(generation2);
      const afterAbort = await store.getActiveSnapshot();

      let activeAbortCode = '';
      try {
        await store.abortGeneration(generation1);
      } catch (error) {
        activeAbortCode = error.code || '';
      }

      await store.beginGeneration({ generationId: generation2, revision: revision2 });
      await store.writeGenerationChunk({
        generationId: generation2,
        revision: revision2,
        transactions: [{ transaction_id: 'SYN-LOCAL-004', kind: 'SYNTHETIC_ONLY' }],
        dimensions: [{ dimension_key: 'category:SYN-B', kind: 'SYNTHETIC_ONLY' }],
        sync_journal: [{ sequence: 1, event: 'SYNTHETIC_REBUILD' }]
      });
      const activated2 = await store.finalizeGeneration({
        generationId: generation2,
        revision: revision2,
        expectedCounts: expected2
      });
      const snapshot2 = await store.getActiveSnapshot({ includeJournal: true });

      let mismatchCode = '';
      const generation3 = '3'.repeat(64);
      const revision3 = 'c'.repeat(64);
      await store.beginGeneration({ generationId: generation3, revision: revision3 });
      await store.writeGenerationChunk({
        generationId: generation3,
        revision: revision3,
        transactions: [{ transaction_id: 'SYN-LOCAL-005', kind: 'SYNTHETIC_ONLY' }]
      });
      try {
        await store.finalizeGeneration({
          generationId: generation3,
          revision: revision3,
          expectedCounts: { transactions: 2, dimensions: 0, aggregates: 0, sync_journal: 0 }
        });
      } catch (error) {
        mismatchCode = error.code || '';
      }
      const failedFinalizeStillGeneration2 = await store.getActiveSnapshot();
      await store.abortGeneration(generation3);

      await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, api.databaseVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(['meta'], 'readwrite');
          tx.objectStore('meta').put({
            key: 'active_generation',
            generation_id: missingGeneration,
            revision: revision2,
            status: 'ACTIVE'
          });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
      });
      const corruptActive = await store.getActiveSnapshot();
      const rebuilt = await store.rebuild();
      const statusAfterRebuild = await store.status();
      const wiped = await store.wipe();
      const reopened = await store.open();
      const afterWipe = await store.getActiveSnapshot();
      store.close();

      return {
        api: { schema: api.schema, version: api.version, stores: Array.from(api.stores) },
        opened,
        initiallyEmpty,
        stagingNotVisible,
        activated1,
        snapshot1,
        partialGenerationStillOld,
        aborted2,
        afterAbort,
        activeAbortCode,
        activated2,
        snapshot2,
        mismatchCode,
        failedFinalizeStillGeneration2,
        corruptActive,
        rebuilt,
        statusAfterRebuild,
        wiped,
        reopened,
        afterWipe
      };
    });

    assert.deepStrictEqual(localOperationRequests, [], `local IndexedDB operations emitted network requests: ${localOperationRequests.join(' | ')}`);
    assert.strictEqual(evidence.api.schema, 'PRH_LOCAL_READ_MODEL_V1');
    assert.strictEqual(evidence.api.version, '1.0.0');
    assert.deepStrictEqual(evidence.api.stores, ['meta', 'transactions', 'dimensions', 'aggregates', 'sync_journal']);
    assert.strictEqual(evidence.opened.status, 'OPEN');
    assert.strictEqual(evidence.initiallyEmpty.status, 'EMPTY');
    assert.strictEqual(evidence.stagingNotVisible.status, 'EMPTY');

    assert.strictEqual(evidence.activated1.status, 'ACTIVE');
    assert.strictEqual(evidence.snapshot1.status, 'READY');
    assert.strictEqual(evidence.snapshot1.generation_id, '1'.repeat(64));
    assert.strictEqual(evidence.snapshot1.revision, 'a'.repeat(64));
    assert.strictEqual(evidence.snapshot1.transactions.length, 2);
    assert.strictEqual(evidence.snapshot1.dimensions.length, 1);
    assert.strictEqual(evidence.snapshot1.aggregates.length, 1);
    assert.strictEqual(evidence.snapshot1.sync_journal.length, 1);

    assert.strictEqual(evidence.partialGenerationStillOld.status, 'READY');
    assert.strictEqual(evidence.partialGenerationStillOld.generation_id, '1'.repeat(64));
    assert.strictEqual(evidence.aborted2.status, 'ABORTED');
    assert.strictEqual(evidence.afterAbort.generation_id, '1'.repeat(64));
    assert.strictEqual(evidence.activeAbortCode, 'ACTIVE_GENERATION_ABORT_FORBIDDEN');

    assert.strictEqual(evidence.activated2.status, 'ACTIVE');
    assert.strictEqual(evidence.snapshot2.status, 'READY');
    assert.strictEqual(evidence.snapshot2.generation_id, '2'.repeat(64));
    assert.strictEqual(evidence.snapshot2.revision, 'b'.repeat(64));
    assert.strictEqual(evidence.snapshot2.transactions.length, 1);
    assert.strictEqual(evidence.snapshot2.dimensions.length, 1);
    assert.strictEqual(evidence.snapshot2.aggregates.length, 0);
    assert.strictEqual(evidence.snapshot2.sync_journal.length, 1);

    assert.strictEqual(evidence.mismatchCode, 'GENERATION_COUNT_MISMATCH');
    assert.strictEqual(evidence.failedFinalizeStillGeneration2.status, 'READY');
    assert.strictEqual(evidence.failedFinalizeStillGeneration2.generation_id, '2'.repeat(64));

    assert.strictEqual(evidence.corruptActive.status, 'REBUILD_REQUIRED');
    assert.strictEqual(evidence.corruptActive.reason, 'ACTIVE_MANIFEST_INVALID');
    assert.strictEqual(evidence.rebuilt.status, 'EMPTY');
    assert.strictEqual(evidence.statusAfterRebuild.status, 'EMPTY');
    assert.strictEqual(evidence.wiped.status, 'WIPED');
    assert.strictEqual(evidence.reopened.status, 'OPEN');
    assert.strictEqual(evidence.afterWipe.status, 'EMPTY');

    console.log('Local Read Model IndexedDB adapter: PASS', {
      schema: evidence.api.schema,
      generationSwitch: 'PASS',
      partialVisibility: false,
      failedFinalizePreservedPrevious: true,
      corruptionFailClosed: true,
      explicitWipe: true,
      localNetworkRequests: localOperationRequests.length
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
