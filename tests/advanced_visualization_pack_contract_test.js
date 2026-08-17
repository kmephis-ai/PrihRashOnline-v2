'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ADV = require('../lib/visualization/advanced_visualization_pack');
const VIZ070 = require('../lib/visualization/visualization_registry_v2');
const ANALYTICS = require('../lib/analytics/analytics_engine');

ADV.assertContract();
assert.strictEqual(ADV.SCHEMA, 'PRH_ADVANCED_VISUALIZATION_PACK_V1');
assert.strictEqual(ADV.VERSION, '1.0.0');
assert.strictEqual(ADV.CONTRACT.roadmap_id, 'VIZ-090');
assert.strictEqual(ADV.CONTRACT.principles.query_mutation_allowed, false);
assert.strictEqual(ADV.CONTRACT.principles.financial_formula_allowed, false);
assert.strictEqual(ADV.CONTRACT.principles.transaction_access_allowed, false);
assert.strictEqual(ADV.CONTRACT.principles.arbitrary_renderer_options_allowed, false);
assert(Object.values(ADV.CONTRACT.authorities).every((value) => value === false));

const TYPES = [
  'AREA','GROUPED_BAR','STACKED_BAR','PERCENT_STACKED_BAR','WATERFALL','SANKEY','TREEMAP','SUNBURST',
  'CALENDAR_HEATMAP','MATRIX_HEATMAP','PARETO','SCATTER','BUBBLE','HISTOGRAM','BOX','VIOLIN',
  'SMALL_MULTIPLES','BULLET_KPI'
].sort();
assert.deepStrictEqual(ADV.CHART_TYPES.slice().sort(), TYPES);
assert.deepStrictEqual(VIZ070.CHART_TYPES.slice().sort(), ['BAR','DONUT','LINE']);
assert.strictEqual(VIZ070.rendererCapabilities('ECHARTS_6').loading_policy, 'LOCAL_OR_BUNDLED');
assert.strictEqual(VIZ070.rendererCapabilities('ECHARTS_6').replaceable, true);
assert.strictEqual(VIZ070.rendererCapabilities('ECHARTS_6').financial_truth_authority, false);
assert.strictEqual(VIZ070.rendererCapabilities('ECHARTS_6').query_authority, false);

function expectCode(fn, code) {
  assert.throws(fn, (error) => error && error.code === code, `expected ${code}`);
}

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
const Q = query();
const QH = ANALYTICS.analyticsQueryHash(Q);
const OPTS = { viewport_width_px: 1440, assistive_mode: false, renderer: 'ECHARTS_6' };

function spec(type, interactions) {
  const entry = ADV.CONTRACT.chart_registry[type];
  return {
    schema: ADV.SPEC_SCHEMA,
    contract_version: ADV.VERSION,
    id: `v-${type.toLowerCase().replace(/_/g, '-')}`,
    type,
    title: `Синтетический ${type}`,
    interactions: interactions || { filter: entry.supports_filter, drill: entry.supports_drill }
  };
}
function source(shape, data, extra = {}) {
  return {
    schema: ADV.SOURCE_SCHEMA,
    contract_version: ADV.VERSION,
    query_hash: QH,
    source_contract: 'PRH_SYNTHETIC_VISUAL_SOURCE_V1@1.0.0',
    shape,
    data,
    ...extra
  };
}

