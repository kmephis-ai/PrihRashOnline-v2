/**
 * Local-first SPA renderer.
 *
 * The server-rendered document carries no household financial payload. Starting
 * with FIN-LF-001, the trusted candidate packager may embed the tracked browser
 * Local-first runtime. That runtime can use google.script.run only for explicit
 * cold/background sync; warm route/filter interaction remains local-only.
 * Canonical R2 remains the bounded rollback surface until MASTER-LF-PRODUCT.
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

var PRH_LOCAL_FIRST_CACHE_NAMESPACE = Object.freeze({
  SCHEMA: 'PRH_LOCAL_FIRST_CACHE_NAMESPACE_V1',
  VERSION: '2',
  LEGACY_BOOT_TOKEN: "name:'prihrash-local-first-v1'",
  ACTIVE_BOOT_TOKEN: "name:'prihrash-local-first-v2'"
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

/**
 * Diagnostic reason codes are deliberately machine-readable and therefore can
 * be long unbroken tokens. Keep them visible to the owner without allowing a
 * fail-closed message to widen the SPA on phone-sized viewports.
 */
function prhLocalFirstSpaResponsiveGuard_() {
  return '<style data-lf-server-responsive-guard="1">' +
    '.diagnostic,.diagnostic-actions{min-width:0;max-width:100%}' +
    '#lf-diag-result{min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:break-word}' +
    '</style>';
}

/**
 * IndexedDB contains only a derived Local Read Model, never canonical financial
 * write authority. FIN-LF-001 tightened the canonical transaction wire shape
 * (nullable fields must physically survive JSON/IndexedDB transport), while the
 * financial revision can legitimately remain unchanged. Reusing a pre-contract
 * cache would therefore make an old structurally-incompatible generation look
 * current. A cache namespace bump is the bounded migration mechanism: the old
 * database is left untouched, the new namespace cold-bootstraps from canonical
 * source, and no owner data is fabricated or mutated.
 */
function prhLocalFirstSpaMigrateCacheNamespace_(html) {
  var source = String(html || '');
  var legacy = PRH_LOCAL_FIRST_CACHE_NAMESPACE.LEGACY_BOOT_TOKEN;
  var active = PRH_LOCAL_FIRST_CACHE_NAMESPACE.ACTIVE_BOOT_TOKEN;
  if (source.indexOf(active) >= 0) return source;
  if (source.indexOf(legacy) < 0) throw new Error('LF_SPA_CACHE_NAMESPACE_MARKER_MISSING');
  return source.replace(legacy, active);
}

function prhLocalFirstSpaRender_(params) {
  var source = HtmlService.createHtmlOutputFromFile(PRH_LOCAL_FIRST_SPA_PREVIEW.FILE);
  var html = prhLocalFirstSpaMigrateCacheNamespace_(source.getContent());
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
  html = html.replace(
    appScriptMarker,
    prhLocalFirstSpaResponsiveGuard_() + '\n' + prhLocalFirstSpaBootstrap_(params) + '\n' + appScriptMarker
  );

  var output = HtmlService.createHtmlOutput(html);
  output.setTitle('PrihRashOnline — Local-first');
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return output;
}

function prhLocalFirstSpaSmokeToken() {
  var output = prhLocalFirstSpaRender_({});
  var html = output && typeof output.getContent === 'function' ? output.getContent() : '';
  if (!html ||
      html.indexOf('data-prh-local-first-spa="1"') < 0 ||
      html.indexOf('data-lf-server-responsive-guard="1"') < 0 ||
      html.indexOf('data-lf-server-bootstrap="1"') < 0 ||
      html.indexOf('history.replaceState') < 0 ||
      html.indexOf('history.pushState') < 0 ||
      html.indexOf('popstate') < 0 ||
      html.indexOf('data-lf-rollback="canonical-r2"') < 0 ||
      html.indexOf('window.__PRH_LF_SPA_RUNTIME__') < 0 ||
      html.indexOf(PRH_LOCAL_FIRST_CACHE_NAMESPACE.ACTIVE_BOOT_TOKEN) < 0 ||
      html.indexOf(PRH_LOCAL_FIRST_CACHE_NAMESPACE.LEGACY_BOOT_TOKEN) >= 0) {
    throw new Error('LF_SPA_RENDER_SMOKE_FAILED');
  }

  var hasInjectedRuntime = html.indexOf('data-prh-local-first-runtime="1.0.0"') >= 0 &&
    html.indexOf('PRH_LOCAL_FINANCE_RUNTIME_V1') >= 0 &&
    html.indexOf('PRH_LOCAL_ANALYTICS_WORKER_V1') >= 0;
  if (/\bfetch\s*\(|XMLHttpRequest\s*\(/.test(html)) {
    throw new Error('LF_SPA_UNBOUNDED_NETWORK_PRIMITIVE_PRESENT');
  }
  if (/google\.script\.run/.test(html) && !hasInjectedRuntime) {
    throw new Error('LF_SPA_UNTRUSTED_GOOGLE_SCRIPT_RUN_PRESENT');
  }
  if (/PUBLIC_SYNTHETIC|SYN-TX-/.test(html)) {
    throw new Error('LF_SPA_FIXTURE_PRESENT');
  }
  return 'PRH_LF_SPA_V1|SINGLE_DOCUMENT|ZERO_WARM_NETWORK|OK';
}
