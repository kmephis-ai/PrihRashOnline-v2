'use strict';

const crypto = require('crypto');
const CONTRACT = require('./advanced_visualization_pack.v1.json');
const VIZ070 = require('./visualization_registry_v2');
const ANALYTICS = require('../analytics/analytics_engine');

const SCHEMA = 'PRH_ADVANCED_VISUALIZATION_PACK_V1';
const VERSION = '1.0.0';
const SPEC_SCHEMA = 'PRH_ADVANCED_VISUALIZATION_SPEC_V1';
const SOURCE_SCHEMA = 'PRH_ADVANCED_VISUALIZATION_SOURCE_V1';
const PLAN_SCHEMA = 'PRH_ADVANCED_VISUALIZATION_PLAN_V1';
const CHART_TYPES = Object.freeze(Object.keys(CONTRACT.chart_registry));
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SOURCE_CONTRACT_RE = /^[A-Z][A-Z0-9_]+@[0-9]+\.[0-9]+\.[0-9]+$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOSTILE_KEY_RE = /^(?:echarts|option|options|formatter|callback|function|javascript|html|css|url|href|src|script|transaction|transactions|transaction_rows|amount_minor|balance_minor|credential|credentials|token|secret)$/i;
const HOSTILE_STRING_RE = /(?:<\/?script\b|javascript\s*:|https?:\/\/|url\s*\()/i;

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function stableStringify(value) {
  return ANALYTICS.stableStringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys.slice().sort())) fail(code);
  return value;
}

function assertNoHostilePayload(value, path = 'value') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoHostilePayload(item, `${path}[${index}]`));
    return true;
  }
  if (value == null || typeof value !== 'object') {
    if (typeof value === 'string' && HOSTILE_STRING_RE.test(value)) fail('VIZ090_HOSTILE_STRING_FORBIDDEN', path);
    return true;
  }
  for (const [key, child] of Object.entries(value)) {
    if (HOSTILE_KEY_RE.test(key)) fail('VIZ090_HOSTILE_KEY_FORBIDDEN', `${path}.${key}`);
    assertNoHostilePayload(child, `${path}.${key}`);
  }
  return true;
}

function safeText(value, code, max = CONTRACT.limits.max_id_length) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text.length > max || /[\u0000-\u001f<>]/.test(text) || HOSTILE_STRING_RE.test(text)) fail(code);
  return text;
}

function opaqueId(value, code) {
  const text = String(value == null ? '' : value);
  if (!ID_RE.test(text)) fail(code);
  return text;
}

function sourceContract(value) {
  const text = String(value == null ? '' : value);
  if (!SOURCE_CONTRACT_RE.test(text)) fail('VIZ090_SOURCE_CONTRACT_INVALID');
  return text;
}

function safeInteger(value, code, nonNegative = false) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || (nonNegative && number < 0)) fail(code);
  return number;
}

function finiteNumber(value, code, nonNegative = false) {
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > 1e15 || (nonNegative && number < 0)) fail(code);
  return Object.is(number, -0) ? 0 : number;
}

function safeSum(values, code) {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isSafeInteger(total)) fail(code);
  }
  return total;
}

