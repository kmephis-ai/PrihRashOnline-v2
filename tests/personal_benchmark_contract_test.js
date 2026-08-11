'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const BENCH = require('../lib/analytics/personal_benchmark');
const PERIOD = require('../lib/analytics/period_engine');
const ANALYTICS = require('../lib/analytics/analytics_engine');
const SCOPE = require('../lib/analytics/analytics_scope');

function analyticsResult(value, measure = 'EXPENSE', currency = 'USD', dimensions = {}) {
  return Object.freeze({
    schema: ANALYTICS.RESULT_SCHEMA,
    contract_version: ANALYTICS.CONTRACT_VERSION,
    query_id: 'BENCH-SYNTHETIC',
    currency,
    grain: 'NONE',
    dimensions: Object.freeze([]),
    rows: Object.freeze([Object.freeze({ dimensions: Object.freeze({ ...dimensions }), measures: Object.freeze({ [measure]: value }) })]),
    total_rows: 1,
    truncated: false,
    provenance: Object.freeze({
      financial_truth_policy: 'FIN-TRUTH-v1',
      legacy_total_cells_used: false,
      ui_logic_used: false
    })
  });
}

function bucket(key, start, end, value, measure = 'EXPENSE', currency = 'USD') {
  return Object.freeze({
    key,
    start,
    end,
    day_count: PERIOD.daysBetween(start, end),
    partial: false,
    natural_start: start,
    natural_end: end,
    analytics_result: analyticsResult(value, measure, currency)
  });
}

function periodResult(values, options = {}) {
  const measure = options.measure || 'EXPENSE';
  const currency = options.currency || 'USD';
  const starts = options.starts || ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'];
  const ends = options.ends || ['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'];
  const primary = values.map((value, index) => bucket(`P${index}`, starts[index], ends[index], value, measure, currency));
  const comparisonValues = options.comparison_values || [];
  const comparisonStarts = options.comparison_starts || ['2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01'];
  const comparisonEnds = options.comparison_ends || ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'];
  const comparison = comparisonValues.map((value, index) => bucket(`R${index}`, comparisonStarts[index], comparisonEnds[index], value, measure, currency));
  const primaryStart = primary[0].start;
  const primaryEnd = primary[primary.length - 1].end;
  const hasComparison = comparison.length > 0;
  return Object.freeze({
    schema: PERIOD.RESULT_SCHEMA,
    contract_version: PERIOD.VERSION,
    selector_kind: 'EXPLICIT_RANGE',
    grain: options.grain || 'MONTH',
    comparison_mode: hasComparison ? 'PREVIOUS_COMPARABLE_PERIOD' : 'NONE',
    primary_range: Object.freeze({
      selector_kind: 'EXPLICIT_RANGE',
      start: primaryStart,
      end: primaryEnd,
      day_count: PERIOD.daysBetween(primaryStart, primaryEnd),
      partial: false
    }),
    comparison: hasComparison ? Object.freeze({
      start: comparison[0].start,
      end: comparison[comparison.length - 1].end,
      day_count: PERIOD.daysBetween(comparison[0].start, comparison[comparison.length - 1].end),
      quality: options.comparison_quality || 'EXACT_DAY_COUNT',
      clipped: options.comparison_clipped === true,
      leap_adjusted: false
    }) : null,
    primary_buckets: Object.freeze(primary),
    comparison_buckets: Object.freeze(comparison),
    provenance: Object.freeze({
      period_engine: `${PERIOD.SCHEMA}@${PERIOD.VERSION}`,
      analytics_contract: 'PRH_ANALYTICS_CONTRACT_V1@1.0.0',
      semantic_registry: 'PRH_ANALYTICS_SEMANTIC_REGISTRY_V1@1.0.0',
      financial_truth_policy: 'FIN-TRUTH-v1',
      calendar: 'GREGORIAN_UTC_DATE_ONLY',
      range_semantics: 'HALF_OPEN_START_INCLUSIVE_END_EXCLUSIVE',
      orchestration_only: true,
      analytics_v1_enum_mutated: false
    })
  });
}

function source(result, scope = SCOPE.builtInScope('DEFAULT_ANALYSIS')) {
  return {
    schema: BENCH.SOURCE_SCHEMA,
    contract_version: BENCH.VERSION,
    scope,
    period_result: result
  };
}

function spec(type, measure = 'EXPENSE', options = {}) {
  return {
    schema: BENCH.SPEC_SCHEMA,
    contract_version: BENCH.VERSION,
    comparison_type: type,
    measure,
    options
  };
}

