'use strict';

const crypto = require('crypto');
const CONTRACT = require('./widget_factory.v1.json');
const COMPOSER = require('./dashboard_composer');
const ANALYTICS = require('../analytics/analytics_engine');
const VIZ_REGISTRY = require('../visualization/visualization_registry_v2');
const PIVOT = require('../analytics/pivot_olap');

const SCHEMA = 'PRH_WIDGET_FACTORY_V1';
const VERSION = '1.0.0';
const BINDING_SCHEMA = 'PRH_WIDGET_BINDING_V1';
const VALIDATION_SCHEMA = 'PRH_WIDGET_BINDING_VALIDATION_V1';
const BOUND_DESCRIPTOR_SCHEMA = 'PRH_DASHBOARD_BOUND_WIDGET_V1';
const VALUE_PRESENTATION_SCHEMA = 'PRH_VALUE_WIDGET_PRESENTATION_V1';
const TABLE_PRESENTATION_SCHEMA = 'PRH_TABLE_PRESENTATION_V1';
const KINDS = Object.freeze(Object.keys(CONTRACT.widget_registry));
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const RESULT_PAYLOAD_KEYS = new Set([
  'analytics_result', 'analytics_results', 'dataset', 'transactions', 'transaction_rows', 'records',
  'financial_values', 'amount_minor', 'balance_minor', 'income_minor', 'expense_minor', 'cash_flow_minor',
  'savings_minor', 'budget_variance_minor', 'gross_expense_minor', 'refund_minor', 'transfer_minor'
]);

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function stableStringify(value) {
  return ANALYTICS.stableStringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function exactKeys(value, allowed, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const actual = Object.keys(value).sort();
  const expected = allowed.slice().sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(reason);
  return value;
}

function safeId(value, reason) {
  const text = String(value == null ? '' : value).trim();
  if (!ID_RE.test(text)) fail(reason);
  return text;
}

function shortText(value, max, reason) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text.length > max) fail(reason);
  return text;
}

function assertNoFinancialResultPayload(value, path = 'binding') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoFinancialResultPayload(item, `${path}[${index}]`));
    return true;
  }
  if (!value || typeof value !== 'object') return true;
  for (const [key, child] of Object.entries(value)) {
    const normalized = String(key).toLowerCase();
    if (RESULT_PAYLOAD_KEYS.has(normalized)) fail('DASH081_FINANCIAL_RESULT_PAYLOAD_FORBIDDEN', `${path}.${key}`);
    assertNoFinancialResultPayload(child, `${path}.${key}`);
  }
  return true;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'DASH-081' ||
      CONTRACT.binding_schema !== BINDING_SCHEMA || CONTRACT.validation_schema !== VALIDATION_SCHEMA ||
      CONTRACT.bound_descriptor_schema !== BOUND_DESCRIPTOR_SCHEMA) {
    fail('DASH081_CONTRACT_INVALID');
  }
  COMPOSER.assertContract();
  ANALYTICS.assertContract();
  VIZ_REGISTRY.assertContract();
  PIVOT.assertContract();
  const upstream = CONTRACT.upstream || {};
  if (upstream.dashboard_composer !== `${COMPOSER.SCHEMA}@${COMPOSER.VERSION}` ||
      upstream.analytics_contract !== `PRH_ANALYTICS_CONTRACT_V1@${ANALYTICS.CONTRACT_VERSION}` ||
      upstream.visualization_registry !== `${VIZ_REGISTRY.SCHEMA}@${VIZ_REGISTRY.VERSION}` ||
      upstream.pivot_olap !== `${PIVOT.SCHEMA}@${PIVOT.VERSION}` ||
      upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('DASH081_UPSTREAM_CONTRACT_INVALID');
  }
  if (JSON.stringify(KINDS.slice().sort()) !== JSON.stringify(['CARD', 'CHART', 'KPI', 'PIVOT', 'TABLE'])) {
    fail('DASH081_WIDGET_REGISTRY_INVALID');
  }
  const principles = CONTRACT.principles || {};
  if (principles.configuration_only !== true || principles.explicit_bind_only !== true ||
      principles.implicit_auto_bind !== false || principles.query_mutation_allowed !== false ||
      principles.query_execution_authority !== false || principles.financial_formula_allowed !== false ||
      principles.financial_result_in_binding_allowed !== false || principles.transaction_payload_allowed !== false ||
      principles.broken_binding_fallback_allowed !== false || principles.public_financial_evidence !== 'SYNTHETIC_ONLY' ||
      principles.free_only !== true) {
    fail('DASH081_BOUNDARY_INVALID');
  }
  if (!CONTRACT.authority || Object.values(CONTRACT.authority).some((value) => value !== false)) {
    fail('DASH081_AUTHORITY_INVALID');
  }
  return true;
}

