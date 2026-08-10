'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  CONTRACT, SNAPSHOT_SCHEMA, POSITION_SCHEMA, RESULT_SCHEMA, TELEMETRY_SCHEMA,
  assertContract, accountPositionFromObservation, accountPositionFromReconciliation,
  declaredPosition, normalizeSnapshot, evaluateNetWorth, serializeSnapshot,
  serializeNetWorth, netWorthTelemetry
} = require('../lib/networth/net_worth');
const { OBSERVATION_SCHEMA, reconcileBalance } = require('../lib/balance/balance_reconciliation');
const { SCHEMA_ID: CANONICAL_SCHEMA_ID } = require('../lib/domain/canonical_transaction');

const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');

function observation(id, accountId, balanceMinor, observedAt = '2026-08-10T08:00:00Z') {
  return {
    schema: OBSERVATION_SCHEMA, version: '1.0.0', observation_id: id, account_id: accountId,
    currency: 'RUB', observed_at: observedAt, balance_minor: balanceMinor,
    provenance: {
      source_system: 'SYNTHETIC_TEST', source_record_id: `record:${id}`,
      source_fingerprint: sha256(`obs:${id}:${balanceMinor}:${observedAt}`),
      capture_method: 'SYNTHETIC_TEST', transform_version: 'SYN-NW-030-v1'
    }
  };
}

function tx(id, amountMinor, occurredAt) {
  return {
    schema: CANONICAL_SCHEMA_ID, schema_version: 1, transaction_id: id, occurred_at: occurredAt,
    type: 'income', status: 'posted', amount_minor: amountMinor, currency: 'RUB', account_id: 'acc-b',
    destination_account_id: null, category_id: 'cat-income', member_id: null, project_id: null,
    tags: ['synthetic'], counterparty: null, description: `Synthetic ${id}`,
    reverses_transaction_id: null, adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC_TEST', source_container: 'fixture:net-worth', source_record_id: `record:${id}`,
      source_fingerprint: sha256(`tx:${id}:${amountMinor}`), identity_strategy: 'EXTERNAL_ID',
      transform_version: 'SYN-NW-030-v1', source_position: null
    }
  };
}

function valuation(positionId, type, valueMinor, currency = 'RUB') {
  return declaredPosition({
    schema: POSITION_SCHEMA, version: '1.0.0', position_id: positionId, type,
    label: `Synthetic ${type.toLowerCase()} ${positionId}`, valuation_date: '2026-08-10', currency,
    value_minor: valueMinor,
    provenance: {
      source_kind: 'SYNTHETIC_TEST', source_record_id: `valuation:${positionId}`,
      source_fingerprint: sha256(`valuation:${positionId}:${valueMinor}:${currency}`)
    }
  });
}

assert.strictEqual(assertContract(), true);
assert.strictEqual(CONTRACT.schema, 'PRH_NET_WORTH_V1');
assert.strictEqual(CONTRACT.valuation_policy.fx_conversion, false);
assert.strictEqual(CONTRACT.reconciliation_policy.mismatch_hidden, false);
assert(Object.values(CONTRACT.authorities).every((value) => value === false));

const accountA = accountPositionFromObservation(observation('obs-a', 'acc-a', 10000), {
  position_id: 'pos-account-a', label: 'Synthetic account A', valuation_date: '2026-08-10'
});
const debt = accountPositionFromObservation(observation('obs-debt', 'acc-debt', -2000), {
  position_id: 'pos-debt', label: 'Synthetic overdraft', valuation_date: '2026-08-10'
});
assert.strictEqual(accountA.provenance.source_kind, 'OBSERVED_BALANCE');
assert.strictEqual(debt.value_minor, -2000);

const reconciliation = reconcileBalance({
  anchor: observation('obs-b-anchor', 'acc-b', 5000, '2026-08-01T08:00:00Z'),
  target: observation('obs-b-target', 'acc-b', 6100),
  transactions: [tx('tx-b-income', 1000, '2026-08-05T10:00:00Z')]
});
assert.strictEqual(reconciliation.state, 'MISMATCH');
assert.strictEqual(reconciliation.calculated_balance_minor, 6000);

const observedB = accountPositionFromReconciliation(reconciliation, 'OBSERVED_BALANCE', {
  position_id: 'pos-b-observed', label: 'Synthetic B observed', valuation_date: '2026-08-10'
});
const calculatedB = accountPositionFromReconciliation(reconciliation, 'CALCULATED_BALANCE', {
  position_id: 'pos-b-calculated', label: 'Synthetic B calculated', valuation_date: '2026-08-10'
});
assert.strictEqual(observedB.value_minor, 6100);
assert.strictEqual(calculatedB.value_minor, 6000);
assert.strictEqual(observedB.provenance.reconciliation_state, 'MISMATCH');
assert.strictEqual(calculatedB.provenance.reconciliation_id, reconciliation.reconciliation_id);

