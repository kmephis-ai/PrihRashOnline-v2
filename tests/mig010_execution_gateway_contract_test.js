'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'Mig010ExecutionGateway.js'), 'utf8');

function blankCell() { return { value: '', formula: '' }; }
function cloneCell(cell) { return { value: cell.value instanceof Date ? new Date(cell.value.getTime()) : cell.value, formula: cell.formula }; }

class FakeRange {
  constructor(sheet, row, column, numRows, numColumns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }
  _cell(r, c) { return this.sheet._ensure(this.row - 1 + r, this.column - 1 + c); }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const row = [];
      for (let c = 0; c < this.numColumns; c += 1) row.push(this._cell(r, c).value);
      out.push(row);
    }
    return out;
  }
  getFormulas() {
    const out = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const row = [];
      for (let c = 0; c < this.numColumns; c += 1) row.push(this._cell(r, c).formula || '');
      out.push(row);
    }
    return out;
  }
  setValues(matrix) {
    assert.strictEqual(matrix.length, this.numRows);
    matrix.forEach((row, r) => {
      assert.strictEqual(row.length, this.numColumns);
      row.forEach((value, c) => {
        const cell = this._cell(r, c);
        if (typeof value === 'string' && value.startsWith('=')) {
          cell.formula = value;
          cell.value = '';
        } else {
          cell.formula = '';
          cell.value = value instanceof Date ? new Date(value.getTime()) : value;
        }
      });
    });
    return this;
  }
  clearContent() {
    for (let r = 0; r < this.numRows; r += 1) {
      for (let c = 0; c < this.numColumns; c += 1) {
        const cell = this._cell(r, c);
        cell.value = '';
        cell.formula = '';
      }
    }
    return this;
  }
  copyTo(targetRange, options) {
    const contentsOnly = Boolean(options && options.contentsOnly === true);
    for (let r = 0; r < this.numRows; r += 1) {
      for (let c = 0; c < this.numColumns; c += 1) {
        const sourceCell = this._cell(r, c);
        const targetCell = targetRange._cell(r, c);
        targetCell.value = sourceCell.value instanceof Date ? new Date(sourceCell.value.getTime()) : sourceCell.value;
        targetCell.formula = contentsOnly ? '' : sourceCell.formula;
      }
    }
    return targetRange;
  }
}

class FakeSheet {
  constructor(name, spreadsheet, rows = []) {
    this.name = name;
    this.spreadsheet = spreadsheet;
    this.rows = rows.map((row) => row.map((cell) => cloneCell(cell)));
    this.hidden = false;
  }
  _ensure(r, c) {
    while (this.rows.length <= r) this.rows.push([]);
    while (this.rows[r].length <= c) this.rows[r].push(blankCell());
    return this.rows[r][c];
  }
  getName() { return this.name; }
  setName(name) {
    delete this.spreadsheet.sheets[this.name];
    this.name = name;
    this.spreadsheet.sheets[name] = this;
    return this;
  }
  hideSheet() { this.hidden = true; return this; }
  getRange(row, column, numRows, numColumns) { return new FakeRange(this, row, column, numRows, numColumns); }
  getLastRow() {
    let last = 0;
    this.rows.forEach((row, r) => {
      if (row.some((cell) => cell && (cell.formula || cell.value !== ''))) last = r + 1;
    });
    return last;
  }
  copyTo(spreadsheet) {
    const clone = new FakeSheet(`Copy of ${this.name}`, spreadsheet, this.rows);
    spreadsheet.sheets[clone.name] = clone;
    return clone;
  }
}

class FakeSpreadsheet {
  constructor() { this.sheets = {}; }
  addSheet(name, rows) {
    const sheet = new FakeSheet(name, this, rows);
    this.sheets[name] = sheet;
    return sheet;
  }
  getSheetByName(name) { return this.sheets[name] || null; }
  insertSheet(name) {
    if (this.sheets[name]) throw new Error('SHEET_EXISTS');
    return this.addSheet(name, []);
  }
}

function valueCell(value, formula = '') { return { value, formula }; }
function encodedString(value) { return { t: 's', v: value }; }
function encodedNumber(value) { return { t: 'n', v: value }; }
function encodedDate(value) { return { t: 'd', v: value }; }
function encodedFormula(formula) { return { t: 's', v: '', f: formula }; }