function isoDay(value) {
  const text = String(value || '');
  if (!ISO_DAY_RE.test(text)) fail('VIZ090_DAY_INVALID');
  const date = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) fail('VIZ090_DAY_INVALID');
  return text;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'VIZ-090') {
    fail('VIZ090_CONTRACT_INVALID');
  }
  VIZ070.assertContract();
  ANALYTICS.assertContract();
  if (CONTRACT.schemas.spec !== SPEC_SCHEMA || CONTRACT.schemas.source !== SOURCE_SCHEMA || CONTRACT.schemas.plan !== PLAN_SCHEMA) {
    fail('VIZ090_SCHEMA_CONTRACT_INVALID');
  }
  const upstream = CONTRACT.upstream || {};
  if (upstream.visualization_registry !== `${VIZ070.SCHEMA}@${VIZ070.VERSION}` ||
      upstream.analytics_contract !== `${ANALYTICS.CONTRACT_SCHEMA}@${ANALYTICS.CONTRACT_VERSION}` ||
      upstream.renderer !== 'ECHARTS_6' || upstream.accessible_renderer !== 'SEMANTIC_TABLE_V1' ||
      upstream.financial_truth_policy !== 'FIN-TRUTH-v1') fail('VIZ090_UPSTREAM_INVALID');
  const p = CONTRACT.principles || {};
  if (p.semantic_source_required !== true || p.query_mutation_allowed !== false || p.financial_formula_allowed !== false ||
      p.transaction_access_allowed !== false || p.renderer_owns_financial_truth !== false || p.renderer_owns_query_semantics !== false ||
      p.arbitrary_renderer_options_allowed !== false || p.external_cdn_required !== false || p.paid_dependency_required !== false || p.free_only !== true) {
    fail('VIZ090_BOUNDARY_INVALID');
  }
  if (!CONTRACT.authorities || Object.values(CONTRACT.authorities).some((value) => value !== false)) fail('VIZ090_AUTHORITY_INVALID');
  if (VIZ070.CHART_TYPES.includes('AREA') || !VIZ070.CHART_TYPES.includes('LINE')) fail('VIZ090_VIZ070_BOUNDARY_INVALID');
  const primary = VIZ070.rendererCapabilities('ECHARTS_6');
  const accessible = VIZ070.rendererCapabilities('SEMANTIC_TABLE_V1');
  if (primary.loading_policy !== 'LOCAL_OR_BUNDLED' || primary.replaceable !== true || primary.financial_truth_authority !== false ||
      primary.query_authority !== false || accessible.loading_policy !== 'BUILT_IN') fail('VIZ090_RENDERER_BOUNDARY_INVALID');
  for (const type of CHART_TYPES) {
    const entry = CONTRACT.chart_registry[type];
    if (!entry || !entry.source_shape || !entry.responsive || entry.supports_filter == null || entry.supports_drill == null) {
      fail('VIZ090_REGISTRY_ENTRY_INVALID', type);
    }
    for (const mode of ['mobile', 'tablet', 'desktop']) if (!entry.responsive[mode]) fail('VIZ090_RESPONSIVE_REGISTRY_INVALID', type);
  }
  if (CONTRACT.a11y.semantic_table_required !== true || CONTRACT.a11y.text_summary_required !== true ||
      CONTRACT.a11y.interaction_only_evidence_allowed !== false || CONTRACT.a11y.assistive_renderer !== 'SEMANTIC_TABLE_V1') {
    fail('VIZ090_A11Y_CONTRACT_INVALID');
  }
  return true;
}

function normalizeSpec(input) {
  assertContract();
  assertNoHostilePayload(input, 'spec');
  exactKeys(input, ['schema', 'contract_version', 'id', 'type', 'title', 'interactions'], 'VIZ090_SPEC_SHAPE_INVALID');
  if (input.schema !== SPEC_SCHEMA || input.contract_version !== VERSION) fail('VIZ090_SPEC_VERSION_INVALID');
  const id = opaqueId(input.id, 'VIZ090_SPEC_ID_INVALID');
  const type = String(input.type || '');
  const entry = CONTRACT.chart_registry[type];
  if (!entry) fail('VIZ090_CHART_TYPE_UNKNOWN');
  const title = safeText(input.title, 'VIZ090_TITLE_INVALID', CONTRACT.limits.max_title_length);
  exactKeys(input.interactions, ['filter', 'drill'], 'VIZ090_INTERACTIONS_SHAPE_INVALID');
  if (typeof input.interactions.filter !== 'boolean' || typeof input.interactions.drill !== 'boolean') fail('VIZ090_INTERACTIONS_INVALID');
  if (input.interactions.filter && entry.supports_filter !== true) fail('VIZ090_FILTER_UNSUPPORTED');
  if (input.interactions.drill && entry.supports_drill !== true) fail('VIZ090_DRILL_UNSUPPORTED');
  return deepFreeze({ schema: SPEC_SCHEMA, contract_version: VERSION, id, type, title, interactions: { filter: input.interactions.filter, drill: input.interactions.drill } });
}

function normalizeSeriesKey(value, code) {
  if (value == null) return null;
  return safeText(value, code);
}

function uniqueBy(items, keyFn, code) {
  const seen = new Set();
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) fail(code, key);
    seen.add(key);
  }
}

function boundedRows(rows, code) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > CONTRACT.limits.max_rows) fail(code);
  return rows;
}

function seriesCount(rows) {
  return new Set(rows.map((row) => row.series).filter((value) => value != null)).size;
}

