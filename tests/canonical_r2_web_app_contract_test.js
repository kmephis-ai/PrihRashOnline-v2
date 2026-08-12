'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const privacyRuntimeSource = fs.readFileSync(path.join(root, 'PrivacyPresentationService.js'), 'utf8');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const legacySource = fs.readFileSync(path.join(root, 'DashboardWebDataService.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'FinancialHomeWebApp.html'), 'utf8');
const cutoverContract = JSON.parse(fs.readFileSync(path.join(root, 'lib', 'ui', 'canonical_r2_web_app.v1.json'), 'utf8'));
new vm.Script(privacyRuntimeSource, { filename: 'PrivacyPresentationService.js' });
new vm.Script(routerSource, { filename: 'CanonicalR2WebAppService.js' });

function output(content) {
  return { setTitle() { return this; }, addMetaTag() { return this; }, getContent() { return content; } };
}

let homeRuntimeCalls = 0;
let legacyCalls = 0;
const selfUrl = 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';
const context = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  ScriptApp: { getService() { return { getUrl() { return selfUrl; } }; } },
  HtmlService: {
    createHtmlOutputFromFile(name) { assert.strictEqual(name, 'FinancialHomeWebApp'); return output(homeHtml); },
    createHtmlOutput(content) { return output(String(content)); }
  },
  prhR2BuildFinancialHomeRuntime_() {
    homeRuntimeCalls += 1;
    return {
      schema: 'PRH_FINANCIAL_HOME_VIEW_V1', contract_version: '1.0.0', currency: 'RUB',
      financial_truth_policy: 'FIN-TRUTH-v1', kpi_dictionary_version: '1.0.0',
      period: { kind: 'FULL_INPUT_SET', start: null, end: null, partial: false, day_count: null, proration: 'NONE' },
      cards: { INCOME: { id: 'INCOME', state: 'READY', value_minor: 100, currency: 'RUB' } },
      alerts: [], visual_data: { cash_flow_minor: [], expense_mix: [] },
      provenance: { financial_values: 'SYNTHETIC_CONTRACT_FIXTURE', ui_financial_formula_used: false }
    };
  },
  prhGetWebDashboardData() { legacyCalls += 1; return { legacy: true }; },
  prhRenderWebDashboard_(data) { return output('<html><body data-legacy="1">' + JSON.stringify(data) + '</body></html>'); }
});
vm.runInContext(privacyRuntimeSource, context, { filename: 'PrivacyPresentationService.js' });
vm.runInContext(routerSource, context, { filename: 'CanonicalR2WebAppService.js' });

assert.strictEqual(cutoverContract.schema, 'PRH_CANONICAL_R2_WEB_APP_V1');
assert.strictEqual(cutoverContract.synthetic_policy.private_runtime_fallback_allowed, false);
assert.strictEqual(cutoverContract.synthetic_policy.unproven_binding_behavior, 'FAIL_CLOSED_NO_SYNTHETIC_TRUTH');
assert.strictEqual(cutoverContract.navigation_link_mode, 'RUNTIME_SELF_URL_ABSOLUTE_WITH_TEST_FALLBACK');
assert.strictEqual(cutoverContract.home_data_delivery.mode, 'ASYNC_GOOGLE_SCRIPT_RUN');
assert.strictEqual(cutoverContract.home_data_delivery.initial_html_financial_read, false);
assert.strictEqual(cutoverContract.home_data_delivery.runtime_function, 'prhR2FetchFinancialHomePayload');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.SCHEMA, 'PRH_CANONICAL_R2_WEB_APP_V1');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.VERSION, '1.1.0');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.DEFAULT_SURFACE, 'home');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.PRIVATE_EXPOSURE, 'MYSELF');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.FINANCIAL_WRITE, false);
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.CANONICAL_MUTATION, false);
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.FREE_ONLY, true);
assert.deepStrictEqual(Array.from(context.PRH_CANONICAL_R2_WEB.NAVIGATION, (item) => item[0]), ['home','studio']);
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH.home.runtime_private_data, true);
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH.studio.navigation, 'PRIMARY');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH.studio.runtime_private_data, false);
for (const id of ['transactions','expenses','income','cash-flow','budget','obligations','data-quality']) {
  assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH[id].navigation, 'HIDDEN');
  assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH[id].runtime_private_data, false);
}

for (const request of [undefined, '', 'unknown']) assert.strictEqual(context.prhR2ResolveSurface_(request), 'home');
for (const route of ['home','transactions','expenses','income','cash-flow','budget','obligations','data-quality','legacy','studio','composer']) {
  assert.strictEqual(context.prhR2ResolveSurface_(route), route);
}
assert.strictEqual(context.prhR2RouteHref_('home'), `${selfUrl}?surface=home`);
assert.strictEqual(context.prhR2RouteHref_('studio', { mode: 'explore' }), `${selfUrl}?surface=studio&mode=explore`);
assert.strictEqual(context.prhR2RouteHref_('legacy'), `${selfUrl}?surface=legacy`);

const previewParser = "function parse(){try{const text=document.getElementById('initial-home-data').textContent.trim();if(!text||text.indexOf('<?')===0)return SYN;return JSON.parse(text);}catch(e){return SYN;}}";
const hardenedRawHome = context.prhR2HardenPrivateHome_(homeHtml);
assert(!hardenedRawHome.includes(previewParser));
assert(hardenedRawHome.includes('R2_PRIVATE_HOME_PAYLOAD_REQUIRED'));
assert(hardenedRawHome.includes('R2_PRIVATE_HOME_PAYLOAD_INVALID'));

