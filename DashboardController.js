/**
 * ПрихРасхOnline v2 DEV — Income Dashboard Controller v0.2.1
 *
 * Safety contract:
 * - never writes values to sheet "01 Операции";
 * - only changes dashboard filters, row visibility, sheet filter criteria and active selection;
 * - preserves the existing Foundation onOpen() and dry-run command flow.
 */

var PRH_INCOME_DASHBOARD = Object.freeze({
  VERSION: '0.2.1',
  MENU: 'Доходы',
  SHEET: '14 Аналитика',
  OPERATIONS: '01 Операции',
  SETTINGS: '09 Настройки',
  MODE_CELL: 'E3',
  YEAR_CELL: 'A7',
  MONTH_CELL: 'D7',
  CATEGORY_CELL: 'A545',
  MIN_AMOUNT_CELL: 'D545',
  DETAIL_RANGE: 'A541',
  STATUS_COLUMN: 19,
  REVIEW_STATUSES: Object.freeze(['Требует проверки', 'Возможный дубль']),
  MODES: Object.freeze({
    'Обзор': { row: 10, groups: ['overview'] },
    'Годы': { row: 10, groups: ['years'] },
    'Месяцы года': { row: 26, groups: ['months'] },
    'Выбранный месяц': { row: 53, groups: ['selectedMonth'] },
    'Сезонность': { row: 220, groups: ['seasonality'] },
    'Структура': { row: 289, groups: ['structure'] },
    'Операции': { row: 322, groups: ['operations', 'drilldown'] },
    'Прогноз': { row: 401, groups: ['forecast'] },
    'Качество': { row: 382, groups: ['quality'] },
    'Полный дашборд': { row: 10, groups: ['all'] }
  }),
  GROUPS: Object.freeze({
    overview: [[10, 72]],
    years: [[10, 24]],
    months: [[26, 51]],
    selectedMonth: [[53, 80]],
    seasonality: [[220, 286]],
    structure: [[289, 320]],
    operations: [[322, 380]],
    quality: [[382, 399]],
    forecast: [[401, 459]],
    drilldown: [[541, 690]]
  })
});

function prhInstallIncomeDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'prhIncomeDashboardOnOpen_';
  });
  if (!exists) ScriptApp.newTrigger('prhIncomeDashboardOnOpen_').forSpreadsheet(ss).onOpen().create();
  prhIncomeDashboardOnOpen_();
  prhUpdateIncomeDashboardSettings_('READY', 'Income Dashboard Controller v' + PRH_INCOME_DASHBOARD.VERSION + ' установлен');
  SpreadsheetApp.getUi().alert('Дашборд доходов подключён', 'Меню «Доходы» установлено. Финансовые операции не изменялись.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function prhIncomeDashboardOnOpen_() {
  var ui = SpreadsheetApp.getUi();
  var modeMenu = ui.createMenu('Режим');
  Object.keys(PRH_INCOME_DASHBOARD.MODES).forEach(function (mode) {
    modeMenu.addItem(mode, prhModeHandlerName_(mode));
  });
  ui.createMenu(PRH_INCOME_DASHBOARD.MENU)
    .addSubMenu(modeMenu)
    .addSeparator()
    .addItem('Последний месяц с доходами', 'prhIncomeSetLatestPeriod')
    .addItem('Текущий календарный месяц', 'prhIncomeSetCurrentPeriod')
    .addItem('Сбросить фильтры дашборда', 'prhIncomeResetFilters')
    .addSeparator()
    .addItem('Открыть детализацию месяца', 'prhIncomeOpenDrilldown')
    .addItem('Показать проблемные операции', 'prhIncomeShowReviewRows')
    .addItem('Снять фильтр проблемных операций', 'prhIncomeClearReviewFilter')
    .addSeparator()
    .addItem('Обновить расчёты', 'prhIncomeRefreshDashboard')
    .addItem('Проверить конфигурацию', 'prhIncomeValidateDashboard')
    .addToUi();
}

