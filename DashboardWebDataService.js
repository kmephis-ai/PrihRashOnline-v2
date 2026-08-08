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
    prhNotify_('Web App not deployed.');
    return;
  }

  var safeUrl = String(url);
  safeUrl = safeUrl.split('&').join('&amp;');
  safeUrl = safeUrl.split('<').join('&lt;');
  safeUrl = safeUrl.split('>').join('&gt;');
  safeUrl = safeUrl.split(String.fromCharCode(34)).join('&quot;');

  var quote = String.fromCharCode(34);
  var body = '<p><a href=' + quote + safeUrl + quote +
    ' target=' + quote + '_blank' + quote +
    ' rel=' + quote + 'noopener noreferrer' + quote +
    '>Open Dashboard</a></p>';

  var output = HtmlService.createHtmlOutput(body);
  output.setWidth(420);
  output.setHeight(140);
  SpreadsheetApp.getUi().showModalDialog(output, 'PrihRashOnline Dashboard');
}
