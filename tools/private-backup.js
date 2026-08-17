'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const BACKUP_FORMAT = 'PRH_PORTABLE_BACKUP_V1';
const ENVELOPE_FORMAT = 'PRH_ENCRYPTED_BACKUP_V1';
const EVIDENCE_SCHEMA = 'DR-001-EVIDENCE-v1';
const SOURCE_FORMAT = 'PRH_BACKUP_SOURCE_V1';
const SOURCE_SCHEMA_VERSION = 1;
const CIPHER = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const MAX_CHUNK_ROWS = 200;
const RPO_TARGET_MS = 24 * 60 * 60 * 1000;
const RTO_TARGET_MS = 4 * 60 * 60 * 1000;
const API_DEPLOYMENT_DESCRIPTION = 'CI-002 authenticated runtime verification';
const ALLOWED_BACKUP_FUNCTIONS = new Set(['prhBackupDescribe', 'prhBackupReadChunk']);

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function sha256Hex(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function safeReason(error, fallback) {
  const value = String(error && error.message || '');
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(value) ? value : fallback;
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

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

function readKey(keyPath) {
  const text = fs.readFileSync(keyPath, 'utf8').trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error('BACKUP_KEY_FORMAT_INVALID');
  const key = Buffer.from(text, 'base64');
  if (key.length !== KEY_BYTES) throw new Error('BACKUP_KEY_LENGTH_INVALID');
  return key;
}

function createKeyFile(keyPath) {
  ensureParent(keyPath);
  const key = crypto.randomBytes(KEY_BYTES).toString('base64');
  fs.writeFileSync(keyPath, `${key}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  try { fs.chmodSync(keyPath, 0o600); } catch (_) { /* Windows ACL is owner-managed. */ }
  return { status: 'KEY_CREATED' };
}

function encodeEnvelope(plainObject, key) {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) throw new Error('BACKUP_KEY_LENGTH_INVALID');
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(CIPHER, key, iv);
  const plaintext = Buffer.from(canonicalJson(plainObject), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    format: ENVELOPE_FORMAT,
    version: 1,
    cipher: 'AES-256-GCM',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

function decodeEnvelope(envelope, key) {
  try {
    if (!envelope || envelope.format !== ENVELOPE_FORMAT || envelope.version !== 1 || envelope.cipher !== 'AES-256-GCM') {
      throw new Error('BACKUP_ENVELOPE_INVALID');
    }
    if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) throw new Error('BACKUP_KEY_LENGTH_INVALID');
    const iv = Buffer.from(String(envelope.iv || ''), 'base64');
    const tag = Buffer.from(String(envelope.tag || ''), 'base64');
    const ciphertext = Buffer.from(String(envelope.ciphertext || ''), 'base64');
    if (iv.length !== IV_BYTES || tag.length !== 16 || ciphertext.length === 0) throw new Error('BACKUP_ENVELOPE_INVALID');
    const decipher = crypto.createDecipheriv(CIPHER, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return JSON.parse(plaintext);
  } catch (error) {
    if (safeReason(error, '') === 'BACKUP_ENVELOPE_INVALID' || safeReason(error, '') === 'BACKUP_KEY_LENGTH_INVALID') throw error;
    throw new Error('BACKUP_DECRYPT_FAILED');
  }
}

function cellValue(cell) {
  if (!cell || typeof cell !== 'object') throw new Error('BACKUP_CELL_INVALID');
  if (cell.t === 'n') {
    if (typeof cell.v !== 'number' || !Number.isFinite(cell.v)) throw new Error('BACKUP_CELL_INVALID');
    return cell.v;
  }
  if (cell.t === 'b') {
    if (typeof cell.v !== 'boolean') throw new Error('BACKUP_CELL_INVALID');
    return cell.v;
  }
  if (cell.t === 'd') {
    if (typeof cell.v !== 'string' || !Number.isFinite(Date.parse(cell.v))) throw new Error('BACKUP_CELL_INVALID');
    return cell.v;
  }
  if (cell.t === 's') return String(cell.v == null ? '' : cell.v);
  throw new Error('BACKUP_CELL_TYPE_INVALID');
}

function cellIsEmpty(cell) {
  const value = cellValue(cell);
  return value === '' && !String(cell && cell.f || '');
}

function sheetDigest(sheet) {
  return sha256Hex(canonicalJson({ metadata: sheet.metadata, rows: sheet.rows }));
}

function computeControlTotals(sheets) {
  const bySheet = {};
  for (const sheet of sheets) {
    let nonEmptyCells = 0;
    for (const row of sheet.rows) {
      for (const cell of row) if (!cellIsEmpty(cell)) nonEmptyCells += 1;
    }
    bySheet[sheet.metadata.name] = {
      rowCount: sheet.rows.length,
      columnCount: sheet.metadata.lastColumn,
      nonEmptyCells
    };
  }

  const operations = sheets.find((sheet) => sheet.metadata.name === '01 Операции');
  const operationTotals = {
    recordCount: 0,
    idCount: 0,
    amountMinorSum: 0
  };
  if (operations && operations.rows.length > 0) {
    const headers = operations.rows[0].map((cell) => String(cellValue(cell)));
    const idIndex = headers.indexOf('ID');
    const amountIndex = headers.indexOf('Сумма');
    for (const row of operations.rows.slice(1)) {
      if (!row.some((cell) => !cellIsEmpty(cell))) continue;
      operationTotals.recordCount += 1;
      if (idIndex >= 0 && row[idIndex] && String(cellValue(row[idIndex])).trim()) operationTotals.idCount += 1;
      if (amountIndex >= 0 && row[amountIndex] && row[amountIndex].t === 'n') {
        operationTotals.amountMinorSum += Math.round(cellValue(row[amountIndex]) * 100);
      }
    }
  }

  return { bySheet, operations: operationTotals };
}

function validateSourceSheet(sheet) {
  if (!sheet || typeof sheet !== 'object' || !sheet.metadata || !Array.isArray(sheet.rows)) throw new Error('BACKUP_SOURCE_SHEET_INVALID');
  const metadata = sheet.metadata;
  if (!metadata.name || !Number.isInteger(metadata.index) || metadata.index < 0) throw new Error('BACKUP_SOURCE_SHEET_INVALID');
  if (!Number.isInteger(metadata.lastRow) || metadata.lastRow < 0 || !Number.isInteger(metadata.lastColumn) || metadata.lastColumn < 0) {
    throw new Error('BACKUP_SOURCE_SHEET_INVALID');
  }
  if (sheet.rows.length !== metadata.lastRow) throw new Error('BACKUP_SOURCE_ROW_COUNT_MISMATCH');
  for (const row of sheet.rows) {
    if (!Array.isArray(row) || row.length !== metadata.lastColumn) throw new Error('BACKUP_SOURCE_COLUMN_COUNT_MISMATCH');
    row.forEach((cell) => cellValue(cell));
  }
}

function buildPortablePackage(sourceMeta, sheets, createdAt = new Date().toISOString()) {
  if (!sourceMeta || sourceMeta.format !== SOURCE_FORMAT || sourceMeta.schemaVersion !== SOURCE_SCHEMA_VERSION) {
    throw new Error('BACKUP_SOURCE_METADATA_INVALID');
  }
  if (!Array.isArray(sheets) || sheets.length !== sourceMeta.sheetCount) throw new Error('BACKUP_SOURCE_SHEET_COUNT_MISMATCH');
  sheets.forEach(validateSourceSheet);

  const names = new Set();
  for (const sheet of sheets) {
    if (names.has(sheet.metadata.name)) throw new Error('BACKUP_SOURCE_DUPLICATE_SHEET');
    names.add(sheet.metadata.name);
  }

  const sheetManifests = sheets.map((sheet) => ({
    name: sheet.metadata.name,
    index: sheet.metadata.index,
    rowCount: sheet.rows.length,
    columnCount: sheet.metadata.lastColumn,
    sha256: sheetDigest(sheet)
  }));
  const content = {
    source: {
      buildSha: String(sourceMeta.sourceBuildSha || ''),
      sourceTreeHash: String(sourceMeta.sourceTreeHash || '')
    },
    sheets
  };
  const contentSha256 = sha256Hex(canonicalJson(content));
  const manifest = {
    format: BACKUP_FORMAT,
    schemaVersion: 1,
    createdAt,
    datasetRevision: contentSha256,
    contentSha256,
    sourceBuildSha: content.source.buildSha,
    sourceTreeHash: content.source.sourceTreeHash,
    sheetCount: sheets.length,
    sheets: sheetManifests,
    controlTotals: computeControlTotals(sheets),
    restoreTool: 'tools/private-backup.js',
    credentialsIncluded: false
  };
  return { format: BACKUP_FORMAT, schemaVersion: 1, manifest, content };
}

function validatePortablePackage(pkg) {
  if (!pkg || pkg.format !== BACKUP_FORMAT || pkg.schemaVersion !== 1 || !pkg.manifest || !pkg.content) {
    throw new Error('BACKUP_PACKAGE_INVALID');
  }
  if (pkg.manifest.credentialsIncluded !== false) throw new Error('BACKUP_CREDENTIAL_CONTRACT_INVALID');
  if (!Array.isArray(pkg.content.sheets) || !Array.isArray(pkg.manifest.sheets)) throw new Error('BACKUP_PACKAGE_INVALID');
  if (pkg.content.sheets.length !== pkg.manifest.sheetCount || pkg.manifest.sheets.length !== pkg.manifest.sheetCount) {
    throw new Error('BACKUP_MANIFEST_SHEET_COUNT_MISMATCH');
  }
  const contentSha256 = sha256Hex(canonicalJson(pkg.content));
  if (contentSha256 !== pkg.manifest.contentSha256 || contentSha256 !== pkg.manifest.datasetRevision) {
    throw new Error('BACKUP_CONTENT_CHECKSUM_MISMATCH');
  }
  for (let index = 0; index < pkg.content.sheets.length; index += 1) {
    const sheet = pkg.content.sheets[index];
    validateSourceSheet(sheet);
    const manifestSheet = pkg.manifest.sheets[index];
    if (!manifestSheet || manifestSheet.name !== sheet.metadata.name || manifestSheet.index !== sheet.metadata.index) {
      throw new Error('BACKUP_SHEET_MANIFEST_MISMATCH');
    }
    if (sheetDigest(sheet) !== manifestSheet.sha256) throw new Error('BACKUP_SHEET_CHECKSUM_MISMATCH');
  }
  if (canonicalJson(computeControlTotals(pkg.content.sheets)) !== canonicalJson(pkg.manifest.controlTotals)) {
    throw new Error('BACKUP_CONTROL_TOTAL_MISMATCH');
  }
  if (!Number.isFinite(Date.parse(pkg.manifest.createdAt))) throw new Error('BACKUP_CREATED_AT_INVALID');
  return true;
}

async function refreshOAuth(authPath, profileName) {
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  const profile = auth && auth.tokens && auth.tokens[profileName];
  if (!profile) throw new Error('OAUTH_PROFILE_NOT_FOUND');
  const clientId = profile.client_id;
  const clientSecret = profile.client_secret;
  const refreshToken = profile.refresh_token;
  if (![clientId, clientSecret, refreshToken].every((value) => typeof value === 'string' && value.length > 0)) {
    throw new Error('OAUTH_PROFILE_INCOMPLETE');
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
  });
  const payload = await response.json().catch(() => null);
  const accessToken = payload && payload.access_token;
  if (!response.ok || typeof accessToken !== 'string' || !accessToken) throw new Error('OAUTH_TOKEN_REFRESH_FAILED');
  return accessToken;
}

function readScriptId(projectPath) {
  const config = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
  const scriptId = String(config && config.scriptId || '');
  if (!/^[A-Za-z0-9_-]{20,}$/.test(scriptId)) throw new Error('APPS_SCRIPT_ID_INVALID');
  return scriptId;
}

async function resolveApiDeployment(scriptId, accessToken) {
  const headers = { authorization: `Bearer ${accessToken}` };
  let pageToken = '';
  const matches = [];
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}/deployments`);
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !Array.isArray(payload.deployments)) throw new Error('API_DEPLOYMENT_LOOKUP_FAILED');
    for (const deployment of payload.deployments) {
      const description = String(deployment && deployment.deploymentConfig && deployment.deploymentConfig.description || '');
      const executionApi = Array.isArray(deployment && deployment.entryPoints)
        && deployment.entryPoints.some((entry) => entry && entry.entryPointType === 'EXECUTION_API');
      if (description === API_DEPLOYMENT_DESCRIPTION && executionApi) matches.push(deployment);
    }
    pageToken = String(payload.nextPageToken || '');
    if (!pageToken) break;
  }
  if (matches.length !== 1 || !/^AKfy[A-Za-z0-9_-]+$/.test(String(matches[0].deploymentId || ''))) {
    throw new Error('API_DEPLOYMENT_IDENTITY_INVALID');
  }
  return String(matches[0].deploymentId);
}

