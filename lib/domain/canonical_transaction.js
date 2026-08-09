'use strict';

const {
  TYPES,
  normalizeTransaction: normalizeFinTruthTransaction
} = require('../finance/financial_reconciliation');
const {
  TRANSFORM_VERSION,
  normalizeCanonicalRecord,
  canonicalFingerprint
} = require('../migration/migration_reconciliation');

const SCHEMA = require('./canonical_transaction.v1.schema.json');

const SCHEMA_ID = 'PRH_CANONICAL_TRANSACTION_V1';
const SCHEMA_VERSION = 1;
const STATUSES = Object.freeze(['posted', 'pending', 'void']);
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TRANSACTION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const IDENTITY_STRATEGIES = Object.freeze(['EXTERNAL_ID', 'CONTENT_FINGERPRINT_V1']);

const CANONICAL_FIELDS = Object.freeze([
  'schema', 'schema_version', 'transaction_id', 'occurred_at', 'type', 'status',
  'amount_minor', 'currency', 'account_id', 'destination_account_id', 'category_id',
  'member_id', 'project_id', 'tags', 'counterparty', 'description',
  'reverses_transaction_id', 'adjustment_semantics', 'provenance'
]);
const PROVENANCE_FIELDS = Object.freeze([
  'source_system', 'source_container', 'source_record_id', 'source_fingerprint',
  'identity_strategy', 'transform_version', 'source_position'
]);

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function assertPlainObject(value, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
}

function assertExactKeys(value, required, reason) {
  assertPlainObject(value, reason);
  const keys = Object.keys(value);
  if (keys.length !== required.length) fail(reason);
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) fail(reason);
  if (keys.some((key) => !required.includes(key))) fail(reason);
}

function boundedText(value, max, reason, nullable = false) {
  if (value == null && nullable) return null;
  if (typeof value !== 'string') fail(reason);
  const text = value.trim();
  if (!text || text.length > max) fail(reason);
  return text;
}

function canonicalId(value, reason, nullable = false, transaction = false) {
  if (value == null && nullable) return null;
  const text = boundedText(value, transaction ? 128 : 128, reason, false);
  const pattern = transaction ? TRANSACTION_ID_RE : ID_RE;
  if (!pattern.test(text)) fail(reason);
  return text;
}

function canonicalTimestamp(value) {
  if (typeof value !== 'string' || !RFC3339_RE.test(value) || !Number.isFinite(Date.parse(value))) {
    fail('CANONICAL_OCCURRED_AT_INVALID');
  }
  return value;
}

function canonicalMoney(value) {
  if (!Number.isInteger(value) || value < 0) fail('CANONICAL_AMOUNT_MINOR_INVALID');
  return value;
}

function canonicalCurrency(value) {
  if (typeof value !== 'string' || !CURRENCY_RE.test(value)) fail('CANONICAL_CURRENCY_INVALID');
  return value;
}

function canonicalTags(value) {
  if (!Array.isArray(value) || value.length > 64) fail('CANONICAL_TAGS_INVALID');
  const tags = value.map((tag) => boundedText(tag, 64, 'CANONICAL_TAG_INVALID'));
  if (new Set(tags).size !== tags.length) fail('CANONICAL_TAG_DUPLICATE');
  const sorted = tags.slice().sort();
  return Object.freeze(sorted);
}

function normalizeProvenance(value) {
  assertExactKeys(value, PROVENANCE_FIELDS, 'CANONICAL_PROVENANCE_SHAPE_INVALID');
  const sourceSystem = canonicalId(value.source_system, 'CANONICAL_SOURCE_SYSTEM_INVALID');
  const sourceContainer = value.source_container == null
    ? null
    : boundedText(value.source_container, 240, 'CANONICAL_SOURCE_CONTAINER_INVALID');
  const sourceRecordId = boundedText(value.source_record_id, 192, 'CANONICAL_SOURCE_RECORD_ID_INVALID');
  if (sourceRecordId.length < 3) fail('CANONICAL_SOURCE_RECORD_ID_INVALID');
  if (typeof value.source_fingerprint !== 'string' || !SHA256_RE.test(value.source_fingerprint)) {
    fail('CANONICAL_SOURCE_FINGERPRINT_INVALID');
  }
  if (!IDENTITY_STRATEGIES.includes(value.identity_strategy)) fail('CANONICAL_IDENTITY_STRATEGY_INVALID');
  const transformVersion = boundedText(value.transform_version, 80, 'CANONICAL_TRANSFORM_VERSION_INVALID');
  const sourcePosition = value.source_position == null
    ? null
    : boundedText(value.source_position, 128, 'CANONICAL_SOURCE_POSITION_INVALID');
  return Object.freeze({
    source_system: sourceSystem,
    source_container: sourceContainer,
    source_record_id: sourceRecordId,
    source_fingerprint: value.source_fingerprint,
    identity_strategy: value.identity_strategy,
    transform_version: transformVersion,
    source_position: sourcePosition
  });
}

