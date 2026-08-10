'use strict';

const assert = require('assert');
const CONTRACT = require('../lib/visualization/visualization_foundation.v1.json');
const ANALYTICS = require('../lib/analytics/analytics_contract.v1.json');
const DESIGN = require('../lib/design/design_system.v1.json');
const viz = require('../lib/visualization/visualization_foundation');

function expectCode(fn, codePrefix) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  assert(thrown, `Expected failure ${codePrefix}`);
  assert(String(thrown.code || thrown.message).startsWith(codePrefix), `Expected ${codePrefix}, got ${thrown.code || thrown.message}`);
}

function chart(type, id = `chart-${type.toLowerCase()}`) {
  if (type === 'DONUT') {
    return {
      schema: viz.CHART_SPEC_SCHEMA,
      contract_version: viz.VERSION,
      id,
      type,
      title: 'Synthetic category mix',
      encoding: {
        category: { kind: 'DIMENSION', id: 'category_id' },
        value: { kind: 'MEASURE', id: 'EXPENSE' }
      },
      presentation: { legend: true, show_labels: false },
      interactions: { filter: true, drill: true }
    };
  }
  return {
    schema: viz.CHART_SPEC_SCHEMA,
    contract_version: viz.VERSION,
    id,
    type,
    title: `Synthetic ${type.toLowerCase()} trend`,
    encoding: {
      x: { kind: 'DIMENSION', id: 'time_bucket' },
      y: { kind: 'MEASURE', id: 'INCOME' },
      series: { kind: 'DIMENSION', id: 'category_id' }
    },
    presentation: { legend: true, stacked: type === 'BAR', smooth: type === 'LINE', show_labels: false },
    interactions: { filter: true, drill: true }
  };
}

function widget(chartSpec) {
  return {
    schema: viz.WIDGET_SPEC_SCHEMA,
    contract_version: viz.VERSION,
    id: 'widget-income-trend',
    kind: 'CHART',
    query_ref: 'SYN-QUERY-INCOME-TREND',
    chart_spec: chartSpec
  };
}

const emptyFilters = {
  schema: viz.FILTER_CONTEXT_SCHEMA,
  contract_version: viz.VERSION,
  filters: []
};

const trendDataset = {
  schema: viz.RENDER_DATASET_SCHEMA,
  contract_version: viz.VERSION,
  rows: [
    { dimensions: { time_bucket: '2026-01', category_id: 'SYN-ALPHA' }, measures: { INCOME: 120000 } },
    { dimensions: { time_bucket: '2026-02', category_id: 'SYN-ALPHA' }, measures: { INCOME: 140000 } },
    { dimensions: { time_bucket: '2026-01', category_id: 'SYN-BETA' }, measures: { INCOME: 80000 } },
    { dimensions: { time_bucket: '2026-02', category_id: 'SYN-BETA' }, measures: { INCOME: 90000 } }
  ]
};

const donutDataset = {
  schema: viz.RENDER_DATASET_SCHEMA,
  contract_version: viz.VERSION,
  rows: [
    { dimensions: { category_id: 'SYN-FOOD' }, measures: { EXPENSE: 31000 } },
    { dimensions: { category_id: 'SYN-HOME' }, measures: { EXPENSE: 23000 } },
    { dimensions: { category_id: 'SYN-OTHER' }, measures: { EXPENSE: 11000 } }
  ]
};

