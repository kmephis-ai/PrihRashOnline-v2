'use strict';

const assert = require('assert');
const FACTORY = require('../lib/dashboard/widget_factory');
const ANALYTICS = require('../lib/analytics/analytics_engine');
const COMPOSER = require('../lib/dashboard/dashboard_composer');
const VIZ = require('../lib/visualization/visualization_foundation');
const PIVOT = require('../lib/analytics/pivot_olap');

FACTORY.assertContract();
assert.strictEqual(FACTORY.CONTRACT.schema, 'PRH_WIDGET_FACTORY_V1');
assert.strictEqual(FACTORY.CONTRACT.version, '1.0.0');
assert.strictEqual(FACTORY.CONTRACT.roadmap_id, 'DASH-081');
assert.deepStrictEqual(FACTORY.KINDS.slice().sort(), ['CARD', 'CHART', 'KPI', 'PIVOT', 'TABLE']);
assert(Object.values(FACTORY.CONTRACT.authority).every((value) => value === false));
assert.strictEqual(FACTORY.CONTRACT.principles.configuration_only, true);
assert.strictEqual(FACTORY.CONTRACT.principles.query_mutation_allowed, false);
assert.strictEqual(FACTORY.CONTRACT.principles.financial_formula_allowed, false);
assert.strictEqual(FACTORY.CONTRACT.principles.financial_result_in_binding_allowed, false);
assert.strictEqual(FACTORY.CONTRACT.principles.public_financial_evidence, 'SYNTHETIC_ONLY');
assert.strictEqual(FACTORY.CONTRACT.principles.free_only, true);

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

function valuePresentation(title) {
  return {
    schema: FACTORY.VALUE_PRESENTATION_SCHEMA,
    contract_version: FACTORY.VERSION,
    title,
    show_comparison: false
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error && error.code === code, `expected ${code}`);
}

