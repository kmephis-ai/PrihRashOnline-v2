/**
 * IncomeSidebarController v0.6.0
 *
 * Modern control panel for the income dashboard. Reads `01 Операции` only to
 * build available years/categories and determine the latest dated period.
 * Writes are limited to dashboard control cells.
 */
const PRH_INCOME_SIDEBAR = Object.freeze({
  VERSION: '0.6.0',
  DASHBOARD: '14 Аналитика',
  OPERATIONS: '01 Операции',
  MODE_CELL: 'E3',
  YEAR_CELL: 'A7',
  MONTH_CELL: 'D7',
  CATEGORY_CELL: 'A545',
  MIN_AMOUNT_CELL: 'D545',
  MONTHS: Object.freeze([
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]),
  FALLBACK_MODES: Object.freeze([
    'Обзор', 'По годам', 'По месяцам года', 'Выбранный месяц',
    'Структура и стабильность', 'Операции', 'Прогноз',
    'Качество данных', 'Полный дашборд'
  ])
});

function prhShowIncomeSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('IncomeSidebar')
    .setTitle('Дашборд доходов')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
  prhIncomeSidebarAudit_('SIDEBAR_OPEN', 'IncomeSidebar', 'OK');
}

function prhGetIncomeSidebarState() {
  const dashboard = prhIncomeSidebarDashboard_();
  const source = prhReadIncomeSidebarSource_();
  const month = String(dashboard.getRange(PRH_INCOME_SIDEBAR.MONTH_CELL).getDisplayValue() || '');
  const monthIndex = Math.max(PRH_INCOME_SIDEBAR.MONTHS.indexOf(month), 0);
  const stabilityRow = 269 + monthIndex;

  return {
    version: PRH_INCOME_SIDEBAR.VERSION,
    mode: String(dashboard.getRange(PRH_INCOME_SIDEBAR.MODE_CELL).getDisplayValue() || 'Полный дашборд'),
    year: Number(dashboard.getRange(PRH_INCOME_SIDEBAR.YEAR_CELL).getValue()) || '',
    month: month,
    category: String(dashboard.getRange(PRH_INCOME_SIDEBAR.CATEGORY_CELL).getDisplayValue() || 'Все'),
    minAmount: Number(dashboard.getRange(PRH_INCOME_SIDEBAR.MIN_AMOUNT_CELL).getValue()) || 0,
    modes: typeof prhGetDashboardModes === 'function'
      ? prhGetDashboardModes()
      : PRH_INCOME_SIDEBAR.FALLBACK_MODES.slice(),
    months: PRH_INCOME_SIDEBAR.MONTHS.slice(),
    years: source.years,
    categories: source.categories,
    latestPeriod: source.latestPeriod,
    summary: {
      yearIncome: dashboard.getRange('A28').getDisplayValue(),
      monthIncome: dashboard.getRange('A56').getDisplayValue(),
      monthChange: dashboard.getRange('D56').getDisplayValue(),
      operationCount: dashboard.getRange('A62').getDisplayValue(),
      averageOperation: dashboard.getRange('D62').getDisplayValue(),
      specialIncome: dashboard.getRange('D68').getDisplayValue(),
      baseIncome: dashboard.getRange(stabilityRow, 4).getDisplayValue(),
      stabilityIndex: dashboard.getRange('G284').getDisplayValue(),
      qualityIndex: dashboard.getRange('E397').getDisplayValue()
    }
  };
}

