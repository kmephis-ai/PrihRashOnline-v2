'use strict';

const CONTRACT = require('./calculated_metrics.v1.json');
const SEMANTIC = require('./semantic_registry.v1.json');
const {
  RESULT_SCHEMA: ANALYTICS_RESULT_SCHEMA,
  CONTRACT_VERSION: ANALYTICS_VERSION,
  stableStringify
} = require('./analytics_engine');
const {
  RESULT_SCHEMA: PERIOD_RESULT_SCHEMA,
  VERSION: PERIOD_VERSION
} = require('./period_engine');

const SCHEMA = 'PRH_ANALYTICS_CALCULATED_METRICS_V1';
const VERSION = '1.0.0';
const SPEC_SCHEMA = 'PRH_ANALYTICS_CALCULATED_SPEC_V1';
const RESULT_SCHEMA = 'PRH_ANALYTICS_CALCULATED_RESULT_V1';
const RATIO_SCALE = 1000000;
const OPERATORS = Object.freeze(Object.keys(CONTRACT.operators));
const ADDITIVE_MEASURES = Object.freeze(Object.keys(SEMANTIC.measures).filter((id) => SEMANTIC.measures[id].additive === true));

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
  safeInteger(left, 'CALC_MONEY_VALUE_INVALID');
  safeInteger(right, 'CALC_MONEY_VALUE_INVALID');
  return safeBigIntToNumber(BigInt(left) + BigInt(right), 'CALC_MONEY_OVERFLOW');
}

function roundRatioHalfAway(numerator, denominator) {
  safeInteger(numerator, 'CALC_RATIO_NUMERATOR_INVALID');
  safeInteger(denominator, 'CALC_RATIO_DENOMINATOR_INVALID');
  if (denominator === 0) fail('CALC_RATIO_DENOMINATOR_ZERO');
  const negative = (numerator < 0) !== (denominator < 0);
  let top = BigInt(Math.abs(numerator));
  const bottom = BigInt(Math.abs(denominator));
  let quotient = top / bottom;
  const remainder = top % bottom;
  if (remainder * 2n >= bottom) quotient += 1n;
  if (negative) quotient = -quotient;
  return safeBigIntToNumber(quotient, 'CALC_RATIO_OVERFLOW');
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION ||
      CONTRACT.roadmap_id !== 'ANL-072' || CONTRACT.spec_schema !== SPEC_SCHEMA || CONTRACT.result_schema !== RESULT_SCHEMA) {
    fail('CALC_CONTRACT_VERSION_INVALID');
  }
  if (!CONTRACT.upstream ||
      CONTRACT.upstream.analytics_contract !== 'PRH_ANALYTICS_CONTRACT_V1@1.0.0' ||
      CONTRACT.upstream.semantic_registry !== `${SEMANTIC.schema}@${SEMANTIC.version}` ||
      CONTRACT.upstream.period_engine !== 'PRH_ANALYTICS_PERIOD_ENGINE_V1@1.0.0' ||
      CONTRACT.upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('CALC_UPSTREAM_CONTRACT_INVALID');
  }
  if (!CONTRACT.semantics || CONTRACT.semantics.allowlisted_operators_only !== true ||
      CONTRACT.semantics.arbitrary_executable_formula_allowed !== false || CONTRACT.semantics.eval_allowed !== false ||
      CONTRACT.semantics.sql_expression_allowed !== false || CONTRACT.semantics.kpi_formula_redefinition !== false ||
      CONTRACT.semantics.renderer_neutral !== true || CONTRACT.semantics.storage_neutral !== true ||
      CONTRACT.semantics.financial_values_embedded_in_spec !== false || CONTRACT.semantics.ratio_scale !== RATIO_SCALE ||
      CONTRACT.semantics.free_only !== true) {
    fail('CALC_BOUNDARY_INVALID');
  }
  if (!CONTRACT.authorities || Object.values(CONTRACT.authorities).some((value) => value !== false)) {
    fail('CALC_AUTHORITY_INVALID');
  }
  const required = ['SHARE', 'DELTA_ABS', 'DELTA_PCT', 'CUMULATIVE', 'MOVING_AVERAGE', 'MOVING_MEDIAN', 'TOP_N_OTHER'];
  if (JSON.stringify(OPERATORS.slice().sort()) !== JSON.stringify(required.sort())) fail('CALC_OPERATOR_SET_INVALID');
  return true;
}