function normalizeCanonicalTransaction(input) {
  assertExactKeys(input, CANONICAL_FIELDS, 'CANONICAL_TRANSACTION_SHAPE_INVALID');
  if (input.schema !== SCHEMA_ID || input.schema_version !== SCHEMA_VERSION) fail('CANONICAL_SCHEMA_VERSION_INVALID');
  const transactionId = canonicalId(input.transaction_id, 'CANONICAL_TRANSACTION_ID_INVALID', false, true);
  const type = String(input.type || '');
  if (!TYPES.includes(type)) fail('CANONICAL_TYPE_INVALID');
  const status = String(input.status || '');
  if (!STATUSES.includes(status)) fail('CANONICAL_STATUS_INVALID');
  const amountMinor = canonicalMoney(input.amount_minor);
  const accountId = canonicalId(input.account_id, 'CANONICAL_ACCOUNT_ID_INVALID');
  const destinationAccountId = canonicalId(input.destination_account_id, 'CANONICAL_DESTINATION_ACCOUNT_ID_INVALID', true);
  const categoryId = canonicalId(input.category_id, 'CANONICAL_CATEGORY_ID_INVALID');
  const memberId = canonicalId(input.member_id, 'CANONICAL_MEMBER_ID_INVALID', true);
  const projectId = canonicalId(input.project_id, 'CANONICAL_PROJECT_ID_INVALID', true);
  const reversesId = canonicalId(input.reverses_transaction_id, 'CANONICAL_REVERSAL_ID_INVALID', true, true);
  const adjustmentSemantics = input.adjustment_semantics == null ? null : String(input.adjustment_semantics);
  if (![null, 'expense_reduction'].includes(adjustmentSemantics)) fail('CANONICAL_ADJUSTMENT_SEMANTICS_INVALID');

  if (type === 'transfer') {
    if (!destinationAccountId || destinationAccountId === accountId) fail('CANONICAL_TRANSFER_ACCOUNTS_INVALID');
  } else if (destinationAccountId !== null) {
    fail('CANONICAL_DESTINATION_ONLY_FOR_TRANSFER');
  }
  if (type === 'refund' && !reversesId && adjustmentSemantics !== 'expense_reduction') {
    fail('CANONICAL_REFUND_SEMANTICS_REQUIRED');
  }
  if (type === 'adjustment' && amountMinor !== 0) fail('CANONICAL_NONZERO_ADJUSTMENT_UNSUPPORTED');

  const normalized = {
    schema: SCHEMA_ID,
    schema_version: SCHEMA_VERSION,
    transaction_id: transactionId,
    occurred_at: canonicalTimestamp(input.occurred_at),
    type,
    status,
    amount_minor: amountMinor,
    currency: canonicalCurrency(input.currency),
    account_id: accountId,
    destination_account_id: destinationAccountId,
    category_id: categoryId,
    member_id: memberId,
    project_id: projectId,
    tags: canonicalTags(input.tags),
    counterparty: input.counterparty == null ? null : boundedText(input.counterparty, 240, 'CANONICAL_COUNTERPARTY_INVALID'),
    description: input.description == null ? null : boundedText(input.description, 1000, 'CANONICAL_DESCRIPTION_INVALID'),
    reverses_transaction_id: reversesId,
    adjustment_semantics: adjustmentSemantics,
    provenance: normalizeProvenance(input.provenance)
  };
  assertFinTruthCompatibility(normalized);
  return Object.freeze(normalized);
}

function toFinTruthTransaction(input) {
  const tx = input && input.schema === SCHEMA_ID ? input : normalizeCanonicalTransaction(input);
  return {
    transaction_id: tx.transaction_id,
    occurred_at: tx.occurred_at,
    type: tx.type,
    status: tx.status,
    amount_minor: tx.amount_minor,
    currency: tx.currency,
    account_id: tx.account_id,
    destination_account_id: tx.destination_account_id,
    category_id: tx.category_id,
    reverses_transaction_id: tx.reverses_transaction_id,
    adjustment_semantics: tx.adjustment_semantics
  };
}

function assertFinTruthCompatibility(input) {
  normalizeFinTruthTransaction(toFinTruthTransaction(input));
  return true;
}

function sourceIdentityKey(input) {
  const tx = input && input.schema === SCHEMA_ID ? input : normalizeCanonicalTransaction(input);
  const p = tx.provenance;
  return `${p.source_system}|${p.identity_strategy}|${p.source_record_id}|${p.transform_version}`;
}

function assertSourceIdentityImmutable(beforeInput, afterInput) {
  const before = beforeInput && beforeInput.schema === SCHEMA_ID ? beforeInput : normalizeCanonicalTransaction(beforeInput);
  const after = afterInput && afterInput.schema === SCHEMA_ID ? afterInput : normalizeCanonicalTransaction(afterInput);
  const fields = ['source_system', 'source_record_id', 'source_fingerprint', 'identity_strategy', 'transform_version'];
  if (fields.some((field) => before.provenance[field] !== after.provenance[field])) fail('CANONICAL_SOURCE_IDENTITY_MUTATION');
  return true;
}