function normalizeTimeSeries(data) {
  exactKeys(data, ['rows'], 'VIZ090_TIME_SERIES_SHAPE_INVALID');
  const rows = boundedRows(data.rows, 'VIZ090_TIME_SERIES_ROWS_INVALID').map((row) => {
    exactKeys(row, ['x', 'series', 'value'], 'VIZ090_TIME_SERIES_ROW_SHAPE_INVALID');
    return { x: safeText(row.x, 'VIZ090_TIME_X_INVALID'), series: normalizeSeriesKey(row.series, 'VIZ090_SERIES_INVALID'), value: safeInteger(row.value, 'VIZ090_VALUE_INVALID') };
  });
  uniqueBy(rows, (row) => `${row.x}\u0000${row.series == null ? '' : row.series}`, 'VIZ090_TIME_SERIES_DUPLICATE');
  const count = seriesCount(rows);
  if (count > CONTRACT.limits.max_series) fail('VIZ090_SERIES_LIMIT');
  rows.sort((a, b) => a.x.localeCompare(b.x) || String(a.series || '').localeCompare(String(b.series || '')));
  return { data: { rows }, row_count: rows.length, series_count: count };
}

function normalizeCategoricalSeries(data) {
  exactKeys(data, ['rows'], 'VIZ090_CATEGORY_SERIES_SHAPE_INVALID');
  const rows = boundedRows(data.rows, 'VIZ090_CATEGORY_SERIES_ROWS_INVALID').map((row) => {
    exactKeys(row, ['category', 'series', 'value'], 'VIZ090_CATEGORY_SERIES_ROW_SHAPE_INVALID');
    return { category: safeText(row.category, 'VIZ090_CATEGORY_INVALID'), series: normalizeSeriesKey(row.series, 'VIZ090_SERIES_INVALID'), value: safeInteger(row.value, 'VIZ090_VALUE_INVALID') };
  });
  uniqueBy(rows, (row) => `${row.category}\u0000${row.series == null ? '' : row.series}`, 'VIZ090_CATEGORY_SERIES_DUPLICATE');
  const count = seriesCount(rows);
  if (count > CONTRACT.limits.max_series) fail('VIZ090_SERIES_LIMIT');
  rows.sort((a, b) => a.category.localeCompare(b.category) || String(a.series || '').localeCompare(String(b.series || '')));
  return { data: { rows }, row_count: rows.length, series_count: count };
}

function percentStack(rows) {
  if (rows.some((row) => row.series == null || row.value < 0)) fail('VIZ090_PERCENT_STACK_REQUIRES_NON_NEGATIVE_SERIES');
  const byCategory = new Map();
  for (const row of rows) {
    if (!byCategory.has(row.category)) byCategory.set(row.category, []);
    byCategory.get(row.category).push(row);
  }
  const output = [];
  for (const category of Array.from(byCategory.keys()).sort()) {
    const categoryRows = byCategory.get(category).slice().sort((a, b) => a.series.localeCompare(b.series));
    const total = safeSum(categoryRows.map((row) => row.value), 'VIZ090_PERCENT_STACK_TOTAL_OVERFLOW');
    if (total === 0) {
      categoryRows.forEach((row) => output.push({ ...row, share_bps: 0, category_total: 0, normalization: 'ZERO_TOTAL' }));
      continue;
    }
    const totalBig = BigInt(total);
    const provisional = categoryRows.map((row) => {
      const numerator = BigInt(row.value) * 10000n;
      return { row, floor: Number(numerator / totalBig), remainder: numerator % totalBig };
    });
    let assigned = provisional.reduce((sum, item) => sum + item.floor, 0);
    provisional.sort((a, b) => a.remainder === b.remainder ? a.row.series.localeCompare(b.row.series) : (a.remainder > b.remainder ? -1 : 1));
    for (let i = 0; assigned < 10000; i += 1, assigned += 1) provisional[i].floor += 1;
    provisional.sort((a, b) => a.row.series.localeCompare(b.row.series));
    if (provisional.reduce((sum, item) => sum + item.floor, 0) !== 10000) fail('VIZ090_PERCENT_STACK_CONSERVATION_FAILED');
    provisional.forEach((item) => output.push({ ...item.row, share_bps: item.floor, category_total: total, normalization: 'NORMALIZED_100_PERCENT' }));
  }
  return output;
}