function moneyReference(kind, result, value, scopeSpec = SCOPE.builtInScope('DEFAULT_ANALYSIS'), currency = 'USD') {
  return {
    schema: BENCH.MONEY_REFERENCE_SCHEMA,
    contract_version: BENCH.VERSION,
    kind,
    currency,
    scope: scopeSpec,
    period: { start: result.primary_range.start, end: result.primary_range.end },
    value_minor: value,
    provenance: kind === 'BUDGET' ? 'DECLARED_BUDGET' : 'DECLARED_TARGET'
  };
}

function manualReference(result, base, indexPpm, scopeSpec = SCOPE.builtInScope('DEFAULT_ANALYSIS'), currency = 'USD') {
  return {
    schema: BENCH.MANUAL_INDEX_SCHEMA,
    contract_version: BENCH.VERSION,
    currency,
    scope: scopeSpec,
    period: { start: result.primary_range.start, end: result.primary_range.end },
    base_minor: base,
    index_ppm: indexPpm,
    provenance: 'USER_DEFINED_MANUAL_INDEX'
  };
}

assert.strictEqual(BENCH.assertContract(), true);
assert.strictEqual(BENCH.CONTRACT.schema, 'PRH_PERSONAL_BENCHMARK_V1');
assert.strictEqual(BENCH.CONTRACT.version, '1.0.0');
assert.strictEqual(BENCH.CONTRACT.roadmap_id, 'BENCH-070');
assert.deepStrictEqual(BENCH.COMPARISON_TYPES.slice().sort(), [
  'BUDGET', 'MANUAL_INDEX', 'PERSONAL_ROLLING_BASELINE', 'PREVIOUS_COMPARABLE_PERIOD', 'TARGET'
]);
assert.strictEqual(BENCH.CONTRACT.principles.external_market_provider_required, false);
assert.strictEqual(BENCH.CONTRACT.principles.paid_provider_required, false);
assert.strictEqual(BENCH.CONTRACT.principles.declared_reference_is_financial_truth, false);
assert.ok(Object.values(BENCH.CONTRACT.authorities).every((value) => value === false));

const serializedA = BENCH.serializeBenchmarkSpec(spec('PERSONAL_ROLLING_BASELINE', 'EXPENSE', { window: 3, partial_window: 'REQUIRE_FULL' }));
const serializedB = BENCH.serializeBenchmarkSpec({
  options: { partial_window: 'REQUIRE_FULL', window: 3 },
  measure: 'EXPENSE',
  comparison_type: 'PERSONAL_ROLLING_BASELINE',
  contract_version: BENCH.VERSION,
  schema: BENCH.SPEC_SCHEMA
});
assert.strictEqual(serializedA, serializedB);
for (const forbidden of ['amount_minor', 'value_minor', 'transaction_id', 'account_id', 'category_id', 'description', 'counterparty']) {
  assert.strictEqual(serializedA.includes(forbidden), false, forbidden);
}
assert.throws(() => BENCH.serializeBenchmarkSpec(spec('EXECUTE_JS')), /BENCH_COMPARISON_TYPE_UNKNOWN/);
assert.throws(() => BENCH.serializeBenchmarkSpec(spec('PERSONAL_ROLLING_BASELINE', 'EXPENSE', { window: 1, partial_window: 'ALLOW_PARTIAL' })), /BENCH_ROLLING_WINDOW_INVALID/);
assert.throws(() => BENCH.serializeBenchmarkSpec(spec('PERSONAL_ROLLING_BASELINE', 'EXPENSE', { window: 3, partial_window: 'GUESS' })), /BENCH_ROLLING_PARTIAL_POLICY_INVALID/);
assert.throws(() => BENCH.serializeBenchmarkSpec(spec('BUDGET', 'BUDGET_VARIANCE')), /BENCH_MEASURE_NON_ADDITIVE_UNSUPPORTED/);

const previousSource = periodResult([12000], {
  starts: ['2026-03-01'], ends: ['2026-04-01'],
  comparison_values: [10000], comparison_starts: ['2026-02-01'], comparison_ends: ['2026-03-01'],
  comparison_quality: 'CLIPPED_SHORTER_CALENDAR_PERIOD', comparison_clipped: true
});
const previous = BENCH.evaluatePersonalBenchmark(source(previousSource), spec('PREVIOUS_COMPARABLE_PERIOD'), null);
assert.deepStrictEqual([previous.current_minor, previous.reference_minor, previous.delta_minor, previous.delta_ppm, previous.status], [12000, 10000, 2000, 200000, 'OK']);
assert.strictEqual(previous.quality, 'CLIPPED_SHORTER_CALENDAR_PERIOD');
assert.strictEqual(previous.reference_provenance, 'ANL_071_PREVIOUS_COMPARABLE_PERIOD');
assert.strictEqual(previous.provenance.calculated_metrics, 'PRH_ANALYTICS_CALCULATED_METRICS_V1@1.0.0');
assert.strictEqual(previous.provenance.reference_financial_truth, false);
assert.strictEqual(previous.provenance.result_financial_truth, false);

