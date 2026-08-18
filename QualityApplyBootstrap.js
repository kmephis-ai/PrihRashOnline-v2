/**
 * Installs a dedicated spreadsheet onOpen trigger for Quality Apply Service.
 * Installer v0.4.0.
 */
var PRH_QUALITY_APPLY_BOOTSTRAP_VERSION = '0.4.0';

function prhInstallQualityApply() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('The script must be bound to the PrihRashOnline v2 DEV spreadsheet.');
  var handler = 'prhQualityApplyOnOpen_';
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (!exists) {
    ScriptApp.newTrigger(handler).forSpreadsheet(ss).onOpen().create();
  }
  if (typeof prhQualityApplySetting_ === 'function') {
    prhQualityApplySetting_(
      'quality_apply_controller',
      'READY_DISABLED',
      'Quality Apply Service v' + PRH_QUALITY_APPLY.VERSION + '; bootstrap v' + PRH_QUALITY_APPLY_BOOTSTRAP_VERSION
    );
    prhQualityApplySetting_(
      PRH_QUALITY_APPLY.ENABLE_KEY,
      'FALSE',
      'Fail-closed: set TRUE manually only for controlled application'
    );
  }
  return {
    ok: true,
    triggerCreated: !exists,
    handler: handler,
    serviceVersion: PRH_QUALITY_APPLY.VERSION,
    bootstrapVersion: PRH_QUALITY_APPLY_BOOTSTRAP_VERSION,
    enabled: false
  };
}

function prhQualityApplyOnOpen_() {
  if (typeof prhQualityApplyMenuInstall !== 'function') {
    throw new Error('QualityApplyService.js is not loaded.');
  }
  prhQualityApplyMenuInstall();
}
