/**
 * UI-REC-001 truthful canonical R2 Web App router/runtime bridge.
 *
 * Financial Home remains the canonical default. Primary navigation contains
 * only proven user-facing destinations. Unbound financial routes remain
 * directly addressable for fail-closed diagnostics but are never advertised as
 * working household navigation. Studio is a proven read-only/configuration
 * destination; the legacy view remains a secondary emergency tool.
 */
var PRH_CANONICAL_R2_WEB = Object.freeze({
  SCHEMA: 'PRH_CANONICAL_R2_WEB_APP_V1',
  VERSION: '1.1.0',
  DEFAULT_SURFACE: 'home',
  ROUTE_PARAMETER: 'surface',
  LIVE_SURFACES: Object.freeze({
    home: Object.freeze({ file: 'FinancialHomeWebApp', placeholder: 'initialHomeData', title: 'Финансовый обзор', financial_runtime: true, runtime_private_data: true }),
    studio: Object.freeze({ file: 'AnalyticsStudioWebApp', placeholder: null, title: 'Студия аналитики', financial_runtime: false, runtime_private_data: false }),
    composer: Object.freeze({ file: 'DashboardComposerWebApp', placeholder: null, title: 'Конструктор', financial_runtime: false, runtime_private_data: false })
  }),
  SAFE_UNBOUND_SURFACES: Object.freeze({
    transactions: 'Транзакции',
    expenses: 'Расходы',
    income: 'Доходы',
    'cash-flow': 'Денежный поток',
    budget: 'Бюджет',
    obligations: 'Обязательства',
    'data-quality': 'Качество данных'
  }),
  ROUTE_TRUTH: Object.freeze({
    home: Object.freeze({ label: 'Главная', runtime_private_data: true, navigation: 'PRIMARY', binding_state: 'BOUND_READ_ONLY' }),
    studio: Object.freeze({ label: 'Студия аналитики', runtime_private_data: false, navigation: 'PRIMARY', binding_state: 'CONFIGURATION_ONLY' }),
    legacy: Object.freeze({ label: 'Старый интерфейс', runtime_private_data: true, navigation: 'SECONDARY', binding_state: 'BOUND_READ_ONLY' }),
    transactions: Object.freeze({ label: 'Транзакции', runtime_private_data: false, navigation: 'HIDDEN', binding_state: 'SAFE_UNBOUND' }),
    expenses: Object.freeze({ label: 'Расходы', runtime_private_data: false, navigation: 'HIDDEN', binding_state: 'SAFE_UNBOUND' }),
    income: Object.freeze({ label: 'Доходы', runtime_private_data: false, navigation: 'HIDDEN', binding_state: 'SAFE_UNBOUND' }),
    'cash-flow': Object.freeze({ label: 'Денежный поток', runtime_private_data: false, navigation: 'HIDDEN', binding_state: 'SAFE_UNBOUND' }),
    budget: Object.freeze({ label: 'Бюджет', runtime_private_data: false, navigation: 'HIDDEN', binding_state: 'SAFE_UNBOUND' }),
    obligations: Object.freeze({ label: 'Обязательства', runtime_private_data: false, navigation: 'HIDDEN', binding_state: 'SAFE_UNBOUND' }),
    'data-quality': Object.freeze({ label: 'Качество данных', runtime_private_data: false, navigation: 'HIDDEN', binding_state: 'SAFE_UNBOUND' })
  }),
  NAVIGATION: Object.freeze([
    Object.freeze(['home', 'Главная']),
    Object.freeze(['studio', 'Студия аналитики'])
  ]),
  STUDIO_SURFACE: 'studio',
  COMPOSER_SURFACE: 'composer',
  LEGACY_SURFACE: 'legacy',
  FINANCIAL_WRITE: false,
  CANONICAL_MUTATION: false,
  PRIVATE_EXPOSURE: 'MYSELF',
  FREE_ONLY: true
});

function prhR2EscapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function prhR2SerializeJson_(value) {
  return JSON.stringify(value == null ? {} : value).split('<').join(String.fromCharCode(92) + 'u003c');
}

