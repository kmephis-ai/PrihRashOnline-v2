/**
 * @OnlyCurrentDoc
 * ПрихРасхOnline v2 DEV — Apps Script Foundation v0.1.2
 *
 * Safety contract:
 * - this release never writes to sheet "01 Операции";
 * - only confirmed commands with Dry run = TRUE and status "Готово" run;
 * - all runs are serialized with a document lock and recorded in "13 Журнал";
 * - full-history migration and automatic posting remain disabled.
 */

var PRH = Object.freeze({
  VERSION: '0.1.2',
  MENU: 'ПрихРасхOnline v2 DEV',
  SHEETS: Object.freeze({
    HOME: '00 Главная',
    OPERATIONS: '01 Операции',
    REFERENCES: '02 Справочники',
    BUDGETS: '03 Бюджеты',
    RECURRING: '04 Регулярные',
    OBLIGATIONS: '05 Обязательства',
    BALANCE: '06 Баланс',
    PROJECTS: '07 Проекты',
    PURCHASES: '08 Покупки',
    SETTINGS: '09 Настройки',
    CONTROL: '10 Контроль',
    PREVIEW: '11 Предпросмотр',
    COMMANDS: '12 Команды',
    AUDIT: '13 Журнал'
  }),
  REQUIRED_SHEETS: Object.freeze([
    '00 Главная', '01 Операции', '02 Справочники', '03 Бюджеты',
    '04 Регулярные', '05 Обязательства', '06 Баланс', '07 Проекты',
    '08 Покупки', '09 Настройки', '10 Контроль', '11 Предпросмотр',
    '12 Команды', '13 Журнал'
  ]),
  ALLOWED_COMMANDS: Object.freeze([
    'VALIDATE_WORKBOOK',
    'GENERATE_MISSING_IDS',
    'REFRESH_DASHBOARD',
    'PREPARE_PREVIEW'
  ]),
  ALLOWED_ID_TARGETS: Object.freeze([
    '03 Бюджеты', '04 Регулярные', '05 Обязательства',
    '06 Баланс', '07 Проекты', '08 Покупки', '11 Предпросмотр'
  ]),
  COMMAND_HEADERS: Object.freeze([
    'ID', 'Создано', 'Команда', 'Целевой лист', 'Целевой ID', 'Параметр',
    'Dry run', 'Подтверждено', 'Статус', 'Результат', 'Инициатор',
    'Обработано', 'Correlation ID', 'Комментарий'
  ]),
  AUDIT_HEADERS: Object.freeze([
    'ID события', 'Дата/время', 'Уровень', 'Тип события', 'ID команды',
    'Модуль', 'Объект', 'Результат', 'Сообщение', 'Инициатор',
    'Correlation ID', 'До', 'После', 'Детали'
  ]),
  OPERATION_HEADERS: Object.freeze([
    'ID', 'Дата и время', 'Дата', 'Месяц', 'Тип', 'Сумма', 'Счёт',
    'Счёт назначения', 'Категория', 'Подкатегория', 'Наименование',
    'Член семьи', 'Проект', 'Теги', 'Регулярная', 'Комментарий',
    'Источник', 'Строка источника', 'Статус', 'Исходный тип'
  ])
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(PRH.MENU)
    .addItem('1. Проверить установку', 'prhAttachFoundation')
    .addItem('2. Выполнить подтверждённые dry-run команды', 'prhRunConfirmedDryRuns')
    .addSeparator()
    .addItem('Показать состояние автоматизации', 'prhShowAutomationStatus')
    .addToUi();
}

function prhAttachFoundation() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var structural = prhValidateStructure_(ss);
    if (structural.errors.length) {
      throw new Error('Установка не подтверждена: ' + structural.errors.join('; '));
    }

    prhSetSettings_(ss, {
      automation_attached: true,
      automation_script_version: PRH.VERSION,
      dry_run_requires_user_action: false,
      dry_run_execution_status: 'READY'
    });
    prhAppendAudit_(ss, {
      level: 'AUDIT',
      eventType: 'SCRIPT_ATTACHED',
      commandId: '',
      module: 'Automation',
      object: 'Foundation v' + PRH.VERSION,
      result: 'OK',
      message: 'Apps Script подключён; запись в 01 Операции остаётся запрещена',
      initiator: 'Пользователь',
      correlationId: prhCorrelationId_(),
      before: 'automation_attached=FALSE',
      after: 'automation_attached=TRUE',
      details: 'Выполнена только проверка установки и структуры книги'
    });

    SpreadsheetApp.getUi().alert(
      'Установка подтверждена',
      'Foundation v' + PRH.VERSION + ' подключён. Теперь можно вручную подтвердить команду ' +
        'CMD-20260729-0001: Подтверждено = TRUE, Статус = Готово. Запись в 01 Операции отключена.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } finally {
    lock.releaseLock();
  }
}

