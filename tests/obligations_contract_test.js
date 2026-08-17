'use strict';

const assert = require('assert');
const OBL = require('../lib/obligations/obligations');
const CONTRACT = require('../lib/obligations/obligations.v1.json');

function expectCode(fn, prefix) {
  let thrown = null;
  try { fn(); } catch (error) { thrown = error; }
  assert(thrown, `Expected ${prefix}`);
  assert(String(thrown.code || thrown.message).startsWith(prefix), `Expected ${prefix}, got ${thrown.code || thrown.message}`);
}

function plan(overrides = {}) {
  return {
    schema: 'PRH_OBLIGATION_PLAN_V1', version: '1.0.0', plan_id: 'SYN-PLAN', label: 'Synthetic obligation',
    direction: 'OUTFLOW', amount_minor: 10000, currency: 'RUB', enabled: true,
    active_end_exclusive: null, recurrence: { kind: 'ONCE', due_date: '2026-02-10' }, completed_due_dates: [], ...overrides
  };
}

assert.strictEqual(CONTRACT.schema, 'PRH_OBLIGATIONS_V1');
assert.deepStrictEqual(CONTRACT.recurrence.supported, ['ONCE','WEEKLY','MONTHLY']);
assert.strictEqual(CONTRACT.recurrence.monthly_day_policy, 'CLAMP_TO_LAST_DAY');
assert.strictEqual(CONTRACT.completion.fuzzy_transaction_matching, false);
assert.strictEqual(CONTRACT.completion.auto_transaction_creation, false);
assert.strictEqual(CONTRACT.planning.amount_is_financial_truth, false);
assert.strictEqual(CONTRACT.planning.forecast_is_financial_truth, false);
assert.strictEqual(CONTRACT.cost.mode, 'FREE_ONLY');
assert(Object.values(CONTRACT.authority).every((value) => value === false));

const window = { window_start: '2026-02-01', as_of: '2026-02-15', window_end: '2026-05-01' };
const plans = [
  plan({ plan_id: 'SYN-ONCE', label: 'Synthetic once', recurrence: { kind: 'ONCE', due_date: '2026-02-10' } }),
  plan({ plan_id: 'SYN-WEEKLY', label: 'Synthetic weekly inflow', direction: 'INFLOW', amount_minor: 7000,
    recurrence: { kind: 'WEEKLY', anchor_date: '2026-02-01', interval_weeks: 1 }, completed_due_dates: ['2026-02-01', '2026-02-08'] }),
  plan({ plan_id: 'SYN-MONTH-END', label: 'Synthetic month end', amount_minor: 30000,
    recurrence: { kind: 'MONTHLY', anchor_date: '2026-01-31', interval_months: 1, month_day_policy: 'CLAMP_TO_LAST_DAY' }, completed_due_dates: ['2026-01-31'] }),
  plan({ plan_id: 'SYN-DISABLED', label: 'Synthetic disabled', enabled: false,
    recurrence: { kind: 'WEEKLY', anchor_date: '2026-02-01', interval_weeks: 1 } })
];

const view = OBL.buildObligations(plans, window);
assert.strictEqual(view.schema, 'PRH_OBLIGATIONS_VIEW_V1');
assert.strictEqual(view.currency, 'RUB');
assert.strictEqual(view.financial_truth, false);
assert.strictEqual(view.planning_only, true);
assert.strictEqual(view.canonical_transaction_created, false);
assert.deepStrictEqual(view.state_counts, { OVERDUE: 1, DUE: 1, UPCOMING: 5, FORECAST: 8 });
assert.strictEqual(view.occurrences.length, 15);
assert(!view.occurrences.some((item) => item.plan_id === 'SYN-DISABLED'));
assert(view.occurrences.every((item) => /^[0-9a-f]{64}$/.test(item.occurrence_id)));
assert(view.occurrences.every((item) => item.planning_only === true && item.canonical_transaction_created === false));

const once = view.occurrences.find((item) => item.plan_id === 'SYN-ONCE');
assert.strictEqual(once.state, 'OVERDUE');
assert.strictEqual(view.occurrences.find((item) => item.plan_id === 'SYN-WEEKLY' && item.due_date === '2026-02-15').state, 'DUE');
assert.strictEqual(view.occurrences.find((item) => item.plan_id === 'SYN-MONTH-END' && item.due_date === '2026-02-28').state, 'UPCOMING');
assert.strictEqual(view.occurrences.find((item) => item.plan_id === 'SYN-MONTH-END' && item.due_date === '2026-03-31').state, 'FORECAST');
assert(view.occurrences.some((item) => item.plan_id === 'SYN-MONTH-END' && item.due_date === '2026-04-30'));

