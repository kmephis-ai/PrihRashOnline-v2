/**
 * ПрихРасхOnline v2 DEV — Quality Apply Service v0.4.0.
 *
 * Контролируемо применяет только вручную подтверждённые предложения из
 * «11 Предпросмотр». По умолчанию fail-closed и не меняет операции.
 */
var PRH_QUALITY_APPLY = Object.freeze({
  VERSION: '0.4.0',
  OPERATIONS: '01 Операции',
  PREVIEW: '11 Предпросмотр',
  SETTINGS: '09 Настройки',
  BACKUP: '12 Резерв исправлений',
  MAX_BATCH: 10,
  ENABLE_KEY: 'quality_apply_enabled',
  ENABLE_VALUE: 'TRUE',
  APPROVED_STATUS: 'ПОДТВЕРЖДЕНО',
  APPLIED_STATUS: 'ПРИМЕНЕНО',
  ERROR_STATUS: 'ОШИБКА ПРИМЕНЕНИЯ',
  QUEUE_HEADERS: Object.freeze([
    'ID предложения', 'Строка операции', 'ID операции', 'Тип проблемы',
    'Поле', 'Текущее значение', 'Предложенное значение', 'Основание',
    'Уверенность', 'Статус', 'Создано', 'Проверено', 'Комментарий'
  ]),
  BACKUP_HEADERS: Object.freeze([
    'Время', 'ID применения', 'ID предложения', 'Строка операции',
    'ID операции', 'Поле', 'Старое значение', 'Новое значение',
    'Пользователь', 'Версия сервиса'
  ]),
  ALLOWED_ISSUES: Object.freeze({
    MISSING_CATEGORY: true,
    MISSING_DESCRIPTION: true
  })
});

function prhQualityApplyMenuInstall() {
  SpreadsheetApp.getUi().createMenu('Качество: применение')
    .addItem('Проверить готовность', 'prhValidateQualityApply')
    .addItem('Применить подтверждённые', 'prhApplyApprovedQualityItems')
    .addSeparator()
    .addItem('Отключить применение', 'prhDisableQualityApply')
    .addToUi();
}

function prhApplyApprovedQualityItems() {
  var context = prhQualityApplyContext_();
  prhRequireQualityApplyEnabled_(context.settings);

  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var candidates = prhReadApprovedQualityItems_(context.preview);
    if (!candidates.length) {
      SpreadsheetApp.getActive().toast('Нет подтверждённых предложений для применения.', 'Качество данных', 5);
      return { ok: true, applied: 0, skipped: 0 };
    }
    if (candidates.length > PRH_QUALITY_APPLY.MAX_BATCH) {
      throw new Error('Подтверждено ' + candidates.length + ' предложений. Лимит одного запуска: ' + PRH_QUALITY_APPLY.MAX_BATCH + '.');
    }

    var operationsHeaders = context.operations.getRange(1, 1, 1, context.operations.getLastColumn()).getDisplayValues()[0];
    var operationIdColumn = prhFindHeader_(operationsHeaders, ['ID', 'ID операции', 'Operation ID']);
    var backupRows = [];
    var applied = 0;
    var skipped = 0;

    candidates.forEach(function (item) {
      try {
        var result = prhApplyOneQualityItem_(context.operations, operationsHeaders, operationIdColumn, item);
        backupRows.push(result.backup);
        prhMarkQualityItem_(context.preview, item.queueRow, PRH_QUALITY_APPLY.APPLIED_STATUS,
          'Применено ' + result.applyId + '; ' + result.field + ': «' + result.oldDisplay + '» → «' + result.newDisplay + '»');
        applied += 1;
      } catch (error) {
        prhMarkQualityItem_(context.preview, item.queueRow, PRH_QUALITY_APPLY.ERROR_STATUS, error.message);
        prhQualityApplyAudit_('QUALITY_APPLY_ITEM_ERROR', item.proposalId, 'ERROR', {
          queueRow: item.queueRow,
          operationRow: item.operationRow,
          message: error.message
        });
        skipped += 1;
      }
    });

    if (backupRows.length) {
      prhAppendQualityBackups_(context.backup, backupRows);
    }
    prhQualityApplySetting_('quality_apply_last_run', new Date(), 'Applied=' + applied + '; skipped=' + skipped);
    prhQualityApplyAudit_('QUALITY_APPLY_BATCH', PRH_QUALITY_APPLY.OPERATIONS, skipped ? 'PARTIAL' : 'OK', {
      applied: applied,
      skipped: skipped,
      limit: PRH_QUALITY_APPLY.MAX_BATCH,
      version: PRH_QUALITY_APPLY.VERSION
    });
    SpreadsheetApp.flush();
    SpreadsheetApp.getActive().toast('Применено: ' + applied + '; пропущено: ' + skipped, 'Качество данных', 7);
    return { ok: skipped === 0, applied: applied, skipped: skipped };
  } finally {
    lock.releaseLock();
  }
}