function prhShowAutomationStatus() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var settings = prhReadSettings_(ss);
  var text = [
    'Foundation: v' + PRH.VERSION,
    'automation_attached: ' + String(settings.automation_attached),
    'automation_mode: ' + String(settings.automation_mode),
    'automation_write_operations: ' + String(settings.automation_write_operations),
    'full_history_migrated: ' + String(settings.full_history_migrated),
    'dry_run_execution_status: ' + String(settings.dry_run_execution_status)
  ].join('\n');
  SpreadsheetApp.getUi().alert('Состояние автоматизации', text, SpreadsheetApp.getUi().ButtonSet.OK);
}

function prhRunConfirmedDryRuns() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var settings = prhReadSettings_(ss);
    prhAssertAutomationSafety_(settings);

    var sheet = prhRequireSheet_(ss, PRH.SHEETS.COMMANDS);
    prhAssertHeaders_(sheet, PRH.COMMAND_HEADERS);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      SpreadsheetApp.getUi().alert('Нет команд для обработки.');
      return;
    }

    var values = sheet.getRange(2, 1, lastRow - 1, PRH.COMMAND_HEADERS.length).getValues();
    var processed = 0;
    var blocked = 0;
    for (var i = 0; i < values.length; i++) {
      var command = prhCommandFromRow_(values[i], i + 2);
      if (!command.id || command.status !== 'Готово' || command.confirmed !== true) {
        continue;
      }
      if (command.dryRun !== true) {
        prhFinishCommand_(ss, command, 'Заблокировано', 'Dry run должен быть TRUE', 'BLOCKED');
        blocked++;
        continue;
      }
      try {
        var result = prhExecuteDryRun_(ss, command, settings);
        prhFinishCommand_(ss, command, 'Выполнено', result.message, result.level === 'ERROR' ? 'ERROR' : 'OK', result.details);
        processed++;
      } catch (error) {
        prhFinishCommand_(ss, command, 'Ошибка', error.message, 'ERROR', String(error.stack || ''));
      }
    }

    SpreadsheetApp.flush();
    SpreadsheetApp.getUi().alert(
      'Обработка завершена',
      'Выполнено dry-run команд: ' + processed + '\nЗаблокировано: ' + blocked +
        '\nЛист 01 Операции не изменялся.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } finally {
    lock.releaseLock();
  }
}

function prhExecuteDryRun_(ss, command, settings) {
  if (PRH.ALLOWED_COMMANDS.indexOf(command.type) < 0) {
    throw new Error('Команда не разрешена: ' + command.type);
  }
  if (command.targetSheet && !ss.getSheetByName(command.targetSheet)) {
    throw new Error('Целевой лист не найден: ' + command.targetSheet);
  }

  switch (command.type) {
    case 'VALIDATE_WORKBOOK':
      return prhValidateWorkbook_(ss, command, settings);
    case 'GENERATE_MISSING_IDS':
      return prhPreviewMissingIds_(ss, command);
    case 'REFRESH_DASHBOARD':
      SpreadsheetApp.flush();
      return { level: 'INFO', message: 'Формулы пересчитаны; данные не изменялись', details: 'dry-run' };
    case 'PREPARE_PREVIEW':
      return prhValidatePreview_(ss);
    default:
      throw new Error('Нет обработчика команды: ' + command.type);
  }
}

