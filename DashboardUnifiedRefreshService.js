/**
 * ПрихРасхOnline v2 — Unified Refresh Control Plane v1.0.0-rc.1
 *
 * Один безопасный вход для обновления доходного дашборда.
 * Финансовые значения «01 Операции» не изменяются.
 */
const PRH_UNIFIED_REFRESH = Object.freeze({
  VERSION: '1.0.0-rc.1',
  OPERATIONS: '01 Операции',
  ANALYTICS: '14 Аналитика',
  CONTROL: '10 Контроль',
  SETTINGS: '09 Настройки',
  REQUIRED_HEADERS: Object.freeze(['Дата', 'Тип', 'Сумма', 'Категория'])
});

function prhRunUnifiedIncomeRefresh(options) {
  options = options || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Скрипт должен быть привязан к книге ПрихРасхOnline DEV.');

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Обновление уже выполняется другим процессом.');

  const startedAt = new Date();
  try {
    const operations = prhUnifiedRequiredSheet_(ss, PRH_UNIFIED_REFRESH.OPERATIONS);
    const analytics = prhUnifiedRequiredSheet_(ss, PRH_UNIFIED_REFRESH.ANALYTICS);
    prhUnifiedRequiredSheet_(ss, PRH_UNIFIED_REFRESH.CONTROL);
    prhUnifiedRequiredSheet_(ss, PRH_UNIFIED_REFRESH.SETTINGS);

    const header = operations.getRange(1, 1, 1, operations.getLastColumn()).getDisplayValues()[0];
    PRH_UNIFIED_REFRESH.REQUIRED_HEADERS.forEach(function (name) {
      if (header.indexOf(name) < 0) throw new Error('В «01 Операции» отсутствует обязательная колонка «' + name + '».');
    });

    const preflight = {
      operationRows: Math.max(operations.getLastRow() - 1, 0),
      analyticsRows: analytics.getLastRow(),
      writeToOperations: false
    };

    // Existing quality queue is safe: it reads operations and writes only to «11 Предпросмотр».
    let quality = { status: 'SKIPPED' };
    if (options.rebuildQuality === true && typeof prhBuildQualityQueue === 'function') {
      prhBuildQualityQueue();
      quality = { status: 'REBUILT' };
    }

    SpreadsheetApp.flush();

    // Rebuild Web payload after formulas settle. The function is read-only.
    let web = null;
    if (typeof prhGetWebDashboardDataV13 === 'function') {
      web = prhGetWebDashboardDataV13(options.year, options.month, options.view || 'overview');
    } else if (typeof prhGetWebDashboardData === 'function') {
      web = prhGetWebDashboardData(options.year, options.month, options.view || 'overview');
    }

    const validation = {};
    if (typeof prhValidateDashboardApplication === 'function') {
      try { validation.application = prhValidateDashboardApplication({ silent: true }); }
      catch (error) { validation.application = { ok: false, error: error.message }; }
    }
    if (typeof prhValidateQualityCleanup === 'function') validation.qualityModule = 'AVAILABLE';

    const finishedAt = new Date();
    const result = {
      ok: true,
      version: PRH_UNIFIED_REFRESH.VERSION,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      elapsedMs: finishedAt.getTime() - startedAt.getTime(),
      preflight: preflight,
      quality: quality,
      validation: validation,
      dashboard: web ? {
        year: web.period && web.period.year,
        monthIndex: web.period && web.period.monthIndex,
        yearIncome: web.summary && web.summary.selectedYearIncome,
        monthIncome: web.summary && web.summary.selectedMonthIncome,
        qualityScore: web.summary && web.summary.qualityScore
      } : null
    };

    prhUnifiedWriteTechnicalStatus_(ss, 'dashboard_unified_refresh', 'PASSED', JSON.stringify({
      version: PRH_UNIFIED_REFRESH.VERSION,
      elapsedMs: result.elapsedMs,
      operationRows: preflight.operationRows
    }));
    prhUnifiedAudit_(ss, 'UNIFIED_REFRESH', 'OK', result);
    return result;
  } catch (error) {
    prhUnifiedAudit_(ss, 'UNIFIED_REFRESH', 'ERROR', { message: error.message, startedAt: startedAt.toISOString() });
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function prhUnifiedRequiredSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Обязательный лист «' + name + '» не найден. Новые листы автоматически не создаются.');
  return sheet;
}

function prhUnifiedWriteTechnicalStatus_(ss, key, value, description) {
  const sheet = ss.getSheetByName(PRH_UNIFIED_REFRESH.SETTINGS);
  if (!sheet) return;
  const last = Math.max(sheet.getLastRow(), 1);
  const rows = sheet.getRange(1, 1, last, 3).getValues();
  const index = rows.findIndex(function (row) { return String(row[0] || '') === key; });
  if (index >= 0) sheet.getRange(index + 1, 2, 1, 2).setValues([[value, description]]);
  else sheet.appendRow([key, value, description]);
}

function prhUnifiedAudit_(ss, eventType, result, details) {
  try {
    if (typeof prhAppendAudit_ === 'function') {
      prhAppendAudit_(ss, {
        level: 'AUDIT', eventType: eventType, module: 'UnifiedRefresh', object: 'IncomeDashboard',
        result: result, message: 'Без записи финансовых операций', details: JSON.stringify(details || {})
      });
    }
  } catch (error) {
    console.warn('Unified refresh audit skipped: ' + error.message);
  }
}
