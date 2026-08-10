'use strict';

const CONTRACT = require('./cash_flow_projection.v1.json');
const TREND = require('../analytics/long_term_trends');
const PERIOD = require('../analytics/period_engine');
const ANALYTICS = require('../analytics/analytics_contract.v1.json');
const { DICTIONARY, KPI_SCHEMA } = require('../finance/kpi_dictionary');

const SCHEMA = 'PRH_CASH_FLOW_PROJECTION_V1';
const VERSION = '1.0.0';
const SCENARIO_SCHEMA = CONTRACT.schemas.scenario;
const RESULT_SCHEMA = CONTRACT.schemas.result;
const TELEMETRY_SCHEMA = CONTRACT.schemas.telemetry;
const MONTH_START_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;

function fail(reason, detail) {
  const error = new Error(detail ? `${reason}:${detail}` : reason);
  error.code = reason;
  throw error;
}

function exactKeys(value, allowed, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) fail(reason, extra.join(','));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function assertContract() {
  if (CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'PROJ-030') fail('PROJECTION_CONTRACT_VERSION_INVALID');
  if (TREND.CONTRACT.schema !== 'PRH_LONG_TERM_TRENDS_V1' || TREND.CONTRACT.version !== '1.0.0') fail('PROJECTION_TREND_UPSTREAM_INVALID');
  if (PERIOD.CONTRACT.schema !== 'PRH_ANALYTICS_PERIOD_ENGINE_V1' || PERIOD.CONTRACT.version !== '1.0.0') fail('PROJECTION_PERIOD_UPSTREAM_INVALID');
  if (ANALYTICS.schema !== 'PRH_ANALYTICS_CONTRACT_V1' || ANALYTICS.version !== '1.0.0') fail('PROJECTION_ANALYTICS_UPSTREAM_INVALID');
  if (KPI_SCHEMA !== 'PRH_KPI_DICTIONARY_V1' || DICTIONARY.version !== '1.0.0' || DICTIONARY.financial_truth_policy !== 'FIN-TRUTH-v1') fail('PROJECTION_KPI_UPSTREAM_INVALID');
  if (CONTRACT.upstream.trend !== `${TREND.CONTRACT.schema}@${TREND.CONTRACT.version}` ||
      CONTRACT.upstream.period_engine !== `${PERIOD.CONTRACT.schema}@${PERIOD.CONTRACT.version}` ||
      CONTRACT.upstream.analytics_contract !== `${ANALYTICS.schema}@${ANALYTICS.version}` ||
      CONTRACT.upstream.kpi_dictionary !== `${KPI_SCHEMA}@${DICTIONARY.version}` ||
      CONTRACT.upstream.financial_truth_policy !== 'FIN-TRUTH-v1') fail('PROJECTION_UPSTREAM_REFERENCE_INVALID');
  if (CONTRACT.baseline.model_id !== 'ROLLING_MEAN_3_COMPLETE_MONTHS_V1' || CONTRACT.baseline.model_kind !== 'DETERMINISTIC_BASELINE' ||
      CONTRACT.baseline.window_months !== 3 || CONTRACT.baseline.future_policy !== 'FIXED_ORIGIN_MEAN' ||
      CONTRACT.baseline.rounding !== 'INTEGER_DIVISION_HALF_AWAY_FROM_ZERO' || CONTRACT.baseline.future_fact_access !== false || CONTRACT.baseline.ml_required !== false) fail('PROJECTION_BASELINE_POLICY_INVALID');
  if (CONTRACT.backtest.mode !== 'WALK_FORWARD_OBSERVED_ONLY' || CONTRACT.backtest.window_months !== 3 || CONTRACT.backtest.minimum_samples !== 3) fail('PROJECTION_BACKTEST_POLICY_INVALID');
  if (CONTRACT.uncertainty.method !== 'BACKTEST_MAE_SYMMETRIC' || CONTRACT.uncertainty.statistical_confidence_interval !== false) fail('PROJECTION_UNCERTAINTY_POLICY_INVALID');
  if (CONTRACT.result.financial_truth !== false || CONTRACT.result.projection_not_observation !== true) fail('PROJECTION_RESULT_POLICY_INVALID');
  if (Object.values(CONTRACT.authorities || {}).some((value) => value !== false) || CONTRACT.free_only !== true) fail('PROJECTION_AUTHORITY_INVALID');
  return true;
}

