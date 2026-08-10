'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const legacySource = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'FinancialHomeWebApp.html'), 'utf8');
new vm.Script(routerSource, { filename: 'CanonicalR2WebAppService.js' });

function output(content) {
  return {
    setTitle() { return this; },
    addMetaTag() { return this; },
    getContent() { return content; }
  };
}

let homeRuntimeCalls = 0;
let legacyCalls = 0;
const context = vm.createContext({
  console,
  Object,
  Array,
  String,
  Number,
  Math,
  Date,
  RegExp,
  Error,
  JSON,
  encodeURIComponent,
  HtmlService: {
    createHtmlOutputFromFile(name) {
      assert.strictEqual(name, 'FinancialHomeWebApp');
      return output(homeHtml);
    },
    createHtmlOutput(content) { return output(String(content)); }
  },
  prhR2BuildFinancialHomeRuntime_() {
    homeRuntimeCalls += 1;
    return {
      schema: 'PRH_FINANCIAL_HOME_VIEW_V1', contract_version: '1.0.0', currency: 'RUB',
      financial_truth_policy: 'FIN-TRUTH-v1', kpi_dictionary_version: '1.0.0',
      period: { kind: 'FULL_INPUT_SET', start: null, end: null, partial: false, day_count: null, proration: 'NONE' },
      cards: {}, alerts: [], visual_data: { cash_flow_minor: [], expense_mix: [] },
      provenance: { financial_values: 'SYNTHETIC_CONTRACT_FIXTURE', ui_financial_formula_used: false }
    };
  },
  prhGetWebDashboardData() { legacyCalls += 1; return { legacy: true }; },
  prhRenderWebDashboard_(data) { return output('<html><body data-legacy="1">' + JSON.stringify(data) + '</body></html>'); }
});
vm.runInContext(routerSource, context, { filename: 'CanonicalR2WebAppService.js' });

assert.strictEqual(context.PRH_CANONICAL_R2_WEB.SCHEMA, 'PRH_CANONICAL_R2_WEB_APP_V1');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.DEFAULT_SURFACE, 'home');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.PRIVATE_EXPOSURE, 'MYSELF');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.FINANCIAL_WRITE, false);
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.CANONICAL_MUTATION, false);
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.FREE_ONLY, true);
assert.deepStrictEqual(Array.from(context.PRH_CANONICAL_R2_WEB.NAVIGATION, (item) => item[0]), [
  'home','transactions','expenses','income','cash-flow','budget','obligations','data-quality'
]);

for (const request of [undefined, '', 'unknown']) assert.strictEqual(context.prhR2ResolveSurface_(request), 'home');
for (const route of ['home','transactions','expenses','income','cash-flow','budget','obligations','data-quality','legacy']) {
  assert.strictEqual(context.prhR2ResolveSurface_(route), route);
}

const home = context.doGet({ parameter: {} }).getContent();
assert.strictEqual(homeRuntimeCalls, 1);
assert(home.includes('data-prh-canonical-r2-shell="1"'));
assert(home.includes('data-active-surface="home"'));
assert(home.includes('meta name="prh-canonical-r2"'));
assert(home.includes('"schema":"PRH_FINANCIAL_HOME_VIEW_V1"'));
assert(home.includes('?surface=transactions'));
assert(home.includes('?surface=expenses'));
assert(home.includes('?surface=income'));
assert(home.includes('?surface=cash-flow'));
assert(home.includes('?surface=budget'));
assert(home.includes('?surface=obligations'));
assert(home.includes('?surface=data-quality'));
assert(home.includes('?surface=legacy'));
assert(!home.includes('<?!= initialHomeData ?>'));

for (const route of ['transactions','expenses','income','cash-flow','budget','obligations','data-quality']) {
  const html = context.doGet({ parameter: { surface: route } }).getContent();
  assert(html.includes(`data-r2-unbound-surface="${route}"`), `${route} must fail closed until binding is proven`);
  assert(html.includes('RUNTIME_BINDING_NOT_PROVEN'));
  assert(html.includes(`data-active-surface="${route}"`));
  assert(html.includes('?surface=legacy'));
  assert(!/SYN-TX-|SYN-ACCOUNT|Synthetic family transaction|PUBLIC_SYNTHETIC/.test(html), `${route} leaked synthetic preview into private runtime`);
}
assert.strictEqual(homeRuntimeCalls, 1, 'unbound routes must not read financial runtime data');

const legacy = context.doGet({ parameter: { surface: 'legacy', view: 'overview' } }).getContent();
assert.strictEqual(legacyCalls, 1);
assert(legacy.includes('data-legacy="1"'));
assert(legacy.includes('"legacy":true'));

const smoke = context.prhCanonicalR2WebAppSmokeToken();
assert.strictEqual(smoke, 'PRH_WEBAPP_SMOKE_V3|R2|OK');
assert.strictEqual(homeRuntimeCalls, 1, 'technical smoke must not call the private financial runtime adapter');

const doGetCount = (routerSource.match(/function\s+doGet\s*\(/g) || []).length + (legacySource.match(/function\s+doGet\s*\(/g) || []).length;
assert.strictEqual(doGetCount, 1, 'canonical Web App must have one doGet authority');
assert.match(routerSource, /prhR2BuildFinancialHomeRuntime_\(\)/);
assert.doesNotMatch(routerSource, /PRH_R2_DOMAIN|generated bundle/i);
assert.doesNotMatch(routerSource, /setValue\s*\(|setValues\s*\(|appendRow\s*\(/);
assert.doesNotMatch(legacySource, /function\s+doGet\s*\(/);

console.log('canonical_r2_web_app_contract_test: OK', {
  defaultRoute: 'home',
  primaryNavigationCount: 8,
  liveBoundRoutes: ['home'],
  unboundPolicy: 'FAIL_CLOSED_NO_SYNTHETIC_TRUTH',
  legacyRollback: true,
  privateExposure: 'MYSELF',
  financialWrite: false,
  smoke: 'PRH_WEBAPP_SMOKE_V3|R2|OK'
});