const FIXTURES = {
  AREA: source('TIME_SERIES', { rows: [
    { x: '2026-01', series: 's', value: 100 }, { x: '2026-02', series: 's', value: 120 }
  ] }),
  GROUPED_BAR: source('CATEGORICAL_SERIES', { rows: [
    { category: 'food', series: 'current', value: 60 }, { category: 'food', series: 'previous', value: 50 },
    { category: 'home', series: 'current', value: 40 }, { category: 'home', series: 'previous', value: 45 }
  ] }),
  STACKED_BAR: source('CATEGORICAL_SERIES', { rows: [
    { category: 'jan', series: 'food', value: 60 }, { category: 'jan', series: 'home', value: 40 }
  ] }),
  PERCENT_STACKED_BAR: source('CATEGORICAL_SERIES', { rows: [
    { category: 'jan', series: 'a', value: 1 }, { category: 'jan', series: 'b', value: 2 }, { category: 'jan', series: 'c', value: 3 },
    { category: 'zero', series: 'a', value: 0 }, { category: 'zero', series: 'b', value: 0 }
  ] }),
  WATERFALL: source('WATERFALL', { rows: [
    { id: 'start', order: 0, kind: 'START', value: 1000 },
    { id: 'expense', order: 1, kind: 'DELTA', value: -300 },
    { id: 'income', order: 2, kind: 'DELTA', value: 500 },
    { id: 'end', order: 3, kind: 'END', value: 1200 }
  ] }, { source_contract: 'PRH_CONTRIBUTION_DECOMPOSITION_V1@1.0.0' }),
  SANKEY: source('SANKEY', { edges: [
    { source: 'income', target: 'account', value: 1000 }, { source: 'account', target: 'food', value: 600 },
    { source: 'account', target: 'home', value: 400 }
  ] }),
  TREEMAP: source('HIERARCHY', { nodes: [
    { id: 'all', parent_id: null, value: 1000 }, { id: 'food', parent_id: 'all', value: 600 }, { id: 'home', parent_id: 'all', value: 400 }
  ] }),
  SUNBURST: source('HIERARCHY', { nodes: [
    { id: 'all', parent_id: null, value: 1000 }, { id: 'food', parent_id: 'all', value: 600 }, { id: 'home', parent_id: 'all', value: 400 }
  ] }),
  CALENDAR_HEATMAP: source('CALENDAR_HEATMAP', { rows: [
    { day: '2026-01-01', present: true, value: 0 }, { day: '2026-01-02', present: false, value: null },
    { day: '2026-01-03', present: true, value: 25 }
  ] }),
  MATRIX_HEATMAP: source('MATRIX_HEATMAP', { rows: [
    { x: 'mon', y: 'food', present: true, value: 10 }, { x: 'mon', y: 'home', present: false, value: null },
    { x: 'tue', y: 'food', present: true, value: 0 }
  ] }),
  PARETO: source('PARETO', { rows: [
    { category: 'a', value: 60 }, { category: 'b', value: 30 }, { category: 'c', value: 10 }
  ] }),
  SCATTER: source('XY', { rows: [
    { id: 'p1', x: 1.5, y: 2.5, series: 's' }, { id: 'p2', x: 2.5, y: 3.5, series: 's' }
  ] }),
  BUBBLE: source('XYZ', { rows: [
    { id: 'p1', x: 1.5, y: 2.5, size: 10, series: 's' }, { id: 'p2', x: 2.5, y: 3.5, size: 20, series: 's' }
  ] }),
  HISTOGRAM: source('DISTRIBUTION_SAMPLES', { series: [{ id: 's', samples: [4,1,3,2,5] }] }, { source_contract: 'PRH_DISTRIBUTION_FACTS_V1@1.0.0' }),
  BOX: source('DISTRIBUTION_SAMPLES', { series: [{ id: 's', samples: [4,1,3,2,5] }] }, { source_contract: 'PRH_DISTRIBUTION_FACTS_V1@1.0.0' }),
  VIOLIN: source('DISTRIBUTION_SAMPLES', { series: [{ id: 's', samples: [4,1,3,2,5] }] }, { source_contract: 'PRH_DISTRIBUTION_FACTS_V1@1.0.0' }),
  SMALL_MULTIPLES: source('FACET_SERIES', { rows: [
    { facet: 'food', x: 'jan', series: null, value: 10 }, { facet: 'food', x: 'feb', series: null, value: 12 },
    { facet: 'home', x: 'jan', series: null, value: 8 }, { facet: 'home', x: 'feb', series: null, value: 9 }
  ] }),
  BULLET_KPI: source('BULLET_KPI', {
    actual: 900, reference: 850, target: 1000,
    reference_provenance: 'PRH_PERSONAL_BENCHMARK_RESULT_V1@1.0.0',
    target_provenance: 'PRH_GOAL_PLANNING_V1@1.0.0'
  })
};

