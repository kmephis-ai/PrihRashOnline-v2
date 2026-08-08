/**
 * Privacy-safe bounded audit persistence for «13 Журнал».
 *
 * Audit is deliberately best-effort with an independent technical health signal:
 * a logging/storage failure must not by itself turn a correct financial operation
 * into an outage. Financial/user payloads are sanitized before persistence by
 * SecurityPrivacyPolicy.js.
 */
var PR_AUDIT_HEALTH_KEYS = Object.freeze({
  STATUS: 'PR_AUDIT_HEALTH_STATUS',
  REASON: 'PR_AUDIT_HEALTH_REASON',
  FAILURE_COUNT: 'PR_AUDIT_HEALTH_FAILURE_COUNT',
  CONSECUTIVE_FAILURES: 'PR_AUDIT_HEALTH_CONSECUTIVE_FAILURES',
  CAPACITY_PERCENT: 'PR_AUDIT_HEALTH_CAPACITY_PERCENT',
  LAST_ROTATED_ROWS: 'PR_AUDIT_HEALTH_LAST_ROTATED_ROWS',
  LAST_SUCCESS_AT: 'PR_AUDIT_HEALTH_LAST_SUCCESS_AT',
  LAST_FAILURE_AT: 'PR_AUDIT_HEALTH_LAST_FAILURE_AT'
});

function appendAudit_(event) {
  var lock = null;
  var locked = false;
  try {
    var safeEvent = sanitizeAuditEvent_(event);
    var correlationId = safeEvent.correlationId || makeCorrelationId_();
    lock = LockService.getDocumentLock();
    lock.waitLock(10000);
    locked = true;

    var sheet = getSheetRequired_(PR_CONFIG.SHEETS.AUDIT);
    var capacity = ensureAuditCapacity_(sheet);
    var nextRow = Math.max(sheet.getLastRow() + 1, 2);
    var eventId = nextSequentialId_(
      sheet,
      'EVT',
      1,
      PR_CONFIG.MAX_AUDIT_ROWS
    );

    sheet.getRange(nextRow, 1, 1, 14).setValues([[
      eventId,
      new Date(),
      safeEvent.level || 'INFO',
      safeEvent.type || 'SYSTEM',
      safeEvent.commandId || '',
      safeEvent.module || '',
      safeEvent.target || '',
      safeEvent.result || 'DEV',
      safeEvent.message || safeEvent.type || 'SYSTEM',
      safeEvent.initiator || getInitiator_(),
      correlationId,
      stringifySafe_(safeEvent.before),
      stringifySafe_(safeEvent.after),
      stringifySafe_(safeEvent.details)
    ]]);

    recordAuditHealthSuccess_({
      dataRows: Math.max(sheet.getLastRow() - 1, 0),
      capacityPercent: capacity.capacityPercent,
      rotatedRows: capacity.rotatedRows
    });
    return eventId;
  } catch (error) {
    recordAuditHealthFailure_(classifyAuditFailure_(error));
    return '';
  } finally {
    if (locked && lock) {
      try {
        lock.releaseLock();
      } catch (_) {
        // The write result is already known. Release failure is non-financial and
        // must not change transaction correctness; the next lock attempt remains
        // authoritative for concurrency safety.
      }
    }
  }
}

function auditRetentionPlan_(dataRows, maxRows, rotateBatchRows) {
  if (!Number.isInteger(dataRows) || dataRows < 0
      || !Number.isInteger(maxRows) || maxRows < 1
      || !Number.isInteger(rotateBatchRows) || rotateBatchRows < 1
      || rotateBatchRows >= maxRows) {
    throw new Error('AUDIT_RETENTION_POLICY_INVALID');
  }

  var targetRows = Math.max(maxRows - rotateBatchRows, 0);
  var rowsToDelete = dataRows >= maxRows
    ? Math.max(rotateBatchRows, dataRows - targetRows)
    : 0;
  rowsToDelete = Math.min(rowsToDelete, dataRows);

  return {
    dataRows: dataRows,
    rowsToDelete: rowsToDelete,
    retainedRows: dataRows - rowsToDelete,
    capacityPercent: Math.min(100, Math.round((dataRows / maxRows) * 100))
  };
}

function ensureAuditCapacity_(sheet) {
  var maxRows = PR_CONFIG.MAX_AUDIT_ROWS;
  var rotateBatchRows = PR_CONFIG.AUDIT_ROTATE_BATCH_ROWS;
  var dataRows = Math.max(sheet.getLastRow() - 1, 0);
  var plan = auditRetentionPlan_(dataRows, maxRows, rotateBatchRows);

  if (plan.rowsToDelete > 0) {
    sheet.deleteRows(2, plan.rowsToDelete);
    var requiredGridRows = maxRows + 1;
    var currentGridRows = sheet.getMaxRows();
    if (currentGridRows < requiredGridRows) {
      sheet.insertRowsAfter(currentGridRows, requiredGridRows - currentGridRows);
    }
  }

  var currentDataRows = Math.max(sheet.getLastRow() - 1, 0);
  return {
    dataRows: currentDataRows,
    capacityPercent: Math.min(100, Math.round((currentDataRows / maxRows) * 100)),
    rotatedRows: plan.rowsToDelete
  };
}

