'use strict';

/**
 * PUBLIC-SAFE OWNER TEMPLATE.
 *
 * Copy this file OUTSIDE the Git repository before use. Runtime-only private
 * selectors are supplied through environment variables; do not hard-code them
 * in the tracked file and do not publish the configured copy.
 *
 * Required local env:
 *   MIG010_REPO_ROOT     - local checkout containing the exact MIG-010 code
 *   MIG010_SOURCE_SHEET  - owner-private legacy source sheet name
 *   MIG010_TARGET_SHEET  - owner-private current canonical-register sheet name
 * Optional:
 *   MIG010_SOURCE_LABEL  - value expected in target provenance/source column;
 *                          defaults to MIG010_SOURCE_SHEET
 *   MIG010_CURRENCY      - ISO-4217 currency, default RUB
 */

const crypto = require('crypto');
const path = require('path');

const MAPPER_SCHEMA = 'MIG010_OWNER_PRIVATE_MAPPER_V1';
const MAPPING_VERSION = 'LEGACY-SPLIT-FORM-TO-CANONICAL-v2';
const SOURCE_TRANSFORM_VERSION = 'SOURCE-TRANSFORM-v1';
const SOURCE_SYSTEM = 'GOOGLE_FORM_LEGACY';

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

function envRequired(name) {
  const value = text(process.env[name]);
  if (!value) fail(`MIG010_PRIVATE_ENV_${name}_REQUIRED`);
  return value;
}

function loadProjectModules() {
  const repoRoot = envRequired('MIG010_REPO_ROOT');
  let canonical;
  let googleAdapter;
  try {
    canonical = require(path.join(repoRoot, 'lib', 'domain', 'canonical_transaction.js'));
    googleAdapter = require(path.join(repoRoot, 'lib', 'adapters', 'google_sheets_transaction_repository.js'));
  } catch (_) {
    fail('MIG010_PRIVATE_PROJECT_MODULE_LOAD_FAILED');
  }
  if (!canonical || typeof canonical.fromMigrationCanonicalRecord !== 'function' ||
      !googleAdapter || typeof googleAdapter.majorToMinorExact !== 'function') {
    fail('MIG010_PRIVATE_PROJECT_MODULE_CONTRACT_INVALID');
  }
  return { canonical, majorToMinorExact: googleAdapter.majorToMinorExact };
}

function privateStableId(kind, raw) {
  const normalized = lower(raw);
  if (!normalized) return '';
  const digest = crypto.createHash('sha256').update(`${kind}:${normalized}`, 'utf8').digest('hex');
  return `mig-${kind}-${digest.slice(0, 32)}`;
}

function findSheet(backupPackage, name) {
  const sheets = backupPackage && backupPackage.content && backupPackage.content.sheets;
  if (!Array.isArray(sheets)) fail('MIG010_PRIVATE_BACKUP_SHEETS_INVALID');
  const matches = sheets.filter((sheet) => sheet && sheet.metadata && sheet.metadata.name === name);
  if (matches.length !== 1) fail('MIG010_PRIVATE_SHEET_SELECTION_INVALID');
  return matches[0];
}

function values(sheet, cellValue) {
  if (!sheet || !Array.isArray(sheet.rows) || typeof cellValue !== 'function') {
    fail('MIG010_PRIVATE_SHEET_ROWS_INVALID');
  }
  return sheet.rows.map((row) => {
    if (!Array.isArray(row)) fail('MIG010_PRIVATE_SHEET_ROW_INVALID');
    return row.map(cellValue);
  });
}

function assertHeaderAt(headers, index, allowed, reason) {
  const actual = lower(headers[index]);
  if (!allowed.some((candidate) => actual === lower(candidate))) fail(reason);
}

function assertLegacySourceHeaders(headers) {
  if (!Array.isArray(headers) || headers.length < 9) fail('MIG010_PRIVATE_SOURCE_HEADERS_INVALID');
  assertHeaderAt(headers, 0, ['Дата'], 'MIG010_PRIVATE_SOURCE_DATE_HEADER_INVALID');
  assertHeaderAt(headers, 1, ['Тип операции'], 'MIG010_PRIVATE_SOURCE_TYPE_HEADER_INVALID');
  assertHeaderAt(headers, 2, ['Счет', 'Счёт'], 'MIG010_PRIVATE_SOURCE_EXPENSE_ACCOUNT_HEADER_INVALID');
  assertHeaderAt(headers, 3, ['Категория'], 'MIG010_PRIVATE_SOURCE_EXPENSE_CATEGORY_HEADER_INVALID');
  assertHeaderAt(headers, 4, ['Наименование'], 'MIG010_PRIVATE_SOURCE_NAME_HEADER_INVALID');
  assertHeaderAt(headers, 5, ['Сумма'], 'MIG010_PRIVATE_SOURCE_EXPENSE_AMOUNT_HEADER_INVALID');
  assertHeaderAt(headers, 6, ['Счет', 'Счёт'], 'MIG010_PRIVATE_SOURCE_INCOME_ACCOUNT_HEADER_INVALID');
  assertHeaderAt(headers, 7, ['Источник'], 'MIG010_PRIVATE_SOURCE_INCOME_SOURCE_HEADER_INVALID');
  assertHeaderAt(headers, 8, ['Сумма'], 'MIG010_PRIVATE_SOURCE_INCOME_AMOUNT_HEADER_INVALID');
}

