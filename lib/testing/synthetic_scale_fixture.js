'use strict';

const crypto = require('crypto');
const { normalizeCanonicalTransaction } = require('../domain/canonical_transaction');

const FIXTURE_SCHEMA = 'PRH_SYNTHETIC_SCALE_FIXTURE_V1';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function lcg(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function occurredAt(index) {
  const monthIndex = index % 48;
  const year = 2023 + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const day = (index % 27) + 1;
  const hour = index % 24;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`;
}

function generateSyntheticScaleTransactions(count, seed = 14014) {
  if (!Number.isInteger(count) || count < 1 || count > 100000) throw new Error('SYNTHETIC_SCALE_COUNT_INVALID');
  if (!Number.isInteger(seed)) throw new Error('SYNTHETIC_SCALE_SEED_INVALID');
  const random = lcg(seed);
  const result = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const id = `SCALE-${String(i + 1).padStart(6, '0')}`;
    const selector = i % 23;
    let type = 'expense';
    if (selector < 4) type = 'income';
    else if (selector === 20) type = 'refund';
    else if (selector === 21 || selector === 22) type = 'transfer';
    const statusSelector = i % 31;
    const status = statusSelector === 29 ? 'pending' : statusSelector === 30 ? 'void' : 'posted';
    const amount = 100 + Math.floor(random() * 990000);
    const accountIndex = i % 8;
    const accountId = `ACC-SYN-${accountIndex + 1}`;
    const destinationAccountId = type === 'transfer' ? `ACC-SYN-${((accountIndex + 1) % 8) + 1}` : null;
    const categoryId = type === 'income'
      ? `CAT-INCOME-${(i % 6) + 1}`
      : type === 'transfer'
        ? 'CAT-TRANSFER'
        : `CAT-EXPENSE-${(i % 24) + 1}`;
    const transaction = {
      schema: 'PRH_CANONICAL_TRANSACTION_V1',
      schema_version: 1,
      transaction_id: id,
      occurred_at: occurredAt(i),
      type,
      status,
      amount_minor: amount,
      currency: 'RUB',
      account_id: accountId,
      destination_account_id: destinationAccountId,
      category_id: categoryId,
      member_id: `MEMBER-${(i % 4) + 1}`,
      project_id: i % 7 === 0 ? `PROJECT-${(i % 5) + 1}` : null,
      tags: [`tag-${i % 12}`, `scale-${i % 3}`].sort(),
      counterparty: null,
      description: null,
      reverses_transaction_id: null,
      adjustment_semantics: type === 'refund' ? 'expense_reduction' : null,
      provenance: {
        source_system: 'SYNTHETIC',
        source_container: 'perf014-scale-generator',
        source_record_id: id,
        source_fingerprint: sha256(`${FIXTURE_SCHEMA}:${seed}:${i}:${type}:${status}:${amount}`),
        identity_strategy: 'EXTERNAL_ID',
        transform_version: FIXTURE_SCHEMA,
        source_position: null
      }
    };
    result[i] = normalizeCanonicalTransaction(transaction);
  }
  return result;
}

function mutateSyntheticScaleTransactions(transactions, deltaCount, seed = 24014) {
  if (!Array.isArray(transactions) || !Number.isInteger(deltaCount) || deltaCount < 1 || deltaCount > transactions.length) {
    throw new Error('SYNTHETIC_SCALE_DELTA_INVALID');
  }
  const next = transactions.slice();
  for (let i = 0; i < deltaCount; i += 1) {
    const current = next[i];
    const categoryId = current.type === 'income'
      ? `CAT-INCOME-DELTA-${(i % 3) + 1}`
      : current.type === 'transfer'
        ? 'CAT-TRANSFER-DELTA'
        : `CAT-EXPENSE-DELTA-${(i % 5) + 1}`;
    next[i] = normalizeCanonicalTransaction({
      ...current,
      category_id: categoryId,
      account_id: `ACC-SYN-${((i + 3) % 8) + 1}`,
      amount_minor: current.amount_minor + 1,
      provenance: {
        ...current.provenance,
        source_fingerprint: sha256(`${FIXTURE_SCHEMA}:delta:${seed}:${i}:${current.transaction_id}`)
      }
    });
  }
  return next;
}

module.exports = {
  FIXTURE_SCHEMA,
  generateSyntheticScaleTransactions,
  mutateSyntheticScaleTransactions
};
