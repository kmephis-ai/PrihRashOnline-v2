'use strict';

const CONTRACT = require('./long_term_trends.v1.json');
const ANALYTICS = require('./analytics_contract.v1.json');
const SEMANTIC = require('./semantic_registry.v1.json');
const PERIOD = require('./period_engine');
const { DICTIONARY, KPI_SCHEMA } = require('../finance/kpi_dictionary');

const SCHEMA = 'PRH_LONG_TERM_TRENDS_V1';
const VERSION = '1.0.0';
const QUERY_SCHEMA = CONTRACT.schemas.query;
const RESULT_SCHEMA = CONTRACT.schemas.result;
const TELEMETRY_SCHEMA = CONTRACT.schemas.telemetry;

function fail(reason, detail) {
  const error = new Error(detail ? `${reason}:${detail}` : reason);
  error.code = reason;
  throw error;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function exactKeys(value, allowed, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length) fail(reason, extra.join(','));
}

function assertContract() {
  if (CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'TREND-030') fail('TREND_CONTRACT_VERSION_INVALID');
  if (ANALYTICS.schema !== 'PRH_ANALYTICS_CONTRACT_V1' || ANALYTICS.version !== '1.0.0') fail('TREND_ANALYTICS_UPSTREAM_INVALID');
  if (SEMANTIC.schema !== 'PRH_ANALYTICS_SEMANTIC_REGISTRY_V1' || SEMANTIC.version !== '1.0.0') fail('TREND_SEMANTIC_UPSTREAM_INVALID');
  if (PERIOD.CONTRACT.schema !== 'PRH_ANALYTICS_PERIOD_ENGINE_V1' || PERIOD.CONTRACT.version !== '1.0.0') fail('TREND_PERIOD_UPSTREAM_INVALID');
  if (KPI_SCHEMA !== 'PRH_KPI_DICTIONARY_V1' || DICTIONARY.version !== '1.0.0' || DICTIONARY.financial_truth_policy !== 'FIN-TRUTH-v1') fail('TREND_KPI_UPSTREAM_INVALID');
  if (CONTRACT.upstream.analytics_contract !== `${ANALYTICS.schema}@${ANALYTICS.version}` ||
      CONTRACT.upstream.semantic_registry !== `${SEMANTIC.schema}@${SEMANTIC.version}` ||
      CONTRACT.upstream.period_engine !== `${PERIOD.CONTRACT.schema}@${PERIOD.CONTRACT.version}` ||
      CONTRACT.upstream.kpi_dictionary !== `${KPI_SCHEMA}@${DICTIONARY.version}` ||
      CONTRACT.upstream.financial_truth_policy !== 'FIN-TRUTH-v1') fail('TREND_UPSTREAM_REFERENCE_INVALID');
  if (CONTRACT.orchestration.execution_engine !== `${PERIOD.CONTRACT.schema}@${PERIOD.CONTRACT.version}` ||
      CONTRACT.orchestration.bucket_query_grain !== 'NONE' || CONTRACT.orchestration.bucket_query_comparison !== 'NONE' ||
      CONTRACT.orchestration.kpi_formula_redefinition !== false || CONTRACT.orchestration.calculated_metric_operators !== false ||
      CONTRACT.orchestration.window_metric_operators !== false || CONTRACT.orchestration.forecasting !== false ||
      CONTRACT.orchestration.benchmarking !== false || CONTRACT.orchestration.budget_variance_temporal_trend !== 'DENY') fail('TREND_ORCHESTRATION_INVALID');
  if (Object.values(CONTRACT.authorities || {}).some((value) => value !== false) || CONTRACT.free_only !== true) fail('TREND_AUTHORITY_INVALID');
  const expectedMeasures = Object.keys(SEMANTIC.measures).filter((id) => id !== 'BUDGET_VARIANCE').sort();
  if (stableStringify(CONTRACT.allowed.measures.slice().sort()) !== stableStringify(expectedMeasures)) fail('TREND_MEASURE_REGISTRY_DRIFT');
  for (const dimension of CONTRACT.allowed.dimensions) {
    if (!SEMANTIC.dimensions[dimension] || SEMANTIC.dimensions[dimension].groupable !== true) fail('TREND_DIMENSION_REGISTRY_DRIFT');
  }
  return true;
}