const previousTotals = periodResult([1000, 2000], {
  starts: ['2026-03-01', '2026-04-01'], ends: ['2026-04-01', '2026-05-01'],
  comparison_values: [500, 1000], comparison_starts: ['2026-01-01', '2026-02-01'], comparison_ends: ['2026-02-01', '2026-03-01']
});
const previousTotalsResult = BENCH.evaluatePersonalBenchmark(source(previousTotals), spec('PREVIOUS_COMPARABLE_PERIOD'), null);
assert.deepStrictEqual([previousTotalsResult.current_minor, previousTotalsResult.reference_minor, previousTotalsResult.delta_minor, previousTotalsResult.delta_ppm], [3000, 1500, 1500, 1000000]);

const zeroBothSource = periodResult([0], {
  starts: ['2026-03-01'], ends: ['2026-04-01'],
  comparison_values: [0], comparison_starts: ['2026-02-01'], comparison_ends: ['2026-03-01']
});
const zeroBoth = BENCH.evaluatePersonalBenchmark(source(zeroBothSource), spec('PREVIOUS_COMPARABLE_PERIOD'), null);
assert.deepStrictEqual([zeroBoth.delta_ppm, zeroBoth.status], [0, 'ZERO_REFERENCE_NO_CHANGE']);
const zeroUndefinedSource = periodResult([100], {
  starts: ['2026-03-01'], ends: ['2026-04-01'],
  comparison_values: [0], comparison_starts: ['2026-02-01'], comparison_ends: ['2026-03-01']
});
const zeroUndefined = BENCH.evaluatePersonalBenchmark(source(zeroUndefinedSource), spec('PREVIOUS_COMPARABLE_PERIOD'), null);
assert.deepStrictEqual([zeroUndefined.delta_ppm, zeroUndefined.status], [null, 'ZERO_REFERENCE_UNDEFINED']);

const rollingSource = periodResult([100, 200, 300, 400]);
const rolling = BENCH.evaluatePersonalBenchmark(source(rollingSource), spec('PERSONAL_ROLLING_BASELINE', 'EXPENSE', { window: 3, partial_window: 'REQUIRE_FULL' }), null);
assert.deepStrictEqual([rolling.current_minor, rolling.reference_minor, rolling.delta_minor, rolling.delta_ppm], [400, 200, 200, 1000000]);
assert.deepStrictEqual([rolling.sample_count, rolling.sample_complete, rolling.quality], [3, true, 'COMPLETE_BASELINE']);
assert.strictEqual(rolling.reference_provenance, 'ANL_072_MOVING_AVERAGE');
assert.throws(() => BENCH.evaluatePersonalBenchmark(source(rollingSource), spec('PERSONAL_ROLLING_BASELINE', 'EXPENSE', { window: 4, partial_window: 'REQUIRE_FULL' }), null), /BENCH_ROLLING_BASELINE_INCOMPLETE/);
const rollingPartial = BENCH.evaluatePersonalBenchmark(source(rollingSource), spec('PERSONAL_ROLLING_BASELINE', 'EXPENSE', { window: 4, partial_window: 'ALLOW_PARTIAL' }), null);
assert.deepStrictEqual([rollingPartial.reference_minor, rollingPartial.sample_count, rollingPartial.sample_complete, rollingPartial.quality], [200, 3, false, 'PARTIAL_BASELINE']);

const budgetSource = periodResult([1000, 2000], { starts: ['2026-01-01', '2026-02-01'], ends: ['2026-02-01', '2026-03-01'] });
const budget = BENCH.evaluatePersonalBenchmark(source(budgetSource), spec('BUDGET'), moneyReference('BUDGET', budgetSource, 4000));
assert.deepStrictEqual([budget.current_minor, budget.reference_minor, budget.delta_minor, budget.delta_ppm, budget.status], [3000, 4000, -1000, -250000, 'OK']);
assert.strictEqual(budget.reference_provenance, 'DECLARED_BUDGET');
assert.strictEqual(budget.quality, 'DECLARED_REFERENCE');

const target = BENCH.evaluatePersonalBenchmark(source(budgetSource), spec('TARGET'), moneyReference('TARGET', budgetSource, 0));
assert.deepStrictEqual([target.reference_minor, target.delta_ppm, target.status], [0, null, 'ZERO_REFERENCE_UNDEFINED']);

