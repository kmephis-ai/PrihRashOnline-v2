'use strict';

const assert = require('assert');
const REGISTRY = require('../lib/visualization/visualization_registry_v2');
const VIZ = require('../lib/visualization/visualization_foundation');
const ANALYTICS = require('../lib/analytics/analytics_engine');
const EXPLORATION = require('../lib/analytics/exploration_state');

function query(overrides = {}) {
  return {
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: 'RUB',
    measures: ['EXPENSE'],
    dimensions: ['category_id'],
    filters: [],
    time_range: null,
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 5000,
    ...overrides
  };
}

function chart(type = 'BAR', options = {}) {
  const encoding = options.encoding || (type === 'DONUT'
    ? {
        category: { kind: 'DIMENSION', id: 'category_id' },
        value: { kind: 'MEASURE', id: 'EXPENSE' }
      }
    : {
        x: { kind: 'DIMENSION', id: 'category_id' },
        y: { kind: 'MEASURE', id: 'EXPENSE' },
        ...(options.series ? { series: { kind: 'DIMENSION', id: options.series } } : {})
      });
  return {
    schema: VIZ.CHART_SPEC_SCHEMA,
    contract_version: VIZ.VERSION,
    id: options.id || 'chart.expense',
    type,
    title: options.title || 'Расходы',
    encoding,
    presentation: {
      legend: true,
      stacked: false,
      smooth: false,
      show_labels: false,
      ...(options.presentation || {})
    },
    interactions: {
      filter: true,
      drill: true,
      ...(options.interactions || {})
    }
  };
}

function widget(chartSpec = chart()) {
  return {
    schema: VIZ.WIDGET_SPEC_SCHEMA,
    contract_version: VIZ.VERSION,
    id: 'widget.expense',
    kind: 'CHART',
    query_ref: 'query.expense',
    chart_spec: chartSpec
  };
}

function filterContext(filters = []) {
  return {
    schema: VIZ.FILTER_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    filters
  };
}

function baseFilterContext(normalized) {
  return {
    schema: normalized.schema,
    contract_version: normalized.contract_version,
    filters: normalized.filters
  };
}

function equivalentQuery(input) {
  const copy = JSON.parse(JSON.stringify(input));
  copy.filters = copy.filters.slice().reverse().map((item) => ({
    values: item.values.slice().reverse(),
    operator: item.operator,
    field: item.field
  }));
  copy.comparison = Object.fromEntries(Object.entries(copy.comparison).reverse());
  copy.parameters = Object.fromEntries(Object.entries(copy.parameters).reverse());
  return Object.fromEntries(Object.entries(copy).reverse());
}

assert.strictEqual(REGISTRY.assertContract(), true);
assert.deepStrictEqual(REGISTRY.CHART_TYPES.slice().sort(), ['BAR', 'DONUT', 'LINE']);
assert.deepStrictEqual(REGISTRY.RENDERERS.slice().sort(), ['ECHARTS_6', 'SEMANTIC_TABLE_V1']);
assert.strictEqual(REGISTRY.CONTRACT.principles.advanced_chart_pack_in_scope, false);
assert.ok(Object.values(REGISTRY.CONTRACT.authorities).every((value) => value === false));

const echarts = REGISTRY.rendererCapabilities('ECHARTS_6');
assert.strictEqual(echarts.primary_browser, true);
assert.strictEqual(echarts.replaceable, true);
assert.strictEqual(echarts.loading_policy, 'LOCAL_OR_BUNDLED');
assert.strictEqual(echarts.network_authority, false);
assert.strictEqual(echarts.financial_truth_authority, false);
assert.strictEqual(echarts.query_authority, false);
const semanticTable = REGISTRY.rendererCapabilities('SEMANTIC_TABLE_V1');
assert.strictEqual(semanticTable.loading_policy, 'BUILT_IN');
assert.strictEqual(semanticTable.financial_truth_authority, false);
assert.throws(() => REGISTRY.rendererCapabilities('UNKNOWN_RENDERER'), /VIZ070_RENDERER_UNKNOWN/);

