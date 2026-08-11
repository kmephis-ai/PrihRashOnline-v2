'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const STUDIO = require('../lib/studio/analytics_studio_shell');

const root = path.join(__dirname, '..');
const privacyRuntimeSource = fs.readFileSync(path.join(root, 'PrivacyPresentationService.js'), 'utf8');
const privacyStudioSource = fs.readFileSync(path.join(root, 'PrivacyStudioControlService.js'), 'utf8');
const composerStudioSource = fs.readFileSync(path.join(root, 'DashboardComposerStudioControlService.js'), 'utf8');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');
const studioHtml = fs.readFileSync(path.join(root, 'AnalyticsStudioWebApp.html'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'FinancialHomeWebApp.html'), 'utf8');

assert.strictEqual(STUDIO.assertContract(), true);
assert.strictEqual(STUDIO.SCHEMA, 'PRH_ANALYTICS_STUDIO_SHELL_V1');
assert.strictEqual(STUDIO.VERSION, '1.0.0');
assert.deepStrictEqual(STUDIO.MODES, ['DAILY', 'EXPLORE', 'STUDIO']);
assert.strictEqual(STUDIO.CONTRACT.default_mode, 'DAILY');
assert.strictEqual(STUDIO.CONTRACT.runtime.private_exposure, 'MYSELF');
assert.strictEqual(STUDIO.CONTRACT.runtime.studio_financial_runtime_fetch, false);
assert.strictEqual(STUDIO.CONTRACT.runtime.synthetic_financial_preview_allowed, false);
assert.strictEqual(STUDIO.CONTRACT.runtime.default_route_changes, false);
assert.strictEqual(STUDIO.CONTRACT.runtime.free_only, true);
assert.ok(Object.values(STUDIO.CONTRACT.authority).every((value) => value === false));

const dailyCaps = new Set(STUDIO.CONTRACT.modes.DAILY.capabilities);
const exploreCaps = new Set(STUDIO.CONTRACT.modes.EXPLORE.capabilities);
const studioCaps = new Set(STUDIO.CONTRACT.modes.STUDIO.capabilities);
for (const capability of dailyCaps) assert(exploreCaps.has(capability));
for (const capability of exploreCaps) assert(studioCaps.has(capability));
assert.strictEqual(dailyCaps.has('DASHBOARD_COMPOSER_AFFORDANCE'), false);
assert.strictEqual(exploreCaps.has('DASHBOARD_COMPOSER_AFFORDANCE'), false);
assert.strictEqual(studioCaps.has('DASHBOARD_COMPOSER_AFFORDANCE'), true);
assert.strictEqual(STUDIO.CONTRACT.future_affordances.DASHBOARD_COMPOSER_AFFORDANCE.status, 'UPCOMING');
assert.strictEqual(STUDIO.CONTRACT.future_affordances.DASHBOARD_COMPOSER_AFFORDANCE.dependency, 'DASH-080');

const defaultPref = STUDIO.normalizePreference({});
assert.deepStrictEqual(defaultPref, {
  schema: STUDIO.PREFERENCE_SCHEMA,
  version: STUDIO.VERSION,
  mode: 'DAILY'
});
assert(Object.isFrozen(defaultPref));
assert.strictEqual(STUDIO.normalizePreference({ mode: 'explore' }).mode, 'EXPLORE');
assert.strictEqual(STUDIO.normalizePreference({ mode: 'studio' }).mode, 'STUDIO');
assert.throws(() => STUDIO.normalizePreference({ mode: 'EXPERT' }), /STUDIO080_MODE_INVALID/);
assert.throws(() => STUDIO.normalizePreference({ mode: 'EXPLORE', amount_minor: 1 }), /STUDIO080_FORBIDDEN_PAYLOAD_KEY/);
assert.throws(() => STUDIO.normalizePreference({ mode: 'EXPLORE', query: { measures: ['EXPENSE'] } }), /STUDIO080_FORBIDDEN_PAYLOAD_KEY/);
assert.throws(() => STUDIO.normalizePreference({ mode: 'EXPLORE', filters: [] }), /STUDIO080_FORBIDDEN_PAYLOAD_KEY/);
assert.throws(() => STUDIO.normalizePreference({ mode: 'EXPLORE', account_id: 'private' }), /STUDIO080_FORBIDDEN_PAYLOAD_KEY/);

