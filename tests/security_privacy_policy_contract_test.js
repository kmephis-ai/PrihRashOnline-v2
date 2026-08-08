'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'SecurityPrivacyPolicy.js'), 'utf8');
const context = { Object, String, Array, JSON, isFinite };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'SecurityPrivacyPolicy.js' });

const safe = context.sanitizeAuditMetadata_({
  buildSha: 'abc123',
  schemaVersion: 2,
  datasetRevision: 'rev-7',
  actionType: 'REFRESH',
  success: true,
  latencyMs: 42,
  rowsExamined: 100,
  quotaClass: 'apps-script',
  reconciliationStatus: 'PASS'
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(safe)), {
  buildSha: 'abc123',
  schemaVersion: 2,
  datasetRevision: 'rev-7',
  actionType: 'REFRESH',
  success: true,
  latencyMs: 42,
  rowsExamined: 100,
  quotaClass: 'apps-script',
  reconciliationStatus: 'PASS'
});

const forbidden = context.sanitizeAuditMetadata_({
  amountMinor: 12345,
  incomeTotal: 20000,
  expenseValue: 5000,
  category: 'private',
  description: 'private',
  merchant: 'private',
  transactionId: 'private-id',
  rawPayload: { anything: true },
  accountId: 'private-account',
  details: { nested: 'not allowlisted' },
  buildSha: 'safe-sha'
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(forbidden)), { buildSha: 'safe-sha' });

const event = context.sanitizeAuditEvent_({
  level: 'INFO',
  type: 'MIGRATION_CHECK',
  commandId: 'CMD-1',
  module: 'migration',
  target: 'free-form target must not persist',
  targetType: 'CANONICAL_SCHEMA',
  result: 'PASS',
  message: 'free-form user message must not persist',
  messageCode: 'MIGRATION_CHECK_PASS',
  initiator: 'automation',
  correlationId: 'corr-1',
  before: { amountMinor: 999, datasetRevision: 'before-r1' },
  after: { description: 'private', datasetRevision: 'after-r2' },
  details: { latencyMs: 55, payload: { hidden: true } }
});
assert.strictEqual(event.target, 'CANONICAL_SCHEMA');
assert.strictEqual(event.message, 'MIGRATION_CHECK_PASS');
assert.deepStrictEqual(JSON.parse(JSON.stringify(event.before)), { datasetRevision: 'before-r1' });
assert.deepStrictEqual(JSON.parse(JSON.stringify(event.after)), { datasetRevision: 'after-r2' });
assert.deepStrictEqual(JSON.parse(JSON.stringify(event.details)), { latencyMs: 55 });
assert(!JSON.stringify(event).includes('free-form user message'));
assert(!JSON.stringify(event).includes('free-form target'));

assert.strictEqual(context.sanitizeAuditScalar_({ nested: true }), undefined);
assert.strictEqual(context.sanitizeAuditScalar_(['payload']), undefined);
assert.strictEqual(context.sanitizeAuditScalar_(Infinity), undefined);
assert.strictEqual(context.sanitizeAuditCode_('ok value / 1', ''), 'ok_value_/_1');

const auditService = fs.readFileSync(path.join(__dirname, '..', 'AuditService.js'), 'utf8');
assert(auditService.includes('sanitizeAuditEvent_(event)'), 'AuditService must sanitize before persistence');
assert(!auditService.includes('stringifySafe_(event.before)'), 'AuditService must not serialize raw before payload');
assert(!auditService.includes('stringifySafe_(event.after)'), 'AuditService must not serialize raw after payload');
assert(!auditService.includes('stringifySafe_(event.details)'), 'AuditService must not serialize raw details payload');

console.log('security_privacy_policy_contract_test: OK');
