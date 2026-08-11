'use strict';

const assert = require('assert');
const {
  SCHEMA,
  VERSION,
  CONTRACT,
  assertContract,
  queryFingerprint,
  aggregateProjectionFor,
  buildAggregateAnalyticsResult,
  createAnalyticsQueryPlanner
} = require('../lib/performance/analytics_query_planner_cache');
const { evaluateAnalytics } = require('../lib/analytics/analytics_engine');
const { buildIncrementalAggregates } = require('../lib/analytics/incremental_aggregates');
const { generateSyntheticScaleTransactions, mutateSyntheticScaleTransactions } = require('../lib/testing/synthetic_scale_fixture');

function query(overrides = {}) {
  return {
    schema: 'PRH_ANALYTICS_QUERY_V1',
    contract_version: '1.0.0',
    currency: 'RUB',
    measures: ['EXPENSE', 'INCOME'],
    dimensions: ['category_id'],
    filters: [],
    time_range: null,
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 500,
    ...overrides
  };
}

async function main() {
  assert.strictEqual(assertContract(), true);
  assert.strictEqual(CONTRACT.schema, SCHEMA);
  assert.strictEqual(CONTRACT.version, VERSION);
  assert.strictEqual(CONTRACT.roadmap_id, 'PERF-070');
  assert.strictEqual(CONTRACT.aggregate_reuse.heuristic_reuse, false);
  assert.strictEqual(CONTRACT.async.stale_completion, 'DISCARD_STALE');
  assert.strictEqual(CONTRACT.budgets.financial_writes, 0);
  assert.ok(Object.values(CONTRACT.authority).every((value) => value === false));

  const dataset = generateSyntheticScaleTransactions(600, 0x707070);
  const aggregate = buildIncrementalAggregates(dataset, { currency: 'RUB' });
  const revision = aggregate.state.canonical_revision;

  const equivalentA = query({
    filters: [
      { field: 'status', operator: 'EQ', values: ['posted'] },
      { field: 'type', operator: 'IN', values: ['expense', 'refund'] }
    ]
  });
  const equivalentB = {
    limit: 500,
    parameters: {},
    sort: [],
    comparison: { mode: 'NONE' },
    grain: 'NONE',
    time_range: null,
    filters: [
      { values: ['refund', 'expense'], operator: 'IN', field: 'type' },
      { values: ['posted'], field: 'status', operator: 'EQ' }
    ],
    dimensions: ['category_id'],
    measures: ['EXPENSE', 'INCOME'],
    currency: 'RUB',
    contract_version: '1.0.0',
    schema: 'PRH_ANALYTICS_QUERY_V1'
  };
  const fingerprintA = queryFingerprint(equivalentA, revision);
  const fingerprintB = queryFingerprint(equivalentB, revision);
  assert.strictEqual(fingerprintA.hash, fingerprintB.hash, 'filter/object ordering must normalize to one fingerprint');
  assert.strictEqual(fingerprintA.query_hash, fingerprintB.query_hash);
  assert.throws(() => queryFingerprint(query(), 'not-a-revision'), /QUERY_PLANNER_REVISION_INVALID/);

  const categoryQuery = query();
  assert.strictEqual(aggregateProjectionFor(fingerprintA.normalized_query), null, 'filtered query must not use aggregate projection');
  assert.strictEqual(aggregateProjectionFor(queryFingerprint(categoryQuery, revision).normalized_query), 'CATEGORY_ID');
  const categoryAggregate = buildAggregateAnalyticsResult(aggregate.state, categoryQuery);
  const categoryCanonical = evaluateAnalytics(dataset, categoryQuery);
  assert.deepStrictEqual(categoryAggregate, categoryCanonical, 'CATEGORY_ID aggregate reuse must be byte-parity with canonical evaluator');

  const accountQuery = query({ dimensions: ['account_id'], measures: ['EXPENSE', 'CASH_FLOW'] });
  assert.strictEqual(aggregateProjectionFor(queryFingerprint(accountQuery, revision).normalized_query), 'ACCOUNT_ID');
  assert.deepStrictEqual(buildAggregateAnalyticsResult(aggregate.state, accountQuery), evaluateAnalytics(dataset, accountQuery));

  const monthQuery = query({
    dimensions: [],
    measures: ['EXPENSE', 'INCOME', 'CASH_FLOW'],
    time_range: { start: '2024-01-01', end: '2026-01-01' },
    grain: 'MONTH'
  });
  assert.strictEqual(aggregateProjectionFor(queryFingerprint(monthQuery, revision).normalized_query), 'MONTH');
  assert.deepStrictEqual(buildAggregateAnalyticsResult(aggregate.state, monthQuery), evaluateAnalytics(dataset, monthQuery));
  const partialMonthQuery = query({ dimensions: [], measures: ['EXPENSE'], time_range: { start: '2024-01-15', end: '2024-03-01' }, grain: 'MONTH' });
  assert.strictEqual(aggregateProjectionFor(queryFingerprint(partialMonthQuery, revision).normalized_query), null, 'partial month range must fall back');

  let canonicalEvaluations = 0;
  const planner = createAnalyticsQueryPlanner(dataset, {
    aggregate_state: aggregate.state,
    max_entries: 4,
    ttl_ms: 60000,
    evaluate: (snapshot, normalized) => {
      canonicalEvaluations += 1;
      return evaluateAnalytics(snapshot, normalized);
    }
  });
  assert.strictEqual(planner.capabilities.write, false);
  assert.strictEqual(planner.capabilities.network, false);
  const cold = planner.execute(categoryQuery);
  assert.strictEqual(cold.status, 'READY');
  assert.strictEqual(cold.source, 'AGGREGATE_REUSE');
  assert.deepStrictEqual(cold.result, categoryCanonical);
  assert.strictEqual(canonicalEvaluations, 0);
  const warm = planner.execute(categoryQuery);
  assert.strictEqual(warm.reason, 'CACHE_HIT');
  assert.strictEqual(warm.source, 'MEMORY_CACHE');
  assert.deepStrictEqual(warm.result, cold.result);
  assert.strictEqual(canonicalEvaluations, 0);
  let telemetry = planner.getTelemetry('READY', warm.reason, warm.fingerprint_hash);
  assert.strictEqual(telemetry.cache_hits, 1);
  assert.strictEqual(telemetry.cache_misses, 1);
  assert.strictEqual(telemetry.aggregate_reuses, 1);
  assert.strictEqual(telemetry.canonical_evaluations, 0);
  for (const forbidden of ['amount_minor', 'value_minor', 'transaction_id', 'category_id', 'account_id', 'filters', 'raw_query']) {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(telemetry, forbidden), false, forbidden);
  }

  const fallbackQuery = equivalentA;
  const fallback = planner.execute(fallbackQuery);
  assert.strictEqual(fallback.source, 'CANONICAL_EVALUATOR');
  assert.deepStrictEqual(fallback.result, evaluateAnalytics(dataset, fallbackQuery));
  assert.strictEqual(canonicalEvaluations, 1);
  const fallbackWarm = planner.execute(equivalentB);
  assert.strictEqual(fallbackWarm.reason, 'CACHE_HIT');
  assert.strictEqual(canonicalEvaluations, 1, 'equivalent normalized query must reuse cache');

  const nextDataset = mutateSyntheticScaleTransactions(dataset, 12, 0x707071);
  const nextAggregate = buildIncrementalAggregates(nextDataset, { currency: 'RUB' });
  const replaced = planner.replaceSnapshot(nextDataset, { aggregate_state: nextAggregate.state });
  assert.strictEqual(replaced.changed, true);
  assert.notStrictEqual(replaced.revision, revision);
  const afterRevision = planner.execute(categoryQuery);
  assert.strictEqual(afterRevision.source, 'AGGREGATE_REUSE', 'new revision must miss old cache then safely reuse new exact aggregate state');
  telemetry = planner.getTelemetry('READY', afterRevision.reason, afterRevision.fingerprint_hash);
  assert.strictEqual(telemetry.cache_entries, 1, 'revision change must invalidate prior revision cache');

  assert.throws(() => createAnalyticsQueryPlanner(dataset, { aggregate_state: nextAggregate.state }), /QUERY_PLANNER_AGGREGATE_REVISION_MISMATCH/);

  let now = 1000;
  const bounded = createAnalyticsQueryPlanner(dataset, {
    aggregate_state: aggregate.state,
    max_entries: 2,
    ttl_ms: 10,
    now_ms: () => now
  });
  bounded.execute(query({ measures: ['EXPENSE'] }));
  now += 1;
  bounded.execute(accountQuery);
  now += 1;
  bounded.execute(monthQuery);
  telemetry = bounded.getTelemetry();
  assert.strictEqual(telemetry.cache_entries, 2);
  assert.strictEqual(telemetry.evictions, 1, 'third entry must evict LRU');
  now += 20;
  bounded.execute(monthQuery);
  telemetry = bounded.getTelemetry();
  assert(telemetry.expirations >= 1, 'expired entries must be removed before lookup');

  let asyncCalls = 0;
  const deferred = [];
  const asyncPlanner = createAnalyticsQueryPlanner(dataset, {
    evaluate_async: (snapshot, normalized) => {
      asyncCalls += 1;
      return new Promise((resolve) => deferred.push(() => resolve(evaluateAnalytics(snapshot, normalized))));
    }
  });
  const asyncQuery = equivalentA;
  const firstPromise = asyncPlanner.executeAsync(asyncQuery);
  const secondPromise = asyncPlanner.executeAsync(equivalentB);
  assert.strictEqual(asyncCalls, 0, 'async evaluator starts in next microtask');
  await Promise.resolve();
  assert.strictEqual(asyncCalls, 1, 'same generation/fingerprint must coalesce one evaluator');
  assert.strictEqual(deferred.length, 1);
  deferred.shift()();
  const [firstAsync, secondAsync] = await Promise.all([firstPromise, secondPromise]);
  assert.strictEqual(firstAsync.status, 'READY');
  assert.strictEqual(secondAsync.status, 'READY');
  assert.strictEqual(secondAsync.coalesced, true);
  telemetry = asyncPlanner.getTelemetry();
  assert.strictEqual(telemetry.coalesced_requests, 1);
  assert.strictEqual(telemetry.canonical_evaluations, 1);

  const stalePlannerDeferred = [];
  const stalePlanner = createAnalyticsQueryPlanner(dataset, {
    evaluate_async: (snapshot, normalized) => new Promise((resolve) => stalePlannerDeferred.push(() => resolve(evaluateAnalytics(snapshot, normalized))))
  });
  const oldGeneration = stalePlanner.getGeneration();
  const stalePromise = stalePlanner.executeAsync(asyncQuery, { generation: oldGeneration });
  await Promise.resolve();
  assert.strictEqual(stalePlannerDeferred.length, 1);
  stalePlanner.advanceGeneration();
  stalePlannerDeferred.shift()();
  const stale = await stalePromise;
  assert.strictEqual(stale.status, 'DISCARDED_STALE');
  assert.strictEqual(stale.reason, 'COMPLETION_GENERATION_OR_REVISION_STALE');
  assert.strictEqual(stale.result, null);
  telemetry = stalePlanner.getTelemetry();
  assert.strictEqual(telemetry.stale_discards, 1);
  assert.strictEqual(telemetry.cache_entries, 0, 'stale completion must never be cached');
  const staleRequest = await stalePlanner.executeAsync(asyncQuery, { generation: oldGeneration });
  assert.strictEqual(staleRequest.status, 'DISCARDED_STALE');
  assert.strictEqual(staleRequest.reason, 'REQUEST_GENERATION_STALE');

  const revisionDeferred = [];
  const revisionPlanner = createAnalyticsQueryPlanner(dataset, {
    evaluate_async: (snapshot, normalized) => new Promise((resolve) => revisionDeferred.push(() => resolve(evaluateAnalytics(snapshot, normalized))))
  });
  const revisionPromise = revisionPlanner.executeAsync(asyncQuery);
  await Promise.resolve();
  revisionPlanner.replaceSnapshot(nextDataset);
  revisionDeferred.shift()();
  const revisionStale = await revisionPromise;
  assert.strictEqual(revisionStale.status, 'DISCARDED_STALE');
  assert.strictEqual(revisionStale.result, null);

  console.log('analytics_query_planner_cache_contract_test: OK', {
    contract: `${SCHEMA}@${VERSION}`,
    fingerprintNormalization: true,
    aggregateParity: ['CATEGORY_ID', 'ACCOUNT_ID', 'MONTH'],
    cacheHitSameRevision: true,
    revisionInvalidation: true,
    ttlLruBounded: true,
    inflightCoalescing: true,
    generationStaleDiscard: true,
    revisionStaleDiscard: true,
    publicTelemetryFinancialPayload: false,
    financialWrite: false,
    freeOnly: true
  });
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
