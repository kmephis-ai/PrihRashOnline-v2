'use strict';

const crypto = require('crypto');
const MAPPING = require('./google_sheets_operations_mapping.v1.json');
const {
  normalizeCanonicalTransaction,
  validateCanonicalCollection
} = require('../domain/canonical_transaction');
const {
  applyQuery,
  repositoryRevision
} = require('../repository/transaction_repository');

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

function normalizeHeaderIndex(headers) {
  if (!Array.isArray(headers)) fail('GOOGLE_ADAPTER_HEADERS_INVALID');
  const normalized = headers.map(normalizedLabel);
  const index = {};
  for (const header of MAPPING.required_headers) {
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
  return { headers: snapshot.headers, rows: snapshot.rows, start_row: startRow };
}

function createGoogleSheetsTransactionRepository(gateway, options = {}) {
  assertMappingContract();
  if (!gateway || typeof gateway.readOperationsTable !== 'function') fail('GOOGLE_ADAPTER_GATEWAY_REQUIRED');
  const config = {
    default_currency: String(options.default_currency || ''),
    resolvers: options.resolvers || {}
  };
  if (!/^[A-Z]{3}$/.test(config.default_currency)) fail('GOOGLE_ADAPTER_DEFAULT_CURRENCY_REQUIRED');

  function readCanonical() {
    const snapshot = normalizeGatewaySnapshot(gateway.readOperationsTable());
    const index = normalizeHeaderIndex(snapshot.headers);
    const transactions = [];
    snapshot.rows.forEach((row, offset) => {
      const tx = rowToCanonical(row, snapshot.start_row + offset, index, config);
      if (tx) transactions.push(tx);
    });
    return validateCanonicalCollection(transactions);
  }

  return Object.freeze({
    schema: 'PRH_TRANSACTION_REPOSITORY_V1',
    adapter_schema: ADAPTER_SCHEMA,
    adapter_version: ADAPTER_VERSION,
    mapping_version: MAPPING_VERSION,
    capabilities: Object.freeze({ read: true, query: true, write: false, write_interface: true }),
    getRevision: () => repositoryRevision(readCanonical()),
    readAll: () => Object.freeze(readCanonical().slice()),
    getById: (transactionId) => {
      const id = normalizedLabel(transactionId);
      if (!id) fail('GOOGLE_ADAPTER_TRANSACTION_ID_INVALID');
      return readCanonical().find((tx) => tx.transaction_id === id) || null;
    },
    query: (query) => applyQuery(readCanonical(), query),
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
