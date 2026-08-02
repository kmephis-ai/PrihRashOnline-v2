/**
 * PrihRashOnline v2 — dashboard action links.
 *
 * Recreates the compact action panel next to the income quality block.
 * The service only writes formulas and formatting to `14 Аналитика` and
 * records UX metadata in `09 Настройки`. It never changes `01 Операции`.
 */
const DASHBOARD_ACTION_LINKS_VERSION = '1.2.0';

function applyDashboardActionLinks() {
  const spreadsheet = SpreadsheetApp.getActive();
  const analytics = spreadsheet.getSheetByName('14 Аналитика');
  const settings = spreadsheet.getSheetByName('09 Настройки');

  if (!analytics || !settings) {
    throw new Error('Required sheets are missing: 14 Аналитика or 09 Настройки');
  }

  const title = analytics.getRange('A383').getDisplayValue();
  if (title !== '8. КАЧЕСТВО ДАННЫХ И КЛАССИФИКАЦИИ') {
    throw new Error('Quality block anchor mismatch; action links were not applied');
  }

  const values = [
    ['ДЕЙСТВИЯ', '', ''],
    ['=HYPERLINK("#gid=516842185&range=S1:S2000";"Открыть статусы операций →")', '', ''],
    ['=HYPERLINK("#gid=875358913&range=A1:Z200";"Открыть очередь исправлений →")', '', ''],
    ['=HYPERLINK("#gid=88428147&range=A1:O140";"Открыть контрольный журнал →")', '', ''],
  ];

  const target = analytics.getRange('F385:H388');
  target.clearContent();
  target.setValues(values);
  analytics.setRowHeights(385, 4, 28);

  analytics.getRange('F385:H385')
    .setBackground('#1E4F77')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setVerticalAlignment('middle');

  analytics.getRange('F386:H388')
    .setBackground('#F2F7F9')
    .setFontColor('#1E4F77')
    .setFontWeight('bold')
    .setWrap(true)
    .setVerticalAlignment('middle');

  upsertSetting_(settings, 'income_dashboard_ux_version', DASHBOARD_ACTION_LINKS_VERSION,
    'Динамические выводы и быстрые переходы от качества к действиям');
  upsertSetting_(settings, 'income_dashboard_next_focus', 'CHARTS_UNIFICATION',
    'Следующий фокус — унификация диаграмм и устранение дублирующих визуализаций');
}

function upsertSetting_(sheet, key, value, description) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const keys = sheet.getRange(1, 1, lastRow, 1).getDisplayValues().flat();
  const index = keys.indexOf(key);
  const row = index >= 0 ? index + 1 : lastRow + 1;
  sheet.getRange(row, 1, 1, 3).setValues([[key, value, description]]);
}