const plans = {};
for (const type of TYPES) {
  const plan = ADV.planAdvancedVisualization(spec(type), FIXTURES[type], Q, OPTS);
  plans[type] = plan;
  assert.strictEqual(plan.schema, ADV.PLAN_SCHEMA);
  assert.strictEqual(plan.chart_type, type);
  assert.strictEqual(plan.query_hash, QH);
  assert.strictEqual(plan.query_modified, false);
  assert.strictEqual(plan.financial_truth_policy, 'FIN-TRUTH-v1');
  assert.strictEqual(plan.renderer, 'ECHARTS_6');
  assert.strictEqual(plan.renderer_replaceable, true);
  assert.strictEqual(plan.a11y.semantic_table_required, true);
  assert.strictEqual(plan.a11y.text_summary_required, true);
  assert.strictEqual(plan.a11y.interaction_only_evidence_allowed, false);
  assert.match(plan.plan_hash, /^[0-9a-f]{64}$/);
}

// Assistive fallback is a semantic table, not hidden chart-only evidence.
for (const type of ['WATERFALL','SANKEY','SMALL_MULTIPLES']) {
  const plan = ADV.planAdvancedVisualization(spec(type), FIXTURES[type], Q, {
    viewport_width_px: 390, assistive_mode: true, renderer: 'ECHARTS_6'
  });
  assert.strictEqual(plan.renderer, 'SEMANTIC_TABLE_V1');
  assert.strictEqual(plan.a11y.active_fallback, 'SEMANTIC_TABLE_V1');
  assert.strictEqual(plan.responsive_mode, 'MOBILE');
}

// 100% stack: original values are preserved; positive category = exactly 10000 bps, zero total stays explicit zero.
const percent = plans.PERCENT_STACKED_BAR.normalized_source.data.rows;
const jan = percent.filter((row) => row.category === 'jan');
assert.strictEqual(jan.reduce((sum, row) => sum + row.value, 0), 6);
assert.strictEqual(jan.reduce((sum, row) => sum + row.share_bps, 0), 10000);
assert(jan.every((row) => row.normalization === 'NORMALIZED_100_PERCENT'));
const zero = percent.filter((row) => row.category === 'zero');
assert.strictEqual(zero.reduce((sum, row) => sum + row.share_bps, 0), 0);
assert(zero.every((row) => row.normalization === 'ZERO_TOTAL'));

// Waterfall and hierarchy are reconciliation-gated.
assert.strictEqual(plans.WATERFALL.normalized_source.data.start, 1000);
assert.strictEqual(plans.WATERFALL.normalized_source.data.end, 1200);
expectCode(() => ADV.planAdvancedVisualization(spec('WATERFALL'), source('WATERFALL', { rows: [
  { id: 'start', order: 0, kind: 'START', value: 1000 }, { id: 'd', order: 1, kind: 'DELTA', value: -200 },
  { id: 'end', order: 2, kind: 'END', value: 900 }
] }), Q, OPTS), 'VIZ090_WATERFALL_CONSERVATION_FAILED');
expectCode(() => ADV.planAdvancedVisualization(spec('TREEMAP'), source('HIERARCHY', { nodes: [
  { id: 'all', parent_id: null, value: 100 }, { id: 'child', parent_id: 'all', value: 90 }
] }), Q, OPTS), 'VIZ090_HIERARCHY_RECONCILIATION_FAILED');
expectCode(() => ADV.planAdvancedVisualization(spec('TREEMAP'), source('HIERARCHY', { nodes: [
  { id: 'root', parent_id: null, value: 1 }, { id: 'orphan', parent_id: 'missing', value: 1 }
] }), Q, OPTS), 'VIZ090_HIERARCHY_ORPHAN');

// Sankey accepts topology, not causal interpretation; negative/self edges fail closed.
assert.strictEqual(plans.SANKEY.normalized_source.data.causality_claimed, false);
assert.deepStrictEqual(plans.SANKEY.normalized_source.data.nodes, ['account','food','home','income']);
const cyclic = source('SANKEY', { edges: [{ source: 'a', target: 'b', value: 1 }, { source: 'b', target: 'a', value: 1 }] });
assert.strictEqual(ADV.planAdvancedVisualization(spec('SANKEY'), cyclic, Q, OPTS).normalized_source.data.causality_claimed, false);
expectCode(() => ADV.planAdvancedVisualization(spec('SANKEY'), source('SANKEY', { edges: [{ source: 'a', target: 'b', value: -1 }] }), Q, OPTS), 'VIZ090_SANKEY_VALUE_INVALID');
expectCode(() => ADV.planAdvancedVisualization(spec('SANKEY'), source('SANKEY', { edges: [{ source: 'a', target: 'a', value: 1 }] }), Q, OPTS), 'VIZ090_SANKEY_SELF_EDGE_INVALID');

