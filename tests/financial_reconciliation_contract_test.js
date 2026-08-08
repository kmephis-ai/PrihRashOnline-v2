'use strict';

const assert = require('assert');
const {
  POLICY_VERSION,
  aggregateTransactions,
  aggregateByMonth,
  assertFinancialInvariants,
  normalizeTransaction
} = require('../lib/finance/financial_reconciliation');
const { generateSyntheticFinanceFixture } = require('./fixtures/synthetic_finance');

function independentReference(rows) {
  const expected = {
    income_minor: 0,
    gross_expense_minor: 0,
    refund_minor: 0,
    external_expense_minor: 0,
    cash_flow_minor: 0,
    transfer_minor: 0
  };
  for (const row of rows) {
    if ((row.status || 'posted') !== 'posted') continue;
    if (row.type === 'income') expected.income_minor += row.amount_minor;
    if (row.type === 'expense') expected.gross_expense_minor += row.amount_minor;
    if (row.type === 'refund') expected.refund_minor += row.amount_minor;
    if (row.type === 'transfer') expected.transfer_minor += row.amount_minor;
  }
  expected.external_expense_minor = expected.gross_expense_minor - expected.refund_minor;
  expected.cash_flow_minor = expected.income_minor - expected.external_expense_minor;
  return expected;
}

function pickFinancial(report) {
  return {
    income_minor: report.income_minor,
    gross_expense_minor: report.gross_expense_minor,
    refund_minor: report.refund_minor,
    external_expense_minor: report.external_expense_minor,
    cash_flow_minor: report.cash_flow_minor,
    transfer_minor: report.transfer_minor
  };
}

const golden = generateSyntheticFinanceFixture({ profile: 'golden' }).transactions;
const report = aggregateTransactions(golden);
assert.strictEqual(report.policy_version, POLICY_VERSION);
assert.deepStrictEqual(pickFinancial(report), independentReference(golden));
assert.strictEqual(assertFinancialInvariants(report), true);
assert.strictEqual(
  Object.values(report.by_income_category_minor).reduce((a, b) => a + b, 0),
  report.income_minor,
  'income category partition must equal income total'
);
assert.strictEqual(
  Object.values(report.by_expense_category_minor).reduce((a, b) => a + b, 0),
  report.external_expense_minor,
  'expense category partition must equal net external expense'
);

// Internal transfer may be large, but family income/expense/cash-flow cannot change.
const withoutTransfer = aggregateTransactions(golden.filter((row) => row.type !== 'transfer'));
assert.strictEqual(report.income_minor, withoutTransfer.income_minor);
assert.strictEqual(report.external_expense_minor, withoutTransfer.external_expense_minor);
assert.strictEqual(report.cash_flow_minor, withoutTransfer.cash_flow_minor);
assert(report.transfer_minor > 0, 'transfer fixture must still be measured separately');

// Refund/reversal semantics must be explicit.
const linkedRefund = golden.find((row) => row.type === 'refund');
assert(linkedRefund.reverses_transaction_id, 'golden refund must explicitly link to its source expense');
assert.throws(
  () => normalizeTransaction({ ...linkedRefund, reverses_transaction_id: null, adjustment_semantics: null }),
  /refund requires/,
  'ambiguous refund must fail closed'
);
assert.doesNotThrow(() => normalizeTransaction({ ...linkedRefund, reverses_transaction_id: null, adjustment_semantics: 'expense_reduction' }));

// Money truth is integer minor units. Floating business money must fail closed.
const expense = golden.find((row) => row.type === 'expense');
assert.throws(() => normalizeTransaction({ ...expense, transaction_id: 'SYN-FLOAT', amount_minor: 10.5 }), /integer minor units/);
assert.doesNotThrow(() => normalizeTransaction({ ...expense, transaction_id: 'SYN-ZERO-EXPENSE', amount_minor: 0 }));

// Non-zero adjustment is intentionally unsupported until a later versioned definition exists.
const zeroAdjustment = golden.find((row) => row.type === 'adjustment');
assert.strictEqual(zeroAdjustment.amount_minor, 0);
assert.throws(() => normalizeTransaction({ ...zeroAdjustment, transaction_id: 'SYN-ADJ-NONZERO', amount_minor: 1 }), /non-zero adjustment/);

// Month/year boundaries must resolve deterministically from occurred_at.
const monthly = aggregateByMonth(golden);
assert(monthly['2024-12'], 'December boundary bucket missing');
assert(monthly['2025-01'], 'January boundary bucket missing');
Object.values(monthly).forEach((monthReport) => assert.strictEqual(assertFinancialInvariants(monthReport), true));

// Property/invariant layer over a larger deterministic synthetic sample.
const generated = generateSyntheticFinanceFixture({ profile: 'small', seed: 20260808 }).transactions;
const generatedReport = aggregateTransactions(generated);
assert.deepStrictEqual(pickFinancial(generatedReport), independentReference(generated));
assert.strictEqual(assertFinancialInvariants(generatedReport), true);
const generatedMonthly = aggregateByMonth(generated);
Object.values(generatedMonthly).forEach((monthReport) => assert.strictEqual(assertFinancialInvariants(monthReport), true));

// Pending rows are explicit exclusions, never silently included.
const pending = { ...expense, transaction_id: 'SYN-PENDING', status: 'pending' };
const pendingReport = aggregateTransactions([pending]);
assert.strictEqual(pendingReport.included_count, 0);
assert.strictEqual(pendingReport.excluded_status_count, 1);
assert.strictEqual(pendingReport.cash_flow_minor, 0);

// Duplicate canonical transaction identity is a hard reconciliation failure.
assert.throws(() => aggregateTransactions([expense, { ...expense }]), /duplicate transaction_id/);

console.log('financial_reconciliation_contract_test: OK', {
  policyVersion: POLICY_VERSION,
  goldenTransactions: golden.length,
  generatedTransactions: generated.length,
  monthBuckets: Object.keys(generatedMonthly).length,
  invariants: [
    'canonical totals',
    'category partition',
    'transfer neutral',
    'refund explicit',
    'cash-flow identity',
    'minor-unit rounding',
    'month boundary',
    'status exclusion',
    'unique transaction identity'
  ]
});