function prhApplyIncomeSidebarFilters(payload) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) throw new Error('Панель занята другим действием.');
  try {
    const state = prhGetIncomeSidebarState();
    const filters = prhValidateIncomeSidebarPayload_(payload, state);
    const dashboard = prhIncomeSidebarDashboard_();

    prhSetIncomeSidebarControl_(dashboard.getRange(PRH_INCOME_SIDEBAR.YEAR_CELL), filters.year, 'год');
    prhSetIncomeSidebarControl_(dashboard.getRange(PRH_INCOME_SIDEBAR.MONTH_CELL), filters.month, 'месяц');
    prhSetIncomeSidebarControl_(dashboard.getRange(PRH_INCOME_SIDEBAR.CATEGORY_CELL), filters.category, 'категория');
    dashboard.getRange(PRH_INCOME_SIDEBAR.MIN_AMOUNT_CELL).setValue(filters.minAmount);

    if (typeof prhApplyDashboardMode !== 'function') {
      throw new Error('DashboardModeService.js не установлен.');
    }
    prhApplyDashboardMode(filters.mode);
    SpreadsheetApp.flush();
    prhIncomeSidebarAudit_('SIDEBAR_APPLY', filters.mode, 'OK');
    return prhGetIncomeSidebarState();
  } finally {
    lock.releaseLock();
  }
}

function prhIncomeSidebarLatestPeriod() {
  const state = prhGetIncomeSidebarState();
  if (!state.latestPeriod) throw new Error('Не найден последний датированный доход.');
  const dashboard = prhIncomeSidebarDashboard_();
  prhSetIncomeSidebarControl_(dashboard.getRange(PRH_INCOME_SIDEBAR.YEAR_CELL), state.latestPeriod.year, 'год');
  prhSetIncomeSidebarControl_(dashboard.getRange(PRH_INCOME_SIDEBAR.MONTH_CELL), state.latestPeriod.month, 'месяц');
  if (typeof prhDashboardSelectedMonth === 'function') prhDashboardSelectedMonth();
  SpreadsheetApp.flush();
  prhIncomeSidebarAudit_('SIDEBAR_LATEST_PERIOD', state.latestPeriod.year + ' ' + state.latestPeriod.month, 'OK');
  return prhGetIncomeSidebarState();
}

function prhIncomeSidebarReset() {
  if (typeof prhResetDashboardFilters === 'function') {
    prhResetDashboardFilters();
  } else {
    const dashboard = prhIncomeSidebarDashboard_();
    prhSetIncomeSidebarControl_(dashboard.getRange(PRH_INCOME_SIDEBAR.CATEGORY_CELL), 'Все', 'категория');
    dashboard.getRange(PRH_INCOME_SIDEBAR.MIN_AMOUNT_CELL).setValue(0);
    if (typeof prhDashboardFull === 'function') prhDashboardFull();
  }
  SpreadsheetApp.flush();
  prhIncomeSidebarAudit_('SIDEBAR_RESET', 'Dashboard controls', 'OK');
  return prhGetIncomeSidebarState();
}

function prhIncomeSidebarOpenOperations() {
  if (typeof prhDashboardOperations !== 'function') {
    throw new Error('DashboardModeService.js не установлен.');
  }
  prhDashboardOperations();
  prhIncomeSidebarDashboard_().getRange('A541').activate();
  return { status: 'OPENED', target: 'DETAILS' };
}

function prhIncomeSidebarOpenProblems() {
  if (typeof prhDashboardQuality !== 'function') {
    throw new Error('DashboardModeService.js не установлен.');
  }
  prhDashboardQuality();
  prhIncomeSidebarDashboard_().getRange('A385').activate();
  return { status: 'OPENED', target: 'QUALITY' };
}

function prhIncomeSidebarRefresh() {
  if (typeof prhRefreshIncomeDashboard !== 'function') {
    SpreadsheetApp.flush();
    return prhGetIncomeSidebarState();
  }
  prhRefreshIncomeDashboard();
  return prhGetIncomeSidebarState();
}

function prhValidateIncomeSidebar() {
  const errors = [];
  let state = null;
  try { state = prhGetIncomeSidebarState(); } catch (error) { errors.push(error.message); }
  if (typeof prhApplyDashboardMode !== 'function') errors.push('DashboardModeService.js не установлен');
  if (state && state.modes.length !== 9) errors.push('ожидалось 9 режимов');
  if (state && !state.years.length) errors.push('нет датированных доходных операций');

  const message = errors.length
    ? errors.join('\n')
    : 'Панель готова: 9 режимов, период и фильтры доступны. Запись в «01 Операции» отсутствует.';
  SpreadsheetApp.getUi().alert('Проверка панели доходов', message, SpreadsheetApp.getUi().ButtonSet.OK);
  prhIncomeSidebarAudit_('SIDEBAR_VALIDATE', 'IncomeSidebar', errors.length ? 'ERROR' : 'OK');
  return { ok: errors.length === 0, errors: errors };
}

