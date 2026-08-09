'use strict';

const assert = require('assert');
const { buildMigrationPlan } = require('../lib/migration/full_history_migration');

const source = {
  source_system: 'SYN-FORM',
  source_sheet: 'SYN-PRIVATE',
  source_row: 2,
  transform_version: 'SOURCE-TRANSFORM-v1',
  occurred_at: '2025-01-01T10:00:00Z',
  type: 'expense',
  amount_minor: 1234,
  currency: 'RUB',
  account_id: 'ACC-SYN',
  destination_account_id: '',
  category_id: 'CAT-SYN',
  name: 'SYNTHETIC-PRIVATE-CANARY',
  source_quality: 'VALID'
};

const plan = buildMigrationPlan({
  source_records: [source],
  canonical_records: [],
  mapping_version: 'SYN-PRIVACY-v1',
  backup_binding: {
    schema: 'DR-001-EVIDENCE-v1',
    status: 'PASS',
    checksum: 'PASS',
    backupCipherSha256: 'b'.repeat(64)
  }
});

assert.strictEqual(plan.status, 'READY');
assert.strictEqual(Object.prototype.hasOwnProperty.call(plan, 'private_source_records'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(plan, 'source_records'), false);
assert.strictEqual(JSON.stringify({
  schema: plan.schema,
  status: plan.status,
  source_revision: plan.source_revision,
  plan_hash: plan.plan_hash,
  blocked_reasons: plan.blocked_reasons
}).includes('SYNTHETIC-PRIVATE-CANARY'), false);

console.log('mig010_plan_privacy_contract_test: OK', {
  sourceRecordsReturned: false,
  technicalIdentityOnly: true
});
