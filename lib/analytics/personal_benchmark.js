'use strict';

const CONTRACT = require('./personal_benchmark.v1.json');
const SEMANTIC = require('./semantic_registry.v1.json');
const PERIOD = require('./period_engine');
const CALC = require('./calculated_metrics');
const SCOPE = require('./analytics_scope');
const ANALYTICS = require('./analytics_engine');

const SCHEMA = 'PRH_PERSONAL_BENCHMARK_V1';
const VERSION = '1.0.0';
const SPEC_SCHEMA = 'PRH_PERSONAL_BENCHMARK_SPEC_V1';
const SOURCE_SCHEMA = 'PRH_PERSONAL_BENCHMARK_SOURCE_V1';
const RESULT_SCHEMA = 'PRH_PERSONAL_BENCHMARK_RESULT_V1';
const MONEY_REFERENCE_SCHEMA = 'PRH_PERSONAL_BENCHMARK_MONEY_REFERENCE_V1';
const MANUAL_INDEX_SCHEMA = 'PRH_PERSONAL_BENCHMARK_MANUAL_INDEX_V1';
const COMPARISON_TYPES = Object.freeze(Object.keys(CONTRACT.comparison_types));
const RATIO_SCALE = CALC.RATIO_SCALE;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function exactKeys(value, keys, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(reason);
  return value;
}

function safeInteger(value, reason) {
  if (!Number.isSafeInteger(value)) fail(reason);
  return value;
}

function safeBigIntToNumber(value, reason) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || BigInt(number) !== value) fail(reason);
  return number;
}

function safeAdd(left, right) {
  safeInteger(left, 'BENCH_MONEY_VALUE_INVALID');
  safeInteger(right, 'BENCH_MONEY_VALUE_INVALID');
  return safeBigIntToNumber(BigInt(left) + BigInt(right), 'BENCH_MONEY_OVERFLOW');
}

function roundBigRatioHalfAway(numerator, denominator) {
  if (typeof numerator !== 'bigint' || typeof denominator !== 'bigint' || denominator === 0n) {
    fail('BENCH_RATIO_INVALID');
  }
  const negative = (numerator < 0n) !== (denominator < 0n);
  const top = numerator < 0n ? -numerator : numerator;
  const bottom = denominator < 0n ? -denominator : denominator;
  let quotient = top / bottom;
  const remainder = top % bottom;
  if (remainder * 2n >= bottom) quotient += 1n;
  if (negative) quotient = -quotient;
  return safeBigIntToNumber(quotient, 'BENCH_RATIO_OVERFLOW');
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION ||
      CONTRACT.roadmap_id !== 'BENCH-070' || CONTRACT.spec_schema !== SPEC_SCHEMA ||
      CONTRACT.source_schema !== SOURCE_SCHEMA || CONTRACT.result_schema !== RESULT_SCHEMA ||
      CONTRACT.money_reference_schema !== MONEY_REFERENCE_SCHEMA || CONTRACT.manual_index_schema !== MANUAL_INDEX_SCHEMA) {
    fail('BENCH_CONTRACT_VERSION_INVALID');
  }
  const upstream = CONTRACT.upstream || {};
  if (upstream.analytics_contract !== 'PRH_ANALYTICS_CONTRACT_V1@1.0.0' ||
      upstream.semantic_registry !== `${SEMANTIC.schema}@${SEMANTIC.version}` ||
      upstream.period_engine !== `${PERIOD.SCHEMA}@${PERIOD.VERSION}` ||
      upstream.calculated_metrics !== `${CALC.SCHEMA}@${CALC.VERSION}` ||
      upstream.analytics_scope !== `${SCOPE.SCHEMA}@${SCOPE.VERSION}` ||
      upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('BENCH_UPSTREAM_CONTRACT_INVALID');
  }
  const principles = CONTRACT.principles || {};
  if (principles.allowlisted_comparisons_only !== true ||
      principles.period_semantics_redefined !== false || principles.calculated_delta_formula_duplicated !== false ||
      principles.scope_semantics_redefined !== false || principles.declared_reference_is_financial_truth !== false ||
      principles.renderer_neutral !== true || principles.storage_neutral !== true ||
      principles.core_network_required !== false || principles.external_market_provider_required !== false ||
      principles.paid_provider_required !== false || principles.financial_values_embedded_in_spec !== false ||
      principles.financial_values_allowed_in_public_telemetry !== false || principles.free_only !== true) {
    fail('BENCH_BOUNDARY_INVALID');
  }
  const expectedTypes = ['PREVIOUS_COMPARABLE_PERIOD', 'PERSONAL_ROLLING_BASELINE', 'BUDGET', 'TARGET', 'MANUAL_INDEX'];
  if (JSON.stringify(COMPARISON_TYPES.slice().sort()) !== JSON.stringify(expectedTypes.sort())) fail('BENCH_COMPARISON_SET_INVALID');
  if (!CONTRACT.authorities || Object.values(CONTRACT.authorities).some((value) => value !== false)) fail('BENCH_AUTHORITY_INVALID');
  return true;
}

