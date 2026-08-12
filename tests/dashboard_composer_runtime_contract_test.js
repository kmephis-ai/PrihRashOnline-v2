'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const privacyRuntimeSource = fs.readFileSync(path.join(root, 'PrivacyPresentationService.js'), 'utf8');
const privacyStudioSource = fs.readFileSync(path.join(root, 'PrivacyStudioControlService.js'), 'utf8');
const composerStudioSource = fs.readFileSync(path.join(root, 'DashboardComposerStudioControlService.js'), 'utf8');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'FinancialHomeWebApp.html'), 'utf8');
const studioHtml = fs.readFileSync(path.join(root, 'AnalyticsStudioWebApp.html'), 'utf8');
const composerHtml = fs.readFileSync(path.join(root, 'DashboardComposerWebApp.html'), 'utf8');

function output(content) {
  return {
    setTitle() { return this; },
    addMetaTag() { return this; },
    getContent() { return content; }
  };
}

let privateReads = 0;
let legacyReads = 0;
const context = vm.createContext({
  console, Object, Array, String, Number, Boolean, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  HtmlService: {
    createHtmlOutputFromFile(name) {
      if (name === 'FinancialHomeWebApp') return output(homeHtml);
      if (name === 'AnalyticsStudioWebApp') return output(studioHtml);
      if (name === 'DashboardComposerWebApp') return output(composerHtml);
      throw new Error(`UNEXPECTED_HTML_FILE:${name}`);
    },
    createHtmlOutput(content) { return output(String(content)); }
  },
  prhR2BuildFinancialHomeRuntime_() {
    privateReads += 1;
    return {
      schema: 'PRH_FINANCIAL_HOME_VIEW_V1', contract_version: '1.0.0', currency: 'RUB',
      financial_truth_policy: 'FIN-TRUTH-v1', kpi_dictionary_version: '1.0.0',
      period: { kind: 'FULL_INPUT_SET', start: null, end: null, partial: false, day_count: null, proration: 'NONE' },
      cards: {}, alerts: [], visual_data: { cash_flow_minor: [], expense_mix: [] },
      provenance: { financial_values: 'SYNTHETIC_CONTRACT_FIXTURE', ui_financial_formula_used: false }
    };
  },
  prhGetWebDashboardData() { legacyReads += 1; return { legacy: true }; },
  prhRenderWebDashboard_(data) { return output(`<html><body>${JSON.stringify(data)}</body></html>`); }
});
vm.runInContext(privacyRuntimeSource, context, { filename: 'PrivacyPresentationService.js' });
vm.runInContext(privacyStudioSource, context, { filename: 'PrivacyStudioControlService.js' });
vm.runInContext(composerStudioSource, context, { filename: 'DashboardComposerStudioControlService.js' });
vm.runInContext(routerSource, context, { filename: 'CanonicalR2WebAppService.js' });

assert.strictEqual(context.PRH_CANONICAL_R2_WEB.COMPOSER_SURFACE, 'composer');
assert.strictEqual(context.prhR2ResolveSurface_('composer'), 'composer');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.LIVE_SURFACES.composer.financial_runtime, false);
assert.deepStrictEqual(Array.from(context.PRH_CANONICAL_R2_WEB.NAVIGATION, (item) => item[0]), ['home','studio']);
for (const route of ['transactions','expenses','income','cash-flow','budget','obligations','data-quality']) {
  assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH[route].navigation, 'HIDDEN');
}
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.ROUTE_TRUTH.studio.navigation, 'PRIMARY');

privateReads = 0;
const studio = context.doGet({ parameter: { surface: 'studio', mode: 'studio', privacy: 'masked' } }).getContent();
assert.strictEqual(privateReads, 0, 'Studio must not read financial runtime');
assert(studio.includes('data-dash080-composer-launcher="1"'));
assert(studio.includes('data-dash080-responsive-launcher="1"'));
assert(studio.includes('href="?surface=composer"'));
assert(studio.includes('<span class="status ready">READY</span>'));
assert(!studio.includes('<b>Dashboard composer</b><small>DASH-080</small><span class="status future">UPCOMING</span>'));
assert(!/amount_minor|income_minor|expense_minor|cash_flow_minor/.test(studio));

privateReads = 0;
const composer = context.doGet({ parameter: { surface: 'composer' } }).getContent();
assert.strictEqual(privateReads, 0, 'Composer must not read financial runtime');
assert.strictEqual(legacyReads, 0);
assert(composer.includes('data-prh-dashboard-composer="1"'));
assert(composer.includes('data-persistence="SESSION_ONLY"'));
assert(composer.includes('data-financial-runtime-fetch="false"'));
assert(composer.includes('data-semantic-binding="UNBOUND"'));
assert(composer.includes('data-active-surface="composer"'));
assert(composer.includes('PRH_DASHBOARD_COMPOSER_V1'));
assert(composer.includes('PRH_DASHBOARD_SPEC_V1'));
assert(composer.includes('UNBOUND • DASH-081'));
assert(composer.includes('?surface=studio&mode=studio'));
assert(composer.includes('?surface=home'));
assert(!composer.includes('?surface=transactions'));
assert(!composer.includes('?surface=expenses'));
assert(!composer.includes('google.script.run'));
assert(!composer.includes('localStorage'));
assert(!composer.includes('sessionStorage'));
assert(!composer.includes('<?!='));
assert(!/amount_minor|income_minor|expense_minor|cash_flow_minor|balance_minor|AnalyticsQuery|ChartSpec/.test(composer));

const defaultHome = context.doGet({ parameter: {} }).getContent();
assert.strictEqual(privateReads, 0, 'Default Home HTML must render before private financial read');
assert(defaultHome.includes('data-active-surface="home"'));
assert(defaultHome.includes('PRH_R2_HOME_ASYNC_BOOTSTRAP_V1'));
assert.strictEqual(legacyReads, 0);
context.prhR2FetchFinancialHomePayload('NORMAL');
assert.strictEqual(privateReads, 1, 'Async Home payload must perform exactly one runtime build in this fixture');

console.log('dashboard-composer-runtime: PASS', {
  surface: 'composer',
  composerPrivateReads: 0,
  studioPrivateReads: 0,
  initialHomePrivateReads: 0,
  asyncHomePrivateReads: 1,
  primaryNavigationTruthful: true,
  semanticBinding: 'UNBOUND',
  persistence: 'SESSION_ONLY'
});