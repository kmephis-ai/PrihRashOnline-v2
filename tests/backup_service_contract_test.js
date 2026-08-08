'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'BackupService.js'), 'utf8');

assert(source.includes("FORMAT: 'PRH_BACKUP_SOURCE_V1'"), 'backup source format must be versioned');
assert(source.includes('SCHEMA_VERSION: 1'), 'backup source schema must be explicit');
assert(source.includes('MAX_CHUNK_ROWS: 200'), 'backup chunks must remain bounded');
assert(/function\s+prhBackupDescribe\s*\(/.test(source), 'metadata entrypoint missing');
assert(/function\s+prhBackupReadChunk\s*\(/.test(source), 'chunk entrypoint missing');
assert(source.includes('SpreadsheetApp.getActiveSpreadsheet()'), 'backup exporter must remain bound to the current workbook');
assert(source.includes('spreadsheet.getSheets()'), 'backup metadata must enumerate the current workbook sheets');
assert(source.includes('sheet.getRange(startRow, 1, rowCount, lastColumn)'), 'backup chunk must read only the requested bounded sheet range');
assert(source.includes('range.getValues()'), 'backup source must preserve typed values');
assert(source.includes('range.getFormulas()'), 'backup source must preserve formulas');
assert(source.includes('PR_BUILD_INFO.candidateSha'), 'backup metadata must bind to deployed build SHA when available');
assert(source.includes('PR_BUILD_INFO.sourceTreeHash'), 'backup metadata must bind to deployed source tree when available');

const forbiddenWriteOrExternalApis = [
  /\.setValue\s*\(/,
  /\.setValues\s*\(/,
  /\.setFormula\s*\(/,
  /\.setFormulas\s*\(/,
  /\.appendRow\s*\(/,
  /\.insertRows?\s*\(/,
  /\.deleteRows?\s*\(/,
  /\.clear(?:Content|Format)?\s*\(/,
  /DriveApp\./,
  /PropertiesService\./,
  /UrlFetchApp\./,
  /GmailApp\./,
  /MailApp\./,
  /SpreadsheetApp\.openBy(?:Id|Url)\s*\(/
];
forbiddenWriteOrExternalApis.forEach((pattern) => {
  assert(!pattern.test(source), `backup exporter must be read-only/current-workbook only: ${pattern}`);
});

assert(/requestedRows\s*>\s*PRH_BACKUP_SOURCE\.MAX_CHUNK_ROWS/.test(source), 'chunk size must fail closed above the maximum');
assert(/Number\.isInteger\(startRow\)/.test(source), 'start row must be integer validated');
assert(/Number\.isInteger\(requestedRows\)/.test(source), 'chunk row count must be integer validated');
assert(/value instanceof Date/.test(source), 'date cell type must be preserved');
assert(/typeof value === 'number'/.test(source), 'number cell type must be preserved');
assert(/typeof value === 'boolean'/.test(source), 'boolean cell type must be preserved');
assert(/if \(formula\) encoded\.f = String\(formula\)/.test(source), 'formula text must be preserved independently of computed value');

console.log('backup_service_contract_test: OK', {
  source: 'bound-current-workbook',
  writes: false,
  externalServices: false,
  maxChunkRows: 200,
  typedValues: true,
  formulas: true,
  exactBuildMetadata: true
});
