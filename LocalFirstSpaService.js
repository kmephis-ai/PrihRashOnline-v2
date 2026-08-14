/**
 * SPA-LF-001 bounded Local-first preview renderer.
 *
 * This surface intentionally carries no household financial payload. It proves
 * the single-document/client-routing lifecycle before STORE/WORKER/SYNC are
 * connected. Canonical R2 remains the rollback/default surface until the
 * Local-first Product Gate passes.
 */
var PRH_LOCAL_FIRST_SPA_PREVIEW = Object.freeze({
  SCHEMA: 'PRH_LOCAL_FIRST_SPA_PREVIEW_V1',
  VERSION: '1.0.0',
  SURFACE: 'local-first',
  FILE: 'LocalFirstSpaWebApp',
  FINANCIAL_WRITE: false,
  CANONICAL_MUTATION: false,
  PRIVATE_PAYLOAD: false,
  FREE_ONLY: true
});

function prhLocalFirstSpaRender_(params) {
  var output = HtmlService.createHtmlOutputFromFile(PRH_LOCAL_FIRST_SPA_PREVIEW.FILE);
  output.setTitle('PrihRashOnline — Local-first preview');
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return output;
}

function prhLocalFirstSpaSmokeToken() {
  var output = prhLocalFirstSpaRender_({});
  var html = output && typeof output.getContent === 'function' ? output.getContent() : '';
  if (!html ||
      html.indexOf('data-prh-local-first-spa="1"') < 0 ||
      html.indexOf('history.pushState') < 0 ||
      html.indexOf('popstate') < 0 ||
      html.indexOf('data-lf-rollback="canonical-r2"') < 0 ||
      html.indexOf('window.__PRH_LF_SPA_RUNTIME__') < 0) {
    throw new Error('LF_SPA_RENDER_SMOKE_FAILED');
  }
  if (/google\.script\.run|\bfetch\s*\(|XMLHttpRequest\s*\(/.test(html)) {
    throw new Error('LF_SPA_WARM_NETWORK_PRIMITIVE_PRESENT');
  }
  if (/value_minor|amount_minor|balance_minor|PUBLIC_SYNTHETIC|SYN-TX-/.test(html)) {
    throw new Error('LF_SPA_FINANCIAL_PAYLOAD_OR_FIXTURE_PRESENT');
  }
  return 'PRH_LF_SPA_V1|SINGLE_DOCUMENT|ZERO_WARM_NETWORK|OK';
}
