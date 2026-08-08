/**
 * DR-001 owner-only portable backup source exporter.
 *
 * Safety contract:
 * - reads only the spreadsheet bound to this Apps Script project;
 * - performs no workbook/Drive/Properties writes;
 * - never creates a plaintext backup in Google;
 * - returns bounded JSON chunks for a trusted local owner tool to encrypt before disk storage.
 */
var PRH_BACKUP_SOURCE = Object.freeze({
  FORMAT: 'PRH_BACKUP_SOURCE_V1',
  SCHEMA_VERSION: 1,
  MAX_CHUNK_ROWS: 200
});

function prhBackupDescribe() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('BACKUP_SOURCE_SPREADSHEET_UNAVAILABLE');
  }

  var sheets = spreadsheet.getSheets().map(function (sheet, index) {
    return {
      name: sheet.getName(),
      index: index,
      lastRow: sheet.getLastRow(),
      lastColumn: sheet.getLastColumn(),
      frozenRows: sheet.getFrozenRows(),
      frozenColumns: sheet.getFrozenColumns(),
      hidden: sheet.isSheetHidden()
    };
  });

  var buildSha = '';
  var sourceTreeHash = '';
  if (typeof PR_BUILD_INFO !== 'undefined' && PR_BUILD_INFO) {
    buildSha = String(PR_BUILD_INFO.candidateSha || '');
    sourceTreeHash = String(PR_BUILD_INFO.sourceTreeHash || '');
  }

  return JSON.stringify({
    format: PRH_BACKUP_SOURCE.FORMAT,
    schemaVersion: PRH_BACKUP_SOURCE.SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    sourceBuildSha: buildSha,
    sourceTreeHash: sourceTreeHash,
    sheetCount: sheets.length,
    sheets: sheets
  });
}

function prhBackupReadChunk(request) {
  var input = request || {};
  var sheetName = String(input.sheetName || '');
  var startRow = Number(input.startRow || 0);
  var requestedRows = Number(input.maxRows || PRH_BACKUP_SOURCE.MAX_CHUNK_ROWS);

  if (!sheetName) throw new Error('BACKUP_SOURCE_SHEET_REQUIRED');
  if (!Number.isInteger(startRow) || startRow < 1) throw new Error('BACKUP_SOURCE_START_ROW_INVALID');
  if (!Number.isInteger(requestedRows) || requestedRows < 1 || requestedRows > PRH_BACKUP_SOURCE.MAX_CHUNK_ROWS) {
    throw new Error('BACKUP_SOURCE_CHUNK_SIZE_INVALID');
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('BACKUP_SOURCE_SPREADSHEET_UNAVAILABLE');
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('BACKUP_SOURCE_SHEET_NOT_FOUND');

  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow === 0 || lastColumn === 0 || startRow > lastRow) {
    return JSON.stringify({
      format: PRH_BACKUP_SOURCE.FORMAT,
      schemaVersion: PRH_BACKUP_SOURCE.SCHEMA_VERSION,
      sheetName: sheetName,
      startRow: startRow,
      rowCount: 0,
      columnCount: lastColumn,
      rows: []
    });
  }

  var rowCount = Math.min(requestedRows, lastRow - startRow + 1);
  var range = sheet.getRange(startRow, 1, rowCount, lastColumn);
  var values = range.getValues();
  var formulas = range.getFormulas();
  var rows = [];

  for (var r = 0; r < values.length; r += 1) {
    var encodedRow = [];
    for (var c = 0; c < values[r].length; c += 1) {
      encodedRow.push(prhBackupEncodeCell_(values[r][c], formulas[r][c]));
    }
    rows.push(encodedRow);
  }

  return JSON.stringify({
    format: PRH_BACKUP_SOURCE.FORMAT,
    schemaVersion: PRH_BACKUP_SOURCE.SCHEMA_VERSION,
    sheetName: sheetName,
    startRow: startRow,
    rowCount: rowCount,
    columnCount: lastColumn,
    rows: rows
  });
}

function prhBackupEncodeCell_(value, formula) {
  var encoded;
  if (value instanceof Date) {
    encoded = { t: 'd', v: value.toISOString() };
  } else if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error('BACKUP_SOURCE_NONFINITE_NUMBER');
    encoded = { t: 'n', v: value };
  } else if (typeof value === 'boolean') {
    encoded = { t: 'b', v: value };
  } else if (value === null || typeof value === 'undefined') {
    encoded = { t: 's', v: '' };
  } else {
    encoded = { t: 's', v: String(value) };
  }

  if (formula) encoded.f = String(formula);
  return encoded;
}