function prhValidateWorkbook_(ss, command, settings) {
  var structure = prhValidateStructure_(ss);
  var errors = structure.errors.slice();
  var warnings = structure.warnings.slice();
  var params = prhParseParams_(command.parameter);
  var expected = Number(params.operations_expected || 0);

  if (String(settings.environment) !== 'DEV') errors.push('environment должен быть DEV');
  if (String(settings.automation_mode) !== 'DRY_RUN') errors.push('automation_mode должен быть DRY_RUN');
  if (prhToBool_(settings.automation_write_operations)) errors.push('automation_write_operations должен быть FALSE');
  if (prhToBool_(settings.full_history_migrated)) errors.push('full_history_migrated должен быть FALSE в DEV');

  var operations = prhRequireSheet_(ss, PRH.SHEETS.OPERATIONS);
  prhAssertHeaders_(operations, PRH.OPERATION_HEADERS);
  var lastRow = operations.getLastRow();
  var rows = lastRow > 1 ? operations.getRange(2, 1, lastRow - 1, PRH.OPERATION_HEADERS.length).getValues() : [];
  var analysis = prhAnalyzeOperationValues_(rows, expected);
  errors = errors.concat(analysis.errors);
  warnings = warnings.concat(analysis.warnings);

  var level = errors.length ? 'ERROR' : (warnings.length ? 'WARN' : 'INFO');
  var message = [
    errors.length ? 'FAIL' : 'OK',
    'operations=' + analysis.metrics.operationCount,
    'errors=' + errors.length,
    'warnings=' + warnings.length
  ].join('; ');
  var details = JSON.stringify({ errors: errors, warnings: warnings, metrics: analysis.metrics });

  prhSetSettings_(ss, {
    dry_run_execution_status: errors.length ? 'FAILED' : 'PASSED'
  });
  return { level: level, message: message, details: details };
}

function prhAnalyzeOperationValues_(rows, expectedCount) {
  var metrics = {
    operationCount: 0,
    duplicateIds: 0,
    duplicateSourceRows: 0,
    blankDates: 0,
    invalidTypes: 0,
    missingAmount: 0,
    missingAccount: 0,
    missingCategory: 0,
    problemStatuses: 0
  };
  var ids = {};
  var sourceRows = {};
  var errors = [];
  var warnings = [];

  rows.forEach(function (row) {
    var id = String(row[0] || '').trim();
    if (!id) return;
    metrics.operationCount++;
    if (ids[id]) metrics.duplicateIds++;
    ids[id] = true;

    var sourceKey = String(row[16] || '') + '|' + String(row[17] || '');
    if (sourceRows[sourceKey]) metrics.duplicateSourceRows++;
    sourceRows[sourceKey] = true;

    var type = String(row[4] || '').trim();
    var financial = type === 'Доход' || type === 'Расход';
    if (['Доход', 'Расход', 'Служебная запись'].indexOf(type) < 0) metrics.invalidTypes++;
    if (!row[2]) metrics.blankDates++;
    if (financial && (row[5] === '' || row[5] === null)) metrics.missingAmount++;
    if (financial && !String(row[6] || '').trim()) metrics.missingAccount++;
    if (financial && !String(row[8] || '').trim()) metrics.missingCategory++;
    if (row[18] === 'Возможный дубль' || row[18] === 'Требует проверки') metrics.problemStatuses++;
  });

  if (expectedCount && metrics.operationCount !== expectedCount) {
    errors.push('ожидалось операций ' + expectedCount + ', найдено ' + metrics.operationCount);
  }
  if (metrics.duplicateIds) errors.push('дубли ID: ' + metrics.duplicateIds);
  if (metrics.duplicateSourceRows) errors.push('дубли строк источника: ' + metrics.duplicateSourceRows);
  if (metrics.invalidTypes) errors.push('неизвестные типы: ' + metrics.invalidTypes);
  if (metrics.missingAmount) errors.push('пустая сумма у финансовых операций: ' + metrics.missingAmount);
  if (metrics.missingAccount) errors.push('пустой счёт у финансовых операций: ' + metrics.missingAccount);
  if (metrics.missingCategory) errors.push('пустая категория у финансовых операций: ' + metrics.missingCategory);
  if (metrics.blankDates) warnings.push('пустая дата: ' + metrics.blankDates);
  if (metrics.problemStatuses) warnings.push('проблемные статусы: ' + metrics.problemStatuses);

  return { metrics: metrics, errors: errors, warnings: warnings };
}

