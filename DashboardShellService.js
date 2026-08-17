/**
 * DashboardShellService v2.0.0
 *
 * App-like shell for `14 Аналитика`. It formats only A1:T9, controls navigation
 * highlighting and restores the last user view. Financial data and formulas are
 * not rewritten; `01 Операции` is never modified.
 */
const PRH_DASHBOARD_SHELL = Object.freeze({
  VERSION: '2.0.0',
  SHEET: '14 Аналитика',
  MODE_CELL: 'E3',
  YEAR_CELL: 'A7',
  MONTH_CELL: 'D7',
  SHELL_RANGE: 'A1:T9',
  NAV_ROW: 4,
  NAV_ITEMS: Object.freeze([
    Object.freeze({ range: 'A4:B4', labelCell: 'A4', modes: Object.freeze(['Обзор']) }),
    Object.freeze({ range: 'C4:D4', labelCell: 'C4', modes: Object.freeze(['По годам']) }),
    Object.freeze({ range: 'E4:F4', labelCell: 'E4', modes: Object.freeze(['По месяцам года']) }),
    Object.freeze({ range: 'G4:H4', labelCell: 'G4', modes: Object.freeze(['Выбранный месяц']) }),
    Object.freeze({ range: 'I4:J4', labelCell: 'I4', modes: Object.freeze(['Структура и стабильность']) }),
    Object.freeze({ range: 'K4:L4', labelCell: 'K4', modes: Object.freeze(['Операции']) }),
    Object.freeze({ range: 'M4:N4', labelCell: 'M4', modes: Object.freeze(['Прогноз']) }),
    Object.freeze({ range: 'O4:P4', labelCell: 'O4', modes: Object.freeze(['Качество данных']) }),
    Object.freeze({ range: 'Q4:R4', labelCell: 'Q4', modes: Object.freeze(['Полный дашборд']) }),
    Object.freeze({ range: 'S4:T4', labelCell: 'S4', modes: Object.freeze(['Операции']) })
  ]),
  COLORS: Object.freeze({
    NAVY: '#082F58',
    NAVY_DARK: '#062443',
    TEAL: '#0F8F94',
    TEAL_LIGHT: '#E5F6F5',
    BLUE_LIGHT: '#EEF4FF',
    GREEN_LIGHT: '#ECF7EA',
    TEXT: '#102A56',
    MUTED: '#5B6C87',
    BORDER: '#D5DFED',
    WHITE: '#FFFFFF'
  })
});

function prhInstallDashboardShell() {
  const sheet = prhDashboardShellSheet_();
  const before = prhDashboardShellPeriod_(sheet);
  prhValidateDashboardShell_(sheet);
  prhApplyDashboardShellStyle_(sheet);
  const mode = prhDashboardShellMode_(sheet);
  prhHighlightDashboardShellMode_(sheet, mode);
  prhAssertDashboardShellPeriod_(sheet, before);
  PropertiesService.getDocumentProperties().setProperty('prh.dashboard.shell.version', PRH_DASHBOARD_SHELL.VERSION);
  SpreadsheetApp.flush();
  return { status: 'SHELL_READY_DEV', version: PRH_DASHBOARD_SHELL.VERSION, mode: mode, period: before };
}

function prhRestoreDashboardShell() {
  const sheet = prhDashboardShellSheet_();
  prhApplyDashboardShellStyle_(sheet);
  const stored = PropertiesService.getUserProperties().getProperty('prh.dashboard.mode');
  const requested = stored || prhDashboardShellMode_(sheet) || 'Обзор';
  const result = typeof prhApplyDashboardMode === 'function'
    ? prhApplyDashboardMode(requested)
    : { mode: requested };
  prhHighlightDashboardShellMode_(sheet, result.mode || requested);
  SpreadsheetApp.flush();
  return { status: 'SHELL_RESTORED', version: PRH_DASHBOARD_SHELL.VERSION, mode: result.mode || requested };
}

function prhRefreshDashboardShell() {
  const sheet = prhDashboardShellSheet_();
  const before = prhDashboardShellPeriod_(sheet);
  prhApplyDashboardShellStyle_(sheet);
  prhHighlightDashboardShellMode_(sheet, prhDashboardShellMode_(sheet));
  prhAssertDashboardShellPeriod_(sheet, before);
  SpreadsheetApp.flush();
  SpreadsheetApp.getActive().toast('Оболочка и навигация обновлены', 'ПрихРасхOnline', 3);
  return { status: 'SHELL_REFRESHED', version: PRH_DASHBOARD_SHELL.VERSION, period: before };
}

function prhHandleDashboardShellEdit(e) {
  if (!e || !e.range) return;
  const range = e.range;
  if (range.getSheet().getName() !== PRH_DASHBOARD_SHELL.SHEET) return;
  if (range.getA1Notation() === PRH_DASHBOARD_SHELL.MODE_CELL) {
    prhHighlightDashboardShellMode_(range.getSheet(), String(e.value || ''));
  }
}

