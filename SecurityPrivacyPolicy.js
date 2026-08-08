/**
 * Security/privacy policy for audit and telemetry metadata.
 *
 * Public/runtime rule: financial payloads are never treated as telemetry.
 * Only explicitly allowlisted technical metadata may be serialized into
 * before/after/details audit columns.
 */
var PR_AUDIT_TECHNICAL_FIELDS = Object.freeze([
  'buildSha',
  'schemaVersion',
  'datasetRevision',
  'actionType',
  'success',
  'errorClass',
  'latencyMs',
  'cacheHit',
  'rowsExamined',
  'rowsWritten',
  'quotaClass',
  'backupAgeHours',
  'reconciliationStatus',
  'runtimeHealthStatus',
  'costIncidentCount',
  'operationType',
  'idempotencyKey',
  'baseRevision',
  'affectedCount',
  'status',
  'reasonCode',
  'auditCapacityPercent',
  'auditRotatedRows',
  'auditFailureCount',
  'auditConsecutiveFailures'
]);

var PR_AUDIT_FORBIDDEN_FIELD_PARTS = Object.freeze([
  'amount', 'sum', 'income', 'expense', 'balance', 'description',
  'merchant', 'counterparty', 'category', 'payload', 'transaction',
  'account', 'comment', 'note', 'raw', 'beforevalue', 'aftervalue'
]);

function sanitizeAuditMetadata_(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  var output = {};
  PR_AUDIT_TECHNICAL_FIELDS.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      return;
    }
    if (isForbiddenAuditField_(key)) {
      return;
    }
    var sanitized = sanitizeAuditScalar_(value[key]);
    if (sanitized !== undefined) {
      output[key] = sanitized;
    }
  });
  return output;
}

function isForbiddenAuditField_(key) {
  var normalized = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return PR_AUDIT_FORBIDDEN_FIELD_PARTS.some(function (part) {
    return normalized.indexOf(part) !== -1;
  });
}

function sanitizeAuditScalar_(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    return value.slice(0, 160);
  }
  return undefined;
}

function sanitizeAuditCode_(value, fallback) {
  var source = value === undefined || value === null || value === '' ? fallback : value;
  return String(source || '')
    .replace(/[^A-Za-z0-9_.:\/-]/g, '_')
    .slice(0, 96);
}

function sanitizeAuditEvent_(event) {
  var source = event && typeof event === 'object' ? event : {};
  var type = sanitizeAuditCode_(source.type, 'SYSTEM');
  return {
    level: sanitizeAuditCode_(source.level, 'INFO'),
    type: type,
    commandId: sanitizeAuditCode_(source.commandId, ''),
    module: sanitizeAuditCode_(source.module, ''),
    target: sanitizeAuditCode_(source.targetType, ''),
    result: sanitizeAuditCode_(source.result, 'DEV'),
    // Free-form financial/user messages are intentionally not persisted.
    // Callers may provide a public-safe technical messageCode instead.
    message: sanitizeAuditCode_(source.messageCode, type),
    initiator: sanitizeAuditCode_(source.initiator, ''),
    correlationId: sanitizeAuditCode_(source.correlationId, ''),
    before: sanitizeAuditMetadata_(source.before),
    after: sanitizeAuditMetadata_(source.after),
    details: sanitizeAuditMetadata_(source.details)
  };
}
