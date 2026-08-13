'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'R2DataRuntimeService.js'), 'utf8');
new vm.Script(source, { filename: 'R2DataRuntimeService.js' });

const runtime = Object.freeze({
  schema: 'PRH_R2_CANONICAL_RUNTIME_BUNDLE_V1',
  generated_from_canonical_lib: true,
  financial_formula_copy: false,
  googleAdapter: require('../lib/adapters/google_sheets_transaction_repository'),
  transactionExplorer: require('../lib/explorer/transaction_explorer'),
  dataQuality: require('../lib/data_quality/data_quality_center'),
  financialReconciliation: require('../lib/finance/financial_reconciliation'),
  singleScanRefresh: require('../lib/repository/single_scan_refresh')
});

const fullHeaders = [
  'ID', 'Дата и время', 'Тип', 'Сумма', 'Счёт', 'Счёт назначения',
  'Категория', 'Наименование', 'Член семьи', 'Проект', 'Теги',
  'Комментарий', 'Источник', 'Строка источника', 'Статус'
];
let rawRows = [
  ['TX-001', '2026-08-01T10:00:00Z', 'Расход', '100.00', 'Основной', '', 'Продукты', 'Магазин', 'Андрей', '', 'дом', '', 'Форма', '1', 'Проведено'],
  ['TX-002', '2026-08-02T10:00:00Z', 'Доход', '500.00', 'Основной', '', 'Зарплата', 'Зарплата', 'Андрей', '', '', '', 'Форма', '2', 'Проведено'],
  ['TX-003', '2026-08-03T10:00:00Z', 'Расход', '50.00', 'Основной', '', 'Транспорт', 'Такси', 'Андрей', '', '', '', 'Форма', '3', 'Ожидает'],
  ['TX-004', '2026-08-01T10:00:00Z', 'Расход', '100.00', 'Основной', '', 'Продукты', 'Магазин', 'Андрей', '', 'дом', '', 'Импорт', '77', 'Проведено']
];
let unavailable = false;
let malformed = false;
let gatewayCalls = 0;

function createDimensionState() {
  const byKind = {};
  ['account', 'category', 'member', 'project'].forEach((kind) => { byKind[kind] = { byLabel: new Map(), byId: new Map() }; });
  function resolver(kind) {
    return (value) => {
      const label = String(value).trim();
      const store = byKind[kind];
      if (store.byLabel.has(label)) return store.byLabel.get(label);
      const id = `${kind}:${store.byLabel.size + 1}`;
      store.byLabel.set(label, id);
      store.byId.set(id, label);
      return id;
    };
  }
  return Object.freeze({
    resolvers: Object.freeze({ account: resolver('account'), category: resolver('category'), member: resolver('member'), project: resolver('project') }),
    displayLabel(kind, id) {
      const value = byKind[kind].byId.get(String(id));
      if (!value) throw new Error('R2_RUNTIME_DIMENSION_DISPLAY_LABEL_MISSING');
      return value;
    },
    telemetry() { return Object.freeze({ unique_dimension_hash_count: 0, dimension_hash_memo_hit_count: 0 }); }
  });
}

function gatewaySnapshot(request) {
  gatewayCalls += 1;
  if (unavailable) throw Object.assign(new Error('SPREADSHEET_UNAVAILABLE'), { code: 'SPREADSHEET_UNAVAILABLE' });
  const requested = Array.isArray(request.required_headers) ? request.required_headers.slice() : fullHeaders.slice();
  const effective = malformed ? requested.filter((header) => header !== 'Категория') : requested;
  const startRow = request.start_row == null ? 2 : Number(request.start_row);
  const startIndex = startRow - 2;
  const available = Math.max(0, rawRows.length - startIndex);
  const rowCount = request.row_count == null ? available : Number(request.row_count);
  const rows = rawRows.slice(startIndex, startIndex + rowCount).map((row) => effective.map((header) => row[fullHeaders.indexOf(header)]));
  return {
    schema: 'PRH_GOOGLE_OPERATIONS_TABLE_V1',
    sheet_name: '01 Операции',
    start_row: startRow,
    headers: effective,
    rows,
    read_plan: {
      range_read_count: rowCount ? 1 : 0,
      cell_read_count: rowCount * effective.length
    }
  };
}

const context = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON,
  prhR2CanonicalRuntime_() { return runtime; },
  prhR2FinCurrency_() { return 'RUB'; },
  prhR2FinCreateDimensionResolverState_: createDimensionState,
  prhR2FinSha256Hex_(value) { return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex'); },
  prhGoogleRepositoryReadOperationsTable_: gatewaySnapshot,
  prhPrivacyResolveMode_(value) { return String(value || 'NORMAL').trim().toUpperCase(); }
});
vm.runInContext(source, context, { filename: 'R2DataRuntimeService.js' });

assert.strictEqual(context.PRH_R2_DATA_RUNTIME.WRITE_AUTHORITY, false);
assert.strictEqual(context.PRH_R2_DATA_RUNTIME.AUTO_REPAIR_AUTHORITY, false);
assert.strictEqual(context.PRH_R2_DATA_RUNTIME.FREE_ONLY, true);
assert.strictEqual(context.prhR2DataRuntimeSmokeToken(), 'PRH_R2_DATA_RUNTIME_V1|READ_ONLY|OK');