// Missing bucket remains different from an explicit financial zero.
const cal = plans.CALENDAR_HEATMAP.normalized_source.data.rows;
assert.deepStrictEqual(cal.find((row) => row.day === '2026-01-01'), { day: '2026-01-01', present: true, value: 0 });
assert.deepStrictEqual(cal.find((row) => row.day === '2026-01-02'), { day: '2026-01-02', present: false, value: null });
expectCode(() => ADV.planAdvancedVisualization(spec('CALENDAR_HEATMAP'), source('CALENDAR_HEATMAP', { rows: [
  { day: '2026-01-01', present: false, value: 0 }
] }), Q, OPTS), 'VIZ090_HEATMAP_MISSING_MUST_BE_NULL');

// Pareto conserves total and reaches exact 100%.
assert.strictEqual(plans.PARETO.normalized_source.data.total, 100);
const paretoRows = plans.PARETO.normalized_source.data.rows;
assert.deepStrictEqual(paretoRows.map((row) => row.category), ['a','b','c']);
assert.strictEqual(paretoRows[paretoRows.length - 1].cumulative_value, 100);
assert.strictEqual(paretoRows[paretoRows.length - 1].cumulative_bps, 10000);

// Scatter/Bubble validate numeric semantics and make no correlation/causality claim.
assert.strictEqual(plans.SCATTER.normalized_source.data.correlation_claimed, false);
assert.strictEqual(plans.SCATTER.normalized_source.data.causality_claimed, false);
assert.strictEqual(plans.BUBBLE.normalized_source.data.correlation_claimed, false);
expectCode(() => ADV.planAdvancedVisualization(spec('BUBBLE'), source('XYZ', { rows: [
  { id: 'p', x: 1, y: 2, size: -1, series: null }
] }), Q, OPTS), 'VIZ090_BUBBLE_SIZE_INVALID');
expectCode(() => ADV.planAdvancedVisualization(spec('SCATTER'), source('XY', { rows: [
  { id: 'p', x: NaN, y: 2, series: null }
] }), Q, OPTS), 'VIZ090_X_INVALID');

// Distribution remains explicit-sample semantics; no hidden summary substitution.
for (const type of ['HISTOGRAM','BOX','VIOLIN']) {
  assert.strictEqual(plans[type].normalized_source.data.source_semantics, 'EXPLICIT_SAMPLES');
  assert.deepStrictEqual(plans[type].normalized_source.data.series[0].samples, [1,2,3,4,5]);
  assert.strictEqual(plans[type].normalized_source.data.total_samples, 5);
}

// Small multiples are bounded and no facet is dropped.
assert.deepStrictEqual(plans.SMALL_MULTIPLES.normalized_source.data.facets, ['food','home']);
assert.strictEqual(plans.SMALL_MULTIPLES.normalized_source.data.scale_policy, 'SHARED_COMPATIBLE');
const tooManyFacets = Array.from({ length: ADV.CONTRACT.limits.max_facets + 1 }, (_, i) => ({ facet: `f${i}`, x: 'x', series: null, value: i }));
expectCode(() => ADV.planAdvancedVisualization(spec('SMALL_MULTIPLES'), source('FACET_SERIES', { rows: tooManyFacets }), Q, OPTS), 'VIZ090_FACET_LIMIT');

// Bullet references/targets are explicit upstream facts, never invented by renderer.
assert.strictEqual(plans.BULLET_KPI.normalized_source.data.reference_provenance, 'PRH_PERSONAL_BENCHMARK_RESULT_V1@1.0.0');
assert.strictEqual(plans.BULLET_KPI.normalized_source.data.target_provenance, 'PRH_GOAL_PLANNING_V1@1.0.0');
expectCode(() => ADV.planAdvancedVisualization(spec('BULLET_KPI'), source('BULLET_KPI', {
  actual: 1, reference: 1, target: 2, reference_provenance: 'manual', target_provenance: 'manual'
}), Q, OPTS), 'VIZ090_SOURCE_CONTRACT_INVALID');