function safeInteger(value, reason) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail(reason);
  return number;
}

function safeAdd(a, b, reason = 'PROJECTION_SAFE_INTEGER_OVERFLOW') {
  const result = a + b;
  if (!Number.isSafeInteger(result)) fail(reason);
  return result;
}

function safeSub(a, b, reason = 'PROJECTION_SAFE_INTEGER_OVERFLOW') {
  const result = a - b;
  if (!Number.isSafeInteger(result)) fail(reason);
  return result;
}

function absSafe(value) {
  if (!Number.isSafeInteger(value) || value === Number.MIN_SAFE_INTEGER) fail('PROJECTION_SAFE_INTEGER_OVERFLOW');
  const result = Math.abs(value);
  if (!Number.isSafeInteger(result)) fail('PROJECTION_SAFE_INTEGER_OVERFLOW');
  return result;
}

function roundDivideHalfAwayFromZero(numerator, denominator) {
  numerator = safeInteger(numerator, 'PROJECTION_DIVIDEND_INVALID');
  denominator = safeInteger(denominator, 'PROJECTION_DIVISOR_INVALID');
  if (denominator <= 0) fail('PROJECTION_DIVISOR_INVALID');
  const quotient = Math.trunc(numerator / denominator);
  const remainder = numerator % denominator;
  if (absSafe(remainder) * 2 < denominator) return quotient;
  return quotient + (numerator < 0 ? -1 : 1);
}

function meanMinor(values) {
  if (!Array.isArray(values) || values.length < 1) fail('PROJECTION_MEAN_VALUES_INVALID');
  let sum = 0;
  for (const value of values) sum = safeAdd(sum, safeInteger(value, 'PROJECTION_MEAN_VALUE_INVALID'));
  return roundDivideHalfAwayFromZero(sum, values.length);
}

function addMonths(monthStart, delta) {
  if (!MONTH_START_RE.test(monthStart)) fail('PROJECTION_MONTH_INVALID');
  const [year, month] = monthStart.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = ((index % 12) + 12) % 12 + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
}

function normalizeScenario(input) {
  assertContract();
  exactKeys(input, ['schema', 'version', 'horizon_months', 'monthly_adjustment_minor', 'one_off_adjustments'], 'PROJECTION_SCENARIO_SHAPE_INVALID');
  if (input.schema !== SCENARIO_SCHEMA || input.version !== VERSION) fail('PROJECTION_SCENARIO_VERSION_INVALID');
  const horizon = safeInteger(input.horizon_months, 'PROJECTION_HORIZON_INVALID');
  if (horizon < CONTRACT.scenario.horizon_months.minimum || horizon > CONTRACT.scenario.horizon_months.maximum) fail('PROJECTION_HORIZON_INVALID');
  const monthlyAdjustment = safeInteger(input.monthly_adjustment_minor, 'PROJECTION_MONTHLY_ADJUSTMENT_INVALID');
  if (!Array.isArray(input.one_off_adjustments) || input.one_off_adjustments.length > CONTRACT.scenario.one_off_adjustments.maximum) fail('PROJECTION_ONE_OFF_LIST_INVALID');
  const oneOffs = input.one_off_adjustments.map((item) => {
    exactKeys(item, ['month', 'delta_minor'], 'PROJECTION_ONE_OFF_SHAPE_INVALID');
    if (!MONTH_START_RE.test(String(item.month || ''))) fail('PROJECTION_ONE_OFF_MONTH_INVALID');
    return Object.freeze({ month: item.month, delta_minor: safeInteger(item.delta_minor, 'PROJECTION_ONE_OFF_AMOUNT_INVALID') });
  }).sort((a, b) => a.month.localeCompare(b.month));
  if (new Set(oneOffs.map((item) => item.month)).size !== oneOffs.length) fail('PROJECTION_ONE_OFF_MONTH_DUPLICATE');
  return Object.freeze({ schema: SCENARIO_SCHEMA, version: VERSION, horizon_months: horizon, monthly_adjustment_minor: monthlyAdjustment, one_off_adjustments: Object.freeze(oneOffs) });
}

