'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');
const TREND = require('../lib/analytics/long_term_trends');
const PROJ = require('../lib/planning/cash_flow_projection');

function hash(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function tx(index, month, cashFlowMinor) {
  return normalizeCanonicalTransaction({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: `PROJ-TX-${String(index).padStart(3, '0')}`,
    occurred_at: `${month}-15T12:00:00Z`,
    type: 'income',
    status: 'posted',
    amount_minor: cashFlowMinor,
    currency: 'RUB',
    account_id: 'acct-synthetic-proj',
    destination_account_id: null,
    category_id: 'income-synthetic-proj',
    member_id: null,
    project_id: null,
    tags: ['synthetic-projection'],
    counterparty: null,
    description: null,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'fixture:proj-030',
      source_record_id: `PROJ-REC-${index}`,
      source_fingerprint: hash(`proj:${index}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'PROJ-030-SYNTHETIC-v1',
      source_position: null
    }
  });
}

function trendQuery(start = '2026-01-01', end = '2026-10-01') {
  return {
    schema: TREND.QUERY_SCHEMA,
    contract_version: TREND.VERSION,
    currency: 'RUB',
    measures: ['CASH_FLOW'],
    dimension: null,
    filters: [],
    sort: [],
    parameters: {},
    limit: 500,
    trend: { selector: { kind: 'EXPLICIT_RANGE', start, end }, grain: 'MONTH', comparison_mode: 'NONE' }
  };
}

function scenario(overrides = {}) {
  return {
    schema: PROJ.SCENARIO_SCHEMA,
    version: PROJ.VERSION,
    horizon_months: 3,
    monthly_adjustment_minor: -50,
    one_off_adjustments: [{ month: '2026-10-01', delta_minor: 100 }],
    ...overrides
  };
}

const fixture = [100, 200, 300, 400, 500, 600, 700, 800, 900].map((value, index) => tx(index + 1, `2026-${String(index + 1).padStart(2, '0')}`, value));
const observedTrend = TREND.evaluateLongTermTrend(fixture, trendQuery());

assert.strictEqual(PROJ.assertContract(), true);
assert.strictEqual(PROJ.CONTRACT.schema, 'PRH_CASH_FLOW_PROJECTION_V1');
assert.strictEqual(PROJ.CONTRACT.version, '1.0.0');
assert.strictEqual(PROJ.CONTRACT.baseline.model_kind, 'DETERMINISTIC_BASELINE');
assert.strictEqual(PROJ.CONTRACT.baseline.future_fact_access, false);
assert.strictEqual(PROJ.CONTRACT.baseline.ml_required, false);
assert.strictEqual(PROJ.CONTRACT.uncertainty.method, 'BACKTEST_MAE_SYMMETRIC');
assert.strictEqual(PROJ.CONTRACT.uncertainty.statistical_confidence_interval, false);
assert.strictEqual(PROJ.CONTRACT.result.financial_truth, false);
assert.strictEqual(PROJ.CONTRACT.result.projection_not_observation, true);
assert.strictEqual(PROJ.CONTRACT.free_only, true);
assert.ok(Object.values(PROJ.CONTRACT.authorities).every((value) => value === false));

assert.strictEqual(PROJ.roundDivideHalfAwayFromZero(5, 2), 3);
assert.strictEqual(PROJ.roundDivideHalfAwayFromZero(-5, 2), -3);
assert.strictEqual(PROJ.roundDivideHalfAwayFromZero(4, 3), 1);
assert.strictEqual(PROJ.meanMinor([100, 200, 300]), 200);
assert.strictEqual(PROJ.addMonths('2026-12-01', 1), '2027-01-01');

const observed = PROJ.extractObservedMonths(observedTrend);
assert.strictEqual(observed.length, 9);
assert.strictEqual(observed[0].month, '2026-01-01');
assert.strictEqual(observed[8].cash_flow_minor, 900);
assert(Object.isFrozen(observed));

const backtest = PROJ.backtestObserved(observed);
assert.strictEqual(backtest.mode, 'WALK_FORWARD_OBSERVED_ONLY');
assert.strictEqual(backtest.window_months, 3);
assert.strictEqual(backtest.sample_count, 6);
assert.strictEqual(backtest.mean_absolute_error_minor, 200);
assert.strictEqual(backtest.mean_error_minor, 200);
assert.deepStrictEqual(backtest.points.map((point) => point.prediction_minor), [200, 300, 400, 500, 600, 700]);
assert.deepStrictEqual(backtest.points.map((point) => point.actual_minor), [400, 500, 600, 700, 800, 900]);

const before = JSON.stringify(observedTrend);
const result = PROJ.projectCashFlow(observedTrend, scenario());
assert.strictEqual(JSON.stringify(observedTrend), before, 'projection must not mutate observed TREND result');
assert.strictEqual(result.schema, 'PRH_CASH_FLOW_PROJECTION_RESULT_V1');
assert.strictEqual(result.model_id, 'ROLLING_MEAN_3_COMPLETE_MONTHS_V1');
assert.strictEqual(result.model_kind, 'DETERMINISTIC_BASELINE');
assert.strictEqual(result.observed_complete_months, 9);
assert.deepStrictEqual(result.observed_range, { start: '2026-01-01', end: '2026-10-01' });
assert.strictEqual(result.uncertainty.method, 'BACKTEST_MAE_SYMMETRIC');
assert.strictEqual(result.uncertainty.statistical_confidence_interval, false);
assert.strictEqual(result.uncertainty.half_width_minor, 200);
assert.strictEqual(result.forecast.length, 3);
assert.deepStrictEqual(result.forecast[0], {
  month: '2026-10-01',
  baseline_cash_flow_minor: 800,
  scenario_adjustment_minor: 50,
  projected_cash_flow_minor: 850,
  uncertainty_lower_minor: 650,
  uncertainty_upper_minor: 1050
});
assert.deepStrictEqual(result.forecast[1], {
  month: '2026-11-01',
  baseline_cash_flow_minor: 800,
  scenario_adjustment_minor: -50,
  projected_cash_flow_minor: 750,
  uncertainty_lower_minor: 550,
  uncertainty_upper_minor: 950
});
assert.strictEqual(result.forecast[2].baseline_cash_flow_minor, 800, 'future policy must remain fixed-origin mean');
assert.strictEqual(result.provenance.financial_truth_policy, 'FIN-TRUTH-v1');
assert.strictEqual(result.provenance.financial_truth, false);
assert.strictEqual(result.provenance.projection_not_observation, true);
assert.strictEqual(result.provenance.future_fact_access, false);
assert.strictEqual(result.provenance.scenario_separate_from_observed, true);
assert.strictEqual(result.provenance.canonical_mutation, false);

const partialTrend = TREND.evaluateLongTermTrend(fixture, trendQuery('2026-01-15', '2026-10-01'));
const partialObserved = PROJ.extractObservedMonths(partialTrend);
assert.strictEqual(partialObserved.length, 8);
assert.strictEqual(partialObserved[0].month, '2026-02-01');

const normalizedScenario = PROJ.normalizeScenario(scenario({ one_off_adjustments: [{ month: '2026-12-01', delta_minor: -25 }, { month: '2026-10-01', delta_minor: 100 }] }));
assert.deepStrictEqual(normalizedScenario.one_off_adjustments.map((item) => item.month), ['2026-10-01', '2026-12-01']);
assert(Object.isFrozen(normalizedScenario));

assert.throws(() => PROJ.normalizeScenario(scenario({ horizon_months: 0 })), (error) => error.code === 'PROJECTION_HORIZON_INVALID');
assert.throws(() => PROJ.normalizeScenario(scenario({ horizon_months: 13 })), (error) => error.code === 'PROJECTION_HORIZON_INVALID');
assert.throws(() => PROJ.normalizeScenario(scenario({ monthly_adjustment_minor: 1.5 })), (error) => error.code === 'PROJECTION_MONTHLY_ADJUSTMENT_INVALID');
assert.throws(() => PROJ.normalizeScenario(scenario({ one_off_adjustments: [{ month: '2026-10-01', delta_minor: 1 }, { month: '2026-10-01', delta_minor: 2 }] })), (error) => error.code === 'PROJECTION_ONE_OFF_MONTH_DUPLICATE');
assert.throws(() => PROJ.projectCashFlow(observedTrend, scenario({ one_off_adjustments: [{ month: '2027-01-01', delta_minor: 1 }] })), (error) => error.code === 'PROJECTION_ONE_OFF_OUTSIDE_HORIZON');

const shortFixture = fixture.slice(0, 5);
const shortTrend = TREND.evaluateLongTermTrend(shortFixture, trendQuery('2026-01-01', '2026-06-01'));
assert.throws(() => PROJ.extractObservedMonths(shortTrend), (error) => error.code === 'PROJECTION_OBSERVED_HISTORY_TOO_SHORT');

const grouped = { ...observedTrend, dimension_id: 'category_id' };
assert.throws(() => PROJ.extractObservedMonths(grouped), (error) => error.code === 'PROJECTION_OBSERVED_SHAPE_INVALID');
const compared = { ...observedTrend, comparison_mode: 'YEAR_OVER_YEAR' };
assert.throws(() => PROJ.extractObservedMonths(compared), (error) => error.code === 'PROJECTION_OBSERVED_SHAPE_INVALID');
const noCashFlow = { ...observedTrend, measure_ids: ['INCOME'] };
assert.throws(() => PROJ.extractObservedMonths(noCashFlow), (error) => error.code === 'PROJECTION_CASH_FLOW_MEASURE_REQUIRED');

const telemetry = PROJ.projectionTelemetry(result);
assert.deepStrictEqual(Object.keys(telemetry).sort(), PROJ.CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.model_kind, 'DETERMINISTIC_BASELINE');
assert.strictEqual(telemetry.backtest_samples, 6);
assert.strictEqual(telemetry.horizon_months, 3);
assert.strictEqual(telemetry.scenario_one_off_count, 1);
assert.strictEqual(telemetry.uncertainty_method, 'BACKTEST_MAE_SYMMETRIC');
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['cash_flow_minor', 'mean_absolute_error_minor', 'projected_cash_flow_minor', 'baseline_cash_flow_minor', 'scenario_adjustment_minor']) {
  assert.strictEqual(telemetryText.includes(forbidden), false, forbidden);
}

console.log('cash-flow-projection-contract: PASS', {
  schema: PROJ.CONTRACT.schema,
  version: PROJ.CONTRACT.version,
  observedCompleteMonths: result.observed_complete_months,
  backtestSamples: result.backtest.sample_count,
  backtestMaeMinor: result.backtest.mean_absolute_error_minor,
  horizonMonths: result.scenario.horizon_months,
  uncertaintyMethod: result.uncertainty.method,
  financialTruth: result.provenance.financial_truth,
  futureFactAccess: result.provenance.future_fact_access,
  financialWrite: PROJ.CONTRACT.authorities.financial_write,
  freeOnly: PROJ.CONTRACT.free_only
});