const manualSource = periodResult([4000], { starts: ['2026-01-01'], ends: ['2026-02-01'] });
const manual = BENCH.evaluatePersonalBenchmark(source(manualSource), spec('MANUAL_INDEX'), manualReference(manualSource, 2000, 1500000));
assert.deepStrictEqual([manual.current_minor, manual.reference_minor, manual.delta_minor, manual.delta_ppm], [4000, 3000, 1000, 333333]);
assert.strictEqual(manual.reference_provenance, 'USER_DEFINED_MANUAL_INDEX');
assert.strictEqual(manual.quality, 'DECLARED_MANUAL_INDEX');

const emergencyScope = SCOPE.builtInScope('EMERGENCY_FUND_ONLY');
assert.throws(() => BENCH.evaluatePersonalBenchmark(source(budgetSource), spec('BUDGET'), moneyReference('BUDGET', budgetSource, 4000, emergencyScope)), /BENCH_REFERENCE_SCOPE_MISMATCH/);
assert.throws(() => BENCH.evaluatePersonalBenchmark(source(budgetSource), spec('BUDGET'), moneyReference('BUDGET', budgetSource, 4000, SCOPE.builtInScope('DEFAULT_ANALYSIS'), 'EUR')), /BENCH_REFERENCE_CURRENCY_MISMATCH/);
const wrongPeriod = moneyReference('BUDGET', budgetSource, 4000);
wrongPeriod.period = { start: '2026-01-01', end: '2026-02-01' };
assert.throws(() => BENCH.evaluatePersonalBenchmark(source(budgetSource), spec('BUDGET'), wrongPeriod), /BENCH_REFERENCE_PERIOD_MISMATCH/);
const wrongProvenance = moneyReference('BUDGET', budgetSource, 4000);
wrongProvenance.provenance = 'MARKET_DATA';
assert.throws(() => BENCH.evaluatePersonalBenchmark(source(budgetSource), spec('BUDGET'), wrongProvenance), /BENCH_REFERENCE_PROVENANCE_INVALID/);
assert.throws(() => BENCH.evaluatePersonalBenchmark(source(previousSource), spec('PREVIOUS_COMPARABLE_PERIOD'), moneyReference('BUDGET', previousSource, 1)), /BENCH_REFERENCE_NOT_ALLOWED/);

const nonScalar = periodResult([100]);
nonScalar.primary_buckets[0].analytics_result.rows[0].dimensions.category_id = 'synthetic-category';
assert.throws(() => BENCH.evaluatePersonalBenchmark(source(nonScalar), spec('BUDGET'), moneyReference('BUDGET', nonScalar, 100)), /BENCH_ANALYTICS_RESULT_NOT_SCALAR/);

const telemetry = BENCH.benchmarkTelemetry(previous);
assert.deepStrictEqual(Object.keys(telemetry).sort(), BENCH.CONTRACT.telemetry_allowlist.slice().sort());
for (const forbidden of ['current_minor', 'reference_minor', 'delta_minor', 'delta_ppm', 'transaction_id', 'account_id', 'category_id']) {
  assert.strictEqual(Object.prototype.hasOwnProperty.call(telemetry, forbidden), false, forbidden);
}
assert.strictEqual(telemetry.decision, 'ALLOW');
assert.strictEqual(telemetry.reason, 'OK');

const implementation = fs.readFileSync(path.join(__dirname, '..', 'lib', 'analytics', 'personal_benchmark.js'), 'utf8');
assert(implementation.includes('CALC.evaluateCalculatedMetric'), 'BENCH-070 must reuse ANL-072 operators');
assert(implementation.includes("operator: 'DELTA_ABS'"), 'previous comparison must reuse ANL-072 absolute delta');
assert(implementation.includes("operator: 'DELTA_PCT'"), 'previous comparison must reuse ANL-072 percent delta');
assert(implementation.includes("operator: 'MOVING_AVERAGE'"), 'rolling baseline must reuse ANL-072 moving average');
assert(!/\beval\s*\(|new\s+Function\s*\(|UrlFetchApp|SpreadsheetApp|fetch\s*\(/.test(implementation), 'comparison core must remain offline and non-executable');

console.log('personal_benchmark_contract_test: OK', {
  contract: `${BENCH.SCHEMA}@${BENCH.VERSION}`,
  comparisons: BENCH.COMPARISON_TYPES,
  previousUsesAnl072Delta: true,
  rollingUsesAnl072MovingAverage: true,
  declaredReferencesFinancialTruth: false,
  scopeCurrencyPeriodFailClosed: true,
  zeroReferenceExplicit: true,
  telemetryFinancialPayload: false,
  externalMarketProviderRequired: false,
  financialWrite: false,
  freeOnly: true
});
