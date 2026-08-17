'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  CONTRACT,
  OBSERVATION_SCHEMA,
  RESULT_SCHEMA,
  TELEMETRY_SCHEMA,
  assertContract,
  normalizeObservation,
  accountDelta,
  reconcileBalance,
  serializeObservation,
  serializeReconciliation,
  reconciliationTelemetry
} = require('../lib/balance/balance_reconciliation');
const { SCHEMA_ID: CANONICAL_SCHEMA_ID } = require('../lib/domain/canonical_transaction');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function observation(id, balanceMinor, overrides = {}) {
  return {
    schema: OBSERVATION_SCHEMA,
    version: '1.0.0',
    observation_id: id,
    account_id: 'acc-main',
    currency: 'RUB',
    observed_at: id === 'obs-anchor' ? '2026-01-01T00:00:00Z' : '2026-02-01T00:00:00Z',
    balance_minor: balanceMinor,
    provenance: {
      source_system: 'SYNTHETIC_TEST',
      source_record_id: `record:${id}`,
      source_fingerprint: sha256(`balance:${id}:${balanceMinor}`),
      capture_method: 'SYNTHETIC_TEST',
      transform_version: 'SYN-BAL-030-v1'
    },
    ...overrides
  };
}

function tx(id, type, amountMinor, occurredAt, overrides = {}) {
  const account = overrides.account_id || 'acc-main';
  const destination = type === 'transfer' ? (overrides.destination_account_id || 'acc-second') : null;
  return {
    schema: CANONICAL_SCHEMA_ID,
    schema_version: 1,
    transaction_id: id,
    occurred_at: occurredAt,
    type,
    status: overrides.status || 'posted',
    amount_minor: amountMinor,
    currency: overrides.currency || 'RUB',
    account_id: account,
    destination_account_id: destination,
    category_id: overrides.category_id || `cat-${type}`,
    member_id: null,
    project_id: null,
    tags: ['synthetic'],
    counterparty: null,
    description: `Synthetic BAL transaction ${id}`,
    reverses_transaction_id: type === 'refund' ? `ref-${id}` : null,
    adjustment_semantics: type === 'refund' ? 'expense_reduction' : null,
    provenance: {
      source_system: 'SYNTHETIC_TEST',
      source_container: 'fixture:balance_reconciliation',
      source_record_id: `record:${id}`,
      source_fingerprint: sha256(`canonical:${id}:${type}:${amountMinor}:${occurredAt}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYN-BAL-030-v1',
      source_position: null
    }
  };
}

assert.strictEqual(assertContract(), true);
assert.strictEqual(CONTRACT.schema, 'PRH_BALANCE_RECONCILIATION_V1');
assert.strictEqual(CONTRACT.version, '1.0.0');
assert.strictEqual(CONTRACT.absolute_balance_policy.anchor_observation_required, true);
assert.strictEqual(CONTRACT.absolute_balance_policy.zero_origin_assumed, false);
assert.strictEqual(CONTRACT.reconciliation.mismatch_formula, 'OBSERVED_MINUS_CALCULATED');
assert.strictEqual(CONTRACT.free_only, true);
assert(Object.values(CONTRACT.authorities).every((value) => value === false));

const anchor = observation('obs-anchor', 10000);
const targetMatch = observation('obs-target', 13200);
const fixture = [
  tx('tx-income', 'income', 5000, '2026-01-05T10:00:00Z'),
  tx('tx-expense', 'expense', 2000, '2026-01-06T10:00:00Z'),
  tx('tx-refund', 'refund', 500, '2026-01-07T10:00:00Z'),
  tx('tx-transfer-out', 'transfer', 1000, '2026-01-08T10:00:00Z', { destination_account_id: 'acc-second' }),
  tx('tx-transfer-in', 'transfer', 700, '2026-01-09T10:00:00Z', { account_id: 'acc-other', destination_account_id: 'acc-main' }),
  tx('tx-pending', 'expense', 9000, '2026-01-10T10:00:00Z', { status: 'pending' }),
  tx('tx-adjustment', 'adjustment', 0, '2026-01-11T10:00:00Z'),
  tx('tx-anchor-boundary', 'income', 999, '2026-01-01T00:00:00Z'),
  tx('tx-after-target', 'income', 999, '2026-02-01T00:00:01Z'),
  tx('tx-other-account', 'expense', 111, '2026-01-12T10:00:00Z', { account_id: 'acc-other' })
];

const fixtureBefore = JSON.stringify(fixture);
const anchorBefore = JSON.stringify(anchor);
const targetBefore = JSON.stringify(targetMatch);
const match = reconcileBalance({ anchor, target: targetMatch, transactions: fixture });
assert.strictEqual(match.schema, RESULT_SCHEMA);
assert.strictEqual(match.canonical_delta_minor, 3200);
assert.strictEqual(match.calculated_balance_minor, 13200);
assert.strictEqual(match.observed_balance_minor, 13200);
assert.strictEqual(match.mismatch_minor, 0);
assert.strictEqual(match.state, 'MATCH');
assert.strictEqual(match.transaction_count, fixture.length);
assert.strictEqual(match.included_transaction_count, 6);
assert.strictEqual(match.proposal.kind, 'NO_ACTION');
assert.strictEqual(match.proposal.mutation_authorized, false);
assert.strictEqual(match.proposal.financial_write, false);
assert.strictEqual(match.provenance.zero_origin_assumed, false);
assert.strictEqual(match.provenance.interval, 'ANCHOR_EXCLUSIVE_TARGET_INCLUSIVE');
assert.strictEqual(JSON.stringify(fixture), fixtureBefore);
assert.strictEqual(JSON.stringify(anchor), anchorBefore);
assert.strictEqual(JSON.stringify(targetMatch), targetBefore);
assert(Object.isFrozen(match));
assert(Object.isFrozen(match.anchor_observation));
assert(Object.isFrozen(match.proposal));

const mismatchTarget = observation('obs-target-mismatch', 13000);
const mismatch = reconcileBalance({ anchor, target: mismatchTarget, transactions: fixture });
assert.strictEqual(mismatch.state, 'MISMATCH');
assert.strictEqual(mismatch.calculated_balance_minor, 13200);
assert.strictEqual(mismatch.mismatch_minor, -200);
assert.strictEqual(mismatch.proposal.kind, 'REVIEW_CANONICAL_OR_OBSERVATION');
assert.strictEqual(mismatch.proposal.reason_code, 'OBSERVED_DIFFERS_FROM_CALCULATED');
assert.strictEqual(mismatch.proposal.canonical_mutation, false);
assert.strictEqual(mismatch.proposal.observation_mutation, false);

// Account semantics: transfer is household-neutral but balance-moving for source/destination accounts.
const transfer = fixture.find((item) => item.transaction_id === 'tx-transfer-out');
assert.deepStrictEqual(accountDelta(transfer, 'acc-main', 'RUB'), { included: true, delta_minor: -1000 });
assert.deepStrictEqual(accountDelta(transfer, 'acc-second', 'RUB'), { included: true, delta_minor: 1000 });
assert.deepStrictEqual(accountDelta(fixture.find((item) => item.transaction_id === 'tx-pending'), 'acc-main', 'RUB'), { included: false, delta_minor: 0 });

// Determinism/idempotency: input ordering cannot change reconciliation identity or result.
const reversed = reconcileBalance({ anchor, target: targetMatch, transactions: fixture.slice().reverse() });
assert.strictEqual(reversed.reconciliation_id, match.reconciliation_id);
assert.strictEqual(serializeReconciliation(reversed), serializeReconciliation(match));
assert.strictEqual(serializeObservation(anchor), serializeObservation({ ...anchor }));
assert(/^balrec-[0-9a-f]{48}$/.test(match.reconciliation_id));

// Signed balances remain valid; zero-origin is never inferred.
const debtAnchor = observation('obs-debt-anchor', -1000, { observed_at: '2026-03-01T00:00:00Z' });
const debtTarget = observation('obs-debt-target', -500, { observed_at: '2026-04-01T00:00:00Z' });
const debt = reconcileBalance({
  anchor: debtAnchor,
  target: debtTarget,
  transactions: [tx('tx-debt-income', 'income', 500, '2026-03-15T10:00:00Z')]
});
assert.strictEqual(debt.state, 'MATCH');
assert.strictEqual(debt.calculated_balance_minor, -500);

// Target boundary is inclusive; anchor boundary is exclusive.
const boundaryAnchor = observation('obs-boundary-anchor', 0, { observed_at: '2026-05-01T00:00:00Z' });
const boundaryTarget = observation('obs-boundary-target', 200, { observed_at: '2026-06-01T00:00:00Z' });
const boundary = reconcileBalance({
  anchor: boundaryAnchor,
  target: boundaryTarget,
  transactions: [
    tx('tx-boundary-anchor', 'income', 100, '2026-05-01T00:00:00Z'),
    tx('tx-boundary-target', 'income', 200, '2026-06-01T00:00:00Z')
  ]
});
assert.strictEqual(boundary.canonical_delta_minor, 200);
assert.strictEqual(boundary.state, 'MATCH');

// Fail-closed boundaries.
assert.throws(() => reconcileBalance({ anchor: null, target: targetMatch, transactions: [] }), /BAL_ANCHOR_REQUIRED/);
assert.throws(() => reconcileBalance({ anchor, target: { ...targetMatch, account_id: 'acc-other' }, transactions: [] }), /BAL_ACCOUNT_MISMATCH/);
assert.throws(() => reconcileBalance({ anchor, target: { ...targetMatch, currency: 'USD' }, transactions: [] }), /BAL_OBSERVATION_CURRENCY_MISMATCH/);
assert.throws(() => reconcileBalance({ anchor, target: { ...targetMatch, observed_at: anchor.observed_at }, transactions: [] }), /BAL_TARGET_NOT_AFTER_ANCHOR/);
assert.throws(() => reconcileBalance({ anchor, target: targetMatch, transactions: [
  tx('tx-foreign', 'income', 1, '2026-01-15T00:00:00Z', { currency: 'USD' })
] }), /BAL_TRANSACTION_CURRENCY_MISMATCH/);
assert.throws(() => reconcileBalance({ anchor, target: targetMatch, transactions: [fixture[0], { ...fixture[0] }] }), /CANONICAL_TRANSACTION_ID_DUPLICATE/);
assert.throws(() => normalizeObservation({ ...anchor, balance_minor: Number.MAX_SAFE_INTEGER + 1 }), /BAL_OBSERVATION_BALANCE_INVALID/);
assert.throws(() => normalizeObservation({ ...anchor, currency: 'rub' }), /BAL_CURRENCY_INVALID/);
assert.throws(() => normalizeObservation({ ...anchor, observed_at: '2026-01-01' }), /BAL_OBSERVATION_TIME_INVALID/);
assert.throws(() => normalizeObservation({ ...anchor, provenance: { ...anchor.provenance, source_fingerprint: 'bad' } }), /BAL_OBSERVATION_SOURCE_FINGERPRINT_INVALID/);
assert.throws(() => normalizeObservation({ ...anchor, extra: true }), /BAL_OBSERVATION_SHAPE_INVALID/);
assert.throws(() => reconcileBalance({
  anchor: observation('obs-overflow-anchor', Number.MAX_SAFE_INTEGER - 1, { observed_at: '2026-07-01T00:00:00Z' }),
  target: observation('obs-overflow-target', 0, { observed_at: '2026-08-01T00:00:00Z' }),
  transactions: [tx('tx-overflow', 'income', 2, '2026-07-15T00:00:00Z')]
}), /BAL_SAFE_INTEGER_OVERFLOW/);

const telemetry = reconciliationTelemetry(mismatch);
assert.strictEqual(telemetry.schema, TELEMETRY_SCHEMA);
assert.deepStrictEqual(Object.keys(telemetry).sort(), CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.state, 'MISMATCH');
assert.strictEqual(telemetry.delta_direction, 'POSITIVE');
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['obs-anchor', 'obs-target', 'acc-main', '13200', '13000', '-200', 'balance_minor', 'mismatch_minor']) {
  assert(!telemetryText.includes(forbidden), `telemetry leaked ${forbidden}`);
}

const source = fs.readFileSync(path.join(__dirname, '..', 'lib/balance/balance_reconciliation.js'), 'utf8');
assert(!/SpreadsheetApp|UrlFetchApp|HtmlService|DocumentApp|XMLHttpRequest|\bdocument\.|\bwindow\.|setValues|appendRow/.test(source));
assert(!/financial_write\s*:\s*true|canonical_mutation\s*:\s*true|observation_mutation\s*:\s*true/.test(source));

console.log('balance_reconciliation_contract_test: OK', {
  schema: CONTRACT.schema,
  version: CONTRACT.version,
  anchorRequired: true,
  zeroOriginAssumed: false,
  exactExpectedBalance: 13200,
  mismatchFormula: 'OBSERVED_MINUS_CALCULATED',
  transferAccountAware: true,
  deterministic: true,
  idempotent: true,
  financialWrite: false,
  publicTelemetryFinancialValues: false,
  freeOnly: true
});
