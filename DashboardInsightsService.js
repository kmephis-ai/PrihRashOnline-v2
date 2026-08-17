/**
 * DashboardInsightsService v1.1.0
 *
 * Builds user-oriented conclusions for the income dashboard without changing
 * operation data. The formula is written only to the existing analytical
 * commentary cell A25 on sheet `14 Аналитика`.
 */
const DASHBOARD_INSIGHTS = Object.freeze({
  SHEET_NAME: '14 Аналитика',
  TARGET_CELL: 'A25',
  VERSION: '1.1.0'
});

function applyIncomeDashboardInsight() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(DASHBOARD_INSIGHTS.SHEET_NAME);
  if (!sheet) {
    throw new Error('Dashboard sheet not found: ' + DASHBOARD_INSIGHTS.SHEET_NAME);
  }

  const target = sheet.getRange(DASHBOARD_INSIGHTS.TARGET_CELL);
  target.setFormula(
    '="ГЛАВНЫЙ ВЫВОД: "&IF($D$13>0,05;"доход выбранного года вырос на "&TEXT($D$13;"0,0%")&" — откройте месяцы и найдите источники роста";IF($D$13<-0,05;"доход выбранного года снизился на "&TEXT(ABS($D$13);"0,0%")&" — сравните месяцы и структуру поступлений";"доход стабилен, изменение "&TEXT($D$13;"0,0%")&" — проверьте устойчивость источников"))&". Доля года в общей истории: "&FIXED($A$13/$B$85*100;1;TRUE)&"%."'
  );

  return {
    version: DASHBOARD_INSIGHTS.VERSION,
    sheet: DASHBOARD_INSIGHTS.SHEET_NAME,
    target: DASHBOARD_INSIGHTS.TARGET_CELL
  };
}
