'use strict';

const crypto = require('crypto');
const CONTRACT = require('./single_scan_refresh.v1.json');
const {
  REPOSITORY_SCHEMA,
  REPOSITORY_VERSION,
  applyQuery,
  repositoryRevision
} = require('./transaction_repository');
const {
  validateCanonicalCollection
} = require('../domain/canonical_transaction');
const {
  CONTRACT_SCHEMA: ANALYTICS_SCHEMA,
  CONTRACT_VERSION: ANALYTICS_VERSION,
  evaluateAnalytics
} = require('../analytics/analytics_engine');

const REVISION_RE = /^[0-9a-f]{64}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function cloneValue(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== 'PRH_SINGLE_SCAN_REFRESH_V1' ||
      CONTRACT.version !== '1.0.0' || CONTRACT.roadmap_id !== 'PERF-012') {
    fail('SINGLE_SCAN_REFRESH_CONTRACT_INVALID');
  }
  if (CONTRACT.repository_contract !== `${REPOSITORY_SCHEMA}@${REPOSITORY_VERSION}` ||
      CONTRACT.analytics_contract !== `${ANALYTICS_SCHEMA}@${ANALYTICS_VERSION}`) {
    fail('SINGLE_SCAN_REFRESH_UPSTREAM_CONTRACT_INVALID');
  }
  if (CONTRACT.snapshot.source !== 'READ_ALL_ONCE_PER_CYCLE' ||
      CONTRACT.snapshot.revision_strategy !== 'DERIVE_FROM_VALIDATED_CANONICAL_SNAPSHOT' ||
      CONTRACT.snapshot.cross_cycle_reuse !== false ||
      CONTRACT.execution.canonical_snapshot_reads_per_cycle !== 1 ||
      CONTRACT.execution.underlying_get_revision_calls !== 0 ||
      CONTRACT.execution.underlying_get_by_id_calls !== 0 ||
      CONTRACT.execution.underlying_query_calls !== 0) {
    fail('SINGLE_SCAN_REFRESH_EXECUTION_POLICY_INVALID');
  }
  if (CONTRACT.execution.query_semantic_authority !== 'PRH_TRANSACTION_REPOSITORY_V1.applyQuery' ||
      CONTRACT.execution.analytics_semantic_authority !== 'PRH_ANALYTICS_CONTRACT_V1.evaluateAnalytics') {
    fail('SINGLE_SCAN_REFRESH_SEMANTIC_AUTHORITY_INVALID');
  }
  if (CONTRACT.telemetry.financial_payload_allowed !== false ||
      CONTRACT.telemetry.raw_query_allowed !== false ||
      CONTRACT.telemetry.transaction_identity_allowed !== false ||
      CONTRACT.authority.financial_semantics !== false ||
      CONTRACT.authority.financial_write !== false ||
      CONTRACT.authority.migration !== false ||
      CONTRACT.authority.network !== false ||
      CONTRACT.authority.external_provider_required !== false ||
      CONTRACT.authority.paid_dependency_required !== false) {
    fail('SINGLE_SCAN_REFRESH_AUTHORITY_INVALID');
  }
  return true;
}

function normalizeOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) fail('SINGLE_SCAN_REFRESH_OPTIONS_INVALID');
  const allowed = new Set(['max_age_ms', 'max_operations', 'now_ms']);
  for (const key of Object.keys(options)) if (!allowed.has(key)) fail('SINGLE_SCAN_REFRESH_OPTION_UNKNOWN', key);
  const maxAgeMs = options.max_age_ms == null ? CONTRACT.bounds.default_max_age_ms : Number(options.max_age_ms);
  const maxOperations = options.max_operations == null
    ? CONTRACT.bounds.default_max_operations
    : Number(options.max_operations);
  if (!Number.isInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > CONTRACT.bounds.max_age_ms) {
    fail('SINGLE_SCAN_REFRESH_MAX_AGE_INVALID');
  }
  if (!Number.isInteger(maxOperations) || maxOperations < 1 || maxOperations > CONTRACT.bounds.max_operations) {
    fail('SINGLE_SCAN_REFRESH_MAX_OPERATIONS_INVALID');
  }
  const nowMs = options.now_ms == null ? Date.now : options.now_ms;
  if (typeof nowMs !== 'function') fail('SINGLE_SCAN_REFRESH_CLOCK_INVALID');
  return Object.freeze({ max_age_ms: maxAgeMs, max_operations: maxOperations, now_ms: nowMs });
}

function normalizeRepository(repository) {
  if (!repository || typeof repository !== 'object' || Array.isArray(repository)) {
    fail('SINGLE_SCAN_REFRESH_REPOSITORY_INVALID');
  }
  if (repository.schema !== REPOSITORY_SCHEMA) fail('SINGLE_SCAN_REFRESH_REPOSITORY_SCHEMA_INVALID');
  if (typeof repository.readAll !== 'function') fail('SINGLE_SCAN_REFRESH_READ_ALL_REQUIRED');
  if (repository.capabilities && repository.capabilities.read === false) fail('SINGLE_SCAN_REFRESH_READ_NOT_AUTHORIZED');
  return repository;
}

