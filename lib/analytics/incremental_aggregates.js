'use strict';

const crypto = require('crypto');
const CONTRACT = require('./incremental_aggregates.v1.json');
const { validateCanonicalCollection } = require('../domain/canonical_transaction');
const { repositoryRevision } = require('../repository/transaction_repository');
const { DICTIONARY, evaluateKpis } = require('../finance/kpi_dictionary');

const STATE_SCHEMA = 'PRH_INCREMENTAL_ANALYTICS_AGGREGATES_STATE_V1';
const REVISION_RE = /^[0-9a-f]{64}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const PROJECTIONS = Object.freeze(['MONTH', 'CATEGORY_ID', 'ACCOUNT_ID']);
const MEASURES = Object.freeze(['INCOME', 'EXPENSE', 'CASH_FLOW', 'SAVINGS', 'GROSS_EXPENSE', 'REFUND', 'TRANSFER']);
const OUTPUT_FIELDS = Object.freeze({
  INCOME: 'income_minor',
  EXPENSE: 'expense_minor',
  CASH_FLOW: 'cash_flow_minor',
  SAVINGS: 'savings_minor',
  GROSS_EXPENSE: 'gross_expense_minor',
  REFUND: 'refund_minor',
  TRANSFER: 'transfer_minor'
});

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = stableValue(value[key]);
    return result;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== 'PRH_INCREMENTAL_ANALYTICS_AGGREGATES_V1' ||
      CONTRACT.version !== '1.0.0' || CONTRACT.roadmap_id !== 'PERF-013') {
    fail('INCREMENTAL_AGGREGATES_CONTRACT_INVALID');
  }
  if (CONTRACT.financial_truth_policy !== 'FIN-TRUTH-v1' ||
      CONTRACT.state.schema !== STATE_SCHEMA ||
      CONTRACT.state.exact_base_revision_required !== true ||
      CONTRACT.state.state_hash_required !== true ||
      CONTRACT.delta.recompute_scope !== 'AFFECTED_PROJECTION_BUCKETS_ONLY' ||
      CONTRACT.semantics.measure_authority !== 'PRH_KPI_DICTIONARY_V1.evaluateKpis' ||
      CONTRACT.semantics.analytics_parity_authority !== 'PRH_ANALYTICS_CONTRACT_V1.evaluateAnalytics') {
    fail('INCREMENTAL_AGGREGATES_POLICY_INVALID');
  }
  if (stableStringify(CONTRACT.projections) !== stableStringify(PROJECTIONS) ||
      stableStringify(CONTRACT.measures) !== stableStringify(MEASURES)) {
    fail('INCREMENTAL_AGGREGATES_PROJECTION_MEASURE_INVALID');
  }
  if (CONTRACT.authority.financial_semantics !== false || CONTRACT.authority.financial_write !== false ||
      CONTRACT.authority.migration !== false || CONTRACT.authority.network !== false ||
      CONTRACT.authority.ui !== false || CONTRACT.authority.external_provider_required !== false ||
      CONTRACT.authority.paid_dependency_required !== false || CONTRACT.evidence.financial_payload_allowed !== false ||
      CONTRACT.evidence.transaction_identity_allowed !== false) {
    fail('INCREMENTAL_AGGREGATES_AUTHORITY_INVALID');
  }
  return true;
}

function normalizeCurrency(canonical, explicitCurrency) {
  const currencies = Array.from(new Set(canonical.map((tx) => tx.currency))).sort();
  const currency = explicitCurrency == null ? (currencies.length === 1 ? currencies[0] : '') : String(explicitCurrency).toUpperCase();
  if (!CURRENCY_RE.test(currency)) fail('INCREMENTAL_AGGREGATES_CURRENCY_REQUIRED');
  if (currencies.some((item) => item !== currency)) fail('INCREMENTAL_AGGREGATES_MIXED_CURRENCY_UNSUPPORTED');
  return currency;
}

function transactionFingerprint(tx) {
  return sha256(stableStringify(tx));
}

function bucketKey(tx, projection) {
  if (projection === 'MONTH') return tx.occurred_at.slice(0, 7);
  if (projection === 'CATEGORY_ID') return tx.category_id;
  if (projection === 'ACCOUNT_ID') return tx.account_id;
  fail('INCREMENTAL_AGGREGATES_PROJECTION_INVALID', projection);
}

