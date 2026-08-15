'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'lib', 'local_first', 'spa_shell.v1.json'), 'utf8'));
const architecture = JSON.parse(fs.readFileSync(path.join(root, 'lib', 'local_first', 'local_first_runtime.v1.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'LocalFirstSpaWebApp.html'), 'utf8');
const dataExtensionHtml = fs.readFileSync(path.join(root, 'LocalFirstDataSpaExtension.html'), 'utf8');
const serviceSource = fs.readFileSync(path.join(root, 'LocalFirstSpaService.js'), 'utf8');
const routerSource = fs.readFileSync(path.join(root, 'CanonicalR2WebAppService.js'), 'utf8');

assert.strictEqual(contract.schema, 'PRH_LOCAL_FIRST_SPA_SHELL_V1');
assert.strictEqual(contract.version, '1.0.0');
assert.strictEqual(contract.roadmap_id, 'SPA-LF-001');
assert.strictEqual(contract.architecture_contract, 'PRH_LOCAL_FIRST_RUNTIME_V1@1.0.0');
assert.strictEqual(contract.preview.server_surface, 'local-first');
assert.strictEqual(contract.preview.canonical_cutover, false);
assert.strictEqual(contract.preview.primary_navigation_before_product_gate, false);
assert.deepStrictEqual(contract.routes, ['home','transactions','expenses','income','cash-flow','data-quality']);
assert.strictEqual(contract.lifecycle.single_html_document, true);
assert.strictEqual(contract.lifecycle.router, 'HISTORY_API_PUSHSTATE_POPSTATE');
assert.strictEqual(contract.lifecycle.server_document_reload_on_warm_route, false);
assert.strictEqual(contract.lifecycle.renderer_runtime, 'APP_SINGLETON');
assert.strictEqual(contract.lifecycle.back_forward_server_reload, false);
assert.strictEqual(contract.lifecycle.chart_runtime_policy, 'APP_SINGLETON_WHEN_BOUND');
assert.strictEqual(contract.lifecycle.chart_vendor_activation, 'FIN-LF-001');
assert.deepStrictEqual(contract.warm_path, {
  mandatory_network_requests:0,
  google_sheets_reads:0,
  google_script_run_calls:0,
  fetch_calls:0,
  xhr_calls:0
});
assert.strictEqual(contract.presentation.synthetic_financial_values, false);
assert.strictEqual(contract.presentation.financial_payload_in_url_history, false);
assert.strictEqual(contract.data_boundary.indexeddb_bound, false);
assert.strictEqual(contract.data_boundary.worker_bound, false);
assert.strictEqual(contract.data_boundary.background_sync_bound, false);
assert.strictEqual(contract.data_boundary.financial_write, false);
assert.strictEqual(contract.data_boundary.canonical_mutation, false);
assert.strictEqual(contract.product_gate.exit_gate, 'MASTER-LF-SPA');
assert.strictEqual(contract.product_gate.fresh_owner_product_uat_required, true);
assert.strictEqual(contract.product_gate.manual_merge, false);
assert.strictEqual(contract.cost.class, 'FREE_ONLY');
assert.strictEqual(contract.cost.external_cdn_required, false);

assert.strictEqual(architecture.spa.single_document_shell, true);
assert.strictEqual(architecture.spa.client_side_history, true);
assert.strictEqual(architecture.spa.warm_route_requires_network, false);
assert.strictEqual(architecture.spa.warm_google_sheets_reads, 0);
assert.strictEqual(architecture.spa.renderer_runtime_reused, true);

new vm.Script(serviceSource, { filename:'LocalFirstSpaService.js' });
new vm.Script(routerSource, { filename:'CanonicalR2WebAppService.js' });

function output(content) {
  return {
    title:'',
    meta:[],
    setTitle(value){ this.title=String(value); return this; },
    addMetaTag(name,value){ this.meta.push([name,value]); return this; },
    getContent(){ return String(content); }
  };
}

let localFileReads = 0;
const context = vm.createContext({
  console, Object, Array, String, Number, Math, Date, RegExp, Error, JSON, encodeURIComponent,
  HtmlService:{
    createHtmlOutputFromFile(name){
      localFileReads += 1;
      if (name === 'LocalFirstSpaWebApp') return output(html);
      if (name === 'LocalFirstDataSpaExtension') return output(dataExtensionHtml);
      throw new Error(`unexpected HtmlService file: ${name}`);
    },
    createHtmlOutput(content){ return output(content); }
  }
});
vm.runInContext(serviceSource, context, { filename:'LocalFirstSpaService.js' });
vm.runInContext(routerSource, context, { filename:'CanonicalR2WebAppService.js' });

assert.strictEqual(context.PRH_LOCAL_FIRST_SPA_PREVIEW.SURFACE, 'local-first');
assert.strictEqual(context.PRH_LOCAL_FIRST_SPA_PREVIEW.DATA_EXTENSION_FILE, 'LocalFirstDataSpaExtension');
assert.strictEqual(context.PRH_LOCAL_FIRST_SPA_PREVIEW.PRIVATE_PAYLOAD, false);
assert.strictEqual(context.PRH_LOCAL_FIRST_SPA_PREVIEW.FINANCIAL_WRITE, false);
assert.strictEqual(context.PRH_LOCAL_FIRST_SPA_PREVIEW.CANONICAL_MUTATION, false);
assert.strictEqual(context.prhLocalFirstSpaSmokeToken(), 'PRH_LF_SPA_V1|SINGLE_DOCUMENT|ZERO_WARM_NETWORK|DATA_LOCAL_READ_ONLY|OK');
assert.strictEqual(context.prhR2ResolveSurface_('local-first'), 'local-first');

const preview = context.doGet({ parameter:{ surface:'local-first', lf_route:'expenses', privacy:'MASKED', lf_diag:'1' } });
const previewHtml = preview.getContent();
assert.notStrictEqual(previewHtml, html, 'server render must inject iframe-safe bootstrap state');
assert(previewHtml.includes('data-lf-server-bootstrap="1"'), 'server bootstrap marker missing');
assert(previewHtml.includes('data-prh-local-first-data-extension="1.0.0"'), 'Local-first Data extension must be injected');
assert(previewHtml.includes('history.replaceState'), 'server bootstrap must establish same-origin iframe history state');
assert(previewHtml.includes('?surface=local-first&lf_route=expenses&privacy=MASKED&lf_diag=1'), 'server bootstrap must preserve route/privacy/diagnostic params');
assert(previewHtml.indexOf('data-lf-server-bootstrap="1"') < previewHtml.indexOf('<script>\n(function(){'), 'server bootstrap must execute before SPA runtime');
assert(preview.title.includes('Local-first'));
assert.strictEqual(localFileReads, 4, 'smoke + route render must each read shell and data extension');
assert(!Array.from(context.PRH_CANONICAL_R2_WEB.NAVIGATION, (entry) => entry[0]).includes('local-first'), 'preview must not enter canonical primary navigation');

const safePreview = context.doGet({ parameter:{ surface:'local-first', lf_route:'unknown', privacy:'unexpected', lf_diag:'0' } }).getContent();
assert(safePreview.includes('?surface=local-first&lf_route=home&privacy=MASKED'), 'server bootstrap must fail closed to safe route/privacy state');
assert(!safePreview.includes('&lf_diag=1'), 'diagnostic must remain opt-in');
assert(safePreview.includes('data-prh-local-first-data-extension="1.0.0"'), 'safe route must keep Data extension available');
assert.strictEqual(localFileReads, 6, 'smoke + diagnostic route + safe route render must read two HTML files per render');

for (const marker of [
  'data-prh-local-first-spa="1"',
  'data-document-lifecycle="SINGLE"',
  'history.pushState',
  "window.addEventListener('popstate'",
  'window.__PRH_LF_SPA_RUNTIME__',
  'rendererLifecycle:\'APP_SINGLETON\'',
  'mandatoryNetworkCalls:0',
  'googleSheetsReads:0',
  'data-lf-rollback="canonical-r2"',
  'data-lf-diagnostic="route-to-paint"',
  'id="lf-diag-run"',
  'PRH_LF_ROUTE_TO_PAINT_DIAGNOSTIC_V1',
  'runDiagnostic:runRouteDiagnostic'
]) assert(html.includes(marker), `missing SPA marker ${marker}`);
for (const route of contract.routes) assert(html.includes(`data-lf-route="${route}"`), `missing route ${route}`);

for (const marker of [
  'data-prh-local-first-data-extension="1.0.0"',
  'window.__PRH_LF_DATA_EXTENSION__',
  'PRH_LOCAL_FIRST_DATA_EXTENSION_V1',
  "const DATA_ROUTES=Object.freeze(['transactions','data-quality'])",
  'googleSheetsReads:0',
  'canonicalWrites:0',
  'autofixCalls:0'
]) assert(dataExtensionHtml.includes(marker), `missing Data extension marker ${marker}`);

for (const serverMarker of [
  'prhLocalFirstSpaNormalizeRoute_',
  'prhLocalFirstSpaNormalizePrivacy_',
  'prhLocalFirstSpaBootstrap_',
  'prhLocalFirstSpaInjectDataExtension_',
  'data-lf-server-bootstrap="1"',
  'history.replaceState',
  'window.__PRH_LF_SERVER_BOOT__'
]) assert(serviceSource.includes(serverMarker), `missing server bootstrap marker ${serverMarker}`);

assert.doesNotMatch(html, /google\.script\.run|\bfetch\s*\(|XMLHttpRequest\s*\(/);
assert.doesNotMatch(dataExtensionHtml, /google\.script\.run|\bfetch\s*\(|XMLHttpRequest\s*\(/);
assert.doesNotMatch(serviceSource, /setValue\s*\(|setValues\s*\(|appendRow\s*\(/);
assert.doesNotMatch(routerSource, /LOCAL_FIRST_SURFACE[\s\S]{0,300}(setValue|setValues|appendRow)\s*\(/);
assert.doesNotMatch(previewHtml, /value_minor|amount_minor|balance_minor|SYN-TX-|PUBLIC_SYNTHETIC/);

console.log('local_first_spa_runtime_contract_test: OK', {
  routes:contract.routes.length,
  singleDocument:true,
  historyApi:true,
  serverIframeBootstrap:true,
  serverDiagnosticParam:true,
  dataExtensionInjected:true,
  zeroWarmNetwork:true,
  zeroGoogleReads:true,
  ownerRouteToPaintDiagnostic:true,
  canonicalCutover:false,
  financialWrite:false,
  freeOnly:true
});