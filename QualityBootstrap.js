/**
 * Installs a dedicated spreadsheet onOpen trigger for the quality menu.
 * Installer v0.3.1.
 *
 * Important: this installer can be started from the Apps Script editor, where
 * SpreadsheetApp.getUi() is unavailable. Therefore it never builds the menu,
 * calls the onOpen handler, or shows alerts directly. The menu is created only
 * by the installable onOpen trigger when the spreadsheet is opened or reloaded.
 */
var PRH_QUALITY_BOOTSTRAP_VERSION = '0.3.1';

function prhInstallQualityCleanup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('The script must be bound to the PrihRashOnline v2 DEV spreadsheet.');
  }

  var handler = 'prhQualityCleanupOnOpen_';
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === handler;
  });

  if (!exists) {
    ScriptApp.newTrigger(handler)
      .forSpreadsheet(ss)
      .onOpen()
      .create();
  }

  if (typeof prhQualitySetting_ === 'function') {
    prhQualitySetting_(
      'quality_cleanup_controller',
      'READY',
      'Quality Cleanup Service v' + PRH_QUALITY.VERSION +
        '; bootstrap v' + PRH_QUALITY_BOOTSTRAP_VERSION + ' installed'
    );
  }

  console.log(
    exists
      ? 'Quality cleanup onOpen trigger already exists.'
      : 'Quality cleanup onOpen trigger created.'
  );
  console.log('Bootstrap version: ' + PRH_QUALITY_BOOTSTRAP_VERSION);
  console.log('Reload the spreadsheet to display the Quality Data menu.');

  return {
    ok: true,
    triggerCreated: !exists,
    handler: handler,
    serviceVersion: PRH_QUALITY.VERSION,
    bootstrapVersion: PRH_QUALITY_BOOTSTRAP_VERSION
  };
}

function prhQualityCleanupOnOpen_() {
  if (typeof prhQualityMenuInstall !== 'function') {
    throw new Error('QualityCleanupService.js is not loaded.');
  }
  prhQualityMenuInstall();
}