function prhPreviewMissingIds_(ss, command) {
  if (PRH.ALLOWED_ID_TARGETS.indexOf(command.targetSheet) < 0) {
    throw new Error('Для GENERATE_MISSING_IDS недопустим целевой лист: ' + command.targetSheet);
  }
  var sheet = prhRequireSheet_(ss, command.targetSheet);
  var lastRow = sheet.getLastRow();
  var missing = 0;
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function (row) {
      if (!String(row[0] || '').trim()) missing++;
    });
  }
  return {
    level: missing ? 'WARN' : 'INFO',
    message: 'dry-run: отсутствующих ID=' + missing + '; изменений нет',
    details: 'target=' + command.targetSheet
  };
}

function prhValidatePreview_(ss) {
  var sheet = prhRequireSheet_(ss, PRH.SHEETS.PREVIEW);
  var lastRow = sheet.getLastRow();
  var counts = { ready: 0, missing: 0, view: 0, excluded: 0, other: 0 };
  if (lastRow > 1) {
    sheet.getRange(2, 14, lastRow - 1, 1).getDisplayValues().forEach(function (row) {
      var value = row[0];
      if (value === 'Готово к записи') counts.ready++;
      else if (value === 'Не хватает данных') counts.missing++;
      else if (value === 'Только просмотр') counts.view++;
      else if (value === 'Исключено') counts.excluded++;
      else if (value) counts.other++;
    });
  }
  if (counts.other) throw new Error('Неизвестных статусов предпросмотра: ' + counts.other);
  return {
    level: counts.missing ? 'WARN' : 'INFO',
    message: 'Предпросмотр проверен; готово=' + counts.ready + '; не хватает данных=' + counts.missing + '; запись не выполнялась',
    details: JSON.stringify(counts)
  };
}

function prhValidateStructure_(ss) {
  var errors = [];
  PRH.REQUIRED_SHEETS.forEach(function (name) {
    if (!ss.getSheetByName(name)) errors.push('нет листа ' + name);
  });
  if (!errors.length) {
    try { prhAssertHeaders_(ss.getSheetByName(PRH.SHEETS.COMMANDS), PRH.COMMAND_HEADERS); }
    catch (error) { errors.push(error.message); }
    try { prhAssertHeaders_(ss.getSheetByName(PRH.SHEETS.AUDIT), PRH.AUDIT_HEADERS); }
    catch (error) { errors.push(error.message); }
    try { prhAssertHeaders_(ss.getSheetByName(PRH.SHEETS.OPERATIONS), PRH.OPERATION_HEADERS); }
    catch (error) { errors.push(error.message); }
  }
  return { errors: errors, warnings: [] };
}

function prhAssertAutomationSafety_(settings) {
  if (!prhToBool_(settings.automation_attached)) throw new Error('Сначала выполните «Проверить установку»');
  if (String(settings.automation_mode) !== 'DRY_RUN') throw new Error('Разрешён только режим DRY_RUN');
  if (prhToBool_(settings.automation_write_operations)) throw new Error('Запись в 01 Операции должна быть отключена');
  if (prhToBool_(settings.full_history_migrated)) throw new Error('DEV-пакет не предназначен для полной истории');
}