function normalizeWaterfall(data) {
  exactKeys(data, ['rows'], 'VIZ090_WATERFALL_SHAPE_INVALID');
  const rows = boundedRows(data.rows, 'VIZ090_WATERFALL_ROWS_INVALID').map((row) => {
    exactKeys(row, ['id', 'order', 'kind', 'value'], 'VIZ090_WATERFALL_ROW_SHAPE_INVALID');
    const kind = String(row.kind || '');
    if (!['START', 'DELTA', 'END'].includes(kind)) fail('VIZ090_WATERFALL_KIND_INVALID');
    return { id: opaqueId(row.id, 'VIZ090_WATERFALL_ID_INVALID'), order: safeInteger(row.order, 'VIZ090_WATERFALL_ORDER_INVALID', true), kind, value: safeInteger(row.value, 'VIZ090_WATERFALL_VALUE_INVALID') };
  });
  uniqueBy(rows, (row) => row.id, 'VIZ090_WATERFALL_ID_DUPLICATE');
  uniqueBy(rows, (row) => String(row.order), 'VIZ090_WATERFALL_ORDER_DUPLICATE');
  rows.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  if (rows.some((row, index) => row.order !== index)) fail('VIZ090_WATERFALL_ORDER_NOT_CONTIGUOUS');
  if (rows[0].kind !== 'START' || rows[rows.length - 1].kind !== 'END' || rows.filter((r) => r.kind === 'START').length !== 1 || rows.filter((r) => r.kind === 'END').length !== 1) fail('VIZ090_WATERFALL_BOUNDARY_INVALID');
  const deltas = rows.filter((row) => row.kind === 'DELTA').map((row) => row.value);
  const expected = safeSum([rows[0].value, ...deltas], 'VIZ090_WATERFALL_TOTAL_OVERFLOW');
  if (expected !== rows[rows.length - 1].value) fail('VIZ090_WATERFALL_CONSERVATION_FAILED');
  return { data: { rows, start: rows[0].value, end: rows[rows.length - 1].value }, row_count: rows.length, series_count: 0 };
}

function normalizeSankey(data) {
  exactKeys(data, ['edges'], 'VIZ090_SANKEY_SHAPE_INVALID');
  if (!Array.isArray(data.edges) || data.edges.length < 1 || data.edges.length > CONTRACT.limits.max_edges) fail('VIZ090_SANKEY_EDGE_LIMIT');
  const edges = data.edges.map((edge) => {
    exactKeys(edge, ['source', 'target', 'value'], 'VIZ090_SANKEY_EDGE_SHAPE_INVALID');
    const source = opaqueId(edge.source, 'VIZ090_SANKEY_NODE_INVALID');
    const target = opaqueId(edge.target, 'VIZ090_SANKEY_NODE_INVALID');
    if (source === target) fail('VIZ090_SANKEY_SELF_EDGE_INVALID');
    return { source, target, value: safeInteger(edge.value, 'VIZ090_SANKEY_VALUE_INVALID', true) };
  });
  uniqueBy(edges, (edge) => `${edge.source}\u0000${edge.target}`, 'VIZ090_SANKEY_EDGE_DUPLICATE');
  const nodes = Array.from(new Set(edges.flatMap((edge) => [edge.source, edge.target]))).sort();
  if (nodes.length > CONTRACT.limits.max_nodes) fail('VIZ090_NODE_LIMIT');
  edges.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  return { data: { nodes, edges, causality_claimed: false }, row_count: edges.length, series_count: 0 };
}