function prhApplyOneQualityItem_(operations, headers, operationIdColumn, item) {
  if (!PRH_QUALITY_APPLY.ALLOWED_ISSUES[item.issueType]) {
    throw new Error('Тип проблемы не разрешён для автоматического применения: ' + item.issueType);
  }
  if (!item.proposedValue) {
    throw new Error('Предложенное значение пустое. Заполните его и подтвердите предложение повторно.');
  }
  if (!Number.isInteger(item.operationRow) || item.operationRow < 2 || item.operationRow > operations.getLastRow()) {
    throw new Error('Строка операции вне допустимого диапазона: ' + item.operationRow);
  }

  var fieldColumn = prhFindHeader_(headers, [item.field]);
  if (fieldColumn < 0) throw new Error('Поле операции не найдено: ' + item.field);
  if (!prhIsAllowedTargetField_(headers[fieldColumn])) {
    throw new Error('Поле запрещено для автоматического изменения: ' + headers[fieldColumn]);
  }

  if (operationIdColumn >= 0 && item.operationId) {
    var actualId = String(operations.getRange(item.operationRow, operationIdColumn + 1).getDisplayValue() || '').trim();
    if (actualId !== item.operationId) {
      throw new Error('ID операции изменился: ожидался «' + item.operationId + '», найден «' + actualId + '».');
    }
  }

  var cell = operations.getRange(item.operationRow, fieldColumn + 1);
  var oldRaw = cell.getValue();
  var oldDisplay = String(cell.getDisplayValue() || '').trim();
  if (oldDisplay !== item.currentValue) {
    throw new Error('Текущее значение изменилось после формирования очереди: ожидалось «' + item.currentValue + '», найдено «' + oldDisplay + '».');
  }

  var applyId = 'APL-' + Utilities.getUuid();
  var now = new Date();
  var user = Session.getEffectiveUser().getEmail() || 'unknown';
  var backup = [
    now, applyId, item.proposalId, item.operationRow, item.operationId,
    headers[fieldColumn], oldRaw, item.proposedValue, user, PRH_QUALITY_APPLY.VERSION
  ];

  cell.setValue(item.proposedValue);
  var writtenDisplay = String(cell.getDisplayValue() || '').trim();
  if (writtenDisplay !== item.proposedValue) {
    cell.setValue(oldRaw);
    throw new Error('Проверка записи не пройдена; исходное значение восстановлено.');
  }

  prhQualityApplyAudit_('QUALITY_APPLY_ITEM', item.proposalId, 'OK', {
    applyId: applyId,
    operationRow: item.operationRow,
    operationId: item.operationId,
    field: headers[fieldColumn],
    oldValue: oldDisplay,
    newValue: writtenDisplay
  });
  return {
    applyId: applyId,
    field: headers[fieldColumn],
    oldDisplay: oldDisplay,
    newDisplay: writtenDisplay,
    backup: backup
  };
}

