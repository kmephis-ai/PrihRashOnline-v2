'use strict';

const assert = require('assert');
const { performance } = require('perf_hooks');
const CONTRACT = require('../lib/performance/studio_scale_performance.v1.json');
const { planPresentation, createStudioScaleCoordinator } = require('../lib/performance/studio_scale_performance');
const { createAnalyticsQueryPlanner } = require('../lib/performance/analytics_query_planner_cache');
const { buildIncrementalAggregates } = require('../lib/analytics/incremental_aggregates');
const { generateSyntheticScaleTransactions } = require('../lib/testing/synthetic_scale_fixture');

function query(kind) {
  const dimensions = kind === 'ACCOUNT' ? ['account_id'] : ['category_id'];
  return {
    schema: 'PRH_ANALYTICS_QUERY_V1',
    contract_version: '1.0.0',
    currency: 'RUB',
    measures: ['INCOME', 'EXPENSE', 'CASH_FLOW'],
    dimensions,
    filters: [],
    time_range: null,
    grain: 'NONE',
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 500
  };
}

function widgets(visible, deferred) {
  const kinds = ['CATEGORY', 'ACCOUNT'];
  const result = [];
  for (let index = 0; index < visible; index += 1) {
    result.push({
      widget_id: `SYN-W-${index}`,
      visibility: 'VISIBLE',
      query: query(kinds[Math.floor(index / 4) % kinds.length]),
      presentation: { semantic_downsampling_safe: index % 2 === 0, accessible_table: true }
    });
  }
  for (let index = 0; index < deferred; index += 1) {
    result.push({
      widget_id: `SYN-D-${index}`,
      visibility: index % 2 === 0 ? 'HIDDEN' : 'OFFSCREEN',
      query: query('CATEGORY'),
      presentation: { semantic_downsampling_safe: false, accessible_table: true }
    });
  }
  return result;
}

function assertPublicTelemetrySafe(telemetry) {
  const json = JSON.stringify(telemetry);
  for (const forbidden of [
    'amount_minor', 'measures', 'dimensions', 'filters', 'transaction_id', 'account_id', 'category_id',
    'widget_id', 'query_hash', 'canonical_revision', 'rows', 'result'
  ]) {
    assert.strictEqual(json.includes(forbidden), false, `PERF-090 telemetry leaked ${forbidden}`);
  }
}

