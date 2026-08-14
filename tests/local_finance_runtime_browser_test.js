'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { repositoryRevision } = require('../lib/repository/transaction_repository');
const { evaluateAnalytics } = require('../lib/analytics/analytics_engine');
const financeNode = require('../pwa/local_finance_runtime');
const { buildWorkerBundle } = require('../tools/build-local-analytics-worker');

const ROOT = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(ROOT, 'pwa/local_read_model_store.js'), 'utf8');
const financeSource = fs.readFileSync(path.join(ROOT, 'pwa/local_finance_runtime.js'), 'utf8');
const workerBundle = buildWorkerBundle({ root: ROOT });

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function tx(index, overrides = {}) {
  const type = overrides.type || 'expense';
  return Object.freeze({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: `fin-lf-${String(index).padStart(3, '0')}`,
    occurred_at: overrides.occurred_at || `2026-${String(Math.min(index, 12)).padStart(2, '0')}-10T12:00:00Z`,
    type,
    status: 'posted',
    amount_minor: overrides.amount_minor == null ? 10000 : overrides.amount_minor,
    currency: 'RUB',
    account_id: 'acc-main',
    destination_account_id: type === 'transfer' ? 'acc-second' : null,
    category_id: overrides.category_id || (type === 'income' ? 'cat-income' : 'cat-home'),
    member_id: 'member-a',
    project_id: 'project-home',
    tags: ['synthetic'],
    counterparty: null,
    description: `Synthetic FIN-LF transaction ${index}`,
    reverses_transaction_id: type === 'refund' ? 'fin-lf-002' : null,
    adjustment_semantics: type === 'refund' ? 'expense_reduction' : null,
    provenance: Object.freeze({
      source_system: 'SYNTHETIC_TEST',
      source_container: 'fin-lf-browser',
      source_record_id: `record-${index}`,
      source_fingerprint: fingerprint(`fin-lf:${index}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'FIN-LF-SYN-v1',
      source_position: null
    })
  });
}

const transactions = Object.freeze([
  tx(1, { type: 'income', amount_minor: 120000, occurred_at: '2026-01-05T10:00:00Z', category_id: 'cat-salary' }),
  tx(2, { type: 'expense', amount_minor: 30000, occurred_at: '2026-01-10T10:00:00Z', category_id: 'cat-home' }),
  tx(3, { type: 'refund', amount_minor: 5000, occurred_at: '2026-01-15T10:00:00Z', category_id: 'cat-home' }),
  tx(4, { type: 'expense', amount_minor: 18000, occurred_at: '2026-02-05T10:00:00Z', category_id: 'cat-food' }),
  tx(5, { type: 'income', amount_minor: 35000, occurred_at: '2026-02-20T10:00:00Z', category_id: 'cat-bonus' }),
  tx(6, { type: 'expense', amount_minor: 12000, occurred_at: '2026-03-04T10:00:00Z', category_id: 'cat-food' }),
  tx(7, { type: 'income', amount_minor: 90000, occurred_at: '2026-03-25T10:00:00Z', category_id: 'cat-salary' }),
  tx(8, { type: 'expense', amount_minor: 22000, occurred_at: '2026-04-02T10:00:00Z', category_id: 'cat-home' }),
  tx(9, { type: 'expense', amount_minor: 7000, occurred_at: '2026-04-18T10:00:00Z', category_id: 'cat-fun' }),
  tx(10, { type: 'income', amount_minor: 15000, occurred_at: '2026-04-28T10:00:00Z', category_id: 'cat-bonus' })
]);
const revision = repositoryRevision(transactions);
const dimensions = Object.freeze([
  { dimension_key: 'category|cat-salary', kind: 'category', dimension_id: 'cat-salary', label: 'Зарплата' },
  { dimension_key: 'category|cat-bonus', kind: 'category', dimension_id: 'cat-bonus', label: 'Премия' },
  { dimension_key: 'category|cat-home', kind: 'category', dimension_id: 'cat-home', label: 'Дом' },
  { dimension_key: 'category|cat-food', kind: 'category', dimension_id: 'cat-food', label: 'Продукты' },
  { dimension_key: 'category|cat-fun', kind: 'category', dimension_id: 'cat-fun', label: 'Отдых' }
]);
const snapshotForNode = { status: 'READY', generation_id: revision, revision, transactions, dimensions };
const homeSpecs = financeNode.routeQueries('home', snapshotForNode, { currency: 'RUB' });
const directHome = Object.fromEntries(homeSpecs.map((spec) => [spec.key, evaluateAnalytics(transactions, spec.query)]));

const harness = `<!doctype html><html><body><script>${storeSource}</script><script>${financeSource}</script><script>window.__WORKER__=${JSON.stringify(workerBundle.source)};</script></body></html>`;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}
function closeServer(server) { return new Promise((resolve) => server.close(resolve)); }

(async () => {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(harness);
  });
  const address = await listen(server);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const localRequests = [];
  let measure = false;
  page.on('request', (request) => { if (measure) localRequests.push(request.url()); });

  try {
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.PrhLocalReadModelStore && !!window.PrhLocalFinanceRuntime && !!window.__WORKER__);
    measure = true;
    const browserResult = await page.evaluate(async ({ transactions, dimensions, revision }) => {
      const store = PrhLocalReadModelStore.createStore({ indexedDB, IDBKeyRange, name: 'fin-lf-runtime-' + Date.now() });
      await store.wipe();
      await store.beginGeneration({ generationId: revision, revision });
      await store.writeGenerationChunk({
        generationId: revision,
        revision,
        transactions,
        dimensions,
        aggregates: [],
        sync_journal: [{ sequence: 1, event: 'SYNTHETIC_FIN_LF_BOOTSTRAP', revision }]
      });
      await store.finalizeGeneration({
        generationId: revision,
        revision,
        expectedCounts: { transactions: transactions.length, dimensions: dimensions.length, aggregates: 0, sync_journal: 1 }
      });

      const worker = PrhLocalFinanceRuntime.createWorkerClient({ bundleSource: window.__WORKER__ });
      const states = [];
      const runtime = PrhLocalFinanceRuntime.createRuntime({ store, workerClient: worker, onState: (state) => states.push(state) });
      await runtime.start('home');
      const home = runtime.getState();

      const raceExpenses = runtime.setRoute('expenses');
      const raceIncome = runtime.setRoute('income');
      const race = await Promise.all([raceExpenses, raceIncome]);
      const afterRace = runtime.getState();

      const sharedFilter = {
        currency: 'RUB',
        start: '2026-02-01',
        end: '2026-05-01',
        category_id: null,
        account_id: null,
        member_id: null,
        project_id: null
      };
      await runtime.setFilterContext(sharedFilter);
      const incomeFiltered = runtime.getState();
      await runtime.setRoute('expenses');
      const expensesFiltered = runtime.getState();
      await runtime.setRoute('cash-flow');
      const cashFlowFiltered = runtime.getState();
      await runtime.setRoute('home');
      const homeFiltered = runtime.getState();

      const categoryFilter = Object.assign({}, sharedFilter, { category_id: 'cat-food' });
      await runtime.setFilterContext(categoryFilter);
      const categoryHome = runtime.getState();
      await runtime.setRoute('expenses');
      const categoryExpenses = runtime.getState();

      const beforeWipe = await store.status();
      await store.wipe();
      worker.dispose();
      store.close();
      return {
        home,
        race,
        afterRace,
        incomeFiltered,
        expensesFiltered,
        cashFlowFiltered,
        homeFiltered,
        categoryHome,
        categoryExpenses,
        beforeWipe,
        stateCount: states.length
      };
    }, { transactions, dimensions, revision });

    assert.strictEqual(browserResult.home.snapshot_status, 'READY');
    assert.strictEqual(browserResult.home.revision, revision);
    assert.strictEqual(browserResult.home.generation_id, revision);
    assert.strictEqual(browserResult.home.view.status, 'READY');
    assert.strictEqual(browserResult.home.view.route, 'home');
    assert.strictEqual(browserResult.home.view.provenance.input_revision, revision);
    assert.strictEqual(browserResult.home.view.provenance.canonical_worker_only, true);
    assert.strictEqual(browserResult.home.view.provenance.ui_financial_formula_used, false);
    assert.deepStrictEqual(browserResult.home.view.results.totals.rows, directHome.totals.rows, 'real Worker Home totals must equal direct canonical evaluator');
    assert.deepStrictEqual(browserResult.home.view.results.trend.rows, directHome.trend.rows, 'real Worker Home trend must equal direct canonical evaluator');

    assert(browserResult.race.some((entry) => entry.status === 'STALE_DISCARDED'), 'overlapped route render must discard at least one stale completion');
    assert.strictEqual(browserResult.afterRace.route, 'income');
    assert.strictEqual(browserResult.afterRace.view.route, 'income');
    assert.strictEqual(browserResult.afterRace.revision, revision);

    for (const state of [browserResult.incomeFiltered, browserResult.expensesFiltered, browserResult.cashFlowFiltered, browserResult.homeFiltered]) {
      assert.strictEqual(state.snapshot_status, 'READY');
      assert.strictEqual(state.revision, revision, 'all finance routes must use the same verified snapshot revision');
      assert.deepStrictEqual(state.filter_context, browserResult.incomeFiltered.filter_context, 'shared FilterContext must survive route changes');
      assert.strictEqual(state.view.provenance.input_revision, revision);
      assert.strictEqual(state.view.provenance.canonical_worker_only, true);
      assert.strictEqual(state.view.provenance.ui_financial_formula_used, false);
    }
    assert.strictEqual(browserResult.categoryHome.filter_context.category_id, 'cat-food');
    assert.strictEqual(browserResult.categoryExpenses.filter_context.category_id, 'cat-food');
    assert.strictEqual(browserResult.categoryExpenses.revision, revision);
    assert.strictEqual(browserResult.categoryExpenses.view.results.breakdown.rows.length, 1);
    assert.strictEqual(browserResult.categoryExpenses.view.results.breakdown.rows[0].dimensions.category_id, 'cat-food');

    assert.strictEqual(browserResult.beforeWipe.status, 'READY');
    assert(browserResult.stateCount >= 10);
    assert.deepStrictEqual(localRequests, [], `warm finance route/filter/Worker operations emitted network requests: ${localRequests.join(' | ')}`);

    console.log('local_finance_runtime_browser_adapter_test: PASS', {
      oneVerifiedSnapshot: true,
      sharedFilterContext: true,
      canonicalWorkerParity: true,
      staleDiscard: true,
      warmNetworkRequests: localRequests.length
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
