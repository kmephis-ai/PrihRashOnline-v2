'use strict';

const crypto = require('crypto');
const CONTRACT = require('./dashboard_visual_customization.v1.json');
const FACTORY = require('./widget_factory');
const VIZ = require('../visualization/visualization_foundation');
const VIZ_REGISTRY = require('../visualization/visualization_registry_v2');
const CALCULATED = require('../analytics/calculated_metrics');
const DESIGN = require('../design/design_system.v1.json');

const SCHEMA = 'PRH_DASHBOARD_VISUAL_CUSTOMIZATION_V1';
const VERSION = '1.0.0';
const CUSTOMIZATION_SCHEMA = 'PRH_DASHBOARD_WIDGET_CUSTOMIZATION_V1';
const RESULT_SCHEMA = 'PRH_DASHBOARD_WIDGET_CUSTOMIZATION_RESULT_V1';
const TELEMETRY_SCHEMA = 'PRH_DASHBOARD_VISUAL_CUSTOMIZATION_TELEMETRY_V1';
const FORBIDDEN_KEYS = new Set([
  'data', 'dataset', 'rows', 'transactions', 'records', 'analytics_result', 'analytics_results',
  'amount', 'amount_minor', 'income_minor', 'expense_minor', 'cash_flow_minor', 'balance_minor',
  'financial_values', 'script', 'html', 'css', 'url', 'href', 'src'
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
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function assertNoHostilePayload(value, path = 'customization') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoHostilePayload(item, `${path}[${index}]`));
    return true;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && /(?:<\/?script|javascript:|data:text\/html|url\s*\()/i.test(value)) {
      fail('DASH085_HOSTILE_PRESENTATION_VALUE', path);
    }
    return true;
  }
  for (const [key, child] of Object.entries(value)) {
    const normalized = String(key).toLowerCase();
    if (FORBIDDEN_KEYS.has(normalized) || normalized.endsWith('_amount') || normalized.endsWith('_amount_minor')) {
      fail('DASH085_FORBIDDEN_PAYLOAD_KEY', `${path}.${key}`);
    }
    assertNoHostilePayload(child, `${path}.${key}`);
  }
  return true;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'DASH-085' ||
      CONTRACT.schemas.customization !== CUSTOMIZATION_SCHEMA || CONTRACT.schemas.result !== RESULT_SCHEMA ||
      CONTRACT.schemas.telemetry !== TELEMETRY_SCHEMA) fail('DASH085_CONTRACT_INVALID');
  FACTORY.assertContract();
  VIZ.assertContract();
  VIZ_REGISTRY.assertContract();
  CALCULATED.assertContract();
  if (!DESIGN || DESIGN.schema !== 'PRH_DESIGN_SYSTEM_V1' || DESIGN.version !== '1.0.0') fail('DASH085_DESIGN_UPSTREAM_INVALID');
  const upstream = CONTRACT.upstream || {};
  if (upstream.widget_factory !== `${FACTORY.SCHEMA}@${FACTORY.VERSION}` ||
      upstream.design_system !== `${DESIGN.schema}@${DESIGN.version}` ||
      upstream.visualization_registry !== `${VIZ_REGISTRY.SCHEMA}@${VIZ_REGISTRY.VERSION}` ||
      upstream.calculated_metrics !== `${CALCULATED.SCHEMA}@${CALCULATED.VERSION}` ||
      upstream.financial_truth_policy !== 'FIN-TRUTH-v1') fail('DASH085_UPSTREAM_CONTRACT_INVALID');
  const p = CONTRACT.principles || {};
  if (p.configuration_only !== true || p.design_token_only !== true || p.arbitrary_css_allowed !== false ||
      p.arbitrary_html_allowed !== false || p.arbitrary_url_allowed !== false || p.query_mutation_allowed !== false ||
      p.financial_formula_allowed !== false || p.financial_payload_allowed !== false ||
      p.advanced_chart_pack_in_scope !== false || p.data_hidden_for_density_allowed !== false ||
      p.semantic_table_fallback_required_for_charts !== true || p.text_summary_required_for_charts !== true ||
      p.free_only !== true) fail('DASH085_BOUNDARY_INVALID');
  if (!CONTRACT.authority || Object.values(CONTRACT.authority).some((value) => value !== false)) fail('DASH085_AUTHORITY_INVALID');
  if (!CALCULATED.OPERATORS.includes(CONTRACT.top_n.operator)) fail('DASH085_TOP_N_UPSTREAM_INVALID');
  for (const [id, tokens] of Object.entries(CONTRACT.palette_registry || {})) {
    if (!/^[A-Z][A-Z0-9_]{0,31}$/.test(id) || !Array.isArray(tokens) || tokens.length < 1) fail('DASH085_PALETTE_REGISTRY_INVALID');
    for (const token of tokens) {
      if (!(token in DESIGN.themes.light) || !(token in DESIGN.themes.dark)) fail('DASH085_PALETTE_TOKEN_UNKNOWN', token);
    }
  }
  return true;
}

