/**
 * DashboardWebDataService v1.2.0
 * Read-only data API and Web App entry point for the HTML dashboard.
 *
 * Source of truth: `01 Операции` and quality score from `14 Аналитика`.
 * This service never writes financial values or changes spreadsheet geometry.
 */
const PRH_WEB_DASHBOARD = Object.freeze({
  VERSION: '1.2.0',
  OPERATIONS_SHEET: '01 Операции',
  ANALYTICS_SHEET: '14 Аналитика',
  QUALITY_CELL: 'E396',
  MONTHS: Object.freeze([
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]),
  VIEWS: Object.freeze([
    ['overview', 'Обзор'],
    ['years', 'Годы'],
    ['months', 'Месяцы'],
    ['month', 'Месяц'],
    ['seasonality', 'Сезонность'],
    ['structure', 'Структура'],
    ['operations', 'Операции'],
    ['forecast', 'Прогноз'],
    ['quality', 'Качество'],
    ['details', 'Детали']
  ]),
  SPECIAL_PATTERNS: Object.freeze([
    /капитализац/i,
    /квартальн.*прем/i,
    /отпуск/i
  ])
});

function prhRenderWebDashboard_(data) {
  var template = HtmlService.createTemplateFromFile('DashboardWebApp');
  var serialized = JSON.stringify(data == null ? {} : data);
  template.initialData = serialized.split('<').join(String.fromCharCode(92) + 'u003c');

  var output = template.evaluate();
  output.setTitle('PrihRashOnline Dashboard');
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return output;
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var data = prhGetWebDashboardData(params.year, params.month, params.view);
  return prhRenderWebDashboard_(data);
}

/**
 * Privacy-safe render smoke used by authenticated CI runtime health.
 * It deliberately avoids workbook reads and returns only a constant token.
 */
function prhWebAppSmokeToken() {
  var output = prhRenderWebDashboard_({ smoke: true });
  var html = output && typeof output.getContent === 'function' ? output.getContent() : '';
  if (!html || html.indexOf('id="initial-data"') === -1 || html.indexOf('PrihRashOnline') === -1) {
    throw new Error('WEBAPP_RENDER_SMOKE_FAILED');
  }
  return 'PRH_WEBAPP_SMOKE_V1|OK';
}