function effectiveQueryDimensions(query) {
  const dimensions = query.dimensions.slice();
  if (query.grain !== 'NONE') dimensions.push('time_bucket');
  return dimensions;
}

function sortedSet(items) {
  return Array.from(new Set(items)).sort();
}

function assertSameSet(left, right, reason) {
  if (JSON.stringify(sortedSet(left)) !== JSON.stringify(sortedSet(right))) fail(reason);
}

function normalizeValuePresentation(input, kind) {
  exactKeys(input, ['schema', 'contract_version', 'title', 'show_comparison'], 'DASH081_VALUE_PRESENTATION_SHAPE_INVALID');
  if (input.schema !== VALUE_PRESENTATION_SCHEMA || input.contract_version !== VERSION) fail('DASH081_VALUE_PRESENTATION_VERSION_INVALID');
  const title = shortText(input.title, CONTRACT.limits.max_title_length, 'DASH081_VALUE_TITLE_INVALID');
  if (typeof input.show_comparison !== 'boolean') fail('DASH081_VALUE_SHOW_COMPARISON_INVALID');
  return deepFreeze({
    schema: VALUE_PRESENTATION_SCHEMA,
    contract_version: VERSION,
    title,
    mode: kind,
    show_comparison: input.show_comparison
  });
}

function assertSingleMeasureUngrouped(query) {
  if (query.measures.length !== 1 || query.dimensions.length !== 0 || query.grain !== 'NONE') {
    fail('DASH081_VALUE_QUERY_MUST_BE_SINGLE_MEASURE_UNGROUPED');
  }
}

function normalizeTableColumn(input) {
  exactKeys(input, ['kind', 'id'], 'DASH081_TABLE_COLUMN_SHAPE_INVALID');
  const kind = String(input.kind || '');
  const id = String(input.id || '');
  if (!['DIMENSION', 'MEASURE'].includes(kind)) fail('DASH081_TABLE_COLUMN_KIND_INVALID');
  if (kind === 'DIMENSION') {
    if (id !== 'time_bucket' && !ANALYTICS.DIMENSIONS.includes(id)) fail('DASH081_TABLE_DIMENSION_INVALID');
  } else if (!ANALYTICS.MEASURES.includes(id)) {
    fail('DASH081_TABLE_MEASURE_INVALID');
  }
  return Object.freeze({ kind, id });
}

function normalizeTablePresentation(input, query) {
  exactKeys(input, ['schema', 'contract_version', 'title', 'columns'], 'DASH081_TABLE_PRESENTATION_SHAPE_INVALID');
  if (input.schema !== TABLE_PRESENTATION_SCHEMA || input.contract_version !== VERSION) fail('DASH081_TABLE_PRESENTATION_VERSION_INVALID');
  const title = shortText(input.title, CONTRACT.limits.max_title_length, 'DASH081_TABLE_TITLE_INVALID');
  if (!Array.isArray(input.columns) || input.columns.length < 1 || input.columns.length > CONTRACT.limits.max_table_columns) {
    fail('DASH081_TABLE_COLUMNS_INVALID');
  }
  const columns = input.columns.map(normalizeTableColumn);
  const signatures = columns.map((item) => `${item.kind}:${item.id}`);
  if (new Set(signatures).size !== signatures.length) fail('DASH081_TABLE_COLUMN_DUPLICATE');
  const expected = effectiveQueryDimensions(query).map((id) => `DIMENSION:${id}`)
    .concat(query.measures.map((id) => `MEASURE:${id}`));
  assertSameSet(signatures, expected, 'DASH081_TABLE_QUERY_FIELD_COVERAGE_MISMATCH');
  return deepFreeze({ schema: TABLE_PRESENTATION_SCHEMA, contract_version: VERSION, title, columns });
}

