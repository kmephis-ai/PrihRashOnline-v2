'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const auditSource = fs.readFileSync(path.join(__dirname, '..', 'AuditService.js'), 'utf8');
const privacySource = fs.readFileSync(path.join(__dirname, '..', 'SecurityPrivacyPolicy.js'), 'utf8');

function makeContext(overrides = {}) {
  const context = {
    PR_CONFIG: {
      MAX_AUDIT_ROWS: 1000,
      AUDIT_ROTATE_BATCH_ROWS: 250,
      AUDIT_WARN_AT_ROWS: 800,
      SHEETS: { AUDIT: '13 Журнал' }
    },
    sanitizeAuditEvent_(event) {
      const source = event || {};
      return {
        level: source.level || 'INFO',
        type: source.type || 'SYSTEM',
        commandId: '',
        module: '',
        target: '',
        result: 'DEV',
        message: source.messageCode || source.type || 'SYSTEM',
        initiator: 'automation',
        correlationId: source.correlationId || '',
        before: {},
        after: {},
        details: {}
      };
    },
    makeCorrelationId_() { return 'COR-SYNTHETIC'; },
    getInitiator_() { return 'automation'; },
    nextSequentialId_() { return 'EVT-1001'; },
    LockService: {
      getDocumentLock() {
        return { waitLock() {}, releaseLock() {} };
      }
    },
    ...overrides
  };
  vm.createContext(context);
  vm.runInContext(auditSource, context, { filename: 'AuditService.js' });
  return context;
}

{
  const context = makeContext();
  const pass = vm.runInContext(
    'JSON.stringify(auditHealthSuccessState_({dataRows:750,capacityPercent:75,rotatedRows:250}))',
    context
  );
  assert.deepStrictEqual(JSON.parse(pass), {
    status: 'PASS',
    reasonCode: 'OK',
    auditConsecutiveFailures: 0,
    auditCapacityPercent: 75,
    auditRotatedRows: 250
  });
  const warn = vm.runInContext(
    'JSON.stringify(auditHealthSuccessState_({dataRows:850,capacityPercent:85,rotatedRows:0}))',
    context
  );
  assert.deepStrictEqual(JSON.parse(warn), {
    status: 'WARN',
    reasonCode: 'AUDIT_CAPACITY_WARNING',
    auditConsecutiveFailures: 0,
    auditCapacityPercent: 85,
    auditRotatedRows: 0
  });
  const fail = vm.runInContext(
    "JSON.stringify(auditHealthFailureState_('AUDIT_STORAGE_FAILED', 4, 2))",
    context
  );
  assert.deepStrictEqual(JSON.parse(fail), {
    status: 'FAIL',
    reasonCode: 'AUDIT_STORAGE_FAILED',
    auditFailureCount: 5,
    auditConsecutiveFailures: 3
  });
}

{
  const context = makeContext();
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(context.auditRetentionPlan_(799, 1000, 250))),
    { dataRows: 799, rowsToDelete: 0, retainedRows: 799, capacityPercent: 80 }
  );
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(context.auditRetentionPlan_(999, 1000, 250))),
    { dataRows: 999, rowsToDelete: 0, retainedRows: 999, capacityPercent: 100 }
  );
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(context.auditRetentionPlan_(1000, 1000, 250))),
    { dataRows: 1000, rowsToDelete: 250, retainedRows: 750, capacityPercent: 100 }
  );
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(context.auditRetentionPlan_(1105, 1000, 250))),
    { dataRows: 1105, rowsToDelete: 355, retainedRows: 750, capacityPercent: 100 }
  );
  assert.throws(() => context.auditRetentionPlan_(1000, 1000, 1000), /AUDIT_RETENTION_POLICY_INVALID/);
}

{
  let lastRow = 1001;
  let maxGridRows = 1001;
  let deletedRows = 0;
  let insertedRows = 0;
  const writes = [];
  const sheet = {
    getLastRow() { return lastRow; },
    getMaxRows() { return maxGridRows; },
    deleteRows(start, count) {
      assert.strictEqual(start, 2);
      deletedRows += count;
      lastRow -= count;
      maxGridRows -= count;
    },
    insertRowsAfter(position, count) {
      assert.strictEqual(position, maxGridRows);
      insertedRows += count;
      maxGridRows += count;
    },
    getRange(row, column, rowCount, columnCount) {
      assert.strictEqual(column, 1);
      assert.strictEqual(rowCount, 1);
      assert.strictEqual(columnCount, 14);
      return {
        setValues(values) {
          writes.push(values);
          lastRow = Math.max(lastRow, row);
        }
      };
    }
  };
  const context = makeContext({
    getSheetRequired_() { return sheet; },
    PropertiesService: {
      getScriptProperties() {
        return { setProperty() {}, getProperty() { return null; } };
      }
    }
  });
  const eventId = vm.runInContext("appendAudit_({type:'SYNTHETIC_TEST'})", context);
  assert.strictEqual(eventId, 'EVT-1001');
  assert.strictEqual(deletedRows, 250);
  assert.strictEqual(insertedRows, 250);
  assert.strictEqual(writes.length, 1);
  assert.strictEqual(writes[0][0][10], 'COR-SYNTHETIC');
}

{
  const context = makeContext();
  assert.doesNotThrow(() => {
    assert.strictEqual(vm.runInContext("appendAudit_({type:'SYNTHETIC_FAILURE'})", context), '');
  });
  assert.strictEqual(
    vm.runInContext("classifyAuditFailure_(new Error('sheet unavailable'))", context),
    'AUDIT_STORAGE_FAILED'
  );
}

{
  const context = {};
  vm.createContext(context);
  vm.runInContext(privacySource, context, { filename: 'SecurityPrivacyPolicy.js' });
  const safe = vm.runInContext(`sanitizeAuditMetadata_({
    latencyMs:42,
    errorClass:'NONE',
    quotaClass:'apps-script',
    auditCapacityPercent:80,
    auditRotatedRows:250,
    auditFailureCount:2,
    auditConsecutiveFailures:1,
    amountMinor:12345,
    description:'private',
    rawPayload:'private'
  })`, context);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(safe)), {
    latencyMs: 42,
    errorClass: 'NONE',
    quotaClass: 'apps-script',
    auditCapacityPercent: 80,
    auditRotatedRows: 250,
    auditFailureCount: 2,
    auditConsecutiveFailures: 1
  });
}

assert(!auditSource.includes('Журнал достиг DEV-лимита'));
assert(auditSource.includes('sheet.deleteRows(2, plan.rowsToDelete)'));
assert(auditSource.includes('sheet.insertRowsAfter'));
assert(auditSource.includes("recordAuditHealthFailure_(classifyAuditFailure_(error))"));
assert(auditSource.includes('auditHealthSuccessState_'));
assert(auditSource.includes('auditHealthFailureState_'));
assert(auditSource.includes('props.setProperty(PR_AUDIT_HEALTH_KEYS.STATUS'));
assert(auditSource.includes('props.setProperty(PR_AUDIT_HEALTH_KEYS.FAILURE_COUNT'));
assert(auditSource.includes("return '';"), 'audit persistence failure must be isolated from transaction correctness');

console.log('observability_audit_contract_test: OK', {
  boundedRotation: true,
  warningRecovery: true,
  gridCapacityRestored: true,
  failureIsolation: true,
  deterministicHealthPolicy: true,
  explicitHealthKeys: true,
  privacySafeMetrics: true
});