function targetHeaderIndex(headers) {
  const normalized = headers.map(text);
  const aliases = {
    id: ['ID'],
    occurred: ['Дата и время'],
    type: ['Тип'],
    amount: ['Сумма'],
    account: ['Счёт', 'Счет'],
    destination: ['Счёт назначения', 'Счет назначения'],
    category: ['Категория'],
    name: ['Наименование'],
    source: ['Источник'],
    sourceRow: ['Строка источника']
  };
  const result = {};
  Object.keys(aliases).forEach((key) => {
    const positions = normalized.map((value, index) => aliases[key].includes(value) ? index : -1).filter((index) => index >= 0);
    if (positions.length !== 1) fail(`MIG010_PRIVATE_TARGET_${key.toUpperCase()}_HEADER_INVALID`);
    result[key] = positions[0];
  });
  return result;
}

function toIso(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 100000000000 ? value : Date.UTC(1899, 11, 30) + Math.round(value * 86400000);
    const date = new Date(ms);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  const raw = text(value);
  if (!raw) fail('MIG010_PRIVATE_DATE_INVALID');
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  const match = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(raw);
  if (!match) fail('MIG010_PRIVATE_DATE_INVALID');
  const date = new Date(Date.UTC(
    Number(match[3]), Number(match[2]) - 1, Number(match[1]),
    Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0)
  ));
  if (!Number.isFinite(date.getTime())) fail('MIG010_PRIVATE_DATE_INVALID');
  return date.toISOString();
}

function canonicalType(value) {
  const normalized = lower(value);
  const map = {
    'доход': 'income', income: 'income',
    'расход': 'expense', expense: 'expense',
    'перевод': 'transfer', transfer: 'transfer',
    'возврат': 'refund', refund: 'refund',
    'корректировка': 'adjustment', adjustment: 'adjustment'
  };
  if (!map[normalized]) fail('MIG010_PRIVATE_TYPE_UNMAPPED');
  return map[normalized];
}

function minorExact(value, majorToMinorExact) {
  let raw = text(value).replace(',', '.');
  if (!raw) fail('MIG010_PRIVATE_AMOUNT_INVALID');
  if (raw.startsWith('-')) raw = raw.slice(1);
  return majorToMinorExact(raw);
}

function invalidSource(sourceSystem, sourceSheet, sourceRow) {
  return {
    source_system: sourceSystem,
    source_sheet: sourceSheet,
    source_row: sourceRow,
    transform_version: SOURCE_TRANSFORM_VERSION,
    source_quality: 'INVALID'
  };
}

function legacySourceRecords(sourceSheet, cellValue, majorToMinorExact, config) {
  const table = values(sourceSheet, cellValue);
  if (table.length < 1) fail('MIG010_PRIVATE_SOURCE_EMPTY');
  const headers = table[0];
  assertLegacySourceHeaders(headers);
  const out = [];

  for (let offset = 1; offset < table.length; offset += 1) {
    const row = table[offset];
    const sourceRow = offset + 1;
    const rawType = lower(row[1]);
    const transactionalPayload = row.slice(2, 9).some((value) => text(value) !== '');
    if (!rawType && !transactionalPayload) continue;

    let type;
    if (rawType === 'расход' || rawType === 'expense') type = 'expense';
    else if (rawType === 'доход' || rawType === 'income') type = 'income';
    else {
      out.push(invalidSource(config.sourceSystem, config.sourceContainer, sourceRow));
      continue;
    }

    const accountRaw = type === 'expense' ? row[2] : row[6];
    const categoryRaw = type === 'expense' ? row[3] : row[7];
    const nameRaw = type === 'expense' ? row[4] : row[7];
    const amountRaw = type === 'expense' ? row[5] : row[8];
    try {
      const occurredAt = toIso(row[0]);
      const accountId = privateStableId('account', accountRaw);
      const categoryId = privateStableId('category', categoryRaw);
      const name = text(nameRaw);
      if (!accountId || !categoryId || !name) throw new Error('MIG010_PRIVATE_SOURCE_REQUIRED_FIELD_MISSING');
      out.push({
        source_system: config.sourceSystem,
        source_sheet: config.sourceContainer,
        source_row: sourceRow,
        transform_version: SOURCE_TRANSFORM_VERSION,
        occurred_at: occurredAt,
        type,
        amount_minor: minorExact(amountRaw, majorToMinorExact),
        currency: config.currency,
        account_id: accountId,
        destination_account_id: '',
        category_id: categoryId,
        name,
        source_quality: 'VALID'
      });
    } catch (_) {
      out.push(invalidSource(config.sourceSystem, config.sourceContainer, sourceRow));
    }
  }
  return out;
}