assert.strictEqual(CONTRACT.schema, 'PRH_VISUALIZATION_FOUNDATION_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'VIZ-020');
assert.strictEqual(CONTRACT.upstream.analytics_contract, `${ANALYTICS.schema}@${ANALYTICS.version}`);
assert.strictEqual(CONTRACT.upstream.design_system, `${DESIGN.schema}@${DESIGN.version}`);
assert.strictEqual(CONTRACT.upstream.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(CONTRACT.invariants.renderer_neutral_specs, true);
assert.strictEqual(CONTRACT.invariants.configuration_only_specs, true);
assert.strictEqual(CONTRACT.invariants.financial_payload_in_specs_allowed, false);
assert.strictEqual(CONTRACT.invariants.external_asset_required, false);
assert.strictEqual(CONTRACT.invariants.paid_dependency_required, false);
assert.strictEqual(CONTRACT.invariants.cost_class, 'FREE_ONLY');
assert(Object.values(CONTRACT.authorities).every((value) => value === false), 'Visualization foundation must not gain query/storage/network/write authority');

const primary = CONTRACT.renderers.filter((renderer) => renderer.primary_browser);
assert.strictEqual(primary.length, 1);
assert.strictEqual(primary[0].id, 'ECHARTS_6');
assert.strictEqual(primary[0].major, 6);
assert.strictEqual(primary[0].replaceable, true);
assert.strictEqual(primary[0].loading_policy, 'LOCAL_OR_BUNDLED');
assert.strictEqual(primary[0].external_cdn_required, false);
assert.strictEqual(primary[0].financial_write_authority, false);

assert.deepStrictEqual(CONTRACT.chart_registry.map((item) => item.id).sort(), ['BAR', 'DONUT', 'LINE']);
assert.strictEqual(new Set(CONTRACT.chart_registry.map((item) => item.id)).size, CONTRACT.chart_registry.length, 'Chart registry ids must be unique');
for (const entry of CONTRACT.chart_registry) {
  assert.strictEqual(entry.renderer, 'ECHARTS_6');
  assert.strictEqual(entry.accessible_summary_required, true);
  assert.strictEqual(entry.supports_filter_selection, true);
  assert.strictEqual(entry.supports_drill, true);
}

for (const type of ['BAR', 'LINE', 'DONUT']) {
  const normalized = viz.normalizeChartSpec(chart(type));
  assert.strictEqual(normalized.type, type);
  assert(Object.isFrozen(normalized), `${type} ChartSpec must be immutable`);
  assert(Object.isFrozen(normalized.encoding), `${type} encodings must be immutable`);
}

const normalizedWidget = viz.normalizeWidgetSpec(widget(chart('LINE')));
assert.strictEqual(normalizedWidget.kind, 'CHART');
assert.strictEqual(normalizedWidget.chart_spec.type, 'LINE');
assert.strictEqual(normalizedWidget.query_ref, 'SYN-QUERY-INCOME-TREND');

expectCode(() => viz.normalizeChartSpec({ ...chart('LINE'), type: 'MAGIC' }), 'VIZ_CHART_TYPE_UNSUPPORTED');
expectCode(() => viz.normalizeChartSpec({ ...chart('LINE'), encoding: { x: { kind: 'DIMENSION', id: 'time_bucket' } } }), 'VIZ_REQUIRED_ENCODING_MISSING');
expectCode(() => viz.normalizeChartSpec({ ...chart('LINE'), data: [{ value: 100 }] }), 'VIZ_SPEC_FINANCIAL_PAYLOAD_FORBIDDEN');
expectCode(() => viz.normalizeChartSpec({ ...chart('LINE'), amount_minor: 12345 }), 'VIZ_SPEC_FINANCIAL_PAYLOAD_FORBIDDEN');
expectCode(() => viz.normalizeWidgetSpec({ ...widget(chart('BAR')), rows: [] }), 'VIZ_SPEC_FINANCIAL_PAYLOAD_FORBIDDEN');

const lineOption = viz.compileEChartsOption(chart('LINE'), trendDataset);
assert.strictEqual(lineOption.renderer, 'ECHARTS_6');
assert.strictEqual(lineOption.option.aria.enabled, true);
assert.deepStrictEqual(lineOption.option.xAxis.data, ['2026-01', '2026-02']);
assert.strictEqual(lineOption.option.series.length, 2);
assert(lineOption.option.series.every((series) => series.type === 'line'), 'LINE must compile to ECharts line series');
assert.deepStrictEqual(lineOption.option.series[0].data.length, 2);

const barOption = viz.compileEChartsOption(chart('BAR'), trendDataset);
assert(barOption.option.series.every((series) => series.type === 'bar'), 'BAR must compile to ECharts bar series');
assert(barOption.option.series.every((series) => series.stack === 'total'), 'Stacked BAR presentation must compile deterministically');

const donutOption = viz.compileEChartsOption(chart('DONUT'), donutDataset);
assert.strictEqual(donutOption.option.series.length, 1);
assert.strictEqual(donutOption.option.series[0].type, 'pie');
assert.deepStrictEqual(donutOption.option.series[0].radius, ['48%', '72%']);
assert.strictEqual(donutOption.option.series[0].data.length, 3);
assert(donutOption.option.series[0].data.every((item) => item.name.startsWith('SYN-')), 'Public renderer fixture must remain synthetic');

const firstContext = viz.filterContextFromSelection(chart('DONUT'), { encoding: 'category', value: 'SYN-FOOD' }, emptyFilters);
const sameContext = viz.filterContextFromSelection(chart('DONUT'), { encoding: 'category', value: 'SYN-FOOD' }, emptyFilters);
assert.strictEqual(firstContext.context_hash, sameContext.context_hash, 'FilterContext identity must be deterministic');
assert.deepStrictEqual(firstContext.filters[0].values, ['SYN-FOOD']);

const expandedContext = viz.filterContextFromSelection(chart('DONUT'), { encoding: 'category', value: 'SYN-HOME' }, {
  schema: firstContext.schema,
  contract_version: firstContext.contract_version,
  filters: firstContext.filters.map((item) => ({ kind: item.kind, field: item.field, operator: item.operator, values: item.values.slice() }))
});
assert.deepStrictEqual(expandedContext.filters[0].values, ['SYN-FOOD', 'SYN-HOME']);
assert.notStrictEqual(expandedContext.context_hash, firstContext.context_hash);

const drill = viz.drillContextFromSelection(widget(chart('DONUT')), { encoding: 'category', value: 'SYN-FOOD' }, emptyFilters, 'TRANSACTION_EXPLORER');
const drill2 = viz.drillContextFromSelection(widget(chart('DONUT')), { encoding: 'category', value: 'SYN-FOOD' }, emptyFilters, 'TRANSACTION_EXPLORER');
assert.strictEqual(drill.target, 'TRANSACTION_EXPLORER');
assert.strictEqual(drill.source_widget_id, 'widget-income-trend');
assert.strictEqual(drill.context_hash, drill2.context_hash, 'DrillContext identity must be deterministic');
assert.deepStrictEqual(drill.filter_context.filters[0].values, ['SYN-FOOD']);

expectCode(() => viz.normalizeFilterContext({
  schema: viz.FILTER_CONTEXT_SCHEMA,
  contract_version: viz.VERSION,
  filters: [
    { kind: 'DIMENSION', field: 'category_id', operator: 'INCLUDE', values: ['SYN-A'] },
    { kind: 'DIMENSION', field: 'category_id', operator: 'INCLUDE', values: ['SYN-B'] }
  ]
}), 'VIZ_FILTER_CONTEXT_AMBIGUOUS');
expectCode(() => viz.filterContextFromSelection(chart('LINE'), { encoding: 'y', value: '1000' }, emptyFilters), 'VIZ_SELECTION_ENCODING_INVALID');
expectCode(() => viz.normalizeDrillContext({
  schema: viz.DRILL_CONTEXT_SCHEMA,
  contract_version: viz.VERSION,
  source_widget_id: 'widget-x',
  target: 'ARBITRARY_URL',
  filter_context: emptyFilters
}), 'VIZ_DRILL_TARGET_UNSUPPORTED');

const optionText = JSON.stringify(lineOption.option);
assert(!/https?:\/\//i.test(optionText), 'Renderer option must not inject network URLs');
assert(!/GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED/.test(optionText), 'Renderer option must remain outside write policy');

console.log('visualization_foundation_contract_test: OK', {
  contract: `${CONTRACT.schema}@${CONTRACT.version}`,
  chartTypes: CONTRACT.chart_registry.map((item) => item.id),
  renderer: primary[0].id,
  configurationOnlySpecs: true,
  deterministicFilterContext: true,
  deterministicDrillContext: true,
  externalCdnRequired: false,
  freeOnly: true,
  financialWriteAuthority: false
});