'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  CONTRACT,
  SNAPSHOT_SCHEMA,
  POSITION_SCHEMA,
  RESULT_SCHEMA,
  TELEMETRY_SCHEMA,
  assertContract,
  accountPositionFromObservation,
  accountPositionFromReconciliation,
  declaredPosition,
  normalizeSnapshot,
  evaluateNetWorth,
  serializeSnapshot,
  serializeNetWorth,
  netWorthTelemetry
} = require('../lib/networth/net_worth');
const {
  OBSERVATION_SCHEMA,
  reconcileBalance
} = require('../lib/balance/balance_reconciliation');
const { SCHEMA_ID: CANONICAL_SCHEMA_ID } = require('../lib/domain/canonical_transaction');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function observation(id, accountId, balanceMinor, observedAt = '2026-08-10T08:00:00Z') {
  return {
    schema: OBSERVATION_SCHEMA,
    version: '1.0.0',
    observation_id: id,
    account_id: accountId,
    currency: 'RUB',
    observed_at: observedAt,
    balance_minor: balanceMinor,
    provenance: {
      source_system: 'SYNTHETIC_TEST',
      source_record_id: `record:${id}`,
      source_fingerprint: sha256(`obs:${id}:${balanceMinor}:${observedAt}`),
      capture_method: 'SYNTHETIC_TEST',
      transform_version: 'SYN-NW-030-v1'
    }
  };
}

