'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const runtimeContract = JSON.parse(fs.readFileSync(path.join(root, 'lib', 'local_first', 'local_planning_runtime.v1.json'), 'utf8'));
const engineContract = JSON.parse(fs.readFileSync(path.join(root, 'lib', 'planning', 'local_planning_engine.v1.json'), 'utf8'));
const extensionHtml = fs.readFileSync(path.join(root, 'LocalFirstPlanningSpaExtension.html'), 'utf8');
const shellHtml = fs.readFileSync(path.join(root, 'LocalFirstSpaWebApp.html'), 'utf8');
const serviceSource = fs.readFileSync(path.join(root, 'LocalFirstSpaService.js'), 'utf8');
const planningServiceSource = fs.readFileSync(path.join(root, 'PlanningLocalFirstService.js'), 'utf8');
const browserMarker = JSON.parse(fs.readFileSync(path.join(root, 'local-first-browser-runtime.json'), 'utf8'));

assert.strictEqual(runtimeContract.schema, 'PRH_LOCAL_PLANNING_RUNTIME_V1');
assert.strictEqual(runtimeContract.version, '1.0.0');
assert.strictEqual(runtimeContract.roadmap_id, 'PLAN-REC-001');
assert.deepStrictEqual(runtimeContract.routes, ['budget','obligations','liquidity']);
assert.strictEqual(runtimeContract.sync.cold_or_background_only, true);
assert.strictEqual(runtimeContract.sync.warm_route_network_requests, 0);
assert.strictEqual(runtimeContract.sync.warm_route_google_sheets_reads, 0);
assert.strictEqual(runtimeContract.authority.canonical_financial_write, false);
assert.strictEqual(runtimeContract.authority.source_financial_write, false);
assert.strictEqual(runtimeContract.authority.auto_transaction_creation, false);
assert.strictEqual(runtimeContract.authority.cash_flow_as_balance_proxy, false);
assert.strictEqual(runtimeContract.authority.recurrence_inference, false);
assert.strictEqual(runtimeContract.authority.free_only, true);
assert.strictEqual(engineContract.owner_attestation, 'APPROVED');
assert.strictEqual(engineContract.authorities.financial_write, false);
assert.strictEqual(engineContract.authorities.cash_flow_as_balance_proxy, false);
assert(engineContract.invariants.includes('BUDGET_DETAIL_ROWS_NOT_RESUMMED'));
assert(engineContract.invariants.includes('MISSING_OBSERVATION_IS_UNKNOWN_NOT_ZERO'));

for (const marker of [
  'data-prh-local-first-planning-extension="1.0.0"',
  'PRH_LOCAL_FIRST_PLANNING_EXTENSION_V1',
  "const ROUTES=Object.freeze(['budget','obligations','liquidity'])",
  'Детальные строки автоматически не суммируются',
  'Плановые платежи не создают операции автоматически',
  'Cash Flow как остаток',
  'Отсутствующий остаток считается неизвестным, а не нулём',
  "if(ROUTES.indexOf(route())>=0)Promise.resolve().then(boot)",
  "if(!raw)return 'NORMAL';return ['NORMAL','MASKED','DEMO','ZEN'].includes(raw)?raw:'MASKED'",
  "function privateText(value,fallback){if(!valuesVisible())return 'Скрыто'"
]) assert(extensionHtml.includes(marker), `missing planning SPA marker: ${marker}`);

for (const route of ['budget','obligations','liquidity']) {
  assert(shellHtml.includes(`data-lf-route="${route}"`), `shell missing planning route ${route}`);
}
assert(serviceSource.includes("PLANNING_EXTENSION_FILE: 'LocalFirstPlanningSpaExtension'"));
assert(serviceSource.includes('prhLocalFirstSpaInjectPlanningExtension_'));
assert(serviceSource.includes('data-prh-local-first-planning-extension="1.0.0"'));
assert(browserMarker.modules.includes('pwa/local_planning_runtime.js'));

for (const forbidden of [
  'SpreadsheetApp.', 'UrlFetchApp.', 'setValue(', 'setValues(', 'appendRow(',
  'deleteRow(', 'insertRowAfter(', 'XMLHttpRequest(', 'fetch('
]) assert(!extensionHtml.includes(forbidden), `planning SPA gained forbidden source/network primitive: ${forbidden}`);

for (const writePrimitive of ['setValue(', 'setValues(', 'appendRow(', 'deleteRow(', 'insertRowAfter(', 'insertRowsAfter(']) {
  assert(!planningServiceSource.includes(writePrimitive), `planning source adapter gained write primitive: ${writePrimitive}`);
}
assert(planningServiceSource.includes("BUDGET_SCENARIO: 'Базовый'"));
assert(planningServiceSource.includes("BALANCE_SHEET: '06 Баланс'"));
assert(planningServiceSource.includes('CASH_FLOW_BALANCE_PROXY: false'));
assert(planningServiceSource.includes('AUTO_TRANSACTION_CREATION: false'));
assert(planningServiceSource.includes('PRH_PLANNING_LOCAL_FIRST.BALANCE_HEADERS)'));

const scriptMatch = extensionHtml.match(/<script data-prh-local-first-planning-extension="1\.0\.0">([\s\S]*?)<\/script>/);
assert(scriptMatch, 'planning extension script not found');
const sandbox = {
  console, URL, Intl, Object, Array, String, Number, Math, Date, RegExp, Error, Promise, Set,
  location:{href:'https://example.test/?surface=local-first&lf_route=home&privacy=NORMAL'},
  history:{replaceState(){}},
  document:{
    body:{dataset:{activeLfRoute:'home'}},
    getElementById(){return null;}
  },
  MutationObserver:function(){this.observe=function(){};},
  setTimeout, clearTimeout
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(scriptMatch[1], sandbox, {filename:'LocalFirstPlanningSpaExtension.html'});
assert(sandbox.__PRH_LF_PLANNING_EXTENSION__);
assert.strictEqual(sandbox.__PRH_LF_PLANNING_EXTENSION__.schema, 'PRH_LOCAL_FIRST_PLANNING_EXTENSION_V1');
assert.deepStrictEqual(Array.from(sandbox.__PRH_LF_PLANNING_EXTENSION__.routes), ['budget','obligations','liquidity']);
assert.strictEqual(sandbox.__PRH_LF_PLANNING_EXTENSION__.getState().booted, false, 'ordinary finance/data route must not cold-sync planning source');
assert.strictEqual(sandbox.__PRH_LF_PLANNING_EXTENSION__.getState().backgroundSyncCalls, 0);

console.log('local_first_planning_spa_contract_test: PASS', {
  ownerAuthority:true,
  routes:3,
  ordinaryRoutePlanningSync:false,
  warmNetwork:0,
  financialWrite:false,
  cashFlowBalanceProxy:false,
  freeOnly:true
});