const tx = context.prhR2FetchTransactionsPayload({
  privacy_mode: 'NORMAL',
  query: { limit: 2, offset: 0, sort: { field: 'occurred_at', direction: 'DESC' } }
});
assert.strictEqual(tx.schema, 'PRH_R2_PRIVATE_TRANSACTIONS_VIEW_V1');
assert.strictEqual(tx.state, 'READY');
assert.strictEqual(tx.financial_write_authorized, false);
assert.strictEqual(tx.canonical_mutation_performed, false);
assert(/^[0-9a-f]{64}$/.test(tx.snapshot_revision));
assert.strictEqual(tx.snapshot_revision_prefix, tx.snapshot_revision.slice(0, 12));
assert.strictEqual(tx.page_count, 2);
assert.strictEqual(tx.rows.length, 2);
assert(tx.filters.accounts.some((item) => item.label === 'Основной'));
assert(tx.filters.categories.length >= 3);
assert.strictEqual(tx.page_financials.policy_version, 'FIN-TRUTH-v1');
assert.strictEqual(tx.telemetry.canonical_snapshot_read_count, 1);
assert.strictEqual(tx.telemetry.financial_payload_in_telemetry, false);
assert(!JSON.stringify(tx).includes('TX-001'), 'private transaction identity must not be returned to browser view');
assert(!Object.prototype.hasOwnProperty.call(tx.rows[0], 'transaction_id'));

const dq = context.prhR2FetchDataQualityPayload({ privacy_mode: 'NORMAL', expected_revision: tx.snapshot_revision });
assert.strictEqual(dq.schema, 'PRH_R2_PRIVATE_DATA_QUALITY_VIEW_V1');
assert.strictEqual(dq.state, 'READY');
assert.strictEqual(dq.snapshot_revision, tx.snapshot_revision, 'Transactions and DQ must prove identical canonical snapshot revision');
assert.strictEqual(dq.repair_write_authorized, false);
assert.strictEqual(dq.canonical_mutation_performed, false);
assert(dq.kind_counts.EXACT_DUPLICATE >= 2, 'duplicate business payload must be surfaced without autofix');
assert(dq.findings.every((item) => item.autofix === false));
assert(dq.findings.every((item) => !Object.prototype.hasOwnProperty.call(item, 'record_hash')));
assert(!JSON.stringify(dq).includes('TX-001'), 'DQ browser payload must not expose transaction identities');
assert.strictEqual(dq.telemetry.canonical_snapshot_read_count, 1);
assert.strictEqual(dq.telemetry.financial_payload_in_telemetry, false);

const masked = context.prhR2FetchTransactionsPayload({ privacy_mode: 'MASKED', query: { limit: 5 } });
assert.strictEqual(masked.state, 'READY');
assert(masked.rows.every((row) => row.amount_minor === null));
assert(masked.rows.every((row) => row.description === null && row.counterparty === null));
assert.deepStrictEqual(Array.from(masked.filters.accounts), []);
assert.deepStrictEqual(Array.from(masked.filters.categories), []);
assert.deepStrictEqual(Array.from(masked.filters.members), []);

const oldRevision = tx.snapshot_revision;
rawRows = rawRows.map((row, index) => index === 2 ? row.map((value, column) => column === 3 ? '51.00' : value) : row.slice());
const stale = context.prhR2FetchDataQualityPayload({ privacy_mode: 'NORMAL', expected_revision: oldRevision });
assert.strictEqual(stale.state, 'STALE_SNAPSHOT');
assert.notStrictEqual(stale.snapshot_revision, oldRevision);
assert.strictEqual(stale.retryable, true);

malformed = true;
const malformedView = context.prhR2FetchTransactionsPayload({ privacy_mode: 'NORMAL', query: { limit: 5 } });
assert.strictEqual(malformedView.state, 'MALFORMED_SOURCE');
assert.strictEqual(malformedView.canonical_mutation_performed, false);
malformed = false;

unavailable = true;
const unavailableView = context.prhR2FetchDataQualityPayload({ privacy_mode: 'NORMAL' });
assert.strictEqual(unavailableView.state, 'SOURCE_UNAVAILABLE');
assert.strictEqual(unavailableView.repair_write_authorized, false);
unavailable = false;

const demo = context.prhR2FetchTransactionsPayload({ privacy_mode: 'DEMO' });
assert.strictEqual(demo.state, 'PRIVACY_MODE_UNAVAILABLE');
assert.strictEqual(demo.financial_write_authorized, false);

assert(gatewayCalls >= 5, 'private runtime contract should exercise canonical Google repository boundary');
assert.doesNotMatch(source, /\.setValue\s*\(|\.setValues\s*\(|appendRow\s*\(|deleteRow\s*\(/);
assert.match(source, /singleScanRefresh\.createSingleScanRefresh/);
assert.match(source, /transactionExplorer\.exploreTransactions/);
assert.match(source, /dataQuality\.scanRecords/);
assert.match(source, /financialReconciliation\.aggregateTransactions/);

console.log('r2_data_runtime_contract_test: OK', {
  sameRevisionTransactionsAndDQ: true,
  finTruthPageSummary: true,
  boundedBrowserIdentity: true,
  malformedFailClosed: true,
  unavailableFailClosed: true,
  staleFailClosed: true,
  maskedPrivateView: true,
  zeroWrite: true
});
