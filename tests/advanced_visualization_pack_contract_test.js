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
assert.strictEqual(ADV.CONTRACT.principles.external_cdn_required, false);
assert.strictEqual(ADV.CONTRACT.principles.paid_dependency_required, false);
assert(Object.values(ADV.CONTRACT.authorities).every((value) => value === false));
assert(VIZ070.CHART_TYPES.includes('LINE'));
assert(!VIZ070.CHART_TYPES.includes('AREA'));

const EXPECTED_TYPES = [
  'AREA', 'GROUPED_BAR', 'STACKED_BAR', 'PERCENT_STACKED_BAR', 'WATERFALL', 'SANKEY', 'TREEMAP', 'SUNBURST',
  'CALENDAR_HEATMAP', 'MATRIX_HEATMAP', 'PARETO', 'SCATTER', 'BUBBLE', 'HISTOGRAM', 'BOX', 'VIOLIN',
  'SMALL_MULTIPLES', 'BULLET_KPI'
].sort();
assert.deepStrictEqual(ADV.CHART_TYPES.slice().sort(), EXPECTED_TYPES);
for (const type of ADV.CHART_TYPES) {
  const entry = ADV.CONTRACT.chart_registry[type];
  assert(entry.source_shape, `${type} missing source shape`);
  assert(Array.isArray(entry.required_roles) && entry.required_roles.length > 0, `${type} roles missing`);
  assert(entry.responsive.mobile && entry.responsive.tablet && entry.responsive.desktop, `${type} responsive missing`);
  assert.strictEqual(ADV.CONTRACT.a11y.semantic_table_required, true);
  assert.strictEqual(ADV.CONTRACT.a11y.text_summary_required, true);
  assert.strictEqual(ADV.CONTRACT.a11y.interaction_only_evidence_allowed, false);
}

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

const baseQuery = query();
const baseHash = ANALYTICS.analyticsQueryHash(baseQuery);

function spec(type, overrides = {}) {
  const entry = ADV.CONTRACT.chart_registry[type];
  return {
    schema: ADV.SPEC_SCHEMA,
    contract_version: ADV.VERSION,
    id: `viz-${type.toLowerCase().replace(/_/g, '-')}`,
    type,
    title: `Синтетический ${type}`,
    interactions: { filter: entry.supports_filter, drill: entry.supports_drill },
    ...overrides
  };
}

function source(shape, data, overrides = {}) {
  return {
    schema: ADV.SOURCE_SCHEMA,
    contract_version: ADV.VERSION,
    query_hash: baseHash,
    source_contract: 'PRH_ANALYTICS_RESULT_V1@1.0.0',
    shape,
    data,
    ...overrides
  };
}

