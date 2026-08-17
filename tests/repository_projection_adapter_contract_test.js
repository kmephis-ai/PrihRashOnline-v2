'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  CONTRACT,
  assertContract,
  queryProjectionHeaders,
  fullProjectionHeaders,
  buildColumnSpans,
  groupConsecutiveRows,
  projectionTelemetry
} = require('../lib/adapters/google_sheets_projection');
const {
  createGoogleSheetsTransactionRepository
} = require('../lib/adapters/google_sheets_transaction_repository');
const { applyQuery } = require('../lib/repository/transaction_repository');

assert.strictEqual(assertContract(), true);
assert.strictEqual(CONTRACT.schema, 'PRH_GOOGLE_QUERY_PROJECTION_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'PERF-010');
assert.strictEqual(CONTRACT.authority.financial_semantics, false);
assert.strictEqual(CONTRACT.authority.financial_write, false);
assert.strictEqual(CONTRACT.authority.paid_dependency_required, false);

const headers = [
  'ID', 'Дата и время', 'Дата', 'Месяц', 'Тип', 'Сумма', 'Счёт', 'Счёт назначения',
  'Категория', 'Подкатегория', 'Наименование', 'Член семьи', 'Проект', 'Теги',
  'Регулярная', 'Комментарий', 'Источник', 'Строка источника', 'Статус', 'Исходный тип'
];
const rows = [
  ['G-TX-001', new Date('2026-02-01T10:00:00Z'), '', '', 'Доход', '1000.00', 'Основной', '', 'Зарплата', '', 'Synthetic salary', 'А', '', 'salary', '', '', 'SYN-FORM', '10', 'Проведено', ''],
  ['G-TX-002', new Date('2026-02-02T10:00:00Z'), '', '', 'Расход', '25,50', 'Основной', '', 'Питание', '', 'Synthetic food', 'А', 'Дом', 'food; home', '', '', 'SYN-FORM', '11', 'posted', ''],
  ['G-TX-003', new Date('2026-02-03T10:00:00Z'), '', '', 'Перевод', '100.00', 'Основной', 'Накопления', 'Перевод', '', 'Synthetic transfer', '', '', '', '', '', 'SYN-FORM', '12', '', ''],
  ['G-TX-004', new Date('2026-02-04T10:00:00Z'), '', '', 'Возврат', '5.50', 'Основной', '', 'Питание', '', 'Synthetic refund', 'А', 'Дом', 'food', '', '', 'SYN-FORM', '13', 'OK', '']
];

assert.deepStrictEqual(Array.from(queryProjectionHeaders({})), ['ID', 'Дата и время']);
assert.deepStrictEqual(Array.from(queryProjectionHeaders({
  types: ['expense'], statuses: ['posted'], category_id: 'CAT-FOOD', tags_any: ['food']
})), ['ID', 'Дата и время', 'Тип', 'Категория', 'Теги', 'Статус']);
assert.strictEqual(fullProjectionHeaders().length, 15);
assert(fullProjectionHeaders().length < headers.length, 'mapped full projection must exclude unmapped sheet columns');

const spans = buildColumnSpans(headers, fullProjectionHeaders());
assert.deepStrictEqual(spans.map((span) => [span.start_column, span.end_column, span.width]), [
  [1, 2, 2], [5, 9, 5], [11, 14, 4], [16, 19, 4]
]);
const telemetry = projectionTelemetry(fullProjectionHeaders(), spans, rows.length);
assert.strictEqual(telemetry.projected_column_count, 15);
assert.strictEqual(telemetry.column_span_count, 4);
assert.strictEqual(telemetry.cell_read_count, 60);
assert.strictEqual(telemetry.financial_payload, undefined);

assert.deepStrictEqual(groupConsecutiveRows([7, 4, 5, 11, 12, 13]).map((group) => ({ ...group })), [
  { start_row: 4, row_count: 2 },
  { start_row: 7, row_count: 1 },
  { start_row: 11, row_count: 3 }
]);
assert.deepStrictEqual(groupConsecutiveRows([]), []);
assert.throws(() => groupConsecutiveRows([2, 2]), /GOOGLE_PROJECTION_ROW_NUMBER_DUPLICATE/);
assert.throws(() => buildColumnSpans(headers, ['ID', 'НЕИЗВЕСТНО']), /GOOGLE_PROJECTION_HEADER_NOT_ALLOWED/);
const duplicatePhysicalHeaders = headers.slice();
duplicatePhysicalHeaders[2] = 'ID';
assert.throws(
  () => buildColumnSpans(duplicatePhysicalHeaders, ['ID']),
  /GOOGLE_PROJECTION_SOURCE_HEADER_DUPLICATE/,
  'ambiguous physical mapped header must fail closed in pure planner'
);

const dimensionMap = {
  account: { 'Основной': 'ACC-MAIN', 'Накопления': 'ACC-SAVINGS' },
  category: { 'Зарплата': 'CAT-SALARY', 'Питание': 'CAT-FOOD', 'Перевод': 'CAT-TRANSFER' },
  member: { 'А': 'MEMBER-A' },
  project: { 'Дом': 'PROJECT-HOME' }
};
const resolvers = {};
for (const kind of Object.keys(dimensionMap)) resolvers[kind] = (label) => dimensionMap[kind][label] || '';

function createInstrumentedGateway() {
  const calls = [];
  const gateway = {
    readOperationsTable: (request = {}) => {
      const requiredHeaders = request.required_headers || fullProjectionHeaders();
      const startRow = request.start_row == null ? 2 : request.start_row;
      const rowCount = request.row_count == null ? Math.max(0, rows.length - (startRow - 2)) : request.row_count;
      const startOffset = startRow - 2;
      const projectedRows = rows.slice(startOffset, startOffset + rowCount).map((record) =>
        requiredHeaders.map((header) => record[headers.indexOf(header)])
      );
      calls.push(Object.freeze({
        required_headers: Object.freeze(requiredHeaders.slice()),
        start_row: startRow,
        row_count: rowCount,
        cell_read_count: requiredHeaders.length * rowCount
      }));
      return {
        schema: 'PRH_GOOGLE_OPERATIONS_TABLE_V1',
        sheet_name: '01 Операции',
        start_row: startRow,
        headers: requiredHeaders.slice(),
        rows: projectedRows,
        read_plan: {
          schema: 'PRH_GOOGLE_PROJECTED_READ_V1',
          requested_header_count: requiredHeaders.length,
          projected_column_count: requiredHeaders.length,
          column_span_count: 1,
          row_count: rowCount,
          range_read_count: rowCount ? 1 : 0,
          cell_read_count: requiredHeaders.length * rowCount
        }
      };
    }
  };
  return { gateway, calls };
}

const instrumented = createInstrumentedGateway();
const repo = createGoogleSheetsTransactionRepository(instrumented.gateway, { default_currency: 'RUB', resolvers });
assert.strictEqual(repo.capabilities.projection, true);

// readAll: 15 mapped columns instead of all 20 source columns.
const all = repo.readAll();
assert.strictEqual(all.length, 4);
assert.strictEqual(instrumented.calls.length, 1);
assert.strictEqual(instrumented.calls[0].required_headers.length, 15);
assert.strictEqual(instrumented.calls[0].cell_read_count, 60);
assert(instrumented.calls[0].cell_read_count < headers.length * rows.length);

// getById: first scan only ID, then fetch exactly one full mapped row.
instrumented.calls.length = 0;
const byId = repo.getById('G-TX-003');
assert.strictEqual(byId.transaction_id, 'G-TX-003');
assert.strictEqual(byId.type, 'transfer');
assert.deepStrictEqual(instrumented.calls.map((call) => [call.required_headers.length, call.row_count]), [
  [1, 4], [15, 1]
]);
assert.strictEqual(instrumented.calls.reduce((sum, call) => sum + call.cell_read_count, 0), 19);

// Narrow query: scan only filter/sort headers, then full mapped read for selected page rows.
instrumented.calls.length = 0;
const queryInput = { types: ['expense'], statuses: ['posted'], category_id: 'CAT-FOOD', limit: 10 };
const projectedResult = repo.query(queryInput);
assert.strictEqual(projectedResult.total_count, 1);
assert.strictEqual(projectedResult.items.length, 1);
assert.strictEqual(projectedResult.items[0].transaction_id, 'G-TX-002');
assert.deepStrictEqual(instrumented.calls.map((call) => [call.required_headers.length, call.row_count]), [
  [5, 4], [15, 1]
]);
assert.strictEqual(instrumented.calls.reduce((sum, call) => sum + call.cell_read_count, 0), 35);
assert(instrumented.calls[0].required_headers.includes('ID'));
assert(instrumented.calls[0].required_headers.includes('Дата и время'));
assert(!instrumented.calls[0].required_headers.includes('Сумма'), 'query scan must not read amount when amount is not a filter/sort field');
assert(!instrumented.calls[0].required_headers.includes('Наименование'));

// Query semantics parity with authoritative repository applyQuery on the same canonical set.
const expected = applyQuery(all, queryInput);
assert.deepStrictEqual(projectedResult, expected);

// Empty result performs no second-phase full-row read.
instrumented.calls.length = 0;
const empty = repo.query({ types: ['income'], category_id: 'CAT-FOOD' });
assert.strictEqual(empty.total_count, 0);
assert.strictEqual(empty.items.length, 0);
assert.strictEqual(instrumented.calls.length, 1);
assert(instrumented.calls[0].required_headers.length < 15);

// Runtime gateway must not regress to getDataRange/full-width data-row reads.
const gatewaySource = fs.readFileSync(path.join(__dirname, '..', 'GoogleTransactionRepositoryGateway.js'), 'utf8');
assert(!/\.getDataRange\s*\(/.test(gatewaySource));
assert(!/getRange\(2\s*,\s*1\s*,[^\n]*lastColumn/.test(gatewaySource),
  'PERF-010 canonical data path must not read every source column for every data row');
assert(/required_headers/.test(gatewaySource));
assert(/column_span_count/.test(gatewaySource));
assert(/GOOGLE_REPOSITORY_REQUIRED_HEADER_DUPLICATE/.test(gatewaySource));
assert(/GOOGLE_REPOSITORY_READ_SOURCE_HEADER_DUPLICATE/.test(gatewaySource));
assert(!/\.setValues?\s*\(/.test(gatewaySource));
assert(!/\.appendRow\s*\(/.test(gatewaySource));

// Runtime gateway also rejects an ambiguous mapped header row before any data read.
let duplicateDataReads = 0;
const duplicateContext = {
  PR_CONFIG: { SHEETS: { OPERATIONS: '01 Операции' } },
  getSheetRequired_: () => ({
    getLastRow: () => 2,
    getLastColumn: () => duplicatePhysicalHeaders.length,
    getRange: (row, col, height, width) => ({
      getValues: () => {
        if (row === 1) return [duplicatePhysicalHeaders.slice()];
        duplicateDataReads += 1;
        return [Array(width).fill('')];
      }
    })
  }),
  operationWriteGuard_: () => true,
  Object,
  Array,
  String,
  Number,
  Error,
  Math
};
vm.createContext(duplicateContext);
vm.runInContext(gatewaySource, duplicateContext, { filename: 'GoogleTransactionRepositoryGateway.js' });
assert.throws(
  () => duplicateContext.prhGoogleRepositoryReadOperationsTable_({ required_headers: ['ID'] }),
  /GOOGLE_REPOSITORY_REQUIRED_HEADER_DUPLICATE/,
  'gateway must reject ambiguous source header row'
);
assert.strictEqual(duplicateDataReads, 0, 'ambiguous header must fail before any data-row read');

console.log('repository_projection_adapter_contract_test: OK', {
  contract: 'PRH_GOOGLE_QUERY_PROJECTION_V1@1.0.0',
  sourceColumns: headers.length,
  mappedColumns: fullProjectionHeaders().length,
  getByIdCells: 19,
  narrowQueryCells: 35,
  baselineFullWidthCells: headers.length * rows.length,
  querySemanticParity: true,
  ambiguousSourceHeaderFailClosed: true,
  financialPayloadInTelemetry: false,
  financialWriteAuthority: false,
  freeOnly: true
});
