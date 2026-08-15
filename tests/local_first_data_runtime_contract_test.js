'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'lib', 'local_first', 'local_data_runtime.v1.json'), 'utf8'));
const extensionHtml = fs.readFileSync(path.join(root, 'LocalFirstDataSpaExtension.html'), 'utf8');
const serviceSource = fs.readFileSync(path.join(root, 'LocalFirstSpaService.js'), 'utf8');
const packagerSource = fs.readFileSync(path.join(root, 'tools', 'build-apps-script-candidate.js'), 'utf8');

assert.strictEqual(contract.schema, 'PRH_LOCAL_FIRST_DATA_RUNTIME_CONTRACT_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.roadmap_id, 'DATA-LF-001');
assert.deepStrictEqual(contract.routes, ['transactions','data-quality']);
assert.strictEqual(contract.local_read_model.schema, 'PRH_LOCAL_READ_MODEL_V1');
assert.strictEqual(contract.local_read_model.storage_namespace, 'prihrash-local-first-v3');
assert.strictEqual(contract.local_read_model.required_state, 'ACTIVE_VERIFIED');
assert.strictEqual(contract.local_read_model.browser_snapshot_status, 'READY');
assert.strictEqual(contract.local_read_model.same_snapshot_as_finance, true);
assert.strictEqual(contract.transactions.read_only, true);
assert.strictEqual(contract.transactions.page_size, 20);
assert.strictEqual(contract.transactions.detail, 'local_exact_transaction_id_within_current_filter');
assert.deepStrictEqual(contract.transactions.filters, ['start','end_exclusive','category_id','account_id','member_id']);
assert.strictEqual(contract.transactions.history_financial_payload_forbidden, true);
assert.strictEqual(contract.data_quality.read_only, true);
assert.strictEqual(contract.data_quality.canonical_write, false);
assert.strictEqual(contract.data_quality.autofix, false);
assert.strictEqual(contract.data_quality.semantics, 'LOCAL_PROJECTION_AND_REFERENTIAL_SIGNALS_ONLY');
assert.deepStrictEqual(contract.data_quality.checks, [
  'CATEGORY_DIMENSION_MISSING',
  'ACCOUNT_DIMENSION_MISSING',
  'MEMBER_DIMENSION_MISSING',
  'DUPLICATE_SOURCE_FINGERPRINT'
]);
assert.strictEqual(contract.privacy.invalid_mode_failsafe, 'MASKED');
assert.strictEqual(contract.privacy.demo_uses_synthetic_owner_values, false);
assert.strictEqual(contract.navigation.single_document, true);
assert.strictEqual(contract.navigation.back_forward, true);
assert.strictEqual(contract.navigation.stale_generation_commit, false);
for (const value of Object.values(contract.network)) assert.strictEqual(value, 0);
assert.strictEqual(contract.authority.canonical_financial_write, false);
assert.strictEqual(contract.authority.data_quality_repair, false);
assert.strictEqual(contract.authority.free_only, true);

for (const marker of [
  'data-prh-local-first-data-extension="1.0.0"',
  'PRH_LOCAL_FIRST_DATA_EXTENSION_V1',
  "const DATA_ROUTES=Object.freeze(['transactions','data-quality'])",
  "name:'prihrash-local-first-v3'",
  "snapshot.status!=='READY'||snapshot.schema!=='PRH_LOCAL_READ_MODEL_V1'",
  'epoch!==runtime.renderEpoch',
  "window.addEventListener('popstate'",
  'history.pushState',
  'history.replaceState',
  'canonicalWrites:0',
  'autofixCalls:0',
  "detail=q.detail_id?all.find"
]) assert(extensionHtml.includes(marker), `missing Local-first Data marker: ${marker}`);

for (const forbidden of [
  'google.script.run',
  'SpreadsheetApp.',
  'UrlFetchApp.',
  'setValue(',
  'setValues(',
  'appendRow(',
  'deleteRow(',
  'insertRowAfter(',
  'XMLHttpRequest(',
  'fetch('
]) assert(!extensionHtml.includes(forbidden), `Local-first Data runtime gained forbidden authority/network primitive: ${forbidden}`);

assert(serviceSource.includes("DATA_EXTENSION_FILE: 'LocalFirstDataSpaExtension'"));
assert(serviceSource.includes('prhLocalFirstSpaInjectDataExtension_'));
assert(serviceSource.includes('data-prh-local-first-data-extension="1.0.0"'));
assert(packagerSource.includes("entry.name.endsWith('.html')"), 'candidate packager must include tracked top-level Data extension HTML');

const scriptMatch = extensionHtml.match(/<script data-prh-local-first-data-extension="1\.0\.0">([\s\S]*?)<\/script>/);
assert(scriptMatch, 'Data extension script not found');
const scriptSource = scriptMatch[1];

const sandbox = {
  console,
  URL,
  Intl,
  Set,
  location:{href:'https://example.test/?surface=local-first&lf_route=home&privacy=NORMAL'},
  history:{pushState(){},replaceState(){}},
  document:{body:{dataset:{}},getElementById(){return null;}},
  MutationObserver:function(){this.observe=function(){};},
  indexedDB:{},
  IDBKeyRange:{},
  setTimeout,
  clearTimeout
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(scriptSource, sandbox, { filename:'LocalFirstDataSpaExtension.html' });
assert(sandbox.__PRH_LF_DATA_EXTENSION__, 'Data extension must expose deterministic test surface');
assert.strictEqual(sandbox.__PRH_LF_DATA_EXTENSION__.schema, 'PRH_LOCAL_FIRST_DATA_EXTENSION_V1');
assert.strictEqual(sandbox.__PRH_LF_DATA_EXTENSION__.version, '1.0.0');
assert.strictEqual(sandbox.__PRH_LF_DATA_EXTENSION__.pageSize, 20);
assert.deepStrictEqual(Array.from(sandbox.__PRH_LF_DATA_EXTENSION__.safeQueryKeys), [
  'tx_page','tx_start','tx_end','tx_category','tx_account','tx_member','tx_detail'
]);

function provenance(record, fingerprint) {
  return {
    source_system:'SYNTHETIC_TEST',
    source_container:'data-lf-contract',
    source_record_id:record,
    source_fingerprint:fingerprint,
    identity_strategy:'EXTERNAL_ID',
    transform_version:'DATA-LF-TEST-v1',
    source_position:null
  };
}
function fp(ch){return String(ch).repeat(64)}
const snapshot = {
  status:'READY', schema:'PRH_LOCAL_READ_MODEL_V1', generation_id:'1'.repeat(64), revision:'1'.repeat(64),
  transactions:[
    {transaction_id:'tx-1',type:'expense',category_id:'c1',account_id:'a1',destination_account_id:null,member_id:'m1',provenance:provenance('row-1',fp('1'))},
    {transaction_id:'tx-2',type:'income',category_id:'c-missing',account_id:'a1',destination_account_id:null,member_id:'m1',provenance:provenance('row-2',fp('2'))},
    {transaction_id:'tx-3',type:'expense',category_id:'c1',account_id:'a-missing',destination_account_id:null,member_id:'m1',provenance:provenance('row-3',fp('3'))},
    {transaction_id:'tx-4',type:'transfer',category_id:'c1',account_id:'a1',destination_account_id:'a2',member_id:'m-missing',provenance:provenance('row-4',fp('4'))},
    {transaction_id:'tx-5',type:'expense',category_id:'c1',account_id:'a1',destination_account_id:null,member_id:'m1',provenance:provenance('row-5',fp('a'))},
    {transaction_id:'tx-6',type:'income',category_id:'c1',account_id:'a1',destination_account_id:null,member_id:'m1',provenance:provenance('row-6',fp('a'))}
  ],
  dimensions:[
    {dimension_key:'category|c1',kind:'category',dimension_id:'c1',label:'Дом'},
    {dimension_key:'account|a1',kind:'account',dimension_id:'a1',label:'Основной счёт'},
    {dimension_key:'account|a2',kind:'account',dimension_id:'a2',label:'Второй счёт'},
    {dimension_key:'member|m1',kind:'member',dimension_id:'m1',label:'Участник'}
  ]
};
const before = JSON.stringify(snapshot);
const dq = sandbox.__PRH_LF_DATA_EXTENSION__.buildDataQuality(snapshot);
assert.strictEqual(JSON.stringify(snapshot), before, 'Data Quality scan must be read-only');
assert.strictEqual(dq.total, 6);
assert.strictEqual(dq.problem_count, 4);
const counts = Object.fromEntries(Array.from(dq.findings, (item) => [item.code, item.count]));
assert.deepStrictEqual(counts, {
  CATEGORY_DIMENSION_MISSING:1,
  ACCOUNT_DIMENSION_MISSING:1,
  MEMBER_DIMENSION_MISSING:1,
  DUPLICATE_SOURCE_FINGERPRINT:1
});

const runtimeState = sandbox.__PRH_LF_DATA_EXTENSION__.getState();
assert.strictEqual(runtimeState.networkCalls, 0);
assert.strictEqual(runtimeState.googleSheetsReads, 0);
assert.strictEqual(runtimeState.canonicalWrites, 0);
assert.strictEqual(runtimeState.autofixCalls, 0);

console.log('local_first_data_runtime_contract_test: PASS', {
  sameVerifiedSnapshot:true,
  browserSnapshotStatus:'READY',
  transactionPageSize:20,
  filteredDetailOnly:true,
  safeHistoryKeys:contract.transactions.history_query_keys.length,
  dataQualityChecks:contract.data_quality.checks.length,
  deterministicProblemCount:dq.problem_count,
  zeroWarmNetwork:true,
  canonicalWrite:false,
  autofix:false,
  freeOnly:true
});