function prhR2ResolveSurface_(requested) {
  var surface = String(requested || '').trim().toLowerCase();
  if (!surface) return PRH_CANONICAL_R2_WEB.DEFAULT_SURFACE;
  if (surface === PRH_CANONICAL_R2_WEB.LEGACY_SURFACE) return surface;
  if (Object.prototype.hasOwnProperty.call(PRH_CANONICAL_R2_WEB.LIVE_SURFACES, surface)) return surface;
  if (Object.prototype.hasOwnProperty.call(PRH_CANONICAL_R2_WEB.SAFE_UNBOUND_SURFACES, surface)) return surface;
  return PRH_CANONICAL_R2_WEB.DEFAULT_SURFACE;
}

function prhR2SelfUrl_() {
  try {
    if (typeof ScriptApp !== 'undefined' && ScriptApp && typeof ScriptApp.getService === 'function') {
      var service = ScriptApp.getService();
      var url = service && typeof service.getUrl === 'function' ? service.getUrl() : '';
      if (url) return String(url).split('#')[0].split('?')[0];
    }
  } catch (error) {}
  return '';
}

function prhR2RouteHref_(surface, extraParams) {
  var parts = ['surface=' + encodeURIComponent(String(surface || PRH_CANONICAL_R2_WEB.DEFAULT_SURFACE))];
  Object.keys(extraParams || {}).sort().forEach(function(key) {
    var value = extraParams[key];
    if (value == null || value === '') return;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
  });
  var base = prhR2SelfUrl_();
  return (base || '') + '?' + parts.join('&');
}

function prhR2NavigationHtml_(activeSurface) {
  var primary = PRH_CANONICAL_R2_WEB.NAVIGATION.map(function(item) {
    var id = item[0];
    var current = id === activeSurface ? ' aria-current="page"' : '';
    var studio = id === PRH_CANONICAL_R2_WEB.STUDIO_SURFACE;
    var href = studio ? prhR2RouteHref_(id, { mode: 'explore' }) : prhR2RouteHref_(id);
    var launcher = studio ? ' data-r2-studio-launcher="1" title="Студия аналитики"' : '';
    return '<a data-r2-nav="' + prhR2EscapeHtml_(id) + '"' + launcher + current +
      ' href="' + prhR2EscapeHtml_(href) + '">' + prhR2EscapeHtml_(item[1]) + '</a>';
  }).join('');
  var legacyCurrent = activeSurface === PRH_CANONICAL_R2_WEB.LEGACY_SURFACE ? ' aria-current="page"' : '';
  var secondary = '<a data-r2-nav="legacy" data-r2-emergency-rollback="1"' + legacyCurrent + ' href="' + prhR2EscapeHtml_(prhR2RouteHref_('legacy')) + '" title="Предыдущая версия интерфейса">Старый интерфейс</a>';
  return '<div id="prh-r2-shell" data-prh-canonical-r2-shell="1" data-navigation-policy="PROVEN_DESTINATIONS_ONLY" data-route-link-mode="SELF_URL" data-active-surface="' + prhR2EscapeHtml_(activeSurface) + '">' +
    '<nav id="prh-r2-canonical-nav" aria-label="Основная навигация PrihRashOnline">' + primary + '</nav>' +
    '<nav id="prh-r2-secondary-nav" aria-label="Дополнительные инструменты PrihRashOnline">' + secondary + '</nav></div>' +
    '<style id="prh-r2-canonical-nav-style">#prh-r2-shell{position:sticky;top:0;z-index:1000;display:flex;align-items:center;gap:10px;padding:8px 12px;background:#061d37;border-bottom:1px solid rgba(255,255,255,.16);font:600 13px/1.2 Inter,system-ui,sans-serif}#prh-r2-canonical-nav,#prh-r2-secondary-nav{display:flex;align-items:center;gap:6px}#prh-r2-canonical-nav{min-width:0;overflow-x:auto;scrollbar-width:none}#prh-r2-canonical-nav::-webkit-scrollbar{display:none}#prh-r2-secondary-nav{margin-left:auto}#prh-r2-shell a{color:#dbeafe;text-decoration:none;padding:8px 10px;border-radius:999px;border:1px solid transparent;white-space:nowrap}#prh-r2-shell a:hover,#prh-r2-shell a:focus-visible{background:#123f66;color:#fff}#prh-r2-shell a[aria-current="page"]{background:#fff;color:#061d37}#prh-r2-secondary-nav a{border-color:rgba(255,255,255,.18);color:#bfdbfe}@media(max-width:620px){#prh-r2-shell{gap:6px;padding:7px 8px}#prh-r2-canonical-nav{flex:1 1 auto}#prh-r2-secondary-nav{flex:0 0 auto;margin-left:0}#prh-r2-shell a{padding:7px 9px;font-size:12px}#prh-r2-secondary-nav a{max-width:92px;overflow:hidden;text-overflow:ellipsis}}</style>';
}

