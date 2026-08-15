'use strict';

const assert = require('assert');
const finance = require('../pwa/local_finance_runtime');

const REVISION = 'c'.repeat(64);

function snapshot() {
  return Object.freeze({
    status:'READY',
    generation_id:REVISION,
    revision:REVISION,
    counts:Object.freeze({ transactions:1, dimensions:0, aggregates:0, sync_journal:0 }),
    transactions:Object.freeze([{ transaction_id:'SYN-1', currency:'RUB', occurred_at:'2026-01-01T00:00:00Z' }]),
    dimensions:Object.freeze([]),
    aggregates:Object.freeze([])
  });
}

function analyticsResult() {
  return Object.freeze({
    schema:'PRH_ANALYTICS_RESULT_V1',
    contract_version:'1.0.0',
    rows:Object.freeze([]),
    provenance:Object.freeze({ financial_truth_policy:'FIN-TRUTH-v1', input_revision:REVISION })
  });
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

(async () => {
  let putCalls = 0;
  let activePuts = 0;
  let maxActivePuts = 0;
  const putRoutes = [];
  const startupViewCache = {
    async readActiveMetadata() { return null; },
    async get() { return null; },
    async put(view) {
      putCalls += 1;
      putRoutes.push(view.route);
      activePuts += 1;
      maxActivePuts = Math.max(maxActivePuts, activePuts);
      await delay(30);
      activePuts -= 1;
      return true;
    }
  };

  const runtime = finance.createRuntime({
    store:{
      async getActiveSnapshot() { return snapshot(); },
      async status() { return { status:'READY', generation_id:REVISION, revision:REVISION }; }
    },
    workerClient:{
      async bind() { return true; },
      async query() { return { result:analyticsResult() }; }
    },
    startupViewCache
  });

  await runtime.start('home');

  // Re-applying the exact default filter creates new canonical READY view objects,
  // but must not enqueue repeated persisted startup-cache writes for the same
  // revision + route identity while the first write is pending or after it lands.
  for (let i = 0; i < 10; i += 1) {
    await runtime.setFilterContext({ currency:'RUB' });
  }

  await runtime.setRoute('expenses');
  await runtime.setRoute('income');
  await runtime.setRoute('cash-flow');

  await delay(180);
  assert.strictEqual(maxActivePuts, 1, 'startup persisted view writes must be serialized, never concurrent');
  assert.strictEqual(putCalls, 4, 'one persisted write per exact revision + eligible finance route is sufficient');
  assert.deepStrictEqual(putRoutes, ['home', 'expenses', 'income', 'cash-flow']);

  const callsAfterFirstPersistence = putCalls;
  await runtime.setRoute('home');
  await runtime.setFilterContext({ currency:'RUB' });
  await runtime.setRoute('expenses');
  await delay(60);
  assert.strictEqual(putCalls, callsAfterFirstPersistence, 'already persisted exact revision/route views must not be rewritten');

  console.log('local_finance_startup_persistence_runtime_test: PASS', {
    repeatedDefaultFilterWritesCoalesced:true,
    exactRevisionRouteDedup:true,
    serializedPersistence:true,
    putCalls,
    maxActivePuts
  });
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
