/**
 * ПрихРасхOnline v2 DEV — конфигурация безопасной автоматизации.
 *
 * По умолчанию система работает только в DRY_RUN. Запись в «01 Операции»
 * запрещена на двух независимых уровнях: конфигурацией и явным guard.
 */
var PR_CONFIG = Object.freeze({
  VERSION: '0.1.0',
  MODE: 'DRY_RUN',
  REQUIRE_CONFIRMATION: true,
  ALLOW_ID_WRITES: false,
  ALLOW_OPERATION_WRITES: false,
  MAX_COMMAND_ROWS: 500,
  MAX_AUDIT_ROWS: 1000,
  SHEETS: Object.freeze({
    SETTINGS: '09 Настройки',
    CONTROL: '10 Контроль',
    PREVIEW: '11 Предпросмотр',
    COMMANDS: '12 Команды',
    AUDIT: '13 Журнал',
    OPERATIONS: '01 Операции'
  }),
  ALLOWED_COMMANDS: Object.freeze([
    'VALIDATE_WORKBOOK',
    'GENERATE_MISSING_IDS',
    'REFRESH_DASHBOARD',
    'PREPARE_PREVIEW'
  ]),
  ID_RULES: Object.freeze([
    { sheet: '03 Бюджеты', prefix: 'BUD', idColumn: 1, contentColumn: 2, maxRows: 500 },
    { sheet: '04 Регулярные', prefix: 'REG', idColumn: 1, contentColumn: 3, maxRows: 500 },
    { sheet: '05 Обязательства', prefix: 'OBL', idColumn: 1, contentColumn: 3, maxRows: 500 },
    { sheet: '06 Баланс', prefix: 'BAL', idColumn: 1, contentColumn: 2, maxRows: 500 },
    { sheet: '07 Проекты', prefix: 'PRJ', idColumn: 1, contentColumn: 2, maxRows: 500 },
    { sheet: '08 Покупки', prefix: 'PUR', idColumn: 1, contentColumn: 4, maxRows: 500 },
    { sheet: '12 Команды', prefix: 'CMD', idColumn: 1, contentColumn: 3, maxRows: 500 }
  ])
});

function getBook_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) {
    throw new Error('Скрипт должен быть привязан к книге ПрихРасхOnline v2 DEV.');
  }
  return book;
}

function getSheetRequired_(name) {
  var sheet = getBook_().getSheetByName(name);
  if (!sheet) {
    throw new Error('Не найден обязательный лист: ' + name);
  }
  return sheet;
}

function getInitiator_() {
  return Session.getActiveUser().getEmail() || 'unknown';
}

function makeCorrelationId_() {
  return 'COR-' + Utilities.getUuid();
}

function getSettingsMap_() {
  var sheet = getSheetRequired_(PR_CONFIG.SHEETS.SETTINGS);
  var lastRow = Math.max(sheet.getLastRow(), 2);
  var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var result = {};
  rows.forEach(function (row) {
    if (row[0] !== '') {
      result[String(row[0])] = row[1];
    }
  });
  return result;
}

function setSetting_(key, value) {
  var sheet = getSheetRequired_(PR_CONFIG.SHEETS.SETTINGS);
  var lastRow = Math.max(sheet.getLastRow(), 2);
  var keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < keys.length; i += 1) {
    if (String(keys[i][0]) === key) {
      sheet.getRange(i + 2, 2).setValue(value);
      return;
    }
  }
  throw new Error('Не найден параметр настройки: ' + key);
}

function operationWriteGuard_() {
  if (PR_CONFIG.ALLOW_OPERATION_WRITES !== false) {
    throw new Error('Safety violation: ALLOW_OPERATION_WRITES должен быть false.');
  }
  var settings = getSettingsMap_();
  if (settings.automation_write_operations !== false) {
    throw new Error('Safety violation: automation_write_operations должен быть FALSE.');
  }
  return true;
}