function targetCanonicalRecords(targetSheet, cellValue, majorToMinorExact, fromMigrationCanonicalRecord, config) {
  const table = values(targetSheet, cellValue);
  if (table.length < 1) fail('MIG010_PRIVATE_TARGET_EMPTY');
  const index = targetHeaderIndex(table[0]);
  const out = [];

  for (let offset = 1; offset < table.length; offset += 1) {
    const row = table[offset];
    const sourceLabel = text(row[index.source]);
    if (!sourceLabel || sourceLabel !== config.sourceLabel) continue;
    const transactionId = text(row[index.id]);
    const sourceRow = Number(row[index.sourceRow]);
    if (!transactionId || !Number.isInteger(sourceRow) || sourceRow < 2) {
      fail('MIG010_PRIVATE_TARGET_PROVENANCE_INVALID');
    }
    const type = canonicalType(row[index.type]);
    const accountId = privateStableId('account', row[index.account]);
    const categoryId = privateStableId('category', row[index.category]);
    const destinationAccountId = type === 'transfer'
      ? privateStableId('account', row[index.destination])
      : '';
    if (!accountId || !categoryId || (type === 'transfer' && !destinationAccountId)) {
      fail('MIG010_PRIVATE_TARGET_DIMENSION_INVALID');
    }
    out.push(fromMigrationCanonicalRecord({
      transaction_id: transactionId,
      source_system: config.sourceSystem,
      source_sheet: config.sourceContainer,
      source_row: sourceRow,
      transform_version: SOURCE_TRANSFORM_VERSION,
      occurred_at: toIso(row[index.occurred]),
      type,
      status: 'posted',
      amount_minor: minorExact(row[index.amount], majorToMinorExact),
      currency: config.currency,
      account_id: accountId,
      destination_account_id: destinationAccountId,
      category_id: categoryId,
      name: text(row[index.name]),
      member_id: null,
      project_id: null,
      tags: [],
      counterparty: null,
      description: text(row[index.name]) || null,
      reverses_transaction_id: null,
      adjustment_semantics: type === 'refund' ? 'expense_reduction' : null
    }));
  }
  return out;
}

module.exports = {
  schema: MAPPER_SCHEMA,
  mappingVersion: MAPPING_VERSION,

  buildSnapshot({ backupPackage, cellValue }) {
    if (!backupPackage || backupPackage.format !== 'PRH_PORTABLE_BACKUP_V1') {
      fail('MIG010_PRIVATE_BACKUP_FORMAT_INVALID');
    }
    if (typeof cellValue !== 'function') fail('MIG010_PRIVATE_CELL_VALUE_REQUIRED');

    const sourceSheetName = envRequired('MIG010_SOURCE_SHEET');
    const targetSheetName = envRequired('MIG010_TARGET_SHEET');
    const sourceLabel = text(process.env.MIG010_SOURCE_LABEL) || sourceSheetName;
    const currency = text(process.env.MIG010_CURRENCY || 'RUB').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) fail('MIG010_PRIVATE_CURRENCY_INVALID');

    const sourceSheet = findSheet(backupPackage, sourceSheetName);
    const targetSheet = findSheet(backupPackage, targetSheetName);
    const { canonical, majorToMinorExact } = loadProjectModules();
    const config = {
      sourceLabel,
      sourceSystem: SOURCE_SYSTEM,
      sourceContainer: sourceLabel,
      currency
    };

    return {
      source_records: legacySourceRecords(sourceSheet, cellValue, majorToMinorExact, config),
      canonical_records: targetCanonicalRecords(
        targetSheet,
        cellValue,
        majorToMinorExact,
        canonical.fromMigrationCanonicalRecord,
        config
      )
    };
  }
};