function enumValue(value, allowed, fallback, code) {
  const normalized = value == null ? fallback : String(value).trim().toUpperCase();
  if (!allowed.includes(normalized)) fail(code, normalized);
  return normalized;
}

function assertObject(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
}

function assertAllowedKeys(value, allowed, code) {
  assertObject(value, code);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(code, key);
}

function effectiveDimensions(binding) {
  const dimensions = binding.query.dimensions.slice();
  if (binding.query.grain !== 'NONE') dimensions.push('time_bucket');
  return dimensions;
}

function normalizeAxes(input, kind, chartType) {
  if (input == null) {
    if (kind !== 'CHART' || chartType === 'DONUT') return deepFreeze({ x: 'HIDE', y: 'HIDE' });
    return deepFreeze({ x: 'AUTO', y: 'AUTO' });
  }
  assertAllowedKeys(input, ['x', 'y'], 'DASH085_AXES_SHAPE_INVALID');
  if (kind !== 'CHART') fail('DASH085_AXES_NON_CHART_FORBIDDEN');
  const x = enumValue(input.x, CONTRACT.axis_modes, 'AUTO', 'DASH085_AXIS_MODE_INVALID');
  const y = enumValue(input.y, CONTRACT.axis_modes, 'AUTO', 'DASH085_AXIS_MODE_INVALID');
  if (chartType === 'DONUT' && (x !== 'HIDE' || y !== 'HIDE')) fail('DASH085_DONUT_AXES_FORBIDDEN');
  return deepFreeze({ x, y });
}

function normalizeSort(input, binding) {
  if (input == null) return deepFreeze({ direction: 'NONE', by: 'VALUE' });
  assertAllowedKeys(input, ['direction', 'by'], 'DASH085_SORT_SHAPE_INVALID');
  const direction = enumValue(input.direction, CONTRACT.sort.directions, 'NONE', 'DASH085_SORT_DIRECTION_INVALID');
  const by = enumValue(input.by, CONTRACT.sort.by, 'VALUE', 'DASH085_SORT_BY_INVALID');
  if (direction !== 'NONE') {
    if (!['CHART', 'TABLE'].includes(binding.kind)) fail('DASH085_SORT_WIDGET_KIND_FORBIDDEN');
    if (effectiveDimensions(binding).length === 0) fail('DASH085_SORT_REQUIRES_DIMENSION');
  }
  return deepFreeze({ direction, by });
}

