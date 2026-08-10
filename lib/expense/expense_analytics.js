'use strict';

const crypto = require('crypto');
const CONTRACT = require('./expense_analytics.v1.json');
const { DICTIONARY, evaluateKpis, normalizePeriod, assertComparablePeriods } = require('../finance/kpi_dictionary');
const { aggregateTransactions, normalizeTransaction } = require('../finance/financial_reconciliation');
const ANALYTICS = require('../analytics/analytics_contract.v1.json');
const viz = require('../visualization/visualization_foundation');
const explorer = require('../explorer/transaction_explorer');

const CONTRACT_SCHEMA = 'PRH_EXPENSE_ANALYTICS_V1';
const VERSION = '1.0.0';
const VIEW_SCHEMA = 'PRH_EXPENSE_ANALYTICS_VIEW_V1';
const DRILL_SCHEMA = 'PRH_EXPENSE_DRILL_ENVELOPE_V1';
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TREND_GRAINS = new Set(CONTRACT.period.supported_trend_grains);

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function assertContract() {
  if (CONTRACT.schema !== CONTRACT_SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'EXP-020') {
    fail('EXP_CONTRACT_VERSION_INVALID');
  }
  if (CONTRACT.upstream.financial_truth !== DICTIONARY.financial_truth_policy ||
      CONTRACT.upstream.kpi_dictionary !== `${DICTIONARY.schema}@${DICTIONARY.version}` ||
      CONTRACT.upstream.analytics !== `${ANALYTICS.schema}@${ANALYTICS.version}` ||
      CONTRACT.upstream.visualization !== `${viz.FOUNDATION_SCHEMA}@${viz.VERSION}` ||
      CONTRACT.upstream.transaction_explorer !== `${explorer.CONTRACT.schema}@${explorer.CONTRACT.version}`) {
    fail('EXP_UPSTREAM_CONTRACT_INVALID');
  }
  if (CONTRACT.measure !== 'EXPENSE' || CONTRACT.category_mix.refund_semantics_source !== 'FIN-010' ||
      CONTRACT.category_mix.partition_must_equal_total !== true || CONTRACT.drivers.financial_formula_authority !== false) {
    fail('EXP_FINANCIAL_AUTHORITY_INVALID');
  }
  if (CONTRACT.period.comparison !== 'EXPLICIT_EQUAL_DAY_WINDOWS_ONLY' || CONTRACT.period.implicit_proration !== false) {
    fail('EXP_COMPARISON_POLICY_INVALID');
  }
  if (CONTRACT.drill.target !== 'TRANSACTION_EXPLORER' || CONTRACT.drill.navigation_financial_payload !== false) {
    fail('EXP_DRILL_POLICY_INVALID');
  }
  if (CONTRACT.cost.mode !== 'FREE_ONLY' || CONTRACT.cost.external_provider_required !== false) fail('EXP_COST_POLICY_INVALID');
  if (Object.values(CONTRACT.authority).some((value) => value !== false)) fail('EXP_AUTHORITY_INVALID');
  return true;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function toDate(isoDay, reason = 'EXP_DATE_INVALID') {
  if (!ISO_DAY_RE.test(String(isoDay || ''))) fail(reason);
  const date = new Date(`${isoDay}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== isoDay) fail(reason);
  return date;
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const date = toDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDay(date);
}

function addMonths(iso, months) {
  const date = toDate(iso);
  if (date.getUTCDate() !== 1) fail('EXP_TREND_MONTH_ALIGNMENT_REQUIRED');
  date.setUTCMonth(date.getUTCMonth() + months);
  return isoDay(date);
}

function addYears(iso, years) {
  const date = toDate(iso);
  if (date.getUTCMonth() !== 0 || date.getUTCDate() !== 1) fail('EXP_TREND_YEAR_ALIGNMENT_REQUIRED');
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return isoDay(date);
}

function normalizeExplicitPeriod(input, reason = 'EXP_PERIOD_REQUIRED') {
  if (!input) fail(reason);
  const period = normalizePeriod(input);
  if (period.kind !== 'EXPLICIT_WINDOW') fail(reason);
  return period;
}

function clonePeriod(period) {
  return Object.freeze({
    kind: period.kind,
    start: period.start,
    end: period.end,
    partial: period.partial === true,
    day_count: period.day_count,
    proration: period.proration
  });
}

function trendWindows(period, grain) {
  const normalizedGrain = String(grain || 'MONTH').toUpperCase();
  if (!TREND_GRAINS.has(normalizedGrain)) fail('EXP_TREND_GRAIN_UNSUPPORTED');
  const windows = [];
  let cursor = period.start;
  const maxBuckets = normalizedGrain === 'DAY' ? 400 : normalizedGrain === 'MONTH' ? 120 : 20;
  if (normalizedGrain === 'MONTH') {
    const start = toDate(period.start);
    const end = toDate(period.end);
    if (start.getUTCDate() !== 1 || end.getUTCDate() !== 1) fail('EXP_TREND_MONTH_ALIGNMENT_REQUIRED');
  }
  if (normalizedGrain === 'YEAR') {
    for (const day of [period.start, period.end]) {
      const date = toDate(day);
      if (date.getUTCMonth() !== 0 || date.getUTCDate() !== 1) fail('EXP_TREND_YEAR_ALIGNMENT_REQUIRED');
    }
  }
  while (cursor < period.end) {
    if (windows.length >= maxBuckets) fail('EXP_TREND_BUCKET_LIMIT_EXCEEDED');
    const nextCandidate = normalizedGrain === 'DAY' ? addDays(cursor, 1) :
      normalizedGrain === 'MONTH' ? addMonths(cursor, 1) : addYears(cursor, 1);
    const next = nextCandidate > period.end ? period.end : nextCandidate;
    if (next <= cursor) fail('EXP_TREND_WINDOW_INVALID');
    windows.push(Object.freeze({ start: cursor, end: next }));
    cursor = next;
  }
  if (windows.length === 0) fail('EXP_TREND_EMPTY');
  return Object.freeze(windows);
}

function bucketLabel(window, grain) {
  if (grain === 'DAY') return window.start;
  if (grain === 'MONTH') return window.start.slice(0, 7);
  return window.start.slice(0, 4);
}

function buildTrend(inputs, currency, period, grain) {
  const windows = trendWindows(period, grain);
  const points = windows.map((window) => {
    const kpi = evaluateKpis(inputs, { currency, period: { start: window.start, end: window.end, partial: false } });
    return Object.freeze({
      time_bucket: bucketLabel(window, grain),
      start: window.start,
      end: window.end,
      expense_minor: kpi.expense_minor
    });
  });
  const sum = points.reduce((total, item) => total + item.expense_minor, 0);
  return Object.freeze({ grain, points: Object.freeze(points), sum_minor: sum, evaluation_count: points.length });
}

function scopeInputs(inputs, period) {
  if (!Array.isArray(inputs)) fail('EXP_TRANSACTIONS_INVALID');
  return inputs.filter((raw) => {
    const tx = normalizeTransaction(raw);
    const day = tx.occurred_at.slice(0, 10);
    return day >= period.start && day < period.end;
  });
}

function categoryMix(inputs, period, expectedTotal) {
  const report = aggregateTransactions(scopeInputs(inputs, period));
  const rows = Object.entries(report.by_expense_category_minor).map(([categoryId, valueMinor]) => {
    if (!Number.isSafeInteger(valueMinor)) fail('EXP_CATEGORY_VALUE_INVALID');
    if (valueMinor < 0) fail('EXP_CATEGORY_NEGATIVE_UNSUPPORTED');
    return Object.freeze({ category_id: categoryId, expense_minor: valueMinor });
  });
  const zeroCategoryCount = rows.filter((item) => item.expense_minor === 0).length;
  const nonZero = rows.filter((item) => item.expense_minor !== 0).sort((a, b) =>
    b.expense_minor - a.expense_minor || a.category_id.localeCompare(b.category_id));
  const sum = rows.reduce((total, item) => total + item.expense_minor, 0);
  if (sum !== expectedTotal || report.external_expense_minor !== expectedTotal) fail('EXP_CATEGORY_PARTITION_MISMATCH');
  if (expectedTotal !== 0 && nonZero.length === 0) fail('EXP_CATEGORY_PARTITION_EMPTY');
  return Object.freeze({
    rows: Object.freeze(nonZero),
    total_minor: sum,
    residual_minor: expectedTotal - sum,
    zero_category_count: zeroCategoryCount
  });
}

function driverRows(primaryMix, comparisonMix, expectedDelta) {
  const current = new Map(primaryMix.rows.map((item) => [item.category_id, item.expense_minor]));
  const previous = new Map(comparisonMix.rows.map((item) => [item.category_id, item.expense_minor]));
  const ids = [...new Set([...current.keys(), ...previous.keys()])].sort();
  const all = ids.map((categoryId) => Object.freeze({
    category_id: categoryId,
    current_expense_minor: current.get(categoryId) || 0,
    comparison_expense_minor: previous.get(categoryId) || 0,
    delta_minor: (current.get(categoryId) || 0) - (previous.get(categoryId) || 0)
  }));
  const sum = all.reduce((total, item) => total + item.delta_minor, 0);
  if (sum !== expectedDelta) fail('EXP_DRIVER_DELTA_CONSERVATION_FAILED');
  const zeroDriverCount = all.filter((item) => item.delta_minor === 0).length;
  const nonZero = all.filter((item) => item.delta_minor !== 0).sort((a, b) =>
    Math.abs(b.delta_minor) - Math.abs(a.delta_minor) || a.category_id.localeCompare(b.category_id));
  return Object.freeze({ rows: Object.freeze(nonZero), delta_minor: sum, zero_driver_count: zeroDriverCount });
}

function expenseWidgetSpecs() {
  const specs = [
    {
      id: 'expense-trend', query_ref: 'expense-trend-query', type: 'LINE', title: 'Динамика расходов',
      encoding: { x: { kind: 'DIMENSION', id: 'time_bucket' }, y: { kind: 'MEASURE', id: 'EXPENSE' } },
      presentation: { legend: false, smooth: true, show_labels: false }
    },
    {
      id: 'expense-category-mix', query_ref: 'expense-category-query', type: 'DONUT', title: 'Структура расходов',
      encoding: { category: { kind: 'DIMENSION', id: 'category_id' }, value: { kind: 'MEASURE', id: 'EXPENSE' } },
      presentation: { legend: true, show_labels: false }
    },
    {
      id: 'expense-drivers', query_ref: 'expense-driver-query', type: 'BAR', title: 'Драйверы изменения',
      encoding: { x: { kind: 'DIMENSION', id: 'category_id' }, y: { kind: 'MEASURE', id: 'EXPENSE' } },
      presentation: { legend: false, stacked: false, show_labels: false }
    }
  ];
  return Object.freeze(specs.map((item) => viz.normalizeWidgetSpec({
    schema: viz.WIDGET_SPEC_SCHEMA,
    contract_version: viz.VERSION,
    id: item.id,
    kind: 'CHART',
    query_ref: item.query_ref,
    chart_spec: {
      schema: viz.CHART_SPEC_SCHEMA,
      contract_version: viz.VERSION,
      id: `${item.id}-chart`,
      type: item.type,
      title: item.title,
      encoding: item.encoding,
      presentation: item.presentation,
      interactions: { filter: true, drill: true }
    }
  })));
}

function renderDatasets(trend, mix, drivers) {
  return Object.freeze({
    trend: Object.freeze({
      schema: viz.RENDER_DATASET_SCHEMA,
      contract_version: viz.VERSION,
      rows: Object.freeze(trend.points.map((item) => Object.freeze({
        dimensions: Object.freeze({ time_bucket: item.time_bucket }),
        measures: Object.freeze({ EXPENSE: item.expense_minor })
      })))
    }),
    category_mix: Object.freeze({
      schema: viz.RENDER_DATASET_SCHEMA,
      contract_version: viz.VERSION,
      rows: Object.freeze(mix.rows.map((item) => Object.freeze({
        dimensions: Object.freeze({ category_id: item.category_id }),
        measures: Object.freeze({ EXPENSE: item.expense_minor })
      })))
    }),
    drivers: Object.freeze({
      schema: viz.RENDER_DATASET_SCHEMA,
      contract_version: viz.VERSION,
      rows: Object.freeze(drivers.rows.map((item) => Object.freeze({
        dimensions: Object.freeze({ category_id: item.category_id }),
        measures: Object.freeze({ EXPENSE: item.delta_minor })
      })))
    })
  });
}

function cloneFilterContext(input) {
  const normalized = viz.normalizeFilterContext(input || {
    schema: viz.FILTER_CONTEXT_SCHEMA,
    contract_version: viz.VERSION,
    filters: []
  });
  return Object.freeze({
    schema: normalized.schema,
    contract_version: normalized.contract_version,
    filters: Object.freeze(normalized.filters.map((item) => Object.freeze({
      kind: item.kind,
      field: item.field,
      operator: item.operator,
      values: Object.freeze(item.values.slice())
    }))),
    context_hash: normalized.context_hash
  });
}

function buildExpenseAnalytics(inputs, options = {}) {
  assertContract();
  const period = normalizeExplicitPeriod(options.period, 'EXP_PRIMARY_PERIOD_REQUIRED');
  const comparisonPeriod = normalizeExplicitPeriod(options.comparison_period, 'EXP_COMPARISON_PERIOD_REQUIRED');
  assertComparablePeriods(options.period, options.comparison_period);
  const currency = String(options.currency || '').toUpperCase();
  const grain = String(options.trend_grain || 'MONTH').toUpperCase();
  const primary = evaluateKpis(inputs, { currency, period: options.period });
  const comparison = evaluateKpis(inputs, { currency, period: options.comparison_period });
  if (primary.currency !== comparison.currency) fail('EXP_COMPARISON_CURRENCY_MISMATCH');
  const trend = buildTrend(inputs, currency, period, grain);
  if (trend.sum_minor !== primary.expense_minor) fail('EXP_TREND_TOTAL_PARITY_FAILED');
  const mix = categoryMix(inputs, period, primary.expense_minor);
  const comparisonMix = categoryMix(inputs, comparisonPeriod, comparison.expense_minor);
  const delta = primary.expense_minor - comparison.expense_minor;
  const drivers = driverRows(mix, comparisonMix, delta);
  const filterContext = cloneFilterContext(options.base_filter_context);
  const widgets = expenseWidgetSpecs();
  const datasets = renderDatasets(trend, mix, drivers);
  const queryIdentity = sha256(JSON.stringify(stable({
    currency, period: clonePeriod(period), comparison_period: clonePeriod(comparisonPeriod), trend_grain: grain,
    filter_context_hash: filterContext.context_hash
  })));
  return Object.freeze({
    schema: VIEW_SCHEMA,
    contract_version: VERSION,
    currency,
    financial_truth_policy: primary.financial_truth_policy,
    kpi_dictionary_version: primary.dictionary_version,
    period: clonePeriod(period),
    comparison_period: clonePeriod(comparisonPeriod),
    total_expense_minor: primary.expense_minor,
    comparison_expense_minor: comparison.expense_minor,
    delta_minor: delta,
    trend,
    category_mix: mix,
    drivers,
    filter_context: filterContext,
    widgets,
    render_datasets: datasets,
    telemetry: Object.freeze({
      schema: CONTRACT_SCHEMA,
      version: VERSION,
      query_hash: queryIdentity,
      context_hash: filterContext.context_hash,
      bucket_count: trend.points.length,
      category_count: mix.rows.length,
      driver_count: drivers.rows.length,
      status: 'OK',
      reason_code: null
    }),
    provenance: Object.freeze({
      primary_total: 'FIN010_EVALUATE_KPIS',
      comparison_total: 'FIN010_EVALUATE_KPIS',
      trend_bucket_totals: 'FIN010_EVALUATE_KPIS',
      category_partition: 'FIN_TRUTH_AGGREGATE_TRANSACTIONS',
      financial_formula_in_ui: false,
      visualization_contract: `${viz.FOUNDATION_SCHEMA}@${viz.VERSION}`,
      explorer_contract: `${explorer.CONTRACT.schema}@${explorer.CONTRACT.version}`
    })
  });
}

function mergeCategoryFilter(filterContext, categoryId) {
  const filters = filterContext.filters.map((item) => ({
    kind: item.kind,
    field: item.field,
    operator: item.operator,
    values: item.values.slice()
  }));
  if (categoryId != null) {
    const category = String(categoryId).trim();
    if (!category) fail('EXP_DRILL_CATEGORY_INVALID');
    const existing = filters.find((item) => item.field === 'category_id');
    if (existing) {
      if (existing.operator !== 'INCLUDE') fail('EXP_DRILL_FILTER_OPERATOR_UNSUPPORTED');
      existing.values = [...new Set([...existing.values, category])].sort();
    } else {
      filters.push({ kind: 'DIMENSION', field: 'category_id', operator: 'INCLUDE', values: [category] });
    }
  }
  return viz.normalizeFilterContext({
    schema: viz.FILTER_CONTEXT_SCHEMA,
    contract_version: viz.VERSION,
    filters
  });
}

function explorerQueryFromContext(period, context) {
  const query = { date_from: period.start, date_to: period.end, offset: 0, limit: 50 };
  const mapping = { account_id: 'account_ids', category_id: 'category_ids', member_id: 'member_ids' };
  for (const item of context.filters) {
    if (item.operator !== 'INCLUDE') fail('EXP_DRILL_FILTER_OPERATOR_UNSUPPORTED');
    const key = mapping[item.field];
    if (!key) fail('EXP_DRILL_FILTER_FIELD_UNSUPPORTED');
    query[key] = item.values.slice();
  }
  return explorer.normalizeQuery(query);
}

function buildExpenseDrill(view, options = {}) {
  assertContract();
  if (!view || view.schema !== VIEW_SCHEMA || view.contract_version !== VERSION) fail('EXP_DRILL_VIEW_INVALID');
  const widgetId = String(options.widget_id || 'expense-category-mix');
  const widget = view.widgets.find((item) => item.id === widgetId);
  if (!widget) fail('EXP_DRILL_WIDGET_UNKNOWN');
  const context = mergeCategoryFilter(view.filter_context, options.category_id);
  const drill = viz.normalizeDrillContext({
    schema: viz.DRILL_CONTEXT_SCHEMA,
    contract_version: viz.VERSION,
    source_widget_id: widgetId,
    target: 'TRANSACTION_EXPLORER',
    filter_context: {
      schema: context.schema,
      contract_version: context.contract_version,
      filters: context.filters.map((item) => ({ kind: item.kind, field: item.field, operator: item.operator, values: item.values.slice() }))
    }
  });
  const explorerQuery = explorerQueryFromContext(view.period, context);
  return Object.freeze({
    schema: DRILL_SCHEMA,
    contract_version: VERSION,
    period: clonePeriod(view.period),
    drill_context: drill,
    explorer_query: explorerQuery,
    financial_payload: false
  });
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  CONTRACT_SCHEMA,
  VERSION,
  VIEW_SCHEMA,
  DRILL_SCHEMA,
  assertContract,
  trendWindows,
  expenseWidgetSpecs,
  buildExpenseAnalytics,
  buildExpenseDrill
});
