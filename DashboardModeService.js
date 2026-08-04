/**
 * DashboardModeService v0.7.0
 *
 * Turns `14 Аналитика` into nine app-like views by changing row visibility only.
 * The compact Overview uses rows 10–58; detailed calculations remain available
 * through the other modes. Financial values, formulas and `01 Операции` are
 * never edited.
 */
const PRH_DASHBOARD_MODE = Object.freeze({
  VERSION: '0.7.0',
  SHEET_NAME: '14 Аналитика',
  MODE_CELL: 'E3',
  YEAR_CELL: 'A7',
  MONTH_CELL: 'D7',
  FIRST_BODY_ROW: 10,
  LAST_BODY_ROW: 700,
  MODES: Object.freeze({
    'Обзор': Object.freeze({ ranges: Object.freeze([[10, 58]]), anchor: 'A10' }),
    'По годам': Object.freeze({ ranges: Object.freeze([[10, 25]]), anchor: 'A10' }),
    'По месяцам года': Object.freeze({ ranges: Object.freeze([[26, 52]]), anchor: 'A26' }),
    'Выбранный месяц': Object.freeze({ ranges: Object.freeze([[53, 75]]), anchor: 'A53' }),
    'Структура и стабильность': Object.freeze({ ranges: Object.freeze([[220, 321]]), anchor: 'A220' }),
    'Операции': Object.freeze({ ranges: Object.freeze([[322, 381], [541, 690]]), anchor: 'A322' }),
    'Прогноз': Object.freeze({ ranges: Object.freeze([[401, 461]]), anchor: 'A401' }),
    'Качество данных': Object.freeze({ ranges: Object.freeze([[382, 400]]), anchor: 'A382' }),
    'Полный дашборд': Object.freeze({ ranges: Object.freeze([[10, 700]]), anchor: 'A10' })
  }),
  ALIASES: Object.freeze({
    'Годы': 'По годам',
    'Месяцы': 'По месяцам года',
    'Месяц': 'Выбранный месяц',
    'Сезонность': 'Структура и стабильность',
    'Структура': 'Структура и стабильность',
    'Полный': 'Полный дашборд'
  }),
  SECTION_HEADERS: Object.freeze({
    10: '1. АНАЛИТИКА ПО ГОДАМ',
    26: '2. АНАЛИТИКА ПО МЕСЯЦАМ ВЫБРАННОГО ГОДА',
    53: '3. АНАЛИТИКА ПО ВЫБРАННОМУ МЕСЯЦУ',
    220: '4. СЕЗОННОСТЬ И НАКОПИТЕЛЬНАЯ ДИНАМИКА',
    266: '5. УСТОЙЧИВОСТЬ И БАЗОВЫЙ ДОХОД',
    289: '6. СТРУКТУРА ДОХОДОВ И ПАРЕТО',
    322: '7. АНАЛИЗ ОПЕРАЦИЙ ВЫБРАННОГО МЕСЯЦА',
    382: '8. КАЧЕСТВО ДАННЫХ И КЛАССИФИКАЦИИ',
    401: '9. ПРОГНОЗ И СКОЛЬЗЯЩИЕ СРЕДНИЕ',
    430: '10. СРАВНЕНИЕ С ТИПИЧНЫМИ ПЕРИОДАМИ',
    462: '11. СПЕЦИАЛЬНЫЕ ДОХОДЫ И КВАРТАЛЬНЫЙ АНАЛИЗ',
    508: '12. ИСТОРИЧЕСКАЯ СТРУКТУРА И ДОЛГОСРОЧНЫЕ ПОКАЗАТЕЛИ',
    541: '13. ДЕТАЛИЗАЦИЯ ОПЕРАЦИЙ ВЫБРАННОГО МЕСЯЦА'
  })
});

function prhInstallDashboardModes() {
  const sheet = prhDashboardModeSheet_();
  prhValidateDashboardModeStructure_(sheet);
  const names = Object.keys(PRH_DASHBOARD_MODE.MODES);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(names, true)
    .setAllowInvalid(false)
    .setHelpText('Выберите экран дашборда. Скрипт покажет только нужные разделы.')
    .build();
  const modeCell = sheet.getRange(PRH_DASHBOARD_MODE.MODE_CELL);
  modeCell.setDataValidation(rule).setNote(
    'Режимы меняют только видимость строк. Год, месяц, формулы и операции сохраняются.'
  );
  const initial = prhNormalizeDashboardMode_(modeCell.getDisplayValue());
  return prhApplyDashboardMode(initial || 'Обзор');
}

