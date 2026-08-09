'use strict';

const crypto = require('crypto');
const MAPPING = require('./google_sheets_operations_mapping.v1.json');
const {
  normalizeCanonicalTransaction,
  validateCanonicalCollection
} = require('../domain/canonical_transaction');
const {
  normalizeQuery,
  compareTransactions,
  matchesQuery,
  repositoryRevision
} = require('../repository/transaction_repository');
const {
  queryProjectionHeaders,
  fullProjectionHeaders,
  groupConsecutiveRows
} = require('./google_sheets_projection');

const ADAPTER_SCHEMA = 'PRH_GOOGLE_SHEETS_TRANSACTION_ADAPTER_V1';
const ADAPTER_VERSION = '1.0.0';
const MAPPING_SCHEMA = 'PRH_GOOGLE_OPERATIONS_MAPPING_V1';
const MAPPING_VERSION = '1.0.0';
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function assertMappingContract() {
  if (!MAPPING || MAPPING.schema !== MAPPING_SCHEMA || MAPPING.version !== MAPPING_VERSION) {
    fail('GOOGLE_ADAPTER_MAPPING_VERSION_INVALID');
  }
  if (MAPPING.sheet_name !== '01 Операции') fail('GOOGLE_ADAPTER_SHEET_CONTRACT_INVALID');
  if (MAPPING.canonical_schema !== 'PRH_CANONICAL_TRANSACTION_V1@1') fail('GOOGLE_ADAPTER_CANONICAL_SCHEMA_MISMATCH');
  if (MAPPING.amount.minor_scale !== 100 || MAPPING.amount.rounding !== 'FORBIDDEN') {
    fail('GOOGLE_ADAPTER_MONEY_POLICY_INVALID');
  }
  if (MAPPING.currency.policy !== 'EXPLICIT_ADAPTER_CONFIG_REQUIRED') fail('GOOGLE_ADAPTER_CURRENCY_POLICY_INVALID');
  if (MAPPING.write_policy !== 'BLOCKED_UNTIL_EXPLICIT_FINANCIAL_MUTATION_POLICY') {
    fail('GOOGLE_ADAPTER_WRITE_POLICY_INVALID');
  }
  return true;
}

function normalizedLabel(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeHeaderIndex(headers, requiredHeaders = MAPPING.required_headers) {
  if (!Array.isArray(headers)) fail('GOOGLE_ADAPTER_HEADERS_INVALID');
  if (!Array.isArray(requiredHeaders) || requiredHeaders.length === 0) fail('GOOGLE_ADAPTER_REQUIRED_HEADERS_INVALID');
  const normalized = headers.map(normalizedLabel);
  const index = {};
  for (const header of requiredHeaders) {
    const position = normalized.indexOf(header);
    if (position < 0) fail('GOOGLE_ADAPTER_REQUIRED_HEADER_MISSING');
    index[header] = position;
  }
  return Object.freeze(index);
}

function normalizeType(value) {
  const key = normalizedLabel(value).toLowerCase();
  const mapped = MAPPING.type_map[key];
  if (!mapped) fail('GOOGLE_ADAPTER_TYPE_UNMAPPED');
  return mapped;
}

function normalizeStatus(value) {
  const key = normalizedLabel(value).toLowerCase();
  const mapped = MAPPING.status_map[key];
  if (!mapped) fail('GOOGLE_ADAPTER_STATUS_UNMAPPED');
  return mapped;
}

function majorToMinorExact(value) {
  if (typeof value !== 'number' && typeof value !== 'string') fail('GOOGLE_ADAPTER_AMOUNT_INVALID');
  const text = String(value).trim().replace(',', '.');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) fail('GOOGLE_ADAPTER_AMOUNT_PRECISION_INVALID');
  const whole = Number(match[1]);
  const fraction = String(match[2] || '').padEnd(2, '0');
  if (!Number.isSafeInteger(whole)) fail('GOOGLE_ADAPTER_AMOUNT_RANGE_INVALID');
  const minor = whole * 100 + Number(fraction || 0);
  if (!Number.isSafeInteger(minor)) fail('GOOGLE_ADAPTER_AMOUNT_RANGE_INVALID');
  return minor;
}

