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

function prhLocalFirstSpaSelfUrl_() {
  try {
    if (typeof ScriptApp !== 'undefined' && ScriptApp && typeof ScriptApp.getService === 'function') {
      var service = ScriptApp.getService();
      var url = service && typeof service.getUrl === 'function' ? service.getUrl() : '';
      if (url) return String(url).split('#')[0].split('?')[0];
    }
  } catch (error) {}
  return '';
}

function prhLocalFirstSpaEscapeAttr_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function prhLocalFirstSpaNormalizeRoute_(value) {
  var route = String(value == null ? '' : value).trim().toLowerCase();
  var allowed = {
    home: true,
    transactions: true,
    expenses: true,
    income: true,
    'cash-flow': true,
    'data-quality': true
  };
  return Object.prototype.hasOwnProperty.call(allowed, route) ? route : 'home';
}

function prhLocalFirstSpaNormalizePrivacy_(value) {
  var privacy = String(value == null ? '' : value).trim().toUpperCase();
  if (!privacy) return '';
  return ['NORMAL', 'MASKED', 'DEMO', 'ZEN'].indexOf(privacy) >= 0 ? privacy : 'MASKED';
}

function prhLocalFirstSpaBootstrap_(params) {
  params = params || {};
  var route = prhLocalFirstSpaNormalizeRoute_(params.lf_route);
  var privacy = prhLocalFirstSpaNormalizePrivacy_(params.privacy);
  var diagnostic = String(params.lf_diag == null ? '' : params.lf_diag).trim() === '1';
  var query = '?surface=local-first&lf_route=' + encodeURIComponent(route);
  if (privacy) query += '&privacy=' + encodeURIComponent(privacy);
  if (diagnostic) query += '&lf_diag=1';

  return '<script data-lf-server-bootstrap="1">(function(){' +
    'var boot=Object.freeze({route:' + JSON.stringify(route) + ',privacy:' + JSON.stringify(privacy) + ',diagnostic:' + (diagnostic ? 'true' : 'false') + '});' +
    'window.__PRH_LF_SERVER_BOOT__=boot;' +
    'try{history.replaceState({prhLfRoute:boot.route},"",location.pathname+' + JSON.stringify(query) + '+location.hash);}' +
    'catch(error){window.__PRH_LF_SERVER_BOOT_ERROR__="HISTORY_REPLACE_FAILED";}' +
    '})();</script>';
}

function prhLocalFirstSpaRender_(params) {
  var source = HtmlService.createHtmlOutputFromFile(PRH_LOCAL_FIRST_SPA_PREVIEW.FILE);
  var html = source.getContent();
  var selfUrl = prhLocalFirstSpaSelfUrl_();
  if (selfUrl) {
    var rollbackHref = prhLocalFirstSpaEscapeAttr_(selfUrl + '?surface=home');
    if (html.indexOf('data-lf-rollback="canonical-r2"') < 0 || html.indexOf('href="?surface=home"') < 0) {
      throw new Error('LF_SPA_ROLLBACK_MARKER_MISSING');
    }
    html = html.replace('href="?surface=home"', 'href="' + rollbackHref + '"');
  }

  var appScriptMarker = '<script>\n(function(){';
  if (html.indexOf(appScriptMarker) < 0) throw new Error('LF_SPA_APP_SCRIPT_MARKER_MISSING');
  html = html.replace(appScriptMarker, prhLocalFirstSpaBootstrap_(params) + '\n' + appScriptMarker);

  var output = HtmlService.createHtmlOutput(html);
  output.setTitle('PrihRashOnline — Local-first preview');
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return output;
}

function prhLocalFirstSpaSmokeToken() {
  var output = prhLocalFirstSpaRender_({});
  var html = output && typeof output.getContent === 'function' ? output.getContent() : '';
  if (!html ||
      html.indexOf('data-prh-local-first-spa="1"') < 0 ||
      html.indexOf('data-lf-server-bootstrap="1"') < 0 ||
      html.indexOf('history.replaceState') < 0 ||
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