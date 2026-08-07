/**
 * ПрихРасхOnline v2 — Income Reports v1.0.0-rc.1
 *
 * PDF экспортирует существующий лист «14 Аналитика» без создания новых листов.
 * Финансовые операции не изменяются.
 */
const PRH_REPORTS = Object.freeze({
  VERSION: '1.0.0-rc.1',
  ANALYTICS: '14 Аналитика',
  YEAR_CELL: 'A7',
  MONTH_CELL: 'D7',
  TYPES: Object.freeze({
    MONTH: 'Месячный отчёт',
    YEAR: 'Годовой отчёт',
    FAMILY: 'Семейный финансовый отчёт',
    SPECIAL: 'Специальные доходы',
    QUALITY: 'Качество данных'
  })
});

function prhGetIncomeReportCatalog() {
  return Object.keys(PRH_REPORTS.TYPES).map(function (key) {
    return { id: key, title: PRH_REPORTS.TYPES[key] };
  });
}

function prhCreateIncomePdfReport(reportType) {
  reportType = String(reportType || 'MONTH').trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(PRH_REPORTS.TYPES, reportType)) throw new Error('Неизвестный тип отчёта: ' + reportType);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(PRH_REPORTS.ANALYTICS);
  if (!sheet) throw new Error('Лист «14 Аналитика» не найден.');
  SpreadsheetApp.flush();

  const year = String(sheet.getRange(PRH_REPORTS.YEAR_CELL).getDisplayValue() || '').trim();
  const month = String(sheet.getRange(PRH_REPORTS.MONTH_CELL).getDisplayValue() || '').trim();
  const fileName = prhReportSafeName_([
    'PrihRashOnline', PRH_REPORTS.TYPES[reportType], year, reportType === 'MONTH' ? month : '',
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
  ].filter(Boolean).join(' — ')) + '.pdf';

  const params = [
    'format=pdf', 'gid=' + sheet.getSheetId(), 'size=A4', 'portrait=false', 'fitw=true',
    'sheetnames=false', 'printtitle=false', 'pagenumbers=true', 'gridlines=false', 'fzr=false',
    'attachment=true'
  ].join('&');
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?' + params;
  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Экспорт PDF завершился кодом ' + response.getResponseCode() + '.');

  const file = DriveApp.createFile(response.getBlob().setName(fileName));
  prhReportAudit_('PDF_EXPORT', reportType, 'OK', { fileId: file.getId(), year: year, month: month });
  return {
    ok: true,
    version: PRH_REPORTS.VERSION,
    reportType: reportType,
    title: PRH_REPORTS.TYPES[reportType],
    fileName: file.getName(),
    fileUrl: file.getUrl(),
    year: year,
    month: month,
    operationWrite: false
  };
}

function prhReportSafeName_(value) {
  return String(value || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
}

function prhReportAudit_(type, target, result, details) {
  try {
    if (typeof prhAppendAudit_ === 'function') {
      prhAppendAudit_(SpreadsheetApp.getActiveSpreadsheet(), {
        level: 'AUDIT', eventType: type, module: 'IncomeReports', object: target,
        result: result, message: 'PDF отчёт; финансовые операции не изменялись', details: JSON.stringify(details || {})
      });
    }
  } catch (error) { console.warn('Report audit skipped: ' + error.message); }
}
