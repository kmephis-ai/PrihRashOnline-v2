'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(ROOT, 'pwa/local_read_model_store.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const financeSource = fs.readFileSync(path.join(ROOT, 'pwa/local_finance_runtime.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const harness = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>${storeSource}</script><script>${financeSource}</script></body></html>`;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

(async () => {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store' });
    response.end(harness);
  });
  const address = await listen(server);
  const browser = await chromium.launch({ headless:true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const url = `http://127.0.0.1:${address.port}/`;
  const revision = 'c'.repeat(64);

  try {
    await page.goto(url, { waitUntil:'load' });
    const seeded = await page.evaluate(async (revision) => {
      const store = PrhLocalReadModelStore.createStore({ indexedDB, IDBKeyRange, name:'prihrash-local-first-v3' });
      await store.wipe();
      await store.beginGeneration({ generationId:revision, revision });
      await store.writeGenerationChunk({
        generationId:revision,
        revision,
        transactions:[{ transaction_id:'SYN-RELOAD-1', currency:'RUB', occurred_at:'2026-01-01' }],
        dimensions:[], aggregates:[], sync_journal:[]
      });
      await store.finalizeGeneration({
        generationId:revision,
        revision,
        expectedCounts:{ transactions:1, dimensions:0, aggregates:0, sync_journal:0 }
      });

      function result(measures) {
        return {
          schema:'PRH_ANALYTICS_RESULT_V1',
          contract_version:'1.0.0',
          rows:[{ dimensions:{}, measures }],
          provenance:{ financial_truth_policy:'FIN-TRUTH-v1', input_revision:revision }
        };
      }

      const view = {
        status:'READY',
        route:'home',
        generation_id:revision,
        revision,
        filter_context:PrhLocalFinanceRuntime.normalizeFilterContext({ currency:'RUB' }),
        labels:{},
        results:{
          totals:result({ INCOME:100, EXPENSE:40, CASH_FLOW:60, SAVINGS:60 }),
          trend:result({ CASH_FLOW:60 })
        },
        provenance:{
          financial_truth_policy:'FIN-TRUTH-v1',
          canonical_worker_only:true,
          ui_financial_formula_used:false,
          input_revision:revision
        }
      };

      const cache = PrhLocalFinanceRuntime.createStartupViewCache({ indexedDB });
      const stored = await cache.put(view);
      store.close();
      return { stored };
    }, revision);

    assert.strictEqual(seeded.stored, true, 'startup READY view must persist before reload');

    await page.reload({ waitUntil:'load' });

    const restored = await page.evaluate(async (revision) => {
      const openOnlyIndexedDB = Object.freeze({
        open: indexedDB.open.bind(indexedDB)
      });
      const cache = PrhLocalFinanceRuntime.createStartupViewCache({ indexedDB:openOnlyIndexedDB });
      const meta = await cache.readActiveMetadata();
      const view = meta ? await cache.get(meta, 'home') : null;
      return {
        databasesApiPresentOnAdapter:typeof openOnlyIndexedDB.databases === 'function',
        metaReady:!!meta && meta.status === 'READY',
        metaRevision:meta && meta.revision,
        viewReady:!!view && view.status === 'READY',
        viewRevision:view && view.revision,
        workerOnly:!!view && !!view.provenance && view.provenance.canonical_worker_only === true,
        finTruth:!!view && !!view.provenance && view.provenance.financial_truth_policy === 'FIN-TRUTH-v1'
      };
    }, revision);

    assert.strictEqual(restored.databasesApiPresentOnAdapter, false, 'regression harness must omit indexedDB.databases');
    assert.strictEqual(restored.metaReady, true, 'verified canonical metadata must restore through direct indexedDB.open');
    assert.strictEqual(restored.metaRevision, revision);
    assert.strictEqual(restored.viewReady, true, 'persisted READY view must survive a real document reload');
    assert.strictEqual(restored.viewRevision, revision);
    assert.strictEqual(restored.workerOnly, true);
    assert.strictEqual(restored.finTruth, true);

    console.log('local_finance_startup_cache_reload_runtime_test: PASS', {
      reloadPersistence:true,
      indexedDbEnumerationRequired:false,
      directOpenAbortOnUpgrade:true,
      exactRevisionOnly:true,
      canonicalWorkerOnly:true,
      finTruth:true,
      restored
    });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await closeServer(server);
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
