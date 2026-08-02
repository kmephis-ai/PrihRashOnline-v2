/**
 * DashboardChartStyleService v0.6.0
 *
 * Idempotent visual-only normalization for the 20 charts on `14 Аналитика`.
 * The service never writes financial values, never creates sheets and never
 * changes calculation ranges. The only guarded source repair is the known
 * empty monthly-income chart, which is bound to A39:B51 when it has no range.
 */
const PRH_CHART_STYLE = Object.freeze({
  VERSION: '0.6.0',
  SHEET_NAME: '14 Аналитика',
  EXPECTED_COUNT: 20,
  COLORS: Object.freeze({
    NAVY: '#0B2E4F',
    TEAL: '#119DA4',
    BLUE: '#7BA7F7',
    ORANGE: '#FF7A2F',
    GRAY: '#9CA3AF',
    PURPLE: '#7C3AED',
    RED: '#C12323',
    GRID: '#E7EDF3',
    TEXT: '#334E68'
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

function applyModernIncomeDashboardChartStyle() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet.getSheetByName(PRH_CHART_STYLE.SHEET_NAME);
  if (!sheet) throw new Error('Лист 14 Аналитика не найден');

  const charts = sheet.getCharts();
  if (charts.length !== PRH_CHART_STYLE.EXPECTED_COUNT) {
    throw new Error('Ожидалось 20 диаграмм, найдено: ' + charts.length);
  }

  const unknown = [];
  let repairedRanges = 0;

  charts.forEach(function (chart) {
    const title = String(chart.getOptions().get('title') || '');
    const profile = PRH_CHART_PROFILES.find(function (item) {
      return title.indexOf(item.match) !== -1;
    });
    if (!profile) {
      unknown.push(title || '<без заголовка>');
      return;
    }

    let builder = chart.modify();
    builder = prhChartConvertType_(builder, profile.type);

    if (profile.repairRange && chart.getRanges().length === 0) {
      builder.addRange(sheet.getRange(profile.repairRange));
      repairedRanges += 1;
    }

    const colors = profile.colors.map(function (key) {
      return PRH_CHART_STYLE.COLORS[key];
    });

    builder
      .setOption('fontName', 'Arial')
      .setOption('backgroundColor', '#FFFFFF')
      .setOption('titleTextStyle', {
        color: PRH_CHART_STYLE.COLORS.NAVY,
        fontSize: 13,
        bold: true
      })
      .setOption('legend', {
        position: profile.legend,
        textStyle: {
          color: PRH_CHART_STYLE.COLORS.TEXT,
          fontSize: 9
        }
      })
      .setOption('colors', colors)
      .setOption('chartArea', {
        left: profile.type === 'PIE' ? 30 : 72,
        top: 54,
        width: profile.type === 'PIE' ? '70%' : '78%',
        height: '68%'
      })
      .setOption('hAxis', {
        textStyle: { color: PRH_CHART_STYLE.COLORS.TEXT, fontSize: 9 },
        titleTextStyle: { color: PRH_CHART_STYLE.COLORS.TEXT, fontSize: 10 },
        gridlines: { color: PRH_CHART_STYLE.COLORS.GRID }
      })
      .setOption('vAxis', {
        textStyle: { color: PRH_CHART_STYLE.COLORS.TEXT, fontSize: 9 },
        titleTextStyle: { color: PRH_CHART_STYLE.COLORS.TEXT, fontSize: 10 },
        gridlines: { color: PRH_CHART_STYLE.COLORS.GRID }
      });

    if (profile.type === 'LINE') {
      builder.setOption('lineWidth', 3).setOption('pointSize', 4);
    }
    if (profile.type === 'COLUMN' || profile.type === 'BAR') {
      builder.setOption('bar', { groupWidth: '62%' });
      builder.setOption('isStacked', profile.stacked === true);
    }
    if (profile.type === 'PIE') {
      builder.setOption('pieHole', 0.58).setOption('pieSliceText', 'percentage');
    }

    sheet.updateChart(builder.build());
  });

  if (unknown.length) {
    throw new Error('Не распознаны диаграммы: ' + unknown.join('; '));
  }

  return {
    status: 'DEV_APPLIED',
    version: PRH_CHART_STYLE.VERSION,
    chartCount: charts.length,
    repairedRanges: repairedRanges
  };
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
