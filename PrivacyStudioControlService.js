/** PRIV-080 configuration-only selector injected into the Studio shell. */
function prhPrivacyStudioSelectorHtml_(requestedMode) {
  var mode = prhPrivacyResolveMode_(requestedMode);
  var items = [
    ['NORMAL', 'Обычный', 'Полный авторизованный private view'],
    ['MASKED', 'Скрытый', 'Суммы и частные измерения удаляются до DOM'],
    ['DEMO', 'Демо', 'Только независимые демо-данные, без private runtime read'],
    ['ZEN', 'Дзен', 'Только безопасное структурное состояние']
  ];
  var links = items.map(function(item) {
    var selected = item[0] === mode;
    return '<a class="prh-privacy-choice" data-privacy-choice="' + item[0] + '" role="radio" aria-checked="' +
      String(selected) + '" tabindex="' + (selected ? '0' : '-1') + '" href="?surface=home&privacy=' +
      item[0].toLowerCase() + '"><strong>' + item[1] + '</strong><small>' + item[2] + '</small></a>';
  }).join('');
  return '<section id="prh-privacy-selector" data-security-boundary="false" aria-labelledby="prh-privacy-title">' +
    '<div><div class="prh-privacy-eyebrow">PRIV-080 • presentation only</div><h2 id="prh-privacy-title">Режим приватности</h2>' +
    '<p>Режим меняет только данные, разрешённые к рендеру. Аутентификацию и права доступа он не выдаёт.</p></div>' +
    '<div class="prh-privacy-choices" role="radiogroup" aria-label="Режим приватности">' + links + '</div></section>' +
    '<style id="prh-privacy-selector-style">#prh-privacy-selector{display:grid;grid-template-columns:minmax(0,1fr) minmax(420px,1.4fr);gap:14px;align-items:center;margin:0 0 18px;padding:14px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow)}#prh-privacy-selector h2{margin:2px 0 4px;font-size:18px}#prh-privacy-selector p{margin:0;color:var(--muted)}.prh-privacy-eyebrow{font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--link)}.prh-privacy-choices{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.prh-privacy-choice{display:flex;min-width:0;flex-direction:column;gap:2px;padding:9px 10px;border:1px solid var(--border);border-radius:12px;background:var(--surface-subtle);color:var(--secondary);text-decoration:none}.prh-privacy-choice strong{font-size:12px}.prh-privacy-choice small{font-size:10px;color:var(--muted)}.prh-privacy-choice[aria-checked="true"]{border-color:var(--primary);background:var(--surface-accent);color:var(--link)}@media(max-width:900px){#prh-privacy-selector{grid-template-columns:1fr}.prh-privacy-choices{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.prh-privacy-choices{grid-template-columns:1fr}}</style>' +
    '<script id="prh-privacy-selector-script">(function(){"use strict";var K="prh.privacyPresentation.mode.v1",S="PRH_PRIVACY_MODE_PREFERENCE_V1",V="1.0.0",M=["NORMAL","MASKED","DEMO","ZEN"];var A=[].slice.call(document.querySelectorAll("[data-privacy-choice]"));function mark(m){A.forEach(function(a){var on=a.dataset.privacyChoice===m;a.setAttribute("aria-checked",String(on));a.tabIndex=on?0:-1;});}try{var p=JSON.parse(localStorage.getItem(K)||"null");if(p&&p.schema===S&&p.version===V&&M.indexOf(p.mode)>=0)mark(p.mode);}catch(e){}A.forEach(function(a){a.addEventListener("click",function(){try{localStorage.setItem(K,JSON.stringify({schema:S,version:V,mode:a.dataset.privacyChoice}));}catch(e){}});});var g=document.querySelector(".prh-privacy-choices");if(g)g.addEventListener("keydown",function(e){var i=A.indexOf(document.activeElement),n=i;if(i<0)return;if(e.key==="ArrowRight"||e.key==="ArrowDown")n=(i+1)%A.length;else if(e.key==="ArrowLeft"||e.key==="ArrowUp")n=(i-1+A.length)%A.length;else if(e.key==="Home")n=0;else if(e.key==="End")n=A.length-1;else return;e.preventDefault();A[n].focus();});}());</script>';
}

function prhPrivacyDecorateStudioOutput_(output, requestedMode) {
  var html = output && typeof output.getContent === 'function' ? output.getContent() : '';
  var marker = '<main class="studio-main">';
  if (!html || html.indexOf(marker) < 0) throw new Error('PRIV080_STUDIO_SHELL_MARKER_MISSING');
  html = html.replace(marker, marker + prhPrivacyStudioSelectorHtml_(requestedMode));
  return HtmlService.createHtmlOutput(html)
    .setTitle('PrihRashOnline — Analytics Studio')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function prhPrivacyRenderZenCanonical_(result) {
  var output = prhPrivacyRenderZen_(result);
  var html = output && typeof output.getContent === 'function' ? output.getContent() : '';
  if (!html || html.indexOf('data-prh-zen-safe="1"') < 0) throw new Error('PRIV080_ZEN_CANONICAL_RENDER_INVALID');
  html = prhR2InjectShell_(html, PRH_CANONICAL_R2_WEB.DEFAULT_SURFACE);
  return HtmlService.createHtmlOutput(html)
    .setTitle('PrihRashOnline — Дзен')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
