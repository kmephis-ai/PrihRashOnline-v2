'use strict';

/**
 * ARCH-011 Apps Script gateway for the current Google Sheets transaction store.
 *
 * Boundary rules:
 * - functions ending with `_` are internal gateway helpers and must never be
 *   exposed as public finance-data Execution API endpoints;
 * - this file may use Google-specific Apps Script services because it lives
 *   outside the pure lib/domain|finance|migration|application boundary;
 * - canonical financial writes remain fail-closed even if legacy config is
 *   accidentally changed: no setValue/setValues/appendRow path exists here.
 */
var PRH_GOOGLE_REPOSITORY_GATEWAY = Object.freeze({
  SCHEMA: 'PRH_GOOGLE_REPOSITORY_GATEWAY_V1',
  VERSION: '1.0.0',
  TABLE_SCHEMA: 'PRH_GOOGLE_OPERATIONS_TABLE_V1',
  MAPPING_VERSION: '1.0.0',
  REQUIRED_HEADERS: Object.freeze([
    'ID', 'Дата и время', 'Тип', 'Сумма', 'Счёт', 'Счёт назначения',
    'Категория', 'Наименование', 'Член семьи', 'Проект', 'Теги',
    'Комментарий', 'Источник', 'Строка источника', 'Статус'
  ])
});

function prhGoogleRepositoryAssertHeaders_(headers) {
  if (!Array.isArray(headers)) {
    throw new Error('GOOGLE_REPOSITORY_HEADERS_INVALID');
  }
  var normalized = headers.map(function (value) { return String(value || '').trim(); });
  PRH_GOOGLE_REPOSITORY_GATEWAY.REQUIRED_HEADERS.forEach(function (required) {
    if (normalized.indexOf(required) < 0) {
      throw new Error('GOOGLE_REPOSITORY_REQUIRED_HEADER_MISSING');
    }
  });
  return true;
}

function prhGoogleRepositoryReadOperationsTable_() {
  var sheet = getSheetRequired_(PR_CONFIG.SHEETS.OPERATIONS);
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  prhGoogleRepositoryAssertHeaders_(headers);
  var rows = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  return {
    schema: PRH_GOOGLE_REPOSITORY_GATEWAY.TABLE_SCHEMA,
    gateway_version: PRH_GOOGLE_REPOSITORY_GATEWAY.VERSION,
    mapping_version: PRH_GOOGLE_REPOSITORY_GATEWAY.MAPPING_VERSION,
    sheet_name: PR_CONFIG.SHEETS.OPERATIONS,
    start_row: 2,
    headers: headers,
    rows: rows
  };
}

function prhGoogleRepositoryApplyCanonicalBatch_() {
  // The legacy guard itself proves the current workbook remains configured
  // read-only for operations. ARCH-011 then adds an independent fail-closed
  // repository policy so adapter existence cannot authorize a financial write.
  operationWriteGuard_();
  throw new Error('GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED');
}

/**
 * Public-safe capability metadata only. No workbook values, row counts,
 * revisions or private locators are returned.
 */
function prhGoogleRepositoryGatewayStatus() {
  return {
    schema: PRH_GOOGLE_REPOSITORY_GATEWAY.SCHEMA,
    version: PRH_GOOGLE_REPOSITORY_GATEWAY.VERSION,
    mapping_version: PRH_GOOGLE_REPOSITORY_GATEWAY.MAPPING_VERSION,
    read_capability: true,
    query_capability: true,
    write_interface: true,
    write_authorized: false,
    write_reason: 'GOOGLE_REPOSITORY_WRITE_POLICY_REQUIRED'
  };
}
