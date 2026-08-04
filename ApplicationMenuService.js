/**
 * ApplicationMenuService v2.0.1
 * Single UI entry point for ПрихРасхOnline.
 */
const PRH_APPLICATION_MENU = Object.freeze({
  VERSION: '2.0.1', DASHBOARD: '14 Аналитика', YEAR_CELL: 'A7', MONTH_CELL: 'D7',
  CATEGORY_CELL: 'A545', MIN_AMOUNT_CELL: 'D545',
  MONTHS: Object.freeze(['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'])
});

function onOpen(e) {
  prhBuildApplicationMenu();
  try {
    if (typeof prhRestoreDashboardShell === 'function') prhRestoreDashboardShell();
    if (typeof prhEnsureCriticalChartSources === 'function') prhEnsureCriticalChartSources();
  } catch (error) {
    console.error('Dashboard lifecycle failed: ' + error.message);
  }
}

function onEdit(e) {
  if (typeof prhHandleDashboardModeEdit === 'function') prhHandleDashboardModeEdit(e);
  if (typeof prhHandleDashboardShellEdit === 'function') prhHandleDashboardShellEdit(e);
}

function prhBuildApplicationMenu() {
  const ui = SpreadsheetApp.getUi();
  const dashboardMenu = ui.createMenu('Дашборд')
    .addItem('Обзор','prhDashboardOverview').addItem('По годам','prhDashboardYears')
    .addItem('По месяцам года','prhDashboardYearMonths').addItem('Выбранный месяц','prhDashboardSelectedMonth')
    .addSeparator().addItem('Структура и стабильность','prhDashboardStructure')
    .addItem('Операции','prhDashboardOperations').addItem('Прогноз','prhDashboardForecast')
    .addItem('Качество данных','prhDashboardQuality').addSeparator().addItem('Полный дашборд','prhDashboardFull');
  const actionsMenu = ui.createMenu('Действия')
    .addItem('Обновить дашборд','prhRefreshIncomeDashboard').addItem('Текущий год','prhSetDashboardCurrentYear')
    .addItem('Текущий месяц','prhSetDashboardCurrentMonth').addItem('Сбросить фильтры','prhResetDashboardFilters')
    .addSeparator().addItem('Открыть операции периода','prhOpenDashboardPeriodOperations')
    .addItem('Проверить качество данных','prhOpenDashboardQuality');
  const exportMenu = ui.createMenu('Экспорт').addItem('Создать PDF','prhMenuCreatePdf').addItem('Сделать снимок показателей','prhMenuCreateSnapshot');
  const settingsMenu = ui.createMenu('Настройки').addItem('Открыть боковую панель','prhMenuOpenSidebar')
    .addSeparator().addItem('Установить Dashboard Shell 2.0','prhInstallDashboardShell')
    .addItem('Обновить оболочку','prhRefreshDashboardShell')
    .addItem('Восстановить диаграммы обзора','prhEnsureCriticalChartSources')
    .addItem('Проверить структуру дашборда','prhValidateDashboardApplication');
  ui.createMenu('ПрихРасхOnline').addSubMenu(dashboardMenu).addSubMenu(actionsMenu).addSubMenu(exportMenu).addSubMenu(settingsMenu).addToUi();
  return { status:'MENU_READY', version:PRH_APPLICATION_MENU.VERSION };
}

function prhRefreshIncomeDashboard() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) throw new Error('Дашборд занят другим действием.');
  try {
    SpreadsheetApp.flush();
    const checks = {};
    if (typeof prhValidateDashboardModes === 'function') checks.modes = prhValidateDashboardModes();
    if (typeof prhValidateDashboardUxStructure_ === 'function' && typeof prhDashboardUxSheet_ === 'function') checks.ux = prhValidateDashboardUxStructure_(prhDashboardUxSheet_());
    if (typeof prhRefreshDashboardShell === 'function') checks.shell = prhRefreshDashboardShell();
    if (typeof prhEnsureCriticalChartSources === 'function') checks.charts = prhEnsureCriticalChartSources();
    SpreadsheetApp.getActive().toast('Расчёты, оболочка и диаграммы обновлены','ПрихРасхOnline',4);
    return { status:'REFRESHED', checks:checks };
  } finally { lock.releaseLock(); }
}

