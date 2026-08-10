'use strict';

const crypto = require('crypto');
const CONTRACT = require('./ydb_serverless_poc.v1.json');
const {
  normalizeCanonicalTransaction,
  validateCanonicalCollection
} = require('../domain/canonical_transaction');

const CONTRACT_SCHEMA = 'PRH_YDB_SERVERLESS_POC_V1';
const VERSION = '1.0.0';
const TELEMETRY_SCHEMA = 'PRH_YDB_POC_TELEMETRY_V1';
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const BILLING_STATE = 'FREE_TIER_CONFIRMED_CURRENT';

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function assertContract() {
  if (CONTRACT.schema !== CONTRACT_SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'YC-040') fail('YDB_POC_CONTRACT_INVALID');
  if (CONTRACT.mode !== 'OFFLINE_SCHEMA_ADAPTER_POC') fail('YDB_POC_MODE_INVALID');
  if (CONTRACT.ydb.mode !== 'Serverless' || CONTRACT.ydb.remote_resource_required_for_ci !== false || CONTRACT.ydb.cloud_credentials_required_for_ci !== false) fail('YDB_POC_REMOTE_REQUIREMENT_FORBIDDEN');
  if (CONTRACT.ydb.canonical_write_owner !== false) fail('YDB_POC_WRITE_OWNER_FORBIDDEN');
  if (CONTRACT.free_tier_reference.monthly_request_units !== 1000000 || CONTRACT.free_tier_reference.monthly_storage_bytes !== 1073741824) fail('YDB_POC_FREE_TIER_REFERENCE_INVALID');
  if (CONTRACT.free_tier_reference.excess_usage_is_billable !== true || CONTRACT.free_tier_reference.cloud_quota_is_billing_cap !== false) fail('YDB_POC_BILLING_SEMANTICS_INVALID');
  const envelope = CONTRACT.safety_envelope;
  if (envelope.monthly_request_units <= 0 || envelope.monthly_request_units >= CONTRACT.free_tier_reference.monthly_request_units) fail('YDB_POC_RU_ENVELOPE_NOT_CONSERVATIVE');
  if (envelope.monthly_storage_bytes <= 0 || envelope.monthly_storage_bytes >= CONTRACT.free_tier_reference.monthly_storage_bytes) fail('YDB_POC_STORAGE_ENVELOPE_NOT_CONSERVATIVE');
  if (envelope.monthly_request_count <= 0 || envelope.max_request_units_per_second <= 0) fail('YDB_POC_REQUEST_ENVELOPE_INVALID');
  if (envelope.paidOverageAllowed !== false || envelope.unknown_billing_state !== 'BLOCK' || envelope.projected_breach !== 'BLOCK' || envelope.required_billing_state !== BILLING_STATE) fail('YDB_POC_FREE_ONLY_POLICY_INVALID');
  if (Object.values(CONTRACT.authority).some(Boolean)) fail('YDB_POC_AUTHORITY_INVALID');
  if (CONTRACT.cost.mode !== 'FREE_ONLY' || CONTRACT.cost.external_provider_required_for_ci !== false || CONTRACT.cost.paid_dependency_required !== false) fail('YDB_POC_COST_POLICY_INVALID');
  if (CONTRACT.privacy.public_data !== 'INDEPENDENTLY_GENERATED_SYNTHETIC_ONLY' || CONTRACT.privacy.credentials_allowed !== false || CONTRACT.privacy.database_endpoint_or_id_allowed !== false || CONTRACT.privacy.billing_account_id_allowed !== false) fail('YDB_POC_PRIVACY_POLICY_INVALID');
  return true;
}

function encodeTags(tags) {
  if (!Array.isArray(tags)) fail('YDB_POC_TAGS_INVALID');
  return JSON.stringify(tags.slice().sort());
}

function canonicalToYdbRow(input) {
  const tx = normalizeCanonicalTransaction(input);
  return Object.freeze({
    transaction_id: tx.transaction_id,
    schema: tx.schema,
    schema_version: tx.schema_version,
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
    tags_json: encodeTags(tx.tags),
    counterparty: tx.counterparty,
    description: tx.description,
    reverses_transaction_id: tx.reverses_transaction_id,
    adjustment_semantics: tx.adjustment_semantics,
    provenance_source_system: tx.provenance.source_system,
    provenance_source_container: tx.provenance.source_container,
    provenance_source_record_id: tx.provenance.source_record_id,
    provenance_source_fingerprint: tx.provenance.source_fingerprint,
    provenance_identity_strategy: tx.provenance.identity_strategy,
    provenance_transform_version: tx.provenance.transform_version,
    provenance_source_position: tx.provenance.source_position
  });
}

