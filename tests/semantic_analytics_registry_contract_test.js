'use strict';

const assert = require('assert');

const analyticsContract = require('../lib/analytics/analytics_contract.v1.json');
const registry = require('../lib/analytics/semantic_registry.v1.json');
const kpi = require('../lib/finance/kpi_dictionary.v1.json');
const canonical = require('../lib/domain/canonical_transaction.v1.schema.json');
const semantic = require('../lib/analytics/semantic_registry');

function sorted(value) {
  return Array.from(value).slice().sort();
}

function select(measureId, aggregation, dimensions = [], grain = 'NONE') {
  return semantic.validateSemanticSelection({
    measures: [{ id: measureId, aggregation }],
    dimensions,
    grain
  });
}

assert.strictEqual(semantic.assertRegistryContract(), true);
assert.strictEqual(registry.schema, 'PRH_ANALYTICS_SEMANTIC_REGISTRY_V1');
assert.strictEqual(registry.version, '1.0.0');
assert.strictEqual(registry.roadmap_id, 'ANL-070');
assert.strictEqual(registry.upstream.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(registry.semantics.registry_redefines_kpi_formulas, false);
assert.strictEqual(registry.semantics.analytics_query_remains_execution_contract, true);
assert.strictEqual(registry.semantics.renderer_neutral, true);
assert.strictEqual(registry.semantics.storage_neutral, true);
assert.strictEqual(registry.semantics.financial_values_embedded, false);
assert.ok(Object.values(registry.authorities).every((value) => value === false));

const registryMeasures = Object.keys(registry.measures);
assert.deepStrictEqual(sorted(registryMeasures), sorted(analyticsContract.measures));
assert.deepStrictEqual(sorted(registryMeasures), sorted(Object.keys(kpi.kpis)));

for (const measureId of registryMeasures) {
  const measure = registry.measures[measureId];
  assert.strictEqual(measure.kpi_authority, measureId);
  assert.strictEqual(measure.output, kpi.kpis[measureId].output);
  assert.strictEqual(measure.value_type, 'MONEY_MINOR');
  assert.strictEqual(measure.format, 'QUERY_CURRENCY_MINOR');
  assert.ok(measure.allowed_aggregations.length > 0);
  assert.ok(measure.supported_grains.every((grain) => analyticsContract.time.grains.includes(grain)));
  assert.ok(measure.supported_dimensions.every((id) => analyticsContract.dimensions.includes(id)));
}

const queryDimensions = Object.keys(registry.dimensions).filter((id) =>
  analyticsContract.dimensions.includes(id) && registry.dimensions[id].groupable
);
assert.deepStrictEqual(sorted(queryDimensions), sorted(analyticsContract.dimensions));

const filterDimensions = Object.keys(registry.dimensions).filter((id) => registry.dimensions[id].filterable);
assert.deepStrictEqual(sorted(filterDimensions), sorted(analyticsContract.filters.fields));

for (const dimension of Object.values(registry.dimensions)) {
  assert.ok(canonical.properties[dimension.canonical_field], dimension.canonical_field);
}
assert.deepStrictEqual(registry.hierarchies.TIME.levels, ['YEAR', 'MONTH', 'DAY']);
assert.deepStrictEqual(registry.hierarchies.TIME.drill_down_transitions, [['YEAR', 'MONTH'], ['MONTH', 'DAY']]);

const additiveMeasures = registryMeasures.filter((id) => id !== 'BUDGET_VARIANCE');
for (const measureId of additiveMeasures) {
  for (const dimensionId of analyticsContract.dimensions) {
    const result = select(measureId, 'SUM', [dimensionId], 'NONE');
    assert.strictEqual(result.decision, 'ALLOW', `${measureId}/${dimensionId}: ${result.reason}`);
  }
  for (const grain of analyticsContract.time.grains) {
    const result = select(measureId, 'SUM', [], grain);
    assert.strictEqual(result.decision, 'ALLOW', `${measureId}/${grain}: ${result.reason}`);
  }
}

const budgetOk = select('BUDGET_VARIANCE', 'SCALAR_KPI', [], 'NONE');
assert.strictEqual(budgetOk.decision, 'ALLOW');
assert.strictEqual(select('BUDGET_VARIANCE', 'SUM', [], 'NONE').reason, 'SEMANTIC_AGGREGATION_UNSUPPORTED');
assert.strictEqual(select('BUDGET_VARIANCE', 'SCALAR_KPI', ['category_id'], 'NONE').reason, 'SEMANTIC_MEASURE_DIMENSION_UNSUPPORTED');
assert.strictEqual(select('BUDGET_VARIANCE', 'SCALAR_KPI', [], 'MONTH').reason, 'SEMANTIC_MEASURE_GRAIN_UNSUPPORTED');

assert.strictEqual(select('UNKNOWN', 'SUM').reason, 'SEMANTIC_MEASURE_UNKNOWN');
assert.strictEqual(select('INCOME', 'UNKNOWN').reason, 'SEMANTIC_AGGREGATION_UNKNOWN');
assert.strictEqual(
  semantic.validateSemanticSelection({ measures: [{ id: 'INCOME', aggregation: 'SUM' }], dimensions: ['status'], grain: 'NONE' }).reason,
  'SEMANTIC_DIMENSION_NOT_GROUPABLE'
);
assert.strictEqual(
  semantic.validateSemanticSelection({ measures: [{ id: 'INCOME', aggregation: 'SUM' }], dimensions: ['time_bucket'], grain: 'NONE' }).reason,
  'SEMANTIC_DIMENSION_NOT_GROUPABLE'
);
assert.strictEqual(
  semantic.validateSemanticSelection({ measures: [{ id: 'INCOME', aggregation: 'SUM' }], dimensions: ['unknown'], grain: 'NONE' }).reason,
  'SEMANTIC_DIMENSION_UNKNOWN'
);
assert.strictEqual(
  semantic.validateSemanticSelection({ measures: [{ id: 'INCOME', aggregation: 'SUM' }, { id: 'INCOME', aggregation: 'SUM' }], dimensions: [], grain: 'NONE' }).reason,
  'SEMANTIC_MEASURE_DUPLICATE'
);
assert.strictEqual(
  semantic.validateSemanticSelection({ measures: [{ id: 'INCOME', aggregation: 'SUM' }], dimensions: ['account_id', 'account_id'], grain: 'NONE' }).reason,
  'SEMANTIC_DIMENSION_DUPLICATE'
);
assert.strictEqual(
  semantic.validateSemanticSelection({ measures: [{ id: 'INCOME', aggregation: 'SUM' }], dimensions: ['account_id', 'category_id', 'member_id', 'project_id'], grain: 'NONE' }).reason,
  'SEMANTIC_MAX_DIMENSIONS_EXCEEDED'
);
assert.strictEqual(select('INCOME', 'SUM', [], 'WEEK').reason, 'SEMANTIC_GRAIN_UNKNOWN');

assert.strictEqual(semantic.validateHierarchyTransition({ hierarchy_id: 'TIME', from_level: 'YEAR', to_level: 'MONTH' }).decision, 'ALLOW');
assert.strictEqual(semantic.validateHierarchyTransition({ hierarchy_id: 'TIME', from_level: 'MONTH', to_level: 'DAY' }).decision, 'ALLOW');
assert.strictEqual(semantic.validateHierarchyTransition({ hierarchy_id: 'TIME', from_level: 'YEAR', to_level: 'DAY' }).reason, 'SEMANTIC_HIERARCHY_TRANSITION_INVALID');
assert.strictEqual(semantic.validateHierarchyTransition({ hierarchy_id: 'TIME', from_level: 'DAY', to_level: 'MONTH' }).reason, 'SEMANTIC_HIERARCHY_TRANSITION_INVALID');
assert.strictEqual(semantic.validateHierarchyTransition({ hierarchy_id: 'TIME', from_level: 'QUARTER', to_level: 'MONTH' }).reason, 'SEMANTIC_HIERARCHY_LEVEL_UNKNOWN');
assert.strictEqual(semantic.validateHierarchyTransition({ hierarchy_id: 'UNKNOWN', from_level: 'YEAR', to_level: 'MONTH' }).reason, 'SEMANTIC_HIERARCHY_UNKNOWN');

const telemetry = semantic.semanticTelemetry(semantic.validateSemanticSelection({
  measures: [{ id: 'INCOME', aggregation: 'SUM' }, { id: 'EXPENSE', aggregation: 'SUM' }],
  dimensions: ['category_id'],
  grain: 'MONTH'
}));
assert.deepStrictEqual(Object.keys(telemetry).sort(), [
  'aggregation_ids', 'decision', 'dimension_count', 'dimension_ids', 'grain', 'measure_count',
  'measure_ids', 'reason', 'schema', 'version'
].sort());
assert.strictEqual(telemetry.decision, 'ALLOW');
const telemetryText = JSON.stringify(telemetry).toLowerCase();
for (const forbidden of ['prompt', 'response', 'description', 'counterparty', 'amount_minor', 'budget_minor', 'transaction_id', 'account_email', 'token']) {
  assert.strictEqual(telemetryText.includes(forbidden), false, forbidden);
}

console.log('semantic-analytics-registry: PASS', {
  schema: registry.schema,
  version: registry.version,
  measures: registryMeasures.length,
  queryDimensions: queryDimensions.length,
  filterDimensions: filterDimensions.length,
  hierarchies: Object.keys(registry.hierarchies).length,
  rendererNeutral: registry.semantics.renderer_neutral,
  financialWrite: registry.authorities.financial_write,
  freeOnly: registry.semantics.free_only
});
