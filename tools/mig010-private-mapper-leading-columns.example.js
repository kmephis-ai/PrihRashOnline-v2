'use strict';

/**
 * PUBLIC-SAFE COMPATIBILITY WRAPPER.
 *
 * Copy this file OUTSIDE the repository and use it as the owner-private mapper.
 * It accepts only 0..3 EMPTY leading technical columns before the strict legacy
 * header block and delegates all real mapping to mig010-private-mapper.example.js.
 * The timestamp header is limited to the known aliases `Дата` or `Отметка времени`.
 */

const path = require('path');

const SCHEMA = 'MIG010_OWNER_PRIVATE_MAPPER_V1';
const HEADER = [
  ['Дата', 'Отметка времени'],
  ['Тип операции'],
  ['Счет', 'Счёт'],
  ['Категория'],
  ['Наименование'],
  ['Сумма'],
  ['Счет', 'Счёт'],
  ['Источник'],
  ['Сумма']
];

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function text(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
}

function lower(value) {
  return text(value).toLowerCase();
}

function requiredEnv(name) {
  const value = text(process.env[name]);
  if (!value) fail(`MIG010_PRIVATE_ENV_${name}_REQUIRED`);
  return value;
}

function findSourceSheet(pkg, name) {
  const sheets = pkg && pkg.content && pkg.content.sheets;
  if (!Array.isArray(sheets)) fail('MIG010_PRIVATE_BACKUP_SHEETS_INVALID');
  const matches = sheets.filter((sheet) => sheet && sheet.metadata && sheet.metadata.name === name);
  if (matches.length !== 1) fail('MIG010_PRIVATE_SHEET_SELECTION_INVALID');
  return matches[0];
}

function detectOffset(sheet, cellValue) {
  if (!sheet || !Array.isArray(sheet.rows) || sheet.rows.length === 0 || !Array.isArray(sheet.rows[0])) {
    fail('MIG010_PRIVATE_SOURCE_HEADERS_INVALID');
  }
  const header = sheet.rows[0].map(cellValue);
  for (let offset = 0; offset <= 3; offset += 1) {
    const prefixEmpty = header.slice(0, offset).every((value) => text(value) === '');
    if (!prefixEmpty) continue;
    let exact = true;
    for (let index = 0; index < HEADER.length; index += 1) {
      const actual = lower(header[offset + index]);
      if (!HEADER[index].some((candidate) => actual === lower(candidate))) {
        exact = false;
        break;
      }
    }
    if (exact) return offset;
  }
  fail('MIG010_PRIVATE_SOURCE_HEADER_BLOCK_NOT_FOUND');
}

function canonicalDateHeaderCell(cell) {
  if (!cell || typeof cell !== 'object') fail('MIG010_PRIVATE_SOURCE_DATE_HEADER_INVALID');
  return { ...cell, t: 's', v: 'Дата' };
}

function normalizedPackage(pkg, sourceName, cellValue) {
  const source = findSourceSheet(pkg, sourceName);
  const offset = detectOffset(source, cellValue);

  const normalizedRows = source.rows.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length < offset) fail('MIG010_PRIVATE_SOURCE_ROW_INVALID');
    const sliced = row.slice(offset);
    if (rowIndex === 0) {
      if (!sliced[0]) fail('MIG010_PRIVATE_SOURCE_DATE_HEADER_INVALID');
      sliced[0] = canonicalDateHeaderCell(sliced[0]);
    }
    return sliced;
  });

  const normalizedSource = {
    ...source,
    metadata: {
      ...source.metadata,
      lastColumn: source.metadata.lastColumn - offset
    },
    rows: normalizedRows
  };

  return {
    ...pkg,
    content: {
      ...pkg.content,
      sheets: pkg.content.sheets.map((sheet) => sheet === source ? normalizedSource : sheet)
    }
  };
}

module.exports = {
  schema: SCHEMA,
  mappingVersion: 'LEGACY-SPLIT-FORM-TO-CANONICAL-v1+LEADING-EMPTY-COLUMNS-v1+TIMESTAMP-HEADER-ALIASES-v1',

  buildSnapshot({ backupPackage, cellValue }) {
    if (!backupPackage || backupPackage.format !== 'PRH_PORTABLE_BACKUP_V1') {
      fail('MIG010_PRIVATE_BACKUP_FORMAT_INVALID');
    }
    if (typeof cellValue !== 'function') fail('MIG010_PRIVATE_CELL_VALUE_REQUIRED');

    const repoRoot = requiredEnv('MIG010_REPO_ROOT');
    const sourceName = requiredEnv('MIG010_SOURCE_SHEET');
    const baseMapperPath = path.join(repoRoot, 'tools', 'mig010-private-mapper.example.js');
    let base;
    try {
      delete require.cache[require.resolve(baseMapperPath)];
      base = require(baseMapperPath);
    } catch (_) {
      fail('MIG010_PRIVATE_BASE_MAPPER_LOAD_FAILED');
    }
    if (!base || base.schema !== SCHEMA || typeof base.buildSnapshot !== 'function') {
      fail('MIG010_PRIVATE_BASE_MAPPER_INVALID');
    }
    return base.buildSnapshot({
      backupPackage: normalizedPackage(backupPackage, sourceName, cellValue),
      cellValue
    });
  }
};