function normalizeMeasure(value, operator) {
  const measure = String(value || '').trim();
  const definition = SEMANTIC.measures[measure];
  if (!definition) fail('CALC_MEASURE_UNKNOWN');
  const operatorDefinition = CONTRACT.operators[operator];
  if (operatorDefinition.requires_additive_measure === true && definition.additive !== true) {
    fail('CALC_MEASURE_NON_ADDITIVE_UNSUPPORTED');
  }
  if (Array.isArray(operatorDefinition.allowed_measures) && !operatorDefinition.allowed_measures.includes(measure)) {
    fail('CALC_MEASURE_OPERATOR_UNSUPPORTED');
  }
  return measure;
}

function normalizeOptions(operator, options) {
  const input = options == null ? {} : options;
  if (operator === 'SHARE') {
    exactKeys(input, ['denominator_scope'], 'CALC_OPTIONS_SHAPE_INVALID');
    if (input.denominator_scope !== 'RESULT_TOTAL') fail('CALC_SHARE_DENOMINATOR_SCOPE_INVALID');
    return Object.freeze({ denominator_scope: 'RESULT_TOTAL' });
  }
  if (operator === 'DELTA_ABS' || operator === 'DELTA_PCT') {
    exactKeys(input, ['reference'], 'CALC_OPTIONS_SHAPE_INVALID');
    if (input.reference !== 'PERIOD_COMPARISON') fail('CALC_DELTA_REFERENCE_INVALID');
    return Object.freeze({ reference: 'PERIOD_COMPARISON' });
  }
  if (operator === 'CUMULATIVE') {
    exactKeys(input, [], 'CALC_OPTIONS_SHAPE_INVALID');
    return Object.freeze({});
  }
  if (operator === 'MOVING_AVERAGE' || operator === 'MOVING_MEDIAN') {
    exactKeys(input, ['window', 'partial_window'], 'CALC_OPTIONS_SHAPE_INVALID');
    const window = Number(input.window);
    if (!Number.isInteger(window) || window < 1 || window > CONTRACT.limits.max_window) fail('CALC_WINDOW_INVALID');
    const partialWindow = String(input.partial_window || '');
    if (!CONTRACT.operators[operator].options.partial_window.includes(partialWindow)) fail('CALC_PARTIAL_WINDOW_INVALID');
    return Object.freeze({ window, partial_window: partialWindow });
  }
  if (operator === 'TOP_N_OTHER') {
    exactKeys(input, ['n'], 'CALC_OPTIONS_SHAPE_INVALID');
    const n = Number(input.n);
    if (!Number.isInteger(n) || n < 1 || n > CONTRACT.limits.max_top_n) fail('CALC_TOP_N_INVALID');
    return Object.freeze({ n });
  }
  fail('CALC_OPERATOR_UNKNOWN');
}

function normalizeCalculatedSpec(input) {
  assertContract();
  exactKeys(input, ['schema', 'contract_version', 'operator', 'measure', 'options'], 'CALC_SPEC_SHAPE_INVALID');
  if (input.schema !== SPEC_SCHEMA || input.contract_version !== VERSION) fail('CALC_SPEC_VERSION_INVALID');
  const operator = String(input.operator || '').trim();
  if (!OPERATORS.includes(operator)) fail('CALC_OPERATOR_UNKNOWN');
  const measure = normalizeMeasure(input.measure, operator);
  const options = normalizeOptions(operator, input.options);
  return Object.freeze({ schema: SPEC_SCHEMA, contract_version: VERSION, operator, measure, options });
}

function serializeCalculatedSpec(input) {
  return stableStringify(normalizeCalculatedSpec(input));
}

