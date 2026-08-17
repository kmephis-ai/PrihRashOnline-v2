'use strict';

const crypto = require('crypto');
const CONTRACT = require('./pivot_olap.v1.json');
const ANALYTICS = require('./analytics_engine');
const SEMANTIC = require('./semantic_registry');
const CALC = require('./calculated_metrics');
const VIZ = require('../visualization/visualization_foundation');

const SCHEMA = 'PRH_PIVOT_OLAP_V1';
const VERSION = '1.0.0';
const SPEC_SCHEMA = 'PRH_PIVOT_SPEC_V1';
const RESULT_SCHEMA = 'PRH_PIVOT_RESULT_V1';
const DRILL_SCHEMA = 'PRH_PIVOT_DRILL_DESCRIPTOR_V1';
const REQUERY_SCHEMA = 'PRH_PIVOT_HIERARCHY_REQUERY_V1';
const AXES = Object.freeze(['ROWS', 'COLUMNS']);
const DIRECTIONS = Object.freeze(CONTRACT.sort.directions.slice());
const SORT_BY = Object.freeze(CONTRACT.sort.by.slice());
const HIERARCHY_ACTIONS = Object.freeze(CONTRACT.hierarchy.actions.slice());
const OTHER_KEY = CONTRACT.axis.other_key;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function stableStringify(value) {
  return ANALYTICS.stableStringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function exactKeys(value, keys, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(reason);
  return value;
}

function safeInteger(value, reason) {
  if (!Number.isSafeInteger(value)) fail(reason);
  return value;
}

function safeAdd(left, right) {
  safeInteger(left, 'PIVOT_MONEY_VALUE_INVALID');
  safeInteger(right, 'PIVOT_MONEY_VALUE_INVALID');
  const value = BigInt(left) + BigInt(right);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || BigInt(number) !== value) fail('PIVOT_MONEY_OVERFLOW');
  return number;
}

function safeId(value, reason) {
  const text = String(value == null ? '' : value).trim();
  if (!ID_RE.test(text)) fail(reason);
  return text;
}

function setEqual(left, right) {
  return JSON.stringify(Array.from(left).slice().sort()) === JSON.stringify(Array.from(right).slice().sort());
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'ANL-073' ||
      CONTRACT.spec_schema !== SPEC_SCHEMA || CONTRACT.result_schema !== RESULT_SCHEMA ||
      CONTRACT.drill_schema !== DRILL_SCHEMA || CONTRACT.requery_schema !== REQUERY_SCHEMA) {
    fail('PIVOT_CONTRACT_VERSION_INVALID');
  }
  const upstream = CONTRACT.upstream || {};
  if (upstream.analytics_contract !== `PRH_ANALYTICS_CONTRACT_V1@${ANALYTICS.CONTRACT_VERSION}` ||
      upstream.semantic_registry !== `${SEMANTIC.SCHEMA}@${SEMANTIC.VERSION}` ||
      upstream.calculated_metrics !== `${CALC.SCHEMA}@${CALC.VERSION}` ||
      upstream.visualization_foundation !== `${VIZ.FOUNDATION_SCHEMA}@${VIZ.VERSION}` ||
      upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('PIVOT_UPSTREAM_CONTRACT_INVALID');
  }
  const principles = CONTRACT.principles || {};
  if (principles.analytics_result_is_input_authority !== true || principles.canonical_kpi_recalculated !== false ||
      principles.additive_sum_only_v1 !== true || principles.non_additive_guessing !== false ||
      principles.hierarchy_transition_from_registry_only !== true || principles.hierarchy_detail_requires_requery !== true ||
      principles.top_n_reuses_calculated_metrics !== true || principles.renderer_neutral !== true ||
      principles.storage_neutral !== true || principles.financial_payload_in_spec !== false ||
      principles.public_financial_evidence !== 'SYNTHETIC_ONLY' || principles.free_only !== true) {
    fail('PIVOT_BOUNDARY_INVALID');
  }
  if (!CONTRACT.authorities || Object.values(CONTRACT.authorities).some((value) => value !== false)) {
    fail('PIVOT_AUTHORITY_INVALID');
  }
  if (CONTRACT.top_n.operator !== 'TOP_N_OTHER' || OTHER_KEY !== '__OTHER__') fail('PIVOT_TOP_N_CONTRACT_INVALID');
  return true;
}

function normalizeAxisEntry(input) {
  exactKeys(input, ['dimension_id', 'hierarchy_id', 'level'], 'PIVOT_AXIS_ENTRY_SHAPE_INVALID');
  const dimensionId = String(input.dimension_id || '').trim();
  const definition = SEMANTIC.REGISTRY.dimensions[dimensionId];
  if (!definition || definition.groupable !== true) fail('PIVOT_AXIS_DIMENSION_UNSUPPORTED');
  if (dimensionId === 'time_bucket') {
    if (input.hierarchy_id !== CONTRACT.axis.time_hierarchy_id ||
        !CONTRACT.axis.time_levels.includes(String(input.level || ''))) {
      fail('PIVOT_TIME_HIERARCHY_INVALID');
    }
    return Object.freeze({ dimension_id: dimensionId, hierarchy_id: CONTRACT.axis.time_hierarchy_id, level: String(input.level) });
  }
  if (input.hierarchy_id != null || input.level != null) fail('PIVOT_NON_TIME_HIERARCHY_FORBIDDEN');
  return Object.freeze({ dimension_id: dimensionId, hierarchy_id: null, level: null });
}

