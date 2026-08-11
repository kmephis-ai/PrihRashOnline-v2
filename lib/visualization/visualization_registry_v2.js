'use strict';

const crypto = require('crypto');
const CONTRACT = require('./visualization_registry_v2.v2.json');
const VIZ = require('./visualization_foundation');
const ANALYTICS = require('../analytics/analytics_engine');
const EXPLORATION = require('../analytics/exploration_state');

const SCHEMA = 'PRH_VISUALIZATION_REGISTRY_V2';
const VERSION = '2.0.0';
const PLAN_SCHEMA = 'PRH_VISUALIZATION_PLAN_V2';
const RETYPE_SCHEMA = 'PRH_VISUALIZATION_RETYPE_RESULT_V2';
const CHART_TYPES = Object.freeze(Object.keys(CONTRACT.chart_registry));
const RENDERERS = Object.freeze(Object.keys(CONTRACT.renderers));

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function stableStringify(value) {
  return VIZ.stableStringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'VIZ-070') {
    fail('VIZ070_CONTRACT_VERSION_INVALID');
  }
  if (CONTRACT.schemas.plan !== PLAN_SCHEMA || CONTRACT.schemas.retype_result !== RETYPE_SCHEMA) {
    fail('VIZ070_SCHEMA_CONTRACT_INVALID');
  }
  VIZ.assertContract();
  EXPLORATION.assertContract();
  ANALYTICS.assertContract();
  const upstream = CONTRACT.upstream || {};
  if (upstream.visualization_foundation !== `${VIZ.FOUNDATION_SCHEMA}@${VIZ.VERSION}` ||
      upstream.exploration_state !== `${EXPLORATION.SCHEMA}@${EXPLORATION.VERSION}` ||
      upstream.analytics_contract !== 'PRH_ANALYTICS_CONTRACT_V1@1.0.0' ||
      upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('VIZ070_UPSTREAM_CONTRACT_INVALID');
  }
  const principles = CONTRACT.principles || {};
  if (principles.registry_configuration_only !== true || principles.query_mutation_allowed !== false ||
      principles.financial_formula_allowed !== false || principles.renderer_owns_financial_truth !== false ||
      principles.renderer_owns_query_semantics !== false || principles.advanced_chart_pack_in_scope !== false ||
      principles.external_cdn_required !== false || principles.paid_dependency_required !== false ||
      principles.free_only !== true) {
    fail('VIZ070_BOUNDARY_INVALID');
  }
  if (JSON.stringify(CHART_TYPES.slice().sort()) !== JSON.stringify(['BAR', 'DONUT', 'LINE'])) {
    fail('VIZ070_CHART_SET_INVALID');
  }
  for (const chartType of CHART_TYPES) {
    const item = CONTRACT.chart_registry[chartType];
    const foundation = VIZ.CHART_REGISTRY[chartType];
    if (!foundation || item.foundation_type !== chartType || item.renderer !== foundation.renderer ||
        item.supports_filter_selection !== foundation.supports_filter_selection ||
        item.supports_drill !== foundation.supports_drill ||
        item.a11y.semantic_table_required !== true || item.a11y.text_summary_required !== true ||
        item.a11y.interaction_only_evidence_allowed !== false) {
      fail('VIZ070_FOUNDATION_PARITY_INVALID');
    }
  }
  const primary = CONTRACT.renderers.ECHARTS_6;
  if (!primary || primary.primary_browser !== true || primary.replaceable !== true ||
      primary.loading_policy !== 'LOCAL_OR_BUNDLED' || primary.network_authority !== false ||
      primary.financial_truth_authority !== false || primary.query_authority !== false) {
    fail('VIZ070_PRIMARY_RENDERER_INVALID');
  }
  const table = CONTRACT.renderers.SEMANTIC_TABLE_V1;
  if (!table || table.primary_browser !== false || table.loading_policy !== 'BUILT_IN' ||
      table.financial_truth_authority !== false || table.query_authority !== false) {
    fail('VIZ070_ACCESSIBLE_RENDERER_INVALID');
  }
  if (!CONTRACT.authorities || Object.values(CONTRACT.authorities).some((value) => value !== false)) {
    fail('VIZ070_AUTHORITY_INVALID');
  }
  return true;
}

