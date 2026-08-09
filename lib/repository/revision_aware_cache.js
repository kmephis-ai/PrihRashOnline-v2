'use strict';

const crypto = require('crypto');
const CONTRACT = require('./revision_aware_cache.v1.json');
const { normalizeQuery } = require('./transaction_repository');

const REVISION_RE = /^[0-9a-f]{64}$/;
const TRANSACTION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function fail(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const output = {};
    for (const key of Object.keys(value).sort()) output[key] = stableValue(value[key]);
    return output;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function cloneValue(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function assertContract() {
  if (CONTRACT.schema !== 'PRH_REVISION_AWARE_READ_CACHE_V1' ||
      CONTRACT.version !== '1.0.0' || CONTRACT.roadmap_id !== 'PERF-011') {
    fail('REVISION_CACHE_CONTRACT_INVALID');
  }
  if (CONTRACT.repository_contract !== 'PRH_TRANSACTION_REPOSITORY_V1@1.0.0') {
    fail('REVISION_CACHE_REPOSITORY_CONTRACT_INVALID');
  }
  if (CONTRACT.freshness.revision_required_before_hit !== true ||
      CONTRACT.freshness.unknown_revision !== 'FAIL_CLOSED' ||
      CONTRACT.freshness.revision_change !== 'INVALIDATE_ALL') {
    fail('REVISION_CACHE_FRESHNESS_POLICY_INVALID');
  }
  if (CONTRACT.authority.financial_semantics !== false ||
      CONTRACT.authority.financial_write !== false ||
      CONTRACT.authority.network !== false ||
      CONTRACT.authority.external_provider_required !== false ||
      CONTRACT.authority.paid_dependency_required !== false ||
      CONTRACT.telemetry.financial_payload_allowed !== false) {
    fail('REVISION_CACHE_AUTHORITY_INVALID');
  }
  return true;
}

function normalizeOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) fail('REVISION_CACHE_OPTIONS_INVALID');
  const allowed = new Set(['ttl_ms', 'max_entries', 'now_ms']);
  for (const key of Object.keys(options)) if (!allowed.has(key)) fail('REVISION_CACHE_OPTION_UNKNOWN', key);
  const ttlMs = options.ttl_ms == null ? CONTRACT.bounds.default_ttl_ms : Number(options.ttl_ms);
  const maxEntries = options.max_entries == null ? CONTRACT.bounds.default_max_entries : Number(options.max_entries);
  if (!Number.isInteger(ttlMs) || ttlMs < 1 || ttlMs > CONTRACT.bounds.max_ttl_ms) {
    fail('REVISION_CACHE_TTL_INVALID');
  }
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > CONTRACT.bounds.max_entries) {
    fail('REVISION_CACHE_MAX_ENTRIES_INVALID');
  }
  const nowMs = options.now_ms == null ? Date.now : options.now_ms;
  if (typeof nowMs !== 'function') fail('REVISION_CACHE_CLOCK_INVALID');
  return Object.freeze({ ttl_ms: ttlMs, max_entries: maxEntries, now_ms: nowMs });
}

function normalizeRepository(repository) {
  if (!repository || typeof repository !== 'object' || Array.isArray(repository)) fail('REVISION_CACHE_REPOSITORY_INVALID');
  if (repository.schema !== 'PRH_TRANSACTION_REPOSITORY_V1') fail('REVISION_CACHE_REPOSITORY_SCHEMA_INVALID');
  for (const method of ['getRevision', 'readAll', 'getById', 'query']) {
    if (typeof repository[method] !== 'function') fail('REVISION_CACHE_REPOSITORY_METHOD_MISSING', method);
  }
  return repository;
}

function normalizeRevision(value) {
  const revision = String(value == null ? '' : value).trim();
  if (!REVISION_RE.test(revision)) fail('REVISION_CACHE_REVISION_UNKNOWN');
  return revision;
}

function normalizeOperationIdentity(operation, input) {
  if (operation === 'READ_ALL') return Object.freeze({ operation: 'READ_ALL' });
  if (operation === 'GET_BY_ID') {
    const transactionId = String(input == null ? '' : input).trim();
    if (!TRANSACTION_ID_RE.test(transactionId)) fail('REVISION_CACHE_TRANSACTION_ID_INVALID');
    return Object.freeze({ operation: 'GET_BY_ID', transaction_id: transactionId });
  }
  if (operation === 'QUERY') {
    return Object.freeze({ operation: 'QUERY', query: normalizeQuery(input || {}) });
  }
  fail('REVISION_CACHE_OPERATION_INVALID', operation);
}

function operationIdentityHash(operation, input) {
  return sha256(stableStringify(normalizeOperationIdentity(operation, input)));
}

function cacheKeyHash(repositorySchema, revision, operation, input) {
  const identityHash = operationIdentityHash(operation, input);
  return sha256(stableStringify({
    cache_schema: CONTRACT.schema,
    cache_version: CONTRACT.version,
    repository_schema: repositorySchema,
    repository_revision: revision,
    operation,
    normalized_operation_identity_hash: identityHash
  }));
}

function revisionTokenHashPrefix(revision) {
  return sha256(`revision:${revision}`).slice(0, 12);
}