function prhR2InjectShell_(html, activeSurface) {
  var marker = '<meta name="prh-canonical-r2" content="' + prhR2EscapeHtml_(PRH_CANONICAL_R2_WEB.VERSION) + '">';
  var headEnd = html.indexOf('</head>');
  if (headEnd < 0) throw new Error('R2_SURFACE_HTML_STRUCTURE_INVALID');
  var bodyStart = html.indexOf('<body', headEnd + '</head>'.length);
  if (bodyStart < 0) throw new Error('R2_SURFACE_HTML_STRUCTURE_INVALID');
  var selfUrl = prhR2SelfUrl_();
  if (selfUrl) {
    var baseTag = '<base href="' + prhR2EscapeHtml_(selfUrl) + '" target="_top">';
    if (html.indexOf('<base target="_top">') >= 0) {
      html = html.replace('<base target="_top">', baseTag);
    } else if (html.indexOf('<head>') >= 0 && html.indexOf('<base ') < 0) {
      html = html.replace('<head>', '<head>' + baseTag);
    }
  }
  html = html.replace('</head>', marker + '</head>');
  headEnd = html.indexOf('</head>');
  bodyStart = html.indexOf('<body', headEnd + '</head>'.length);
  var bodyEnd = bodyStart < 0 ? -1 : html.indexOf('>', bodyStart);
  if (bodyEnd < 0) throw new Error('R2_SURFACE_BODY_INVALID');
  return html.slice(0, bodyEnd + 1) + prhR2NavigationHtml_(activeSurface) + html.slice(bodyEnd + 1);
}

function prhR2HardenPrivateHome_(html) {
  var previewParser = "function parse(){try{const text=document.getElementById('initial-home-data').textContent.trim();if(!text||text.indexOf('<?')===0)return SYN;return JSON.parse(text);}catch(e){return SYN;}}";
  var privateParser = "function parse(){const text=document.getElementById('initial-home-data').textContent.trim();if(!text||text.indexOf('<?')===0)throw new Error('R2_PRIVATE_HOME_PAYLOAD_REQUIRED');try{return JSON.parse(text);}catch(e){throw new Error('R2_PRIVATE_HOME_PAYLOAD_INVALID');}}";
  if (html.indexOf(previewParser) < 0) throw new Error('R2_HOME_SYNTHETIC_FALLBACK_SIGNATURE_MISSING');
  html = html.replace(previewParser, privateParser);
  if (html.indexOf('R2_PRIVATE_HOME_PAYLOAD_REQUIRED') < 0 || html.indexOf(previewParser) >= 0) {
    throw new Error('R2_HOME_PRIVATE_FAIL_CLOSED_HARDENING_FAILED');
  }
  return html;
}

function prhR2RenderFile_(surface, payload) {
  var spec = PRH_CANONICAL_R2_WEB.LIVE_SURFACES[surface];
  if (!spec) throw new Error('R2_LIVE_SURFACE_UNKNOWN');
  var output = HtmlService.createHtmlOutputFromFile(spec.file);
  var html = output.getContent();
  if (spec.placeholder) {
    var placeholder = '<' + '?!= ' + spec.placeholder + ' ?' + '>';
    if (html.indexOf(placeholder) < 0) throw new Error('R2_SURFACE_PAYLOAD_PLACEHOLDER_MISSING');
    html = html.replace(placeholder, prhR2SerializeJson_(payload));
  } else if (payload != null) {
    throw new Error('R2_STATIC_SURFACE_PAYLOAD_FORBIDDEN');
  }
  if (surface === 'home') html = prhR2HardenPrivateHome_(html);
  html = prhR2InjectShell_(html, surface);
  var rendered = HtmlService.createHtmlOutput(html);
  rendered.setTitle('PrihRashOnline — ' + spec.title);
  rendered.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return rendered;
}