function assertAnalyticsResult(result, measure) {
  if (!result || result.schema !== ANALYTICS_RESULT_SCHEMA || result.contract_version !== ANALYTICS_VERSION) {
    fail('CALC_ANALYTICS_RESULT_INVALID');
  }
  if (!Array.isArray(result.rows) || result.rows.length > CONTRACT.limits.max_source_rows ||
      result.truncated !== false || result.total_rows !== result.rows.length) {
    fail('CALC_ANALYTICS_RESULT_INCOMPLETE');
  }
  if (!result.provenance || result.provenance.financial_truth_policy !== 'FIN-TRUTH-v1' ||
      result.provenance.legacy_total_cells_used !== false || result.provenance.ui_logic_used !== false) {
    fail('CALC_ANALYTICS_PROVENANCE_INVALID');
  }
  const keys = new Set();
  for (const row of result.rows) {
    if (!row || typeof row !== 'object' || !row.dimensions || typeof row.dimensions !== 'object' || Array.isArray(row.dimensions) ||
        !row.measures || typeof row.measures !== 'object' || Array.isArray(row.measures)) {
      fail('CALC_ANALYTICS_ROW_INVALID');
    }
    const key = stableStringify(row.dimensions);
    if (keys.has(key)) fail('CALC_ANALYTICS_DIMENSION_DUPLICATE');
    keys.add(key);
    safeInteger(row.measures[measure], 'CALC_MONEY_VALUE_INVALID');
  }
  return result;
}

function assertPeriodResult(result, measure, requireComparison) {
  if (!result || result.schema !== PERIOD_RESULT_SCHEMA || result.contract_version !== PERIOD_VERSION ||
      !Array.isArray(result.primary_buckets) || result.primary_buckets.length < 1 ||
      result.primary_buckets.length > CONTRACT.limits.max_source_buckets) {
    fail('CALC_PERIOD_RESULT_INVALID');
  }
  if (!result.provenance || result.provenance.period_engine !== 'PRH_ANALYTICS_PERIOD_ENGINE_V1@1.0.0' ||
      result.provenance.semantic_registry !== `${SEMANTIC.schema}@${SEMANTIC.version}` ||
      result.provenance.financial_truth_policy !== 'FIN-TRUTH-v1' || result.provenance.orchestration_only !== true) {
    fail('CALC_PERIOD_PROVENANCE_INVALID');
  }
  result.primary_buckets.forEach((bucket) => assertAnalyticsResult(bucket.analytics_result, measure));
  if (requireComparison) {
    if (!result.comparison || !Array.isArray(result.comparison_buckets) || result.comparison_buckets.length < 1) {
      fail('CALC_PERIOD_COMPARISON_REQUIRED');
    }
    if (result.comparison_buckets.length !== result.primary_buckets.length) fail('CALC_REFERENCE_BUCKET_COUNT_MISMATCH');
    result.comparison_buckets.forEach((bucket) => assertAnalyticsResult(bucket.analytics_result, measure));
  }
  return result;
}

function dimensionKey(dimensions) {
  return stableStringify(dimensions || {});
}

function rowValueMap(result, measure) {
  assertAnalyticsResult(result, measure);
  const map = new Map();
  result.rows.forEach((row) => map.set(dimensionKey(row.dimensions), Object.freeze({
    dimensions: Object.freeze({ ...row.dimensions }),
    value: row.measures[measure]
  })));
  return map;
}

function calculatedProvenance(sourceKind) {
  return Object.freeze({
    calculated_metrics: `${SCHEMA}@${VERSION}`,
    analytics_contract: `PRH_ANALYTICS_CONTRACT_V1@${ANALYTICS_VERSION}`,
    semantic_registry: `${SEMANTIC.schema}@${SEMANTIC.version}`,
    period_engine: sourceKind === 'PERIOD_RESULT' ? `PRH_ANALYTICS_PERIOD_ENGINE_V1@${PERIOD_VERSION}` : null,
    financial_truth_policy: 'FIN-TRUTH-v1',
    kpi_formula_redefined: false,
    arbitrary_formula_executed: false,
    renderer_used: false
  });
}

function resultEnvelope(spec, sourceKind, currency, rows, extra) {
  return Object.freeze(Object.assign({
    schema: RESULT_SCHEMA,
    contract_version: VERSION,
    operator: spec.operator,
    measure: spec.measure,
    source_kind: sourceKind,
    currency,
    rows: Object.freeze(rows),
    input_count: 0,
    output_count: rows.length,
    provenance: calculatedProvenance(sourceKind)
  }, extra || {}));
}

