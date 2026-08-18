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
  DATA_EXTENSION_FILE: 'LocalFirstDataSpaExtension',
  PLANNING_EXTENSION_FILE: 'LocalFirstPlanningSpaExtension',
  VISUALIZATION_EXTENSION_FILE: 'LocalFirstVisualizationSpaExtension',
  FINANCIAL_WRITE: false,
  CANONICAL_MUTATION: false,
  PRIVATE_PAYLOAD: false,
  FREE_ONLY: true
});

var PRH_LOCAL_FIRST_CACHE_NAMESPACE = Object.freeze({
  SCHEMA: 'PRH_LOCAL_FIRST_CACHE_NAMESPACE_V1',
  VERSION: '3',
  LEGACY_BOOT_TOKEN: "name:'prihrash-local-first-v1'",
  ACTIVE_BOOT_TOKEN: "name:'prihrash-local-first-v3'"
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
    budget: true,
    obligations: true,
    liquidity: true,
    'data-quality': true
  };
  return Object.prototype.hasOwnProperty.call(allowed, route) ? route : 'home';
}

function prhLocalFirstSpaNormalizePrivacy_(value) {
  var privacy = String(value == null ? '' : value).trim().toUpperCase();
  if (!privacy) return '';
  return ['NORMAL', 'MASKED', 'DEMO', 'ZEN'].indexOf(privacy) >= 0 ? privacy : 'MASKED';
}

function prhLocalFirstSpaDiagnosticRequested_(params) {
  params = params || {};
  return String(params.lf_diag == null ? '' : params.lf_diag).trim() === '1';
}