function ydbRowToCanonical(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) fail('YDB_POC_ROW_INVALID');
  let tags;
  try { tags = JSON.parse(row.tags_json); } catch (error) { fail('YDB_POC_TAGS_JSON_INVALID'); }
  return normalizeCanonicalTransaction({
    schema: row.schema,
    schema_version: row.schema_version,
    transaction_id: row.transaction_id,
    occurred_at: row.occurred_at,
    type: row.type,
    status: row.status,
    amount_minor: row.amount_minor,
    currency: row.currency,
    account_id: row.account_id,
    destination_account_id: row.destination_account_id == null ? null : row.destination_account_id,
    category_id: row.category_id,
    member_id: row.member_id == null ? null : row.member_id,
    project_id: row.project_id == null ? null : row.project_id,
    tags,
    counterparty: row.counterparty == null ? null : row.counterparty,
    description: row.description == null ? null : row.description,
    reverses_transaction_id: row.reverses_transaction_id == null ? null : row.reverses_transaction_id,
    adjustment_semantics: row.adjustment_semantics == null ? null : row.adjustment_semantics,
    provenance: {
      source_system: row.provenance_source_system,
      source_container: row.provenance_source_container == null ? null : row.provenance_source_container,
      source_record_id: row.provenance_source_record_id,
      source_fingerprint: row.provenance_source_fingerprint,
      identity_strategy: row.provenance_identity_strategy,
      transform_version: row.provenance_transform_version,
      source_position: row.provenance_source_position == null ? null : row.provenance_source_position
    }
  });
}

function normalizeUsage(input, prefix = 'YDB_POC_USAGE') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(`${prefix}_INVALID`);
  const monthKey = String(input.month_key || '');
  if (!MONTH_RE.test(monthKey)) fail(`${prefix}_MONTH_INVALID`);
  const ru = Number(input.ru_used);
  const storage = Number(input.storage_bytes);
  const requests = Number(input.request_count);
  for (const [name, value] of [['RU', ru], ['STORAGE', storage], ['REQUEST', requests]]) {
    if (!Number.isSafeInteger(value) || value < 0) fail(`${prefix}_${name}_INVALID`);
  }
  return Object.freeze({ month_key: monthKey, ru_used: ru, storage_bytes: storage, request_count: requests });
}

function normalizeReservation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('YDB_POC_RESERVATION_INVALID');
  const ru = Number(input.ru);
  const storage = Number(input.storage_bytes);
  const requests = Number(input.request_count);
  const peak = Number(input.peak_ru_per_second);
  for (const [name, value] of [['RU', ru], ['STORAGE', storage], ['REQUEST', requests], ['PEAK_RU', peak]]) {
    if (!Number.isSafeInteger(value) || value < 0) fail(`YDB_POC_RESERVATION_${name}_INVALID`);
  }
  return Object.freeze({ ru, storage_bytes: storage, request_count: requests, peak_ru_per_second: peak });
}

function basisPoints(value, limit) {
  if (limit <= 0) fail('YDB_POC_ENVELOPE_LIMIT_INVALID');
  return Math.min(10000, Math.floor((value * 10000) / limit));
}

function buildTelemetry(usage, circuitState, status, reasonCode) {
  const envelope = CONTRACT.safety_envelope;
  return Object.freeze({
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    provider_mode: 'YDB_SERVERLESS_POC',
    month_key: usage.month_key,
    ru_used: usage.ru_used,
    storage_bytes: usage.storage_bytes,
    request_count: usage.request_count,
    ru_utilization_bp: basisPoints(usage.ru_used, envelope.monthly_request_units),
    storage_utilization_bp: basisPoints(usage.storage_bytes, envelope.monthly_storage_bytes),
    request_utilization_bp: basisPoints(usage.request_count, envelope.monthly_request_count),
    circuit_state: circuitState,
    status,
    reason_code: reasonCode
  });
}