function enumValue(value, allowed, reason) {
  const text = String(value || '').trim();
  if (!allowed.includes(text)) fail(reason);
  return text;
}

function normalizeUniqueArray(value, allowed, max, reason) {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) fail(reason);
  const output = value.map((item) => enumValue(item, allowed, reason));
  if (new Set(output).size !== output.length) fail(reason);
  return Object.freeze(output.slice());
}

function normalizeDimension(value) {
  if (value == null) return null;
  return enumValue(value, CONTRACT.allowed.dimensions, 'TREND_DIMENSION_INVALID');
}

function normalizeTrend(input) {
  exactKeys(input, ['selector', 'grain', 'comparison_mode'], 'TREND_SPEC_SHAPE_INVALID');
  if (!input.selector || typeof input.selector !== 'object' || Array.isArray(input.selector)) fail('TREND_SELECTOR_INVALID');
  const selectorKind = enumValue(input.selector.kind, CONTRACT.allowed.selectors, 'TREND_SELECTOR_KIND_INVALID');
  const periodSpec = PERIOD.normalizePeriodSpec({
    selector: input.selector,
    grain: enumValue(input.grain, CONTRACT.allowed.grains, 'TREND_GRAIN_INVALID'),
    comparison_mode: enumValue(input.comparison_mode, CONTRACT.allowed.comparison_modes, 'TREND_COMPARISON_INVALID')
  });
  if (periodSpec.selector_kind !== selectorKind) fail('TREND_SELECTOR_NORMALIZATION_INVALID');
  return Object.freeze({ selector: Object.freeze({ ...input.selector }), grain: periodSpec.grain, comparison_mode: periodSpec.comparison_mode, primary: periodSpec.primary });
}

function buildPeriodQuery(normalized) {
  return Object.freeze({
    schema: PERIOD.QUERY_SCHEMA,
    contract_version: PERIOD.VERSION,
    currency: normalized.currency,
    measures: normalized.measures,
    dimensions: normalized.dimension ? Object.freeze([normalized.dimension]) : Object.freeze([]),
    filters: normalized.filters,
    sort: normalized.sort,
    parameters: normalized.parameters,
    limit: normalized.limit,
    period: Object.freeze({ selector: normalized.trend.selector, grain: normalized.trend.grain, comparison_mode: normalized.trend.comparison_mode })
  });
}

function normalizeTrendQuery(input) {
  assertContract();
  exactKeys(input, ['schema', 'contract_version', 'currency', 'measures', 'dimension', 'filters', 'sort', 'parameters', 'limit', 'trend'], 'TREND_QUERY_SHAPE_INVALID');
  if (input.schema !== QUERY_SCHEMA || input.contract_version !== VERSION) fail('TREND_QUERY_VERSION_INVALID');
  const measures = normalizeUniqueArray(input.measures, CONTRACT.allowed.measures, CONTRACT.limits.max_measures, 'TREND_MEASURES_INVALID');
  if (measures.includes('BUDGET_VARIANCE')) fail('TREND_BUDGET_VARIANCE_UNSUPPORTED');
  const dimension = normalizeDimension(input.dimension);
  const trend = normalizeTrend(input.trend);
  const draft = Object.freeze({
    schema: QUERY_SCHEMA,
    contract_version: VERSION,
    currency: input.currency,
    measures,
    dimension,
    filters: Array.isArray(input.filters) ? Object.freeze(input.filters.map((item) => Object.freeze({ ...item }))) : input.filters,
    sort: Array.isArray(input.sort) ? Object.freeze(input.sort.map((item) => Object.freeze({ ...item }))) : input.sort,
    parameters: input.parameters && typeof input.parameters === 'object' && !Array.isArray(input.parameters) ? Object.freeze({ ...input.parameters }) : input.parameters,
    limit: input.limit,
    trend
  });
  const periodQuery = PERIOD.normalizePeriodQuery(buildPeriodQuery(draft));
  if (periodQuery.measures.length !== measures.length || periodQuery.dimensions.length !== (dimension ? 1 : 0)) fail('TREND_PERIOD_QUERY_PARITY_INVALID');
  return Object.freeze({
    schema: QUERY_SCHEMA,
    contract_version: VERSION,
    currency: periodQuery.currency,
    measures: periodQuery.measures,
    dimension,
    filters: periodQuery.filters,
    sort: periodQuery.sort,
    parameters: periodQuery.parameters,
    limit: periodQuery.limit,
    trend
  });
}