function normalizeAxis(input, max, reason) {
  if (!Array.isArray(input) || input.length > max) fail(reason);
  const axis = input.map(normalizeAxisEntry);
  const ids = axis.map((item) => item.dimension_id);
  if (new Set(ids).size !== ids.length) fail('PIVOT_AXIS_DIMENSION_DUPLICATE');
  return Object.freeze(axis);
}

function normalizeMeasures(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > CONTRACT.limits.max_measures) fail('PIVOT_MEASURES_INVALID');
  const output = input.map((item) => {
    exactKeys(item, ['id', 'aggregation'], 'PIVOT_MEASURE_SHAPE_INVALID');
    const id = String(item.id || '').trim();
    const aggregation = String(item.aggregation || '').trim();
    const definition = SEMANTIC.REGISTRY.measures[id];
    if (!definition) fail('PIVOT_MEASURE_UNKNOWN');
    if (definition.additive !== true || aggregation !== 'SUM' || !definition.allowed_aggregations.includes('SUM')) {
      fail('PIVOT_NON_ADDITIVE_MEASURE_UNSUPPORTED');
    }
    return Object.freeze({ id, aggregation: 'SUM' });
  });
  if (new Set(output.map((item) => item.id)).size !== output.length) fail('PIVOT_MEASURE_DUPLICATE');
  return Object.freeze(output);
}

function axisDimensionIds(rows, columns) {
  return rows.concat(columns).map((item) => item.dimension_id);
}

function pivotGrain(rows, columns) {
  const time = rows.concat(columns).find((item) => item.dimension_id === 'time_bucket');
  return time ? time.level : 'NONE';
}

function normalizeSort(input, rows, columns, measures) {
  if (input == null) return null;
  exactKeys(input, ['axis', 'by', 'key', 'direction'], 'PIVOT_SORT_SHAPE_INVALID');
  const axis = String(input.axis || '');
  const by = String(input.by || '');
  const key = String(input.key || '');
  const direction = String(input.direction || '');
  if (!AXES.includes(axis) || !SORT_BY.includes(by) || !DIRECTIONS.includes(direction)) fail('PIVOT_SORT_INVALID');
  const axisEntries = axis === 'ROWS' ? rows : columns;
  if (axisEntries.length === 0) fail('PIVOT_SORT_AXIS_EMPTY');
  if (by === 'KEY' && !axisEntries.some((item) => item.dimension_id === key)) fail('PIVOT_SORT_DIMENSION_NOT_ON_AXIS');
  if (by === 'MEASURE' && !measures.some((item) => item.id === key)) fail('PIVOT_SORT_MEASURE_NOT_SELECTED');
  return Object.freeze({ axis, by, key, direction });
}

function normalizeTopN(input, rows, columns, measures) {
  if (input == null) return null;
  exactKeys(input, ['axis', 'measure', 'n'], 'PIVOT_TOP_N_SHAPE_INVALID');
  const axis = String(input.axis || '');
  const measure = String(input.measure || '');
  const n = Number(input.n);
  if (!CONTRACT.top_n.axes.includes(axis)) fail('PIVOT_TOP_N_AXIS_INVALID');
  if ((axis === 'ROWS' ? rows : columns).length === 0) fail('PIVOT_TOP_N_AXIS_EMPTY');
  if (!measures.some((item) => item.id === measure)) fail('PIVOT_TOP_N_MEASURE_NOT_SELECTED');
  if (!Number.isInteger(n) || n < CONTRACT.top_n.min || n > CONTRACT.top_n.max) fail('PIVOT_TOP_N_INVALID');
  return Object.freeze({ axis, measure, n });
}

function normalizePivotSpec(input) {
  assertContract();
  exactKeys(input, ['schema', 'contract_version', 'rows', 'columns', 'measures', 'subtotals', 'grand_total', 'sort', 'top_n'], 'PIVOT_SPEC_SHAPE_INVALID');
  if (input.schema !== SPEC_SCHEMA || input.contract_version !== VERSION) fail('PIVOT_SPEC_VERSION_INVALID');
  const rows = normalizeAxis(input.rows, CONTRACT.axis.max_row_dimensions, 'PIVOT_ROWS_INVALID');
  const columns = normalizeAxis(input.columns, CONTRACT.axis.max_column_dimensions, 'PIVOT_COLUMNS_INVALID');
  const dimensionIds = axisDimensionIds(rows, columns);
  if (dimensionIds.length < 1 || dimensionIds.length > CONTRACT.axis.max_total_dimensions) fail('PIVOT_DIMENSION_COUNT_INVALID');
  if (new Set(dimensionIds).size !== dimensionIds.length) fail('PIVOT_DIMENSION_DUPLICATE_ACROSS_AXES');
  const measures = normalizeMeasures(input.measures);
  exactKeys(input.subtotals, ['rows', 'columns'], 'PIVOT_SUBTOTALS_SHAPE_INVALID');
  const subtotals = Object.freeze({ rows: input.subtotals.rows === true, columns: input.subtotals.columns === true });
  if (typeof input.grand_total !== 'boolean') fail('PIVOT_GRAND_TOTAL_INVALID');
  const grain = pivotGrain(rows, columns);
  const nonTimeDimensions = dimensionIds.filter((id) => id !== 'time_bucket');
  const semantic = SEMANTIC.validateSemanticSelection({
    measures: measures.map((item) => ({ id: item.id, aggregation: item.aggregation })),
    dimensions: nonTimeDimensions,
    grain
  });
  if (semantic.decision !== 'ALLOW') fail(`PIVOT_SEMANTIC_SELECTION_DENIED:${semantic.reason}`);
  const sort = normalizeSort(input.sort, rows, columns, measures);
  const topN = normalizeTopN(input.top_n, rows, columns, measures);
  return Object.freeze({
    schema: SPEC_SCHEMA,
    contract_version: VERSION,
    rows,
    columns,
    measures,
    subtotals,
    grand_total: input.grand_total,
    sort,
    top_n: topN
  });
}

