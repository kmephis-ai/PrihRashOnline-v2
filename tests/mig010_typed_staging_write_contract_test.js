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
      // Model the real incident class: Sheets coerces numeric-looking strings
      // unless the destination cell is temporarily formatted as text.
      if (typeof value === 'string' && /^\d+$/.test(value) && this.formats[r][c] !== '@') {
        return Number(value);
      }
      return value;
    }));
    return this;
  }
  getValues() { return this.values.map((row) => row.slice()); }
}

const context = {
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Error,
  SpreadsheetApp: { flush() {} },
  prhMig010Fail_: (reason) => { throw new Error(reason); },
  prhMig010StableStringify_: stable,
  prhMig010NormalizedEncodedCell_: (cell) => {
    if (cell.f) return { f: String(cell.f) };
    if (cell.t === 's') return { t: 's', v: String(cell.v == null ? '' : cell.v) };
    if (cell.t === 'n') return { t: 'n', v: Number(cell.v) };
    if (cell.t === 'd') return { t: 'd', v: String(cell.v) };
    if (cell.t === 'b') return { t: 'b', v: Boolean(cell.v) };
    throw new Error('CELL_INVALID');
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'Mig010ExecutionTypedWrite.js' });

const range = new FakeRange([['0', '0.00', 'yyyy-mm-dd']]);
const encoded = [[
  { t: 's', v: '0012' },
  { t: 'n', v: 12 },
  { t: 's', v: '20250101' }
]];
const matrix = [['0012', 12, '20250101']];
const originalFormats = range.getNumberFormats();

context.prhMig010SetTypedValues_(range, encoded, matrix);

assert.strictEqual(typeof range.getValues()[0][0], 'string');
assert.strictEqual(range.getValues()[0][0], '0012');
assert.strictEqual(typeof range.getValues()[0][1], 'number');
assert.strictEqual(range.getValues()[0][1], 12);
assert.strictEqual(typeof range.getValues()[0][2], 'string');
assert.strictEqual(range.getValues()[0][2], '20250101');
assert.deepStrictEqual(range.getNumberFormats(), originalFormats,
  'typed staging must restore original number formats after preserving cell types');

const typedFormats = context.prhMig010TypedFormats_(encoded, originalFormats);
assert.deepStrictEqual(JSON.parse(JSON.stringify(typedFormats)), [['@', '0.00', '@']]);

assert(source.includes('exactReadbackStillRequired: true'));
assert(source.includes("prhMig010Fail_('MIG010_EXECUTION_BATCH_READBACK_MISMATCH')"));
assert(source.includes('range.clearContent();'));
assert(resumeSource.includes("batch: 'prhMig010WriteAuthorizedBatchTyped'"));
assert(!source.includes('genericRepositoryWriteAuthorized: true'));

console.log('mig010_typed_staging_write_contract_test: OK', {
  stringTypePreserved: true,
  numericTypePreserved: true,
  originalFormatsRestored: true,
  exactReadbackStillRequired: true,
  recoveryUsesTypedWriter: true,
  genericRepositoryWriteAuthorized: false
});
