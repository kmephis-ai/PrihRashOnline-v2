'use strict';

const assert = require('assert');
const {
  defaultSourceToCanonical,
  buildMigrationPlan
} = require('../lib/migration/full_history_migration');
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');

const BACKUP = {
  schema: 'DR-001-EVIDENCE-v1',
  status: 'PASS',
  checksum: 'PASS',
  backupCipherSha256: 'b'.repeat(64)
};

function source(overrides = {}) {
  return {
    source_system: 'SYN-FORM',
    source_sheet: 'SYN-HISTORY',
    source_row: 2,
    transform_version: 'SOURCE-TRANSFORM-v1',
    occurred_at: '2025-01-01T10:00:00Z',
    type: 'expense',
    amount_minor: 2500,
    currency: 'RUB',
    account_id: 'ACC-MAIN',
    destination_account_id: '',
    category_id: 'CAT-HOME',
    name: 'Synthetic preflight row',
    source_quality: 'VALID',
    ...overrides
  };
}

function plan(sourceRecords, canonicalRecords) {
  return buildMigrationPlan({
    source_records: sourceRecords,
    canonical_records: canonicalRecords,
    mapping_version: 'SYN-PREFLIGHT-v1',
    backup_binding: BACKUP
  });
}

const original = source();
const canonical = defaultSourceToCanonical(original);
const clean = plan([original], [canonical]);
assert.strictEqual(clean.status, 'READY');
assert.strictEqual(clean.existing_target_preflight, 'PASS');
assert.strictEqual(clean.batches.length, 0);
assert(clean.dry_run.every((item) => item.action === 'REUSE'));

const coreDrift = normalizeCanonicalTransaction({
  ...canonical,
  amount_minor: canonical.amount_minor + 1
});
const coreBlocked = plan([original], [coreDrift]);
assert.strictEqual(coreBlocked.status, 'BLOCKED');
assert.strictEqual(coreBlocked.existing_target_preflight, 'BLOCKED');
assert(coreBlocked.blocked_reasons.includes('CORE_MISMATCH'));
assert.strictEqual(coreBlocked.batches.length, 0);

const movedProvenance = normalizeCanonicalTransaction({
  ...canonical,
  provenance: {
    ...canonical.provenance,
    source_position: 'row:999'
  }
});
const movedBlocked = plan([original], [movedProvenance]);
assert.strictEqual(movedBlocked.status, 'BLOCKED');
assert(movedBlocked.blocked_reasons.includes('SOURCE_ROW_MOVED'));
assert.strictEqual(movedBlocked.batches.length, 0);

const unrelated = defaultSourceToCanonical(source({ source_row: 3, name: 'Other row', amount_minor: 3000 }));
const sourceMissingBlocked = plan([original], [unrelated]);
assert.strictEqual(sourceMissingBlocked.status, 'BLOCKED');
assert(sourceMissingBlocked.blocked_reasons.includes('SOURCE_MISSING'));
assert.strictEqual(sourceMissingBlocked.batches.length, 0);

const invalidQuality = plan([source({ source_quality: 'INVALID' })], []);
assert.strictEqual(invalidQuality.status, 'BLOCKED');
assert(invalidQuality.blocked_reasons.includes('SOURCE_INVALID'));
assert.strictEqual(invalidQuality.batches.length, 0);

console.log('mig010_existing_target_preflight_contract_test: OK', {
  cleanReuse: true,
  coreMismatchBlocked: true,
  sourceRowMovedBlocked: true,
  sourceMissingBlocked: true,
  invalidQualityBlocked: true,
  accidentalInsertOnDrift: false
});