const baseQuery = query();
const baseWidget = widget();
const baseHash = ANALYTICS.analyticsQueryHash(baseQuery);
const baseBefore = JSON.stringify(baseQuery);
const compatible = REGISTRY.assertQueryCompatibility(baseWidget.chart_spec, baseQuery);
assert.strictEqual(compatible.query_hash, baseHash);
assert.strictEqual(compatible.query_modified, false);
assert.strictEqual(compatible.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(JSON.stringify(baseQuery), baseBefore);

assert.throws(() => REGISTRY.assertQueryCompatibility(baseWidget.chart_spec, query({ dimensions: [] })), /VIZ070_QUERY_DIMENSION_COVERAGE_MISMATCH/);
assert.throws(() => REGISTRY.assertQueryCompatibility(baseWidget.chart_spec, query({ measures: ['INCOME'] })), /VIZ070_QUERY_MEASURE_BINDING_MISSING/);
assert.throws(() => REGISTRY.assertQueryCompatibility(baseWidget.chart_spec, query({ dimensions: ['category_id', 'account_id'] })), /VIZ070_QUERY_DIMENSION_COVERAGE_MISMATCH/);

const timeQuery = query({
  dimensions: [],
  time_range: { start: '2025-01-01', end: '2026-01-01' },
  grain: 'MONTH'
});
const timeLine = chart('LINE', {
  id: 'chart.timeline',
  title: 'Динамика расходов',
  encoding: {
    x: { kind: 'DIMENSION', id: 'time_bucket' },
    y: { kind: 'MEASURE', id: 'EXPENSE' }
  }
});
assert.strictEqual(REGISTRY.assertQueryCompatibility(timeLine, timeQuery).query_hash, ANALYTICS.analyticsQueryHash(timeQuery));

const lineRetype = REGISTRY.retypeWidget(baseWidget, 'LINE', baseQuery);
assert.strictEqual(lineRetype.schema, REGISTRY.RETYPE_SCHEMA);
assert.strictEqual(lineRetype.from, 'BAR');
assert.strictEqual(lineRetype.to, 'LINE');
assert.strictEqual(lineRetype.widget.query_ref, baseWidget.query_ref);
assert.deepStrictEqual(lineRetype.widget.chart_spec.encoding.x, VIZ.normalizeChartSpec(baseWidget.chart_spec).encoding.x);
assert.deepStrictEqual(lineRetype.widget.chart_spec.encoding.y, VIZ.normalizeChartSpec(baseWidget.chart_spec).encoding.y);
assert.strictEqual(lineRetype.query_hash, baseHash);
assert.strictEqual(lineRetype.query_modified, false);
assert.strictEqual(JSON.stringify(baseQuery), baseBefore);

const donutRetype = REGISTRY.retypeWidget(baseWidget, 'DONUT', baseQuery);
assert.strictEqual(donutRetype.widget.chart_spec.type, 'DONUT');
assert.deepStrictEqual(donutRetype.widget.chart_spec.encoding.category, VIZ.normalizeChartSpec(baseWidget.chart_spec).encoding.x);
assert.deepStrictEqual(donutRetype.widget.chart_spec.encoding.value, VIZ.normalizeChartSpec(baseWidget.chart_spec).encoding.y);
assert.strictEqual(donutRetype.query_hash, baseHash);
assert.strictEqual(donutRetype.query_modified, false);

const donutBackToBar = REGISTRY.retypeWidget(donutRetype.widget, 'BAR', baseQuery);
assert.strictEqual(donutBackToBar.widget.chart_spec.type, 'BAR');
assert.strictEqual(donutBackToBar.query_hash, baseHash);
assert.deepStrictEqual(donutBackToBar.widget.chart_spec.encoding.x, donutRetype.widget.chart_spec.encoding.category);
assert.deepStrictEqual(donutBackToBar.widget.chart_spec.encoding.y, donutRetype.widget.chart_spec.encoding.value);

const seriesWidget = widget(chart('BAR', { series: 'account_id' }));
const seriesQuery = query({ dimensions: ['category_id', 'account_id'] });
assert.strictEqual(REGISTRY.assertQueryCompatibility(seriesWidget.chart_spec, seriesQuery).query_hash, ANALYTICS.analyticsQueryHash(seriesQuery));
assert.throws(() => REGISTRY.retypeWidget(seriesWidget, 'DONUT', seriesQuery), /VIZ070_RETYPE_SERIES_AMBIGUOUS/);
assert.throws(() => REGISTRY.retypeWidget(baseWidget, 'WATERFALL', baseQuery), /VIZ070_CHART_TYPE_UNKNOWN/);

const planMobile = REGISTRY.planVisualization(baseWidget, baseQuery, { viewport_width_px: 360 });
assert.strictEqual(planMobile.schema, REGISTRY.PLAN_SCHEMA);
assert.strictEqual(planMobile.chart_type, 'BAR');
assert.strictEqual(planMobile.renderer, 'ECHARTS_6');
assert.strictEqual(planMobile.primary_renderer, 'ECHARTS_6');
assert.strictEqual(planMobile.renderer_replaceable, true);
assert.strictEqual(planMobile.responsive_mode, 'MOBILE');
assert.strictEqual(planMobile.responsive_strategy, 'HORIZONTAL_SCROLL_OR_REDUCE_LABEL_DENSITY');
assert.strictEqual(planMobile.a11y.semantic_table_required, true);
assert.strictEqual(planMobile.a11y.text_summary_required, true);
assert.strictEqual(planMobile.a11y.interaction_only_evidence_allowed, false);
assert.strictEqual(planMobile.query_hash, baseHash);
assert.strictEqual(planMobile.query_modified, false);
assert.strictEqual(planMobile.financial_truth_policy, 'FIN-TRUTH-v1');

const planTablet = REGISTRY.planVisualization(baseWidget, baseQuery, { viewport_width_px: 800 });
assert.strictEqual(planTablet.responsive_mode, 'TABLET');
assert.strictEqual(planTablet.responsive_strategy, 'REDUCE_LABEL_DENSITY');
const planDesktop = REGISTRY.planVisualization(baseWidget, baseQuery, { viewport_width_px: 1280 });
assert.strictEqual(planDesktop.responsive_mode, 'DESKTOP');
assert.strictEqual(planDesktop.responsive_strategy, 'STANDARD');
const planAssistive = REGISTRY.planVisualization(baseWidget, baseQuery, { viewport_width_px: 360, assistive_mode: true });
assert.strictEqual(planAssistive.renderer, 'SEMANTIC_TABLE_V1');
assert.strictEqual(planAssistive.a11y.active_fallback, 'SEMANTIC_TABLE_V1');
const planExplicitTable = REGISTRY.planVisualization(baseWidget, baseQuery, { renderer: 'SEMANTIC_TABLE_V1' });
assert.strictEqual(planExplicitTable.renderer, 'SEMANTIC_TABLE_V1');
assert.throws(() => REGISTRY.planVisualization(baseWidget, baseQuery, { viewport_width_px: 100 }), /VIZ070_VIEWPORT_WIDTH_INVALID/);
assert.throws(() => REGISTRY.planVisualization(baseWidget, baseQuery, { renderer: 'UNKNOWN_RENDERER' }), /VIZ070_RENDERER_UNKNOWN/);

const semanticallyEquivalent = equivalentQuery({
  ...baseQuery,
  filters: [
    { field: 'status', operator: 'IN', values: ['posted', 'pending'] },
    { field: 'type', operator: 'IN', values: ['expense', 'refund'] }
  ]
});
const canonicalEquivalent = {
  ...baseQuery,
  filters: [
    { field: 'type', operator: 'IN', values: ['refund', 'expense'] },
    { field: 'status', operator: 'IN', values: ['pending', 'posted'] }
  ]
};
assert.strictEqual(ANALYTICS.analyticsQueryHash(semanticallyEquivalent), ANALYTICS.analyticsQueryHash(canonicalEquivalent));
const planA = REGISTRY.planVisualization(baseWidget, semanticallyEquivalent, { viewport_width_px: 1280 });
const planB = REGISTRY.planVisualization(baseWidget, canonicalEquivalent, { viewport_width_px: 1280 });
assert.strictEqual(planA.query_hash, planB.query_hash);
assert.strictEqual(planA.plan_hash, planB.plan_hash);

// VIZ-020 filter/drill interactions keep the same semantic context after safe chart retype.
const barFilter = VIZ.filterContextFromSelection(baseWidget.chart_spec, {
  encoding: 'x',
  value: 'cat-synthetic-a',
  operator: 'INCLUDE'
}, filterContext());
const donutFilter = VIZ.filterContextFromSelection(donutRetype.widget.chart_spec, {
  encoding: 'category',
  value: 'cat-synthetic-a',
  operator: 'INCLUDE'
}, filterContext());
assert.deepStrictEqual(donutFilter, barFilter);
const barFilterBase = baseFilterContext(barFilter);

const barDrill = VIZ.drillContextFromSelection(baseWidget, {
  encoding: 'x',
  value: 'cat-synthetic-a',
  operator: 'INCLUDE'
}, filterContext(), 'DETAILS');
const donutDrill = VIZ.drillContextFromSelection(donutRetype.widget, {
  encoding: 'category',
  value: 'cat-synthetic-a',
  operator: 'INCLUDE'
}, filterContext(), 'DETAILS');
assert.deepStrictEqual(donutDrill, barDrill);

let session = EXPLORATION.createSession();
session = EXPLORATION.dispatch(session, {
  type: 'SET_WIDGET_CONTEXT',
  widget_id: baseWidget.id,
  filter_context: barFilterBase,
  scope_mode: 'INHERIT_GLOBAL',
  scope_spec: null
});
const effective = EXPLORATION.effectiveWidgetContext(session.present, baseWidget.id);
assert.deepStrictEqual(effective.filter_context, barFilterBase);
assert.strictEqual(effective.scope_source, 'GLOBAL_INHERITED');

// Existing ECharts adapter remains usable and replaceable; registry does not compile financial formulas.
const renderDataset = {
  schema: VIZ.RENDER_DATASET_SCHEMA,
  contract_version: VIZ.VERSION,
  rows: [
    { dimensions: { category_id: 'cat-synthetic-a' }, measures: { EXPENSE: 1200 } },
    { dimensions: { category_id: 'cat-synthetic-b' }, measures: { EXPENSE: 800 } }
  ]
};
assert.strictEqual(VIZ.compileEChartsOption(baseWidget.chart_spec, renderDataset).renderer, 'ECHARTS_6');
assert.strictEqual(VIZ.compileEChartsOption(lineRetype.widget.chart_spec, renderDataset).renderer, 'ECHARTS_6');
assert.strictEqual(VIZ.compileEChartsOption(donutRetype.widget.chart_spec, renderDataset).renderer, 'ECHARTS_6');

const telemetry = REGISTRY.visualizationTelemetry(planMobile);
assert.deepStrictEqual(Object.keys(telemetry).sort(), REGISTRY.CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.query_hash_prefix, baseHash.slice(0, 12));
assert.strictEqual(telemetry.query_modified, false);
const publicText = JSON.stringify(telemetry).toLowerCase();
for (const forbidden of ['amount', 'expense_minor', 'cat-synthetic-a', 'rows', 'filters', 'query_ref', 'widget_id']) {
  assert.strictEqual(publicText.includes(forbidden), false, forbidden);
}

console.log('visualization-registry-v2: PASS');
