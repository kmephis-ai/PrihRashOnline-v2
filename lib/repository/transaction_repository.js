'use strict';

const crypto = require('crypto');
const CONTRACT = require('./transaction_repository.v1.json');
const {
  SCHEMA_ID: CANONICAL_SCHEMA,
  SCHEMA_VERSION: CANONICAL_VERSION,
  normalizeCanonicalTransaction,
  validateCanonicalCollection
} = require('../domain/canonical_transaction');

const REPOSITORY_SCHEMA = 'PRH_TRANSACTION_REPOSITORY_V1';
const REPOSITORY_VERSION = '1.0.0';
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;
const QUERY_KEYS = Object.freeze([
  'transaction_ids', 'types', 'statuses', 'currency', 'account_id', 'category_id',
  'member_id', 'project_id', 'tags_any', 'period_start', 'period_end', 'limit', 'offset'
]);
const WRITE_KEYS = Object.freeze(['idempotency_key', 'expected_revision', 'operations']);
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== REPOSITORY_SCHEMA || CONTRACT.version !== REPOSITORY_VERSION) {
    fail('REPOSITORY_CONTRACT_VERSION_INVALID');
  }
  if (CONTRACT.entity_schema !== `${CANONICAL_SCHEMA}@${CANONICAL_VERSION}`) {
    fail('REPOSITORY_ENTITY_SCHEMA_MISMATCH');
  }
  if (!CONTRACT.capabilities.read || !CONTRACT.capabilities.query || !CONTRACT.capabilities.write_interface) {
    fail('REPOSITORY_CAPABILITY_CONTRACT_INVALID');
  }
  if (CONTRACT.query.max_limit !== MAX_LIMIT || CONTRACT.query.default_limit !== DEFAULT_LIMIT) {
    fail('REPOSITORY_QUERY_LIMIT_CONTRACT_INVALID');
  }
  return true;
}

function assertPlainObject(value, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  return value;
}

function assertExactKeys(value, allowed, reason) {
  assertPlainObject(value, reason);
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail(reason);
}

function normalizeIdList(value, reason) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) fail(reason);
  const result = value.map((item) => {
    const text = String(item || '').trim();
    if (!ID_RE.test(text)) fail(reason);
    return text;
  });
  if (new Set(result).size !== result.length) fail(reason);
  return Object.freeze(result.slice().sort());
}

function normalizeEnumList(value, allowed, reason) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length === 0 || value.length > allowed.length) fail(reason);
  const result = value.map((item) => String(item || '').trim());
  if (result.some((item) => !allowed.includes(item))) fail(reason);
  if (new Set(result).size !== result.length) fail(reason);
  return Object.freeze(result.slice().sort());
}

function normalizeDay(value, reason) {
  if (value == null) return null;
  const text = String(value);
  if (!ISO_DAY_RE.test(text)) fail(reason);
  const date = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) fail(reason);
  return text;
}

function normalizeQuery(input = {}) {
  assertContract();
  assertExactKeys(input, QUERY_KEYS, 'REPOSITORY_QUERY_SHAPE_INVALID');
  const types = normalizeEnumList(input.types, ['income', 'expense', 'transfer', 'refund', 'adjustment'], 'REPOSITORY_QUERY_TYPE_INVALID');
  const statuses = normalizeEnumList(input.statuses, ['posted', 'pending', 'void'], 'REPOSITORY_QUERY_STATUS_INVALID');
  const currency = input.currency == null ? null : String(input.currency);
  if (currency != null && !/^[A-Z]{3}$/.test(currency)) fail('REPOSITORY_QUERY_CURRENCY_INVALID');
  const ids = {};
  for (const key of ['account_id', 'category_id', 'member_id', 'project_id']) {
    const value = input[key] == null ? null : String(input[key]).trim();
    if (value != null && !ID_RE.test(value)) fail(`REPOSITORY_QUERY_${key.toUpperCase()}_INVALID`);
    ids[key] = value;
  }
  const start = normalizeDay(input.period_start, 'REPOSITORY_QUERY_PERIOD_START_INVALID');
  const end = normalizeDay(input.period_end, 'REPOSITORY_QUERY_PERIOD_END_INVALID');
  if ((start == null) !== (end == null)) fail('REPOSITORY_QUERY_PERIOD_INCOMPLETE');
  if (start != null && start >= end) fail('REPOSITORY_QUERY_PERIOD_RANGE_INVALID');
  const limit = input.limit == null ? DEFAULT_LIMIT : Number(input.limit);
  const offset = input.offset == null ? 0 : Number(input.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) fail('REPOSITORY_QUERY_LIMIT_INVALID');
  if (!Number.isInteger(offset) || offset < 0) fail('REPOSITORY_QUERY_OFFSET_INVALID');
  return Object.freeze({
    transaction_ids: normalizeIdList(input.transaction_ids, 'REPOSITORY_QUERY_TRANSACTION_IDS_INVALID'),
    types,
    statuses,
    currency,
    account_id: ids.account_id,
    category_id: ids.category_id,
    member_id: ids.member_id,
    project_id: ids.project_id,
    tags_any: normalizeIdList(input.tags_any, 'REPOSITORY_QUERY_TAGS_INVALID'),
    period_start: start,
    period_end: end,
    limit,
    offset
  });
}

function compareTransactions(left, right) {
  if (left.occurred_at < right.occurred_at) return -1;
  if (left.occurred_at > right.occurred_at) return 1;
  return left.transaction_id.localeCompare(right.transaction_id);
}