function membershipFor(tx) {
  return Object.freeze({
    fingerprint: transactionFingerprint(tx),
    MONTH: bucketKey(tx, 'MONTH'),
    CATEGORY_ID: bucketKey(tx, 'CATEGORY_ID'),
    ACCOUNT_ID: bucketKey(tx, 'ACCOUNT_ID')
  });
}

function buildMembershipIndex(canonical) {
  const index = {};
  for (const tx of canonical.slice().sort((a, b) => a.transaction_id.localeCompare(b.transaction_id))) {
    index[tx.transaction_id] = membershipFor(tx);
  }
  return index;
}

function evaluateMeasures(transactions, currency) {
  const report = evaluateKpis(transactions, { currency, budget_minor: null });
  const measures = {};
  for (const measure of MEASURES) {
    const value = report[OUTPUT_FIELDS[measure]];
    if (!Number.isSafeInteger(value)) fail('INCREMENTAL_AGGREGATES_MEASURE_INVALID', measure);
    measures[measure] = value;
  }
  return Object.freeze(measures);
}

function projectionRows(canonical, projection, currency) {
  const groups = new Map();
  for (const tx of canonical) {
    const key = bucketKey(tx, projection);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  }
  return Object.freeze(Array.from(groups.keys()).sort().map((key) => Object.freeze({
    key,
    measures: evaluateMeasures(groups.get(key), currency)
  })));
}

function buildProjections(canonical, currency) {
  return Object.freeze({
    MONTH: projectionRows(canonical, 'MONTH', currency),
    CATEGORY_ID: projectionRows(canonical, 'CATEGORY_ID', currency),
    ACCOUNT_ID: projectionRows(canonical, 'ACCOUNT_ID', currency)
  });
}

function stateHashPayload(state) {
  return {
    schema: state.schema,
    contract_version: state.contract_version,
    currency: state.currency,
    canonical_revision: state.canonical_revision,
    projections: state.projections,
    membership_index: state.membership_index
  };
}

function computeStateHash(state) {
  return sha256(stableStringify(stateHashPayload(state)));
}

function validateMeasures(measures) {
  if (!measures || typeof measures !== 'object' || Array.isArray(measures)) fail('INCREMENTAL_AGGREGATES_STATE_MEASURES_INVALID');
  const keys = Object.keys(measures).sort();
  if (stableStringify(keys) !== stableStringify(MEASURES.slice().sort())) fail('INCREMENTAL_AGGREGATES_STATE_MEASURES_INVALID');
  for (const key of keys) if (!Number.isSafeInteger(measures[key])) fail('INCREMENTAL_AGGREGATES_STATE_MEASURE_VALUE_INVALID');
}