function tx(id, type, amountMinor, occurredAt, overrides = {}) {
  const accountId = overrides.account_id || 'acc-b';
  return {
    schema: CANONICAL_SCHEMA_ID,
    schema_version: 1,
    transaction_id: id,
    occurred_at: occurredAt,
    type,
    status: overrides.status || 'posted',
    amount_minor: amountMinor,
    currency: 'RUB',
    account_id: accountId,
    destination_account_id: type === 'transfer' ? (overrides.destination_account_id || 'acc-other') : null,
    category_id: `cat-${type}`,
    member_id: null,
    project_id: null,
    tags: ['synthetic'],
    counterparty: null,
    description: `Synthetic NW transaction ${id}`,
    reverses_transaction_id: type === 'refund' ? `ref-${id}` : null,
    adjustment_semantics: type === 'refund' ? 'expense_reduction' : null,
    provenance: {
      source_system: 'SYNTHETIC_TEST',
      source_container: 'fixture:net-worth',
      source_record_id: `record:${id}`,
      source_fingerprint: sha256(`tx:${id}:${amountMinor}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYN-NW-030-v1',
      source_position: null
    }
  };
}

function valuation(positionId, type, label, valueMinor, sourceKind = 'SYNTHETIC_TEST') {
  return declaredPosition({
    schema: POSITION_SCHEMA,
    version: '1.0.0',
    position_id: positionId,
    type,
    label,
    valuation_date: '2026-08-10',
    currency: 'RUB',
    value_minor: valueMinor,
    provenance: {
      source_kind: sourceKind,
      source_record_id: `valuation:${positionId}`,
      source_fingerprint: sha256(`valuation:${positionId}:${valueMinor}`)
    }
  });
}

assert.strictEqual(assertContract(), true);
assert.strictEqual(CONTRACT.schema, 'PRH_NET_WORTH_V1');
assert.strictEqual(CONTRACT.valuation_policy.fx_conversion, false);
assert.strictEqual(CONTRACT.reconciliation_policy.mismatch_hidden, false);
assert(Object.values(CONTRACT.authorities).every((value) => value === false));
assert.strictEqual(CONTRACT.free_only, true);

const observedA = observation('obs-a', 'acc-a', 10000);
const accountA = accountPositionFromObservation(observedA, {
  position_id: 'pos-account-a',
  label: 'Synthetic account A',
  valuation_date: '2026-08-10'
});
assert.strictEqual(accountA.type, 'ACCOUNT');
assert.strictEqual(accountA.value_minor, 10000);
assert.strictEqual(accountA.provenance.source_kind, 'OBSERVED_BALANCE');
assert.strictEqual(accountA.provenance.reconciliation_id, null);

const anchorB = observation('obs-b-anchor', 'acc-b', 5000, '2026-08-01T08:00:00Z');
const targetB = observation('obs-b-target', 'acc-b', 6100);
const reconciliationB = reconcileBalance({
  anchor: anchorB,
  target: targetB,
  transactions: [tx('tx-b-income', 'income', 1000, '2026-08-05T10:00:00Z')]
});
assert.strictEqual(reconciliationB.state, 'MISMATCH');
assert.strictEqual(reconciliationB.calculated_balance_minor, 6000);
assert.strictEqual(reconciliationB.observed_balance_minor, 6100);

const accountBObserved = accountPositionFromReconciliation(reconciliationB, 'OBSERVED_BALANCE', {
  position_id: 'pos-account-b-observed',
  label: 'Synthetic account B observed',
  valuation_date: '2026-08-10'
});
assert.strictEqual(accountBObserved.value_minor, 6100);
assert.strictEqual(accountBObserved.provenance.reconciliation_state, 'MISMATCH');
assert.strictEqual(accountBObserved.provenance.source_kind, 'OBSERVED_BALANCE');

const accountBCalculated = accountPositionFromReconciliation(reconciliationB, 'CALCULATED_BALANCE', {
  position_id: 'pos-account-b-calculated',
  label: 'Synthetic account B calculated',
  valuation_date: '2026-08-10'
});
assert.strictEqual(accountBCalculated.value_minor, 6000);
assert.strictEqual(accountBCalculated.provenance.reconciliation_state, 'MISMATCH');
assert.strictEqual(accountBCalculated.provenance.source_kind, 'CALCULATED_BALANCE');
assert.strictEqual(accountBCalculated.provenance.reconciliation_id, reconciliationB.reconciliation_id);

const debt = accountPositionFromObservation(observation('obs-debt', 'acc-debt', -2000), {
  position_id: 'pos-debt-account',
  label: 'Synthetic overdraft',
  valuation_date: '2026-08-10'
});
const asset = valuation('pos-asset', 'ASSET', 'Synthetic declared asset', 50000);
const liability = valuation('pos-liability', 'LIABILITY', 'Synthetic declared liability', 12000);

const snapshotInput = {
  schema: SNAPSHOT_SCHEMA,
  version: '1.0.0',
  snapshot_id: 'snapshot-2026-08-10',
  valuation_date: '2026-08-10',
  currency: 'RUB',
  positions: [liability, accountBObserved, asset, debt, accountA]
};
const snapshotBefore = JSON.stringify(snapshotInput);
const result = evaluateNetWorth(snapshotInput);
assert.strictEqual(result.schema, RESULT_SCHEMA);
assert.strictEqual(result.signed_account_total_minor, 14100); // 10000 + 6100 - 2000
assert.strictEqual(result.declared_asset_total_minor, 50000);
assert.strictEqual(result.declared_liability_total_minor, 12000);
assert.strictEqual(result.gross_assets_minor, 66100); // positive accounts 16100 + asset 50000
assert.strictEqual(result.gross_liabilities_minor, 14000); // negative account 2000 + declared liability 12000
assert.strictEqual(result.net_worth_minor, 52100); // signed accounts + assets - liabilities
assert.strictEqual(result.status, 'RECONCILIATION_REVIEW_REQUIRED');
assert.strictEqual(result.provenance.financial_truth, false);
assert.strictEqual(result.provenance.fx_conversion_used, false);
assert.strictEqual(result.provenance.mismatch_hidden, false);
assert.strictEqual(result.provenance.financial_write, false);
assert.strictEqual(JSON.stringify(snapshotInput), snapshotBefore);
assert(Object.isFrozen(result));
assert(Object.isFrozen(result.snapshot.positions));

// Explicit observed/calculated selection changes value and identity, while mismatch stays visible.
const calculatedResult = evaluateNetWorth({ ...snapshotInput, positions: [liability, accountBCalculated, asset, debt, accountA] });
assert.strictEqual(calculatedResult.net_worth_minor, 52000);
assert.notStrictEqual(calculatedResult.net_worth_id, result.net_worth_id);
assert.strictEqual(calculatedResult.status, 'RECONCILIATION_REVIEW_REQUIRED');

// Determinism: position ordering cannot alter normalized snapshot/result.
const reordered = evaluateNetWorth({ ...snapshotInput, positions: snapshotInput.positions.slice().reverse() });
assert.strictEqual(reordered.net_worth_id, result.net_worth_id);
assert.strictEqual(serializeNetWorth(reordered), serializeNetWorth(result));
assert.strictEqual(serializeSnapshot(snapshotInput), serializeSnapshot({ ...snapshotInput, positions: snapshotInput.positions.slice().reverse() }));
assert(/^nw-[0-9a-f]{48}$/.test(result.net_worth_id));

// A fully matched/observed snapshot is OK.
const clean = evaluateNetWorth({
  ...snapshotInput,
  snapshot_id: 'snapshot-clean',
  positions: [accountA, debt, asset, liability]
});
assert.strictEqual(clean.status, 'OK');
assert.strictEqual(clean.net_worth_minor, 46000); // 10000 - 2000 + 50000 - 12000

// Fail-closed date/currency/identity/valuation boundaries.
assert.throws(() => accountPositionFromObservation(observedA, {
  position_id: 'bad-date', label: 'Bad date', valuation_date: '2026-08-09'
}), /NW_ACCOUNT_VALUATION_DATE_MISMATCH/);
assert.throws(() => accountPositionFromReconciliation(reconciliationB, 'AUTO', {
  position_id: 'bad-source', label: 'Bad source', valuation_date: '2026-08-10'
}), /NW_ACCOUNT_SOURCE_INVALID/);
assert.throws(() => valuation('bad-zero', 'ASSET', 'Zero asset', 0), /NW_VALUATION_VALUE_INVALID/);
assert.throws(() => declaredPosition({ ...asset, currency: 'USD' }), /NW_POSITION_SHAPE_INVALID|NW_POSITION_CURRENCY_MISMATCH/);
assert.throws(() => normalizeSnapshot({ ...snapshotInput, positions: [accountA, { ...accountA }] }), /NW_POSITION_ID_DUPLICATE/);
assert.throws(() => normalizeSnapshot({
  ...snapshotInput,
  positions: [accountA, { ...accountA, position_id: 'other-position' }]
}), /NW_ACCOUNT_POSITION_DUPLICATE/);
assert.throws(() => normalizeSnapshot({
  ...snapshotInput,
  positions: [{ ...asset, currency: 'USD' }]
}), /NW_POSITION_CURRENCY_MISMATCH/);
assert.throws(() => normalizeSnapshot({
  ...snapshotInput,
  positions: [{ ...asset, valuation_date: '2026-08-09' }]
}), /NW_POSITION_VALUATION_DATE_MISMATCH/);
assert.throws(() => evaluateNetWorth({
  ...snapshotInput,
  positions: [
    declaredPosition({ ...asset, value_minor: Number.MAX_SAFE_INTEGER }),
    valuation('overflow-asset', 'ASSET', 'Overflow asset', 1)
  ]
}), /NW_SAFE_INTEGER_OVERFLOW/);

const telemetry = netWorthTelemetry(result);
assert.strictEqual(telemetry.schema, TELEMETRY_SCHEMA);
assert.deepStrictEqual(Object.keys(telemetry).sort(), CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.position_count, 5);
assert.strictEqual(telemetry.account_count, 3);
assert.strictEqual(telemetry.mismatch_account_count, 1);
assert.strictEqual(telemetry.observed_account_count, 3);
assert.strictEqual(telemetry.calculated_account_count, 0);
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['acc-a', 'acc-b', 'snapshot-2026', 'Synthetic account', '52100', '50000', '12000', 'net_worth_minor']) {
  assert(!telemetryText.includes(forbidden), `telemetry leaked ${forbidden}`);
}

const source = fs.readFileSync(path.join(__dirname, '..', 'lib/networth/net_worth.js'), 'utf8');
assert(!/SpreadsheetApp|UrlFetchApp|HtmlService|DocumentApp|XMLHttpRequest|\bdocument\.|\bwindow\.|setValues|appendRow/.test(source));
assert(!/financial_write\s*:\s*true|canonical_mutation\s*:\s*true|observation_mutation\s*:\s*true|fx_conversion_used\s*:\s*true/.test(source));

console.log('net_worth_contract_test: OK', {
  schema: CONTRACT.schema,
  version: CONTRACT.version,
  explicitValuationDate: true,
  singleCurrency: true,
  explicitMismatchProvenance: true,
  observedVsCalculatedSelection: true,
  exactNetWorth: 52100,
  deterministic: true,
  financialWrite: false,
  fxConversion: false,
  freeOnly: true
});