function normalizeMeasure(value) {
  const measure = String(value || '').trim();
  const definition = SEMANTIC.measures[measure];
  if (!definition) fail('BENCH_MEASURE_UNKNOWN');
  if (definition.additive !== true) fail('BENCH_MEASURE_NON_ADDITIVE_UNSUPPORTED');
  return measure;
}

function normalizeOptions(type, input) {
  const options = input == null ? {} : input;
  if (type === 'PERSONAL_ROLLING_BASELINE') {
    exactKeys(options, ['window', 'partial_window'], 'BENCH_OPTIONS_SHAPE_INVALID');
    const window = Number(options.window);
    if (!Number.isInteger(window) || window < 2 || window > CONTRACT.limits.max_rolling_window) fail('BENCH_ROLLING_WINDOW_INVALID');
    const partialWindow = String(options.partial_window || '');
    if (!CONTRACT.comparison_types.PERSONAL_ROLLING_BASELINE.options.partial_window.includes(partialWindow)) {
      fail('BENCH_ROLLING_PARTIAL_POLICY_INVALID');
    }
    return Object.freeze({ window, partial_window: partialWindow });
  }
  exactKeys(options, [], 'BENCH_OPTIONS_SHAPE_INVALID');
  return Object.freeze({});
}

function normalizeBenchmarkSpec(input) {
  assertContract();
  exactKeys(input, ['schema', 'contract_version', 'comparison_type', 'measure', 'options'], 'BENCH_SPEC_SHAPE_INVALID');
  if (input.schema !== SPEC_SCHEMA || input.contract_version !== VERSION) fail('BENCH_SPEC_VERSION_INVALID');
  const comparisonType = String(input.comparison_type || '').trim();
  if (!COMPARISON_TYPES.includes(comparisonType)) fail('BENCH_COMPARISON_TYPE_UNKNOWN');
  const measure = normalizeMeasure(input.measure);
  const options = normalizeOptions(comparisonType, input.options);
  return Object.freeze({
    schema: SPEC_SCHEMA,
    contract_version: VERSION,
    comparison_type: comparisonType,
    measure,
    options
  });
}

function serializeBenchmarkSpec(input) {
  return ANALYTICS.stableStringify(normalizeBenchmarkSpec(input));
}

function scalarValue(result, measure) {
  if (!result || result.schema !== ANALYTICS.RESULT_SCHEMA || result.contract_version !== ANALYTICS.CONTRACT_VERSION ||
      result.truncated !== false || result.total_rows !== 1 || !Array.isArray(result.rows) || result.rows.length !== 1) {
    fail('BENCH_ANALYTICS_RESULT_NOT_SCALAR');
  }
  if (!result.provenance || result.provenance.financial_truth_policy !== 'FIN-TRUTH-v1' ||
      result.provenance.legacy_total_cells_used !== false || result.provenance.ui_logic_used !== false) {
    fail('BENCH_ANALYTICS_PROVENANCE_INVALID');
  }
  const row = result.rows[0];
  if (!row || !row.dimensions || Object.keys(row.dimensions).length !== 0 || !row.measures) fail('BENCH_ANALYTICS_RESULT_NOT_SCALAR');
  return safeInteger(row.measures[measure], 'BENCH_MONEY_VALUE_INVALID');
}

