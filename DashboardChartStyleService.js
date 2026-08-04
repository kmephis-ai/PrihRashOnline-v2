/**
 * DashboardChartStyleService v0.7.0
 *
 * Idempotent normalization and guarded source repair for the 20 charts on
 * `14 Аналитика`. It never writes to `01 Операции`; chart sources point only
 * to existing or dedicated helper ranges on the analytics sheet.
 */
const PRH_CHART_STYLE = Object.freeze({
  VERSION: '0.7.0',
  SHEET_NAME: '14 Аналитика',
  EXPECTED_COUNT: 20,
  CRITICAL_SOURCES: Object.freeze({
    'Доходы по годам': 'A87:B96',
    'Структура доходов •': 'N140:O146',
    'Специальные доходы •': 'Q140:R143'
  }),
  COLORS: Object.freeze({
    NAVY: '#0B2E4F', TEAL: '#119DA4', BLUE: '#7BA7F7', ORANGE: '#FF7A2F',
    GRAY: '#9CA3AF', PURPLE: '#7C3AED', RED: '#C12323', GRID: '#E7EDF3', TEXT: '#334E68'
  })
});

const PRH_CHART_PROFILES = Object.freeze([
  { match: 'Доходы по годам', type: 'COLUMN', legend: 'none', colors: ['NAVY'] },
  { match: 'Доходы по месяцам', type: 'COLUMN', legend: 'none', colors: ['TEAL'], repairRange: 'A39:B51' },
  { match: 'Структура доходов •', type: 'PIE', legend: 'right', colors: ['NAVY', 'TEAL', 'BLUE', 'GRAY', 'ORANGE', 'PURPLE'] },
  { match: 'Специальные доходы •', type: 'BAR', legend: 'none', colors: ['ORANGE'] },
  { match: 'Накопительный доход:', type: 'LINE', legend: 'bottom', colors: ['NAVY', 'BLUE'] },
  { match: 'Средняя сезонность', type: 'COLUMN', legend: 'none', colors: ['TEAL'] },
  { match: 'Базовый и специальный', type: 'COLUMN', legend: 'bottom', colors: ['NAVY', 'ORANGE'], stacked: true },
  { match: 'Парето по видам', type: 'BAR', legend: 'none', colors: ['NAVY'] },
  { match: 'Структура доходов по месяцам', type: 'COLUMN', legend: 'bottom', colors: ['NAVY', 'TEAL', 'BLUE', 'GRAY', 'ORANGE', 'PURPLE'], stacked: true },
  { match: 'Крупнейшие операции', type: 'BAR', legend: 'none', colors: ['NAVY'] },
  { match: 'Распределение операций', type: 'COLUMN', legend: 'none', colors: ['TEAL'] },
  { match: 'Доход по дням', type: 'LINE', legend: 'none', colors: ['TEAL'] },
  { match: 'Сценарный прогноз', type: 'COLUMN', legend: 'none', colors: ['PURPLE'] },
  { match: 'Факт и скользящие', type: 'LINE', legend: 'bottom', colors: ['NAVY', 'TEAL', 'BLUE'] },
  { match: 'Факторы изменения к предыдущему месяцу', type: 'BAR', legend: 'none', colors: ['RED'] },
  { match: 'Факторы изменения к предыдущему году', type: 'BAR', legend: 'none', colors: ['RED'] },
  { match: 'Специальные доходы по месяцам', type: 'COLUMN', legend: 'bottom', colors: ['TEAL', 'NAVY', 'ORANGE'], stacked: true },
  { match: 'Специальные доходы по кварталам', type: 'COLUMN', legend: 'bottom', colors: ['TEAL', 'NAVY', 'ORANGE'], stacked: true },
  { match: 'Накопленная капитализация', type: 'LINE', legend: 'none', colors: ['TEAL'] },
  { match: 'Структура доходов по годам', type: 'COLUMN', legend: 'bottom', colors: ['NAVY', 'TEAL', 'BLUE', 'GRAY', 'ORANGE', 'PURPLE'], stacked: true }
]);

