'use strict';

const assert = require('assert');
const {
  TRANSFORM_VERSION,
  REASON,
  sourceFingerprint,
  canonicalFingerprint,
  reconcileMigrations,
  planIdempotentImport
} = require('../lib/migration/migration_reconciliation');

function source(overrides) {
  return Object.assign({
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
    name: 'Synthetic income',
    source_quality: 'VALID'
  }, overrides || {});
}

function canonicalFromSource(src, overrides) {
  return Object.assign({
    transaction_id: 'SYN-TX-001',
    source_system: src.source_system,
    source_sheet: src.source_sheet,
    source_row: src.source_row,
    transform_version: src.transform_version,
    occurred_at: src.occurred_at,
    type: src.type,
    amount_minor: src.amount_minor,
    currency: src.currency,
    account_id: src.account_id,
    destination_account_id: src.destination_account_id,
    category_id: src.category_id,
    name: src.name
  }, overrides || {});
}

const original = source();
const canonical = canonicalFromSource(original);

// Stable fingerprint ignores mutable row position but changes with core content.
const moved = source({ source_row: 12 });
assert.strictEqual(sourceFingerprint(original), sourceFingerprint(moved), 'row movement must not change source fingerprint');
assert.strictEqual(sourceFingerprint(original), canonicalFingerprint(canonical), 'source and canonical fingerprints must agree under the same transform');
assert.notStrictEqual(sourceFingerprint(original), sourceFingerprint(source({ amount_minor: original.amount_minor + 1 })), 'core change must change source fingerprint');

// Clean mapping.
let result = reconcileMigrations([original], [canonical]);
assert.strictEqual(result.results[0].status, 'CLEAN');
assert.strictEqual(result.results[0].reason, REASON.CLEAN);

// A different row now occupies the stored source_row while the exact source moved elsewhere.
const replacement = source({
  source_row: 10,
  transaction_id: undefined,
  occurred_at: '2026-01-16T10:00:00Z',
  amount_minor: 99999,
  category_id: 'SYN-OTHER',
  name: 'Different synthetic row'
});
result = reconcileMigrations([replacement, moved], [canonical]);
assert.strictEqual(result.results[0].status, 'REVIEW');
assert.strictEqual(result.results[0].reason, REASON.SOURCE_ROW_MOVED);
assert(result.results[0].core_diff_fields.length > 0, 'row drift must expose core mismatch fields');

// Missing source row/fingerprint cannot be clean.
result = reconcileMigrations([], [canonical]);
assert.strictEqual(result.results[0].reason, REASON.SOURCE_MISSING);
assert.strictEqual(result.results[0].status, 'REVIEW');

// Same row but changed core content is a hard mismatch.
const changed = source({ amount_minor: original.amount_minor + 100 });
result = reconcileMigrations([changed], [canonical]);
assert.strictEqual(result.results[0].reason, REASON.CORE_MISMATCH);
assert(result.results[0].core_diff_fields.includes('amount_minor'));

// Invalid source quality cannot become CLEAN even when core fields happen to match.
const invalidQuality = source({ source_quality: 'INFERRED_TYPE' });
result = reconcileMigrations([invalidQuality], [canonical]);
assert.strictEqual(result.results[0].status, 'REVIEW');
assert.strictEqual(result.results[0].reason, REASON.SOURCE_INVALID);

// Duplicate source fingerprints are detected by the idempotent import planner.
const duplicateA = source({ source_row: 20, occurred_at: '2026-02-01T00:00:00Z', amount_minor: 777 });
const duplicateB = source({ source_row: 21, occurred_at: duplicateA.occurred_at, amount_minor: duplicateA.amount_minor });
const duplicatePlan = planIdempotentImport([duplicateA, duplicateB], []);
assert(duplicatePlan.every((item) => item.action === 'BLOCK' && item.reason === REASON.SOURCE_DUPLICATE));

// Rerun is idempotent: existing canonical fingerprint is REUSE, never INSERT.
const firstPlan = planIdempotentImport([original], []);
assert.strictEqual(firstPlan[0].action, 'INSERT');
const rerunPlan = planIdempotentImport([original], [canonical]);
assert.strictEqual(rerunPlan[0].action, 'REUSE');
const rerunAgain = planIdempotentImport([original], [canonical]);
assert.deepStrictEqual(rerunAgain, rerunPlan, 'reconciliation rerun must be deterministic and idempotent');

// Duplicate canonical identity/source reference is fail closed.
result = reconcileMigrations([original], [canonical, { ...canonical }]);
assert(result.results.every((item) => item.status === 'REVIEW'));
assert(result.results.every((item) => [REASON.CANONICAL_ID_DUPLICATE, REASON.SOURCE_REF_DUPLICATE].includes(item.reason)));

// Missing provenance cannot be upgraded to a clean status.
result = reconcileMigrations([original], [{ ...canonical, source_row: null }]);
assert.strictEqual(result.results[0].reason, REASON.PROVENANCE_MISSING);
assert.strictEqual(result.results[0].status, 'REVIEW');

console.log('migration_reconciliation_contract_test: OK', {
  transformVersion: TRANSFORM_VERSION,
  reasonCodes: Object.values(REASON),
  invariants: [
    'stable fingerprint across row movement',
    'core change changes fingerprint',
    'row drift detected',
    'missing source detected',
    'core mismatch fail closed',
    'invalid source quality fail closed',
    'duplicate source blocked',
    'rerun idempotent',
    'duplicate canonical identity blocked',
    'missing provenance blocked'
  ]
});
