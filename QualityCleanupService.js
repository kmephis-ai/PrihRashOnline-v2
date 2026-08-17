/**
 * ПрихРасхOnline v2 DEV — Quality Cleanup Service v0.3.0.
 *
 * Контур только для анализа и подготовки предложений:
 * - читает «01 Операции»;
 * - пишет не более 100 предложений в «11 Предпросмотр»;
 * - подтверждение/отклонение меняет только статус предложения;
 * - никогда не изменяет финансовые операции.
 */
var PRH_QUALITY = Object.freeze({
  VERSION: '0.3.0',
  OPERATIONS: '01 Операции',
  PREVIEW: '11 Предпросмотр',
  SETTINGS: '09 Настройки',
  MAX_QUEUE_ROWS: 100,
  QUEUE_HEADERS: Object.freeze([
    'ID предложения', 'Строка операции', 'ID операции', 'Тип проблемы',
    'Поле', 'Текущее значение', 'Предложенное значение', 'Основание',
    'Уверенность', 'Статус', 'Создано', 'Проверено', 'Комментарий'
  ]),
  HEADER_ALIASES: Object.freeze({
    id: ['ID', 'ID операции', 'Operation ID'],
    date: ['Дата', 'Дата операции'],
    type: ['Тип', 'Тип операции'],
    amount: ['Сумма', 'Сумма операции'],
    category: ['Категория'],
    description: ['Описание', 'Комментарий', 'Назначение'],
    status: ['Статус']
  }),
  REVIEW_STATUS: 'Требует проверки',
  DUPLICATE_STATUS: 'Возможный дубль'
});

function prhQualityMenuInstall() {
  SpreadsheetApp.getUi().createMenu('Качество данных')
    .addItem('Подготовить лист очереди', 'prhPrepareQualityQueueSheet')
    .addItem('Сформировать очередь dry-run', 'prhBuildQualityQueue')
    .addSeparator()
    .addItem('Подтвердить выбранные предложения', 'prhApproveSelectedQualityItems')
    .addItem('Отклонить выбранные предложения', 'prhRejectSelectedQualityItems')
    .addItem('Очистить завершённые предложения', 'prhClearResolvedQualityItems')
    .addSeparator()
    .addItem('Проверить безопасность контура', 'prhValidateQualityCleanup')
    .addToUi();
}

function prhPrepareQualityQueueSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PRH_QUALITY.PREVIEW);
  if (!sheet) {
    sheet = ss.insertSheet(PRH_QUALITY.PREVIEW);
  }
  prhEnsureQualityQueueLayout_(sheet);
  prhQualityAudit_('QUALITY_QUEUE_PREPARE', PRH_QUALITY.PREVIEW, 'OK', { version: PRH_QUALITY.VERSION });
  SpreadsheetApp.getUi().alert('Очередь качества подготовлена', 'Создан или проверен лист «11 Предпросмотр». Лист «01 Операции» не изменялся.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function prhBuildQualityQueue() {
  prhQualityOperationWriteGuard_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var operations = ss.getSheetByName(PRH_QUALITY.OPERATIONS);
  var preview = ss.getSheetByName(PRH_QUALITY.PREVIEW);
  if (!operations) throw new Error('Лист «01 Операции» не найден.');
  if (!preview) throw new Error('Сначала выполните «Качество данных → Подготовить лист очереди».');
  prhEnsureQualityQueueLayout_(preview);

  var lastRow = operations.getLastRow();
  var lastColumn = operations.getLastColumn();
  if (lastRow < 2) throw new Error('Операции отсутствуют.');
  var headers = operations.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  var map = prhResolveQualityColumns_(headers);
  var values = operations.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  var display = operations.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
  var duplicateKeys = {};
  var items = [];

  values.forEach(function (row, index) {
    if (items.length >= PRH_QUALITY.MAX_QUEUE_ROWS) return;
    var shown = display[index];
    var sheetRow = index + 2;
    var operationId = map.id >= 0 ? shown[map.id] : '';
    var dateValue = map.date >= 0 ? row[map.date] : null;
    var amountValue = map.amount >= 0 ? row[map.amount] : null;
    var categoryValue = map.category >= 0 ? String(shown[map.category] || '').trim() : '';
    var descriptionValue = map.description >= 0 ? String(shown[map.description] || '').trim() : '';

    if (map.date >= 0 && !(dateValue instanceof Date) && String(shown[map.date] || '').trim() === '') {
      prhPushQualityItem_(items, sheetRow, operationId, 'MISSING_DATE', headers[map.date], '', '', 'Дата операции не заполнена', 1.0);
    }
    if (items.length >= PRH_QUALITY.MAX_QUEUE_ROWS) return;

    if (map.amount >= 0 && (!isFinite(Number(amountValue)) || Number(amountValue) <= 0)) {
      prhPushQualityItem_(items, sheetRow, operationId, 'INVALID_AMOUNT', headers[map.amount], shown[map.amount], '', 'Сумма отсутствует, равна нулю или некорректна', 1.0);
    }
    if (items.length >= PRH_QUALITY.MAX_QUEUE_ROWS) return;

    if (map.category >= 0 && categoryValue === '') {
      prhPushQualityItem_(items, sheetRow, operationId, 'MISSING_CATEGORY', headers[map.category], '', 'Другое', 'Категория не заполнена; предложено временное безопасное значение', 0.6);
    }
    if (items.length >= PRH_QUALITY.MAX_QUEUE_ROWS) return;

    if (map.description >= 0 && descriptionValue === '') {
      prhPushQualityItem_(items, sheetRow, operationId, 'MISSING_DESCRIPTION', headers[map.description], '', '', 'Описание отсутствует; требуется ручное уточнение', 0.4);
    }
    if (items.length >= PRH_QUALITY.MAX_QUEUE_ROWS) return;

    if (map.date >= 0 && map.amount >= 0 && map.category >= 0) {
      var dateKey = dateValue instanceof Date ? Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd') : shown[map.date];
      var key = [dateKey, Number(amountValue) || 0, categoryValue, descriptionValue].join('|').toLowerCase();
      if (duplicateKeys[key]) {
        prhPushQualityItem_(items, sheetRow, operationId, 'POSSIBLE_DUPLICATE', 'Строка', sheetRow, duplicateKeys[key], 'Совпадают дата, сумма, категория и описание; указана первая строка', 0.85);
      } else if (key !== '|0||') {
        duplicateKeys[key] = sheetRow;
      }
    }
  });

  var existingRows = Math.max(preview.getLastRow() - 1, 0);
  if (existingRows > 0) preview.getRange(2, 1, existingRows, PRH_QUALITY.QUEUE_HEADERS.length).clearContent();
  if (items.length > 0) preview.getRange(2, 1, items.length, PRH_QUALITY.QUEUE_HEADERS.length).setValues(items);
  preview.setFrozenRows(1);
  preview.autoResizeColumns(1, PRH_QUALITY.QUEUE_HEADERS.length);
  preview.activate();
  preview.getRange('A1').activate();
  prhQualitySetting_('quality_cleanup_phase_2', 'DRY_RUN_READY', 'Сформирована очередь без записи в операции');
  prhQualityAudit_('QUALITY_QUEUE_BUILD', PRH_QUALITY.PREVIEW, 'OK', { scanned: values.length, queued: items.length, limit: PRH_QUALITY.MAX_QUEUE_ROWS });
  ss.toast('Очередь сформирована: ' + items.length + ' предложений', 'Качество данных', 6);
}

function prhApproveSelectedQualityItems() { prhSetSelectedQualityStatus_('ПОДТВЕРЖДЕНО'); }
function prhRejectSelectedQualityItems() { prhSetSelectedQualityStatus_('ОТКЛОНЕНО'); }

function prhSetSelectedQualityStatus_(status) {
  prhQualityOperationWriteGuard_();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getName() !== PRH_QUALITY.PREVIEW) throw new Error('Откройте лист «11 Предпросмотр».');
  var range = sheet.getActiveRange();
  if (!range || range.getRow() < 2) throw new Error('Выберите одну или несколько строк предложений.');
  var count = range.getNumRows();
  var statusColumn = PRH_QUALITY.QUEUE_HEADERS.indexOf('Статус') + 1;
  var checkedColumn = PRH_QUALITY.QUEUE_HEADERS.indexOf('Проверено') + 1;
  sheet.getRange(range.getRow(), statusColumn, count, 1).setValues(Array(count).fill([status]));
  sheet.getRange(range.getRow(), checkedColumn, count, 1).setValues(Array(count).fill([new Date()]));
  prhQualityAudit_('QUALITY_QUEUE_REVIEW', status, 'OK', { rows: count, firstRow: range.getRow() });
  SpreadsheetApp.getActive().toast('Статус изменён только в очереди: ' + status, 'Качество данных', 5);
}

