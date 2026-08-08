/**
 * DashboardWebDataModel v1.2.1
 * Read-only dashboard data model.
 * Intentionally ES5-style for maximum Google Apps Script compatibility.
 */
var PRH_WEB_DASHBOARD = {
  VERSION: '1.2.1',
  OPERATIONS_SHEET: '01 Операции',
  ANALYTICS_SHEET: '14 Аналитика',
  QUALITY_CELL: 'E396',
  MONTHS: [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ],
  VIEWS: [
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
  ],
  SPECIAL_PATTERNS: [
    /капитализац/i,
    /квартальн.*прем/i,
    /отпуск/i
  ]
};

function prhGetWebDashboardData(requestedYear, requestedMonth, requestedView) {
  var spreadsheet = SpreadsheetApp.getActive();
  var operationsSheet = spreadsheet.getSheetByName(PRH_WEB_DASHBOARD.OPERATIONS_SHEET);
  if (!operationsSheet) {
    throw new Error('Лист 01 Операции не найден.');
  }

  var values = operationsSheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error('В листе 01 Операции нет данных для дашборда.');
  }

  var headers = values[0].map(function (value) {
    return String(value || '').trim();
  });
  var index = prhWebHeaderIndex_(headers);
  var incomeRows = [];
  var rowsWithValidDate = 0;
  var rowIndex;

  for (rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    var row = values[rowIndex];
    var type = String(row[index.type] || '').trim().toLowerCase();
    if (type !== 'доход') {
      continue;
    }

    var amount = Number(row[index.amount]);
    if (!prhWebIsFiniteNumber_(amount)) {
      continue;
    }

    var date = prhWebDate_(row[index.date]);
    if (date) {
      rowsWithValidDate += 1;
    }

    incomeRows.push({
      date: date,
      amount: amount,
      category: String(row[index.category] || 'Без категории').trim() || 'Без категории',
      status: String(row[index.status] || '').trim()
    });
  }

  var datedRows = incomeRows.filter(function (item) {
    return !!item.date;
  });
  if (!datedRows.length) {
    throw new Error('Не найдены доходные операции с корректной датой.');
  }

  var yearsMap = {};
  var years = [];
  datedRows.forEach(function (item) {
    var year = item.date.getFullYear();
    if (!yearsMap[year]) {
      yearsMap[year] = true;
      years.push(year);
    }
  });
  years.sort(function (a, b) {
    return a - b;
  });

  var latestDate = null;
  datedRows.forEach(function (item) {
    if (!latestDate || item.date > latestDate) {
      latestDate = item.date;
    }
  });

  var selectedYear = prhWebResolveYear_(requestedYear, years, latestDate.getFullYear());
  var selectedMonthIndex = prhWebResolveMonth_(requestedMonth, selectedYear, datedRows, latestDate);
  var selectedMonth = PRH_WEB_DASHBOARD.MONTHS[selectedMonthIndex];
  var selectedView = prhWebResolveView_(requestedView);

  var yearTotalsMap = {};
  years.forEach(function (year) {
    yearTotalsMap[year] = 0;
  });
  datedRows.forEach(function (item) {
    yearTotalsMap[item.date.getFullYear()] += item.amount;
  });

  var yearlyIncome = years.map(function (year) {
    return { year: year, value: prhWebMoney_(yearTotalsMap[year]) };
  });

  var monthlyTotals = prhWebZeroArray_(12);
  var monthlyCounts = prhWebZeroArray_(12);
  var selectedYearRows = datedRows.filter(function (item) {
    return item.date.getFullYear() === selectedYear;
  });
  selectedYearRows.forEach(function (item) {
    var month = item.date.getMonth();
    monthlyTotals[month] += item.amount;
    monthlyCounts[month] += 1;
  });

  var monthlyIncome = PRH_WEB_DASHBOARD.MONTHS.map(function (month, monthIndex) {
    return {
      month: month,
      short: month.slice(0, 3),
      value: prhWebMoney_(monthlyTotals[monthIndex]),
      operations: monthlyCounts[monthIndex]
    };
  });

  var selectedMonthRows = selectedYearRows.filter(function (item) {
    return item.date.getMonth() === selectedMonthIndex;
  });
  var categoryMap = {};
  selectedMonthRows.forEach(function (item) {
    categoryMap[item.category] = (categoryMap[item.category] || 0) + item.amount;
  });
  var monthStructure = prhWebTopStructure_(categoryMap, 5);

  var selectedYearIncome = prhWebMoney_(yearTotalsMap[selectedYear] || 0);
  var previousYearIncome = prhWebMoney_(yearTotalsMap[selectedYear - 1] || 0);
  var monthIncome = prhWebMoney_(monthlyTotals[selectedMonthIndex]);
  var activeMonthValues = monthlyTotals.filter(function (value) {
    return value > 0;
  });
  var historyTotal = yearlyIncome.reduce(function (sum, item) {
    return sum + item.value;
  }, 0);
  var specialIncome = selectedYearRows.reduce(function (sum, item) {
    return sum + (prhWebIsSpecial_(item.category) ? item.amount : 0);
  }, 0);

  var maxYearItem = yearlyIncome.reduce(function (best, item) {
    return !best || item.value > best.value ? item : best;
  }, null);
  var peakMonthIndex = prhWebIndexOfExtreme_(monthlyTotals, 'max');
  var minimumActiveMonthIndex = prhWebIndexOfExtreme_(monthlyTotals, 'min-positive');
  var monthOperations = selectedMonthRows.length;
  var averageOperation = monthOperations ? monthIncome / monthOperations : 0;
  var qualityScore = prhWebQualityScore_(spreadsheet, incomeRows.length, rowsWithValidDate);
  var yearChange = previousYearIncome
    ? (selectedYearIncome - previousYearIncome) / previousYearIncome
    : null;
  var historyShare = historyTotal ? selectedYearIncome / historyTotal : 0;

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
        ? prhWebMoney_(activeMonthValues.reduce(function (sum, value) {
          return sum + value;
        }, 0) / activeMonthValues.length)
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