function prhModeHandlerName_(mode) {
  return {
    'Обзор': 'prhIncomeModeOverview',
    'Годы': 'prhIncomeModeYears',
    'Месяцы года': 'prhIncomeModeMonths',
    'Выбранный месяц': 'prhIncomeModeSelectedMonth',
    'Сезонность': 'prhIncomeModeSeasonality',
    'Структура': 'prhIncomeModeStructure',
    'Операции': 'prhIncomeModeOperations',
    'Прогноз': 'prhIncomeModeForecast',
    'Качество': 'prhIncomeModeQuality',
    'Полный дашборд': 'prhIncomeModeFull'
  }[mode];
}

function prhIncomeModeOverview() { prhApplyIncomeDashboardMode_('Обзор'); }
function prhIncomeModeYears() { prhApplyIncomeDashboardMode_('Годы'); }
function prhIncomeModeMonths() { prhApplyIncomeDashboardMode_('Месяцы года'); }
function prhIncomeModeSelectedMonth() { prhApplyIncomeDashboardMode_('Выбранный месяц'); }
function prhIncomeModeSeasonality() { prhApplyIncomeDashboardMode_('Сезонность'); }
function prhIncomeModeStructure() { prhApplyIncomeDashboardMode_('Структура'); }
function prhIncomeModeOperations() { prhApplyIncomeDashboardMode_('Операции'); }
function prhIncomeModeForecast() { prhApplyIncomeDashboardMode_('Прогноз'); }
function prhIncomeModeQuality() { prhApplyIncomeDashboardMode_('Качество'); }
function prhIncomeModeFull() { prhApplyIncomeDashboardMode_('Полный дашборд'); }

function prhApplyIncomeDashboardMode_(mode) {
  var config = PRH_INCOME_DASHBOARD.MODES[mode];
  if (!config) throw new Error('Неизвестный режим дашборда: ' + mode);
  var sheet = prhIncomeDashboardSheet_();
  sheet.getRange(PRH_INCOME_DASHBOARD.MODE_CELL).setValue(mode);
  prhSetIncomeDashboardVisibility_(sheet, config.groups);
  sheet.activate();
  sheet.getRange(config.row, 1).activate();
  SpreadsheetApp.flush();
  prhAuditIncomeDashboard_('DASHBOARD_MODE', mode, 'OK');
}

function prhSetIncomeDashboardVisibility_(sheet, selectedGroups) {
  var allRanges = [];
  Object.keys(PRH_INCOME_DASHBOARD.GROUPS).forEach(function (name) {
    PRH_INCOME_DASHBOARD.GROUPS[name].forEach(function (range) { allRanges.push(range); });
  });
  allRanges.forEach(function (range) { sheet.hideRows(range[0], range[1] - range[0] + 1); });
  if (selectedGroups.indexOf('all') >= 0) {
    allRanges.forEach(function (range) { sheet.showRows(range[0], range[1] - range[0] + 1); });
    return;
  }
  selectedGroups.forEach(function (name) {
    (PRH_INCOME_DASHBOARD.GROUPS[name] || []).forEach(function (range) {
      sheet.showRows(range[0], range[1] - range[0] + 1);
    });
  });
}

function prhIncomeSetLatestPeriod() {
  var operations = prhIncomeOperationsSheet_();
  var lastRow = operations.getLastRow();
  if (lastRow < 2) throw new Error('Доходные операции отсутствуют.');
  var values = operations.getRange(2, 3, lastRow - 1, 3).getValues();
  var latest = null;
  values.forEach(function (row) {
    if (row[2] === 'Доход' && row[0] instanceof Date && (!latest || row[0] > latest)) latest = row[0];
  });
  if (!latest) throw new Error('Не найдены датированные доходные операции.');
  prhSetIncomePeriod_(latest);
}

function prhIncomeSetCurrentPeriod() { prhSetIncomePeriod_(new Date()); }

