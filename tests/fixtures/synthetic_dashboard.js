'use strict';

const { generateSyntheticFinanceFixture } = require('./synthetic_finance');

const MONTHS = Object.freeze([
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
]);

function roundMoney(value) {
  return Math.round(Number(value) || 0);
}

function sum(rows) {
  return rows.reduce((total, row) => total + row.amount, 0);
}

function formatDate(iso) {
  const date = new Date(iso);
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getUTCFullYear()}`;
}

function groupRows(title, rows, extra) {
  const preview = rows.slice(0, 60).map((row, index) => ({
    row: index + 2,
    id: row.id,
    date: formatDate(row.occurred_at),
    amount: row.amount,
    category: row.category,
    description: row.description || 'Synthetic fixture transaction',
    status: 'SYNTHETIC',
    flags: [],
    openUrl: '#'
  }));
  return Object.assign({
    title,
    count: rows.length,
    total: roundMoney(sum(rows)),
    rows: preview,
    openFirstUrl: '#'
  }, extra || {});
}

function generateSyntheticDashboardFixture(options) {
  const opts = options || {};
  const seed = opts.seed == null ? 20260808 : Number(opts.seed);
  const source = generateSyntheticFinanceFixture({ seed, profile: 'small' });
  const incomeRows = source.transactions
    .filter((item) => item.type === 'income')
    .map((item) => ({
      id: item.transaction_id,
      occurred_at: item.occurred_at,
      date: new Date(item.occurred_at),
      amount: roundMoney(item.amount_minor / 100),
      category: item.category_id || 'SYN-INCOME',
      description: item.description || 'Synthetic fixture transaction'
    }))
    .filter((item) => Number.isFinite(item.date.getTime()));

  if (!incomeRows.length) throw new Error('synthetic dashboard requires income rows');

  const years = Array.from(new Set(incomeRows.map((row) => row.date.getUTCFullYear()))).sort((a, b) => a - b);
  const latest = incomeRows.reduce((best, row) => !best || row.date > best.date ? row : best, null);
  const selectedYear = latest.date.getUTCFullYear();
  const selectedMonthIndex = latest.date.getUTCMonth();
  const selectedYearRows = incomeRows.filter((row) => row.date.getUTCFullYear() === selectedYear);
  const selectedMonthRows = selectedYearRows.filter((row) => row.date.getUTCMonth() === selectedMonthIndex);

  const yearlyIncome = years.map((year) => ({
    year,
    value: roundMoney(sum(incomeRows.filter((row) => row.date.getUTCFullYear() === year)))
  }));
  const monthlyIncome = MONTHS.map((month, monthIndex) => {
    const rows = selectedYearRows.filter((row) => row.date.getUTCMonth() === monthIndex);
    return { month, short: month.slice(0, 3), value: roundMoney(sum(rows)), operations: rows.length };
  });
  const categoryTotals = {};
  selectedMonthRows.forEach((row) => {
    categoryTotals[row.category] = (categoryTotals[row.category] || 0) + row.amount;
  });
  const monthStructure = Object.entries(categoryTotals)
    .map(([label, value]) => ({ label, value: roundMoney(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const historyTotal = yearlyIncome.reduce((total, item) => total + item.value, 0);
  const selectedYearIncome = roundMoney(sum(selectedYearRows));
  const selectedMonthIncome = roundMoney(sum(selectedMonthRows));
  const active = monthlyIncome.filter((item) => item.value > 0);
  const maxYear = yearlyIncome.reduce((best, item) => !best || item.value > best.value ? item : best, null);
  const peakMonth = active.reduce((best, item) => !best || item.value > best.value ? item : best, null);
  const minimumActiveMonth = active.reduce((best, item) => !best || item.value < best.value ? item : best, null);
  const averageActiveMonth = active.length ? roundMoney(active.reduce((total, item) => total + item.value, 0) / active.length) : 0;
  const averageOperation = selectedMonthRows.length ? roundMoney(selectedMonthIncome / selectedMonthRows.length) : 0;
  const largestSource = monthStructure.length ? monthStructure[0] : null;
  const forecast = averageActiveMonth * 12;

  const yearGroup = groupRows('Synthetic selected year', selectedYearRows);
  const monthGroup = groupRows('Synthetic selected month', selectedMonthRows);
  const emptyGroup = (title) => groupRows(title, []);

  return {
    testMetadata: {
      synthetic: true,
      privacy_class: 'PUBLIC_SYNTHETIC',
      provenance: 'tests/fixtures/synthetic_finance.js',
      seed
    },
    schemaVersion: 1,
    appVersion: 'synthetic-test-fixture',
    spreadsheetUrl: '#',
    period: {
      year: selectedYear,
      month: MONTHS[selectedMonthIndex],
      monthIndex: selectedMonthIndex,
      years,
      months: MONTHS.slice(),
      latestDate: formatDate(latest.occurred_at)
    },
    summary: {
      incomeOperations: incomeRows.length,
      datedOperations: incomeRows.length,
      qualityScore: 100,
      qualityLabel: 'synthetic',
      selectedYearIncome,
      selectedMonthIncome,
      monthOperations: selectedMonthRows.length,
      averageOperation
    },
    kpis: {
      averageYearIncome: years.length ? roundMoney(historyTotal / years.length) : 0,
      maximumYear: maxYear,
      activeMonths: active.length,
      averageActiveMonth,
      peakMonth: peakMonth ? { month: peakMonth.month, value: peakMonth.value } : null,
      minimumActiveMonth: minimumActiveMonth ? { month: minimumActiveMonth.month, value: minimumActiveMonth.value } : null,
      specialShare: 0,
      yearChange: null,
      historyShare: historyTotal ? selectedYearIncome / historyTotal : 0
    },
    yearlyIncome,
    monthlyIncome,
    monthStructure,
    insight: {
      title: 'Synthetic fixture',
      text: 'Deterministic fictional data for public UI regression tests.',
      tone: 'neutral'
    },
    executive: {
      selectedYearIncome,
      selectedMonthIncome,
      monthChange: null,
      yearChange: null,
      baseIncome: selectedYearIncome,
      specialIncome: 0,
      forecast,
      stabilityIndex: 100,
      qualityScore: 100,
      activeMonths: active.length,
      averageOperation,
      largestSource,
      otherShare: 0,
      largeOperationCount: selectedYearRows.filter((row) => row.amount >= 2500).length,
      possibleDuplicateCount: 0,
      yearOperationCount: selectedYearRows.length,
      monthOperationCount: selectedMonthRows.length,
      reasons: {
        month: 'Synthetic month comparison.',
        year: 'Synthetic year comparison.',
        special: 'No special-income classification in this public fixture.'
      }
    },
    drilldowns: {
      year: yearGroup,
      month: monthGroup,
      previousMonth: emptyGroup('Synthetic previous month'),
      previousYear: emptyGroup('Synthetic previous year'),
      base: yearGroup,
      special: emptyGroup('Synthetic special income'),
      largestSource: largestSource
        ? groupRows('Synthetic largest source', selectedMonthRows.filter((row) => row.category === largestSource.label))
        : emptyGroup('Synthetic largest source'),
      other: emptyGroup('Synthetic other category'),
      large: groupRows('Synthetic large operations', selectedYearRows.filter((row) => row.amount >= 2500)),
      duplicates: groupRows('Возможные точные дубли', [], { groupCount: 0 }),
      quality: emptyGroup('Synthetic quality review')
    },
    navigation: {
      active: 'overview',
      tabs: [
        ['overview','Обзор'],['years','Годы'],['months','Месяцы'],['month','Месяц'],
        ['seasonality','Сезонность'],['structure','Структура'],['operations','Операции'],
        ['forecast','Прогноз'],['quality','Качество'],['details','Детали']
      ]
    }
  };
}

module.exports = { MONTHS, generateSyntheticDashboardFixture };