function prhClearResolvedQualityItems() {
  prhQualityOperationWriteGuard_();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRH_QUALITY.PREVIEW);
  if (!sheet) throw new Error('Лист «11 Предпросмотр» не найден.');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var statusColumn = PRH_QUALITY.QUEUE_HEADERS.indexOf('Статус') + 1;
  var statuses = sheet.getRange(2, statusColumn, lastRow - 1, 1).getDisplayValues();
  var rows = [];
  statuses.forEach(function (row, index) {
    if (row[0] === 'ПОДТВЕРЖДЕНО' || row[0] === 'ОТКЛОНЕНО') rows.push(index + 2);
  });
  rows.reverse().forEach(function (row) { sheet.deleteRow(row); });
  prhQualityAudit_('QUALITY_QUEUE_CLEAR_RESOLVED', PRH_QUALITY.PREVIEW, 'OK', { removed: rows.length });
  SpreadsheetApp.getActive().toast('Удалено завершённых предложений: ' + rows.length, 'Качество данных', 5);
}

function prhValidateQualityCleanup() {
  var errors = [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(PRH_QUALITY.OPERATIONS)) errors.push('нет листа «01 Операции»');
  var preview = ss.getSheetByName(PRH_QUALITY.PREVIEW);
  if (!preview) errors.push('нет листа «11 Предпросмотр»');
  if (typeof PR_CONFIG !== 'undefined' && PR_CONFIG.ALLOW_OPERATION_WRITES !== false) errors.push('ALLOW_OPERATION_WRITES не равен false');
  var message = errors.length ? errors.join('\n') : 'Контур безопасен: операции доступны только для чтения; очередь ограничена 100 строками.';
  prhQualityAudit_('QUALITY_VALIDATE', 'Block 2', errors.length ? 'ERROR' : 'OK', { errors: errors });
  SpreadsheetApp.getUi().alert('Проверка контура качества', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function prhEnsureQualityQueueLayout_(sheet) {
  var width = PRH_QUALITY.QUEUE_HEADERS.length;
  if (sheet.getMaxColumns() < width) sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  sheet.getRange(1, 1, 1, width).setValues([PRH_QUALITY.QUEUE_HEADERS]);
  sheet.getRange(1, 1, 1, width).setFontWeight('bold');
}

function prhResolveQualityColumns_(headers) {
  var normalized = headers.map(function (value) { return String(value || '').trim().toLowerCase(); });
  var result = {};
  Object.keys(PRH_QUALITY.HEADER_ALIASES).forEach(function (key) {
    result[key] = -1;
    PRH_QUALITY.HEADER_ALIASES[key].some(function (alias) {
      var index = normalized.indexOf(alias.toLowerCase());
      if (index >= 0) result[key] = index;
      return index >= 0;
    });
  });
  ['date', 'amount', 'category'].forEach(function (required) {
    if (result[required] < 0) throw new Error('Не найден обязательный столбец: ' + required);
  });
  return result;
}

function prhPushQualityItem_(items, row, operationId, issueType, field, currentValue, proposedValue, reason, confidence) {
  if (items.length >= PRH_QUALITY.MAX_QUEUE_ROWS) return;
  items.push([
    'QLT-' + Utilities.getUuid(), row, operationId, issueType, field,
    currentValue, proposedValue, reason, confidence, 'НОВОЕ', new Date(), '', ''
  ]);
}

function prhQualityOperationWriteGuard_() {
  if (typeof operationWriteGuard_ === 'function') operationWriteGuard_();
  if (typeof PR_CONFIG !== 'undefined' && PR_CONFIG.ALLOW_OPERATION_WRITES !== false) {
    throw new Error('Safety violation: запись в операции должна быть запрещена.');
  }
  return true;
}

function prhQualityAudit_(type, target, result, details) {
  try {
    if (typeof appendAudit_ === 'function') {
      appendAudit_({ level: 'AUDIT', type: type, module: 'QualityCleanup', target: target, result: result, details: details });
    } else if (typeof prhAppendAudit_ === 'function') {
      prhAppendAudit_(SpreadsheetApp.getActiveSpreadsheet(), {
        level: 'AUDIT', eventType: type, module: 'QualityCleanup', object: target,
        result: result, message: 'Операции не изменялись', details: JSON.stringify(details || {})
      });
    }
  } catch (error) { console.warn('Quality audit skipped: ' + error.message); }
}

function prhQualitySetting_(key, value, description) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRH_QUALITY.SETTINGS);
    if (!sheet) return;
    var rows = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 3).getValues();
    var index = rows.findIndex(function (row) { return row[0] === key; });
    if (index >= 0) sheet.getRange(index + 1, 2, 1, 2).setValues([[value, description]]);
    else sheet.appendRow([key, value, description]);
  } catch (error) { console.warn('Quality setting skipped: ' + error.message); }
}