async function runBackupFunction(deploymentId, accessToken, functionName, parameters) {
  if (!ALLOWED_BACKUP_FUNCTIONS.has(functionName)) throw new Error('BACKUP_FUNCTION_NOT_ALLOWED');
  const response = await fetch(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(deploymentId)}:run`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ function: functionName, parameters, devMode: false })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error('BACKUP_EXECUTION_TRANSPORT_FAILED');
  if (payload.error) {
    const message = String(payload.error && payload.error.details && payload.error.details[0] && payload.error.details[0].errorMessage || '');
    const known = message.match(/BACKUP_SOURCE_[A-Z0-9_]+/);
    throw new Error(known ? known[0] : 'BACKUP_EXECUTION_FAILED');
  }
  const result = payload.response && payload.response.result;
  if (typeof result !== 'string') throw new Error('BACKUP_EXECUTION_RESPONSE_INVALID');
  try { return JSON.parse(result); } catch (_) { throw new Error('BACKUP_EXECUTION_RESPONSE_INVALID'); }
}

async function fetchWorkbookSource(options) {
  const accessToken = await refreshOAuth(options.authPath, options.profileName);
  const scriptId = readScriptId(options.projectPath);
  const deploymentId = await resolveApiDeployment(scriptId, accessToken);
  const describe = await runBackupFunction(deploymentId, accessToken, 'prhBackupDescribe', []);
  if (describe.format !== SOURCE_FORMAT || describe.schemaVersion !== SOURCE_SCHEMA_VERSION || !Array.isArray(describe.sheets)) {
    throw new Error('BACKUP_SOURCE_METADATA_INVALID');
  }
  if (describe.sheets.length !== describe.sheetCount) throw new Error('BACKUP_SOURCE_SHEET_COUNT_MISMATCH');

  const sheets = [];
  for (const metadata of describe.sheets) {
    if (!metadata || !metadata.name || !Number.isInteger(metadata.lastRow) || !Number.isInteger(metadata.lastColumn)) {
      throw new Error('BACKUP_SOURCE_SHEET_INVALID');
    }
    const rows = [];
    for (let startRow = 1; startRow <= metadata.lastRow; startRow += MAX_CHUNK_ROWS) {
      const chunk = await runBackupFunction(deploymentId, accessToken, 'prhBackupReadChunk', [{
        sheetName: metadata.name,
        startRow,
        maxRows: MAX_CHUNK_ROWS
      }]);
      if (chunk.format !== SOURCE_FORMAT || chunk.schemaVersion !== SOURCE_SCHEMA_VERSION
        || chunk.sheetName !== metadata.name || chunk.startRow !== startRow
        || !Array.isArray(chunk.rows) || chunk.rowCount !== chunk.rows.length
        || chunk.columnCount !== metadata.lastColumn) {
        throw new Error('BACKUP_SOURCE_CHUNK_INVALID');
      }
      rows.push(...chunk.rows);
    }
    sheets.push({ metadata: { ...metadata }, rows });
  }
  return { sourceMeta: describe, sheets };
}

function writeEncryptedBackup(outPath, pkg, key) {
  const envelope = encodeEnvelope(pkg, key);
  const serialized = `${canonicalJson(envelope)}\n`;
  ensureParent(outPath);
  const resolved = path.resolve(outPath);
  if (fs.existsSync(resolved)) throw new Error('BACKUP_OUTPUT_EXISTS');
  const tempPath = `${resolved}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, serialized, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  fs.renameSync(tempPath, resolved);
  return { cipherSha256: sha256Hex(Buffer.from(serialized, 'utf8')) };
}

