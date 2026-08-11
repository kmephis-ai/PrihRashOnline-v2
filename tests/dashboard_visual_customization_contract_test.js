'use strict';

const assert = require('assert');
const CUSTOM = require('../lib/dashboard/dashboard_visual_customization');
const FACTORY = require('../lib/dashboard/widget_factory');
const ANALYTICS = require('../lib/analytics/analytics_engine');
const VIZ = require('../lib/visualization/visualization_foundation');

CUSTOM.assertContract();
assert.strictEqual(CUSTOM.SCHEMA, 'PRH_DASHBOARD_VISUAL_CUSTOMIZATION_V1');
assert.strictEqual(CUSTOM.VERSION, '1.0.0');
assert.strictEqual(CUSTOM.CONTRACT.roadmap_id, 'DASH-085');
assert(Object.values(CUSTOM.CONTRACT.authority).every((value) => value === false));
assert.strictEqual(CUSTOM.CONTRACT.principles.configuration_only, true);
assert.strictEqual(CUSTOM.CONTRACT.principles.design_token_only, true);
assert.strictEqual(CUSTOM.CONTRACT.principles.query_mutation_allowed, false);
assert.strictEqual(CUSTOM.CONTRACT.principles.financial_formula_allowed, false);
assert.strictEqual(CUSTOM.CONTRACT.principles.financial_payload_allowed, false);
assert.strictEqual(CUSTOM.CONTRACT.principles.arbitrary_css_allowed, false);
assert.strictEqual(CUSTOM.CONTRACT.principles.arbitrary_html_allowed, false);
assert.strictEqual(CUSTOM.CONTRACT.principles.arbitrary_url_allowed, false);
assert.strictEqual(CUSTOM.CONTRACT.principles.free_only, true);
assert.deepStrictEqual(CUSTOM.CONTRACT.themes, ['SYSTEM', 'LIGHT', 'DARK']);
assert.deepStrictEqual(CUSTOM.CONTRACT.densities, ['COMFORTABLE', 'COMPACT']);
assert.deepStrictEqual(CUSTOM.CONTRACT.chart_types, ['BAR', 'LINE', 'DONUT']);
assert.strictEqual(CUSTOM.CONTRACT.top_n.operator, 'TOP_N_OTHER');

