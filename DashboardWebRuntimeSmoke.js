/**
 * Privacy-safe Web App render smoke for trusted runtime health.
 * Uses synthetic technical data only and performs no workbook reads.
 */
function prhWebAppRenderSmokeToken() {
  var output = prhRenderWebDashboard_({ smoke: true });
  var html = output && typeof output.getContent === 'function' ? output.getContent() : '';
  var placeholder = '<' + '?!= initialData ?' + '>';

  if (!html || html.indexOf('id="initial-data"') === -1 || html.indexOf('"smoke":true') === -1) {
    throw new Error('WEBAPP_RENDER_SMOKE_FAILED');
  }
  if (html.indexOf(placeholder) !== -1) {
    throw new Error('WEBAPP_INITIAL_DATA_NOT_INJECTED');
  }
  return 'PRH_WEBAPP_SMOKE_V2|OK';
}