function readEncryptedBackup(backupPath, key) {
  const serialized = fs.readFileSync(backupPath, 'utf8');
  let envelope;
  try { envelope = JSON.parse(serialized); } catch (_) { throw new Error('BACKUP_ENVELOPE_INVALID'); }
  const pkg = decodeEnvelope(envelope, key);
  validatePortablePackage(pkg);
  return { pkg, cipherSha256: sha256Hex(Buffer.from(serialized, 'utf8')) };
}

function restoreToSqliteAndReconcile(pkg, sqlitePath) {
  let db;
  try {
    db = new DatabaseSync(sqlitePath, { timeout: 5000 });
    db.exec(`
      PRAGMA journal_mode=DELETE;
      CREATE TABLE backup_sheets (
        name TEXT PRIMARY KEY,
        sheet_index INTEGER NOT NULL,
        metadata_json TEXT NOT NULL,
        expected_sha256 TEXT NOT NULL
      ) STRICT;
      CREATE TABLE backup_rows (
        sheet_name TEXT NOT NULL,
        row_index INTEGER NOT NULL,
        row_json TEXT NOT NULL,
        PRIMARY KEY (sheet_name, row_index),
        FOREIGN KEY (sheet_name) REFERENCES backup_sheets(name)
      ) STRICT;
    `);
    const insertSheet = db.prepare('INSERT INTO backup_sheets(name, sheet_index, metadata_json, expected_sha256) VALUES (?, ?, ?, ?)');
    const insertRow = db.prepare('INSERT INTO backup_rows(sheet_name, row_index, row_json) VALUES (?, ?, ?)');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (let index = 0; index < pkg.content.sheets.length; index += 1) {
        const sheet = pkg.content.sheets[index];
        const expected = pkg.manifest.sheets[index];
        insertSheet.run(sheet.metadata.name, sheet.metadata.index, canonicalJson(sheet.metadata), expected.sha256);
        for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex += 1) {
          insertRow.run(sheet.metadata.name, rowIndex, canonicalJson(sheet.rows[rowIndex]));
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    const restoredSheets = [];
    const sheetRows = db.prepare('SELECT name, sheet_index, metadata_json, expected_sha256 FROM backup_sheets ORDER BY sheet_index').all();
    const selectRows = db.prepare('SELECT row_json FROM backup_rows WHERE sheet_name = ? ORDER BY row_index');
    for (const record of sheetRows) {
      const metadata = JSON.parse(record.metadata_json);
      const rows = selectRows.all(record.name).map((row) => JSON.parse(row.row_json));
      const restored = { metadata, rows };
      if (sheetDigest(restored) !== record.expected_sha256) throw new Error('RESTORE_SHEET_CHECKSUM_MISMATCH');
      restoredSheets.push(restored);
    }
    if (canonicalJson(computeControlTotals(restoredSheets)) !== canonicalJson(pkg.manifest.controlTotals)) {
      throw new Error('RESTORE_CONTROL_TOTAL_MISMATCH');
    }
    const restoredContent = { source: pkg.content.source, sheets: restoredSheets };
    if (sha256Hex(canonicalJson(restoredContent)) !== pkg.manifest.contentSha256) {
      throw new Error('RESTORE_CONTENT_CHECKSUM_MISMATCH');
    }
    return { unexplainedMismatch: 0 };
  } finally {
    if (db) db.close();
  }
}

function writeEvidence(evidencePath, evidence) {
  if (!evidencePath) return;
  ensureParent(evidencePath);
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'w', mode: 0o600 });
}

