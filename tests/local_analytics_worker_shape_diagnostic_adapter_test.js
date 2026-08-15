'use strict';

const assert = require('assert');
const { chromium } = require('playwright');
const { buildWorkerBundle } = require('../tools/build-local-analytics-worker');

const REVISION = 'a'.repeat(64);

function canonicalTransaction() {
  return {
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: 'shape-diag-001',
    occurred_at: '2026-08-15T00:00:00Z',
    type: 'expense',
    status: 'posted',
    amount_minor: 12345,
    currency: 'RUB',
    account_id: 'acc-main',
    destination_account_id: null,
    category_id: 'cat-home',
    member_id: null,
    project_id: null,
    tags: ['synthetic'],
    counterparty: null,
    description: null,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC_TEST',
      source_container: 'shape-diag',
      source_record_id: 'row-1',
      source_fingerprint: 'b'.repeat(64),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYN-v1',
      source_position: null
    }
  };
}

function query() {
  return {
    schema: 'PRH_ANALYTICS_QUERY_V1',
    contract_version: '1.0.0',
    currency: 'RUB',
    measures: ['EXPENSE'],
    dimensions: [],
    filters: [],
    time_range: null,
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 200
  };
}

(async () => {
  const bundle = buildWorkerBundle().source;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><body>shape diagnostic</body></html>');
    const evidence = await page.evaluate(async ({ bundle, revision, validTx, querySpec }) => {
      const blob = new Blob([bundle], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      const messages = [];
      const waiters = [];
      worker.onmessage = (event) => {
        messages.push(event.data);
        for (const entry of waiters.slice()) {
          if (!entry.predicate(event.data)) continue;
          clearTimeout(entry.timer);
          waiters.splice(waiters.indexOf(entry), 1);
          entry.resolve(event.data);
        }
      };
      const wait = (predicate) => new Promise((resolve, reject) => {
        const existing = messages.find(predicate);
        if (existing) return resolve(existing);
        const entry = { predicate, resolve, reject, timer: null };
        entry.timer = setTimeout(() => {
          const index = waiters.indexOf(entry);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error('WORKER_SHAPE_DIAGNOSTIC_TIMEOUT'));
        }, 5000);
        waiters.push(entry);
      });

      worker.postMessage({ type: 'INIT' });
      await wait((message) => message.type === 'READY');
      worker.postMessage({ type: 'SET_REVISION', generation_id: revision, revision });

      const missing = structuredClone(validTx);
      delete missing.description;
      worker.postMessage({
        type: 'ANALYTICS_QUERY', request_id: 'missing-field', generation_id: revision,
        revision, transactions: [missing], query: querySpec
      });
      const missingResult = await wait((message) => message.request_id === 'missing-field');

      const extra = structuredClone(validTx);
      extra.owner_private_unexpected_key = 'must-not-be-emitted';
      worker.postMessage({
        type: 'ANALYTICS_QUERY', request_id: 'extra-field', generation_id: revision,
        revision, transactions: [extra], query: querySpec
      });
      const extraResult = await wait((message) => message.request_id === 'extra-field');

      worker.postMessage({
        type: 'ANALYTICS_QUERY', request_id: 'valid-shape', generation_id: revision,
        revision, transactions: [validTx], query: querySpec
      });
      const validResult = await wait((message) => message.request_id === 'valid-shape');

      worker.terminate();
      URL.revokeObjectURL(url);
      return { missingResult, extraResult, validResult };
    }, { bundle, revision: REVISION, validTx: canonicalTransaction(), querySpec: query() });

    assert.strictEqual(evidence.missingResult.type, 'ERROR');
    assert.strictEqual(evidence.missingResult.reason, 'WORKER_CANONICAL_FIELD_MISSING_DESCRIPTION');
    assert.strictEqual(evidence.extraResult.type, 'ERROR');
    assert.strictEqual(evidence.extraResult.reason, 'WORKER_CANONICAL_TOP_LEVEL_EXTRA');
    assert(!JSON.stringify(evidence.extraResult).includes('owner_private_unexpected_key'), 'unknown field name must not cross diagnostic boundary');
    for (const error of [evidence.missingResult, evidence.extraResult]) {
      assert.strictEqual(Object.prototype.hasOwnProperty.call(error, 'transactions'), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(error, 'query'), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(error, 'result'), false);
    }
    assert.strictEqual(evidence.validResult.type, 'ANALYTICS_RESULT');
    assert.strictEqual(evidence.validResult.result.schema, 'PRH_ANALYTICS_RESULT_V1');

    console.log('local_analytics_worker_shape_diagnostic_adapter_test: PASS', {
      missingKnownFieldReason: evidence.missingResult.reason,
      extraUnknownFieldPayloadFree: true,
      canonicalEvaluatorStillRuns: true,
      financialPayloadInDiagnostic: false
    });
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
