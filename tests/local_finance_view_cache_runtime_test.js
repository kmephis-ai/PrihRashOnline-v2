'use strict';

const assert = require('assert');
const finance = require('../pwa/local_finance_runtime');

const REV_A = 'a'.repeat(64);
const REV_B = 'b'.repeat(64);

function snapshot(revision) {
  return Object.freeze({
    status: 'READY',
    generation_id: revision,
    revision,
    transactions: Object.freeze([
      Object.freeze({ currency: 'RUB', occurred_at: '2026-01-15T12:00:00Z' })
    ]),
    dimensions: Object.freeze([]),
    aggregates: Object.freeze([])
  });
}

let activeSnapshot = snapshot(REV_A);
let queryCount = 0;
let bindCount = 0;
const states = [];

const store = {
  async getActiveSnapshot() { return activeSnapshot; },
  async status() { return { status: 'READY' }; }
};

const workerClient = {
  async bind() { bindCount += 1; return true; },
  async query(current) {
    queryCount += 1;
    return {
      result: Object.freeze({
        schema: 'PRH_ANALYTICS_RESULT_V1',
        contract_version: '1.0.0',
        rows: Object.freeze([]),
        provenance: Object.freeze({
          financial_truth_policy: 'FIN-TRUTH-v1',
          input_revision: current.revision
        })
      })
    };
  }
};

(async () => {
  const runtime = finance.createRuntime({
    store,
    workerClient,
    onState: (state) => states.push(state)
  });

  await runtime.start('home');
  assert.strictEqual(queryCount, 2, 'initial Home must be computed by canonical worker');

  await runtime.setRoute('expenses');
  assert.strictEqual(queryCount, 4, 'first Expenses visit must be computed');

  let stateIndex = states.length;
  await runtime.setRoute('home');
  assert.strictEqual(queryCount, 4, 'return to Home on same revision/filter must reuse READY view');
  let emitted = states.slice(stateIndex);
  assert.strictEqual(emitted.length, 1, 'cache hit must emit one stable state without LOADING churn');
  assert.strictEqual(emitted[0].view.status, 'READY');
  assert.strictEqual(emitted[0].view.route, 'home');
  assert.strictEqual(emitted[0].view.revision, REV_A);

  stateIndex = states.length;
  await runtime.setRoute('expenses');
  assert.strictEqual(queryCount, 4, 'Back/Forward-style return to Expenses must reuse READY view');
  emitted = states.slice(stateIndex);
  assert.strictEqual(emitted.length, 1);
  assert.strictEqual(emitted[0].view.status, 'READY');

  await runtime.setFilterContext({ currency: 'RUB', account_id: 'acc-1' });
  assert.strictEqual(queryCount, 6, 'new filter context must not reuse old-filter cache');
  await runtime.setRoute('home');
  assert.strictEqual(queryCount, 8, 'Home under new filter must be computed once');
  await runtime.setRoute('expenses');
  assert.strictEqual(queryCount, 8, 'Expenses under same new filter must then be cached');

  activeSnapshot = snapshot(REV_B);
  await runtime.start('home');
  assert.strictEqual(queryCount, 10, 'new verified revision must invalidate all prior READY views');
  assert.strictEqual(runtime.getState().revision, REV_B);
  assert.strictEqual(runtime.getState().view.revision, REV_B);

  await runtime.setRoute('expenses');
  assert.strictEqual(queryCount, 12, 'first Expenses view on new revision must be recomputed');
  await runtime.setRoute('home');
  assert.strictEqual(queryCount, 12, 'new-revision Home may be reused only after recomputation');

  assert(bindCount >= 2, 'verified snapshots must still bind to canonical worker');
  assert.strictEqual(runtime.getState().view.provenance.financial_truth_policy, 'FIN-TRUTH-v1');
  assert.strictEqual(runtime.getState().view.provenance.canonical_worker_only, true);
  assert.strictEqual(runtime.getState().view.provenance.ui_financial_formula_used, false);

  console.log('local_finance_view_cache_test: PASS', {
    boundedInMemoryReadyViewReuse: true,
    sameRevisionFilterRouteOnly: true,
    filterChangeRecomputes: true,
    revisionChangeInvalidates: true,
    cacheHitSkipsLoadingChurn: true,
    canonicalWorkerTruthPreserved: true,
    queryCount
  });
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
