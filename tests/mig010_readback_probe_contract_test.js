'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  TOOL_SCHEMA,
  REMOTE_SCHEMA,
  FUNCTION_NAME,
  normalizeProbe
} = require('../tools/mig010-readback-probe');

const source = fs.readFileSync(path.join(__dirname, '..', 'Mig010ExecutionReadbackProbe.js'), 'utf8');
const toolSource = fs.readFileSync(path.join(__dirname, '..', 'tools', 'mig010-readback-probe.js'), 'utf8');

const context = {
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Error,
  Set,
  prhMig010NormalizedEncodedCell_: (cell) => {
    if (cell.f) return { f: String(cell.f) };
    return { t: cell.t, v: cell.v };
  },
  prhMig010StableStringify_: (value) => JSON.stringify(value, Object.keys(value).sort())
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'Mig010ExecutionReadbackProbe.js' });

assert.strictEqual(FUNCTION_NAME, 'prhMig010ProbeAuthorizedBatchReadback');
assert.strictEqual(REMOTE_SCHEMA, 'MIG010_EXECUTION_READBACK_PROBE_V1');
assert(source.includes('function prhMig010ProbeAdaptiveWrite_'));
assert(source.includes('prhMig010SetTypedValues_(range, encodedRows, matrix)'));
assert(source.includes('adaptiveFormatReadback'));
assert(source.includes('adaptiveRepairApplied'));
assert(source.includes('originalFormatsRestoredAfterClear: true'));
assert(source.includes('range.clearContent();'));
assert(source.includes('prhMig010TableHash_(target.sheet) !== session.current_raw_table_hash'));
assert(source.includes('liveTargetMutated: false'));
assert(source.includes('financialPayloadStdout: false'));
assert(!source.includes('sessionId:'));
assert(!source.includes('batchIndex:'));
assert(!source.includes('startSheetRow:'));

const classify = context.prhMig010ProbeMismatchClasses_;
assert.deepStrictEqual(Array.from(classify(
  [[{ t: 's', v: '0012' }]],
  [[{ t: 'n', v: 12 }]]
)), ['STRING_TYPE_COERCION']);
assert.deepStrictEqual(Array.from(classify(
  [[{ t: 'd', v: '2025-01-01T00:00:00.000Z' }]],
  [[{ t: 'd', v: '2024-12-31T21:00:00.000Z' }]]
)), ['DATE_VALUE_SHIFT']);
assert.deepStrictEqual(Array.from(classify(
  [[{ f: '=A1' }]],
  [[{ f: '=A1+0' }]]
)), ['FORMULA_NORMALIZED']);
assert.deepStrictEqual(Array.from(classify(
  [[{ t: 's', v: 'safe' }]],
  [[{ t: 's', v: 'safe' }]]
)), []);

const matched = normalizeProbe({
  schema: REMOTE_SCHEMA,
  status: 'MATCHED',
  mismatchClasses: [],
  adaptiveFormatReadback: [],
  adaptiveRepairApplied: true,
  rangeCleared: true,
  originalFormatsRestoredAfterClear: true,
  liveTargetMutated: false,
  financialPayloadStdout: false
});
assert.strictEqual(matched.schema, TOOL_SCHEMA);
assert.strictEqual(matched.status, 'MATCHED');
assert.deepStrictEqual(matched.mismatchClasses, []);
assert.deepStrictEqual(matched.adaptiveFormatReadback, []);
assert.strictEqual(matched.adaptiveRepairApplied, true);
assert.strictEqual(matched.originalFormatsRestoredAfterClear, true);
assert.strictEqual(matched.rangeCleared, true);
assert.strictEqual(matched.liveTargetMutated, false);
assert.strictEqual(matched.financialPayloadStdout, false);

assert.throws(() => normalizeProbe({
  schema: REMOTE_SCHEMA,
  status: 'MISMATCH_CLASSIFIED',
  mismatchClasses: ['PRIVATE_VALUE'],
  adaptiveFormatReadback: ['PRIVATE_VALUE'],
  adaptiveRepairApplied: true,
  rangeCleared: true,
  originalFormatsRestoredAfterClear: true,
  liveTargetMutated: false,
  financialPayloadStdout: false
}), /MIG010_READBACK_PROBE_REMOTE_CLASSES_INVALID/);

assert.throws(() => normalizeProbe({
  schema: REMOTE_SCHEMA,
  status: 'MISMATCH_CLASSIFIED',
  mismatchClasses: ['STRING_TYPE_COERCION'],
  adaptiveFormatReadback: [],
  adaptiveRepairApplied: true,
  rangeCleared: true,
  originalFormatsRestoredAfterClear: true,
  liveTargetMutated: false,
  financialPayloadStdout: false
}), /MIG010_READBACK_PROBE_REMOTE_ADAPTIVE_INVALID/);

assert(toolSource.includes('diagnostic.liveTargetState !== \'INITIAL\''));
assert(toolSource.includes('diagnostic.rollbackMatchesInitial !== true'));
assert(toolSource.includes('pkg.batches[diagnostic.nextBatch]'));
assert(toolSource.includes('devMode: false'));
assert(toolSource.includes('adaptiveFormatReadback'));
assert(toolSource.includes('originalFormatsRestoredAfterClear'));
assert(toolSource.includes('financialPayloadStdout: false'));
assert(!/process\.stdout\.write\([^\n]*(rows|session_id|package_hash|batch_hash)/.test(toolSource));

console.log('mig010_readback_probe_contract_test: OK', {
  stagingOnly: true,
  exactNextBatch: true,
  adaptiveProductionPath: true,
  mismatchClassesOnly: true,
  rangeCleared: true,
  originalFormatsRestoredAfterClear: true,
  liveTargetMutated: false,
  financialPayloadStdout: false
});
