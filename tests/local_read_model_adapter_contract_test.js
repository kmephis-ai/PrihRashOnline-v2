'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

const contract = readJson('lib/local_first/local_read_model.v1.json');
const runtimeContract = readJson('lib/local_first/local_first_runtime.v1.json');
const source = read('pwa/local_read_model_store.js');
const docs = read('docs/architecture/LOCAL_READ_MODEL_STORE.md');
const storeModule = require('../pwa/local_read_model_store.js');

assert.strictEqual(contract.schema, 'PRH_LOCAL_READ_MODEL_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.roadmap_id, 'STORE-LF-001');
assert.strictEqual(contract.cost_class, 'FREE_ONLY');
assert.strictEqual(contract.authority.financial_truth, false);
assert.strictEqual(contract.authority.canonical_write, false);
assert.strictEqual(contract.authority.remote_sync, false);
assert.strictEqual(contract.authority.analytics, false);
assert.strictEqual(contract.authority.browser_local_derived_read_only, true);

assert.strictEqual(contract.database.engine, 'INDEXEDDB');
assert.strictEqual(contract.database.name, 'prihrash-local-read-model');
assert.strictEqual(contract.database.version, 1);
assert.strictEqual(contract.database.private_browser_storage, true);
assert.strictEqual(contract.database.schema_upgrade_policy, 'FAIL_CLOSED_REBUILD');
assert.strictEqual(contract.database.corruption_policy, 'REBUILD_REQUIRED');
assert.strictEqual(contract.database.explicit_wipe_supported, true);

assert.strictEqual(contract.identity.canonical_revision_format, 'SHA256_HEX_64');
assert.strictEqual(contract.identity.generation_id_format, 'SHA256_HEX_64');
assert.strictEqual(contract.identity.immutable_generation, true);
assert.strictEqual(contract.identity.active_pointer_key, 'active_generation');
assert.strictEqual(contract.identity.manifest_key_prefix, 'generation:');

const storeNames = Object.keys(contract.stores);
assert.deepStrictEqual(storeNames, ['meta', 'transactions', 'dimensions', 'aggregates', 'sync_journal']);
assert.deepStrictEqual(contract.stores.transactions.key_path, ['generation_id', 'transaction_id']);
assert.deepStrictEqual(contract.stores.dimensions.key_path, ['generation_id', 'dimension_key']);
assert.deepStrictEqual(contract.stores.aggregates.key_path, ['generation_id', 'aggregate_key']);
assert.deepStrictEqual(contract.stores.sync_journal.key_path, ['generation_id', 'sequence']);
for (const name of storeNames.filter((name) => name !== 'meta')) {
  assert.strictEqual(contract.stores[name].generation_scoped, true);
  assert.strictEqual(contract.stores[name].generation_index, 'generation_id');
}

assert.strictEqual(contract.generation_protocol.visible_state, 'ACTIVE_VERIFIED_ONLY');
assert.strictEqual(contract.generation_protocol.partial_generation_visible, false);
assert.strictEqual(contract.generation_protocol.partial_or_failed_finalize_replaces_active, false);
assert.strictEqual(contract.generation_protocol.active_switch_atomic, true);
assert.strictEqual(contract.generation_protocol.finalize_requires_exact_revision_match, true);
assert.strictEqual(contract.read_contract.active_manifest_required, true);
assert.strictEqual(contract.read_contract.verified_manifest_required, true);
assert.strictEqual(contract.read_contract.revision_pointer_manifest_match_required, true);
assert.strictEqual(contract.read_contract.manifest_count_match_required, true);
assert.strictEqual(contract.read_contract.invalid_active_state, 'REBUILD_REQUIRED');
assert.strictEqual(contract.read_contract.unverified_payload_returned, false);

assert.strictEqual(contract.recovery.incompatible_schema, 'REBUILD_REQUIRED');
assert.strictEqual(contract.recovery.missing_active_manifest, 'REBUILD_REQUIRED');
assert.strictEqual(contract.recovery.revision_mismatch, 'REBUILD_REQUIRED');
assert.strictEqual(contract.recovery.count_mismatch, 'REBUILD_REQUIRED');
assert.strictEqual(contract.recovery.canonical_remote_mutation, false);
assert.strictEqual(contract.network.authority, false);
assert.strictEqual(contract.network.mandatory_requests_for_local_read, 0);
assert.strictEqual(contract.network.google_sheets_reads_for_local_read, 0);
assert.strictEqual(contract.privacy.financial_payload_in_public_artifacts, false);
assert.strictEqual(contract.privacy.financial_payload_in_public_telemetry, false);
assert.strictEqual(contract.privacy.database_export_to_public_artifacts, false);

assert.strictEqual(runtimeContract.local_read_model.schema, 'PRH_LOCAL_READ_MODEL_V1');
assert.strictEqual(runtimeContract.local_read_model.storage, 'INDEXEDDB');
assert.strictEqual(runtimeContract.local_read_model.immutable_generation, true);
assert.strictEqual(runtimeContract.local_read_model.partial_generation_visible, false);
assert.strictEqual(runtimeContract.local_read_model.explicit_wipe_supported, true);
assert.deepStrictEqual(runtimeContract.local_read_model.stores, storeNames);

assert.strictEqual(storeModule.schema, 'PRH_LOCAL_READ_MODEL_V1');
assert.strictEqual(storeModule.version, '1.0.0');
assert.strictEqual(storeModule.databaseName, 'prihrash-local-read-model');
assert.strictEqual(storeModule.databaseVersion, 1);
assert.deepStrictEqual(Array.from(storeModule.stores), storeNames);
assert.strictEqual(typeof storeModule.createStore, 'function');

for (const token of [
  'indexedDB.open',
  "status: 'STAGING'",
  "manifest.status = 'VERIFIED'",
  "key: ACTIVE_KEY",
  'GENERATION_COUNT_MISMATCH',
  'ACTIVE_GENERATION_ABORT_FORBIDDEN',
  'REBUILD_REQUIRED',
  'deleteDatabase'
]) {
  assert(source.includes(token), `missing store implementation token: ${token}`);
}

for (const forbidden of ['google.script.run', 'XMLHttpRequest', 'UrlFetchApp', 'SpreadsheetApp']) {
  assert(!source.includes(forbidden), `local store must not contain network/Google authority: ${forbidden}`);
}
assert(!/\bfetch\s*\(/.test(source), 'local store must not use fetch');

for (const requiredDoc of [
  'PRH_LOCAL_READ_MODEL_V1@1.0.0',
  'ACTIVE + VERIFIED',
  'partial bootstrap',
  'REBUILD_REQUIRED',
  'wipe()',
  'Canonical financial write authority = `false`'
]) {
  assert(docs.includes(requiredDoc), `missing normative Local Read Model documentation: ${requiredDoc}`);
}

console.log('Local Read Model adapter contract: PASS', {
  contract: 'PRH_LOCAL_READ_MODEL_V1@1.0.0',
  engine: 'INDEXEDDB',
  stores: storeNames.length,
  partialVisible: false,
  canonicalWrite: false,
  networkAuthority: false
});