function prhGetWebDashboardData(requestedYear, requestedMonth, requestedView) {
  const spreadsheet = SpreadsheetApp.getActive();
  const operationsSheet = spreadsheet.getSheetByName(PRH_WEB_DASHBOARD.OPERATIONS_SHEET);
  if (!operationsSheet) throw new Error('Лист «01 Операции» не найден.');

  const values = operationsSheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('В «01 Операции» нет данных для дашборда.');

  const headers = values[0].map(function (value) {
    return String(value || '').trim();
  });
  const index = prhWebHeaderIndex_(headers);
  const incomeRows = [];
  let rowsWithValidDate = 0;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const type = String(row[index.type] || '').trim().toLowerCase();
    if (type !== 'доход') continue;

    const amount = Number(row[index.amount]);
    if (!Number.isFinite(amount)) continue;

    const date = prhWebDate_(row[index.date]);
    if (date) rowsWithValidDate += 1;

    incomeRows.push({
      date: date,
      amount: amount,
      category: String(row[index.category] || 'Без категории').trim() || 'Без категории',
      status: String(row[index.status] || '').trim()
    });
  }

  const datedRows = incomeRows.filter(function (item) { return item.date; });
  if (!datedRows.length) {
    throw new Error('Не найдены доходные операции с корректной датой.');
  }

  const years = Array.from(new Set(datedRows.map(function (item) {
    return item.date.getFullYear();
  }))).sort(function (a, b) { return a - b; });

  const latestDate = datedRows.reduce(function (latest, item) {
    return !latest || item.date > latest ? item.date : latest;
  }, null);

  const selectedYear = prhWebResolveYear_(requestedYear, years, latestDate.getFullYear());
  const selectedMonthIndex = prhWebResolveMonth_(requestedMonth, selectedYear, datedRows, latestDate);
  const selectedMonth = PRH_WEB_DASHBOARD.MONTHS[selectedMonthIndex];
  const selectedView = prhWebResolveView_(requestedView);

  const yearTotalsMap = {};
  years.forEach(function (year) { yearTotalsMap[year] = 0; });
  datedRows.forEach(function (item) {
    yearTotalsMap[item.date.getFullYear()] += item.amount;
  });

  const yearlyIncome = years.map(function (year) {
    return { year: year, value: prhWebMoney_(yearTotalsMap[year]) };
  });

  const monthlyTotals = Array(12).fill(0);
  const monthlyCounts = Array(12).fill(0);
  const selectedYearRows = datedRows.filter(function (item) {
    return item.date.getFullYear() === selectedYear;
  });
  selectedYearRows.forEach(function (item) {
    const month = item.date.getMonth();
    monthlyTotals[month] += item.amount;
    monthlyCounts[month] += 1;
  });

  const monthlyIncome = PRH_WEB_DASHBOARD.MONTHS.map(function (month, monthIndex) {
    return {
      month: month,
      short: month.slice(0, 3),
      value: prhWebMoney_(monthlyTotals[monthIndex]),
      operations: monthlyCounts[monthIndex]
    };
  });

  const selectedMonthRows = selectedYearRows.filter(function (item) {
    return item.date.getMonth() === selectedMonthIndex;
  });
  const categoryMap = {};
  selectedMonthRows.forEach(function (item) {
    categoryMap[item.category] = (categoryMap[item.category] || 0) + item.amount;
  });
  const monthStructure = prhWebTopStructure_(categoryMap, 5);

  const selectedYearIncome = prhWebMoney_(yearTotalsMap[selectedYear] || 0);
  const previousYearIncome = prhWebMoney_(yearTotalsMap[selectedYear - 1] || 0);
  const monthIncome = prhWebMoney_(monthlyTotals[selectedMonthIndex]);
  const activeMonthValues = monthlyTotals.filter(function (value) { return value > 0; });
  const historyTotal = yearlyIncome.reduce(function (sum, item) {
    return sum + item.value;
  }, 0);
  const specialIncome = selectedYearRows.reduce(function (sum, item) {
    return sum + (prhWebIsSpecial_(item.category) ? item.amount : 0);
  }, 0);

  const maxYearItem = yearlyIncome.reduce(function (best, item) {
    return !best || item.value > best.value ? item : best;
  }, null);
  const peakMonthIndex = prhWebIndexOfExtreme_(monthlyTotals, 'max');
  const minimumActiveMonthIndex = prhWebIndexOfExtreme_(monthlyTotals, 'min-positive');
  const monthOperations = selectedMonthRows.length;
  const averageOperation = monthOperations ? monthIncome / monthOperations : 0;
  const qualityScore = prhWebQualityScore_(spreadsheet, incomeRows.length, rowsWithValidDate);
  const yearChange = previousYearIncome
    ? (selectedYearIncome - previousYearIncome) / previousYearIncome
    : null;
  const historyShare = historyTotal ? selectedYearIncome / historyTotal : 0;

  return {
    schemaVersion: 1,
    appVersion: PRH_WEB_DASHBOARD.VERSION,
    generatedAt: new Date().toISOString(),
    spreadsheetUrl: spreadsheet.getUrl(),
    period: {
      year: selectedYear,
      month: selectedMonth,
      monthIndex: selectedMonthIndex,
      years: years,
      months: PRH_WEB_DASHBOARD.MONTHS.slice(),
      latestDate: Utilities.formatDate(
        latestDate,
        spreadsheet.getSpreadsheetTimeZone(),
        'dd.MM.yyyy'
      )
    },
    summary: {
      incomeOperations: incomeRows.length,
      datedOperations: rowsWithValidDate,
      qualityScore: qualityScore,
      qualityLabel: prhWebQualityLabel_(qualityScore),
      selectedYearIncome: selectedYearIncome,
      selectedMonthIncome: monthIncome,
      monthOperations: monthOperations,
      averageOperation: prhWebMoney_(averageOperation)
    },
    kpis: {
      averageYearIncome: prhWebMoney_(historyTotal / years.length),
      maximumYear: maxYearItem,
      activeMonths: activeMonthValues.length,
      averageActiveMonth: activeMonthValues.length
        ? prhWebMoney_(
          activeMonthValues.reduce(function (sum, value) { return sum + value; }, 0) /
          activeMonthValues.length
        )
        : 0,
      peakMonth: peakMonthIndex >= 0
        ? {
          month: PRH_WEB_DASHBOARD.MONTHS[peakMonthIndex],
          value: prhWebMoney_(monthlyTotals[peakMonthIndex])
        }
        : null,
      minimumActiveMonth: minimumActiveMonthIndex >= 0
        ? {
          month: PRH_WEB_DASHBOARD.MONTHS[minimumActiveMonthIndex],
          value: prhWebMoney_(monthlyTotals[minimumActiveMonthIndex])
        }
        : null,
      specialShare: selectedYearIncome ? specialIncome / selectedYearIncome : 0,
      yearChange: yearChange,
      historyShare: historyShare
    },
    yearlyIncome: yearlyIncome,
    monthlyIncome: monthlyIncome,
    monthStructure: monthStructure,
    insight: prhWebInsight_(selectedYear, yearChange, historyShare),
    navigation: {
      active: selectedView,
      tabs: PRH_WEB_DASHBOARD.VIEWS.map(function (item) {
        return item.slice();
      })
    }
  };
}

function prhOpenWebDashboard() {
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert(
      'Web Dashboard',
      'Web App ещё не развёрнут. Дождитесь успешного deployment workflow.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return { status: 'NOT_DEPLOYED' };
  }

  const safeUrl = String(url)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
  const output = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;padding:20px">' +
      '<h3 style="margin:0 0 12px">Открытие Web Dashboard</h3>' +
      '<p>Если новая вкладка не открылась автоматически, нажмите кнопку:</p>' +
      '<p><a href="' + safeUrl + '" target="_blank" rel="noopener" ' +
      'style="display:inline-block;padding:12px 18px;background:#075985;color:white;text-decoration:none;border-radius:10px">' +
      'Открыть дашборд</a></p>' +
      '<script>window.open(' + JSON.stringify(url) + ',"_blank","noopener");</script>' +
    '</div>'
  ).setWidth(420).setHeight(210);

  SpreadsheetApp.getUi().showModalDialog(output, 'ПрихРасхOnline');
  return { status: 'OPENING', url: url };
}

