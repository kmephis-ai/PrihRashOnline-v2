'use strict';

const REGISTRY = require('./semantic_registry.v1.json');
const ANALYTICS = require('./analytics_contract.v1.json');
const KPI = require('../finance/kpi_dictionary.v1.json');
const CANONICAL = require('../domain/canonical_transaction.v1.schema.json');

const SCHEMA = 'PRH_ANALYTICS_SEMANTIC_REGISTRY_V1';
const VERSION = '1.0.0';
const GRAINS = Object.freeze(ANALYTICS.time.grains.slice());
const AGGREGATIONS = Object.freeze(Object.keys(REGISTRY.aggregations));
const QUERY_DIMENSIONS = Object.freeze(ANALYTICS.dimensions.slice());

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function setEqual(left, right) {
  const a = Array.from(left).slice().sort();
  const b = Array.from(right).slice().sort();
  return JSON.stringify(a) === JSON.stringify(b);
}

function exactObject(value, keys) {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key));
}

function safeId(value) {
  const text = String(value == null ? '' : value).trim();
  return text.length > 80 ? text.slice(0, 80) : text;
}

function decision(allowed, reason, details) {
  return Object.freeze(Object.assign({
    schema: SCHEMA,
    version: VERSION,
    decision: allowed ? 'ALLOW' : 'DENY',
    reason
  }, details || {}));
}

function assertRegistryContract() {
  if (!REGISTRY || REGISTRY.schema !== SCHEMA || REGISTRY.version !== VERSION || REGISTRY.roadmap_id !== 'ANL-070') {
    fail('SEMANTIC_REGISTRY_VERSION_INVALID');
  }
  if (!REGISTRY.upstream ||
      REGISTRY.upstream.analytics_contract !== 'PRH_ANALYTICS_CONTRACT_V1@1.0.0' ||
      REGISTRY.upstream.canonical_transaction !== 'PRH_CANONICAL_TRANSACTION_V1' ||
      REGISTRY.upstream.kpi_dictionary !== 'PRH_KPI_DICTIONARY_V1@1.0.0' ||
      REGISTRY.upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('SEMANTIC_REGISTRY_UPSTREAM_INVALID');
  }
  if (!REGISTRY.semantics || REGISTRY.semantics.registry_redefines_kpi_formulas !== false ||
      REGISTRY.semantics.analytics_query_remains_execution_contract !== true ||
      REGISTRY.semantics.renderer_neutral !== true || REGISTRY.semantics.storage_neutral !== true ||
      REGISTRY.semantics.financial_values_embedded !== false || REGISTRY.semantics.free_only !== true) {
    fail('SEMANTIC_REGISTRY_BOUNDARY_INVALID');
  }
  if (!REGISTRY.authorities || Object.values(REGISTRY.authorities).some((value) => value !== false)) {
    fail('SEMANTIC_REGISTRY_AUTHORITY_INVALID');
  }

  const registryMeasures = Object.keys(REGISTRY.measures);
  const kpiMeasures = Object.keys(KPI.kpis);
  if (!setEqual(registryMeasures, ANALYTICS.measures) || !setEqual(registryMeasures, kpiMeasures)) {
    fail('SEMANTIC_REGISTRY_MEASURE_SET_MISMATCH');
  }

  for (const measureId of registryMeasures) {
    const measure = REGISTRY.measures[measureId];
    const kpi = KPI.kpis[measureId];
    if (measure.kpi_authority !== measureId || measure.output !== kpi.output ||
        measure.value_type !== 'MONEY_MINOR' || measure.format !== 'QUERY_CURRENCY_MINOR') {
      fail('SEMANTIC_REGISTRY_MEASURE_AUTHORITY_INVALID');
    }
    if (!Array.isArray(measure.allowed_aggregations) || measure.allowed_aggregations.length < 1 ||
        measure.allowed_aggregations.some((id) => !AGGREGATIONS.includes(id))) {
      fail('SEMANTIC_REGISTRY_AGGREGATION_REFERENCE_INVALID');
    }
    if (!Array.isArray(measure.supported_dimensions) ||
        measure.supported_dimensions.some((id) => !QUERY_DIMENSIONS.includes(id))) {
      fail('SEMANTIC_REGISTRY_MEASURE_DIMENSION_REFERENCE_INVALID');
    }
    if (!Array.isArray(measure.supported_grains) || measure.supported_grains.some((grain) => !GRAINS.includes(grain))) {
      fail('SEMANTIC_REGISTRY_MEASURE_GRAIN_REFERENCE_INVALID');
    }
  }

  const dimensions = REGISTRY.dimensions;
  const groupableQueryDimensions = Object.keys(dimensions).filter((id) =>
    QUERY_DIMENSIONS.includes(id) && dimensions[id].groupable === true
  );
  if (!setEqual(groupableQueryDimensions, QUERY_DIMENSIONS)) fail('SEMANTIC_REGISTRY_DIMENSION_SET_MISMATCH');

  const filterableDimensions = Object.keys(dimensions).filter((id) => dimensions[id].filterable === true);
  if (!setEqual(filterableDimensions, ANALYTICS.filters.fields)) fail('SEMANTIC_REGISTRY_FILTER_SET_MISMATCH');

  for (const [dimensionId, dimension] of Object.entries(dimensions)) {
    if (!CANONICAL.properties[dimension.canonical_field]) fail('SEMANTIC_REGISTRY_CANONICAL_FIELD_MISSING');
    if (dimensionId === 'time_bucket') {
      if (dimension.source !== 'DERIVED_FROM_CANONICAL_FIELD' || dimension.canonical_field !== 'occurred_at' ||
          !setEqual(dimension.supported_grains || [], ['DAY', 'MONTH', 'YEAR'])) {
        fail('SEMANTIC_REGISTRY_TIME_DIMENSION_INVALID');
      }
    }
  }

  const budget = REGISTRY.measures.BUDGET_VARIANCE;
  if (budget.grouping_policy !== 'UNGROUPED_ONLY' || budget.additive !== false ||
      !setEqual(budget.allowed_aggregations, ['SCALAR_KPI']) || budget.supported_dimensions.length !== 0 ||
      !setEqual(budget.supported_grains, ['NONE']) || !setEqual(budget.requires_parameters, ['budget_minor'])) {
    fail('SEMANTIC_REGISTRY_BUDGET_VARIANCE_INVALID');
  }

  const timeHierarchy = REGISTRY.hierarchies.TIME;
  if (!timeHierarchy || timeHierarchy.dimension !== 'time_bucket' ||
      !setEqual(timeHierarchy.levels, ['YEAR', 'MONTH', 'DAY'])) {
    fail('SEMANTIC_REGISTRY_TIME_HIERARCHY_INVALID');
  }

  return true;
}

