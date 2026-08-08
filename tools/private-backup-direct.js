'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildPortablePackage,
  writeEncryptedBackup
} = require('./private-backup');
const {
  SHA_RE,
  sha256,
  listDeployFiles,
  stableFileSetHash
} = require('./build-apps-script-candidate');

const SOURCE_FORMAT = 'PRH_BACKUP_SOURCE_V1';
const SOURCE_SCHEMA_VERSION = 1;
const MAX_CHUNK_ROWS = 200;
const KEY_BYTES = 32;

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

function safeReason(error, fallback) {
  const value = String(error && error.message || '');
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(value) ? value : fallback;
}

function readKey(keyPath) {
  const text = fs.readFileSync(keyPath, 'utf8').trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error('BACKUP_KEY_FORMAT_INVALID');
  const key = Buffer.from(text, 'base64');
  if (key.length !== KEY_BYTES) throw new Error('BACKUP_KEY_LENGTH_INVALID');
  return key;
}

function readAuthProfile(authPath, profileName) {
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  const profile = auth && auth.tokens && auth.tokens[profileName];
  if (!profile) throw new Error('OAUTH_PROFILE_NOT_FOUND');
  const clientId = profile.client_id;
  const clientSecret = profile.client_secret;
  const refreshToken = profile.refresh_token;
  if (![clientId, clientSecret, refreshToken].every((value) => typeof value === 'string' && value.length > 0)) {
    throw new Error('OAUTH_PROFILE_INCOMPLETE');
  }
  return { clientId, clientSecret, refreshToken };
}

async function refreshOAuth(authPath, profileName) {
  const profile = readAuthProfile(authPath, profileName);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: profile.clientId,
      client_secret: profile.clientSecret,
      refresh_token: profile.refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const payload = await response.json().catch(() => null);
  const accessToken = payload && payload.access_token;
  if (!response.ok || typeof accessToken !== 'string' || !accessToken) throw new Error('OAUTH_TOKEN_REFRESH_FAILED');
  return accessToken;
}

function localSourceTreeHash(sourceRoot) {
  const root = path.resolve(sourceRoot);
  const names = listDeployFiles(root);
  const descriptors = names.map((name) => {
    const sourcePath = path.join(root, name);
    const stat = fs.lstatSync(sourcePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('BACKUP_LOCAL_SOURCE_FILE_INVALID');
    const bytes = fs.readFileSync(sourcePath);
    return { path: name, sha256: sha256(bytes), size: bytes.length };
  });
  return stableFileSetHash(descriptors);
}

async function runBackupFunction(deploymentId, accessToken, functionName, parameters) {
  const response = await fetch(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(deploymentId)}:run`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ function: functionName, parameters, devMode: false })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) throw new Error('BACKUP_EXECUTION_TRANSPORT_FAILED');
  if (payload.error) {
    const message = String(payload.error && payload.error.details && payload.error.details[0]
      && payload.error.details[0].errorMessage || '');
    const known = message.match(/BACKUP_SOURCE_[A-Z0-9_]+/);
    throw new Error(known ? known[0] : 'BACKUP_EXECUTION_FAILED');
  }
  const result = payload.response && payload.response.result;
  if (typeof result !== 'string') throw new Error('BACKUP_EXECUTION_RESPONSE_INVALID');
  try {
    return JSON.parse(result);
  } catch (_) {
    throw new Error('BACKUP_EXECUTION_RESPONSE_INVALID');
  }
}

function validateDescribe(describe, expectedSourceTreeHash) {
  if (!describe || describe.format !== SOURCE_FORMAT || describe.schemaVersion !== SOURCE_SCHEMA_VERSION
      || !Array.isArray(describe.sheets) || describe.sheets.length !== describe.sheetCount) {
    throw new Error('BACKUP_SOURCE_METADATA_INVALID');
  }
  if (!SHA_RE.test(String(describe.sourceBuildSha || ''))) throw new Error('BACKUP_SOURCE_BUILD_ID_INVALID');
  if (!/^[0-9a-f]{64}$/.test(String(describe.sourceTreeHash || ''))) throw new Error('BACKUP_SOURCE_TREE_ID_INVALID');
  if (describe.sourceTreeHash !== expectedSourceTreeHash) throw new Error('BACKUP_RUNTIME_SOURCE_TREE_MISMATCH');
  return true;
}

async function fetchWorkbookSourceDirect(options) {
  const deploymentId = String(options.deploymentId || '');
  if (!/^AKfy[A-Za-z0-9_-]+$/.test(deploymentId)) throw new Error('API_DEPLOYMENT_ID_INVALID');

  const expectedSourceTreeHash = localSourceTreeHash(options.sourceRoot);
  const accessToken = await refreshOAuth(options.authPath, options.profileName);
  const describe = await runBackupFunction(deploymentId, accessToken, 'prhBackupDescribe', []);
  validateDescribe(describe, expectedSourceTreeHash);

  const sheets = [];
  for (const metadata of describe.sheets) {
    if (!metadata || !metadata.name || !Number.isInteger(metadata.lastRow) || metadata.lastRow < 0
        || !Number.isInteger(metadata.lastColumn) || metadata.lastColumn < 0) {
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

  return { sourceMeta: describe, sheets, expectedSourceTreeHash };
}

async function commandBackup(args) {
  if (!args.deployment || !args.key || !args.out) throw new Error('BACKUP_DIRECT_REQUIRED_ARGUMENTS_MISSING');
  const authPath = path.resolve(args.auth || path.join(os.homedir(), '.clasprc.json'));
  const sourceRoot = path.resolve(args.source || '.');
  const keyPath = path.resolve(String(args.key));
  const outPath = path.resolve(String(args.out));
  const profileName = String(args.user || 'prihrash-ci');
  const key = readKey(keyPath);

  const { sourceMeta, sheets } = await fetchWorkbookSourceDirect({
    authPath,
    profileName,
    sourceRoot,
    deploymentId: String(args.deployment)
  });
  const pkg = buildPortablePackage(sourceMeta, sheets, new Date().toISOString());
  const result = writeEncryptedBackup(outPath, pkg, key);
  return {
    status: 'BACKUP_CREATED',
    encrypted: true,
    format: 'PRH_ENCRYPTED_BACKUP_V1',
    backupCipherSha256: result.cipherSha256,
    sourceBuildBound: true,
    runtimeSourceTreeBound: true
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const command = args._[0];
    if (command !== 'backup') throw new Error('BACKUP_COMMAND_INVALID');
    const result = await commandBackup(args);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'FAIL', reason: safeReason(error, 'BACKUP_DIRECT_FAILED') })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  SOURCE_FORMAT,
  SOURCE_SCHEMA_VERSION,
  MAX_CHUNK_ROWS,
  parseArgs,
  safeReason,
  localSourceTreeHash,
  validateDescribe,
  fetchWorkbookSourceDirect
};
