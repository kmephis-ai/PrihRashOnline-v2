'use strict';

const assert = require('assert');
const crypto = require('crypto');
const {
  SCHEMA,
  SCHEMA_ID,
  SCHEMA_VERSION,
  CANONICAL_FIELDS,
  PROVENANCE_FIELDS,
  normalizeCanonicalTransaction,
  validateCanonicalCollection,
  toFinTruthTransaction,
  assertFinTruthCompatibility,
  sourceIdentityKey,
  assertSourceIdentityImmutable,
  fromMigrationCanonicalRecord,
  toMigrationCompatibilityRecord,
  assertMigrationFingerprintParity
} = require('../lib/domain/canonical_transaction');
const {
  TRANSFORM_VERSION,
  canonicalFingerprint
} = require('../lib/migration/migration_reconciliation');
const { aggregateTransactions } = require('../lib/finance/financial_reconciliation');
const { evaluateKpis } = require('../lib/finance/kpi_dictionary');
const { generateSyntheticFinanceFixture } = require('./fixtures/synthetic_finance');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function canonicalFromSynthetic(row, overrides = {}) {
  const sourceId = String(row.source_external_id || row.transaction_id);
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
    member_id: row.member_id == null ? null : String(row.member_id),
    project_id: row.project_id == null ? null : String(row.project_id),
    tags: Array.isArray(row.tags) ? row.tags : [],
    counterparty: row.counterparty == null ? null : String(row.counterparty),
    description: row.description == null ? null : String(row.description),
    reverses_transaction_id: row.reverses_transaction_id == null ? null : String(row.reverses_transaction_id),
    adjustment_semantics: row.adjustment_semantics == null ? null : String(row.adjustment_semantics),
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'fixture:synthetic_finance',
      source_record_id: sourceId,
      source_fingerprint: sha256(`synthetic-source:${sourceId}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYNTHETIC-v1',
      source_position: null
    },
    ...overrides
  });
}

function legacyMigration(overrides = {}) {
  return {
    transaction_id: 'SYN-MIG-TX-001',
    source_system: 'SYN-FORM',
    source_sheet: 'SYN-SOURCE',
    source_row: 10,
    transform_version: TRANSFORM_VERSION,
    occurred_at: '2026-01-15T10:00:00Z',
    type: 'income',
    amount_minor: 12345,
    currency: 'USD',
    account_id: 'SYN-ACCOUNT-A',
    destination_account_id: '',
    category_id: 'SYN-INCOME',
    name: 'Synthetic migration income',
    ...overrides
  };
}

assert.strictEqual(SCHEMA.title, 'PrihRashOnline Canonical Transaction v1');
assert.strictEqual(SCHEMA.additionalProperties, false);
assert.strictEqual(SCHEMA.properties.schema.const, SCHEMA_ID);
assert.strictEqual(SCHEMA.properties.schema_version.const, SCHEMA_VERSION);
assert.deepStrictEqual(SCHEMA.required.slice().sort(), CANONICAL_FIELDS.slice().sort());
assert.deepStrictEqual(SCHEMA.properties.provenance.required.slice().sort(), PROVENANCE_FIELDS.slice().sort());
assert.strictEqual(SCHEMA.properties.provenance.additionalProperties, false);

const golden = generateSyntheticFinanceFixture({ profile: 'golden' }).transactions;
const canonicalGolden = golden.map(canonicalFromSynthetic);
assert.strictEqual(validateCanonicalCollection(canonicalGolden).length, golden.length);
canonicalGolden.forEach((tx) => {
  assert.strictEqual(tx.schema, SCHEMA_ID);
  assert.strictEqual(tx.schema_version, 1);
  assert.strictEqual(assertFinTruthCompatibility(tx), true);
  assert.strictEqual(tx.amount_minor, toFinTruthTransaction(tx).amount_minor);
  assert.strictEqual(Object.isFrozen(tx), true);
  assert.strictEqual(Object.isFrozen(tx.provenance), true);
});

// Canonical schema must preserve FIN-010/FIN-001 financial semantics exactly.
const originalKpis = evaluateKpis(golden, { currency: 'USD' });
const canonicalKpis = evaluateKpis(canonicalGolden, { currency: 'USD' });
for (const field of ['income_minor', 'expense_minor', 'cash_flow_minor', 'savings_minor', 'refund_minor', 'transfer_minor']) {
  assert.strictEqual(canonicalKpis[field], originalKpis[field]);
}
const canonicalFinancial = aggregateTransactions(canonicalGolden.map(toFinTruthTransaction));
assert.strictEqual(canonicalFinancial.cash_flow_minor, originalKpis.cash_flow_minor);

// Household dimensions are explicit domain fields, not Sheet headers.
const expense = golden.find((row) => row.type === 'expense');
const dimensioned = canonicalFromSynthetic(expense, {
  member_id: 'MEMBER-A',
  project_id: 'PROJECT-HOME',
  tags: ['utilities', 'home']
});
assert.strictEqual(dimensioned.member_id, 'MEMBER-A');
assert.strictEqual(dimensioned.project_id, 'PROJECT-HOME');
assert.deepStrictEqual(dimensioned.tags, ['home', 'utilities']);

// Strict shape/version/identity validation.
assert.throws(() => normalizeCanonicalTransaction({ ...dimensioned, extra_field: true }), /CANONICAL_TRANSACTION_SHAPE_INVALID/);
assert.throws(() => normalizeCanonicalTransaction({ ...dimensioned, schema_version: 2 }), /CANONICAL_SCHEMA_VERSION_INVALID/);
assert.throws(() => normalizeCanonicalTransaction({ ...dimensioned, transaction_id: '' }), /CANONICAL_TRANSACTION_ID_INVALID/);
assert.throws(() => normalizeCanonicalTransaction({ ...dimensioned, occurred_at: '2026-01-01' }), /CANONICAL_OCCURRED_AT_INVALID/);
assert.throws(() => normalizeCanonicalTransaction({ ...dimensioned, type: 'other' }), /CANONICAL_TYPE_INVALID/);
assert.throws(() => normalizeCanonicalTransaction({ ...dimensioned, status: 'mystery' }), /CANONICAL_STATUS_INVALID/);
assert.throws(() => normalizeCanonicalTransaction({ ...dimensioned, amount_minor: 1.25 }), /CANONICAL_AMOUNT_MINOR_INVALID/);
assert.throws(() => normalizeCanonicalTransaction({ ...dimensioned, amount_minor: -1 }), /CANONICAL_AMOUNT_MINOR_INVALID/);
assert.throws(() => normalizeCanonicalTransaction({ ...dimensioned, currency: 'usd' }), /CANONICAL_CURRENCY_INVALID/);
assert.throws(() => normalizeCanonicalTransaction({ ...dimensioned, tags: ['x', 'x'] }), /CANONICAL_TAG_DUPLICATE/);
assert.throws(() => normalizeCanonicalTransaction({ ...dimensioned, provenance: { ...dimensioned.provenance, raw: 'x' } }), /CANONICAL_PROVENANCE_SHAPE_INVALID/);

// Transfer/refund/adjustment semantics remain compatible with FIN-TRUTH-v1.
const transfer = canonicalGolden.find((row) => row.type === 'transfer');
assert(transfer.destination_account_id);
assert.throws(
  () => normalizeCanonicalTransaction({ ...transfer, destination_account_id: transfer.account_id }),
  /CANONICAL_TRANSFER_ACCOUNTS_INVALID/
);
assert.throws(
  () => normalizeCanonicalTransaction({ ...dimensioned, destination_account_id: 'OTHER' }),
  /CANONICAL_DESTINATION_ONLY_FOR_TRANSFER/
);
const refund = canonicalGolden.find((row) => row.type === 'refund');
assert.throws(
  () => normalizeCanonicalTransaction({ ...refund, reverses_transaction_id: null, adjustment_semantics: null }),
  /CANONICAL_REFUND_SEMANTICS_REQUIRED/
);
const adjustment = canonicalGolden.find((row) => row.type === 'adjustment');
assert.throws(
  () => normalizeCanonicalTransaction({ ...adjustment, amount_minor: 1 }),
  /CANONICAL_NONZERO_ADJUSTMENT_UNSUPPORTED/
);

// Collection identity is fail-closed for both transaction ID and source logical identity.
assert.throws(
  () => validateCanonicalCollection([dimensioned, { ...dimensioned }]),
  /CANONICAL_TRANSACTION_ID_DUPLICATE/
);
const sameSourceDifferentTx = { ...dimensioned, transaction_id: 'SYN-OTHER-TX' };
assert.throws(
  () => validateCanonicalCollection([dimensioned, sameSourceDifferentTx]),
  /CANONICAL_SOURCE_IDENTITY_DUPLICATE/
);

// Mutable source position can move; immutable identity/fingerprint cannot silently change.
const moved = normalizeCanonicalTransaction({
  ...dimensioned,
  provenance: { ...dimensioned.provenance, source_position: 'row:999' }
});
assert.strictEqual(sourceIdentityKey(moved), sourceIdentityKey(dimensioned));
assert.strictEqual(assertSourceIdentityImmutable(dimensioned, moved), true);
assert.throws(
  () => assertSourceIdentityImmutable(dimensioned, normalizeCanonicalTransaction({
    ...dimensioned,
    provenance: { ...dimensioned.provenance, source_record_id: 'SYN-CHANGED-ID' }
  })),
  /CANONICAL_SOURCE_IDENTITY_MUTATION/
);
assert.throws(
  () => assertSourceIdentityImmutable(dimensioned, normalizeCanonicalTransaction({
    ...dimensioned,
    provenance: { ...dimensioned.provenance, source_fingerprint: sha256('changed') }
  })),
  /CANONICAL_SOURCE_IDENTITY_MUTATION/
);

// DATA-001 compatibility: legacy row movement must not alter logical fingerprint identity.
const legacy = legacyMigration();
const legacyCanonical = fromMigrationCanonicalRecord(legacy);
const legacyMoved = fromMigrationCanonicalRecord({ ...legacy, source_row: 44 });
assert.strictEqual(legacyCanonical.provenance.identity_strategy, 'CONTENT_FINGERPRINT_V1');
assert.strictEqual(legacyCanonical.provenance.source_record_id, legacyMoved.provenance.source_record_id);
assert.strictEqual(legacyCanonical.provenance.source_fingerprint, legacyMoved.provenance.source_fingerprint);
assert.notStrictEqual(legacyCanonical.provenance.source_position, legacyMoved.provenance.source_position);
assert.strictEqual(assertSourceIdentityImmutable(legacyCanonical, legacyMoved), true);
assert.strictEqual(assertMigrationFingerprintParity(legacyCanonical), true);
const roundTripMigration = toMigrationCompatibilityRecord(legacyCanonical);
assert.strictEqual(canonicalFingerprint(roundTripMigration), legacyCanonical.provenance.source_fingerprint);

// A core source change creates a different content fingerprint and cannot be treated as the same immutable import identity.
const legacyChanged = fromMigrationCanonicalRecord({ ...legacy, amount_minor: legacy.amount_minor + 1 });
assert.notStrictEqual(legacyChanged.provenance.source_record_id, legacyCanonical.provenance.source_record_id);
assert.notStrictEqual(legacyChanged.provenance.source_fingerprint, legacyCanonical.provenance.source_fingerprint);
assert.throws(() => assertSourceIdentityImmutable(legacyCanonical, legacyChanged), /CANONICAL_SOURCE_IDENTITY_MUTATION/);

console.log('canonical_transaction_schema_contract_test: OK', {
  schema: SCHEMA_ID,
  version: SCHEMA_VERSION,
  strictAdditionalProperties: true,
  stableTransactionId: true,
  immutableSourceIdentity: true,
  mutableSourcePositionSeparated: true,
  exactMinorUnits: true,
  explicitCurrency: true,
  householdDimensions: ['account', 'category', 'member', 'project', 'tags'],
  finTruthCompatible: true,
  kpiDictionaryParity: true,
  data001MigrationCompatibility: true,
  fullHistoryMigratedClaimed: false
});