function validateState(stateInput) {
  assertContract();
  if (!stateInput || typeof stateInput !== 'object' || Array.isArray(stateInput)) fail('INCREMENTAL_AGGREGATES_STATE_INVALID');
  const state = stateInput;
  const expectedKeys = ['canonical_revision', 'contract_version', 'currency', 'membership_index', 'projections', 'schema', 'state_hash'].sort();
  if (stableStringify(Object.keys(state).sort()) !== stableStringify(expectedKeys)) fail('INCREMENTAL_AGGREGATES_STATE_SHAPE_INVALID');
  if (state.schema !== STATE_SCHEMA || state.contract_version !== CONTRACT.version) fail('INCREMENTAL_AGGREGATES_STATE_VERSION_INVALID');
  if (!CURRENCY_RE.test(String(state.currency || ''))) fail('INCREMENTAL_AGGREGATES_STATE_CURRENCY_INVALID');
  if (!REVISION_RE.test(String(state.canonical_revision || ''))) fail('INCREMENTAL_AGGREGATES_STATE_REVISION_INVALID');
  if (!state.projections || typeof state.projections !== 'object' || Array.isArray(state.projections)) fail('INCREMENTAL_AGGREGATES_STATE_PROJECTIONS_INVALID');
  if (stableStringify(Object.keys(state.projections).sort()) !== stableStringify(PROJECTIONS.slice().sort())) {
    fail('INCREMENTAL_AGGREGATES_STATE_PROJECTIONS_INVALID');
  }
  for (const projection of PROJECTIONS) {
    if (!Array.isArray(state.projections[projection])) fail('INCREMENTAL_AGGREGATES_STATE_PROJECTION_ROWS_INVALID');
    let previous = null;
    for (const row of state.projections[projection]) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).sort().join(',') !== 'key,measures') {
        fail('INCREMENTAL_AGGREGATES_STATE_PROJECTION_ROW_INVALID');
      }
      const key = String(row.key || '');
      if (!key || (previous != null && key <= previous)) fail('INCREMENTAL_AGGREGATES_STATE_PROJECTION_ORDER_INVALID');
      previous = key;
      validateMeasures(row.measures);
    }
  }
  if (!state.membership_index || typeof state.membership_index !== 'object' || Array.isArray(state.membership_index)) {
    fail('INCREMENTAL_AGGREGATES_STATE_MEMBERSHIP_INVALID');
  }
  for (const [id, member] of Object.entries(state.membership_index)) {
    if (!id || !member || typeof member !== 'object' || Array.isArray(member)) fail('INCREMENTAL_AGGREGATES_STATE_MEMBERSHIP_INVALID');
    const memberKeys = Object.keys(member).sort();
    if (stableStringify(memberKeys) !== stableStringify(['ACCOUNT_ID', 'CATEGORY_ID', 'MONTH', 'fingerprint'].sort())) {
      fail('INCREMENTAL_AGGREGATES_STATE_MEMBERSHIP_SHAPE_INVALID');
    }
    if (!REVISION_RE.test(String(member.fingerprint || '')) || !String(member.MONTH || '') ||
        !String(member.CATEGORY_ID || '') || !String(member.ACCOUNT_ID || '')) {
      fail('INCREMENTAL_AGGREGATES_STATE_MEMBERSHIP_VALUE_INVALID');
    }
  }
  if (!REVISION_RE.test(String(state.state_hash || '')) || computeStateHash(state) !== state.state_hash) {
    fail('INCREMENTAL_AGGREGATES_STATE_HASH_MISMATCH');
  }
  return state;
}

function makeState(canonical, currency, revision, projections, membershipIndex) {
  const partial = {
    schema: STATE_SCHEMA,
    contract_version: CONTRACT.version,
    currency,
    canonical_revision: revision,
    projections: clone(projections),
    membership_index: clone(membershipIndex)
  };
  return Object.freeze({ ...partial, state_hash: computeStateHash(partial) });
}

function revisionHashPrefix(revision) {
  return sha256(`aggregate-revision:${revision}`).slice(0, 12);
}

function evidence(operation, status, baseRevision, resultRevision, delta, affectedBucketCount, recomputedBucketCount) {
  return Object.freeze({
    operation,
    status,
    base_revision_hash_prefix: baseRevision ? revisionHashPrefix(baseRevision) : null,
    result_revision_hash_prefix: revisionHashPrefix(resultRevision),
    added_count: delta.added.length,
    removed_count: delta.removed.length,
    changed_count: delta.changed.length,
    affected_bucket_count: affectedBucketCount,
    recomputed_bucket_count: recomputedBucketCount,
    projection_count: PROJECTIONS.length
  });
}

function buildIncrementalAggregates(transactions, options = {}) {
  assertContract();
  const canonical = validateCanonicalCollection(transactions).slice();
  const currency = normalizeCurrency(canonical, options.currency);
  const revision = repositoryRevision(canonical);
  const membershipIndex = buildMembershipIndex(canonical);
  const projections = buildProjections(canonical, currency);
  const state = makeState(canonical, currency, revision, projections, membershipIndex);
  const bucketCount = PROJECTIONS.reduce((sum, projection) => sum + projections[projection].length, 0);
  return Object.freeze({
    state,
    evidence: evidence('FULL_BUILD', 'PASS', null, revision, { added: Object.keys(membershipIndex), removed: [], changed: [] }, bucketCount, bucketCount)
  });
}