function prhEnsureCriticalChartSources() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PRH_CHART_STYLE.SHEET_NAME);
  if (!sheet) throw new Error('Лист 14 Аналитика не найден');
  let repaired = 0;
  sheet.getCharts().forEach(function (chart) {
    const title = String(chart.getOptions().get('title') || '');
    const key = Object.keys(PRH_CHART_STYLE.CRITICAL_SOURCES).find(function (prefix) {
      return title.indexOf(prefix) === 0;
    });
    if (!key) return;
    const rangeA1 = PRH_CHART_STYLE.CRITICAL_SOURCES[key];
    const expected = sheet.getRange(rangeA1);
    const current = chart.getRanges().map(function (r) { return r.getA1Notation(); });
    if (current.length === 1 && current[0] === rangeA1) return;
    const builder = chart.modify().clearRanges().addRange(expected);
    sheet.updateChart(builder.build());
    repaired += 1;
  });
  SpreadsheetApp.flush();
  return { status: 'DEV_APPLIED', version: PRH_CHART_STYLE.VERSION, repaired: repaired };
}

function applyModernIncomeDashboardChartStyle() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PRH_CHART_STYLE.SHEET_NAME);
  if (!sheet) throw new Error('Лист 14 Аналитика не найден');
  const charts = sheet.getCharts();
  if (charts.length !== PRH_CHART_STYLE.EXPECTED_COUNT) throw new Error('Ожидалось 20 диаграмм, найдено: ' + charts.length);

  prhEnsureCriticalChartSources();
  const unknown = [];
  charts.forEach(function (chart) {
    const title = String(chart.getOptions().get('title') || '');
    const profile = PRH_CHART_PROFILES.find(function (item) { return title.indexOf(item.match) !== -1; });
    if (!profile) { unknown.push(title || '<без заголовка>'); return; }
    let builder = prhChartConvertType_(chart.modify(), profile.type);
    if (profile.repairRange && chart.getRanges().length === 0) builder.addRange(sheet.getRange(profile.repairRange));
    const colors = profile.colors.map(function (key) { return PRH_CHART_STYLE.COLORS[key]; });
    builder.setOption('fontName', 'Arial').setOption('backgroundColor', '#FFFFFF')
      .setOption('titleTextStyle', { color: PRH_CHART_STYLE.COLORS.NAVY, fontSize: 13, bold: true })
      .setOption('legend', { position: profile.legend, textStyle: { color: PRH_CHART_STYLE.COLORS.TEXT, fontSize: 9 } })
      .setOption('colors', colors)
      .setOption('chartArea', { left: profile.type === 'PIE' ? 30 : 72, top: 54, width: profile.type === 'PIE' ? '70%' : '78%', height: '68%' })
      .setOption('hAxis', { textStyle: { color: PRH_CHART_STYLE.COLORS.TEXT, fontSize: 9 }, gridlines: { color: PRH_CHART_STYLE.COLORS.GRID } })
      .setOption('vAxis', { textStyle: { color: PRH_CHART_STYLE.COLORS.TEXT, fontSize: 9 }, gridlines: { color: PRH_CHART_STYLE.COLORS.GRID } });
    if (profile.type === 'LINE') builder.setOption('lineWidth', 3).setOption('pointSize', 4);
    if (profile.type === 'COLUMN' || profile.type === 'BAR') builder.setOption('bar', { groupWidth: '62%' }).setOption('isStacked', profile.stacked === true);
    if (profile.type === 'PIE') builder.setOption('pieHole', 0.58).setOption('pieSliceText', 'percentage');
    sheet.updateChart(builder.build());
  });
  if (unknown.length) throw new Error('Не распознаны диаграммы: ' + unknown.join('; '));
  return { status: 'DEV_APPLIED', version: PRH_CHART_STYLE.VERSION, chartCount: charts.length };
}

function prhChartConvertType_(builder, type) {
  switch (type) {
    case 'COLUMN': return builder.asColumnChart();
    case 'BAR': return builder.asBarChart();
    case 'LINE': return builder.asLineChart();
    case 'PIE': return builder.asPieChart();
    default: throw new Error('Неподдерживаемый тип диаграммы: ' + type);
  }
}