function serializePivotSpec(input) {
  return stableStringify(normalizePivotSpec(input));
}

function pivotSpecHash(input) {
  return sha256(serializePivotSpec(input));
}

function dimensionKey(values) {
  return stableStringify(values || {});
}

function assertSourceResult(result, spec) {
  if (!result || result.schema !== ANALYTICS.RESULT_SCHEMA || result.contract_version !== ANALYTICS.CONTRACT_VERSION ||
      !Array.isArray(result.rows) || result.rows.length > CONTRACT.limits.max_source_rows ||
      result.truncated !== false || result.total_rows !== result.rows.length) {
    fail('PIVOT_ANALYTICS_RESULT_INCOMPLETE');
  }
  if (!result.provenance || result.provenance.financial_truth_policy !== 'FIN-TRUTH-v1' ||
      result.provenance.legacy_total_cells_used !== false || result.provenance.ui_logic_used !== false ||
      result.provenance.query_hash !== result.query_hash) {
    fail('PIVOT_ANALYTICS_PROVENANCE_INVALID');
  }
  if (!result.comparison || result.comparison.mode !== 'NONE') fail('PIVOT_ANALYTICS_COMPARISON_UNSUPPORTED');
  const expectedDimensions = axisDimensionIds(spec.rows, spec.columns).slice().sort();
  const expectedGrain = pivotGrain(spec.rows, spec.columns);
  if (String(result.grain || 'NONE') !== expectedGrain) fail('PIVOT_SOURCE_GRAIN_MISMATCH');
  const fullKeys = new Set();
  for (const row of result.rows) {
    if (!row || typeof row !== 'object' || !row.dimensions || typeof row.dimensions !== 'object' || Array.isArray(row.dimensions) ||
        !row.measures || typeof row.measures !== 'object' || Array.isArray(row.measures)) {
      fail('PIVOT_ANALYTICS_ROW_INVALID');
    }
    const actualDimensions = Object.keys(row.dimensions).sort();
    if (JSON.stringify(actualDimensions) !== JSON.stringify(expectedDimensions)) fail('PIVOT_SOURCE_DIMENSIONS_MISMATCH');
    const key = dimensionKey(row.dimensions);
    if (fullKeys.has(key)) fail('PIVOT_SOURCE_DIMENSION_DUPLICATE');
    fullKeys.add(key);
    for (const measure of spec.measures) safeInteger(row.measures[measure.id], 'PIVOT_MONEY_VALUE_INVALID');
    if (row.comparison_measures != null) fail('PIVOT_COMPARISON_MEASURES_UNSUPPORTED');
  }
  return result;
}

function axisValues(dimensions, entries) {
  const values = {};
  for (const entry of entries) values[entry.dimension_id] = dimensions[entry.dimension_id];
  return values;
}

function memberFromValues(values, kind = 'VALUE') {
  return Object.freeze({ key: kind === 'OTHER' ? OTHER_KEY : dimensionKey(values), values: Object.freeze({ ...values }), kind });
}

function collectMembers(rows, entries) {
  if (rows.length === 0) return Object.freeze([]);
  if (entries.length === 0) return Object.freeze([memberFromValues({})]);
  const members = new Map();
  for (const row of rows) {
    const values = axisValues(row.dimensions, entries);
    const member = memberFromValues(values);
    if (!members.has(member.key)) members.set(member.key, member);
  }
  return Object.freeze(Array.from(members.values()).sort((a, b) => a.key.localeCompare(b.key)));
}

function cellKey(rowKey, columnKey) {
  return `${rowKey.length}:${rowKey}${columnKey}`;
}

function emptyMeasures(spec) {
  const output = {};
  for (const measure of spec.measures) output[measure.id] = 0;
  return output;
}

