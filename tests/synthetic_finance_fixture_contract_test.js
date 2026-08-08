'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_SEED,
  PROFILE_SIZES,
  generateSyntheticFinanceFixture
} = require('./fixtures/synthetic_finance');

function independentExpected(transactions) {
  const totals = {
    transaction_count: transactions.length,
    income_minor: 0,
    expense_minor: 0,
    refund_minor: 0,
    transfer_minor: 0,
    cash_flow_minor: 0,
    zero_amount_count: 0,
    duplicate_source_external_id_count: 0,
    by_type: {}
  };
  const sourceIds = new Set();
  for (const item of transactions) {
    totals.by_type[item.type] = (totals.by_type[item.type] || 0) + 1;
    if (item.amount_minor === 0) totals.zero_amount_count += 1;
    if (item.source_external_id) {
      if (sourceIds.has(item.source_external_id)) totals.duplicate_source_external_id_count += 1;
      sourceIds.add(item.source_external_id);
    }
    switch (item.type) {
      case 'income': totals.income_minor += item.amount_minor; totals.cash_flow_minor += item.amount_minor; break;
      case 'expense': totals.expense_minor += item.amount_minor; totals.cash_flow_minor -= item.amount_minor; break;
      case 'refund': totals.refund_minor += item.amount_minor; totals.cash_flow_minor += item.amount_minor; break;
      case 'transfer': totals.transfer_minor += item.amount_minor; break;
      default: break;
    }
  }
  return totals;
}

const first = generateSyntheticFinanceFixture({ seed: DEFAULT_SEED, profile: 'golden' });
const second = generateSyntheticFinanceFixture({ seed: DEFAULT_SEED, profile: 'golden' });
assert.deepStrictEqual(second, first, 'same fixed seed must produce identical fixture objects');
assert.strictEqual(JSON.stringify(second), JSON.stringify(first), 'same fixed seed must produce byte-stable JSON serialization');

const differentSeed = generateSyntheticFinanceFixture({ seed: DEFAULT_SEED + 1, profile: 'small' });
const originalSmall = generateSyntheticFinanceFixture({ seed: DEFAULT_SEED, profile: 'small' });
assert.notStrictEqual(JSON.stringify(differentSeed.transactions), JSON.stringify(originalSmall.transactions), 'different seeds must change generated transactions');

assert.strictEqual(first.metadata.synthetic, true);
assert.strictEqual(first.metadata.privacy_class, 'PUBLIC_SYNTHETIC');
assert.strictEqual(first.metadata.provenance, 'independent-deterministic-generator');
assert(first.metadata.note.includes('Not sampled'), 'metadata must explicitly reject DEV/production derivation');
assert.strictEqual(first.transactions.length, PROFILE_SIZES.golden);
assert.strictEqual(PROFILE_SIZES.scale20k, 20000);
assert.strictEqual(PROFILE_SIZES.scale50k, 50000);

const requiredCases = new Set(['income','expense','transfer','refund','zero','rounding','year-boundary','unicode','missing-optional','duplicate']);
const actualCases = new Set(first.transactions.map((item) => item.case_kind));
for (const required of requiredCases) assert(actualCases.has(required), `missing required edge case: ${required}`);
assert(first.transactions.some((item) => item.occurred_at.startsWith('2024-02-29')), 'leap-day fixture is required');
assert(first.transactions.every((item) => Number.isInteger(item.amount_minor)), 'money truth must use integer minor units');
assert(first.transactions.every((item) => item.transaction_id && item.transaction_id.startsWith('SYN-')), 'all fixture ids must be visibly synthetic');
assert(first.transactions.some((item) => item.description === null), 'missing optional field case is required');
assert(first.transactions.some((item) => /東京|🧾/.test(item.description || '')), 'unicode case is required');

assert.deepStrictEqual(first.expected, independentExpected(first.transactions), 'expected results must match an independent reference calculation');
assert.strictEqual(first.expected.transfer_minor > 0, true, 'transfer case must be represented');
assert.strictEqual(first.expected.duplicate_source_external_id_count, 1, 'golden set must contain exactly one duplicate source identity collision');

const scaleSample = generateSyntheticFinanceFixture({ seed: 20260808, profile: 'scale20k', count: 2000 });
assert.strictEqual(scaleSample.transactions.length, 2000, 'large profile must support bounded CI sampling');
assert.deepStrictEqual(scaleSample.expected, independentExpected(scaleSample.transactions));

const moduleSource = fs.readFileSync(path.join(__dirname, 'fixtures', 'synthetic_finance.js'), 'utf8');
[
  'OP-F11-',
  'Ответы на форму (11)',
  'real DEV analytics',
  'real DEV data'
].forEach((forbidden) => assert(!moduleSource.includes(forbidden), `synthetic generator contains forbidden production provenance marker: ${forbidden}`));

console.log('synthetic_finance_fixture_contract_test: OK', {
  seed: first.metadata.seed,
  goldenTransactions: first.transactions.length,
  sampledScaleTransactions: scaleSample.transactions.length,
  cases: Array.from(actualCases).sort()
});
