/**
 * UI-MIG-020 canonical R2 Web App router/runtime bridge.
 *
 * Safety:
 * - reads only through the existing Google operations gateway and settings;
 * - financial values are computed by the generated bundle from canonical lib sources;
 * - no financial write/storage authority is introduced;
 * - synthetic R2 previews are never used as private-runtime truth;
 * - legacy Dashboard remains an explicit bounded rollback surface.
 */
var PRH_CANONICAL_R2_WEB = Object.freeze({
  SCHEMA: 'PRH_CANONICAL_R2_WEB_APP_V1',
  VERSION: '1.0.0',
  DEFAULT_SURFACE: 'home',
  ROUTE_PARAMETER: 'surface',
  LIVE_SURFACES: Object.freeze({
    home: Object.freeze({ file: 'FinancialHomeWebApp', placeholder: 'initialHomeData', title: 'Financial Home' }),
    expenses: Object.freeze({ file: 'ExpenseAnalyticsWebApp', placeholder: 'initialExpenseData', title: 'Расходы' }),
    income: Object.freeze({ file: 'IncomeAnalyticsWebApp', placeholder: 'initialIncomeData', title: 'Доходы' }),
    'cash-flow': Object.freeze({ file: 'CashFlowWebApp', placeholder: 'initialCashFlowData', title: 'Cash Flow' })
  }),
  SAFE_UNBOUND_SURFACES: Object.freeze({
    transactions: 'Транзакции',
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
  html = prhR2InjectShell_(html, surface);
  var rendered = HtmlService.createHtmlOutput(html);
  rendered.setTitle('PrihRashOnline — ' + spec.title);
  rendered.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return rendered;
}

function prhR2RenderUnavailable_(surface, reasonCode) {
  var title = PRH_CANONICAL_R2_WEB.SAFE_UNBOUND_SURFACES[surface];
  if (!title) throw new Error('R2_UNBOUND_SURFACE_UNKNOWN');
  var html = '<!doctype html><html lang="ru"><head><base target="_top"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#10233f;font:14px/1.5 Inter,system-ui,sans-serif}.r2-state{max-width:900px;margin:56px auto;padding:0 18px}.r2-card{background:#fff;border:1px solid #d7e0ea;border-radius:18px;padding:24px;box-shadow:0 8px 24px rgba(16,35,63,.10)}h1{margin:0 0 8px;font-size:30px}.pill{display:inline-block;margin-top:14px;padding:6px 10px;border-radius:999px;background:#fff7e6;color:#704400;font-weight:700}.note{margin-top:18px;color:#52657d}@media(prefers-color-scheme:dark){body{background:#0b1220;color:#f3f7fc}.r2-card{background:#111b2c;border-color:#33445d}.note{color:#aebdd0}}</style></head><body><main class="r2-state"><section class="r2-card" data-r2-unbound-surface="' + prhR2EscapeHtml_(surface) + '"><div>PrihRashOnline • R2</div><h1>' + prhR2EscapeHtml_(title) + '</h1><p>Экран включён в canonical navigation, но private runtime binding для него не подтверждён. Synthetic preview здесь намеренно не показывается.</p><span class="pill">FAIL-CLOSED • ' + prhR2EscapeHtml_(reasonCode || 'RUNTIME_BINDING_NOT_PROVEN') + '</span><p class="note">Финансовые данные не изменяются. Для возврата к прежнему интерфейсу доступен bounded route Legacy.</p></section></main></body></html>';
  html = prhR2InjectShell_(html, surface);
  return HtmlService.createHtmlOutput(html).setTitle('PrihRashOnline — ' + title).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function prhR2DomainRequire_(id) {
  if (typeof PRH_R2_DOMAIN !== 'object' || !PRH_R2_DOMAIN || typeof PRH_R2_DOMAIN.require !== 'function') {
    throw new Error('R2_DOMAIN_BUNDLE_MISSING');
  }
  return PRH_R2_DOMAIN.require(id);
}

function prhR2Currency_() {
  var settings = getSettingsMap_();
  var currency = String(settings.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('R2_RUNTIME_CURRENCY_SETTING_REQUIRED');
  return currency;
}

function prhR2ReadFinTransactions_() {
  var adapter = prhR2DomainRequire_('lib/adapters/google_sheets_transaction_repository.js');
  var headers = ['ID', 'Дата и время', 'Тип', 'Сумма', 'Счёт', 'Счёт назначения', 'Категория', 'Статус'];
  var snapshot = prhGoogleRepositoryReadOperationsTable_({ required_headers: headers });
  var index = adapter.normalizeHeaderIndex(snapshot.headers, headers);
  var currency = prhR2Currency_();
  var transactions = [];
  snapshot.rows.forEach(function(row) {
    var transactionId = String(row[index.ID] || '').trim();
    if (!transactionId) return;
    var type = adapter.normalizeType(row[index['Тип']]);
    var account = String(row[index['Счёт']] || '').trim();
    var destination = String(row[index['Счёт назначения']] || '').trim();
    var category = String(row[index['Категория']] || '').trim() || 'UNCLASSIFIED';
    transactions.push({
      transaction_id: transactionId,
      occurred_at: adapter.toRfc3339(row[index['Дата и время']]),
      type: type,
      status: adapter.normalizeStatus(row[index['Статус']]),
      amount_minor: adapter.majorToMinorExact(row[index['Сумма']]),
      currency: currency,
      account_id: account || null,
      destination_account_id: type === 'transfer' ? (destination || null) : null,
      category_id: category,
      reverses_transaction_id: null,
      adjustment_semantics: type === 'refund' ? 'expense_reduction' : null
    });
  });
  if (!transactions.length) throw new Error('R2_RUNTIME_NO_TRANSACTIONS');
  return Object.freeze({ currency: currency, transactions: Object.freeze(transactions) });
}

function prhR2IsoDay_(date) {
  return Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd');
}

function prhR2LatestMonthPeriod_(transactions) {
  var latest = null;
  transactions.forEach(function(tx) {
    var date = new Date(tx.occurred_at);
    if (!Number.isFinite(date.getTime())) throw new Error('R2_RUNTIME_TRANSACTION_DATE_INVALID');
    if (!latest || date > latest) latest = date;
  });
  if (!latest) throw new Error('R2_RUNTIME_PERIOD_UNAVAILABLE');
  var start = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
  var end = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + 1, 1));
  return Object.freeze({ start: prhR2IsoDay_(start), end: prhR2IsoDay_(end), partial: false });
}

function prhR2ComparisonPeriod_(period) {
  var startMs = Date.parse(period.start + 'T00:00:00Z');
  var endMs = Date.parse(period.end + 'T00:00:00Z');
  var days = Math.round((endMs - startMs) / 86400000);
  if (!Number.isInteger(days) || days <= 0) throw new Error('R2_RUNTIME_PERIOD_RANGE_INVALID');
  var comparisonEnd = new Date(startMs);
  var comparisonStart = new Date(startMs - days * 86400000);
  return Object.freeze({ start: prhR2IsoDay_(comparisonStart), end: prhR2IsoDay_(comparisonEnd), partial: false });
}

function prhR2RuntimeViews_() {
  var source = prhR2ReadFinTransactions_();
  var period = prhR2LatestMonthPeriod_(source.transactions);
  var comparisonPeriod = prhR2ComparisonPeriod_(period);
  var homeModule = prhR2DomainRequire_('lib/home/financial_home.js');
  var expenseModule = prhR2DomainRequire_('lib/expense/expense_analytics.js');
  var incomeModule = prhR2DomainRequire_('lib/income/income_analytics.js');
  var cashFlowModule = prhR2DomainRequire_('lib/cashflow/cash_flow_dashboard.js');
  var expenses = expenseModule.buildExpenseAnalytics(source.transactions, {
    currency: source.currency, period: period, comparison_period: comparisonPeriod, trend_grain: 'MONTH'
  });
  var income = incomeModule.buildIncomeAnalytics(source.transactions, {
    currency: source.currency, period: period, comparison_period: comparisonPeriod, trend_grain: 'MONTH'
  });
  var cashFlow = cashFlowModule.buildCashFlowDashboard(source.transactions, {
    currency: source.currency, period: period, comparison_period: comparisonPeriod, grain: 'MONTH'
  });
  var home = homeModule.buildFinancialHome(source.transactions, { currency: source.currency, period: period });
  var homePayload = JSON.parse(JSON.stringify(home));
  homePayload.visual_data = {
    cash_flow_minor: cashFlow.trend.points.map(function(point) { return point.net_minor; }),
    expense_mix: expenses.category_mix.rows.map(function(row) { return [row.category_id, row.expense_minor]; })
  };
  homePayload.provenance.runtime_bridge = 'UI_MIG_020_CANONICAL_LIB_BUNDLE';
  return Object.freeze({
    currency: source.currency,
    period: period,
    comparison_period: comparisonPeriod,
    home: homePayload,
    expenses: expenses,
    income: income,
    'cash-flow': cashFlow
  });
}

function prhR2RenderCanonical_(surface) {
  var views = prhR2RuntimeViews_();
  var payload = views[surface];
  if (!payload) throw new Error('R2_RUNTIME_VIEW_UNAVAILABLE');
  return prhR2RenderFile_(surface, payload);
}

function prhR2RenderLegacy_(params) {
  var data = prhGetWebDashboardData(params.year, params.month, params.view);
  return prhRenderWebDashboard_(data);
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var surface = prhR2ResolveSurface_(params[PRH_CANONICAL_R2_WEB.ROUTE_PARAMETER]);
  if (surface === PRH_CANONICAL_R2_WEB.LEGACY_SURFACE) return prhR2RenderLegacy_(params);
  if (Object.prototype.hasOwnProperty.call(PRH_CANONICAL_R2_WEB.SAFE_UNBOUND_SURFACES, surface)) {
    return prhR2RenderUnavailable_(surface, 'RUNTIME_BINDING_NOT_PROVEN');
  }
  return prhR2RenderCanonical_(surface);
}

function prhR2SmokePayload_() {
  return {
    smoke: true,
    schema: 'PRH_FINANCIAL_HOME_VIEW_V1',
    contract_version: '1.0.0',
    period: { kind: 'FULL_INPUT_SET', start: null, end: null, partial: false, day_count: null, proration: 'NONE' },
    financial_truth_policy: 'FIN-TRUTH-v1',
    kpi_dictionary_version: '1.0.0',
    cards: {},
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