function evaluateLongTermTrend(transactions, input) {
  const query = normalizeTrendQuery(input);
  const periodQuery = buildPeriodQuery(query);
  const periodResult = PERIOD.evaluatePeriodSeries(transactions, periodQuery);
  return Object.freeze({
    schema: RESULT_SCHEMA,
    contract_version: VERSION,
    measure_ids: query.measures,
    dimension_id: query.dimension,
    selector_kind: periodResult.selector_kind,
    grain: periodResult.grain,
    comparison_mode: periodResult.comparison_mode,
    primary_buckets: periodResult.primary_buckets,
    comparison_buckets: periodResult.comparison_buckets,
    primary_range: periodResult.primary_range,
    comparison: periodResult.comparison,
    provenance: Object.freeze({
      trend_contract: `${SCHEMA}@${VERSION}`,
      period_engine: `${PERIOD.CONTRACT.schema}@${PERIOD.CONTRACT.version}`,
      analytics_contract: `${ANALYTICS.schema}@${ANALYTICS.version}`,
      semantic_registry: `${SEMANTIC.schema}@${SEMANTIC.version}`,
      kpi_dictionary: `${KPI_SCHEMA}@${DICTIONARY.version}`,
      financial_truth_policy: 'FIN-TRUTH-v1',
      formula_layer_added: false,
      period_result_passthrough: true
    })
  });
}

function serializeTrendDefinition(input) {
  const query = normalizeTrendQuery(input);
  const safe = {
    schema: QUERY_SCHEMA,
    contract_version: VERSION,
    measures: query.measures.slice(),
    dimension: query.dimension,
    trend: {
      selector: { ...query.trend.selector },
      grain: query.trend.grain,
      comparison_mode: query.trend.comparison_mode
    },
    filter_count: query.filters.length
  };
  return stableStringify(safe);
}

function trendTelemetry(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.contract_version !== VERSION) fail('TREND_RESULT_INVALID');
  const primaryPartial = result.primary_range.partial === true || result.primary_buckets.some((bucket) => bucket.partial === true);
  const output = {
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    selector_kind: result.selector_kind,
    grain: result.grain,
    comparison_mode: result.comparison_mode,
    measure_count: result.measure_ids.length,
    dimension_count: result.dimension_id ? 1 : 0,
    filter_count: 0,
    primary_bucket_count: result.primary_buckets.length,
    comparison_bucket_count: result.comparison_buckets.length,
    primary_partial: primaryPartial,
    comparison_quality: result.comparison ? result.comparison.quality : 'NONE',
    leap_adjusted: result.comparison ? result.comparison.leap_adjusted === true : false
  };
  const extra = Object.keys(output).filter((key) => !CONTRACT.telemetry_allowlist.includes(key));
  if (extra.length) fail('TREND_TELEMETRY_FIELD_FORBIDDEN', extra.join(','));
  return Object.freeze(output);
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  QUERY_SCHEMA,
  RESULT_SCHEMA,
  TELEMETRY_SCHEMA,
  assertContract,
  stableStringify,
  normalizeTrend,
  normalizeTrendQuery,
  buildPeriodQuery,
  evaluateLongTermTrend,
  serializeTrendDefinition,
  trendTelemetry
});
