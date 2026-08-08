function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var template = HtmlService.createTemplateFromFile('DashboardWebApp');
  var data = prhGetWebDashboardData(params.year, params.month, params.view);
  var json = JSON.stringify(data);
  var escapedLessThan = String.fromCharCode(92) + 'u003c';
  template.initialData = json.split('<').join(escapedLessThan);
  return template.evaluate();
}

function prhOpenWebDashboard() {
  var url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert('Web App not deployed.');
    return { status: 'NOT_DEPLOYED' };
  }

  var safeUrl = String(url);
  safeUrl = safeUrl.split('&').join('&amp;');
  safeUrl = safeUrl.split('<').join('&lt;');
  safeUrl = safeUrl.split('>').join('&gt;');
  safeUrl = safeUrl.split('"').join('&quot;');

  var html = HtmlService.createHtmlOutput(
    '<div style="font:14px Arial,sans-serif;padding:16px;line-height:1.45">' +
      '<p><a href="' + safeUrl + '" target="_blank" rel="noopener">Open PrihRashOnline Dashboard</a></p>' +
      '<p style="color:#666">If the dashboard did not open automatically, use the link above.</p>' +
    '</div>'
  ).setWidth(460).setHeight(170);

  SpreadsheetApp.getUi().showModalDialog(html, 'PrihRashOnline Dashboard');
  return { status: 'OPENING', url: url };
}
