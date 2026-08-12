'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const revisionAwareCache = require('../lib/repository/revision_aware_cache');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'R2PerformanceRuntimeService.js'), 'utf8');
new vm.Script(source, { filename: 'R2PerformanceRuntimeService.js' });

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function createHarness() {
  let modifiedMs = 1000;
  let lastRow = 101;
  let lastColumn = 20;
  let nowMs = 100000;
  let builderCalls = 0;
  let mutateDuringBuild = false;
  const cache = new Map();
  const userCache = {
    get(key) { return cache.has(key) ? cache.get(key) : null; },
    put(key, value) { cache.set(key, String(value)); },
    remove(key) { cache.delete(key); }
  };
  const context = vm.createContext({
    console,
    Date: class extends Date {
      static now() { nowMs += 5; return nowMs; }
    },
    Object, Array, String, Number, Math, JSON, Error, RegExp,
    encodeURIComponent, unescape,
    PR_CONFIG: { SHEETS: { OPERATIONS: '01 Операции' } },
    PRH_R2_FIN_RUNTIME: { HOME_VIEW_SCHEMA: 'PRH_FINANCIAL_HOME_VIEW_V1' },
    PR_BUILD_INFO: { candidateSha: 'a'.repeat(40) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getId: () => 'SYN-SPREADSHEET-ID' }) },
    DriveApp: { getFileById: () => ({ getLastUpdated: () => new Date(modifiedMs) }) },
    getSheetRequired_: () => ({ getLastRow: () => lastRow, getLastColumn: () => lastColumn }),
    CacheService: { getUserCache: () => userCache },
    Utilities: { newBlob(value) { return { getBytes: () => Array.from(Buffer.from(String(value), 'utf8')) }; } },
    prhR2FinSha256Hex_: sha256,
    prhR2CanonicalRuntime_: () => ({ revisionAwareCache })
  });
  vm.runInContext(source, context, { filename: 'R2PerformanceRuntimeService.js' });
  function privateHome() {
    builderCalls += 1;
    context.prhPerfRecRecordSource_({
      gateway_call_count: 2, range_read_count: 5, cell_read_count: 700,
      canonical_snapshot_read_count: 1, snapshot_reuse_count: 0,
      unique_dimension_hash_count: 11, dimension_hash_memo_hit_count: 89,
      canonical_revision_hash_prefix: 'abcdef654321'
    });
    context.prhPerfRecRecordPhase_('sheet_read_ms', 35);
    if (mutateDuringBuild) modifiedMs += 1;
    return {
      schema: 'PRH_FINANCIAL_HOME_VIEW_V1', contract_version: '1.0.0', currency: 'RUB',
      cards: { INCOME: { value_minor: 123456 } },
      visual_data: { expense_mix: [['PRIVATE-CATEGORY', 123456]] },
      provenance: { financial_values: 'PRIVATE_TEST_FIXTURE' }
    };
  }
  context.prhR2BuildFinancialHomeRuntime_ = () => context.prhPerfRecGetOrBuildHome_(privateHome);
  return {
    context, cache,
    get builderCalls() { return builderCalls; },
    setModified(value) { modifiedMs = value; },
    setGeometry(row, col) { lastRow = row; lastColumn = col; },
    setMutateDuringBuild(value) { mutateDuringBuild = value; }
  };
}

const h = createHarness();
assert.strictEqual(h.context.PRH_PERF_REC_RUNTIME.SCHEMA, 'PRH_PERF_REC_RUNTIME_V1');
assert.strictEqual(h.context.PRH_PERF_REC_RUNTIME.ROADMAP_ID, 'PERF-REC-001');
assert.strictEqual(h.context.PRH_PERF_REC_RUNTIME.PRIVATE_CACHE, 'USER');
assert.strictEqual(h.context.PRH_PERF_REC_RUNTIME.FINANCIAL_WRITE, false);
assert.strictEqual(h.context.PRH_PERF_REC_RUNTIME.FINANCIAL_SEMANTICS, false);
assert.strictEqual(h.context.PRH_PERF_REC_RUNTIME.FREE_ONLY, true);

