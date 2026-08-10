'use strict';

const crypto = require('crypto');
const CONTRACT = require('./visualization_foundation.v1.json');
const ANALYTICS = require('../analytics/analytics_contract.v1.json');
const DESIGN = require('../design/design_system.v1.json');

const FOUNDATION_SCHEMA = 'PRH_VISUALIZATION_FOUNDATION_V1';
const VERSION = '1.0.0';
const CHART_SPEC_SCHEMA = 'PRH_CHART_SPEC_V1';
const WIDGET_SPEC_SCHEMA = 'PRH_WIDGET_SPEC_V1';
const FILTER_CONTEXT_SCHEMA = 'PRH_FILTER_CONTEXT_V1';
const DRILL_CONTEXT_SCHEMA = 'PRH_DRILL_CONTEXT_V1';
const RENDER_DATASET_SCHEMA = 'PRH_VISUALIZATION_RENDER_DATASET_V1';
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PAYLOAD_KEYS = new Set([
  'data', 'dataset', 'rows', 'points', 'transactions', 'records', 'result', 'results',
  'amount', 'amount_minor', 'income_minor', 'expense_minor', 'cash_flow_minor',
  'savings_minor', 'budget_variance_minor', 'gross_expense_minor', 'refund_minor', 'transfer_minor'
]);
const CHART_REGISTRY = Object.freeze(Object.fromEntries(CONTRACT.chart_registry.map((item) => [item.id, Object.freeze({ ...item })])));
const DIMENSIONS = Object.freeze(CONTRACT.encoding_registry.dimension_ids.slice());
const MEASURES = Object.freeze(CONTRACT.encoding_registry.measure_ids.slice());
const FILTER_OPERATORS = Object.freeze(CONTRACT.interaction.filter_operators.slice());
const DRILL_TARGETS = Object.freeze(CONTRACT.interaction.drill_targets.slice());

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function assertContract() {
  if (CONTRACT.schema !== FOUNDATION_SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'VIZ-020') {
    fail('VIZ_CONTRACT_VERSION_INVALID');
  }
  if (ANALYTICS.schema !== 'PRH_ANALYTICS_CONTRACT_V1' || ANALYTICS.version !== '1.0.0') {
    fail('VIZ_ANALYTICS_UPSTREAM_INVALID');
  }
  if (DESIGN.schema !== 'PRH_DESIGN_SYSTEM_V1' || DESIGN.version !== '1.0.0') {
    fail('VIZ_DESIGN_UPSTREAM_INVALID');
  }
  const invariants = CONTRACT.invariants || {};
  const authorities = CONTRACT.authorities || {};
  if (invariants.renderer_neutral_specs !== true || invariants.configuration_only_specs !== true ||
      invariants.financial_payload_in_specs_allowed !== false || invariants.external_asset_required !== false ||
      invariants.paid_dependency_required !== false || invariants.cost_class !== 'FREE_ONLY') {
    fail('VIZ_INVARIANT_CONTRACT_INVALID');
  }
  if (Object.values(authorities).some((value) => value !== false)) fail('VIZ_AUTHORITY_CONTRACT_INVALID');
  const primary = CONTRACT.renderers.filter((renderer) => renderer.primary_browser === true);
  if (primary.length !== 1 || primary[0].id !== 'ECHARTS_6' || primary[0].major !== 6 || primary[0].replaceable !== true ||
      primary[0].external_cdn_required !== false) {
    fail('VIZ_PRIMARY_RENDERER_INVALID');
  }
  return true;
}

function plainObject(value, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  return value;
}

function exactKeys(value, allowed, reason) {
  plainObject(value, reason);
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail(reason);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function id(value, reason) {
  const text = String(value || '').trim();
  if (!ID_RE.test(text)) fail(reason);
  return text;
}

function shortText(value, max, reason) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text.length > max) fail(reason);
  return text;
}

function assertNoPayloadKeys(value, path = 'spec') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPayloadKeys(item, `${path}[${index}]`));
    return true;
  }
  if (!value || typeof value !== 'object') return true;
  for (const [key, child] of Object.entries(value)) {
    const normalized = String(key).toLowerCase();
    if (PAYLOAD_KEYS.has(normalized) || normalized.endsWith('_amount') || normalized.endsWith('_amount_minor')) {
      fail(`VIZ_SPEC_FINANCIAL_PAYLOAD_FORBIDDEN:${path}.${key}`);
    }
    assertNoPayloadKeys(child, `${path}.${key}`);
  }
  return true;
}

