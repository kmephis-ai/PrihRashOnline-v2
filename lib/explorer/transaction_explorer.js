'use strict';

const crypto = require('crypto');
const CONTRACT = require('./transaction_explorer.v1.json');
const {
  normalizeCanonicalTransaction,
  validateCanonicalCollection,
  assertSourceIdentityImmutable
} = require('../domain/canonical_transaction');

const QUERY_SCHEMA = 'PRH_TRANSACTION_EXPLORER_QUERY_V1';
const ROW_SCHEMA = 'PRH_TRANSACTION_EXPLORER_ROW_V1';
const EDIT_SCHEMA = 'PRH_TRANSACTION_EDIT_DRAFT_V1';
const RESULT_SCHEMA = 'PRH_TRANSACTION_EXPLORER_RESULT_V1';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SORT_FIELDS = new Set(CONTRACT.query.sort_fields);
const EDITABLE_FIELDS = new Set(CONTRACT.edit.editable_fields);
const FILTER_VALUE_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function normalizeIsoDay(value, reason, nullable = true) {
  if ((value == null || value === '') && nullable) return null;
  const text = String(value || '');
  if (!DATE_RE.test(text)) fail(reason);
  const parsed = Date.parse(`${text}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== text) fail(reason);
  return text;
}

function normalizeFilterValues(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) fail('TX_EXPLORER_FILTER_INVALID');
  const normalized = value.map((entry) => {
    if (entry == null && field === 'member_id') return null;
    const text = String(entry || '').trim();
    if (!FILTER_VALUE_RE.test(text)) fail('TX_EXPLORER_FILTER_VALUE_INVALID');
    return text;
  });
  const keyed = normalized.map((entry) => entry === null ? '__NULL__' : entry);
  if (new Set(keyed).size !== keyed.length) fail('TX_EXPLORER_FILTER_DUPLICATE');
  return Object.freeze(normalized.slice().sort((a, b) => String(a).localeCompare(String(b))));
}

function normalizeTextSearch(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  if (text.length > CONTRACT.query.text_max_chars) fail('TX_EXPLORER_TEXT_TOO_LONG');
  return text;
}

function normalizeQuery(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('TX_EXPLORER_QUERY_INVALID');
  const allowed = new Set(['date_from', 'date_to', 'account_ids', 'category_ids', 'member_ids', 'types', 'statuses', 'text', 'sort', 'offset', 'limit']);
  if (Object.keys(input).some((key) => !allowed.has(key))) fail('TX_EXPLORER_QUERY_FIELD_UNKNOWN');

  const dateFrom = normalizeIsoDay(input.date_from, 'TX_EXPLORER_DATE_FROM_INVALID');
  const dateTo = normalizeIsoDay(input.date_to, 'TX_EXPLORER_DATE_TO_INVALID');
  if (dateFrom && dateTo && dateFrom >= dateTo) fail('TX_EXPLORER_DATE_RANGE_INVALID');

  const sortInput = input.sort == null ? {} : input.sort;
  if (!sortInput || typeof sortInput !== 'object' || Array.isArray(sortInput)) fail('TX_EXPLORER_SORT_INVALID');
  if (Object.keys(sortInput).some((key) => !['field', 'direction'].includes(key))) fail('TX_EXPLORER_SORT_INVALID');
  const sortField = String(sortInput.field || 'occurred_at');
  const sortDirection = String(sortInput.direction || 'DESC').toUpperCase();
  if (!SORT_FIELDS.has(sortField)) fail('TX_EXPLORER_SORT_FIELD_INVALID');
  if (!CONTRACT.query.sort_directions.includes(sortDirection)) fail('TX_EXPLORER_SORT_DIRECTION_INVALID');

  const offset = input.offset == null ? 0 : Number(input.offset);
  const limit = input.limit == null ? CONTRACT.query.page.default_limit : Number(input.limit);
  if (!Number.isInteger(offset) || offset < 0 || offset > CONTRACT.query.page.max_offset) fail('TX_EXPLORER_OFFSET_INVALID');
  if (!Number.isInteger(limit) || limit < 1 || limit > CONTRACT.query.page.max_limit) fail('TX_EXPLORER_LIMIT_INVALID');

  const normalized = {
    schema: QUERY_SCHEMA,
    date_from: dateFrom,
    date_to: dateTo,
    account_ids: normalizeFilterValues(input.account_ids, 'account_id'),
    category_ids: normalizeFilterValues(input.category_ids, 'category_id'),
    member_ids: normalizeFilterValues(input.member_ids, 'member_id'),
    types: normalizeFilterValues(input.types, 'type'),
    statuses: normalizeFilterValues(input.statuses, 'status'),
    text: normalizeTextSearch(input.text),
    sort: Object.freeze({ field: sortField, direction: sortDirection }),
    offset,
    limit
  };
  const canonical = JSON.stringify(stable(normalized));
  return Object.freeze({ ...normalized, query_hash: sha256(canonical) });
}

function inFilter(values, value) {
  return values.length === 0 || values.includes(value);
}

function textHaystack(tx) {
  return [
    tx.counterparty || '',
    tx.description || '',
    ...(Array.isArray(tx.tags) ? tx.tags : [])
  ].join('\n').toLowerCase();
}

function matches(tx, query) {
  const day = tx.occurred_at.slice(0, 10);
  if (query.date_from && day < query.date_from) return false;
  if (query.date_to && day >= query.date_to) return false;
  if (!inFilter(query.account_ids, tx.account_id)) return false;
  if (!inFilter(query.category_ids, tx.category_id)) return false;
  if (!inFilter(query.member_ids, tx.member_id)) return false;
  if (!inFilter(query.types, tx.type)) return false;
  if (!inFilter(query.statuses, tx.status)) return false;
  if (query.text && !textHaystack(tx).includes(query.text)) return false;
  return true;
}

function compareNullable(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function sorter(query) {
  const direction = query.sort.direction === 'ASC' ? 1 : -1;
  return (a, b) => {
    const primary = compareNullable(a[query.sort.field], b[query.sort.field]) * direction;
    if (primary !== 0) return primary;
    return String(a.transaction_id).localeCompare(String(b.transaction_id));
  };
}

function projectRow(tx) {
  return Object.freeze({
    schema: ROW_SCHEMA,
    transaction_id: tx.transaction_id,
    occurred_at: tx.occurred_at,
    type: tx.type,
    status: tx.status,
    amount_minor: tx.amount_minor,
    currency: tx.currency,
    account_id: tx.account_id,
    destination_account_id: tx.destination_account_id,
    category_id: tx.category_id,
    member_id: tx.member_id,
    project_id: tx.project_id,
    tags: tx.tags.slice(),
    counterparty: tx.counterparty,
    description: tx.description
  });
}

function exploreTransactions(inputs, queryInput = {}, clock = () => Date.now()) {
  const start = clock();
  const transactions = validateCanonicalCollection(inputs);
  const query = normalizeQuery(queryInput);
  const matched = transactions.filter((tx) => matches(tx, query)).sort(sorter(query));
  const rows = matched.slice(query.offset, query.offset + query.limit).map(projectRow);
  const elapsedMs = Math.max(0, Number(clock()) - Number(start));
  return Object.freeze({
    schema: RESULT_SCHEMA,
    explorer_version: CONTRACT.version,
    canonical_schema: CONTRACT.canonical_source,
    query,
    matched_count: matched.length,
    page_count: rows.length,
    has_more: query.offset + rows.length < matched.length,
    rows: Object.freeze(rows),
    telemetry: Object.freeze({
      schema: CONTRACT.schema,
      version: CONTRACT.version,
      query_hash: query.query_hash,
      matched_count: matched.length,
      page_count: rows.length,
      offset: query.offset,
      limit: query.limit,
      elapsed_ms: elapsedMs,
      financial_payload: false
    })
  });
}

function boundedReason(error) {
  const value = String(error && (error.code || error.message) || 'TX_EDIT_INVALID');
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(value) ? value : 'TX_EDIT_INVALID';
}

function buildEditDraft(originalInput, patchInput) {
  const original = normalizeCanonicalTransaction(originalInput);
  if (!patchInput || typeof patchInput !== 'object' || Array.isArray(patchInput)) fail('TX_EDIT_PATCH_INVALID');
  const patchKeys = Object.keys(patchInput);
  if (patchKeys.length === 0) fail('TX_EDIT_PATCH_EMPTY');
  if (patchKeys.some((key) => !EDITABLE_FIELDS.has(key))) fail('TX_EDIT_IMMUTABLE_FIELD');
  try {
    const candidate = normalizeCanonicalTransaction({ ...original, ...patchInput });
    assertSourceIdentityImmutable(original, candidate);
    return Object.freeze({
      schema: EDIT_SCHEMA,
      state: 'VALID',
      transaction_id: original.transaction_id,
      candidate,
      reason_code: null,
      validator: CONTRACT.edit.validator,
      financial_write_authorized: false
    });
  } catch (error) {
    return Object.freeze({
      schema: EDIT_SCHEMA,
      state: 'INVALID',
      transaction_id: original.transaction_id,
      candidate: null,
      reason_code: boundedReason(error),
      validator: CONTRACT.edit.validator,
      financial_write_authorized: false
    });
  }
}

function requestRuntimeSave(draft) {
  if (!draft || draft.schema !== EDIT_SCHEMA || draft.state !== 'VALID') fail('TX_EDIT_DRAFT_NOT_VALID');
  return Object.freeze({
    schema: EDIT_SCHEMA,
    state: 'WRITE_BLOCKED',
    transaction_id: draft.transaction_id,
    candidate: draft.candidate,
    reason_code: CONTRACT.edit.runtime_write_reason,
    financial_write_authorized: false,
    required_policy_evidence: Object.freeze(['idempotency', 'preconditions', 'backup', 'readback', 'reconciliation', 'rollback'])
  });
}

module.exports = {
  CONTRACT,
  QUERY_SCHEMA,
  ROW_SCHEMA,
  EDIT_SCHEMA,
  RESULT_SCHEMA,
  normalizeQuery,
  exploreTransactions,
  buildEditDraft,
  requestRuntimeSave,
  projectRow
};
