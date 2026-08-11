'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const PRIVACY = require('../lib/privacy/privacy_presentation');

const root = path.join(__dirname, '..');
const privacyRuntimeSource = fs.readFileSync(path.join(root, 'PrivacyPresentationService.js'), 'utf8');
const privacyStudioSource = fs.readFileSync(path.join(root, 'PrivacyStudioControlService.js'), 'utf8');
const composerStudioSource = fs.readFileSync(path.join(root, 'DashboardComposerStudioControlService.js'), 'utf8');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'FinancialHomeWebApp.html'), 'utf8');
const studioHtml = fs.readFileSync(path.join(root, 'AnalyticsStudioWebApp.html'), 'utf8');

function output(content) {
  return {
    title: null,
    setTitle(value) { this.title = value; return this; },
    addMetaTag() { return this; },
    getContent() { return content; }
  };
}

const PRIVATE = {
  schema: 'PRH_FINANCIAL_HOME_VIEW_V1',
  contract_version: '1.0.0',
  status: 'READY',
  currency: 'RUB',
  financial_truth_policy: 'FIN-TRUTH-v1',
  kpi_dictionary_version: '1.0.0',
  period: { kind: 'FULL_INPUT_SET', start: null, end: null, partial: false, day_count: null, proration: 'NONE' },
  filter_context: { schema: 'PRH_FILTER_CONTEXT_V1', filters: [{ field: 'account_id', values: ['SECRET_FILTER'] }] },
  cards: {
    INCOME: { id: 'INCOME', state: 'READY', source_kpi: 'INCOME', value_minor: 918273645, currency: 'RUB', account_name: 'SECRET_ACCOUNT', drill: null },
    EXPENSE: { id: 'EXPENSE', state: 'READY', source_kpi: 'EXPENSE', value_minor: 817263544, currency: 'RUB', category_name: 'SECRET_CATEGORY', drill: null },
    CASH_FLOW: { id: 'CASH_FLOW', state: 'READY', source_kpi: 'CASH_FLOW', value_minor: 101010101, currency: 'RUB', drill: null },
    SAVINGS: { id: 'SAVINGS', state: 'READY', source_kpi: 'SAVINGS', value_minor: 202020202, currency: 'RUB', drill: null },
    BUDGET: { id: 'BUDGET', state: 'READY', budget_minor: 900000000, expense_minor: 817263544, variance_minor: 82736456, currency: 'RUB', drill: null },
    LIQUIDITY: { id: 'LIQUIDITY', state: 'UNAVAILABLE_PENDING_BALANCE_SOURCE', value_minor: null, currency: 'RUB', future_dependency: 'RUNTIME_BINDING', drill: null },
    ALERTS: { id: 'ALERTS', state: 'READY', count: 1, highest_severity: 'INFO', drill: null }
  },
  alerts: [{ code: 'SECRET_ALERT', severity: 'INFO' }],
  widgets: [{ id: 'SECRET_WIDGET', query_ref: 'SECRET_QUERY' }],
  visual_data: { cash_flow_minor: [333333333], expense_mix: [['SECRET_MIX', 444444444]] },
  provenance: { financial_values: 'PRIVATE_TEST_ONLY', ui_financial_formula_used: false }
};
const SECRET_TOKENS = [
  '918273645', '817263544', '101010101', '202020202', '900000000', '82736456', '333333333', '444444444',
  'SECRET_FILTER', 'SECRET_ACCOUNT', 'SECRET_CATEGORY', 'SECRET_ALERT', 'SECRET_WIDGET', 'SECRET_QUERY', 'SECRET_MIX'
];

let privateReads = 0;
let legacyReads = 0;
const context = vm.createContext({
  console, Object, Array, String, Number, Boolean, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  HtmlService: {
    createHtmlOutputFromFile(name) {
      if (name === 'FinancialHomeWebApp') return output(homeHtml);
      if (name === 'AnalyticsStudioWebApp') return output(studioHtml);
      throw new Error(`UNEXPECTED_HTML_FILE:${name}`);
    },
    createHtmlOutput(content) { return output(String(content)); }
  },
  prhR2BuildFinancialHomeRuntime_() {
    privateReads += 1;
    return JSON.parse(JSON.stringify(PRIVATE));
  },
  prhGetWebDashboardData() { legacyReads += 1; return { legacy: true }; },
  prhRenderWebDashboard_(data) { return output(`<html><body>${JSON.stringify(data)}</body></html>`); }
});
vm.runInContext(privacyRuntimeSource, context, { filename: 'PrivacyPresentationService.js' });
vm.runInContext(privacyStudioSource, context, { filename: 'PrivacyStudioControlService.js' });
vm.runInContext(composerStudioSource, context, { filename: 'DashboardComposerStudioControlService.js' });
vm.runInContext(routerSource, context, { filename: 'CanonicalR2WebAppService.js' });

assert.strictEqual(context.PRH_PRIVACY_PRESENTATION_RUNTIME.SECURITY_BOUNDARY, false);
assert.strictEqual(context.PRH_PRIVACY_PRESENTATION_RUNTIME.AUTHORIZATION_BOUNDARY, false);
assert.strictEqual(context.PRH_PRIVACY_PRESENTATION_RUNTIME.FINANCIAL_WRITE, false);
assert.strictEqual(context.PRH_PRIVACY_PRESENTATION_RUNTIME.FREE_ONLY, true);
assert.strictEqual(context.prhPrivacyResolveMode_('broken'), 'MASKED');

