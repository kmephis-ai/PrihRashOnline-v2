'use strict';

const assert = require('assert');
const GOAL = require('../lib/planning/goal_planning');

function event(id, date, delta) {
  return { schema: GOAL.EVENT_SCHEMA, version: GOAL.VERSION, event_id: id, occurred_on: date, delta_minor: delta, provenance: 'DECLARED_PLANNING' };
}

function goal(overrides = {}) {
  return {
    schema: GOAL.GOAL_SCHEMA,
    version: GOAL.VERSION,
    goal_id: 'goal-synthetic-01',
    name: 'Синтетическая цель',
    target_minor: 100000,
    currency: 'RUB',
    deadline: '2026-12-31',
    priority: 'P2',
    status: 'ACTIVE',
    funding_events: [event('fund-3', '2026-04-01', -5000), event('fund-1', '2026-01-15', 20000), event('fund-2', '2026-03-01', 10000)],
    ...overrides
  };
}

assert.strictEqual(GOAL.assertContract(), true);
assert.strictEqual(GOAL.CONTRACT.schema, 'PRH_GOAL_PLANNING_V1');
assert.strictEqual(GOAL.CONTRACT.version, '1.0.0');
assert.strictEqual(GOAL.CONTRACT.funding_history.provenance, 'DECLARED_PLANNING');
assert.strictEqual(GOAL.CONTRACT.funding_history.canonical_transaction_claim, false);
assert.strictEqual(GOAL.CONTRACT.recommendation.model_kind, 'DETERMINISTIC_RULE');
assert.strictEqual(GOAL.CONTRACT.recommendation.hidden_forecast, false);
assert.strictEqual(GOAL.CONTRACT.recommendation.financial_truth, false);
assert.ok(Object.values(GOAL.CONTRACT.authorities).every((value) => value === false));
assert.strictEqual(GOAL.CONTRACT.free_only, true);

const normalized = GOAL.normalizeGoal(goal());
assert.deepStrictEqual(normalized.funding_events.map((item) => item.event_id), ['fund-1', 'fund-2', 'fund-3']);
assert(Object.isFrozen(normalized));
assert(Object.isFrozen(normalized.funding_events));

const evaluation = GOAL.evaluateGoal(goal(), '2026-08-10');
assert.strictEqual(evaluation.funded_minor, 25000);
assert.strictEqual(evaluation.remaining_minor, 75000);
assert.strictEqual(evaluation.overfunded_minor, 0);
assert.strictEqual(evaluation.progress_basis_points, 2500);
assert.strictEqual(evaluation.deadline_state, 'FUTURE');
assert.strictEqual(evaluation.deadline_days_remaining, 143);
assert.strictEqual(evaluation.contribution_periods, 5);
assert.strictEqual(evaluation.recommendation.reason_code, 'ACTIVE_ON_TRACK_INPUT_REQUIRED');
assert.strictEqual(evaluation.recommendation.required_monthly_contribution_minor, 15000);
assert.strictEqual(evaluation.recommendation.financial_truth, false);
assert.strictEqual(evaluation.recommendation.hidden_forecast, false);
assert.strictEqual(evaluation.provenance.funding_provenance, 'DECLARED_PLANNING');
assert.strictEqual(evaluation.provenance.canonical_transaction_claim, false);
assert.strictEqual(evaluation.provenance.projection_used, false);
assert.strictEqual(evaluation.provenance.canonical_mutation, false);

const ordered = goal({ funding_events: goal().funding_events.slice().reverse() });
assert.strictEqual(GOAL.serializeGoal(goal()), GOAL.serializeGoal(ordered));
assert.strictEqual(GOAL.ceilDividePositive(75001, 5), 15001);
assert.strictEqual(GOAL.contributionPeriods('2026-08-10', '2026-12-31'), 5);
assert.strictEqual(GOAL.contributionPeriods('2026-12-31', '2026-12-31'), 1);
assert.strictEqual(GOAL.calendarDaysBetween('2026-08-10', '2026-12-31'), 143);

const overfunded = GOAL.evaluateGoal(goal({ target_minor: 1000, funding_events: [event('over', '2026-01-01', 1200)] }), '2026-08-10');
assert.strictEqual(overfunded.remaining_minor, 0);
assert.strictEqual(overfunded.overfunded_minor, 200);
assert.strictEqual(overfunded.progress_basis_points, 10000);
assert.strictEqual(overfunded.recommendation.reason_code, 'GOAL_FUNDED');
assert.strictEqual(overfunded.recommendation.required_monthly_contribution_minor, 0);

const dueToday = GOAL.evaluateGoal(goal({ deadline: '2026-08-10' }), '2026-08-10');
assert.strictEqual(dueToday.deadline_state, 'DUE_TODAY');
assert.strictEqual(dueToday.contribution_periods, 1);
assert.strictEqual(dueToday.recommendation.required_monthly_contribution_minor, 75000);

