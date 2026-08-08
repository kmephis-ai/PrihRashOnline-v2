function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var template = HtmlService.createTemplateFromFile('DashboardWebApp');
  var data = prhGetWebDashboardData(params.year, params.month, params.view);
  var json = JSON.stringify(data);
  var escapedLessThan = String.fromCharCode(92) + 'u003c';
  template.initialData = json.split('<').join(escapedLessThan);
  return template.evaluate();
}
