'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const contract = readJson('lib/local_first/local_analytics_worker.v1.json');
const runtime = readJson('lib/local_first/local_first_runtime.v1.json');
const entrySource = read('pwa/local_analytics_worker_entry.js');
const builderSource = read('tools/build-local-analytics-worker.js');
const { buildWorkerBundle } = require('../tools/build-local-analytics-worker');

assert.strictEqual(contract.schema, 'PRH_LOCAL_ANALYTICS_WORKER_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.roadmap_id, 'WORKER-LF-001');
assert.strictEqual(contract.cost_class, 'FREE_ONLY');
assert.strictEqual(contract.authority.off_main_thread, true);
assert.strictEqual(contract.authority.canonical_evaluator, 'lib/analytics/analytics_engine.js#evaluateAnalytics');
assert.strictEqual(contract.authority.independent_financial_formulas, false);
assert.strictEqual(contract.authority.network, false);
assert.strictEqual(contract.authority.storage, false);
assert.strictEqual(contract.authority.canonical_financial_write, false);
assert.strictEqual(contract.identity.generation_id_format, 'SHA256_HEX_64');
assert.strictEqual(contract.identity.canonical_revision_format, 'SHA256_HEX_64');
assert.strictEqual(contract.query_protocol.requires_exact_generation_match, true);
assert.strictEqual(contract.query_protocol.requires_exact_revision_match, true);
assert.strictEqual(contract.query_protocol.recheck_binding_before_evaluate, true);
assert.strictEqual(contract.query_protocol.recheck_binding_after_evaluate, true);
assert.strictEqual(contract.query_protocol.stale_completion_policy, 'DISCARD');
assert.strictEqual(contract.query_protocol.stale_output_contains_analytics_payload, false);
assert.strictEqual(contract.query_protocol.canonical_parity_required, true);
assert.strictEqual(contract.privacy.public_tests_synthetic_only, true);
assert.strictEqual(contract.privacy.error_contains_financial_payload, false);
assert.strictEqual(contract.rollback.primary_product_path_connected, false);
assert.strictEqual(contract.rollback.canonical_source_mutation, false);

assert.strictEqual(runtime.worker.schema, contract.schema);
assert.strictEqual(runtime.worker.off_main_thread, true);
assert.strictEqual(runtime.worker.network_authority, false);
assert.strictEqual(runtime.worker.storage_authority, false);
assert.strictEqual(runtime.worker.financial_write_authority, false);
assert.strictEqual(runtime.worker.revision_bound, true);
assert.strictEqual(runtime.worker.generation_bound, true);
assert.strictEqual(runtime.worker.stale_completion, 'DISCARD');
assert.deepStrictEqual(runtime.worker.messages_in, Object.keys(contract.messages.in));
assert.deepStrictEqual(runtime.worker.messages_out, Object.keys(contract.messages.out));

for (const token of [
  "require('../lib/analytics/analytics_engine')",
  'evaluateAnalytics(message.transactions, message.query)',
  'state.epoch += 1',
  'STALE_DISCARDED',
  'STALE_BEFORE_EVALUATE',
  'STALE_AFTER_EVALUATE',
  'setTimeout(() =>',
  'MAX_PENDING'
]) {
  assert(entrySource.includes(token), `missing worker protocol token: ${token}`);
}

for (const forbidden of contract.forbidden_worker_capabilities) {
  const escaped = forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const callable = new RegExp(`\\b${escaped}\\s*\\(`);
  const property = new RegExp(`\\b${escaped}\\b`);
  if (forbidden === 'google.script.run') {
    assert(!entrySource.includes(forbidden), `worker entry contains forbidden capability: ${forbidden}`);
  } else if (['indexedDB', 'localStorage', 'sessionStorage'].includes(forbidden)) {
    assert(!property.test(entrySource), `worker entry contains forbidden storage authority: ${forbidden}`);
  } else {
    assert(!callable.test(entrySource), `worker entry contains forbidden callable capability: ${forbidden}`);
  }
}

assert(builderSource.includes('WORKER_BUNDLE_EXTERNAL_REQUIRE_FORBIDDEN'));
assert(builderSource.includes("request === 'crypto'"));
assert(builderSource.includes('lib/crypto/sha256.js'));
assert(!builderSource.includes("require('esbuild')"));
assert(!builderSource.includes("require('webpack')"));
assert(!builderSource.includes("require('rollup')"));

const bundle = buildWorkerBundle({ root });
assert.strictEqual(bundle.schema, 'PRH_LOCAL_ANALYTICS_WORKER_BUNDLE_V1');
assert.strictEqual(bundle.entry, 'pwa/local_analytics_worker_entry.js');
assert(bundle.module_ids.includes('lib/analytics/analytics_engine.js'), 'canonical analytics evaluator missing from worker graph');
assert(bundle.module_ids.includes('lib/crypto/sha256.js'), 'tracked SHA-256 implementation missing from worker graph');
assert(bundle.module_ids.includes('__virtual__/crypto.js'), 'narrow crypto shim missing from worker graph');
assert(bundle.source.includes('function evaluateAnalytics('), 'worker bundle must contain canonical evaluator implementation');
assert(bundle.source.includes("__require__('lib/crypto/sha256.js')"), 'worker crypto shim must use tracked SHA implementation');
assert(!/\brequire\s*\(\s*['"]crypto['"]\s*\)/.test(bundle.source), 'Node crypto require must not survive browser bundle');
assert(!/\brequire\s*\(\s*['"][^'"]+['"]\s*\)/.test(bundle.source), 'raw CommonJS require must not survive browser bundle');

for (const forbidden of ['XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'localStorage', 'sessionStorage', 'google.script.run', 'SpreadsheetApp', 'UrlFetchApp']) {
  assert(!bundle.source.includes(forbidden), `browser worker bundle contains forbidden authority token: ${forbidden}`);
}
assert(!/\bfetch\s*\(/.test(bundle.source), 'browser worker bundle must not contain fetch call');

console.log('Local Analytics Worker adapter contract: PASS', {
  contract: `${contract.schema}@${contract.version}`,
  canonicalEvaluatorReused: true,
  modules: bundle.module_ids.length,
  networkAuthority: false,
  storageAuthority: false,
  canonicalFinancialWrite: false,
  stalePolicy: contract.query_protocol.stale_completion_policy
});