const overdue = GOAL.evaluateGoal(goal({ deadline: '2026-08-09' }), '2026-08-10');
assert.strictEqual(overdue.deadline_state, 'OVERDUE');
assert.strictEqual(overdue.contribution_periods, 0);
assert.strictEqual(overdue.recommendation.reason_code, 'OVERDUE');
assert.strictEqual(overdue.recommendation.required_monthly_contribution_minor, null);

const noDeadline = GOAL.evaluateGoal(goal({ deadline: null }), '2026-08-10');
assert.strictEqual(noDeadline.deadline_state, 'NO_DEADLINE');
assert.strictEqual(noDeadline.contribution_periods, null);
assert.strictEqual(noDeadline.recommendation.reason_code, 'NO_DEADLINE');
assert.strictEqual(noDeadline.recommendation.required_monthly_contribution_minor, null);

const paused = GOAL.evaluateGoal(goal({ status: 'PAUSED' }), '2026-08-10');
assert.strictEqual(paused.recommendation.reason_code, 'PAUSED');
assert.strictEqual(paused.recommendation.required_monthly_contribution_minor, null);
const cancelled = GOAL.evaluateGoal(goal({ status: 'CANCELLED' }), '2026-08-10');
assert.strictEqual(cancelled.recommendation.reason_code, 'CANCELLED');

const correctionOk = GOAL.evaluateGoal(goal({ funding_events: [event('a', '2026-01-01', 10000), event('b', '2026-02-01', -3000)] }), '2026-08-10');
assert.strictEqual(correctionOk.funded_minor, 7000);
const correctionBad = goal({ funding_events: [event('a', '2026-01-01', 1000), event('b', '2026-02-01', -2000)] });
assert.throws(() => GOAL.evaluateGoal(correctionBad, '2026-08-10'), (error) => error.code === 'GOAL_NEGATIVE_CUMULATIVE_FUNDING');

const duplicate = goal({ funding_events: [event('same', '2026-01-01', 100), event('same', '2026-02-01', 100)] });
assert.throws(() => GOAL.normalizeGoal(duplicate), (error) => error.code === 'GOAL_FUNDING_EVENT_ID_DUPLICATE');
const future = goal({ funding_events: [event('future', '2026-08-11', 100)] });
assert.throws(() => GOAL.evaluateGoal(future, '2026-08-10'), (error) => error.code === 'GOAL_FUTURE_FUNDING_EVENT');
assert.throws(() => GOAL.normalizeGoal(goal({ target_minor: 0 })), (error) => error.code === 'GOAL_TARGET_INVALID');
assert.throws(() => GOAL.normalizeGoal(goal({ currency: 'RU' })), (error) => error.code === 'GOAL_CURRENCY_INVALID');
assert.throws(() => GOAL.normalizeGoal(goal({ deadline: '2026-02-30' })), (error) => error.code === 'GOAL_DEADLINE_INVALID');
assert.throws(() => GOAL.normalizeGoal(goal({ priority: 'P9' })), (error) => error.code === 'GOAL_PRIORITY_INVALID');
assert.throws(() => GOAL.normalizeGoal(goal({ status: 'UNKNOWN' })), (error) => error.code === 'GOAL_STATUS_INVALID');
assert.throws(() => GOAL.normalizeFundingEvent(event('zero', '2026-01-01', 0)), (error) => error.code === 'GOAL_FUNDING_DELTA_INVALID');
assert.throws(() => GOAL.normalizeFundingEvent({ ...event('bad', '2026-01-01', 100), provenance: 'CANONICAL' }), (error) => error.code === 'GOAL_FUNDING_PROVENANCE_INVALID');

const telemetry = GOAL.goalTelemetry(evaluation);
assert.deepStrictEqual(Object.keys(telemetry).sort(), GOAL.CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.status, 'ACTIVE');
assert.strictEqual(telemetry.priority, 'P2');
assert.strictEqual(telemetry.progress_band, '25_49');
assert.strictEqual(telemetry.recommendation_reason, 'ACTIVE_ON_TRACK_INPUT_REQUIRED');
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['goal-synthetic-01', 'Синтетическая цель', 'funded_minor', 'target_minor', 'required_monthly_contribution_minor', 'delta_minor']) {
  assert.strictEqual(telemetryText.includes(forbidden), false, forbidden);
}

console.log('goal-planning-contract: PASS', {
  schema: GOAL.CONTRACT.schema,
  version: GOAL.CONTRACT.version,
  fundedMinor: evaluation.funded_minor,
  remainingMinor: evaluation.remaining_minor,
  progressBasisPoints: evaluation.progress_basis_points,
  contributionPeriods: evaluation.contribution_periods,
  recommendationReason: evaluation.recommendation.reason_code,
  fundingProvenance: evaluation.provenance.funding_provenance,
  financialTruth: evaluation.recommendation.financial_truth,
  financialWrite: GOAL.CONTRACT.authorities.financial_write,
  freeOnly: GOAL.CONTRACT.free_only
});