function buildSourceCells(source, spec, rowMembers, columnMembers) {
  const cells = new Map();
  if (source.rows.length === 0) return cells;
  const rowByKey = new Set(rowMembers.map((item) => item.key));
  const columnByKey = new Set(columnMembers.map((item) => item.key));
  for (const sourceRow of source.rows) {
    const rowKey = spec.rows.length === 0 ? rowMembers[0].key : dimensionKey(axisValues(sourceRow.dimensions, spec.rows));
    const columnKey = spec.columns.length === 0 ? columnMembers[0].key : dimensionKey(axisValues(sourceRow.dimensions, spec.columns));
    if (!rowByKey.has(rowKey) || !columnByKey.has(columnKey)) fail('PIVOT_MEMBER_RESOLUTION_FAILED');
    const key = cellKey(rowKey, columnKey);
    if (cells.has(key)) fail('PIVOT_SOURCE_CELL_DUPLICATE');
    const measures = {};
    for (const measure of spec.measures) measures[measure.id] = sourceRow.measures[measure.id];
    cells.set(key, { row_key: rowKey, column_key: columnKey, measures, source_count: 1 });
  }
  return cells;
}

function aggregateAxisMeasure(members, cells, axis, measureId) {
  const totals = new Map(members.map((member) => [member.key, 0]));
  for (const cell of cells.values()) {
    const key = axis === 'ROWS' ? cell.row_key : cell.column_key;
    if (!totals.has(key)) fail('PIVOT_AXIS_AGGREGATION_MEMBER_MISSING');
    totals.set(key, safeAdd(totals.get(key), cell.measures[measureId]));
  }
  return totals;
}

function calculatedTopNKeys(source, members, cells, axis, measure, n) {
  const totals = aggregateAxisMeasure(members, cells, axis, measure);
  const syntheticRows = members.map((member) => Object.freeze({
    dimensions: Object.freeze({ pivot_axis_key: member.key }),
    measures: Object.freeze({ [measure]: totals.get(member.key) })
  }));
  const synthetic = Object.freeze({
    schema: ANALYTICS.RESULT_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    query_hash: source.query_hash,
    currency: source.currency,
    time_range: source.time_range,
    grain: 'NONE',
    comparison: Object.freeze({ mode: 'NONE', time_range: null }),
    total_rows: syntheticRows.length,
    truncated: false,
    rows: Object.freeze(syntheticRows),
    provenance: Object.freeze({
      contract_version: ANALYTICS.CONTRACT_VERSION,
      query_hash: source.query_hash,
      canonical_schema: source.provenance.canonical_schema,
      kpi_dictionary_version: source.provenance.kpi_dictionary_version,
      financial_truth_policy: 'FIN-TRUTH-v1',
      input_revision: source.provenance.input_revision,
      legacy_total_cells_used: false,
      ui_logic_used: false
    })
  });
  const calculated = CALC.evaluateCalculatedMetric(synthetic, {
    schema: CALC.SPEC_SCHEMA,
    contract_version: CALC.VERSION,
    operator: 'TOP_N_OTHER',
    measure,
    options: { n }
  });
  const kept = calculated.rows.filter((row) => row.bucket_kind === 'TOP').map((row) => row.dimensions.pivot_axis_key);
  const other = calculated.rows.some((row) => row.bucket_kind === 'OTHER');
  return Object.freeze({ kept: Object.freeze(kept), other, source_total_minor: calculated.source_total_minor, output_total_minor: calculated.output_total_minor });
}

function otherMember(entries) {
  const values = {};
  for (const entry of entries) values[entry.dimension_id] = OTHER_KEY;
  return memberFromValues(values, 'OTHER');
}

function remapCellsForTopN(cells, spec, axis, keptSet, hasOther) {
  const output = new Map();
  for (const cell of cells.values()) {
    const originalAxisKey = axis === 'ROWS' ? cell.row_key : cell.column_key;
    const mappedAxisKey = keptSet.has(originalAxisKey) ? originalAxisKey : hasOther ? OTHER_KEY : originalAxisKey;
    const rowKey = axis === 'ROWS' ? mappedAxisKey : cell.row_key;
    const columnKey = axis === 'COLUMNS' ? mappedAxisKey : cell.column_key;
    const key = cellKey(rowKey, columnKey);
    if (!output.has(key)) output.set(key, { row_key: rowKey, column_key: columnKey, measures: emptyMeasures(spec), source_count: 0 });
    const target = output.get(key);
    for (const measure of spec.measures) target.measures[measure.id] = safeAdd(target.measures[measure.id], cell.measures[measure.id]);
    target.source_count += cell.source_count;
  }
  return output;
}

function applyTopN(source, spec, rowMembers, columnMembers, cells) {
  if (!spec.top_n || source.rows.length === 0) return { rowMembers, columnMembers, cells, evidence: null };
  const axis = spec.top_n.axis;
  const members = axis === 'ROWS' ? rowMembers : columnMembers;
  const entries = axis === 'ROWS' ? spec.rows : spec.columns;
  const calculated = calculatedTopNKeys(source, members, cells, axis, spec.top_n.measure, spec.top_n.n);
  const byKey = new Map(members.map((member) => [member.key, member]));
  const selected = calculated.kept.map((key) => {
    const member = byKey.get(key);
    if (!member) fail('PIVOT_TOP_N_MEMBER_MISSING');
    return member;
  });
  if (calculated.other) selected.push(otherMember(entries));
  const keptSet = new Set(calculated.kept);
  const remapped = remapCellsForTopN(cells, spec, axis, keptSet, calculated.other);
  const output = {
    rowMembers: axis === 'ROWS' ? Object.freeze(selected) : rowMembers,
    columnMembers: axis === 'COLUMNS' ? Object.freeze(selected) : columnMembers,
    cells: remapped,
    evidence: Object.freeze({
      axis,
      measure: spec.top_n.measure,
      n: spec.top_n.n,
      other_included: calculated.other,
      source_total_minor: calculated.source_total_minor,
      output_total_minor: calculated.output_total_minor,
      operator: `${CALC.SCHEMA}@${CALC.VERSION}:TOP_N_OTHER`
    })
  };
  return output;
}