function normalizeTopN(input, binding) {
  if (input == null) return null;
  assertAllowedKeys(input, ['n', 'remainder'], 'DASH085_TOP_N_SHAPE_INVALID');
  if (!['CHART', 'TABLE'].includes(binding.kind)) fail('DASH085_TOP_N_WIDGET_KIND_FORBIDDEN');
  if (effectiveDimensions(binding).length === 0) fail('DASH085_TOP_N_REQUIRES_DIMENSION');
  const n = Number(input.n);
  if (!Number.isInteger(n) || n < CONTRACT.top_n.min || n > CONTRACT.top_n.max) fail('DASH085_TOP_N_INVALID');
  const remainder = String(input.remainder || '').toUpperCase();
  if (remainder !== CONTRACT.top_n.remainder) fail('DASH085_TOP_N_REMAINDER_INVALID');
  return deepFreeze({ operator: CONTRACT.top_n.operator, n, remainder });
}

function normalizeNumberFormat(input) {
  if (input == null) return deepFreeze({ style: 'AUTO', fraction_digits: 0, sign: 'AUTO' });
  assertAllowedKeys(input, ['style', 'fraction_digits', 'sign'], 'DASH085_NUMBER_FORMAT_SHAPE_INVALID');
  const style = enumValue(input.style, CONTRACT.number_format.styles, 'AUTO', 'DASH085_NUMBER_FORMAT_STYLE_INVALID');
  const fractionDigits = input.fraction_digits == null ? 0 : Number(input.fraction_digits);
  if (!Number.isInteger(fractionDigits) || fractionDigits < CONTRACT.number_format.fraction_digits_min ||
      fractionDigits > CONTRACT.number_format.fraction_digits_max) fail('DASH085_NUMBER_FORMAT_FRACTION_INVALID');
  const sign = enumValue(input.sign, CONTRACT.number_format.sign_modes, 'AUTO', 'DASH085_NUMBER_FORMAT_SIGN_INVALID');
  return deepFreeze({ style, fraction_digits: fractionDigits, sign });
}

function chartWidget(binding) {
  return {
    schema: VIZ.WIDGET_SPEC_SCHEMA,
    contract_version: VIZ.VERSION,
    id: binding.widget_id,
    kind: 'CHART',
    query_ref: `q-${binding.query_hash.slice(0, 24)}`,
    chart_spec: binding.presentation
  };
}

function normalizeCustomization(bindingInput, input) {
  assertContract();
  const binding = FACTORY.normalizeBinding(bindingInput);
  assertNoHostilePayload(input);
  assertAllowedKeys(input, [
    'schema', 'contract_version', 'theme', 'palette', 'chart_type', 'axes', 'labels', 'legend', 'stack',
    'sort', 'top_n', 'number_format', 'density'
  ], 'DASH085_CUSTOMIZATION_SHAPE_INVALID');
  if (input.schema !== CUSTOMIZATION_SCHEMA || input.contract_version !== VERSION) fail('DASH085_CUSTOMIZATION_VERSION_INVALID');

  const theme = enumValue(input.theme, CONTRACT.themes, 'SYSTEM', 'DASH085_THEME_INVALID');
  const palette = String(input.palette == null ? 'DEFAULT' : input.palette).trim().toUpperCase();
  if (!CONTRACT.palette_registry[palette]) fail('DASH085_PALETTE_UNKNOWN', palette);
  const density = enumValue(input.density, CONTRACT.densities, 'COMFORTABLE', 'DASH085_DENSITY_INVALID');

  let chartType = null;
  if (binding.kind === 'CHART') {
    chartType = enumValue(input.chart_type, CONTRACT.chart_types, binding.presentation.type, 'DASH085_CHART_TYPE_INVALID');
  } else if (input.chart_type != null) {
    fail('DASH085_CHART_TYPE_NON_CHART_FORBIDDEN');
  }

  const axes = normalizeAxes(input.axes, binding.kind, chartType);
  const labels = enumValue(input.labels, CONTRACT.visibility_modes, 'AUTO', 'DASH085_LABELS_INVALID');
  const legend = enumValue(input.legend, CONTRACT.visibility_modes, binding.kind === 'CHART' ? 'AUTO' : 'HIDE', 'DASH085_LEGEND_INVALID');
  if (binding.kind !== 'CHART' && legend !== 'HIDE') fail('DASH085_LEGEND_NON_CHART_FORBIDDEN');
  const stack = enumValue(input.stack, CONTRACT.stack_modes, 'OFF', 'DASH085_STACK_INVALID');
  if (stack === 'ON') {
    if (binding.kind !== 'CHART' || !['BAR', 'LINE'].includes(chartType)) fail('DASH085_STACK_CHART_TYPE_FORBIDDEN');
    if (!binding.presentation.encoding.series) fail('DASH085_STACK_REQUIRES_SERIES');
  }
  const sort = normalizeSort(input.sort, binding);
  const topN = normalizeTopN(input.top_n, binding);
  const numberFormat = normalizeNumberFormat(input.number_format);

  return deepFreeze({
    schema: CUSTOMIZATION_SCHEMA,
    contract_version: VERSION,
    theme,
    palette,
    chart_type: chartType,
    axes,
    labels,
    legend,
    stack,
    sort,
    top_n: topN,
    number_format: numberFormat,
    density
  });
}