// Exact query identity, shape compatibility and stack semantics are fail-closed.
expectCode(() => ADV.planAdvancedVisualization(spec('AREA'), FIXTURES.AREA, query({ measures: ['INCOME'] }), OPTS), 'VIZ090_QUERY_HASH_MISMATCH');
expectCode(() => ADV.planAdvancedVisualization(spec('SANKEY'), FIXTURES.PARETO, Q, OPTS), 'VIZ090_SOURCE_CHART_SHAPE_INCOMPATIBLE');
expectCode(() => ADV.planAdvancedVisualization(spec('STACKED_BAR'), source('CATEGORICAL_SERIES', { rows: [
  { category: 'a', series: null, value: 1 }
] }), Q, OPTS), 'VIZ090_STACK_REQUIRES_SERIES');
expectCode(() => ADV.planAdvancedVisualization(spec('PERCENT_STACKED_BAR'), source('CATEGORICAL_SERIES', { rows: [
  { category: 'a', series: 's', value: -1 }
] }), Q, OPTS), 'VIZ090_PERCENT_STACK_REQUIRES_NON_NEGATIVE_SERIES');

// Canonical ordering produces identical source/plan identities.
const reversed = source('CATEGORICAL_SERIES', { rows: FIXTURES.GROUPED_BAR.data.rows.slice().reverse() });
const reorderedPlan = ADV.planAdvancedVisualization(spec('GROUPED_BAR'), reversed, Q, OPTS);
assert.strictEqual(reorderedPlan.result_shape_hash, plans.GROUPED_BAR.result_shape_hash);
assert.strictEqual(reorderedPlan.plan_hash, plans.GROUPED_BAR.plan_hash);

// Unknown renderer config is rejected by exact schema; executable/hostile keys get the hostile classifier.
expectCode(() => ADV.normalizeSpec({ ...spec('AREA'), echarts_options: { animation: true } }), 'VIZ090_SPEC_SHAPE_INVALID');
expectCode(() => ADV.assertNoHostilePayload({ formatter: 'x => x' }), 'VIZ090_HOSTILE_KEY_FORBIDDEN');
expectCode(() => ADV.assertNoHostilePayload({ label: '<script>alert(1)</script>' }), 'VIZ090_HOSTILE_STRING_FORBIDDEN');
expectCode(() => ADV.assertNoHostilePayload({ label: 'https://example.invalid' }), 'VIZ090_HOSTILE_STRING_FORBIDDEN');
expectCode(() => ADV.normalizeSpec(spec('HISTOGRAM', { filter: true, drill: false })), 'VIZ090_FILTER_UNSUPPORTED');
expectCode(() => ADV.normalizeSpec(spec('HISTOGRAM', { filter: false, drill: true })), 'VIZ090_DRILL_UNSUPPORTED');

// Telemetry is fixed-shape and does not contain private dimension labels.
const telemetry = ADV.telemetry(plans.GROUPED_BAR);
assert.deepStrictEqual(Object.keys(telemetry).sort(), ADV.CONTRACT.telemetry_allowlist.slice().sort());
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['food','home','current','previous']) assert(!telemetryText.includes(forbidden), `telemetry leak: ${forbidden}`);

// Pure pack has no financial-store/network/code-execution authority.
const sourceText = fs.readFileSync(path.join(__dirname, '..', 'lib/visualization/advanced_visualization_pack.js'), 'utf8');
for (const forbidden of ["require('../finance", "require('../domain", 'SpreadsheetApp', 'UrlFetchApp', 'PropertiesService', 'eval(', 'new Function(']) {
  assert(!sourceText.includes(forbidden), `advanced visualization gained forbidden authority: ${forbidden}`);
}

console.log('advanced_visualization_pack_contract_test: OK', {
  contract: `${ADV.SCHEMA}@${ADV.VERSION}`,
  charts: ADV.CHART_TYPES.length,
  viz070LineBaseline: true,
  queryHashPrefix: QH.slice(0, 12),
  semanticTableFallback: true,
  financialWrite: false,
  freeOnly: true
});