function prhWebHeaderIndex_(headers) {
  var required = {
    date: 'Дата',
    type: 'Тип',
    amount: 'Сумма',
    category: 'Категория',
    status: 'Статус'
  };
  var result = {};
  Object.keys(required).forEach(function (key) {
    var index = headers.indexOf(required[key]);
    if (index < 0) {
      throw new Error('В листе 01 Операции отсутствует колонка ' + required[key] + '.');
    }
    result[key] = index;
  });
  return result;
}

function prhWebDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }
  if (!value) {
    return null;
  }

  var text = String(value).trim();
  var match = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (!match) {
    return null;
  }

  var date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return isNaN(date.getTime()) ? null : date;
}

function prhWebResolveYear_(requested, years, fallback) {
  var parsed = Number(requested);
  if (years.indexOf(parsed) >= 0) {
    return parsed;
  }
  if (years.indexOf(fallback) >= 0) {
    return fallback;
  }
  return years[years.length - 1];
}

function prhWebResolveMonth_(requested, selectedYear, rows, latestDate) {
  var text = String(requested == null ? '' : requested).trim();
  var monthIndex = Number(text);
  if (prhWebIsInteger_(monthIndex) && monthIndex >= 0 && monthIndex <= 11) {
    return monthIndex;
  }

  monthIndex = PRH_WEB_DASHBOARD.MONTHS.map(function (month) {
    return month.toLowerCase();
  }).indexOf(text.toLowerCase());
  if (monthIndex >= 0) {
    return monthIndex;
  }

  var active = rows.filter(function (item) {
    return item.date.getFullYear() === selectedYear;
  }).map(function (item) {
    return item.date.getMonth();
  });

  if (selectedYear === latestDate.getFullYear()) {
    return latestDate.getMonth();
  }
  return active.length ? Math.max.apply(null, active) : 0;
}

function prhWebResolveView_(requested) {
  var normalized = String(requested || '').trim().toLowerCase();
  var supported = PRH_WEB_DASHBOARD.VIEWS.some(function (item) {
    return item[0] === normalized;
  });
  return supported ? normalized : 'overview';
}

function prhWebTopStructure_(categoryMap, limit) {
  var entries = Object.keys(categoryMap).map(function (category) {
    return { label: category, value: prhWebMoney_(categoryMap[category]) };
  }).sort(function (a, b) {
    return b.value - a.value;
  });

  if (entries.length <= limit) {
    return entries;
  }

  var visible = entries.slice(0, limit - 1);
  var remainder = entries.slice(limit - 1).reduce(function (sum, item) {
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
  var index = -1;
  values.forEach(function (value, currentIndex) {
    if (mode === 'min-positive' && value <= 0) {
      return;
    }
    if (index < 0 || (mode === 'max' ? value > values[index] : value < values[index])) {
      index = currentIndex;
    }
  });
  return index;
}

function prhWebQualityScore_(spreadsheet, totalIncomeRows, validDateRows) {
  var analytics = spreadsheet.getSheetByName(PRH_WEB_DASHBOARD.ANALYTICS_SHEET);
  if (analytics) {
    var score = Number(analytics.getRange(PRH_WEB_DASHBOARD.QUALITY_CELL).getValue());
    if (prhWebIsFiniteNumber_(score) && score >= 0 && score <= 100) {
      return Math.round(score);
    }
  }

  return totalIncomeRows ? Math.round((validDateRows / totalIncomeRows) * 100) : 0;
}

function prhWebQualityLabel_(score) {
  if (score >= 80) {
    return 'высокое';
  }
  if (score >= 60) {
    return 'достаточное';
  }
  if (score >= 40) {
    return 'требует внимания';
  }
  return 'низкое';
}

function prhWebInsight_(year, change, historyShare) {
  var trend;
  if (change == null) {
    trend = 'Для сравнения с предыдущим годом пока недостаточно данных.';
  } else if (change > 0.03) {
    trend = 'доход выбранного года вырос на ' + Math.round(change * 100) + '%';
  } else if (change < -0.03) {
    trend = 'доход выбранного года снизился на ' + Math.abs(Math.round(change * 100)) + '%';
  } else {
    trend = 'доход выбранного года остается примерно на уровне прошлого года';
  }

  return {
    title: 'Главный вывод',
    text: 'В ' + year + ' году ' + trend + '. Доля года в общей истории: ' +
      (historyShare * 100).toFixed(1).replace('.', ',') + '%.',
    tone: change != null && change < -0.03 ? 'warning' : 'info'
  };
}

function prhWebMoney_(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function prhWebZeroArray_(length) {
  var result = [];
  var index;
  for (index = 0; index < length; index += 1) {
    result.push(0);
  }
  return result;
}

function prhWebIsFiniteNumber_(value) {
  return typeof value === 'number' && isFinite(value);
}

function prhWebIsInteger_(value) {
  return prhWebIsFiniteNumber_(value) && Math.floor(value) === value;
}
