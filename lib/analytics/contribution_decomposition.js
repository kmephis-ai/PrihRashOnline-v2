'use strict';

const crypto = require('crypto');
const CONTRACT = require('./contribution_decomposition.v1.json');
const ANALYTICS = require('./analytics_engine');
const SEMANTIC = require('./semantic_registry.v1.json');
const VIZ090 = require('../visualization/advanced_visualization_pack');

const SCHEMA = 'PRH_CONTRIBUTION_DECOMPOSITION_V1';
const VERSION = '1.0.0';
const REQUEST_SCHEMA = 'PRH_CONTRIBUTION_REQUEST_V1';
const AGGREGATE_SCHEMA = 'PRH_CONTRIBUTION_PERIOD_AGGREGATE_V1';
const RESULT_SCHEMA = 'PRH_CONTRIBUTION_RESULT_V1';
const EVIDENCE_SCHEMA = 'PRH_CONTRIBUTION_EVIDENCE_V1';
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
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

function safeSubtract(a, b, code) {
  const value = a - b;
  if (!Number.isSafeInteger(value)) fail(code);
  return value;
}

function safeAbs(value, code) {
  const output = Math.abs(value);
  if (!Number.isSafeInteger(output)) fail(code);
  return output;
}

function driverId(value) {
  const id = String(value == null ? '' : value);
  if (!DRIVER_RE.test(id) || id.length > CONTRACT.limits.max_driver_id_length) fail('ANL090_DRIVER_ID_INVALID');
  return id;
}

function recursiveFindById(node, id, seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return null;
  seen.add(node);
  if (!Array.isArray(node) && String(node.id || '') === id) return node;
  if (!Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, id) && node[id] && typeof node[id] === 'object') return node[id];
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const value of values) {
    const found = recursiveFindById(value, id, seen);
    if (found) return found;
  }
  return null;
}

function registryEntry(id, kind) {
  const entry = recursiveFindById(SEMANTIC, id);
  if (!entry) fail(kind === 'MEASURE' ? 'ANL090_MEASURE_NOT_IN_SEMANTIC_REGISTRY' : 'ANL090_DIMENSION_NOT_IN_SEMANTIC_REGISTRY', id);
  return entry;
}

function isAdditiveMeasure(id, entry) {
  if (CONTRACT.supported_core_measures.includes(id)) return true;
  const text = stableStringify(entry).toUpperCase();
  if (/\b(?:SUM|ADDITIVE)\b/.test(text) && !/NON[_ -]?ADDITIVE|RATIO|SHARE|PERCENT|MEDIAN|AVERAGE|AVG/.test(text)) return true;
  return false;
}

function assertMeasureDimension(measure, dimension) {
  if (!CONTRACT.supported_dimensions.includes(dimension)) fail('ANL090_DIMENSION_UNSUPPORTED');
  const measureEntry = registryEntry(measure, 'MEASURE');
  registryEntry(dimension, 'DIMENSION');
  if (!isAdditiveMeasure(measure, measureEntry)) fail('ANL090_MEASURE_NON_ADDITIVE');
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

function periodDescriptor(timeRange) {
  if (!timeRange || typeof timeRange !== 'object') fail('ANL090_EXPLICIT_TIME_RANGE_REQUIRED');
  const dates = Array.from(new Set(collectIsoDays(timeRange))).sort();
  if (dates.length !== 2) fail('ANL090_TIME_RANGE_BOUNDS_INVALID');
  const [start, end] = dates;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) fail('ANL090_TIME_RANGE_ORDER_INVALID');
  const spanDays = (endMs - startMs) / 86400000;
  if (!Number.isInteger(spanDays) || spanDays < 1) fail('ANL090_TIME_RANGE_SPAN_INVALID');
  return deepFreeze({ start, end, span_days: spanDays, period_hash: sha256(stableStringify(timeRange)) });
}

function queryWithoutTime(query) {
  return { ...query, time_range: null };
}

function ensureNoDriverFilter(query, dimension) {
  if ((query.filters || []).some((filter) => filter.field === dimension)) fail('ANL090_DRIVER_FILTER_ALREADY_PRESENT');
}