function baseQuery(overrides = {}) {
  return {
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: 'RUB',
    measures: ['EXPENSE'],
    dimensions: [],
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

function valuePresentation(title) {
  return {
    schema: FACTORY.VALUE_PRESENTATION_SCHEMA,
    contract_version: FACTORY.VERSION,
    title,
    show_comparison: false
  };
}

function binding(widgetId, kind, query, presentation) {
  return {
    schema: FACTORY.BINDING_SCHEMA,
    contract_version: FACTORY.VERSION,
    widget_id: widgetId,
    kind,
    query,
    presentation
  };
}

function customization(overrides = {}) {
  return {
    schema: CUSTOM.CUSTOMIZATION_SCHEMA,
    contract_version: CUSTOM.VERSION,
    theme: 'SYSTEM',
    palette: 'DEFAULT',
    chart_type: null,
    axes: null,
    labels: 'AUTO',
    legend: 'HIDE',
    stack: 'OFF',
    sort: { direction: 'NONE', by: 'VALUE' },
    top_n: null,
    number_format: { style: 'AUTO', fraction_digits: 0, sign: 'AUTO' },
    density: 'COMFORTABLE',
    ...overrides
  };
}

function chartSpec(type = 'DONUT') {
  if (type === 'DONUT') {
    return {
      schema: VIZ.CHART_SPEC_SCHEMA,
      contract_version: VIZ.VERSION,
      id: 'expense-by-category',
      type: 'DONUT',
      title: 'Расходы по категориям',
      encoding: {
        category: { kind: 'DIMENSION', id: 'category_id' },
        value: { kind: 'MEASURE', id: 'EXPENSE' }
      },
      presentation: { legend: true, stacked: false, smooth: false, show_labels: false },
      interactions: { filter: true, drill: true }
    };
  }
  return {
    schema: VIZ.CHART_SPEC_SCHEMA,
    contract_version: VIZ.VERSION,
    id: 'expense-by-category',
    type,
    title: 'Расходы по категориям',
    encoding: {
      x: { kind: 'DIMENSION', id: 'category_id' },
      y: { kind: 'MEASURE', id: 'EXPENSE' }
    },
    presentation: { legend: true, stacked: false, smooth: false, show_labels: false },
    interactions: { filter: true, drill: true }
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error && error.code === code, `expected ${code}`);
}

const kpiInput = binding('w-0001', 'KPI', baseQuery(), valuePresentation('Расходы'));
const kpi = FACTORY.normalizeBinding(kpiInput);
const kpiBefore = JSON.stringify(kpiInput);
const kpiCustomization = customization({ chart_type: undefined, axes: undefined });
const kpiResult = CUSTOM.applyCustomization(kpiInput, kpiCustomization);
assert.strictEqual(JSON.stringify(kpiInput), kpiBefore, 'source binding input must remain immutable');
assert.strictEqual(kpiResult.widget_kind, 'KPI');
assert.strictEqual(kpiResult.query_hash, kpi.query_hash);
assert.strictEqual(kpiResult.binding_hash, kpi.binding_hash);
assert.strictEqual(kpiResult.query_modified, false);
assert.strictEqual(kpiResult.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(kpiResult.customization.theme, 'SYSTEM');
assert.strictEqual(kpiResult.customization.palette, 'DEFAULT');
assert.strictEqual(kpiResult.customization.chart_type, null);
assert.deepStrictEqual(kpiResult.customization.axes, { x: 'HIDE', y: 'HIDE' });
assert.strictEqual(kpiResult.customization.density, 'COMFORTABLE');
assert.strictEqual(kpiResult.effective_chart_spec, null);
assert.strictEqual(kpiResult.a11y.data_hidden_for_density, false);
assert.match(kpiResult.customization_hash, /^[0-9a-f]{64}$/);

const chartQuery = baseQuery({ dimensions: ['category_id'] });
const donutInput = binding('w-0002', 'CHART', chartQuery, chartSpec('DONUT'));
const normalizedDonut = FACTORY.normalizeBinding(donutInput);
const richCustomization = customization({
  theme: 'DARK',
  palette: 'STATUS',
  chart_type: 'DONUT',
  axes: { x: 'HIDE', y: 'HIDE' },
  labels: 'SHOW',
  legend: 'SHOW',
  sort: { direction: 'DESC', by: 'VALUE' },
  top_n: { n: 5, remainder: 'OTHER' },
  number_format: { style: 'COMPACT', fraction_digits: 1, sign: 'ALWAYS' },
  density: 'COMPACT'
});
const donutResult = CUSTOM.applyCustomization(donutInput, richCustomization);
assert.strictEqual(donutResult.query_hash, normalizedDonut.query_hash);
assert.strictEqual(donutResult.query_modified, false);
assert.strictEqual(donutResult.effective_chart_spec.type, 'DONUT');
assert.strictEqual(donutResult.customization.top_n.operator, 'TOP_N_OTHER');
assert.strictEqual(donutResult.top_n_operator, 'TOP_N_OTHER');
assert.strictEqual(donutResult.customization.number_format.style, 'COMPACT');
assert.strictEqual(donutResult.a11y.semantic_table_required, true);
assert.strictEqual(donutResult.a11y.text_summary_required, true);
assert.strictEqual(donutResult.a11y.focus_visible_required, true);
assert.strictEqual(donutResult.a11y.reduced_motion_required, true);
assert.deepStrictEqual(donutResult.palette_tokens, CUSTOM.CONTRACT.palette_registry.STATUS);

// Safe chart retype is delegated to VIZ-070 and must preserve canonical query identity.
const barResult = CUSTOM.applyCustomization(donutInput, customization({
  chart_type: 'BAR',
  axes: { x: 'SHOW', y: 'SHOW' },
  legend: 'AUTO'
}));
assert.strictEqual(barResult.effective_chart_spec.type, 'BAR');
assert.strictEqual(barResult.query_hash, normalizedDonut.query_hash);
assert.strictEqual(barResult.query_modified, false);
assert.strictEqual(barResult.effective_chart_spec.encoding.x.id, 'category_id');
assert.strictEqual(barResult.effective_chart_spec.encoding.y.id, 'EXPENSE');

// Canonical identity is independent of customization object key order.
const reordered = {
  density: 'COMPACT',
  number_format: { sign: 'ALWAYS', fraction_digits: 1, style: 'COMPACT' },
  top_n: { remainder: 'OTHER', n: 5 },
  sort: { by: 'VALUE', direction: 'DESC' },
  stack: 'OFF',
  legend: 'SHOW',
  labels: 'SHOW',
  axes: { y: 'HIDE', x: 'HIDE' },
  chart_type: 'DONUT',
  palette: 'STATUS',
  theme: 'DARK',
  contract_version: CUSTOM.VERSION,
  schema: CUSTOM.CUSTOMIZATION_SCHEMA
};
assert.strictEqual(CUSTOM.applyCustomization(donutInput, reordered).customization_hash, donutResult.customization_hash);

// TABLE may use presentation sort/Top-N without mutating its query.
const tableQuery = baseQuery({ dimensions: ['category_id'], measures: ['EXPENSE', 'INCOME'] });
const tableInput = binding('w-0003', 'TABLE', tableQuery, {
  schema: FACTORY.TABLE_PRESENTATION_SCHEMA,
  contract_version: FACTORY.VERSION,
  title: 'Категории',
  columns: [
    { kind: 'DIMENSION', id: 'category_id' },
    { kind: 'MEASURE', id: 'EXPENSE' },
    { kind: 'MEASURE', id: 'INCOME' }
  ]
});
const tableResult = CUSTOM.applyCustomization(tableInput, customization({
  chart_type: undefined,
  axes: undefined,
  sort: { direction: 'ASC', by: 'LABEL' },
  top_n: { n: 10, remainder: 'OTHER' },
  density: 'COMPACT'
}));
assert.strictEqual(tableResult.widget_kind, 'TABLE');
assert.strictEqual(tableResult.query_hash, ANALYTICS.analyticsQueryHash(tableQuery));
assert.strictEqual(tableResult.query_modified, false);
assert.strictEqual(tableResult.customization.top_n.operator, 'TOP_N_OTHER');
assert.strictEqual(tableResult.a11y.data_hidden_for_density, false);

// Incompatible or authority-expanding configuration is fail-closed.
expectCode(() => CUSTOM.applyCustomization(kpiInput, customization({ chart_type: 'BAR' })), 'DASH085_CHART_TYPE_NON_CHART_FORBIDDEN');
expectCode(() => CUSTOM.applyCustomization(kpiInput, customization({ chart_type: undefined, sort: { direction: 'DESC', by: 'VALUE' } })), 'DASH085_SORT_WIDGET_KIND_FORBIDDEN');
expectCode(() => CUSTOM.applyCustomization(kpiInput, customization({ chart_type: undefined, top_n: { n: 5, remainder: 'OTHER' } })), 'DASH085_TOP_N_WIDGET_KIND_FORBIDDEN');
expectCode(() => CUSTOM.applyCustomization(donutInput, customization({ chart_type: 'DONUT', axes: { x: 'SHOW', y: 'HIDE' }, legend: 'AUTO' })), 'DASH085_DONUT_AXES_FORBIDDEN');
expectCode(() => CUSTOM.applyCustomization(donutInput, customization({ chart_type: 'DONUT', axes: { x: 'HIDE', y: 'HIDE' }, stack: 'ON', legend: 'AUTO' })), 'DASH085_STACK_CHART_TYPE_FORBIDDEN');
expectCode(() => CUSTOM.applyCustomization(donutInput, customization({ chart_type: 'DONUT', axes: { x: 'HIDE', y: 'HIDE' }, palette: 'url(https://evil.invalid)', legend: 'AUTO' })), 'DASH085_HOSTILE_PRESENTATION_VALUE');
expectCode(() => CUSTOM.applyCustomization(donutInput, { ...richCustomization, css: 'display:none' }), 'DASH085_FORBIDDEN_PAYLOAD_KEY');
expectCode(() => CUSTOM.applyCustomization(donutInput, { ...richCustomization, amount_minor: 12345 }), 'DASH085_FORBIDDEN_PAYLOAD_KEY');
expectCode(() => CUSTOM.applyCustomization(donutInput, { ...richCustomization, theme: 'NEON' }), 'DASH085_THEME_INVALID');
expectCode(() => CUSTOM.applyCustomization(donutInput, { ...richCustomization, palette: 'RAINBOW' }), 'DASH085_PALETTE_UNKNOWN');
expectCode(() => CUSTOM.applyCustomization(donutInput, { ...richCustomization, density: 'TINY' }), 'DASH085_DENSITY_INVALID');
expectCode(() => CUSTOM.applyCustomization(donutInput, { ...richCustomization, top_n: { n: 21, remainder: 'OTHER' } }), 'DASH085_TOP_N_INVALID');
expectCode(() => CUSTOM.applyCustomization(donutInput, { ...richCustomization, number_format: { style: 'COMPACT', fraction_digits: 3, sign: 'AUTO' } }), 'DASH085_NUMBER_FORMAT_FRACTION_INVALID');

// VIZ-070 rejects information-losing BAR-with-series -> DONUT retype.
const seriesQuery = baseQuery({ dimensions: ['category_id', 'account_id'] });
const seriesBar = binding('w-0004', 'CHART', seriesQuery, {
  schema: VIZ.CHART_SPEC_SCHEMA,
  contract_version: VIZ.VERSION,
  id: 'series-bar',
  type: 'BAR',
  title: 'Расходы по категориям и счетам',
  encoding: {
    x: { kind: 'DIMENSION', id: 'category_id' },
    y: { kind: 'MEASURE', id: 'EXPENSE' },
    series: { kind: 'DIMENSION', id: 'account_id' }
  },
  presentation: { legend: true, stacked: false, smooth: false, show_labels: false },
  interactions: { filter: true, drill: true }
});
expectCode(() => CUSTOM.applyCustomization(seriesBar, customization({
  chart_type: 'DONUT', axes: { x: 'HIDE', y: 'HIDE' }, legend: 'AUTO'
})), 'VIZ070_RETYPE_SERIES_AMBIGUOUS');

const telemetry = CUSTOM.telemetry(donutResult);
assert.deepStrictEqual(Object.keys(telemetry).sort(), CUSTOM.CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.theme, 'DARK');
assert.strictEqual(telemetry.chart_type, 'DONUT');
assert.strictEqual(telemetry.density, 'COMPACT');
assert.strictEqual(telemetry.customization_hash_prefix, donutResult.customization_hash.slice(0, 12));
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['category_id', 'EXPENSE', 'RUB', 'amount_minor', normalizedDonut.query_hash, normalizedDonut.binding_hash]) {
  assert.strictEqual(telemetryText.includes(forbidden), false, `telemetry leaked ${forbidden}`);
}

console.log('dashboard_visual_customization_contract_test: PASS', {
  contract: `${CUSTOM.SCHEMA}@${CUSTOM.VERSION}`,
  themes: CUSTOM.CONTRACT.themes,
  palettes: Object.keys(CUSTOM.CONTRACT.palette_registry),
  chartTypes: CUSTOM.CONTRACT.chart_types,
  queryHashInvariant: true,
  topNAuthority: 'ANL-072/TOP_N_OTHER',
  arbitraryCssHtmlUrl: false,
  financialWrite: false,
  freeOnly: true
});
