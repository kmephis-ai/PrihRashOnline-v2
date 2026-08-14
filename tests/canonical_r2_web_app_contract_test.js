'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const privacyRuntimeSource = fs.readFileSync(path.join(root, 'PrivacyPresentationService.js'), 'utf8');
const routeBootstrapSource = fs.readFileSync(path.join(root, 'R2RouteBootstrapService.js'), 'utf8');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const legacySource = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');
const files = {
  FinancialHomeWebApp: fs.readFileSync(path.join(root, 'FinancialHomeWebApp.html'), 'utf8'),
  TransactionExplorerWebApp: fs.readFileSync(path.join(root, 'TransactionExplorerWebApp.html'), 'utf8'),
  FinancialSectionsWebApp: fs.readFileSync(path.join(root, 'FinancialSectionsWebApp.html'), 'utf8'),
  DataQualityWebApp: fs.readFileSync(path.join(root, 'DataQualityWebApp.html'), 'utf8')
};
const financialSectionsSource = files.FinancialSectionsWebApp;
const contract = JSON.parse(fs.readFileSync(path.join(root, 'lib', 'ui', 'canonical_r2_web_app.v1.json'), 'utf8'));
new vm.Script(privacyRuntimeSource, { filename:'PrivacyPresentationService.js' });
new vm.Script(routeBootstrapSource, { filename:'R2RouteBootstrapService.js' });
new vm.Script(routerSource, { filename:'CanonicalR2WebAppService.js' });

function output(content) {
  return { setTitle() { return this; }, addMetaTag() { return this; }, getContent() { return content; } };
}

let homeRuntimeCalls = 0;
let legacyCalls = 0;
const selfUrl = 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';
const context = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  ScriptApp:{ getService(){ return { getUrl(){ return selfUrl; } }; } },
  HtmlService:{
    createHtmlOutputFromFile(name){ if (!files[name]) throw new Error(`unexpected html file ${name}`); return output(files[name]); },
    createHtmlOutput(content){ return output(String(content)); }
  },
  prhR2BuildFinancialHomeRuntime_(){
    homeRuntimeCalls += 1;
    return {
      schema:'PRH_FINANCIAL_HOME_VIEW_V1',contract_version:'1.0.0',currency:'RUB',financial_truth_policy:'FIN-TRUTH-v1',kpi_dictionary_version:'1.0.0',
      period:{kind:'FULL_INPUT_SET',start:null,end:null,partial:false,day_count:null,proration:'NONE'},
      cards:{INCOME:{id:'INCOME',state:'READY',value_minor:100,currency:'RUB'}},alerts:[],visual_data:{cash_flow_minor:[],expense_mix:[]},
      provenance:{financial_values:'SYNTHETIC_CONTRACT_FIXTURE',ui_financial_formula_used:false}
    };
  },
  prhGetWebDashboardData(){ legacyCalls += 1; return {legacy:true}; },
  prhRenderWebDashboard_(data){ return output('<html><body data-legacy="1">'+JSON.stringify(data)+'</body></html>'); }
});
vm.runInContext(privacyRuntimeSource, context, { filename:'PrivacyPresentationService.js' });
vm.runInContext(routeBootstrapSource, context, { filename:'R2RouteBootstrapService.js' });
vm.runInContext(routerSource, context, { filename:'CanonicalR2WebAppService.js' });

assert.strictEqual(contract.schema, 'PRH_CANONICAL_R2_WEB_APP_V1');
assert.strictEqual(contract.version, '1.3.0');
assert.deepStrictEqual(contract.primary_navigation, ['home','transactions','expenses','income','cash-flow','data-quality']);
assert.deepStrictEqual(contract.hidden_unbound_routes, ['budget','obligations']);
assert.strictEqual(contract.synthetic_policy.private_runtime_fallback_allowed, false);
assert.strictEqual(contract.data_runtime.canonical_snapshot_reads_per_request, 1);
assert.strictEqual(contract.data_runtime.financial_write, false);
assert.strictEqual(contract.route_privacy_continuity.policy, 'PRESERVE_EXPLICIT_MODE');
assert.strictEqual(contract.trusted_delivery.render_smoke_token, 'PRH_WEBAPP_SMOKE_V5|R2|OK');
assert.strictEqual(contract.runtime_bindings.expenses.canonical_engine, 'PRH_EXPENSE_ANALYTICS_V1@1.0.0');
assert.strictEqual(contract.runtime_bindings.income.canonical_engine, 'PRH_INCOME_ANALYTICS_V1@1.0.0');
assert.strictEqual(contract.runtime_bindings['cash-flow'].canonical_engine, 'PRH_CASH_FLOW_DASHBOARD_V1@1.0.0');
for (const id of ['expenses','income','cash-flow']) {
  assert.strictEqual(contract.runtime_bindings[id].state, 'BOUND_READ_ONLY');
  assert.strictEqual(contract.runtime_bindings[id].navigation, 'PRIMARY');
  assert.strictEqual(contract.runtime_bindings[id].write_authority, false);
}