const headers = [
  'ID','Дата и время','Дата','Месяц','Тип','Сумма','Счёт','Счёт назначения','Категория','Подкатегория',
  'Наименование','Член семьи','Проект','Теги','Регулярная','Комментарий','Источник','Строка источника','Статус','Исходный тип'
];
const oldDateFormula = '=IF(B2="";"";INT(B2))';
const oldMonthFormula = '=IF(C2="";"";DATE(YEAR(C2);MONTH(C2);1))';
const initialRows = [
  headers.map((value) => valueCell(value)),
  [
    valueCell('OLD-1'), valueCell(new Date('2025-01-01T10:00:00Z')),
    valueCell('', oldDateFormula), valueCell('', oldMonthFormula),
    valueCell('Расход'), valueCell(10), valueCell('Основной'), valueCell(''), valueCell('Дом'), valueCell(''),
    valueCell('Old synthetic'), valueCell(''), valueCell(''), valueCell(''), valueCell(''), valueCell(''),
    valueCell('SYN-LEGACY'), valueCell(2), valueCell('Перенесено'), valueCell('Расход')
  ]
];

const spreadsheet = new FakeSpreadsheet();
const target = spreadsheet.addSheet('01 Операции', initialRows);
const properties = new Map();
const context = {
  console,
  Date,
  JSON,
  Math,
  Object,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  Error,
  isFinite,
  PR_CONFIG: { SHEETS: { OPERATIONS: '01 Операции' } },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algorithm, value) {
      return Array.from(crypto.createHash('sha256').update(String(value), 'utf8').digest())
        .map((item) => item > 127 ? item - 256 : item);
    }
  },
  SpreadsheetApp: {
    getActiveSpreadsheet: () => spreadsheet,
    flush: () => {}
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (key) => properties.has(key) ? properties.get(key) : null,
      setProperty: (key, value) => { properties.set(key, value); }
    })
  },
  LockService: {
    getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} })
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'Mig010ExecutionGateway.js' });

const headerEncoded = headers.map(encodedString);
function newRow(id, rowNumber, amount) {
  return [
    encodedString(id), encodedDate(`2025-02-0${rowNumber - 1}T10:00:00.000Z`),
    encodedFormula(`=IF(B${rowNumber}="";"";INT(B${rowNumber}))`),
    encodedFormula(`=IF(C${rowNumber}="";"";DATE(YEAR(C${rowNumber});MONTH(C${rowNumber});1))`),
    encodedString('Расход'), encodedNumber(amount), encodedString('Основной'), encodedString(''), encodedString('Дом'), encodedString(''),
    encodedString(`Synthetic ${id}`), encodedString(''), encodedString(''), encodedString(''), encodedString(''), encodedString(''),
    encodedString('SYN-LEGACY'), encodedNumber(rowNumber), encodedString('Перенесено'), encodedString('Расход')
  ];
}
const rows = [newRow('NEW-1', 2, 11), newRow('NEW-2', 3, 12)];
const currentHash = context.prhMig010TableHash_(target);
const headerHash = context.prhMig010HashEncodedRows_([headerEncoded]);
const finalHash = context.prhMig010HashEncodedRows_([headerEncoded, ...rows]);
const batchHash = context.prhMig010HashEncodedRows_(rows);
const authBase = {
  authorization: 'IRREVERSIBLE_ACTION_AUTHORIZED',
  session_id: 'SYNSESSION001',
  package_hash: 'a'.repeat(64),
  resolved_hash: 'b'.repeat(64),
  candidate_revision_hash: 'c'.repeat(64),
  backup_cipher_sha256: 'd'.repeat(64),
  current_raw_table_hash: currentHash,
  final_raw_table_hash: finalHash,
  target_header_hash: headerHash,
  backup_verified_at: new Date().toISOString()
};

assert.throws(
  () => context.prhMig010BeginAuthorizedExecution({ ...authBase, authorization: 'NO' }),
  /MIG010_EXECUTION_IRREVERSIBLE_ACTION_NOT_AUTHORIZED/
);
assert.throws(
  () => context.prhMig010BeginAuthorizedExecution({ ...authBase, backup_verified_at: '2020-01-01T00:00:00Z' }),
  /MIG010_EXECUTION_BACKUP_STALE/
);