function prhCommandFromRow_(row, sheetRow) {
  return {
    row: sheetRow,
    id: String(row[0] || '').trim(),
    created: row[1],
    type: String(row[2] || '').trim(),
    targetSheet: String(row[3] || '').trim(),
    targetId: String(row[4] || '').trim(),
    parameter: String(row[5] || '').trim(),
    dryRun: prhToBool_(row[6]),
    confirmed: prhToBool_(row[7]),
    status: String(row[8] || '').trim(),
    result: String(row[9] || ''),
    initiator: String(row[10] || 'Пользователь'),
    processedAt: row[11],
    correlationId: String(row[12] || prhCorrelationId_()),
    comment: String(row[13] || '')
  };
}

function prhFinishCommand_(ss, command, status, message, auditResult, details) {
  var sheet = prhRequireSheet_(ss, PRH.SHEETS.COMMANDS);
  sheet.getRange(command.row, 9, 1, 4).setValues([[status, message, command.initiator, new Date()]]);
  prhAppendAudit_(ss, {
    level: auditResult === 'ERROR' ? 'ERROR' : (auditResult === 'BLOCKED' ? 'WARN' : 'AUDIT'),
    eventType: 'COMMAND_PROCESSED',
    commandId: command.id,
    module: 'Automation',
    object: command.type,
    result: auditResult,
    message: message,
    initiator: command.initiator,
    correlationId: command.correlationId,
    before: command.status,
    after: status,
    details: details || command.parameter
  });
}

function prhReadSettings_(ss) {
  var sheet = prhRequireSheet_(ss, PRH.SHEETS.SETTINGS);
  var lastRow = sheet.getLastRow();
  var values = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 2).getValues() : [];
  var settings = {};
  values.forEach(function (row) {
    var key = String(row[0] || '').trim();
    if (key) settings[key] = row[1];
  });
  return settings;
}

function prhSetSettings_(ss, updates) {
  var sheet = prhRequireSheet_(ss, PRH.SHEETS.SETTINGS);
  var lastRow = sheet.getLastRow();
  var keys = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues() : [];
  Object.keys(updates).forEach(function (key) {
    var found = -1;
    for (var i = 0; i < keys.length; i++) {
      if (keys[i][0] === key) { found = i + 2; break; }
    }
    if (found < 0) throw new Error('Не найдена настройка: ' + key);
    sheet.getRange(found, 2).setValue(updates[key]);
  });
}

function prhAppendAudit_(ss, event) {
  var sheet = prhRequireSheet_(ss, PRH.SHEETS.AUDIT);
  prhAssertHeaders_(sheet, PRH.AUDIT_HEADERS);
  var row = [
    prhEventId_(), new Date(), event.level, event.eventType, event.commandId,
    event.module, event.object, event.result, event.message, event.initiator,
    event.correlationId, event.before, event.after, event.details
  ];
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function prhAssertHeaders_(sheet, expected) {
  var actual = sheet.getRange(1, 1, 1, expected.length).getDisplayValues()[0];
  for (var i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error('Лист «' + sheet.getName() + '»: заголовок ' + (i + 1) +
        ' должен быть «' + expected[i] + '», найдено «' + actual[i] + '»');
    }
  }
}

function prhRequireSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Не найден лист: ' + name);
  return sheet;
}

function prhParseParams_(text) {
  var result = {};
  String(text || '').split(';').forEach(function (part) {
    var pos = part.indexOf('=');
    if (pos < 0) return;
    var key = part.slice(0, pos).trim();
    var value = part.slice(pos + 1).trim();
    if (key) result[key] = value;
  });
  return result;
}

function prhToBool_(value) {
  return value === true || String(value).toUpperCase() === 'TRUE';
}

function prhCorrelationId_() {
  return 'COR-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Moscow', 'yyyyMMdd-HHmmss');
}

function prhEventId_() {
  return 'EVT-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Moscow', 'yyyyMMdd-HHmmss-SSS');
}
