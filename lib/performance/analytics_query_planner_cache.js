'use strict';

const crypto = require('crypto');
const CONTRACT = require('./analytics_query_planner_cache.v1.json');
const ANALYTICS = require('../analytics/analytics_engine');
const SEMANTIC = require('../analytics/semantic_registry');
const PIVOT = require('../analytics/pivot_olap');
const {
  CONTRACT: AGGREGATE_CONTRACT,
  MEASURES: AGGREGATE_MEASURES,
  validateState: validateAggregateState
} = require('../analytics/incremental_aggregates');
const { repositoryRevision } = require('../repository/transaction_repository');

const SCHEMA = 'PRH_ANALYTICS_QUERY_PLANNER_CACHE_V1';
const VERSION = '1.0.0';
const FINGERPRINT_SCHEMA = 'PRH_ANALYTICS_QUERY_FINGERPRINT_V1';
const EXECUTION_SCHEMA = 'PRH_ANALYTICS_QUERY_PLANNER_EXECUTION_V1';
const HASH_RE = /^[0-9a-f]{64}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function stableStringify(value) {
  return ANALYTICS.stableStringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function hashPrefix(value) {
  return sha256(String(value)).slice(0, 12);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeInteger(value, reason) {
  if (!Number.isSafeInteger(value)) fail(reason);
  return value;
}

function assertContract() {
  if (!CONTRACT || CONTRACT.schema !== SCHEMA || CONTRACT.version !== VERSION || CONTRACT.roadmap_id !== 'PERF-070' ||
      CONTRACT.fingerprint_schema !== FINGERPRINT_SCHEMA || CONTRACT.execution_schema !== EXECUTION_SCHEMA) {
    fail('QUERY_PLANNER_CONTRACT_VERSION_INVALID');
  }
  const upstream = CONTRACT.upstream || {};
  if (upstream.analytics_contract !== `PRH_ANALYTICS_CONTRACT_V1@${ANALYTICS.CONTRACT_VERSION}` ||
      upstream.semantic_registry !== `${SEMANTIC.SCHEMA}@${SEMANTIC.VERSION}` ||
      upstream.revision_cache !== 'PRH_REVISION_AWARE_READ_CACHE_V1@1.0.0' ||
      upstream.single_scan_refresh !== 'PRH_SINGLE_SCAN_REFRESH_V1@1.0.0' ||
      upstream.incremental_aggregates !== `${AGGREGATE_CONTRACT.schema}@${AGGREGATE_CONTRACT.version}` ||
      upstream.pivot_olap !== `${PIVOT.SCHEMA}@${PIVOT.VERSION}` || upstream.financial_truth_policy !== 'FIN-TRUTH-v1') {
    fail('QUERY_PLANNER_UPSTREAM_CONTRACT_INVALID');
  }
  if (CONTRACT.fingerprint.hash !== 'SHA-256' || CONTRACT.fingerprint.raw_query_in_telemetry !== false ||
      CONTRACT.cache.eviction !== 'LRU' || CONTRACT.cache.revision_change !== 'INVALIDATE_ALL' ||
      CONTRACT.aggregate_reuse.fallback !== 'CANONICAL_EVALUATE_ANALYTICS' || CONTRACT.aggregate_reuse.heuristic_reuse !== false ||
      CONTRACT.async.same_fingerprint !== 'COALESCE_INFLIGHT' || CONTRACT.async.stale_completion !== 'DISCARD_STALE' ||
      CONTRACT.budgets.financial_writes !== 0 || CONTRACT.budgets.wall_clock_is_user_sla !== false ||
      !CONTRACT.authority || Object.values(CONTRACT.authority).some((value) => value !== false)) {
    fail('QUERY_PLANNER_POLICY_INVALID');
  }
  return true;
}

function normalizeLimits(options) {
  const maxEntries = options.max_entries == null ? CONTRACT.cache.max_entries_default : Number(options.max_entries);
  const ttlMs = options.ttl_ms == null ? CONTRACT.cache.ttl_ms_default : Number(options.ttl_ms);
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > CONTRACT.cache.max_entries_limit) {
    fail('QUERY_PLANNER_MAX_ENTRIES_INVALID');
  }
  if (!Number.isInteger(ttlMs) || ttlMs < 1 || ttlMs > CONTRACT.cache.ttl_ms_max) fail('QUERY_PLANNER_TTL_INVALID');
  return { maxEntries, ttlMs };
}

function queryFingerprint(queryInput, revision) {
  assertContract();
  const normalized = ANALYTICS.normalizeAnalyticsQuery(queryInput);
  if (!HASH_RE.test(String(revision || ''))) fail('QUERY_PLANNER_REVISION_INVALID');
  const payload = {
    schema: FINGERPRINT_SCHEMA,
    planner_version: VERSION,
    analytics_version: ANALYTICS.CONTRACT_VERSION,
    semantic_version: SEMANTIC.VERSION,
    canonical_revision: revision,
    query: normalized
  };
  return Object.freeze({
    schema: FINGERPRINT_SCHEMA,
    version: VERSION,
    hash: sha256(stableStringify(payload)),
    query_hash: ANALYTICS.analyticsQueryHash(normalized),
    canonical_revision: revision,
    normalized_query: normalized
  });
}

function monthAligned(range) {
  return range && /^\d{4}-\d{2}-01$/.test(range.start) && /^\d{4}-\d{2}-01$/.test(range.end);
}

function aggregateProjectionFor(query) {
  if (query.comparison.mode !== 'NONE' || query.filters.length !== 0 || query.sort.length !== 0 ||
      query.parameters.budget_minor != null || query.measures.some((measure) => !AGGREGATE_MEASURES.includes(measure))) {
    return null;
  }
  if (query.grain === 'NONE' && query.time_range == null && query.dimensions.length === 1 && query.dimensions[0] === 'category_id') {
    return 'CATEGORY_ID';
  }
  if (query.grain === 'NONE' && query.time_range == null && query.dimensions.length === 1 && query.dimensions[0] === 'account_id') {
    return 'ACCOUNT_ID';
  }
  if (query.grain === 'MONTH' && query.dimensions.length === 0 && monthAligned(query.time_range)) return 'MONTH';
  return null;
}

function projectionRowsForQuery(state, projection, query) {
  let rows = state.projections[projection];
  if (projection === 'MONTH') {
    const startKey = query.time_range.start.slice(0, 7);
    const endKey = query.time_range.end.slice(0, 7);
    rows = rows.filter((row) => row.key >= startKey && row.key < endKey);
  }
  return rows;
}

function buildAggregateAnalyticsResult(stateInput, queryInput) {
  const state = validateAggregateState(stateInput);
  const query = ANALYTICS.normalizeAnalyticsQuery(queryInput);
  const projection = aggregateProjectionFor(query);
  if (!projection) fail('QUERY_PLANNER_AGGREGATE_QUERY_INCOMPATIBLE');
  if (query.currency !== state.currency) fail('QUERY_PLANNER_AGGREGATE_CURRENCY_MISMATCH');
  const sourceRows = projectionRowsForQuery(state, projection, query);
  const builtRows = sourceRows.map((row) => {
    const dimensions = projection === 'MONTH'
      ? { time_bucket: row.key }
      : projection === 'CATEGORY_ID'
        ? { category_id: row.key }
        : { account_id: row.key };
    const measures = {};
    for (const measure of query.measures) measures[measure] = safeInteger(row.measures[measure], 'QUERY_PLANNER_AGGREGATE_MEASURE_INVALID');
    return Object.freeze({
      dimensions: Object.freeze(dimensions),
      measures: Object.freeze(measures),
      comparison_measures: null
    });
  });
  const totalRows = builtRows.length;
  const rows = Object.freeze(builtRows.slice(0, query.limit));
  const queryHash = ANALYTICS.analyticsQueryHash(query);
  return Object.freeze({
    schema: ANALYTICS.RESULT_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    query_hash: queryHash,
    currency: query.currency,
    time_range: query.time_range,
    grain: query.grain,
    comparison: Object.freeze({ mode: 'NONE', time_range: null }),
    total_rows: totalRows,
    truncated: rows.length < totalRows,
    rows,
    provenance: Object.freeze({
      contract_version: ANALYTICS.CONTRACT_VERSION,
      query_hash: queryHash,
      canonical_schema: 'PRH_CANONICAL_TRANSACTION_V1',
      kpi_dictionary_version: '1.0.0',
      financial_truth_policy: 'FIN-TRUTH-v1',
      input_revision: state.canonical_revision,
      legacy_total_cells_used: false,
      ui_logic_used: false
    })
  });
}

function validateExecutionResult(result, fingerprint) {
  if (!result || result.schema !== ANALYTICS.RESULT_SCHEMA || result.contract_version !== ANALYTICS.CONTRACT_VERSION ||
      result.query_hash !== fingerprint.query_hash || !result.provenance ||
      result.provenance.financial_truth_policy !== 'FIN-TRUTH-v1' ||
      result.provenance.input_revision !== fingerprint.canonical_revision ||
      result.provenance.legacy_total_cells_used !== false || result.provenance.ui_logic_used !== false) {
    fail('QUERY_PLANNER_RESULT_PROVENANCE_INVALID');
  }
  return result;
}

function executionEnvelope(status, reason, source, fingerprint, result, generation, coalesced) {
  return Object.freeze({
    schema: EXECUTION_SCHEMA,
    contract_version: VERSION,
    status,
    reason,
    source,
    fingerprint_hash: fingerprint.hash,
    query_hash: fingerprint.query_hash,
    revision: fingerprint.canonical_revision,
    generation,
    coalesced: coalesced === true,
    result: result == null ? null : result
  });
}

function createAnalyticsQueryPlanner(snapshotInput, options = {}) {
  assertContract();
  const limits = normalizeLimits(options);
  const nowMs = typeof options.now_ms === 'function' ? options.now_ms : () => Date.now();
  const evaluator = typeof options.evaluate === 'function' ? options.evaluate : ANALYTICS.evaluateAnalytics;
  const asyncEvaluator = typeof options.evaluate_async === 'function'
    ? options.evaluate_async
    : (snapshot, query) => Promise.resolve(evaluator(snapshot, query));

  let snapshot = Array.isArray(snapshotInput) ? snapshotInput.slice() : fail('QUERY_PLANNER_SNAPSHOT_INVALID');
  let revision = repositoryRevision(snapshot);
  let aggregateState = options.aggregate_state == null ? null : validateAggregateState(options.aggregate_state);
  if (aggregateState && aggregateState.canonical_revision !== revision) fail('QUERY_PLANNER_AGGREGATE_REVISION_MISMATCH');
  let generation = 1;
  let sequence = 0;
  const cache = new Map();
  const inflight = new Map();
  const counters = {
    cache_hits: 0,
    cache_misses: 0,
    aggregate_reuses: 0,
    canonical_evaluations: 0,
    coalesced_requests: 0,
    stale_discards: 0,
    evictions: 0,
    expirations: 0
  };

  function expireEntries() {
    const now = nowMs();
    for (const [key, entry] of Array.from(cache.entries())) {
      if (now - entry.created_at_ms >= limits.ttlMs) {
        cache.delete(key);
        counters.expirations += 1;
      }
    }
  }

  function evictIfNeeded() {
    while (cache.size > limits.maxEntries) {
      const entries = Array.from(cache.entries()).sort((a, b) => {
        if (a[1].last_access_ms !== b[1].last_access_ms) return a[1].last_access_ms - b[1].last_access_ms;
        return a[1].sequence - b[1].sequence;
      });
      cache.delete(entries[0][0]);
      counters.evictions += 1;
    }
  }

  function cacheGet(fingerprint) {
    expireEntries();
    const entry = cache.get(fingerprint.hash);
    if (!entry) return null;
    entry.last_access_ms = nowMs();
    counters.cache_hits += 1;
    return entry.result;
  }

  function cachePut(fingerprint, result) {
    const now = nowMs();
    sequence += 1;
    cache.set(fingerprint.hash, {
      result,
      created_at_ms: now,
      last_access_ms: now,
      sequence
    });
    evictIfNeeded();
  }

  function materialize(fingerprint) {
    if (aggregateState && aggregateState.canonical_revision === revision && aggregateProjectionFor(fingerprint.normalized_query)) {
      counters.aggregate_reuses += 1;
      return Object.freeze({ source: 'AGGREGATE_REUSE', result: validateExecutionResult(
        buildAggregateAnalyticsResult(aggregateState, fingerprint.normalized_query), fingerprint
      ) });
    }
    counters.canonical_evaluations += 1;
    return Object.freeze({ source: 'CANONICAL_EVALUATOR', result: validateExecutionResult(
      evaluator(snapshot, fingerprint.normalized_query), fingerprint
    ) });
  }

  function execute(queryInput) {
    const fingerprint = queryFingerprint(queryInput, revision);
    const hit = cacheGet(fingerprint);
    if (hit) return executionEnvelope('READY', 'CACHE_HIT', 'MEMORY_CACHE', fingerprint, hit, generation, false);
    counters.cache_misses += 1;
    const materialized = materialize(fingerprint);
    cachePut(fingerprint, materialized.result);
    return executionEnvelope('READY', materialized.source, materialized.source, fingerprint, materialized.result, generation, false);
  }

  function executeAsync(queryInput, request = {}) {
    const requestGeneration = request.generation == null ? generation : Number(request.generation);
    const fingerprint = queryFingerprint(queryInput, revision);
    if (!Number.isInteger(requestGeneration) || requestGeneration !== generation) {
      counters.stale_discards += 1;
      return Promise.resolve(executionEnvelope('DISCARDED_STALE', 'REQUEST_GENERATION_STALE', 'NONE', fingerprint, null, generation, false));
    }
    const hit = cacheGet(fingerprint);
    if (hit) return Promise.resolve(executionEnvelope('READY', 'CACHE_HIT', 'MEMORY_CACHE', fingerprint, hit, generation, false));

    const inflightKey = `${generation}:${fingerprint.hash}`;
    const existing = inflight.get(inflightKey);
    if (existing) {
      counters.coalesced_requests += 1;
      return existing.then((envelope) => Object.freeze({ ...envelope, coalesced: true }));
    }
    counters.cache_misses += 1;
    const startGeneration = generation;
    const startRevision = revision;
    let promise;
    if (aggregateState && aggregateState.canonical_revision === revision && aggregateProjectionFor(fingerprint.normalized_query)) {
      counters.aggregate_reuses += 1;
      promise = Promise.resolve({
        source: 'AGGREGATE_REUSE',
        result: buildAggregateAnalyticsResult(aggregateState, fingerprint.normalized_query)
      });
    } else {
      counters.canonical_evaluations += 1;
      promise = Promise.resolve().then(() => asyncEvaluator(snapshot.slice(), fingerprint.normalized_query));
    }
    const tracked = promise.then((materialized) => {
      if (generation !== startGeneration || revision !== startRevision) {
        counters.stale_discards += 1;
        return executionEnvelope('DISCARDED_STALE', 'COMPLETION_GENERATION_OR_REVISION_STALE', materialized.source || 'CANONICAL_EVALUATOR', fingerprint, null, generation, false);
      }
      const result = validateExecutionResult(materialized.result || materialized, fingerprint);
      cachePut(fingerprint, result);
      return executionEnvelope('READY', materialized.source || 'CANONICAL_EVALUATOR', materialized.source || 'CANONICAL_EVALUATOR', fingerprint, result, generation, false);
    }).finally(() => {
      if (inflight.get(inflightKey) === tracked) inflight.delete(inflightKey);
    });
    inflight.set(inflightKey, tracked);
    return tracked;
  }

  function advanceGeneration() {
    generation += 1;
    return generation;
  }

  function replaceSnapshot(nextSnapshotInput, replaceOptions = {}) {
    if (!Array.isArray(nextSnapshotInput)) fail('QUERY_PLANNER_SNAPSHOT_INVALID');
    const nextSnapshot = nextSnapshotInput.slice();
    const nextRevision = repositoryRevision(nextSnapshot);
    const nextAggregate = replaceOptions.aggregate_state == null ? null : validateAggregateState(replaceOptions.aggregate_state);
    if (nextAggregate && nextAggregate.canonical_revision !== nextRevision) fail('QUERY_PLANNER_AGGREGATE_REVISION_MISMATCH');
    const changed = nextRevision !== revision;
    snapshot = nextSnapshot;
    revision = nextRevision;
    aggregateState = nextAggregate;
    if (changed) {
      generation += 1;
      cache.clear();
    }
    return Object.freeze({ changed, revision, generation });
  }

  function invalidate() {
    cache.clear();
    generation += 1;
    return generation;
  }

  function getTelemetry(lastStatus = 'READY', lastReason = 'OK', lastFingerprint = null) {
    const output = Object.freeze({
      schema: SCHEMA,
      version: VERSION,
      status: lastStatus,
      reason: lastReason,
      fingerprint_hash_prefix: lastFingerprint ? String(lastFingerprint).slice(0, 12) : null,
      revision_hash_prefix: hashPrefix(revision),
      cache_entries: cache.size,
      inflight_entries: inflight.size,
      generation,
      cache_hits: counters.cache_hits,
      cache_misses: counters.cache_misses,
      aggregate_reuses: counters.aggregate_reuses,
      canonical_evaluations: counters.canonical_evaluations,
      coalesced_requests: counters.coalesced_requests,
      stale_discards: counters.stale_discards,
      evictions: counters.evictions,
      expirations: counters.expirations
    });
    if (JSON.stringify(Object.keys(output).sort()) !== JSON.stringify(CONTRACT.telemetry_allowlist.slice().sort())) {
      fail('QUERY_PLANNER_TELEMETRY_CONTRACT_MISMATCH');
    }
    return output;
  }

  return Object.freeze({
    schema: SCHEMA,
    contract_version: VERSION,
    execute,
    executeAsync,
    replaceSnapshot,
    advanceGeneration,
    invalidate,
    getRevision: () => revision,
    getGeneration: () => generation,
    getTelemetry,
    capabilities: Object.freeze({ cache: true, aggregate_reuse: true, inflight_coalescing: true, write: false, network: false })
  });
}

module.exports = Object.freeze({
  SCHEMA,
  VERSION,
  FINGERPRINT_SCHEMA,
  EXECUTION_SCHEMA,
  CONTRACT,
  assertContract,
  queryFingerprint,
  aggregateProjectionFor,
  buildAggregateAnalyticsResult,
  createAnalyticsQueryPlanner
});