function prhSetDashboardCurrentYear() {
  const year = Number(Utilities.formatDate(new Date(),SpreadsheetApp.getActive().getSpreadsheetTimeZone(),'yyyy'));
  const sheet = prhApplicationDashboard_(); prhSetValidatedControl_(sheet.getRange(PRH_APPLICATION_MENU.YEAR_CELL),year,'год'); SpreadsheetApp.flush();
  return { status:'DEV_APPLIED', year:year };
}
function prhSetDashboardCurrentMonth() {
  const index = Number(Utilities.formatDate(new Date(),SpreadsheetApp.getActive().getSpreadsheetTimeZone(),'M'))-1;
  const month = PRH_APPLICATION_MENU.MONTHS[index]; const sheet = prhApplicationDashboard_();
  prhSetValidatedControl_(sheet.getRange(PRH_APPLICATION_MENU.MONTH_CELL),month,'месяц'); SpreadsheetApp.flush();
  return { status:'DEV_APPLIED', month:month };
}
function prhResetDashboardFilters() {
  const sheet = prhApplicationDashboard_(); prhSetValidatedControl_(sheet.getRange(PRH_APPLICATION_MENU.CATEGORY_CELL),'Все','категория');
  sheet.getRange(PRH_APPLICATION_MENU.MIN_AMOUNT_CELL).setValue(0); if (typeof prhDashboardFull === 'function') prhDashboardFull(); SpreadsheetApp.flush();
  return { status:'DEV_APPLIED', category:'Все', minAmount:0, mode:'Полный дашборд' };
}
function prhOpenDashboardPeriodOperations(){ if(typeof prhDashboardOperations!=='function') throw new Error('DashboardModeService.js не установлен.'); return prhDashboardOperations(); }
function prhOpenDashboardQuality(){ if(typeof prhDashboardQuality!=='function') throw new Error('DashboardModeService.js не установлен.'); return prhDashboardQuality(); }
function prhMenuOpenSidebar(){ if(typeof prhShowIncomeSidebar!=='function') return prhFeaturePending_('Боковая панель','IncomeSidebar.html и контроллер ещё не развёрнуты.'); return prhShowIncomeSidebar(); }
function prhMenuCreatePdf(){ if(typeof prhCreateIncomeDashboardPdf!=='function') return prhFeaturePending_('Экспорт PDF','Модуль экспорта будет подключён позже.'); return prhCreateIncomeDashboardPdf(); }
function prhMenuCreateSnapshot(){ if(typeof prhCreateIncomeDashboardSnapshot!=='function') return prhFeaturePending_('Снимок показателей','Модуль снимков будет подключён позже.'); return prhCreateIncomeDashboardSnapshot(); }
function prhValidateDashboardApplication(){
  const results={}; if(typeof prhValidateDashboardModes==='function') results.modes=prhValidateDashboardModes(); else throw new Error('DashboardModeService.js не установлен.');
  if(typeof prhValidateDashboardShell_==='function') results.shell=prhValidateDashboardShell_(prhApplicationDashboard_()); else throw new Error('DashboardShellService.js не установлен.');
  if(typeof prhEnsureCriticalChartSources==='function') results.charts=prhEnsureCriticalChartSources();
  const count=prhApplicationDashboard_().getCharts().length; if(count!==20) throw new Error('Ожидалось 20 диаграмм, найдено: '+count); results.chartCount=count;
  SpreadsheetApp.getUi().alert('Проверка дашборда','Shell корректен: 10 вкладок, 9 режимов, 13 разделов, 20 диаграмм. Финансовые операции не изменяются.',SpreadsheetApp.getUi().ButtonSet.OK);
  return { status:'VALID', version:PRH_APPLICATION_MENU.VERSION, results:results };
}
function prhSetValidatedControl_(range,value,label){ const rule=range.getDataValidation(); if(rule&&rule.getCriteriaType()===SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST){ const allowed=rule.getCriteriaValues()[0].map(String); if(allowed.indexOf(String(value))<0) throw new Error('Текущий '+label+' отсутствует в разрешённом списке: '+value); } range.setValue(value); }
function prhFeaturePending_(title,message){ SpreadsheetApp.getUi().alert(title,message,SpreadsheetApp.getUi().ButtonSet.OK); return { status:'PENDING', feature:title, message:message }; }
function prhApplicationDashboard_(){ const sheet=SpreadsheetApp.getActive().getSheetByName(PRH_APPLICATION_MENU.DASHBOARD); if(!sheet) throw new Error('Лист «14 Аналитика» не найден.'); return sheet; }
