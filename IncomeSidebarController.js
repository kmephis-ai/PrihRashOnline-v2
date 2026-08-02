/**
 * ПрихРасхOnline v2 DEV — Income Sidebar Controller v0.5.0.
 * Read-only with respect to «01 Операции».
 */
var PRH_INCOME_SIDEBAR = Object.freeze({
  VERSION: '0.5.0',
  DASHBOARD: '14 Аналитика',
  OPERATIONS: '01 Операции',
  SETTINGS: '09 Настройки',
  MODE_CELL: 'E3',
  YEAR_CELL: 'A7',
  MONTH_CELL: 'D7',
  CATEGORY_CELL: 'A545',
  MIN_AMOUNT_CELL: 'D545',
  ALLOWED_MODES: Object.freeze(['Обзор','Годы','Месяцы года','Выбранный месяц','Сезонность','Структура','Операции','Прогноз','Качество','Полный дашборд']),
  MONTHS: Object.freeze(['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'])
});

function prhInstallIncomeSidebar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Скрипт должен быть привязан к DEV-книге.');
  var handler = 'prhIncomeSidebarOnOpen_';
  var exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (!exists) ScriptApp.newTrigger(handler).forSpreadsheet(ss).onOpen().create();
  prhIncomeSidebarSetting_('income_dashboard_phase_2', 'READY_DISABLED', 'Income Sidebar Controller v' + PRH_INCOME_SIDEBAR.VERSION + ' installed');
  return {ok:true, triggerCreated:!exists, version:PRH_INCOME_SIDEBAR.VERSION};
}

function prhIncomeSidebarOnOpen_() {
  SpreadsheetApp.getUi().createMenu('Панель доходов')
    .addItem('Открыть панель', 'prhShowIncomeSidebar')
    .addItem('Проверить панель', 'prhValidateIncomeSidebar')
    .addToUi();
}

function prhShowIncomeSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('IncomeSidebar').setTitle('Доходы').setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
  prhIncomeSidebarAudit_('SIDEBAR_OPEN', 'IncomeSidebar', 'OK');
}

function prhGetIncomeSidebarState() {
  var dashboard = prhIncomeSidebarSheet_();
  var operations = prhIncomeSidebarOperations_();
  var lastRow = operations.getLastRow();
  var values = lastRow > 1 ? operations.getRange(2, 3, lastRow - 1, 7).getValues() : [];
  var years = {}, categories = {};
  values.forEach(function(row) {
    var date = row[0], type = row[2], category = String(row[6] || '').trim();
    if (type !== 'Доход') return;
    if (date instanceof Date) years[date.getFullYear()] = true;
    if (category) categories[category] = true;
  });
  return {
    version: PRH_INCOME_SIDEBAR.VERSION,
    mode: String(dashboard.getRange(PRH_INCOME_SIDEBAR.MODE_CELL).getDisplayValue() || 'Обзор'),
    year: Number(dashboard.getRange(PRH_INCOME_SIDEBAR.YEAR_CELL).getValue()) || '',
    month: String(dashboard.getRange(PRH_INCOME_SIDEBAR.MONTH_CELL).getDisplayValue() || ''),
    category: String(dashboard.getRange(PRH_INCOME_SIDEBAR.CATEGORY_CELL).getDisplayValue() || 'Все'),
    minAmount: Number(dashboard.getRange(PRH_INCOME_SIDEBAR.MIN_AMOUNT_CELL).getValue()) || 0,
    modes: PRH_INCOME_SIDEBAR.ALLOWED_MODES.slice(),
    months: PRH_INCOME_SIDEBAR.MONTHS.slice(),
    years: Object.keys(years).map(Number).sort(function(a,b){return b-a;}),
    categories: ['Все'].concat(Object.keys(categories).sort())
  };
}

