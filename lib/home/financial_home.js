'use strict';

const CONTRACT = require('./financial_home.v1.json');
const { evaluateKpis, DICTIONARY } = require('../finance/kpi_dictionary');
const viz = require('../visualization/visualization_foundation');

const CONTRACT_SCHEMA = 'PRH_FINANCIAL_HOME_V1';
const VIEW_SCHEMA = 'PRH_FINANCIAL_HOME_VIEW_V1';
const VERSION = '1.0.0';
const SEVERITY_ORDER = Object.freeze({ INFO: 1, WARNING: 2, CRITICAL: 3 });

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function assertContract() {
  if (CONTRACT.schema !== CONTRACT_SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'HOME-020') {
    fail('HOME_CONTRACT_VERSION_INVALID');
  }
  if (CONTRACT.upstream.financial_truth !== DICTIONARY.financial_truth_policy ||
      CONTRACT.upstream.kpi_dictionary !== `${DICTIONARY.schema}@${DICTIONARY.version}` ||
      CONTRACT.upstream.visualization !== `${viz.FOUNDATION_SCHEMA}@${viz.VERSION}`) {
    fail('HOME_UPSTREAM_CONTRACT_INVALID');
  }
  if (CONTRACT.view_model.financial_values_source !== 'SINGLE_FIN010_EVALUATION') fail('HOME_FIN_SOURCE_INVALID');
  if (CONTRACT.budget.implicit_plan_allowed !== false || CONTRACT.liquidity.cash_flow_proxy_allowed !== false) {
    fail('HOME_FAIL_SAFE_POLICY_INVALID');
  }
  if (CONTRACT.cost.class !== 'FREE_ONLY' || CONTRACT.cost.paid_dependency_required !== false ||
      CONTRACT.cost.external_cdn_required !== false) fail('HOME_COST_POLICY_INVALID');
  if (Object.values(CONTRACT.authorities).some((value) => value !== false)) fail('HOME_AUTHORITY_INVALID');
  return true;
}

function clonePeriod(period) {
  if (!period || typeof period !== 'object') fail('HOME_PERIOD_INVALID');
  return Object.freeze({
    kind: period.kind,
    start: period.start,
    end: period.end,
    partial: period.partial === true,
    day_count: period.day_count,
    proration: period.proration
  });
}