function effectiveQueryDimensions(query) {
  const dimensions = query.dimensions.slice();
  if (query.grain !== 'NONE') dimensions.push('time_bucket');
  return dimensions.slice().sort();
}

function chartDimensionBindings(chartSpec) {
  return Object.values(chartSpec.encoding)
    .filter((binding) => binding.kind === 'DIMENSION')
    .map((binding) => binding.id)
    .sort();
}

function assertQueryCompatibility(chartSpecInput, queryInput) {
  assertContract();
  const chartSpec = VIZ.normalizeChartSpec(chartSpecInput);
  const query = ANALYTICS.normalizeAnalyticsQuery(queryInput);
  const queryDimensions = effectiveQueryDimensions(query);
  const encodedDimensions = chartDimensionBindings(chartSpec);
  if (JSON.stringify(queryDimensions) !== JSON.stringify(encodedDimensions)) {
    fail('VIZ070_QUERY_DIMENSION_COVERAGE_MISMATCH');
  }
  for (const binding of Object.values(chartSpec.encoding)) {
    if (binding.kind === 'MEASURE' && !query.measures.includes(binding.id)) {
      fail('VIZ070_QUERY_MEASURE_BINDING_MISSING');
    }
  }
  return Object.freeze({
    chart_spec: chartSpec,
    query_hash: ANALYTICS.analyticsQueryHash(query),
    query_dimensions: Object.freeze(queryDimensions),
    query_modified: false,
    financial_truth_policy: 'FIN-TRUTH-v1'
  });
}

function rendererCapabilities(rendererId) {
  assertContract();
  const id = String(rendererId || '');
  const renderer = CONTRACT.renderers[id];
  if (!renderer) fail('VIZ070_RENDERER_UNKNOWN');
  return Object.freeze({ id, ...renderer });
}

function responsiveMode(widthPx) {
  const width = Number(widthPx);
  const bp = CONTRACT.responsive_breakpoints;
  if (!Number.isInteger(width) || width < bp.min_width_px || width > bp.max_width_px) {
    fail('VIZ070_VIEWPORT_WIDTH_INVALID');
  }
  if (width <= bp.mobile_max_width_px) return 'MOBILE';
  if (width <= bp.tablet_max_width_px) return 'TABLET';
  return 'DESKTOP';
}

function planVisualization(widgetSpecInput, queryInput, options = {}) {
  assertContract();
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some((key) => !['viewport_width_px', 'assistive_mode', 'renderer'].includes(key))) {
    fail('VIZ070_PLAN_OPTIONS_INVALID');
  }
  const widget = VIZ.normalizeWidgetSpec(widgetSpecInput);
  const compatibility = assertQueryCompatibility(widget.chart_spec, queryInput);
  const chart = CONTRACT.chart_registry[widget.chart_spec.type];
  const mode = responsiveMode(options.viewport_width_px == null ? 1280 : options.viewport_width_px);
  const assistive = options.assistive_mode === true;
  const requestedRenderer = options.renderer == null ? chart.renderer : String(options.renderer);
  rendererCapabilities(requestedRenderer);
  if (requestedRenderer !== chart.renderer && requestedRenderer !== 'SEMANTIC_TABLE_V1') {
    fail('VIZ070_RENDERER_CHART_INCOMPATIBLE');
  }
  const renderer = assistive ? 'SEMANTIC_TABLE_V1' : requestedRenderer;
  const strategy = chart.responsive[mode.toLowerCase()];
  if (!strategy) fail('VIZ070_RESPONSIVE_STRATEGY_MISSING');
  const body = {
    schema: PLAN_SCHEMA,
    contract_version: VERSION,
    widget_id: widget.id,
    chart_type: widget.chart_spec.type,
    query_ref: widget.query_ref,
    query_hash: compatibility.query_hash,
    query_modified: false,
    financial_truth_policy: 'FIN-TRUTH-v1',
    renderer,
    primary_renderer: chart.renderer,
    renderer_replaceable: CONTRACT.renderers[chart.renderer].replaceable === true,
    responsive_mode: mode,
    responsive_strategy: strategy,
    a11y: {
      semantic_table_required: chart.a11y.semantic_table_required,
      text_summary_required: chart.a11y.text_summary_required,
      interaction_only_evidence_allowed: chart.a11y.interaction_only_evidence_allowed,
      active_fallback: renderer === 'SEMANTIC_TABLE_V1' ? 'SEMANTIC_TABLE_V1' : null
    },
    interactions: {
      filter: widget.chart_spec.interactions.filter,
      drill: widget.chart_spec.interactions.drill
    }
  };
  return Object.freeze({ ...body, plan_hash: sha256(stableStringify(body)) });
}

