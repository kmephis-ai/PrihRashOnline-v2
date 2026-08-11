'use strict';

const assert = require('assert');
const CUSTOM = require('../lib/dashboard/dashboard_visual_customization');
const FACTORY = require('../lib/dashboard/widget_factory');
const COMPOSER = require('../lib/dashboard/dashboard_composer');
const ANALYTICS = require('../lib/analytics/analytics_engine');
const VIZ = require('../lib/visualization/visualization_foundation');
const DESIGN = require('../lib/design/design_system.v1.json');

CUSTOM.assertContract();
assert.strictEqual(CUSTOM.CONTRACT.schema, 'PRH_DASHBOARD_VISUAL_CUSTOMIZATION_V1');
assert.strictEqual(CUSTOM.CONTRACT.version, '1.0.0');
assert.strictEqual(CUSTOM.CONTRACT.roadmap_id, 'DASH-085');
assert.deepStrictEqual(CUSTOM.THEMES, ['SYSTEM', 'LIGHT', 'DARK']);
assert.deepStrictEqual(CUSTOM.DENSITIES, ['COMPACT', 'COMFORTABLE']);
assert.deepStrictEqual(CUSTOM.PALETTES.slice().sort(), ['COLORBLIND', 'DEFAULT', 'MONO']);
assert(Object.values(CUSTOM.CONTRACT.authority).every((value) => value === false));
assert.strictEqual(CUSTOM.CONTRACT.principles.presentation_only, true);
assert.strictEqual(CUSTOM.CONTRACT.principles.query_mutation_allowed, false);
assert.strictEqual(CUSTOM.CONTRACT.principles.financial_formula_allowed, false);
assert.strictEqual(CUSTOM.CONTRACT.principles.free_only, true);
assert.strictEqual(DESIGN.accessibility.focus_visible_required, true);
assert.strictEqual(DESIGN.accessibility.reduced_motion_required, true);

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

function placeholder(id, title = 'Synthetic widget') {
  return {
    schema: COMPOSER.WIDGET_SCHEMA,
    id,
    title,
    semantic_binding_status: 'UNBOUND',
    geometry: { x: 0, y: 0, w: 4, h: 2 }
  };
}

function chartSpec(type = 'BAR', withSeries = false) {
  const encoding = type === 'DONUT'
    ? {
        category: { kind: 'DIMENSION', id: 'category_id' },
        value: { kind: 'MEASURE', id: 'EXPENSE' }
      }
    : {
        x: { kind: 'DIMENSION', id: 'category_id' },
        y: { kind: 'MEASURE', id: 'EXPENSE' }
      };
  if (withSeries && type !== 'DONUT') encoding.series = { kind: 'DIMENSION', id: 'member_id' };
  return {
    schema: VIZ.CHART_SPEC_SCHEMA,
    contract_version: VIZ.VERSION,
    id: `synthetic-${type.toLowerCase()}`,
    type,
    title: 'Synthetic chart',
    encoding,
    presentation: { legend: true, stacked: false, smooth: false, show_labels: false },
    interactions: { filter: true, drill: true }
  };
}

function boundChart(id = 'w-0001', options = {}) {
  const withSeries = options.withSeries === true;
  const q = query({ dimensions: withSeries ? ['category_id', 'member_id'] : ['category_id'] });
  return FACTORY.bindPlaceholder(placeholder(id), {
    schema: FACTORY.BINDING_SCHEMA,
    contract_version: FACTORY.VERSION,
    widget_id: id,
    kind: 'CHART',
    query: q,
    presentation: chartSpec('BAR', withSeries)
  });
}

function boundKpi(id = 'w-0090') {
  return FACTORY.bindPlaceholder(placeholder(id, 'Synthetic KPI'), {
    schema: FACTORY.BINDING_SCHEMA,
    contract_version: FACTORY.VERSION,
    widget_id: id,
    kind: 'KPI',
    query: query({ dimensions: [], measures: ['EXPENSE'] }),
    presentation: {
      schema: FACTORY.VALUE_PRESENTATION_SCHEMA,
      contract_version: FACTORY.VERSION,
      title: 'Synthetic KPI',
      show_comparison: false
    }
  });
}

