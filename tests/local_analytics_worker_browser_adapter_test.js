'use strict';

const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const { QUERY_SCHEMA, evaluateAnalytics } = require('../lib/analytics/analytics_engine');
const { buildWorkerBundle } = require('../tools/build-local-analytics-worker');

const root = path.resolve(__dirname, '..');
const workerBundle = buildWorkerBundle({ root }).source;

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function transaction(index, category, amount, occurredAt) {
  return {
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: `worker-syn-${index}`,
    occurred_at: occurredAt,
    type: 'expense',
    status: 'posted',
    amount_minor: amount,
    currency: 'RUB',
    account_id: 'acc-worker-syn',
    destination_account_id: null,
    category_id: category,
    member_id: null,
    project_id: null,
    tags: ['synthetic-worker'],
    counterparty: null,
    description: `Synthetic Worker ${index}`,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC_TEST',
      source_container: 'worker-parity',
      source_record_id: `worker-${index}`,
      source_fingerprint: fingerprint(`worker:${index}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYN-WORKER-LF-001-v1',
      source_position: null
    }
  };
}

function query() {
  return {
    schema: QUERY_SCHEMA,
    contract_version: '1.0.0',
    currency: 'RUB',
    measures: ['EXPENSE', 'CASH_FLOW'],
    dimensions: ['category_id'],
    filters: [],
    time_range: { start: '2026-01-01', end: '2026-03-01' },
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [{ kind: 'MEASURE', key: 'EXPENSE', direction: 'DESC' }],
    parameters: {},
    limit: 5000
  };
}

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
  const fixture = [
    transaction(1, 'cat-a', 12000, '2026-01-10T09:00:00Z'),
    transaction(2, 'cat-b', 8000, '2026-01-11T09:00:00Z'),
    transaction(3, 'cat-a', 5000, '2026-02-12T09:00:00Z')
  ];
  const analyticsQuery = query();
  const directCanonical = evaluateAnalytics(fixture, analyticsQuery);
  const html = '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body>worker harness</body></html>';

  const server = http.createServer((request, response) => {
    if (request.url === '/worker.js') {
      response.writeHead(200, {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-store'
      });
      response.end(workerBundle);
      return;
    }
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store'
    });
    response.end(html);
  });

  const address = await listen(server);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const allRequests = [];
  const postReadyRequests = [];
  let measurePostReadyNetwork = false;
  page.on('request', (request) => {
    allRequests.push({ url: request.url(), type: request.resourceType() });
    if (measurePostReadyNetwork) postReadyRequests.push({ url: request.url(), type: request.resourceType() });
  });

  try {
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load', timeout: 15000 });
    const ready = await page.evaluate(async () => {
      window.__lfWorkerMessages = [];
      window.__lfWorker = new Worker('/worker.js');
      window.__lfWorker.onmessage = (event) => {
        window.__lfWorkerMessages.push(event.data);
        window.dispatchEvent(new Event('lf-worker-message'));
      };
      window.__lfWaitForWorker = (predicate, timeoutMs = 5000) => new Promise((resolve, reject) => {
        const existing = window.__lfWorkerMessages.find(predicate);
        if (existing) {
          resolve(existing);
          return;
        }
        let timer = null;
        const onMessage = () => {
          const found = window.__lfWorkerMessages.find(predicate);
          if (!found) return;
          window.removeEventListener('lf-worker-message', onMessage);
          if (timer) clearTimeout(timer);
          resolve(found);
        };
        window.addEventListener('lf-worker-message', onMessage);
        timer = setTimeout(() => {
          window.removeEventListener('lf-worker-message', onMessage);
          reject(new Error('WORKER_TEST_MESSAGE_TIMEOUT'));
        }, timeoutMs);
      });
      const readyPromise = window.__lfWaitForWorker((message) => message.type === 'READY');
      window.__lfWorker.postMessage({ type: 'INIT' });
      return readyPromise;
    });

    assert.strictEqual(ready.type, 'READY');
    assert.strictEqual(ready.schema, 'PRH_LOCAL_ANALYTICS_WORKER_V1');
    assert.strictEqual(ready.version, '1.0.0');
    assert(allRequests.some((item) => item.url.endsWith('/worker.js')), 'real browser Worker script was not requested');

    measurePostReadyNetwork = true;
    const evidence = await page.evaluate(async ({ fixture, analyticsQuery }) => {
      const worker = window.__lfWorker;
      const wait = window.__lfWaitForWorker;
      const gen1 = '1'.repeat(64);
      const rev1 = 'a'.repeat(64);
      const gen2 = '2'.repeat(64);
      const rev2 = 'b'.repeat(64);
      const gen3 = '3'.repeat(64);
      const rev3 = 'c'.repeat(64);
      const wrongRevision = 'f'.repeat(64);

      worker.postMessage({ type: 'SET_REVISION', generation_id: gen1, revision: rev1 });

      const mismatchPromise = wait((message) => message.request_id === 'mismatch-1');
      worker.postMessage({
        type: 'ANALYTICS_QUERY',
        request_id: 'mismatch-1',
        generation_id: gen1,
        revision: wrongRevision,
        transactions: fixture,
        query: analyticsQuery
      });
      const mismatch = await mismatchPromise;

      const cancelPromise = wait((message) => message.request_id === 'cancel-1');
      worker.postMessage({
        type: 'ANALYTICS_QUERY',
        request_id: 'cancel-1',
        generation_id: gen1,
        revision: rev1,
        transactions: fixture,
        query: analyticsQuery
      });
      worker.postMessage({ type: 'CANCEL_GENERATION', generation_id: gen1 });
      const cancelled = await cancelPromise;

      worker.postMessage({ type: 'SET_REVISION', generation_id: gen2, revision: rev2 });
      const parityPromise = wait((message) => message.request_id === 'parity-1');
      worker.postMessage({
        type: 'ANALYTICS_QUERY',
        request_id: 'parity-1',
        generation_id: gen2,
        revision: rev2,
        transactions: fixture,
        query: analyticsQuery
      });
      const parity = await parityPromise;

      const switchedPromise = wait((message) => message.request_id === 'switch-stale-1');
      worker.postMessage({
        type: 'ANALYTICS_QUERY',
        request_id: 'switch-stale-1',
        generation_id: gen2,
        revision: rev2,
        transactions: fixture,
        query: analyticsQuery
      });
      worker.postMessage({ type: 'SET_REVISION', generation_id: gen3, revision: rev3 });
      const switched = await switchedPromise;

      return {
        mismatch,
        cancelled,
        parity,
        switched,
        allMessages: window.__lfWorkerMessages.slice()
      };
    }, { fixture, analyticsQuery });

    measurePostReadyNetwork = false;

    assert.strictEqual(evidence.mismatch.type, 'STALE_DISCARDED');
    assert.strictEqual(evidence.mismatch.reason, 'BINDING_NOT_CURRENT');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(evidence.mismatch, 'result'), false);
    assert.strictEqual(evidence.cancelled.type, 'STALE_DISCARDED');
    assert.strictEqual(evidence.cancelled.reason, 'STALE_BEFORE_EVALUATE');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(evidence.cancelled, 'result'), false);
    assert.strictEqual(evidence.switched.type, 'STALE_DISCARDED');
    assert.strictEqual(evidence.switched.reason, 'STALE_BEFORE_EVALUATE');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(evidence.switched, 'result'), false);

    assert.strictEqual(evidence.parity.type, 'ANALYTICS_RESULT');
    assert.strictEqual(evidence.parity.generation_id, '2'.repeat(64));
    assert.strictEqual(evidence.parity.revision, 'b'.repeat(64));
    assert.deepStrictEqual(evidence.parity.result, directCanonical,
      'Worker analytics must be exactly parity-equivalent to direct canonical evaluateAnalytics');

    for (const message of evidence.allMessages.filter((item) => item.type === 'STALE_DISCARDED' || item.type === 'ERROR')) {
      assert.strictEqual(Object.prototype.hasOwnProperty.call(message, 'transactions'), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(message, 'query'), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(message, 'result'), false);
    }
    assert.deepStrictEqual(postReadyRequests, [], `Worker emitted network after READY: ${JSON.stringify(postReadyRequests)}`);

    await page.evaluate(() => window.__lfWorker.terminate());

    console.log('Local Analytics Worker browser adapter: PASS', {
      realWorker: true,
      canonicalParity: true,
      mismatchDiscard: evidence.mismatch.reason,
      cancellationDiscard: evidence.cancelled.reason,
      generationSwitchDiscard: evidence.switched.reason,
      postReadyNetworkRequests: postReadyRequests.length,
      financialWriteAuthority: false
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
