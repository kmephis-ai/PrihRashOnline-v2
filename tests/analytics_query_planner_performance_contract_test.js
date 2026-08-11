'use strict';

const assert = require('assert');
const { performance } = require('perf_hooks');
const CONTRACT = require('../lib/performance/analytics_query_planner_cache.v1.json');
const { createAnalyticsQueryPlanner } = require('../lib/performance/analytics_query_planner_cache');
const { buildIncrementalAggregates } = require('../lib/analytics/incremental_aggregates');
const { generateSyntheticScaleTransactions } = require('../lib/testing/synthetic_scale_fixture');

function query() {
  return {
    schema: 'PRH_ANALYTICS_QUERY_V1',
    contract_version: '1.0.0',
    currency: 'RUB',
    measures: ['INCOME', 'EXPENSE', 'CASH_FLOW', 'SAVINGS', 'GROSS_EXPENSE', 'REFUND', 'TRANSFER'],
    dimensions: ['category_id'],
    filters: [],
    time_range: null,
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 500
  };
}

function elapsedMs(start) {
  return Math.ceil((performance.now() - start) * 1000) / 1000;
}

assert.deepStrictEqual(CONTRACT.budgets.profiles, [20000, 50000]);
assert.strictEqual(CONTRACT.budgets.warm_extra_canonical_evaluations, 0);
assert.strictEqual(CONTRACT.budgets.warm_extra_aggregate_builds, 0);
assert.strictEqual(CONTRACT.budgets.financial_writes, 0);
assert.strictEqual(CONTRACT.budgets.wall_clock_is_user_sla, false);
assert.strictEqual(CONTRACT.budgets.warm_query_ceiling_ms, 100);

const results = [];
for (const operations of CONTRACT.budgets.profiles) {
  const dataset = generateSyntheticScaleTransactions(operations, 0x700000 + operations);
  let aggregateBuilds = 0;
  let financialWrites = 0;
  aggregateBuilds += 1;
  const aggregate = buildIncrementalAggregates(dataset, { currency: 'RUB' });
  const planner = createAnalyticsQueryPlanner(dataset, {
    aggregate_state: aggregate.state,
    max_entries: 16,
    ttl_ms: 120000,
    evaluate: () => {
      throw new Error('PERF070_CANONICAL_EVALUATOR_NOT_EXPECTED_FOR_SUPPORTED_QUERY');
    }
  });

  const coldStart = performance.now();
  const cold = planner.execute(query());
  const coldElapsed = elapsedMs(coldStart);
  assert.strictEqual(cold.source, 'AGGREGATE_REUSE');
  assert.strictEqual(cold.status, 'READY');

  const telemetryBeforeWarm = planner.getTelemetry();
  const aggregateBuildsBeforeWarm = aggregateBuilds;
  const writesBeforeWarm = financialWrites;
  const warmStart = performance.now();
  const warm = planner.execute(query());
  const warmElapsed = elapsedMs(warmStart);
  assert.strictEqual(warm.source, 'MEMORY_CACHE');
  assert.strictEqual(warm.reason, 'CACHE_HIT');
  assert.strictEqual(warm.fingerprint_hash, cold.fingerprint_hash);
  assert.deepStrictEqual(warm.result, cold.result);
  assert(warmElapsed <= CONTRACT.budgets.warm_query_ceiling_ms,
    `PERF-070 warm ${operations} exceeded generous CI ceiling: ${warmElapsed}ms > ${CONTRACT.budgets.warm_query_ceiling_ms}ms`);

  const telemetryAfterWarm = planner.getTelemetry();
  assert.strictEqual(
    telemetryAfterWarm.canonical_evaluations - telemetryBeforeWarm.canonical_evaluations,
    CONTRACT.budgets.warm_extra_canonical_evaluations
  );
  assert.strictEqual(aggregateBuilds - aggregateBuildsBeforeWarm, CONTRACT.budgets.warm_extra_aggregate_builds);
  assert.strictEqual(financialWrites - writesBeforeWarm, CONTRACT.budgets.financial_writes);
  assert.strictEqual(telemetryAfterWarm.aggregate_reuses, 1, 'warm request must not rebuild/reuse aggregate again');
  assert.strictEqual(telemetryAfterWarm.cache_hits, 1);
  assert.strictEqual(telemetryAfterWarm.cache_misses, 1);

  const result = {
    operations,
    cold_ms: coldElapsed,
    warm_ms: warmElapsed,
    aggregate_builds: aggregateBuilds,
    warm_extra_aggregate_builds: aggregateBuilds - aggregateBuildsBeforeWarm,
    warm_extra_canonical_evaluations: telemetryAfterWarm.canonical_evaluations - telemetryBeforeWarm.canonical_evaluations,
    financial_writes: financialWrites - writesBeforeWarm,
    cache_hits: telemetryAfterWarm.cache_hits,
    status: 'PASS'
  };
  const publicJson = JSON.stringify(result);
  for (const forbidden of ['amount_minor', 'transaction_id', 'category_id', 'account_id', 'source_fingerprint', 'canonical_revision']) {
    assert.strictEqual(publicJson.includes(forbidden), false, `PERF-070 evidence leaked ${forbidden}`);
  }
  results.push(result);
}

console.log('analytics_query_planner_performance_contract_test: OK', {
  contract: 'PRH_ANALYTICS_QUERY_PLANNER_CACHE_V1@1.0.0',
  profiles: results,
  warmExtraCanonicalEvaluations: 0,
  warmExtraAggregateBuilds: 0,
  financialWrites: 0,
  wallClockIsUserSla: false,
  freeOnly: true
});
