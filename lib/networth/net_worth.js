'use strict';

const crypto = require('crypto');
const CONTRACT = require('./net_worth.v1.json');
const {
  OBSERVATION_SCHEMA,
  RESULT_SCHEMA: BALANCE_RESULT_SCHEMA,
  normalizeObservation
} = require('../balance/balance_reconciliation');

const SCHEMA = CONTRACT.schema;
const VERSION = CONTRACT.version;
const SNAPSHOT_SCHEMA = CONTRACT.schemas.snapshot;
const POSITION_SCHEMA = CONTRACT.schemas.position;
const RESULT_SCHEMA = CONTRACT.schemas.result;
const TELEMETRY_SCHEMA = CONTRACT.schemas.telemetry;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

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

function opaqueId(value, reason) {
  const text = String(value == null ? '' : value).trim();
  if (!ID_RE.test(text)) fail(reason);
  return text;
}

function boundedLabel(value) {
  const text = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  if (!text || text.length > 160 || /[\u0000-\u001f\u007f]/.test(text)) fail('NW_POSITION_LABEL_INVALID');
  return text;
}

function safeInteger(value, reason) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) fail(reason);
  return number;
}

function positiveSafeInteger(value, reason) {
  const number = safeInteger(value, reason);
  if (number <= 0) fail(reason);
  return number;
}

function safeAdd(a, b, reason = 'NW_SAFE_INTEGER_OVERFLOW') {
  const result = a + b;
  if (!Number.isSafeInteger(result)) fail(reason);
  return result;
}

function safeSub(a, b, reason = 'NW_SAFE_INTEGER_OVERFLOW') {
  const result = a - b;
  if (!Number.isSafeInteger(result)) fail(reason);
  return result;
}

function valuationDate(value) {
  const text = String(value || '');
  if (!DATE_RE.test(text)) fail('NW_VALUATION_DATE_INVALID');
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) fail('NW_VALUATION_DATE_INVALID');
  return text;
}

function currency(value) {
  const text = String(value || '').trim();
  if (!CURRENCY_RE.test(text)) fail('NW_CURRENCY_INVALID');
  return text;
}

function assertContract() {
  if (SCHEMA !== 'PRH_NET_WORTH_V1' || VERSION !== '1.0.0' || CONTRACT.roadmap_id !== 'NW-030') fail('NW_CONTRACT_VERSION_INVALID');
  if (CONTRACT.dependencies.balance_reconciliation !== 'PRH_BALANCE_RECONCILIATION_V1@1.0.0') fail('NW_BALANCE_DEPENDENCY_INVALID');
  if (CONTRACT.valuation_policy.fx_conversion !== false || CONTRACT.valuation_policy.single_currency_required !== true) fail('NW_FX_BOUNDARY_INVALID');
  if (CONTRACT.reconciliation_policy.mismatch_hidden !== false || CONTRACT.reconciliation_policy.explicit_observed_or_calculated_selection !== true) fail('NW_RECONCILIATION_BOUNDARY_INVALID');
  if (Object.values(CONTRACT.authorities || {}).some((value) => value !== false) || CONTRACT.free_only !== true) fail('NW_AUTHORITY_INVALID');
  return true;
}

function normalizeAccountProvenance(input) {
  exactKeys(input, ['source_kind', 'account_id', 'observation_id', 'reconciliation_id', 'reconciliation_state'], 'NW_ACCOUNT_PROVENANCE_SHAPE_INVALID');
  const sourceKind = String(input.source_kind || '');
  if (!CONTRACT.account_sources.includes(sourceKind)) fail('NW_ACCOUNT_SOURCE_INVALID');
  const state = input.reconciliation_state == null ? null : String(input.reconciliation_state);
  if (state != null && !['MATCH', 'MISMATCH'].includes(state)) fail('NW_RECONCILIATION_STATE_INVALID');
  if (sourceKind === 'CALCULATED_BALANCE' && (!input.reconciliation_id || state == null)) fail('NW_CALCULATED_RECONCILIATION_REQUIRED');
  return deepFreeze({
    source_kind: sourceKind,
    account_id: opaqueId(input.account_id, 'NW_ACCOUNT_ID_INVALID'),
    observation_id: opaqueId(input.observation_id, 'NW_OBSERVATION_ID_INVALID'),
    reconciliation_id: input.reconciliation_id == null ? null : opaqueId(input.reconciliation_id, 'NW_RECONCILIATION_ID_INVALID'),
    reconciliation_state: state
  });
}

