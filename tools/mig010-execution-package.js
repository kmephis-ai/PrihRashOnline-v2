'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const POLICY = require('../lib/migration/mig010_execution_policy.v1.json');
const { readEncryptedBackup, canonicalJson, sha256Hex } = require('./private-backup');
const {
  assertOutsideRepository,
  readBackupKey,
  backupCellValue,
  normalizeSnapshot
} = require('./mig010-owner');
const { verifyResolvedCandidate } = require('./mig010-rebuild-dry-run');
const {
  PROPOSAL_SCHEMA,
  RESOLUTION_SCHEMA,
  RESOLVED_SCHEMA
} = require('../lib/migration/mig010_repair_policy');
const { sourceFingerprint } = require('../lib/migration/migration_reconciliation');
const { validateCanonicalCollection } = require('../lib/domain/canonical_transaction');
const { repositoryRevision } = require('../lib/repository/transaction_repository');

const PACKAGE_SCHEMA = 'MIG010_OWNER_EXECUTION_PACKAGE_V1';
const TOOL_SCHEMA = 'MIG010_EXECUTION_PACKAGE_TOOL_V1';
const MAX_BATCH_ROWS = 100;
const SHA256_RE = /^[0-9a-f]{64}$/;
const TARGET_HEADERS = Object.freeze([
  'ID', 'Дата и время', 'Дата', 'Месяц', 'Тип', 'Сумма', 'Счёт', 'Счёт назначения',
  'Категория', 'Подкатегория', 'Наименование', 'Член семьи', 'Проект', 'Теги',
  'Регулярная', 'Комментарий', 'Источник', 'Строка источника', 'Статус', 'Исходный тип'
]);
const SOURCE_HEADER = Object.freeze([
  ['Дата', 'Отметка времени'], ['Тип операции'], ['Счет', 'Счёт'], ['Категория'],
  ['Наименование'], ['Сумма'], ['Счет', 'Счёт'], ['Источник'], ['Сумма']
]);

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function safeReason(error, fallback = 'MIG010_EXECUTION_PACKAGE_FAILED') {
  const value = String(error && (error.code || error.message) || '');
  return /^[A-Z][A-Z0-9_]{2,95}$/.test(value) ? value : fallback;
}

function text(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
}

function lower(value) {
  return text(value).toLowerCase();
}

function envRequired(name) {
  const value = text(process.env[name]);
  if (!value) fail(`MIG010_EXECUTION_ENV_${name}_REQUIRED`);
  return value;
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      result._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function readPrivateJson(filePath, reason) {
  const resolved = assertOutsideRepository(filePath, 'MIG010_EXECUTION_PRIVATE_PATH_INSIDE_REPOSITORY');
  try { return JSON.parse(fs.readFileSync(resolved, 'utf8')); } catch (_) { fail(reason); }
}

function writePrivateJson(filePath, value) {
  const resolved = assertOutsideRepository(filePath, 'MIG010_EXECUTION_PRIVATE_PATH_INSIDE_REPOSITORY');
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'w', mode: 0o600 });
  try { fs.chmodSync(resolved, 0o600); } catch (_) { /* Windows ACL owner-managed. */ }
}

function assertPolicy() {
  if (!POLICY || POLICY.schema !== 'MIG010_EXECUTION_POLICY_V1' || POLICY.version !== '1.0.0' ||
      POLICY.strategy !== 'STAGE_VERIFY_REPLACE_WITH_ROLLBACK_V1' ||
      POLICY.authorization !== 'IRREVERSIBLE_ACTION_AUTHORIZED' ||
      POLICY.batch.max_rows !== MAX_BATCH_ROWS || POLICY.batch.readback_required !== true ||
      POLICY.mutation.rollback_copy_required !== true || POLICY.mutation.staging_sheet_required !== true ||
      POLICY.public_ci_can_authorize_real_write !== false || POLICY.write_authority_default !== false) {
    fail('MIG010_EXECUTION_POLICY_INVALID');
  }
  return true;
}

function findSheet(pkg, name) {
  const sheets = pkg && pkg.content && pkg.content.sheets;
  if (!Array.isArray(sheets)) fail('MIG010_EXECUTION_BACKUP_SHEETS_INVALID');
  const matches = sheets.filter((sheet) => sheet && sheet.metadata && sheet.metadata.name === name);
  if (matches.length !== 1) fail('MIG010_EXECUTION_SHEET_SELECTION_INVALID');
  return matches[0];
}