function override(widgetId, changes = {}) {
  return {
    schema: CUSTOM.OVERRIDE_SCHEMA,
    contract_version: CUSTOM.VERSION,
    widget_id: widgetId,
    chart_type: null,
    axes: { x: 'AUTO', y: 'AUTO' },
    labels: 'AUTO',
    legend: { mode: 'AUTO', position: 'AUTO' },
    stack: 'NONE',
    sort: 'NONE',
    top_n: null,
    number_format: 'AUTO',
    ...changes
  };
}

function preference(changes = {}) {
  return {
    schema: CUSTOM.PREFERENCE_SCHEMA,
    contract_version: CUSTOM.VERSION,
    theme: 'SYSTEM',
    palette: 'DEFAULT',
    density: 'COMFORTABLE',
    reduced_motion: false,
    high_contrast: false,
    widget_overrides: [],
    ...changes
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error && error.code === code, `expected ${code}`);
}

// Deterministic preference identity is independent of object-key and widget override ordering.
const normalizedA = CUSTOM.normalizePreference(preference({
  theme: 'DARK',
  palette: 'COLORBLIND',
  density: 'COMPACT',
  widget_overrides: [override('w-0002'), override('w-0001')]
}));
const normalizedB = CUSTOM.normalizePreference({
  widget_overrides: [override('w-0001'), override('w-0002')],
  high_contrast: false,
  reduced_motion: false,
  density: 'COMPACT',
  palette: 'COLORBLIND',
  theme: 'DARK',
  contract_version: CUSTOM.VERSION,
  schema: CUSTOM.PREFERENCE_SCHEMA
});
assert.strictEqual(normalizedA.customization_hash, normalizedB.customization_hash);
assert.deepStrictEqual(normalizedA.widget_overrides.map((item) => item.widget_id), ['w-0001', 'w-0002']);

// Theme resolution delegates raw colors to DESIGN-020 token set.
const systemPreference = CUSTOM.normalizePreference(preference());
assert.strictEqual(CUSTOM.resolveTheme(systemPreference, false).effective, 'LIGHT');
assert.strictEqual(CUSTOM.resolveTheme(systemPreference, true).effective, 'DARK');
assert.strictEqual(CUSTOM.resolveTheme(CUSTOM.normalizePreference(preference({ theme: 'LIGHT' })), true).effective, 'LIGHT');
assert.strictEqual(CUSTOM.resolveTheme(CUSTOM.normalizePreference(preference({ theme: 'DARK' })), false).design_theme_ref, 'DESIGN:dark');

// High contrast deterministically selects MONO; density points only to DESIGN aliases and preserves 44px hit target.
const accessiblePreference = CUSTOM.normalizePreference(preference({
  palette: 'COLORBLIND',
  density: 'COMPACT',
  reduced_motion: true,
  high_contrast: true
}));
const palette = CUSTOM.resolvePalette(accessiblePreference);
assert.strictEqual(palette.requested, 'COLORBLIND');
assert.strictEqual(palette.effective, 'MONO');
assert.strictEqual(palette.high_contrast_fallback_applied, true);
assert(palette.series.every((value) => value.startsWith('DESIGN:')));
const density = CUSTOM.resolveDensity(accessiblePreference);
assert.strictEqual(density.spacing_ref, `DESIGN:spacing:${CUSTOM.CONTRACT.density_tokens.COMPACT.spacing_token}`);
assert.strictEqual(density.min_hit_target_px, 44);
assert.strictEqual(density.focus_visible_required, true);