function runRestoreDrill(backupPath, key, options = {}) {
  const startedAt = Date.now();
  const { pkg, cipherSha256 } = readEncryptedBackup(backupPath, key);
  const workdir = path.resolve(options.workdir || fs.mkdtempSync(path.join(os.tmpdir(), 'prh-drill-')));
  fs.mkdirSync(workdir, { recursive: true });
  const sqlitePath = path.join(workdir, `restore-${crypto.randomUUID()}.sqlite`);
  let destroyed = false;
  try {
    const reconciliation = restoreToSqliteAndReconcile(pkg, sqlitePath);
    const rtoMs = Date.now() - startedAt;
    const rpoMs = Math.max(0, Date.now() - Date.parse(pkg.manifest.createdAt));
    if (reconciliation.unexplainedMismatch !== 0) throw new Error('RESTORE_RECONCILIATION_MISMATCH');
    if (rpoMs > RPO_TARGET_MS) throw new Error('RESTORE_RPO_TARGET_MISSED');
    if (rtoMs > RTO_TARGET_MS) throw new Error('RESTORE_RTO_TARGET_MISSED');
    return {
      schema: EVIDENCE_SCHEMA,
      status: 'PASS',
      backupCipherSha256: cipherSha256,
      checksum: 'PASS',
      reconciliation: 'PASS',
      unexplainedMismatch: 0,
      rpoMs,
      rtoMs,
      temporaryTargetDestroyed: true
    };
  } finally {
    try {
      if (fs.existsSync(sqlitePath)) fs.unlinkSync(sqlitePath);
      destroyed = !fs.existsSync(sqlitePath);
    } catch (_) {
      destroyed = false;
    }
    if (!destroyed && fs.existsSync(sqlitePath)) {
      throw new Error('RESTORE_TEMP_TARGET_DELETE_FAILED');
    }
  }
}

