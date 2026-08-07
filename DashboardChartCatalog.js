/**
 * Dashboard Chart Catalog v1.3.0
 *
 * Safe metadata-only catalog for the 20 embedded charts on `14 Аналитика`.
 * It does not delete, move, rebuild, or change chart source ranges.
 */
const PRH_DASHBOARD_CHART_CATALOG = Object.freeze([
  { id: 298495940, tier: 'PRIMARY', question: 'Как менялся доход по годам?' },
  { id: 544833457, tier: 'PRIMARY', question: 'Как распределён доход по месяцам выбранного года?' },
  { id: 1438384242, tier: 'PRIMARY', question: 'Из чего состоит доход выбранного месяца?' },
  { id: 325972127, tier: 'PRIMARY', question: 'Какие операции дали наибольший вклад?' },
  { id: 372360840, tier: 'PRIMARY', question: 'Какой итог года ожидается по сценариям?' },
  { id: 707040910, tier: 'SECONDARY', question: 'Какие виды дохода формируют основную долю?' },
  { id: 17662568, tier: 'SECONDARY', question: 'Как накапливается доход относительно прошлого года?' },
  { id: 27947804, tier: 'SECONDARY', question: 'Какие месяцы обычно сильнее или слабее?' },
  { id: 919572342, tier: 'SECONDARY', question: 'Как меняется базовый и специальный доход?' },
  { id: 1799808047, tier: 'SECONDARY', question: 'Как меняется структура доходов внутри года?' },
  { id: 181137981, tier: 'SECONDARY', question: 'Как распределены операции по размерам?' },
  { id: 833636605, tier: 'SECONDARY', question: 'В какие дни месяца поступал доход?' },
  { id: 1186288203, tier: 'SECONDARY', question: 'Как факт соотносится со скользящими средними?' },
  { id: 1108361065, tier: 'SECONDARY', question: 'Какие категории изменили результат к прошлому месяцу?' },
  { id: 1027505513, tier: 'SECONDARY', question: 'Какие категории изменили результат к прошлому году?' },
  { id: 166599231, tier: 'SPECIAL', question: 'Как устроены специальные доходы выбранного месяца?' },
  { id: 794933302, tier: 'SPECIAL', question: 'Как специальные доходы меняются по месяцам?' },
  { id: 2108962541, tier: 'SPECIAL', question: 'Как специальные доходы меняются по кварталам?' },
  { id: 1814722715, tier: 'SPECIAL', question: 'Как накапливается капитализация вклада?' },
  { id: 1648992940, tier: 'SPECIAL', question: 'Как структура доходов меняется по годам?' }
]);

function prhGetDashboardChartCatalog() {
  return PRH_DASHBOARD_CHART_CATALOG.map(function (item) {
    return Object.assign({}, item);
  });
}

function prhValidateDashboardChartCatalog() {
  const ids = PRH_DASHBOARD_CHART_CATALOG.map(function (item) { return item.id; });
  if (ids.length !== 20) throw new Error('Expected exactly 20 dashboard charts.');
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate chart IDs detected.');
  return {
    total: ids.length,
    primary: PRH_DASHBOARD_CHART_CATALOG.filter(function (item) { return item.tier === 'PRIMARY'; }).length,
    secondary: PRH_DASHBOARD_CHART_CATALOG.filter(function (item) { return item.tier === 'SECONDARY'; }).length,
    special: PRH_DASHBOARD_CHART_CATALOG.filter(function (item) { return item.tier === 'SPECIAL'; }).length
  };
}