function matchesQuery(tx, query) {
  if (query.transaction_ids && !query.transaction_ids.includes(tx.transaction_id)) return false;
  if (query.types && !query.types.includes(tx.type)) return false;
  if (query.statuses && !query.statuses.includes(tx.status)) return false;
  if (query.currency && tx.currency !== query.currency) return false;
  if (query.account_id && tx.account_id !== query.account_id && tx.destination_account_id !== query.account_id) return false;
  if (query.category_id && tx.category_id !== query.category_id) return false;
  if (query.member_id && tx.member_id !== query.member_id) return false;
  if (query.project_id && tx.project_id !== query.project_id) return false;
  if (query.tags_any && !query.tags_any.some((tag) => tx.tags.includes(tag))) return false;
  if (query.period_start) {
    const day = tx.occurred_at.slice(0, 10);
    if (day < query.period_start || day >= query.period_end) return false;
  }
  return true;
}

function applyQuery(transactions, queryInput = {}) {
  const canonical = validateCanonicalCollection(transactions).slice().sort(compareTransactions);
  const query = normalizeQuery(queryInput);
  const matching = canonical.filter((tx) => matchesQuery(tx, query));
  const items = matching.slice(query.offset, query.offset + query.limit);
  return Object.freeze({
    schema: 'PRH_REPOSITORY_QUERY_RESULT_V1',
    total_count: matching.length,
    offset: query.offset,
    limit: query.limit,
    has_more: query.offset + items.length < matching.length,
    items: Object.freeze(items)
  });
}

function repositoryRevision(transactions) {
  const canonical = validateCanonicalCollection(transactions).slice().sort((a, b) => a.transaction_id.localeCompare(b.transaction_id));
  const stable = canonical.map((tx) => ({
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
    tags: tx.tags,
    reverses_transaction_id: tx.reverses_transaction_id,
    adjustment_semantics: tx.adjustment_semantics,
    source_identity: [
      tx.provenance.source_system,
      tx.provenance.identity_strategy,
      tx.provenance.source_record_id,
      tx.provenance.source_fingerprint,
      tx.provenance.transform_version
    ]
  }));
  return crypto.createHash('sha256').update(JSON.stringify(stable), 'utf8').digest('hex');
}

function normalizeWriteRequest(request) {
  assertExactKeys(request, WRITE_KEYS, 'REPOSITORY_WRITE_SHAPE_INVALID');
  const idempotencyKey = String(request.idempotency_key || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey)) fail('REPOSITORY_WRITE_IDEMPOTENCY_KEY_INVALID');
  const expectedRevision = String(request.expected_revision || '').trim();
  if (!/^[0-9a-f]{64}$/.test(expectedRevision)) fail('REPOSITORY_WRITE_EXPECTED_REVISION_INVALID');
  if (!Array.isArray(request.operations) || request.operations.length < 1 || request.operations.length > 100) {
    fail('REPOSITORY_WRITE_BATCH_INVALID');
  }
  const operations = request.operations.map((operation) => {
    assertExactKeys(operation, ['action', 'transaction'], 'REPOSITORY_WRITE_OPERATION_SHAPE_INVALID');
    if (operation.action !== 'PUT') fail('REPOSITORY_WRITE_ACTION_INVALID');
    return Object.freeze({ action: 'PUT', transaction: normalizeCanonicalTransaction(operation.transaction) });
  });
  return Object.freeze({ idempotency_key: idempotencyKey, expected_revision: expectedRevision, operations: Object.freeze(operations) });
}

function createFakeTransactionRepository(initialTransactions = [], options = {}) {
  assertContract();
  let state = validateCanonicalCollection(initialTransactions).slice();
  const writesAllowed = options && options.synthetic_write_authority === true;
  const receipts = new Map();

  function revision() {
    return repositoryRevision(state);
  }

  return Object.freeze({
    schema: REPOSITORY_SCHEMA,
    adapter: 'FAKE_IN_MEMORY_V1',
    capabilities: Object.freeze({ read: true, query: true, write: writesAllowed }),
    getRevision: () => revision(),
    readAll: () => Object.freeze(validateCanonicalCollection(state).slice()),
    getById: (transactionId) => {
      const id = String(transactionId || '').trim();
      if (!ID_RE.test(id)) fail('REPOSITORY_TRANSACTION_ID_INVALID');
      return state.find((tx) => tx.transaction_id === id) || null;
    },
    query: (query) => applyQuery(state, query),
    writeBatch: (requestInput) => {
      if (!writesAllowed) return Object.freeze({ status: 'BLOCKED', reason_code: 'REPOSITORY_WRITE_POLICY_REQUIRED' });
      const request = normalizeWriteRequest(requestInput);
      if (receipts.has(request.idempotency_key)) return receipts.get(request.idempotency_key);
      const beforeRevision = revision();
      if (request.expected_revision !== beforeRevision) {
        return Object.freeze({ status: 'BLOCKED', reason_code: 'REPOSITORY_WRITE_STALE_REVISION', revision: beforeRevision });
      }
      const byId = new Map(state.map((tx) => [tx.transaction_id, tx]));
      for (const operation of request.operations) byId.set(operation.transaction.transaction_id, operation.transaction);
      const nextState = validateCanonicalCollection(Array.from(byId.values())).slice();
      const afterRevision = repositoryRevision(nextState);
      state = nextState;
      const receipt = Object.freeze({
        status: 'PASS',
        idempotency_key: request.idempotency_key,
        before_revision: beforeRevision,
        revision: afterRevision,
        applied_count: request.operations.length,
        readback_count: state.length
      });
      receipts.set(request.idempotency_key, receipt);
      return receipt;
    }
  });
}

module.exports = {
  CONTRACT,
  REPOSITORY_SCHEMA,
  REPOSITORY_VERSION,
  MAX_LIMIT,
  DEFAULT_LIMIT,
  QUERY_KEYS,
  assertContract,
  normalizeQuery,
  applyQuery,
  repositoryRevision,
  normalizeWriteRequest,
  createFakeTransactionRepository
};
