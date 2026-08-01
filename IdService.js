/**
 * Возвращает следующий свободный ID вида PREFIX-0001.
 * Существующие значения не изменяются и не перенумеровываются.
 */
function nextSequentialId_(sheet, prefix, idColumn, maxRows) {
  var rowCount = Math.min(Math.max(sheet.getLastRow() - 1, 0), maxRows);
  if (rowCount === 0) {
    return prefix + '-0001';
  }
  var ids = sheet.getRange(2, idColumn, rowCount, 1).getDisplayValues();
  var pattern = new RegExp('^' + prefix + '-(\\d+)$');
  var maxNumber = 0;
  ids.forEach(function (row) {
    var match = String(row[0]).match(pattern);
    if (match) {
      maxNumber = Math.max(maxNumber, Number(match[1]));
    }
  });
  return prefix + '-' + String(maxNumber + 1).padStart(4, '0');
}

/**
 * Проверяет или заполняет отсутствующие ID в разрешённых модулях.
 * applyChanges=true работает только после снятия двух safety-блокировок.
 */
function generateMissingIds_(applyChanges) {
  operationWriteGuard_();
  if (applyChanges && (PR_CONFIG.MODE === 'DRY_RUN' || !PR_CONFIG.ALLOW_ID_WRITES)) {
    throw new Error('Запись ID заблокирована конфигурацией DRY_RUN.');
  }

  var lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    var summary = [];
    PR_CONFIG.ID_RULES.forEach(function (rule) {
      var sheet = getSheetRequired_(rule.sheet);
      var rowCount = Math.min(Math.max(sheet.getLastRow() - 1, 0), rule.maxRows);
      if (rowCount === 0) {
        summary.push({ sheet: rule.sheet, missing: 0, written: 0 });
        return;
      }

      var width = Math.max(rule.idColumn, rule.contentColumn);
      var data = sheet.getRange(2, 1, rowCount, width).getValues();
      var ids = data.map(function (row) { return [row[rule.idColumn - 1]]; });
      var nextNumber = extractNextNumber_(ids, rule.prefix);
      var missing = 0;
      var written = 0;

      data.forEach(function (row, index) {
        var hasContent = row[rule.contentColumn - 1] !== '';
        var hasId = row[rule.idColumn - 1] !== '';
        if (hasContent && !hasId) {
          missing += 1;
          if (applyChanges) {
            ids[index][0] = rule.prefix + '-' + String(nextNumber).padStart(4, '0');
            nextNumber += 1;
            written += 1;
          }
        }
      });

      if (applyChanges && written > 0) {
        sheet.getRange(2, rule.idColumn, rowCount, 1).setValues(ids);
      }
      summary.push({ sheet: rule.sheet, missing: missing, written: written });
    });
    return summary;
  } finally {
    lock.releaseLock();
  }
}

function extractNextNumber_(ids, prefix) {
  var pattern = new RegExp('^' + prefix + '-(\\d+)$');
  var maxNumber = 0;
  ids.forEach(function (row) {
    var match = String(row[0]).match(pattern);
    if (match) {
      maxNumber = Math.max(maxNumber, Number(match[1]));
    }
  });
  return maxNumber + 1;
}