const DATA = {
  AREA: source('TIME_SERIES', { rows: [
    { x: '2026-01', series: 'family', value: 1000 },
    { x: '2026-02', series: 'family', value: 1200 }
  ] }),
  GROUPED_BAR: source('CATEGORICAL_SERIES', { rows: [
    { category: 'food', series: 'current', value: 600 },
    { category: 'food', series: 'previous', value: 500 },
    { category: 'home', series: 'current', value: 400 },
    { category: 'home', series: 'previous', value: 450 }
  ] }),
  STACKED_BAR: source('CATEGORICAL_SERIES', { rows: [
    { category: 'jan', series: 'food', value: 600 },
    { category: 'jan', series: 'home', value: 400 },
    { category: 'feb', series: 'food', value: 700 },
    { category: 'feb', series: 'home', value: 500 }
  ] }),
  PERCENT_STACKED_BAR: source('CATEGORICAL_SERIES', { rows: [
    { category: 'jan', series: 'a', value: 1 },
    { category: 'jan', series: 'b', value: 2 },
    { category: 'jan', series: 'c', value: 3 },
    { category: 'zero', series: 'a', value: 0 },
    { category: 'zero', series: 'b', value: 0 }
  ] }),
  WATERFALL: source('WATERFALL', { rows: [
    { id: 'start', order: 0, kind: 'START', value: 1000 },
    { id: 'food', order: 1, kind: 'DELTA', value: -300 },
    { id: 'income', order: 2, kind: 'DELTA', value: 500 },
    { id: 'end', order: 3, kind: 'END', value: 1200 }
  ] }, { source_contract: 'PRH_CONTRIBUTION_DECOMPOSITION_V1@1.0.0' }),
  SANKEY: source('SANKEY', { edges: [
    { source: 'income', target: 'account', value: 1000 },
    { source: 'account', target: 'food', value: 600 },
    { source: 'account', target: 'home', value: 400 }
  ] }),
  TREEMAP: source('HIERARCHY', { nodes: [
    { id: 'all', parent_id: null, value: 1000 },
    { id: 'food', parent_id: 'all', value: 600 },
    { id: 'home', parent_id: 'all', value: 400 }
  ] }),
  SUNBURST: source('HIERARCHY', { nodes: [
    { id: 'all', parent_id: null, value: 1000 },
    { id: 'food', parent_id: 'all', value: 600 },
    { id: 'home', parent_id: 'all', value: 400 }
  ] }),
  CALENDAR_HEATMAP: source('CALENDAR_HEATMAP', { rows: [
    { day: '2026-01-01', present: true, value: 0 },
    { day: '2026-01-02', present: false, value: null },
    { day: '2026-01-03', present: true, value: 250 }
  ] }),
  MATRIX_HEATMAP: source('MATRIX_HEATMAP', { rows: [
    { x: 'monday', y: 'food', present: true, value: 100 },
    { x: 'monday', y: 'home', present: false, value: null },
    { x: 'tuesday', y: 'food', present: true, value: 0 }
  ] }),
  PARETO: source('PARETO', { rows: [
    { category: 'a', value: 60 },
    { category: 'b', value: 30 },
    { category: 'c', value: 10 }
  ] }),
  SCATTER: source('XY', { rows: [
    { id: 'p1', x: 1.5, y: 2.25, series: 'synthetic' },
    { id: 'p2', x: 2.5, y: 3.75, series: 'synthetic' }
  ] }),
  BUBBLE: source('XYZ', { rows: [
    { id: 'p1', x: 1.5, y: 2.25, size: 10, series: 'synthetic' },
    { id: 'p2', x: 2.5, y: 3.75, size: 20, series: 'synthetic' }
  ] }),
  HISTOGRAM: source('DISTRIBUTION_SAMPLES', { series: [
    { id: 'synthetic', samples: [4, 1, 3, 2, 5] }
  ] }, { source_contract: 'PRH_DISTRIBUTION_FACTS_V1@1.0.0' }),
  BOX: source('DISTRIBUTION_SAMPLES', { series: [
    { id: 'synthetic', samples: [4, 1, 3, 2, 5] }
  ] }, { source_contract: 'PRH_DISTRIBUTION_FACTS_V1@1.0.0' }),
  VIOLIN: source('DISTRIBUTION_SAMPLES', { series: [
    { id: 'synthetic', samples: [4, 1, 3, 2, 5] }
  ] }, { source_contract: 'PRH_DISTRIBUTION_FACTS_V1@1.0.0' }),
  SMALL_MULTIPLES: source('FACET_SERIES', { rows: [
    { facet: 'food', x: 'jan', series: null, value: 100 },
    { facet: 'food', x: 'feb', series: null, value: 120 },
    { facet: 'home', x: 'jan', series: null, value: 80 },
    { facet: 'home', x: 'feb', series: null, value: 90 }
  ] }),
  BULLET_KPI: source('BULLET_KPI', {
    actual: 900,
    reference: 850,
    target: 1000,
    reference_provenance: 'PRH_PERSONAL_BENCHMARK_RESULT_V1@1.0.0',
    target_provenance: 'PRH_GOAL_PLANNING_V1@1.0.0'
  })
};

const PLANS = {};
for (const type of EXPECTED_TYPES) {
  const plan = ADV.planAdvancedVisualization(spec(type), DATA[type], baseQuery, {
    viewport_width_px: 1440,
    assistive_mode: false,
    renderer: 'ECHARTS_6'
  });
  PLANS[type] = plan;
  assert.strictEqual(plan.schema, ADV.PLAN_SCHEMA);
  assert.strictEqual(plan.chart_type, type);
  assert.strictEqual(plan.query_hash, baseHash);
  assert.strictEqual(plan.query_modified, false);
  assert.strictEqual(plan.financial_truth_policy, 'FIN-TRUTH-v1');
  assert.strictEqual(plan.renderer, 'ECHARTS_6');
  assert.strictEqual(plan.primary_renderer, 'ECHARTS_6');
  assert.strictEqual(plan.renderer_replaceable, true);
  assert.strictEqual(plan.a11y.semantic_table_required, true);
  assert.strictEqual(plan.a11y.text_summary_required, true);
  assert.strictEqual(plan.a11y.interaction_only_evidence_allowed, false);
  assert.match(plan.plan_hash, /^[0-9a-f]{64}$/);
  assert.match(plan.result_shape_hash, /^[0-9a-f]{64}$/);
}