const home = context.doGet({ parameter: {} }).getContent();
assert.strictEqual(homeRuntimeCalls, 0, 'initial NORMAL Home HTML must not block on financial runtime');
assert(home.includes('data-prh-canonical-r2-shell="1"'));
assert(home.includes('data-navigation-policy="PROVEN_DESTINATIONS_ONLY"'));
assert(home.includes('data-route-link-mode="SELF_URL"'));
assert(home.includes('data-active-surface="home"'));
assert(home.includes('meta name="prh-canonical-r2"'));
assert(home.includes('"schema":"PRH_R2_HOME_ASYNC_BOOTSTRAP_V1"'));
assert(home.includes('"runtime_load":"ASYNC"'));
assert(home.includes('R2_PRIVATE_HOME_PAYLOAD_REQUIRED'));
assert(home.includes(`href="${selfUrl}?surface=home"`));
assert(home.includes(`href="${selfUrl}?surface=studio&amp;mode=explore"`));
assert(home.includes(`href="${selfUrl}?surface=legacy"`));
assert(home.includes('data-r2-nav="home"'));
assert(home.includes('data-r2-nav="studio"'));
assert(home.includes('data-r2-studio-launcher="1"'));
assert(home.includes('>Главная</a>'));
assert(home.includes('>Студия аналитики</a>'));
assert(home.includes('>Старый интерфейс</a>'));
for (const route of ['transactions','expenses','income','cash-flow','budget','obligations','data-quality']) {
  assert(!home.includes(`surface=${route}`), `unbound ${route} must not be advertised in household navigation`);
}
assert(!home.includes('Показать контекст'));
assert(!home.includes('data-drill-card'));
assert(!home.includes('<?!= initialHomeData ?>'));

const asyncPayload = context.prhR2FetchFinancialHomePayload('NORMAL');
assert.strictEqual(homeRuntimeCalls, 1, 'async Home payload endpoint must perform the read-only runtime build');
assert.strictEqual(asyncPayload.schema, 'PRH_FINANCIAL_HOME_VIEW_V1');
assert(asyncPayload.cards && asyncPayload.cards.INCOME, 'async Home payload missing cards');
assert.throws(() => context.prhR2FetchFinancialHomePayload('ZEN'), /R2_HOME_ASYNC_MODE_FORBIDDEN/);

for (const route of ['transactions','expenses','income','cash-flow','budget','obligations','data-quality']) {
  const html = context.doGet({ parameter: { surface: route } }).getContent();
  assert(html.includes(`data-r2-unbound-surface="${route}"`), `${route} must fail closed until binding is proven`);
  assert(html.includes('Этот раздел ещё подключается к реальным данным'));
  assert(html.includes('Вернуться на главную'));
  assert(html.includes(`${selfUrl}?surface=home`));
  assert(!html.includes('RUNTIME_BINDING_NOT_PROVEN'));
  assert(!html.includes('FAIL-CLOSED'));
  assert(!/Synthetic preview|private runtime|machine gate|rollback route/i.test(html));
  assert(!/SYN-TX-|SYN-ACCOUNT|Synthetic family transaction|PUBLIC_SYNTHETIC/.test(html), `${route} leaked synthetic preview into private runtime`);
}
assert.strictEqual(homeRuntimeCalls, 1, 'unbound routes must not read financial runtime data');

const legacy = context.doGet({ parameter: { surface: 'legacy', view: 'overview' } }).getContent();
assert.strictEqual(legacyCalls, 1);
assert(legacy.includes('data-legacy="1"'));
assert(legacy.includes('"legacy":true'));

const smoke = context.prhCanonicalR2WebAppSmokeToken();
assert.strictEqual(smoke, 'PRH_WEBAPP_SMOKE_V4|R2|OK');
assert.strictEqual(homeRuntimeCalls, 1, 'technical smoke must not call the private financial runtime bridge');

const doGetCount = (routerSource.match(/function\s+doGet\s*\(/g) || []).length + (legacySource.match(/function\s+doGet\s*\(/g) || []).length;
assert.strictEqual(doGetCount, 1, 'canonical Web App must have one doGet authority');
assert.match(routerSource, /function\s+prhR2FetchFinancialHomePayload\s*\(/);
assert.match(routerSource, /prhR2BuildFinancialHomeRuntime_\(\)/);
assert.match(routerSource, /prhR2HardenPrivateHome_/);
assert.match(routerSource, /ScriptApp\.getService\(\)\.getUrl|service\.getUrl/);
assert.match(routerSource, /PROVEN_DESTINATIONS_ONLY/);
assert.doesNotMatch(routerSource, /setValue\s*\(|setValues\s*\(|appendRow\s*\(/);
assert.doesNotMatch(legacySource, /function\s+doGet\s*\(/);

console.log('canonical_r2_web_app_contract_test: OK', {
  defaultRoute: 'home',
  primaryNavigationCount: 2,
  liveBoundRoutes: ['home'],
  primaryStudioRoute: 'studio',
  hiddenUnboundRoutes: 7,
  navigationLinkMode: 'RUNTIME_SELF_URL_ABSOLUTE_WITH_TEST_FALLBACK',
  homeDataDelivery: 'ASYNC_GOOGLE_SCRIPT_RUN',
  initialHtmlFinancialRead: false,
  unboundPolicy: 'HUMAN_FAIL_CLOSED_NO_SYNTHETIC_TRUTH',
  privateHomeParseFallback: 'FAIL_CLOSED',
  legacyRollback: true,
  privateExposure: 'MYSELF',
  financialWrite: false,
  smoke: 'PRH_WEBAPP_SMOKE_V4|R2|OK'
});