function prhSetIncomePeriod_(date) {
  var sheet = prhIncomeDashboardSheet_();
  var monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  sheet.getRange(PRH_INCOME_DASHBOARD.YEAR_CELL).setValue(date.getFullYear());
  sheet.getRange(PRH_INCOME_DASHBOARD.MONTH_CELL).setValue(monthNames[date.getMonth()]);
  sheet.getRange(PRH_INCOME_DASHBOARD.CATEGORY_CELL).setValue('Все');
  sheet.getRange(PRH_INCOME_DASHBOARD.MIN_AMOUNT_CELL).setValue(0);
  SpreadsheetApp.flush();
  sheet.activate();
  sheet.getRange('A1').activate();
  prhAuditIncomeDashboard_('DASHBOARD_PERIOD', Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM'), 'OK');
}

function prhIncomeResetFilters() {
  var sheet = prhIncomeDashboardSheet_();
  sheet.getRange(PRH_INCOME_DASHBOARD.CATEGORY_CELL).setValue('Все');
  sheet.getRange(PRH_INCOME_DASHBOARD.MIN_AMOUNT_CELL).setValue(0);
  sheet.getRange(PRH_INCOME_DASHBOARD.MODE_CELL).setValue('Обзор');
  prhSetIncomeDashboardVisibility_(sheet, ['overview']);
  SpreadsheetApp.flush();
  sheet.activate();
  sheet.getRange('A1').activate();
  prhAuditIncomeDashboard_('DASHBOARD_FILTERS_RESET', 'Доходы', 'OK');
}

function prhIncomeOpenDrilldown() {
  var sheet = prhIncomeDashboardSheet_();
  prhSetIncomeDashboardVisibility_(sheet, ['operations', 'drilldown']);
  sheet.getRange(PRH_INCOME_DASHBOARD.MODE_CELL).setValue('Операции');
  sheet.activate();
  sheet.getRange(PRH_INCOME_DASHBOARD.DETAIL_RANGE).activate();
}

function prhIncomeShowReviewRows() {
  var sheet = prhIncomeOperationsSheet_();
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2) throw new Error('На листе «01 Операции» нет данных.');
  var filter = sheet.getFilter();
  if (!filter) filter = sheet.getRange(1, 1, lastRow, lastColumn).createFilter();
  var statuses = sheet.getRange(2, PRH_INCOME_DASHBOARD.STATUS_COLUMN, lastRow - 1, 1).getDisplayValues();
  var hiddenStatuses = [];
  statuses.forEach(function (row) {
    var status = String(row[0] || '').trim();
    if (PRH_INCOME_DASHBOARD.REVIEW_STATUSES.indexOf(status) < 0 && hiddenStatuses.indexOf(status) < 0) {
      hiddenStatuses.push(status);
    }
  });
  var criteria = SpreadsheetApp.newFilterCriteria()
    .setHiddenValues(hiddenStatuses)
    .build();
  filter.setColumnFilterCriteria(PRH_INCOME_DASHBOARD.STATUS_COLUMN, criteria);
  var count = statuses.reduce(function (sum, row) {
    return sum + (PRH_INCOME_DASHBOARD.REVIEW_STATUSES.indexOf(row[0]) >= 0 ? 1 : 0);
  }, 0);
  sheet.activate();
  sheet.getRange('A1').activate();
  SpreadsheetApp.flush();
  SpreadsheetApp.getActive().toast('Показано проблемных операций: ' + count, 'Доходы', 6);
  prhAuditIncomeDashboard_('OPERATIONS_REVIEW_FILTER', count + ' записей', 'OK');
}

function prhIncomeClearReviewFilter() {
  var sheet = prhIncomeOperationsSheet_();
  var filter = sheet.getFilter();
  if (filter) filter.removeColumnFilterCriteria(PRH_INCOME_DASHBOARD.STATUS_COLUMN);
  sheet.activate();
  sheet.getRange('A1').activate();
  SpreadsheetApp.flush();
  SpreadsheetApp.getActive().toast('Фильтр проблемных операций снят', 'Доходы', 4);
  prhAuditIncomeDashboard_('OPERATIONS_REVIEW_FILTER_CLEAR', 'Статус', 'OK');
}