function shareResult(source, spec) {
  assertAnalyticsResult(source, spec.measure);
  if (source.rows.length < 1) fail('CALC_SHARE_SOURCE_EMPTY');
  const entries = source.rows.map((row, index) => ({
    index,
    key: dimensionKey(row.dimensions),
    dimensions: Object.freeze({ ...row.dimensions }),
    source_value_minor: row.measures[spec.measure]
  }));
  if (entries.some((entry) => entry.source_value_minor < 0)) fail('CALC_SHARE_NEGATIVE_PARTITION_UNSUPPORTED');
  let denominator = 0;
  entries.forEach((entry) => { denominator = safeAdd(denominator, entry.source_value_minor); });
  if (denominator <= 0) fail('CALC_SHARE_DENOMINATOR_ZERO');

  let floorTotal = 0;
  const denominatorBig = BigInt(denominator);
  const allocations = entries.map((entry) => {
    const scaled = BigInt(entry.source_value_minor) * BigInt(RATIO_SCALE);
    const floor = scaled / denominatorBig;
    const remainder = scaled % denominatorBig;
    const value = safeBigIntToNumber(floor, 'CALC_RATIO_OVERFLOW');
    floorTotal += value;
    return { ...entry, value_ppm: value, remainder };
  });
  let residual = RATIO_SCALE - floorTotal;
  allocations.slice().sort((a, b) => {
    if (a.remainder === b.remainder) return a.key.localeCompare(b.key);
    return a.remainder > b.remainder ? -1 : 1;
  }).forEach((entry) => {
    if (residual > 0) {
      allocations[entry.index].value_ppm += 1;
      residual -= 1;
    }
  });
  if (residual !== 0 || allocations.reduce((sum, entry) => sum + entry.value_ppm, 0) !== RATIO_SCALE) {
    fail('CALC_SHARE_RECONCILIATION_FAILED');
  }
  const rows = allocations.map((entry) => Object.freeze({
    dimensions: entry.dimensions,
    source_value_minor: entry.source_value_minor,
    value_ppm: entry.value_ppm,
    status: 'OK'
  }));
  return resultEnvelope(spec, 'ANALYTICS_RESULT', source.currency, rows, {
    denominator_scope: spec.options.denominator_scope,
    denominator_minor: denominator,
    ratio_scale: RATIO_SCALE,
    input_count: source.rows.length,
    reconciliation_ppm: RATIO_SCALE
  });
}

function topNOtherResult(source, spec) {
  assertAnalyticsResult(source, spec.measure);
  if (source.rows.length < 1) fail('CALC_TOP_N_SOURCE_EMPTY');
  if (source.rows.every((row) => Object.keys(row.dimensions).length === 0)) fail('CALC_TOP_N_DIMENSION_REQUIRED');
  const sorted = source.rows.map((row) => Object.freeze({
    dimensions: Object.freeze({ ...row.dimensions }),
    key: dimensionKey(row.dimensions),
    value_minor: row.measures[spec.measure]
  })).sort((left, right) => right.value_minor - left.value_minor || left.key.localeCompare(right.key));
  const kept = sorted.slice(0, spec.options.n).map((row) => Object.freeze({
    dimensions: row.dimensions,
    source_value_minor: row.value_minor,
    value_minor: row.value_minor,
    bucket_kind: 'TOP',
    status: 'OK'
  }));
  const remainder = sorted.slice(spec.options.n);
  let other = 0;
  remainder.forEach((row) => { other = safeAdd(other, row.value_minor); });
  if (remainder.length > 0) {
    kept.push(Object.freeze({
      dimensions: Object.freeze({}),
      source_value_minor: other,
      value_minor: other,
      bucket_kind: 'OTHER',
      bucket_key: CONTRACT.operators.TOP_N_OTHER.other_key,
      status: 'OK'
    }));
  }
  const sourceTotal = sorted.reduce((sum, row) => safeAdd(sum, row.value_minor), 0);
  const outputTotal = kept.reduce((sum, row) => safeAdd(sum, row.value_minor), 0);
  if (sourceTotal !== outputTotal) fail('CALC_TOP_N_RECONCILIATION_FAILED');
  return resultEnvelope(spec, 'ANALYTICS_RESULT', source.currency, kept, {
    top_n: spec.options.n,
    other_included: remainder.length > 0,
    input_count: source.rows.length,
    source_total_minor: sourceTotal,
    output_total_minor: outputTotal
  });
}

