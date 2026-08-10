'use strict';

const crypto = require('crypto');
const CONTRACT = require('./balance_reconciliation.v1.json');
const {
  SCHEMA_ID: CANONICAL_SCHEMA_ID,
  validateCanonicalCollection
} = require('../domain/canonical_transaction');
const { POLICY_VERSION: FIN_TRUTH_POLICY } = require('../finance/financial_reconciliation');

const SCHEMA = CONTRACT.schema;
const VERSION = CONTRACT.version;
const OBSERVATION_SCHEMA = CONTRACT.schemas.observation;
const RESULT_SCHEMA = CONTRACT.schemas.result;
const TELEMETRY_SCHEMA = CONTRACT.schemas.telemetry;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function fail(reason, detail) {
  const error = new Error(detail ? `${reason}:${detail}` : reason);
  error.code = reason;
  throw error;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function exactKeys(value, allowed, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const keys = Object.keys(value);
  if (keys.length !== allowed.length || keys.some((key) => !allowed.includes(key))) fail(reason);
}

function safeInteger(value, reason) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail(reason);
  return number;
}

function safeAdd(a, b, reason = 'BAL_SAFE_INTEGER_OVERFLOW') {
  const result = a + b;
  if (!Number.isSafeInteger(result)) fail(reason);
  return result;
}

function safeSub(a, b, reason = 'BAL_SAFE_INTEGER_OVERFLOW') {
  const result = a - b;
  if (!Number.isSafeInteger(result)) fail(reason);
  return result;
}

function opaqueId(value, reason) {
  const text = String(value == null ? '' : value).trim();
  if (!ID_RE.test(text)) fail(reason);
  return text;
}

function canonicalCurrency(value) {
  const text = String(value == null ? '' : value).trim();
  if (!CURRENCY_RE.test(text)) fail('BAL_CURRENCY_INVALID');
  return text;
}

function canonicalInstant(value, reason) {
  const text = String(value == null ? '' : value).trim();
  if (!RFC3339_RE.test(text) || !Number.isFinite(Date.parse(text))) fail(reason);
  return text;
}

function assertContract() {
  if (SCHEMA !== 'PRH_BALANCE_RECONCILIATION_V1' || VERSION !== '1.0.0' || CONTRACT.roadmap_id !== 'BAL-030') fail('BAL_CONTRACT_VERSION_INVALID');
  if (CONTRACT.dependencies.canonical_transactions !== CANONICAL_SCHEMA_ID || CONTRACT.dependencies.financial_truth_policy !== FIN_TRUTH_POLICY) fail('BAL_UPSTREAM_AUTHORITY_INVALID');
  if (CONTRACT.absolute_balance_policy.anchor_observation_required !== true || CONTRACT.absolute_balance_policy.zero_origin_assumed !== false) fail('BAL_ABSOLUTE_BALANCE_POLICY_INVALID');
  if (CONTRACT.reconciliation.mismatch_formula !== 'OBSERVED_MINUS_CALCULATED' || CONTRACT.reconciliation.input_mutation !== false) fail('BAL_RECONCILIATION_POLICY_INVALID');
  if (Object.values(CONTRACT.authorities || {}).some((value) => value !== false) || CONTRACT.free_only !== true) fail('BAL_AUTHORITY_INVALID');
  return true;
}

function normalizeObservationProvenance(input) {
  exactKeys(input, ['source_system', 'source_record_id', 'source_fingerprint', 'capture_method', 'transform_version'], 'BAL_OBSERVATION_PROVENANCE_SHAPE_INVALID');
  const sourceSystem = opaqueId(input.source_system, 'BAL_OBSERVATION_SOURCE_SYSTEM_INVALID');
  const sourceRecordId = String(input.source_record_id == null ? '' : input.source_record_id).trim();
  if (sourceRecordId.length < 3 || sourceRecordId.length > 192) fail('BAL_OBSERVATION_SOURCE_RECORD_ID_INVALID');
  const sourceFingerprint = String(input.source_fingerprint || '');
  if (!SHA256_RE.test(sourceFingerprint)) fail('BAL_OBSERVATION_SOURCE_FINGERPRINT_INVALID');
  const captureMethod = String(input.capture_method || '').trim().toUpperCase();
  if (!CONTRACT.observation.capture_methods.includes(captureMethod)) fail('BAL_OBSERVATION_CAPTURE_METHOD_INVALID');
  const transformVersion = String(input.transform_version == null ? '' : input.transform_version).trim();
  if (!transformVersion || transformVersion.length > 80) fail('BAL_OBSERVATION_TRANSFORM_VERSION_INVALID');
  return deepFreeze({
    source_system: sourceSystem,
    source_record_id: sourceRecordId,
    source_fingerprint: sourceFingerprint,
    capture_method: captureMethod,
    transform_version: transformVersion
  });
}