function compareValue(left, right) {
  if (left === right) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  return String(left).localeCompare(String(right));
}

function sortedMembers(members, cells, axis, sort) {
  if (!sort || sort.axis !== axis || members.length < 2) return members;
  let totals = null;
  if (sort.by === 'MEASURE') totals = aggregateAxisMeasure(members, cells, axis, sort.key);
  return Object.freeze(members.slice().sort((left, right) => {
    if (left.kind === 'OTHER' && right.kind !== 'OTHER') return 1;
    if (right.kind === 'OTHER' && left.kind !== 'OTHER') return -1;
    let comparison = 0;
    if (sort.by === 'KEY') comparison = compareValue(left.values[sort.key], right.values[sort.key]);
    else {
      const lv = totals.get(left.key);
      const rv = totals.get(right.key);
      comparison = lv === rv ? 0 : lv < rv ? -1 : 1;
    }
    if (comparison !== 0) return sort.direction === 'DESC' ? -comparison : comparison;
    return left.key.localeCompare(right.key);
  }));
}

function outputCells(spec, rowMembers, columnMembers, cells) {
  if (rowMembers.length === 0 || columnMembers.length === 0) return Object.freeze([]);
  const cellCount = rowMembers.length * columnMembers.length;
  if (cellCount > CONTRACT.limits.max_cells) fail('PIVOT_CELL_LIMIT_EXCEEDED');
  const output = [];
  for (const row of rowMembers) {
    for (const column of columnMembers) {
      const source = cells.get(cellKey(row.key, column.key));
      output.push(Object.freeze({
        row_key: row.key,
        column_key: column.key,
        measures: Object.freeze(source ? { ...source.measures } : emptyMeasures(spec)),
        sparse_zero: source == null,
        source_count: source ? source.source_count : 0
      }));
    }
  }
  return Object.freeze(output);
}

function measureTotalsFromCells(spec, cells) {
  const totals = emptyMeasures(spec);
  for (const cell of cells) {
    for (const measure of spec.measures) totals[measure.id] = safeAdd(totals[measure.id], cell.measures[measure.id]);
  }
  return totals;
}

function measureTotalsFromSource(spec, source) {
  const totals = emptyMeasures(spec);
  for (const row of source.rows) {
    for (const measure of spec.measures) totals[measure.id] = safeAdd(totals[measure.id], row.measures[measure.id]);
  }
  return totals;
}

function prefixValues(member, entries, prefixLength) {
  const values = {};
  for (let index = 0; index < prefixLength; index += 1) {
    values[entries[index].dimension_id] = member.values[entries[index].dimension_id];
  }
  return values;
}

function buildAxisSubtotals(spec, axis, members, oppositeMembers, cells) {
  const entries = axis === 'ROWS' ? spec.rows : spec.columns;
  const enabled = axis === 'ROWS' ? spec.subtotals.rows : spec.subtotals.columns;
  if (!enabled || entries.length < 2 || members.length === 0) return [];
  const output = [];
  for (let prefixLength = 1; prefixLength < entries.length; prefixLength += 1) {
    const groups = new Map();
    for (const member of members) {
      const values = prefixValues(member, entries, prefixLength);
      const key = dimensionKey(values);
      if (!groups.has(key)) groups.set(key, { values, memberKeys: [] });
      groups.get(key).memberKeys.push(member.key);
    }
    for (const [key, group] of Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      const totals = emptyMeasures(spec);
      for (const memberKey of group.memberKeys) {
        for (const opposite of oppositeMembers) {
          const rowKey = axis === 'ROWS' ? memberKey : opposite.key;
          const columnKey = axis === 'COLUMNS' ? memberKey : opposite.key;
          const cell = cells.get(cellKey(rowKey, columnKey));
          if (!cell) continue;
          for (const measure of spec.measures) totals[measure.id] = safeAdd(totals[measure.id], cell.measures[measure.id]);
        }
      }
      output.push(Object.freeze({
        axis,
        prefix_length: prefixLength,
        key,
        dimensions: Object.freeze({ ...group.values }),
        measures: Object.freeze(totals)
      }));
      if (output.length > CONTRACT.limits.max_subtotals) fail('PIVOT_SUBTOTAL_LIMIT_EXCEEDED');
    }
  }
  return output;
}

