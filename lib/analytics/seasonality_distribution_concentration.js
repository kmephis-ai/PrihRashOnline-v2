'use strict';

const crypto = require('crypto');
const CONTRACT = require('./seasonality_distribution_concentration.v1.json');
const ANALYTICS = require('./analytics_engine');

const SCHEMA = 'PRH_SEASONALITY_DISTRIBUTION_CONCENTRATION_V1';
const VERSION = '1.0.0';
const REQUEST_SCHEMA = 'PRH_ANALYTICS_SHAPE_REQUEST_V1';
const DATASET_SCHEMA = 'PRH_ANALYTICS_DAILY_DRIVER_DATASET_V1';
const RESULT_SCHEMA = 'PRH_ANALYTICS_SHAPE_RESULT_V1';
const DRILL_SCHEMA = 'PRH_ANALYTICS_SHAPE_DRILL_V1';
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TZ_RE = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/;
const DRIVER_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function stableStringify(value) {
  return ANALYTICS.stableStringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys.slice().sort())) fail(code);
  return value;
}

function safeInteger(value, code) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail(code);
  return number;
}

function safeAdd(a, b, code) {
  const value = a + b;
  if (!Number.isSafeInteger(value)) fail(code);
  return value;
}

function driverId(value) {
  const id = String(value == null ? '' : value);
  if (!DRIVER_RE.test(id) || id.length > CONTRACT.limits.max_driver_id_length) fail('ANL091_DRIVER_ID_INVALID');
  return id;
}

function collectIsoDays(value, output = []) {
  if (typeof value === 'string') {
    if (ISO_DAY_RE.test(value)) output.push(value);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const child of Object.values(value)) collectIsoDays(child, output);
  return output;
}

function parseDay(day, code) {
  if (!ISO_DAY_RE.test(day)) fail(code);
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== day) fail(code);
  return ms;
}

function periodDescriptor(timeRange) {
  if (!timeRange || typeof timeRange !== 'object') fail('ANL091_EXPLICIT_TIME_RANGE_REQUIRED');
  const dates = Array.from(new Set(collectIsoDays(timeRange))).sort();
  if (dates.length !== 2) fail('ANL091_TIME_RANGE_BOUNDS_INVALID');
  const [start, end] = dates;
  const startMs = parseDay(start, 'ANL091_TIME_RANGE_BOUNDS_INVALID');
  const endMs = parseDay(end, 'ANL091_TIME_RANGE_BOUNDS_INVALID');
  if (endMs <= startMs) fail('ANL091_TIME_RANGE_ORDER_INVALID');
  const spanDays = (endMs - startMs) / 86400000;
  if (!Number.isInteger(spanDays) || spanDays < 1 || spanDays > CONTRACT.limits.max_period_days) fail('ANL091_TIME_RANGE_SPAN_INVALID');
  const days = [];
  for (let ms = startMs; ms < endMs; ms += 86400000) days.push(new Date(ms).toISOString().slice(0, 10));
  return deepFreeze({ start, end, span_days: spanDays, days, period_hash: sha256(stableStringify(timeRange)) });
}

function ensureNoDriverFilter(query, dimension) {
  if ((query.filters || []).some((filter) => filter.field === dimension)) fail('ANL091_DIMENSION_FILTER_ALREADY_PRESENT');
}