function prhApplyDashboardShellStyle_(sheet) {
  const c = PRH_DASHBOARD_SHELL.COLORS;
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(9);
  sheet.setFrozenColumns(0);

  sheet.setRowHeight(1, 42);
  sheet.setRowHeight(2, 26);
  sheet.setRowHeight(3, 32);
  sheet.setRowHeight(4, 36);
  sheet.setRowHeight(5, 22);
  sheet.setRowHeight(6, 24);
  sheet.setRowHeight(7, 48);
  sheet.setRowHeight(8, 28);
  sheet.setRowHeight(9, 30);

  sheet.getRange('A1:T2').setBackground(c.NAVY_DARK).setFontColor(c.WHITE).setFontFamily('Arial');
  sheet.getRange('A1:T1').setFontSize(18).setFontWeight('bold').setVerticalAlignment('middle');
  sheet.getRange('A2:T2').setFontSize(10).setFontStyle('italic').setVerticalAlignment('middle');

  sheet.getRange('A3:T3').setBackground(c.WHITE).setFontColor(c.TEXT).setFontFamily('Arial')
    .setFontSize(10).setFontWeight('bold').setVerticalAlignment('middle');
  sheet.getRange('A3:T3').setBorder(true, true, true, true, false, false, c.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange('A4:T4').setBackground(c.WHITE).setFontColor(c.TEXT).setFontFamily('Arial')
    .setFontSize(10).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.getRange('A4:T4').setBorder(true, true, true, true, true, false, c.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange('A5:T5').setBackground('#F7F9FC').setFontColor(c.MUTED).setFontFamily('Arial')
    .setFontSize(9).setFontWeight('normal').setVerticalAlignment('middle');
  sheet.getRange('A6:T6').setBackground(c.WHITE).setFontColor(c.TEXT).setFontFamily('Arial')
    .setFontSize(9).setFontWeight('bold').setVerticalAlignment('middle');
  sheet.getRange('A7:C7').setBackground(c.WHITE);
  sheet.getRange('D7:F7').setBackground(c.WHITE);
  sheet.getRange('G7:J7').setBackground(c.TEAL_LIGHT);
  sheet.getRange('K7:N7').setBackground(c.BLUE_LIGHT);
  sheet.getRange('O7:T7').setBackground(c.GREEN_LIGHT);
  sheet.getRange('A7:T7').setFontFamily('Arial').setFontColor(c.TEXT).setFontSize(12)
    .setFontWeight('bold').setVerticalAlignment('middle').setWrap(true);
  ['A7:C7', 'D7:F7', 'G7:J7', 'K7:N7', 'O7:T7'].forEach(function(a1) {
    sheet.getRange(a1).setBorder(true, true, true, true, false, false, c.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sheet.getRange('A8:T8').setBackground(c.WHITE).setFontFamily('Arial').setFontColor(c.MUTED)
    .setFontSize(9).setVerticalAlignment('middle');
  sheet.getRange('A9:T9').setBackground('#F7F9FC').setFontFamily('Arial').setFontColor(c.MUTED)
    .setFontSize(9).setFontStyle('italic').setVerticalAlignment('middle').setWrap(true);
}

function prhHighlightDashboardShellMode_(sheet, requestedMode) {
  const c = PRH_DASHBOARD_SHELL.COLORS;
  const normalized = typeof prhNormalizeDashboardMode_ === 'function'
    ? prhNormalizeDashboardMode_(requestedMode)
    : requestedMode;

  PRH_DASHBOARD_SHELL.NAV_ITEMS.forEach(function(item) {
    const active = item.modes.indexOf(normalized) >= 0;
    sheet.getRange(item.range)
      .setBackground(active ? c.TEAL : c.WHITE)
      .setFontColor(active ? c.WHITE : c.TEXT)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  });
  return normalized;
}

function prhValidateDashboardShell_(sheet) {
  const required = ['A1', 'A2', 'E3', 'A4', 'S4', 'A7', 'D7', 'G7', 'K7', 'O7'];
  required.forEach(function(a1) { sheet.getRange(a1); });
  const labels = ['ОБЗОР', 'ПО ГОДАМ', 'МЕСЯЦЫ ГОДА', 'МЕСЯЦ', 'СТРУКТУРА', 'ОПЕРАЦИИ', 'ПРОГНОЗ', 'КАЧЕСТВО', 'ПОЛНЫЙ', 'ДЕТАЛИ'];
  PRH_DASHBOARD_SHELL.NAV_ITEMS.forEach(function(item, index) {
    const actual = String(sheet.getRange(item.labelCell).getDisplayValue() || '').toUpperCase();
    if (actual.indexOf(labels[index]) < 0) {
      throw new Error('Нарушена навигация Shell 2.0 в ' + item.labelCell + ': ожидалось «' + labels[index] + '».');
    }
  });
  return { ok: true, version: PRH_DASHBOARD_SHELL.VERSION, navigationItems: PRH_DASHBOARD_SHELL.NAV_ITEMS.length };
}

function prhDashboardShellMode_(sheet) {
  const raw = String(sheet.getRange(PRH_DASHBOARD_SHELL.MODE_CELL).getDisplayValue() || '').trim();
  return typeof prhNormalizeDashboardMode_ === 'function' ? (prhNormalizeDashboardMode_(raw) || 'Обзор') : (raw || 'Обзор');
}

function prhDashboardShellPeriod_(sheet) {
  return {
    year: sheet.getRange(PRH_DASHBOARD_SHELL.YEAR_CELL).getValue(),
    month: sheet.getRange(PRH_DASHBOARD_SHELL.MONTH_CELL).getValue()
  };
}

function prhAssertDashboardShellPeriod_(sheet, expected) {
  const actual = prhDashboardShellPeriod_(sheet);
  if (actual.year !== expected.year || actual.month !== expected.month) {
    throw new Error('Защитная остановка Shell 2.0: выбранный год или месяц изменился.');
  }
}

function prhDashboardShellSheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PRH_DASHBOARD_SHELL.SHEET);
  if (!sheet) throw new Error('Лист «14 Аналитика» не найден.');
  return sheet;
}
