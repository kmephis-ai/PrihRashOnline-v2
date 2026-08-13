/**
 * FIN-REC-001 safe route bootstrap for Transaction Explorer.
 *
 * This script contains only bounded filter/date context. It executes immediately
 * at the end of the document so existing DOMContentLoaded runtime loading sees
 * the routed controls on its first request. No financial values are placed in
 * route state.
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
