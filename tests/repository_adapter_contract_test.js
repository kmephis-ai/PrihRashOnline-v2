'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  REPOSITORY_SCHEMA,
  REPOSITORY_VERSION,
  CONTRACT,
  assertContract,
  normalizeQuery,
  applyQuery,
  repositoryRevision,
  createFakeTransactionRepository
} = require('../lib/repository/transaction_repository');
const {
  MAPPING,
  ADAPTER_SCHEMA,
  ADAPTER_VERSION,
  assertMappingContract,
  majorToMinorExact,
  createGoogleSheetsTransactionRepository
} = require('../lib/adapters/google_sheets_transaction_repository');
const {
  normalizeCanonicalTransaction
} = require('../lib/domain/canonical_transaction');
const { evaluateKpis } = require('../lib/finance/kpi_dictionary');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function canonical(id, overrides = {}) {
  return normalizeCanonicalTransaction({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: id,
    occurred_at: '2026-01-01T10:00:00Z',
    type: 'expense',
    status: 'posted',
    amount_minor: 1000,
    currency: 'RUB',
    account_id: 'ACC-MAIN',
    destination_account_id: null,
    category_id: 'CAT-FOOD',
    member_id: 'MEMBER-A',
    project_id: null,
    tags: ['home'],
    counterparty: null,
    description: 'Synthetic repository transaction',
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'repository-contract',
      source_record_id: id,
      source_fingerprint: sha256(`repo:${id}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYNTHETIC-v1',
      source_position: null
    },
    ...overrides
  });
}

assert.strictEqual(assertContract(), true);
assert.strictEqual(REPOSITORY_SCHEMA, 'PRH_TRANSACTION_REPOSITORY_V1');
assert.strictEqual(REPOSITORY_VERSION, '1.0.0');
assert.strictEqual(CONTRACT.capabilities.read, true);
assert.strictEqual(CONTRACT.capabilities.query, true);
assert.strictEqual(CONTRACT.capabilities.write_interface, true);
assert.strictEqual(CONTRACT.write.production_authority, 'EXPLICIT_FINANCIAL_MUTATION_POLICY_REQUIRED');
assert.strictEqual(assertMappingContract(), true);
assert.strictEqual(ADAPTER_SCHEMA, 'PRH_GOOGLE_SHEETS_TRANSACTION_ADAPTER_V1');
assert.strictEqual(ADAPTER_VERSION, '1.0.0');
assert.strictEqual(MAPPING.write_policy, 'BLOCKED_UNTIL_EXPLICIT_FINANCIAL_MUTATION_POLICY');

const seed = [
  canonical('SYN-REPO-001', { occurred_at: '2026-01-02T10:00:00Z', type: 'income', amount_minor: 50000, category_id: 'CAT-SALARY', tags: ['salary'] }),
  canonical('SYN-REPO-002', { occurred_at: '2026-01-03T10:00:00Z', amount_minor: 2500, category_id: 'CAT-FOOD', tags: ['food', 'home'] }),
  canonical('SYN-REPO-003', { occurred_at: '2026-01-04T10:00:00Z', status: 'pending', amount_minor: 1200, category_id: 'CAT-FOOD', tags: ['food'] })
];

const revisionA = repositoryRevision(seed);
assert(/^[0-9a-f]{64}$/.test(revisionA));
assert.strictEqual(repositoryRevision(seed.slice().reverse()), revisionA, 'repository revision must not depend on input order');

const query = normalizeQuery({
  statuses: ['posted'],
  category_id: 'CAT-FOOD',
  tags_any: ['food'],
  period_start: '2026-01-01',
  period_end: '2026-02-01',
  limit: 10
});
const queried = applyQuery(seed, query);
assert.strictEqual(queried.total_count, 1);
assert.strictEqual(queried.items[0].transaction_id, 'SYN-REPO-002');
assert.strictEqual(applyQuery(seed, { limit: 1 }).has_more, true);
assert.throws(() => normalizeQuery({ limit: 501 }), /REPOSITORY_QUERY_LIMIT_INVALID/);
assert.throws(() => normalizeQuery({ period_start: '2026-01-01' }), /REPOSITORY_QUERY_PERIOD_INCOMPLETE/);
assert.throws(() => normalizeQuery({ unknown: true }), /REPOSITORY_QUERY_SHAPE_INVALID/);

const readOnlyFake = createFakeTransactionRepository(seed);
assert.strictEqual(readOnlyFake.capabilities.write, false);
assert.strictEqual(readOnlyFake.writeBatch({}).reason_code, 'REPOSITORY_WRITE_POLICY_REQUIRED');

const writableFake = createFakeTransactionRepository(seed, { synthetic_write_authority: true });
const beforeRevision = writableFake.getRevision();
const added = canonical('SYN-REPO-004', {
  occurred_at: '2026-01-05T10:00:00Z',
  amount_minor: 700,
  provenance: {
    source_system: 'SYNTHETIC',
    source_container: 'repository-contract',
    source_record_id: 'SYN-REPO-004',
    source_fingerprint: sha256('repo:SYN-REPO-004'),
    identity_strategy: 'EXTERNAL_ID',
    transform_version: 'SYNTHETIC-v1',
    source_position: null
  }
});
const writeRequest = {
  idempotency_key: 'SYN-IDEMPOTENCY-0001',
  expected_revision: beforeRevision,
  operations: [{ action: 'PUT', transaction: added }]
};
const receipt1 = writableFake.writeBatch(writeRequest);
assert.strictEqual(receipt1.status, 'PASS');
assert.strictEqual(receipt1.applied_count, 1);
assert.strictEqual(receipt1.readback_count, 4);
assert.notStrictEqual(receipt1.revision, beforeRevision);
assert.deepStrictEqual(writableFake.writeBatch(writeRequest), receipt1, 'same idempotency key must replay same receipt');
const stale = writableFake.writeBatch({
  idempotency_key: 'SYN-IDEMPOTENCY-0002',
  expected_revision: beforeRevision,
  operations: [{ action: 'PUT', transaction: canonical('SYN-REPO-005') }]
});
assert.strictEqual(stale.status, 'BLOCKED');
assert.strictEqual(stale.reason_code, 'REPOSITORY_WRITE_STALE_REVISION');
assert.strictEqual(writableFake.getById('SYN-REPO-004').amount_minor, 700);

assert.strictEqual(majorToMinorExact('25.50'), 2550);
assert.strictEqual(majorToMinorExact('25,50'), 2550);
assert.strictEqual(majorToMinorExact(1000), 100000);
assert.throws(() => majorToMinorExact('1.001'), /GOOGLE_ADAPTER_AMOUNT_PRECISION_INVALID/);

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
const dimensionMap = {
  account: { 'Основной': 'ACC-MAIN', 'Накопления': 'ACC-SAVINGS' },
  category: { 'Зарплата': 'CAT-SALARY', 'Питание': 'CAT-FOOD', 'Перевод': 'CAT-TRANSFER' },
  member: { 'А': 'MEMBER-A' },
  project: { 'Дом': 'PROJECT-HOME' }
};
const resolvers = {};
for (const kind of Object.keys(dimensionMap)) {
  resolvers[kind] = (label) => dimensionMap[kind][label] || '';
}
const tableGateway = {
  readOperationsTable: () => ({
    schema: 'PRH_GOOGLE_OPERATIONS_TABLE_V1',
    sheet_name: '01 Операции',
    start_row: 2,
    headers,
    rows
  })
};
const googleRepo = createGoogleSheetsTransactionRepository(tableGateway, { default_currency: 'RUB', resolvers });
assert.strictEqual(googleRepo.capabilities.read, true);
assert.strictEqual(googleRepo.capabilities.query, true);
assert.strictEqual(googleRepo.capabilities.write, false);
assert.strictEqual(googleRepo.capabilities.write_interface, true);
const googleAll = googleRepo.readAll();
assert.strictEqual(googleAll.length, 4);
assert.deepStrictEqual(googleAll.map((tx) => tx.transaction_id), ['G-TX-001', 'G-TX-002', 'G-TX-003', 'G-TX-004']);
assert.strictEqual(googleAll[0].amount_minor, 100000);
assert.strictEqual(googleAll[1].amount_minor, 2550);
assert.deepStrictEqual(googleAll[1].tags, ['food', 'home']);
assert.strictEqual(googleAll[2].destination_account_id, 'ACC-SAVINGS');
assert.strictEqual(googleAll[3].adjustment_semantics, 'expense_reduction');
assert.strictEqual(googleAll[0].currency, 'RUB');
assert.strictEqual(googleRepo.query({ types: ['expense'], statuses: ['posted'] }).total_count, 1);
assert.strictEqual(googleRepo.getById('G-TX-003').type, 'transfer');
assert(/^[0-9a-f]{64}$/.test(googleRepo.getRevision()));
const googleWrite = googleRepo.writeBatch({ any: 'payload-is-not-inspected-while-blocked' });
assert.strictEqual(googleWrite.status, 'BLOCKED');
assert.strictEqual(googleWrite.reason_code, 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED');

const googleKpis = evaluateKpis(googleAll, { currency: 'RUB' });
assert.strictEqual(googleKpis.income_minor, 100000);
assert.strictEqual(googleKpis.expense_minor, 2000);
assert.strictEqual(googleKpis.cash_flow_minor, 98000);
assert.strictEqual(googleKpis.transfer_minor, 10000);

// Row movement changes only source_position; logical source ID and fingerprint remain stable.
const movedRepo = createGoogleSheetsTransactionRepository({
  readOperationsTable: () => ({
    schema: 'PRH_GOOGLE_OPERATIONS_TABLE_V1',
    sheet_name: '01 Операции',
    start_row: 40,
    headers,
    rows: [rows[0]]
  })
}, { default_currency: 'RUB', resolvers });
const originalFirst = googleAll[0];
const movedFirst = movedRepo.readAll()[0];
assert.strictEqual(movedFirst.provenance.source_record_id, originalFirst.provenance.source_record_id);
assert.strictEqual(movedFirst.provenance.source_fingerprint, originalFirst.provenance.source_fingerprint);
assert.notStrictEqual(movedFirst.provenance.source_position, originalFirst.provenance.source_position);

assert.throws(
  () => createGoogleSheetsTransactionRepository(tableGateway, { resolvers }),
  /GOOGLE_ADAPTER_DEFAULT_CURRENCY_REQUIRED/
);
assert.throws(
  () => createGoogleSheetsTransactionRepository(tableGateway, { default_currency: 'RUB', resolvers: {} }).readAll(),
  /GOOGLE_ADAPTER_ACCOUNT_RESOLVER_REQUIRED/
);
assert.throws(
  () => createGoogleSheetsTransactionRepository({
    readOperationsTable: () => ({ schema: 'PRH_GOOGLE_OPERATIONS_TABLE_V1', sheet_name: '01 Операции', start_row: 2, headers: headers.filter((h) => h !== 'ID'), rows })
  }, { default_currency: 'RUB', resolvers }).readAll(),
  /GOOGLE_ADAPTER_REQUIRED_HEADER_MISSING/
);

// Apps Script gateway integration contract with synthetic SpreadsheetApp sheet stub.
const gatewaySource = fs.readFileSync(path.join(__dirname, '..', 'GoogleTransactionRepositoryGateway.js'), 'utf8');
assert(/getSheetRequired_\(PR_CONFIG\.SHEETS\.OPERATIONS\)/.test(gatewaySource));
assert(/operationWriteGuard_\(\)/.test(gatewaySource));
assert(/GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED/.test(gatewaySource));
assert(!/\.getDataRange\s*\(/.test(gatewaySource), 'Google operations gateway must not use full data-range reads');
assert(!/\.setValues?\s*\(/.test(gatewaySource), 'Google operations gateway must not contain write primitive');
assert(!/\.appendRow\s*\(/.test(gatewaySource), 'Google operations gateway must not contain append primitive');
assert(!/\.deleteRow\s*\(/.test(gatewaySource), 'Google operations gateway must not contain delete primitive');

let legacyGuardCalls = 0;
const gatewayReadCalls = [];
const syntheticSheet = {
  getLastRow: () => rows.length + 1,
  getLastColumn: () => headers.length,
  getRange: (row, col, height, width) => ({
    getValues: () => {
      gatewayReadCalls.push({ row, col, height, width });
      assert(Number.isInteger(row) && row >= 1);
      assert(Number.isInteger(col) && col >= 1);
      assert(Number.isInteger(height) && height >= 1);
      assert(Number.isInteger(width) && width >= 1);
      if (row === 1) {
        assert.strictEqual(col, 1);
        assert.strictEqual(height, 1);
        assert.strictEqual(width, headers.length);
        return [headers.slice()];
      }
      const startOffset = row - 2;
      return rows.slice(startOffset, startOffset + height).map((record) =>
        record.slice(col - 1, col - 1 + width)
      );
    }
  })
};
const context = {
  PR_CONFIG: { SHEETS: { OPERATIONS: '01 Операции' } },
  getSheetRequired_: (name) => {
    assert.strictEqual(name, '01 Операции');
    return syntheticSheet;
  },
  operationWriteGuard_: () => { legacyGuardCalls += 1; return true; },
  Object,
  Array,
  String,
  Error
};
vm.createContext(context);
vm.runInContext(gatewaySource, context, { filename: 'GoogleTransactionRepositoryGateway.js' });
const gatewaySnapshot = context.prhGoogleRepositoryReadOperationsTable_({
  required_headers: MAPPING.required_headers.slice()
});
assert.strictEqual(gatewaySnapshot.schema, 'PRH_GOOGLE_OPERATIONS_TABLE_V1');
assert.strictEqual(gatewaySnapshot.rows.length, rows.length);
assert.deepStrictEqual(Array.from(gatewaySnapshot.headers), MAPPING.required_headers);
assert.deepStrictEqual(Array.from(context.PRH_GOOGLE_REPOSITORY_GATEWAY.REQUIRED_HEADERS), MAPPING.required_headers);
assert.strictEqual(gatewaySnapshot.read_plan.projected_column_count, MAPPING.required_headers.length);
assert.strictEqual(gatewaySnapshot.read_plan.row_count, rows.length);
assert.strictEqual(gatewaySnapshot.read_plan.cell_read_count, MAPPING.required_headers.length * rows.length);
assert(gatewaySnapshot.read_plan.cell_read_count < headers.length * rows.length);
assert.strictEqual(gatewayReadCalls[0].row, 1, 'first gateway read must be header discovery');
assert.strictEqual(gatewayReadCalls[0].height, 1, 'header discovery must read one row only');
assert(gatewayReadCalls.slice(1).every((call) => call.row === 2 && call.height === rows.length));
assert(gatewayReadCalls.slice(1).every((call) => call.width < headers.length));
const gatewayStatus = context.prhGoogleRepositoryGatewayStatus();
assert.strictEqual(gatewayStatus.write_authorized, false);
assert.strictEqual(gatewayStatus.write_reason, 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED');
assert.strictEqual(gatewayStatus.projected_read_capability, true);
assert.strictEqual(gatewayStatus.projection_schema, 'PRH_GOOGLE_PROJECTED_READ_V1');
assert(!Object.prototype.hasOwnProperty.call(gatewayStatus, 'rows'));
assert(!Object.prototype.hasOwnProperty.call(gatewayStatus, 'revision'));
assert.throws(() => context.prhGoogleRepositoryApplyCanonicalBatch_(), /GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED/);
assert.strictEqual(legacyGuardCalls, 1);

// Google-specific runtime calls must stay outside the pure ARCH-010 boundary.
for (const rel of ['lib/domain', 'lib/finance', 'lib/migration', 'lib/application']) {
  const stack = [path.join(__dirname, '..', rel)];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        const source = fs.readFileSync(full, 'utf8');
        assert(!/\bSpreadsheetApp\b/.test(source), `${rel} leaked SpreadsheetApp dependency`);
      }
    }
  }
}

console.log('repository_adapter_contract_test: OK', {
  repository: `${REPOSITORY_SCHEMA}@${REPOSITORY_VERSION}`,
  fakeReadQuery: true,
  fakeSyntheticWriteContract: true,
  fakeIdempotency: true,
  fakeOptimisticRevision: true,
  googleAdapter: `${ADAPTER_SCHEMA}@${ADAPTER_VERSION}`,
  googleMapping: MAPPING.version,
  googleReadQuery: true,
  googleProjectedRead: true,
  googleWriteAuthorized: false,
  googleWriteReason: 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED',
  appsScriptGatewaySyntheticIntegration: true,
  appsScriptGatewayWritePrimitives: false,
  pureCoreGoogleDependency: false,
  financialParity: true
});