function sourceOffset(sheet) {
  if (!sheet || !Array.isArray(sheet.rows) || sheet.rows.length === 0 || !Array.isArray(sheet.rows[0])) {
    fail('MIG010_EXECUTION_SOURCE_HEADERS_INVALID');
  }
  const header = sheet.rows[0].map(backupCellValue);
  for (let offset = 0; offset <= 3; offset += 1) {
    if (!header.slice(0, offset).every((value) => text(value) === '')) continue;
    let matches = true;
    for (let index = 0; index < SOURCE_HEADER.length; index += 1) {
      const actual = lower(header[offset + index]);
      if (!SOURCE_HEADER[index].some((candidate) => actual === lower(candidate))) {
        matches = false;
        break;
      }
    }
    if (matches) return offset;
  }
  fail('MIG010_EXECUTION_SOURCE_HEADER_BLOCK_NOT_FOUND');
}

function targetHeaderIndex(sheet) {
  if (!sheet || !Array.isArray(sheet.rows) || sheet.rows.length === 0 || !Array.isArray(sheet.rows[0])) {
    fail('MIG010_EXECUTION_TARGET_HEADERS_INVALID');
  }
  const headers = sheet.rows[0].map((cell) => text(backupCellValue(cell)));
  if (headers.length !== TARGET_HEADERS.length) fail('MIG010_EXECUTION_TARGET_WIDTH_INVALID');
  TARGET_HEADERS.forEach((expected, index) => {
    if (headers[index] !== expected) fail('MIG010_EXECUTION_TARGET_HEADER_ORDER_INVALID');
  });
  return Object.freeze({ source: 16, sourceRow: 17, occurred: 1 });
}

function normalizedHashCell(cell) {
  if (!cell || typeof cell !== 'object') fail('MIG010_EXECUTION_CELL_INVALID');
  if (cell.f) return Object.freeze({ f: String(cell.f) });
  if (cell.t === 'd') {
    const value = String(cell.v || '');
    if (!Number.isFinite(Date.parse(value))) fail('MIG010_EXECUTION_DATE_CELL_INVALID');
    return Object.freeze({ t: 'd', v: new Date(value).toISOString() });
  }
  if (cell.t === 'n') {
    if (typeof cell.v !== 'number' || !Number.isFinite(cell.v)) fail('MIG010_EXECUTION_NUMBER_CELL_INVALID');
    return Object.freeze({ t: 'n', v: cell.v });
  }
  if (cell.t === 'b') return Object.freeze({ t: 'b', v: Boolean(cell.v) });
  if (cell.t === 's') return Object.freeze({ t: 's', v: String(cell.v == null ? '' : cell.v) });
  fail('MIG010_EXECUTION_CELL_TYPE_INVALID');
}

function rawTableHash(rows) {
  return sha256Hex(canonicalJson(rows.map((row) => row.map(normalizedHashCell))));
}

function stablePrivateId(kind, raw) {
  const normalized = lower(raw);
  if (!normalized) return '';
  const digest = crypto.createHash('sha256').update(`${kind}:${normalized}`, 'utf8').digest('hex');
  return `mig-${kind}-${digest.slice(0, 32)}`;
}

function formulaCell(formula) {
  return { t: 's', v: '', f: formula };
}
function stringCell(value) { return { t: 's', v: String(value == null ? '' : value) }; }
function numberCell(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('MIG010_EXECUTION_NUMBER_INVALID');
  return { t: 'n', v: value };
}
function dateCell(value) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) fail('MIG010_EXECUTION_DATE_INVALID');
  return { t: 'd', v: new Date(parsed).toISOString() };
}

function formulaLikeTextForbidden(value) {
  const raw = String(value == null ? '' : value);
  if (/^\s*=/.test(raw)) fail('MIG010_EXECUTION_FORMULA_LIKE_TEXT_UNSUPPORTED');
  return raw;
}

