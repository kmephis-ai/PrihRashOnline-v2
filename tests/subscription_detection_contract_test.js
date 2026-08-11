'use strict';

const assert = require('assert');
const crypto = require('crypto');
const detector = require('../lib/subscriptions/subscription_detection');

function fp(seed) { return crypto.createHash('sha256').update(seed, 'utf8').digest('hex'); }
function tx(id, day, amount, overrides = {}) {
  const type = overrides.type || 'expense';
  return {
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: id,
    occurred_at: `${day}T10:00:00Z`,
    type,
    status: overrides.status || 'posted',
    amount_minor: type === 'adjustment' ? 0 : amount,
    currency: overrides.currency || 'RUB',
    account_id: overrides.account_id || 'ACC-MAIN',
    destination_account_id: type === 'transfer' ? (overrides.destination_account_id || 'ACC-OTHER') : null,
    category_id: overrides.category_id || 'CAT-SERVICES',
    member_id: overrides.member_id === undefined ? 'MEMBER-A' : overrides.member_id,
    project_id: overrides.project_id === undefined ? null : overrides.project_id,
    tags: overrides.tags || [],
    counterparty: overrides.counterparty === undefined ? 'СИН Подписка' : overrides.counterparty,
    description: overrides.description === undefined ? 'Синтетический регулярный платёж' : overrides.description,
    reverses_transaction_id: overrides.reverses_transaction_id || null,
    adjustment_semantics: type === 'refund' ? (overrides.adjustment_semantics || 'expense_reduction') : null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'SUB030',
      source_record_id: `SRC-${id}`,
      source_fingerprint: fp(`source|${id}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SUB030-SYN-v1',
      source_position: `row:${id}`
    }
  };
}

const monthly = [
  tx('M001', '2026-01-31', 999),
  tx('M002', '2026-02-28', 1000),
  tx('M003', '2026-03-31', 1000),
  tx('M004', '2026-04-30', 1001)
];
const weekly = [
  tx('W001', '2026-03-01', 2500, { counterparty: 'СИН Еженедельно', category_id: 'CAT-WEEKLY' }),
  tx('W002', '2026-03-08', 2500, { counterparty: 'СИН Еженедельно', category_id: 'CAT-WEEKLY' }),
  tx('W003', '2026-03-15', 2500, { counterparty: 'СИН Еженедельно', category_id: 'CAT-WEEKLY' }),
  tx('W004', '2026-03-22', 2500, { counterparty: 'СИН Еженедельно', category_id: 'CAT-WEEKLY' })
];
const irregular = [
  tx('I001', '2026-01-01', 3000, { counterparty: 'СИН Нерегулярно', category_id: 'CAT-IRREGULAR' }),
  tx('I002', '2026-01-10', 3000, { counterparty: 'СИН Нерегулярно', category_id: 'CAT-IRREGULAR' }),
  tx('I003', '2026-01-25', 3000, { counterparty: 'СИН Нерегулярно', category_id: 'CAT-IRREGULAR' })
];
const drift = [
  tx('D001', '2026-01-10', 1000, { counterparty: 'СИН Дрейф', category_id: 'CAT-DRIFT' }),
  tx('D002', '2026-02-10', 1000, { counterparty: 'СИН Дрейф', category_id: 'CAT-DRIFT' }),
  tx('D003', '2026-03-10', 1600, { counterparty: 'СИН Дрейф', category_id: 'CAT-DRIFT' })
];
const insufficient = [
  tx('N001', '2026-01-05', 4000, { counterparty: 'СИН Мало', category_id: 'CAT-SHORT' }),
  tx('N002', '2026-02-05', 4000, { counterparty: 'СИН Мало', category_id: 'CAT-SHORT' })
];
const ignored = [
  tx('X001', '2026-01-15', 9000, { type: 'income', counterparty: 'СИН Ignore Income', category_id: 'CAT-IGNORE-1' }),
  tx('X002', '2026-02-15', 9000, { type: 'transfer', counterparty: 'СИН Ignore Transfer', category_id: 'CAT-IGNORE-2' }),
  tx('X003', '2026-03-15', 9000, { type: 'refund', counterparty: 'СИН Ignore Refund', category_id: 'CAT-IGNORE-3' }),
  tx('X004', '2026-04-15', 9000, { status: 'pending', counterparty: 'СИН Ignore Pending', category_id: 'CAT-IGNORE-4' }),
  tx('X005', '2026-05-15', 9000, { status: 'void', counterparty: 'СИН Ignore Void', category_id: 'CAT-IGNORE-5' }),
  tx('X006', '2026-06-15', 0, { type: 'adjustment', counterparty: 'СИН Ignore Adjustment', category_id: 'CAT-IGNORE-6' })
];

assert.strictEqual(detector.assertContract(), true);
assert.deepStrictEqual(detector.CONTRACT.cadence.supported, ['WEEKLY', 'MONTHLY']);
assert.strictEqual(detector.CONTRACT.review.auto_confirm, false);
assert.strictEqual(detector.CONTRACT.review.auto_create_obligation, false);
assert.strictEqual(detector.CONTRACT.review.financial_write, false);
assert.strictEqual(detector.CONTRACT.signature.fuzzy_matching, false);
assert.strictEqual(detector.normalizeLabel('  СИН   Подписка  ').normalized, 'син подписка');
assert.strictEqual(detector.normalizeLabel('ＳＹＮ').normalized, 'syn');

const input = [...monthly, ...weekly, ...irregular, ...drift, ...insufficient, ...ignored];
const before = JSON.stringify(input);
const result = detector.detectSubscriptions(input);
assert.strictEqual(JSON.stringify(input), before, 'detector mutated input');
assert.strictEqual(result.schema, 'PRH_SUBSCRIPTION_DETECTION_RESULT_V1');
assert.strictEqual(result.proposal_only, true);
assert.strictEqual(result.auto_confirmed, false);
assert.strictEqual(result.obligation_created, false);
assert.strictEqual(result.canonical_mutation, false);
assert.strictEqual(result.financial_write, false);
assert.strictEqual(result.financial_truth, false);

const candidates = result.findings.filter((item) => item.status === 'CANDIDATE');
const reviews = result.findings.filter((item) => item.status === 'REVIEW');
assert.strictEqual(candidates.length, 2, 'expected monthly + weekly candidates');
assert.strictEqual(reviews.length, 2, 'expected cadence-irregular + amount-drift review');
assert.strictEqual(result.telemetry.rejected_group_count, 1, 'two-occurrence group must be rejected');
assert.strictEqual(result.telemetry.group_count, 5, 'non-expense/non-posted records must never create groups');
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.telemetry.cadence_count)), { WEEKLY: 1, MONTHLY: 2 });

const monthlyFinding = candidates.find((item) => item.cadence === 'MONTHLY');
const weeklyFinding = candidates.find((item) => item.cadence === 'WEEKLY');
assert(monthlyFinding && weeklyFinding);
assert.deepStrictEqual(monthlyFinding.reason_codes, ['CADENCE_MONTHLY_STABLE', 'AMOUNT_STABLE']);
assert.strictEqual(monthlyFinding.amount_evidence.reference_minor, 1000);
assert.strictEqual(monthlyFinding.amount_evidence.tolerance_minor, 100);
assert.strictEqual(monthlyFinding.amount_evidence.max_deviation_minor, 1);
assert.strictEqual(monthlyFinding.cadence_evidence.monthly.nominal_day, 31);
assert.strictEqual(monthlyFinding.cadence_evidence.monthly.max_deviation_days, 0);
assert.strictEqual(monthlyFinding.review_required, true);
assert.strictEqual(weeklyFinding.cadence_evidence.weekly.max_deviation_days, 0);

const irregularFinding = reviews.find((item) => item.display_label === 'СИН Нерегулярно');
const driftFinding = reviews.find((item) => item.display_label === 'СИН Дрейф');
assert(irregularFinding.reason_codes.includes('CADENCE_AMBIGUOUS_OR_IRREGULAR'));
assert(driftFinding.reason_codes.includes('AMOUNT_UNSTABLE'));
assert.strictEqual(irregularFinding.auto_confirmed, false);
assert.strictEqual(driftFinding.financial_write, false);

// Description fallback is explicit, not fuzzy.
const descriptionOnly = [
  tx('L001', '2026-01-12', 700, { counterparty: null, description: '  СИН   Описание ', category_id: 'CAT-DESC' }),
  tx('L002', '2026-02-12', 700, { counterparty: null, description: 'син описание', category_id: 'CAT-DESC' }),
  tx('L003', '2026-03-12', 700, { counterparty: null, description: 'СИН ОПИСАНИЕ', category_id: 'CAT-DESC' })
];
const descriptionResult = detector.detectSubscriptions(descriptionOnly);
assert.strictEqual(descriptionResult.findings.length, 1);
assert.strictEqual(descriptionResult.findings[0].status, 'CANDIDATE');
assert.strictEqual(descriptionResult.findings[0].display_label, 'СИН ОПИСАНИЕ', 'deterministic sort uses earliest transaction display label');

// Existing OBL comparison is explicit signature_hash -> plan_id only.
const plan = {
  schema: 'PRH_OBLIGATION_PLAN_V1', version: '1.0.0', plan_id: 'PLAN-SYN-001', label: 'Не участвует в matching',
  direction: 'OUTFLOW', amount_minor: 1000, currency: 'RUB', enabled: true, active_end_exclusive: null,
  recurrence: { kind: 'MONTHLY', anchor_date: '2026-01-31', interval_months: 1, month_day_policy: 'CLAMP_TO_LAST_DAY' },
  completed_due_dates: []
};
const linked = detector.detectSubscriptions(monthly, {
  existing_plans: [plan],
  plan_links: [{ schema: 'PRH_SUBSCRIPTION_OBLIGATION_LINK_V1', version: '1.0.0', signature_hash: monthlyFinding.signature_hash, plan_id: 'PLAN-SYN-001' }]
});
assert.strictEqual(linked.findings.length, 1);
assert.strictEqual(linked.findings[0].status, 'ALREADY_TRACKED');
assert.strictEqual(linked.findings[0].tracked_plan_id, 'PLAN-SYN-001');
assert.strictEqual(linked.findings[0].review_required, false);
assert.strictEqual(linked.findings[0].auto_confirmed, false);
assert.strictEqual(linked.findings[0].obligation_created, false);
assert(linked.findings[0].reason_codes.includes('EXPLICIT_OBLIGATION_LINK_MATCH'));

const wrongPlan = { ...plan, plan_id: 'PLAN-SYN-WRONG', amount_minor: 1100 };
assert.throws(() => detector.detectSubscriptions(monthly, {
  existing_plans: [wrongPlan],
  plan_links: [{ schema: 'PRH_SUBSCRIPTION_OBLIGATION_LINK_V1', version: '1.0.0', signature_hash: monthlyFinding.signature_hash, plan_id: 'PLAN-SYN-WRONG' }]
}), /SUB_TRACKED_PLAN_AMOUNT_MISMATCH/);

// Deterministic ordering/id/result under shuffled input.
const shuffled = input.slice().reverse();
const repeat = detector.detectSubscriptions(shuffled);
assert.strictEqual(JSON.stringify(repeat), JSON.stringify(result));
for (const finding of result.findings) assert(/^[0-9a-f]{64}$/.test(finding.finding_id));

const telemetryText = JSON.stringify(result.telemetry);
for (const forbidden of ['СИН ', 'M001', 'W001', 'ACC-MAIN', 'CAT-SERVICES', 'amount_minor', 'reference_minor', 'display_label']) {
  assert(!telemetryText.includes(forbidden), `public telemetry leaked ${forbidden}`);
}
assert.deepStrictEqual(Object.keys(result.telemetry).sort(), detector.CONTRACT.privacy.telemetry_allowlist.slice().sort());

const duplicate = monthly.concat([{ ...monthly[0] }]);
assert.throws(() => detector.detectSubscriptions(duplicate), /CANONICAL_TRANSACTION_ID_DUPLICATE|CANONICAL_SOURCE_IDENTITY_DUPLICATE/);
assert.throws(() => detector.detectSubscriptions(new Array(detector.CONTRACT.history.max_input_transactions + 1).fill(null)), /SUB_TRANSACTIONS_INVALID/);

console.log('subscription_detection_contract_test: OK', {
  monthlyCandidate: true,
  weeklyCandidate: true,
  irregularReview: true,
  driftReview: true,
  ignoredNonExpenseOrNonPosted: ignored.length,
  exactObligationLinkOnly: true,
  deterministic: true,
  telemetryPrivateSafe: true,
  autoMutation: false,
  freeOnly: true
});