function retypeRule(from, to) {
  if (from === to) return { from, to, mapping: null, requires_no_series: false };
  const rule = CONTRACT.retype_rules.find((item) => item.from === from && item.to === to);
  if (!rule) fail('VIZ070_RETYPE_UNSUPPORTED');
  return rule;
}

function remapEncoding(sourceSpec, targetType, rule) {
  if (sourceSpec.type === targetType) {
    return Object.fromEntries(Object.entries(sourceSpec.encoding).map(([key, value]) => [key, { ...value }]));
  }
  if (rule.requires_no_series === true && sourceSpec.encoding.series) fail('VIZ070_RETYPE_SERIES_AMBIGUOUS');
  const encoding = {};
  for (const [targetRole, sourceRole] of Object.entries(rule.mapping)) {
    if (!sourceSpec.encoding[sourceRole]) fail('VIZ070_RETYPE_REQUIRED_BINDING_MISSING');
    encoding[targetRole] = { ...sourceSpec.encoding[sourceRole] };
  }
  return encoding;
}

function retypeWidget(widgetSpecInput, targetTypeInput, queryInput) {
  assertContract();
  const widget = VIZ.normalizeWidgetSpec(widgetSpecInput);
  const targetType = String(targetTypeInput || '');
  if (!CHART_TYPES.includes(targetType)) fail('VIZ070_CHART_TYPE_UNKNOWN');
  const before = assertQueryCompatibility(widget.chart_spec, queryInput);
  const rule = retypeRule(widget.chart_spec.type, targetType);
  const targetChart = VIZ.normalizeChartSpec({
    schema: VIZ.CHART_SPEC_SCHEMA,
    contract_version: VIZ.VERSION,
    id: widget.chart_spec.id,
    type: targetType,
    title: widget.chart_spec.title,
    encoding: remapEncoding(widget.chart_spec, targetType, rule),
    presentation: { ...widget.chart_spec.presentation },
    interactions: { ...widget.chart_spec.interactions }
  });
  const targetWidget = VIZ.normalizeWidgetSpec({
    schema: VIZ.WIDGET_SPEC_SCHEMA,
    contract_version: VIZ.VERSION,
    id: widget.id,
    kind: widget.kind,
    query_ref: widget.query_ref,
    chart_spec: targetChart
  });
  const after = assertQueryCompatibility(targetWidget.chart_spec, queryInput);
  if (before.query_hash !== after.query_hash) fail('VIZ070_RETYPE_QUERY_IDENTITY_CHANGED');
  return Object.freeze({
    schema: RETYPE_SCHEMA,
    contract_version: VERSION,
    from: widget.chart_spec.type,
    to: targetType,
    widget: targetWidget,
    query_hash: before.query_hash,
    query_modified: false,
    financial_truth_policy: 'FIN-TRUTH-v1'
  });
}

function visualizationTelemetry(planInput, decision = 'ACCEPTED', reason = 'OK') {
  if (!planInput || planInput.schema !== PLAN_SCHEMA || planInput.contract_version !== VERSION) {
    fail('VIZ070_PLAN_INVALID');
  }
  const output = Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    chart_type: planInput.chart_type,
    renderer: planInput.renderer,
    responsive_mode: planInput.responsive_mode,
    responsive_strategy: planInput.responsive_strategy,
    semantic_table_required: planInput.a11y.semantic_table_required,
    text_summary_required: planInput.a11y.text_summary_required,
    query_hash_prefix: String(planInput.query_hash).slice(0, 12),
    query_modified: planInput.query_modified,
    decision: String(decision),
    reason: String(reason)
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) {
    fail('VIZ070_TELEMETRY_SHAPE_INVALID');
  }
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  PLAN_SCHEMA,
  RETYPE_SCHEMA,
  CHART_TYPES,
  RENDERERS,
  assertContract,
  assertQueryCompatibility,
  rendererCapabilities,
  responsiveMode,
  planVisualization,
  retypeWidget,
  visualizationTelemetry
});
