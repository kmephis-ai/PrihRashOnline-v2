'use strict';

const crypto = require('crypto');
const CONTRACT = require('./analytics_contract.v1.json');
const {
  SCHEMA_ID: CANONICAL_SCHEMA,
  validateCanonicalCollection
} = require('../domain/canonical_transaction');
const {
  DICTIONARY,
  evaluateKpis
} = require('../finance/kpi_dictionary');
const { repositoryRevision } = require('../repository/transaction_repository');

const CONTRACT_SCHEMA = 'PRH_ANALYTICS_CONTRACT_V1';
const CONTRACT_VERSION = '1.0.0';
const QUERY_SCHEMA = 'PRH_ANALYTICS_QUERY_V1';
const RESULT_SCHEMA = 'PRH_ANALYTICS_RESULT_V1';
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const QUERY_KEYS = Object.freeze([
  'schema', 'contract_version', 'currency', 'measures', 'dimensions', 'filters',
  'time_range', 'grain', 'comparison', 'sort', 'parameters', 'limit'
]);
const FILTER_FIELDS = Object.freeze(CONTRACT.filters.fields.slice());
const DIMENSIONS = Object.freeze(CONTRACT.dimensions.slice());
const MEASURES = Object.freeze(CONTRACT.measures.slice());
const GRAINS = Object.freeze(CONTRACT.time.grains.slice());
const COMPARISON_MODES = Object.freeze(CONTRACT.comparison_modes.slice());
const MEASURE_OUTPUTS = Object.freeze({
  INCOME: 'income_minor',
  EXPENSE: 'expense_minor',
  CASH_FLOW: 'cash_flow_minor',
  SAVINGS: 'savings_minor',
  BUDGET_VARIANCE: 'budget_variance_minor',
  GROSS_EXPENSE: 'gross_expense_minor',
  REFUND: 'refund_minor',
  TRANSFER: 'transfer_minor'
});

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== CONTRACT_SCHEMA || CONTRACT.version !== CONTRACT_VERSION ||
      CONTRACT.query_schema !== QUERY_SCHEMA || CONTRACT.result_schema !== RESULT_SCHEMA) {
    fail('ANALYTICS_CONTRACT_VERSION_INVALID');
  }
  if (CONTRACT.canonical_transaction_schema !== CANONICAL_SCHEMA ||
      CONTRACT.kpi_dictionary_schema !== 'PRH_KPI_DICTIONARY_V1' ||
      CONTRACT.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('ANALYTICS_UPSTREAM_CONTRACT_MISMATCH');
  }
  if (CONTRACT.renderer_neutral !== true || CONTRACT.storage_neutral !== true ||
      CONTRACT.ui_logic_authoritative !== false || CONTRACT.authorities.io !== false ||
      CONTRACT.authorities.network !== false || CONTRACT.authorities.financial_write !== false ||
      CONTRACT.authorities.ui !== false) {
    fail('ANALYTICS_AUTHORITY_CONTRACT_INVALID');
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

function isoDay(value, reason) {
  const text = String(value || '');
  if (!ISO_DAY_RE.test(text)) fail(reason);
  const parsed = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) fail(reason);
  return text;
}

function dayNumber(day) {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
}

function dayFromNumber(number) {
  return new Date(number * 86400000).toISOString().slice(0, 10);
}

function normalizeStringArray(value, allowed, max, reason, preserveOrder = true) {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) fail(reason);
  const items = value.map((item) => String(item || '').trim());
  if (items.some((item) => !allowed.includes(item))) fail(reason);
  if (new Set(items).size !== items.length) fail(reason);
  return Object.freeze(preserveOrder ? items : items.slice().sort());
}

function normalizeOptionalStringArray(value, allowed, max, reason, preserveOrder = true) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) fail(reason);
  if (value.length === 0) return Object.freeze([]);
  return normalizeStringArray(value, allowed, max, reason, preserveOrder);
}

function normalizeFilterValue(field, raw) {
  if (field === 'type') {
    const value = String(raw || '').trim();
    if (!['income', 'expense', 'transfer', 'refund', 'adjustment'].includes(value)) fail('ANALYTICS_FILTER_VALUE_INVALID');
    return value;
  }
  if (field === 'status') {
    const value = String(raw || '').trim();
    if (!['posted', 'pending', 'void'].includes(value)) fail('ANALYTICS_FILTER_VALUE_INVALID');
    return value;
  }
  const value = String(raw == null ? '' : raw).trim();
  if (!value || value.length > 128) fail('ANALYTICS_FILTER_VALUE_INVALID');
  if (field !== 'tag' && !ID_RE.test(value)) fail('ANALYTICS_FILTER_VALUE_INVALID');
  if (field === 'tag' && value.length > 64) fail('ANALYTICS_FILTER_VALUE_INVALID');
  return value;
}

