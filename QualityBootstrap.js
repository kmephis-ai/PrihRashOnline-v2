/**
 * Устанавливает отдельный onOpen-триггер меню качества, не изменяя Foundation onOpen().
 */
function prhInstallQualityCleanup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var handler = 'prhQualityCleanupOnOpen_';
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (!exists) ScriptApp.newTrigger(handler).forSpreadsheet(ss).onOpen().create();
  prhQualityCleanupOnOpen_();
  if (typeof prhQualitySetting_ === 'function') {
    prhQualitySetting_('quality_cleanup_controller', 'READY', 'Quality Cleanup Service v' + PRH_QUALITY.VERSION + ' установлен');
  }
  SpreadsheetApp.getUi().alert(
    'Контур качества подключён',
    'Меню «Качество данных» установлено. Запись в «01 Операции» запрещена.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function prhQualityCleanupOnOpen_() {
  if (typeof prhQualityMenuInstall !== 'function') {
    throw new Error('QualityCleanupService.js не загружен.');
  }
  prhQualityMenuInstall();
}