async function main() {
  assert.strictEqual(CONTRACT.schema, 'PRH_STUDIO_SCALE_PERFORMANCE_V1');
  assert.strictEqual(CONTRACT.version, '1.0.0');
  assert.strictEqual(CONTRACT.roadmap_id, 'PERF-090');
  assert.strictEqual(CONTRACT.authority.financial_truth, false);
  assert.strictEqual(CONTRACT.authority.financial_write, false);
  assert.strictEqual(CONTRACT.authority.query_semantics, false);
  assert.strictEqual(CONTRACT.authority.canonical_result_mutation, false);
  assert.strictEqual(CONTRACT.authority.network, false);
  assert.strictEqual(CONTRACT.authority.paid_dependency_required, false);
  assert.strictEqual(CONTRACT.visibility.deferred_query_requests, 0);
  assert.strictEqual(CONTRACT.visibility.deferred_render_commits, 0);
  assert.strictEqual(CONTRACT.scheduler.same_query, 'DELEGATE_TO_PERF_070_COALESCE_INFLIGHT');
  assert.strictEqual(CONTRACT.scheduler.stale_render_commit, false);
  assert.strictEqual(CONTRACT.presentation.downsampling_query_hash_mutation, false);
  assert.strictEqual(CONTRACT.presentation.downsampling_canonical_result_mutation, false);

  const queryHash = 'a'.repeat(64);
  const direct = planPresentation({ query_hash: queryHash, row_count: 40 }, { accessible_table: true });
  assert.strictEqual(direct.mode, 'DIRECT');
  assert.strictEqual(direct.render_rows, 40);
  assert.strictEqual(direct.query_hash, queryHash);
  assert.strictEqual(direct.canonical_result_mutated, false);

  const downsample = planPresentation(
    { query_hash: queryHash, row_count: CONTRACT.presentation.direct_render_row_limit + 5000 },
    { semantic_downsampling_safe: true, accessible_table: true }
  );
  assert.strictEqual(downsample.mode, 'VIEW_ONLY_DOWNSAMPLE');
  assert.strictEqual(downsample.render_rows, CONTRACT.presentation.direct_render_row_limit);
  assert.strictEqual(downsample.query_hash_unchanged, true);
  assert.strictEqual(downsample.canonical_result_mutated, false);

  const virtualized = planPresentation(
    { query_hash: queryHash, row_count: CONTRACT.presentation.direct_render_row_limit + 5000 },
    { semantic_downsampling_safe: false, accessible_table: true }
  );
  assert.strictEqual(virtualized.mode, 'VIRTUALIZED_ACCESSIBLE_TABLE');
  assert.strictEqual(virtualized.render_rows, CONTRACT.presentation.virtualized_table_window_rows);
  assert.throws(() => planPresentation(
    { query_hash: queryHash, row_count: 9999 },
    { semantic_downsampling_safe: true, accessible_table: false }
  ), /STUDIO_SCALE_ACCESSIBLE_FALLBACK_REQUIRED/);

  const benchmarkEvidence = [];
  for (const profile of CONTRACT.budgets.profiles) {
    const dataset = generateSyntheticScaleTransactions(profile.operations, 0x900000 + profile.operations);
    const aggregate = buildIncrementalAggregates(dataset, { currency: 'RUB' });
    const planner = createAnalyticsQueryPlanner(dataset, {
      aggregate_state: aggregate.state,
      max_entries: 32,
      ttl_ms: 120000,
      evaluate: () => {
        throw new Error('PERF090_CANONICAL_EVALUATOR_NOT_EXPECTED_FOR_SUPPORTED_QUERY');
      }
    });
    let financialWrites = 0;
    const coordinator = createStudioScaleCoordinator({
      max_concurrency: CONTRACT.scheduler.max_concurrency_default,
      execute_query: (analyticsQuery, request) => planner.executeAsync(analyticsQuery, request),
      get_query_generation: () => planner.getGeneration(),
      advance_query_generation: () => planner.advanceGeneration(),
      get_revision: () => planner.getRevision(),
      commit_render: async (_widget, execution, presentation) => {
        assert.strictEqual(presentation.query_hash, execution.query_hash);
        assert.strictEqual(presentation.query_hash_unchanged, true);
        assert.strictEqual(presentation.canonical_result_mutated, false);
        return { status: 'COMMITTED' };
      }
    });
    const workload = widgets(profile.visible_widgets, profile.deferred_widgets);
    const before = planner.getTelemetry();
    const started = performance.now();
    const run = await coordinator.run(workload, { profile: String(profile.operations) });
    const elapsed = Math.ceil((performance.now() - started) * 1000) / 1000;
    const after = planner.getTelemetry();

    assert.strictEqual(run.telemetry.visible_widgets, profile.visible_widgets);
    assert.strictEqual(run.telemetry.deferred_widgets, profile.deferred_widgets);
    assert.strictEqual(run.telemetry.query_requests, profile.visible_widgets);
    assert.strictEqual(run.telemetry.render_commits, profile.visible_widgets);
    assert(run.telemetry.query_requests <= profile.max_query_requests);
    assert(run.telemetry.render_commits <= profile.max_render_commits);
    assert(run.telemetry.high_water_concurrency <= CONTRACT.scheduler.max_concurrency_default);
    assert(run.telemetry.high_water_concurrency > 0);
    assert.strictEqual(run.states.filter((state) => state.status === 'DEFERRED').length, profile.deferred_widgets);
    assert(run.states.filter((state) => state.status === 'DEFERRED').every((state) => state.query_requested === false));
    assert.strictEqual(run.financial_write, false);
    assert.strictEqual(run.query_semantics_changed, false);
    assert.strictEqual(run.canonical_result_mutated, false);
    assert.strictEqual(financialWrites, CONTRACT.budgets.financial_writes);
    assert.strictEqual(after.canonical_evaluations - before.canonical_evaluations, 0,
      'PERF-090 supported Studio workload must reuse PERF-070 aggregate/cache path');
    assert(after.coalesced_requests - before.coalesced_requests > 0,
      'PERF-090 duplicate visible queries must exercise PERF-070 in-flight coalescing');
    assert(elapsed <= profile.max_elapsed_ms,
      `PERF-090 ${profile.operations} exceeded generous CI ceiling: ${elapsed}ms > ${profile.max_elapsed_ms}ms`);
    assertPublicTelemetrySafe(run.telemetry);

    const beforeWarmStudio = planner.getTelemetry();
    const warmStudio = await coordinator.run(workload, { profile: `${profile.operations}-WARM` });
    const afterWarmStudio = planner.getTelemetry();
    assert.strictEqual(warmStudio.telemetry.query_requests, profile.visible_widgets);
    assert.strictEqual(warmStudio.telemetry.deferred_widgets, profile.deferred_widgets);
    assert.strictEqual(afterWarmStudio.canonical_evaluations - beforeWarmStudio.canonical_evaluations, 0);
    assert.strictEqual(afterWarmStudio.aggregate_reuses - beforeWarmStudio.aggregate_reuses, 0,
      'warm Studio view must not rebuild/reuse aggregate after PERF-070 cache is warm');
    assert.strictEqual(afterWarmStudio.cache_hits - beforeWarmStudio.cache_hits, profile.visible_widgets,
      'warm same-revision Studio view must resolve all visible widgets through PERF-070 cache');
    assertPublicTelemetrySafe(warmStudio.telemetry);

    benchmarkEvidence.push({
      operations: profile.operations,
      widget_count: workload.length,
      visible_widgets: run.telemetry.visible_widgets,
      deferred_widgets: run.telemetry.deferred_widgets,
      query_requests: run.telemetry.query_requests,
      render_commits: run.telemetry.render_commits,
      coalesced_requests: after.coalesced_requests - before.coalesced_requests,
      warm_cache_hits: afterWarmStudio.cache_hits - beforeWarmStudio.cache_hits,
      high_water_concurrency: run.telemetry.high_water_concurrency,
      elapsed_ms: elapsed,
      financial_writes: financialWrites,
      status: 'PASS'
    });
  }

  const deferredResolvers = [];
  let generation = 1;
  const revision = 'b'.repeat(64);
  let staleCommits = 0;
  const staleCoordinator = createStudioScaleCoordinator({
    max_concurrency: 2,
    execute_query: (_query, request) => new Promise((resolve) => {
      deferredResolvers.push(() => resolve({
        status: request.generation === generation ? 'READY' : 'DISCARDED_STALE',
        reason: request.generation === generation ? 'CANONICAL_EVALUATOR' : 'REQUEST_GENERATION_STALE',
        query_hash: 'c'.repeat(64),
        result: request.generation === generation ? {
          schema: 'PRH_ANALYTICS_RESULT_V1',
          query_hash: 'c'.repeat(64),
          total_rows: 2,
          truncated: false
        } : null
      }));
    }),
    get_query_generation: () => generation,
    advance_query_generation: () => { generation += 1; return generation; },
    get_revision: () => revision,
    commit_render: async () => { staleCommits += 1; return { status: 'COMMITTED' }; }
  });
  const staleRunPromise = staleCoordinator.run([
    { widget_id: 'SYN-STALE-1', visibility: 'VISIBLE', query: query('CATEGORY'), presentation: { accessible_table: true } },
    { widget_id: 'SYN-STALE-2', visibility: 'VISIBLE', query: query('ACCOUNT'), presentation: { accessible_table: true } }
  ], { profile: 'STALE' });
  await Promise.resolve();
  staleCoordinator.advanceGeneration();
  while (deferredResolvers.length) deferredResolvers.shift()();
  const staleRun = await staleRunPromise;
  assert.strictEqual(staleRun.telemetry.stale_discards, 2);
  assert.strictEqual(staleRun.telemetry.render_commits, 0);
  assert.strictEqual(staleCommits, 0, 'stale execution must never commit render state');
  assert(staleRun.states.every((state) => state.status === 'DISCARDED_STALE'));
  assertPublicTelemetrySafe(staleRun.telemetry);

  console.log('studio_scale_performance_contract_test: OK', {
    contract: `${CONTRACT.schema}@${CONTRACT.version}`,
    perf070Delegation: true,
    hiddenOffscreenZeroQueryLoad: true,
    boundedConcurrency: CONTRACT.scheduler.max_concurrency_default,
    staleRenderCommit: false,
    presentationOnlyDownsampling: true,
    accessibleVirtualization: true,
    profiles: benchmarkEvidence,
    publicTelemetryFinancialPayload: false,
    financialWrite: false,
    freeOnly: true
  });
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
