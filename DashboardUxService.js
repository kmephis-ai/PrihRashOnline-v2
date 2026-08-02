/**
 * ПрихРасхOnline v2 DEV — Dashboard UX Service v1.0.0.
 *
 * Идемпотентно применяет визуальную иерархию к листу «14 Аналитика».
 * Не изменяет формулы, значения и лист «01 Операции».
 */
var PRH_DASHBOARD_UX = Object.freeze({
  VERSION: '1.0.0',
  SHEET: '14 Аналитика',
  SETTINGS: '09 Настройки',
  MIN_ROWS: 690,
  MIN_COLUMNS: 20,
  SECTION_ROWS: Object.freeze([10, 26, 53, 220, 289, 322, 382, 401, 541]),
  DESCRIPTION_ROWS: Object.freeze([221, 222, 290, 291, 323, 324, 383, 384, 402, 403]),
  QUALITY_RANGE: 'C385:C392'
});

function prhInstallDashboardUx() {
  prhApplyDashboardUx();
  prhDashboardUxSetting_('income_dashboard_ux_version', PRH_DASHBOARD_UX.VERSION,
    'Единая визуальная иерархия и пользовательская структура дашборда');
  prhDashboardUxSetting_('income_dashboard_ux_status', 'READY_DEV',
    'Стиль применён в DEV; формулы и операции не изменяются');
  return { ok: true, version: PRH_DASHBOARD_UX.VERSION };
}

function prhApplyDashboardUx() {
  var sheet = prhDashboardUxSheet_();
  prhValidateDashboardUxStructure_(sheet);

  sheet.getRange(1, 1, sheet.getMaxRows(), PRH_DASHBOARD_UX.MIN_COLUMNS)
    .setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');

  sheet.setColumnWidth(1, 190);
  for (var col = 2; col <= 6; col += 1) sheet.setColumnWidth(col, 125);
  for (var col2 = 7; col2 <= 15; col2 += 1) sheet.setColumnWidth(col2, 105);
  for (var col3 = 16; col3 <= 20; col3 += 1) sheet.setColumnWidth(col3, 90);

  sheet.setRowHeight(1, 42);
  sheet.setRowHeight(2, 28);
  for (var row = 3; row <= 8; row += 1) sheet.setRowHeight(row, 30);

  prhDashboardUxStyleRange_(sheet.getRange('A1:T1'), '#143347', '#FFFFFF', 20, true, false, 'left');
  prhDashboardUxStyleRange_(sheet.getRange('A2:T2'), '#143347', '#CCDFEA', 11, false, true, 'left');
  prhDashboardUxStyleRange_(sheet.getRange('A3:T3'), '#EDF4F7', '#193D4F', 10, true, false, 'center');
  prhDashboardUxStyleRange_(sheet.getRange('A4:T4'), '#286B7F', '#FFFFFF', 10, true, false, 'center');
  prhDashboardUxStyleRange_(sheet.getRange('A5:T5'), '#E5F2F5', '#195666', 10, true, false, 'center');
  prhDashboardUxStyleRange_(sheet.getRange('A6:T8'), '#F7FAFA', '#1D2939', 10, false, false, 'center');
  prhDashboardUxStyleRange_(sheet.getRange('A9:T9'), '#F5F7F7', '#59666B', 9, false, true, 'left');

  PRH_DASHBOARD_UX.SECTION_ROWS.forEach(function (rowNumber) {
    var range = sheet.getRange(rowNumber, 1, 1, PRH_DASHBOARD_UX.MIN_COLUMNS);
    prhDashboardUxStyleRange_(range, '#145160', '#FFFFFF', 14, true, false, 'left');
    range.setBorder(null, null, true, null, null, null, '#389EAD', SpreadsheetApp.BorderStyle.SOLID_THICK);
  });

  PRH_DASHBOARD_UX.DESCRIPTION_ROWS.forEach(function (rowNumber) {
    prhDashboardUxStyleRange_(sheet.getRange(rowNumber, 1, 1, PRH_DASHBOARD_UX.MIN_COLUMNS),
      '#F2F7F9', '#4C606B', 10, false, true, 'left');
  });

  prhDashboardUxEnsureQualityRules_(sheet);
  SpreadsheetApp.flush();
  return prhValidateDashboardUxStructure_(sheet);
}

