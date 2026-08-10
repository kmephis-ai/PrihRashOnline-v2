/**
 * UI-MIG-020 canonical R2 Web App router/runtime bridge.
 *
 * Default route is R2 Financial Home. Home receives private read-only data from
 * the parity-guarded FIN runtime adapter. Other R2 routes are visible in primary
 * navigation but fail closed until their private runtime binding is separately proven.
 * Synthetic preview values are never substituted for private runtime truth.
 * Legacy Dashboard remains an explicit bounded rollback route.
 */
var PRH_CANONICAL_R2_WEB = Object.freeze({
  SCHEMA: 'PRH_CANONICAL_R2_WEB_APP_V1',
  VERSION: '1.0.0',
  DEFAULT_SURFACE: 'home',
  ROUTE_PARAMETER: 'surface',
  LIVE_SURFACES: Object.freeze({
    home: Object.freeze({ file: 'FinancialHomeWebApp', placeholder: 'initialHomeData', title: 'Financial Home' })
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
  NAVIGATION: Object.freeze([
    Object.freeze(['home', 'Главная']),
    Object.freeze(['transactions', 'Транзакции']),
    Object.freeze(['expenses', 'Расходы']),
    Object.freeze(['income', 'Доходы']),
    Object.freeze(['cash-flow', 'Денежный поток']),
    Object.freeze(['budget', 'Бюджет']),
    Object.freeze(['obligations', 'Обязательства']),
    Object.freeze(['data-quality', 'Качество данных'])
  ]),
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
    .replace(/"/g, '&quot;')
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

function prhR2NavigationHtml_(activeSurface) {
  var links = PRH_CANONICAL_R2_WEB.NAVIGATION.map(function(item) {
    var id = item[0];
    var label = item[1];
    var current = id === activeSurface ? ' aria-current="page"' : '';
    return '<a data-r2-nav="' + prhR2EscapeHtml_(id) + '"' + current +
      ' href="?surface=' + encodeURIComponent(id) + '">' + prhR2EscapeHtml_(label) + '</a>';
  }).join('');
  return '<nav id="prh-r2-canonical-nav" data-prh-canonical-r2-shell="1" data-active-surface="' +
    prhR2EscapeHtml_(activeSurface) + '" aria-label="Основная навигация PrihRashOnline">' + links +
    '<a data-r2-nav="legacy" href="?surface=legacy" title="Ограниченный rollback route">Legacy</a></nav>' +
    '<style id="prh-r2-canonical-nav-style">#prh-r2-canonical-nav{position:sticky;top:0;z-index:1000;display:flex;gap:6px;overflow-x:auto;padding:9px 12px;background:#061d37;color:#fff;border-bottom:1px solid rgba(255,255,255,.16);font:600 13px/1.2 Inter,system-ui,sans-serif;scrollbar-width:thin}#prh-r2-canonical-nav a{flex:0 0 auto;color:#dbeafe;text-decoration:none;padding:8px 10px;border-radius:999px;border:1px solid transparent}#prh-r2-canonical-nav a:hover,#prh-r2-canonical-nav a:focus-visible{background:#123f66;color:#fff}#prh-r2-canonical-nav a[aria-current="page"]{background:#fff;color:#061d37}#prh-r2-canonical-nav a[data-r2-nav="legacy"]{margin-left:auto;border-color:rgba(255,255,255,.24);color:#bfdbfe}@media(max-width:620px){#prh-r2-canonical-nav a[data-r2-nav="legacy"]{margin-left:0}}</style>';
}

function prhR2InjectShell_(html, activeSurface) {
  var marker = '<meta name="prh-canonical-r2" content="' + prhR2EscapeHtml_(PRH_CANONICAL_R2_WEB.VERSION) + '">';
  if (html.indexOf('</head>') < 0 || html.indexOf('<body') < 0) throw new Error('R2_SURFACE_HTML_STRUCTURE_INVALID');
  html = html.replace('</head>', marker + '</head>');
  var bodyEnd = html.indexOf('>', html.indexOf('<body'));
  if (bodyEnd < 0) throw new Error('R2_SURFACE_BODY_INVALID');
  return html.slice(0, bodyEnd + 1) + prhR2NavigationHtml_(activeSurface) + html.slice(bodyEnd + 1);
}

function prhR2RenderFile_(surface, payload) {
  var spec = PRH_CANONICAL_R2_WEB.LIVE_SURFACES[surface];
  if (!spec) throw new Error('R2_LIVE_SURFACE_UNKNOWN');
  var output = HtmlService.createHtmlOutputFromFile(spec.file);
  var html = output.getContent();
  var placeholder = '<' + '?!= ' + spec.placeholder + ' ?' + '>';
  if (html.indexOf(placeholder) < 0) throw new Error('R2_SURFACE_PAYLOAD_PLACEHOLDER_MISSING');
  html = html.replace(placeholder, prhR2SerializeJson_(payload));
  if (surface === 'home') {
    html = html
      .replace(/Synthetic cash-flow trend/g, 'Cash-flow trend')
      .replace(/title="Synthetic"/g, 'title="Cash flow"')
      .replace(
        'До появления versioned balance-observation source (BAL-030) карточка остаётся явно недоступной.',
        'До подключения private balance runtime source карточка ликвидности остаётся явно недоступной.'
      );
  }
  html = prhR2InjectShell_(html, surface);
  var rendered = HtmlService.createHtmlOutput(html);
  rendered.setTitle('PrihRashOnline — ' + spec.title);
  rendered.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return rendered;
}

function prhR2RenderUnavailable_(surface, reasonCode) {
  var title = PRH_CANONICAL_R2_WEB.SAFE_UNBOUND_SURFACES[surface];
  if (!title) throw new Error('R2_UNBOUND_SURFACE_UNKNOWN');
  var html = '<!doctype html><html lang="ru"><head><base target="_top"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#10233f;font:14px/1.5 Inter,system-ui,sans-serif}.r2-state{max-width:900px;margin:56px auto;padding:0 18px}.r2-card{background:#fff;border:1px solid #d7e0ea;border-radius:18px;padding:24px;box-shadow:0 8px 24px rgba(16,35,63,.10)}h1{margin:0 0 8px;font-size:30px}.pill{display:inline-block;margin-top:14px;padding:6px 10px;border-radius:999px;background:#fff7e6;color:#704400;font-weight:700}.note{margin-top:18px;color:#52657d}@media(prefers-color-scheme:dark){body{background:#0b1220;color:#f3f7fc}.r2-card{background:#111b2c;border-color:#33445d}.note{color:#aebdd0}}</style></head><body><main class="r2-state"><section class="r2-card" data-r2-unbound-surface="' + prhR2EscapeHtml_(surface) + '"><div>PrihRashOnline • R2</div><h1>' + prhR2EscapeHtml_(title) + '</h1><p>Экран уже находится в canonical navigation, но его private runtime binding ещё не доказан machine gate. Synthetic preview здесь намеренно не показывается как реальные данные.</p><span class="pill">FAIL-CLOSED • ' + prhR2EscapeHtml_(reasonCode || 'RUNTIME_BINDING_NOT_PROVEN') + '</span><p class="note">Финансовые данные не изменяются. Для ограниченного rollback доступен маршрут Legacy.</p></section></main></body></html>';
  html = prhR2InjectShell_(html, surface);
  return HtmlService.createHtmlOutput(html).setTitle('PrihRashOnline — ' + title).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function prhR2RenderLegacy_(params) {
  var data = prhGetWebDashboardData(params.year, params.month, params.view);
  return prhRenderWebDashboard_(data);
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var surface = prhR2ResolveSurface_(params[PRH_CANONICAL_R2_WEB.ROUTE_PARAMETER]);
  if (surface === PRH_CANONICAL_R2_WEB.LEGACY_SURFACE) return prhR2RenderLegacy_(params);
  if (surface === PRH_CANONICAL_R2_WEB.DEFAULT_SURFACE) {
    return prhR2RenderFile_('home', prhR2BuildFinancialHomeRuntime_());
  }
  return prhR2RenderUnavailable_(surface, 'RUNTIME_BINDING_NOT_PROVEN');
}

function prhR2SmokePayload_() {
  function unavailable(id) {
    return { id: id, state: 'UNAVAILABLE', value_minor: null, currency: 'RUB', drill: null };
  }
  return {
    smoke: true,
    schema: 'PRH_FINANCIAL_HOME_VIEW_V1',
    contract_version: '1.0.0',
    currency: 'RUB',
    period: { kind: 'FULL_INPUT_SET', start: null, end: null, partial: false, day_count: null, proration: 'NONE' },
    financial_truth_policy: 'FIN-TRUTH-v1',
    kpi_dictionary_version: '1.0.0',
    cards: {
      INCOME: unavailable('INCOME'),
      EXPENSE: unavailable('EXPENSE'),
      CASH_FLOW: unavailable('CASH_FLOW'),
      SAVINGS: unavailable('SAVINGS'),
      BUDGET: { id: 'BUDGET', state: 'NOT_CONFIGURED', budget_minor: null, expense_minor: null, variance_minor: null, currency: 'RUB', drill: null },
      LIQUIDITY: { id: 'LIQUIDITY', state: 'UNAVAILABLE_PENDING_BALANCE_SOURCE', value_minor: null, currency: 'RUB', future_dependency: 'RUNTIME_BINDING', drill: null },
      ALERTS: { id: 'ALERTS', state: 'READY', value_minor: null, currency: 'RUB', drill: null }
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
      html.indexOf('data-active-surface="home"') < 0 || html.indexOf('Financial Home') < 0 ||
      html.indexOf('"smoke":true') < 0 || html.indexOf('?surface=legacy') < 0) {
    throw new Error('R2_CANONICAL_RENDER_SMOKE_FAILED');
  }
  if (html.indexOf('<' + '?!= initialHomeData ?' + '>') >= 0) throw new Error('R2_CANONICAL_PAYLOAD_NOT_INJECTED');
  return 'PRH_WEBAPP_SMOKE_V3|R2|OK';
}