function cloneFilterContext(context) {
  const normalized = viz.normalizeFilterContext(context || {
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

function drillEnvelope(sourceWidgetId, target, period, filterContext) {
  const drill = viz.normalizeDrillContext({
    schema: viz.DRILL_CONTEXT_SCHEMA,
    contract_version: viz.VERSION,
    source_widget_id: sourceWidgetId,
    target,
    filter_context: {
      schema: filterContext.schema,
      contract_version: filterContext.contract_version,
      filters: filterContext.filters.map((item) => ({
        kind: item.kind,
        field: item.field,
        operator: item.operator,
        values: item.values.slice()
      }))
    }
  });
  return Object.freeze({
    schema: 'PRH_HOME_DRILL_ENVELOPE_V1',
    period: clonePeriod(period),
    drill_context: drill
  });
}

function readyMoneyCard(id, kpiId, valueMinor, currency, period, filterContext) {
  if (!Number.isSafeInteger(valueMinor)) fail('HOME_CARD_VALUE_INVALID');
  return Object.freeze({
    id,
    state: 'READY',
    source_kpi: kpiId,
    value_minor: valueMinor,
    currency,
    drill: drillEnvelope(`home-card-${id.toLowerCase()}`, 'TRANSACTION_EXPLORER', period, filterContext)
  });
}

function budgetCard(kpiResult, budgetMinor, filterContext) {
  if (kpiResult.budget_variance_minor == null) {
    return Object.freeze({
      id: 'BUDGET',
      state: 'NOT_CONFIGURED',
      source_kpi: 'BUDGET_VARIANCE',
      budget_minor: null,
      expense_minor: kpiResult.expense_minor,
      variance_minor: null,
      currency: kpiResult.currency,
      reason: 'EXPLICIT_BUDGET_REQUIRED',
      drill: drillEnvelope('home-card-budget', 'DETAILS', kpiResult.period, filterContext)
    });
  }
  if (!Number.isSafeInteger(budgetMinor)) fail('HOME_BUDGET_INPUT_INVALID');
  return Object.freeze({
    id: 'BUDGET',
    state: 'READY',
    source_kpi: 'BUDGET_VARIANCE',
    budget_minor: budgetMinor,
    expense_minor: kpiResult.expense_minor,
    variance_minor: kpiResult.budget_variance_minor,
    currency: kpiResult.currency,
    reason: null,
    drill: drillEnvelope('home-card-budget', 'TRANSACTION_EXPLORER', kpiResult.period, filterContext)
  });
}

function liquidityCard(kpiResult, filterContext) {
  return Object.freeze({
    id: 'LIQUIDITY',
    state: 'UNAVAILABLE_PENDING_BALANCE_SOURCE',
    value_minor: null,
    currency: kpiResult.currency,
    source: null,
    reason: 'VERSIONED_BALANCE_OBSERVATION_REQUIRED',
    future_dependency: 'BAL-030',
    cash_flow_proxy_used: false,
    drill: drillEnvelope('home-card-liquidity', 'DETAILS', kpiResult.period, filterContext)
  });
}

function alertItem({ code, severity, sourceKpi = null, sourceCapability = null, period, filterContext, target }) {
  if (!Object.prototype.hasOwnProperty.call(SEVERITY_ORDER, severity)) fail('HOME_ALERT_SEVERITY_INVALID');
  return Object.freeze({
    code,
    severity,
    source_kpi: sourceKpi,
    source_capability: sourceCapability,
    drill: drillEnvelope(`home-alert-${code.toLowerCase().replace(/_/g, '-')}`, target, period, filterContext)
  });
}

function buildAlerts(kpiResult, filterContext) {
  const alerts = [];
  if (kpiResult.cash_flow_minor < 0) {
    alerts.push(alertItem({
      code: 'NEGATIVE_CASH_FLOW', severity: 'WARNING', sourceKpi: 'CASH_FLOW',
      period: kpiResult.period, filterContext, target: 'TRANSACTION_EXPLORER'
    }));
  }
  if (kpiResult.budget_variance_minor != null && kpiResult.budget_variance_minor < 0) {
    alerts.push(alertItem({
      code: 'BUDGET_OVERRUN', severity: 'WARNING', sourceKpi: 'BUDGET_VARIANCE',
      period: kpiResult.period, filterContext, target: 'TRANSACTION_EXPLORER'
    }));
  }
  if (kpiResult.budget_variance_minor == null) {
    alerts.push(alertItem({
      code: 'BUDGET_NOT_CONFIGURED', severity: 'INFO', sourceCapability: 'BUDGET',
      period: kpiResult.period, filterContext, target: 'DETAILS'
    }));
  }
  alerts.push(alertItem({
    code: 'LIQUIDITY_SOURCE_UNAVAILABLE', severity: 'INFO', sourceCapability: 'LIQUIDITY',
    period: kpiResult.period, filterContext, target: 'DETAILS'
  }));
  return Object.freeze(alerts.sort((a, b) => {
    const severityDelta = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    return severityDelta || a.code.localeCompare(b.code);
  }));
}

function alertsCard(alerts, period, filterContext) {
  const highest = alerts.reduce((best, item) => {
    if (!best || SEVERITY_ORDER[item.severity] > SEVERITY_ORDER[best]) return item.severity;
    return best;
  }, null);
  return Object.freeze({
    id: 'ALERTS',
    state: 'READY',
    count: alerts.length,
    highest_severity: highest,
    drill: drillEnvelope('home-card-alerts', 'DETAILS', period, filterContext)
  });
}

function homeWidgetSpecs() {
  const line = viz.normalizeWidgetSpec({
    schema: viz.WIDGET_SPEC_SCHEMA,
    contract_version: viz.VERSION,
    id: 'home-cash-flow-trend',
    kind: 'CHART',
    query_ref: 'HOME:CASH_FLOW:TREND',
    chart_spec: {
      schema: viz.CHART_SPEC_SCHEMA,
      contract_version: viz.VERSION,
      id: 'home-cash-flow-trend-chart',
      type: 'LINE',
      title: 'Денежный поток',
      encoding: {
        x: { kind: 'DIMENSION', id: 'time_bucket' },
        y: { kind: 'MEASURE', id: 'CASH_FLOW' }
      },
      presentation: { legend: false, smooth: true, show_labels: false },
      interactions: { filter: true, drill: true }
    }
  });
  const donut = viz.normalizeWidgetSpec({
    schema: viz.WIDGET_SPEC_SCHEMA,
    contract_version: viz.VERSION,
    id: 'home-expense-mix',
    kind: 'CHART',
    query_ref: 'HOME:EXPENSE:MIX',
    chart_spec: {
      schema: viz.CHART_SPEC_SCHEMA,
      contract_version: viz.VERSION,
      id: 'home-expense-mix-chart',
      type: 'DONUT',
      title: 'Структура расходов',
      encoding: {
        category: { kind: 'DIMENSION', id: 'category_id' },
        value: { kind: 'MEASURE', id: 'EXPENSE' }
      },
      presentation: { legend: true, show_labels: false },
      interactions: { filter: true, drill: true }
    }
  });
  return Object.freeze([line, donut]);
}

function assertKpiResult(result) {
  if (!result || result.schema !== DICTIONARY.schema || result.dictionary_version !== DICTIONARY.version ||
      result.financial_truth_policy !== DICTIONARY.financial_truth_policy) fail('HOME_KPI_RESULT_INVALID');
  for (const field of ['income_minor', 'expense_minor', 'cash_flow_minor', 'savings_minor']) {
    if (!Number.isSafeInteger(result[field])) fail('HOME_KPI_RESULT_INVALID');
  }
  if (result.budget_variance_minor != null && !Number.isSafeInteger(result.budget_variance_minor)) fail('HOME_KPI_RESULT_INVALID');
  return true;
}

function buildFinancialHomeFromKpiResult(kpiResult, options = {}) {
  assertContract();
  assertKpiResult(kpiResult);
  const filterContext = cloneFilterContext(options.base_filter_context);
  const budgetMinor = kpiResult.budget_variance_minor == null ? null : Number(options.budget_minor);
  if (kpiResult.budget_variance_minor != null && !Number.isSafeInteger(budgetMinor)) fail('HOME_BUDGET_INPUT_INVALID');
  const alerts = buildAlerts(kpiResult, filterContext);
  const cards = Object.freeze({
    INCOME: readyMoneyCard('INCOME', 'INCOME', kpiResult.income_minor, kpiResult.currency, kpiResult.period, filterContext),
    EXPENSE: readyMoneyCard('EXPENSE', 'EXPENSE', kpiResult.expense_minor, kpiResult.currency, kpiResult.period, filterContext),
    CASH_FLOW: readyMoneyCard('CASH_FLOW', 'CASH_FLOW', kpiResult.cash_flow_minor, kpiResult.currency, kpiResult.period, filterContext),
    SAVINGS: readyMoneyCard('SAVINGS', 'SAVINGS', kpiResult.savings_minor, kpiResult.currency, kpiResult.period, filterContext),
    BUDGET: budgetCard(kpiResult, budgetMinor, filterContext),
    LIQUIDITY: liquidityCard(kpiResult, filterContext),
    ALERTS: alertsCard(alerts, kpiResult.period, filterContext)
  });
  return Object.freeze({
    schema: VIEW_SCHEMA,
    contract_version: VERSION,
    currency: kpiResult.currency,
    period: clonePeriod(kpiResult.period),
    financial_truth_policy: kpiResult.financial_truth_policy,
    kpi_dictionary_version: kpiResult.dictionary_version,
    filter_context: filterContext,
    cards,
    alerts,
    widgets: homeWidgetSpecs(),
    provenance: Object.freeze({
      financial_values: 'FIN010_EVALUATE_KPIS_RESULT',
      kpi_evaluation_count: 1,
      ui_financial_formula_used: false,
      liquidity_proxy_used: false,
      visualization_contract: `${viz.FOUNDATION_SCHEMA}@${viz.VERSION}`
    })
  });
}

function buildFinancialHome(transactions, options = {}) {
  assertContract();
  const kpiResult = evaluateKpis(transactions, {
    currency: options.currency,
    period: options.period,
    budget_minor: options.budget_minor
  });
  return buildFinancialHomeFromKpiResult(kpiResult, options);
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  CONTRACT_SCHEMA,
  VIEW_SCHEMA,
  VERSION,
  assertContract,
  buildFinancialHome,
  buildFinancialHomeFromKpiResult,
  buildAlerts,
  homeWidgetSpecs
});