const cold = h.context.prhPerfRecBaselineProbe('COLD');
assert.strictEqual(h.builderCalls, 1);
assert.strictEqual(cold.mode, 'COLD');
assert.strictEqual(cold.cache_status, 'MISS');
assert.strictEqual(cold.reason_code, 'COLD_PROJECTED_HOME_BUILT');
assert.strictEqual(cold.gateway_call_count, 2);
assert.strictEqual(cold.canonical_snapshot_read_count, 1);
assert.strictEqual(cold.unique_dimension_hash_count, 11);
assert.strictEqual(cold.dimension_hash_memo_hit_count, 89);
assert.strictEqual(cold.source_revision_probe_count, 3);
assert.strictEqual(cold.candidate_sha, 'a'.repeat(40));
assert(/^[0-9a-f]{12}$/.test(cold.source_revision_hash_prefix));
assert.strictEqual(cold.canonical_revision_hash_prefix, 'abcdef654321');
assert(h.cache.size > 0);

const warm = h.context.prhPerfRecBaselineProbe('WARM');
assert.strictEqual(h.builderCalls, 1);
assert.strictEqual(warm.cache_status, 'HIT');
assert.strictEqual(warm.reason_code, 'EXACT_SOURCE_REVISION_MATCH');
assert.strictEqual(warm.gateway_call_count, 0);
assert.strictEqual(warm.canonical_snapshot_read_count, 0);
assert.strictEqual(warm.source_revision_probe_count, 2);

h.setModified(2000);
const changed = h.context.prhPerfRecBaselineProbe('WARM');
assert.strictEqual(h.builderCalls, 2);
assert.strictEqual(changed.cache_status, 'MISS');
assert.notStrictEqual(changed.source_revision_hash_prefix, warm.source_revision_hash_prefix);

h.setGeometry(102, 20);
const geometryChanged = h.context.prhPerfRecBaselineProbe('WARM');
assert.strictEqual(h.builderCalls, 3);
assert.strictEqual(geometryChanged.cache_status, 'MISS');

h.setModified(3000);
h.setMutateDuringBuild(true);
assert.throws(() => h.context.prhPerfRecBaselineProbe('COLD'), /PERF_REC_SOURCE_REVISION_CHANGED_DURING_BUILD/);
h.setMutateDuringBuild(false);

for (const evidence of [cold, warm, changed, geometryChanged]) {
  const serialized = JSON.stringify(evidence);
  for (const forbidden of ['123456','PRIVATE-CATEGORY','PRIVATE_TEST_FIXTURE','SYN-SPREADSHEET-ID','script.google.com','cards','visual_data']) {
    assert(!serialized.includes(forbidden), `PERF-REC telemetry leaked private payload: ${forbidden}`);
  }
  assert(serialized.includes('phase_ms'));
  assert(serialized.includes('range_read_count'));
}

assert.match(source, /CacheService\.getUserCache\(\)/);
assert.match(source, /DriveApp\.getFileById/);
assert.match(source, /revisionAwareCache\.cacheKeyHash/);
assert.match(source, /COLD_PROJECTED_HOME_BUILT/);
assert.doesNotMatch(source, /setValue\s*\(|setValues\s*\(|appendRow\s*\(/);

console.log('perf_rec_runtime_cache_contract_test: OK', {
  contract: 'PRH_PERF_REC_RUNTIME_V1@1.0.0', perf011CacheIdentity: true,
  exactSourceRevisionHit: true, revisionChangeMiss: true,
  projectedColdHome: true, concurrentChangeFailClosed: true, userPrivateCache: true,
  baselineFinancialPayload: false, financialWriteAuthority: false, freeOnly: true
});