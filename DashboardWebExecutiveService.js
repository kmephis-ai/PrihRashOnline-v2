/**
 * DashboardWebExecutiveService v1.3.0
 * Read-only enrichment for Web Dashboard blocks 4–5:
 * drill-down to source operations + executive metrics.
 */
const PRH_WEB_EXECUTIVE = Object.freeze({
  VERSION: '1.3.0',
  OPERATIONS_SHEET: '01 Операции',
  LARGE_AMOUNT: 100000,
  MAX_DRILL_ROWS: 60,
  OTHER_CATEGORY: 'Другое',
  SPECIAL_PATTERNS: Object.freeze([
    /капитализац/i,
    /квартальн.*прем/i,
    /отпуск/i
  ])
});

function prhGetWebDashboardDataV13(requestedYear, requestedMonth, requestedView) {
  const base = prhGetWebDashboardData(requestedYear, requestedMonth, requestedView);
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet.getSheetByName(PRH_WEB_EXECUTIVE.OPERATIONS_SHEET);
  if (!sheet) throw new Error('Лист «01 Операции» не найден.');

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (value) { return String(value || '').trim(); });
  const index = prhWebExecutiveHeaderIndex_(headers);
  const timeZone = spreadsheet.getSpreadsheetTimeZone();
  const rows = [];
  const duplicateBuckets = {};

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    if (String(row[index.type] || '').trim().toLowerCase() !== 'доход') continue;

    const amount = Number(row[index.amount]);
    if (!Number.isFinite(amount)) continue;

    const date = prhWebDate_(row[index.date]);
    const rawCategory = String(row[index.category] || '').trim();
    const category = rawCategory || 'Без категории';
    const name = index.name >= 0 ? String(row[index.name] || '').trim() : '';
    const comment = index.comment >= 0 ? String(row[index.comment] || '').trim() : '';
    const description = name || comment || '';
    const specialText = [category, name, comment].filter(Boolean).join(' ');
    const operation = {
      row: rowIndex + 1,
      id: index.id >= 0 ? String(row[index.id] || '').trim() : '',
      date: date,
      amount: amount,
      category: category,
      rawCategory: rawCategory,
      description: description,
      status: index.status >= 0 ? String(row[index.status] || '').trim() : '',
      isSpecial: prhWebExecutiveIsSpecial_(specialText),
      isLarge: amount >= PRH_WEB_EXECUTIVE.LARGE_AMOUNT,
      duplicate: false
    };
    operation.duplicateKey = prhWebExecutiveDuplicateKey_(operation);
    if (operation.duplicateKey) {
      if (!duplicateBuckets[operation.duplicateKey]) duplicateBuckets[operation.duplicateKey] = [];
      duplicateBuckets[operation.duplicateKey].push(operation);
    }
    rows.push(operation);
  }

  const duplicateKeys = Object.keys(duplicateBuckets).filter(function (key) {
    return duplicateBuckets[key].length > 1;
  });
  const duplicateKeySet = {};
  duplicateKeys.forEach(function (key) { duplicateKeySet[key] = true; });
  rows.forEach(function (row) { row.duplicate = Boolean(row.duplicateKey && duplicateKeySet[row.duplicateKey]); });

  const selectedYear = base.period.year;
  const selectedMonthIndex = base.period.monthIndex;
  const yearRows = rows.filter(function (row) {
    return row.date && row.date.getFullYear() === selectedYear;
  });
  const monthRows = yearRows.filter(function (row) {
    return row.date.getMonth() === selectedMonthIndex;
  });

  const previousMonthRef = selectedMonthIndex > 0
    ? { year: selectedYear, month: selectedMonthIndex - 1 }
    : { year: selectedYear - 1, month: 11 };
  const previousMonthRows = rows.filter(function (row) {
    return row.date && row.date.getFullYear() === previousMonthRef.year && row.date.getMonth() === previousMonthRef.month;
  });

  const activeMonthIndexes = yearRows.map(function (row) { return row.date.getMonth(); });
  const comparisonEndMonth = activeMonthIndexes.length ? Math.max.apply(null, activeMonthIndexes) : selectedMonthIndex;
  const previousComparableRows = rows.filter(function (row) {
    return row.date && row.date.getFullYear() === selectedYear - 1 && row.date.getMonth() <= comparisonEndMonth;
  });

  const specialRows = yearRows.filter(function (row) { return row.isSpecial; });
  const baseRows = yearRows.filter(function (row) { return !row.isSpecial; });
  const otherRows = yearRows.filter(function (row) {
    return row.category.toLowerCase() === PRH_WEB_EXECUTIVE.OTHER_CATEGORY.toLowerCase();
  });
  const largeRows = yearRows.filter(function (row) { return row.isLarge; });
  const duplicateRows = yearRows.filter(function (row) { return row.duplicate; });
  const qualityRows = rows.filter(prhWebExecutiveHasQualityIssue_);

  const yearCategoryTotals = prhWebExecutiveCategoryTotals_(yearRows);
  const largestSource = prhWebExecutiveLargestCategory_(yearCategoryTotals);
  const largestSourceRows = largestSource
    ? yearRows.filter(function (row) { return row.category === largestSource.label; })
    : [];

  const selectedYearIncome = prhWebExecutiveSum_(yearRows);
  const selectedMonthIncome = prhWebExecutiveSum_(monthRows);
  const previousMonthIncome = prhWebExecutiveSum_(previousMonthRows);
  const previousComparableIncome = prhWebExecutiveSum_(previousComparableRows);
  const specialIncome = prhWebExecutiveSum_(specialRows);
  const baseIncome = prhWebExecutiveSum_(baseRows);
  const monthChange = previousMonthIncome
    ? (selectedMonthIncome - previousMonthIncome) / previousMonthIncome
    : null;
  const comparableYearChange = previousComparableIncome
    ? (selectedYearIncome - previousComparableIncome) / previousComparableIncome
    : null;
  const otherIncome = prhWebExecutiveSum_(otherRows);
  const stabilityIndex = prhWebExecutiveStabilityIndex_(baseRows);
  const forecast = prhWebExecutiveForecast_(baseRows, specialIncome);
  const duplicateGroupCount = prhWebExecutiveDuplicateGroupCount_(duplicateBuckets, selectedYear);

  const qualityCounts = {
    withoutDate: rows.filter(function (row) { return !row.date; }).length,
    withoutDescription: rows.filter(function (row) { return !row.description; }).length,
    other: rows.filter(function (row) { return row.category.toLowerCase() === PRH_WEB_EXECUTIVE.OTHER_CATEGORY.toLowerCase(); }).length,
    zeroOrNegative: rows.filter(function (row) { return row.amount <= 0; }).length,
    duplicateGroups: duplicateKeys.length,
    large: rows.filter(function (row) { return row.isLarge; }).length
  };

  base.appVersion = PRH_WEB_EXECUTIVE.VERSION;
  base.executive = {
    selectedYearIncome: prhWebMoney_(selectedYearIncome),
    selectedMonthIncome: prhWebMoney_(selectedMonthIncome),
    monthChange: monthChange,
    yearChange: comparableYearChange,
    comparisonEndMonth: comparisonEndMonth,
    baseIncome: prhWebMoney_(baseIncome),
    specialIncome: prhWebMoney_(specialIncome),
    forecast: prhWebMoney_(forecast),
    stabilityIndex: stabilityIndex,
    qualityScore: base.summary.qualityScore,
    activeMonths: new Set(yearRows.map(function (row) { return row.date.getMonth(); })).size,
    averageOperation: monthRows.length ? prhWebMoney_(selectedMonthIncome / monthRows.length) : 0,
    largestSource: largestSource,
    otherShare: selectedYearIncome ? otherIncome / selectedYearIncome : 0,
    largeOperationCount: largeRows.length,
    possibleDuplicateCount: duplicateGroupCount,
    yearOperationCount: yearRows.length,
    monthOperationCount: monthRows.length,
    reasons: {
      month: prhWebExecutiveDeltaReason_(monthRows, previousMonthRows, 'месяца'),
      year: prhWebExecutiveDeltaReason_(yearRows, previousComparableRows, 'сопоставимого периода года'),
      special: specialIncome
        ? 'Специальные доходы составляют ' + prhWebExecutivePercentText_(selectedYearIncome ? specialIncome / selectedYearIncome : 0) + ' дохода выбранного года.'
        : 'Специальные доходы в выбранном году не обнаружены.'
    }
  };

  base.drilldowns = {
    year: prhWebExecutiveGroup_('Доход выбранного года', yearRows, spreadsheet, sheet, timeZone),
    month: prhWebExecutiveGroup_('Доход выбранного месяца', monthRows, spreadsheet, sheet, timeZone),
    previousMonth: prhWebExecutiveGroup_('Предыдущий месяц', previousMonthRows, spreadsheet, sheet, timeZone),
    previousYear: prhWebExecutiveGroup_('Сопоставимый период прошлого года', previousComparableRows, spreadsheet, sheet, timeZone),
    base: prhWebExecutiveGroup_('Базовые доходы', baseRows, spreadsheet, sheet, timeZone),
    special: prhWebExecutiveGroup_('Специальные доходы', specialRows, spreadsheet, sheet, timeZone),
    largestSource: prhWebExecutiveGroup_(largestSource ? 'Крупнейший источник: ' + largestSource.label : 'Крупнейший источник', largestSourceRows, spreadsheet, sheet, timeZone),
    other: prhWebExecutiveGroup_('Категория «Другое»', otherRows, spreadsheet, sheet, timeZone),
    large: prhWebExecutiveGroup_('Крупные операции ≥ ' + PRH_WEB_EXECUTIVE.LARGE_AMOUNT + ' ₽', largeRows, spreadsheet, sheet, timeZone),
    duplicates: prhWebExecutiveGroup_('Возможные точные дубли', duplicateRows, spreadsheet, sheet, timeZone, { groupCount: duplicateGroupCount }),
    quality: prhWebExecutiveGroup_('Операции, требующие контроля качества', qualityRows, spreadsheet, sheet, timeZone, { qualityCounts: qualityCounts })
  };

  base.kpis.specialShare = selectedYearIncome ? specialIncome / selectedYearIncome : 0;
  return base;
}