function extractObservedMonths(trendResult) {
  assertContract();
  if (!trendResult || trendResult.schema !== TREND.RESULT_SCHEMA || trendResult.contract_version !== TREND.VERSION) fail('PROJECTION_OBSERVED_SCHEMA_INVALID');
  if (trendResult.grain !== CONTRACT.observed_input.required_grain || trendResult.dimension_id !== null || trendResult.comparison_mode !== CONTRACT.observed_input.required_comparison) fail('PROJECTION_OBSERVED_SHAPE_INVALID');
  if (!Array.isArray(trendResult.measure_ids) || !trendResult.measure_ids.includes(CONTRACT.observed_input.required_measure)) fail('PROJECTION_CASH_FLOW_MEASURE_REQUIRED');
  if (!Array.isArray(trendResult.primary_buckets)) fail('PROJECTION_OBSERVED_BUCKETS_INVALID');
  const observed = [];
  for (const bucket of trendResult.primary_buckets) {
    if (bucket.partial === true) continue;
    if (!MONTH_START_RE.test(bucket.start) || addMonths(bucket.start, 1) !== bucket.end) fail('PROJECTION_OBSERVED_MONTH_BUCKET_INVALID');
    const result = bucket.analytics_result;
    if (!result || !Array.isArray(result.rows) || result.rows.length !== 1 || result.grain !== 'NONE') fail('PROJECTION_OBSERVED_ANALYTICS_INVALID');
    const value = result.rows[0] && result.rows[0].measures ? result.rows[0].measures.CASH_FLOW : undefined;
    observed.push(Object.freeze({ month: bucket.start, cash_flow_minor: safeInteger(value, 'PROJECTION_OBSERVED_CASH_FLOW_INVALID') }));
  }
  observed.sort((a, b) => a.month.localeCompare(b.month));
  if (observed.length < CONTRACT.observed_input.minimum_complete_months) fail('PROJECTION_OBSERVED_HISTORY_TOO_SHORT');
  for (let index = 1; index < observed.length; index += 1) {
    if (addMonths(observed[index - 1].month, 1) !== observed[index].month) fail('PROJECTION_OBSERVED_MONTH_GAP');
  }
  return Object.freeze(observed);
}

function backtestObserved(observed) {
  if (!Array.isArray(observed) || observed.length < CONTRACT.observed_input.minimum_complete_months) fail('PROJECTION_OBSERVED_HISTORY_TOO_SHORT');
  const window = CONTRACT.backtest.window_months;
  const points = [];
  let absErrorSum = 0;
  let errorSum = 0;
  for (let index = window; index < observed.length; index += 1) {
    const prediction = meanMinor(observed.slice(index - window, index).map((item) => item.cash_flow_minor));
    const actual = observed[index].cash_flow_minor;
    const error = safeSub(actual, prediction);
    absErrorSum = safeAdd(absErrorSum, absSafe(error));
    errorSum = safeAdd(errorSum, error);
    points.push(Object.freeze({ month: observed[index].month, prediction_minor: prediction, actual_minor: actual, error_minor: error }));
  }
  if (points.length < CONTRACT.backtest.minimum_samples) fail('PROJECTION_BACKTEST_SAMPLES_INSUFFICIENT');
  return Object.freeze({
    mode: CONTRACT.backtest.mode,
    window_months: window,
    sample_count: points.length,
    mean_absolute_error_minor: roundDivideHalfAwayFromZero(absErrorSum, points.length),
    mean_error_minor: roundDivideHalfAwayFromZero(errorSum, points.length),
    points: Object.freeze(points)
  });
}

