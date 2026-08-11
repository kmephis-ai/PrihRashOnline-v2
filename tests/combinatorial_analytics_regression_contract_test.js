'use strict';

const assert = require('assert');
const CONTRACT = require('../lib/testing/combinatorial_analytics_regression.v1.json');
const ANALYTICS = require('../lib/analytics/analytics_engine');
const PERIOD = require('../lib/analytics/period_engine');
const CALC = require('../lib/analytics/calculated_metrics');
const SCOPE = require('../lib/analytics/analytics_scope');
const BENCH = require('../lib/analytics/personal_benchmark');
const PIVOT = require('../lib/analytics/pivot_olap');
const EXPLORATION = require('../lib/analytics/exploration_state');
const VIZ = require('../lib/visualization/visualization_foundation');
const { buildIncrementalAggregates } = require('../lib/analytics/incremental_aggregates');
const { createAnalyticsQueryPlanner } = require('../lib/performance/analytics_query_planner_cache');
const {
  generateSyntheticScaleTransactions,
  mutateSyntheticScaleTransactions
} = require('../lib/testing/synthetic_scale_fixture');

const SCHEMA = 'PRH_COMBINATORIAL_ANALYTICS_REGRESSION_V1';
const VERSION = '1.0.0';
const SEED = CONTRACT.generator.default_seed;
const CASE_COUNT = CONTRACT.generator.representative_case_count;

function lcg(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick(list, random) {
  return list[Math.floor(random() * list.length) % list.length];
}

function reverseObject(value) {
  return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, item]));
}

function equivalentQuery(query) {
  const copy = JSON.parse(JSON.stringify(query));
  copy.filters = copy.filters.slice().reverse().map((filter) => ({
    values: filter.values.slice().reverse(),
    operator: filter.operator,
    field: filter.field
  }));
  copy.comparison = reverseObject(copy.comparison);
  copy.parameters = reverseObject(copy.parameters);
  return reverseObject(copy);
}

function filterSpec(kind) {
  if (kind === 'POSTED') return [{ field: 'status', operator: 'EQ', values: ['posted'] }];
  if (kind === 'EXPENSE') return [{ field: 'type', operator: 'EQ', values: ['expense'] }];
  if (kind === 'EXPENSE_OR_REFUND') return [{ field: 'type', operator: 'IN', values: ['expense', 'refund'] }];
  if (kind === 'ACCOUNT') return [{ field: 'account_id', operator: 'EQ', values: ['ACC-SYN-1'] }];
  if (kind === 'CATEGORY') return [{ field: 'category_id', operator: 'EQ', values: ['CAT-EXPENSE-1'] }];
  if (kind === 'TAG') return [{ field: 'tag', operator: 'EQ', values: ['tag-1'] }];
  return [];
}

function dimensionSpec(kind) {
  if (kind === 'CATEGORY_ID') return ['category_id'];
  if (kind === 'ACCOUNT_ID') return ['account_id'];
  if (kind === 'MEMBER_ID') return ['member_id'];
  if (kind === 'PROJECT_ID') return ['project_id'];
  if (kind === 'CATEGORY_ACCOUNT') return ['category_id', 'account_id'];
  return [];
}

function timeSpec(kind, random) {
  if (kind === 'FULL') return { time_range: null, grain: 'NONE' };
  const year = kind === 'YEAR_2024' ? 2024 : kind === 'YEAR_2025' ? 2025 : 2026;
  const grain = pick(['NONE', 'MONTH', 'YEAR'], random);
  return {
    time_range: { start: `${year}-01-01`, end: `${year + 1}-01-01` },
    grain
  };
}

function analyticsQuery({ measure, dimensionKind, filterKind, timeKind, random }) {
  const temporal = timeSpec(timeKind, random);
  return {
    schema: ANALYTICS.QUERY_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    currency: 'RUB',
    measures: [measure],
    dimensions: dimensionSpec(dimensionKind),
    filters: filterSpec(filterKind),
    time_range: temporal.time_range,
    grain: temporal.grain,
    comparison: { mode: 'NONE' },
    sort: [],
    parameters: {},
    limit: 5000
  };
}

function scalarCompanion(query) {
  return {
    ...query,
    dimensions: [],
    grain: 'NONE',
    sort: []
  };
}

function sumMeasure(result, measure) {
  return result.rows.reduce((sum, row) => sum + row.measures[measure], 0);
}