function normalizeEncoding(value, allowedKinds, reason) {
  exactKeys(value, ['kind', 'id'], reason);
  const kind = String(value.kind || '');
  const encodingId = String(value.id || '');
  if (!allowedKinds.includes(kind)) fail(reason);
  if (kind === 'DIMENSION' && !DIMENSIONS.includes(encodingId)) fail(reason);
  if (kind === 'MEASURE' && !MEASURES.includes(encodingId)) fail(reason);
  return Object.freeze({ kind, id: encodingId });
}

function normalizePresentation(value) {
  if (value == null) value = {};
  exactKeys(value, ['legend', 'stacked', 'smooth', 'show_labels'], 'VIZ_PRESENTATION_SHAPE_INVALID');
  const output = {
    legend: value.legend == null ? true : Boolean(value.legend),
    stacked: value.stacked == null ? false : Boolean(value.stacked),
    smooth: value.smooth == null ? false : Boolean(value.smooth),
    show_labels: value.show_labels == null ? false : Boolean(value.show_labels)
  };
  return Object.freeze(output);
}

function normalizeInteractions(value, registry) {
  if (value == null) value = {};
  exactKeys(value, ['filter', 'drill'], 'VIZ_INTERACTIONS_SHAPE_INVALID');
  const filter = value.filter == null ? registry.supports_filter_selection : Boolean(value.filter);
  const drill = value.drill == null ? registry.supports_drill : Boolean(value.drill);
  if (filter && !registry.supports_filter_selection) fail('VIZ_FILTER_INTERACTION_UNSUPPORTED');
  if (drill && !registry.supports_drill) fail('VIZ_DRILL_INTERACTION_UNSUPPORTED');
  return Object.freeze({ filter, drill });
}

function normalizeChartSpec(input) {
  assertContract();
  assertNoPayloadKeys(input);
  exactKeys(input, ['schema', 'contract_version', 'id', 'type', 'title', 'encoding', 'presentation', 'interactions'], 'VIZ_CHART_SPEC_SHAPE_INVALID');
  if (input.schema !== CHART_SPEC_SCHEMA || input.contract_version !== VERSION) fail('VIZ_CHART_SPEC_VERSION_INVALID');
  const chartId = id(input.id, 'VIZ_CHART_ID_INVALID');
  const type = String(input.type || '');
  const registry = CHART_REGISTRY[type];
  if (!registry) fail('VIZ_CHART_TYPE_UNSUPPORTED');
  const title = shortText(input.title, CONTRACT.limits.max_title_length, 'VIZ_CHART_TITLE_INVALID');
  plainObject(input.encoding, 'VIZ_ENCODING_INVALID');
  const allowedEncodingKeys = [...registry.required_encodings, ...registry.optional_encodings];
  if (Object.keys(input.encoding).some((key) => !allowedEncodingKeys.includes(key))) fail('VIZ_ENCODING_KEY_UNSUPPORTED');
  for (const key of registry.required_encodings) {
    if (!input.encoding[key]) fail('VIZ_REQUIRED_ENCODING_MISSING');
  }
  const encoding = {};
  for (const key of allowedEncodingKeys) {
    if (input.encoding[key] == null) continue;
    const kinds = registry[`${key}_kinds`];
    encoding[key] = normalizeEncoding(input.encoding[key], kinds, 'VIZ_ENCODING_BINDING_INVALID');
  }
  if (encoding.series && encoding.x && encoding.series.kind === encoding.x.kind && encoding.series.id === encoding.x.id) {
    fail('VIZ_SERIES_ENCODING_AMBIGUOUS');
  }
  return Object.freeze({
    schema: CHART_SPEC_SCHEMA,
    contract_version: VERSION,
    id: chartId,
    type,
    title,
    encoding: Object.freeze(encoding),
    presentation: normalizePresentation(input.presentation),
    interactions: normalizeInteractions(input.interactions, registry)
  });
}