function rebasedRetainedRow(raw, sheetRow) {
  if (!Array.isArray(raw) || raw.length !== TARGET_HEADERS.length) fail('MIG010_EXECUTION_TARGET_ROW_WIDTH_INVALID');
  raw.forEach((cell, index) => {
    if (cell && cell.f && index !== 2 && index !== 3) fail('MIG010_EXECUTION_TARGET_UNSUPPORTED_FORMULA');
    if (cell && !cell.f && cell.t === 's') formulaLikeTextForbidden(cell.v);
  });
  const row = raw.map((cell) => ({ ...cell }));
  row[2] = formulaCell(`=IF(B${sheetRow}="";"";INT(B${sheetRow}))`);
  row[3] = formulaCell(`=IF(C${sheetRow}="";"";DATE(YEAR(C${sheetRow});MONTH(C${sheetRow});1))`);
  return row;
}

function sourcePositionRow(tx) {
  const match = /^row:(\d+)$/.exec(String(tx && tx.provenance && tx.provenance.source_position || ''));
  if (!match) fail('MIG010_EXECUTION_CANDIDATE_SOURCE_POSITION_INVALID');
  const row = Number(match[1]);
  if (!Number.isInteger(row) || row < 2) fail('MIG010_EXECUTION_CANDIDATE_SOURCE_POSITION_INVALID');
  return row;
}

function typeLabel(type) {
  if (type === 'expense') return 'Расход';
  if (type === 'income') return 'Доход';
  fail('MIG010_EXECUTION_LEGACY_TYPE_UNSUPPORTED');
}

function candidateRawLabels(sourceSheet, offset, sourceRow, type) {
  const raw = sourceSheet.rows[sourceRow - 1];
  if (!Array.isArray(raw)) fail('MIG010_EXECUTION_SOURCE_ROW_NOT_FOUND');
  const row = raw.slice(offset).map(backupCellValue);
  const rawType = text(row[1]);
  const account = text(type === 'expense' ? row[2] : row[6]);
  const category = text(type === 'expense' ? row[3] : row[7]);
  const name = text(type === 'expense' ? row[4] : row[7]);
  if (!account || !category || !name) fail('MIG010_EXECUTION_SOURCE_LABELS_INVALID');
  [rawType, account, category, name].forEach(formulaLikeTextForbidden);
  return { rawType, account, category, name };
}

function sourceRecordByRow(snapshot, sourceRow) {
  const matches = snapshot.source_records.filter((record) => Number(record && record.source_row) === sourceRow);
  if (matches.length !== 1) fail('MIG010_EXECUTION_SOURCE_RECORD_AMBIGUOUS');
  return matches[0];
}

function buildCandidateRow(tx, sourceSheet, offset, snapshot, sourceLabel, sheetRow) {
  const sourceRow = sourcePositionRow(tx);
  const source = sourceRecordByRow(snapshot, sourceRow);
  const fingerprint = sourceFingerprint(source);
  if (fingerprint !== tx.provenance.source_fingerprint) fail('MIG010_EXECUTION_SOURCE_FINGERPRINT_MISMATCH');
  if (source.source_quality !== 'VALID') fail('MIG010_EXECUTION_INVALID_SOURCE_SELECTED');
  const labels = candidateRawLabels(sourceSheet, offset, sourceRow, tx.type);
  if (stablePrivateId('account', labels.account) !== tx.account_id ||
      stablePrivateId('category', labels.category) !== tx.category_id) {
    fail('MIG010_EXECUTION_DIMENSION_LABEL_MISMATCH');
  }
  if (text(labels.name) !== text(tx.description)) fail('MIG010_EXECUTION_DESCRIPTION_MISMATCH');
  if (tx.status !== 'posted' || tx.destination_account_id) fail('MIG010_EXECUTION_CANDIDATE_SEMANTICS_INVALID');
  if (!Number.isSafeInteger(tx.amount_minor) || tx.amount_minor < 0) fail('MIG010_EXECUTION_AMOUNT_INVALID');
  const major = tx.amount_minor / 100;
  if (!Number.isFinite(major)) fail('MIG010_EXECUTION_AMOUNT_INVALID');

  return [
    stringCell(tx.transaction_id),
    dateCell(tx.occurred_at),
    formulaCell(`=IF(B${sheetRow}="";"";INT(B${sheetRow}))`),
    formulaCell(`=IF(C${sheetRow}="";"";DATE(YEAR(C${sheetRow});MONTH(C${sheetRow});1))`),
    stringCell(typeLabel(tx.type)),
    numberCell(major),
    stringCell(labels.account),
    stringCell(''),
    stringCell(labels.category),
    stringCell(''),
    stringCell(labels.name),
    stringCell(''), stringCell(''), stringCell(''), stringCell(''), stringCell(''),
    stringCell(sourceLabel),
    numberCell(sourceRow),
    stringCell('Перенесено'),
    stringCell(labels.rawType || typeLabel(tx.type))
  ];
}

