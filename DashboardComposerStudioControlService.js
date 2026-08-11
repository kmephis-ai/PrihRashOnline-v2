/** DASH-080 configuration-only Studio integration. */
function prhDashboardComposerDecorateStudioOutput_(output) {
  var html = output && typeof output.getContent === 'function' ? output.getContent() : '';
  if (!html || html.indexOf('data-prh-studio-shell="1"') < 0) throw new Error('DASH080_STUDIO_OUTPUT_INVALID');

  var composerUpcoming = '<div class="cap future"><b>Dashboard composer</b><small>DASH-080</small><span class="status future">UPCOMING</span></div>';
  var layoutUpcoming = '<div class="cap future"><b>Responsive layout</b><small>DASH-080</small><span class="status future">UPCOMING</span></div>';
  var composerReady = '<a class="cap ready" data-dash080-composer-launcher="1" href="?surface=composer" style="color:inherit;text-decoration:none"><b>Dashboard composer</b><small>Добавить, переместить и изменить placeholder-виджеты</small><span class="status ready">READY</span></a>';
  var layoutReady = '<a class="cap ready" data-dash080-responsive-launcher="1" href="?surface=composer" style="color:inherit;text-decoration:none"><b>Responsive layout</b><small>Desktop / tablet / mobile deterministic layout</small><span class="status ready">READY</span></a>';

  if (html.indexOf(composerUpcoming) < 0 || html.indexOf(layoutUpcoming) < 0) {
    throw new Error('DASH080_STUDIO_AFFORDANCE_MARKER_MISSING');
  }
  html = html.replace(composerUpcoming, composerReady).replace(layoutUpcoming, layoutReady);
  return HtmlService.createHtmlOutput(html)
    .setTitle('PrihRashOnline — Analytics Studio')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