// Assistive mode deterministically switches every family to the built-in semantic table.
for (const type of EXPECTED_TYPES) {
  const plan = ADV.planAdvancedVisualization(spec(type), DATA[type], baseQuery, {
    viewport_width_px: 390,
    assistive_mode: true,
    renderer: 'ECHARTS_6'
  });
  assert.strictEqual(plan.renderer, 'SEMANTIC_TABLE_V1');
  assert.strictEqual(plan.a11y.active_fallback, 'SEMANTIC_TABLE_V1');
  assert.strictEqual(plan.responsive_mode, 'MOBILE');
  assert(plan.responsive_strategy);
}

// VIZ-070 remains canonical and unchanged; advanced planning preserves the same exact query identity.
assert.strictEqual(PLANS.AREA.query_hash, ANALYTICS.analyticsQueryHash(baseQuery));
assert.deepStrictEqual(VIZ070.CHART_TYPES.slice().sort(), ['BAR', 'DONUT', 'LINE']);
assert.strictEqual(VIZ070.rendererCapabilities('ECHARTS_6').loading_policy, 'LOCAL_OR_BUNDLED');
assert.strictEqual(VIZ070.rendererCapabilities('ECHARTS_6').replaceable, true);
assert.strictEqual(VIZ070.rendererCapabilities('ECHARTS_6').financial_truth_authority, false);
assert.strictEqual(VIZ070.rendererCapabilities('ECHARTS_6').query_authority, false);

// Percent stack preserves original amounts and allocates exactly 10,000 bps per positive category.
const percentRows = PLANS.PERCENT_STACKED_BAR.normalized_source.data.rows;
const janRows = percentRows.filter((row) => row.category === 'jan');
assert.strictEqual(janRows.reduce((sum, row) => sum + row.share_bps, 0), 10000);
assert.strictEqual(janRows.reduce((sum, row) => sum + row.value, 0), 6);
assert(janRows.every((row) => row.normalization === 'NORMALIZED_100_PERCENT'));
const zeroRows = percentRows.filter((row) => row.category === 'zero');
assert.strictEqual(zeroRows.reduce((sum, row) => sum + row.share_bps, 0), 0);
assert(zeroRows.every((row) => row.normalization === 'ZERO_TOTAL'));