function prhR2RenderUnavailable_(surface) {
  var title = PRH_CANONICAL_R2_WEB.SAFE_UNBOUND_SURFACES[surface];
  if (!title) throw new Error('R2_UNBOUND_SURFACE_UNKNOWN');
  var html = '<!doctype html><html lang="ru"><head><base target="_top"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#13243a;font:14px/1.5 Inter,system-ui,sans-serif}.r2-state{max-width:760px;margin:56px auto;padding:0 18px}.r2-card{background:#fff;border:1px solid #dbe3ec;border-radius:18px;padding:26px;box-shadow:0 8px 28px rgba(24,45,74,.08)}h1{margin:4px 0 10px;font-size:30px}.note{color:#617086}.back{display:inline-block;margin-top:18px;padding:9px 13px;border-radius:999px;background:#0b5d65;color:#fff;text-decoration:none;font-weight:700}@media(prefers-color-scheme:dark){body{background:#0b1220;color:#f2f6fb}.r2-card{background:#111b2c;border-color:#32445d}.note{color:#a9b8cb}}</style></head><body><main class="r2-state"><section class="r2-card" data-r2-unbound-surface="' + prhR2EscapeHtml_(surface) + '"><div class="note">PrihRashOnline</div><h1>' + prhR2EscapeHtml_(title) + '</h1><p>Этот раздел ещё подключается к реальным данным. Мы не показываем здесь демонстрационные значения вместо ваших финансов.</p><p class="note">Пока используйте финансовый обзор на главной странице.</p><a class="back" href="' + prhR2EscapeHtml_(prhR2RouteHref_('home')) + '">Вернуться на главную</a></section></main></body></html>';
  html = prhR2InjectShell_(html, surface);
  return HtmlService.createHtmlOutput(html).setTitle('PrihRashOnline — ' + title).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function prhR2RenderLegacy_(params) {
  var data = prhGetWebDashboardData(params.year, params.month, params.view);
  return prhRenderWebDashboard_(data);
}

function prhR2AsyncHomeMarker_(mode) {
  return {
    schema: 'PRH_R2_HOME_ASYNC_BOOTSTRAP_V1',
    version: '1.0.0',
    runtime_load: 'ASYNC',
    privacy_mode: mode
  };
}

function prhR2FetchFinancialHomePayload(privacyMode) {
  var mode = prhPrivacyResolveMode_(privacyMode);
  if (mode !== 'NORMAL' && mode !== 'MASKED') throw new Error('R2_HOME_ASYNC_MODE_FORBIDDEN');
  var privateView = prhR2BuildFinancialHomeRuntime_();
  var transformed = prhPrivacyTransform_(privateView, mode, PRH_PRIVACY_PRESENTATION_RUNTIME.PRIVATE_SOURCE);
  return transformed.payload;
}

function prhR2RenderHomeWithPrivacy_(params) {
  var mode = prhPrivacyResolveMode_(params[PRH_PRIVACY_PRESENTATION_RUNTIME.URL_PARAMETER]);
  if (mode === 'DEMO') {
    var demo = prhPrivacyTransform_(prhPrivacyDemoFinancialHome_(), 'DEMO', PRH_PRIVACY_PRESENTATION_RUNTIME.SYNTHETIC_SOURCE);
    return prhPrivacyDecorateOutput_(prhR2RenderFile_('home', demo.payload), demo.mode, demo.source, 'PrihRashOnline — Демо');
  }
  if (mode === 'ZEN') {
    var zenView = prhR2BuildFinancialHomeRuntime_();
    var zen = prhPrivacyTransform_(zenView, mode, PRH_PRIVACY_PRESENTATION_RUNTIME.PRIVATE_SOURCE);
    return prhPrivacyRenderZenCanonical_(zen);
  }
  return prhPrivacyDecorateOutput_(
    prhR2RenderFile_('home', prhR2AsyncHomeMarker_(mode)),
    mode,
    PRH_PRIVACY_PRESENTATION_RUNTIME.PRIVATE_SOURCE,
    'PrihRashOnline — Финансовый обзор'
  );
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var surface = prhR2ResolveSurface_(params[PRH_CANONICAL_R2_WEB.ROUTE_PARAMETER]);
  if (surface === PRH_CANONICAL_R2_WEB.LEGACY_SURFACE) return prhR2RenderLegacy_(params);
  if (surface === PRH_CANONICAL_R2_WEB.DEFAULT_SURFACE) return prhR2RenderHomeWithPrivacy_(params);
  if (surface === PRH_CANONICAL_R2_WEB.STUDIO_SURFACE) {
    return prhDashboardComposerDecorateStudioOutput_(prhPrivacyDecorateStudioOutput_(prhR2RenderFile_('studio', null), params[PRH_PRIVACY_PRESENTATION_RUNTIME.URL_PARAMETER]));
  }
  if (surface === PRH_CANONICAL_R2_WEB.COMPOSER_SURFACE) return prhR2RenderFile_('composer', null);
  return prhR2RenderUnavailable_(surface);
}

function prhR2SmokePayload_() {
  function unavailable(id) { return { id: id, state: 'UNAVAILABLE', value_minor: null, currency: 'RUB', drill: null }; }
  return {
    smoke: true,
    schema: 'PRH_FINANCIAL_HOME_VIEW_V1',
    contract_version: '1.0.0',
    currency: 'RUB',
    period: { kind: 'FULL_INPUT_SET', start: null, end: null, partial: false, day_count: null, proration: 'NONE' },
    financial_truth_policy: 'FIN-TRUTH-v1',
    kpi_dictionary_version: '1.0.0',
    cards: {
      INCOME: unavailable('INCOME'), EXPENSE: unavailable('EXPENSE'), CASH_FLOW: unavailable('CASH_FLOW'), SAVINGS: unavailable('SAVINGS'),
      BUDGET: { id: 'BUDGET', state: 'NOT_CONFIGURED', budget_minor: null, expense_minor: null, variance_minor: null, currency: 'RUB', drill: null },
      LIQUIDITY: { id: 'LIQUIDITY', state: 'UNAVAILABLE_PENDING_BALANCE_SOURCE', value_minor: null, currency: 'RUB', drill: null },
      ALERTS: { id: 'ALERTS', state: 'READY', count: 0, highest_severity: null, currency: 'RUB', drill: null }
    },
    alerts: [],
    visual_data: { cash_flow_minor: [], expense_mix: [] },
    provenance: { financial_values: 'TECHNICAL_SMOKE_ONLY', ui_financial_formula_used: false }
  };
}

function prhCanonicalR2WebAppSmokeToken() {
  var output = prhR2RenderFile_(PRH_CANONICAL_R2_WEB.DEFAULT_SURFACE, prhR2SmokePayload_());
  var html = output && typeof output.getContent === 'function' ? output.getContent() : '';
  if (!html || html.indexOf('data-prh-canonical-r2-shell="1"') < 0 ||
      html.indexOf('data-navigation-policy="PROVEN_DESTINATIONS_ONLY"') < 0 ||
      html.indexOf('data-route-link-mode="SELF_URL"') < 0 ||
      html.indexOf('data-active-surface="home"') < 0 || html.indexOf('Финансовый обзор') < 0 ||
      html.indexOf('"smoke":true') < 0 || html.indexOf('?surface=legacy') < 0 ||
      html.indexOf('Студия аналитики') < 0 || html.indexOf('R2_PRIVATE_HOME_PAYLOAD_REQUIRED') < 0) {
    throw new Error('R2_CANONICAL_RENDER_SMOKE_FAILED');
  }
  ['transactions','expenses','income','cash-flow','budget','obligations','data-quality'].forEach(function(surface) {
    if (html.indexOf('?surface=' + surface) >= 0) throw new Error('R2_CANONICAL_FALSE_AFFORDANCE_PRESENT');
  });
  if (html.indexOf('Показать контекст') >= 0 || html.indexOf('data-drill-card') >= 0) throw new Error('R2_CANONICAL_FALSE_HOME_ACTION_PRESENT');
  if (html.indexOf('<' + '?!= initialHomeData ?' + '>') >= 0) throw new Error('R2_CANONICAL_PAYLOAD_NOT_INJECTED');
  return 'PRH_WEBAPP_SMOKE_V4|R2|OK';
}