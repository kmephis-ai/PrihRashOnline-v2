'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const YDB = require('../lib/ydb/ydb_serverless_poc');
const CONTRACT = require('../lib/ydb/ydb_serverless_poc.v1.json');
const { normalizeCanonicalTransaction } = require('../lib/domain/canonical_transaction');

function hash(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function tx(index) {
  const id = String(index).padStart(4, '0');
  return {
    schema: 'PRH_CANONICAL_TRANSACTION_V1',
    schema_version: 1,
    transaction_id: `SYN-YDB-${id}`,
    occurred_at: `2026-04-${String((index % 28) + 1).padStart(2, '0')}T12:34:56+03:00`,
    type: index % 5 === 0 ? 'income' : 'expense',
    status: 'posted',
    amount_minor: 1000 + index * 17,
    currency: 'RUB',
    account_id: `ACC-${index % 3}`,
    destination_account_id: null,
    category_id: `CAT-${index % 7}`,
    member_id: index % 2 === 0 ? 'MEM-A' : null,
    project_id: index % 4 === 0 ? 'PRJ-A' : null,
    tags: index % 3 === 0 ? ['synthetic', 'ydb'] : ['synthetic'],
    counterparty: `Synthetic party ${index % 9}`,
    description: `Synthetic YC-040 fixture ${id}`,
    reverses_transaction_id: null,
    adjustment_semantics: null,
    provenance: {
      source_system: 'SYNTHETIC_YDB_POC',
      source_container: 'PUBLIC_SAFE_FIXTURE',
      source_record_id: `SRC-YDB-${id}`,
      source_fingerprint: hash(`source-${id}`),
      identity_strategy: 'EXTERNAL_ID',
      transform_version: 'yc040-synthetic-v1',
      source_position: `row:${index + 1}`
    }
  };
}

function expectBlocked(current, reservation, context, reason) {
  const result = YDB.evaluateReservation(current, reservation, context);
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reason_code, reason);
  assert.strictEqual(result.telemetry.status, 'BLOCKED');
  assert.strictEqual(YDB.assertTelemetryPublicSafe(result.telemetry), true);
  return result;
}

assert.strictEqual(CONTRACT.schema, 'PRH_YDB_SERVERLESS_POC_V1');
assert.strictEqual(CONTRACT.mode, 'OFFLINE_SCHEMA_ADAPTER_POC');
assert.strictEqual(CONTRACT.ydb.remote_resource_required_for_ci, false);
assert.strictEqual(CONTRACT.ydb.cloud_credentials_required_for_ci, false);
assert.strictEqual(CONTRACT.ydb.canonical_write_owner, false);
assert.strictEqual(CONTRACT.free_tier_reference.monthly_request_units, 1000000);
assert.strictEqual(CONTRACT.free_tier_reference.monthly_storage_bytes, 1073741824);
assert.strictEqual(CONTRACT.free_tier_reference.excess_usage_is_billable, true);
assert.strictEqual(CONTRACT.free_tier_reference.cloud_quota_is_billing_cap, false);
assert.strictEqual(CONTRACT.safety_envelope.monthly_request_units, 250000);
assert.strictEqual(CONTRACT.safety_envelope.monthly_storage_bytes, 268435456);
assert.strictEqual(CONTRACT.safety_envelope.monthly_request_count, 100000);
assert.strictEqual(CONTRACT.safety_envelope.max_request_units_per_second, 5);
assert.strictEqual(CONTRACT.safety_envelope.paidOverageAllowed, false);
assert(Object.values(CONTRACT.authority).every((value) => value === false));
assert.strictEqual(CONTRACT.cost.mode, 'FREE_ONLY');

const yql = fs.readFileSync(path.join(__dirname, '..', 'lib', 'ydb', 'canonical_transactions_v1.yql'), 'utf8');
assert(yql.includes('CREATE TABLE canonical_transactions_v1'));
assert(yql.includes('transaction_id Utf8 NOT NULL'));
assert(yql.includes('amount_minor Uint64 NOT NULL'));
assert(yql.includes('occurred_at Utf8 NOT NULL'));
assert(yql.includes('PRIMARY KEY (transaction_id)'));
assert(!/endpoint|database_id|billing_account|token|password|secret/i.test(yql));

const fixtures = Array.from({ length: 250 }, (_, index) => tx(index + 1));
const poc = YDB.createInMemoryPoc(fixtures);
assert.strictEqual(poc.row_count, 250);
assert(/^[0-9a-f]{64}$/.test(poc.snapshotHash()));

