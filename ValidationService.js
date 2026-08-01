/**
 * Выполняет read-only проверку ключевых инвариантов DEV-книги.
 */
function validateWorkbook_() {
  var errors = [];
  var warnings = [];
  var requiredSheets = [
    '00 Главная', '01 Операции', '02 Справочники', '03 Бюджеты',
    '04 Регулярные', '05 Обязательства', '06 Баланс', '07 Проекты',
    '08 Покупки', '09 Настройки', '10 Контроль', '11 Предпросмотр',
    '12 Команды', '13 Журнал'
  ];

  requiredSheets.forEach(function (name) {
    if (!getBook_().getSheetByName(name)) {
      errors.push('Нет обязательного листа: ' + name);
    }
  });

  var settings = getSettingsMap_();
  if (settings.full_history_migrated !== false) {
    errors.push('full_history_migrated должен оставаться FALSE в DEV.');
  }
  if (settings.preview_write_enabled !== false) {
    errors.push('preview_write_enabled должен оставаться FALSE.');
  }
  if (settings.purchase_auto_post !== false) {
    errors.push('purchase_auto_post должен оставаться FALSE.');
  }
  if (settings.automation_write_operations !== false) {
    errors.push('automation_write_operations должен оставаться FALSE.');
  }
  if (String(settings.automation_mode) !== 'DRY_RUN') {
    warnings.push('automation_mode отличается от DRY_RUN.');
  }

  PR_CONFIG.ID_RULES.forEach(function (rule) {
    var sheet = getBook_().getSheetByName(rule.sheet);
    if (!sheet) {
      return;
    }
    var count = Math.min(Math.max(sheet.getLastRow() - 1, 0), rule.maxRows);
    if (count === 0) {
      return;
    }
    var ids = sheet.getRange(2, rule.idColumn, count, 1).getDisplayValues()
      .map(function (row) { return row[0]; })
      .filter(function (value) { return value !== ''; });
    var unique = {};
    ids.forEach(function (value) {
      if (unique[value]) {
        errors.push('Дублирующийся ID ' + value + ' на листе ' + rule.sheet);
      }
      unique[value] = true;
    });
  });

  operationWriteGuard_();
  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    summary: errors.length + ' ошибок; ' + warnings.length + ' предупреждений'
  };
}

function validatePreview_() {
  operationWriteGuard_();
  var preview = getSheetRequired_(PR_CONFIG.SHEETS.PREVIEW);
  var settings = getSettingsMap_();
  return {
    ok: settings.preview_write_enabled === false,
    rows: Math.max(preview.getLastRow() - 1, 0),
    writeEnabled: settings.preview_write_enabled,
    message: 'Предпросмотр проверен; запись в журнал операций отключена.'
  };
}