assert.match(financialSectionsSource, /function shellSurface\(\)/, 'FIN client must resolve initial section from canonical shell inside Apps Script iframe');
assert.match(financialSectionsSource, /history\.pushState\(\{prhFin:true,section:next\},'','\?'\+q\.toString\(\)\)/, 'warm navigation must preserve shared filter state using same-origin relative History query');
assert.doesNotMatch(financialSectionsSource, /history\.pushState\([^\n;]*https?:\/\//, 'FIN iframe History state must never receive an absolute external URL');
assert.doesNotMatch(financialSectionsSource, /history\.pushState\([^\n;]*url\.pathname/, 'canonical script.google.com path must never be passed into iframe pushState');
assert.match(financialSectionsSource, /existing&&existing\.generation===generation/, 'in-flight reuse must be generation-bound after filter state changes');
assert.match(financialSectionsSource, /existing\.waiters\.push\(waiter\)/, 'active click during same-generation prefetch must join the in-flight request instead of being dropped');
assert.match(financialSectionsSource, /entry\.generation!==generation/, 'late pre-filter RPC responses must be ignored');
assert.match(financialSectionsSource, /function filterStateFromForm\(\)/, 'owner-visible filters must come from one in-page form state');
assert.match(financialSectionsSource, /data-filter-navigation="IN_PAGE_RPC_STATE"/, 'FIN filter navigation must use in-page RPC state rather than top-level GET split state');
assert.match(financialSectionsSource, /function fallbackNavigate\(href\)/, 'History API failure must retain truthful canonical navigation fallback');
assert.match(routeBootstrapSource, /function prhR2InjectFinancialRouteBootstrap_\(html, params\)/, 'FIN deep links must retain bounded initial route bootstrap into HtmlService iframe');
assert.match(routeBootstrapSource, /history\.replaceState\(history\.state\|\|null,"","\?"\+q\.toString\(\)\)/, 'FIN route bootstrap must rehydrate initial iframe location.search with same-origin History API');

assert.strictEqual(context.PRH_CANONICAL_R2_WEB.VERSION, '1.3.0');
assert.deepStrictEqual(Array.from(context.PRH_CANONICAL_R2_WEB.NAVIGATION, (item) => item[0]), ['home','transactions','expenses','income','cash-flow','data-quality']);
for (const id of ['home','transactions','expenses','income','cash-flow','data-quality']) {
  assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH[id].navigation, 'PRIMARY');
  assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH[id].runtime_private_data, true);
  assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH[id].binding_state, 'BOUND_READ_ONLY');
}
for (const id of ['budget','obligations']) {
  assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH[id].navigation, 'HIDDEN');
  assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH[id].runtime_private_data, false);
}
for (const route of ['home','transactions','expenses','income','cash-flow','budget','obligations','data-quality','legacy','studio','composer']) {
  assert.strictEqual(context.prhR2ResolveSurface_(route), route);
}
assert.strictEqual(context.prhR2RouteHref_('expenses'), `${selfUrl}?surface=expenses`);
assert.strictEqual(context.prhR2RouteHref_('income'), `${selfUrl}?surface=income`);
assert.strictEqual(context.prhR2RouteHref_('cash-flow'), `${selfUrl}?surface=cash-flow`);
assert.strictEqual(context.prhR2RoutePrivacyParams_({privacy:'unexpected'}).privacy, 'MASKED');

const home = context.doGet({parameter:{}}).getContent();
assert.strictEqual(homeRuntimeCalls, 0, 'initial Home HTML must remain async');
for (const marker of ['>Главная</a>','>Операции</a>','>Расходы</a>','>Доходы</a>','>Денежный поток</a>','>Качество данных</a>','>Студия аналитики</a>','>Старый интерфейс</a>']) assert(home.includes(marker), `home missing ${marker}`);
for (const route of ['budget','obligations']) assert(!home.includes(`surface=${route}`), `unbound ${route} advertised`);
for (const route of ['transactions','expenses','income','cash-flow','data-quality']) assert(home.includes(`${selfUrl}?surface=${route}`), `bound ${route} missing`);
assert(home.includes('data-privacy-route-policy="PRESERVE_EXPLICIT_MODE"'));
assert(home.includes('R2_PRIVATE_HOME_PAYLOAD_REQUIRED'));
assert(!/SYN-TX-|PUBLIC_SYNTHETIC/.test(home));

const maskedHome = context.doGet({parameter:{privacy:'MASKED'}}).getContent();
assert.strictEqual(homeRuntimeCalls, 0, 'MASKED initial Home HTML must remain async');
for (const route of ['home','transactions','expenses','income','cash-flow','data-quality','legacy']) assert(maskedHome.includes(`${selfUrl}?surface=${route}&amp;privacy=MASKED`), `MASKED ${route} continuity missing`);
assert(maskedHome.includes(`${selfUrl}?surface=studio&amp;mode=explore&amp;privacy=MASKED`));