function buildExecutionPackage(input) {
  assertPolicy();
  const { pkg, cipherSha256, snapshot, proposal, resolution, resolved, sourceName, targetName, sourceLabel } = input || {};
  if (!pkg || !snapshot || !proposal || !resolution || !resolved) fail('MIG010_EXECUTION_PACKAGE_INPUT_INVALID');
  if (proposal.schema !== PROPOSAL_SCHEMA || resolution.schema !== RESOLUTION_SCHEMA || resolved.schema !== RESOLVED_SCHEMA) {
    fail('MIG010_EXECUTION_REPAIR_BINDING_INVALID');
  }
  if (snapshot.backup_cipher_sha256 !== cipherSha256 || proposal.backup_cipher_sha256 !== cipherSha256) {
    fail('MIG010_EXECUTION_BACKUP_BINDING_MISMATCH');
  }
  const rebuild = verifyResolvedCandidate({ snapshot, proposal, resolution, resolved });
  if (rebuild.status !== 'PASS' || rebuild.reconciliationReady !== true || rebuild.writeAuthorized !== false) {
    fail('MIG010_EXECUTION_REBUILD_NOT_READY');
  }

  const candidate = validateCanonicalCollection(resolved.canonical_candidate);
  const candidateRevision = repositoryRevision(candidate);
  if (candidateRevision !== rebuild.candidateRevisionHash) fail('MIG010_EXECUTION_CANDIDATE_REVISION_MISMATCH');
  const sourceSheet = findSheet(pkg, sourceName);
  const targetSheet = findSheet(pkg, targetName);
  const offset = sourceOffset(sourceSheet);
  const targetIndex = targetHeaderIndex(targetSheet);
  const header = targetSheet.rows[0].map((cell) => ({ ...cell }));
  const currentTableHash = rawTableHash(targetSheet.rows);

  const retained = [];
  for (let index = 1; index < targetSheet.rows.length; index += 1) {
    const raw = targetSheet.rows[index];
    const rowSource = text(backupCellValue(raw[targetIndex.source]));
    if (rowSource === sourceLabel) continue;
    retained.push(raw);
  }
  const sortedCandidate = candidate.slice().sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at) || a.transaction_id.localeCompare(b.transaction_id));
  const finalRows = [];
  retained.forEach((raw) => finalRows.push(rebasedRetainedRow(raw, finalRows.length + 2)));
  sortedCandidate.forEach((tx) => finalRows.push(buildCandidateRow(
    tx, sourceSheet, offset, snapshot, sourceLabel, finalRows.length + 2)));

  const finalTableHash = rawTableHash([header, ...finalRows]);
  const batches = [];
  for (let offsetRows = 0; offsetRows < finalRows.length; offsetRows += MAX_BATCH_ROWS) {
    const rows = finalRows.slice(offsetRows, offsetRows + MAX_BATCH_ROWS);
    const batchIndex = batches.length;
    batches.push(Object.freeze({
      batch_index: batchIndex,
      start_sheet_row: offsetRows + 2,
      batch_hash: rawTableHash(rows),
      rows: Object.freeze(rows.map((row) => Object.freeze(row.map((cell) => Object.freeze({ ...cell })))))
    }));
  }

  const identity = {
    schema: PACKAGE_SCHEMA,
    policy_schema: POLICY.schema,
    policy_version: POLICY.version,
    strategy: POLICY.strategy,
    resolved_hash: resolved.resolved_hash,
    proposal_hash: proposal.proposal_hash,
    source_revision_hash: resolved.source_revision,
    candidate_revision_hash: candidateRevision,
    initial_target_revision_hash: resolved.target_revision,
    backup_cipher_sha256: cipherSha256,
    current_raw_table_hash: currentTableHash,
    final_raw_table_hash: finalTableHash,
    target_header_hash: rawTableHash([header]),
    batch_hashes: batches.map((batch) => batch.batch_hash)
  };
  const packageHash = sha256Hex(canonicalJson(identity));

  return Object.freeze({
    schema: PACKAGE_SCHEMA,
    policy_schema: POLICY.schema,
    policy_version: POLICY.version,
    strategy: POLICY.strategy,
    package_hash: packageHash,
    resolved_hash: resolved.resolved_hash,
    proposal_hash: proposal.proposal_hash,
    source_revision_hash: resolved.source_revision,
    candidate_revision_hash: candidateRevision,
    initial_target_revision_hash: resolved.target_revision,
    backup_cipher_sha256: cipherSha256,
    current_raw_table_hash: currentTableHash,
    final_raw_table_hash: finalTableHash,
    target_header_hash: identity.target_header_hash,
    target_sheet_name: targetName,
    header: Object.freeze(header.map((cell) => Object.freeze({ ...cell }))),
    batches: Object.freeze(batches),
    write_authorized: false
  });
}