function prhIncomeRefreshDashboard() {
  SpreadsheetApp.flush();
  Utilities.sleep(300);
  SpreadsheetApp.flush();
  prhAuditIncomeDashboard_('DASHBOARD_REFRESH', '14 Аналитика', 'OK');
  SpreadsheetApp.getActive().toast('Расчёты дашборда обновлены', 'Доходы', 4);
}

function prhIncomeValidateDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var errors = [];
  var dashboard = ss.getSheetByName(PRH_INCOME_DASHBOARD.SHEET);
  var operations = ss.getSheetByName(PRH_INCOME_DASHBOARD.OPERATIONS);
  if (!dashboard) errors.push('нет листа «14 Аналитика»');
  if (!operations) errors.push('нет листа «01 Операции»');
  if (dashboard) {
    [PRH_INCOME_DASHBOARD.MODE_CELL, PRH_INCOME_DASHBOARD.YEAR_CELL, PRH_INCOME_DASHBOARD.MONTH_CELL, PRH_INCOME_DASHBOARD.CATEGORY_CELL, PRH_INCOME_DASHBOARD.MIN_AMOUNT_CELL].forEach(function (a1) {
      try { dashboard.getRange(a1); } catch (error) { errors.push('нет диапазона ' + a1); }
    });
  }
  if (operations && operations.getLastColumn() < PRH_INCOME_DASHBOARD.STATUS_COLUMN) errors.push('нет столбца «Статус»');
  var message = errors.length ? errors.join('\n') : 'Конфигурация корректна. Запись в «01 Операции» не выполняется.';
  prhAuditIncomeDashboard_('DASHBOARD_VALIDATE', PRH_INCOME_DASHBOARD.SHEET, errors.length ? 'ERROR' : 'OK');
  SpreadsheetApp.getUi().alert('Проверка дашборда', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function prhIncomeDashboardSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRH_INCOME_DASHBOARD.SHEET);
  if (!sheet) throw new Error('Лист «14 Аналитика» не найден.');
  return sheet;
}

function prhIncomeOperationsSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRH_INCOME_DASHBOARD.OPERATIONS);
  if (!sheet) throw new Error('Лист «01 Операции» не найден.');
  return sheet;
}

function prhAuditIncomeDashboard_(type, target, result) {
  try {
    if (typeof prhAppendAudit_ === 'function') {
      prhAppendAudit_(SpreadsheetApp.getActiveSpreadsheet(), {
        level: 'AUDIT', eventType: type, commandId: '', module: 'IncomeDashboard', object: target,
        result: result, message: 'Действие выполнено без изменения финансовых операций', initiator: 'Пользователь',
        correlationId: typeof prhCorrelationId_ === 'function' ? prhCorrelationId_() : '', before: '', after: '',
        details: 'controller=' + PRH_INCOME_DASHBOARD.VERSION
      });
    }
  } catch (error) { console.warn('Audit skipped: ' + error.message); }
}

function prhUpdateIncomeDashboardSettings_(status, description) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRH_INCOME_DASHBOARD.SETTINGS);
    if (!sheet) return;
    var values = sheet.getRange(1, 1, sheet.getLastRow(), 3).getValues();
    var keys = {
      income_dashboard_phase_1_2: [status, description],
      income_dashboard_phase_1_4: ['READY', 'Фильтр проблемных операций подключён'],
      income_dashboard_script_version: [PRH_INCOME_DASHBOARD.VERSION, 'Версия контроллера дашборда доходов']
    };
    Object.keys(keys).forEach(function (key) {
      var row = values.findIndex(function (item) { return item[0] === key; });
      if (row >= 0) sheet.getRange(row + 1, 2, 1, 2).setValues([[keys[key][0], keys[key][1]]]);
      else sheet.appendRow([key, keys[key][0], keys[key][1]]);
    });
  } catch (error) { console.warn('Settings update skipped: ' + error.message); }
}