function normalizeFilters(value) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > CONTRACT.limits.max_filters) fail('ANALYTICS_FILTERS_INVALID');
  const normalized = value.map((filter) => {
    exactKeys(filter, ['field', 'operator', 'values'], 'ANALYTICS_FILTER_SHAPE_INVALID');
    const field = String(filter.field || '');
    const operator = String(filter.operator || '');
    if (!FILTER_FIELDS.includes(field) || !CONTRACT.filters.operators.includes(operator)) fail('ANALYTICS_FILTER_OPERATOR_INVALID');
    if (!Array.isArray(filter.values) || filter.values.length < 1 || filter.values.length > CONTRACT.limits.max_filter_values) {
      fail('ANALYTICS_FILTER_VALUES_INVALID');
    }
    if (operator === 'EQ' && filter.values.length !== 1) fail('ANALYTICS_FILTER_EQ_ARITY_INVALID');
    const values = filter.values.map((item) => normalizeFilterValue(field, item)).sort();
    if (new Set(values).size !== values.length) fail('ANALYTICS_FILTER_VALUES_DUPLICATE');
    return Object.freeze({ field, operator, values: Object.freeze(values) });
  });
  const signatures = normalized.map((item) => stableStringify(item));
  if (new Set(signatures).size !== signatures.length) fail('ANALYTICS_FILTER_DUPLICATE');
  return Object.freeze(normalized.slice().sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))));
}

function normalizeTimeRange(value) {
  if (value == null) return null;
  exactKeys(value, ['start', 'end'], 'ANALYTICS_TIME_RANGE_SHAPE_INVALID');
  const start = isoDay(value.start, 'ANALYTICS_TIME_START_INVALID');
  const end = isoDay(value.end, 'ANALYTICS_TIME_END_INVALID');
  if (start >= end) fail('ANALYTICS_TIME_RANGE_INVALID');
  return Object.freeze({ start, end });
}

function normalizeComparison(value) {
  if (value == null) return Object.freeze({ mode: 'NONE' });
  exactKeys(value, ['mode'], 'ANALYTICS_COMPARISON_SHAPE_INVALID');
  const mode = String(value.mode || '');
  if (!COMPARISON_MODES.includes(mode)) fail('ANALYTICS_COMPARISON_MODE_INVALID');
  return Object.freeze({ mode });
}

function normalizeSort(value, measures, dimensions, grain) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > 4) fail('ANALYTICS_SORT_INVALID');
  const normalized = value.map((item) => {
    exactKeys(item, ['kind', 'key', 'direction'], 'ANALYTICS_SORT_SHAPE_INVALID');
    const kind = String(item.kind || '');
    const key = String(item.key || '');
    const direction = String(item.direction || '');
    if (!CONTRACT.sort.keys.includes(kind) || !CONTRACT.sort.directions.includes(direction)) fail('ANALYTICS_SORT_INVALID');
    if (kind === 'MEASURE' && !measures.includes(key)) fail('ANALYTICS_SORT_MEASURE_NOT_SELECTED');
    if (kind === 'DIMENSION') {
      const selected = dimensions.includes(key) || (key === 'time_bucket' && grain !== 'NONE');
      if (!selected) fail('ANALYTICS_SORT_DIMENSION_NOT_SELECTED');
    }
    return Object.freeze({ kind, key, direction });
  });
  const signatures = normalized.map((item) => `${item.kind}:${item.key}`);
  if (new Set(signatures).size !== signatures.length) fail('ANALYTICS_SORT_DUPLICATE');
  return Object.freeze(normalized);
}

function normalizeParameters(value, measures, dimensions, grain) {
  if (value == null) value = {};
  exactKeys(value, ['budget_minor'], 'ANALYTICS_PARAMETERS_SHAPE_INVALID');
  const budgetMinor = value.budget_minor == null ? null : Number(value.budget_minor);
  if (budgetMinor != null && (!Number.isSafeInteger(budgetMinor) || budgetMinor < 0)) fail('ANALYTICS_BUDGET_INVALID');
  if (measures.includes('BUDGET_VARIANCE')) {
    if (budgetMinor == null) fail('ANALYTICS_BUDGET_REQUIRED');
    if (dimensions.length > 0 || grain !== 'NONE') fail('ANALYTICS_BUDGET_GROUPING_UNSUPPORTED');
  } else if (budgetMinor != null) {
    fail('ANALYTICS_BUDGET_WITHOUT_MEASURE');
  }
  return Object.freeze({ budget_minor: budgetMinor });
}

