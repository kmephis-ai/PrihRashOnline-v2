'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');
const { evaluateAnalytics } = require('../lib/analytics/analytics_engine');
const period = require('../lib/analytics/period_engine');

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function tx(index, occurredAt, type, amountMinor, overrides = {}) {
  return normalizeCanonicalTransaction({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: `PER-TX-${String(index).padStart(3, '0')}`,
    occurred_at: occurredAt,
    type,
    status: 'posted',
    amount_minor: amountMinor,
    currency: 'USD',
    account_id: overrides.account_id || 'acct-main',
    destination_account_id: type === 'transfer' ? (overrides.destination_account_id || 'acct-second') : null,
    category_id: overrides.category_id || (type === 'income' ? 'income' : type === 'transfer' ? 'transfer' : 'expense'),
    member_id: null,
    project_id: null,
    tags: ['synthetic-period'],
    counterparty: null,
    description: null,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'fixture:period-071',
      source_record_id: `PER-REC-${index}`,
      source_fingerprint: fingerprint(`period:${index}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'ANL-071-SYNTHETIC-v1',
      source_position: null
    }
  });
}

function baseQuery(periodSpec, overrides = {}) {
  return {
    schema: period.QUERY_SCHEMA,
    contract_version: period.VERSION,
    currency: 'USD',
    measures: ['INCOME', 'EXPENSE', 'CASH_FLOW'],
    dimensions: [],
    filters: [],
    sort: [],
    parameters: {},
    limit: 500,
    period: periodSpec,
    ...overrides
  };
}

function spec(selector, grain = 'NONE', comparisonMode = 'NONE') {
  return { selector, grain, comparison_mode: comparisonMode };
}

function assertCoverage(range, buckets) {
  assert(buckets.length > 0);
  assert.strictEqual(buckets[0].start, range.start);
  assert.strictEqual(buckets[buckets.length - 1].end, range.end);
  let total = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    total += buckets[i].day_count;
    assert(period.daysBetween(buckets[i].start, buckets[i].end) > 0);
    if (i > 0) assert.strictEqual(buckets[i - 1].end, buckets[i].start);
  }
  assert.strictEqual(total, range.day_count);
}

assert.strictEqual(period.assertContract(), true);
assert.strictEqual(period.CONTRACT.schema, 'PRH_ANALYTICS_PERIOD_ENGINE_V1');
assert.strictEqual(period.CONTRACT.version, '1.0.0');
assert.strictEqual(period.CONTRACT.orchestration.mutate_analytics_v1_enum, false);
assert.strictEqual(period.CONTRACT.orchestration.week_and_quarter_via_range_orchestration, true);
assert.strictEqual(period.CONTRACT.orchestration.kpi_formula_redefinition, false);
assert.strictEqual(period.CONTRACT.calendar.wall_clock_today_allowed, false);
assert.ok(Object.values(period.CONTRACT.authorities).every((value) => value === false));
assert.strictEqual(period.CONTRACT.free_only, true);

// Strict Gregorian UTC date-only semantics.
assert.deepStrictEqual(period.parseDate('2024-02-29'), { text: '2024-02-29', year: 2024, month: 2, day: 29, time: Date.UTC(2024, 1, 29) });
for (const invalid of ['2023-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '26-01-01', '2026-1-01', '', null]) {
  assert.throws(() => period.parseDate(invalid), /PERIOD_DATE_INVALID/);
}
assert.strictEqual(period.addDays('2024-02-28', 1), '2024-02-29');
assert.strictEqual(period.addDays('2024-02-29', 1), '2024-03-01');
assert.strictEqual(period.daysBetween('2024-02-01', '2024-03-01'), 29);
assert.strictEqual(period.startOfIsoWeek('2026-01-01'), '2025-12-29');
assert.strictEqual(period.startOfQuarter('2026-11-15'), '2026-10-01');

const explicit = period.resolveSelector({ kind: 'EXPLICIT_RANGE', start: '2026-01-10', end: '2026-02-04' });
assert.strictEqual(explicit.day_count, 25);
assert.strictEqual(explicit.partial, false);
assert.throws(() => period.resolveSelector({ kind: 'EXPLICIT_RANGE', start: '2026-02-01', end: '2026-02-01' }), /PERIOD_RANGE_INVALID/);
assert.throws(() => period.resolveSelector({ kind: 'ROLLING_7' }), /PERIOD_SELECTOR_SHAPE_INVALID/);

for (const [kind, days] of [['ROLLING_7', 7], ['ROLLING_30', 30], ['ROLLING_90', 90], ['ROLLING_365', 365]]) {
  const rolling = period.resolveSelector({ kind, as_of: '2024-03-01' });
  assert.strictEqual(rolling.day_count, days, kind);
  assert.strictEqual(rolling.end, '2024-03-02');
  assert.strictEqual(rolling.partial, false);
}

const mtdPartial = period.resolveSelector({ kind: 'MTD', as_of: '2026-02-10' });
assert.deepStrictEqual([mtdPartial.start, mtdPartial.end, mtdPartial.day_count, mtdPartial.partial], ['2026-02-01', '2026-02-11', 10, true]);
const mtdFull = period.resolveSelector({ kind: 'MTD', as_of: '2024-02-29' });
assert.deepStrictEqual([mtdFull.start, mtdFull.end, mtdFull.day_count, mtdFull.partial], ['2024-02-01', '2024-03-01', 29, false]);
const qtd = period.resolveSelector({ kind: 'QTD', as_of: '2026-05-15' });
assert.deepStrictEqual([qtd.start, qtd.end, qtd.natural_period_start, qtd.natural_period_end], ['2026-04-01', '2026-05-16', '2026-04-01', '2026-07-01']);
assert.strictEqual(qtd.partial, true);
const ytd = period.resolveSelector({ kind: 'YTD', as_of: '2024-12-31' });
assert.deepStrictEqual([ytd.start, ytd.end, ytd.day_count, ytd.partial], ['2024-01-01', '2025-01-01', 366, false]);

const weekFullRange = period.resolveSelector({ kind: 'EXPLICIT_RANGE', start: '2025-12-29', end: '2026-01-05' });
const weekFull = period.buildBuckets(weekFullRange, 'WEEK');
assert.strictEqual(weekFull.length, 1);
assert.strictEqual(weekFull[0].partial, false);
assert.strictEqual(weekFull[0].key, 'WEEK:2025-12-29');
const weekPartialRange = period.resolveSelector({ kind: 'EXPLICIT_RANGE', start: '2025-12-31', end: '2026-01-03' });
const weekPartial = period.buildBuckets(weekPartialRange, 'WEEK');
assert.strictEqual(weekPartial.length, 1);
assert.strictEqual(weekPartial[0].partial, true);
assertCoverage(weekPartialRange, weekPartial);

const longRange = period.resolveSelector({ kind: 'EXPLICIT_RANGE', start: '2025-11-17', end: '2027-02-11' });
for (const grain of ['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR']) {
  const buckets = period.buildBuckets(longRange, grain);
  assertCoverage(longRange, buckets);
  assert(buckets.every((bucket) => bucket.day_count > 0));
}
const quarterBuckets = period.buildBuckets(period.resolveSelector({ kind: 'EXPLICIT_RANGE', start: '2026-01-01', end: '2026-10-01' }), 'QUARTER');
assert.deepStrictEqual(quarterBuckets.map((bucket) => bucket.key), ['QUARTER:2026-01-01', 'QUARTER:2026-04-01', 'QUARTER:2026-07-01']);
assert(quarterBuckets.every((bucket) => bucket.partial === false));

const previousExplicit = period.resolveComparison(explicit, 'PREVIOUS_COMPARABLE_PERIOD');
assert.deepStrictEqual([previousExplicit.start, previousExplicit.end, previousExplicit.day_count, previousExplicit.quality, previousExplicit.clipped], ['2025-12-16', '2026-01-10', 25, 'EXACT_DAY_COUNT', false]);

const marchFull = period.resolveSelector({ kind: 'MTD', as_of: '2026-03-31' });
const previousMarch = period.resolveComparison(marchFull, 'PREVIOUS_COMPARABLE_PERIOD');
assert.deepStrictEqual([previousMarch.start, previousMarch.end, previousMarch.day_count], ['2026-02-01', '2026-03-01', 28]);
assert.strictEqual(previousMarch.quality, 'CLIPPED_SHORTER_CALENDAR_PERIOD');
assert.strictEqual(previousMarch.clipped, true);
const previousQtd = period.resolveComparison(qtd, 'PREVIOUS_COMPARABLE_PERIOD');
assert.strictEqual(previousQtd.day_count, qtd.day_count);
assert.strictEqual(previousQtd.quality, 'EXACT_DAY_COUNT');
const previousYtd = period.resolveComparison(period.resolveSelector({ kind: 'YTD', as_of: '2024-02-29' }), 'PREVIOUS_COMPARABLE_PERIOD');
assert.strictEqual(previousYtd.day_count, 60);
assert.strictEqual(previousYtd.quality, 'EXACT_DAY_COUNT');

const leapYearRange = period.resolveSelector({ kind: 'EXPLICIT_RANGE', start: '2024-02-01', end: '2024-03-01' });
const leapYoy = period.resolveComparison(leapYearRange, 'YEAR_OVER_YEAR');
assert.deepStrictEqual([leapYoy.start, leapYoy.end, leapYoy.day_count, leapYoy.quality], ['2023-02-01', '2023-03-01', 28, 'CALENDAR_ALIGNED_DAY_COUNT_DIFF']);
const leapDayOnly = period.resolveSelector({ kind: 'EXPLICIT_RANGE', start: '2024-02-29', end: '2024-03-01' });
const leapDayYoy = period.resolveComparison(leapDayOnly, 'YEAR_OVER_YEAR');
assert.deepStrictEqual([leapDayYoy.start, leapDayYoy.end, leapDayYoy.day_count], ['2023-02-28', '2023-03-01', 1]);
assert.strictEqual(leapDayYoy.leap_adjusted, true);
assert.strictEqual(leapDayYoy.quality, 'CALENDAR_ALIGNED');

const serialA = period.serializePeriodSpec(spec({ kind: 'ROLLING_30', as_of: '2026-06-30' }, 'WEEK', 'PREVIOUS_COMPARABLE_PERIOD'));
const serialB = period.serializePeriodSpec({ comparison_mode: 'PREVIOUS_COMPARABLE_PERIOD', grain: 'WEEK', selector: { as_of: '2026-06-30', kind: 'ROLLING_30' } });
assert.strictEqual(serialA, serialB);
for (const forbidden of ['account_id', 'transaction_id', 'category_id', 'amount_minor', 'budget_minor', 'description', 'counterparty']) {
  assert.strictEqual(serialA.includes(forbidden), false, forbidden);
}

const fixture = [
  tx(1, '2025-12-30T12:00:00Z', 'expense', 800),
  tx(2, '2026-01-01T12:00:00Z', 'income', 5000),
  tx(3, '2026-01-05T12:00:00Z', 'expense', 1000),
  tx(4, '2026-01-31T12:00:00Z', 'expense', 700),
  tx(5, '2026-02-01T12:00:00Z', 'income', 3000),
  tx(6, '2026-03-15T12:00:00Z', 'transfer', 1500, { destination_account_id: 'acct-reserve' }),
  tx(7, '2026-04-01T12:00:00Z', 'expense', 900),
  tx(8, '2026-06-30T12:00:00Z', 'income', 4000),
  tx(9, '2026-07-01T12:00:00Z', 'expense', 600),
  tx(10, '2026-10-01T12:00:00Z', 'income', 2000)
];

const explicitQuarterSpec = spec({ kind: 'EXPLICIT_RANGE', start: '2026-01-01', end: '2026-07-01' }, 'NONE', 'NONE');
const periodNoneQuery = baseQuery(explicitQuarterSpec);
const periodNone = period.evaluatePeriodSeries(fixture, periodNoneQuery);
assert.strictEqual(periodNone.primary_buckets.length, 1);
const directQuery = period.bucketAnalyticsQuery(period.normalizePeriodQuery(periodNoneQuery), { start: '2026-01-01', end: '2026-07-01' });
assert.deepStrictEqual(periodNone.primary_buckets[0].analytics_result, evaluateAnalytics(fixture, directQuery));
assert.strictEqual(periodNone.provenance.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(periodNone.provenance.analytics_v1_enum_mutated, false);

for (const [grain, expectedCount] of [['DAY', 181], ['MONTH', 6], ['QUARTER', 2]]) {
  const result = period.evaluatePeriodSeries(fixture, baseQuery(spec({ kind: 'EXPLICIT_RANGE', start: '2026-01-01', end: '2026-07-01' }, grain, 'NONE')));
  assert.strictEqual(result.primary_buckets.length, expectedCount, grain);
  assert(result.primary_buckets.every((bucket) => bucket.analytics_result.provenance.financial_truth_policy === 'FIN-TRUTH-v1'));
}
const weekResult = period.evaluatePeriodSeries(fixture, baseQuery(spec({ kind: 'EXPLICIT_RANGE', start: '2025-12-29', end: '2026-01-12' }, 'WEEK', 'NONE')));
assert.strictEqual(weekResult.primary_buckets.length, 2);
assert(weekResult.primary_buckets.every((bucket) => bucket.analytics_result.grain === 'NONE'));
const yearResult = period.evaluatePeriodSeries(fixture, baseQuery(spec({ kind: 'EXPLICIT_RANGE', start: '2025-01-01', end: '2027-01-01' }, 'YEAR', 'NONE')));
assert.strictEqual(yearResult.primary_buckets.length, 2);

const compared = period.evaluatePeriodSeries(fixture, baseQuery(spec({ kind: 'MTD', as_of: '2026-03-31' }, 'MONTH', 'PREVIOUS_COMPARABLE_PERIOD')));
assert.strictEqual(compared.primary_range.day_count, 31);
assert.strictEqual(compared.comparison.day_count, 28);
assert.strictEqual(compared.comparison.quality, 'CLIPPED_SHORTER_CALENDAR_PERIOD');
assert.strictEqual(compared.comparison_buckets.length, 1);

assert.throws(() => period.normalizePeriodQuery(baseQuery(spec({ kind: 'EXPLICIT_RANGE', start: '2026-01-01', end: '2026-02-01' }, 'MONTH', 'NONE'), {
  measures: ['BUDGET_VARIANCE'],
  parameters: { budget_minor: 10000 }
})), /PERIOD_BUDGET_VARIANCE_TEMPORAL_UNSUPPORTED/);
assert.throws(() => period.normalizePeriodQuery(baseQuery(spec({ kind: 'EXPLICIT_RANGE', start: '2026-01-01', end: '2026-02-01' }, 'NONE', 'YEAR_OVER_YEAR'), {
  measures: ['BUDGET_VARIANCE'],
  parameters: { budget_minor: 10000 }
})), /PERIOD_BUDGET_VARIANCE_TEMPORAL_UNSUPPORTED/);
const budgetScalar = period.evaluatePeriodSeries(fixture, baseQuery(spec({ kind: 'EXPLICIT_RANGE', start: '2026-01-01', end: '2026-02-01' }, 'NONE', 'NONE'), {
  measures: ['BUDGET_VARIANCE'],
  parameters: { budget_minor: 10000 }
}));
assert.strictEqual(budgetScalar.primary_buckets.length, 1);
assert(Number.isSafeInteger(budgetScalar.primary_buckets[0].analytics_result.rows[0].measures.BUDGET_VARIANCE));

const telemetry = period.periodTelemetry(compared);
assert.deepStrictEqual(Object.keys(telemetry).sort(), period.CONTRACT.telemetry_allowlist.slice().sort());
const telemetryText = JSON.stringify(telemetry).toLowerCase();
for (const forbidden of ['amount', 'income', 'expense', 'account', 'transaction', 'category', 'member', 'project', 'description', 'counterparty']) {
  assert.strictEqual(telemetryText.includes(forbidden), false, forbidden);
}

console.log('period-comparison-engine: PASS', {
  contract: `${period.SCHEMA}@${period.VERSION}`,
  selectors: period.SELECTOR_KINDS.length,
  grains: period.GRAINS,
  comparisonModes: period.COMPARISON_MODES,
  isoMondayWeek: true,
  weekQuarterOrchestration: true,
  leapYearRules: true,
  partialPeriodRules: true,
  analyticsV1EnumMutated: false,
  financialWrite: false,
  freeOnly: period.CONTRACT.free_only
});