function normalizePivotPresentation(input, query) {
  if (query.comparison.mode !== 'NONE') fail('DASH081_PIVOT_QUERY_COMPARISON_UNSUPPORTED');
  const pivot = PIVOT.normalizePivotSpec(input);
  const pivotDimensions = pivot.rows.concat(pivot.columns).map((item) => item.dimension_id);
  const pivotMeasures = pivot.measures.map((item) => item.id);
  assertSameSet(pivotDimensions, effectiveQueryDimensions(query), 'DASH081_PIVOT_QUERY_DIMENSION_MISMATCH');
  assertSameSet(pivotMeasures, query.measures, 'DASH081_PIVOT_QUERY_MEASURE_MISMATCH');
  const timeAxis = pivot.rows.concat(pivot.columns).find((item) => item.dimension_id === 'time_bucket');
  const pivotGrain = timeAxis ? timeAxis.level : 'NONE';
  if (pivotGrain !== query.grain) fail('DASH081_PIVOT_QUERY_GRAIN_MISMATCH');
  return pivot;
}

function normalizePresentation(kind, input, query) {
  if (kind === 'KPI' || kind === 'CARD') {
    assertSingleMeasureUngrouped(query);
    return normalizeValuePresentation(input, kind);
  }
  if (kind === 'CHART') {
    const compatibility = VIZ_REGISTRY.assertQueryCompatibility(input, query);
    return compatibility.chart_spec;
  }
  if (kind === 'TABLE') return normalizeTablePresentation(input, query);
  if (kind === 'PIVOT') return normalizePivotPresentation(input, query);
  fail('DASH081_WIDGET_KIND_UNSUPPORTED');
}

function normalizeBinding(input) {
  assertContract();
  assertNoFinancialResultPayload(input);
  exactKeys(input, ['schema', 'contract_version', 'widget_id', 'kind', 'query', 'presentation'], 'DASH081_BINDING_SHAPE_INVALID');
  if (input.schema !== BINDING_SCHEMA || input.contract_version !== VERSION) fail('DASH081_BINDING_VERSION_INVALID');
  const widgetId = safeId(input.widget_id, 'DASH081_WIDGET_ID_INVALID');
  const kind = String(input.kind || '').toUpperCase();
  if (!KINDS.includes(kind)) fail('DASH081_WIDGET_KIND_UNSUPPORTED');
  const query = ANALYTICS.normalizeAnalyticsQuery(input.query);
  const queryHash = ANALYTICS.analyticsQueryHash(query);
  const presentation = normalizePresentation(kind, input.presentation, query);
  const body = {
    schema: BINDING_SCHEMA,
    contract_version: VERSION,
    widget_id: widgetId,
    kind,
    query,
    presentation,
    query_hash: queryHash,
    query_modified: false,
    financial_truth_policy: 'FIN-TRUTH-v1'
  };
  return deepFreeze({ ...body, binding_hash: sha256(stableStringify(body)) });
}

function validateBinding(input) {
  try {
    const binding = normalizeBinding(input);
    return Object.freeze({
      schema: VALIDATION_SCHEMA,
      contract_version: VERSION,
      status: 'VALID',
      reason: 'OK',
      widget_kind: binding.kind,
      query_hash: binding.query_hash,
      binding_hash: binding.binding_hash
    });
  } catch (error) {
    return Object.freeze({
      schema: VALIDATION_SCHEMA,
      contract_version: VERSION,
      status: 'INVALID',
      reason: String(error && error.code ? error.code : 'DASH081_BINDING_INVALID'),
      widget_kind: input && typeof input === 'object' ? String(input.kind || '').toUpperCase() : '',
      query_hash: null,
      binding_hash: null
    });
  }
}