for (const index of [1, 2, 17, 249]) {
  const original = normalizeCanonicalTransaction(tx(index));
  const row = YDB.canonicalToYdbRow(original);
  const roundTrip = YDB.ydbRowToCanonical(row);
  assert.deepStrictEqual(roundTrip, original, `Lossless round-trip failed for ${index}`);
  assert.strictEqual(row.occurred_at, original.occurred_at, 'Exact canonical timestamp text must be preserved');
  assert(Number.isSafeInteger(row.amount_minor));
}

const read17 = poc.readById('SYN-YDB-0017');
assert.deepStrictEqual(read17, normalizeCanonicalTransaction(tx(17)));
assert.strictEqual(poc.readById('SYN-YDB-9999'), null);
const cat3 = poc.queryByCategory('CAT-3');
assert(cat3.length > 0);
assert(cat3.every((item) => item.category_id === 'CAT-3'));
assert.deepStrictEqual(cat3.map((item) => item.transaction_id), cat3.map((item) => item.transaction_id).slice().sort());

const current = { month_key: '2026-08', ru_used: 10000, storage_bytes: 10485760, request_count: 3000 };
const allowed = YDB.evaluateReservation(current, { ru: 5000, storage_bytes: 1048576, request_count: 1000, peak_ru_per_second: 3 }, { billing_state: YDB.BILLING_STATE });
assert.strictEqual(allowed.allowed, true);
assert.deepStrictEqual(allowed.projected, { month_key: '2026-08', ru_used: 15000, storage_bytes: 11534336, request_count: 4000 });
assert.strictEqual(allowed.telemetry.circuit_state, 'CLOSED_ALLOW');
assert.strictEqual(YDB.assertTelemetryPublicSafe(allowed.telemetry), true);
assert.deepStrictEqual(Object.keys(allowed.telemetry).sort(), CONTRACT.telemetry.allowlist.slice().sort());

expectBlocked(current, { ru: 1, storage_bytes: 0, request_count: 1, peak_ru_per_second: 1 }, {}, 'YDB_FREE_ONLY_BILLING_STATE_BLOCKED');
expectBlocked(current, { ru: 1, storage_bytes: 0, request_count: 1, peak_ru_per_second: 6 }, { billing_state: YDB.BILLING_STATE }, 'YDB_FREE_ONLY_PEAK_RU_BLOCKED');
expectBlocked({ month_key:'2026-08',ru_used:249999,storage_bytes:0,request_count:0 }, { ru:2,storage_bytes:0,request_count:1,peak_ru_per_second:1 }, { billing_state:YDB.BILLING_STATE }, 'YDB_FREE_ONLY_RU_ENVELOPE_BLOCKED');
expectBlocked({ month_key:'2026-08',ru_used:0,storage_bytes:268435455,request_count:0 }, { ru:1,storage_bytes:2,request_count:1,peak_ru_per_second:1 }, { billing_state:YDB.BILLING_STATE }, 'YDB_FREE_ONLY_STORAGE_ENVELOPE_BLOCKED');
expectBlocked({ month_key:'2026-08',ru_used:0,storage_bytes:0,request_count:99999 }, { ru:1,storage_bytes:0,request_count:2,peak_ru_per_second:1 }, { billing_state:YDB.BILLING_STATE }, 'YDB_FREE_ONLY_REQUEST_ENVELOPE_BLOCKED');

const telemetryText = JSON.stringify(allowed.telemetry);
for (const forbidden of ['SYN-YDB', 'amount_minor', 'Synthetic party', 'database_id', 'endpoint', 'billing_account']) assert(!telemetryText.includes(forbidden));

assert.throws(() => YDB.normalizeUsage({ month_key:'2026-13',ru_used:0,storage_bytes:0,request_count:0 }), /YDB_POC_USAGE_MONTH_INVALID/);
assert.throws(() => YDB.normalizeReservation({ ru:-1,storage_bytes:0,request_count:0,peak_ru_per_second:0 }), /YDB_POC_RESERVATION_RU_INVALID/);

console.log('ydb_serverless_poc_contract_test: OK', {
  contract: `${CONTRACT.schema}@${CONTRACT.version}`,
  syntheticRows: poc.row_count,
  losslessCanonicalRoundTrip: true,
  conservativeRuEnvelopePct: 25,
  conservativeStorageEnvelopePct: 25,
  unknownBillingStateBlocked: true,
  paidOverageAllowed: false,
  canonicalWriteOwner: false,
  cloudCredentialsRequiredForCi: false,
  publicTelemetryFinancialPayload: false
});