function assertAnalyticsResult(result, query, measure) {
  assert.strictEqual(result.schema, ANALYTICS.RESULT_SCHEMA);
  assert.strictEqual(result.contract_version, ANALYTICS.CONTRACT_VERSION);
  assert.strictEqual(result.query_hash, ANALYTICS.analyticsQueryHash(query));
  assert.strictEqual(result.provenance.financial_truth_policy, 'FIN-TRUTH-v1');
  assert.strictEqual(result.provenance.legacy_total_cells_used, false);
  assert.strictEqual(result.provenance.ui_logic_used, false);
  assert.strictEqual(result.truncated, false);
  for (const row of result.rows) assert.strictEqual(Number.isSafeInteger(row.measures[measure]), true);
}

function axis(dimensionId, level = null) {
  return dimensionId === 'time_bucket'
    ? { dimension_id: 'time_bucket', hierarchy_id: 'TIME', level }
    : { dimension_id: dimensionId, hierarchy_id: null, level: null };
}

function pivotSpec(measure) {
  return {
    schema: PIVOT.SPEC_SCHEMA,
    contract_version: PIVOT.VERSION,
    rows: [axis('category_id')],
    columns: [axis('account_id')],
    measures: [{ id: measure, aggregation: 'SUM' }],
    subtotals: { rows: true, columns: true },
    grand_total: true,
    sort: { axis: 'ROWS', by: 'MEASURE', key: measure, direction: 'DESC' },
    top_n: { axis: 'ROWS', measure, n: 5 }
  };
}

function periodQuery(comparisonMode = 'NONE') {
  return {
    schema: PERIOD.QUERY_SCHEMA,
    contract_version: PERIOD.VERSION,
    currency: 'RUB',
    measures: ['EXPENSE'],
    dimensions: [],
    filters: [{ field: 'status', operator: 'EQ', values: ['posted'] }],
    sort: [],
    parameters: {},
    limit: 5000,
    period: {
      selector: { kind: 'EXPLICIT_RANGE', start: '2026-01-01', end: '2026-05-01' },
      grain: 'MONTH',
      comparison_mode: comparisonMode
    }
  };
}

function benchmarkSource(periodResult) {
  return {
    schema: BENCH.SOURCE_SCHEMA,
    contract_version: BENCH.VERSION,
    scope: SCOPE.builtInScope('DEFAULT_ANALYSIS'),
    period_result: periodResult
  };
}

function benchmarkSpec(type, options = {}) {
  return {
    schema: BENCH.SPEC_SCHEMA,
    contract_version: BENCH.VERSION,
    comparison_type: type,
    measure: 'EXPENSE',
    options
  };
}

function filterContext(filters) {
  return {
    schema: VIZ.FILTER_CONTEXT_SCHEMA,
    contract_version: VIZ.VERSION,
    filters
  };
}

function explorationItem(field, operator, values) {
  return { kind: 'DIMENSION', field, operator, values };
}

function assertContract() {
  assert.strictEqual(CONTRACT.schema, SCHEMA);
  assert.strictEqual(CONTRACT.version, VERSION);
  assert.strictEqual(CONTRACT.roadmap_id, 'TEST-070');
  assert.strictEqual(CONTRACT.generator.full_cartesian_product, false);
  assert.strictEqual(CONTRACT.generator.representative_case_count, 48);
  assert(CONTRACT.generator.representative_case_count <= CONTRACT.generator.max_case_count);
  assert.strictEqual(CONTRACT.privacy.real_or_real_derived_data, false);
  assert.strictEqual(CONTRACT.privacy.financial_values_in_evidence, false);
  assert.strictEqual(CONTRACT.free_only, true);
  assert.ok(Object.values(CONTRACT.authorities).every((value) => value === false));
}

function buildCases() {
  const random = lcg(SEED);
  const measures = CONTRACT.matrix.measures;
  const dimensions = CONTRACT.matrix.dimensions;
  const filters = CONTRACT.matrix.filters;
  const times = CONTRACT.matrix.time;
  const cases = [];
  for (let index = 0; index < CASE_COUNT; index += 1) {
    cases.push({
      id: `C${String(index + 1).padStart(3, '0')}`,
      query: analyticsQuery({
        measure: measures[index % measures.length],
        dimensionKind: dimensions[(index + Math.floor(random() * dimensions.length)) % dimensions.length],
        filterKind: filters[(index * 3 + Math.floor(random() * filters.length)) % filters.length],
        timeKind: times[(index * 5 + Math.floor(random() * times.length)) % times.length],
        random
      })
    });
  }
  return cases;
}