function prhWebHeaderIndex_(headers) {
  const required = {
    date: 'Дата',
    type: 'Тип',
    amount: 'Сумма',
    category: 'Категория',
    status: 'Статус'
  };
  const result = {};
  Object.keys(required).forEach(function (key) {
    const index = headers.indexOf(required[key]);
    if (index < 0) {
      throw new Error('В «01 Операции» отсутствует колонка «' + required[key] + '».');
    }
    result[key] = index;
  });
  return result;
}

function prhWebDate_(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (!value) return null;

  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (!match) return null;

  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function prhWebResolveYear_(requested, years, fallback) {
  const parsed = Number(requested);
  if (years.indexOf(parsed) >= 0) return parsed;
  if (years.indexOf(fallback) >= 0) return fallback;
  return years[years.length - 1];
}

function prhWebResolveMonth_(requested, selectedYear, rows, latestDate) {
  const text = String(requested == null ? '' : requested).trim();
  let monthIndex = Number(text);
  if (Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex <= 11) {
    return monthIndex;
  }

  monthIndex = PRH_WEB_DASHBOARD.MONTHS
    .map(function (month) { return month.toLowerCase(); })
    .indexOf(text.toLowerCase());
  if (monthIndex >= 0) return monthIndex;

  const active = rows
    .filter(function (item) { return item.date.getFullYear() === selectedYear; })
    .map(function (item) { return item.date.getMonth(); });

  if (selectedYear === latestDate.getFullYear()) return latestDate.getMonth();
  return active.length ? Math.max.apply(null, active) : 0;
}

function prhWebResolveView_(requested) {
  const normalized = String(requested || '').trim().toLowerCase();
  const supported = PRH_WEB_DASHBOARD.VIEWS.some(function (item) {
    return item[0] === normalized;
  });
  return supported ? normalized : 'overview';
}

function prhWebTopStructure_(categoryMap, limit) {
  const entries = Object.keys(categoryMap)
    .map(function (category) {
      return { label: category, value: prhWebMoney_(categoryMap[category]) };
    })
    .sort(function (a, b) { return b.value - a.value; });

  if (entries.length <= limit) return entries;

  const visible = entries.slice(0, limit - 1);
  const remainder = entries.slice(limit - 1).reduce(function (sum, item) {
    return sum + item.value;
  }, 0);
  visible.push({ label: 'Прочее', value: prhWebMoney_(remainder) });
  return visible;
}

function prhWebIsSpecial_(category) {
  return PRH_WEB_DASHBOARD.SPECIAL_PATTERNS.some(function (pattern) {
    return pattern.test(String(category || ''));
  });
}

function prhWebIndexOfExtreme_(values, mode) {
  let index = -1;
  values.forEach(function (value, currentIndex) {
    if (mode === 'min-positive' && value <= 0) return;
    if (index < 0 || (mode === 'max' ? value > values[index] : value < values[index])) {
      index = currentIndex;
    }
  });
  return index;
}

function prhWebQualityScore_(spreadsheet, totalIncomeRows, validDateRows) {
  const analytics = spreadsheet.getSheetByName(PRH_WEB_DASHBOARD.ANALYTICS_SHEET);
  if (analytics) {
    const score = Number(analytics.getRange(PRH_WEB_DASHBOARD.QUALITY_CELL).getValue());
    if (Number.isFinite(score) && score >= 0 && score <= 100) {
      return Math.round(score);
    }
  }

  return totalIncomeRows
    ? Math.round((validDateRows / totalIncomeRows) * 100)
    : 0;
}

function prhWebQualityLabel_(score) {
  if (score >= 80) return 'высокое';
  if (score >= 60) return 'достаточное';
  if (score >= 40) return 'требует внимания';
  return 'низкое';
}

function prhWebInsight_(year, change, historyShare) {
  let trend;
  if (change == null) {
    trend = 'Для сравнения с предыдущим годом пока недостаточно данных.';
  } else if (change > 0.03) {
    trend = 'доход выбранного года вырос на ' + Math.round(change * 100) + '%';
  } else if (change < -0.03) {
    trend = 'доход выбранного года снизился на ' +
      Math.abs(Math.round(change * 100)) + '%';
  } else {
    trend = 'доход выбранного года остаётся примерно на уровне прошлого года';
  }

  return {
    title: 'Главный вывод',
    text: 'В ' + year + ' году ' + trend +
      '. Доля года в общей истории: ' +
      (historyShare * 100).toFixed(1).replace('.', ',') + '%.',
    tone: change != null && change < -0.03 ? 'warning' : 'info'
  };
}

function prhWebMoney_(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