function assertPeriodResult(result, measure) {
  if (!result || result.schema !== PERIOD.RESULT_SCHEMA || result.contract_version !== PERIOD.VERSION ||
      !Array.isArray(result.primary_buckets) || result.primary_buckets.length < 1 ||
      result.primary_buckets.length > CONTRACT.limits.max_source_buckets) {
    fail('BENCH_PERIOD_RESULT_INVALID');
  }
  if (!result.primary_range || !result.provenance ||
      result.provenance.period_engine !== `${PERIOD.SCHEMA}@${PERIOD.VERSION}` ||
      result.provenance.semantic_registry !== `${SEMANTIC.schema}@${SEMANTIC.version}` ||
      result.provenance.financial_truth_policy !== 'FIN-TRUTH-v1' || result.provenance.orchestration_only !== true) {
    fail('BENCH_PERIOD_PROVENANCE_INVALID');
  }
  let currency = null;
  for (const bucket of result.primary_buckets) {
    scalarValue(bucket.analytics_result, measure);
    const currentCurrency = String(bucket.analytics_result.currency || '');
    if (!currentCurrency) fail('BENCH_CURRENCY_INVALID');
    if (currency == null) currency = currentCurrency;
    if (currentCurrency !== currency) fail('BENCH_CURRENCY_MISMATCH');
  }
  if (Array.isArray(result.comparison_buckets)) {
    for (const bucket of result.comparison_buckets) {
      scalarValue(bucket.analytics_result, measure);
      if (String(bucket.analytics_result.currency || '') !== currency) fail('BENCH_CURRENCY_MISMATCH');
    }
  }
  return currency;
}

function normalizeBenchmarkSource(input, measure) {
  exactKeys(input, ['schema', 'contract_version', 'scope', 'period_result'], 'BENCH_SOURCE_SHAPE_INVALID');
  if (input.schema !== SOURCE_SCHEMA || input.contract_version !== VERSION) fail('BENCH_SOURCE_VERSION_INVALID');
  const scope = SCOPE.normalizeScopeSpec(input.scope);
  const currency = assertPeriodResult(input.period_result, measure);
  return Object.freeze({
    schema: SOURCE_SCHEMA,
    contract_version: VERSION,
    scope,
    scope_serialized: SCOPE.serializeScopeSpec(scope),
    period_result: input.period_result,
    currency
  });
}

function periodTotal(result, measure, buckets) {
  let total = 0;
  for (const bucket of buckets) total = safeAdd(total, scalarValue(bucket.analytics_result, measure));
  return total;
}

function aggregateAnalyticsResult(template, measure, value, currency) {
  return Object.freeze({
    schema: ANALYTICS.RESULT_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    query_id: 'BENCH_INTERNAL_AGGREGATE',
    currency,
    grain: 'NONE',
    dimensions: Object.freeze([]),
    rows: Object.freeze([Object.freeze({
      dimensions: Object.freeze({}),
      measures: Object.freeze({ [measure]: value })
    })]),
    total_rows: 1,
    truncated: false,
    provenance: Object.freeze({
      financial_truth_policy: 'FIN-TRUTH-v1',
      legacy_total_cells_used: false,
      ui_logic_used: false
    })
  });
}

function aggregateBucket(template, measure, value, currency, key, start, end) {
  return Object.freeze({
    key,
    start,
    end,
    day_count: PERIOD.daysBetween(start, end),
    partial: template && template.partial === true,
    natural_start: start,
    natural_end: end,
    analytics_result: aggregateAnalyticsResult(template && template.analytics_result, measure, value, currency)
  });
}

function compactPreviousComparison(source, measure) {
  const result = source.period_result;
  if (result.comparison_mode !== 'PREVIOUS_COMPARABLE_PERIOD' || !result.comparison ||
      !Array.isArray(result.comparison_buckets) || result.comparison_buckets.length < 1) {
    fail('BENCH_PREVIOUS_COMPARISON_REQUIRED');
  }
  const current = periodTotal(result, measure, result.primary_buckets);
  const reference = periodTotal(result, measure, result.comparison_buckets);
  const primaryRange = result.primary_range;
  const comparison = result.comparison;
  const primaryBucket = aggregateBucket(result.primary_buckets[0], measure, current, source.currency,
    'BENCH_PRIMARY_TOTAL', primaryRange.start, primaryRange.end);
  const referenceBucket = aggregateBucket(result.comparison_buckets[0], measure, reference, source.currency,
    'BENCH_REFERENCE_TOTAL', comparison.start, comparison.end);
  return Object.freeze({
    schema: PERIOD.RESULT_SCHEMA,
    contract_version: PERIOD.VERSION,
    selector_kind: result.selector_kind,
    grain: 'NONE',
    comparison_mode: 'PREVIOUS_COMPARABLE_PERIOD',
    primary_range: primaryRange,
    comparison,
    primary_buckets: Object.freeze([primaryBucket]),
    comparison_buckets: Object.freeze([referenceBucket]),
    provenance: result.provenance
  });
}

