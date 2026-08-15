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
function closeServer(server) { return new Promise((resolve) => server.close(resolve)); }

(async () => {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store' });
    response.end(harness);
  });
  const address = await listen(server);
  const browser = await chromium.launch({ headless:true });
  const context = await browser.newContext();
  const url = `http://127.0.0.1:${address.port}/`;
  const revision = 'a'.repeat(64);
  const nextRevision = 'b'.repeat(64);
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil:'load' });
    const evidence = await page.evaluate(async ({ revision, nextRevision }) => {
      const store = PrhLocalReadModelStore.createStore({ indexedDB, IDBKeyRange, name:'prihrash-local-first-v1' });
      await store.wipe();
      await store.beginGeneration({ generationId:revision, revision });
      await store.writeGenerationChunk({
        generationId:revision,
        revision,
        transactions:[{ transaction_id:'SYN-1', currency:'RUB', occurred_at:'2026-01-01' }],
        dimensions:[], aggregates:[], sync_journal:[]
      });
      await store.finalizeGeneration({
        generationId:revision,
        revision,
        expectedCounts:{ transactions:1, dimensions:0, aggregates:0, sync_journal:0 }
      });

      function result(measure) {
        return {
          schema:'PRH_ANALYTICS_RESULT_V1',
          contract_version:'1.0.0',
          rows:[{ dimensions:{}, measures:{ [measure]:100 } }],
          provenance:{ financial_truth_policy:'FIN-TRUTH-v1', input_revision:revision }
        };
      }
      const filter = PrhLocalFinanceRuntime.normalizeFilterContext({ currency:'RUB' });
      const homeView = {
        status:'READY', route:'home', generation_id:revision, revision,
        filter_context:filter,
        labels:{},
        results:{ totals:result('INCOME'), trend:result('CASH_FLOW') },
        provenance:{
          financial_truth_policy:'FIN-TRUTH-v1', canonical_worker_only:true,
          ui_financial_formula_used:false, input_revision:revision
        }
      };
      const startupCache = PrhLocalFinanceRuntime.createStartupViewCache({ indexedDB });
      if (!(await startupCache.put(homeView))) throw new Error('startup cache seed failed');
      const meta = await startupCache.readActiveMetadata();
      if (!meta || meta.status !== 'READY' || meta.revision !== revision) throw new Error('metadata fast path failed');
      const restored = await startupCache.get(meta, 'home');
      if (!restored || restored.revision !== revision) throw new Error('startup view restore failed');

      let binds = 0;
      let queries = 0;
      const states = [];
      const started = performance.now();
      const slowSnapshot = {
        status:'READY', generation_id:revision, revision,
        counts:{ transactions:1, dimensions:0, aggregates:0, sync_journal:0 },
        transactions:[{ transaction_id:'SYN-1', currency:'RUB', occurred_at:'2026-01-01' }],
        dimensions:[], aggregates:[]
      };
      const fakeStore = {
        status: async () => ({ status:'READY' }),
        getActiveSnapshot: () => new Promise((resolve) => setTimeout(() => resolve(slowSnapshot), 1200))
      };
      const fakeWorker = {
        bind: async () => { binds += 1; },
        query: async () => { queries += 1; throw new Error('restored startup view must avoid initial query'); }
      };
      const runtime = PrhLocalFinanceRuntime.createRuntime({
        store:fakeStore,
        workerClient:fakeWorker,
        startupViewCache:startupCache,
        onState:(state) => states.push({
          t:performance.now() - started,
          sync:state.sync_status,
          view:state.view && state.view.status,
          revision:state.revision
        })
      });
      const startPromise = runtime.start('home');
      await new Promise((resolve) => setTimeout(resolve, 100));
      const earlyReady = states.find((state) => state.view === 'READY' && state.sync === 'READY');
      if (!earlyReady) throw new Error('no early READY before full hydration');
      await startPromise;

      await store.beginGeneration({ generationId:nextRevision, revision:nextRevision });
      await store.writeGenerationChunk({
        generationId:nextRevision,
        revision:nextRevision,
        transactions:[{ transaction_id:'SYN-2', currency:'RUB', occurred_at:'2026-01-02' }],
        dimensions:[], aggregates:[], sync_journal:[]
      });
      await store.finalizeGeneration({
        generationId:nextRevision,
        revision:nextRevision,
        expectedCounts:{ transactions:1, dimensions:0, aggregates:0, sync_journal:0 }
      });
      const nextMeta = await startupCache.readActiveMetadata();
      const staleLookup = await startupCache.get(nextMeta, 'home');
      store.close();
      return {
        earlyReadyMs:earlyReady.t,
        binds,
        queries,
        finalView:runtime.getState().view.status,
        oldRevision:revision,
        nextRevision:nextMeta.revision,
        staleLookup:staleLookup === null,
        states
      };
    }, { revision, nextRevision });

    assert(evidence.earlyReadyMs < 800, `cached startup READY ${evidence.earlyReadyMs}ms must stay below 800ms even while full hydration is 1200ms`);
    assert.strictEqual(evidence.binds, 1, 'full canonical Worker bind must still happen after fast paint');
    assert.strictEqual(evidence.queries, 0, 'exact restored view must seed in-memory cache and avoid duplicate initial query');
    assert.strictEqual(evidence.finalView, 'READY');
    assert.strictEqual(evidence.nextRevision, nextRevision);
    assert.strictEqual(evidence.staleLookup, true, 'old-revision persisted view must never restore for a new active revision');
    assert(evidence.states.some((state) => state.sync === 'LOCAL_OPENING'));
    assert(evidence.states.some((state) => state.sync === 'READY' && state.view === 'READY'));
    console.log('local_finance_startup_view_cache_runtime_test: PASS', {
      exactRevisionOnly:true,
      canonicalWorkerProvenanceOnly:true,
      earlyReadyBeforeSlowHydration:true,
      cachedReadyUnder800Ms:true,
      staleRevisionRejected:true,
      noInitialDuplicateWorkerQuery:true,
      evidence
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