function prhWebExecutiveHeaderIndex_(headers) {
  function required(name) {
    const index = headers.indexOf(name);
    if (index < 0) throw new Error('В «01 Операции» отсутствует колонка «' + name + '».');
    return index;
  }
  return {
    id: headers.indexOf('ID'),
    date: required('Дата'),
    type: required('Тип'),
    amount: required('Сумма'),
    category: required('Категория'),
    name: headers.indexOf('Наименование'),
    comment: headers.indexOf('Комментарий'),
    status: headers.indexOf('Статус')
  };
}

function prhWebExecutiveIsSpecial_(text) {
  return PRH_WEB_EXECUTIVE.SPECIAL_PATTERNS.some(function (pattern) {
    return pattern.test(String(text || ''));
  });
}

function prhWebExecutiveDuplicateKey_(row) {
  if (!row.date) return '';
  const dateKey = [row.date.getFullYear(), row.date.getMonth() + 1, row.date.getDate()].join('-');
  return [dateKey, row.amount, row.category.toLowerCase(), row.description.toLowerCase()].join('|');
}

function prhWebExecutiveHasQualityIssue_(row) {
  return !row.date || !row.rawCategory || !row.description || row.amount <= 0 || row.isLarge || row.duplicate ||
    row.category.toLowerCase() === PRH_WEB_EXECUTIVE.OTHER_CATEGORY.toLowerCase();
}