async function commandBackup(args) {
  const authPath = path.resolve(args.auth || path.join(os.homedir(), '.clasprc.json'));
  const projectPath = path.resolve(args.project || '.clasp.json');
  const keyPath = path.resolve(String(args.key || ''));
  const outPath = path.resolve(String(args.out || ''));
  const profileName = String(args.user || 'prihrash-ci');
  if (!args.key || !args.out) throw new Error('BACKUP_KEY_AND_OUTPUT_REQUIRED');
  const key = readKey(keyPath);
  const { sourceMeta, sheets } = await fetchWorkbookSource({ authPath, projectPath, profileName });
  const pkg = buildPortablePackage(sourceMeta, sheets, new Date().toISOString());
  const result = writeEncryptedBackup(outPath, pkg, key);
  return {
    status: 'BACKUP_CREATED',
    encrypted: true,
    format: ENVELOPE_FORMAT,
    backupCipherSha256: result.cipherSha256,
    sourceBuildBound: /^[0-9a-f]{40}$/.test(String(pkg.manifest.sourceBuildSha || ''))
  };
}

function commandVerify(args) {
  if (!args.backup || !args.key) throw new Error('BACKUP_FILE_AND_KEY_REQUIRED');
  const key = readKey(path.resolve(args.key));
  const result = readEncryptedBackup(path.resolve(args.backup), key);
  return {
    status: 'PASS',
    schema: EVIDENCE_SCHEMA,
    backupCipherSha256: result.cipherSha256,
    checksum: 'PASS'
  };
}