function normalizeWidgetSpec(input) {
  assertContract();
  assertNoPayloadKeys(input);
  exactKeys(input, ['schema', 'contract_version', 'id', 'kind', 'query_ref', 'chart_spec'], 'VIZ_WIDGET_SPEC_SHAPE_INVALID');
  if (input.schema !== WIDGET_SPEC_SCHEMA || input.contract_version !== VERSION) fail('VIZ_WIDGET_SPEC_VERSION_INVALID');
  if (input.kind !== 'CHART') fail('VIZ_WIDGET_KIND_UNSUPPORTED');
  const widgetId = id(input.id, 'VIZ_WIDGET_ID_INVALID');
  const queryRef = id(input.query_ref, 'VIZ_QUERY_REF_INVALID');
  const chartSpec = normalizeChartSpec(input.chart_spec);
  return Object.freeze({
    schema: WIDGET_SPEC_SCHEMA,
    contract_version: VERSION,
    id: widgetId,
    kind: 'CHART',
    query_ref: queryRef,
    chart_spec: chartSpec
  });
}

function normalizeFilterItem(item) {
  exactKeys(item, ['kind', 'field', 'operator', 'values'], 'VIZ_FILTER_ITEM_SHAPE_INVALID');
  if (item.kind !== 'DIMENSION') fail('VIZ_FILTER_KIND_UNSUPPORTED');
  const field = String(item.field || '');
  const operator = String(item.operator || '');
  if (!DIMENSIONS.includes(field)) fail('VIZ_FILTER_FIELD_UNSUPPORTED');
  if (!FILTER_OPERATORS.includes(operator)) fail('VIZ_FILTER_OPERATOR_UNSUPPORTED');
  if (!Array.isArray(item.values) || item.values.length < 1 || item.values.length > CONTRACT.limits.max_filter_values) {
    fail('VIZ_FILTER_VALUES_INVALID');
  }
  const values = item.values.map((value) => {
    const text = String(value == null ? '' : value).trim();
    if (!text || text.length > 128) fail('VIZ_FILTER_VALUE_INVALID');
    return text;
  }).sort();
  if (new Set(values).size !== values.length) fail('VIZ_FILTER_VALUE_DUPLICATE');
  return Object.freeze({ kind: 'DIMENSION', field, operator, values: Object.freeze(values) });
}

function normalizeFilterContext(input) {
  assertContract();
  if (input == null) input = { schema: FILTER_CONTEXT_SCHEMA, contract_version: VERSION, filters: [] };
  exactKeys(input, ['schema', 'contract_version', 'filters'], 'VIZ_FILTER_CONTEXT_SHAPE_INVALID');
  if (input.schema !== FILTER_CONTEXT_SCHEMA || input.contract_version !== VERSION) fail('VIZ_FILTER_CONTEXT_VERSION_INVALID');
  if (!Array.isArray(input.filters) || input.filters.length > CONTRACT.limits.max_filter_items) fail('VIZ_FILTER_CONTEXT_INVALID');
  const filters = input.filters.map(normalizeFilterItem).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
  const keys = filters.map((item) => `${item.kind}:${item.field}:${item.operator}`);
  if (new Set(keys).size !== keys.length) fail('VIZ_FILTER_CONTEXT_AMBIGUOUS');
  const normalized = Object.freeze({ schema: FILTER_CONTEXT_SCHEMA, contract_version: VERSION, filters: Object.freeze(filters) });
  return Object.freeze({ ...normalized, context_hash: sha256(stableStringify(normalized)) });
}

function normalizeDrillContext(input) {
  assertContract();
  exactKeys(input, ['schema', 'contract_version', 'source_widget_id', 'target', 'filter_context'], 'VIZ_DRILL_CONTEXT_SHAPE_INVALID');
  if (input.schema !== DRILL_CONTEXT_SCHEMA || input.contract_version !== VERSION) fail('VIZ_DRILL_CONTEXT_VERSION_INVALID');
  const sourceWidgetId = id(input.source_widget_id, 'VIZ_DRILL_SOURCE_INVALID');
  const target = String(input.target || '');
  if (!DRILL_TARGETS.includes(target)) fail('VIZ_DRILL_TARGET_UNSUPPORTED');
  const filterContext = normalizeFilterContext(input.filter_context);
  const normalized = Object.freeze({
    schema: DRILL_CONTEXT_SCHEMA,
    contract_version: VERSION,
    source_widget_id: sourceWidgetId,
    target,
    filter_context: Object.freeze({
      schema: filterContext.schema,
      contract_version: filterContext.contract_version,
      filters: filterContext.filters
    })
  });
  return Object.freeze({ ...normalized, context_hash: sha256(stableStringify(normalized)) });
}

