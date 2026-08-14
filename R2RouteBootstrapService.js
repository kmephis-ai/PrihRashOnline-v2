/**
 * FIN-REC-001 safe route bootstrap for private R2 surfaces.
 *
 * Google Apps Script renders HtmlService content inside a service iframe whose
 * document URL does not reliably inherit the top-level Web App query string.
 * Route bootstrap therefore rehydrates only bounded navigation/filter context
 * before the page runtime starts. No financial values are placed in route state.
 */
function prhR2TransactionRouteBootstrapScript_(params) {
  var source = params && typeof params === 'object' ? params : {};
  var allowed = {};
  ['date_from', 'date_to', 'account_id', 'category_id', 'member_id'].forEach(function(key) {
    var value = String(source[key] || '').trim();
    if (value) allowed[key] = value;
  });
  if (!Object.keys(allowed).length) return '';
  var payload = JSON.stringify(allowed).split('<').join('\\u003c');
  return '<script id="prh-r2-transaction-route-bootstrap">(function(){' +
    'var p=' + payload + ';' +
    'function select(id,key){var v=p[key];if(!v)return;var s=document.getElementById(id);if(!s)return;var o=document.createElement("option");o.value=v;o.textContent="Фильтр из аналитики";s.appendChild(o);s.value=v;}' +
    'function value(id,key){var v=p[key];var e=document.getElementById(id);if(v&&e)e.value=v;}' +
    'select("account","account_id");select("category","category_id");select("member","member_id");value("date-from","date_from");' +
    'var end=p.date_to;if(end){var d=new Date(end+"T00:00:00Z");if(Number.isFinite(d.getTime())){d.setUTCDate(d.getUTCDate()-1);var e=document.getElementById("date-to");if(e)e.value=d.toISOString().slice(0,10);}}' +
    '})();</script>';
}

function prhR2InjectTransactionRouteBootstrap_(html, params) {
  var script = prhR2TransactionRouteBootstrapScript_(params);
  if (!script) return html;
  if (html.indexOf('</body>') < 0) throw new Error('R2_TRANSACTION_ROUTE_BODY_MISSING');
  return html.replace('</body>', script + '</body>');
}

function prhR2FinancialRouteBootstrapParams_(params) {
  var source = params && typeof params === 'object' ? params : {};
  var allowed = {};
  var surface = String(source.surface || '').trim().toLowerCase();
  if (['expenses', 'income', 'cash-flow'].indexOf(surface) >= 0) allowed.surface = surface;

  var privacy = String(source.privacy || '').trim().toUpperCase();
  if (privacy) allowed.privacy = ['NORMAL', 'MASKED', 'DEMO', 'ZEN'].indexOf(privacy) >= 0 ? privacy : 'MASKED';

  var windowDays = String(source.window_days || '').trim();
  if (['30', '90', '180', '365'].indexOf(windowDays) >= 0) allowed.window_days = windowDays;

  ['account_id', 'category_id', 'member_id'].forEach(function(key) {
    var value = String(source[key] || '').trim();
    if (value && value.length <= 160) allowed[key] = value;
  });
  return allowed;
}

function prhR2FinancialRouteBootstrapScript_(params) {
  var allowed = prhR2FinancialRouteBootstrapParams_(params);
  if (!allowed.surface) return '';
  var payload = JSON.stringify(allowed).split('<').join('\\u003c');
  return '<script id="prh-r2-financial-route-bootstrap">(function(){' +
    'var p=' + payload + ';var q=new URLSearchParams();' +
    'Object.keys(p).forEach(function(k){if(p[k]!=null&&String(p[k])!=="")q.set(k,String(p[k]));});' +
    'try{history.replaceState(history.state||null,"","?"+q.toString());document.documentElement.setAttribute("data-fin-route-bootstrap","1");}' +
    'catch(e){document.documentElement.setAttribute("data-fin-route-bootstrap","0");}' +
    '})();</script>';
}

function prhR2InjectFinancialRouteBootstrap_(html, params) {
  var script = prhR2FinancialRouteBootstrapScript_(params);
  if (!script) return html;
  var bodyStart = html.indexOf('<body');
  var bodyEnd = bodyStart < 0 ? -1 : html.indexOf('>', bodyStart);
  if (bodyEnd < 0) throw new Error('R2_FINANCIAL_ROUTE_BODY_MISSING');
  return html.slice(0, bodyEnd + 1) + script + html.slice(bodyEnd + 1);
}