function evaluatePivot(sourceInput, specInput) {
  const spec = normalizePivotSpec(specInput);
  const source = assertSourceResult(sourceInput, spec);
  let rowMembers = collectMembers(source.rows, spec.rows);
  let columnMembers = collectMembers(source.rows, spec.columns);
  let cells = buildSourceCells(source, spec, rowMembers, columnMembers);

  const topN = applyTopN(source, spec, rowMembers, columnMembers, cells);
  rowMembers = topN.rowMembers;
  columnMembers = topN.columnMembers;
  cells = topN.cells;

  rowMembers = sortedMembers(rowMembers, cells, 'ROWS', spec.sort);
  columnMembers = sortedMembers(columnMembers, cells, 'COLUMNS', spec.sort);
  const renderedCells = outputCells(spec, rowMembers, columnMembers, cells);
  const sourceTotals = measureTotalsFromSource(spec, source);
  const outputTotals = measureTotalsFromCells(spec, renderedCells);
  for (const measure of spec.measures) {
    if (sourceTotals[measure.id] !== outputTotals[measure.id]) fail('PIVOT_GRAND_TOTAL_RECONCILIATION_FAILED');
  }
  const rowSubtotals = buildAxisSubtotals(spec, 'ROWS', rowMembers, columnMembers, cells);
  const columnSubtotals = buildAxisSubtotals(spec, 'COLUMNS', columnMembers, rowMembers, cells);
  const subtotalCount = rowSubtotals.length + columnSubtotals.length;

  const body = {
    schema: RESULT_SCHEMA,
    contract_version: VERSION,
    spec_hash: pivotSpecHash(spec),
    source_query_hash: source.query_hash,
    currency: source.currency,
    rows: spec.rows,
    columns: spec.columns,
    measures: spec.measures,
    row_members: rowMembers,
    column_members: columnMembers,
    cells: renderedCells,
    row_subtotals: Object.freeze(rowSubtotals),
    column_subtotals: Object.freeze(columnSubtotals),
    grand_total: spec.grand_total ? Object.freeze({ measures: Object.freeze({ ...sourceTotals }) }) : null,
    top_n_evidence: topN.evidence,
    provenance: Object.freeze({
      pivot_olap: `${SCHEMA}@${VERSION}`,
      analytics_contract: `PRH_ANALYTICS_CONTRACT_V1@${ANALYTICS.CONTRACT_VERSION}`,
      semantic_registry: `${SEMANTIC.SCHEMA}@${SEMANTIC.VERSION}`,
      calculated_metrics: `${CALC.SCHEMA}@${CALC.VERSION}`,
      financial_truth_policy: 'FIN-TRUTH-v1',
      source_query_hash: source.query_hash,
      source_input_revision: source.provenance.input_revision,
      kpi_formula_redefined: false,
      non_additive_guessing: false,
      renderer_used: false,
      storage_used: false,
      network_used: false,
      financial_write: false
    })
  };
  const resultHash = sha256(stableStringify(body));
  return Object.freeze({ ...body, result_hash: resultHash, subtotal_count: subtotalCount });
}

function copySpec(spec) {
  return {
    schema: spec.schema,
    contract_version: spec.contract_version,
    rows: spec.rows.map((item) => ({ ...item })),
    columns: spec.columns.map((item) => ({ ...item })),
    measures: spec.measures.map((item) => ({ ...item })),
    subtotals: { ...spec.subtotals },
    grand_total: spec.grand_total,
    sort: spec.sort == null ? null : { ...spec.sort },
    top_n: spec.top_n == null ? null : { ...spec.top_n }
  };
}

function currentQueryMatchesSpec(query, spec) {
  const expectedDimensions = axisDimensionIds(spec.rows, spec.columns).filter((id) => id !== 'time_bucket');
  if (!setEqual(query.dimensions, expectedDimensions)) return false;
  if (!setEqual(query.measures, spec.measures.map((item) => item.id))) return false;
  if (query.grain !== pivotGrain(spec.rows, spec.columns) || query.comparison.mode !== 'NONE') return false;
  return true;
}