function toRfc3339(value) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) fail('GOOGLE_ADAPTER_OCCURRED_AT_INVALID');
    return value.toISOString();
  }
  const text = normalizedLabel(value);
  if (!RFC3339_RE.test(text) || !Number.isFinite(Date.parse(text))) fail('GOOGLE_ADAPTER_OCCURRED_AT_INVALID');
  return text;
}

function parseTags(value) {
  const text = normalizedLabel(value);
  if (!text) return [];
  const tags = text.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  return Array.from(new Set(tags)).sort();
}

function resolveDimension(resolvers, kind, rawValue, required) {
  const label = normalizedLabel(rawValue);
  if (!label) {
    if (required) fail(`GOOGLE_ADAPTER_${kind.toUpperCase()}_REQUIRED`);
    return null;
  }
  const resolver = resolvers && resolvers[kind];
  if (typeof resolver !== 'function') fail(`GOOGLE_ADAPTER_${kind.toUpperCase()}_RESOLVER_REQUIRED`);
  const resolved = normalizedLabel(resolver(label));
  if (!resolved) fail(`GOOGLE_ADAPTER_${kind.toUpperCase()}_UNRESOLVED`);
  return resolved;
}

function rowFingerprint(projection) {
  return crypto.createHash('sha256').update(JSON.stringify(projection), 'utf8').digest('hex');
}

function rowToCanonical(row, rowNumber, headerIndex, options) {
  if (!Array.isArray(row)) fail('GOOGLE_ADAPTER_ROW_INVALID');
  const get = (header) => row[headerIndex[header]];
  const transactionId = normalizedLabel(get('ID'));
  if (!transactionId) return null;
  const type = normalizeType(get('Тип'));
  const status = normalizeStatus(get('Статус'));
  const currency = String(options.default_currency || '');
  if (!/^[A-Z]{3}$/.test(currency)) fail('GOOGLE_ADAPTER_DEFAULT_CURRENCY_REQUIRED');
  const accountId = resolveDimension(options.resolvers, 'account', get('Счёт'), true);
  const destinationAccountId = type === 'transfer'
    ? resolveDimension(options.resolvers, 'account', get('Счёт назначения'), true)
    : null;
  const categoryId = resolveDimension(options.resolvers, 'category', get('Категория'), true);
  const memberId = resolveDimension(options.resolvers, 'member', get('Член семьи'), false);
  const projectId = resolveDimension(options.resolvers, 'project', get('Проект'), false);
  const description = normalizedLabel(get('Наименование')) || normalizedLabel(get('Комментарий')) || null;
  const sourceLabel = normalizedLabel(get('Источник')) || '01 Операции';
  const sourceRowLabel = normalizedLabel(get('Строка источника'));
  const amountMinor = majorToMinorExact(get('Сумма'));
  const occurredAt = toRfc3339(get('Дата и время'));
  const projection = {
    mapping_version: MAPPING_VERSION,
    transaction_id: transactionId,
    occurred_at: occurredAt,
    type,
    status,
    amount_minor: amountMinor,
    currency,
    account_id: accountId,
    destination_account_id: destinationAccountId,
    category_id: categoryId,
    member_id: memberId,
    project_id: projectId,
    tags: parseTags(get('Теги')),
    source_label: sourceLabel,
    source_row_label: sourceRowLabel
  };
  return normalizeCanonicalTransaction({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: transactionId,
    occurred_at: occurredAt,
    type,
    status,
    amount_minor: amountMinor,
    currency,
    account_id: accountId,
    destination_account_id: destinationAccountId,
    category_id: categoryId,
    member_id: memberId,
    project_id: projectId,
    tags: projection.tags,
    counterparty: null,
    description,
    reverses_transaction_id: null,
    adjustment_semantics: type === 'refund' ? 'expense_reduction' : null,
    provenance: {
      source_system: 'GOOGLE_SHEETS',
      source_container: MAPPING.sheet_name,
      source_record_id: transactionId,
      source_fingerprint: rowFingerprint(projection),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: `GOOGLE-OPERATIONS-MAPPING-v${MAPPING_VERSION}`,
      source_position: `row:${rowNumber}`
    }
  });
}

function normalizeGatewaySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) fail('GOOGLE_ADAPTER_GATEWAY_SNAPSHOT_INVALID');
  if (snapshot.schema !== 'PRH_GOOGLE_OPERATIONS_TABLE_V1') fail('GOOGLE_ADAPTER_GATEWAY_SCHEMA_INVALID');
  if (snapshot.sheet_name !== MAPPING.sheet_name) fail('GOOGLE_ADAPTER_GATEWAY_SHEET_INVALID');
  if (!Array.isArray(snapshot.headers) || !Array.isArray(snapshot.rows)) fail('GOOGLE_ADAPTER_GATEWAY_TABLE_INVALID');
  const startRow = snapshot.start_row == null ? 2 : Number(snapshot.start_row);
  if (!Number.isInteger(startRow) || startRow < 2) fail('GOOGLE_ADAPTER_GATEWAY_START_ROW_INVALID');
  return { headers: snapshot.headers, rows: snapshot.rows, start_row: startRow, read_plan: snapshot.read_plan || null };
}

function createGoogleSheetsTransactionRepository(gateway, options = {}) {
  assertMappingContract();
  if (!gateway || typeof gateway.readOperationsTable !== 'function') fail('GOOGLE_ADAPTER_GATEWAY_REQUIRED');
  const config = {
    default_currency: String(options.default_currency || ''),
    resolvers: options.resolvers || {}
  };
  if (!/^[A-Z]{3}$/.test(config.default_currency)) fail('GOOGLE_ADAPTER_DEFAULT_CURRENCY_REQUIRED');
  const fullHeaders = fullProjectionHeaders();

  function readProjected(requiredHeaders, startRow, rowCount) {
    const request = { required_headers: requiredHeaders.slice() };
    if (startRow != null) request.start_row = startRow;
    if (rowCount != null) request.row_count = rowCount;
    const snapshot = normalizeGatewaySnapshot(gateway.readOperationsTable(request));
    normalizeHeaderIndex(snapshot.headers, requiredHeaders);
    return snapshot;
  }

  function canonicalFromSnapshot(snapshot) {
    const index = normalizeHeaderIndex(snapshot.headers, fullHeaders);
    const transactions = [];
    snapshot.rows.forEach((row, offset) => {
      const tx = rowToCanonical(row, snapshot.start_row + offset, index, config);
      if (tx) transactions.push(tx);
    });
    return transactions;
  }

  function readCanonical(startRow, rowCount) {
    const snapshot = readProjected(fullHeaders, startRow, rowCount);
    return validateCanonicalCollection(canonicalFromSnapshot(snapshot));
  }

  function projectedCandidate(row, rowNumber, headers, query) {
    const index = normalizeHeaderIndex(headers, headers);
    const get = (header) => index[header] == null ? null : row[index[header]];
    const transactionId = normalizedLabel(get('ID'));
    if (!transactionId) return null;
    const candidate = {
      row_number: rowNumber,
      transaction_id: transactionId,
      occurred_at: toRfc3339(get('Дата и время')),
      currency: config.default_currency,
      type: query.types ? normalizeType(get('Тип')) : null,
      status: query.statuses ? normalizeStatus(get('Статус')) : null,
      account_id: null,
      destination_account_id: null,
      category_id: null,
      member_id: null,
      project_id: null,
      tags: []
    };
    if (query.account_id) {
      candidate.account_id = resolveDimension(config.resolvers, 'account', get('Счёт'), true);
      candidate.destination_account_id = resolveDimension(config.resolvers, 'account', get('Счёт назначения'), false);
    }
    if (query.category_id) candidate.category_id = resolveDimension(config.resolvers, 'category', get('Категория'), true);
    if (query.member_id) candidate.member_id = resolveDimension(config.resolvers, 'member', get('Член семьи'), false);
    if (query.project_id) candidate.project_id = resolveDimension(config.resolvers, 'project', get('Проект'), false);
    if (query.tags_any) candidate.tags = parseTags(get('Теги'));
    return candidate;
  }

  function queryProjected(queryInput) {
    const query = normalizeQuery(queryInput);
    const scanHeaders = queryProjectionHeaders(queryInput);
    const snapshot = readProjected(scanHeaders);
    const candidates = [];
    const ids = new Set();
    snapshot.rows.forEach((row, offset) => {
      const candidate = projectedCandidate(row, snapshot.start_row + offset, snapshot.headers, query);
      if (!candidate) return;
      if (ids.has(candidate.transaction_id)) fail('GOOGLE_ADAPTER_TRANSACTION_ID_DUPLICATE');
      ids.add(candidate.transaction_id);
      if (matchesQuery(candidate, query)) candidates.push(candidate);
    });
    candidates.sort(compareTransactions);
    const selected = candidates.slice(query.offset, query.offset + query.limit);
    const selectedIds = new Set(selected.map((candidate) => candidate.transaction_id));
    const byId = new Map();
    for (const group of groupConsecutiveRows(selected.map((candidate) => candidate.row_number))) {
      const fullSnapshot = readProjected(fullHeaders, group.start_row, group.row_count);
      for (const tx of canonicalFromSnapshot(fullSnapshot)) {
        if (selectedIds.has(tx.transaction_id)) byId.set(tx.transaction_id, tx);
      }
    }
    const items = selected.map((candidate) => {
      const tx = byId.get(candidate.transaction_id);
      if (!tx) fail('GOOGLE_ADAPTER_SELECTED_ROW_READBACK_MISSING');
      return tx;
    });
    validateCanonicalCollection(items);
    return Object.freeze({
      schema: 'PRH_REPOSITORY_QUERY_RESULT_V1',
      total_count: candidates.length,
      offset: query.offset,
      limit: query.limit,
      has_more: query.offset + items.length < candidates.length,
      items: Object.freeze(items)
    });
  }

  return Object.freeze({
    schema: 'PRH_TRANSACTION_REPOSITORY_V1',
    adapter_schema: ADAPTER_SCHEMA,
    adapter_version: ADAPTER_VERSION,
    mapping_version: MAPPING_VERSION,
    capabilities: Object.freeze({ read: true, query: true, write: false, write_interface: true, projection: true }),
    getRevision: () => repositoryRevision(readCanonical()),
    readAll: () => Object.freeze(readCanonical().slice()),
    getById: (transactionId) => {
      const id = normalizedLabel(transactionId);
      if (!id) fail('GOOGLE_ADAPTER_TRANSACTION_ID_INVALID');
      const idSnapshot = readProjected(['ID']);
      const idIndex = normalizeHeaderIndex(idSnapshot.headers, ['ID']);
      let rowNumber = null;
      idSnapshot.rows.forEach((row, offset) => {
        if (normalizedLabel(row[idIndex.ID]) === id) {
          if (rowNumber != null) fail('GOOGLE_ADAPTER_TRANSACTION_ID_DUPLICATE');
          rowNumber = idSnapshot.start_row + offset;
        }
      });
      if (rowNumber == null) return null;
      const snapshot = readProjected(fullHeaders, rowNumber, 1);
      const transactions = canonicalFromSnapshot(snapshot).filter((tx) => tx.transaction_id === id);
      if (transactions.length !== 1) fail('GOOGLE_ADAPTER_SELECTED_ROW_READBACK_MISSING');
      return transactions[0];
    },
    query: (query) => queryProjected(query),
    writeBatch: () => Object.freeze({
      status: 'BLOCKED',
      reason_code: 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED',
      adapter_version: ADAPTER_VERSION
    })
  });
}

module.exports = {
  MAPPING,
  ADAPTER_SCHEMA,
  ADAPTER_VERSION,
  MAPPING_SCHEMA,
  MAPPING_VERSION,
  assertMappingContract,
  normalizeHeaderIndex,
  normalizeType,
  normalizeStatus,
  majorToMinorExact,
  toRfc3339,
  parseTags,
  rowToCanonical,
  createGoogleSheetsTransactionRepository
};