function validateSemanticSelection(input) {
  assertRegistryContract();
  if (!exactObject(input, ['measures', 'dimensions', 'grain'])) {
    return decision(false, 'SEMANTIC_SELECTION_SHAPE_INVALID');
  }
  if (!Array.isArray(input.measures) || input.measures.length < 1 || input.measures.length > REGISTRY.limits.max_measures) {
    return decision(false, 'SEMANTIC_MEASURES_INVALID');
  }

  const measures = [];
  for (const raw of input.measures) {
    if (!exactObject(raw, ['id', 'aggregation'])) return decision(false, 'SEMANTIC_MEASURE_SHAPE_INVALID');
    const id = safeId(raw.id);
    const aggregation = safeId(raw.aggregation);
    if (!REGISTRY.measures[id]) {
      return decision(false, 'SEMANTIC_MEASURE_UNKNOWN', { measure_ids: Object.freeze([id]), measure_count: 1 });
    }
    if (!AGGREGATIONS.includes(aggregation)) {
      return decision(false, 'SEMANTIC_AGGREGATION_UNKNOWN', {
        measure_ids: Object.freeze([id]), aggregation_ids: Object.freeze([aggregation]), measure_count: 1
      });
    }
    if (!REGISTRY.measures[id].allowed_aggregations.includes(aggregation)) {
      return decision(false, 'SEMANTIC_AGGREGATION_UNSUPPORTED', {
        measure_ids: Object.freeze([id]), aggregation_ids: Object.freeze([aggregation]), measure_count: 1
      });
    }
    measures.push(Object.freeze({ id, aggregation }));
  }
  const measureIds = measures.map((item) => item.id);
  if (new Set(measureIds).size !== measureIds.length) {
    return decision(false, 'SEMANTIC_MEASURE_DUPLICATE', {
      measure_ids: Object.freeze(measureIds), aggregation_ids: Object.freeze(measures.map((item) => item.aggregation)),
      measure_count: measureIds.length
    });
  }

  const dimensions = input.dimensions == null ? [] : input.dimensions;
  if (!Array.isArray(dimensions)) return decision(false, 'SEMANTIC_DIMENSIONS_INVALID');
  if (dimensions.length > REGISTRY.limits.max_dimensions) {
    return decision(false, 'SEMANTIC_MAX_DIMENSIONS_EXCEEDED', { dimension_count: dimensions.length });
  }
  const dimensionIds = dimensions.map(safeId);
  if (new Set(dimensionIds).size !== dimensionIds.length) {
    return decision(false, 'SEMANTIC_DIMENSION_DUPLICATE', {
      dimension_ids: Object.freeze(dimensionIds), dimension_count: dimensionIds.length
    });
  }
  for (const id of dimensionIds) {
    const dimension = REGISTRY.dimensions[id];
    if (!dimension) {
      return decision(false, 'SEMANTIC_DIMENSION_UNKNOWN', { dimension_ids: Object.freeze([id]), dimension_count: 1 });
    }
    if (!QUERY_DIMENSIONS.includes(id) || dimension.groupable !== true) {
      return decision(false, 'SEMANTIC_DIMENSION_NOT_GROUPABLE', { dimension_ids: Object.freeze([id]), dimension_count: 1 });
    }
  }

  const grain = safeId(input.grain == null ? 'NONE' : input.grain);
  if (!GRAINS.includes(grain)) return decision(false, 'SEMANTIC_GRAIN_UNKNOWN', { grain });

  for (const item of measures) {
    const measure = REGISTRY.measures[item.id];
    const unsupportedDimension = dimensionIds.find((id) => !measure.supported_dimensions.includes(id));
    if (unsupportedDimension) {
      return decision(false, 'SEMANTIC_MEASURE_DIMENSION_UNSUPPORTED', {
        measure_ids: Object.freeze([item.id]), aggregation_ids: Object.freeze([item.aggregation]),
        dimension_ids: Object.freeze([unsupportedDimension]), grain, measure_count: 1, dimension_count: 1
      });
    }
    if (!measure.supported_grains.includes(grain)) {
      return decision(false, 'SEMANTIC_MEASURE_GRAIN_UNSUPPORTED', {
        measure_ids: Object.freeze([item.id]), aggregation_ids: Object.freeze([item.aggregation]),
        dimension_ids: Object.freeze(dimensionIds), grain, measure_count: 1, dimension_count: dimensionIds.length
      });
    }
  }

  return decision(true, 'OK', {
    measure_ids: Object.freeze(measureIds),
    aggregation_ids: Object.freeze(measures.map((item) => item.aggregation)),
    dimension_ids: Object.freeze(dimensionIds),
    grain,
    measure_count: measureIds.length,
    dimension_count: dimensionIds.length
  });
}

