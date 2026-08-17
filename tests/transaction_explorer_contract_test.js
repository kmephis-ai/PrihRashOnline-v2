'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');
const {
  CONTRACT,
  QUERY_SCHEMA,
  ROW_SCHEMA,
  EDIT_SCHEMA,
  RESULT_SCHEMA,
  normalizeQuery,
  exploreTransactions,
  buildEditDraft,
  requestRuntimeSave
} = require('../lib/explorer/transaction_explorer');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function syntheticTx(index, overrides = {}) {
  const base = new Date(Date.UTC(2020, 0, 1));
  base.setUTCDate(base.getUTCDate() + (index % 2400));
  const occurred = base.toISOString().replace('.000Z', 'Z');
  const type = index % 4 === 0 ? 'income' : 'expense';
  const id = `SYN-TX-${String(index).padStart(6, '0')}`;
  return normalizeCanonicalTransaction({
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: id,
    occurred_at: occurred,
    type,
    status: index % 17 === 0 ? 'pending' : 'posted',
    amount_minor: 100 + (index % 25000),
    currency: 'USD',
    account_id: `SYN-ACCOUNT-${index % 8}`,
    destination_account_id: null,
    category_id: type === 'income' ? `SYN-INCOME-${index % 5}` : `SYN-EXPENSE-${index % 12}`,
    member_id: index % 3 === 0 ? null : `SYN-MEMBER-${index % 4}`,
    project_id: index % 7 === 0 ? 'SYN-PROJECT-HOME' : null,
    tags: index % 10 === 0 ? ['synthetic', 'recurring'] : ['synthetic'],
    counterparty: `Synthetic Counterparty ${index % 23}`,
    description: `Synthetic transaction ${index} family test`,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC',
      source_container: 'fixture:transaction_explorer',
      source_record_id: `synthetic-record-${index}`,
      source_fingerprint: sha256(`transaction-explorer:${index}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYNTHETIC-TX-020-v1',
      source_position: null
    },
    ...overrides
  });
}

assert.strictEqual(CONTRACT.schema, 'PRH_TRANSACTION_EXPLORER_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.canonical_source, 'PRH_CANONICAL_TRANSACTION_V1');
assert.strictEqual(CONTRACT.authority.financial_truth, false);
assert.strictEqual(CONTRACT.authority.financial_calculation, false);
assert.strictEqual(CONTRACT.authority.storage, false);
assert.strictEqual(CONTRACT.authority.network, false);
assert.strictEqual(CONTRACT.authority.financial_write, false);
assert.strictEqual(CONTRACT.edit.runtime_write_reason, 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED');
assert.strictEqual(CONTRACT.privacy.public_finance_data, 'INDEPENDENTLY_GENERATED_SYNTHETIC_ONLY');
assert.strictEqual(CONTRACT.cost.mode, 'FREE_ONLY');
assert.strictEqual(CONTRACT.cost.external_provider_required, false);

const queryA = normalizeQuery({
  category_ids: ['SYN-EXPENSE-2', 'SYN-EXPENSE-1'],
  account_ids: ['SYN-ACCOUNT-3', 'SYN-ACCOUNT-1'],
  text: ' FAMILY ',
  sort: { field: 'amount_minor', direction: 'asc' },
  limit: 20,
  offset: 5
});
const queryB = normalizeQuery({
  account_ids: ['SYN-ACCOUNT-1', 'SYN-ACCOUNT-3'],
  category_ids: ['SYN-EXPENSE-1', 'SYN-EXPENSE-2'],
  text: 'family',
  sort: { direction: 'ASC', field: 'amount_minor' },
  offset: 5,
  limit: 20
});
assert.strictEqual(queryA.schema, QUERY_SCHEMA);
assert.strictEqual(queryA.query_hash, queryB.query_hash);
assert.deepStrictEqual(queryA.account_ids, queryB.account_ids);
assert.deepStrictEqual(queryA.category_ids, queryB.category_ids);
assert.throws(() => normalizeQuery({ mystery: true }), /TX_EXPLORER_QUERY_FIELD_UNKNOWN/);
assert.throws(() => normalizeQuery({ date_from: '2026-03-01', date_to: '2026-03-01' }), /TX_EXPLORER_DATE_RANGE_INVALID/);
assert.throws(() => normalizeQuery({ sort: { field: 'provenance', direction: 'ASC' } }), /TX_EXPLORER_SORT_FIELD_INVALID/);
assert.throws(() => normalizeQuery({ limit: 201 }), /TX_EXPLORER_LIMIT_INVALID/);
assert.throws(() => normalizeQuery({ text: 'x'.repeat(121) }), /TX_EXPLORER_TEXT_TOO_LONG/);

const small = Array.from({ length: 240 }, (_, index) => syntheticTx(index));
const filtered = exploreTransactions(small, {
  date_from: '2020-01-01',
  date_to: '2021-01-01',
  account_ids: ['SYN-ACCOUNT-1'],
  category_ids: ['SYN-EXPENSE-1', 'SYN-EXPENSE-5', 'SYN-EXPENSE-9'],
  member_ids: ['SYN-MEMBER-1'],
  types: ['expense'],
  statuses: ['posted'],
  text: 'synthetic transaction',
  sort: { field: 'occurred_at', direction: 'ASC' },
  limit: 25
});
assert.strictEqual(filtered.schema, RESULT_SCHEMA);
assert(filtered.rows.length > 0);
assert(filtered.rows.length <= 25);
filtered.rows.forEach((row) => {
  assert.strictEqual(row.schema, ROW_SCHEMA);
  assert.strictEqual(row.type, 'expense');
  assert.strictEqual(row.status, 'posted');
  assert.strictEqual(row.account_id, 'SYN-ACCOUNT-1');
  assert.strictEqual(row.member_id, 'SYN-MEMBER-1');
  assert(['SYN-EXPENSE-1', 'SYN-EXPENSE-5', 'SYN-EXPENSE-9'].includes(row.category_id));
});
assert.strictEqual(filtered.telemetry.financial_payload, false);
assert(!Object.prototype.hasOwnProperty.call(filtered.telemetry, 'amount_minor'));
assert(!Object.prototype.hasOwnProperty.call(filtered.telemetry, 'transaction_id'));
assert.strictEqual(filtered.query.query_hash.length, 64);

// Stable tie-breaker is transaction_id even when primary sort values are equal.
const tieA = syntheticTx(9001, { transaction_id: 'SYN-TIE-B', amount_minor: 500 });
const tieB = syntheticTx(9002, { transaction_id: 'SYN-TIE-A', amount_minor: 500 });
const tieResult = exploreTransactions([tieA, tieB], { sort: { field: 'amount_minor', direction: 'DESC' } });
assert.deepStrictEqual(tieResult.rows.map((row) => row.transaction_id), ['SYN-TIE-A', 'SYN-TIE-B']);

const original = small[5];
const validDraft = buildEditDraft(original, {
  description: 'Synthetic edited description',
  amount_minor: original.amount_minor + 100
});
assert.strictEqual(validDraft.schema, EDIT_SCHEMA);
assert.strictEqual(validDraft.state, 'VALID');
assert.strictEqual(validDraft.candidate.transaction_id, original.transaction_id);
assert.deepStrictEqual(validDraft.candidate.provenance, original.provenance);
assert.strictEqual(validDraft.financial_write_authorized, false);

const invalidDraft = buildEditDraft(original, { amount_minor: -1 });
assert.strictEqual(invalidDraft.state, 'INVALID');
assert.strictEqual(invalidDraft.reason_code, 'CANONICAL_AMOUNT_MINOR_INVALID');
assert.strictEqual(invalidDraft.candidate, null);
assert.throws(() => buildEditDraft(original, { transaction_id: 'SYN-ILLEGAL' }), /TX_EDIT_IMMUTABLE_FIELD/);
assert.throws(() => buildEditDraft(original, { provenance: original.provenance }), /TX_EDIT_IMMUTABLE_FIELD/);

const blockedSave = requestRuntimeSave(validDraft);
assert.strictEqual(blockedSave.state, 'WRITE_BLOCKED');
assert.strictEqual(blockedSave.reason_code, 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED');
assert.strictEqual(blockedSave.financial_write_authorized, false);
assert.deepStrictEqual(blockedSave.required_policy_evidence, ['idempotency', 'preconditions', 'backup', 'readback', 'reconciliation', 'rollback']);
assert.throws(() => requestRuntimeSave(invalidDraft), /TX_EDIT_DRAFT_NOT_VALID/);

function scaleProfile(count, maxElapsedMs) {
  const records = Array.from({ length: count }, (_, index) => syntheticTx(index + 100000));
  const started = Date.now();
  const result = exploreTransactions(records, {
    account_ids: ['SYN-ACCOUNT-3'],
    statuses: ['posted'],
    text: 'family',
    sort: { field: 'occurred_at', direction: 'DESC' },
    offset: 100,
    limit: 100
  });
  const elapsed = Date.now() - started;
  assert(result.matched_count > result.page_count);
  assert.strictEqual(result.page_count, 100);
  assert.strictEqual(result.rows.length, 100);
  assert(elapsed <= maxElapsedMs, `TX_EXPLORER_SCALE_${count}_REGRESSION ${elapsed}ms > ${maxElapsedMs}ms`);
  return { operations: count, elapsed_ms: elapsed, matched_count: result.matched_count, page_count: result.page_count };
}

const scale20k = scaleProfile(20000, 5000);
const scale50k = scaleProfile(50000, 10000);

console.log('transaction_explorer_contract_test: OK', {
  contract: `${CONTRACT.schema}@${CONTRACT.version}`,
  canonicalProjection: true,
  deterministicQueryIdentity: true,
  stableSortTieBreaker: CONTRACT.query.stable_tie_breaker,
  maxPage: CONTRACT.query.page.max_limit,
  editDraftValidation: CONTRACT.edit.validator,
  genericWriteAuthorized: false,
  writeBlockReason: CONTRACT.edit.runtime_write_reason,
  publicFinanceData: CONTRACT.privacy.public_finance_data,
  scale: [scale20k, scale50k],
  freeOnly: true
});