// BAR -> LINE is delegated to VIZ-070 and cannot modify query or binding identity.
const chart = boundChart();
const retypePreference = preference({
  theme: 'DARK',
  palette: 'COLORBLIND',
  widget_overrides: [override(chart.widget_id, {
    chart_type: 'LINE',
    axes: { x: 'SHOW', y: 'SHOW' },
    labels: 'SHOW',
    legend: { mode: 'SHOW', position: 'BOTTOM' },
    sort: 'DESC',
    top_n: { limit: 5, other_policy: 'REMAINDER' },
    number_format: 'MONEY'
  })]
});
const linePlan = CUSTOM.applyToBoundWidget(retypePreference, chart, { system_dark: false });
assert.strictEqual(linePlan.presentation.chart_type, 'LINE');
assert.strictEqual(linePlan.query_hash, chart.binding.query_hash);
assert.strictEqual(linePlan.input_binding_hash, chart.binding.binding_hash);
assert.strictEqual(linePlan.query_modified, false);
assert.strictEqual(linePlan.binding_modified, false);
assert.strictEqual(linePlan.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(linePlan.presentation.number_format.id, 'MONEY');
assert.strictEqual(linePlan.presentation.number_format.locale, 'ru-RU');
assert.strictEqual(linePlan.theme.effective, 'DARK');

// BAR -> DONUT succeeds without series; axes/stack remain constrained by target chart semantics.
const donutPlan = CUSTOM.applyToBoundWidget(preference({
  widget_overrides: [override(chart.widget_id, { chart_type: 'DONUT', labels: 'SHOW', legend: { mode: 'SHOW', position: 'RIGHT' } })]
}), chart, { system_dark: false });
assert.strictEqual(donutPlan.presentation.chart_type, 'DONUT');
assert.strictEqual(donutPlan.query_hash, chart.binding.query_hash);
expectCode(() => CUSTOM.applyToBoundWidget(preference({
  widget_overrides: [override(chart.widget_id, { chart_type: 'DONUT', axes: { x: 'SHOW', y: 'AUTO' } })]
}), chart, { system_dark: false }), 'DASH085_DONUT_AXES_UNSUPPORTED');
expectCode(() => CUSTOM.applyToBoundWidget(preference({
  widget_overrides: [override(chart.widget_id, { chart_type: 'DONUT', stack: 'NORMAL' })]
}), chart, { system_dark: false }), 'DASH085_DONUT_STACK_UNSUPPORTED');

// VIZ-070 ambiguity stays fail-closed for a BAR with series -> DONUT retype.
const seriesChart = boundChart('w-0003', { withSeries: true });
expectCode(() => CUSTOM.applyToBoundWidget(preference({
  widget_overrides: [override(seriesChart.widget_id, { chart_type: 'DONUT' })]
}), seriesChart, { system_dark: false }), 'VIZ070_RETYPE_SERIES_AMBIGUOUS');

// Stacking is bounded: only BAR with an explicit series binding.
const stackedPlan = CUSTOM.applyToBoundWidget(preference({
  widget_overrides: [override(seriesChart.widget_id, { stack: 'NORMAL' })]
}), seriesChart, { system_dark: false });
assert.strictEqual(stackedPlan.presentation.stack, 'NORMAL');
expectCode(() => CUSTOM.applyToBoundWidget(preference({
  widget_overrides: [override(chart.widget_id, { stack: 'NORMAL' })]
}), chart, { system_dark: false }), 'DASH085_STACK_UNSUPPORTED');
expectCode(() => CUSTOM.applyToBoundWidget(preference({
  widget_overrides: [override(chart.widget_id, { legend: { mode: 'HIDE', position: 'BOTTOM' } })]
}), chart, { system_dark: false }), 'DASH085_HIDDEN_LEGEND_POSITION_INVALID');

// Non-chart widgets support semantic number/sort/top-N preferences but reject chart-only knobs.
const kpi = boundKpi();
const kpiPlan = CUSTOM.applyToBoundWidget(preference({
  widget_overrides: [override(kpi.widget_id, { number_format: 'COMPACT', sort: 'DESC', top_n: { limit: 3, other_policy: 'REMAINDER' } })]
}), kpi, { system_dark: false });
assert.strictEqual(kpiPlan.widget_kind, 'KPI');
assert.strictEqual(kpiPlan.presentation.chart_spec, null);
assert.strictEqual(kpiPlan.presentation.number_format.id, 'COMPACT');
expectCode(() => CUSTOM.applyToBoundWidget(preference({
  widget_overrides: [override(kpi.widget_id, { axes: { x: 'SHOW', y: 'AUTO' } })]
}), kpi, { system_dark: false }), 'DASH085_NON_CHART_OPTION_UNSUPPORTED');

// Top-N is presentation-only and conserves the semantic result total through explicit __OTHER__ remainder.
const topN = CUSTOM.applyTopN([
  { key: 'synthetic-food', value: 5000 },
  { key: 'synthetic-home', value: 3000 },
  { key: 'synthetic-car', value: 2000 },
  { key: 'synthetic-health', value: 1000 }
], { sort: 'DESC', top_n: { limit: 2, other_policy: 'REMAINDER' } });
assert.deepStrictEqual(topN.rows, [
  { key: 'synthetic-food', value: 5000 },
  { key: 'synthetic-home', value: 3000 },
  { key: '__OTHER__', value: 3000 }
]);
assert.strictEqual(topN.source_total, 11000);
assert.strictEqual(topN.presented_total, 11000);
assert.strictEqual(topN.conserved, true);
assert.strictEqual(topN.presentation_only, true);
assert.strictEqual(topN.financial_truth_policy, 'FIN-TRUTH-v1');
const topNReordered = CUSTOM.applyTopN([
  { key: 'synthetic-home', value: 3000 },
  { key: 'synthetic-food', value: 5000 },
  { key: 'synthetic-health', value: 1000 },
  { key: 'synthetic-car', value: 2000 }
], { sort: 'DESC', top_n: { limit: 2, other_policy: 'REMAINDER' } });
assert.strictEqual(topN.presentation_hash, topNReordered.presentation_hash);
expectCode(() => CUSTOM.applyTopN([{ key: '__OTHER__', value: 1 }], { sort: 'NONE', top_n: null }), 'DASH085_TOP_N_KEY_INVALID');
expectCode(() => CUSTOM.applyTopN([{ key: 'a', value: Number.MAX_SAFE_INTEGER }, { key: 'b', value: 1 }], { sort: 'NONE', top_n: null }), 'DASH085_TOP_N_TOTAL_OVERFLOW');

// Arbitrary CSS/color/formatter/financial or private-data payload is rejected before normalization.
for (const hostile of [
  { css: 'body{display:none}' },
  { color: '#ffffff' },
  { formatter: 'return value' },
  { transaction_id: 'private-transaction' },
  { amount_minor: 100 }
]) {
  const payload = preference();
  Object.assign(payload, hostile);
  expectCode(() => CUSTOM.normalizePreference(payload), 'DASH085_HOSTILE_PRESENTATION_PAYLOAD');
}
expectCode(() => CUSTOM.normalizePreference(preference({ palette: '#ff00ff' })), 'DASH085_PALETTE_INVALID');
expectCode(() => CUSTOM.normalizePreference(preference({ widget_overrides: [
  { ...override('w-0001'), formatter: 'custom' }
] })), 'DASH085_HOSTILE_PRESENTATION_PAYLOAD');

// Telemetry emits only enums and hash prefixes, never widget IDs, filters, palette colors or result values.
const telemetry = CUSTOM.telemetry(linePlan);
assert.deepStrictEqual(Object.keys(telemetry).sort(), CUSTOM.CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.query_hash_prefix, chart.binding.query_hash.slice(0, 12));
assert.strictEqual(telemetry.theme, 'DARK');
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['w-0001', 'category_id', 'RUB', 'EXPENSE', '#0072b2', 'synthetic-food', '5000']) {
  assert(!telemetryText.includes(forbidden), `telemetry leak: ${forbidden}`);
}

console.log('dashboard_visual_customization_contract_test: OK', {
  contract: `${CUSTOM.SCHEMA}@${CUSTOM.VERSION}`,
  themes: CUSTOM.THEMES,
  palettes: CUSTOM.PALETTES,
  densities: CUSTOM.DENSITIES,
  vizRetypeDelegated: true,
  queryMutation: false,
  topNConservation: true,
  designTokens: true,
  publicEvidence: CUSTOM.CONTRACT.privacy.public_evidence,
  freeOnly: true
});