function normalizeRequest(input) {
  assertContract();
  exactKeys(input, ['schema', 'contract_version', 'measure', 'dimension', 'current_query', 'reference_query'], 'ANL090_REQUEST_SHAPE_INVALID');
  if (input.schema !== REQUEST_SCHEMA || input.contract_version !== VERSION) fail('ANL090_REQUEST_VERSION_INVALID');
  const measure = String(input.measure || '');
  const dimension = String(input.dimension || '');
  assertMeasureDimension(measure, dimension);
  const currentQuery = ANALYTICS.normalizeAnalyticsQuery(input.current_query);
  const referenceQuery = ANALYTICS.normalizeAnalyticsQuery(input.reference_query);
  if (currentQuery.measures.length !== 1 || currentQuery.measures[0] !== measure || referenceQuery.measures.length !== 1 || referenceQuery.measures[0] !== measure) {
    fail('ANL090_QUERY_MEASURE_MISMATCH');
  }
  if (!currentQuery.dimensions.includes(dimension) || !referenceQuery.dimensions.includes(dimension)) fail('ANL090_QUERY_DIMENSION_MISSING');
  ensureNoDriverFilter(currentQuery, dimension);
  ensureNoDriverFilter(referenceQuery, dimension);
  if (stableStringify(queryWithoutTime(currentQuery)) !== stableStringify(queryWithoutTime(referenceQuery))) fail('ANL090_QUERY_CONTEXT_MISMATCH');
  const currentPeriod = periodDescriptor(currentQuery.time_range);
  const referencePeriod = periodDescriptor(referenceQuery.time_range);
  if (currentPeriod.span_days !== referencePeriod.span_days) fail('ANL090_PERIOD_NOT_COMPARABLE');
  const currentQueryHash = ANALYTICS.analyticsQueryHash(currentQuery);
  const referenceQueryHash = ANALYTICS.analyticsQueryHash(referenceQuery);
  const body = {
    schema: REQUEST_SCHEMA,
    contract_version: VERSION,
    measure,
    dimension,
    current_query: currentQuery,
    reference_query: referenceQuery,
    current_query_hash: currentQueryHash,
    reference_query_hash: referenceQueryHash,
    current_period: currentPeriod,
    reference_period: referencePeriod,
    comparison_policy: 'EQUAL_SPAN_EXPLICIT_PERIODS_V1',
    causality_claimed: false
  };
  return deepFreeze({ ...body, request_hash: sha256(stableStringify(body)) });
}

function normalizeAggregate(input, expectedQueryHash) {
  exactKeys(input, ['schema', 'contract_version', 'query_hash', 'source_contract', 'total', 'rows'], 'ANL090_AGGREGATE_SHAPE_INVALID');
  if (input.schema !== AGGREGATE_SCHEMA || input.contract_version !== VERSION) fail('ANL090_AGGREGATE_VERSION_INVALID');
  if (String(input.query_hash || '') !== expectedQueryHash) fail('ANL090_AGGREGATE_QUERY_HASH_MISMATCH');
  const sourceContract = String(input.source_contract || '');
  if (!/^[A-Z][A-Z0-9_]+@[0-9]+\.[0-9]+\.[0-9]+$/.test(sourceContract)) fail('ANL090_SOURCE_CONTRACT_INVALID');
  const total = safeInteger(input.total, 'ANL090_TOTAL_INVALID');
  if (!Array.isArray(input.rows) || input.rows.length > CONTRACT.limits.max_drivers) fail('ANL090_ROWS_LIMIT');
  const seen = new Set();
  const rows = input.rows.map((row) => {
    exactKeys(row, ['driver_id', 'value'], 'ANL090_AGGREGATE_ROW_SHAPE_INVALID');
    const id = driverId(row.driver_id);
    if (seen.has(id)) fail('ANL090_DRIVER_DUPLICATE', id);
    seen.add(id);
    return { driver_id: id, value: safeInteger(row.value, 'ANL090_DRIVER_VALUE_INVALID') };
  }).sort((a, b) => a.driver_id.localeCompare(b.driver_id));
  let sum = 0;
  for (const row of rows) sum = safeAdd(sum, row.value, 'ANL090_PERIOD_SUM_OVERFLOW');
  if (sum !== total) fail('ANL090_PERIOD_TOTAL_RECONCILIATION_FAILED');
  const body = { schema: AGGREGATE_SCHEMA, contract_version: VERSION, query_hash: expectedQueryHash, source_contract: sourceContract, total, rows };
  return deepFreeze({ ...body, aggregate_hash: sha256(stableStringify(body)) });
}