// Waterfall is exact, not visual guesswork.
assert.strictEqual(PLANS.WATERFALL.normalized_source.data.start, 1000);
assert.strictEqual(PLANS.WATERFALL.normalized_source.data.end, 1200);
expectCode(() => ADV.planAdvancedVisualization(spec('WATERFALL'), source('WATERFALL', { rows: [
  { id: 'start', order: 0, kind: 'START', value: 1000 },
  { id: 'delta', order: 1, kind: 'DELTA', value: -200 },
  { id: 'end', order: 2, kind: 'END', value: 900 }
] }), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_WATERFALL_CONSERVATION_FAILED');

// Sankey topology is deterministic, non-negative and never becomes a causality statement.
assert.deepStrictEqual(PLANS.SANKEY.normalized_source.data.nodes, ['account', 'food', 'home', 'income']);
assert.strictEqual(PLANS.SANKEY.normalized_source.data.causality_claimed, false);
expectCode(() => ADV.planAdvancedVisualization(spec('SANKEY'), source('SANKEY', { edges: [{ source: 'a', target: 'b', value: -1 }] }), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_SANKEY_VALUE_INVALID');
expectCode(() => ADV.planAdvancedVisualization(spec('SANKEY'), source('SANKEY', { edges: [{ source: 'a', target: 'a', value: 1 }] }), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_SANKEY_SELF_EDGE_INVALID');

// Hierarchies reject orphans/cycles/mismatched totals and expose a deterministic root/depth.
assert.strictEqual(PLANS.TREEMAP.normalized_source.data.root_id, 'all');
assert.strictEqual(PLANS.TREEMAP.normalized_source.data.max_depth, 1);
expectCode(() => ADV.planAdvancedVisualization(spec('TREEMAP'), source('HIERARCHY', { nodes: [
  { id: 'all', parent_id: null, value: 100 },
  { id: 'child', parent_id: 'all', value: 90 }
] }), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_HIERARCHY_RECONCILIATION_FAILED');
expectCode(() => ADV.planAdvancedVisualization(spec('TREEMAP'), source('HIERARCHY', { nodes: [
  { id: 'root', parent_id: null, value: 1 },
  { id: 'orphan', parent_id: 'missing', value: 1 }
] }), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_HIERARCHY_ORPHAN');

// Heatmap missing bucket remains distinguishable from an explicit zero.
const calendar = PLANS.CALENDAR_HEATMAP.normalized_source.data.rows;
assert.deepStrictEqual(calendar.find((row) => row.day === '2026-01-01'), { day: '2026-01-01', present: true, value: 0 });
assert.deepStrictEqual(calendar.find((row) => row.day === '2026-01-02'), { day: '2026-01-02', present: false, value: null });
expectCode(() => ADV.planAdvancedVisualization(spec('CALENDAR_HEATMAP'), source('CALENDAR_HEATMAP', { rows: [{ day: '2026-01-01', present: false, value: 0 }] }), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_HEATMAP_MISSING_MUST_BE_NULL');

// Pareto conserves the original total and ends exactly at 100%.
const pareto = PLANS.PARETO.normalized_source.data;
assert.strictEqual(pareto.total, 100);
assert.deepStrictEqual(pareto.rows.map((row) => row.category), ['a', 'b', 'c']);
assert.strictEqual(pareto.rows[pareto.rows.length - 1].cumulative_value, 100);
assert.strictEqual(pareto.rows[pareto.rows.length - 1].cumulative_bps, 10000);

// Scatter/Bubble validate numeric inputs without making correlation/causality claims.
assert.strictEqual(PLANS.SCATTER.normalized_source.data.correlation_claimed, false);
assert.strictEqual(PLANS.SCATTER.normalized_source.data.causality_claimed, false);
assert.strictEqual(PLANS.BUBBLE.normalized_source.data.correlation_claimed, false);
expectCode(() => ADV.planAdvancedVisualization(spec('BUBBLE'), source('XYZ', { rows: [{ id: 'p', x: 1, y: 2, size: -1, series: null }] }), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_BUBBLE_SIZE_INVALID');
expectCode(() => ADV.planAdvancedVisualization(spec('SCATTER'), source('XY', { rows: [{ id: 'p', x: NaN, y: 2, series: null }] }), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_X_INVALID');

// Distribution charts retain explicit sorted samples rather than inventing hidden summaries.
for (const type of ['HISTOGRAM', 'BOX', 'VIOLIN']) {
  assert.strictEqual(PLANS[type].normalized_source.data.source_semantics, 'EXPLICIT_SAMPLES');
  assert.deepStrictEqual(PLANS[type].normalized_source.data.series[0].samples, [1, 2, 3, 4, 5]);
  assert.strictEqual(PLANS[type].normalized_source.data.total_samples, 5);
}

// Small multiples are bounded and never silently drop facets.
assert.deepStrictEqual(PLANS.SMALL_MULTIPLES.normalized_source.data.facets, ['food', 'home']);
assert.strictEqual(PLANS.SMALL_MULTIPLES.normalized_source.data.scale_policy, 'SHARED_COMPATIBLE');
const tooManyFacets = Array.from({ length: ADV.CONTRACT.limits.max_facets + 1 }, (_, index) => ({ facet: `f${index}`, x: 'x', series: null, value: index }));
expectCode(() => ADV.planAdvancedVisualization(spec('SMALL_MULTIPLES'), source('FACET_SERIES', { rows: tooManyFacets }), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_FACET_LIMIT');

// Bullet/KPI requires explicit upstream reference + target provenance.
assert.strictEqual(PLANS.BULLET_KPI.normalized_source.data.reference_provenance, 'PRH_PERSONAL_BENCHMARK_RESULT_V1@1.0.0');
assert.strictEqual(PLANS.BULLET_KPI.normalized_source.data.target_provenance, 'PRH_GOAL_PLANNING_V1@1.0.0');
expectCode(() => ADV.planAdvancedVisualization(spec('BULLET_KPI'), source('BULLET_KPI', {
  actual: 1, reference: 1, target: 2, reference_provenance: 'manual', target_provenance: 'manual'
}), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_SOURCE_CONTRACT_INVALID');

// Query identity is exact; a source from another query cannot be rendered under this query.
const otherQuery = query({ measures: ['INCOME'] });
expectCode(() => ADV.planAdvancedVisualization(spec('AREA'), DATA.AREA, otherQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_QUERY_HASH_MISMATCH');

// Source-shape mismatch cannot be silently coerced to another chart family.
expectCode(() => ADV.planAdvancedVisualization(spec('SANKEY'), DATA.PARETO, baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_SOURCE_CHART_SHAPE_INCOMPATIBLE');

// Stacked charts require an explicit series dimension.
expectCode(() => ADV.planAdvancedVisualization(spec('STACKED_BAR'), source('CATEGORICAL_SERIES', { rows: [{ category: 'a', series: null, value: 1 }] }), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_STACK_REQUIRES_SERIES');
expectCode(() => ADV.planAdvancedVisualization(spec('PERCENT_STACKED_BAR'), source('CATEGORICAL_SERIES', { rows: [{ category: 'a', series: 's', value: -1 }] }), baseQuery, { viewport_width_px: 1280, assistive_mode: false, renderer: 'ECHARTS_6' }), 'VIZ090_PERCENT_STACK_REQUIRES_NON_NEGATIVE_SERIES');

// Input ordering does not affect canonical advanced source/plan identity where order is semantic-by-key.
const reversedGrouped = source('CATEGORICAL_SERIES', { rows: DATA.GROUPED_BAR.data.rows.slice().reverse() });
const groupedReordered = ADV.planAdvancedVisualization(spec('GROUPED_BAR'), reversedGrouped, baseQuery, { viewport_width_px: 1440, assistive_mode: false, renderer: 'ECHARTS_6' });
assert.strictEqual(groupedReordered.result_shape_hash, PLANS.GROUPED_BAR.result_shape_hash);
assert.strictEqual(groupedReordered.plan_hash, PLANS.GROUPED_BAR.plan_hash);

// Arbitrary renderer options / executable payloads fail closed.
expectCode(() => ADV.normalizeSpec({ ...spec('AREA'), echarts_options: { animation: true } }), 'VIZ090_HOSTILE_KEY_FORBIDDEN');
expectCode(() => ADV.assertNoHostilePayload({ formatter: 'x => x' }), 'VIZ090_HOSTILE_KEY_FORBIDDEN');
expectCode(() => ADV.assertNoHostilePayload({ label: '<script>alert(1)</script>' }), 'VIZ090_HOSTILE_STRING_FORBIDDEN');
expectCode(() => ADV.assertNoHostilePayload({ label: 'https://example.invalid' }), 'VIZ090_HOSTILE_STRING_FORBIDDEN');

// Unsupported interactions fail closed instead of creating fake semantics.
expectCode(() => ADV.normalizeSpec({ ...spec('HISTOGRAM'), interactions: { filter: true, drill: false } }), 'VIZ090_FILTER_UNSUPPORTED');
expectCode(() => ADV.normalizeSpec({ ...spec('HISTOGRAM'), interactions: { filter: false, drill: true } }), 'VIZ090_DRILL_UNSUPPORTED');

// Telemetry is value/private-label free and fixed-shape.
const telemetry = ADV.telemetry(PLANS.GROUPED_BAR);
assert.deepStrictEqual(Object.keys(telemetry).sort(), ADV.CONTRACT.telemetry_allowlist.slice().sort());
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['food', 'home', 'current', 'previous', '600', '450']) assert(!telemetryText.includes(forbidden), `telemetry leak: ${forbidden}`);

// Pure visualization layer has no finance/domain/storage/network dependency and no arbitrary ECharts option passthrough.
const sourceText = fs.readFileSync(path.join(__dirname, '..', 'lib/visualization/advanced_visualization_pack.js'), 'utf8');
for (const forbidden of ["require('../finance", "require('../domain", 'SpreadsheetApp', 'UrlFetchApp', 'PropertiesService', 'fetch(', 'eval(', 'new Function(']) {
  assert(!sourceText.includes(forbidden), `advanced visualization gained forbidden authority: ${forbidden}`);
}

console.log('advanced_visualization_pack_contract_test: OK', {
  contract: `${ADV.SCHEMA}@${ADV.VERSION}`,
  charts: ADV.CHART_TYPES.length,
  baseLineStillVIZ070: true,
  queryHashPrefix: baseHash.slice(0, 12),
  semanticTableFallback: true,
  financialWrite: false,
  freeOnly: true
});