function collectPeriodDimensions(result, measure, includeComparison) {
  const dimensions = new Map();
  const allBuckets = includeComparison
    ? result.primary_buckets.concat(result.comparison_buckets)
    : result.primary_buckets;
  allBuckets.forEach((bucket) => {
    const map = rowValueMap(bucket.analytics_result, measure);
    map.forEach((entry, key) => {
      if (!dimensions.has(key)) dimensions.set(key, entry.dimensions);
    });
  });
  if (dimensions.size < 1) dimensions.set('{}', Object.freeze({}));
  return dimensions;
}

function bucketValue(bucket, measure, key) {
  const map = rowValueMap(bucket.analytics_result, measure);
  const entry = map.get(key);
  return entry ? entry.value : 0;
}

function periodRowBase(bucket, bucketIndex, dimensions, sourceValue) {
  return {
    bucket_index: bucketIndex,
    bucket_key: bucket.key,
    start: bucket.start,
    end: bucket.end,
    partial: bucket.partial === true,
    dimensions: Object.freeze({ ...dimensions }),
    source_value_minor: sourceValue
  };
}

function cumulativeResult(source, spec) {
  assertPeriodResult(source, spec.measure, false);
  const dimensions = collectPeriodDimensions(source, spec.measure, false);
  const rows = [];
  dimensions.forEach((dimensionObject, key) => {
    let running = 0;
    source.primary_buckets.forEach((bucket, index) => {
      const value = bucketValue(bucket, spec.measure, key);
      running = safeAdd(running, value);
      rows.push(Object.freeze(Object.assign(periodRowBase(bucket, index, dimensionObject, value), {
        value_minor: running,
        status: 'OK'
      })));
    });
  });
  rows.sort((a, b) => a.bucket_index - b.bucket_index || dimensionKey(a.dimensions).localeCompare(dimensionKey(b.dimensions)));
  return resultEnvelope(spec, 'PERIOD_RESULT', source.primary_buckets[0].analytics_result.currency, rows, {
    input_count: source.primary_buckets.length * dimensions.size,
    bucket_count: source.primary_buckets.length,
    series_count: dimensions.size
  });
}

function medianRounded(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return roundRatioHalfAway(safeAdd(sorted[middle - 1], sorted[middle]), 2);
}

function movingResult(source, spec) {
  assertPeriodResult(source, spec.measure, false);
  const dimensions = collectPeriodDimensions(source, spec.measure, false);
  const rows = [];
  const window = spec.options.window;
  dimensions.forEach((dimensionObject, key) => {
    const values = source.primary_buckets.map((bucket) => bucketValue(bucket, spec.measure, key));
    source.primary_buckets.forEach((bucket, index) => {
      const startIndex = Math.max(0, index - window + 1);
      const windowValues = values.slice(startIndex, index + 1);
      const complete = windowValues.length === window;
      let calculated = null;
      let status = 'WINDOW_INCOMPLETE';
      if (complete || spec.options.partial_window === 'ALLOW_PARTIAL') {
        if (spec.operator === 'MOVING_AVERAGE') {
          let total = 0;
          windowValues.forEach((value) => { total = safeAdd(total, value); });
          calculated = roundRatioHalfAway(total, windowValues.length);
        } else {
          calculated = medianRounded(windowValues);
        }
        status = complete ? 'OK' : 'OK_PARTIAL_WINDOW';
      }
      rows.push(Object.freeze(Object.assign(periodRowBase(bucket, index, dimensionObject, values[index]), {
        value_minor: calculated,
        window_sample_count: windowValues.length,
        window_complete: complete,
        status
      })));
    });
  });
  rows.sort((a, b) => a.bucket_index - b.bucket_index || dimensionKey(a.dimensions).localeCompare(dimensionKey(b.dimensions)));
  return resultEnvelope(spec, 'PERIOD_RESULT', source.primary_buckets[0].analytics_result.currency, rows, {
    window,
    partial_window: spec.options.partial_window,
    input_count: source.primary_buckets.length * dimensions.size,
    bucket_count: source.primary_buckets.length,
    series_count: dimensions.size
  });
}