function deriveHierarchyRequery(baseQueryInput, specInput, transitionInput) {
  const spec = normalizePivotSpec(specInput);
  const baseQuery = ANALYTICS.normalizeAnalyticsQuery(baseQueryInput);
  if (!currentQueryMatchesSpec(baseQuery, spec)) fail('PIVOT_BASE_QUERY_SPEC_MISMATCH');
  exactKeys(transitionInput, ['axis', 'index', 'action'], 'PIVOT_HIERARCHY_TRANSITION_SHAPE_INVALID');
  const axis = String(transitionInput.axis || '');
  const index = Number(transitionInput.index);
  const action = String(transitionInput.action || '');
  if (!AXES.includes(axis) || !Number.isInteger(index) || index < 0 || !HIERARCHY_ACTIONS.includes(action)) {
    fail('PIVOT_HIERARCHY_TRANSITION_INVALID');
  }
  const entries = axis === 'ROWS' ? spec.rows : spec.columns;
  if (index >= entries.length) fail('PIVOT_HIERARCHY_AXIS_INDEX_INVALID');
  const entry = entries[index];
  if (!entry.hierarchy_id) fail('PIVOT_HIERARCHY_AXIS_REQUIRED');
  const hierarchy = SEMANTIC.REGISTRY.hierarchies[entry.hierarchy_id];
  if (!hierarchy) fail('PIVOT_HIERARCHY_UNKNOWN');
  const levelIndex = hierarchy.levels.indexOf(entry.level);
  if (levelIndex < 0) fail('PIVOT_HIERARCHY_LEVEL_UNKNOWN');
  const targetIndex = action === 'EXPAND' ? levelIndex + 1 : levelIndex - 1;
  if (targetIndex < 0 || targetIndex >= hierarchy.levels.length) fail('PIVOT_HIERARCHY_BOUNDARY_REACHED');
  const targetLevel = hierarchy.levels[targetIndex];
  const validation = action === 'EXPAND'
    ? SEMANTIC.validateHierarchyTransition({ hierarchy_id: entry.hierarchy_id, from_level: entry.level, to_level: targetLevel })
    : SEMANTIC.validateHierarchyTransition({ hierarchy_id: entry.hierarchy_id, from_level: targetLevel, to_level: entry.level });
  if (validation.decision !== 'ALLOW') fail(`PIVOT_HIERARCHY_TRANSITION_DENIED:${validation.reason}`);

  const nextSpecRaw = copySpec(spec);
  nextSpecRaw[axis === 'ROWS' ? 'rows' : 'columns'][index].level = targetLevel;
  const nextSpec = normalizePivotSpec(nextSpecRaw);
  const nextQuery = ANALYTICS.normalizeAnalyticsQuery({
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: baseQuery.currency,
    measures: nextSpec.measures.map((item) => item.id),
    dimensions: axisDimensionIds(nextSpec.rows, nextSpec.columns).filter((id) => id !== 'time_bucket'),
    filters: baseQuery.filters,
    time_range: baseQuery.time_range,
    grain: pivotGrain(nextSpec.rows, nextSpec.columns),
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: baseQuery.limit
  });
  return Object.freeze({
    schema: REQUERY_SCHEMA,
    contract_version: VERSION,
    action,
    hierarchy_id: entry.hierarchy_id,
    from_level: entry.level,
    to_level: targetLevel,
    previous_query_hash: ANALYTICS.analyticsQueryHash(baseQuery),
    next_query_hash: ANALYTICS.analyticsQueryHash(nextQuery),
    pivot_spec: nextSpec,
    analytics_query: nextQuery,
    provenance: Object.freeze({
      semantic_registry: `${SEMANTIC.SCHEMA}@${SEMANTIC.VERSION}`,
      analytics_contract: `PRH_ANALYTICS_CONTRACT_V1@${ANALYTICS.CONTRACT_VERSION}`,
      implicit_detail_synthesis: false,
      query_reexecution_required: true
    })
  });
}