function normalizeObservation(input) {
  assertContract();
  exactKeys(input, ['schema', 'version', 'observation_id', 'account_id', 'currency', 'observed_at', 'balance_minor', 'provenance'], 'BAL_OBSERVATION_SHAPE_INVALID');
  if (input.schema !== OBSERVATION_SCHEMA || input.version !== VERSION) fail('BAL_OBSERVATION_VERSION_INVALID');
  return deepFreeze({
    schema: OBSERVATION_SCHEMA,
    version: VERSION,
    observation_id: opaqueId(input.observation_id, 'BAL_OBSERVATION_ID_INVALID'),
    account_id: opaqueId(input.account_id, 'BAL_OBSERVATION_ACCOUNT_ID_INVALID'),
    currency: canonicalCurrency(input.currency),
    observed_at: canonicalInstant(input.observed_at, 'BAL_OBSERVATION_TIME_INVALID'),
    balance_minor: safeInteger(input.balance_minor, 'BAL_OBSERVATION_BALANCE_INVALID'),
    provenance: normalizeObservationProvenance(input.provenance)
  });
}

function transactionTouchesAccount(tx, accountId) {
  return tx.account_id === accountId || (tx.type === 'transfer' && tx.destination_account_id === accountId);
}

function accountDelta(tx, accountId, currency) {
  if (tx.status !== CONTRACT.account_delta_policy.included_status) return Object.freeze({ included: false, delta_minor: 0 });
  if (!transactionTouchesAccount(tx, accountId)) return Object.freeze({ included: false, delta_minor: 0 });
  if (tx.currency !== currency) fail('BAL_TRANSACTION_CURRENCY_MISMATCH');

  let delta = 0;
  switch (tx.type) {
    case 'income':
    case 'refund':
      if (tx.account_id === accountId) delta = tx.amount_minor;
      break;
    case 'expense':
      if (tx.account_id === accountId) delta = -tx.amount_minor;
      break;
    case 'transfer':
      if (tx.account_id === accountId) delta = safeSub(delta, tx.amount_minor);
      if (tx.destination_account_id === accountId) delta = safeAdd(delta, tx.amount_minor);
      break;
    case 'adjustment':
      if (tx.amount_minor !== 0) fail('BAL_ADJUSTMENT_SEMANTICS_INVALID');
      delta = 0;
      break;
    default:
      fail('BAL_TRANSACTION_TYPE_UNSUPPORTED');
  }
  return Object.freeze({ included: true, delta_minor: delta });
}

function compareTransactions(a, b) {
  const time = Date.parse(a.occurred_at) - Date.parse(b.occurred_at);
  if (time !== 0) return time;
  const literal = a.occurred_at.localeCompare(b.occurred_at);
  if (literal !== 0) return literal;
  return a.transaction_id.localeCompare(b.transaction_id);
}

function reconciliationIdentity(anchor, target, relevantTransactions) {
  const payload = stableStringify({
    schema: SCHEMA,
    version: VERSION,
    anchor,
    target,
    transactions: relevantTransactions
  });
  return `balrec-${crypto.createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 48)}`;
}

