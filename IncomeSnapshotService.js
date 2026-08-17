/**
 * ПрихРасхOnline v2 — Dashboard Snapshots v1.0.0-rc.1
 *
 * Снимки KPI сохраняются только в существующий «10 Контроль».
 * Новые листы не создаются. «01 Операции» не изменяется.
 */
const PRH_SNAPSHOTS = Object.freeze({
  VERSION: '1.0.0-rc.1',
  CONTROL: '10 Контроль',
  MARKER: 'DASHBOARD_SNAPSHOT_V1',
  WIDTH: 12
});

function prhCreateIncomeDashboardSnapshot(year, month) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const control = ss.getSheetByName(PRH_SNAPSHOTS.CONTROL);
  if (!control) throw new Error('Лист «10 Контроль» не найден. Новые листы автоматически не создаются.');

  let data;
  if (typeof prhGetWebDashboardDataV13 === 'function') data = prhGetWebDashboardDataV13(year, month, 'overview');
  else if (typeof prhGetWebDashboardData === 'function') data = prhGetWebDashboardData(year, month, 'overview');
  else throw new Error('Web Dashboard Data Service не установлен.');

  const executive = data.executive || {};
  const forecast = Number(executive.forecast || data.summary.selectedYearIncome || 0);
  const stability = Number(executive.stabilityIndex || 0);
  const problems = executive.possibleDuplicateCount != null
    ? Number(executive.possibleDuplicateCount || 0)
    : 0;
  const row = [
    PRH_SNAPSHOTS.MARKER,
    new Date(),
    Number(data.period.year),
    Number(data.period.monthIndex) + 1,
    Number(data.summary.selectedYearIncome || 0),
    Number(data.summary.selectedMonthIncome || 0),
    forecast,
    stability,
    Number(data.summary.qualityScore || 0),
    Number(data.summary.selectedMonthOperations || executive.monthOperationCount || 0),
    problems,
    PRH_SNAPSHOTS.VERSION
  ];

  const rowNumber = control.getLastRow() + 1;
  control.getRange(rowNumber, 1, 1, PRH_SNAPSHOTS.WIDTH).setValues([row]);
  SpreadsheetApp.flush();
  const readback = control.getRange(rowNumber, 1, 1, PRH_SNAPSHOTS.WIDTH).getValues()[0];
  if (String(readback[0]) !== PRH_SNAPSHOTS.MARKER || Number(readback[2]) !== Number(data.period.year)) {
    throw new Error('Readback снимка KPI не совпал с записанными значениями.');
  }

  return {
    ok: true,
    version: PRH_SNAPSHOTS.VERSION,
    row: rowNumber,
    year: row[2],
    month: row[3],
    yearIncome: row[4],
    monthIncome: row[5],
    forecast: row[6],
    stabilityIndex: row[7],
    qualityScore: row[8],
    operationWrite: false
  };
}

function prhListIncomeDashboardSnapshots(limit) {
  limit = Math.max(1, Math.min(Number(limit || 20), 100));
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const control = ss.getSheetByName(PRH_SNAPSHOTS.CONTROL);
  if (!control) throw new Error('Лист «10 Контроль» не найден.');
  const lastRow = control.getLastRow();
  if (!lastRow) return [];
  const values = control.getRange(1, 1, lastRow, PRH_SNAPSHOTS.WIDTH).getValues();
  return values.map(function (row, index) {
    if (String(row[0] || '') !== PRH_SNAPSHOTS.MARKER) return null;
    return {
      row: index + 1, createdAt: row[1], year: row[2], month: row[3],
      yearIncome: row[4], monthIncome: row[5], forecast: row[6], stabilityIndex: row[7],
      qualityScore: row[8], operationCount: row[9], problems: row[10], version: row[11]
    };
  }).filter(Boolean).slice(-limit).reverse();
}