function prhApplyIncomeSidebarFilters(payload) {
  payload = payload || {};
  var mode = String(payload.mode || 'Обзор').trim();
  var year = Number(payload.year);
  var month = String(payload.month || '').trim();
  var category = String(payload.category || 'Все').trim();
  var minAmount = Number(payload.minAmount || 0);
  if (PRH_INCOME_SIDEBAR.ALLOWED_MODES.indexOf(mode) < 0) throw new Error('Недопустимый режим.');
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Недопустимый год.');
  if (PRH_INCOME_SIDEBAR.MONTHS.indexOf(month) < 0) throw new Error('Недопустимый месяц.');
  if (!isFinite(minAmount) || minAmount < 0) throw new Error('Минимальная сумма должна быть неотрицательной.');
  var state = prhGetIncomeSidebarState();
  if (state.categories.indexOf(category) < 0) throw new Error('Категория отсутствует в доходных операциях.');
  var dashboard = prhIncomeSidebarSheet_();
  dashboard.getRange(PRH_INCOME_SIDEBAR.MODE_CELL).setValue(mode);
  dashboard.getRange(PRH_INCOME_SIDEBAR.YEAR_CELL).setValue(year);
  dashboard.getRange(PRH_INCOME_SIDEBAR.MONTH_CELL).setValue(month);
  dashboard.getRange(PRH_INCOME_SIDEBAR.CATEGORY_CELL).setValue(category);
  dashboard.getRange(PRH_INCOME_SIDEBAR.MIN_AMOUNT_CELL).setValue(minAmount);
  if (typeof prhApplyIncomeDashboardMode_ === 'function') prhApplyIncomeDashboardMode_(mode);
  SpreadsheetApp.flush();
  prhIncomeSidebarAudit_('SIDEBAR_APPLY', mode, 'OK');
  return prhGetIncomeSidebarState();
}

function prhIncomeSidebarLatestPeriod() {
  if (typeof prhIncomeSetLatestPeriod !== 'function') throw new Error('DashboardController.js не установлен.');
  prhIncomeSetLatestPeriod();
  return prhGetIncomeSidebarState();
}
function prhIncomeSidebarReset() {
  if (typeof prhIncomeResetFilters !== 'function') throw new Error('DashboardController.js не установлен.');
  prhIncomeResetFilters();
  return prhGetIncomeSidebarState();
}
function prhIncomeSidebarOpenProblems() {
  if (typeof prhIncomeShowReviewRows !== 'function') throw new Error('DashboardController.js не установлен.');
  prhIncomeShowReviewRows();
  return {ok:true};
}
function prhValidateIncomeSidebar() {
  var errors = [];
  try { prhIncomeSidebarSheet_(); } catch (error) { errors.push(error.message); }
  try { prhIncomeSidebarOperations_(); } catch (error) { errors.push(error.message); }
  if (typeof prhApplyIncomeDashboardMode_ !== 'function') errors.push('DashboardController.js не установлен');
  var message = errors.length ? errors.join('\n') : 'Панель готова. Запись в «01 Операции» отсутствует.';
  SpreadsheetApp.getUi().alert('Проверка панели доходов', message, SpreadsheetApp.getUi().ButtonSet.OK);
  prhIncomeSidebarAudit_('SIDEBAR_VALIDATE', 'IncomeSidebar', errors.length ? 'ERROR' : 'OK');
  return {ok:errors.length===0, errors:errors};
}
function prhIncomeSidebarSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRH_INCOME_SIDEBAR.DASHBOARD);
  if (!sheet) throw new Error('Лист «14 Аналитика» не найден.');
  return sheet;
}
function prhIncomeSidebarOperations_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRH_INCOME_SIDEBAR.OPERATIONS);
  if (!sheet) throw new Error('Лист «01 Операции» не найден.');
  return sheet;
}
function prhIncomeSidebarSetting_(key,value,description) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRH_INCOME_SIDEBAR.SETTINGS);
  if (!sheet) return;
  var rows = sheet.getRange(1,1,Math.max(sheet.getLastRow(),1),3).getValues();
  var index = rows.findIndex(function(row){return row[0]===key;});
  if (index >= 0) sheet.getRange(index+1,2,1,2).setValues([[value,description]]); else sheet.appendRow([key,value,description]);
}
function prhIncomeSidebarAudit_(type,target,result) {
  try {
    if (typeof prhAppendAudit_ === 'function') prhAppendAudit_(SpreadsheetApp.getActiveSpreadsheet(), {level:'AUDIT',eventType:type,module:'IncomeSidebar',object:target,result:result,message:'Без изменения финансовых операций',details:'controller='+PRH_INCOME_SIDEBAR.VERSION});
  } catch (error) { console.warn('Sidebar audit skipped: '+error.message); }
}