function normalizePlaceholder(input) {
  exactKeys(input, ['schema', 'id', 'title', 'semantic_binding_status', 'geometry'], 'DASH081_PLACEHOLDER_SHAPE_INVALID');
  if (input.schema !== COMPOSER.WIDGET_SCHEMA || input.semantic_binding_status !== 'UNBOUND') fail('DASH081_PLACEHOLDER_NOT_UNBOUND');
  const id = String(input.id || '').trim();
  if (!/^w-[0-9]{4}$/.test(id)) fail('DASH081_PLACEHOLDER_ID_INVALID');
  shortText(input.title, 80, 'DASH081_PLACEHOLDER_TITLE_INVALID');
  exactKeys(input.geometry, ['x', 'y', 'w', 'h'], 'DASH081_PLACEHOLDER_GEOMETRY_INVALID');
  for (const key of ['x', 'y', 'w', 'h']) {
    if (!Number.isInteger(input.geometry[key])) fail('DASH081_PLACEHOLDER_GEOMETRY_INVALID');
  }
  return input;
}

function bindPlaceholder(placeholderInput, bindingInput) {
  assertContract();
  const placeholder = normalizePlaceholder(placeholderInput);
  const binding = normalizeBinding(bindingInput);
  if (placeholder.id !== binding.widget_id) fail('DASH081_PLACEHOLDER_BINDING_ID_MISMATCH');
  return deepFreeze({
    schema: BOUND_DESCRIPTOR_SCHEMA,
    contract_version: VERSION,
    widget_id: placeholder.id,
    semantic_binding_status: 'BOUND',
    layout_identity_authority: false,
    geometry_mutation: false,
    binding
  });
}

function registryEntry(kindInput) {
  assertContract();
  const kind = String(kindInput || '').toUpperCase();
  const entry = CONTRACT.widget_registry[kind];
  if (!entry) fail('DASH081_WIDGET_KIND_UNSUPPORTED');
  return deepFreeze({ kind, ...entry, authorities: { ...CONTRACT.authority } });
}

function telemetry(bindingOrValidation, decision = 'ACCEPTED', reason = 'OK') {
  assertContract();
  if (!bindingOrValidation || typeof bindingOrValidation !== 'object') fail('DASH081_TELEMETRY_INPUT_INVALID');
  const isBinding = bindingOrValidation.schema === BINDING_SCHEMA && bindingOrValidation.contract_version === VERSION;
  const isValidation = bindingOrValidation.schema === VALIDATION_SCHEMA && bindingOrValidation.contract_version === VERSION;
  if (!isBinding && !isValidation) fail('DASH081_TELEMETRY_INPUT_INVALID');
  const output = Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    widget_kind: String(isBinding ? bindingOrValidation.kind : bindingOrValidation.widget_kind || ''),
    query_hash_prefix: String(isBinding ? bindingOrValidation.query_hash : bindingOrValidation.query_hash || '').slice(0, 12),
    binding_hash_prefix: String(isBinding ? bindingOrValidation.binding_hash : bindingOrValidation.binding_hash || '').slice(0, 12),
    decision: String(decision || '').toUpperCase(),
    reason: String(reason || '').toUpperCase()
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) {
    fail('DASH081_TELEMETRY_SHAPE_INVALID');
  }
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  BINDING_SCHEMA,
  VALIDATION_SCHEMA,
  BOUND_DESCRIPTOR_SCHEMA,
  VALUE_PRESENTATION_SCHEMA,
  TABLE_PRESENTATION_SCHEMA,
  KINDS,
  assertContract,
  assertNoFinancialResultPayload,
  normalizeBinding,
  validateBinding,
  bindPlaceholder,
  registryEntry,
  telemetry
});
