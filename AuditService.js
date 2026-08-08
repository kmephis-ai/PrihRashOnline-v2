/**
 * Добавляет одно privacy-safe событие в «13 Журнал».
 * Журналирование разрешено в DRY_RUN, потому что не изменяет финансовые данные.
 * Перед записью применяется SecurityPrivacyPolicy: свободные financial/user
 * payloads не сериализуются, а before/after/details ограничены technical allowlist.
 */
function appendAudit_(event) {
  var safeEvent = sanitizeAuditEvent_(event);
  var lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheetRequired_(PR_CONFIG.SHEETS.AUDIT);
    var nextRow = Math.max(sheet.getLastRow() + 1, 2);
    if (nextRow > PR_CONFIG.MAX_AUDIT_ROWS + 1) {
      throw new Error('Журнал достиг DEV-лимита ' + PR_CONFIG.MAX_AUDIT_ROWS + ' строк.');
    }
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
      safeEvent.correlationId || makeCorrelationId_(),
      stringifySafe_(safeEvent.before),
      stringifySafe_(safeEvent.after),
      stringifySafe_(safeEvent.details)
    ]]);
    return eventId;
  } finally {
    lock.releaseLock();
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