function deltaResult(source, spec) {
  assertPeriodResult(source, spec.measure, true);
  const dimensions = collectPeriodDimensions(source, spec.measure, true);
  const rows = [];
  source.primary_buckets.forEach((primaryBucket, index) => {
    const referenceBucket = source.comparison_buckets[index];
    dimensions.forEach((dimensionObject, key) => {
      const current = bucketValue(primaryBucket, spec.measure, key);
      const reference = bucketValue(referenceBucket, spec.measure, key);
      const delta = safeAdd(current, -reference);
      let status = 'OK';
      let valueMinor = null;
      let valuePpm = null;
      if (spec.operator === 'DELTA_ABS') {
        valueMinor = delta;
      } else if (reference === 0) {
        if (current === 0) {
          valuePpm = 0;
          status = 'ZERO_REFERENCE_NO_CHANGE';
        } else {
          status = 'ZERO_REFERENCE_UNDEFINED';
        }
      } else {
        valuePpm = roundRatioHalfAway(
          safeBigIntToNumber(BigInt(delta) * BigInt(RATIO_SCALE), 'CALC_RATIO_OVERFLOW'),
          reference
        );
      }
      rows.push(Object.freeze(Object.assign(periodRowBase(primaryBucket, index, dimensionObject, current), {
        reference_bucket_key: referenceBucket.key,
        reference_start: referenceBucket.start,
        reference_end: referenceBucket.end,
        reference_value_minor: reference,
        value_minor: valueMinor,
        value_ppm: valuePpm,
        status
      })));
    });
  });
  return resultEnvelope(spec, 'PERIOD_RESULT', source.primary_buckets[0].analytics_result.currency, rows, {
    reference: spec.options.reference,
    ratio_scale: spec.operator === 'DELTA_PCT' ? RATIO_SCALE : null,
    comparison_quality: source.comparison.quality,
    input_count: source.primary_buckets.length * dimensions.size,
    bucket_count: source.primary_buckets.length,
    series_count: dimensions.size
  });
}

function evaluateCalculatedMetric(source, specInput) {
  const spec = normalizeCalculatedSpec(specInput);
  if (spec.operator === 'SHARE') return shareResult(source, spec);
  if (spec.operator === 'TOP_N_OTHER') return topNOtherResult(source, spec);
  if (spec.operator === 'CUMULATIVE') return cumulativeResult(source, spec);
  if (spec.operator === 'MOVING_AVERAGE' || spec.operator === 'MOVING_MEDIAN') return movingResult(source, spec);
  if (spec.operator === 'DELTA_ABS' || spec.operator === 'DELTA_PCT') return deltaResult(source, spec);
  fail('CALC_OPERATOR_UNKNOWN');
}

function calculatedTelemetry(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.contract_version !== VERSION || !OPERATORS.includes(result.operator)) {
    fail('CALC_RESULT_INVALID');
  }
  const output = {
    schema: SCHEMA,
    version: VERSION,
    operator: result.operator,
    measure_id: result.measure,
    source_kind: result.source_kind,
    window: result.window == null ? null : result.window,
    top_n: result.top_n == null ? null : result.top_n,
    input_count: result.input_count,
    output_count: result.output_count,
    decision: 'ALLOW',
    reason: 'OK',
    financial_truth_policy: result.provenance.financial_truth_policy,
    semantic_registry_version: SEMANTIC.version,
    period_engine_version: result.source_kind === 'PERIOD_RESULT' ? PERIOD_VERSION : null
  };
  return Object.freeze(output);
}

module.exports = Object.freeze({
  SCHEMA,
  VERSION,
  SPEC_SCHEMA,
  RESULT_SCHEMA,
  RATIO_SCALE,
  OPERATORS,
  ADDITIVE_MEASURES,
  CONTRACT,
  assertContract,
  normalizeCalculatedSpec,
  serializeCalculatedSpec,
  evaluateCalculatedMetric,
  calculatedTelemetry,
  roundRatioHalfAway
});