function normalizeAnalyticsQuery(input) {
  assertContract();
  exactKeys(input, QUERY_KEYS, 'ANALYTICS_QUERY_SHAPE_INVALID');
  if (input.schema !== QUERY_SCHEMA || input.contract_version !== CONTRACT_VERSION) fail('ANALYTICS_QUERY_VERSION_INVALID');
  const currency = String(input.currency || '').toUpperCase();
  if (!CURRENCY_RE.test(currency)) fail('ANALYTICS_CURRENCY_INVALID');
  const measures = normalizeStringArray(input.measures, MEASURES, CONTRACT.limits.max_measures, 'ANALYTICS_MEASURES_INVALID', true);
  const dimensions = normalizeOptionalStringArray(
    input.dimensions,
    DIMENSIONS,
    CONTRACT.limits.max_dimensions,
    'ANALYTICS_DIMENSIONS_INVALID',
    true
  );
  const filters = normalizeFilters(input.filters);
  const timeRange = normalizeTimeRange(input.time_range);
  const grain = String(input.grain == null ? 'NONE' : input.grain);
  if (!GRAINS.includes(grain)) fail('ANALYTICS_GRAIN_INVALID');
  if (grain !== 'NONE' && !timeRange) fail('ANALYTICS_GRAIN_REQUIRES_TIME_RANGE');
  const comparison = normalizeComparison(input.comparison);
  if (comparison.mode !== 'NONE' && !timeRange) fail('ANALYTICS_COMPARISON_REQUIRES_TIME_RANGE');
  if (comparison.mode !== 'NONE' && grain !== 'NONE') fail('ANALYTICS_COMPARISON_GRAIN_UNSUPPORTED');
  const parameters = normalizeParameters(input.parameters, measures, dimensions, grain);
  const sort = normalizeSort(input.sort, measures, dimensions, grain);
  const limit = input.limit == null ? CONTRACT.limits.max_rows : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > CONTRACT.limits.max_rows) fail('ANALYTICS_LIMIT_INVALID');
  return Object.freeze({
    schema: QUERY_SCHEMA,
    contract_version: CONTRACT_VERSION,
    currency,
    measures,
    dimensions,
    filters,
    time_range: timeRange,
    grain,
    comparison,
    sort,
    parameters,
    limit
  });
}

function analyticsQueryHash(queryInput) {
  return sha256(stableStringify(normalizeAnalyticsQuery(queryInput)));
}

function filterFieldValue(tx, field) {
  if (field === 'tag') return tx.tags;
  return tx[field];
}

function filterMatches(tx, filter) {
  const actual = filterFieldValue(tx, filter.field);
  if (filter.field === 'tag') return actual.some((tag) => filter.values.includes(tag));
  return filter.values.includes(actual == null ? '' : String(actual));
}

function inTimeRange(tx, range) {
  if (!range) return true;
  const day = tx.occurred_at.slice(0, 10);
  return day >= range.start && day < range.end;
}

function applyAnalyticsScope(transactions, query, range) {
  return transactions.filter((tx) =>
    tx.currency === query.currency && inTimeRange(tx, range) && query.filters.every((filter) => filterMatches(tx, filter))
  );
}

function timeBucket(tx, grain) {
  const day = tx.occurred_at.slice(0, 10);
  if (grain === 'NONE') return null;
  if (grain === 'DAY') return day;
  if (grain === 'MONTH') return day.slice(0, 7);
  if (grain === 'YEAR') return day.slice(0, 4);
  fail('ANALYTICS_GRAIN_INVALID');
}

function rowDimensions(tx, query) {
  const output = {};
  if (query.grain !== 'NONE') output.time_bucket = timeBucket(tx, query.grain);
  for (const dimension of query.dimensions) output[dimension] = tx[dimension] == null ? null : tx[dimension];
  return output;
}

function dimensionKey(dimensions) {
  return stableStringify(dimensions);
}

function groupRows(transactions, query) {
  const groups = new Map();
  if (query.grain === 'NONE' && query.dimensions.length === 0) {
    groups.set('{}', { dimensions: {}, transactions: transactions.slice() });
    return groups;
  }
  for (const tx of transactions) {
    const dimensions = rowDimensions(tx, query);
    const key = dimensionKey(dimensions);
    if (!groups.has(key)) groups.set(key, { dimensions, transactions: [] });
    groups.get(key).transactions.push(tx);
  }
  return groups;
}