function addEvidenceFilter(query, dimension, id) {
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

function evidenceFor(request, id) {
  const currentQuery = addEvidenceFilter(request.current_query, request.dimension, id);
  const referenceQuery = addEvidenceFilter(request.reference_query, request.dimension, id);
  const body = {
    schema: EVIDENCE_SCHEMA,
    contract_version: VERSION,
    mode: 'READ_ONLY',
    driver_dimension: request.dimension,
    driver_id: id,
    driver_hash: sha256(id),
    current_query: currentQuery,
    reference_query: referenceQuery,
    current_query_hash: ANALYTICS.analyticsQueryHash(currentQuery),
    reference_query_hash: ANALYTICS.analyticsQueryHash(referenceQuery),
    current_period_hash: request.current_period.period_hash,
    reference_period_hash: request.reference_period.period_hash,
    financial_values_in_navigation: false,
    financial_write: false
  };
  return deepFreeze({ ...body, evidence_hash: sha256(stableStringify(body)) });
}

function ratioBps(numerator, denominator, code) {
  if (denominator === 0) return null;
  const sign = numerator < 0 ? -1n : 1n;
  const value = (BigInt(Math.abs(numerator)) * 10000n) / BigInt(Math.abs(denominator));
  const signed = sign * value;
  const number = Number(signed);
  if (!Number.isSafeInteger(number)) fail(code);
  return number;
}

function classify(currentPresent, referencePresent, current, reference, delta) {
  if (!referencePresent && currentPresent) return 'NEW';
  if (referencePresent && !currentPresent) return 'REMOVED';
  if (delta === 0) return 'UNCHANGED';
  return delta > 0 ? 'INCREASE' : 'DECREASE';
}

function decompose(requestInput, currentInput, referenceInput) {
  const request = normalizeRequest(requestInput);
  const current = normalizeAggregate(currentInput, request.current_query_hash);
  const reference = normalizeAggregate(referenceInput, request.reference_query_hash);
  if (current.source_contract !== reference.source_contract) fail('ANL090_AGGREGATE_PROVENANCE_MISMATCH');
  const currentMap = new Map(current.rows.map((row) => [row.driver_id, row.value]));
  const referenceMap = new Map(reference.rows.map((row) => [row.driver_id, row.value]));
  const ids = Array.from(new Set([...currentMap.keys(), ...referenceMap.keys()])).sort();
  if (ids.length > CONTRACT.limits.max_drivers) fail('ANL090_DRIVER_UNION_LIMIT');
  const totalDelta = safeSubtract(current.total, reference.total, 'ANL090_TOTAL_DELTA_OVERFLOW');
  const preliminary = ids.map((id) => {
    const currentPresent = currentMap.has(id);
    const referencePresent = referenceMap.has(id);
    const currentValue = currentPresent ? currentMap.get(id) : 0;
    const referenceValue = referencePresent ? referenceMap.get(id) : 0;
    const delta = safeSubtract(currentValue, referenceValue, 'ANL090_DRIVER_DELTA_OVERFLOW');
    return {
      driver_id: id,
      driver_hash: sha256(id),
      current_present: currentPresent,
      reference_present: referencePresent,
      current_value: currentValue,
      reference_value: referenceValue,
      delta,
      absolute_delta: safeAbs(delta, 'ANL090_DRIVER_ABS_OVERFLOW'),
      state: classify(currentPresent, referencePresent, currentValue, referenceValue, delta)
    };
  });
  let deltaSum = 0;
  let absoluteSum = 0;
  for (const row of preliminary) {
    deltaSum = safeAdd(deltaSum, row.delta, 'ANL090_DELTA_SUM_OVERFLOW');
    absoluteSum = safeAdd(absoluteSum, row.absolute_delta, 'ANL090_ABSOLUTE_SUM_OVERFLOW');
  }
  if (deltaSum !== totalDelta) fail('ANL090_DELTA_RECONCILIATION_FAILED');
  preliminary.sort((a, b) => b.absolute_delta - a.absolute_delta || b.delta - a.delta || a.driver_id.localeCompare(b.driver_id));
  const rows = preliminary.map((row, index) => deepFreeze({
    ...row,
    rank: index + 1,
    materiality_bps: absoluteSum === 0 ? 0 : ratioBps(row.absolute_delta, absoluteSum, 'ANL090_MATERIALITY_BPS_OVERFLOW'),
    net_contribution_bps: totalDelta === 0 ? null : ratioBps(row.delta, totalDelta, 'ANL090_NET_BPS_OVERFLOW'),
    zero_total_delta: totalDelta === 0,
    causality_claimed: false,
    evidence: evidenceFor(request, row.driver_id)
  }));
  const resultBody = {
    schema: RESULT_SCHEMA,
    contract_version: VERSION,
    request_hash: request.request_hash,
    measure: request.measure,
    dimension: request.dimension,
    current_query_hash: request.current_query_hash,
    reference_query_hash: request.reference_query_hash,
    current_total: current.total,
    reference_total: reference.total,
    total_delta: totalDelta,
    absolute_change_total: absoluteSum,
    driver_count: rows.length,
    changed_count: rows.filter((row) => row.delta !== 0).length,
    rows,
    arithmetic: 'CURRENT_MINUS_REFERENCE',
    missing_driver_policy: 'EXPLICIT_ZERO_FOR_DECOMPOSITION_ONLY',
    causality_claimed: false,
    financial_truth_policy: 'FIN-TRUTH-v1'
  };
  return deepFreeze({
    request,
    current_aggregate: current,
    reference_aggregate: reference,
    result: deepFreeze({ ...resultBody, result_hash: sha256(stableStringify(resultBody)) })
  });
}

function toWaterfallSource(decomposition) {
  if (!decomposition || !decomposition.request || !decomposition.result) fail('ANL090_DECOMPOSITION_INVALID');
  const request = decomposition.request;
  const result = decomposition.result;
  const changed = result.rows.filter((row) => row.delta !== 0);
  const rows = [{ id: 'reference-total', order: 0, kind: 'START', value: result.reference_total }];
  changed.forEach((row, index) => rows.push({
    id: `driver-${row.driver_hash.slice(0, 24)}`,
    order: index + 1,
    kind: 'DELTA',
    value: row.delta
  }));
  rows.push({ id: 'current-total', order: rows.length, kind: 'END', value: result.current_total });
  return deepFreeze({
    schema: VIZ090.SOURCE_SCHEMA,
    contract_version: VIZ090.VERSION,
    query_hash: request.current_query_hash,
    source_contract: `${SCHEMA}@${VERSION}`,
    shape: 'WATERFALL',
    data: { rows }
  });
}

function telemetry(decomposition, decision = 'ACCEPTED', reason = 'OK') {
  if (!decomposition || !decomposition.request || !decomposition.result) fail('ANL090_DECOMPOSITION_INVALID');
  const request = decomposition.request;
  const result = decomposition.result;
  const output = deepFreeze({
    schema: SCHEMA,
    version: VERSION,
    measure: request.measure,
    dimension: request.dimension,
    request_hash_prefix: request.request_hash.slice(0, 12),
    result_hash_prefix: result.result_hash.slice(0, 12),
    current_query_hash_prefix: request.current_query_hash.slice(0, 12),
    reference_query_hash_prefix: request.reference_query_hash.slice(0, 12),
    driver_count: result.driver_count,
    changed_count: result.changed_count,
    decision: String(decision || '').toUpperCase(),
    reason: String(reason || '').toUpperCase()
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) fail('ANL090_TELEMETRY_SHAPE_INVALID');
  return output;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'ANL-090') fail('ANL090_CONTRACT_INVALID');
  ANALYTICS.assertContract();
  VIZ090.assertContract();
  if (!SEMANTIC || typeof SEMANTIC !== 'object') fail('ANL090_SEMANTIC_REGISTRY_INVALID');
  if (!CONTRACT.authorities || Object.values(CONTRACT.authorities).some((value) => value !== false)) fail('ANL090_AUTHORITY_INVALID');
  const p = CONTRACT.principles || {};
  if (p.additive_only !== true || p.causality_claimed !== false || p.missing_driver_means_zero_for_decomposition_only !== true ||
      p.query_mutation_allowed !== false || p.financial_formula_authority !== false || p.financial_write_allowed !== false ||
      p.public_financial_values_allowed !== false || p.free_only !== true) fail('ANL090_BOUNDARY_INVALID');
  for (const measure of CONTRACT.supported_core_measures) registryEntry(measure, 'MEASURE');
  for (const dimension of CONTRACT.supported_dimensions) registryEntry(dimension, 'DIMENSION');
  return true;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  REQUEST_SCHEMA,
  AGGREGATE_SCHEMA,
  RESULT_SCHEMA,
  EVIDENCE_SCHEMA,
  assertContract,
  normalizeRequest,
  normalizeAggregate,
  decompose,
  toWaterfallSource,
  telemetry,
  stableStringify
});