function applyCustomization(bindingInput, customizationInput) {
  assertContract();
  const binding = FACTORY.normalizeBinding(bindingInput);
  const customization = normalizeCustomization(bindingInput, customizationInput);
  let effectiveChartSpec = null;
  if (binding.kind === 'CHART') {
    const retyped = VIZ_REGISTRY.retypeWidget(chartWidget(binding), customization.chart_type, binding.query);
    if (retyped.query_hash !== binding.query_hash || retyped.query_modified !== false) fail('DASH085_QUERY_IDENTITY_CHANGED');
    effectiveChartSpec = retyped.widget.chart_spec;
  }
  const a11y = deepFreeze({
    focus_visible_required: DESIGN.accessibility.focus_visible_required === true,
    reduced_motion_required: DESIGN.accessibility.reduced_motion_required === true,
    semantic_table_required: binding.kind === 'CHART',
    text_summary_required: binding.kind === 'CHART',
    data_hidden_for_density: false
  });
  const paletteTokens = deepFreeze(CONTRACT.palette_registry[customization.palette].slice());
  const identityBody = {
    widget_id: binding.widget_id,
    binding_hash: binding.binding_hash,
    query_hash: binding.query_hash,
    customization
  };
  const body = {
    schema: RESULT_SCHEMA,
    contract_version: VERSION,
    widget_id: binding.widget_id,
    widget_kind: binding.kind,
    binding_hash: binding.binding_hash,
    query_hash: binding.query_hash,
    query_modified: false,
    financial_truth_policy: 'FIN-TRUTH-v1',
    customization,
    palette_tokens: paletteTokens,
    effective_chart_spec: effectiveChartSpec,
    top_n_operator: customization.top_n ? CONTRACT.top_n.operator : null,
    a11y
  };
  return deepFreeze({ ...body, customization_hash: sha256(stableStringify(identityBody)) });
}

function telemetry(result, decision = 'ACCEPTED', reason = 'OK') {
  assertContract();
  if (!result || result.schema !== RESULT_SCHEMA || result.contract_version !== VERSION || !/^[0-9a-f]{64}$/.test(result.customization_hash || '')) {
    fail('DASH085_RESULT_INVALID');
  }
  const output = deepFreeze({
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    theme: result.customization.theme,
    chart_type: result.customization.chart_type,
    density: result.customization.density,
    customization_hash_prefix: result.customization_hash.slice(0, 12),
    decision: String(decision || '').toUpperCase(),
    reason: String(reason || '').toUpperCase()
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) fail('DASH085_TELEMETRY_SHAPE_INVALID');
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  CUSTOMIZATION_SCHEMA,
  RESULT_SCHEMA,
  TELEMETRY_SCHEMA,
  assertContract,
  assertNoHostilePayload,
  normalizeCustomization,
  applyCustomization,
  telemetry
});
