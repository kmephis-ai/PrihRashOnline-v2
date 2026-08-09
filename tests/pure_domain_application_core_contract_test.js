'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  APPLICATION_SCHEMA,
  APPLICATION_VERSION,
  USE_CASES,
  CONTRACT,
  assertContract,
  validateCanonicalDataset,
  calculateFinancialSnapshot,
  reviewMigration,
  planIdempotentMigration,
  runUseCase
} = require('../lib/application/financial_core');
const {
  SCHEMA_ID,
  SCHEMA_VERSION,
  normalizeCanonicalTransaction,
  fromMigrationCanonicalRecord
} = require('../lib/domain/canonical_transaction');
const { evaluateKpis } = require('../lib/finance/kpi_dictionary');
const { generateSyntheticFinanceFixture } = require('./fixtures/synthetic_finance');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function canonicalFromSynthetic(row) {
  const sourceId = String(row.transaction_id);
  return normalizeCanonicalTransaction({
    schema: SCHEMA_ID,
    schema_version: SCHEMA_VERSION,
    transaction_id: row.transaction_id,
    occurred_at: row.occurred_at,
    type: row.type,
    status: row.status || 'posted',
    amount_minor: row.amount_minor,
    currency: row.currency,
    account_id: row.account_id,
    destination_account_id: row.destination_account_id,
    category_id: row.category_id,
    member_id: null,
    project_id: null,
    tags: [],
    counterparty: null,
    description: row.description == null ? null : String(row.description),
    reverses_transaction_id: row.reverses_transaction_id == null ? null : String(row.reverses_transaction_id),
    adjustment_semantics: row.adjustment_semantics == null ? null : String(row.adjustment_semantics),
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'fixture:application_core',
      source_record_id: sourceId,
      source_fingerprint: sha256(`app-core:${sourceId}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYNTHETIC-v1',
      source_position: null
    }
  });
}

function migrationSource(overrides = {}) {
  return {
    transaction_id: 'SYN-MIG-APP-001',
    source_system: 'SYN-FORM',
    source_sheet: 'SYN-SOURCE',
    source_row: 10,
    transform_version: 'SOURCE-TRANSFORM-v1',
    occurred_at: '2026-01-15T10:00:00Z',
    type: 'income',
    status: 'posted',
    amount_minor: 12345,
    currency: 'USD',
    account_id: 'SYN-ACCOUNT-A',
    destination_account_id: '',
    category_id: 'SYN-INCOME',
    name: 'Synthetic application migration',
    ...overrides
  };
}

assert.strictEqual(assertContract(), true);
assert.strictEqual(APPLICATION_SCHEMA, 'PRH_APPLICATION_CORE_V1');
assert.strictEqual(APPLICATION_VERSION, '1.0.0');
assert.deepStrictEqual(USE_CASES, [
  'VALIDATE_CANONICAL_DATASET',
  'CALCULATE_FINANCIAL_SNAPSHOT',
  'REVIEW_MIGRATION',
  'PLAN_IDEMPOTENT_IMPORT'
]);
assert.strictEqual(CONTRACT.runtime_model, 'PURE_IN_PROCESS');
assert.strictEqual(CONTRACT.io_authority, false);
assert.strictEqual(CONTRACT.financial_write_authority, false);
assert.strictEqual(CONTRACT.network_authority, false);

const rawGolden = generateSyntheticFinanceFixture({ profile: 'golden' }).transactions;
const canonicalGolden = rawGolden.map(canonicalFromSynthetic);
const beforeJson = JSON.stringify(canonicalGolden);

const validation = validateCanonicalDataset(canonicalGolden);
assert.strictEqual(validation.schema, 'PRH_DATASET_VALIDATION_RESULT_V1');
assert.strictEqual(validation.status, 'PASS');
assert.strictEqual(validation.transaction_count, canonicalGolden.length);
assert.strictEqual(Object.isFrozen(validation), true);
assert.strictEqual(Object.isFrozen(validation.transactions), true);

const options = { currency: 'USD', budget_minor: 500000 };
const snapshot1 = calculateFinancialSnapshot(canonicalGolden, options);
const snapshot2 = calculateFinancialSnapshot(canonicalGolden, options);
assert.deepStrictEqual(snapshot2, snapshot1);
assert.strictEqual(JSON.stringify(canonicalGolden), beforeJson, 'application core must not mutate canonical inputs');
assert.strictEqual(snapshot1.schema, 'PRH_FINANCIAL_SNAPSHOT_V1');
assert.strictEqual(snapshot1.application_core_version, APPLICATION_VERSION);
assert.strictEqual(snapshot1.canonical_schema, 'PRH_CANONICAL_TRANSACTION_V1@1');
assert.strictEqual(Object.isFrozen(snapshot1.values), true);

const directKpis = evaluateKpis(canonicalGolden, options);
for (const field of [
  'income_minor', 'expense_minor', 'cash_flow_minor', 'savings_minor',
  'budget_variance_minor', 'gross_expense_minor', 'refund_minor', 'transfer_minor'
]) {
  assert.strictEqual(snapshot1.values[field], directKpis[field]);
}

const validationUseCase = runUseCase('VALIDATE_CANONICAL_DATASET', { transactions: canonicalGolden });
assert.strictEqual(validationUseCase.status, 'PASS');
assert.strictEqual(validationUseCase.result.transaction_count, canonicalGolden.length);
const snapshotUseCase = runUseCase('CALCULATE_FINANCIAL_SNAPSHOT', { transactions: canonicalGolden, options });
assert.strictEqual(snapshotUseCase.status, 'PASS');
assert.deepStrictEqual(snapshotUseCase.result.values, snapshot1.values);
assert.strictEqual(runUseCase('UNKNOWN_USE_CASE', {}).reason_code, 'APP_CORE_USE_CASE_UNKNOWN');

const invalid = { ...canonicalGolden[0], amount_minor: 1.5 };
const blocked = runUseCase('VALIDATE_CANONICAL_DATASET', { transactions: [invalid] });
assert.strictEqual(blocked.status, 'BLOCKED');
assert.strictEqual(blocked.reason_code, 'CANONICAL_AMOUNT_MINOR_INVALID');
assert(!Object.prototype.hasOwnProperty.call(blocked, 'payload'));
assert(!Object.prototype.hasOwnProperty.call(blocked, 'error'));

const source = migrationSource();
const migrationCanonical = fromMigrationCanonicalRecord(source);
const sourceBefore = JSON.stringify(source);
const canonicalBefore = JSON.stringify(migrationCanonical);
const reviewClean = reviewMigration([source], [migrationCanonical]);
assert.strictEqual(reviewClean.schema, 'PRH_MIGRATION_REVIEW_RESULT_V1');
assert.strictEqual(reviewClean.summary.clean_count, 1);
assert.strictEqual(reviewClean.summary.review_count, 0);
assert.strictEqual(reviewClean.results[0].reason, 'CLEAN');
const plan = planIdempotentMigration([source], [migrationCanonical]);
assert.strictEqual(plan.schema, 'PRH_MIGRATION_IMPORT_PLAN_V1');
assert.strictEqual(plan.plan[0].action, 'REUSE');
assert.strictEqual(JSON.stringify(source), sourceBefore, 'migration review must not mutate source input');
assert.strictEqual(JSON.stringify(migrationCanonical), canonicalBefore, 'migration review must not mutate canonical input');

const movedReview = reviewMigration([{ ...source, source_row: 44 }], [migrationCanonical]);
assert.strictEqual(movedReview.summary.clean_count, 0);
assert.strictEqual(movedReview.results[0].reason, 'SOURCE_ROW_MOVED');

const reviewUseCase = runUseCase('REVIEW_MIGRATION', {
  source_records: [source],
  canonical_transactions: [migrationCanonical]
});
assert.strictEqual(reviewUseCase.status, 'PASS');
assert.strictEqual(reviewUseCase.result.summary.clean_count, 1);
const planUseCase = runUseCase('PLAN_IDEMPOTENT_IMPORT', {
  source_records: [source],
  canonical_transactions: [migrationCanonical]
});
assert.strictEqual(planUseCase.status, 'PASS');
assert.strictEqual(planUseCase.result.plan[0].action, 'REUSE');

// Static dependency boundary: pure core may depend only on lib/* and allowlisted Node builtins.
const root = path.join(__dirname, '..');
const pureRoots = ['lib/domain', 'lib/finance', 'lib/migration', 'lib/application'];
const forbiddenRuntime = /\b(?:SpreadsheetApp|UrlFetchApp|HtmlService|PropertiesService|LockService|CacheService|DriveApp|DocumentApp|FormApp|window|document|localStorage|fetch)\b/;
const allowedBuiltins = new Set(['crypto']);
const scanned = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) scanned.push(full);
  }
}

for (const rel of pureRoots) walk(path.join(root, rel));
assert(scanned.length >= 4);
for (const file of scanned) {
  const sourceText = fs.readFileSync(file, 'utf8');
  assert(!forbiddenRuntime.test(sourceText), `${path.relative(root, file)} contains platform/UI dependency`);
  const requireRe = /require\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = requireRe.exec(sourceText))) {
    const spec = match[1];
    if (!spec.startsWith('.')) {
      assert(allowedBuiltins.has(spec), `${path.relative(root, file)} imports non-allowlisted external/builtin ${spec}`);
      continue;
    }
    const resolved = path.resolve(path.dirname(file), spec);
    const relResolved = path.relative(root, resolved).split(path.sep).join('/');
    assert(relResolved.startsWith('lib/'), `${path.relative(root, file)} imports outside pure lib boundary: ${spec}`);
  }
}

console.log('pure_domain_application_core_contract_test: OK', {
  schema: APPLICATION_SCHEMA,
  version: APPLICATION_VERSION,
  useCases: USE_CASES,
  pureFilesScanned: scanned.length,
  spreadsheetAppDependency: false,
  uiDomDependency: false,
  networkDependency: false,
  financialWriteAuthority: false,
  canonicalValidationReused: true,
  kpiParity: true,
  migrationParity: true,
  deterministic: true,
  inputMutation: false
});