function normalizeRequest(input) {
  assertContract();
  exactKeys(input, ['schema', 'contract_version', 'measure', 'dimension', 'query', 'timezone'], 'ANL091_REQUEST_SHAPE_INVALID');
  if (input.schema !== REQUEST_SCHEMA || input.contract_version !== VERSION) fail('ANL091_REQUEST_VERSION_INVALID');
  const measure = String(input.measure || '');
  const dimension = String(input.dimension || '');
  if (!CONTRACT.supported_core_measures.includes(measure)) fail('ANL091_MEASURE_UNSUPPORTED');
  if (!CONTRACT.supported_dimensions.includes(dimension)) fail('ANL091_DIMENSION_UNSUPPORTED');
  const timezone = String(input.timezone || '');
  if (!TZ_RE.test(timezone)) fail('ANL091_TIMEZONE_INVALID');
  const query = ANALYTICS.normalizeAnalyticsQuery(input.query);
  if (query.measures.length !== 1 || query.measures[0] !== measure) fail('ANL091_QUERY_MEASURE_MISMATCH');
  if (!query.dimensions.includes(dimension)) fail('ANL091_QUERY_DIMENSION_MISSING');
  ensureNoDriverFilter(query, dimension);
  const period = periodDescriptor(query.time_range);
  const queryHash = ANALYTICS.analyticsQueryHash(query);
  const body = {
    schema: REQUEST_SCHEMA,
    contract_version: VERSION,
    measure,
    dimension,
    query,
    query_hash: queryHash,
    timezone,
    timezone_semantics: CONTRACT.seasonality.date_semantics,
    period,
    missing_day_policy: CONTRACT.seasonality.missing_day_policy,
    financial_truth_policy: 'FIN-TRUTH-v1'
  };
  return deepFreeze({ ...body, request_hash: sha256(stableStringify(body)) });
}