function deltaFromCalculated(compact, measure) {
  const absolute = CALC.evaluateCalculatedMetric(compact, {
    schema: CALC.SPEC_SCHEMA,
    contract_version: CALC.VERSION,
    operator: 'DELTA_ABS',
    measure,
    options: { reference: 'PERIOD_COMPARISON' }
  });
  const percent = CALC.evaluateCalculatedMetric(compact, {
    schema: CALC.SPEC_SCHEMA,
    contract_version: CALC.VERSION,
    operator: 'DELTA_PCT',
    measure,
    options: { reference: 'PERIOD_COMPARISON' }
  });
  return Object.freeze({
    current_minor: absolute.rows[0].source_value_minor,
    reference_minor: absolute.rows[0].reference_value_minor,
    delta_minor: absolute.rows[0].value_minor,
    delta_ppm: percent.rows[0].value_ppm,
    status: percent.rows[0].status
  });
}

function exactMoneyDelta(current, reference) {
  safeInteger(current, 'BENCH_MONEY_VALUE_INVALID');
  safeInteger(reference, 'BENCH_MONEY_VALUE_INVALID');
  const delta = safeBigIntToNumber(BigInt(current) - BigInt(reference), 'BENCH_MONEY_OVERFLOW');
  if (reference === 0) {
    return Object.freeze({
      current_minor: current,
      reference_minor: reference,
      delta_minor: delta,
      delta_ppm: current === 0 ? 0 : null,
      status: current === 0 ? 'ZERO_REFERENCE_NO_CHANGE' : 'ZERO_REFERENCE_UNDEFINED'
    });
  }
  const ppm = roundBigRatioHalfAway(BigInt(delta) * BigInt(RATIO_SCALE), BigInt(reference));
  return Object.freeze({ current_minor: current, reference_minor: reference, delta_minor: delta, delta_ppm: ppm, status: 'OK' });
}

function normalizeReferencePeriod(value, source) {
  exactKeys(value, ['start', 'end'], 'BENCH_REFERENCE_PERIOD_SHAPE_INVALID');
  PERIOD.parseDate(value.start);
  PERIOD.parseDate(value.end);
  if (PERIOD.daysBetween(value.start, value.end) <= 0) fail('BENCH_REFERENCE_PERIOD_INVALID');
  if (value.start !== source.period_result.primary_range.start || value.end !== source.period_result.primary_range.end) {
    fail('BENCH_REFERENCE_PERIOD_MISMATCH');
  }
  return Object.freeze({ start: value.start, end: value.end });
}

function normalizeReferenceScope(value, source) {
  const scope = SCOPE.normalizeScopeSpec(value);
  if (SCOPE.serializeScopeSpec(scope) !== source.scope_serialized) fail('BENCH_REFERENCE_SCOPE_MISMATCH');
  return scope;
}

function normalizeMoneyReference(input, expectedKind, source) {
  exactKeys(input, ['schema', 'contract_version', 'kind', 'currency', 'scope', 'period', 'value_minor', 'provenance'], 'BENCH_REFERENCE_SHAPE_INVALID');
  if (input.schema !== MONEY_REFERENCE_SCHEMA || input.contract_version !== VERSION || input.kind !== expectedKind) {
    fail('BENCH_REFERENCE_VERSION_OR_KIND_INVALID');
  }
  if (String(input.currency || '') !== source.currency) fail('BENCH_REFERENCE_CURRENCY_MISMATCH');
  normalizeReferenceScope(input.scope, source);
  normalizeReferencePeriod(input.period, source);
  const expectedProvenance = expectedKind === 'BUDGET' ? 'DECLARED_BUDGET' : 'DECLARED_TARGET';
  if (input.provenance !== expectedProvenance) fail('BENCH_REFERENCE_PROVENANCE_INVALID');
  return Object.freeze({
    kind: expectedKind,
    value_minor: safeInteger(input.value_minor, 'BENCH_REFERENCE_VALUE_INVALID'),
    provenance: input.provenance
  });
}

