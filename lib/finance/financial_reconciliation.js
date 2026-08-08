'use strict';

const POLICY_VERSION = 'FIN-TRUTH-v1';
const INCLUDED_STATUS = 'posted';
const TYPES = Object.freeze(['income', 'expense', 'transfer', 'refund', 'adjustment']);

function asMinorUnits(value, fieldName = 'amount_minor') {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be integer minor units`);
  }
  if (value < 0) {
    throw new Error(`${fieldName} must be non-negative`);
  }
  return value;
}

function monthKey(occurredAt) {
  const value = String(occurredAt || '');
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  if (!match) throw new Error('occurred_at must start with ISO YYYY-MM-DD');
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error('occurred_at has invalid calendar components');
  }
  return `${match[1]}-${match[2]}`;
}

function normalizeTransaction(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('transaction must be an object');
  }
  const type = String(input.type || '');
  if (!TYPES.includes(type)) throw new Error(`unsupported transaction type: ${type}`);
  const status = String(input.status || INCLUDED_STATUS);
  const amountMinor = asMinorUnits(input.amount_minor);
  const categoryId = String(input.category_id || 'UNCLASSIFIED');
  const transactionId = String(input.transaction_id || '');
  if (!transactionId) throw new Error('transaction_id is required');
  const period = monthKey(input.occurred_at);

  if (type === 'transfer') {
    if (!input.account_id || !input.destination_account_id) {
      throw new Error('transfer requires source and destination accounts');
    }
    if (String(input.account_id) === String(input.destination_account_id)) {
      throw new Error('transfer source and destination must differ');
    }
  }
  if (type === 'refund') {
    const linked = String(input.reverses_transaction_id || '').trim();
    const explicitAdjustment = input.adjustment_semantics === 'expense_reduction';
    if (!linked && !explicitAdjustment) {
      throw new Error('refund requires reverses_transaction_id or expense_reduction adjustment semantics');
    }
  }
  if (type === 'adjustment' && amountMinor !== 0) {
    throw new Error('non-zero adjustment requires a later versioned semantic policy');
  }

  return {
    transaction_id: transactionId,
    occurred_at: String(input.occurred_at),
    month_key: period,
    type,
    status,
    amount_minor: amountMinor,
    currency: String(input.currency || ''),
    account_id: input.account_id == null ? null : String(input.account_id),
    destination_account_id: input.destination_account_id == null ? null : String(input.destination_account_id),
    category_id: categoryId,
    reverses_transaction_id: input.reverses_transaction_id == null ? null : String(input.reverses_transaction_id),
    adjustment_semantics: input.adjustment_semantics == null ? null : String(input.adjustment_semantics)
  };
}

function addBucket(map, key, delta) {
  map[key] = (map[key] || 0) + delta;
}

function sumBuckets(map) {
  return Object.values(map).reduce((sum, value) => sum + value, 0);
}

function aggregateTransactions(inputs) {
  if (!Array.isArray(inputs)) throw new Error('transactions must be an array');
  const report = {
    policy_version: POLICY_VERSION,
    included_status: INCLUDED_STATUS,
    transaction_count: inputs.length,
    included_count: 0,
    excluded_status_count: 0,
    income_minor: 0,
    gross_expense_minor: 0,
    refund_minor: 0,
    external_expense_minor: 0,
    cash_flow_minor: 0,
    transfer_minor: 0,
    zero_amount_count: 0,
    by_income_category_minor: {},
    by_expense_category_minor: {},
    by_type_count: {}
  };

  const seenIds = new Set();
  inputs.forEach((raw) => {
    const tx = normalizeTransaction(raw);
    if (seenIds.has(tx.transaction_id)) throw new Error(`duplicate transaction_id: ${tx.transaction_id}`);
    seenIds.add(tx.transaction_id);
    report.by_type_count[tx.type] = (report.by_type_count[tx.type] || 0) + 1;
    if (tx.status !== INCLUDED_STATUS) {
      report.excluded_status_count += 1;
      return;
    }
    report.included_count += 1;
    if (tx.amount_minor === 0) report.zero_amount_count += 1;

    switch (tx.type) {
      case 'income':
        report.income_minor += tx.amount_minor;
        addBucket(report.by_income_category_minor, tx.category_id, tx.amount_minor);
        break;
      case 'expense':
        report.gross_expense_minor += tx.amount_minor;
        addBucket(report.by_expense_category_minor, tx.category_id, tx.amount_minor);
        break;
      case 'refund':
        report.refund_minor += tx.amount_minor;
        addBucket(report.by_expense_category_minor, tx.category_id, -tx.amount_minor);
        break;
      case 'transfer':
        report.transfer_minor += tx.amount_minor;
        break;
      case 'adjustment':
        break;
      default:
        throw new Error(`unreachable transaction type: ${tx.type}`);
    }
  });

  report.external_expense_minor = report.gross_expense_minor - report.refund_minor;
  report.cash_flow_minor = report.income_minor - report.external_expense_minor;

  if (sumBuckets(report.by_income_category_minor) !== report.income_minor) {
    throw new Error('income category partition invariant failed');
  }
  if (sumBuckets(report.by_expense_category_minor) !== report.external_expense_minor) {
    throw new Error('expense category partition invariant failed');
  }
  return report;
}

function aggregateByMonth(inputs) {
  if (!Array.isArray(inputs)) throw new Error('transactions must be an array');
  const groups = new Map();
  inputs.forEach((raw) => {
    const tx = normalizeTransaction(raw);
    if (!groups.has(tx.month_key)) groups.set(tx.month_key, []);
    groups.get(tx.month_key).push(raw);
  });
  const result = {};
  Array.from(groups.keys()).sort().forEach((key) => {
    result[key] = aggregateTransactions(groups.get(key));
  });
  return result;
}

function assertFinancialInvariants(report) {
  if (!report || report.policy_version !== POLICY_VERSION) throw new Error('unexpected policy version');
  if (sumBuckets(report.by_income_category_minor) !== report.income_minor) throw new Error('income partition mismatch');
  if (sumBuckets(report.by_expense_category_minor) !== report.external_expense_minor) throw new Error('expense partition mismatch');
  if (report.external_expense_minor !== report.gross_expense_minor - report.refund_minor) throw new Error('refund invariant failed');
  if (report.cash_flow_minor !== report.income_minor - report.external_expense_minor) throw new Error('cash-flow invariant failed');
  return true;
}

module.exports = {
  POLICY_VERSION,
  INCLUDED_STATUS,
  TYPES,
  asMinorUnits,
  monthKey,
  normalizeTransaction,
  aggregateTransactions,
  aggregateByMonth,
  assertFinancialInvariants,
  sumBuckets
};