function prhReadApprovedQualityItems_(preview) {
  var lastRow = preview.getLastRow();
  if (lastRow < 2) return [];
  var width = PRH_QUALITY_APPLY.QUEUE_HEADERS.length;
  var actualHeaders = preview.getRange(1, 1, 1, width).getDisplayValues()[0];
  PRH_QUALITY_APPLY.QUEUE_HEADERS.forEach(function (header, index) {
    if (actualHeaders[index] !== header) throw new Error('Неверная структура очереди. Ожидался столбец: ' + header);
  });
  var rows = preview.getRange(2, 1, lastRow - 1, width).getDisplayValues();
  return rows.map(function (row, index) {
    return {
      queueRow: index + 2,
      proposalId: String(row[0] || '').trim(),
      operationRow: Number(row[1]),
      operationId: String(row[2] || '').trim(),
      issueType: String(row[3] || '').trim(),
      field: String(row[4] || '').trim(),
      currentValue: String(row[5] || '').trim(),
      proposedValue: String(row[6] || '').trim(),
      status: String(row[9] || '').trim()
    };
  }).filter(function (item) {
    return item.status === PRH_QUALITY_APPLY.APPROVED_STATUS;
  });
}

function prhValidateQualityApply() {
  var errors = [];
  var context;
  try {
    context = prhQualityApplyContext_();
  } catch (error) {
    errors.push(error.message);
  }
  if (context) {
    if (!prhIsQualityApplyEnabled_(context.settings)) errors.push('переключатель ' + PRH_QUALITY_APPLY.ENABLE_KEY + ' не равен TRUE');
    if (typeof PR_CONFIG !== 'undefined' && PR_CONFIG.ALLOW_OPERATION_WRITES !== true) errors.push('ALLOW_OPERATION_WRITES не равен true');
    var approved = prhReadApprovedQualityItems_(context.preview).length;
    if (approved > PRH_QUALITY_APPLY.MAX_BATCH) errors.push('подтверждено больше ' + PRH_QUALITY_APPLY.MAX_BATCH + ' предложений');
  }
  var message = errors.length
    ? 'Применение заблокировано:\n• ' + errors.join('\n• ')
    : 'Контур готов. Разрешены только категория и описание; лимит — ' + PRH_QUALITY_APPLY.MAX_BATCH + ' строк за запуск.';
  prhQualityApplyAudit_('QUALITY_APPLY_VALIDATE', 'Block 3', errors.length ? 'ERROR' : 'OK', { errors: errors });
  SpreadsheetApp.getUi().alert('Проверка применения исправлений', message, SpreadsheetApp.getUi().ButtonSet.OK);
  return { ok: errors.length === 0, errors: errors };
}

function prhDisableQualityApply() {
  prhQualityApplySetting_(PRH_QUALITY_APPLY.ENABLE_KEY, 'FALSE', 'Применение исправлений отключено пользователем');
  prhQualityApplyAudit_('QUALITY_APPLY_DISABLE', PRH_QUALITY_APPLY.ENABLE_KEY, 'OK', {});
  SpreadsheetApp.getActive().toast('Применение исправлений отключено.', 'Качество данных', 5);
}

function prhQualityApplyContext_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var operations = ss.getSheetByName(PRH_QUALITY_APPLY.OPERATIONS);
  var preview = ss.getSheetByName(PRH_QUALITY_APPLY.PREVIEW);
  var settings = ss.getSheetByName(PRH_QUALITY_APPLY.SETTINGS);
  if (!operations) throw new Error('Лист «01 Операции» не найден.');
  if (!preview) throw new Error('Лист «11 Предпросмотр» не найден.');
  if (!settings) throw new Error('Лист «09 Настройки» не найден.');
  var backup = ss.getSheetByName(PRH_QUALITY_APPLY.BACKUP) || ss.insertSheet(PRH_QUALITY_APPLY.BACKUP);
  prhEnsureQualityBackupLayout_(backup);
  return { ss: ss, operations: operations, preview: preview, settings: settings, backup: backup };
}