function evaluateReservation(currentInput, reservationInput, context = {}) {
  assertContract();
  const current = normalizeUsage(currentInput);
  const reservation = normalizeReservation(reservationInput);
  const billingState = String(context.billing_state || 'UNKNOWN');
  if (billingState !== CONTRACT.safety_envelope.required_billing_state) {
    return Object.freeze({
      allowed: false,
      reason_code: 'YDB_FREE_ONLY_BILLING_STATE_BLOCKED',
      projected: current,
      telemetry: buildTelemetry(current, 'OPEN_BLOCKED', 'BLOCKED', 'YDB_FREE_ONLY_BILLING_STATE_BLOCKED')
    });
  }
  if (reservation.peak_ru_per_second > CONTRACT.safety_envelope.max_request_units_per_second) {
    return Object.freeze({
      allowed: false,
      reason_code: 'YDB_FREE_ONLY_PEAK_RU_BLOCKED',
      projected: current,
      telemetry: buildTelemetry(current, 'OPEN_BLOCKED', 'BLOCKED', 'YDB_FREE_ONLY_PEAK_RU_BLOCKED')
    });
  }
  const projected = Object.freeze({
    month_key: current.month_key,
    ru_used: current.ru_used + reservation.ru,
    storage_bytes: current.storage_bytes + reservation.storage_bytes,
    request_count: current.request_count + reservation.request_count
  });
  if (![projected.ru_used, projected.storage_bytes, projected.request_count].every(Number.isSafeInteger)) fail('YDB_POC_USAGE_OVERFLOW');
  const envelope = CONTRACT.safety_envelope;
  let reason = null;
  if (projected.ru_used > envelope.monthly_request_units) reason = 'YDB_FREE_ONLY_RU_ENVELOPE_BLOCKED';
  else if (projected.storage_bytes > envelope.monthly_storage_bytes) reason = 'YDB_FREE_ONLY_STORAGE_ENVELOPE_BLOCKED';
  else if (projected.request_count > envelope.monthly_request_count) reason = 'YDB_FREE_ONLY_REQUEST_ENVELOPE_BLOCKED';
  if (reason) {
    return Object.freeze({ allowed: false, reason_code: reason, projected, telemetry: buildTelemetry(projected, 'OPEN_BLOCKED', 'BLOCKED', reason) });
  }
  return Object.freeze({ allowed: true, reason_code: null, projected, telemetry: buildTelemetry(projected, 'CLOSED_ALLOW', 'OK', null) });
}

function assertTelemetryPublicSafe(telemetry) {
  if (!telemetry || telemetry.schema !== TELEMETRY_SCHEMA || telemetry.version !== VERSION) fail('YDB_POC_TELEMETRY_INVALID');
  const allowed = new Set(CONTRACT.telemetry.allowlist);
  if (Object.keys(telemetry).some((key) => !allowed.has(key))) fail('YDB_POC_TELEMETRY_FIELD_FORBIDDEN');
  const text = JSON.stringify(telemetry);
  if (/transaction|amount_minor|counterparty|description|account_id|category_id|database_id|endpoint|billing_account/i.test(text)) fail('YDB_POC_TELEMETRY_PAYLOAD_FORBIDDEN');
  return true;
}

function createInMemoryPoc(inputs) {
  const canonical = validateCanonicalCollection(inputs);
  const table = new Map();
  for (const tx of canonical) {
    const row = canonicalToYdbRow(tx);
    table.set(row.transaction_id, row);
  }
  return Object.freeze({
    schema: 'PRH_YDB_IN_MEMORY_POC_V1',
    version: VERSION,
    row_count: table.size,
    readById(transactionId) {
      const row = table.get(String(transactionId));
      return row ? ydbRowToCanonical(row) : null;
    },
    queryByCategory(categoryId) {
      const rows = Array.from(table.values()).filter((row) => row.category_id === String(categoryId));
      rows.sort((a, b) => a.transaction_id.localeCompare(b.transaction_id));
      return Object.freeze(rows.map(ydbRowToCanonical));
    },
    snapshotHash() {
      const rows = Array.from(table.values()).sort((a, b) => a.transaction_id.localeCompare(b.transaction_id));
      return sha256(JSON.stringify(rows));
    }
  });
}

assertContract();
module.exports = Object.freeze({
  CONTRACT,
  CONTRACT_SCHEMA,
  VERSION,
  TELEMETRY_SCHEMA,
  BILLING_STATE,
  assertContract,
  canonicalToYdbRow,
  ydbRowToCanonical,
  normalizeUsage,
  normalizeReservation,
  evaluateReservation,
  assertTelemetryPublicSafe,
  createInMemoryPoc
});