const begin = context.prhMig010BeginAuthorizedExecution({ ...authBase, batch_count: 1 });
assert.strictEqual(begin.status, 'STAGING_READY');
assert.strictEqual(begin.writeAuthorized, true);
const rollbackSheet = spreadsheet.getSheetByName('__MIG010_RB_SYNSESSION001');
const stageSheet = spreadsheet.getSheetByName('__MIG010_STAGE_SYNSESSION001');
assert(rollbackSheet);
assert(stageSheet);
assert.strictEqual(context.prhMig010TableHash_(target), currentHash, 'begin must not mutate live target');
assert.strictEqual(rollbackSheet.getRange(2, 3, 1, 1).getFormulas()[0][0], oldDateFormula,
  'rollback copy must preserve formulas before any live mutation');
assert.strictEqual(stageSheet.getLastRow(), 1, 'staging clone must clear old data rows but retain header');

const batchRequest = {
  ...authBase,
  batch_index: 0,
  start_sheet_row: 2,
  batch_hash: batchHash,
  rows
};
const staged = context.prhMig010WriteAuthorizedBatch(batchRequest);
assert.strictEqual(staged.status, 'BATCH_STAGED');
const repeated = context.prhMig010WriteAuthorizedBatch(batchRequest);
assert.strictEqual(repeated.status, 'ALREADY_APPLIED');
assert.strictEqual(context.prhMig010TableHash_(target), currentHash, 'staging must not mutate live target');
assert.strictEqual(stageSheet.getRange(2, 3, 1, 1).getFormulas()[0][0], rows[0][2].f,
  'staging must preserve candidate date formula');
assert.strictEqual(stageSheet.getRange(2, 4, 1, 1).getFormulas()[0][0], rows[0][3].f,
  'staging must preserve candidate month formula');

const finalized = context.prhMig010FinalizeAuthorizedExecution(authBase);
assert.strictEqual(finalized.status, 'FINALIZED_PENDING_RECONCILIATION');
assert.strictEqual(finalized.rollbackAvailable, true);
assert.strictEqual(context.prhMig010TableHash_(target), finalHash);
assert.strictEqual(target.getRange(2, 3, 1, 1).getFormulas()[0][0], rows[0][2].f,
  'finalize must preserve date formula, not only evaluated value');
assert.strictEqual(target.getRange(2, 4, 1, 1).getFormulas()[0][0], rows[0][3].f,
  'finalize must preserve month formula, not only evaluated value');

const rolledBack = context.prhMig010RollbackAuthorizedExecution(authBase);
assert.strictEqual(rolledBack.status, 'ROLLED_BACK');
assert.strictEqual(context.prhMig010TableHash_(target), currentHash);
assert.strictEqual(target.getRange(2, 3, 1, 1).getFormulas()[0][0], oldDateFormula,
  'rollback must restore original date formula exactly');
assert.strictEqual(target.getRange(2, 4, 1, 1).getFormulas()[0][0], oldMonthFormula,
  'rollback must restore original month formula exactly');

// Regression guard: Apps Script contentsOnly semantics intentionally drop formulas.
const scratch = spreadsheet.addSheet('SCRATCH', initialRows);
const contentsOnlyTarget = spreadsheet.addSheet('CONTENTS_ONLY_TARGET', []);
scratch.getRange(2, 1, 1, 20).copyTo(contentsOnlyTarget.getRange(1, 1, 1, 20), { contentsOnly: true });
assert.strictEqual(contentsOnlyTarget.getRange(1, 3, 1, 1).getFormulas()[0][0], '',
  'fake must model contentsOnly formula loss so gateway regression cannot be masked');

const status = context.prhMig010ExecutionGatewayStatus();
assert.strictEqual(status.max_batch_rows, 100);
assert.strictEqual(status.rollback_copy_required, true);
assert.strictEqual(status.staging_required, true);
assert.strictEqual(status.explicit_authorization_required, true);
assert.strictEqual(status.public_ci_can_authorize, false);
assert.strictEqual(status.generic_repository_write_authorized, false);

console.log('mig010_execution_gateway_contract_test: OK', {
  authorizationRequired: true,
  stagingBeforeLiveMutation: true,
  batchReadback: true,
  idempotentBatch: true,
  finalizeHashVerified: true,
  formulasPreservedOnFinalize: true,
  formulasPreservedOnRollback: true,
  contentsOnlyFormulaLossModeled: true,
  rollbackVerified: true,
  genericRepositoryWriteAuthorized: false
});