function normalizeManualIndex(input, source) {
  exactKeys(input, ['schema', 'contract_version', 'currency', 'scope', 'period', 'base_minor', 'index_ppm', 'provenance'], 'BENCH_MANUAL_INDEX_SHAPE_INVALID');
  if (input.schema !== MANUAL_INDEX_SCHEMA || input.contract_version !== VERSION || input.provenance !== 'USER_DEFINED_MANUAL_INDEX') {
    fail('BENCH_MANUAL_INDEX_VERSION_INVALID');
  }
  if (String(input.currency || '') !== source.currency) fail('BENCH_REFERENCE_CURRENCY_MISMATCH');
  normalizeReferenceScope(input.scope, source);
  normalizeReferencePeriod(input.period, source);
  const base = safeInteger(input.base_minor, 'BENCH_MANUAL_BASE_INVALID');
  if (Math.abs(base) > CONTRACT.limits.max_manual_base_abs_minor) fail('BENCH_MANUAL_BASE_OUT_OF_RANGE');
  const index = Number(input.index_ppm);
  if (!Number.isInteger(index) || index <= 0 || index > CONTRACT.limits.max_manual_index_ppm) fail('BENCH_MANUAL_INDEX_INVALID');
  const product = base * index;
  if (!Number.isSafeInteger(product)) fail('BENCH_MANUAL_REFERENCE_OVERFLOW');
  const reference = CALC.roundRatioHalfAway(product, RATIO_SCALE);
  return Object.freeze({ kind: 'MANUAL_INDEX', value_minor: reference, provenance: input.provenance, index_ppm: index });
}

function rollingBaseline(source, spec) {
  const result = source.period_result;
  if (result.primary_buckets.length < 2) fail('BENCH_ROLLING_HISTORY_INSUFFICIENT');
  const historyBuckets = result.primary_buckets.slice(0, -1);
  const historyStart = historyBuckets[0].start;
  const historyEnd = historyBuckets[historyBuckets.length - 1].end;
  const history = Object.freeze({
    schema: PERIOD.RESULT_SCHEMA,
    contract_version: PERIOD.VERSION,
    selector_kind: result.selector_kind,
    grain: result.grain,
    comparison_mode: 'NONE',
    primary_range: Object.freeze({
      selector_kind: 'EXPLICIT_RANGE',
      start: historyStart,
      end: historyEnd,
      day_count: PERIOD.daysBetween(historyStart, historyEnd),
      partial: historyBuckets.some((bucket) => bucket.partial === true)
    }),
    comparison: null,
    primary_buckets: Object.freeze(historyBuckets.slice()),
    comparison_buckets: Object.freeze([]),
    provenance: result.provenance
  });
  const moving = CALC.evaluateCalculatedMetric(history, {
    schema: CALC.SPEC_SCHEMA,
    contract_version: CALC.VERSION,
    operator: 'MOVING_AVERAGE',
    measure: spec.measure,
    options: { window: spec.options.window, partial_window: spec.options.partial_window }
  });
  const baseline = moving.rows[moving.rows.length - 1];
  if (!baseline || baseline.value_minor == null) fail('BENCH_ROLLING_BASELINE_INCOMPLETE');
  const current = scalarValue(result.primary_buckets[result.primary_buckets.length - 1].analytics_result, spec.measure);
  return Object.freeze({
    delta: exactMoneyDelta(current, baseline.value_minor),
    sample_count: baseline.window_sample_count,
    sample_complete: baseline.window_complete === true,
    quality: baseline.window_complete === true ? 'COMPLETE_BASELINE' : 'PARTIAL_BASELINE',
    reference_provenance: 'ANL_072_MOVING_AVERAGE'
  });
}