function normalizeDataset(input, request) {
  exactKeys(input, ['schema', 'contract_version', 'query_hash', 'source_contract', 'observed_days', 'rows'], 'ANL091_DATASET_SHAPE_INVALID');
  if (input.schema !== DATASET_SCHEMA || input.contract_version !== VERSION) fail('ANL091_DATASET_VERSION_INVALID');
  if (String(input.query_hash || '') !== request.query_hash) fail('ANL091_DATASET_QUERY_HASH_MISMATCH');
  const sourceContract = String(input.source_contract || '');
  if (!/^[A-Z][A-Z0-9_]+@[0-9]+\.[0-9]+\.[0-9]+$/.test(sourceContract)) fail('ANL091_SOURCE_CONTRACT_INVALID');
  if (!Array.isArray(input.observed_days) || input.observed_days.length > CONTRACT.limits.max_observed_days) fail('ANL091_OBSERVED_DAYS_INVALID');
  const periodSet = new Set(request.period.days);
  const observedSet = new Set();
  for (const rawDay of input.observed_days) {
    const day = String(rawDay || '');
    parseDay(day, 'ANL091_OBSERVED_DAY_INVALID');
    if (!periodSet.has(day)) fail('ANL091_OBSERVED_DAY_OUTSIDE_PERIOD');
    if (observedSet.has(day)) fail('ANL091_OBSERVED_DAY_DUPLICATE');
    observedSet.add(day);
  }
  const observedDays = Array.from(observedSet).sort();
  if (!Array.isArray(input.rows) || input.rows.length > CONTRACT.limits.max_rows) fail('ANL091_ROWS_LIMIT');
  const seenPairs = new Set();
  const rows = input.rows.map((row) => {
    exactKeys(row, ['date', 'driver_id', 'value'], 'ANL091_ROW_SHAPE_INVALID');
    const date = String(row.date || '');
    if (!observedSet.has(date)) fail('ANL091_ROW_DAY_NOT_OBSERVED');
    const id = driverId(row.driver_id);
    const key = `${date}\u0000${id}`;
    if (seenPairs.has(key)) fail('ANL091_ROW_DUPLICATE');
    seenPairs.add(key);
    return { date, driver_id: id, value: safeInteger(row.value, 'ANL091_VALUE_INVALID') };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.driver_id.localeCompare(b.driver_id));
  const body = { schema: DATASET_SCHEMA, contract_version: VERSION, query_hash: request.query_hash, source_contract: sourceContract, observed_days: observedDays, rows };
  return deepFreeze({ ...body, dataset_hash: sha256(stableStringify(body)) });
}

function ratioBps(numerator, denominator, code) {
  if (denominator <= 0) return null;
  const out = (BigInt(numerator) * 10000n) / BigInt(denominator);
  const number = Number(out);
  if (!Number.isSafeInteger(number)) fail(code);
  return number;
}

function meanDescriptor(values) {
  if (!values.length) return deepFreeze({ status: 'NO_OBSERVATIONS', numerator: 0, denominator: 0, floor: null, remainder: null });
  let sum = 0;
  for (const value of values) sum = safeAdd(sum, value, 'ANL091_MEAN_SUM_OVERFLOW');
  return deepFreeze({ status: 'AVAILABLE', numerator: sum, denominator: values.length, floor: Math.floor(sum / values.length), remainder: sum % values.length });
}

function nearestRank(sortedValues, percentile) {
  if (!sortedValues.length) return null;
  const rank = Math.max(1, Math.ceil((percentile / 100) * sortedValues.length));
  return sortedValues[rank - 1];
}

function distribution(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  let sum = 0;
  for (const value of sorted) sum = safeAdd(sum, value, 'ANL091_DISTRIBUTION_SUM_OVERFLOW');
  const percentiles = {};
  for (const p of CONTRACT.distribution.percentiles) percentiles[`p${p}`] = nearestRank(sorted, p);
  return deepFreeze({
    status: sorted.length ? 'AVAILABLE' : 'NO_OBSERVATIONS',
    count: sorted.length,
    sum,
    min: sorted.length ? sorted[0] : null,
    max: sorted.length ? sorted[sorted.length - 1] : null,
    zero_count: sorted.filter((value) => value === 0).length,
    negative_count: sorted.filter((value) => value < 0).length,
    positive_count: sorted.filter((value) => value > 0).length,
    mean: meanDescriptor(sorted),
    percentiles,
    algorithm: CONTRACT.distribution.algorithm
  });
}

function weekdayIso(day) {
  const js = new Date(`${day}T00:00:00Z`).getUTCDay();
  return js === 0 ? 7 : js;
}

function bucketSummary(bucketValues, expectedKeys) {
  return expectedKeys.map((key) => {
    const values = bucketValues.get(String(key)) || [];
    let sum = 0;
    for (const value of values) sum = safeAdd(sum, value, 'ANL091_SEASONALITY_SUM_OVERFLOW');
    return deepFreeze({ bucket: key, observed_day_count: values.length, sum, mean: meanDescriptor(values) });
  });
}

function buildSeasonality(request, dailyTotals, observedDays) {
  const month = new Map();
  const weekday = new Map();
  const dom = new Map();
  const add = (map, key, value) => {
    const k = String(key);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(value);
  };
  for (const day of observedDays) {
    const value = dailyTotals.get(day) || 0;
    add(month, Number(day.slice(5, 7)), value);
    add(dom, Number(day.slice(8, 10)), value);
    add(weekday, weekdayIso(day), value);
  }
  return deepFreeze({
    timezone: request.timezone,
    date_semantics: request.timezone_semantics,
    day_of_month: bucketSummary(dom, Array.from({ length: 31 }, (_, i) => i + 1)),
    weekday: bucketSummary(weekday, Array.from({ length: 7 }, (_, i) => i + 1)),
    month_of_year: bucketSummary(month, Array.from({ length: 12 }, (_, i) => i + 1))
  });
}

function addDriverFilter(query, dimension, id) {
  const raw = {
    schema: query.schema,
    contract_version: query.contract_version,
    currency: query.currency,
    measures: query.measures,
    dimensions: query.dimensions,
    filters: [...query.filters, { field: dimension, operator: 'IN', values: [id] }],
    time_range: query.time_range,
    grain: query.grain,
    comparison: query.comparison,
    sort: query.sort,
    parameters: query.parameters,
    limit: query.limit
  };
  return ANALYTICS.normalizeAnalyticsQuery(raw);
}

function drillDescriptor(request, id) {
  const query = addDriverFilter(request.query, request.dimension, id);
  const body = {
    schema: DRILL_SCHEMA,
    contract_version: VERSION,
    mode: 'READ_ONLY',
    driver_dimension: request.dimension,
    driver_id: id,
    driver_hash: sha256(id),
    query,
    query_hash: ANALYTICS.analyticsQueryHash(query),
    source_query_hash: request.query_hash,
    financial_values_in_navigation: false,
    financial_write: false
  };
  return deepFreeze({ ...body, drill_hash: sha256(stableStringify(body)) });
}

function concentration(request, driverTotals) {
  const rows = Array.from(driverTotals, ([driver_id, value]) => ({ driver_id, value }))
    .sort((a, b) => b.value - a.value || a.driver_id.localeCompare(b.driver_id));
  let total = 0;
  let negative = false;
  for (const row of rows) {
    if (row.value < 0) negative = true;
    total = safeAdd(total, row.value, 'ANL091_CONCENTRATION_TOTAL_OVERFLOW');
  }
  if (!rows.length) return deepFreeze({ status: 'NOT_APPLICABLE', reason: 'NO_DRIVERS', driver_count: 0 });
  if (negative || total <= 0) return deepFreeze({ status: 'NOT_APPLICABLE', reason: negative ? 'NEGATIVE_DRIVER_VALUE' : 'NONPOSITIVE_TOTAL', driver_count: rows.length });
  let cumulative = 0;
  const ranked = rows.map((row, index) => {
    const beforeBps = ratioBps(cumulative, total, 'ANL091_CONCENTRATION_BPS_OVERFLOW');
    cumulative = safeAdd(cumulative, row.value, 'ANL091_CONCENTRATION_CUMULATIVE_OVERFLOW');
    const cumulativeBps = ratioBps(cumulative, total, 'ANL091_CONCENTRATION_BPS_OVERFLOW');
    const abc = beforeBps < CONTRACT.concentration.abc_thresholds_bps.a ? 'A' : beforeBps < CONTRACT.concentration.abc_thresholds_bps.b ? 'B' : 'C';
    return deepFreeze({
      rank: index + 1,
      driver_id: row.driver_id,
      driver_hash: sha256(row.driver_id),
      value: row.value,
      share_bps: ratioBps(row.value, total, 'ANL091_CONCENTRATION_BPS_OVERFLOW'),
      cumulative_bps: cumulativeBps,
      abc,
      drill: drillDescriptor(request, row.driver_id)
    });
  });
  const topShare = (count) => ratioBps(rows.slice(0, count).reduce((sum, row) => safeAdd(sum, row.value, 'ANL091_TOP_SUM_OVERFLOW'), 0), total, 'ANL091_TOP_BPS_OVERFLOW');
  let squareSum = 0n;
  for (const row of rows) squareSum += BigInt(row.value) * BigInt(row.value);
  const hhi = Number((squareSum * 10000n) / (BigInt(total) * BigInt(total)));
  const pareto = ranked.find((row) => row.cumulative_bps >= CONTRACT.concentration.pareto_threshold_bps);
  return deepFreeze({
    status: 'AVAILABLE',
    reason: null,
    total,
    driver_count: ranked.length,
    top1_bps: topShare(1),
    top3_bps: topShare(3),
    top5_bps: topShare(5),
    hhi_10000: hhi,
    pareto80_driver_count: pareto ? pareto.rank : ranked.length,
    rows: ranked,
    abc_thresholds_bps: CONTRACT.concentration.abc_thresholds_bps
  });
}

function analyze(requestInput, datasetInput) {
  const request = normalizeRequest(requestInput);
  const dataset = normalizeDataset(datasetInput, request);
  const dailyTotals = new Map(dataset.observed_days.map((day) => [day, 0]));
  const driverTotals = new Map();
  for (const row of dataset.rows) {
    dailyTotals.set(row.date, safeAdd(dailyTotals.get(row.date) || 0, row.value, 'ANL091_DAILY_TOTAL_OVERFLOW'));
    driverTotals.set(row.driver_id, safeAdd(driverTotals.get(row.driver_id) || 0, row.value, 'ANL091_DRIVER_TOTAL_OVERFLOW'));
  }
  if (driverTotals.size > CONTRACT.limits.max_drivers) fail('ANL091_DRIVER_LIMIT');
  const missingDays = request.period.days.filter((day) => !dailyTotals.has(day));
  const dailyValues = dataset.observed_days.map((day) => dailyTotals.get(day) || 0);
  const driverValues = Array.from(driverTotals.values());
  const concentrationResult = concentration(request, driverTotals);
  const body = {
    schema: RESULT_SCHEMA,
    contract_version: VERSION,
    request_hash: request.request_hash,
    query_hash: request.query_hash,
    dataset_hash: dataset.dataset_hash,
    source_contract: dataset.source_contract,
    measure: request.measure,
    dimension: request.dimension,
    timezone: request.timezone,
    period_days: request.period.span_days,
    observed_day_count: dataset.observed_days.length,
    missing_day_count: missingDays.length,
    coverage_status: missingDays.length ? 'PARTIAL' : 'COMPLETE',
    missing_days: missingDays,
    seasonality: buildSeasonality(request, dailyTotals, dataset.observed_days),
    daily_distribution: distribution(dailyValues),
    driver_distribution: distribution(driverValues),
    concentration: concentrationResult,
    missing_day_policy: CONTRACT.seasonality.missing_day_policy,
    explicit_zero_policy: CONTRACT.seasonality.explicit_zero_policy,
    financial_truth_policy: 'FIN-TRUTH-v1',
    financial_write: false
  };
  return deepFreeze({ request, dataset, result: deepFreeze({ ...body, result_hash: sha256(stableStringify(body)) }) });
}

function telemetry(analysis, decision = 'ANALYZED', reason = 'OK') {
  if (!analysis || !analysis.request || !analysis.dataset || !analysis.result) fail('ANL091_ANALYSIS_INVALID');
  const out = {
    schema: SCHEMA,
    version: VERSION,
    measure: analysis.result.measure,
    dimension: analysis.result.dimension,
    query_hash_prefix: analysis.result.query_hash.slice(0, 12),
    dataset_hash_prefix: analysis.result.dataset_hash.slice(0, 12),
    result_hash_prefix: analysis.result.result_hash.slice(0, 12),
    coverage_status: analysis.result.coverage_status,
    period_days: analysis.result.period_days,
    observed_day_count: analysis.result.observed_day_count,
    missing_day_count: analysis.result.missing_day_count,
    driver_count: analysis.result.concentration.driver_count,
    concentration_status: analysis.result.concentration.status,
    decision,
    reason
  };
  if (JSON.stringify(Object.keys(out).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) fail('ANL091_TELEMETRY_SHAPE_INVALID');
  return deepFreeze(out);
}

function assertContract() {
  if (CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'ANL-091') fail('ANL091_CONTRACT_INVALID');
  if (!CONTRACT.principles.free_only || CONTRACT.principles.financial_write_allowed || CONTRACT.principles.query_execution_allowed || CONTRACT.principles.query_mutation_allowed) fail('ANL091_PRINCIPLES_INVALID');
  if (Object.values(CONTRACT.authorities).some(Boolean)) fail('ANL091_AUTHORITY_INVALID');
  return true;
}

module.exports = {
  CONTRACT,
  SCHEMA,
  VERSION,
  REQUEST_SCHEMA,
  DATASET_SCHEMA,
  RESULT_SCHEMA,
  DRILL_SCHEMA,
  stableStringify,
  normalizeRequest,
  normalizeDataset,
  distribution,
  analyze,
  telemetry,
  assertContract
};