function evaluateMeasures(transactions, query) {
  const report = evaluateKpis(transactions, {
    currency: query.currency,
    budget_minor: query.parameters.budget_minor
  });
  const output = {};
  for (const measure of query.measures) {
    const field = MEASURE_OUTPUTS[measure];
    const value = report[field];
    if (!Number.isSafeInteger(value)) fail('ANALYTICS_MEASURE_RESULT_INVALID');
    output[measure] = value;
  }
  return Object.freeze(output);
}

function previousPeriod(range) {
  const length = dayNumber(range.end) - dayNumber(range.start);
  return Object.freeze({
    start: dayFromNumber(dayNumber(range.start) - length),
    end: range.start
  });
}

function compareScalar(left, right) {
  if (left === right) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  return String(left).localeCompare(String(right));
}

function compareNumbers(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareRows(left, right, query) {
  for (const sort of query.sort) {
    const comparison = sort.kind === 'MEASURE'
      ? compareNumbers(left.measures[sort.key], right.measures[sort.key])
      : compareScalar(left.dimensions[sort.key], right.dimensions[sort.key]);
    if (comparison !== 0) return sort.direction === 'DESC' ? -comparison : comparison;
  }
  return dimensionKey(left.dimensions).localeCompare(dimensionKey(right.dimensions));
}

function buildRows(canonical, query) {
  const currentScope = applyAnalyticsScope(canonical, query, query.time_range);
  const currentGroups = groupRows(currentScope, query);
  let comparisonGroups = new Map();
  let comparisonRange = null;
  if (query.comparison.mode === 'PREVIOUS_PERIOD') {
    comparisonRange = previousPeriod(query.time_range);
    comparisonGroups = groupRows(applyAnalyticsScope(canonical, query, comparisonRange), query);
  }
  const keys = new Set([...currentGroups.keys(), ...comparisonGroups.keys()]);
  if (keys.size === 0 && query.grain === 'NONE' && query.dimensions.length === 0) keys.add('{}');
  const rows = [];
  for (const key of keys) {
    const current = currentGroups.get(key);
    const compared = comparisonGroups.get(key);
    const dimensions = current ? current.dimensions : compared ? compared.dimensions : {};
    rows.push(Object.freeze({
      dimensions: Object.freeze({ ...dimensions }),
      measures: evaluateMeasures(current ? current.transactions : [], query),
      comparison_measures: query.comparison.mode === 'NONE'
        ? null
        : evaluateMeasures(compared ? compared.transactions : [], query)
    }));
  }
  rows.sort((a, b) => compareRows(a, b, query));
  return Object.freeze({ rows, comparisonRange });
}

function evaluateAnalytics(transactions, queryInput) {
  const canonical = validateCanonicalCollection(transactions);
  const query = normalizeAnalyticsQuery(queryInput);
  const queryHash = sha256(stableStringify(query));
  const built = buildRows(canonical, query);
  const totalRows = built.rows.length;
  const rows = Object.freeze(built.rows.slice(0, query.limit));
  return Object.freeze({
    schema: RESULT_SCHEMA,
    contract_version: CONTRACT_VERSION,
    query_hash: queryHash,
    currency: query.currency,
    time_range: query.time_range,
    grain: query.grain,
    comparison: Object.freeze({ mode: query.comparison.mode, time_range: built.comparisonRange }),
    total_rows: totalRows,
    truncated: rows.length < totalRows,
    rows,
    provenance: Object.freeze({
      contract_version: CONTRACT_VERSION,
      query_hash: queryHash,
      canonical_schema: CANONICAL_SCHEMA,
      kpi_dictionary_version: DICTIONARY.version,
      financial_truth_policy: CONTRACT.financial_truth_policy,
      input_revision: repositoryRevision(canonical),
      legacy_total_cells_used: false,
      ui_logic_used: false
    })
  });
}

module.exports = {
  CONTRACT,
  CONTRACT_SCHEMA,
  CONTRACT_VERSION,
  QUERY_SCHEMA,
  RESULT_SCHEMA,
  MEASURES,
  DIMENSIONS,
  FILTER_FIELDS,
  GRAINS,
  COMPARISON_MODES,
  assertContract,
  stableStringify,
  normalizeAnalyticsQuery,
  analyticsQueryHash,
  previousPeriod,
  evaluateAnalytics
};