function resultEnvelope(source, spec, comparison, meta) {
  const periodResult = source.period_result;
  return Object.freeze({
    schema: RESULT_SCHEMA,
    contract_version: VERSION,
    comparison_type: spec.comparison_type,
    measure: spec.measure,
    currency: source.currency,
    scope_id: source.scope.scope_id,
    primary_period: Object.freeze({
      start: periodResult.primary_range.start,
      end: periodResult.primary_range.end,
      day_count: periodResult.primary_range.day_count
    }),
    current_minor: comparison.current_minor,
    reference_minor: comparison.reference_minor,
    delta_minor: comparison.delta_minor,
    delta_ppm: comparison.delta_ppm,
    status: comparison.status,
    sample_count: meta.sample_count,
    sample_complete: meta.sample_complete,
    quality: meta.quality,
    reference_provenance: meta.reference_provenance,
    provenance: Object.freeze({
      personal_benchmark: `${SCHEMA}@${VERSION}`,
      analytics_contract: 'PRH_ANALYTICS_CONTRACT_V1@1.0.0',
      semantic_registry: `${SEMANTIC.schema}@${SEMANTIC.version}`,
      period_engine: `${PERIOD.SCHEMA}@${PERIOD.VERSION}`,
      calculated_metrics: `${CALC.SCHEMA}@${CALC.VERSION}`,
      analytics_scope: `${SCOPE.SCHEMA}@${SCOPE.VERSION}`,
      financial_truth_policy: 'FIN-TRUTH-v1',
      reference_financial_truth: false,
      result_financial_truth: false,
      kpi_formula_redefined: false,
      period_semantics_redefined: false,
      scope_semantics_redefined: false,
      external_market_provider_used: false
    })
  });
}

function evaluatePersonalBenchmark(sourceInput, specInput, referenceInput) {
  const spec = normalizeBenchmarkSpec(specInput);
  const source = normalizeBenchmarkSource(sourceInput, spec.measure);
  const result = source.period_result;

  if (spec.comparison_type === 'PREVIOUS_COMPARABLE_PERIOD') {
    if (referenceInput != null) fail('BENCH_REFERENCE_NOT_ALLOWED');
    const compact = compactPreviousComparison(source, spec.measure);
    const delta = deltaFromCalculated(compact, spec.measure);
    return resultEnvelope(source, spec, delta, {
      sample_count: result.comparison_buckets.length,
      sample_complete: result.comparison && result.comparison.clipped !== true,
      quality: result.comparison.quality,
      reference_provenance: 'ANL_071_PREVIOUS_COMPARABLE_PERIOD'
    });
  }

  if (spec.comparison_type === 'PERSONAL_ROLLING_BASELINE') {
    if (referenceInput != null) fail('BENCH_REFERENCE_NOT_ALLOWED');
    const baseline = rollingBaseline(source, spec);
    return resultEnvelope(source, spec, baseline.delta, baseline);
  }

  const current = periodTotal(result, spec.measure, result.primary_buckets);
  if (spec.comparison_type === 'BUDGET' || spec.comparison_type === 'TARGET') {
    const reference = normalizeMoneyReference(referenceInput, spec.comparison_type, source);
    return resultEnvelope(source, spec, exactMoneyDelta(current, reference.value_minor), {
      sample_count: 1,
      sample_complete: true,
      quality: 'DECLARED_REFERENCE',
      reference_provenance: reference.provenance
    });
  }

  if (spec.comparison_type === 'MANUAL_INDEX') {
    const reference = normalizeManualIndex(referenceInput, source);
    return resultEnvelope(source, spec, exactMoneyDelta(current, reference.value_minor), {
      sample_count: 1,
      sample_complete: true,
      quality: 'DECLARED_MANUAL_INDEX',
      reference_provenance: reference.provenance
    });
  }

  fail('BENCH_COMPARISON_TYPE_UNKNOWN');
}

function benchmarkTelemetry(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.contract_version !== VERSION || !COMPARISON_TYPES.includes(result.comparison_type)) {
    fail('BENCH_RESULT_INVALID');
  }
  return Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    comparison_type: result.comparison_type,
    measure_id: result.measure,
    scope_id: result.scope_id,
    selector_kind: null,
    grain: null,
    primary_day_count: result.primary_period.day_count,
    sample_count: result.sample_count,
    sample_complete: result.sample_complete,
    quality: result.quality,
    decision: 'ALLOW',
    reason: 'OK',
    period_engine_version: PERIOD.VERSION,
    calculated_metrics_version: CALC.VERSION,
    scope_contract_version: SCOPE.VERSION,
    financial_truth_policy: result.provenance.financial_truth_policy
  });
}

module.exports = Object.freeze({
  SCHEMA,
  VERSION,
  SPEC_SCHEMA,
  SOURCE_SCHEMA,
  RESULT_SCHEMA,
  MONEY_REFERENCE_SCHEMA,
  MANUAL_INDEX_SCHEMA,
  COMPARISON_TYPES,
  CONTRACT,
  assertContract,
  normalizeBenchmarkSpec,
  serializeBenchmarkSpec,
  normalizeBenchmarkSource,
  evaluatePersonalBenchmark,
  benchmarkTelemetry
});