const reversed = OBL.buildObligations(plans.slice().reverse(), window);
assert.deepStrictEqual(reversed.occurrences.map((item) => item.occurrence_id), view.occurrences.map((item) => item.occurrence_id));
assert.strictEqual(OBL.occurrenceId('SYN-ONCE','2026-02-10'), once.occurrence_id);
assert.strictEqual(OBL.recurrenceMatches({kind:'WEEKLY',anchor_date:'2026-02-01',interval_weeks:2},'2026-03-01'), true);
assert.strictEqual(OBL.recurrenceMatches({kind:'WEEKLY',anchor_date:'2026-02-01',interval_weeks:2},'2026-03-08'), false);

const leapPlan = OBL.normalizePlan(plan({ plan_id: 'SYN-LEAP', recurrence: { kind: 'MONTHLY', anchor_date: '2028-01-31', interval_months: 1, month_day_policy: 'CLAMP_TO_LAST_DAY' }, completed_due_dates: ['2028-01-31'] }));
const leapDates = OBL.dueDatesInWindow(leapPlan, OBL.normalizeWindow({window_start:'2028-02-01',as_of:'2028-02-10',window_end:'2028-04-01'}));
assert.deepStrictEqual(leapDates, ['2028-02-29','2028-03-31']);

const ended = OBL.buildObligations([plan({ plan_id:'SYN-END', recurrence:{kind:'WEEKLY',anchor_date:'2026-02-01',interval_weeks:1}, active_end_exclusive:'2026-02-20' })], window);
assert.deepStrictEqual(ended.occurrences.map((item)=>item.due_date), ['2026-02-01','2026-02-08','2026-02-15']);

assert(/^[0-9a-f]{64}$/.test(view.telemetry.query_hash));
assert.deepStrictEqual(Object.keys(view.telemetry).sort(), ['schema','version','query_hash','plan_count','occurrence_count','state_count','status','reason_code'].sort());
const telemetryText = JSON.stringify(view.telemetry);
for (const forbidden of ['SYN-ONCE','SYN-WEEKLY','Synthetic','10000','30000','7000']) assert(!telemetryText.includes(forbidden));

expectCode(() => OBL.normalizePlan(plan({completed_due_dates:['2026-02-11']})), 'OBL_COMPLETED_DATE_NOT_OCCURRENCE');
expectCode(() => OBL.normalizePlan(plan({recurrence:{kind:'MONTHLY',anchor_date:'2026-01-31',interval_months:1,month_day_policy:'ROLL_FORWARD'}})), 'OBL_MONTH_DAY_POLICY_INVALID');
expectCode(() => OBL.normalizeWindow({window_start:'2026-01-01',as_of:'2026-01-02',window_end:'2027-01-03'}), 'OBL_WINDOW_TOO_LARGE');
expectCode(() => OBL.buildObligations([plan({plan_id:'SYN-RUB'}), plan({plan_id:'SYN-USD',currency:'USD'})], window), 'OBL_MIXED_CURRENCY_UNSUPPORTED');
expectCode(() => OBL.buildObligations([plan({plan_id:'SYN-DUP'}), plan({plan_id:'SYN-DUP'})], window), 'OBL_PLAN_ID_DUPLICATE');
const manyPlans = Array.from({length:6},(_,i)=>plan({plan_id:`SYN-MANY-${i}`,recurrence:{kind:'WEEKLY',anchor_date:'2026-01-01',interval_weeks:1}}));
expectCode(() => OBL.buildObligations(manyPlans,{window_start:'2026-01-01',as_of:'2026-01-02',window_end:'2027-01-01'}), 'OBL_OCCURRENCE_LIMIT_EXCEEDED');

console.log('obligations_contract_test: OK', { contract: `${CONTRACT.schema}@${CONTRACT.version}`, occurrences: view.occurrences.length, states: view.state_counts, monthEndClamp: true, leapClamp: true, explicitCompletion: true, stableOccurrenceIdentity: true, autoTransactionCreation: false, financialTruth: false, publicTelemetryPayload: false, freeOnly: true, financialWriteAuthority: false });