function prhLocalFirstSpaBootstrap_(params) {
  params = params || {};
  var route = prhLocalFirstSpaNormalizeRoute_(params.lf_route);
  var privacy = prhLocalFirstSpaNormalizePrivacy_(params.privacy);
  var diagnostic = prhLocalFirstSpaDiagnosticRequested_(params);
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
 * Household mode intentionally hides implementation vocabulary. Technical
 * provenance and machine-readable reason codes remain available only when the
 * owner explicitly opts into lf_diag=1. This is presentation-only: no finance,
 * storage, sync or Worker authority changes here.
 */
function prhLocalFirstSpaApplyHouseholdCopy_(html, params) {
  var source = String(html || '');
  if (prhLocalFirstSpaDiagnosticRequested_(params)) return source;

  var replacements = [
    ['<title>PrihRashOnline — Local-first</title>', '<title>PrihRashOnline — Семейные финансы</title>'],
    ['<span class="status-chip" id="lf-revision-chip">rev —</span>', '<span class="status-chip" id="lf-revision-chip" hidden>rev —</span>'],
    ['>Вернуться к R2</a>', '>Предыдущий интерфейс</a>'],
    ['aria-label="Разделы Local-first"', 'aria-label="Разделы"'],
    ['<div class="eyebrow">Local-first finance</div>', '<div class="eyebrow">Семейные финансы</div>'],
    ['Один живущий интерфейс, одна проверенная локальная ревизия и расчёты в Web Worker.', 'Ваши основные финансовые показатели в одном быстром и удобном интерфейсе.'],
    ['<span class="pill">Одна страница</span><span class="pill">Warm path без сети</span><span class="pill" id="lf-fin-truth-pill">FIN-TRUTH</span>', '<span class="pill">Быстрый режим</span><span class="pill" id="lf-fin-truth-pill">Проверенные данные</span>'],
    ['Local-first browser runtime будет встроен только в trusted Apps Script candidate.', 'Подготавливаем финансовые данные…'],
    ['title="Явное фоновое обновление"', 'title="Обновить данные"'],
    ['<article class="card"><h2>Навигация</h2><p>Переход между разделами выполняется внутри уже открытого приложения — без новой загрузки серверной страницы.</p><div class="state">Готово для проверки</div></article>', '<article class="card"><h2>Быстрые переходы</h2><p>Разделы открываются без повторной загрузки страницы.</p><div class="state">Работает</div></article>'],
    ['<article class="card"><h2>Локальные данные</h2><p id="lf-data-state">IndexedDB runtime подключается в trusted candidate. Source preview намеренно не показывает финансовые значения.</p><div class="state">Exact candidate only</div></article>', '<article class="card"><h2>Данные</h2><p id="lf-data-state">Защищённая локальная копия помогает открывать финансовые разделы быстрее.</p><div class="state">Локальная копия</div></article>'],
    ['<article class="card"><h2>Расчёты</h2><p>Financial values разрешены только из canonical analytics Web Worker, связанного с exact generation/revision.</p><div class="state">FIN-LF-001</div></article>', '<article class="card"><h2>Расчёты</h2><p>Показатели формируются только по вашим проверенным операциям.</p><div class="state">Проверенные данные</div></article>'],
    ['<div class="truth"><strong>Граница истины:</strong> никаких демонстрационных сумм вместо ваших финансов. При отсутствии verified Local Read Model показывается состояние загрузки/ошибки, а не выдуманные данные.</div>', '<div class="truth"><strong>Важно:</strong> приложение не подменяет ваши данные демонстрационными суммами. Если данные ещё не готовы, будет показано состояние загрузки или понятное сообщение об ошибке.</div>'],
    ["home:Object.freeze({title:'Главная',summary:'Ключевые показатели и динамика из одной проверенной локальной ревизии.'})", "home:Object.freeze({title:'Главная',summary:'Ключевые показатели и динамика семейных финансов.'})"],
    ["transactions:Object.freeze({title:'Операции',summary:'Local-first список операций подключается следующим этапом DATA-LF-001.'})", "transactions:Object.freeze({title:'Операции',summary:'Список операций из вашей проверенной локальной копии с быстрыми фильтрами и просмотром деталей.'})"],
    ["expenses:Object.freeze({title:'Расходы',summary:'Расходы и структура по категориям считаются canonical Web Worker на общем FilterContext.'})", "expenses:Object.freeze({title:'Расходы',summary:'Расходы и их структура по категориям за выбранный период.'})"],
    ["income:Object.freeze({title:'Доходы',summary:'Доходы и структура по категориям считаются canonical Web Worker на той же локальной ревизии.'})", "income:Object.freeze({title:'Доходы',summary:'Доходы и их структура по категориям за выбранный период.'})"],
    ["'cash-flow':Object.freeze({title:'Денежный поток',summary:'Доходы, расходы и денежный поток по периодам — без server request на каждый переход.'})", "'cash-flow':Object.freeze({title:'Денежный поток',summary:'Доходы, расходы и итоговый денежный поток по периодам.'})"],
    ["'data-quality':Object.freeze({title:'Качество данных',summary:'Local-first Data Quality подключается следующим этапом DATA-LF-001.'})", "'data-quality':Object.freeze({title:'Качество данных',summary:'Проверка полноты и согласованности текущей локальной копии без автоматического изменения данных.'})"],
    ["function provenance(view){return '<div class=\"provenance\"><div>Источник расчёта: <strong>canonical Web Worker</strong></div><div>FIN-TRUTH: <strong>'+esc(view.provenance.financial_truth_policy)+'</strong></div><div>Ревизия: <code>'+esc(view.revision.slice(0,12))+'…</code></div><div>UI financial formulas: <strong>0</strong></div></div>'}", "function provenance(view){return '<div class=\"provenance\"><div>Источник: <strong>ваши проверенные операции</strong></div><div>Состояние: <strong>данные проверены</strong></div></div>'}"],
    ['Canonical Worker · общий фильтр', 'По выбранным фильтрам'],
    ["syncChip.textContent=state.sync_status==='READY'?'Local-first готов':state.sync_status==='DEGRADED'?'Локально · sync degraded':state.sync_status==='SYNCING'?'Фоновое обновление…':state.sync_status==='FAILED'?'Sync недоступен':'Local-first'", "syncChip.textContent=state.sync_status==='READY'?'Данные готовы':state.sync_status==='DEGRADED'?'Данные доступны · обновление отложено':state.sync_status==='SYNCING'?'Обновляем…':state.sync_status==='FAILED'?'Обновление недоступно':'Подготовка данных'"],
    ["syncBanner.textContent=state.sync_status==='DEGRADED'?'Сеть/синхронизация временно недоступна. Показывается последняя проверенная локальная ревизия.':state.snapshot_status==='READY'?'Финансовые разделы работают из локальной verified revision; сеть используется только отдельным background sync.':'Проверенная локальная ревизия ещё не загружена.'", "syncBanner.textContent=state.sync_status==='DEGRADED'?'Обновление временно недоступно. Можно продолжать работу с последними проверенными данными.':state.snapshot_status==='READY'?'Финансовые данные готовы. Обновление выполняется в фоне и не мешает работе.':'Финансовые данные ещё загружаются.'"],
    ["financeContent.innerHTML='<div class=\"loading\">Считаем локально в Web Worker…</div>'", "financeContent.innerHTML='<div class=\"loading\">Обновляем показатели…</div>'"],
    ["financeContent.innerHTML='<div class=\"empty\">Первый verified snapshot ещё не готов. Выполняется безопасный cold bootstrap; выдуманные суммы не показываются.</div>'", "financeContent.innerHTML='<div class=\"empty\">Финансовые данные ещё загружаются. Подождите немного и повторите попытку.</div>'"],
    ["financeContent.innerHTML='<div class=\"error\">Локальный расчёт не выполнен: '+esc(view.reason)+'</div>'", "financeContent.innerHTML='<div class=\"error\">Не удалось обновить показатели. Попробуйте обновить данные.</div>'"],
    ["syncBanner.textContent='Source preview: browser runtime отсутствует до trusted candidate packaging.'", "syncBanner.textContent='Подготовка финансовых данных временно недоступна.'"],
    ["syncChip.textContent='Local-first недоступен'", "syncChip.textContent='Данные недоступны'"],
    ["syncBanner.textContent='Local-first runtime не запущен: '+String(error&&error.code||'RUNTIME_BOOT_FAILED')", "syncBanner.textContent='Не удалось подготовить финансовые данные. Попробуйте обновить страницу.'"]
  ];

  replacements.forEach(function (pair) {
    if (source.indexOf(pair[0]) < 0) throw new Error('LF_SPA_HOUSEHOLD_COPY_MARKER_MISSING');
    source = source.split(pair[0]).join(pair[1]);
  });
  return source;
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
 * write authority. Cache namespaces are bumped when the browser wire/storage
 * contract changes even if the financial revision itself remains identical.
 * This leaves the previous cache untouched and forces a clean canonical cold
 * bootstrap into the new namespace without fabricating or mutating owner data.
 */
function prhLocalFirstSpaMigrateCacheNamespace_(html) {
  var source = String(html || '');
  var legacy = PRH_LOCAL_FIRST_CACHE_NAMESPACE.LEGACY_BOOT_TOKEN;
  var active = PRH_LOCAL_FIRST_CACHE_NAMESPACE.ACTIVE_BOOT_TOKEN;
  if (source.indexOf(active) >= 0) return source;
  if (source.indexOf(legacy) < 0) throw new Error('LF_SPA_CACHE_NAMESPACE_MARKER_MISSING');
  return source.replace(legacy, active);
}

/**
 * Browser Back/Forward must reuse the same warm SPA renderer as explicit route
 * navigation, but without creating a new history entry or stealing focus from
 * the browser's native history restoration. The source template is kept stable;
 * the canonical server renderer applies this bounded, fail-closed repair before
 * any HTML is sent to the owner browser.
 */
function prhLocalFirstSpaRepairHistoryRestore_(html) {
  var source = String(html || '');
  var legacy = "window.addEventListener('popstate',function(){render(routeFromUrl(),true)});";
  var repaired = "window.addEventListener('popstate',function(){navigate(routeFromUrl(),{fromPopstate:true,history:false,focusMain:false})});";
  var legacyCount = source.split(legacy).length - 1;
  var repairedCount = source.split(repaired).length - 1;
  if (legacyCount === 1 && repairedCount === 0) return source.replace(legacy, repaired);
  if (legacyCount === 0 && repairedCount === 1) return source;
  throw new Error('LF_SPA_HISTORY_RESTORE_HANDLER_INVALID');
}

function prhLocalFirstSpaInjectDataExtension_(html) {
  var source = String(html || '');
  var marker = '</body>';
  if (source.split(marker).length - 1 !== 1) throw new Error('LF_SPA_DATA_EXTENSION_BODY_MARKER_INVALID');
  var extension = HtmlService.createHtmlOutputFromFile(PRH_LOCAL_FIRST_SPA_PREVIEW.DATA_EXTENSION_FILE).getContent();
  if (!extension || extension.indexOf('data-prh-local-first-data-extension="1.0.0"') < 0) {
    throw new Error('LF_SPA_DATA_EXTENSION_INVALID');
  }
  return source.replace(marker, extension + '\n' + marker);
}

function prhLocalFirstSpaInjectPlanningExtension_(html) {
  var source = String(html || '');
  var marker = '</body>';
  if (source.split(marker).length - 1 !== 1) throw new Error('LF_SPA_PLANNING_EXTENSION_BODY_MARKER_INVALID');
  var extension = HtmlService.createHtmlOutputFromFile(PRH_LOCAL_FIRST_SPA_PREVIEW.PLANNING_EXTENSION_FILE).getContent();
  if (!extension || extension.indexOf('data-prh-local-first-planning-extension="1.0.0"') < 0) {
    throw new Error('LF_SPA_PLANNING_EXTENSION_INVALID');
  }
  return source.replace(marker, extension + '\n' + marker);
}

function prhLocalFirstSpaInjectVisualizationExtension_(html) {
  var source = String(html || '');
  var marker = '</body>';
  if (source.split(marker).length - 1 !== 1) throw new Error('LF_SPA_VISUALIZATION_EXTENSION_BODY_MARKER_INVALID');
  var extension = HtmlService.createHtmlOutputFromFile(PRH_LOCAL_FIRST_SPA_PREVIEW.VISUALIZATION_EXTENSION_FILE).getContent();
  if (!extension || extension.indexOf('data-prh-local-first-visualization-extension="1.0.0"') < 0) {
    throw new Error('LF_SPA_VISUALIZATION_EXTENSION_INVALID');
  }
  return source.replace(marker, extension + '\n' + marker);
}

function prhLocalFirstSpaRender_(params) {
  params = params || {};
  var source = HtmlService.createHtmlOutputFromFile(PRH_LOCAL_FIRST_SPA_PREVIEW.FILE);
  var html = prhLocalFirstSpaMigrateCacheNamespace_(source.getContent());
  html = prhLocalFirstSpaRepairHistoryRestore_(html);
  html = prhLocalFirstSpaApplyHouseholdCopy_(html, params);
  html = prhLocalFirstSpaInjectDataExtension_(html);
  html = prhLocalFirstSpaInjectPlanningExtension_(html);
  html = prhLocalFirstSpaInjectVisualizationExtension_(html);
  var selfUrl = prhLocalFirstSpaSelfUrl_();
  if (selfUrl) {
    var rollbackHref = prhLocalFirstSpaEscapeAttr_(selfUrl + '?surface=home');
    if (html.indexOf('data-lf-rollback="canonical-r2"') < 0 || html.indexOf('href="?surface=home"') < 0) {
      throw new Error('LF_SPA_ROLLBACK_MARKER_MISSING');
    }
    html = html.replace('href="?surface=home"', 'href="' + rollbackHref + '"');

    // HtmlService pages run in a sandbox. A query-only href can resolve against
    // the sandbox document instead of the deployed Web App and produce a blank
    // page. Keep the DASH-090 launcher on the authoritative Web App self URL
    // and force top-level navigation so script.google.com is never framed.
    var galleryLauncher = '<a class="lf-studio-gallery-link" href="?surface=gallery">';
    if (html.indexOf(galleryLauncher) < 0) throw new Error('LF_SPA_GALLERY_LAUNCHER_MARKER_MISSING');
    var galleryHref = prhLocalFirstSpaEscapeAttr_(selfUrl + '?surface=gallery');
    html = html.replace(
      galleryLauncher,
      '<a class="lf-studio-gallery-link" href="' + galleryHref + '" target="_top">'
    );
  }

  var appScriptMarker = '<script>\n(function(){';
  if (html.indexOf(appScriptMarker) < 0) throw new Error('LF_SPA_APP_SCRIPT_MARKER_MISSING');
  html = html.replace(
    appScriptMarker,
    prhLocalFirstSpaResponsiveGuard_() + '\n' + prhLocalFirstSpaBootstrap_(params) + '\n' + appScriptMarker
  );

  var output = HtmlService.createHtmlOutput(html);
  output.setTitle(prhLocalFirstSpaDiagnosticRequested_(params) ? 'PrihRashOnline — Local-first' : 'PrihRashOnline — Семейные финансы');
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return output;
}

function prhLocalFirstSpaSmokeToken() {
  var output = prhLocalFirstSpaRender_({});
  var html = output && typeof output.getContent === 'function' ? output.getContent() : '';
  if (!html ||
      html.indexOf('data-prh-local-first-spa="1"') < 0 ||
      html.indexOf('data-prh-local-first-data-extension="1.0.0"') < 0 ||
      html.indexOf('data-prh-local-first-planning-extension="1.0.0"') < 0 ||
      html.indexOf('data-prh-local-first-visualization-extension="1.0.0"') < 0 ||
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
  return 'PRH_LF_SPA_V1|SINGLE_DOCUMENT|ZERO_WARM_NETWORK|DATA_LOCAL_READ_ONLY|PLANNING_LOCAL_READ_ONLY|OK';
}