async function main() {
  const started = Date.now();
  assertContract();
  ANALYTICS.assertContract();
  PERIOD.assertContract();
  CALC.assertContract();
  SCOPE.assertScopeContract();
  BENCH.assertContract();
  PIVOT.assertContract();
  EXPLORATION.assertContract();

  const dataset = generateSyntheticScaleTransactions(CONTRACT.generator.dataset_rows, SEED);
  const datasetBefore = JSON.stringify(dataset);
  const aggregate = buildIncrementalAggregates(dataset, { currency: 'RUB' });
  const planner = createAnalyticsQueryPlanner(dataset, {
    aggregate_state: aggregate.state,
    max_entries: CONTRACT.generator.max_case_count,
    ttl_ms: 60000
  });
  const cases = buildCases();
  assert.strictEqual(cases.length, CASE_COUNT);
  const hashes = new Set();

  for (const testCase of cases) {
    try {
      const normalized = ANALYTICS.normalizeAnalyticsQuery(testCase.query);
      const hash = ANALYTICS.analyticsQueryHash(testCase.query);
      const equivalentHash = ANALYTICS.analyticsQueryHash(equivalentQuery(testCase.query));
      assert.strictEqual(equivalentHash, hash, 'query/filter object ordering must not affect semantic hash');
      hashes.add(hash.slice(0, 12));

      const canonical = ANALYTICS.evaluateAnalytics(dataset, normalized);
      const measure = normalized.measures[0];
      assertAnalyticsResult(canonical, normalized, measure);
      const scalar = ANALYTICS.evaluateAnalytics(dataset, scalarCompanion(normalized));
      assert.strictEqual(sumMeasure(canonical, measure), scalar.rows[0].measures[measure], 'additive grouped result must reconcile to scalar result');

      const cold = planner.execute(normalized);
      assert.deepStrictEqual(cold.result, canonical, 'planner cold path must preserve canonical result exactly');
      const warm = planner.execute(equivalentQuery(normalized));
      assert.strictEqual(warm.source, 'MEMORY_CACHE');
      assert.strictEqual(warm.reason, 'CACHE_HIT');
      assert.deepStrictEqual(warm.result, canonical, 'planner warm path must preserve canonical result exactly');
    } catch (error) {
      error.message = `TEST070 ${testCase.id} seed=${SEED}: ${error.message}`;
      throw error;
    }
  }

  // Explicit aggregate-reuse paths remain byte/deep-equivalent to canonical evaluation.
  const aggregatePlanner = createAnalyticsQueryPlanner(dataset, {
    aggregate_state: aggregate.state,
    max_entries: 16,
    ttl_ms: 60000
  });
  const aggregateQueries = [
    analyticsQuery({ measure: 'EXPENSE', dimensionKind: 'CATEGORY_ID', filterKind: 'NONE', timeKind: 'FULL', random: lcg(1) }),
    analyticsQuery({ measure: 'CASH_FLOW', dimensionKind: 'ACCOUNT_ID', filterKind: 'NONE', timeKind: 'FULL', random: lcg(2) }),
    {
      ...analyticsQuery({ measure: 'INCOME', dimensionKind: 'SCALAR', filterKind: 'NONE', timeKind: 'YEAR_2025', random: () => 0.45 }),
      dimensions: [],
      grain: 'MONTH'
    }
  ];
  for (const query of aggregateQueries) {
    const canonical = ANALYTICS.evaluateAnalytics(dataset, query);
    const cold = aggregatePlanner.execute(query);
    assert.strictEqual(cold.source, 'AGGREGATE_REUSE');
    assert.deepStrictEqual(cold.result, canonical);
    const warm = aggregatePlanner.execute(query);
    assert.strictEqual(warm.source, 'MEMORY_CACHE');
    assert.deepStrictEqual(warm.result, canonical);
  }

  // Revision change must invalidate old cache identity; stale values can never become current truth.
  const nextDataset = mutateSyntheticScaleTransactions(dataset, 9, SEED + 1);
  const nextAggregate = buildIncrementalAggregates(nextDataset, { currency: 'RUB' });
  const revisionQuery = aggregateQueries[0];
  const replaced = aggregatePlanner.replaceSnapshot(nextDataset, { aggregate_state: nextAggregate.state });
  assert.strictEqual(replaced.changed, true);
  const afterRevision = aggregatePlanner.execute(revisionQuery);
  assert.notStrictEqual(afterRevision.source, 'MEMORY_CACHE');
  assert.deepStrictEqual(afterRevision.result, ANALYTICS.evaluateAnalytics(nextDataset, revisionQuery));

  // Scope layer must preserve canonical evaluator semantics and never mutate canonical transactions.
  const assignments = {
    schema: SCOPE.ASSIGNMENTS_SCHEMA,
    contract_version: SCOPE.VERSION,
    account: [
      { account_id: 'ACC-SYN-8', system_tags: ['EMERGENCY_FUND'] },
      { account_id: 'ACC-SYN-7', system_tags: ['EXCLUDE_FROM_ANALYSIS'] }
    ],
    transaction: []
  };
  const scopeQuery = analyticsQuery({ measure: 'EXPENSE', dimensionKind: 'CATEGORY_ID', filterKind: 'POSTED', timeKind: 'YEAR_2025', random: () => 0 });
  const allScoped = SCOPE.evaluateScopedAnalytics(dataset, assignments, SCOPE.builtInScope('ALL_CANONICAL'), scopeQuery);
  assert.deepStrictEqual(allScoped.analytics_result, ANALYTICS.evaluateAnalytics(dataset, scopeQuery));
  for (const scopeId of ['DEFAULT_ANALYSIS', 'EMERGENCY_FUND_ONLY']) {
    const scopeSpec = SCOPE.builtInScope(scopeId);
    const view = SCOPE.applyAnalyticsScope(dataset, assignments, scopeSpec);
    const evaluated = SCOPE.evaluateScopedAnalytics(dataset, assignments, scopeSpec, scopeQuery);
    assert.deepStrictEqual(evaluated.analytics_result, ANALYTICS.evaluateAnalytics(view.transactions, scopeQuery));
  }
  assert.strictEqual(JSON.stringify(dataset), datasetBefore, 'scope/evaluation must not mutate canonical source');

  // Exploration composition is deterministic and cannot broaden two INCLUDE sets.
  const globalContext = filterContext([
    explorationItem('account_id', 'EXCLUDE', ['ACC-SYN-1']),
    explorationItem('category_id', 'INCLUDE', ['CAT-EXPENSE-1', 'CAT-EXPENSE-2'])
  ]);
  const widgetContext = filterContext([
    explorationItem('account_id', 'EXCLUDE', ['ACC-SYN-2']),
    explorationItem('category_id', 'INCLUDE', ['CAT-EXPENSE-2', 'CAT-EXPENSE-3'])
  ]);
  const merged = EXPLORATION.mergeFilterContexts(globalContext, widgetContext);
  const mergedReordered = EXPLORATION.mergeFilterContexts(
    filterContext(globalContext.filters.slice().reverse()),
    filterContext(widgetContext.filters.slice().reverse())
  );
  assert.deepStrictEqual(mergedReordered, merged);
  const categoryInclude = merged.filters.find((item) => item.field === 'category_id' && item.operator === 'INCLUDE');
  const accountExclude = merged.filters.find((item) => item.field === 'account_id' && item.operator === 'EXCLUDE');
  assert.deepStrictEqual(categoryInclude.values, ['CAT-EXPENSE-2']);
  assert.deepStrictEqual(accountExclude.values, ['ACC-SYN-1', 'ACC-SYN-2']);

  // Period + calculated metrics + personal benchmarks share the same canonical period engine.
  const series = PERIOD.evaluatePeriodSeries(dataset, periodQuery('NONE'));
  assert.strictEqual(series.primary_buckets.length, 4);
  assert.strictEqual(series.provenance.financial_truth_policy, 'FIN-TRUTH-v1');
  const moving = CALC.evaluateCalculatedMetric(series, {
    schema: CALC.SPEC_SCHEMA,
    contract_version: CALC.VERSION,
    operator: 'MOVING_AVERAGE',
    measure: 'EXPENSE',
    options: { window: 2, partial_window: 'REQUIRE_FULL' }
  });
  assert.strictEqual(moving.rows.length, 4);
  assert(moving.rows.every((row) => row.value_minor == null || Number.isSafeInteger(row.value_minor)));
  assert.strictEqual(moving.provenance.financial_truth_policy, 'FIN-TRUTH-v1');

  const rolling = BENCH.evaluatePersonalBenchmark(
    benchmarkSource(series),
    benchmarkSpec('PERSONAL_ROLLING_BASELINE', { window: 3, partial_window: 'REQUIRE_FULL' }),
    null
  );
  assert.strictEqual(rolling.provenance.result_financial_truth, false);
  assert.strictEqual(rolling.reference_provenance, 'ANL_072_MOVING_AVERAGE');

  const comparedSeries = PERIOD.evaluatePeriodSeries(dataset, periodQuery('PREVIOUS_COMPARABLE_PERIOD'));
  const previous = BENCH.evaluatePersonalBenchmark(
    benchmarkSource(comparedSeries),
    benchmarkSpec('PREVIOUS_COMPARABLE_PERIOD'),
    null
  );
  assert.strictEqual(previous.provenance.result_financial_truth, false);
  assert.strictEqual(previous.reference_provenance, 'ANL_071_PREVIOUS_COMPARABLE_PERIOD');

  // Pivot totals must reconcile to the same canonical grouped source; source row ordering cannot alter identity.
  const pivotQuery = analyticsQuery({ measure: 'EXPENSE', dimensionKind: 'CATEGORY_ACCOUNT', filterKind: 'POSTED', timeKind: 'YEAR_2025', random: () => 0 });
  const pivotSource = ANALYTICS.evaluateAnalytics(dataset, pivotQuery);
  const pivot = PIVOT.evaluatePivot(pivotSource, pivotSpec('EXPENSE'));
  const pivotScalar = ANALYTICS.evaluateAnalytics(dataset, scalarCompanion(pivotQuery));
  assert.strictEqual(pivot.grand_total.measures.EXPENSE, pivotScalar.rows[0].measures.EXPENSE);
  assert.strictEqual(pivot.top_n_evidence.source_total_minor, pivot.top_n_evidence.output_total_minor);
  const reversedPivotSource = Object.freeze({ ...pivotSource, rows: Object.freeze(pivotSource.rows.slice().reverse()) });
  assert.strictEqual(PIVOT.evaluatePivot(reversedPivotSource, pivotSpec('EXPENSE')).result_hash, pivot.result_hash);

  // Transfers do not create household cash-flow, and unsupported/currency-adjacent states never trigger implicit conversion.
  const transferQuery = analyticsQuery({ measure: 'CASH_FLOW', dimensionKind: 'SCALAR', filterKind: 'NONE', timeKind: 'FULL', random: () => 0 });
  transferQuery.filters = [{ field: 'type', operator: 'EQ', values: ['transfer'] }];
  const transferOnly = ANALYTICS.evaluateAnalytics(dataset, transferQuery);
  assert.strictEqual(transferOnly.rows[0].measures.CASH_FLOW, 0);
  const eurQuery = { ...transferQuery, currency: 'EUR', filters: [] };
  const eurResult = ANALYTICS.evaluateAnalytics(dataset, eurQuery);
  assert.strictEqual(eurResult.rows[0].measures.CASH_FLOW, 0, 'RUB values must never be silently converted into EUR');
  assert.throws(() => ANALYTICS.normalizeAnalyticsQuery({ ...pivotQuery, measures: ['BUDGET_VARIANCE'], parameters: { budget_minor: 1 } }), /ANALYTICS_BUDGET_GROUPING_UNSUPPORTED/);
  assert.throws(() => PIVOT.evaluatePivot({ ...pivotSource, truncated: true, total_rows: pivotSource.total_rows + 1 }, pivotSpec('EXPENSE')), /PIVOT_ANALYTICS_RESULT_INCOMPLETE/);

  const report = {
    schema: SCHEMA,
    version: VERSION,
    seed: SEED,
    case_count: cases.length,
    query_hash_prefix_count: hashes.size,
    status: 'PASS',
    reason: 'OK'
  };
  assert.deepStrictEqual(Object.keys(report).sort(), CONTRACT.telemetry_allowlist.slice().sort());
  const publicText = JSON.stringify(report).toLowerCase();
  for (const forbidden of ['amount_minor', 'value_minor', 'acc-syn-', 'cat-expense-', 'scale-', 'transaction_id', 'rows', 'filters']) {
    assert.strictEqual(publicText.includes(forbidden), false, forbidden);
  }
  assert.strictEqual(JSON.stringify(dataset), datasetBefore, 'TEST-070 must remain read-only over the source dataset');
  const elapsed = Date.now() - started;
  assert(elapsed <= CONTRACT.runtime_budget.max_ms, `TEST070_RUNTIME_BUDGET_EXCEEDED:${elapsed}`);

  console.log('combinatorial-analytics-regression: PASS', report);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