function prhApplyDashboardMode(requestedMode) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) throw new Error('Дашборд занят другим действием. Повторите попытку.');
  try {
    const spreadsheet = SpreadsheetApp.getActive();
    const sheet = prhDashboardModeSheet_();
    prhValidateDashboardModeStructure_(sheet);
    const mode = prhNormalizeDashboardMode_(
      requestedMode || sheet.getRange(PRH_DASHBOARD_MODE.MODE_CELL).getDisplayValue()
    );
    if (!mode) throw new Error('Неизвестный режим дашборда: ' + requestedMode);
    const yearBefore = sheet.getRange(PRH_DASHBOARD_MODE.YEAR_CELL).getValue();
    const monthBefore = sheet.getRange(PRH_DASHBOARD_MODE.MONTH_CELL).getValue();
    const lastBodyRow = Math.min(PRH_DASHBOARD_MODE.LAST_BODY_ROW, sheet.getMaxRows());
    sheet.showRows(1, lastBodyRow);
    sheet.hideRows(PRH_DASHBOARD_MODE.FIRST_BODY_ROW, lastBodyRow - PRH_DASHBOARD_MODE.FIRST_BODY_ROW + 1);
    const profile = PRH_DASHBOARD_MODE.MODES[mode];
    profile.ranges.forEach(function (pair) {
      const start = pair[0];
      const end = Math.min(pair[1], lastBodyRow);
      if (end >= start) sheet.showRows(start, end - start + 1);
    });
    sheet.getRange(PRH_DASHBOARD_MODE.MODE_CELL).setValue(mode);
    if (sheet.getRange(PRH_DASHBOARD_MODE.YEAR_CELL).getValue() !== yearBefore ||
        sheet.getRange(PRH_DASHBOARD_MODE.MONTH_CELL).getValue() !== monthBefore) {
      throw new Error('Защитная остановка: год или месяц изменились при переключении режима.');
    }
    PropertiesService.getUserProperties().setProperty('prh.dashboard.mode', mode);
    spreadsheet.setActiveSheet(sheet);
    sheet.getRange(profile.anchor).activate();
    SpreadsheetApp.flush();
    return {
      status: 'DEV_APPLIED',
      version: PRH_DASHBOARD_MODE.VERSION,
      mode: mode,
      visibleRanges: profile.ranges.map(function (pair) { return pair[0] + ':' + pair[1]; }),
      year: yearBefore,
      month: monthBefore
    };
  } finally {
    lock.releaseLock();
  }
}

function prhHandleDashboardModeEdit(e) {
  if (!e || !e.range) return;
  const range = e.range;
  if (range.getSheet().getName() !== PRH_DASHBOARD_MODE.SHEET_NAME) return;
  if (range.getA1Notation() !== PRH_DASHBOARD_MODE.MODE_CELL) return;
  prhApplyDashboardMode(String(e.value || ''));
}

function prhRestoreLastDashboardMode() {
  const stored = PropertiesService.getUserProperties().getProperty('prh.dashboard.mode');
  return prhApplyDashboardMode(stored || 'Обзор');
}

function prhDashboardOverview() { return prhApplyDashboardMode('Обзор'); }
function prhDashboardYears() { return prhApplyDashboardMode('По годам'); }
function prhDashboardYearMonths() { return prhApplyDashboardMode('По месяцам года'); }
function prhDashboardSelectedMonth() { return prhApplyDashboardMode('Выбранный месяц'); }
function prhDashboardStructure() { return prhApplyDashboardMode('Структура и стабильность'); }
function prhDashboardOperations() { return prhApplyDashboardMode('Операции'); }
function prhDashboardForecast() { return prhApplyDashboardMode('Прогноз'); }
function prhDashboardQuality() { return prhApplyDashboardMode('Качество данных'); }
function prhDashboardFull() { return prhApplyDashboardMode('Полный дашборд'); }
function prhGetDashboardModes() { return Object.keys(PRH_DASHBOARD_MODE.MODES); }
function prhValidateDashboardModes() { return prhValidateDashboardModeStructure_(prhDashboardModeSheet_()); }

function prhNormalizeDashboardMode_(value) {
  const trimmed = String(value || '').trim();
  if (PRH_DASHBOARD_MODE.MODES[trimmed]) return trimmed;
  return PRH_DASHBOARD_MODE.ALIASES[trimmed] || null;
}

function prhValidateDashboardModeStructure_(sheet) {
  if (sheet.getMaxRows() < PRH_DASHBOARD_MODE.LAST_BODY_ROW) {
    throw new Error('Недостаточно строк для структуры режимов дашборда.');
  }
  Object.keys(PRH_DASHBOARD_MODE.SECTION_HEADERS).forEach(function (rowKey) {
    const row = Number(rowKey);
    const expected = PRH_DASHBOARD_MODE.SECTION_HEADERS[row];
    const actual = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    if (actual !== expected) {
      throw new Error('Структура изменена в строке ' + row + ': ожидалось «' + expected + '».');
    }
  });
  return {
    ok: true,
    version: PRH_DASHBOARD_MODE.VERSION,
    modeCount: Object.keys(PRH_DASHBOARD_MODE.MODES).length,
    sectionCount: Object.keys(PRH_DASHBOARD_MODE.SECTION_HEADERS).length
  };
}

function prhDashboardModeSheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PRH_DASHBOARD_MODE.SHEET_NAME);
  if (!sheet) throw new Error('Лист «14 Аналитика» не найден.');
  return sheet;
}