function diffMembership(previous, next) {
  const added = [];
  const removed = [];
  const changed = [];
  for (const id of Object.keys(next).sort()) {
    if (!previous[id]) added.push(id);
    else if (previous[id].fingerprint !== next[id].fingerprint) changed.push(id);
  }
  for (const id of Object.keys(previous).sort()) if (!next[id]) removed.push(id);
  return Object.freeze({ added: Object.freeze(added), removed: Object.freeze(removed), changed: Object.freeze(changed) });
}

function affectedBuckets(delta, previous, next) {
  const affected = { MONTH: new Set(), CATEGORY_ID: new Set(), ACCOUNT_ID: new Set() };
  const ids = [...delta.added, ...delta.removed, ...delta.changed];
  for (const id of ids) {
    for (const projection of PROJECTIONS) {
      if (previous[id]) affected[projection].add(previous[id][projection]);
      if (next[id]) affected[projection].add(next[id][projection]);
    }
  }
  return affected;
}

function mergeProjectionRows(previousRows, canonical, projection, currency, affectedKeys) {
  const byKey = new Map(previousRows.map((row) => [row.key, clone(row)]));
  for (const key of Array.from(affectedKeys).sort()) {
    const group = canonical.filter((tx) => bucketKey(tx, projection) === key);
    if (group.length === 0) byKey.delete(key);
    else byKey.set(key, { key, measures: clone(evaluateMeasures(group, currency)) });
  }
  return Object.freeze(Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key)).map((row) => Object.freeze({
    key: row.key,
    measures: Object.freeze({ ...row.measures })
  })));
}

function updateIncrementalAggregates(stateInput, nextTransactions, options = {}) {
  const state = validateState(stateInput);
  const expectedBaseRevision = String(options.expected_base_revision || '');
  if (!REVISION_RE.test(expectedBaseRevision)) fail('INCREMENTAL_AGGREGATES_EXPECTED_BASE_REVISION_REQUIRED');
  if (expectedBaseRevision !== state.canonical_revision) fail('INCREMENTAL_AGGREGATES_BASE_REVISION_MISMATCH');
  const canonical = validateCanonicalCollection(nextTransactions).slice();
  const currency = normalizeCurrency(canonical, options.currency == null ? state.currency : options.currency);
  if (currency !== state.currency) fail('INCREMENTAL_AGGREGATES_CURRENCY_CHANGE_UNSUPPORTED');
  const resultRevision = repositoryRevision(canonical);
  const nextMembership = buildMembershipIndex(canonical);
  const delta = diffMembership(state.membership_index, nextMembership);
  if (resultRevision === state.canonical_revision) {
    if (delta.added.length || delta.removed.length || delta.changed.length) fail('INCREMENTAL_AGGREGATES_REVISION_DELTA_CONTRADICTION');
    return Object.freeze({
      state: Object.freeze(clone(state)),
      evidence: evidence('INCREMENTAL_UPDATE', 'NOOP', state.canonical_revision, resultRevision, delta, 0, 0)
    });
  }
  if (!delta.added.length && !delta.removed.length && !delta.changed.length) fail('INCREMENTAL_AGGREGATES_REVISION_DELTA_CONTRADICTION');
  const affected = affectedBuckets(delta, state.membership_index, nextMembership);
  const projections = {};
  let affectedBucketCount = 0;
  let recomputedBucketCount = 0;
  for (const projection of PROJECTIONS) {
    affectedBucketCount += affected[projection].size;
    projections[projection] = mergeProjectionRows(state.projections[projection], canonical, projection, currency, affected[projection]);
    recomputedBucketCount += affected[projection].size;
  }
  const nextState = makeState(canonical, currency, resultRevision, projections, nextMembership);
  return Object.freeze({
    state: nextState,
    evidence: evidence('INCREMENTAL_UPDATE', 'PASS', state.canonical_revision, resultRevision, delta, affectedBucketCount, recomputedBucketCount)
  });
}

module.exports = {
  CONTRACT,
  STATE_SCHEMA,
  PROJECTIONS,
  MEASURES,
  assertContract,
  stableStringify,
  transactionFingerprint,
  bucketKey,
  computeStateHash,
  validateState,
  buildIncrementalAggregates,
  updateIncrementalAggregates
};