function validateCanonicalCollection(inputs) {
  if (!Array.isArray(inputs)) fail('CANONICAL_COLLECTION_INVALID');
  const transactions = inputs.map(normalizeCanonicalTransaction);
  const ids = new Set();
  const sourceIds = new Set();
  for (const tx of transactions) {
    if (ids.has(tx.transaction_id)) fail('CANONICAL_TRANSACTION_ID_DUPLICATE');
    ids.add(tx.transaction_id);
    const sourceKey = sourceIdentityKey(tx);
    if (sourceIds.has(sourceKey)) fail('CANONICAL_SOURCE_IDENTITY_DUPLICATE');
    sourceIds.add(sourceKey);
  }
  return Object.freeze(transactions);
}

function fromMigrationCanonicalRecord(input) {
  const migration = normalizeCanonicalRecord(input);
  const fingerprint = canonicalFingerprint(migration);
  const sourceContainer = migration.source_sheet || null;
  const sourcePosition = Number.isInteger(migration.source_row) ? `row:${migration.source_row}` : null;
  return normalizeCanonicalTransaction({
    schema: SCHEMA_ID,
    schema_version: SCHEMA_VERSION,
    transaction_id: migration.transaction_id,
    occurred_at: migration.occurred_at,
    type: migration.type,
    status: input.status == null ? 'posted' : String(input.status),
    amount_minor: migration.amount_minor,
    currency: migration.currency,
    account_id: migration.account_id,
    destination_account_id: migration.destination_account_id || null,
    category_id: migration.category_id,
    member_id: input.member_id == null ? null : String(input.member_id),
    project_id: input.project_id == null ? null : String(input.project_id),
    tags: Array.isArray(input.tags) ? input.tags : [],
    counterparty: input.counterparty == null ? null : String(input.counterparty),
    description: input.description == null
      ? (migration.name ? migration.name : null)
      : String(input.description),
    reverses_transaction_id: input.reverses_transaction_id == null ? null : String(input.reverses_transaction_id),
    adjustment_semantics: input.adjustment_semantics == null ? null : String(input.adjustment_semantics),
    provenance: {
      source_system: migration.source_system,
      source_container: sourceContainer,
      source_record_id: `sha256:${fingerprint}`,
      source_fingerprint: fingerprint,
      identity_strategy: 'CONTENT_FINGERPRINT_V1',
      transform_version: migration.transform_version || TRANSFORM_VERSION,
      source_position: sourcePosition
    }
  });
}

function toMigrationCompatibilityRecord(input) {
  const tx = input && input.schema === SCHEMA_ID ? input : normalizeCanonicalTransaction(input);
  const p = tx.provenance;
  if (!p.source_container) fail('CANONICAL_MIGRATION_CONTAINER_REQUIRED');
  const rowMatch = /^row:(\d+)$/.exec(String(p.source_position || ''));
  if (!rowMatch || Number(rowMatch[1]) < 2) fail('CANONICAL_MIGRATION_POSITION_REQUIRED');
  return {
    transaction_id: tx.transaction_id,
    source_system: p.source_system,
    source_sheet: p.source_container,
    source_row: Number(rowMatch[1]),
    transform_version: p.transform_version,
    occurred_at: tx.occurred_at,
    type: tx.type,
    amount_minor: tx.amount_minor,
    currency: tx.currency,
    account_id: tx.account_id,
    destination_account_id: tx.destination_account_id || '',
    category_id: tx.category_id,
    name: tx.description || ''
  };
}

function assertMigrationFingerprintParity(input) {
  const tx = input && input.schema === SCHEMA_ID ? input : normalizeCanonicalTransaction(input);
  if (tx.provenance.identity_strategy !== 'CONTENT_FINGERPRINT_V1') fail('CANONICAL_MIGRATION_IDENTITY_STRATEGY_REQUIRED');
  const compatible = toMigrationCompatibilityRecord(tx);
  if (canonicalFingerprint(compatible) !== tx.provenance.source_fingerprint) fail('CANONICAL_MIGRATION_FINGERPRINT_MISMATCH');
  return true;
}

module.exports = {
  SCHEMA,
  SCHEMA_ID,
  SCHEMA_VERSION,
  STATUSES,
  IDENTITY_STRATEGIES,
  CANONICAL_FIELDS,
  PROVENANCE_FIELDS,
  normalizeCanonicalTransaction,
  validateCanonicalCollection,
  toFinTruthTransaction,
  assertFinTruthCompatibility,
  sourceIdentityKey,
  assertSourceIdentityImmutable,
  fromMigrationCanonicalRecord,
  toMigrationCompatibilityRecord,
  assertMigrationFingerprintParity
};