function commandPrepare(args) {
  for (const required of ['backup', 'key', 'snapshot', 'proposal', 'resolution', 'resolved', 'out']) {
    if (!args[required]) fail('MIG010_EXECUTION_PREPARE_ARGUMENTS_REQUIRED');
  }
  const backupPath = assertOutsideRepository(args.backup, 'MIG010_EXECUTION_BACKUP_INSIDE_REPOSITORY');
  const key = readBackupKey(args.key);
  const { pkg, cipherSha256 } = readEncryptedBackup(backupPath, key);
  const snapshot = normalizeSnapshot(readPrivateJson(args.snapshot, 'MIG010_EXECUTION_SNAPSHOT_READ_FAILED'));
  const proposal = readPrivateJson(args.proposal, 'MIG010_EXECUTION_PROPOSAL_READ_FAILED');
  const resolution = readPrivateJson(args.resolution, 'MIG010_EXECUTION_RESOLUTION_READ_FAILED');
  const resolved = readPrivateJson(args.resolved, 'MIG010_EXECUTION_RESOLVED_READ_FAILED');
  const sourceName = envRequired('MIG010_SOURCE_SHEET');
  const targetName = envRequired('MIG010_TARGET_SHEET');
  const sourceLabel = text(process.env.MIG010_SOURCE_LABEL) || sourceName;
  const executionPackage = buildExecutionPackage({
    pkg, cipherSha256, snapshot, proposal, resolution, resolved, sourceName, targetName, sourceLabel
  });
  writePrivateJson(args.out, executionPackage);
  return {
    schema: 'MIG010_OWNER_EXECUTION_PACKAGE_PREPARE_V1',
    status: 'PACKAGE_READY',
    packageHash: executionPackage.package_hash,
    resolvedHash: executionPackage.resolved_hash,
    candidateRevisionHash: executionPackage.candidate_revision_hash,
    currentRawTableHash: executionPackage.current_raw_table_hash,
    finalRawTableHash: executionPackage.final_raw_table_hash,
    packageWritten: true,
    financialPayloadStdout: false,
    writeAuthorized: false
  };
}

function commandContract() {
  return {
    schema: TOOL_SCHEMA,
    packageSchema: PACKAGE_SCHEMA,
    executionPolicy: `${POLICY.schema}@${POLICY.version}`,
    strategy: POLICY.strategy,
    maxBatchRows: MAX_BATCH_ROWS,
    exactBackupBinding: true,
    exactResolvedBinding: true,
    rawTableHashBinding: true,
    retainNonScopedTargetRows: true,
    formulaLikeTextFailClosed: true,
    financialPayloadStdout: false,
    writeCommandEnabled: false
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  try {
    let result;
    if (command === 'prepare') result = commandPrepare(args);
    else if (command === 'contract') result = commandContract();
    else if (command === 'execute' || command === 'write' || command === 'apply' || command === 'authorize') {
      fail('MIGRATION_IRREVERSIBLE_ACTION_TOOL_NOT_ENABLED');
    } else fail('MIG010_EXECUTION_PACKAGE_COMMAND_INVALID');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'FAIL', reason: safeReason(error) })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  PACKAGE_SCHEMA,
  TOOL_SCHEMA,
  MAX_BATCH_ROWS,
  TARGET_HEADERS,
  assertPolicy,
  sourceOffset,
  targetHeaderIndex,
  normalizedHashCell,
  rawTableHash,
  rebasedRetainedRow,
  buildCandidateRow,
  buildExecutionPackage,
  commandPrepare,
  commandContract
};