const asset = valuation('asset', 'ASSET', 50000);
const liability = valuation('liability', 'LIABILITY', 12000);
const snapshot = {
  schema: SNAPSHOT_SCHEMA, version: '1.0.0', snapshot_id: 'snapshot-2026-08-10',
  valuation_date: '2026-08-10', currency: 'RUB', positions: [liability, observedB, asset, debt, accountA]
};
const before = JSON.stringify(snapshot);
const result = evaluateNetWorth(snapshot);
assert.strictEqual(result.schema, RESULT_SCHEMA);
assert.strictEqual(result.signed_account_total_minor, 14100);
assert.strictEqual(result.gross_assets_minor, 66100);
assert.strictEqual(result.gross_liabilities_minor, 14000);
assert.strictEqual(result.net_worth_minor, 52100);
assert.strictEqual(result.status, 'RECONCILIATION_REVIEW_REQUIRED');
assert.strictEqual(result.provenance.financial_truth, false);
assert.strictEqual(result.provenance.fx_conversion_used, false);
assert.strictEqual(result.provenance.mismatch_hidden, false);
assert.strictEqual(result.provenance.financial_write, false);
assert.strictEqual(JSON.stringify(snapshot), before);

const calculated = evaluateNetWorth({ ...snapshot, positions: [liability, calculatedB, asset, debt, accountA] });
assert.strictEqual(calculated.net_worth_minor, 52000);
assert.notStrictEqual(calculated.net_worth_id, result.net_worth_id);
assert.strictEqual(calculated.status, 'RECONCILIATION_REVIEW_REQUIRED');

const reordered = evaluateNetWorth({ ...snapshot, positions: snapshot.positions.slice().reverse() });
assert.strictEqual(reordered.net_worth_id, result.net_worth_id);
assert.strictEqual(serializeNetWorth(reordered), serializeNetWorth(result));
assert.strictEqual(serializeSnapshot(snapshot), serializeSnapshot({ ...snapshot, positions: snapshot.positions.slice().reverse() }));
assert(/^nw-[0-9a-f]{48}$/.test(result.net_worth_id));

const clean = evaluateNetWorth({ ...snapshot, snapshot_id: 'snapshot-clean', positions: [accountA, debt, asset, liability] });
assert.strictEqual(clean.status, 'OK');
assert.strictEqual(clean.net_worth_minor, 46000);

assert.throws(() => accountPositionFromObservation(observation('wrong-day', 'acc-x', 1, '2026-08-09T08:00:00Z'), {
  position_id: 'bad-date', label: 'Bad date', valuation_date: '2026-08-10'
}), /NW_ACCOUNT_VALUATION_DATE_MISMATCH/);
assert.throws(() => accountPositionFromReconciliation(reconciliation, 'AUTO', {
  position_id: 'bad-source', label: 'Bad source', valuation_date: '2026-08-10'
}), /NW_ACCOUNT_SOURCE_INVALID/);
assert.throws(() => valuation('zero', 'ASSET', 0), /NW_VALUATION_VALUE_INVALID/);
assert.throws(() => normalizeSnapshot({ ...snapshot, positions: [accountA, { ...accountA }] }), /NW_POSITION_ID_DUPLICATE/);
assert.throws(() => normalizeSnapshot({ ...snapshot, positions: [accountA, { ...accountA, position_id: 'other' }] }), /NW_ACCOUNT_POSITION_DUPLICATE/);
// Standalone USD valuation is valid; mixed currency inside one snapshot is what must fail.
const usdAsset = valuation('usd-asset', 'ASSET', 100, 'USD');
assert.throws(() => normalizeSnapshot({ ...snapshot, positions: [usdAsset] }), /NW_POSITION_CURRENCY_MISMATCH/);
assert.throws(() => normalizeSnapshot({ ...snapshot, positions: [{ ...asset, valuation_date: '2026-08-09' }] }), /NW_POSITION_VALUATION_DATE_MISMATCH/);
assert.throws(() => evaluateNetWorth({
  ...snapshot,
  positions: [declaredPosition({ ...asset, value_minor: Number.MAX_SAFE_INTEGER }), valuation('overflow', 'ASSET', 1)]
}), /NW_SAFE_INTEGER_OVERFLOW/);

const telemetry = netWorthTelemetry(result);
assert.strictEqual(telemetry.schema, TELEMETRY_SCHEMA);
assert.deepStrictEqual(Object.keys(telemetry).sort(), CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.position_count, 5);
assert.strictEqual(telemetry.account_count, 3);
assert.strictEqual(telemetry.mismatch_account_count, 1);
assert.strictEqual(telemetry.observed_account_count, 3);
const telemetryText = JSON.stringify(telemetry);
for (const forbidden of ['acc-a', 'acc-b', 'snapshot-2026', 'Synthetic account', '52100', '50000', '12000', 'net_worth_minor']) {
  assert(!telemetryText.includes(forbidden), `telemetry leaked ${forbidden}`);
}

const source = fs.readFileSync(path.join(__dirname, '..', 'lib/networth/net_worth.js'), 'utf8');
assert(!/SpreadsheetApp|UrlFetchApp|HtmlService|DocumentApp|XMLHttpRequest|\bdocument\.|\bwindow\.|setValues|appendRow/.test(source));
assert(!/financial_write\s*:\s*true|canonical_mutation\s*:\s*true|observation_mutation\s*:\s*true|fx_conversion_used\s*:\s*true/.test(source));

console.log('net_worth_contract_test: OK', {
  schema: CONTRACT.schema, version: CONTRACT.version, explicitValuationDate: true,
  singleCurrency: true, explicitMismatchProvenance: true, observedVsCalculatedSelection: true,
  exactNetWorth: 52100, deterministic: true, financialWrite: false, fxConversion: false, freeOnly: true
});
