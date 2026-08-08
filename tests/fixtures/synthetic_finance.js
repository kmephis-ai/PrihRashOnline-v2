'use strict';

const GENERATOR_VERSION = '1.0.0';
const DEFAULT_SEED = 0x5eed2026;
const PROFILE_SIZES = Object.freeze({
  golden: 12,
  small: 256,
  scale20k: 20000,
  scale50k: 50000
});

function normalizeSeed(seed) {
  const value = Number(seed);
  if (!Number.isFinite(value)) throw new TypeError('seed must be a finite number');
  return (value >>> 0) || 1;
}

function createRng(seed) {
  let state = normalizeSeed(seed);
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}

function isoDayFromIndex(index) {
  const start = Date.UTC(2023, 0, 1);
  const dayMs = 24 * 60 * 60 * 1000;
  return new Date(start + (index % 1096) * dayMs).toISOString().slice(0, 10);
}

function tx(overrides) {
  return Object.assign({
    transaction_id: null,
    occurred_at: '2024-01-15T12:00:00Z',
    type: 'expense',
    amount_minor: 1000,
    currency: 'USD',
    account_id: 'SYN-ACCOUNT-A',
    destination_account_id: null,
    category_id: 'SYN-CATEGORY-A',
    counterparty: null,
    project_id: null,
    tags: [],
    description: 'Synthetic fixture transaction',
    source: 'synthetic-generator',
    source_external_id: null,
    status: 'posted',
    case_kind: 'ordinary',
    schema_version: 1
  }, overrides || {});
}

function goldenTransactions() {
  return [
    tx({ transaction_id: 'SYN-G-001', occurred_at: '2024-01-31T23:59:59Z', type: 'income', amount_minor: 123456, category_id: 'SYN-INCOME-A', source_external_id: 'SYN-SRC-001', case_kind: 'income' }),
    tx({ transaction_id: 'SYN-G-002', occurred_at: '2024-02-01T00:00:00Z', type: 'expense', amount_minor: 23456, category_id: 'SYN-EXPENSE-A', source_external_id: 'SYN-SRC-002', case_kind: 'expense' }),
    tx({ transaction_id: 'SYN-G-003', occurred_at: '2024-02-29T08:15:00Z', type: 'expense', amount_minor: 101, category_id: 'SYN-ROUNDING', source_external_id: 'SYN-SRC-003', case_kind: 'rounding' }),
    tx({ transaction_id: 'SYN-G-004', occurred_at: '2024-02-29T08:16:00Z', type: 'refund', amount_minor: 51, category_id: 'SYN-ROUNDING', source_external_id: 'SYN-SRC-004', case_kind: 'refund' }),
    tx({ transaction_id: 'SYN-G-005', occurred_at: '2024-03-01T00:00:00Z', type: 'transfer', amount_minor: 50000, category_id: 'SYN-TRANSFER', destination_account_id: 'SYN-ACCOUNT-B', source_external_id: 'SYN-SRC-005', case_kind: 'transfer' }),
    tx({ transaction_id: 'SYN-G-006', occurred_at: '2024-06-30T12:00:00Z', type: 'adjustment', amount_minor: 0, category_id: 'SYN-ZERO', source_external_id: 'SYN-SRC-006', case_kind: 'zero' }),
    tx({ transaction_id: 'SYN-G-007', occurred_at: '2024-12-31T23:59:59Z', type: 'expense', amount_minor: 999, category_id: 'SYN-BOUNDARY', source_external_id: 'SYN-SRC-007', case_kind: 'year-boundary' }),
    tx({ transaction_id: 'SYN-G-008', occurred_at: '2025-01-01T00:00:00Z', type: 'income', amount_minor: 7777, category_id: 'SYN-BOUNDARY', source_external_id: 'SYN-SRC-008', case_kind: 'year-boundary' }),
    tx({ transaction_id: 'SYN-G-009', occurred_at: '2025-03-10T10:30:00Z', type: 'expense', amount_minor: 3456, category_id: 'SYN-UNICODE', description: 'Синтетика café 東京 🧾', source_external_id: 'SYN-SRC-009', case_kind: 'unicode' }),
    tx({ transaction_id: 'SYN-G-010', occurred_at: '2025-04-11T09:00:00Z', type: 'expense', amount_minor: 2222, category_id: 'SYN-OPTIONAL', counterparty: null, project_id: null, tags: [], description: null, source_external_id: 'SYN-SRC-010', case_kind: 'missing-optional' }),
    tx({ transaction_id: 'SYN-G-011-A', occurred_at: '2025-05-12T09:00:00Z', type: 'expense', amount_minor: 4242, category_id: 'SYN-DUPLICATE', source_external_id: 'SYN-DUP-001', case_kind: 'duplicate' }),
    tx({ transaction_id: 'SYN-G-011-B', occurred_at: '2025-05-12T09:00:00Z', type: 'expense', amount_minor: 4242, category_id: 'SYN-DUPLICATE', source_external_id: 'SYN-DUP-001', case_kind: 'duplicate' })
  ];
}

