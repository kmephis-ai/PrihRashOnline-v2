/**
 * Обрабатывает только явно подтверждённые команды со статусом «Готово».
 * В DRY_RUN любая команда, требующая записи данных, остаётся read-only.
 */
function processConfirmedCommands_() {
  operationWriteGuard_();
  var sheet = getSheetRequired_(PR_CONFIG.SHEETS.COMMANDS);
  var rowCount = Math.min(Math.max(sheet.getLastRow() - 1, 0), PR_CONFIG.MAX_COMMAND_ROWS);
  if (rowCount === 0) {
    return { processed: 0, blocked: 0, errors: 0 };
  }

  var rows = sheet.getRange(2, 1, rowCount, 14).getValues();
  var processed = 0;
  var blocked = 0;
  var errors = 0;

  rows.forEach(function (row, index) {
    if (row[2] === '' || String(row[8]) !== 'Готово') {
      return;
    }
    var sheetRow = index + 2;
    var metadata = ensureCommandMetadata_(sheet, sheetRow, row);
    var commandId = metadata.commandId;
    var command = String(row[2]);
    var targetSheet = String(row[3] || '');
    var dryRun = row[6] === true;
    var confirmed = row[7] === true;
    var correlationId = metadata.correlationId;

    try {
      if (targetSheet === PR_CONFIG.SHEETS.OPERATIONS) {
        throw new Error('Запись в 01 Операции запрещена.');
      }
      if (PR_CONFIG.ALLOWED_COMMANDS.indexOf(command) === -1) {
        throw new Error('Команда отсутствует в allowlist: ' + command);
      }
      if (PR_CONFIG.REQUIRE_CONFIRMATION && !confirmed) {
        blockCommand_(sheet, sheetRow, 'Требуется явное подтверждение.');
        blocked += 1;
        appendAudit_({
          level: 'WARN', type: 'COMMAND_BLOCKED', commandId: commandId,
          module: targetSheet, result: 'BLOCKED',
          message: 'Команда не подтверждена.',
          correlationId: correlationId
        });
        return;
      }
      if (PR_CONFIG.MODE === 'DRY_RUN' && !dryRun) {
        blockCommand_(sheet, sheetRow, 'В режиме DRY_RUN флаг Dry run должен быть включён.');
        blocked += 1;
        return;
      }

      var result = executeAllowedCommand_(command, dryRun);
      completeCommand_(sheet, sheetRow, result);
      processed += 1;
      appendAudit_({
        level: 'AUDIT', type: 'COMMAND_COMPLETED', commandId: commandId,
        module: targetSheet, target: row[4], result: 'OK',
        message: result.message, correlationId: correlationId,
        details: result.details
      });
    } catch (error) {
      failCommand_(sheet, sheetRow, error.message);
      errors += 1;
      appendAudit_({
        level: 'ERROR', type: 'COMMAND_ERROR', commandId: commandId,
        module: targetSheet, target: row[4], result: 'ERROR',
        message: error.message, correlationId: correlationId
      });
    }
  });

  return { processed: processed, blocked: blocked, errors: errors };
}

function executeAllowedCommand_(command, dryRun) {
  if (command === 'VALIDATE_WORKBOOK') {
    var validation = validateWorkbook_();
    return { message: validation.summary, details: validation };
  }
  if (command === 'GENERATE_MISSING_IDS') {
    var ids = generateMissingIds_(!dryRun);
    return { message: 'Проверка ID завершена.', details: ids };
  }
  if (command === 'REFRESH_DASHBOARD') {
    SpreadsheetApp.flush();
    return { message: 'Формулы пересчитаны.', details: { dryRun: dryRun } };
  }
  if (command === 'PREPARE_PREVIEW') {
    var preview = validatePreview_();
    return { message: preview.message, details: preview };
  }
  throw new Error('Необработанная команда: ' + command);
}

function ensureCommandMetadata_(sheet, rowNumber, row) {
  var commandId = row[0];
  var correlationId = row[12];
  if (!commandId) {
    commandId = nextSequentialId_(sheet, 'CMD', 1, PR_CONFIG.MAX_COMMAND_ROWS);
    sheet.getRange(rowNumber, 1).setValue(commandId);
  }
  if (!row[1]) {
    sheet.getRange(rowNumber, 2).setValue(new Date());
  }
  if (!row[10]) {
    sheet.getRange(rowNumber, 11).setValue(getInitiator_());
  }
  if (!correlationId) {
    correlationId = makeCorrelationId_();
    sheet.getRange(rowNumber, 13).setValue(correlationId);
  }
  return {
    commandId: commandId,
    correlationId: correlationId
  };
}

function completeCommand_(sheet, rowNumber, result) {
  sheet.getRange(rowNumber, 9, 1, 4).setValues([[
    'Выполнено', result.message, getInitiator_(), new Date()
  ]]);
}

function blockCommand_(sheet, rowNumber, message) {
  sheet.getRange(rowNumber, 9, 1, 4).setValues([[
    'Заблокировано', message, getInitiator_(), new Date()
  ]]);
}

function failCommand_(sheet, rowNumber, message) {
  sheet.getRange(rowNumber, 9, 1, 4).setValues([[
    'Ошибка', message, getInitiator_(), new Date()
  ]]);
}