function classifyAuditFailure_(error) {
  var message = String(error && error.message || '').toUpperCase();
  if (message.indexOf('LOCK') !== -1) {
    return 'AUDIT_LOCK_FAILED';
  }
  if (message.indexOf('RETENTION') !== -1
      || message.indexOf('ROW') !== -1
      || message.indexOf('RANGE') !== -1
      || message.indexOf('SHEET') !== -1) {
    return 'AUDIT_STORAGE_FAILED';
  }
  return 'AUDIT_WRITE_FAILED';
}

function auditHealthProperties_() {
  return PropertiesService.getScriptProperties();
}

function boundedAuditCounter_(value) {
  var parsed = parseInt(String(value || '0'), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.min(parsed, 999999999);
}

function setAuditHealthProperties_(values) {
  var props = auditHealthProperties_();
  Object.keys(values).forEach(function (key) {
    props.setProperty(key, String(values[key]));
  });
  return true;
}

function recordAuditHealthSuccess_(capacity) {
  try {
    var percent = Number(capacity && capacity.capacityPercent || 0);
    var rotatedRows = Number(capacity && capacity.rotatedRows || 0);
    var warnAt = PR_CONFIG.AUDIT_WARN_AT_ROWS;
    var currentRows = Number(capacity && capacity.dataRows || 0);
    var warning = currentRows >= warnAt;
    setAuditHealthProperties_({
      PR_AUDIT_HEALTH_STATUS: warning ? 'WARN' : 'PASS',
      PR_AUDIT_HEALTH_REASON: warning ? 'AUDIT_CAPACITY_WARNING' : 'OK',
      PR_AUDIT_HEALTH_CONSECUTIVE_FAILURES: '0',
      PR_AUDIT_HEALTH_CAPACITY_PERCENT: String(Math.max(0, Math.min(100, Math.round(percent)))),
      PR_AUDIT_HEALTH_LAST_ROTATED_ROWS: String(Math.max(0, Math.round(rotatedRows))),
      PR_AUDIT_HEALTH_LAST_SUCCESS_AT: new Date().toISOString()
    });
    return true;
  } catch (_) {
    return false;
  }
}

function recordAuditHealthFailure_(reasonCode) {
  try {
    var props = auditHealthProperties_();
    var failures = boundedAuditCounter_(props.getProperty(PR_AUDIT_HEALTH_KEYS.FAILURE_COUNT));
    var consecutive = boundedAuditCounter_(props.getProperty(PR_AUDIT_HEALTH_KEYS.CONSECUTIVE_FAILURES));
    setAuditHealthProperties_({
      PR_AUDIT_HEALTH_STATUS: 'FAIL',
      PR_AUDIT_HEALTH_REASON: String(reasonCode || 'AUDIT_WRITE_FAILED').slice(0, 64),
      PR_AUDIT_HEALTH_FAILURE_COUNT: String(Math.min(failures + 1, 999999999)),
      PR_AUDIT_HEALTH_CONSECUTIVE_FAILURES: String(Math.min(consecutive + 1, 999999999)),
      PR_AUDIT_HEALTH_LAST_FAILURE_AT: new Date().toISOString()
    });
    return true;
  } catch (_) {
    return false;
  }
}

function getAuditHealthSnapshot_() {
  try {
    var props = auditHealthProperties_();
    return {
      status: String(props.getProperty(PR_AUDIT_HEALTH_KEYS.STATUS) || 'UNKNOWN'),
      reasonCode: String(props.getProperty(PR_AUDIT_HEALTH_KEYS.REASON) || 'UNKNOWN'),
      auditCapacityPercent: boundedAuditCounter_(props.getProperty(PR_AUDIT_HEALTH_KEYS.CAPACITY_PERCENT)),
      auditFailureCount: boundedAuditCounter_(props.getProperty(PR_AUDIT_HEALTH_KEYS.FAILURE_COUNT)),
      auditConsecutiveFailures: boundedAuditCounter_(props.getProperty(PR_AUDIT_HEALTH_KEYS.CONSECUTIVE_FAILURES))
    };
  } catch (_) {
    return {
      status: 'UNKNOWN',
      reasonCode: 'AUDIT_HEALTH_UNAVAILABLE',
      auditCapacityPercent: 0,
      auditFailureCount: 0,
      auditConsecutiveFailures: 0
    };
  }
}

function stringifySafe_(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return '';
  }
}