const kpi = FACTORY.normalizeBinding(binding('w-0001', 'KPI', baseQuery(), valuePresentation('Расходы')));
assert.strictEqual(kpi.kind, 'KPI');
assert.strictEqual(kpi.query_modified, false);
assert.strictEqual(kpi.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(kpi.query_hash, ANALYTICS.analyticsQueryHash(baseQuery()));
assert.match(kpi.binding_hash, /^[0-9a-f]{64}$/);
assert(Object.isFrozen(kpi));

const card = FACTORY.normalizeBinding(binding('w-0002', 'CARD', baseQuery({ measures: ['INCOME'] }), valuePresentation('Доходы')));
assert.strictEqual(card.kind, 'CARD');
assert.strictEqual(card.presentation.mode, 'CARD');

const chartQuery = baseQuery({ dimensions: ['category_id'] });
const chartSpec = {
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
const chart = FACTORY.normalizeBinding(binding('w-0003', 'CHART', chartQuery, chartSpec));
assert.strictEqual(chart.kind, 'CHART');
assert.strictEqual(chart.presentation.type, 'DONUT');
assert.strictEqual(chart.query_hash, ANALYTICS.analyticsQueryHash(chartQuery));

const tableQuery = baseQuery({ measures: ['EXPENSE', 'INCOME'], dimensions: ['category_id'] });
const tablePresentation = {
  schema: FACTORY.TABLE_PRESENTATION_SCHEMA,
  contract_version: FACTORY.VERSION,
  title: 'Категории',
  columns: [
    { kind: 'DIMENSION', id: 'category_id' },
    { kind: 'MEASURE', id: 'EXPENSE' },
    { kind: 'MEASURE', id: 'INCOME' }
  ]
};
const table = FACTORY.normalizeBinding(binding('w-0004', 'TABLE', tableQuery, tablePresentation));
assert.strictEqual(table.kind, 'TABLE');
assert.deepStrictEqual(table.presentation.columns.map((item) => item.id), ['category_id', 'EXPENSE', 'INCOME']);

const pivotQuery = baseQuery({
  dimensions: ['category_id'],
  time_range: { start: '2026-01-01', end: '2026-07-01' },
  grain: 'MONTH'
});
const pivotSpec = {
  schema: PIVOT.SPEC_SCHEMA,
  contract_version: PIVOT.VERSION,
  rows: [{ dimension_id: 'category_id', hierarchy_id: null, level: null }],
  columns: [{ dimension_id: 'time_bucket', hierarchy_id: 'TIME', level: 'MONTH' }],
  measures: [{ id: 'EXPENSE', aggregation: 'SUM' }],
  subtotals: { rows: true, columns: false },
  grand_total: true,
  sort: null,
  top_n: null
};
const pivot = FACTORY.normalizeBinding(binding('w-0005', 'PIVOT', pivotQuery, pivotSpec));
assert.strictEqual(pivot.kind, 'PIVOT');
assert.strictEqual(pivot.presentation.schema, PIVOT.SPEC_SCHEMA);
assert.strictEqual(pivot.presentation.columns[0].level, 'MONTH');

// Object serialization order must not affect canonical binding identity.
const reorderedChartBinding = {
  presentation: chartSpec,
  query: chartQuery,
  kind: 'CHART',
  widget_id: 'w-0003',
  contract_version: FACTORY.VERSION,
  schema: FACTORY.BINDING_SCHEMA
};
assert.strictEqual(FACTORY.normalizeBinding(reorderedChartBinding).binding_hash, chart.binding_hash);

// Explicit binding upgrades only semantic descriptor; DASH-080 geometry remains external and unchanged.
const placeholder = {
  schema: COMPOSER.WIDGET_SCHEMA,
  id: 'w-0003',
  title: 'Расходы по категориям',
  semantic_binding_status: 'UNBOUND',
  geometry: { x: 4, y: 2, w: 4, h: 2 }
};
const beforeGeometry = JSON.stringify(placeholder.geometry);
const bound = FACTORY.bindPlaceholder(placeholder, binding('w-0003', 'CHART', chartQuery, chartSpec));
assert.strictEqual(bound.schema, FACTORY.BOUND_DESCRIPTOR_SCHEMA);
assert.strictEqual(bound.semantic_binding_status, 'BOUND');
assert.strictEqual(bound.geometry_mutation, false);
assert.strictEqual(bound.layout_identity_authority, false);
assert.strictEqual(JSON.stringify(placeholder.geometry), beforeGeometry);
assert(!Object.prototype.hasOwnProperty.call(bound, 'geometry'));
assert.strictEqual(bound.binding.widget_id, placeholder.id);

// Broken bindings are fail-closed and have stable explainable reason codes.
expectCode(
  () => FACTORY.normalizeBinding(binding('w-0006', 'KPI', baseQuery({ dimensions: ['category_id'] }), valuePresentation('Ошибка'))),
  'DASH081_VALUE_QUERY_MUST_BE_SINGLE_MEASURE_UNGROUPED'
);
expectCode(
  () => FACTORY.normalizeBinding(binding('w-0007', 'CHART', baseQuery({ dimensions: ['account_id'] }), chartSpec)),
  'VIZ070_QUERY_DIMENSION_COVERAGE_MISMATCH'
);
expectCode(
  () => FACTORY.normalizeBinding(binding('w-0008', 'TABLE', tableQuery, {
    ...tablePresentation,
    columns: [{ kind: 'MEASURE', id: 'EXPENSE' }]
  })),
  'DASH081_TABLE_QUERY_FIELD_COVERAGE_MISMATCH'
);
expectCode(
  () => FACTORY.normalizeBinding(binding('w-0009', 'PIVOT', baseQuery({ dimensions: ['category_id'] }), pivotSpec)),
  'DASH081_PIVOT_QUERY_DIMENSION_MISMATCH'
);
expectCode(
  () => FACTORY.bindPlaceholder({ ...placeholder, semantic_binding_status: 'BOUND' }, binding('w-0003', 'CHART', chartQuery, chartSpec)),
  'DASH081_PLACEHOLDER_NOT_UNBOUND'
);
expectCode(
  () => FACTORY.bindPlaceholder(placeholder, binding('w-0042', 'CHART', chartQuery, chartSpec)),
  'DASH081_PLACEHOLDER_BINDING_ID_MISMATCH'
);
expectCode(
  () => FACTORY.normalizeBinding({ ...binding('w-0010', 'KPI', baseQuery(), valuePresentation('Нет payload')), transactions: [] }),
  'DASH081_FINANCIAL_RESULT_PAYLOAD_FORBIDDEN'
);
expectCode(
  () => FACTORY.normalizeBinding({
    ...binding('w-0011', 'KPI', baseQuery(), valuePresentation('Нет суммы')),
    presentation: { ...valuePresentation('Нет суммы'), amount_minor: 12345 }
  }),
  'DASH081_FINANCIAL_RESULT_PAYLOAD_FORBIDDEN'
);

const invalid = FACTORY.validateBinding(binding('w-0012', 'KPI', baseQuery({ grain: 'MONTH' }), valuePresentation('Ошибка')));
assert.strictEqual(invalid.status, 'INVALID');
assert.strictEqual(invalid.reason, 'ANALYTICS_GRAIN_REQUIRES_TIME_RANGE');
assert.strictEqual(invalid.query_hash, null);
assert.strictEqual(invalid.binding_hash, null);

for (const kind of FACTORY.KINDS) {
  const registry = FACTORY.registryEntry(kind);
  assert.strictEqual(registry.kind, kind);
  assert(Object.values(registry.authorities).every((value) => value === false));
}

const telemetry = FACTORY.telemetry(chart);
assert.deepStrictEqual(Object.keys(telemetry).sort(), FACTORY.CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.widget_kind, 'CHART');
assert.strictEqual(telemetry.query_hash_prefix, chart.query_hash.slice(0, 12));
assert.strictEqual(telemetry.binding_hash_prefix, chart.binding_hash.slice(0, 12));
const telemetryText = JSON.stringify(telemetry);
assert(!telemetryText.includes('category_id'));
assert(!telemetryText.includes('RUB'));
assert(!telemetryText.includes('EXPENSE'));
assert(!telemetryText.includes('filters'));
assert(!telemetryText.includes('amount'));

assert.strictEqual(FACTORY.assertNoFinancialResultPayload({
  query: baseQuery({ filters: [{ field: 'category_id', operator: 'EQ', values: ['synthetic-food'] }] })
}), true);

console.log('widget_factory_semantic_bindings_contract_test: OK', {
  contract: `${FACTORY.SCHEMA}@${FACTORY.VERSION}`,
  kinds: FACTORY.KINDS,
  explicitBindOnly: true,
  queryMutation: false,
  financialFormulaAuthority: false,
  financialWriteAuthority: false,
  publicEvidence: 'SYNTHETIC_ONLY',
  freeOnly: true
});
