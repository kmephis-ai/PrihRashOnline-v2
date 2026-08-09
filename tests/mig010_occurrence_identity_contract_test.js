'use strict';

const assert = require('assert');
const {
  IDENTITY_STRATEGIES,
  fromMigrationCanonicalOccurrenceRecord,
  validateCanonicalCollection,
  sourceIdentityKey,
  assertSourceIdentityImmutable,
  assertMigrationFingerprintParity,
  toFinTruthTransaction
} = require('../lib/domain/canonical_transaction');
const { canonicalFingerprint } = require('../lib/migration/migration_reconciliation');
const { aggregateTransactions } = require('../lib/finance/financial_reconciliation');

function migration(row) {
  return {
    transaction_id: 'SYN-OCCURRENCE-BASE',
    source_system: 'SYN-FORM',
    source_sheet: 'SYN-LEGACY',
    source_row: row,
    transform_version: 'SOURCE-TRANSFORM-v1',
    occurred_at: '2025-05-01T10:00:00Z',
    type: 'expense',
    amount_minor: 1250,
    currency: 'RUB',
    account_id: 'ACC-MAIN',
    destination_account_id: '',
    category_id: 'CAT-HOME',
    name: 'Synthetic identical real operation'
  };
}

assert(IDENTITY_STRATEGIES.includes('CONTENT_FINGERPRINT_OCCURRENCE_V1'));

const first = fromMigrationCanonicalOccurrenceRecord(migration(10), 1);
const second = fromMigrationCanonicalOccurrenceRecord(migration(11), 2);
const collection = validateCanonicalCollection([first, second]);

assert.strictEqual(collection.length, 2);
assert.strictEqual(first.provenance.identity_strategy, 'CONTENT_FINGERPRINT_OCCURRENCE_V1');
assert.strictEqual(second.provenance.identity_strategy, 'CONTENT_FINGERPRINT_OCCURRENCE_V1');
assert.strictEqual(first.provenance.source_fingerprint, second.provenance.source_fingerprint,
  'identical content must retain the same content fingerprint');
assert.notStrictEqual(first.provenance.source_record_id, second.provenance.source_record_id,
  'owner-confirmed occurrences require distinct immutable source identities');
assert.notStrictEqual(first.transaction_id, second.transaction_id,
  'owner-confirmed occurrences require distinct canonical transaction IDs');
assert.notStrictEqual(sourceIdentityKey(first), sourceIdentityKey(second));
assert.strictEqual(assertMigrationFingerprintParity(first), true);
assert.strictEqual(assertMigrationFingerprintParity(second), true);

const movedFirst = fromMigrationCanonicalOccurrenceRecord(migration(99), 1);
assert.strictEqual(first.transaction_id, movedFirst.transaction_id,
  'same content + occurrence ordinal must keep transaction ID across row movement');
assert.strictEqual(first.provenance.source_record_id, movedFirst.provenance.source_record_id,
  'source_position must remain separate from occurrence identity');
assert.strictEqual(first.provenance.source_fingerprint, movedFirst.provenance.source_fingerprint);
assert.notStrictEqual(first.provenance.source_position, movedFirst.provenance.source_position);
assert.strictEqual(assertSourceIdentityImmutable(first, movedFirst), true);

const aggregate = aggregateTransactions(collection.map(toFinTruthTransaction));
assert.strictEqual(aggregate.expense_minor, 2500,
  'PRESERVE_ALL must preserve both real operations in financial truth');

assert.strictEqual(canonicalFingerprint({ ...migration(10), transaction_id: first.transaction_id }), first.provenance.source_fingerprint);
assert.throws(() => fromMigrationCanonicalOccurrenceRecord(migration(10), 0), /CANONICAL_OCCURRENCE_ORDINAL_INVALID/);
assert.throws(() => fromMigrationCanonicalOccurrenceRecord(migration(10), 1.5), /CANONICAL_OCCURRENCE_ORDINAL_INVALID/);

console.log('mig010_occurrence_identity_contract_test: OK', {
  strategy: 'CONTENT_FINGERPRINT_OCCURRENCE_V1',
  identicalContentFingerprintPreserved: true,
  distinctOccurrenceIdentity: true,
  rowMovementDoesNotChangeIdentity: true,
  preserveAllFinancialParity: true,
  writeAuthority: false
});