function prhValidateDashboardUx() {
  var result = prhValidateDashboardUxStructure_(prhDashboardUxSheet_());
  SpreadsheetApp.getUi().alert('Проверка UX дашборда',
    'Структура корректна. Формулы и финансовые операции не изменяются.',
    SpreadsheetApp.getUi().ButtonSet.OK);
  return result;
}

function prhValidateDashboardUxStructure_(sheet) {
  if (sheet.getMaxRows() < PRH_DASHBOARD_UX.MIN_ROWS) throw new Error('Недостаточно строк для текущей структуры дашборда.');
  if (sheet.getMaxColumns() < PRH_DASHBOARD_UX.MIN_COLUMNS) throw new Error('Недостаточно столбцов для текущей структуры дашборда.');
  var required = ['E3', 'A7', 'D7', 'E396', 'A545', 'D545'];
  required.forEach(function (a1) { sheet.getRange(a1); });
  PRH_DASHBOARD_UX.SECTION_ROWS.forEach(function (rowNumber) {
    if (!String(sheet.getRange(rowNumber, 1).getDisplayValue() || '').trim()) {
      throw new Error('Не найден заголовок смыслового раздела в строке ' + rowNumber + '.');
    }
  });
  return { ok: true, version: PRH_DASHBOARD_UX.VERSION, sectionRows: PRH_DASHBOARD_UX.SECTION_ROWS.slice() };
}

function prhDashboardUxStyleRange_(range, background, foreground, size, bold, italic, alignment) {
  range.setBackground(background)
    .setFontColor(foreground)
    .setFontSize(size)
    .setFontWeight(bold ? 'bold' : 'normal')
    .setFontStyle(italic ? 'italic' : 'normal')
    .setHorizontalAlignment(alignment)
    .setVerticalAlignment('middle')
    .setWrap(true);
}

function prhDashboardUxEnsureQualityRules_(sheet) {
  var targetA1 = PRH_DASHBOARD_UX.QUALITY_RANGE;
  var kept = sheet.getConditionalFormatRules().filter(function (rule) {
    return !rule.getRanges().some(function (range) { return range.getA1Notation() === targetA1; });
  });
  var target = sheet.getRange(targetA1);
  kept.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('OK')
    .setBackground('#D8F2E0').setFontColor('#197233').setBold(true).setRanges([target]).build());
  kept.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Проверить')
    .setBackground('#FFE5E0').setFontColor('#A51E14').setBold(true).setRanges([target]).build());
  kept.push(SpreadsheetApp.newConditionalFormatRule().whenTextContains('Допустимо')
    .setBackground('#FFF4D1').setFontColor('#8C5905').setBold(true).setRanges([target]).build());
  sheet.setConditionalFormatRules(kept);
}

function prhDashboardUxSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRH_DASHBOARD_UX.SHEET);
  if (!sheet) throw new Error('Лист «14 Аналитика» не найден.');
  return sheet;
}

function prhDashboardUxSetting_(key, value, description) {
  var settings = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRH_DASHBOARD_UX.SETTINGS);
  if (!settings) throw new Error('Лист «09 Настройки» не найден.');
  var rows = settings.getRange(1, 1, Math.max(settings.getLastRow(), 1), 3).getValues();
  var index = rows.findIndex(function (row) { return row[0] === key; });
  if (index >= 0) settings.getRange(index + 1, 2, 1, 2).setValues([[value, description]]);
  else settings.appendRow([key, value, description]);
}