function prhRequireQualityApplyEnabled_(settings) {
  if (!prhIsQualityApplyEnabled_(settings)) {
    throw new Error('Применение отключено. Установите ' + PRH_QUALITY_APPLY.ENABLE_KEY + '=TRUE в «09 Настройки».');
  }
  if (typeof PR_CONFIG === 'undefined' || PR_CONFIG.ALLOW_OPERATION_WRITES !== true) {
    throw new Error('Запись заблокирована: PR_CONFIG.ALLOW_OPERATION_WRITES должен быть true.');
  }
}

function prhIsQualityApplyEnabled_(settings) {
  var rows = settings.getRange(1, 1, Math.max(settings.getLastRow(), 1), 2).getDisplayValues();
  return rows.some(function (row) {
    return String(row[0] || '').trim() === PRH_QUALITY_APPLY.ENABLE_KEY &&
      String(row[1] || '').trim().toUpperCase() === PRH_QUALITY_APPLY.ENABLE_VALUE;
  });
}

function prhIsAllowedTargetField_(header) {
  var normalized = String(header || '').trim().toLowerCase();
  return ['категория', 'описание', 'комментарий', 'назначение'].indexOf(normalized) >= 0;
}

function prhFindHeader_(headers, aliases) {
  var normalized = headers.map(function (value) { return String(value || '').trim().toLowerCase(); });
  for (var i = 0; i < aliases.length; i += 1) {
    var index = normalized.indexOf(String(aliases[i] || '').trim().toLowerCase());
    if (index >= 0) return index;
  }
  return -1;
}

function prhMarkQualityItem_(preview, row, status, comment) {
  var statusColumn = PRH_QUALITY_APPLY.QUEUE_HEADERS.indexOf('Статус') + 1;
  var checkedColumn = PRH_QUALITY_APPLY.QUEUE_HEADERS.indexOf('Проверено') + 1;
  var commentColumn = PRH_QUALITY_APPLY.QUEUE_HEADERS.indexOf('Комментарий') + 1;
  preview.getRange(row, statusColumn).setValue(status);
  preview.getRange(row, checkedColumn).setValue(new Date());
  preview.getRange(row, commentColumn).setValue(comment);
}

function prhEnsureQualityBackupLayout_(sheet) {
  var width = PRH_QUALITY_APPLY.BACKUP_HEADERS.length;
  if (sheet.getMaxColumns() < width) sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  sheet.getRange(1, 1, 1, width).setValues([PRH_QUALITY_APPLY.BACKUP_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function prhAppendQualityBackups_(sheet, rows) {
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, PRH_QUALITY_APPLY.BACKUP_HEADERS.length).setValues(rows);
}

function prhQualityApplySetting_(key, value, description) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRH_QUALITY_APPLY.SETTINGS);
  if (!sheet) throw new Error('Лист «09 Настройки» не найден.');
  var rows = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 3).getValues();
  var index = rows.findIndex(function (row) { return row[0] === key; });
  if (index >= 0) sheet.getRange(index + 1, 2, 1, 2).setValues([[value, description]]);
  else sheet.appendRow([key, value, description]);
}

function prhQualityApplyAudit_(type, target, result, details) {
  try {
    if (typeof appendAudit_ === 'function') {
      appendAudit_({ level: 'AUDIT', type: type, module: 'QualityApply', target: target, result: result, details: details });
    } else if (typeof prhAppendAudit_ === 'function') {
      prhAppendAudit_(SpreadsheetApp.getActiveSpreadsheet(), {
        level: 'AUDIT', eventType: type, module: 'QualityApply', object: target,
        result: result, message: 'Контролируемое применение исправлений', details: JSON.stringify(details || {})
      });
    }
  } catch (error) {
    console.warn('Quality apply audit skipped: ' + error.message);
  }
}