const tx = context.doGet({parameter:{surface:'transactions'}}).getContent();
assert(tx.includes('data-active-surface="transactions"'));
assert(tx.includes('data-private-runtime="READ_ONLY"'));
assert(tx.includes('prhR2FetchTransactionsPayload'));
assert(!/SYN-TX-|PUBLIC_SYNTHETIC/.test(tx));

for (const route of ['expenses','income','cash-flow']) {
  const html = context.doGet({parameter:{surface:route,privacy:'MASKED'}}).getContent();
  assert(html.includes(`data-active-surface="${route}"`));
  assert(html.includes('data-private-runtime="READ_ONLY"'));
  assert(html.includes('data-financial-authority="CANONICAL_FIN_TRUTH"'));
  assert(html.includes('prhR2FetchFinancialSectionsPayload'));
  assert(html.includes('name="window_days"'));
  assert(html.includes('id="prh-r2-financial-route-bootstrap"'));
  assert(html.indexOf('id="prh-r2-financial-route-bootstrap"') < html.indexOf("var TITLES={expenses:"), 'FIN route bootstrap must execute before client query() reads initial iframe location.search');
  assert(!html.includes(`data-r2-unbound-surface="${route}"`));
  assert(!/SYN-TX-|PUBLIC_SYNTHETIC/.test(html));
}

const filteredExpenses = context.doGet({parameter:{
  surface:'expenses',privacy:'NORMAL',window_days:'30',account_id:'ACC-1',category_id:'CAT-1',member_id:'MEM-1'
}}).getContent();
for (const marker of ['"surface":"expenses"','"privacy":"NORMAL"','"window_days":"30"','"account_id":"ACC-1"','"category_id":"CAT-1"','"member_id":"MEM-1"']) {
  assert(filteredExpenses.includes(marker), `filtered FIN iframe bootstrap missing ${marker}`);
}
const invalidBootstrap = context.prhR2FinancialRouteBootstrapParams_({surface:'expenses',privacy:'???',window_days:'31',account_id:'A'.repeat(161)});
assert.strictEqual(JSON.stringify(invalidBootstrap), JSON.stringify({surface:'expenses',privacy:'MASKED'}));

const dq = context.doGet({parameter:{surface:'data-quality'}}).getContent();
assert(dq.includes('data-active-surface="data-quality"'));
assert(dq.includes('data-private-runtime="READ_ONLY"'));
assert(dq.includes('prhR2FetchDataQualityPayload'));
assert.strictEqual(homeRuntimeCalls, 0, 'static private shells must not read private rows while rendering');

for (const route of ['budget','obligations']) {
  const html = context.doGet({parameter:{surface:route,privacy:'MASKED'}}).getContent();
  assert(html.includes(`data-r2-unbound-surface="${route}"`));
  assert(html.includes('Этот раздел ещё подключается к реальным данным'));
  assert(html.includes(`${selfUrl}?surface=home&amp;privacy=MASKED`));
}

const asyncPayload = context.prhR2FetchFinancialHomePayload('NORMAL');
assert.strictEqual(homeRuntimeCalls, 1);
assert.strictEqual(asyncPayload.schema, 'PRH_FINANCIAL_HOME_VIEW_V1');

const legacy = context.doGet({parameter:{surface:'legacy',view:'overview'}}).getContent();
assert.strictEqual(legacyCalls, 1);
assert(legacy.includes('data-legacy="1"'));

assert.strictEqual(context.prhCanonicalR2WebAppSmokeToken(), 'PRH_WEBAPP_SMOKE_V5|R2|OK');
assert.strictEqual(homeRuntimeCalls, 1, 'technical render smoke must not read private financial rows');
assert.doesNotMatch(routerSource, /setValue\s*\(|setValues\s*\(|appendRow\s*\(/);
assert.doesNotMatch(routeBootstrapSource, /setValue\s*\(|setValues\s*\(|appendRow\s*\(/);
assert.doesNotMatch(legacySource, /function\s+doGet\s*\(/);

console.log('canonical_r2_web_app_contract_test: OK', {
  version:'1.3.0',
  primaryRoutes:['home','transactions','expenses','income','cash-flow','data-quality'],
  hiddenUnboundRoutes:2,
  financialSectionsAsync:true,
  warmNavigationIframeSafe:true,
  sharedFilterState:true,
  generationBoundInflight:true,
  financialFilterInitialRouteBootstrap:true,
  privacyModeContinuity:'PRESERVE_EXPLICIT_MODE',
  financialWrite:false,
  smoke:'PRH_WEBAPP_SMOKE_V5|R2|OK'
});