function commandDrill(args) {
  if (!args.backup || !args.key) throw new Error('BACKUP_FILE_AND_KEY_REQUIRED');
  const key = readKey(path.resolve(args.key));
  const evidence = runRestoreDrill(path.resolve(args.backup), key, { workdir: args.workdir });
  writeEvidence(args.evidence ? path.resolve(args.evidence) : '', evidence);
  return evidence;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  try {
    let result;
    if (command === 'init-key') {
      if (!args.key) throw new Error('BACKUP_KEY_PATH_REQUIRED');
      result = createKeyFile(path.resolve(args.key));
    } else if (command === 'backup') {
      result = await commandBackup(args);
    } else if (command === 'verify') {
      result = commandVerify(args);
    } else if (command === 'drill') {
      result = commandDrill(args);
    } else {
      throw new Error('BACKUP_COMMAND_INVALID');
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'FAIL', reason: safeReason(error, 'BACKUP_TOOL_FAILED') })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  BACKUP_FORMAT,
  ENVELOPE_FORMAT,
  EVIDENCE_SCHEMA,
  RPO_TARGET_MS,
  RTO_TARGET_MS,
  canonicalJson,
  sha256Hex,
  encodeEnvelope,
  decodeEnvelope,
  computeControlTotals,
  sheetDigest,
  buildPortablePackage,
  validatePortablePackage,
  writeEncryptedBackup,
  readEncryptedBackup,
  restoreToSqliteAndReconcile,
  runRestoreDrill
};