function createRevisionAwareReadCache(repositoryInput, optionsInput = {}) {
  assertContract();
  const repository = normalizeRepository(repositoryInput);
  const options = normalizeOptions(optionsInput);
  const entries = new Map();
  let lastRevision = null;
  let evictionCount = 0;
  let invalidationCount = 0;
  let lastTelemetry = Object.freeze({
    cache_status: 'EMPTY',
    reason_code: 'CACHE_NOT_USED',
    operation: 'NONE',
    cache_key_hash: null,
    revision_token_hash_prefix: null,
    entry_count: 0,
    age_ms: null,
    eviction_count: 0,
    invalidation_count: 0
  });

  function now() {
    const value = Number(options.now_ms());
    if (!Number.isSafeInteger(value) || value < 0) fail('REVISION_CACHE_CLOCK_VALUE_INVALID');
    return value;
  }

  function setTelemetry(fields) {
    lastTelemetry = Object.freeze({
      cache_status: fields.cache_status,
      reason_code: fields.reason_code,
      operation: fields.operation,
      cache_key_hash: fields.cache_key_hash || null,
      revision_token_hash_prefix: fields.revision_token_hash_prefix || null,
      entry_count: entries.size,
      age_ms: fields.age_ms == null ? null : fields.age_ms,
      eviction_count: evictionCount,
      invalidation_count: invalidationCount
    });
  }

  function clear(reasonCode, operation, revision) {
    if (entries.size > 0) {
      entries.clear();
      invalidationCount += 1;
    }
    setTelemetry({
      cache_status: 'MISS',
      reason_code: reasonCode,
      operation,
      cache_key_hash: null,
      revision_token_hash_prefix: revision ? revisionTokenHashPrefix(revision) : null,
      age_ms: null
    });
  }

  function observeRevision(operation) {
    let revision;
    try {
      revision = normalizeRevision(repository.getRevision());
    } catch (error) {
      clear('REVISION_UNKNOWN', operation, null);
      throw error;
    }
    if (lastRevision !== null && revision !== lastRevision) {
      clear('REVISION_CHANGED', operation, revision);
    }
    lastRevision = revision;
    return revision;
  }

  function touch(key, entry) {
    entries.delete(key);
    entries.set(key, entry);
  }

  function evictIfNeeded() {
    while (entries.size > options.max_entries) {
      const oldestKey = entries.keys().next().value;
      entries.delete(oldestKey);
      evictionCount += 1;
    }
  }

  function execute(operation, input, loader) {
    const revision = observeRevision(operation);
    const key = cacheKeyHash(repository.schema, revision, operation, input);
    const currentTime = now();
    const cached = entries.get(key);
    if (cached) {
      const ageMs = currentTime - cached.created_at_ms;
      if (ageMs >= 0 && ageMs < options.ttl_ms && cached.revision === revision &&
          cached.cache_schema === CONTRACT.schema && cached.cache_version === CONTRACT.version) {
        touch(key, cached);
        setTelemetry({
          cache_status: 'HIT',
          reason_code: 'EXACT_REVISION_KEY_MATCH',
          operation,
          cache_key_hash: key,
          revision_token_hash_prefix: revisionTokenHashPrefix(revision),
          age_ms: ageMs
        });
        return cloneValue(cached.value);
      }
      entries.delete(key);
      setTelemetry({
        cache_status: 'MISS',
        reason_code: ageMs >= options.ttl_ms ? 'TTL_EXPIRED' : 'CACHE_ENTRY_INVALID',
        operation,
        cache_key_hash: key,
        revision_token_hash_prefix: revisionTokenHashPrefix(revision),
        age_ms: Math.max(0, ageMs)
      });
    } else {
      setTelemetry({
        cache_status: 'MISS',
        reason_code: lastTelemetry.reason_code === 'REVISION_CHANGED' ? 'REVISION_CHANGED' : 'CACHE_KEY_ABSENT',
        operation,
        cache_key_hash: key,
        revision_token_hash_prefix: revisionTokenHashPrefix(revision),
        age_ms: null
      });
    }

    const loaded = loader();
    entries.set(key, Object.freeze({
      cache_schema: CONTRACT.schema,
      cache_version: CONTRACT.version,
      revision,
      created_at_ms: currentTime,
      value: cloneValue(loaded)
    }));
    evictIfNeeded();
    setTelemetry({
      cache_status: 'MISS',
      reason_code: lastTelemetry.reason_code,
      operation,
      cache_key_hash: key,
      revision_token_hash_prefix: revisionTokenHashPrefix(revision),
      age_ms: 0
    });
    return cloneValue(loaded);
  }

  return Object.freeze({
    schema: 'PRH_TRANSACTION_REPOSITORY_READ_CACHE_V1',
    version: CONTRACT.version,
    repository_schema: repository.schema,
    capabilities: Object.freeze({ read: true, query: true, write: false, cache: true }),
    getRevision: () => repository.getRevision(),
    readAll: () => execute('READ_ALL', null, () => repository.readAll()),
    getById: (transactionId) => execute('GET_BY_ID', transactionId, () => repository.getById(transactionId)),
    query: (queryInput) => {
      const normalized = normalizeQuery(queryInput || {});
      return execute('QUERY', normalized, () => repository.query(normalized));
    },
    writeBatch: () => Object.freeze({ status: 'BLOCKED', reason_code: 'REVISION_CACHE_WRITE_NOT_AUTHORIZED' }),
    invalidate: () => {
      entries.clear();
      invalidationCount += 1;
      lastRevision = null;
      setTelemetry({ cache_status: 'EMPTY', reason_code: 'EXPLICIT_INVALIDATION', operation: 'NONE', age_ms: null });
      return true;
    },
    getTelemetry: () => Object.freeze({ ...lastTelemetry }),
    getEntryCount: () => entries.size
  });
}

module.exports = {
  CONTRACT,
  assertContract,
  stableStringify,
  normalizeOperationIdentity,
  operationIdentityHash,
  cacheKeyHash,
  createRevisionAwareReadCache
};
