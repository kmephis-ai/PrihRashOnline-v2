function doGet() {
  var template = HtmlService.createTemplateFromFile("DashboardWebApp");
  template.initialData = "{}";
  return template.evaluate();
}
