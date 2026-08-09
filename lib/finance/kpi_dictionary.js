'use strict';

const DICTIONARY = require('./kpi_dictionary.v1.json');
const {
  POLICY_VERSION,
  INCLUDED_STATUS,
  asMinorUnits,
  aggregateTransactions,
  normalizeTransaction
} = require('./financial_reconciliation');

const KPI_SCHEMA = 'PRH_KPI_DICTIONARY_V1';
const REQUIRED_KPIS = Object.freeze([
  'INCOME',
  'EXPENSE',
  'CASH_FLOW',
  'SAVINGS',
  'BUDGET_VARIANCE',
  'GROSS_EXPENSE',
  'REFUND',
  'TRANSFER'
]);
const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function assertIsoDay(value, reason) {
  const text = String(value || '');
  const match = ISO_DAY_RE.exec(text);
  if (!match) fail(reason);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) fail(reason);
  return text;
}

function dayNumber(isoDay) {
  const [year, month, day] = isoDay.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function normalizePeriod(period) {
  if (period == null) {
    return Object.freeze({
      kind: 'FULL_INPUT_SET',
      start: null,
      end: null,
      partial: false,
      day_count: null,
      proration: 'NONE'
    });
  }
  if (!period || typeof period !== 'object' || Array.isArray(period)) fail('KPI_PERIOD_INVALID');
  const allowed = ['start', 'end', 'partial'];
  if (Object.keys(period).some((key) => !allowed.includes(key))) fail('KPI_PERIOD_INVALID');
  const start = assertIsoDay(period.start, 'KPI_PERIOD_START_INVALID');
  const end = assertIsoDay(period.end, 'KPI_PERIOD_END_INVALID');
  const days = dayNumber(end) - dayNumber(start);
  if (days <= 0) fail('KPI_PERIOD_RANGE_INVALID');
  return Object.freeze({
    kind: 'EXPLICIT_WINDOW',
    start,
    end,
    partial: period.partial === true,
    day_count: days,
    proration: 'NONE'
  });
}

function assertComparablePeriods(primary, comparison) {
  const left = normalizePeriod(primary);
  const right = normalizePeriod(comparison);
  if (left.kind !== 'EXPLICIT_WINDOW' || right.kind !== 'EXPLICIT_WINDOW') fail('KPI_COMPARISON_PERIOD_REQUIRED');
  if (left.day_count !== right.day_count) fail('KPI_PERIODS_NOT_COMPARABLE');
  return true;
}

function validateDictionary(dictionary = DICTIONARY) {
  if (!dictionary || dictionary.schema !== KPI_SCHEMA) fail('KPI_DICTIONARY_SCHEMA_INVALID');
  if (dictionary.version !== '1.0.0') fail('KPI_DICTIONARY_VERSION_INVALID');
  if (dictionary.financial_truth_policy !== POLICY_VERSION) fail('KPI_FINANCIAL_POLICY_MISMATCH');
  if (!dictionary.scope || dictionary.scope.included_status !== INCLUDED_STATUS) fail('KPI_INCLUDED_STATUS_MISMATCH');
  if (dictionary.scope.money_representation !== 'integer_minor_units') fail('KPI_MONEY_REPRESENTATION_INVALID');
  if (dictionary.scope.rounding_policy !== 'NO_IMPLICIT_ROUNDING') fail('KPI_ROUNDING_POLICY_INVALID');
  if (dictionary.scope.currency_mode !== 'SINGLE_CURRENCY') fail('KPI_CURRENCY_POLICY_INVALID');
  if (dictionary.scope.partial_period_policy !== 'EXPLICIT_WINDOW_NO_IMPLICIT_PRORATION') fail('KPI_PARTIAL_PERIOD_POLICY_INVALID');
  if (!dictionary.kpis || REQUIRED_KPIS.some((id) => !dictionary.kpis[id])) fail('KPI_REQUIRED_DEFINITION_MISSING');
  if (!dictionary.provenance || dictionary.provenance.legacy_total_cells_authoritative !== false) fail('KPI_LEGACY_TRUTH_FORBIDDEN');
  if (dictionary.provenance.ui_or_chart_logic_authoritative !== false) fail('KPI_UI_TRUTH_FORBIDDEN');
  return true;
}

function resolveKpiDefinition(kpiId, version = DICTIONARY.version) {
  validateDictionary();
  if (String(version) !== DICTIONARY.version) fail('KPI_VERSION_UNSUPPORTED');
  const id = String(kpiId || '').toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(DICTIONARY.kpis, id)) fail('KPI_ID_UNKNOWN');
  return DICTIONARY.kpis[id];
}