function createSingleScanRefresh(repositoryInput, optionsInput = {}) {
  assertContract();
  const repository = normalizeRepository(repositoryInput);
  const options = normalizeOptions(optionsInput);

  function now() {
    const value = Number(options.now_ms());
    if (!Number.isSafeInteger(value) || value < 0) fail('SINGLE_SCAN_REFRESH_CLOCK_VALUE_INVALID');
    return value;
  }

  const startedAtMs = now();
  const canonical = Object.freeze(validateCanonicalCollection(repository.readAll()).map((tx) => cloneValue(tx)));
  const revision = repositoryRevision(canonical);
  if (!REVISION_RE.test(revision)) fail('SINGLE_SCAN_REFRESH_REVISION_UNKNOWN');
  const cycleHash = sha256(`single-scan-cycle:${revision}:${startedAtMs}`);
  const revisionTokenHashPrefix = sha256(`revision:${revision}`).slice(0, 12);
  let snapshotStatus = 'ACTIVE';
  let reasonCode = 'SNAPSHOT_READY';
  let logicalOperationCount = 0;
  let snapshotReuseCount = 0;
  let readAllCount = 0;
  let getByIdCount = 0;
  let queryCount = 0;
  let analyticsCount = 0;
  let invalidationCount = 0;

  function ageMs() {
    const age = now() - startedAtMs;
    if (!Number.isSafeInteger(age) || age < 0) fail('SINGLE_SCAN_REFRESH_CLOCK_MOVED_BACKWARD');
    return age;
  }

  function assertUsable() {
    if (snapshotStatus === 'INVALIDATED') fail('SINGLE_SCAN_REFRESH_INVALIDATED');
    if (snapshotStatus === 'EXPIRED') fail('SINGLE_SCAN_REFRESH_EXPIRED');
    if (snapshotStatus === 'EXHAUSTED') fail('SINGLE_SCAN_REFRESH_OPERATION_BUDGET_EXHAUSTED');
    if (ageMs() >= options.max_age_ms) {
      snapshotStatus = 'EXPIRED';
      reasonCode = 'MAX_AGE_EXCEEDED';
      fail('SINGLE_SCAN_REFRESH_EXPIRED');
    }
    if (logicalOperationCount >= options.max_operations) {
      snapshotStatus = 'EXHAUSTED';
      reasonCode = 'MAX_OPERATIONS_EXCEEDED';
      fail('SINGLE_SCAN_REFRESH_OPERATION_BUDGET_EXHAUSTED');
    }
  }

  function recordOperation(operation) {
    assertUsable();
    if (logicalOperationCount > 0) snapshotReuseCount += 1;
    logicalOperationCount += 1;
    if (operation === 'READ_ALL') readAllCount += 1;
    else if (operation === 'GET_BY_ID') getByIdCount += 1;
    else if (operation === 'QUERY') queryCount += 1;
    else if (operation === 'ANALYTICS') analyticsCount += 1;
    else fail('SINGLE_SCAN_REFRESH_OPERATION_INVALID', operation);
    reasonCode = logicalOperationCount === 1 ? 'SNAPSHOT_FIRST_CONSUMER' : 'SNAPSHOT_REUSED';
  }

  function telemetry() {
    let observedStatus = snapshotStatus;
    let observedReason = reasonCode;
    let observedAge = ageMs();
    if (observedStatus === 'ACTIVE' && observedAge >= options.max_age_ms) {
      observedStatus = 'EXPIRED';
      observedReason = 'MAX_AGE_EXCEEDED';
    }
    return Object.freeze({
      snapshot_status: observedStatus,
      reason_code: observedReason,
      cycle_hash: cycleHash,
      revision_token_hash_prefix: revisionTokenHashPrefix,
      canonical_snapshot_read_count: 1,
      logical_operation_count: logicalOperationCount,
      snapshot_reuse_count: snapshotReuseCount,
      read_all_count: readAllCount,
      get_by_id_count: getByIdCount,
      query_count: queryCount,
      analytics_count: analyticsCount,
      invalidation_count: invalidationCount,
      age_ms: observedAge,
      max_age_ms: options.max_age_ms,
      max_operations: options.max_operations
    });
  }

  return Object.freeze({
    schema: 'PRH_SINGLE_SCAN_REFRESH_CYCLE_V1',
    version: CONTRACT.version,
    repository_schema: repository.schema,
    capabilities: Object.freeze({ read: true, query: true, analytics: true, write: false, single_scan: true }),
    getRevision: () => revision,
    readAll: () => {
      recordOperation('READ_ALL');
      return Object.freeze(canonical.map((tx) => cloneValue(tx)));
    },
    getById: (transactionId) => {
      const id = String(transactionId == null ? '' : transactionId).trim();
      if (!ID_RE.test(id)) fail('SINGLE_SCAN_REFRESH_TRANSACTION_ID_INVALID');
      recordOperation('GET_BY_ID');
      const result = applyQuery(canonical, { transaction_ids: [id], limit: 2 });
      return result.items.length === 0 ? null : cloneValue(result.items[0]);
    },
    query: (queryInput) => {
      recordOperation('QUERY');
      return cloneValue(applyQuery(canonical, queryInput || {}));
    },
    analytics: (queryInput) => {
      recordOperation('ANALYTICS');
      const result = evaluateAnalytics(canonical, queryInput);
      if (!result || !result.provenance || result.provenance.input_revision !== revision) {
        fail('SINGLE_SCAN_REFRESH_ANALYTICS_REVISION_MISMATCH');
      }
      return cloneValue(result);
    },
    writeBatch: () => Object.freeze({ status: 'BLOCKED', reason_code: 'SINGLE_SCAN_REFRESH_WRITE_NOT_AUTHORIZED' }),
    invalidate: () => {
      if (snapshotStatus !== 'INVALIDATED') invalidationCount += 1;
      snapshotStatus = 'INVALIDATED';
      reasonCode = 'EXPLICIT_INVALIDATION';
      return true;
    },
    getTelemetry: () => telemetry()
  });
}

module.exports = {
  CONTRACT,
  assertContract,
  createSingleScanRefresh
};