function normalizeValuationProvenance(input) {
  exactKeys(input, ['source_kind', 'source_record_id', 'source_fingerprint'], 'NW_VALUATION_PROVENANCE_SHAPE_INVALID');
  const sourceKind = String(input.source_kind || '');
  if (!CONTRACT.valuation_sources.includes(sourceKind)) fail('NW_VALUATION_SOURCE_INVALID');
  const recordId = String(input.source_record_id == null ? '' : input.source_record_id).trim();
  if (recordId.length < 3 || recordId.length > 192) fail('NW_VALUATION_SOURCE_RECORD_ID_INVALID');
  const fingerprint = String(input.source_fingerprint || '');
  if (!SHA256_RE.test(fingerprint)) fail('NW_VALUATION_FINGERPRINT_INVALID');
  return deepFreeze({ source_kind: sourceKind, source_record_id: recordId, source_fingerprint: fingerprint });
}

function normalizePosition(input) {
  exactKeys(input, ['schema', 'version', 'position_id', 'type', 'label', 'valuation_date', 'currency', 'value_minor', 'provenance'], 'NW_POSITION_SHAPE_INVALID');
  if (input.schema !== POSITION_SCHEMA || input.version !== VERSION) fail('NW_POSITION_VERSION_INVALID');
  const type = String(input.type || '').toUpperCase();
  if (!CONTRACT.position_types.includes(type)) fail('NW_POSITION_TYPE_INVALID');
  const value = type === 'ACCOUNT'
    ? safeInteger(input.value_minor, 'NW_ACCOUNT_VALUE_INVALID')
    : positiveSafeInteger(input.value_minor, 'NW_VALUATION_VALUE_INVALID');
  return deepFreeze({
    schema: POSITION_SCHEMA,
    version: VERSION,
    position_id: opaqueId(input.position_id, 'NW_POSITION_ID_INVALID'),
    type,
    label: boundedLabel(input.label),
    valuation_date: valuationDate(input.valuation_date),
    currency: currency(input.currency),
    value_minor: value,
    provenance: type === 'ACCOUNT' ? normalizeAccountProvenance(input.provenance) : normalizeValuationProvenance(input.provenance)
  });
}

function dateFromInstant(value) {
  return String(value || '').slice(0, 10);
}

function accountPositionFromObservation(observationInput, options) {
  exactKeys(options, ['position_id', 'label', 'valuation_date'], 'NW_ACCOUNT_POSITION_OPTIONS_INVALID');
  const observation = normalizeObservation(observationInput);
  const date = valuationDate(options.valuation_date);
  if (dateFromInstant(observation.observed_at) !== date) fail('NW_ACCOUNT_VALUATION_DATE_MISMATCH');
  return normalizePosition({
    schema: POSITION_SCHEMA,
    version: VERSION,
    position_id: options.position_id,
    type: 'ACCOUNT',
    label: options.label,
    valuation_date: date,
    currency: observation.currency,
    value_minor: observation.balance_minor,
    provenance: {
      source_kind: 'OBSERVED_BALANCE',
      account_id: observation.account_id,
      observation_id: observation.observation_id,
      reconciliation_id: null,
      reconciliation_state: null
    }
  });
}

function assertBalanceResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) fail('NW_BALANCE_RESULT_INVALID');
  if (result.schema !== BALANCE_RESULT_SCHEMA || result.version !== VERSION) fail('NW_BALANCE_RESULT_INVALID');
  if (!result.target_observation || result.target_observation.schema !== OBSERVATION_SCHEMA) fail('NW_BALANCE_RESULT_INVALID');
  if (!['MATCH', 'MISMATCH'].includes(result.state)) fail('NW_BALANCE_RESULT_INVALID');
  safeInteger(result.calculated_balance_minor, 'NW_BALANCE_RESULT_INVALID');
  safeInteger(result.observed_balance_minor, 'NW_BALANCE_RESULT_INVALID');
  opaqueId(result.reconciliation_id, 'NW_RECONCILIATION_ID_INVALID');
  return result;
}

function accountPositionFromReconciliation(resultInput, selection, options) {
  exactKeys(options, ['position_id', 'label', 'valuation_date'], 'NW_ACCOUNT_POSITION_OPTIONS_INVALID');
  const result = assertBalanceResult(resultInput);
  const sourceKind = String(selection || '').toUpperCase();
  if (!CONTRACT.account_sources.includes(sourceKind)) fail('NW_ACCOUNT_SOURCE_INVALID');
  const target = normalizeObservation(result.target_observation);
  const date = valuationDate(options.valuation_date);
  if (dateFromInstant(target.observed_at) !== date) fail('NW_ACCOUNT_VALUATION_DATE_MISMATCH');
  return normalizePosition({
    schema: POSITION_SCHEMA,
    version: VERSION,
    position_id: options.position_id,
    type: 'ACCOUNT',
    label: options.label,
    valuation_date: date,
    currency: target.currency,
    value_minor: sourceKind === 'OBSERVED_BALANCE' ? result.observed_balance_minor : result.calculated_balance_minor,
    provenance: {
      source_kind: sourceKind,
      account_id: target.account_id,
      observation_id: target.observation_id,
      reconciliation_id: result.reconciliation_id,
      reconciliation_state: result.state
    }
  });
}

function declaredPosition(input) {
  return normalizePosition(input);
}

function normalizeSnapshot(input) {
  assertContract();
  exactKeys(input, ['schema', 'version', 'snapshot_id', 'valuation_date', 'currency', 'positions'], 'NW_SNAPSHOT_SHAPE_INVALID');
  if (input.schema !== SNAPSHOT_SCHEMA || input.version !== VERSION || !Array.isArray(input.positions)) fail('NW_SNAPSHOT_VERSION_INVALID');
  const date = valuationDate(input.valuation_date);
  const snapshotCurrency = currency(input.currency);
  const positions = input.positions.map(normalizePosition).sort((a, b) => a.type.localeCompare(b.type) || a.position_id.localeCompare(b.position_id));
  const positionIds = new Set();
  const accountIds = new Set();
  for (const position of positions) {
    if (position.valuation_date !== date) fail('NW_POSITION_VALUATION_DATE_MISMATCH');
    if (position.currency !== snapshotCurrency) fail('NW_POSITION_CURRENCY_MISMATCH');
    if (positionIds.has(position.position_id)) fail('NW_POSITION_ID_DUPLICATE');
    positionIds.add(position.position_id);
    if (position.type === 'ACCOUNT') {
      const accountId = position.provenance.account_id;
      if (accountIds.has(accountId)) fail('NW_ACCOUNT_POSITION_DUPLICATE');
      accountIds.add(accountId);
    }
  }
  return deepFreeze({
    schema: SNAPSHOT_SCHEMA,
    version: VERSION,
    snapshot_id: opaqueId(input.snapshot_id, 'NW_SNAPSHOT_ID_INVALID'),
    valuation_date: date,
    currency: snapshotCurrency,
    positions: deepFreeze(positions)
  });
}

function snapshotIdentity(snapshot) {
  return `nw-${crypto.createHash('sha256').update(stableStringify(snapshot), 'utf8').digest('hex').slice(0, 48)}`;
}

