/**
 * Dashboard Web App bootstrap.
 * Keep this file deliberately small and ES5-compatible for Google Apps Script.
 */
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
    SpreadsheetApp.getUi().alert('Web Dashboard', 'Web App is not deployed.', SpreadsheetApp.getUi().ButtonSet.OK);
    return { status: 'NOT_DEPLOYED' };
  }

  var safeUrl = String(url).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  var html = '<div style="font-family:Arial,sans-serif;padding:20px">' +
    '<p><a href="' + safeUrl + '" target="_blank" rel="noopener">Открыть дашборд</a></p>' +
    '</div>';
  var output = HtmlService.createHtmlOutput(html);
  output.setWidth(420);
  output.setHeight(160);
  SpreadsheetApp.getUi().showModalDialog(output, 'ПрихРасхOnline');
  return { status: 'OPENING', url: url };
}
