'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'Mig010ExecutionTypedWrite.js'), 'utf8');
const resumeSource = fs.readFileSync(path.join(__dirname, '..', 'tools', 'mig010-resume.js'), 'utf8');

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
}

function normalizedCell(cell) {
  if (cell.f) return { f: String(cell.f) };
  if (cell.t === 's') return { t: 's', v: String(cell.v == null ? '' : cell.v) };
  if (cell.t === 'n') return { t: 'n', v: Number(cell.v) };
  if (cell.t === 'd') return { t: 'd', v: new Date(String(cell.v)).toISOString() };
  if (cell.t === 'b') return { t: 'b', v: Boolean(cell.v) };
  throw new Error('CELL_INVALID');
}

class FakeRange {
  constructor(formats) {
    this.formats = formats.map((row) => row.slice());
    this.values = formats.map((row) => row.map(() => ''));
  }
  getNumberFormats() { return this.formats.map((row) => row.slice()); }
  setNumberFormats(next) {
    this.formats = next.map((row) => row.slice());
    return this;
  }
  setValues(matrix) {
    this.values = matrix.map((row, r) => row.map((value, c) => {
      const format = this.formats[r][c];
      // Model the two real incident classes:
      // numeric-looking strings become numbers outside text format;
      // Date objects become serial numbers outside a date/time format.
      if (typeof value === 'string' && /^\d+$/.test(value) && format !== '@') {
        return Number(value);
      }
      if (value instanceof Date && !/[dmyhs]/i.test(String(format))) {
        return value.getTime() / 86400000;
      }
      return value;
    }));
    return this;
  }
  getValues() { return this.values.map((row) => row.slice()); }
  getFormulas() { return this.values.map((row) => row.map(() => '')); }
  clearContent() {
    this.values = this.values.map((row) => row.map(() => ''));
    return this;
  }
}

function encodeRange(range) {
  return range.getValues().map((row) => row.map((value) => {
    if (value instanceof Date) return { t: 'd', v: value.toISOString() };
    if (typeof value === 'number') return { t: 'n', v: value };
    if (typeof value === 'boolean') return { t: 'b', v: value };
    return { t: 's', v: String(value == null ? '' : value) };
  }));
}

const context = {
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Error,
  Date,
  SpreadsheetApp: { flush() {} },
  prhMig010Fail_: (reason) => { throw new Error(reason); },
  prhMig010StableStringify_: stable,
  prhMig010NormalizedEncodedCell_: normalizedCell,
  prhMig010EncodeRange_: encodeRange,
  prhMig010HashEncodedRows_: (rows) => stable(rows.map((row) => row.map(normalizedCell))),
  prhMig010HashRange_: (range) => stable(encodeRange(range).map((row) => row.map(normalizedCell)))
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'Mig010ExecutionTypedWrite.js' });

const encoded = [[
  { t: 's', v: '0012' },
  { t: 'n', v: 12 },
  { t: 'd', v: '2025-01-01T10:20:30.000Z' },
  { t: 's', v: 'safe' }
]];
const matrix = [['0012', 12, new Date('2025-01-01T10:20:30.000Z'), 'safe']];

const range = new FakeRange([['General', '0.00', 'General', 'General']]);
const result = context.prhMig010SetTypedValues_(range, encoded, matrix);
assert.strictEqual(result.adaptiveRepairApplied, true);
assert.deepStrictEqual(encodeRange(range), encoded, 'adaptive writer must finish with exact package types');
assert.deepStrictEqual(range.getNumberFormats(), [[
  '@',
  '0.00',
  'dd.MM.yyyy HH:mm:ss',
  'General'
]], 'only incompatible cells should receive compatible formats');

const alreadyCompatible = new FakeRange([['@', '0.00', 'dd.MM.yyyy HH:mm:ss', 'General']]);
const compatibleFormats = alreadyCompatible.getNumberFormats();
const compatibleResult = context.prhMig010SetTypedValues_(alreadyCompatible, encoded, matrix);
assert.strictEqual(compatibleResult.adaptiveRepairApplied, false);
assert.deepStrictEqual(encodeRange(alreadyCompatible), encoded);
assert.deepStrictEqual(alreadyCompatible.getNumberFormats(), compatibleFormats,
  'compatible existing formats must remain untouched');

assert(source.includes('adaptiveExistingFormatFirst: true'));
assert(source.includes('minimalCompatibleFormatRepair: true'));
assert(source.includes('incompatibleFormatsNotRestoredAfterSuccess: true'));
assert(source.includes('originalFormatsRestoredAfterFailedWrite: true'));
assert(source.includes('exactReadbackStillRequired: true'));
assert(source.includes("prhMig010Fail_('MIG010_EXECUTION_BATCH_READBACK_MISMATCH')"));
assert(source.includes('range.clearContent();'));
assert(resumeSource.includes("batch: 'prhMig010WriteAuthorizedBatchTyped'"));
assert(!source.includes('genericRepositoryWriteAuthorized: true'));

console.log('mig010_typed_staging_write_contract_test: OK', {
  adaptiveExistingFormatFirst: true,
  stringTypePreserved: true,
  dateTypePreserved: true,
  minimalCompatibleFormatRepair: true,
  compatibleFormatsUntouched: true,
  exactReadbackStillRequired: true,
  recoveryUsesTypedWriter: true,
  genericRepositoryWriteAuthorized: false
});