function prhWebExecutiveSum_(rows) {
  return rows.reduce(function (sum, row) { return sum + row.amount; }, 0);
}

function prhWebExecutiveCategoryTotals_(rows) {
  const totals = {};
  rows.forEach(function (row) { totals[row.category] = (totals[row.category] || 0) + row.amount; });
  return totals;
}

function prhWebExecutiveLargestCategory_(totals) {
  const labels = Object.keys(totals);
  if (!labels.length) return null;
  return labels.map(function (label) {
    return { label: label, value: prhWebMoney_(totals[label]) };
  }).sort(function (a, b) { return b.value - a.value; })[0];
}

function prhWebExecutiveStabilityIndex_(baseRows) {
  const monthly = Array(12).fill(0);
  baseRows.forEach(function (row) { monthly[row.date.getMonth()] += row.amount; });
  const active = monthly.filter(function (value) { return value > 0; });
  if (active.length < 2) return active.length ? 100 : 0;
  const mean = active.reduce(function (sum, value) { return sum + value; }, 0) / active.length;
  const variance = active.reduce(function (sum, value) {
    return sum + Math.pow(value - mean, 2);
  }, 0) / active.length;
  const coefficient = mean ? Math.sqrt(variance) / mean : 1;
  return Math.max(0, Math.min(100, Math.round(100 - coefficient * 100)));
}