function normalizeRenderDataset(input) {
  exactKeys(input, ['schema', 'contract_version', 'rows'], 'VIZ_RENDER_DATASET_SHAPE_INVALID');
  if (input.schema !== RENDER_DATASET_SCHEMA || input.contract_version !== VERSION) fail('VIZ_RENDER_DATASET_VERSION_INVALID');
  if (!Array.isArray(input.rows) || input.rows.length > CONTRACT.limits.max_render_rows) fail('VIZ_RENDER_ROWS_INVALID');
  const rows = input.rows.map((row) => {
    exactKeys(row, ['dimensions', 'measures'], 'VIZ_RENDER_ROW_SHAPE_INVALID');
    plainObject(row.dimensions, 'VIZ_RENDER_DIMENSIONS_INVALID');
    plainObject(row.measures, 'VIZ_RENDER_MEASURES_INVALID');
    const dimensions = {};
    for (const [key, value] of Object.entries(row.dimensions)) {
      if (!DIMENSIONS.includes(key)) fail('VIZ_RENDER_DIMENSION_UNSUPPORTED');
      const text = String(value == null ? '' : value);
      if (text.length > 256) fail('VIZ_RENDER_DIMENSION_VALUE_INVALID');
      dimensions[key] = text;
    }
    const measures = {};
    for (const [key, value] of Object.entries(row.measures)) {
      if (!MEASURES.includes(key)) fail('VIZ_RENDER_MEASURE_UNSUPPORTED');
      const number = Number(value);
      if (!Number.isSafeInteger(number)) fail('VIZ_RENDER_MEASURE_VALUE_INVALID');
      measures[key] = number;
    }
    return Object.freeze({ dimensions: Object.freeze(dimensions), measures: Object.freeze(measures) });
  });
  return Object.freeze({ schema: RENDER_DATASET_SCHEMA, contract_version: VERSION, rows: Object.freeze(rows) });
}

function bindingValue(row, binding) {
  if (binding.kind === 'DIMENSION') {
    if (!Object.prototype.hasOwnProperty.call(row.dimensions, binding.id)) fail('VIZ_RENDER_DIMENSION_MISSING');
    return row.dimensions[binding.id];
  }
  if (!Object.prototype.hasOwnProperty.call(row.measures, binding.id)) fail('VIZ_RENDER_MEASURE_MISSING');
  return row.measures[binding.id];
}

function groupSeries(rows, seriesBinding) {
  if (!seriesBinding) return [{ name: null, rows }];
  const groups = new Map();
  for (const row of rows) {
    const name = String(bindingValue(row, seriesBinding));
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(row);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, groupRows]) => ({ name, rows: groupRows }));
}

function compileCartesian(spec, dataset, rendererType) {
  const xBinding = spec.encoding.x;
  const yBinding = spec.encoding.y;
  const grouped = groupSeries(dataset.rows, spec.encoding.series);
  const categories = [];
  for (const row of dataset.rows) {
    const category = String(bindingValue(row, xBinding));
    if (!categories.includes(category)) categories.push(category);
  }
  const series = grouped.map((group) => {
    const valuesByCategory = new Map(group.rows.map((row) => [String(bindingValue(row, xBinding)), bindingValue(row, yBinding)]));
    return {
      name: group.name || spec.title,
      type: rendererType,
      stack: spec.presentation.stacked ? 'total' : undefined,
      smooth: rendererType === 'line' ? spec.presentation.smooth : undefined,
      label: { show: spec.presentation.show_labels },
      data: categories.map((category) => valuesByCategory.has(category) ? valuesByCategory.get(category) : null)
    };
  });
  return {
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    series
  };
}

function compileDonut(spec, dataset) {
  const categoryBinding = spec.encoding.category;
  const valueBinding = spec.encoding.value;
  return {
    series: [{
      name: spec.title,
      type: 'pie',
      radius: ['48%', '72%'],
      label: { show: spec.presentation.show_labels },
      data: dataset.rows.map((row) => ({
        name: String(bindingValue(row, categoryBinding)),
        value: bindingValue(row, valueBinding)
      }))
    }]
  };
}

