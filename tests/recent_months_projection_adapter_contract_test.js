'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const recent = require('../lib/adapters/google_sheets_recent_months_projection');

const headers = recent.FULL_HEADERS.slice();

function sourceRow(id, occurredAt, type, amount, category) {
  const values = {
    'ID': id,
    'Дата и время': occurredAt,
    'Тип': type,
    'Сумма': amount,
    'Счёт': 'Основной',
    'Счёт назначения': '',
    'Категория': category,
    'Наименование': `Synthetic ${id}`,
    'Член семьи': '',
    'Проект': '',
    'Теги': '',
    'Комментарий': '',
    'Источник': 'SYNTHETIC_TEST',
    'Строка источника': id,
    'Статус': 'Проведено'
  };
  return headers.map((header) => values[header]);
}

function instrumentedGateway(sourceRows) {
  const calls = [];
  return {
    calls,
    gateway: {
      readOperationsTable(request = {}) {
        const requiredHeaders = request.required_headers || headers;
        const startRow = request.start_row == null ? 2 : request.start_row;
        const rowCount = request.row_count == null
          ? Math.max(0, sourceRows.length - (startRow - 2))
          : request.row_count;
        const offset = startRow - 2;
        const projectedRows = sourceRows.slice(offset, offset + rowCount).map((row) =>
          requiredHeaders.map((header) => row[headers.indexOf(header)])
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
          rows: projectedRows
        };
      }
    }
  };
}

function canonicalFixtureId(prefix, label) {
  return `${prefix}:${Buffer.from(String(label), 'utf8').toString('hex').slice(0, 96)}`;
}

const resolvers = {
  account: (label) => canonicalFixtureId('account', label),
  category: (label) => canonicalFixtureId('category', label),
  member: (label) => canonicalFixtureId('member', label),
  project: (label) => canonicalFixtureId('project', label)
};

const rows = [
  sourceRow('SYN-2026-01', '2026-01-10T12:00:00Z', 'Доход', '1000.00', 'Зарплата'),
  sourceRow('SYN-2026-02', '2026-02-10T12:00:00Z', 'Расход', '100.00', 'Питание'),
  sourceRow('SYN-2026-03', '2026-03-10T12:00:00Z', 'Доход', '1100.00', 'Зарплата'),
  sourceRow('SYN-2026-04', '2026-04-10T12:00:00Z', 'Расход', '120.00', 'Питание'),
  sourceRow('SYN-2026-05', '2026-05-10T12:00:00Z', 'Доход', '1200.00', 'Зарплата'),
  sourceRow('SYN-2026-06', '2026-06-10T12:00:00Z', 'Расход', '140.00', 'Питание'),
  sourceRow('SYN-2026-07', '2026-07-10T12:00:00Z', 'Доход', '1300.00', 'Зарплата'),
  sourceRow('SYN-2026-08', '2026-08-10T12:00:00Z', 'Расход', '160.00', 'Питание')
];

const instrumented = instrumentedGateway(rows);
const snapshot = recent.readRecentCalendarMonths(instrumented.gateway, {
  default_currency: 'RUB',
  resolvers
}, 6);

assert.strictEqual(snapshot.schema, recent.SCHEMA);
assert.strictEqual(snapshot.contract_version, recent.VERSION);
assert.strictEqual(snapshot.requested_period_count, 6);
assert.strictEqual(snapshot.available_period_count, 6);
assert.strictEqual(snapshot.observed_period_count, 8);
assert.strictEqual(snapshot.complete, true);
assert.deepStrictEqual(snapshot.periods.map((entry) => entry.month_key), [
  '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'
]);
assert.deepStrictEqual(snapshot.periods.map((entry) => entry.items[0].transaction_id), [
  'SYN-2026-03', 'SYN-2026-04', 'SYN-2026-05', 'SYN-2026-06', 'SYN-2026-07', 'SYN-2026-08'
]);
assert.deepStrictEqual(snapshot.periods[0].period, {
  start: '2026-03-01', end: '2026-04-01', partial: false
});
assert.deepStrictEqual(snapshot.periods[5].period, {
  start: '2026-08-01', end: '2026-09-01', partial: false
});

// One lightweight full-timeline scan plus one bounded canonical read for the
// six selected contiguous source rows. Never six independent full queries.
assert.strictEqual(instrumented.calls.length, 2);
assert.deepStrictEqual(instrumented.calls.map((call) => [call.required_headers.length, call.start_row, call.row_count]), [
  [2, 2, 8],
  [15, 4, 6]
]);
assert.strictEqual(instrumented.calls[0].cell_read_count, 16);
assert.strictEqual(instrumented.calls[1].cell_read_count, 90);
assert(instrumented.calls[1].row_count < rows.length, 'full canonical read must remain bounded to selected periods');

// Less than six observed calendar periods is explicit incomplete evidence, not
// a synthetic zero-filled six-point series.
const sparse = instrumentedGateway(rows.slice(0, 3));
const incomplete = recent.readRecentCalendarMonths(sparse.gateway, {
  default_currency: 'RUB',
  resolvers
}, 6);
assert.strictEqual(incomplete.requested_period_count, 6);
assert.strictEqual(incomplete.available_period_count, 3);
assert.strictEqual(incomplete.observed_period_count, 3);
assert.strictEqual(incomplete.complete, false);
assert.deepStrictEqual(incomplete.periods.map((entry) => entry.month_key), ['2026-01', '2026-02', '2026-03']);
assert.strictEqual(sparse.calls.length, 2);
assert.deepStrictEqual(sparse.calls.map((call) => [call.required_headers.length, call.row_count]), [
  [2, 3], [15, 3]
]);

const empty = instrumentedGateway([]);
const emptySnapshot = recent.readRecentCalendarMonths(empty.gateway, {
  default_currency: 'RUB',
  resolvers
}, 6);
assert.strictEqual(emptySnapshot.complete, false);
assert.strictEqual(emptySnapshot.available_period_count, 0);
assert.strictEqual(emptySnapshot.observed_period_count, 0);
assert.deepStrictEqual(emptySnapshot.periods, []);
assert.strictEqual(empty.calls.length, 1, 'empty timeline must not trigger a full canonical read');

assert.throws(
  () => recent.readRecentCalendarMonths(instrumented.gateway, { default_currency: 'RUB', resolvers }, 0),
  /GOOGLE_RECENT_MONTHS_COUNT_INVALID/
);
assert.throws(
  () => recent.readRecentCalendarMonths(instrumented.gateway, { default_currency: 'RUB', resolvers }, 25),
  /GOOGLE_RECENT_MONTHS_COUNT_INVALID/
);

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'adapters', 'google_sheets_recent_months_projection.js'), 'utf8');
assert(!/\.readAll\s*\(/.test(source), 'recent-months path must not use full-history readAll');
assert(!/\.query\s*\(/.test(source), 'recent-months path must not issue repeated repository queries');
assert(!/https?:\/\//i.test(source), 'recent-months projection must not use network/CDN dependencies');

console.log('recent_months_projection_adapter_contract_test: OK', {
  requestedPeriods: 6,
  selectedPeriods: snapshot.available_period_count,
  observedPeriods: snapshot.observed_period_count,
  gatewayCalls: instrumented.calls.length,
  timelineColumns: instrumented.calls[0].required_headers.length,
  selectedCanonicalRows: instrumented.calls[1].row_count,
  insufficientDataExplicit: incomplete.complete === false,
  syntheticZeroFill: false,
  fullHistoryReadAll: false,
  financialWriteAuthority: false,
  freeOnly: true
});