function normalizeHierarchy(data) {
  exactKeys(data, ['nodes'], 'VIZ090_HIERARCHY_SHAPE_INVALID');
  if (!Array.isArray(data.nodes) || data.nodes.length < 1 || data.nodes.length > CONTRACT.limits.max_nodes) fail('VIZ090_HIERARCHY_NODE_LIMIT');
  const nodes = data.nodes.map((node) => {
    exactKeys(node, ['id', 'parent_id', 'value'], 'VIZ090_HIERARCHY_NODE_SHAPE_INVALID');
    return { id: opaqueId(node.id, 'VIZ090_HIERARCHY_ID_INVALID'), parent_id: node.parent_id == null ? null : opaqueId(node.parent_id, 'VIZ090_HIERARCHY_PARENT_INVALID'), value: safeInteger(node.value, 'VIZ090_HIERARCHY_VALUE_INVALID', true) };
  });
  uniqueBy(nodes, (node) => node.id, 'VIZ090_HIERARCHY_ID_DUPLICATE');
  const map = new Map(nodes.map((node) => [node.id, node]));
  const roots = nodes.filter((node) => node.parent_id == null);
  if (roots.length !== 1) fail('VIZ090_HIERARCHY_ROOT_INVALID');
  for (const node of nodes) if (node.parent_id != null && !map.has(node.parent_id)) fail('VIZ090_HIERARCHY_ORPHAN');
  const children = new Map(nodes.map((node) => [node.id, []]));
  for (const node of nodes) if (node.parent_id != null) children.get(node.parent_id).push(node.id);
  for (const values of children.values()) values.sort();
  const visiting = new Set();
  const visited = new Set();
  let maxDepth = 0;
  function visit(id, depth) {
    if (visiting.has(id)) fail('VIZ090_HIERARCHY_CYCLE');
    if (visited.has(id)) return;
    if (depth > CONTRACT.limits.max_hierarchy_depth) fail('VIZ090_HIERARCHY_DEPTH_LIMIT');
    maxDepth = Math.max(maxDepth, depth);
    visiting.add(id);
    for (const child of children.get(id)) visit(child, depth + 1);
    visiting.delete(id);
    visited.add(id);
  }
  visit(roots[0].id, 0);
  if (visited.size !== nodes.length) fail('VIZ090_HIERARCHY_DISCONNECTED');
  for (const node of nodes) {
    const ids = children.get(node.id);
    if (ids.length === 0) continue;
    const childTotal = safeSum(ids.map((id) => map.get(id).value), 'VIZ090_HIERARCHY_TOTAL_OVERFLOW');
    if (childTotal !== node.value) fail('VIZ090_HIERARCHY_RECONCILIATION_FAILED', node.id);
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  return { data: { root_id: roots[0].id, max_depth: maxDepth, nodes }, row_count: nodes.length, series_count: 0 };
}

function normalizeCalendarHeatmap(data) {
  exactKeys(data, ['rows'], 'VIZ090_CALENDAR_SHAPE_INVALID');
  const rows = boundedRows(data.rows, 'VIZ090_CALENDAR_ROWS_INVALID').map((row) => {
    exactKeys(row, ['day', 'present', 'value'], 'VIZ090_CALENDAR_ROW_SHAPE_INVALID');
    if (typeof row.present !== 'boolean') fail('VIZ090_HEATMAP_PRESENT_INVALID');
    if (row.present && row.value == null) fail('VIZ090_HEATMAP_VALUE_REQUIRED');
    if (!row.present && row.value != null) fail('VIZ090_HEATMAP_MISSING_MUST_BE_NULL');
    return { day: isoDay(row.day), present: row.present, value: row.present ? safeInteger(row.value, 'VIZ090_HEATMAP_VALUE_INVALID') : null };
  });
  uniqueBy(rows, (row) => row.day, 'VIZ090_CALENDAR_DAY_DUPLICATE');
  rows.sort((a, b) => a.day.localeCompare(b.day));
  return { data: { rows }, row_count: rows.length, series_count: 0 };
}

function normalizeMatrixHeatmap(data) {
  exactKeys(data, ['rows'], 'VIZ090_MATRIX_SHAPE_INVALID');
  const rows = boundedRows(data.rows, 'VIZ090_MATRIX_ROWS_INVALID').map((row) => {
    exactKeys(row, ['x', 'y', 'present', 'value'], 'VIZ090_MATRIX_ROW_SHAPE_INVALID');
    if (typeof row.present !== 'boolean') fail('VIZ090_HEATMAP_PRESENT_INVALID');
    if (row.present && row.value == null) fail('VIZ090_HEATMAP_VALUE_REQUIRED');
    if (!row.present && row.value != null) fail('VIZ090_HEATMAP_MISSING_MUST_BE_NULL');
    return { x: safeText(row.x, 'VIZ090_MATRIX_X_INVALID'), y: safeText(row.y, 'VIZ090_MATRIX_Y_INVALID'), present: row.present, value: row.present ? safeInteger(row.value, 'VIZ090_HEATMAP_VALUE_INVALID') : null };
  });
  uniqueBy(rows, (row) => `${row.x}\u0000${row.y}`, 'VIZ090_MATRIX_CELL_DUPLICATE');
  rows.sort((a, b) => a.x.localeCompare(b.x) || a.y.localeCompare(b.y));
  return { data: { rows }, row_count: rows.length, series_count: 0 };
}

function normalizePareto(data) {
  exactKeys(data, ['rows'], 'VIZ090_PARETO_SHAPE_INVALID');
  const rows = boundedRows(data.rows, 'VIZ090_PARETO_ROWS_INVALID').map((row) => {
    exactKeys(row, ['category', 'value'], 'VIZ090_PARETO_ROW_SHAPE_INVALID');
    return { category: safeText(row.category, 'VIZ090_CATEGORY_INVALID'), value: safeInteger(row.value, 'VIZ090_PARETO_VALUE_INVALID', true) };
  });
  uniqueBy(rows, (row) => row.category, 'VIZ090_PARETO_CATEGORY_DUPLICATE');
  rows.sort((a, b) => b.value - a.value || a.category.localeCompare(b.category));
  const total = safeSum(rows.map((row) => row.value), 'VIZ090_PARETO_TOTAL_OVERFLOW');
  let cumulative = 0;
  const enriched = rows.map((row, index) => {
    cumulative = safeSum([cumulative, row.value], 'VIZ090_PARETO_TOTAL_OVERFLOW');
    let cumulativeBps = 0;
    if (total > 0) cumulativeBps = index === rows.length - 1 ? 10000 : Number((BigInt(cumulative) * 10000n) / BigInt(total));
    return { ...row, cumulative_value: cumulative, cumulative_bps: cumulativeBps };
  });
  if (total > 0 && enriched[enriched.length - 1].cumulative_bps !== 10000) fail('VIZ090_PARETO_CONSERVATION_FAILED');
  return { data: { rows: enriched, total }, row_count: rows.length, series_count: 0 };
}

function normalizeXY(data, bubble) {
  exactKeys(data, ['rows'], bubble ? 'VIZ090_BUBBLE_SHAPE_INVALID' : 'VIZ090_SCATTER_SHAPE_INVALID');
  const rows = boundedRows(data.rows, 'VIZ090_XY_ROWS_INVALID').map((row) => {
    exactKeys(row, bubble ? ['id', 'x', 'y', 'size', 'series'] : ['id', 'x', 'y', 'series'], 'VIZ090_XY_ROW_SHAPE_INVALID');
    const normalized = { id: opaqueId(row.id, 'VIZ090_POINT_ID_INVALID'), x: finiteNumber(row.x, 'VIZ090_X_INVALID'), y: finiteNumber(row.y, 'VIZ090_Y_INVALID'), series: normalizeSeriesKey(row.series, 'VIZ090_SERIES_INVALID') };
    if (bubble) normalized.size = finiteNumber(row.size, 'VIZ090_BUBBLE_SIZE_INVALID', true);
    return normalized;
  });
  uniqueBy(rows, (row) => row.id, 'VIZ090_POINT_ID_DUPLICATE');
  const count = seriesCount(rows);
  if (count > CONTRACT.limits.max_series) fail('VIZ090_SERIES_LIMIT');
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return { data: { rows, causality_claimed: false, correlation_claimed: false }, row_count: rows.length, series_count: count };
}

function normalizeDistribution(data) {
  exactKeys(data, ['series'], 'VIZ090_DISTRIBUTION_SHAPE_INVALID');
  if (!Array.isArray(data.series) || data.series.length < 1 || data.series.length > CONTRACT.limits.max_series) fail('VIZ090_DISTRIBUTION_SERIES_LIMIT');
  let totalSamples = 0;
  const series = data.series.map((group) => {
    exactKeys(group, ['id', 'samples'], 'VIZ090_DISTRIBUTION_SERIES_SHAPE_INVALID');
    const id = safeText(group.id, 'VIZ090_SERIES_INVALID');
    if (!Array.isArray(group.samples) || group.samples.length < 1) fail('VIZ090_DISTRIBUTION_SAMPLES_INVALID');
    const samples = group.samples.map((value) => finiteNumber(value, 'VIZ090_SAMPLE_INVALID')).sort((a, b) => a - b);
    totalSamples += samples.length;
    if (totalSamples > CONTRACT.limits.max_samples) fail('VIZ090_SAMPLE_LIMIT');
    return { id, samples };
  });
  uniqueBy(series, (group) => group.id, 'VIZ090_DISTRIBUTION_SERIES_DUPLICATE');
  series.sort((a, b) => a.id.localeCompare(b.id));
  return { data: { series, total_samples: totalSamples, source_semantics: 'EXPLICIT_SAMPLES' }, row_count: totalSamples, series_count: series.length };
}

function normalizeFacetSeries(data) {
  exactKeys(data, ['rows'], 'VIZ090_FACET_SHAPE_INVALID');
  const rows = boundedRows(data.rows, 'VIZ090_FACET_ROWS_INVALID').map((row) => {
    exactKeys(row, ['facet', 'x', 'series', 'value'], 'VIZ090_FACET_ROW_SHAPE_INVALID');
    return { facet: safeText(row.facet, 'VIZ090_FACET_INVALID'), x: safeText(row.x, 'VIZ090_FACET_X_INVALID'), series: normalizeSeriesKey(row.series, 'VIZ090_SERIES_INVALID'), value: safeInteger(row.value, 'VIZ090_VALUE_INVALID') };
  });
  uniqueBy(rows, (row) => `${row.facet}\u0000${row.x}\u0000${row.series || ''}`, 'VIZ090_FACET_ROW_DUPLICATE');
  const facets = Array.from(new Set(rows.map((row) => row.facet))).sort();
  const count = seriesCount(rows);
  if (facets.length > CONTRACT.limits.max_facets) fail('VIZ090_FACET_LIMIT');
  if (count > CONTRACT.limits.max_series) fail('VIZ090_SERIES_LIMIT');
  rows.sort((a, b) => a.facet.localeCompare(b.facet) || a.x.localeCompare(b.x) || String(a.series || '').localeCompare(String(b.series || '')));
  return { data: { facets, rows, scale_policy: 'SHARED_COMPATIBLE' }, row_count: rows.length, series_count: count };
}

function normalizeBullet(data) {
  exactKeys(data, ['actual', 'reference', 'target', 'reference_provenance', 'target_provenance'], 'VIZ090_BULLET_SHAPE_INVALID');
  return {
    data: {
      actual: safeInteger(data.actual, 'VIZ090_BULLET_ACTUAL_INVALID'),
      reference: safeInteger(data.reference, 'VIZ090_BULLET_REFERENCE_INVALID'),
      target: safeInteger(data.target, 'VIZ090_BULLET_TARGET_INVALID'),
      reference_provenance: sourceContract(data.reference_provenance),
      target_provenance: sourceContract(data.target_provenance)
    },
    row_count: 1,
    series_count: 0
  };
}

function normalizeSourceData(shape, data) {
  if (shape === 'TIME_SERIES') return normalizeTimeSeries(data);
  if (shape === 'CATEGORICAL_SERIES') return normalizeCategoricalSeries(data);
  if (shape === 'WATERFALL') return normalizeWaterfall(data);
  if (shape === 'SANKEY') return normalizeSankey(data);
  if (shape === 'HIERARCHY') return normalizeHierarchy(data);
  if (shape === 'CALENDAR_HEATMAP') return normalizeCalendarHeatmap(data);
  if (shape === 'MATRIX_HEATMAP') return normalizeMatrixHeatmap(data);
  if (shape === 'PARETO') return normalizePareto(data);
  if (shape === 'XY') return normalizeXY(data, false);
  if (shape === 'XYZ') return normalizeXY(data, true);
  if (shape === 'DISTRIBUTION_SAMPLES') return normalizeDistribution(data);
  if (shape === 'FACET_SERIES') return normalizeFacetSeries(data);
  if (shape === 'BULLET_KPI') return normalizeBullet(data);
  fail('VIZ090_SOURCE_SHAPE_UNKNOWN');
}

function normalizeSource(input, expectedShape, queryHash) {
  assertNoHostilePayload(input, 'source');
  exactKeys(input, ['schema', 'contract_version', 'query_hash', 'source_contract', 'shape', 'data'], 'VIZ090_SOURCE_SHAPE_INVALID');
  if (input.schema !== SOURCE_SCHEMA || input.contract_version !== VERSION) fail('VIZ090_SOURCE_VERSION_INVALID');
  if (!HASH_RE.test(String(input.query_hash || '')) || input.query_hash !== queryHash) fail('VIZ090_QUERY_HASH_MISMATCH');
  const contract = sourceContract(input.source_contract);
  const shape = String(input.shape || '');
  if (shape !== expectedShape) fail('VIZ090_SOURCE_CHART_SHAPE_INCOMPATIBLE');
  const normalized = normalizeSourceData(shape, input.data);
  const body = { schema: SOURCE_SCHEMA, contract_version: VERSION, query_hash: queryHash, source_contract: contract, shape, data: normalized.data };
  return deepFreeze({ ...body, result_shape_hash: sha256(stableStringify(body)), row_count: normalized.row_count, series_count: normalized.series_count });
}

function validateChartSpecific(type, source) {
  if (['STACKED_BAR', 'PERCENT_STACKED_BAR'].includes(type) && source.data.rows.some((row) => row.series == null)) fail('VIZ090_STACK_REQUIRES_SERIES');
  if (type === 'PERCENT_STACKED_BAR') {
    return deepFreeze({ ...source, data: { rows: percentStack(source.data.rows) } });
  }
  return source;
}

function planAdvancedVisualization(specInput, sourceInput, queryInput, options = {}) {
  assertContract();
  exactKeys(options, ['viewport_width_px', 'assistive_mode', 'renderer'], 'VIZ090_PLAN_OPTIONS_INVALID');
  const spec = normalizeSpec(specInput);
  const query = ANALYTICS.normalizeAnalyticsQuery(queryInput);
  const queryHash = ANALYTICS.analyticsQueryHash(query);
  const entry = CONTRACT.chart_registry[spec.type];
  const source = validateChartSpecific(spec.type, normalizeSource(sourceInput, entry.source_shape, queryHash));
  const mode = VIZ070.responsiveMode(options.viewport_width_px == null ? 1280 : options.viewport_width_px);
  const requestedRenderer = options.renderer == null ? 'ECHARTS_6' : String(options.renderer);
  VIZ070.rendererCapabilities(requestedRenderer);
  if (!['ECHARTS_6', 'SEMANTIC_TABLE_V1'].includes(requestedRenderer)) fail('VIZ090_RENDERER_INCOMPATIBLE');
  const renderer = options.assistive_mode === true ? 'SEMANTIC_TABLE_V1' : requestedRenderer;
  const responsiveStrategy = entry.responsive[mode.toLowerCase()];
  const body = {
    schema: PLAN_SCHEMA,
    contract_version: VERSION,
    spec_id: spec.id,
    chart_type: spec.type,
    query_hash: queryHash,
    query_modified: false,
    financial_truth_policy: 'FIN-TRUTH-v1',
    source_contract: source.source_contract,
    result_shape_hash: source.result_shape_hash,
    row_count: source.row_count,
    series_count: source.series_count,
    renderer,
    primary_renderer: 'ECHARTS_6',
    renderer_replaceable: true,
    responsive_mode: mode,
    responsive_strategy: responsiveStrategy,
    a11y: {
      semantic_table_required: true,
      text_summary_required: true,
      interaction_only_evidence_allowed: false,
      active_fallback: renderer === 'SEMANTIC_TABLE_V1' ? 'SEMANTIC_TABLE_V1' : null
    },
    interactions: { ...spec.interactions },
    normalized_source: source
  };
  return deepFreeze({ ...body, plan_hash: sha256(stableStringify(body)) });
}

function telemetry(planInput, decision = 'ACCEPTED', reason = 'OK') {
  if (!planInput || planInput.schema !== PLAN_SCHEMA || planInput.contract_version !== VERSION) fail('VIZ090_PLAN_INVALID');
  const output = deepFreeze({
    schema: SCHEMA,
    version: VERSION,
    chart_type: planInput.chart_type,
    renderer: planInput.renderer,
    result_shape_hash_prefix: String(planInput.result_shape_hash || '').slice(0, 12),
    query_hash_prefix: String(planInput.query_hash || '').slice(0, 12),
    row_count: planInput.row_count,
    series_count: planInput.series_count,
    responsive_mode: planInput.responsive_mode,
    decision: String(decision || '').toUpperCase(),
    reason: String(reason || '').toUpperCase()
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) fail('VIZ090_TELEMETRY_SHAPE_INVALID');
  return output;
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  SPEC_SCHEMA,
  SOURCE_SCHEMA,
  PLAN_SCHEMA,
  CHART_TYPES,
  assertContract,
  assertNoHostilePayload,
  normalizeSpec,
  normalizeSource,
  planAdvancedVisualization,
  telemetry,
  stableStringify
});