function filterByPeriod(inputs, period) {
  if (!Array.isArray(inputs)) fail('KPI_TRANSACTIONS_INVALID');
  if (period.kind === 'FULL_INPUT_SET') return inputs.slice();
  return inputs.filter((raw) => {
    const tx = normalizeTransaction(raw);
    const day = tx.occurred_at.slice(0, 10);
    return day >= period.start && day < period.end;
  });
}

function assertSingleCurrency(inputs, currency) {
  const target = String(currency || '').toUpperCase();
  if (!CURRENCY_RE.test(target)) fail('KPI_CURRENCY_INVALID');
  for (const raw of inputs) {
    const tx = normalizeTransaction(raw);
    if (tx.status !== INCLUDED_STATUS) continue;
    if (!CURRENCY_RE.test(tx.currency)) fail('KPI_TRANSACTION_CURRENCY_INVALID');
    if (tx.currency !== target) fail('KPI_MIXED_CURRENCY_UNSUPPORTED');
  }
  return target;
}

function evaluateKpis(inputs, options = {}) {
  validateDictionary();
  const period = normalizePeriod(options.period);
  const scoped = filterByPeriod(inputs, period);
  const currency = assertSingleCurrency(scoped, options.currency);
  const report = aggregateTransactions(scoped);
  const hasBudget = options.budget_minor != null;
  const budgetMinor = hasBudget ? asMinorUnits(options.budget_minor, 'budget_minor') : null;
  const result = {
    schema: KPI_SCHEMA,
    dictionary_version: DICTIONARY.version,
    financial_truth_policy: report.policy_version,
    currency,
    period,
    income_minor: report.income_minor,
    expense_minor: report.external_expense_minor,
    cash_flow_minor: report.cash_flow_minor,
    savings_minor: report.cash_flow_minor,
    budget_variance_minor: hasBudget ? budgetMinor - report.external_expense_minor : null,
    gross_expense_minor: report.gross_expense_minor,
    refund_minor: report.refund_minor,
    transfer_minor: report.transfer_minor,
    included_count: report.included_count,
    excluded_status_count: report.excluded_status_count,
    provenance: Object.freeze({
      dictionary: 'lib/finance/kpi_dictionary.v1.json',
      canonical_policy: report.policy_version,
      legacy_total_cells_used: false,
      ui_logic_used: false
    })
  };
  assertKpiInvariants(result, budgetMinor);
  return Object.freeze(result);
}

function assertKpiInvariants(result, budgetMinor = null) {
  if (!result || result.schema !== KPI_SCHEMA) fail('KPI_RESULT_SCHEMA_INVALID');
  if (result.dictionary_version !== DICTIONARY.version) fail('KPI_RESULT_VERSION_MISMATCH');
  if (result.financial_truth_policy !== POLICY_VERSION) fail('KPI_RESULT_POLICY_MISMATCH');
  if (result.cash_flow_minor !== result.income_minor - result.expense_minor) fail('KPI_CASH_FLOW_INVARIANT_FAILED');
  if (result.savings_minor !== result.cash_flow_minor) fail('KPI_SAVINGS_INVARIANT_FAILED');
  if (budgetMinor == null) {
    if (result.budget_variance_minor !== null) fail('KPI_BUDGET_VARIANCE_UNEXPECTED');
  } else if (result.budget_variance_minor !== budgetMinor - result.expense_minor) {
    fail('KPI_BUDGET_VARIANCE_INVARIANT_FAILED');
  }
  return true;
}

function evaluateKpi(kpiId, inputs, options = {}) {
  const definition = resolveKpiDefinition(kpiId, options.version || DICTIONARY.version);
  const result = evaluateKpis(inputs, options);
  if (definition.output === 'budget_variance_minor' && result.budget_variance_minor == null) fail('KPI_BUDGET_REQUIRED');
  return Object.freeze({
    kpi_id: String(kpiId).toUpperCase(),
    definition,
    value_minor: result[definition.output],
    currency: result.currency,
    period: result.period,
    dictionary_version: result.dictionary_version,
    financial_truth_policy: result.financial_truth_policy
  });
}

module.exports = {
  KPI_SCHEMA,
  DICTIONARY,
  REQUIRED_KPIS,
  validateDictionary,
  resolveKpiDefinition,
  normalizePeriod,
  assertComparablePeriods,
  evaluateKpis,
  evaluateKpi,
  assertKpiInvariants
};