assert.deepStrictEqual(STUDIO.resolveMode(), { mode: 'DAILY', source: 'DEFAULT', explicit_invalid: false });
assert.deepStrictEqual(STUDIO.resolveMode({ stored_preference: { mode: 'STUDIO' } }), { mode: 'STUDIO', source: 'PREFERENCE', explicit_invalid: false });
assert.deepStrictEqual(STUDIO.resolveMode({ url_mode: 'explore', stored_preference: { mode: 'STUDIO' } }), { mode: 'EXPLORE', source: 'URL', explicit_invalid: false });
assert.deepStrictEqual(STUDIO.resolveMode({ url_mode: 'unknown', stored_preference: { mode: 'STUDIO' } }), { mode: 'DAILY', source: 'URL_FAIL_SAFE', explicit_invalid: true });
assert.deepStrictEqual(STUDIO.resolveMode({ stored_preference: { mode: 'BROKEN' } }), { mode: 'DAILY', source: 'PREFERENCE', explicit_invalid: false });

for (const from of STUDIO.MODES) {
  for (const to of STUDIO.MODES) {
    const forward = STUDIO.transitionMode(from, to);
    assert.strictEqual(forward.mode, to);
    assert.strictEqual(forward.previous_mode, from);
    assert.strictEqual(forward.reversible, true);
    assert.strictEqual(forward.query_execution, false);
    assert.strictEqual(forward.financial_write, false);
    const reverse = STUDIO.transitionMode(to, from);
    assert.strictEqual(reverse.mode, from);
    assert.strictEqual(reverse.previous_mode, to);
  }
}
assert.strictEqual(STUDIO.transitionMode('BROKEN', 'EXPLORE').previous_mode, 'DAILY');
assert.throws(() => STUDIO.transitionMode('DAILY', 'BROKEN'), /STUDIO080_MODE_INVALID/);

assert.strictEqual(STUDIO.viewportClass(390), 'MOBILE');
assert.strictEqual(STUDIO.viewportClass(760), 'MOBILE');
assert.strictEqual(STUDIO.viewportClass(768), 'TABLET');
assert.strictEqual(STUDIO.viewportClass(1250), 'TABLET');
assert.strictEqual(STUDIO.viewportClass(1440), 'DESKTOP');
assert.throws(() => STUDIO.viewportClass(200), /STUDIO080_VIEWPORT_WIDTH_INVALID/);

const daily = STUDIO.shellDescriptor('DAILY');
const explore = STUDIO.shellDescriptor('EXPLORE');
const expert = STUDIO.shellDescriptor('STUDIO');
assert.strictEqual(daily.surface, 'home');
assert.strictEqual(explore.surface, 'studio');
assert.strictEqual(expert.surface, 'studio');
assert.strictEqual(daily.query_execution, false);
assert.strictEqual(explore.query_mutation, false);
assert.strictEqual(expert.financial_write, false);
assert.strictEqual(daily.future_affordances.length, 0);
assert.strictEqual(explore.future_affordances.length, 0);
assert(expert.future_affordances.length >= 4);
assert(expert.future_affordances.every((item) => item.status === 'UPCOMING'));
assert.strictEqual(STUDIO.modeHref('DAILY'), '?surface=home&mode=daily');
assert.strictEqual(STUDIO.modeHref('EXPLORE'), '?surface=studio&mode=explore');
assert.strictEqual(STUDIO.modeHref('STUDIO'), '?surface=studio&mode=studio');