function compileEChartsOption(chartSpecInput, datasetInput) {
  assertContract();
  const spec = normalizeChartSpec(chartSpecInput);
  const dataset = normalizeRenderDataset(datasetInput);
  let chart;
  if (spec.type === 'BAR') chart = compileCartesian(spec, dataset, 'bar');
  else if (spec.type === 'LINE') chart = compileCartesian(spec, dataset, 'line');
  else if (spec.type === 'DONUT') chart = compileDonut(spec, dataset);
  else fail('VIZ_CHART_TYPE_UNSUPPORTED');
  return Object.freeze({
    renderer: 'ECHARTS_6',
    option: Object.freeze({
      animation: true,
      aria: Object.freeze({ enabled: true }),
      title: Object.freeze({ text: spec.title }),
      tooltip: Object.freeze({ trigger: spec.type === 'DONUT' ? 'item' : 'axis' }),
      legend: Object.freeze({ show: spec.presentation.legend }),
      ...chart
    })
  });
}

function mergeFilterSelection(baseContextInput, field, value, operator = 'INCLUDE') {
  const base = normalizeFilterContext(baseContextInput);
  if (!DIMENSIONS.includes(field)) fail('VIZ_FILTER_FIELD_UNSUPPORTED');
  if (!FILTER_OPERATORS.includes(operator)) fail('VIZ_FILTER_OPERATOR_UNSUPPORTED');
  const text = String(value == null ? '' : value).trim();
  if (!text) fail('VIZ_FILTER_VALUE_INVALID');
  const filters = base.filters.map((item) => ({ kind: item.kind, field: item.field, operator: item.operator, values: item.values.slice() }));
  const existing = filters.find((item) => item.kind === 'DIMENSION' && item.field === field && item.operator === operator);
  if (existing) {
    if (!existing.values.includes(text)) existing.values.push(text);
    existing.values.sort();
  } else {
    filters.push({ kind: 'DIMENSION', field, operator, values: [text] });
  }
  return normalizeFilterContext({ schema: FILTER_CONTEXT_SCHEMA, contract_version: VERSION, filters });
}

function filterContextFromSelection(chartSpecInput, selection, baseContextInput) {
  const spec = normalizeChartSpec(chartSpecInput);
  if (!spec.interactions.filter) fail('VIZ_FILTER_INTERACTION_DISABLED');
  exactKeys(selection, ['encoding', 'value', 'operator'], 'VIZ_SELECTION_SHAPE_INVALID');
  const encodingKey = String(selection.encoding || '');
  const binding = spec.encoding[encodingKey];
  if (!binding || binding.kind !== 'DIMENSION') fail('VIZ_SELECTION_ENCODING_INVALID');
  return mergeFilterSelection(
    baseContextInput || { schema: FILTER_CONTEXT_SCHEMA, contract_version: VERSION, filters: [] },
    binding.id,
    selection.value,
    selection.operator == null ? 'INCLUDE' : String(selection.operator)
  );
}

function drillContextFromSelection(widgetSpecInput, selection, baseContextInput, target = 'DETAILS') {
  const widget = normalizeWidgetSpec(widgetSpecInput);
  if (!widget.chart_spec.interactions.drill) fail('VIZ_DRILL_INTERACTION_DISABLED');
  const filterContext = filterContextFromSelection(widget.chart_spec, selection, baseContextInput);
  return normalizeDrillContext({
    schema: DRILL_CONTEXT_SCHEMA,
    contract_version: VERSION,
    source_widget_id: widget.id,
    target,
    filter_context: {
      schema: filterContext.schema,
      contract_version: filterContext.contract_version,
      filters: filterContext.filters.map((item) => ({ kind: item.kind, field: item.field, operator: item.operator, values: item.values.slice() }))
    }
  });
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  CHART_REGISTRY,
  FOUNDATION_SCHEMA,
  VERSION,
  CHART_SPEC_SCHEMA,
  WIDGET_SPEC_SCHEMA,
  FILTER_CONTEXT_SCHEMA,
  DRILL_CONTEXT_SCHEMA,
  RENDER_DATASET_SCHEMA,
  assertContract,
  stableStringify,
  assertNoPayloadKeys,
  normalizeChartSpec,
  normalizeWidgetSpec,
  normalizeFilterContext,
  normalizeDrillContext,
  normalizeRenderDataset,
  compileEChartsOption,
  filterContextFromSelection,
  drillContextFromSelection
});