function validateHierarchyTransition(input) {
  assertRegistryContract();
  if (!exactObject(input, ['hierarchy_id', 'from_level', 'to_level'])) {
    return decision(false, 'SEMANTIC_HIERARCHY_SHAPE_INVALID');
  }
  const hierarchyId = safeId(input.hierarchy_id);
  const fromLevel = safeId(input.from_level);
  const toLevel = safeId(input.to_level);
  const hierarchy = REGISTRY.hierarchies[hierarchyId];
  const details = { hierarchy_id: hierarchyId, from_level: fromLevel, to_level: toLevel };
  if (!hierarchy) return decision(false, 'SEMANTIC_HIERARCHY_UNKNOWN', details);
  if (!hierarchy.levels.includes(fromLevel) || !hierarchy.levels.includes(toLevel)) {
    return decision(false, 'SEMANTIC_HIERARCHY_LEVEL_UNKNOWN', details);
  }
  const allowed = hierarchy.drill_down_transitions.some(([from, to]) => from === fromLevel && to === toLevel);
  return decision(allowed, allowed ? 'OK' : 'SEMANTIC_HIERARCHY_TRANSITION_INVALID', details);
}

function semanticTelemetry(result) {
  const output = {};
  for (const key of REGISTRY.telemetry_allowlist) {
    if (Object.prototype.hasOwnProperty.call(result, key)) output[key] = result[key];
  }
  output.schema = SCHEMA;
  output.version = VERSION;
  return Object.freeze(output);
}

module.exports = Object.freeze({
  SCHEMA,
  VERSION,
  REGISTRY,
  assertRegistryContract,
  validateSemanticSelection,
  validateHierarchyTransition,
  semanticTelemetry
});
