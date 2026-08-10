'use strict';

const assert = require('assert');
const { performance } = require('perf_hooks');
const CONTRACT = require('../lib/performance/synthetic_scale_gate.v1.json');
const {
  generateSyntheticScaleTransactions,
  mutateSyntheticScaleTransactions
} = require('../lib/testing/synthetic_scale_fixture');
const {
  REPOSITORY_SCHEMA,
  repositoryRevision
} = require('../lib/repository/transaction_repository');
const { createSingleScanRefresh } = require('../lib/repository/single_scan_refresh');
const { evaluateAnalytics } = require('../lib/analytics/analytics_engine');
const {
  MEASURES,
  buildIncrementalAggregates,
  updateIncrementalAggregates
} = require('../lib/analytics/incremental_aggregates');

function elapsedMs(start) {
  return Math.ceil((performance.now() - start) * 1000) / 1000;
}

function timed(metric, ceiling, fn) {
  const start = performance.now();
  const value = fn();
  const elapsed = elapsedMs(start);
  assert(elapsed <= ceiling, `${metric} exceeded PERF-014 ceiling: ${elapsed}ms > ${ceiling}ms`);
  return { value, elapsed };
}

function analyticsQuery() {
  return {
    schema: 'PRH_ANALYTICS_QUERY_V1',
    contract_version: '1.0.0',
    currency: 'RUB',
    measures: MEASURES.slice(),
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

assert.strictEqual(CONTRACT.schema, 'PRH_SYNTHETIC_SCALE_GATE_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.roadmap_id, 'PERF-014');
assert.strictEqual(CONTRACT.fixture.generator, 'PRH_SYNTHETIC_SCALE_FIXTURE_V1');
assert.strictEqual(CONTRACT.fixture.production_derived, false);
assert.strictEqual(CONTRACT.fixture.persist_dataset_artifact, false);
assert.deepStrictEqual(CONTRACT.profiles.map((profile) => profile.operations), [20000, 50000]);
assert.strictEqual(CONTRACT.budgets.canonical_reads_per_refresh_cycle, 1);
assert.strictEqual(CONTRACT.budgets.financial_writes, 0);
assert.strictEqual(CONTRACT.budgets.regression_threshold_breach, 'FAIL_PR');
assert.strictEqual(CONTRACT.budgets.wall_clock_is_user_sla, false);
assert.strictEqual(CONTRACT.evidence.financial_payload_allowed, false);
assert.strictEqual(CONTRACT.authority.financial_write, false);
assert.strictEqual(CONTRACT.authority.paid_dependency_required, false);

const results = [];
for (const profile of CONTRACT.profiles) {
  const dataset = generateSyntheticScaleTransactions(profile.operations, CONTRACT.fixture.seed);
  assert.strictEqual(dataset.length, profile.operations);
  const ceilings = profile.ceilings_ms;

  const revisionRun = timed(`${profile.id}:canonical_revision`, ceilings.canonical_revision, () => repositoryRevision(dataset));
  assert(/^[0-9a-f]{64}$/.test(revisionRun.value));

  const analyticsRun = timed(`${profile.id}:analytics_full_recompute`, ceilings.analytics_full_recompute, () =>
    evaluateAnalytics(dataset, analyticsQuery())
  );
  assert.strictEqual(analyticsRun.value.provenance.input_revision, revisionRun.value);

  let canonicalReads = 0;
  let financialWrites = 0;
  const countedRepository = {
    schema: REPOSITORY_SCHEMA,
    capabilities: { read: true, query: true, write: false, revision: true },
    readAll: () => { canonicalReads += 1; return dataset; },
    writeBatch: () => { financialWrites += 1; throw new Error('PERF014_UNDERLYING_WRITE_FORBIDDEN'); }
  };
  const singleScanRun = timed(`${profile.id}:single_scan_linked_refresh`, ceilings.single_scan_linked_refresh, () => {
    const cycle = createSingleScanRefresh(countedRepository, { max_age_ms: 300000, max_operations: 16 });
    const queryResult = cycle.query({ types: ['expense'], statuses: ['posted'], limit: 50 });
    const analyticsResult = cycle.analytics(analyticsQuery());
    const item = cycle.getById('SCALE-000001');
    const blocked = cycle.writeBatch({ ignored: true });
    return { queryResult, analyticsResult, item, blocked, telemetry: cycle.getTelemetry() };
  });
  assert.strictEqual(canonicalReads, CONTRACT.budgets.canonical_reads_per_refresh_cycle);
  assert.strictEqual(financialWrites, CONTRACT.budgets.financial_writes);
  assert.strictEqual(singleScanRun.value.blocked.status, 'BLOCKED');
  assert.strictEqual(singleScanRun.value.telemetry.canonical_snapshot_read_count, 1);

  const aggregateBuildRun = timed(`${profile.id}:aggregate_full_build`, ceilings.aggregate_full_build, () =>
    buildIncrementalAggregates(dataset, { currency: 'RUB' })
  );
  assert.strictEqual(aggregateBuildRun.value.state.canonical_revision, revisionRun.value);

  const nextDataset = mutateSyntheticScaleTransactions(dataset, profile.delta_operations, CONTRACT.fixture.seed + 1000);
  const incrementalRun = timed(`${profile.id}:incremental_update`, ceilings.incremental_update, () =>
    updateIncrementalAggregates(aggregateBuildRun.value.state, nextDataset, {
      expected_base_revision: aggregateBuildRun.value.state.canonical_revision,
      currency: 'RUB'
    })
  );
  assert.strictEqual(incrementalRun.value.evidence.added_count, 0);
  assert.strictEqual(incrementalRun.value.evidence.removed_count, 0);
  assert.strictEqual(incrementalRun.value.evidence.changed_count, profile.delta_operations);
  assert.strictEqual(
    incrementalRun.value.evidence.recomputed_bucket_count,
    incrementalRun.value.evidence.affected_bucket_count
  );
  assert(incrementalRun.value.evidence.affected_bucket_count > 0);

  const parityRun = timed(`${profile.id}:aggregate_parity_rebuild`, ceilings.aggregate_parity_rebuild, () =>
    buildIncrementalAggregates(nextDataset, { currency: 'RUB' })
  );
  assert.deepStrictEqual(incrementalRun.value.state.projections, parityRun.value.state.projections);
  assert.strictEqual(incrementalRun.value.state.canonical_revision, parityRun.value.state.canonical_revision);
  assert.strictEqual(incrementalRun.value.state.state_hash, parityRun.value.state.state_hash);

  const result = {
    profile: profile.id,
    operations: profile.operations,
    delta_operations: profile.delta_operations,
    elapsed_ms: {
      canonical_revision: revisionRun.elapsed,
      analytics_full_recompute: analyticsRun.elapsed,
      single_scan_linked_refresh: singleScanRun.elapsed,
      aggregate_full_build: aggregateBuildRun.elapsed,
      incremental_update: incrementalRun.elapsed,
      aggregate_parity_rebuild: parityRun.elapsed
    },
    canonical_reads: canonicalReads,
    financial_writes: financialWrites,
    changed_count: incrementalRun.value.evidence.changed_count,
    affected_bucket_count: incrementalRun.value.evidence.affected_bucket_count,
    recomputed_bucket_count: incrementalRun.value.evidence.recomputed_bucket_count,
    status: 'PASS'
  };
  const publicJson = JSON.stringify(result);
  for (const forbidden of ['SCALE-000001', 'CAT-', 'ACC-', 'amount_minor', 'source_fingerprint', 'transaction_id']) {
    assert(!publicJson.includes(forbidden), `PERF-014 public evidence leaked payload/identity: ${forbidden}`);
  }
  results.push(result);
}

console.log('synthetic_scale_performance_contract_test: OK', {
  contract: 'PRH_SYNTHETIC_SCALE_GATE_V1@1.0.0',
  profiles: results,
  productionDerived: false,
  financialWrites: 0,
  wallClockIsUserSla: false,
  regressionThreshold: 'FAIL_PR',
  externalProviderRequired: false,
  freeOnly: true
});