function evaluateNetWorth(input) {
  const snapshot = normalizeSnapshot(input);
  let signedAccounts = 0;
  let declaredAssets = 0;
  let declaredLiabilities = 0;
  let grossAssets = 0;
  let grossLiabilities = 0;

  for (const position of snapshot.positions) {
    if (position.type === 'ACCOUNT') {
      signedAccounts = safeAdd(signedAccounts, position.value_minor);
      if (position.value_minor >= 0) grossAssets = safeAdd(grossAssets, position.value_minor);
      else grossLiabilities = safeAdd(grossLiabilities, -position.value_minor);
    } else if (position.type === 'ASSET') {
      declaredAssets = safeAdd(declaredAssets, position.value_minor);
      grossAssets = safeAdd(grossAssets, position.value_minor);
    } else {
      declaredLiabilities = safeAdd(declaredLiabilities, position.value_minor);
      grossLiabilities = safeAdd(grossLiabilities, position.value_minor);
    }
  }

  let netWorth = safeAdd(signedAccounts, declaredAssets);
  netWorth = safeSub(netWorth, declaredLiabilities);
  const mismatchAccounts = snapshot.positions.filter((p) => p.type === 'ACCOUNT' && p.provenance.reconciliation_state === 'MISMATCH').length;

  return deepFreeze({
    schema: RESULT_SCHEMA,
    version: VERSION,
    net_worth_id: snapshotIdentity(snapshot),
    snapshot,
    signed_account_total_minor: signedAccounts,
    declared_asset_total_minor: declaredAssets,
    declared_liability_total_minor: declaredLiabilities,
    gross_assets_minor: grossAssets,
    gross_liabilities_minor: grossLiabilities,
    net_worth_minor: netWorth,
    status: mismatchAccounts > 0 ? 'RECONCILIATION_REVIEW_REQUIRED' : 'OK',
    provenance: deepFreeze({
      balance_contract: CONTRACT.dependencies.balance_reconciliation,
      financial_truth_policy: CONTRACT.dependencies.financial_truth_policy,
      financial_truth: false,
      fx_conversion_used: false,
      market_data_provider_used: false,
      mismatch_hidden: false,
      canonical_mutation: false,
      observation_mutation: false,
      financial_write: false
    })
  });
}

function serializeSnapshot(input) {
  return stableStringify(normalizeSnapshot(input));
}

function serializeNetWorth(input) {
  const result = input && input.schema === RESULT_SCHEMA ? input : evaluateNetWorth(input);
  return stableStringify(result);
}

function netWorthTelemetry(result) {
  if (!result || result.schema !== RESULT_SCHEMA || result.version !== VERSION) fail('NW_RESULT_INVALID');
  const positions = result.snapshot.positions;
  const accounts = positions.filter((p) => p.type === 'ACCOUNT');
  const output = {
    schema: TELEMETRY_SCHEMA,
    version: VERSION,
    position_count: positions.length,
    account_count: accounts.length,
    asset_count: positions.filter((p) => p.type === 'ASSET').length,
    liability_count: positions.filter((p) => p.type === 'LIABILITY').length,
    observed_account_count: accounts.filter((p) => p.provenance.source_kind === 'OBSERVED_BALANCE').length,
    calculated_account_count: accounts.filter((p) => p.provenance.source_kind === 'CALCULATED_BALANCE').length,
    mismatch_account_count: accounts.filter((p) => p.provenance.reconciliation_state === 'MISMATCH').length,
    status: result.status
  };
  const extra = Object.keys(output).filter((key) => !CONTRACT.telemetry_allowlist.includes(key));
  if (extra.length) fail('NW_TELEMETRY_FIELD_FORBIDDEN', extra.join(','));
  return deepFreeze(output);
}

assertContract();

module.exports = Object.freeze({
  CONTRACT,
  SCHEMA,
  VERSION,
  SNAPSHOT_SCHEMA,
  POSITION_SCHEMA,
  RESULT_SCHEMA,
  TELEMETRY_SCHEMA,
  assertContract,
  stableStringify,
  normalizePosition,
  accountPositionFromObservation,
  accountPositionFromReconciliation,
  declaredPosition,
  normalizeSnapshot,
  evaluateNetWorth,
  serializeSnapshot,
  serializeNetWorth,
  netWorthTelemetry
});