for (const mode of ['MASKED', 'ZEN']) {
  const nodeResult = PRIVACY.transformPresentation(PRIVATE, { mode, source: 'PRIVATE_AUTHORIZED_PRESENTATION' });
  const runtimeResult = context.prhPrivacyTransform_(PRIVATE, mode, 'PRIVATE_AUTHORIZED_PRESENTATION');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(runtimeResult.payload)), JSON.parse(JSON.stringify(nodeResult.payload)), `${mode} runtime parity`);
  assert.strictEqual(runtimeResult.security_boundary, false);
  const serialized = JSON.stringify(runtimeResult);
  for (const token of SECRET_TOKENS) assert.strictEqual(serialized.includes(token), false, `${mode} runtime leak: ${token}`);
}

privateReads = 0;
const maskedHtml = context.doGet({ parameter: { surface: 'home', privacy: 'masked' } }).getContent();
assert.strictEqual(privateReads, 1, 'MASKED reads canonical private view exactly once server-side');
assert(maskedHtml.includes('data-prh-privacy-mode="MASKED"'));
assert(maskedHtml.includes('data-prh-privacy-security-boundary="false"'));
assert(maskedHtml.includes('R2_PRIVATE_HOME_PAYLOAD_REQUIRED'));
for (const token of SECRET_TOKENS) assert.strictEqual(maskedHtml.includes(token), false, `MASKED DOM payload leak: ${token}`);
assert(maskedHtml.includes('"cash_flow_minor":[]'));
assert(maskedHtml.includes('"expense_mix":[]'));

privateReads = 0;
const invalidHtml = context.doGet({ parameter: { surface: 'home', privacy: 'invalid-mode' } }).getContent();
assert.strictEqual(privateReads, 1);
assert(invalidHtml.includes('data-prh-privacy-mode="MASKED"'));
for (const token of SECRET_TOKENS) assert.strictEqual(invalidHtml.includes(token), false, `invalid fail-safe leak: ${token}`);

privateReads = 0;
const zenHtml = context.doGet({ parameter: { surface: 'home', privacy: 'zen' } }).getContent();
assert.strictEqual(privateReads, 1, 'ZEN may inspect canonical private view server-side once');
assert(zenHtml.includes('data-prh-privacy-mode="ZEN"'));
assert(zenHtml.includes('data-prh-zen-safe="1"'));
assert(zenHtml.includes('data-prh-canonical-r2-shell="1"'));
assert(zenHtml.includes('data-active-surface="home"'));
assert(zenHtml.includes('Финансовые суммы, транзакции и частные измерения не переданы'));
for (const token of SECRET_TOKENS) assert.strictEqual(zenHtml.includes(token), false, `ZEN DOM payload leak: ${token}`);

privateReads = 0;
const demoHtml = context.doGet({ parameter: { surface: 'home', privacy: 'demo' } }).getContent();
assert.strictEqual(privateReads, 0, 'DEMO must not read private runtime');
assert(demoHtml.includes('data-prh-privacy-mode="DEMO"'));
assert(demoHtml.includes('PUBLIC_SYNTHETIC'));
assert(demoHtml.includes('DEMO_SYNTHETIC_NOT_FIN_TRUTH'));
assert(demoHtml.includes('"private_runtime_read":false'));
for (const token of SECRET_TOKENS) assert.strictEqual(demoHtml.includes(token), false, `DEMO contamination: ${token}`);

privateReads = 0;
const normalHtml = context.doGet({ parameter: { surface: 'home' } }).getContent();
assert.strictEqual(privateReads, 1);
assert(normalHtml.includes('data-prh-privacy-mode="NORMAL"'));
assert(normalHtml.includes('918273645'), 'NORMAL preserves already-authorized presentation values');

privateReads = 0;
const studioOutput = context.doGet({ parameter: { surface: 'studio', mode: 'studio', privacy: 'masked' } }).getContent();
assert.strictEqual(privateReads, 0, 'Studio privacy selector must not read private financial runtime');
assert(studioOutput.includes('id="prh-privacy-selector"'));
assert(studioOutput.includes('role="radiogroup"'));
assert(studioOutput.includes('data-privacy-choice="NORMAL"'));
assert(studioOutput.includes('data-privacy-choice="MASKED"'));
assert(studioOutput.includes('data-privacy-choice="DEMO"'));
assert(studioOutput.includes('data-privacy-choice="ZEN"'));
assert(studioOutput.includes('prh.privacyPresentation.mode.v1'));
assert(studioOutput.includes('JSON.stringify({schema:S,version:V,mode:a.dataset.privacyChoice})'));
assert(studioOutput.includes('data-dash080-composer-launcher="1"'));
assert(!/amount_minor|account_id|category_id|member_id|project_id/.test(studioOutput));

assert.strictEqual(legacyReads, 0);

console.log('privacy-presentation-runtime: PASS', {
  nodeRuntimeParity: ['MASKED', 'ZEN'],
  invalidFailSafe: 'MASKED',
  demoPrivateReads: 0,
  studioPrivateReads: 0,
  dashboardComposerAffordance: true,
  maskedPreRender: true,
  zenStructuralOnly: true,
  canonicalZenNavigation: true,
  securityBoundary: false
});