function projectCashFlow(trendResult, scenarioInput) {
  const observed = extractObservedMonths(trendResult);
  const scenario = normalizeScenario(scenarioInput);
  const backtest = backtestObserved(observed);
  const window = CONTRACT.baseline.window_months;
  const originValues = observed.slice(-window).map((item) => item.cash_flow_minor);
  const baseline = meanMinor(originValues);
  const nextMonth = addMonths(observed[observed.length - 1].month, 1);
  const oneOffByMonth = new Map(scenario.one_off_adjustments.map((item) => [item.month, item.delta_minor]));
  const allowedMonths = new Set(Array.from({ length: scenario.horizon_months }, (_, index) => addMonths(nextMonth, index)));
  for (const item of scenario.one_off_adjustments) {
    if (!allowedMonths.has(item.month)) fail('PROJECTION_ONE_OFF_OUTSIDE_HORIZON');
  }
  const forecast = [];
  for (let index = 0; index < scenario.horizon_months; index += 1) {
    const month = addMonths(nextMonth, index);
    const oneOff = oneOffByMonth.get(month) || 0;
    const scenarioAdjustment = safeAdd(scenario.monthly_adjustment_minor, oneOff);
    const projected = safeAdd(baseline, scenarioAdjustment);
    const lower = safeSub(projected, backtest.mean_absolute_error_minor);
    const upper = safeAdd(projected, backtest.mean_absolute_error_minor);
    forecast.push(Object.freeze({
      month,
      baseline_cash_flow_minor: baseline,
      scenario_adjustment_minor: scenarioAdjustment,
      projected_cash_flow_minor: projected,
      uncertainty_lower_minor: lower,
      uncertainty_upper_minor: upper
    }));
  }
  return Object.freeze({
    schema: RESULT_SCHEMA,
    version: VERSION,
    model_id: CONTRACT.baseline.model_id,
    model_kind: CONTRACT.baseline.model_kind,
    observed_complete_months: observed.length,
    observed_range: Object.freeze({ start: observed[0].month, end: addMonths(observed[observed.length - 1].month, 1) }),
    scenario,
    backtest,
    uncertainty: Object.freeze({ method: CONTRACT.uncertainty.method, statistical_confidence_interval: false, half_width_minor: backtest.mean_absolute_error_minor }),
    forecast: Object.freeze(forecast),
    provenance: Object.freeze({
      projection_contract: `${SCHEMA}@${VERSION}`,
      trend_contract: `${TREND.CONTRACT.schema}@${TREND.CONTRACT.version}`,
      period_engine: `${PERIOD.CONTRACT.schema}@${PERIOD.CONTRACT.version}`,
      analytics_contract: `${ANALYTICS.schema}@${ANALYTICS.version}`,
      kpi_dictionary: `${KPI_SCHEMA}@${DICTIONARY.version}`,
      financial_truth_policy: 'FIN-TRUTH-v1',
      financial_truth: false,
      projection_not_observation: true,
      future_fact_access: false,
      scenario_separate_from_observed: true,
      canonical_mutation: false
    })
  });
}

function projectionTelemetry(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.version !== VERSION) fail('PROJECTION_RESULT_INVALID');
  const output = {
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    model_id: result.model_id,
    model_kind: result.model_kind,
    observed_complete_months: result.observed_complete_months,
    backtest_samples: result.backtest.sample_count,
    horizon_months: result.scenario.horizon_months,
    scenario_one_off_count: result.scenario.one_off_adjustments.length,
    uncertainty_method: result.uncertainty.method,
    status: 'OK',
    reason_code: 'OK'
  };
  const extra = Object.keys(output).filter((key) => !CONTRACT.telemetry_allowlist.includes(key));
  if (extra.length) fail('PROJECTION_TELEMETRY_FIELD_FORBIDDEN', extra.join(','));
  return Object.freeze(output);
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  SCENARIO_SCHEMA,
  RESULT_SCHEMA,
  TELEMETRY_SCHEMA,
  assertContract,
  stableStringify,
  roundDivideHalfAwayFromZero,
  meanMinor,
  addMonths,
  normalizeScenario,
  extractObservedMonths,
  backtestObserved,
  projectCashFlow,
  projectionTelemetry
});