function reconcileBalance(input) {
  assertContract();
  exactKeys(input, ['anchor', 'target', 'transactions'], 'BAL_RECONCILIATION_INPUT_SHAPE_INVALID');
  if (input.anchor == null) fail('BAL_ANCHOR_REQUIRED');
  if (input.target == null) fail('BAL_TARGET_REQUIRED');
  if (!Array.isArray(input.transactions)) fail('BAL_TRANSACTIONS_INVALID');

  const anchor = normalizeObservation(input.anchor);
  const target = normalizeObservation(input.target);
  if (anchor.account_id !== target.account_id) fail('BAL_ACCOUNT_MISMATCH');
  if (anchor.currency !== target.currency) fail('BAL_OBSERVATION_CURRENCY_MISMATCH');
  const anchorMs = Date.parse(anchor.observed_at);
  const targetMs = Date.parse(target.observed_at);
  if (targetMs <= anchorMs) fail('BAL_TARGET_NOT_AFTER_ANCHOR');

  const transactions = validateCanonicalCollection(input.transactions);
  const relevant = transactions
    .filter((tx) => {
      const time = Date.parse(tx.occurred_at);
      return time > anchorMs && time <= targetMs;
    })
    .slice()
    .sort(compareTransactions);

  let canonicalDelta = 0;
  let includedCount = 0;
  for (const tx of relevant) {
    const evaluated = accountDelta(tx, anchor.account_id, anchor.currency);
    if (!evaluated.included) continue;
    canonicalDelta = safeAdd(canonicalDelta, evaluated.delta_minor);
    includedCount += 1;
  }

  const calculated = safeAdd(anchor.balance_minor, canonicalDelta);
  const mismatch = safeSub(target.balance_minor, calculated);
  const state = mismatch === 0 ? 'MATCH' : 'MISMATCH';
  const proposal = deepFreeze({
    kind: state === 'MATCH' ? 'NO_ACTION' : CONTRACT.reconciliation.mismatch_proposal,
    reason_code: state === 'MATCH' ? 'BALANCE_MATCH' : 'OBSERVED_DIFFERS_FROM_CALCULATED',
    mutation_authorized: false,
    canonical_mutation: false,
    observation_mutation: false,
    financial_write: false
  });

  return deepFreeze({
    schema: RESULT_SCHEMA,
    version: VERSION,
    reconciliation_id: reconciliationIdentity(anchor, target, relevant),
    anchor_observation: anchor,
    target_observation: target,
    canonical_delta_minor: canonicalDelta,
    calculated_balance_minor: calculated,
    observed_balance_minor: target.balance_minor,
    mismatch_minor: mismatch,
    state,
    transaction_count: transactions.length,
    included_transaction_count: includedCount,
    proposal,
    provenance: deepFreeze({
      canonical_schema: CANONICAL_SCHEMA_ID,
      financial_truth_policy: FIN_TRUTH_POLICY,
      anchor_observation_required: true,
      zero_origin_assumed: false,
      interval: CONTRACT.absolute_balance_policy.interval,
      financial_truth: false,
      canonical_mutation: false,
      observation_mutation: false,
      financial_write: false
    })
  });
}

function serializeObservation(input) {
  return stableStringify(normalizeObservation(input));
}

function serializeReconciliation(input) {
  const result = input && input.schema === RESULT_SCHEMA ? input : reconcileBalance(input);
  return stableStringify(result);
}

function reconciliationTelemetry(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.version !== VERSION) fail('BAL_RESULT_INVALID');
  const direction = result.canonical_delta_minor > 0 ? 'POSITIVE' : result.canonical_delta_minor < 0 ? 'NEGATIVE' : 'ZERO';
  const output = {
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    state: result.state,
    reason_code: result.proposal.reason_code,
    transaction_count: result.transaction_count,
    included_transaction_count: result.included_transaction_count,
    delta_direction: direction,
    proposal_kind: result.proposal.kind
  };
  const extra = Object.keys(output).filter((key) => !CONTRACT.telemetry_allowlist.includes(key));
  if (extra.length) fail('BAL_TELEMETRY_FIELD_FORBIDDEN', extra.join(','));
  return deepFreeze(output);
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  OBSERVATION_SCHEMA,
  RESULT_SCHEMA,
  TELEMETRY_SCHEMA,
  assertContract,
  stableStringify,
  normalizeObservation,
  accountDelta,
  reconcileBalance,
  serializeObservation,
  serializeReconciliation,
  reconciliationTelemetry
});