function generatedTransaction(index, rng) {
  const types = ['income', 'expense', 'expense', 'expense', 'transfer', 'refund'];
  const type = types[Math.floor(rng() * types.length)];
  const amountMinor = Math.floor(rng() * 400000) + 1;
  const occurredDay = isoDayFromIndex(index * 17 + Math.floor(rng() * 31));
  const accountIndex = 1 + Math.floor(rng() * 4);
  const categoryIndex = 1 + Math.floor(rng() * 12);
  return tx({
    transaction_id: `SYN-R-${pad(index + 1, 6)}`,
    occurred_at: `${occurredDay}T${pad(Math.floor(rng() * 24), 2)}:${pad(Math.floor(rng() * 60), 2)}:00Z`,
    type,
    amount_minor: amountMinor,
    account_id: `SYN-ACCOUNT-${accountIndex}`,
    destination_account_id: type === 'transfer' ? `SYN-ACCOUNT-${1 + (accountIndex % 4)}` : null,
    category_id: type === 'transfer' ? 'SYN-TRANSFER' : `SYN-CATEGORY-${pad(categoryIndex, 2)}`,
    counterparty: rng() < 0.35 ? null : `Synthetic Counterparty ${1 + Math.floor(rng() * 30)}`,
    project_id: rng() < 0.8 ? null : `SYN-PROJECT-${1 + Math.floor(rng() * 5)}`,
    tags: rng() < 0.7 ? [] : [`syn-tag-${1 + Math.floor(rng() * 6)}`],
    description: `Synthetic generated transaction ${index + 1}`,
    source_external_id: `SYN-RSRC-${pad(index + 1, 6)}`,
    case_kind: 'generated'
  });
}

function referenceAggregate(transactions) {
  const result = {
    transaction_count: 0,
    income_minor: 0,
    expense_minor: 0,
    refund_minor: 0,
    transfer_minor: 0,
    cash_flow_minor: 0,
    zero_amount_count: 0,
    duplicate_source_external_id_count: 0,
    by_type: {}
  };
  const seen = new Set();
  transactions.forEach((item) => {
    result.transaction_count += 1;
    result.by_type[item.type] = (result.by_type[item.type] || 0) + 1;
    if (item.amount_minor === 0) result.zero_amount_count += 1;
    if (item.source_external_id) {
      if (seen.has(item.source_external_id)) result.duplicate_source_external_id_count += 1;
      seen.add(item.source_external_id);
    }
    if (item.type === 'income') {
      result.income_minor += item.amount_minor;
      result.cash_flow_minor += item.amount_minor;
    } else if (item.type === 'expense') {
      result.expense_minor += item.amount_minor;
      result.cash_flow_minor -= item.amount_minor;
    } else if (item.type === 'refund') {
      result.refund_minor += item.amount_minor;
      result.cash_flow_minor += item.amount_minor;
    } else if (item.type === 'transfer') {
      result.transfer_minor += item.amount_minor;
    }
  });
  return result;
}

function generateSyntheticFinanceFixture(options) {
  const opts = options || {};
  const seed = normalizeSeed(opts.seed == null ? DEFAULT_SEED : opts.seed);
  const profile = opts.profile || 'golden';
  const profileSize = PROFILE_SIZES[profile];
  if (!profileSize) throw new Error(`unknown synthetic fixture profile: ${profile}`);
  const golden = goldenTransactions();
  const requestedCount = opts.count == null ? profileSize : Number(opts.count);
  if (!Number.isInteger(requestedCount) || requestedCount < golden.length) {
    throw new Error(`count must be an integer >= ${golden.length}`);
  }

  const transactions = golden.slice();
  const rng = createRng(seed);
  while (transactions.length < requestedCount) {
    transactions.push(generatedTransaction(transactions.length - golden.length, rng));
  }

  return {
    metadata: {
      synthetic: true,
      privacy_class: 'PUBLIC_SYNTHETIC',
      provenance: 'independent-deterministic-generator',
      generator_version: GENERATOR_VERSION,
      seed,
      profile,
      transaction_count: transactions.length,
      note: 'Fictional dataset. Not sampled, scaled, seasonally fitted, or derived from DEV/production finance data.'
    },
    transactions,
    expected: referenceAggregate(transactions)
  };
}

module.exports = {
  DEFAULT_SEED,
  GENERATOR_VERSION,
  PROFILE_SIZES,
  createRng,
  generateSyntheticFinanceFixture,
  goldenTransactions,
  referenceAggregate
};
