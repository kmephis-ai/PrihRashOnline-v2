'use strict';

/**
 * PUBLIC-SAFE COMPATIBILITY WRAPPER.
 *
 * Copy this file OUTSIDE the repository and use it as the owner-private mapper.
 * It accepts only 0..3 EMPTY leading technical columns before the strict legacy
 * header block and delegates all real mapping to mig010-private-mapper.example.js.
 * The timestamp header is limited to the known aliases `Дата` or `Отметка времени`.
 *
 * A legacy target row that already carries the migrating source provenance but
 * has an empty target timestamp is NOT repaired. For dry-run only, its empty
 * timestamp is replaced in-memory by a diagnostic RFC3339 sentinel so the
 * reconciliation layer can classify the row as SOURCE_MISSING/CORE_MISMATCH and
 * block all writes. The workbook and encrypted backup are never modified.
 */

const path = require('path');

const SCHEMA = 'MIG010_OWNER_PRIVATE_MAPPER_V1';
const TARGET_DATE_SENTINEL = '1900-01-01T00:00:00Z';
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

function findSheet(pkg, name) {
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

function diagnosticDateCell(cell) {
  if (!cell || typeof cell !== 'object') return { t: 's', v: TARGET_DATE_SENTINEL };
  return { ...cell, t: 's', v: TARGET_DATE_SENTINEL };
}

function uniqueHeaderIndex(header, aliases, reason) {
  const positions = header
    .map((value, index) => aliases.some((alias) => text(value) === alias) ? index : -1)
    .filter((index) => index >= 0);
  if (positions.length !== 1) fail(reason);
  return positions[0];
}

function normalizeSourceSheet(source, cellValue) {
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
  return {
    ...source,
    metadata: {
      ...source.metadata,
      lastColumn: source.metadata.lastColumn - offset
    },
    rows: normalizedRows
  };
}

function normalizeTargetDiagnostics(target, sourceLabel, cellValue) {
  if (!target || !Array.isArray(target.rows) || target.rows.length === 0 || !Array.isArray(target.rows[0])) {
    fail('MIG010_PRIVATE_TARGET_HEADERS_INVALID');
  }
  const header = target.rows[0].map(cellValue);
  const occurredIndex = uniqueHeaderIndex(header, ['Дата и время'], 'MIG010_PRIVATE_TARGET_OCCURRED_HEADER_INVALID');
  const sourceIndex = uniqueHeaderIndex(header, ['Источник'], 'MIG010_PRIVATE_TARGET_SOURCE_HEADER_INVALID');

  return {
    ...target,
    rows: target.rows.map((row, rowIndex) => {
      if (!Array.isArray(row)) fail('MIG010_PRIVATE_TARGET_ROW_INVALID');
      if (rowIndex === 0) return row.slice();
      const copy = row.slice();
      const rowSource = copy[sourceIndex] == null ? '' : text(cellValue(copy[sourceIndex]));
      const occurred = copy[occurredIndex] == null ? '' : text(cellValue(copy[occurredIndex]));
      if (rowSource === sourceLabel && occurred === '') {
        copy[occurredIndex] = diagnosticDateCell(copy[occurredIndex]);
      }
      return copy;
    })
  };
}

function normalizedPackage(pkg, sourceName, targetName, sourceLabel, cellValue) {
  const source = findSheet(pkg, sourceName);
  const target = findSheet(pkg, targetName);
  if (source === target) fail('MIG010_PRIVATE_SOURCE_TARGET_MUST_DIFFER');
  const normalizedSource = normalizeSourceSheet(source, cellValue);
  const normalizedTarget = normalizeTargetDiagnostics(target, sourceLabel, cellValue);

  return {
    ...pkg,
    content: {
      ...pkg.content,
      sheets: pkg.content.sheets.map((sheet) => {
        if (sheet === source) return normalizedSource;
        if (sheet === target) return normalizedTarget;
        return sheet;
      })
    }
  };
}

module.exports = {
  schema: SCHEMA,
  mappingVersion: 'LEGACY-SPLIT-v3+LEADING-v1+TIME-v1+TARGET-DATE-DIAG-v1',

  buildSnapshot({ backupPackage, cellValue }) {
    if (!backupPackage || backupPackage.format !== 'PRH_PORTABLE_BACKUP_V1') {
      fail('MIG010_PRIVATE_BACKUP_FORMAT_INVALID');
    }
    if (typeof cellValue !== 'function') fail('MIG010_PRIVATE_CELL_VALUE_REQUIRED');

    const repoRoot = requiredEnv('MIG010_REPO_ROOT');
    const sourceName = requiredEnv('MIG010_SOURCE_SHEET');
    const targetName = requiredEnv('MIG010_TARGET_SHEET');
    const sourceLabel = text(process.env.MIG010_SOURCE_LABEL) || sourceName;
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
      backupPackage: normalizedPackage(backupPackage, sourceName, targetName, sourceLabel, cellValue),
      cellValue
    });
  }
};