function prhWebExecutiveForecast_(baseRows, specialIncome) {
  const monthly = Array(12).fill(0);
  baseRows.forEach(function (row) { monthly[row.date.getMonth()] += row.amount; });
  const active = monthly.filter(function (value) { return value > 0; });
  if (!active.length) return specialIncome;
  const averageBaseMonth = active.reduce(function (sum, value) { return sum + value; }, 0) / active.length;
  return averageBaseMonth * 12 + specialIncome;
}

function prhWebExecutiveDeltaReason_(currentRows, previousRows, label) {
  const current = prhWebExecutiveCategoryTotals_(currentRows);
  const previous = prhWebExecutiveCategoryTotals_(previousRows);
  const keys = Array.from(new Set(Object.keys(current).concat(Object.keys(previous))));
  if (!keys.length) return 'Недостаточно данных для объяснения изменения ' + label + '.';
  const deltas = keys.map(function (key) {
    return { label: key, delta: (current[key] || 0) - (previous[key] || 0) };
  }).sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
  const top = deltas[0];
  const direction = top.delta >= 0 ? 'выше' : 'ниже';
  return 'Наибольший вклад по категориям: «' + top.label + '» — ' + direction + ' на ' +
    prhWebExecutiveMoneyText_(Math.abs(top.delta)) + '.';
}

function prhWebExecutiveDuplicateGroupCount_(buckets, year) {
  return Object.keys(buckets).filter(function (key) {
    const group = buckets[key];
    return group.length > 1 && group.some(function (row) {
      return row.date && row.date.getFullYear() === year;
    });
  }).length;
}

function prhWebExecutiveGroup_(title, rows, spreadsheet, sheet, timeZone, extra) {
  const sorted = rows.slice().sort(function (a, b) {
    if (a.date && b.date && a.date.getTime() !== b.date.getTime()) return b.date - a.date;
    return b.row - a.row;
  });
  const preview = sorted.slice(0, PRH_WEB_EXECUTIVE.MAX_DRILL_ROWS).map(function (row) {
    const flags = [];
    if (!row.date) flags.push('без даты');
    if (!row.rawCategory) flags.push('без категории');
    if (!row.description) flags.push('без описания');
    if (row.category.toLowerCase() === PRH_WEB_EXECUTIVE.OTHER_CATEGORY.toLowerCase()) flags.push('Другое');
    if (row.amount <= 0) flags.push('нулевая/отрицательная сумма');
    if (row.isLarge) flags.push('крупная');
    if (row.duplicate) flags.push('возможный дубль');
    return {
      row: row.row,
      id: row.id,
      date: row.date ? Utilities.formatDate(row.date, timeZone, 'dd.MM.yyyy') : '—',
      amount: prhWebMoney_(row.amount),
      category: row.category,
      description: row.description || '—',
      status: row.status,
      flags: flags,
      openUrl: spreadsheet.getUrl() + '#gid=' + sheet.getSheetId() + '&range=A' + row.row + ':S' + row.row
    };
  });
  const result = {
    title: title,
    count: rows.length,
    total: prhWebMoney_(prhWebExecutiveSum_(rows)),
    previewLimit: PRH_WEB_EXECUTIVE.MAX_DRILL_ROWS,
    rows: preview,
    openFirstUrl: preview.length ? preview[0].openUrl : spreadsheet.getUrl()
  };
  if (extra) Object.keys(extra).forEach(function (key) { result[key] = extra[key]; });
  return result;
}

function prhWebExecutiveMoneyText_(value) {
  return Math.round(Number(value) || 0).toLocaleString('ru-RU') + ' ₽';
}

function prhWebExecutivePercentText_(value) {
  return ((Number(value) || 0) * 100).toFixed(1).replace('.', ',') + '%';
}