const telemetry = STUDIO.telemetry({ mode: 'STUDIO', previous_mode: 'EXPLORE', source: 'USER', viewport_class: 'DESKTOP' });
assert.deepStrictEqual(Object.keys(telemetry).sort(), STUDIO.CONTRACT.telemetry_allowlist.slice().sort());
assert.strictEqual(telemetry.mode, 'STUDIO');
assert.strictEqual(telemetry.previous_mode, 'EXPLORE');
const telemetryText = JSON.stringify(telemetry).toLowerCase();
for (const forbidden of ['amount', 'expense', 'query', 'filter', 'account', 'category', 'member', 'project']) {
  assert.strictEqual(telemetryText.includes(forbidden), false, forbidden);
}

assert(studioHtml.includes('data-prh-studio-shell="1"'));
assert(studioHtml.includes('role="tablist"'));
assert(studioHtml.includes('ArrowLeft'));
assert(studioHtml.includes('ArrowRight'));
assert(studioHtml.includes("event.key==='Home'"));
assert(studioHtml.includes("event.key==='End'"));
assert(studioHtml.includes('@media(prefers-reduced-motion:reduce)'));
assert(studioHtml.includes('prh.analyticsStudio.mode.v1'));
assert(studioHtml.includes("['schema','version','mode']"));
assert(!studioHtml.includes('google.script.run'));
assert(!studioHtml.includes('<?!='));
assert(!/amount_minor|income_minor|expense_minor|cash_flow_minor|balance_minor/i.test(studioHtml));

function output(content) {
  return { setTitle() { return this; }, addMetaTag() { return this; }, getContent() { return content; } };
}
let homeRuntimeCalls = 0;
let legacyCalls = 0;
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
  prhRenderWebDashboard_(data) { return output(`<html><body>${JSON.stringify(data)}</body></html>`); }
});
vm.runInContext(privacyRuntimeSource, context, { filename: 'PrivacyPresentationService.js' });
vm.runInContext(privacyStudioSource, context, { filename: 'PrivacyStudioControlService.js' });
vm.runInContext(composerStudioSource, context, { filename: 'DashboardComposerStudioControlService.js' });
vm.runInContext(routerSource, context, { filename: 'CanonicalR2WebAppService.js' });
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.DEFAULT_SURFACE, 'home');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.PRIVATE_EXPOSURE, 'MYSELF');
assert.strictEqual(context.PRH_CANONICAL_R2_WEB.STUDIO_SURFACE, 'studio');
assert.strictEqual(context.prhR2ResolveSurface_('studio'), 'studio');
assert.strictEqual(context.prhR2ResolveSurface_('unknown'), 'home');

const studioOutput = context.doGet({ parameter: { surface: 'studio', mode: 'explore' } }).getContent();
assert.strictEqual(homeRuntimeCalls, 0, 'Studio route must not fetch private financial runtime');
assert.strictEqual(legacyCalls, 0);
assert(studioOutput.includes('data-prh-studio-shell="1"'));
assert(studioOutput.includes('data-active-surface="studio"'));
assert(studioOutput.includes('data-r2-studio-launcher="1" aria-current="page"'));
assert(studioOutput.includes('?surface=home&mode=daily'));
assert(studioOutput.includes('data-dash080-composer-launcher="1"'));
assert(studioOutput.includes('href="?surface=composer"'));
assert(!studioOutput.includes('R2_PRIVATE_HOME_PAYLOAD_REQUIRED'));
assert(!/SYN-ACCOUNT|SYN-TX-|PUBLIC_SYNTHETIC/.test(studioOutput));

context.doGet({ parameter: {} });
assert.strictEqual(homeRuntimeCalls, 1, 'Daily default must keep canonical Financial Home runtime');
assert.strictEqual(legacyCalls, 0);

console.log('analytics-studio-shell-contract: PASS', {
  defaultMode: 'DAILY',
  modes: STUDIO.MODES,
  studioFinancialRuntimeFetch: false,
  dashboardComposerReady: true,
  privateExposure: 'MYSELF',
  freeOnly: true
});