function bucketTimeRange(value, level) {
  const text = String(value == null ? '' : value);
  if (level === 'YEAR') {
    if (!/^\d{4}$/.test(text)) fail('PIVOT_DRILL_TIME_VALUE_INVALID');
    const year = Number(text);
    return { start: `${text}-01-01`, end: `${String(year + 1).padStart(4, '0')}-01-01` };
  }
  if (level === 'MONTH') {
    if (!/^\d{4}-\d{2}$/.test(text)) fail('PIVOT_DRILL_TIME_VALUE_INVALID');
    const [yearText, monthText] = text.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (month < 1 || month > 12) fail('PIVOT_DRILL_TIME_VALUE_INVALID');
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return { start: `${yearText}-${monthText}-01`, end: `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01` };
  }
  if (level === 'DAY') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) fail('PIVOT_DRILL_TIME_VALUE_INVALID');
    const timestamp = Date.parse(`${text}T00:00:00Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== text) fail('PIVOT_DRILL_TIME_VALUE_INVALID');
    return { start: text, end: new Date(timestamp + 86400000).toISOString().slice(0, 10) };
  }
  fail('PIVOT_DRILL_TIME_LEVEL_INVALID');
}

function mergeCellFilters(baseFilters, dimensionValues) {
  const byField = new Map();
  for (const filter of baseFilters) byField.set(filter.field, filter);
  for (const [field, rawValue] of Object.entries(dimensionValues)) {
    if (field === 'time_bucket') continue;
    if (rawValue == null) fail('PIVOT_DRILL_NULL_DIMENSION_UNSUPPORTED');
    const value = String(rawValue);
    const existing = byField.get(field);
    if (existing && !existing.values.includes(value)) fail('PIVOT_DRILL_SOURCE_FILTER_CONFLICT');
    byField.set(field, Object.freeze({ field, operator: 'EQ', values: Object.freeze([value]) }));
  }
  return Array.from(byField.values()).map((item) => ({ field: item.field, operator: item.operator, values: Array.from(item.values) }));
}

function normalizePivotResult(result, spec, source) {
  if (!result || result.schema !== RESULT_SCHEMA || result.contract_version !== VERSION ||
      result.spec_hash !== pivotSpecHash(spec) || result.source_query_hash !== source.query_hash ||
      !Array.isArray(result.row_members) || !Array.isArray(result.column_members) || !Array.isArray(result.cells)) {
    fail('PIVOT_RESULT_INVALID');
  }
  return result;
}

function buildDrillDescriptor(sourceInput, specInput, pivotResultInput, baseQueryInput, selectionInput) {
  const spec = normalizePivotSpec(specInput);
  const source = assertSourceResult(sourceInput, spec);
  const pivot = normalizePivotResult(pivotResultInput, spec, source);
  const baseQuery = ANALYTICS.normalizeAnalyticsQuery(baseQueryInput);
  if (ANALYTICS.analyticsQueryHash(baseQuery) !== source.query_hash || !currentQueryMatchesSpec(baseQuery, spec)) {
    fail('PIVOT_DRILL_BASE_QUERY_MISMATCH');
  }
  exactKeys(selectionInput, ['row_key', 'column_key', 'measure', 'source_widget_id', 'target'], 'PIVOT_DRILL_SELECTION_SHAPE_INVALID');
  const measure = String(selectionInput.measure || '');
  if (!spec.measures.some((item) => item.id === measure)) fail('PIVOT_DRILL_MEASURE_NOT_SELECTED');
  const rowMember = pivot.row_members.find((item) => item.key === selectionInput.row_key);
  const columnMember = pivot.column_members.find((item) => item.key === selectionInput.column_key);
  if (!rowMember || !columnMember) fail('PIVOT_DRILL_MEMBER_NOT_FOUND');
  if (rowMember.kind === 'OTHER' || columnMember.kind === 'OTHER') fail('PIVOT_DRILL_OTHER_UNSUPPORTED');
  const values = Object.freeze({ ...rowMember.values, ...columnMember.values });
  const timeEntry = spec.rows.concat(spec.columns).find((item) => item.dimension_id === 'time_bucket');
  const timeRange = timeEntry ? bucketTimeRange(values.time_bucket, timeEntry.level) : baseQuery.time_range;
  const filters = mergeCellFilters(baseQuery.filters, values);
  const query = ANALYTICS.normalizeAnalyticsQuery({
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: baseQuery.currency,
    measures: [measure],
    dimensions: [],
    filters,
    time_range: timeRange,
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 1
  });
  const filterContext = VIZ.normalizeFilterContext({
    schema: VIZ.FILTER_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    filters: Object.entries(values).filter(([field]) => field !== 'time_bucket').map(([field, value]) => {
      if (value == null) fail('PIVOT_DRILL_NULL_DIMENSION_UNSUPPORTED');
      return { kind: 'DIMENSION', field, operator: 'INCLUDE', values: [String(value)] };
    })
  });
  const drillContext = VIZ.normalizeDrillContext({
    schema: VIZ.DRILL_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    source_widget_id: safeId(selectionInput.source_widget_id, 'PIVOT_DRILL_WIDGET_ID_INVALID'),
    target: String(selectionInput.target || ''),
    filter_context: {
      schema: filterContext.schema,
      contract_version: filterContext.contract_version,
      filters: filterContext.filters
    }
  });
  return Object.freeze({
    schema: DRILL_SCHEMA,
    contract_version: VERSION,
    spec_hash: pivot.spec_hash,
    source_query_hash: source.query_hash,
    measure,
    analytics_query: query,
    drill_context: drillContext,
    time_range: timeRange == null ? null : Object.freeze({ ...timeRange }),
    provenance: Object.freeze({
      pivot_olap: `${SCHEMA}@${VERSION}`,
      visualization_foundation: `${VIZ.FOUNDATION_SCHEMA}@${VIZ.VERSION}`,
      financial_truth_policy: 'FIN-TRUTH-v1',
      runtime_private_descriptor: true,
      persisted_in_pivot_spec: false,
      public_telemetry_payload: false
    })
  });
}

function pivotTelemetry(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.contract_version !== VERSION) fail('PIVOT_RESULT_INVALID');
  const output = Object.freeze({
    schema: SCHEMA,
    version: VERSION,
    spec_hash: result.spec_hash,
    source_query_hash: result.source_query_hash,
    row_axis_count: result.rows.length,
    column_axis_count: result.columns.length,
    measure_count: result.measures.length,
    row_member_count: result.row_members.length,
    column_member_count: result.column_members.length,
    cell_count: result.cells.length,
    subtotal_count: result.subtotal_count,
    top_n_axis: result.top_n_evidence ? result.top_n_evidence.axis : null,
    hierarchy_active: result.rows.concat(result.columns).some((item) => item.hierarchy_id != null),
    decision: 'ALLOW',
    reason: 'OK',
    semantic_registry_version: SEMANTIC.VERSION,
    calculated_metrics_version: CALC.VERSION,
    financial_truth_policy: result.provenance.financial_truth_policy
  });
  if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) {
    fail('PIVOT_TELEMETRY_CONTRACT_MISMATCH');
  }
  return output;
}

module.exports = Object.freeze({
  SCHEMA,
  VERSION,
  SPEC_SCHEMA,
  RESULT_SCHEMA,
  DRILL_SCHEMA,
  REQUERY_SCHEMA,
  CONTRACT,
  assertContract,
  normalizePivotSpec,
  serializePivotSpec,
  pivotSpecHash,
  evaluatePivot,
  deriveHierarchyRequery,
  buildDrillDescriptor,
  pivotTelemetry
});
