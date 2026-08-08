'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const auditSource = fs.readFileSync(path.join(__dirname, '..', 'AuditService.js'), 'utf8');
const privacySource = fs.readFileSync(path.join(__dirname, '..', 'SecurityPrivacyPolicy.js'), 'utf8');

function makePropertiesStore() {
  const values = {};
  return {
    values,
    getProperty(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    setProperty(key, value) {
      values[key] = String(value);
      return this;
    },
    setProperties(input) {
      Object.keys(input).forEach((key) => { values[key] = String(input[key]); });
      return this;
    }
  };
}

function makeContext(overrides = {}) {
  const properties = makePropertiesStore();
  const context = {
    Object,
    String,
    Number,
    Array,
    JSON,
    Math,
    Date,
    parseInt,
    isFinite,
    PropertiesService: {
      getScriptProperties() { return properties; }
    },
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
  return { context, properties };
}

{
  const { context } = makeContext();
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
  const { context, properties } = makeContext({
    getSheetRequired_() { return sheet; }
  });
  const eventId = context.appendAudit_({ type: 'SYNTHETIC_TEST' });
  assert.strictEqual(eventId, 'EVT-1001');
  assert.strictEqual(deletedRows, 250);
  assert.strictEqual(insertedRows, 250);
  assert.strictEqual(writes.length, 1);
  assert.strictEqual(writes[0][0][10], 'COR-SYNTHETIC');
  assert.strictEqual(properties.values.PRH_AUDIT_HEALTH_STATUS, 'PASS');
  assert.strictEqual(properties.values.PRH_AUDIT_HEALTH_REASON, 'OK');
  assert.strictEqual(properties.values.PRH_AUDIT_HEALTH_LAST_ROTATED_ROWS, '250');
  assert.strictEqual(Number(properties.values.PRH_AUDIT_HEALTH_CAPACITY_PERCENT) < 80, true);
}

{
  const { context, properties } = makeContext();
  assert.strictEqual(context.recordAuditHealthSuccess_({ dataRows: 850, capacityPercent: 85, rotatedRows: 0 }), true);
  assert.strictEqual(properties.values.PRH_AUDIT_HEALTH_STATUS, 'WARN');
  assert.strictEqual(properties.values.PRH_AUDIT_HEALTH_REASON, 'AUDIT_CAPACITY_WARNING');
}

{
  const { context, properties } = makeContext({
    getSheetRequired_() { throw new Error('sheet unavailable'); }
  });
  assert.doesNotThrow(() => {
    assert.strictEqual(context.appendAudit_({ type: 'SYNTHETIC_FAILURE' }), '');
  });
  assert.strictEqual(properties.values.PRH_AUDIT_HEALTH_STATUS, 'FAIL');
  assert.strictEqual(properties.values.PRH_AUDIT_HEALTH_REASON, 'AUDIT_STORAGE_FAILED');
  assert.strictEqual(properties.values.PRH_AUDIT_HEALTH_FAILURE_COUNT, '1');
  assert.strictEqual(properties.values.PRH_AUDIT_HEALTH_CONSECUTIVE_FAILURES, '1');
  const snapshot = context.getAuditHealthSnapshot_();
  assert.strictEqual(snapshot.status, 'FAIL');
  assert.strictEqual(snapshot.reasonCode, 'AUDIT_STORAGE_FAILED');
  assert.strictEqual(snapshot.auditFailureCount, 1);
  assert.strictEqual(snapshot.auditConsecutiveFailures, 1);
}

{
  const context = { Object, String, Number, Array, JSON, isFinite };
  vm.createContext(context);
  vm.runInContext(privacySource, context, { filename: 'SecurityPrivacyPolicy.js' });
  const safe = context.sanitizeAuditMetadata_({
    latencyMs: 42,
    errorClass: 'NONE',
    quotaClass: 'apps-script',
    auditCapacityPercent: 80,
    auditRotatedRows: 250,
    auditFailureCount: 2,
    auditConsecutiveFailures: 1,
    amountMinor: 12345,
    description: 'private',
    rawPayload: 'private'
  });
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
assert(auditSource.includes('props.setProperty(key, String(values[key]))'));
assert(auditSource.includes("return '';"), 'audit persistence failure must be isolated from transaction correctness');

console.log('observability_audit_contract_test: OK', {
  boundedRotation: true,
  warningRecovery: true,
  gridCapacityRestored: true,
  failureIsolation: true,
  healthSignal: true,
  privacySafeMetrics: true
});