function prhValidateIncomeSidebarPayload_(payload, state) {
  payload = payload || {};
  const normalized = {
    mode: String(payload.mode || 'Полный дашборд').trim(),
    year: Number(payload.year),
    month: String(payload.month || '').trim(),
    category: String(payload.category || 'Все').trim(),
    minAmount: Number(payload.minAmount || 0)
  };

  if (state.modes.indexOf(normalized.mode) < 0) throw new Error('Недопустимый режим.');
  if (!Number.isInteger(normalized.year) || state.years.indexOf(normalized.year) < 0) {
    throw new Error('Год отсутствует в доходных операциях.');
  }
  if (PRH_INCOME_SIDEBAR.MONTHS.indexOf(normalized.month) < 0) throw new Error('Недопустимый месяц.');
  if (state.categories.indexOf(normalized.category) < 0) throw new Error('Категория отсутствует в доходных операциях.');
  if (!isFinite(normalized.minAmount) || normalized.minAmount < 0) {
    throw new Error('Минимальная сумма должна быть неотрицательной.');
  }
  return normalized;
}

function prhReadIncomeSidebarSource_() {
  const operations = SpreadsheetApp.getActive().getSheetByName(PRH_INCOME_SIDEBAR.OPERATIONS);
  if (!operations) throw new Error('Лист «01 Операции» не найден.');

  const lastRow = operations.getLastRow();
  const values = lastRow > 1 ? operations.getRange(2, 3, lastRow - 1, 7).getValues() : [];
  const years = {};
  const categories = {};
  let latest = null;

  values.forEach(function (row) {
    const date = row[0];
    const operationType = row[2];
    const category = String(row[6] || '').trim();
    if (operationType !== 'Доход') return;
    if (date instanceof Date && !isNaN(date.getTime())) {
      years[date.getFullYear()] = true;
      if (!latest || date.getTime() > latest.getTime()) latest = date;
    }
    if (category) categories[category] = true;
  });

  return {
    years: Object.keys(years).map(Number).sort(function (a, b) { return b - a; }),
    categories: ['Все'].concat(Object.keys(categories).sort()),
    latestPeriod: latest ? {
      year: latest.getFullYear(),
      month: PRH_INCOME_SIDEBAR.MONTHS[latest.getMonth()]
    } : null
  };
}

function prhSetIncomeSidebarControl_(range, value, label) {
  if (typeof prhSetValidatedControl_ === 'function') {
    prhSetValidatedControl_(range, value, label);
    return;
  }
  const rule = range.getDataValidation();
  if (rule && rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    const allowed = rule.getCriteriaValues()[0].map(String);
    if (allowed.indexOf(String(value)) < 0) {
      throw new Error('Недопустимое значение «' + label + '»: ' + value);
    }
  }
  range.setValue(value);
}

function prhIncomeSidebarDashboard_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PRH_INCOME_SIDEBAR.DASHBOARD);
  if (!sheet) throw new Error('Лист «14 Аналитика» не найден.');
  return sheet;
}

function prhIncomeSidebarAudit_(eventType, object, result) {
  try {
    if (typeof prhAppendAudit_ === 'function') {
      prhAppendAudit_(SpreadsheetApp.getActive(), {
        level: 'AUDIT',
        eventType: eventType,
        module: 'IncomeSidebar',
        object: object,
        result: result,
        message: 'Без изменения финансовых операций',
        details: 'controller=' + PRH_INCOME_SIDEBAR.VERSION
      });
    }
  } catch (error) {
    console.warn('Sidebar audit skipped: ' + error.message);
  }
}
